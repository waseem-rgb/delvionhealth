import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class NotificationLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(tenantId: string, data: {
    patientId?: string;
    channel: string;
    type: string;
    recipient: string;
    message: string;
    subject?: string;
    orderId?: string;
  }) {
    return this.prisma.notificationLog.create({
      data: {
        tenantId,
        patientId: data.patientId,
        channel: data.channel,
        type: data.type,
        recipient: data.recipient,
        message: data.message,
        subject: data.subject,
        orderId: data.orderId,
        status: "PENDING",
      },
    });
  }

  async markSent(id: string, providerId?: string) {
    return this.prisma.notificationLog.update({
      where: { id },
      data: { status: "SENT", sentAt: new Date(), providerId },
    });
  }

  async markFailed(id: string, reason: string) {
    return this.prisma.notificationLog.update({
      where: { id },
      data: { status: "FAILED", failReason: reason },
    });
  }

  async getLogs(tenantId: string, filters: {
    patientId?: string;
    channel?: string;
    type?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 50, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId };
    if (filters.patientId) where.patientId = filters.patientId;
    if (filters.channel) where.channel = filters.channel;
    if (filters.type) where.type = filters.type;
    if (filters.status) where.status = filters.status;

    const [logs, total] = await Promise.all([
      this.prisma.notificationLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.notificationLog.count({ where }),
    ]);

    return { data: logs, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }
}
