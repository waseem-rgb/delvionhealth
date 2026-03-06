import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { Prisma } from "@prisma/client";

export interface CreateOrganizationDto {
  name: string;
  code: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  gstNumber?: string;
  creditDays?: number;
  discountPct?: number;
}

export interface UpdateOrganizationDto {
  name?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  gstNumber?: string;
  creditDays?: number;
  discountPct?: number;
}

export interface OrganizationQueryDto {
  search?: string;
  page?: number;
  limit?: number;
  isActive?: boolean;
}

@Injectable()
export class OrganizationService {
  private readonly logger = new Logger(OrganizationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, query: OrganizationQueryDto = {}) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.OrganizationWhereInput = {
      tenantId,
      ...(query.isActive !== undefined && { isActive: query.isActive }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: "insensitive" } },
          { code: { contains: query.search, mode: "insensitive" } },
          { contactPerson: { contains: query.search, mode: "insensitive" } },
          { city: { contains: query.search, mode: "insensitive" } },
        ],
      }),
    };

    const [organizations, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: "asc" },
      }),
      this.prisma.organization.count({ where }),
    ]);

    return {
      data: organizations,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(tenantId: string, id: string) {
    const org = await this.prisma.organization.findFirst({
      where: { id, tenantId },
      include: {
        b2bInvoices: {
          take: 5,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            paidAmount: true,
            status: true,
            dueDate: true,
            createdAt: true,
          },
        },
      },
    });
    if (!org) throw new NotFoundException("Organization not found");

    // Compute stats
    const invoiceAgg = await this.prisma.b2BInvoice.aggregate({
      where: { tenantId, organizationId: id },
      _sum: { totalAmount: true, paidAmount: true },
      _count: true,
    });

    return {
      ...org,
      stats: {
        totalInvoices: invoiceAgg._count,
        totalInvoiced: invoiceAgg._sum.totalAmount ?? 0,
        totalPaid: invoiceAgg._sum.paidAmount ?? 0,
        outstanding: (invoiceAgg._sum.totalAmount ?? 0) - (invoiceAgg._sum.paidAmount ?? 0),
      },
    };
  }

  async create(tenantId: string, dto: CreateOrganizationDto) {
    // Check unique code within tenant
    const existing = await this.prisma.organization.findUnique({
      where: { tenantId_code: { tenantId, code: dto.code } },
    });
    if (existing) {
      throw new ConflictException(`Organization with code '${dto.code}' already exists`);
    }

    return this.prisma.organization.create({
      data: {
        tenantId,
        name: dto.name,
        code: dto.code,
        contactPerson: dto.contactPerson,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        city: dto.city,
        gstNumber: dto.gstNumber,
        creditDays: dto.creditDays ?? 30,
        discountPct: dto.discountPct ?? 0,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateOrganizationDto) {
    const org = await this.prisma.organization.findFirst({
      where: { id, tenantId },
    });
    if (!org) throw new NotFoundException("Organization not found");

    return this.prisma.organization.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.contactPerson !== undefined && { contactPerson: dto.contactPerson }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.gstNumber !== undefined && { gstNumber: dto.gstNumber }),
        ...(dto.creditDays !== undefined && { creditDays: dto.creditDays }),
        ...(dto.discountPct !== undefined && { discountPct: dto.discountPct }),
      },
    });
  }

  async remove(tenantId: string, id: string) {
    const org = await this.prisma.organization.findFirst({
      where: { id, tenantId },
    });
    if (!org) throw new NotFoundException("Organization not found");

    return this.prisma.organization.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
