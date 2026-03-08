import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class CorporateContractsService {
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
      this.prisma.corporateContract.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.corporateContract.count({ where }),
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
    const contract = await this.prisma.corporateContract.findFirst({
      where: { id, tenantId },
    });

    if (!contract) {
      throw new NotFoundException(`Corporate contract ${id} not found`);
    }

    return contract;
  }

  async create(
    tenantId: string,
    dto: Record<string, unknown>,
    userId: string,
  ) {
    return this.prisma.corporateContract.create({
      data: {
        ...dto,
        tenantId,
        createdById: userId,
        contractStart: new Date(dto.contractStart as string),
        contractEnd: new Date(dto.contractEnd as string),
      } as never,
    });
  }

  async update(
    tenantId: string,
    id: string,
    dto: Record<string, unknown>,
  ) {
    const result = await this.prisma.corporateContract.updateMany({
      where: { id, tenantId },
      data: dto as never,
    });

    if (result.count === 0) {
      throw new NotFoundException(`Corporate contract ${id} not found`);
    }

    return this.prisma.corporateContract.findFirst({
      where: { id, tenantId },
    });
  }

  async getUtilization(tenantId: string, id: string) {
    const contract = await this.prisma.corporateContract.findFirst({
      where: { id, tenantId },
    });

    if (!contract) {
      throw new NotFoundException(`Corporate contract ${id} not found`);
    }

    return {
      ...contract,
      enrolledCount: (contract as Record<string, unknown>).enrolledCount ?? 0,
      completedCount: (contract as Record<string, unknown>).completedCount ?? 0,
      employeeCount: (contract as Record<string, unknown>).employeeCount ?? 0,
    };
  }
}
