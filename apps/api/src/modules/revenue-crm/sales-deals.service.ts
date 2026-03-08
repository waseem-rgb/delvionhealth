import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class SalesDealsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List deals with activity count & pagination.
   */
  async findAll(
    tenantId: string,
    query: { stage?: string; assignedRepId?: string; page?: number; limit?: number },
  ) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId };

    if (query.stage) {
      where.stage = query.stage;
    }

    if (query.assignedRepId) {
      where.assignedRepId = query.assignedRepId;
    }

    const [data, total] = await Promise.all([
      this.prisma.salesDeal.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: { activities: true },
          },
        },
      }),
      this.prisma.salesDeal.count({ where }),
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
   * Single deal with activities.
   */
  async findOne(tenantId: string, id: string) {
    const deal = await this.prisma.salesDeal.findFirst({
      where: { id, tenantId },
      include: {
        activities: {
          orderBy: { doneAt: "desc" },
        },
      },
    });

    if (!deal) {
      throw new NotFoundException(`Sales deal ${id} not found`);
    }

    return deal;
  }

  /**
   * Create a new sales deal.
   */
  async create(tenantId: string, dto: Record<string, unknown>, userId: string) {
    return this.prisma.salesDeal.create({
      data: {
        tenantId,
        createdById: userId,
        ...dto,
      } as never,
    });
  }

  /**
   * Update deal stage + stageUpdatedAt.
   */
  async updateStage(tenantId: string, id: string, stage: string) {
    const existing = await this.prisma.salesDeal.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException(`Sales deal ${id} not found`);
    }

    return this.prisma.salesDeal.update({
      where: { id },
      data: {
        stage,
        stageUpdatedAt: new Date(),
      } as never,
    });
  }

  /**
   * Log an activity on a deal.
   */
  async logActivity(
    tenantId: string,
    dealId: string,
    dto: Record<string, unknown>,
    userId: string,
  ) {
    const deal = await this.prisma.salesDeal.findFirst({
      where: { id: dealId, tenantId },
    });

    if (!deal) {
      throw new NotFoundException(`Sales deal ${dealId} not found`);
    }

    return this.prisma.dealActivity.create({
      data: {
        tenantId,
        dealId,
        performedById: userId,
        ...dto,
      } as never,
    });
  }
}
