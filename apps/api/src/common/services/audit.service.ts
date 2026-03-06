import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export interface AuditLogParams {
  tenantId: string;
  actorId: string;
  actorName?: string;
  actorRole?: string;
  action: string;
  module?: string;
  entity: string;
  entityId?: string;
  targetType?: string;
  targetRef?: string;
  changes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

export interface AuditLogQuery {
  module?: string;
  action?: string;
  userId?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create an audit log entry.
   * Resolves actorName/actorRole from the User record if not provided.
   */
  async log(params: AuditLogParams): Promise<void> {
    let { actorName, actorRole } = params;

    // If actorName not provided, look up the user
    if (!actorName || !actorRole) {
      const user = await this.prisma.user.findUnique({
        where: { id: params.actorId },
        select: { firstName: true, lastName: true, role: true },
      });
      if (user) {
        actorName = actorName || `${user.firstName} ${user.lastName}`;
        actorRole = actorRole || user.role;
      }
    }

    await this.prisma.auditLog.create({
      data: {
        tenantId: params.tenantId,
        userId: params.actorId,
        actorName: actorName ?? "",
        actorRole: actorRole ?? "",
        action: params.action,
        module: params.module ?? "",
        entity: params.entity,
        entityId: params.entityId,
        targetType: params.targetType,
        targetRef: params.targetRef,
        changes: (params.changes as object) ?? undefined,
        metadata: (params.metadata as object) ?? undefined,
        ipAddress: params.ipAddress,
      },
    });
  }

  /**
   * List audit logs with optional filters and pagination.
   */
  async findAll(tenantId: string, query: AuditLogQuery) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId };

    if (query.module) {
      where.module = query.module;
    }
    if (query.action) {
      where.action = query.action;
    }
    if (query.userId) {
      where.userId = query.userId;
    }
    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }
    if (query.search) {
      where.OR = [
        { entity: { contains: query.search, mode: "insensitive" } },
        { actorName: { contains: query.search, mode: "insensitive" } },
        { action: { contains: query.search, mode: "insensitive" } },
        { targetRef: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, role: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
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
}
