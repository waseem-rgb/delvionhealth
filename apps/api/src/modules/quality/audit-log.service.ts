import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(
    tenantId: string,
    action: string,
    entity: string,
    entityId: string | null,
    actorId: string | null,
    actorName: string | null,
    details?: Record<string, unknown>,
  ) {
    return this.prisma.qualityAuditEntry.create({
      data: {
        tenantId,
        action,
        entityType: entity,
        entity,
        entityId,
        performedById: actorId,
        actorId,
        actorName,
        details: details ? JSON.parse(JSON.stringify(details)) : undefined,
        metadata: details ? JSON.parse(JSON.stringify(details)) : undefined,
      },
    });
  }

  async getAuditLog(
    tenantId: string,
    filters: { entity?: string; dateFrom?: string; dateTo?: string },
    page = 1,
    limit = 50,
  ) {
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = { tenantId };

    if (filters.entity) {
      where["entityType"] = filters.entity;
    }
    if (filters.dateFrom || filters.dateTo) {
      const performedAt: Record<string, Date> = {};
      if (filters.dateFrom) performedAt["gte"] = new Date(filters.dateFrom);
      if (filters.dateTo) performedAt["lte"] = new Date(filters.dateTo);
      where["performedAt"] = performedAt;
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.qualityAuditEntry.findMany({
        where,
        orderBy: { performedAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.qualityAuditEntry.count({ where }),
    ]);

    return { data, total, page, limit };
  }
}
