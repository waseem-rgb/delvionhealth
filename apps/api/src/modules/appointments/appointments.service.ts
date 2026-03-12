import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { AppointmentStatus, AppointmentType, Prisma } from "@prisma/client";

interface CreateAppointmentDto {
  patientId?: string;
  tests?: string[];
  collectionAddress?: {
    line1?: string;
    line2?: string;
    city?: string;
    pincode?: string;
    landmark?: string;
  };
  scheduledDate?: string;
  scheduledAt?: string;
  slot?: string;
  phlebotomistId?: string;
  phlebName?: string;
  notes?: string;
  type?: string;
  isHomeCollection?: boolean;
  homeAddress?: string;
  homeCity?: string;
  homePincode?: string;
  homeSlot?: string;
  branchId?: string;
}

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

  async create(tenantId: string, createdById: string, dto: CreateAppointmentDto) {
    const scheduledAt = dto.scheduledAt
      ? new Date(dto.scheduledAt)
      : dto.scheduledDate
        ? new Date(`${dto.scheduledDate}T07:00:00.000Z`)
        : new Date();

    const appointment = await this.prisma.appointment.create({
      data: {
        tenantId,
        patientId: dto.patientId ?? undefined,
        branchId: dto.branchId ?? undefined,
        scheduledAt,
        scheduledSlot: dto.slot ?? undefined,
        type: (dto.type as AppointmentType) ?? "HOME_COLLECTION",
        status: "SCHEDULED" as AppointmentStatus,
        isHomeCollection: dto.isHomeCollection ?? false,
        homeAddress: dto.collectionAddress?.line1 ?? dto.homeAddress ?? undefined,
        homeCity: dto.collectionAddress?.city ?? dto.homeCity ?? undefined,
        homePincode: dto.collectionAddress?.pincode ?? dto.homePincode ?? undefined,
        homeSlot: dto.slot ?? dto.homeSlot ?? undefined,
        assignedPhlebId: dto.phlebotomistId ?? undefined,
        phlebName: dto.phlebName ?? undefined,
        requestedTestIds: dto.tests ? JSON.stringify(dto.tests) : undefined,
        notes: dto.notes ?? undefined,
        createdById,
      },
      include: {
        patient: {
          select: { firstName: true, lastName: true, mrn: true, phone: true },
        },
        branch: { select: { name: true } },
      },
    });

    return { data: appointment };
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

    return { success: true, message: `Reminder sent to ${appointment.patient?.firstName ?? appointment.patientName ?? 'patient'}` };
  }
}
