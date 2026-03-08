import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class RevShareService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Paginated rev-share ledger with filters.
   */
  async getLedger(
    tenantId: string,
    query: {
      entityType?: string;
      status?: string;
      month?: number;
      year?: number;
      page?: number;
      limit?: number;
    },
  ) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId };

    if (query.entityType) {
      where.entityType = query.entityType;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.month) {
      where.month = query.month;
    }

    if (query.year) {
      where.year = query.year;
    }

    const [data, total] = await Promise.all([
      this.prisma.revShareLedger.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.revShareLedger.count({ where }),
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

  /**
   * Summary grouped by entityType: sum revShareAmount, count.
   */
  async getSummary(
    tenantId: string,
    query: { month?: number; year?: number },
  ) {
    const where: Record<string, unknown> = { tenantId };

    if (query.month) {
      where.month = query.month;
    }

    if (query.year) {
      where.year = query.year;
    }

    const groups = await this.prisma.revShareLedger.groupBy({
      by: ["entityType"],
      where,
      _sum: {
        revShareAmount: true,
      },
      _count: {
        id: true,
      },
    });

    return groups.map((g) => ({
      entityType: g.entityType,
      totalRevShareAmount: g._sum.revShareAmount ?? 0,
      count: g._count.id,
    }));
  }

  /**
   * Mark a ledger entry as paid.
   */
  async markPaid(tenantId: string, id: string, userId: string) {
    const entry = await this.prisma.revShareLedger.findFirst({
      where: { id, tenantId },
    });

    if (!entry) {
      throw new NotFoundException(`Rev-share ledger entry ${id} not found`);
    }

    return this.prisma.revShareLedger.update({
      where: { id },
      data: {
        status: "PAID",
        paidAt: new Date(),
        paidById: userId,
      } as never,
    });
  }

  /**
   * Full statement for one entity (e.g. a doctor or sales rep).
   */
  async getStatement(
    tenantId: string,
    entityType: string,
    entityId: string,
  ) {
    return this.prisma.revShareLedger.findMany({
      where: {
        tenantId,
        entityType,
        entityId,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Auto-compute rev share for an order.
   * Looks up patient -> referringDoctor -> creates DOCTOR ledger entry,
   * then checks if doctor has assignedRepId -> creates SALES_REP ledger entry.
   */
  async computeRevShare(tenantId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: {
        patient: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    const patient = order.patient as Record<string, unknown> | null;
    if (!patient?.referringDoctorId) {
      return { message: "No referring doctor on patient; nothing to compute." };
    }

    const doctor = await this.prisma.referringDoctor.findFirst({
      where: {
        id: patient.referringDoctorId as string,
        tenantId,
        revShareEnabled: true,
      },
    });

    if (!doctor) {
      return { message: "Referring doctor not found or rev-share not enabled." };
    }

    const orderAmount = (order as Record<string, unknown>).netAmount as number ?? 0;
    const doctorRevSharePct = (doctor as Record<string, unknown>).revSharePct as number ?? 0;
    const doctorAmount = (orderAmount * doctorRevSharePct) / 100;

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    // Create DOCTOR ledger entry
    const doctorEntry = await this.prisma.revShareLedger.create({
      data: {
        tenantId,
        entityType: "DOCTOR",
        entityId: doctor.id,
        entityName: doctor.name,
        orderId,
        orderAmount,
        revSharePct: doctorRevSharePct,
        revShareAmount: doctorAmount,
        month,
        year,
        status: "PENDING",
      } as never,
    });

    // Update doctor totals
    await this.prisma.referringDoctor.update({
      where: { id: doctor.id },
      data: {
        totalRevenue: { increment: orderAmount },
        totalReferrals: { increment: 1 },
        revShareEarned: { increment: doctorAmount },
        revSharePending: { increment: doctorAmount },
        lastReferralDate: now,
      } as never,
    });

    let repEntry = null;

    // Check if doctor has an assigned sales rep
    const assignedRepId = (doctor as Record<string, unknown>).assignedRepId as string | null;

    if (assignedRepId) {
      const rep = await this.prisma.salesRep.findFirst({
        where: { id: assignedRepId, tenantId },
      });

      if (rep) {
        const repRevSharePct = (rep as Record<string, unknown>).revSharePct as number ?? 0;
        const repAmount = (orderAmount * repRevSharePct) / 100;

        repEntry = await this.prisma.revShareLedger.create({
          data: {
            tenantId,
            entityType: "SALES_REP",
            entityId: rep.id,
            entityName: rep.name,
            orderId,
            orderAmount,
            revSharePct: repRevSharePct,
            revShareAmount: repAmount,
            month,
            year,
            status: "PENDING",
          } as never,
        });

        await this.prisma.salesRep.update({
          where: { id: rep.id },
          data: {
            revenueMTD: { increment: orderAmount },
            revShareEarned: { increment: repAmount },
          } as never,
        });
      }
    }

    return { doctorEntry, repEntry };
  }
}
