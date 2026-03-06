import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type {
  CreateTenantDto,
  CreateBranchDto,
  UpdateTenantDto,
  UpdateTenantConfigDto,
} from "./dto/create-tenant.dto";

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTenantDto) {
    const existing = await this.prisma.tenant.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new ConflictException(`Tenant slug "${dto.slug}" is already taken`);
    }

    return this.prisma.tenant.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        plan: dto.plan ?? "starter",
        config: {},
      },
    });
  }

  async findAll() {
    return this.prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: { users: true, branches: true, patients: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        branches: { where: { isActive: true } },
        _count: {
          select: { users: true, patients: true, orders: true },
        },
      },
    });

    if (!tenant) throw new NotFoundException(`Tenant ${id} not found`);
    return tenant;
  }

  async update(id: string, dto: UpdateTenantDto) {
    await this.findOne(id);
    return this.prisma.tenant.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.plan && { plan: dto.plan }),
      },
    });
  }

  async updateConfig(id: string, dto: UpdateTenantConfigDto) {
    await this.findOne(id);
    return this.prisma.tenant.update({
      where: { id },
      data: { config: dto.config as object },
    });
  }

  async createBranch(tenantId: string, dto: CreateBranchDto) {
    await this.findOne(tenantId);

    return this.prisma.tenantBranch.create({
      data: {
        tenantId,
        name: dto.name,
        address: dto.address,
        city: dto.city,
        state: dto.state,
        country: dto.country ?? "IN",
        phone: dto.phone,
        email: dto.email,
      },
    });
  }

  async getBranches(tenantId: string) {
    await this.findOne(tenantId);
    return this.prisma.tenantBranch.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: "asc" },
    });
  }

  async updateBranch(tenantId: string, branchId: string, dto: Partial<CreateBranchDto>) {
    const branch = await this.prisma.tenantBranch.findFirst({
      where: { id: branchId, tenantId },
    });
    if (!branch) throw new NotFoundException("Branch not found");

    return this.prisma.tenantBranch.update({
      where: { id: branchId },
      data: dto,
    });
  }

  async deactivateBranch(tenantId: string, branchId: string): Promise<void> {
    const branch = await this.prisma.tenantBranch.findFirst({
      where: { id: branchId, tenantId },
    });
    if (!branch) throw new NotFoundException("Branch not found");

    await this.prisma.tenantBranch.update({
      where: { id: branchId },
      data: { isActive: false },
    });
  }

  async findById(id: string) {
    return this.prisma.tenant.findUniqueOrThrow({ where: { id } });
  }

  async updateSettings(id: string, data: Record<string, unknown>) {
    return this.prisma.tenant.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name as string } : {}),
        config: data as Parameters<typeof this.prisma.tenant.update>[0]['data']['config'],
      },
    });
  }

  // ─── Report Settings ──────────────────────────────────────────────────

  async getReportSettings(tenantId: string) {
    return this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: {
        reportHeaderHtml: true,
        reportFooterHtml: true,
        reportHeaderImageUrl: true,
        reportFooterImageUrl: true,
        showHeaderFooter: true,
        name: true,
      },
    });
  }

  async updateReportSettings(
    tenantId: string,
    data: {
      reportHeaderHtml?: string | null;
      reportFooterHtml?: string | null;
      reportHeaderImageUrl?: string | null;
      reportFooterImageUrl?: string | null;
      showHeaderFooter?: boolean;
    },
  ) {
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(data.reportHeaderHtml !== undefined ? { reportHeaderHtml: data.reportHeaderHtml } : {}),
        ...(data.reportFooterHtml !== undefined ? { reportFooterHtml: data.reportFooterHtml } : {}),
        ...(data.reportHeaderImageUrl !== undefined ? { reportHeaderImageUrl: data.reportHeaderImageUrl } : {}),
        ...(data.reportFooterImageUrl !== undefined ? { reportFooterImageUrl: data.reportFooterImageUrl } : {}),
        ...(data.showHeaderFooter !== undefined ? { showHeaderFooter: data.showHeaderFooter } : {}),
      },
      select: {
        reportHeaderHtml: true,
        reportFooterHtml: true,
        reportHeaderImageUrl: true,
        reportFooterImageUrl: true,
        showHeaderFooter: true,
      },
    });
  }
}
