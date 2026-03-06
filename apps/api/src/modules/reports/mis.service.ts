import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class MisService {
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────────────────────────
  // Daily Collection Report
  // ───────────────────────────────────────────

  async getDailyCollection(tenantId: string, date: string, branchId?: string) {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const branchFilter = branchId ? { branchId } : {};

    // Total orders for the day
    const [totalOrders, ordersByPriority] = await Promise.all([
      this.prisma.order.count({
        where: {
          tenantId,
          createdAt: { gte: dayStart, lt: dayEnd },
          ...branchFilter,
        },
      }),
      this.prisma.order.groupBy({
        by: ["priority"],
        where: {
          tenantId,
          createdAt: { gte: dayStart, lt: dayEnd },
          ...branchFilter,
        },
        _count: { id: true },
      }),
    ]);

    // Revenue and payment breakdown
    const payments = await this.prisma.payment.findMany({
      where: {
        tenantId,
        paidAt: { gte: dayStart, lt: dayEnd },
        status: "COMPLETED",
        ...(branchId
          ? { invoice: { order: { branchId } } }
          : {}),
      },
      select: {
        amount: true,
        method: true,
        paidAt: true,
      },
    });

    const totalRevenue = payments.reduce(
      (sum, p) => sum + Number(p.amount),
      0,
    );

    // Payment by method
    const byMethod: Record<string, number> = {};
    for (const payment of payments) {
      const method = payment.method;
      byMethod[method] = (byMethod[method] ?? 0) + Number(payment.amount);
    }

    // Hourly breakdown
    const hourly: Record<number, number> = {};
    for (const payment of payments) {
      const hour = payment.paidAt.getHours();
      hourly[hour] = (hourly[hour] ?? 0) + Number(payment.amount);
    }
    const hourlyBreakdown = Object.entries(hourly)
      .map(([hour, amount]) => ({ hour: Number(hour), amount }))
      .sort((a, b) => a.hour - b.hour);

    // By technician (createdBy on orders)
    const ordersByTechnician = await this.prisma.order.groupBy({
      by: ["createdById"],
      where: {
        tenantId,
        createdAt: { gte: dayStart, lt: dayEnd },
        ...branchFilter,
      },
      _count: { id: true },
      _sum: { netAmount: true },
    });

    // Resolve technician names
    const techIds = ordersByTechnician.map((t) => t.createdById);
    const techUsers = await this.prisma.user.findMany({
      where: { id: { in: techIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const techMap = new Map(techUsers.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

    const byTechnician = ordersByTechnician.map((t) => ({
      userId: t.createdById,
      name: techMap.get(t.createdById) ?? "Unknown",
      orderCount: t._count.id,
      revenue: Number(t._sum.netAmount ?? 0),
    }));

    return {
      date,
      totalOrders,
      totalRevenue,
      ordersByPriority: ordersByPriority.map((p) => ({
        priority: p.priority,
        count: p._count.id,
      })),
      byMethod,
      hourlyBreakdown,
      byTechnician,
    };
  }

  // ───────────────────────────────────────────
  // End of Day Report
  // ───────────────────────────────────────────

  async getEndOfDayReport(tenantId: string, date: string, branchId?: string) {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const branchFilter = branchId ? { branchId } : {};

    const [payments, refunds, orders] = await Promise.all([
      this.prisma.payment.findMany({
        where: {
          tenantId,
          paidAt: { gte: dayStart, lt: dayEnd },
          status: "COMPLETED",
          ...(branchId ? { invoice: { order: { branchId } } } : {}),
        },
        select: { amount: true, method: true },
      }),
      this.prisma.payment.findMany({
        where: {
          tenantId,
          paidAt: { gte: dayStart, lt: dayEnd },
          status: "REFUNDED",
          ...(branchId ? { invoice: { order: { branchId } } } : {}),
        },
        select: { amount: true, method: true },
      }),
      this.prisma.order.findMany({
        where: {
          tenantId,
          createdAt: { gte: dayStart, lt: dayEnd },
          ...branchFilter,
        },
        select: { discountAmount: true, netAmount: true, totalAmount: true },
      }),
    ]);

    const totalCollections = payments.reduce(
      (sum, p) => sum + Number(p.amount),
      0,
    );
    const totalRefunds = refunds.reduce(
      (sum, p) => sum + Number(p.amount),
      0,
    );
    const totalDiscounts = orders.reduce(
      (sum, o) => sum + Number(o.discountAmount),
      0,
    );
    const grossAmount = orders.reduce(
      (sum, o) => sum + Number(o.totalAmount),
      0,
    );

    // Collections by payment mode
    const collectionByMode: Record<string, number> = {};
    for (const p of payments) {
      collectionByMode[p.method] = (collectionByMode[p.method] ?? 0) + Number(p.amount);
    }

    // Refunds by payment mode
    const refundByMode: Record<string, number> = {};
    for (const r of refunds) {
      refundByMode[r.method] = (refundByMode[r.method] ?? 0) + Number(r.amount);
    }

    return {
      date,
      grossAmount,
      totalDiscounts,
      totalCollections,
      totalRefunds,
      netCollection: totalCollections - totalRefunds,
      orderCount: orders.length,
      collectionByMode,
      refundByMode,
    };
  }

  // ───────────────────────────────────────────
  // TAT Report
  // ───────────────────────────────────────────

  async getTATReport(tenantId: string, from: string, to: string) {
    const dateFrom = new Date(from);
    const dateTo = new Date(to);
    dateTo.setHours(23, 59, 59, 999);

    // Get completed orders with their samples and items for TAT calculation
    const orders = await this.prisma.order.findMany({
      where: {
        tenantId,
        createdAt: { gte: dateFrom, lte: dateTo },
        status: "REPORTED",
      },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        createdById: true,
        items: {
          select: {
            testCatalog: { select: { id: true, name: true } },
          },
        },
        samples: {
          select: {
            collectedAt: true,
          },
        },
      },
    });

    // Calculate TAT per test
    const testTatMap: Record<string, { name: string; tats: number[] }> = {};
    const techTatMap: Record<string, { userId: string; tats: number[] }> = {};

    for (const order of orders) {
      const tatHours =
        (order.updatedAt.getTime() - order.createdAt.getTime()) /
        (1000 * 60 * 60);

      for (const item of order.items) {
        const testId = item.testCatalog.id;
        if (!testTatMap[testId]) {
          testTatMap[testId] = { name: item.testCatalog.name, tats: [] };
        }
        testTatMap[testId]!.tats.push(tatHours);
      }

      if (!techTatMap[order.createdById]) {
        techTatMap[order.createdById] = { userId: order.createdById, tats: [] };
      }
      techTatMap[order.createdById]!.tats.push(tatHours);
    }

    const calcStats = (tats: number[]) => {
      if (tats.length === 0) return { avg: 0, min: 0, max: 0, count: 0 };
      const sorted = [...tats].sort((a, b) => a - b);
      return {
        avg: Math.round((tats.reduce((a, b) => a + b, 0) / tats.length) * 100) / 100,
        min: Math.round((sorted[0] ?? 0) * 100) / 100,
        max: Math.round((sorted[sorted.length - 1] ?? 0) * 100) / 100,
        count: tats.length,
      };
    };

    const perTest = Object.entries(testTatMap).map(([testId, data]) => ({
      testId,
      testName: data.name,
      ...calcStats(data.tats),
    }));

    // Resolve technician names
    const techIds = Object.keys(techTatMap);
    const techUsers = await this.prisma.user.findMany({
      where: { id: { in: techIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const techNameMap = new Map(
      techUsers.map((u) => [u.id, `${u.firstName} ${u.lastName}`]),
    );

    const perTechnician = Object.entries(techTatMap).map(
      ([userId, data]) => ({
        userId,
        name: techNameMap.get(userId) ?? "Unknown",
        ...calcStats(data.tats),
      }),
    );

    // TAT distribution buckets
    const allTats = orders.map(
      (o) =>
        (o.updatedAt.getTime() - o.createdAt.getTime()) / (1000 * 60 * 60),
    );
    const distribution = {
      under2h: allTats.filter((t) => t < 2).length,
      "2to6h": allTats.filter((t) => t >= 2 && t < 6).length,
      "6to12h": allTats.filter((t) => t >= 6 && t < 12).length,
      "12to24h": allTats.filter((t) => t >= 12 && t < 24).length,
      over24h: allTats.filter((t) => t >= 24).length,
    };

    // SLA breaches (> 24h)
    const slaBreaches = allTats.filter((t) => t > 24).length;

    return {
      from,
      to,
      totalReported: orders.length,
      overallAvgTatHours: allTats.length > 0
        ? Math.round((allTats.reduce((a, b) => a + b, 0) / allTats.length) * 100) / 100
        : 0,
      slaBreaches,
      slaBreachRate: orders.length > 0
        ? Math.round((slaBreaches / orders.length) * 10000) / 100
        : 0,
      perTest: perTest.sort((a, b) => b.avg - a.avg),
      perTechnician: perTechnician.sort((a, b) => b.avg - a.avg),
      distribution,
    };
  }

  // ───────────────────────────────────────────
  // Sample Movement Report
  // ───────────────────────────────────────────

  async getSampleMovement(tenantId: string, date: string) {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const statusCounts = await this.prisma.sample.groupBy({
      by: ["status"],
      where: {
        tenantId,
        updatedAt: { gte: dayStart, lt: dayEnd },
      },
      _count: { id: true },
    });

    // Total samples created today
    const createdToday = await this.prisma.sample.count({
      where: {
        tenantId,
        createdAt: { gte: dayStart, lt: dayEnd },
      },
    });

    // Collected today
    const collectedToday = await this.prisma.sample.count({
      where: {
        tenantId,
        collectedAt: { gte: dayStart, lt: dayEnd },
      },
    });

    return {
      date,
      createdToday,
      collectedToday,
      byStatus: statusCounts.map((s) => ({
        status: s.status,
        count: s._count.id,
      })),
    };
  }

  // ───────────────────────────────────────────
  // Organization Report (B2B organizations)
  // ───────────────────────────────────────────

  async getOrganizationReport(tenantId: string, from: string, to: string) {
    const dateFrom = new Date(from);
    const dateTo = new Date(to);
    dateTo.setHours(23, 59, 59, 999);

    // Group orders by referring doctor's clinic/organization
    const orders = await this.prisma.order.findMany({
      where: {
        tenantId,
        createdAt: { gte: dateFrom, lte: dateTo },
      },
      select: {
        netAmount: true,
        paymentStatus: true,
        patient: {
          select: {
            referringDoctorId: true,
          },
        },
      },
    });

    // Get unique doctor IDs
    const doctorIds = [
      ...new Set(
        orders
          .map((o) => o.patient?.referringDoctorId)
          .filter((id): id is string => !!id),
      ),
    ];

    const doctors = await this.prisma.doctor.findMany({
      where: { id: { in: doctorIds } },
      select: { id: true, name: true, clinicName: true },
    });

    const doctorMap = new Map(doctors.map((d) => [d.id, d]));

    // Aggregate by organization/clinic
    const orgData: Record<
      string,
      { name: string; orders: number; revenue: number; outstanding: number }
    > = {};

    for (const order of orders) {
      const docId = order.patient?.referringDoctorId;
      if (!docId) continue;

      const doc = doctorMap.get(docId);
      const orgName = doc?.clinicName ?? doc?.name ?? "Unknown";
      const key = docId;

      if (!orgData[key]) {
        orgData[key] = { name: orgName, orders: 0, revenue: 0, outstanding: 0 };
      }

      const org = orgData[key]!;
      org.orders += 1;
      org.revenue += Number(order.netAmount);
      if (order.paymentStatus !== "PAID") {
        org.outstanding += Number(order.netAmount);
      }
    }

    const organizations = Object.values(orgData).sort(
      (a, b) => b.revenue - a.revenue,
    );

    return {
      from,
      to,
      totalOrganizations: organizations.length,
      totalRevenue: organizations.reduce((s, o) => s + o.revenue, 0),
      totalOutstanding: organizations.reduce((s, o) => s + o.outstanding, 0),
      organizations,
    };
  }

  // ───────────────────────────────────────────
  // Test-wise Report
  // ───────────────────────────────────────────

  async getTestWiseReport(tenantId: string, from: string, to: string) {
    const dateFrom = new Date(from);
    const dateTo = new Date(to);
    dateTo.setHours(23, 59, 59, 999);

    const orderItems = await this.prisma.orderItem.findMany({
      where: {
        order: {
          tenantId,
          createdAt: { gte: dateFrom, lte: dateTo },
          status: { not: "CANCELLED" },
        },
      },
      select: {
        testCatalogId: true,
        quantity: true,
        price: true,
        discount: true,
        testCatalog: {
          select: { id: true, name: true, code: true, category: true },
        },
      },
    });

    // Aggregate by test
    const testData: Record<
      string,
      {
        name: string;
        code: string;
        category: string | null;
        count: number;
        revenue: number;
      }
    > = {};

    for (const item of orderItems) {
      const testId = item.testCatalogId;
      if (!testData[testId]) {
        testData[testId] = {
          name: item.testCatalog.name,
          code: item.testCatalog.code,
          category: item.testCatalog.category,
          count: 0,
          revenue: 0,
        };
      }
      const entry = testData[testId]!;
      entry.count += item.quantity;
      const lineNet =
        Number(item.price) *
        item.quantity *
        (1 - Number(item.discount) / 100);
      entry.revenue += lineNet;
    }

    // Get abnormal result counts per test (through orderItem relation)
    const abnormalResults = await this.prisma.testResult.findMany({
      where: {
        tenantId,
        createdAt: { gte: dateFrom, lte: dateTo },
        interpretation: { in: ["ABNORMAL", "CRITICAL"] },
      },
      select: {
        orderItem: { select: { testCatalogId: true } },
      },
    });

    const abnormalMap = new Map<string, number>();
    for (const r of abnormalResults) {
      const testId = r.orderItem.testCatalogId;
      abnormalMap.set(testId, (abnormalMap.get(testId) ?? 0) + 1);
    }

    const tests = Object.entries(testData)
      .map(([testId, data]) => ({
        testId,
        ...data,
        abnormalCount: abnormalMap.get(testId) ?? 0,
        abnormalRate:
          data.count > 0
            ? Math.round(((abnormalMap.get(testId) ?? 0) / data.count) * 10000) / 100
            : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      from,
      to,
      totalTests: tests.reduce((s, t) => s + t.count, 0),
      totalRevenue: tests.reduce((s, t) => s + t.revenue, 0),
      tests,
    };
  }

  // ───────────────────────────────────────────
  // Doctor Report
  // ───────────────────────────────────────────

  async getDoctorReport(tenantId: string, from: string, to: string) {
    const dateFrom = new Date(from);
    const dateTo = new Date(to);
    dateTo.setHours(23, 59, 59, 999);

    // Get orders with referring doctor info
    const orders = await this.prisma.order.findMany({
      where: {
        tenantId,
        createdAt: { gte: dateFrom, lte: dateTo },
        status: { not: "CANCELLED" },
      },
      select: {
        id: true,
        netAmount: true,
        patient: {
          select: { referringDoctorId: true },
        },
      },
    });

    // Group by doctor
    const doctorOrderMap: Record<string, { count: number; revenue: number }> = {};
    for (const order of orders) {
      const docId = order.patient?.referringDoctorId;
      if (!docId) continue;
      if (!doctorOrderMap[docId]) {
        doctorOrderMap[docId] = { count: 0, revenue: 0 };
      }
      const docEntry = doctorOrderMap[docId]!;
      docEntry.count += 1;
      docEntry.revenue += Number(order.netAmount);
    }

    const doctorIds = Object.keys(doctorOrderMap);
    const doctors = await this.prisma.doctor.findMany({
      where: { id: { in: doctorIds }, tenantId },
      select: {
        id: true,
        name: true,
        specialty: true,
        clinicName: true,
        phone: true,
      },
    });

    // Get commission data
    const commissions = await this.prisma.doctorCommission.groupBy({
      by: ["doctorId"],
      where: {
        doctor: { tenantId },
        createdAt: { gte: dateFrom, lte: dateTo },
      },
      _sum: { amount: true },
    });

    const commissionMap = new Map(
      commissions.map((c) => [c.doctorId, Number(c._sum.amount ?? 0)]),
    );

    const doctorMap = new Map(doctors.map((d) => [d.id, d]));

    const report = doctorIds
      .map((docId) => {
        const doc = doctorMap.get(docId);
        const data = doctorOrderMap[docId];
        return {
          doctorId: docId,
          name: doc?.name ?? "Unknown",
          specialty: doc?.specialty ?? null,
          clinicName: doc?.clinicName ?? null,
          phone: doc?.phone ?? null,
          orderCount: data?.count ?? 0,
          revenue: data?.revenue ?? 0,
          commission: commissionMap.get(docId) ?? 0,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    return {
      from,
      to,
      totalDoctors: report.length,
      totalRevenue: report.reduce((s, d) => s + d.revenue, 0),
      totalCommission: report.reduce((s, d) => s + d.commission, 0),
      doctors: report,
    };
  }
}
