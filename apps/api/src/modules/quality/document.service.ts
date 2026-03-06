import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditLogService } from "./audit-log.service";

@Injectable()
export class DocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async createDocument(
    tenantId: string,
    userId: string,
    dto: {
      title: string;
      type?: string;
      category?: string;
      version?: string;
      content?: string;
      fileUrl?: string;
      docNumber?: string;
      certType?: string;
      issuerName?: string;
      issuedDate?: string;
      expiryDate?: string;
      nextReviewDate?: string;
    },
  ) {
    const doc = await this.prisma.qualityDocument.create({
      data: {
        tenantId,
        title: dto.title,
        type: dto.type ?? "SOP",
        category: dto.category,
        version: dto.version ?? "1.0",
        content: dto.content,
        fileUrl: dto.fileUrl,
        docNumber: dto.docNumber,
        certType: dto.certType,
        issuerName: dto.issuerName,
        issuedDate: dto.issuedDate ? new Date(dto.issuedDate) : undefined,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
        nextReviewDate: dto.nextReviewDate ? new Date(dto.nextReviewDate) : undefined,
        createdById: userId,
      },
    });

    await this.auditLog.log(tenantId, "DOCUMENT_CREATED", "QualityDocument", doc.id, userId, null, {
      title: dto.title,
      type: dto.type ?? "SOP",
    });

    return doc;
  }

  async updateDocument(
    tenantId: string,
    id: string,
    userId: string,
    dto: {
      title?: string;
      category?: string;
      version?: string;
      content?: string;
      fileUrl?: string;
      status?: string;
      expiryDate?: string;
      nextReviewDate?: string;
    },
  ) {
    const data: Record<string, unknown> = {};
    if (dto.title) data["title"] = dto.title;
    if (dto.category) data["category"] = dto.category;
    if (dto.version) data["version"] = dto.version;
    if (dto.content !== undefined) data["content"] = dto.content;
    if (dto.fileUrl) data["fileUrl"] = dto.fileUrl;
    if (dto.status) data["status"] = dto.status;
    if (dto.expiryDate) data["expiryDate"] = new Date(dto.expiryDate);
    if (dto.nextReviewDate) data["nextReviewDate"] = new Date(dto.nextReviewDate);

    const doc = await this.prisma.qualityDocument.update({ where: { id }, data });

    await this.auditLog.log(tenantId, "DOCUMENT_UPDATED", "QualityDocument", id, userId, null, { changes: dto });

    return doc;
  }

  async getDocuments(
    tenantId: string,
    filters: { category?: string; status?: string; type?: string; page?: number; limit?: number },
  ) {
    const { page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = { tenantId };
    if (filters.category) where["category"] = filters.category;
    if (filters.status) where["status"] = filters.status;
    if (filters.type) where["type"] = filters.type;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.qualityDocument.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
      this.prisma.qualityDocument.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async getExpiringDocuments(tenantId: string, daysAhead = 90) {
    const now = new Date();
    const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    return this.prisma.qualityDocument.findMany({
      where: {
        tenantId,
        expiryDate: { gte: now, lte: futureDate },
      },
      orderBy: { expiryDate: "asc" },
    });
  }

  async approveDocument(tenantId: string, id: string, approverId: string) {
    const doc = await this.prisma.qualityDocument.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedById: approverId,
        approvedAt: new Date(),
      },
    });

    await this.auditLog.log(tenantId, "DOCUMENT_APPROVED", "QualityDocument", id, approverId, null);

    return doc;
  }

  async getVaultStatus(tenantId: string) {
    const now = new Date();
    const sixtyDays = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

    const docs = await this.prisma.qualityDocument.findMany({
      where: { tenantId },
      select: { id: true, title: true, certType: true, expiryDate: true, status: true },
    });

    const grouped: Record<string, { total: number; valid: number; expiring: number; expired: number }> = {};
    for (const doc of docs) {
      const key = doc.certType ?? doc.status ?? "OTHER";
      if (!grouped[key]) grouped[key] = { total: 0, valid: 0, expiring: 0, expired: 0 };
      grouped[key].total++;
      if (doc.expiryDate) {
        if (doc.expiryDate < now) grouped[key].expired++;
        else if (doc.expiryDate <= sixtyDays) grouped[key].expiring++;
        else grouped[key].valid++;
      } else {
        grouped[key].valid++;
      }
    }

    return { total: docs.length, byType: grouped };
  }
}
