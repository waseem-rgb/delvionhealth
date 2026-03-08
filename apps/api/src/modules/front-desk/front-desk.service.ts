import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class FrontDeskService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      todayPatients,
      todayRevenue,
      samplesPending,
      reportsReady,
      homeCollectionsToday,
      appointmentsToday,
      queueStats,
      recentRegistrations,
      todayAppointments,
    ] = await Promise.all([
      // Patients registered today
      this.prisma.order.count({
        where: { tenantId, createdAt: { gte: today, lt: tomorrow } },
      }),
      // Revenue today
      this.prisma.order.aggregate({
        where: { tenantId, createdAt: { gte: today, lt: tomorrow } },
        _sum: { totalAmount: true },
      }),
      // Samples pending collection
      this.prisma.order.count({
        where: { tenantId, status: "PENDING_COLLECTION" },
      }),
      // Reports ready (approved)
      this.prisma.order.count({
        where: {
          tenantId,
          status: { in: ["APPROVED", "REPORTED"] },
          approvedAt: { gte: today },
        },
      }),
      // Home collections today
      this.prisma.appointment.count({
        where: {
          tenantId,
          isHomeCollection: true,
          scheduledAt: { gte: today, lt: tomorrow },
        },
      }),
      // Appointments today
      this.prisma.appointment.count({
        where: {
          tenantId,
          scheduledAt: { gte: today, lt: tomorrow },
        },
      }),
      // Queue stats
      this.prisma.queueToken.groupBy({
        by: ["status"],
        where: { tenantId, date: { gte: today, lt: tomorrow } },
        _count: true,
      }),
      // Recent registrations
      this.prisma.order.findMany({
        where: { tenantId, createdAt: { gte: today } },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          patient: {
            select: { id: true, firstName: true, lastName: true, mrn: true, phone: true },
          },
          items: {
            include: { testCatalog: { select: { name: true } } },
          },
        },
      }),
      // Today's appointments for timeline
      this.prisma.appointment.findMany({
        where: {
          tenantId,
          scheduledAt: { gte: today, lt: tomorrow },
        },
        orderBy: { scheduledAt: "asc" },
        include: {
          patient: {
            select: { firstName: true, lastName: true },
          },
        },
      }),
    ]);

    const queueWaiting = queueStats.find((s) => s.status === "WAITING")?._count ?? 0;
    const queueCalled = queueStats.find((s) => s.status === "CALLED")?._count ?? 0;

    // Build alerts
    const alerts: Array<{ type: string; message: string; severity: string }> = [];

    // Long waiting tokens
    const longWaiting = await this.prisma.queueToken.findMany({
      where: {
        tenantId,
        date: { gte: today, lt: tomorrow },
        status: "WAITING",
        createdAt: { lt: new Date(Date.now() - 20 * 60 * 1000) },
      },
    });
    for (const token of longWaiting) {
      const waitMins = Math.round((Date.now() - token.createdAt.getTime()) / 60000);
      alerts.push({
        type: "LONG_WAIT",
        message: `Token ${token.tokenDisplay} waiting ${waitMins} minutes`,
        severity: waitMins > 30 ? "error" : "warning",
      });
    }

    if (reportsReady > 0) {
      alerts.push({
        type: "REPORTS_READY",
        message: `${reportsReady} reports ready — not yet sent`,
        severity: "info",
      });
    }

    // Unassigned home collections for tomorrow
    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
    const unassignedHC = await this.prisma.appointment.count({
      where: {
        tenantId,
        isHomeCollection: true,
        scheduledAt: { gte: tomorrow, lt: tomorrowEnd },
        assignedPhlebId: null,
      },
    });
    if (unassignedHC > 0) {
      alerts.push({
        type: "UNASSIGNED_HC",
        message: `${unassignedHC} home collections unassigned for tomorrow`,
        severity: "warning",
      });
    }

    // Phleb status
    const phlebStatus = await this.prisma.phlebSchedule.findMany({
      where: { tenantId, date: { gte: today, lt: tomorrow } },
      select: {
        phlebId: true,
        phlebName: true,
        status: true,
        shiftStart: true,
        shiftEnd: true,
        assignedSlots: true,
        maxSlotsPerDay: true,
      },
    });

    return {
      todayPatients,
      todayRevenue: Number(todayRevenue._sum.totalAmount ?? 0),
      samplesPending,
      reportsReady,
      homeCollectionsToday,
      appointmentsToday,
      queueWaiting,
      queueCalled,
      alerts,
      recentRegistrations: recentRegistrations.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        patient: o.patient,
        tests: o.items.map((i) => i.testCatalog?.name ?? "Unknown"),
        totalAmount: Number(o.totalAmount),
        status: o.status,
        createdAt: o.createdAt.toISOString(),
      })),
      todayAppointments: todayAppointments.map((a) => ({
        id: a.id,
        appointmentNumber: a.appointmentNumber,
        patientName: a.patient
          ? `${a.patient.firstName} ${a.patient.lastName}`
          : a.patientName ?? "Unknown",
        type: a.type,
        status: a.status,
        scheduledAt: a.scheduledAt.toISOString(),
        scheduledSlot: a.scheduledSlot,
        isHomeCollection: a.isHomeCollection,
      })),
      phlebStatus: phlebStatus.map((p) => ({
        ...p,
        assignedCount: p.assignedSlots
          ? JSON.parse(p.assignedSlots).length
          : 0,
      })),
    };
  }
}
