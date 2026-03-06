import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditLogService } from "./audit-log.service";
import { AiService } from "../ai/ai.service";

@Injectable()
export class CapaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly aiService: AiService,
  ) {}

  async suggestRootCause(source: string, description: string) {
    const systemPrompt = `You are a quality manager in an ISO 15189 accredited diagnostic laboratory.`;
    const userMessage = `A CAPA has been raised:
Source: ${source}
Description: ${description}

In 3-4 concise sentences, provide:
1. The most likely root cause
2. One immediate corrective action
3. One preventive action to avoid recurrence

Use ISO 15189 and NABL terminology. Be specific and practical.`;

    const result = await this.aiService.complete(systemPrompt, userMessage, 300);
    return { suggestion: result.text ?? result.toString() };
  }

  async createCapa(
    tenantId: string,
    userId: string,
    dto: {
      title: string;
      description?: string;
      type?: string;
      source?: string;
      sourceId?: string;
      priority?: string;
      department?: string;
      rootCause?: string;
      proposedAction?: string;
      dueDate?: string;
      assignedToId?: string;
    },
  ) {
    const capaNumber = await this.generateCapaNumber(tenantId);

    const capa = await this.prisma.qualityCapa.create({
      data: {
        tenantId,
        capaNumber,
        title: dto.title,
        description: dto.description,
        type: dto.type ?? "CORRECTIVE",
        source: dto.source,
        sourceId: dto.sourceId,
        priority: dto.priority ?? "MEDIUM",
        department: dto.department,
        rootCause: dto.rootCause,
        proposedAction: dto.proposedAction,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        assignedToId: dto.assignedToId,
        createdById: userId,
      },
    });

    await this.auditLog.log(tenantId, "CAPA_CREATED", "QualityCapa", capa.id, userId, null, {
      capaNumber,
      title: dto.title,
      type: dto.type ?? "CORRECTIVE",
      source: dto.source,
    });

    return capa;
  }

  async updateCapa(
    tenantId: string,
    id: string,
    userId: string,
    dto: {
      title?: string;
      description?: string;
      status?: string;
      priority?: string;
      rootCause?: string;
      proposedAction?: string;
      actualAction?: string;
      dueDate?: string;
      assignedToId?: string;
      effectivenessCheck?: string;
      effectivenessDate?: string;
    },
  ) {
    const data: Record<string, unknown> = {};
    if (dto.title) data["title"] = dto.title;
    if (dto.description !== undefined) data["description"] = dto.description;
    if (dto.priority) data["priority"] = dto.priority;
    if (dto.rootCause !== undefined) data["rootCause"] = dto.rootCause;
    if (dto.proposedAction !== undefined) data["proposedAction"] = dto.proposedAction;
    if (dto.actualAction !== undefined) data["actualAction"] = dto.actualAction;
    if (dto.dueDate) data["dueDate"] = new Date(dto.dueDate);
    if (dto.assignedToId) data["assignedToId"] = dto.assignedToId;
    if (dto.effectivenessCheck !== undefined) data["effectivenessCheck"] = dto.effectivenessCheck;
    if (dto.effectivenessDate) data["effectivenessDate"] = new Date(dto.effectivenessDate);

    if (dto.status) {
      data["status"] = dto.status;
      if (dto.status === "COMPLETED") data["completedAt"] = new Date();
      if (dto.status === "VERIFIED") {
        data["verifiedAt"] = new Date();
        data["verifiedById"] = userId;
      }
    }

    const capa = await this.prisma.qualityCapa.update({
      where: { id },
      data,
    });

    await this.auditLog.log(tenantId, "CAPA_UPDATED", "QualityCapa", id, userId, null, {
      changes: dto,
    });

    return capa;
  }

  async getCapas(
    tenantId: string,
    filters: { status?: string; type?: string; department?: string; priority?: string; page?: number; limit?: number },
  ) {
    const { page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = { tenantId };
    if (filters.status) where["status"] = filters.status;
    if (filters.type) where["type"] = filters.type;
    if (filters.department) where["department"] = filters.department;
    if (filters.priority) where["priority"] = filters.priority;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.qualityCapa.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
      this.prisma.qualityCapa.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async getCapaSummary(tenantId: string) {
    const now = new Date();
    const [open, inProgress, completed, closed, overdue] = await this.prisma.$transaction([
      this.prisma.qualityCapa.count({ where: { tenantId, status: "OPEN" } }),
      this.prisma.qualityCapa.count({ where: { tenantId, status: "IN_PROGRESS" } }),
      this.prisma.qualityCapa.count({ where: { tenantId, status: "COMPLETED" } }),
      this.prisma.qualityCapa.count({ where: { tenantId, status: "CLOSED" } }),
      this.prisma.qualityCapa.count({
        where: { tenantId, status: { in: ["OPEN", "IN_PROGRESS"] }, dueDate: { lt: now } },
      }),
    ]);
    return { open, inProgress, completed, closed, overdue };
  }

  private async generateCapaNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.qualityCapa.count({
      where: { tenantId, createdAt: { gte: new Date(`${year}-01-01`) } },
    });
    return `CAPA-${year}-${String(count + 1).padStart(4, "0")}`;
  }
}
