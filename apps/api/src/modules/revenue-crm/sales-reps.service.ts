import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class SalesRepsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List sales reps with pagination & optional search/branch filter.
   */
  async findAll(
    tenantId: string,
    query: { page?: number; limit?: number; branchId?: string; search?: string },
  ) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId };

    if (query.branchId) {
      where.branchId = query.branchId;
    }

    if (query.search) {
      where.name = { contains: query.search, mode: "insensitive" };
    }

    const [data, total] = await Promise.all([
      this.prisma.salesRep.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.salesRep.count({ where }),
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

  /**
   * Single sales rep with last 10 visits.
   */
  async findOne(tenantId: string, id: string) {
    const rep = await this.prisma.salesRep.findFirst({
      where: { id, tenantId },
      include: {
        visits: {
          orderBy: { visitDate: "desc" },
          take: 10,
        },
        targets: {
          orderBy: [{ year: "desc" }, { month: "desc" }],
          take: 3,
        },
      },
    });

    if (!rep) {
      throw new NotFoundException(`Sales rep ${id} not found`);
    }

    return rep;
  }

  /**
   * Create a new sales rep.
   */
  async create(tenantId: string, dto: Record<string, unknown>) {
    return this.prisma.salesRep.create({
      data: {
        tenantId,
        ...dto,
      } as never,
    });
  }

  /**
   * Update an existing sales rep.
   */
  async update(tenantId: string, id: string, dto: Record<string, unknown>) {
    const existing = await this.prisma.salesRep.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException(`Sales rep ${id} not found`);
    }

    return this.prisma.salesRep.update({
      where: { id },
      data: dto as never,
    });
  }

  /**
   * Performance stats for a rep: visits this month, revenue MTD, targets, etc.
   */
  async getStats(tenantId: string, id: string) {
    const rep = await this.prisma.salesRep.findFirst({
      where: { id, tenantId },
    });

    if (!rep) {
      throw new NotFoundException(`Sales rep ${id} not found`);
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [visitsThisMonth, currentTarget] = await Promise.all([
      this.prisma.salesVisit.count({
        where: {
          tenantId,
          repId: id,
          visitDate: { gte: monthStart, lte: monthEnd },
        },
      }),
      this.prisma.salesTarget.findFirst({
        where: {
          tenantId,
          repId: id,
          month: now.getMonth() + 1,
          year: now.getFullYear(),
        },
      }),
    ]);

    return {
      repId: id,
      name: rep.name,
      visitsThisMonth,
      visitTarget: rep.visitTarget,
      revenueMTD: rep.revenueMTD,
      revenueTarget: rep.revenueTarget,
      newDoctorTarget: rep.newDoctorTarget,
      newDealTarget: rep.newDealTarget,
      revSharePct: rep.revSharePct,
      revShareEarned: rep.revShareEarned,
      currentMonthTarget: currentTarget,
    };
  }

  /**
   * Paginated visits for a rep, optionally filtered by date range.
   */
  async getVisits(
    tenantId: string,
    repId: string,
    query: { page?: number; limit?: number; from?: string; to?: string },
  ) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId, repId };

    if (query.from || query.to) {
      const dateFilter: Record<string, Date> = {};
      if (query.from) dateFilter.gte = new Date(query.from);
      if (query.to) {
        const toDate = new Date(query.to);
        toDate.setHours(23, 59, 59, 999);
        dateFilter.lte = toDate;
      }
      where.visitDate = dateFilter;
    }

    const [data, total] = await Promise.all([
      this.prisma.salesVisit.findMany({
        where,
        skip,
        take: limit,
        orderBy: { visitDate: "desc" },
      }),
      this.prisma.salesVisit.count({ where }),
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

  /**
   * Log a new sales visit.
   */
  async logVisit(tenantId: string, dto: Record<string, unknown>) {
    return this.prisma.salesVisit.create({
      data: {
        tenantId,
        ...dto,
      } as never,
    });
  }

  /**
   * List SalesTarget records, optionally filtered by repId and/or month/year.
   */
  async getTargets(
    tenantId: string,
    query: { repId?: string; month?: number; year?: number },
  ) {
    const where: Record<string, unknown> = { tenantId };

    if (query.repId) where.repId = query.repId;
    if (query.month) where.month = query.month;
    if (query.year) where.year = query.year;

    return this.prisma.salesTarget.findMany({
      where,
      orderBy: [{ year: "desc" }, { month: "desc" }],
      include: {
        rep: {
          select: { id: true, name: true, employeeCode: true },
        },
      },
    });
  }

  /**
   * Upsert a monthly SalesTarget for a rep.
   */
  async setTarget(tenantId: string, dto: Record<string, unknown>) {
    const { repId, month, year, ...rest } = dto as {
      repId: string;
      month: number;
      year: number;
      [key: string]: unknown;
    };

    return this.prisma.salesTarget.upsert({
      where: {
        tenantId_repId_month_year: {
          tenantId,
          repId,
          month,
          year,
        },
      },
      update: rest as never,
      create: {
        tenantId,
        repId,
        month,
        year,
        ...rest,
      } as never,
    });
  }
}
