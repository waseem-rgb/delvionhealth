import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AiService } from "../ai/ai.service";
import type { Prisma } from "@prisma/client";
import * as bcrypt from "bcryptjs";

@Injectable()
export class OrganisationsService {
  private readonly logger = new Logger(OrganisationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  // ─── List ─────────────────────────────────────────────────────────────

  async findAll(
    tenantId: string,
    query: { search?: string; paymentType?: string; isActive?: boolean },
  ) {
    const where: Prisma.OrganizationWhereInput = { tenantId };

    if (query.paymentType) where.paymentType = query.paymentType;
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { code: { contains: query.search, mode: "insensitive" } },
        { phone: { contains: query.search } },
      ];
    }

    return this.prisma.organization.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        rateList: { select: { id: true, name: true } },
        parentOrg: { select: { id: true, name: true } },
        _count: { select: { orders: true, subOrgs: true } },
      },
    });
  }

  // ─── Find One ─────────────────────────────────────────────────────────

  async findOne(id: string, tenantId: string) {
    const org = await this.prisma.organization.findFirst({
      where: { id, tenantId },
      include: {
        rateList: { select: { id: true, name: true } },
        parentOrg: { select: { id: true, name: true } },
        subOrgs: { select: { id: true, name: true, code: true, isActive: true } },
        _count: { select: { orders: true, invoices: true, b2bInvoices: true } },
      },
    });
    if (!org) throw new NotFoundException("Organisation not found");
    return org;
  }

  // ─── Create ───────────────────────────────────────────────────────────

  async create(
    tenantId: string,
    data: {
      name: string;
      code?: string;
      contactPerson?: string;
      email?: string;
      phone?: string;
      address?: string;
      city?: string;
      state?: string;
      pincode?: string;
      gstNumber?: string;
      panNumber?: string;
      paymentType?: string;
      creditDays?: number;
      creditLimit?: number;
      startingAdvance?: number;
      loginType?: string;
      loginEmail?: string;
      loginPassword?: string;
      showHeaderFooter?: boolean;
      autoReportEmail?: boolean;
      autoReportWhatsapp?: boolean;
      patientCommMode?: string;
      alwaysShowMRP?: boolean;
      showOnlyPaidReports?: boolean;
      showSecondaryUnits?: boolean;
      reportAccess?: string;
      rateListId?: string;
      parentOrgId?: string;
    },
  ) {
    // Auto-generate code if not provided
    const code = data.code || data.name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);

    // Check unique code
    const existing = await this.prisma.organization.findFirst({
      where: { tenantId, code },
    });
    if (existing) throw new ConflictException(`Organisation with code "${code}" already exists`);

    // Hash password if provided
    let hashedPassword: string | undefined;
    if (data.loginPassword) {
      hashedPassword = await bcrypt.hash(data.loginPassword, 10);
    }

    const org = await this.prisma.organization.create({
      data: {
        tenantId,
        name: data.name,
        code,
        contactPerson: data.contactPerson,
        email: data.email,
        phone: data.phone,
        address: data.address,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        gstNumber: data.gstNumber,
        panNumber: data.panNumber,
        paymentType: data.paymentType || "WALKIN",
        creditDays: data.creditDays ?? 30,
        creditLimit: data.creditLimit,
        startingAdvance: data.startingAdvance,
        currentBalance: data.startingAdvance ?? 0,
        loginType: data.loginType || "NO_LOGIN",
        loginEmail: data.loginEmail,
        loginPassword: hashedPassword,
        showHeaderFooter: data.showHeaderFooter ?? false,
        autoReportEmail: data.autoReportEmail ?? false,
        autoReportWhatsapp: data.autoReportWhatsapp ?? false,
        patientCommMode: data.patientCommMode || "REPORTS_ONLY",
        alwaysShowMRP: data.alwaysShowMRP ?? false,
        showOnlyPaidReports: data.showOnlyPaidReports ?? true,
        showSecondaryUnits: data.showSecondaryUnits ?? false,
        reportAccess: data.reportAccess || "SIGNED",
        rateListId: data.rateListId || null,
        parentOrgId: data.parentOrgId || null,
      },
    });

    return org;
  }

  // ─── Update ───────────────────────────────────────────────────────────

  async update(id: string, tenantId: string, data: Record<string, unknown>) {
    const org = await this.prisma.organization.findFirst({ where: { id, tenantId } });
    if (!org) throw new NotFoundException("Organisation not found");

    // Hash password if being updated
    if (data.loginPassword && typeof data.loginPassword === "string") {
      data.loginPassword = await bcrypt.hash(data.loginPassword, 10);
    }

    return this.prisma.organization.update({
      where: { id },
      data: data as Prisma.OrganizationUpdateInput,
      include: {
        rateList: { select: { id: true, name: true } },
      },
    });
  }

  // ─── Soft Delete ──────────────────────────────────────────────────────

  async softDelete(id: string, tenantId: string) {
    const org = await this.prisma.organization.findFirst({ where: { id, tenantId } });
    if (!org) throw new NotFoundException("Organisation not found");

    return this.prisma.organization.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ─── Generate Login ───────────────────────────────────────────────────

  async generateLogin(
    id: string,
    tenantId: string,
    data: { loginType: string; loginEmail: string; loginPassword: string },
  ) {
    const org = await this.prisma.organization.findFirst({ where: { id, tenantId } });
    if (!org) throw new NotFoundException("Organisation not found");

    if (data.loginEmail) {
      const emailTaken = await this.prisma.organization.findFirst({
        where: { loginEmail: data.loginEmail, NOT: { id } },
      });
      if (emailTaken) throw new ConflictException("Login email already in use");
    }

    const hashed = await bcrypt.hash(data.loginPassword, 10);

    await this.prisma.organization.update({
      where: { id },
      data: {
        loginType: data.loginType,
        loginEmail: data.loginEmail,
        loginPassword: hashed,
      },
    });

    return { email: data.loginEmail, password: data.loginPassword };
  }

  // ─── Ledger ───────────────────────────────────────────────────────────

  async getLedger(id: string, tenantId: string) {
    const org = await this.prisma.organization.findFirst({ where: { id, tenantId } });
    if (!org) throw new NotFoundException("Organisation not found");

    const invoices = await this.prisma.invoice.findMany({
      where: { organizationId: id, tenantId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        invoiceNumber: true,
        total: true,
        amountPaid: true,
        balance: true,
        status: true,
        createdAt: true,
      },
    });

    const totalBilled = invoices.reduce((s, i) => s + Number(i.total), 0);
    const totalPaid = invoices.reduce((s, i) => s + Number(i.amountPaid), 0);
    const totalOutstanding = invoices.reduce((s, i) => s + Number(i.balance), 0);

    return {
      organisation: { id: org.id, name: org.name, currentBalance: Number(org.currentBalance) },
      summary: { totalBilled, totalPaid, totalOutstanding },
      invoices,
    };
  }

  // ─── Record Payment ───────────────────────────────────────────────────

  async recordPayment(
    id: string,
    tenantId: string,
    data: { amount: number; method?: string; reference?: string; notes?: string },
  ) {
    const org = await this.prisma.organization.findFirst({ where: { id, tenantId } });
    if (!org) throw new NotFoundException("Organisation not found");
    if (data.amount <= 0) throw new BadRequestException("Amount must be positive");

    const updated = await this.prisma.organization.update({
      where: { id },
      data: {
        currentBalance: { increment: data.amount },
        currentOutstanding: { decrement: Math.min(data.amount, org.currentOutstanding) },
      },
    });

    return {
      newBalance: Number(updated.currentBalance),
      newOutstanding: Number(updated.currentOutstanding),
    };
  }

  // ─── Get Org Rate List ────────────────────────────────────────────────

  async getOrgRateList(id: string, tenantId: string) {
    const org = await this.prisma.organization.findFirst({
      where: { id, tenantId },
      select: { rateListId: true, name: true },
    });
    if (!org) throw new NotFoundException("Organisation not found");
    if (!org.rateListId) return { organisation: org.name, rateListId: null, items: [] };

    const items = await this.prisma.rateListItem.findMany({
      where: { rateListId: org.rateListId, isActive: true },
      include: {
        testCatalog: {
          select: { id: true, code: true, name: true, price: true, department: true },
        },
      },
      orderBy: { testCatalog: { name: "asc" } },
    });

    return {
      organisation: org.name,
      rateListId: org.rateListId,
      items: items.map((i) => ({
        testCatalogId: i.testCatalogId,
        testCode: i.testCatalog.code,
        testName: i.testCatalog.name,
        department: i.testCatalog.department,
        mrp: Number(i.testCatalog.price),
        orgPrice: Number(i.price),
      })),
    };
  }

  // ─── Overview (KPIs + Chart Data) ───────────────────────────────────

  async getOrgOverview(id: string, tenantId: string) {
    const org = await this.prisma.organization.findFirst({ where: { id, tenantId } });
    if (!org) throw new NotFoundException("Organisation not found");

    // Invoices for this org (non-cancelled)
    const invoices = await this.prisma.invoice.findMany({
      where: { organizationId: id, tenantId, NOT: { status: "CANCELLED" } },
      select: { total: true, amountPaid: true, createdAt: true },
    });

    const totalRevenue = invoices.reduce((s, i) => s + Number(i.total), 0);
    const totalOutstanding = Number(org.currentOutstanding);
    const totalOrders = Number(org.totalOrders);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // COGS from order items
    const orderItems = await this.prisma.orderItem.findMany({
      where: { order: { organizationId: id, tenantId } },
      select: { quantity: true, testCatalog: { select: { cogs: true } } },
    });
    const totalCogs = orderItems.reduce(
      (s, i) => s + (Number(i.testCatalog.cogs ?? 0) * i.quantity),
      0,
    );
    const grossMargin = totalRevenue > 0 ? ((totalRevenue - totalCogs) / totalRevenue) * 100 : 0;

    // Monthly revenue (last 12 months)
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const monthlyInvoices = await this.prisma.invoice.findMany({
      where: {
        organizationId: id,
        tenantId,
        NOT: { status: "CANCELLED" },
        createdAt: { gte: twelveMonthsAgo },
      },
      select: { total: true, createdAt: true },
    });

    const monthlyOrderItems = await this.prisma.orderItem.findMany({
      where: {
        order: { organizationId: id, tenantId, createdAt: { gte: twelveMonthsAgo } },
      },
      select: { quantity: true, testCatalog: { select: { cogs: true } }, order: { select: { createdAt: true } } },
    });

    const revenueByMonth: { month: string; revenue: number; cogs: number }[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      const m = d.getMonth();
      const y = d.getFullYear();
      const label = `${d.toLocaleString("en", { month: "short" })} ${y}`;
      const monthRevenue = monthlyInvoices
        .filter((inv) => inv.createdAt.getMonth() === m && inv.createdAt.getFullYear() === y)
        .reduce((s, inv) => s + Number(inv.total), 0);
      const monthCogs = monthlyOrderItems
        .filter((oi) => oi.order.createdAt.getMonth() === m && oi.order.createdAt.getFullYear() === y)
        .reduce((s, oi) => s + (Number(oi.testCatalog.cogs ?? 0) * oi.quantity), 0);
      revenueByMonth.push({ month: label, revenue: monthRevenue, cogs: monthCogs });
    }

    // Top 10 tests by revenue
    const topTestsRaw = await this.prisma.orderItem.groupBy({
      by: ["testCatalogId"],
      where: { order: { organizationId: id, tenantId } },
      _count: true,
      _sum: { price: true },
      orderBy: { _sum: { price: "desc" } },
      take: 10,
    });

    const testIds = topTestsRaw.map((t) => t.testCatalogId);
    const testNames = testIds.length
      ? await this.prisma.testCatalog.findMany({
          where: { id: { in: testIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameMap = new Map(testNames.map((t) => [t.id, t.name]));

    const topTests = topTestsRaw.map((t) => ({
      testName: nameMap.get(t.testCatalogId) ?? "Unknown",
      count: t._count,
      revenue: Number(t._sum.price ?? 0),
    }));

    return {
      organisation: org,
      kpis: {
        totalOrders,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalOutstanding: Math.round(totalOutstanding * 100) / 100,
        avgOrderValue: Math.round(avgOrderValue * 100) / 100,
        grossMargin: Math.round(grossMargin * 100) / 100,
      },
      revenueByMonth,
      topTests,
    };
  }

  // ─── Paginated Invoices ─────────────────────────────────────────────

  async getOrgInvoices(
    id: string,
    tenantId: string,
    filters: { status?: string; page?: number; limit?: number; from?: string; to?: string },
  ) {
    const org = await this.prisma.organization.findFirst({ where: { id, tenantId } });
    if (!org) throw new NotFoundException("Organisation not found");

    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.InvoiceWhereInput = { organizationId: id, tenantId };
    if (filters.status) where.status = filters.status as never;
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) (where.createdAt as Record<string, Date>).gte = new Date(filters.from);
      if (filters.to) {
        const end = new Date(filters.to);
        end.setHours(23, 59, 59, 999);
        (where.createdAt as Record<string, Date>).lte = end;
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          invoiceNumber: true,
          total: true,
          amountPaid: true,
          balance: true,
          status: true,
          createdAt: true,
          order: { select: { orderNumber: true } },
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Paginated Ledger Entries ───────────────────────────────────────

  async getOrgLedgerEntries(
    id: string,
    tenantId: string,
    filters: { page?: number; limit?: number; from?: string; to?: string },
  ) {
    const org = await this.prisma.organization.findFirst({ where: { id, tenantId } });
    if (!org) throw new NotFoundException("Organisation not found");

    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.OrgLedgerWhereInput = { orgId: id, tenantId };
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) (where.createdAt as Record<string, Date>).gte = new Date(filters.from);
      if (filters.to) {
        const end = new Date(filters.to);
        end.setHours(23, 59, 59, 999);
        (where.createdAt as Record<string, Date>).lte = end;
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.orgLedger.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.orgLedger.count({ where }),
    ]);

    // Summary from org fields
    const invoices = await this.prisma.invoice.findMany({
      where: { organizationId: id, tenantId, NOT: { status: "CANCELLED" } },
      select: { total: true, amountPaid: true },
    });
    const totalBilled = invoices.reduce((s, i) => s + Number(i.total), 0);
    const totalPaid = invoices.reduce((s, i) => s + Number(i.amountPaid), 0);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      summary: {
        totalBilled: Math.round(totalBilled * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100,
        outstanding: Math.round(Number(org.currentOutstanding) * 100) / 100,
      },
    };
  }

  // ─── AI Insights ────────────────────────────────────────────────────

  async getOrgAiInsights(id: string, tenantId: string) {
    const org = await this.prisma.organization.findFirst({ where: { id, tenantId } });
    if (!org) throw new NotFoundException("Organisation not found");

    // Gather context data
    const invoiceCount = await this.prisma.invoice.count({
      where: { organizationId: id, tenantId, NOT: { status: "CANCELLED" } },
    });
    const invoices = await this.prisma.invoice.findMany({
      where: { organizationId: id, tenantId, NOT: { status: "CANCELLED" } },
      select: { total: true, amountPaid: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const totalRevenue = invoices.reduce((s, i) => s + Number(i.total), 0);
    const totalPaid = invoices.reduce((s, i) => s + Number(i.amountPaid), 0);

    const topTests = await this.prisma.orderItem.groupBy({
      by: ["testCatalogId"],
      where: { order: { organizationId: id, tenantId } },
      _count: true,
      _sum: { price: true },
      orderBy: { _sum: { price: "desc" } },
      take: 5,
    });
    const testIds = topTests.map((t) => t.testCatalogId);
    const tests = testIds.length
      ? await this.prisma.testCatalog.findMany({
          where: { id: { in: testIds } },
          select: { id: true, name: true },
        })
      : [];
    const testMap = new Map(tests.map((t) => [t.id, t.name]));

    const topTestsStr = topTests
      .map((t) => `${testMap.get(t.testCatalogId) ?? "Unknown"}: ${t._count} orders, ₹${Number(t._sum.price ?? 0).toFixed(0)} revenue`)
      .join("; ");

    const systemPrompt = `You are a diagnostic lab business analyst. Provide 3-5 concise, actionable insights about this B2B organisation client. Focus on revenue trends, payment behavior, test ordering patterns, and growth opportunities. Keep it under 300 words. Use bullet points.`;

    const userMessage = `Organisation: ${org.name} (${org.paymentType})
Total Orders: ${org.totalOrders}
Total Revenue: ₹${totalRevenue.toFixed(0)}
Total Paid: ₹${totalPaid.toFixed(0)}
Outstanding: ₹${Number(org.currentOutstanding).toFixed(0)}
Credit Limit: ₹${Number(org.creditLimit ?? 0).toFixed(0)}
Credit Days: ${org.creditDays}
Invoices: ${invoiceCount}
Top Tests: ${topTestsStr || "No orders yet"}`;

    try {
      const result = await this.aiService.complete(systemPrompt, userMessage);
      return { insights: result.text, generatedAt: new Date().toISOString(), provider: result.provider };
    } catch (err) {
      this.logger.warn(`AI insights failed for org ${id}: ${err}`);
      return { insights: "AI insights are currently unavailable. Please try again later.", generatedAt: new Date().toISOString(), provider: null };
    }
  }
}
