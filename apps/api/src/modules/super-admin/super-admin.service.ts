import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import type { ProvisionTenantDto } from './dto/provision-tenant.dto';
import { Prisma, Role, TenantStatus, SubStatus, BillingCycle } from '@prisma/client';

@Injectable()
export class SuperAdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Platform Stats ────────────────────────────────────────
  async getPlatformStats() {
    const [
      totalTenants,
      activeTenants,
      suspendedTenants,
      totalUsers,
      totalOrders,
      subscriptions,
      trialTenants,
    ] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { status: TenantStatus.ACTIVE } }),
      this.prisma.tenant.count({ where: { status: TenantStatus.SUSPENDED } }),
      this.prisma.user.count(),
      this.prisma.order.count(),
      this.prisma.tenantSubscription.findMany({
        where: { status: { in: [SubStatus.ACTIVE, SubStatus.TRIAL] } },
        select: { mrr: true, status: true },
      }),
      this.prisma.tenant.count({
        where: {
          subscription: { status: SubStatus.TRIAL },
        },
      }),
    ]);

    const totalMRR = subscriptions
      .filter((s) => s.status === SubStatus.ACTIVE)
      .reduce((sum, s) => sum + s.mrr, 0);

    const arr = totalMRR * 12;

    return {
      totalTenants,
      activeTenants,
      suspendedTenants,
      trialTenants,
      totalUsers,
      totalOrders,
      totalMRR,
      arr,
    };
  }

  // ─── MRR Trend ────────────────────────────────────────────
  async getMRRTrend(months = 12) {
    const result: Array<{ month: string; mrr: number }> = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);

      const subs = await this.prisma.tenantSubscription.findMany({
        where: {
          status: SubStatus.ACTIVE,
          startedAt: { lte: monthEnd },
          OR: [{ cancelledAt: null }, { cancelledAt: { gte: monthStart } }],
        },
        select: { mrr: true },
      });

      const mrr = subs.reduce((sum, s) => sum + s.mrr, 0);
      result.push({
        month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        mrr,
      });
    }

    return result;
  }

  // ─── List Tenants ─────────────────────────────────────────
  async listTenants(query: {
    page: number;
    limit: number;
    status?: string;
    search?: string;
    planId?: string;
  }) {
    const { page, limit, status, search, planId } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.TenantWhereInput = {
      ...(status ? { status: status as TenantStatus } : {}),
      ...(planId ? { planId } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { slug: { contains: search, mode: 'insensitive' } },
              { adminEmail: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [tenants, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          subscription: { include: { plan: true } },
          subscriptionPlan: true,
          _count: { select: { users: true, branches: true, orders: true } },
        },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return { tenants, total, page, limit, pages: Math.ceil(total / limit) };
  }

  // ─── Tenant Detail ────────────────────────────────────────
  async getTenantDetail(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        subscription: { include: { plan: true, invoices: { take: 5, orderBy: { createdAt: 'desc' } } } },
        subscriptionPlan: true,
        branches: { where: { isActive: true } },
        featureFlagOverrides: { include: { flag: true } },
        _count: {
          select: {
            users: true,
            orders: true,
            patients: true,
            branches: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    // Get recent audit logs for this tenant
    const auditLogs = await this.prisma.tenantAuditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return { ...tenant, auditLogs };
  }

  // ─── Provision Tenant ─────────────────────────────────────
  async provisionTenant(dto: ProvisionTenantDto, actorId: string) {
    const {
      labName,
      adminEmail,
      adminFirstName,
      adminLastName,
      adminPassword,
      planName,
      billingCycle = 'MONTHLY',
      trialDays = 0,
      city,
    } = dto;

    // Find plan
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { name: planName },
    });
    if (!plan) {
      throw new BadRequestException(`Plan '${planName}' not found`);
    }

    // Check email uniqueness
    const existingUser = await this.prisma.user.findFirst({
      where: { email: adminEmail },
    });
    if (existingUser) {
      throw new BadRequestException(`User with email '${adminEmail}' already exists`);
    }

    // Generate slug from lab name
    const baseSlug = labName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const existingSlug = await this.prisma.tenant.findUnique({ where: { slug: baseSlug } });
    const slug = existingSlug ? `${baseSlug}-${Date.now()}` : baseSlug;

    const password = adminPassword ?? 'Admin@123';
    const passwordHash = await bcrypt.hash(password, 10);

    const now = new Date();
    const trialEndsAt = trialDays > 0 ? new Date(now.getTime() + trialDays * 86400000) : null;
    const periodStart = trialEndsAt ?? now;
    const periodEnd = new Date(periodStart);
    if (billingCycle === 'ANNUAL') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    const mrr =
      billingCycle === 'ANNUAL'
        ? Math.round(plan.annualPrice / 12)
        : plan.monthlyPrice;

    const subStatus: SubStatus = trialDays > 0 ? SubStatus.TRIAL : SubStatus.ACTIVE;
    const billingCycleEnum: BillingCycle =
      billingCycle === 'ANNUAL' ? BillingCycle.ANNUAL : BillingCycle.MONTHLY;

    // Transactional provisioning
    const tenant = await this.prisma.$transaction(async (tx) => {
      // 1. Create tenant
      const newTenant = await tx.tenant.create({
        data: {
          name: labName,
          slug,
          plan: planName.toLowerCase(),
          isActive: true,
          status: TenantStatus.ACTIVE,
          provisionedAt: now,
          adminEmail,
          maxUsers: plan.maxUsers,
          maxBranches: plan.maxBranches,
          planId: plan.id,
          config: {},
        },
      });

      // 2. Create default branch
      await tx.tenantBranch.create({
        data: {
          tenantId: newTenant.id,
          name: `Main Branch${city ? ` - ${city}` : ''}`,
          city: city ?? null,
          isActive: true,
        },
      });

      // 3. Create admin user
      await tx.user.create({
        data: {
          tenantId: newTenant.id,
          email: adminEmail,
          firstName: adminFirstName,
          lastName: adminLastName,
          role: Role.TENANT_ADMIN,
          passwordHash,
          isActive: true,
        },
      });

      // 4. Create subscription
      await tx.tenantSubscription.create({
        data: {
          tenantId: newTenant.id,
          planId: plan.id,
          status: subStatus,
          billingCycle: billingCycleEnum,
          startedAt: now,
          trialEndsAt,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          mrr,
        },
      });

      // 5. Apply feature flag overrides based on plan features
      const allFlags = await tx.featureFlag.findMany();
      for (const flag of allFlags) {
        const enabled = plan.features.includes(flag.key);
        await tx.featureFlagOverride.create({
          data: {
            flagId: flag.id,
            tenantId: newTenant.id,
            value: enabled,
            setById: actorId,
          },
        });
      }

      return newTenant;
    });

    // Audit log (outside transaction)
    await this.logAction(actorId, 'TENANT_PROVISIONED', 'Tenant', tenant.id, {
      labName,
      planName,
      billingCycle,
      adminEmail,
    });

    return { message: 'Tenant provisioned successfully', tenantId: tenant.id, slug };
  }

  // ─── Suspend Tenant ───────────────────────────────────────
  async suspendTenant(tenantId: string, reason: string, actorId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException(`Tenant ${tenantId} not found`);
    if (tenant.status === TenantStatus.SUSPENDED) {
      throw new BadRequestException('Tenant is already suspended');
    }

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        status: TenantStatus.SUSPENDED,
        suspendedAt: new Date(),
        suspendReason: reason,
        isActive: false,
      },
    });

    await this.logAction(actorId, 'TENANT_SUSPENDED', 'Tenant', tenantId, { reason });
    return { message: 'Tenant suspended successfully' };
  }

  // ─── Reactivate Tenant ────────────────────────────────────
  async reactivateTenant(tenantId: string, actorId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException(`Tenant ${tenantId} not found`);
    if (tenant.status === TenantStatus.ACTIVE) {
      throw new BadRequestException('Tenant is already active');
    }

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        status: TenantStatus.ACTIVE,
        suspendedAt: null,
        suspendReason: null,
        isActive: true,
      },
    });

    await this.logAction(actorId, 'TENANT_REACTIVATED', 'Tenant', tenantId, {});
    return { message: 'Tenant reactivated successfully' };
  }

  // ─── Change Plan ──────────────────────────────────────────
  async changePlan(tenantId: string, newPlanName: string, actorId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException(`Tenant ${tenantId} not found`);

    const newPlan = await this.prisma.subscriptionPlan.findUnique({
      where: { name: newPlanName },
    });
    if (!newPlan) throw new BadRequestException(`Plan '${newPlanName}' not found`);

    const oldPlanName = tenant.plan;

    // Update tenant plan
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        planId: newPlan.id,
        plan: newPlanName.toLowerCase(),
        maxUsers: newPlan.maxUsers,
        maxBranches: newPlan.maxBranches,
      },
    });

    // Update subscription
    const sub = await this.prisma.tenantSubscription.findUnique({
      where: { tenantId },
    });
    if (sub) {
      const newMrr =
        sub.billingCycle === BillingCycle.ANNUAL
          ? Math.round(newPlan.annualPrice / 12)
          : newPlan.monthlyPrice;

      await this.prisma.tenantSubscription.update({
        where: { tenantId },
        data: { planId: newPlan.id, mrr: newMrr },
      });
    }

    // Update feature flag overrides based on new plan
    const allFlags = await this.prisma.featureFlag.findMany();
    for (const flag of allFlags) {
      const enabled = newPlan.features.includes(flag.key);
      await this.prisma.featureFlagOverride.upsert({
        where: { flagId_tenantId: { flagId: flag.id, tenantId } },
        update: { value: enabled, setById: actorId, setAt: new Date() },
        create: {
          flagId: flag.id,
          tenantId,
          value: enabled,
          setById: actorId,
        },
      });
    }

    await this.logAction(actorId, 'TENANT_PLAN_CHANGED', 'Tenant', tenantId, {
      oldPlan: oldPlanName,
      newPlan: newPlanName,
    });

    return { message: `Plan changed to ${newPlanName} successfully` };
  }

  // ─── Feature Flags ────────────────────────────────────────
  async listFeatureFlags() {
    return this.prisma.featureFlag.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }] });
  }

  async getTenantFlags(tenantId: string) {
    const flags = await this.prisma.featureFlag.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    const overrides = await this.prisma.featureFlagOverride.findMany({
      where: { tenantId },
    });

    const overrideMap = new Map(overrides.map((o) => [o.flagId, o.value]));

    return flags.map((flag) => ({
      ...flag,
      effectiveValue: overrideMap.has(flag.id)
        ? overrideMap.get(flag.id)
        : flag.defaultValue,
      hasOverride: overrideMap.has(flag.id),
    }));
  }

  async setFeatureFlag(
    tenantId: string,
    flagKey: string,
    value: boolean,
    actorId: string,
  ) {
    const flag = await this.prisma.featureFlag.findUnique({ where: { key: flagKey } });
    if (!flag) throw new NotFoundException(`Feature flag '${flagKey}' not found`);

    await this.prisma.featureFlagOverride.upsert({
      where: { flagId_tenantId: { flagId: flag.id, tenantId } },
      update: { value, setById: actorId, setAt: new Date() },
      create: { flagId: flag.id, tenantId, value, setById: actorId },
    });

    await this.logAction(actorId, 'FEATURE_FLAG_SET', 'FeatureFlag', flag.id, {
      tenantId,
      flagKey,
      value,
    });

    return { message: `Feature flag '${flagKey}' set to ${value}` };
  }

  // ─── Usage ────────────────────────────────────────────────
  async getCurrentUsage(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { subscriptionPlan: true },
    });
    if (!tenant) throw new NotFoundException(`Tenant ${tenantId} not found`);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const [activeUsers, ordersThisMonth, patients, branches] = await Promise.all([
      this.prisma.user.count({ where: { tenantId, isActive: true } }),
      this.prisma.order.count({
        where: {
          tenantId,
          createdAt: { gte: monthStart, lte: monthEnd },
        },
      }),
      this.prisma.patient.count({ where: { tenantId, isActive: true } }),
      this.prisma.tenantBranch.count({ where: { tenantId, isActive: true } }),
    ]);

    const plan = tenant.subscriptionPlan;

    return {
      tenantId,
      usage: {
        activeUsers: {
          current: activeUsers,
          limit: tenant.maxUsers,
          unlimited: tenant.maxUsers === -1,
          percentage: tenant.maxUsers > 0 ? Math.round((activeUsers / tenant.maxUsers) * 100) : 0,
        },
        ordersThisMonth: {
          current: ordersThisMonth,
          limit: plan?.maxOrdersPerMonth ?? 0,
          unlimited: (plan?.maxOrdersPerMonth ?? 0) === -1,
          percentage:
            plan && plan.maxOrdersPerMonth > 0
              ? Math.round((ordersThisMonth / plan.maxOrdersPerMonth) * 100)
              : 0,
        },
        patients: {
          current: patients,
          limit: null,
          unlimited: true,
        },
        branches: {
          current: branches,
          limit: tenant.maxBranches,
          unlimited: tenant.maxBranches === -1,
          percentage:
            tenant.maxBranches > 0
              ? Math.round((branches / tenant.maxBranches) * 100)
              : 0,
        },
      },
      period: { start: monthStart, end: monthEnd },
    };
  }

  // ─── Platform Health ──────────────────────────────────────
  async getPlatformHealth() {
    const checks: Array<{ service: string; status: string; latencyMs?: number }> = [];

    // DB health
    const dbStart = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.push({ service: 'database', status: 'healthy', latencyMs: Date.now() - dbStart });
    } catch {
      checks.push({ service: 'database', status: 'unhealthy', latencyMs: Date.now() - dbStart });
    }

    const allHealthy = checks.every((c) => c.status === 'healthy');

    return {
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  // ─── Audit Log ────────────────────────────────────────────
  async logAction(
    actorId: string,
    action: string,
    targetType?: string,
    targetId?: string,
    details?: Record<string, unknown>,
  ) {
    return this.prisma.tenantAuditLog.create({
      data: {
        actorId,
        action,
        targetType,
        targetId,
        details: details as object,
        tenantId: targetType === 'Tenant' ? targetId : undefined,
      },
    });
  }

  async getAuditLog(query: {
    page: number;
    limit: number;
    tenantId?: string;
    action?: string;
  }) {
    const { page, limit, tenantId, action } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.TenantAuditLogWhereInput = {
      ...(tenantId ? { tenantId } : {}),
      ...(action ? { action: { contains: action, mode: 'insensitive' } } : {}),
    };

    const [logs, total] = await Promise.all([
      this.prisma.tenantAuditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.tenantAuditLog.count({ where }),
    ]);

    return { logs, total, page, limit, pages: Math.ceil(total / limit) };
  }
}
