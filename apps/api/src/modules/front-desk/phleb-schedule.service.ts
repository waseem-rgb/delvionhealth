import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class PhlebScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  async getSchedule(tenantId: string, from?: string, to?: string) {
    const fromDate = from ? new Date(from) : new Date();
    fromDate.setHours(0, 0, 0, 0);
    const toDate = to ? new Date(to) : new Date(fromDate);
    toDate.setDate(toDate.getDate() + 7);

    return this.prisma.phlebSchedule.findMany({
      where: { tenantId, date: { gte: fromDate, lt: toDate } },
      orderBy: [{ date: "asc" }, { phlebName: "asc" }],
    });
  }

  async create(tenantId: string, data: {
    phlebId: string;
    phlebName: string;
    date: string;
    shiftStart: string;
    shiftEnd: string;
    maxSlotsPerDay?: number;
    notes?: string;
  }) {
    return this.prisma.phlebSchedule.create({
      data: {
        tenantId,
        phlebId: data.phlebId,
        phlebName: data.phlebName,
        date: new Date(data.date),
        shiftStart: data.shiftStart,
        shiftEnd: data.shiftEnd,
        maxSlotsPerDay: data.maxSlotsPerDay ?? 8,
        notes: data.notes,
      },
    });
  }

  async update(tenantId: string, id: string, data: Record<string, unknown>) {
    const existing = await this.prisma.phlebSchedule.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException("Schedule not found");

    const updateData: Record<string, unknown> = {};
    if (data.shiftStart !== undefined) updateData.shiftStart = data.shiftStart;
    if (data.shiftEnd !== undefined) updateData.shiftEnd = data.shiftEnd;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.maxSlotsPerDay !== undefined) updateData.maxSlotsPerDay = data.maxSlotsPerDay;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.assignedSlots !== undefined) updateData.assignedSlots = data.assignedSlots;

    return this.prisma.phlebSchedule.update({ where: { id }, data: updateData });
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.phlebSchedule.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException("Schedule not found");
    return this.prisma.phlebSchedule.delete({ where: { id } });
  }

  async getAvailable(tenantId: string, date: string, slot?: string) {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const schedules = await this.prisma.phlebSchedule.findMany({
      where: {
        tenantId,
        date: { gte: targetDate, lt: nextDay },
        status: { in: ["AVAILABLE", "ON_ROUTE"] },
      },
    });

    return schedules.map((s) => {
      const assigned = s.assignedSlots ? JSON.parse(s.assignedSlots).length : 0;
      return {
        id: s.id,
        phlebId: s.phlebId,
        phlebName: s.phlebName,
        shiftStart: s.shiftStart,
        shiftEnd: s.shiftEnd,
        slotsUsed: assigned,
        slotsAvailable: s.maxSlotsPerDay - assigned,
        status: s.status,
      };
    }).filter((s) => s.slotsAvailable > 0);
  }
}
