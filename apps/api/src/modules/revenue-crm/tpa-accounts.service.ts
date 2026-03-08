import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class TpaAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.tPAAccount.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: { claims: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(tenantId: string, id: string) {
    const tpa = await this.prisma.tPAAccount.findFirst({
      where: { id, tenantId },
      include: { claims: true },
    });

    if (!tpa) {
      throw new NotFoundException(`TPA account ${id} not found`);
    }

    return tpa;
  }

  async create(tenantId: string, dto: Record<string, unknown>) {
    return this.prisma.tPAAccount.create({
      data: {
        ...dto,
        tenantId,
      } as never,
    });
  }

  async getClaims(
    tenantId: string,
    tpaId: string,
    query: { status?: string; page?: number; limit?: number },
  ) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId, tpaAccountId: tpaId };
    if (query.status) {
      where.status = query.status;
    }

    const [data, total] = await Promise.all([
      this.prisma.tPAClaim.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.tPAClaim.count({ where }),
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

  async addClaim(
    tenantId: string,
    tpaId: string,
    dto: Record<string, unknown>,
  ) {
    return this.prisma.tPAClaim.create({
      data: {
        ...dto,
        tenantId,
        tpaAccountId: tpaId,
        submittedDate: new Date(dto.submittedDate as string),
      } as never,
    });
  }

  async updateClaim(
    tenantId: string,
    claimId: string,
    dto: Record<string, unknown>,
  ) {
    const result = await this.prisma.tPAClaim.updateMany({
      where: { id: claimId, tenantId },
      data: dto as never,
    });

    if (result.count === 0) {
      throw new NotFoundException(`TPA claim ${claimId} not found`);
    }

    return this.prisma.tPAClaim.findFirst({
      where: { id: claimId, tenantId },
    });
  }
}
