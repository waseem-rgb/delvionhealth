import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { AppointmentStatus, Prisma } from "@prisma/client";

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    query: { status?: string; limit?: number; date?: string } = {}
  ) {
    const where: Prisma.AppointmentWhereInput = { tenantId };

    if (query.status && query.status !== "ALL") {
      where.status = query.status as AppointmentStatus;
    }

    if (query.date) {
      const d = new Date(query.date);
      const start = new Date(d);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(d);
      end.setUTCHours(23, 59, 59, 999);
      where.scheduledAt = { gte: start, lte: end };
    }

    return this.prisma.appointment.findMany({
      where,
      include: {
        patient: {
          select: { firstName: true, lastName: true, mrn: true, phone: true },
        },
        branch: { select: { name: true } },
      },
      orderBy: { scheduledAt: "asc" },
      take: query.limit ?? 50,
    });
  }

  async updateStatus(id: string, tenantId: string, status: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, tenantId },
    });
    if (!appointment) throw new NotFoundException(`Appointment ${id} not found`);

    return this.prisma.appointment.update({
      where: { id },
      data: { status: status as AppointmentStatus },
      include: {
        patient: {
          select: { firstName: true, lastName: true, mrn: true, phone: true },
        },
        branch: { select: { name: true } },
      },
    });
  }

  async sendReminder(id: string, tenantId: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, tenantId },
      include: { patient: { select: { firstName: true, phone: true } } },
    });
    if (!appointment) throw new NotFoundException(`Appointment ${id} not found`);

    await this.prisma.appointment.update({
      where: { id },
      data: { reminderSent: true },
    });

    return { success: true, message: `Reminder sent to ${appointment.patient.firstName}` };
  }
}
