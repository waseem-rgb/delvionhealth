import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class HealthCampsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    query: { page?: number; limit?: number; status?: string },
  ) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId };
    if (query.status) {
      where.status = query.status;
    }

    const [data, total] = await Promise.all([
      this.prisma.healthCamp.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.healthCamp.count({ where }),
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
    const camp = await this.prisma.healthCamp.findFirst({
      where: { id, tenantId },
    });

    if (!camp) {
      throw new NotFoundException(`Health camp ${id} not found`);
    }

    return camp;
  }

  async create(
    tenantId: string,
    dto: Record<string, unknown>,
    userId: string,
  ) {
    return this.prisma.healthCamp.create({
      data: {
        ...dto,
        tenantId,
        createdById: userId,
        campDate: new Date(dto.campDate as string),
      } as never,
    });
  }

  async update(
    tenantId: string,
    id: string,
    dto: Record<string, unknown>,
  ) {
    const result = await this.prisma.healthCamp.updateMany({
      where: { id, tenantId },
      data: dto as never,
    });

    if (result.count === 0) {
      throw new NotFoundException(`Health camp ${id} not found`);
    }

    return this.prisma.healthCamp.findFirst({
      where: { id, tenantId },
    });
  }

  async updateStatus(tenantId: string, id: string, status: string) {
    const result = await this.prisma.healthCamp.updateMany({
      where: { id, tenantId },
      data: { status } as never,
    });

    if (result.count === 0) {
      throw new NotFoundException(`Health camp ${id} not found`);
    }

    return this.prisma.healthCamp.findFirst({
      where: { id, tenantId },
    });
  }
}
