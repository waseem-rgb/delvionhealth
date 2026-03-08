import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class QueueService {
  constructor(private readonly prisma: PrismaService) {}

  async getTokens(tenantId: string, date?: string) {
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    return this.prisma.queueToken.findMany({
      where: { tenantId, date: { gte: targetDate, lt: nextDay } },
      orderBy: { tokenNumber: "asc" },
    });
  }

  async issueToken(
    tenantId: string,
    data: { patientName: string; patientId?: string; orderId?: string; appointmentId?: string; type?: string },
  ) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get next token number for today
    const lastToken = await this.prisma.queueToken.findFirst({
      where: { tenantId, date: { gte: today, lt: tomorrow } },
      orderBy: { tokenNumber: "desc" },
    });

    const nextNumber = (lastToken?.tokenNumber ?? 0) + 1;
    const type = data.type ?? "WALKIN";
    const prefix = type === "PRIORITY" ? "P" : type === "HOME" ? "H" : type === "CORPORATE" ? "C" : "A";
    const tokenDisplay = `${prefix}${String(nextNumber).padStart(3, "0")}`;

    return this.prisma.queueToken.create({
      data: {
        tenantId,
        tokenNumber: nextNumber,
        tokenDisplay,
        date: today,
        patientId: data.patientId,
        patientName: data.patientName,
        orderId: data.orderId,
        appointmentId: data.appointmentId,
        type,
        status: "WAITING",
      },
    });
  }

  async callNext(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const next = await this.prisma.queueToken.findFirst({
      where: { tenantId, date: { gte: today, lt: tomorrow }, status: "WAITING" },
      orderBy: { tokenNumber: "asc" },
    });

    if (!next) return null;

    return this.prisma.queueToken.update({
      where: { id: next.id },
      data: { status: "CALLED", calledAt: new Date() },
    });
  }

  async callToken(tenantId: string, id: string) {
    return this.prisma.queueToken.update({
      where: { id },
      data: { status: "CALLED", calledAt: new Date() },
    });
  }

  async completeToken(tenantId: string, id: string) {
    const now = new Date();
    const token = await this.prisma.queueToken.findFirst({
      where: { id, tenantId },
    });
    const waitMinutes = token?.createdAt
      ? Math.round((now.getTime() - token.createdAt.getTime()) / 60000)
      : 0;

    return this.prisma.queueToken.update({
      where: { id },
      data: { status: "DONE", completedAt: now, waitMinutes },
    });
  }

  async getDisplayData(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [current, waiting] = await Promise.all([
      this.prisma.queueToken.findFirst({
        where: { tenantId, date: { gte: today, lt: tomorrow }, status: "CALLED" },
        orderBy: { calledAt: "desc" },
      }),
      this.prisma.queueToken.findMany({
        where: { tenantId, date: { gte: today, lt: tomorrow }, status: "WAITING" },
        orderBy: { tokenNumber: "asc" },
        take: 5,
      }),
    ]);

    const avgWait = await this.prisma.queueToken.aggregate({
      where: {
        tenantId,
        date: { gte: today, lt: tomorrow },
        status: "DONE",
        waitMinutes: { not: null },
      },
      _avg: { waitMinutes: true },
    });

    return {
      currentToken: current,
      nextTokens: waiting,
      estimatedWait: Math.round(avgWait._avg.waitMinutes ?? 10),
    };
  }
}
