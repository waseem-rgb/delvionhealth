import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class B2bAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    query: {
      page?: number;
      limit?: number;
      type?: string;
      status?: string;
      search?: string;
    },
  ) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId };

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { contactPerson: { contains: query.search, mode: "insensitive" } },
        { phone: { contains: query.search } },
        { email: { contains: query.search, mode: "insensitive" } },
      ];
    }

    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.b2BAccount.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.b2BAccount.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(tenantId: string, id: string) {
    const account = await this.prisma.b2BAccount.findFirst({
      where: { id, tenantId },
    });

    if (!account) {
      throw new NotFoundException("B2B account not found");
    }

    return account;
  }

  async create(tenantId: string, dto: Record<string, unknown>, userId: string) {
    return this.prisma.b2BAccount.create({
      data: {
        tenantId,
        type: dto.type as string,
        name: dto.name as string,
        contactPerson: dto.contactPerson as string | undefined,
        phone: dto.phone as string | undefined,
        email: dto.email as string | undefined,
        address: dto.address as string | undefined,
        city: dto.city as string | undefined,
        pincode: dto.pincode as string | undefined,
        website: dto.website as string | undefined,
        rateListId: dto.rateListId as string | undefined,
        creditDays: dto.creditDays as number | undefined,
        creditLimit: dto.creditLimit as number | undefined,
        paymentTerms: dto.paymentTerms as string | undefined,
        pickupSchedule: dto.pickupSchedule as string | undefined,
        tatSlaHours: dto.tatSlaHours as number | undefined,
        platformName: dto.platformName as string | undefined,
        platformCommissionPct: dto.platformCommissionPct as number | undefined,
        status: (dto.status as string) || "ACTIVE",
        assignedRepId: dto.assignedRepId as string | undefined,
        addedById: userId,
      },
    });
  }

  async update(tenantId: string, id: string, dto: Record<string, unknown>) {
    const account = await this.prisma.b2BAccount.findFirst({
      where: { id, tenantId },
    });

    if (!account) {
      throw new NotFoundException("B2B account not found");
    }

    return this.prisma.b2BAccount.update({
      where: { id },
      data: dto,
    });
  }

  async getStats(tenantId: string, id: string) {
    const account = await this.prisma.b2BAccount.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        name: true,
        type: true,
        totalRevenue: true,
        revenueMTD: true,
        outstandingAmt: true,
        creditLimit: true,
        creditDays: true,
        status: true,
      },
    });

    if (!account) {
      throw new NotFoundException("B2B account not found");
    }

    return {
      account,
      revenue: {
        total: account.totalRevenue,
        mtd: account.revenueMTD,
        outstanding: account.outstandingAmt,
      },
    };
  }
}
