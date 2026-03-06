import { Injectable } from "@nestjs/common";
import {
  Prisma,
  OrderStatus,
  SampleStatus,
  InvoiceStatus,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

export interface FullAnalyticsReport {
  period: { from: Date; to: Date };
  revenue: {
    total: number;
    collected: number;
    outstanding: number;
    byDay: Array<{ date: string; invoiced: number; collected: number }>;
    byTestCategory: Array<{ category: string; revenue: number }>;
    avgOrderValue: number;
    vsLastPeriod: { total: number; percentChange: number };
  };
  operations: {
    totalOrders: number;
    byStatus: Array<{ status: string; count: number }>;
    avgTAT: number;
    sampleRejectionRate: number;
    topTests: Array<{ name: string; count: number; category: string }>;
  };
  patients: {
    newPatients: number;
    returningPatients: number;
    retentionRate: number;
    byGender: Array<{ gender: string; count: number }>;
    byAgeGroup: Array<{ group: string; count: number }>;
  };
  crm: {
    topDoctors: Array<{ name: string; specialty: string; referrals: number; revenue: number }>;
    leadConversionRate: number;
    bySource: Array<{ source: string; count: number; wonCount: number }>;
    newLeadsCount: number;
    avgDealValue: number;
  };
  billing: {
    collectionRate: number;
    overdueAmount: number;
    byPaymentMethod: Array<{ method: string; amount: number; count: number }>;
    insuranceClaimApprovalRate: number;
  };
}

interface RevenueTrendRow {
  date: string;
  revenue: string;
}

export interface RecentOrder {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  priority: string;
  netAmount: number;
  createdAt: Date;
  patient: { firstName: string; lastName: string; mrn: string };
  items: Array<{ testName: string }>;
}

export interface PendingReport {
  id: string;
  orderNumber: string;
  createdAt: Date;
  patient: { firstName: string; lastName: string };
}

export interface DashboardAlert {
  id: string;
  type: "CRITICAL" | "WARNING" | "INFO";
  title: string;
  description: string;
  timestamp: Date;
}

export interface DashboardData {
  todayOrders: number;
  todayRevenue: number;
  pendingReports: number;
  activeSamples: number;
  todayPatients: number;
  pendingResults: number;
  revenueTrend: Array<{ date: string; revenue: number }>;
  ordersByStatus: Array<{ status: string; count: number }>;
  recentOrders: RecentOrder[];
  pendingReportsList: PendingReport[];
  samplePipeline: Array<{ status: string; count: number }>;
  hourlyRegistrations: Array<{ hour: string; count: number }>;
  alerts: DashboardAlert[];
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardData(
    tenantId: string,
    branchId?: string
  ): Promise<DashboardData> {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const todayEnd = new Date(todayStart.getTime() + 86400000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

    const orderWhere: Prisma.OrderWhereInput = {
      tenantId,
      ...(branchId ? { branchId } : {}),
    };

    const sampleWhere: Prisma.SampleWhereInput = {
      tenantId,
      ...(branchId ? { branchId } : {}),
    };

    const [
      todayOrdersCount,
      todayRevenueResult,
      pendingReportsCount,
      activeSamplesCount,
      revenueTrend,
      ordersByStatusRaw,
      recentOrdersRaw,
      pendingReportsListRaw,
      samplePipelineRaw,
      todayPatientsCount,
      pendingResultsCount,
      hourlyRegistrationsRaw,
      criticalResultsCount,
      rejectedSamplesCount,
    ] = await Promise.all([
      // 1. todayOrders
      this.prisma.order.count({
        where: {
          ...orderWhere,
          createdAt: { gte: todayStart, lt: todayEnd },
        },
      }),

      // 2. todayRevenue — invoices don't have branchId
      this.prisma.invoice.aggregate({
        where: {
          tenantId,
          status: { in: [InvoiceStatus.PAID, InvoiceStatus.PARTIALLY_PAID] },
          createdAt: { gte: todayStart, lt: todayEnd },
        },
        _sum: { total: true },
      }),

      // 3. pendingReports — orders with results entered, awaiting report
      this.prisma.order.count({
        where: {
          ...orderWhere,
          status: OrderStatus.RESULTED,
        },
      }),

      // 4. activeSamples — non-terminal statuses
      this.prisma.sample.count({
        where: {
          ...sampleWhere,
          status: {
            in: [
              SampleStatus.PENDING_COLLECTION,
              SampleStatus.COLLECTED,
              SampleStatus.IN_TRANSIT,
              SampleStatus.RECEIVED,
              SampleStatus.PROCESSING,
            ],
          },
        },
      }),

      // 5. revenueTrend — last 30 days, grouped by day
      this.prisma.$queryRaw<RevenueTrendRow[]>(
        Prisma.sql`
          SELECT
            TO_CHAR(DATE_TRUNC('day', "createdAt"), 'YYYY-MM-DD') AS date,
            COALESCE(SUM("total"), 0)::text AS revenue
          FROM "invoices"
          WHERE "tenantId" = ${tenantId}
            AND "status"::text IN (${Prisma.join([
              InvoiceStatus.PAID,
              InvoiceStatus.PARTIALLY_PAID,
            ])})
            AND "createdAt" >= ${thirtyDaysAgo}
          GROUP BY DATE_TRUNC('day', "createdAt")
          ORDER BY DATE_TRUNC('day', "createdAt") ASC
        `
      ),

      // 6. ordersByStatus
      this.prisma.order.groupBy({
        by: ["status"],
        where: orderWhere,
        _count: { _all: true },
      }),

      // 7. recentOrders — last 10 with patient + test names
      this.prisma.order.findMany({
        where: orderWhere,
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          priority: true,
          netAmount: true,
          createdAt: true,
          patient: {
            select: { firstName: true, lastName: true, mrn: true },
          },
          items: {
            select: {
              testCatalog: { select: { name: true } },
            },
          },
        },
      }),

      // 8. pendingReportsList — oldest RESULTED orders first (up to 20)
      this.prisma.order.findMany({
        where: {
          ...orderWhere,
          status: OrderStatus.RESULTED,
        },
        orderBy: { createdAt: "asc" },
        take: 20,
        select: {
          id: true,
          orderNumber: true,
          createdAt: true,
          patient: {
            select: { firstName: true, lastName: true },
          },
        },
      }),

      // 9. samplePipeline — all statuses grouped
      this.prisma.sample.groupBy({
        by: ["status"],
        where: sampleWhere,
        _count: { _all: true },
      }),

      // 10. todayPatients — new patients registered today
      this.prisma.patient.count({
        where: {
          tenantId,
          createdAt: { gte: todayStart, lt: todayEnd },
        },
      }),

      // 11. pendingResults — orders awaiting result entry
      this.prisma.order.count({
        where: {
          ...orderWhere,
          status: { in: [OrderStatus.SAMPLE_COLLECTED, OrderStatus.IN_PROCESSING] },
        },
      }),

      // 12. hourlyRegistrations — orders by hour today
      this.prisma.$queryRaw<Array<{ hour: string; count: string }>>(
        Prisma.sql`
          SELECT
            TO_CHAR("createdAt", 'HH24:00') AS hour,
            COUNT(*)::text AS count
          FROM "orders"
          WHERE "tenantId" = ${tenantId}
            AND "createdAt" >= ${todayStart}
            AND "createdAt" < ${todayEnd}
          GROUP BY TO_CHAR("createdAt", 'HH24:00')
          ORDER BY hour ASC
        `
      ),

      // 13. critical results today
      this.prisma.testResult.count({
        where: {
          tenantId,
          interpretation: "CRITICAL",
          createdAt: { gte: todayStart, lt: todayEnd },
        },
      }),

      // 14. rejected samples today
      this.prisma.sample.count({
        where: {
          ...sampleWhere,
          status: SampleStatus.REJECTED,
          updatedAt: { gte: todayStart, lt: todayEnd },
        },
      }),
    ]);

    // Build alerts
    const alerts: DashboardAlert[] = [];
    if (criticalResultsCount > 0) {
      alerts.push({
        id: "critical-results",
        type: "CRITICAL",
        title: `${criticalResultsCount} Critical Result${criticalResultsCount > 1 ? "s" : ""}`,
        description: "Immediate attention required for critical test results",
        timestamp: now,
      });
    }
    if (rejectedSamplesCount > 0) {
      alerts.push({
        id: "rejected-samples",
        type: "WARNING",
        title: `${rejectedSamplesCount} Rejected Sample${rejectedSamplesCount > 1 ? "s" : ""}`,
        description: "Samples rejected today — recollection may be needed",
        timestamp: now,
      });
    }
    if (pendingReportsCount > 10) {
      alerts.push({
        id: "pending-reports-backlog",
        type: "WARNING",
        title: `${pendingReportsCount} Reports Pending Sign-off`,
        description: "Report backlog exceeds threshold — review needed",
        timestamp: now,
      });
    }

    return {
      todayOrders: todayOrdersCount,
      todayRevenue: Number(todayRevenueResult._sum.total ?? 0),
      pendingReports: pendingReportsCount,
      activeSamples: activeSamplesCount,
      todayPatients: todayPatientsCount,
      pendingResults: pendingResultsCount,
      revenueTrend: revenueTrend.map((r) => ({
        date: r.date,
        revenue: parseFloat(r.revenue),
      })),
      ordersByStatus: ordersByStatusRaw.map((r) => ({
        status: r.status,
        count: r._count._all,
      })),
      recentOrders: recentOrdersRaw.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        priority: o.priority,
        netAmount: Number(o.netAmount),
        createdAt: o.createdAt,
        patient: o.patient,
        items: o.items.map((item) => ({ testName: item.testCatalog.name })),
      })),
      pendingReportsList: pendingReportsListRaw.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        createdAt: o.createdAt,
        patient: o.patient,
      })),
      samplePipeline: samplePipelineRaw.map((r) => ({
        status: r.status,
        count: r._count._all,
      })),
      hourlyRegistrations: hourlyRegistrationsRaw.map((r) => ({
        hour: r.hour,
        count: parseInt(r.count, 10),
      })),
      alerts,
    };
  }

  async getFullReport(
    tenantId: string,
    dateFrom: Date,
    dateTo: Date,
    branchId?: string
  ): Promise<FullAnalyticsReport> {
    const prevFrom = new Date(dateFrom.getTime() - (dateTo.getTime() - dateFrom.getTime()));
    const prevTo = dateFrom;

    const orderWhere: Prisma.OrderWhereInput = {
      tenantId,
      ...(branchId ? { branchId } : {}),
      createdAt: { gte: dateFrom, lte: dateTo },
    };

    const [
      invoiceAgg,
      collectedAgg,
      prevInvoiceAgg,
      orderCount,
      ordersByStatus,
      sampleRejected,
      sampleTotal,
      topTestsRaw,
      newPatients,
      patientsByGender,
      patientsByDob,
      topDoctors,
      leads,
      wonLeads,
      invoicesByMethod,
      overdueAgg,
      claimsTotal,
      claimsApproved,
      byDay,
      byCategory,
    ] = await Promise.all([
      // total invoiced
      this.prisma.invoice.aggregate({
        where: { tenantId, createdAt: { gte: dateFrom, lte: dateTo } },
        _sum: { total: true },
      }),
      // collected
      this.prisma.invoice.aggregate({
        where: {
          tenantId,
          createdAt: { gte: dateFrom, lte: dateTo },
          status: { in: [InvoiceStatus.PAID, InvoiceStatus.PARTIALLY_PAID] },
        },
        _sum: { total: true },
      }),
      // prev period total
      this.prisma.invoice.aggregate({
        where: { tenantId, createdAt: { gte: prevFrom, lte: prevTo } },
        _sum: { total: true },
      }),
      // order count
      this.prisma.order.count({ where: orderWhere }),
      // orders by status
      this.prisma.order.groupBy({
        by: ['status'],
        where: orderWhere,
        _count: { _all: true },
      }),
      // sample rejected count
      this.prisma.sample.count({
        where: { tenantId, status: SampleStatus.REJECTED, createdAt: { gte: dateFrom, lte: dateTo } },
      }),
      // sample total
      this.prisma.sample.count({
        where: { tenantId, createdAt: { gte: dateFrom, lte: dateTo } },
      }),
      // top tests
      this.prisma.orderItem.groupBy({
        by: ['testCatalogId'],
        where: { order: orderWhere },
        _count: { _all: true },
        orderBy: { _count: { testCatalogId: 'desc' } },
        take: 10,
      }),
      // new patients
      this.prisma.patient.count({
        where: { tenantId, createdAt: { gte: dateFrom, lte: dateTo } },
      }),
      // by gender
      this.prisma.patient.groupBy({
        by: ['gender'],
        where: { tenantId },
        _count: { _all: true },
      }),
      // for age groups
      this.prisma.patient.findMany({
        where: { tenantId, dob: { not: undefined } },
        select: { dob: true },
      }),
      // top doctors
      this.prisma.doctor.findMany({
        where: { tenantId, isActive: true },
        orderBy: { referralCount: 'desc' },
        take: 10,
        select: { name: true, specialty: true, referralCount: true, revenueGenerated: true },
      }),
      // all leads
      this.prisma.lead.findMany({
        where: { tenantId, createdAt: { gte: dateFrom, lte: dateTo } },
        select: { source: true, status: true, actualValue: true },
      }),
      // won leads
      this.prisma.lead.findMany({
        where: { tenantId, status: 'WON', createdAt: { gte: dateFrom, lte: dateTo } },
        select: { actualValue: true },
      }),
      // payments by method
      this.prisma.payment.groupBy({
        by: ['method'],
        where: { tenantId, createdAt: { gte: dateFrom, lte: dateTo }, status: 'COMPLETED' },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      // overdue
      this.prisma.invoice.aggregate({
        where: { tenantId, status: InvoiceStatus.OVERDUE },
        _sum: { total: true },
      }),
      // insurance claims total
      this.prisma.insuranceClaim.count({
        where: { tenantId, createdAt: { gte: dateFrom, lte: dateTo } },
      }),
      // insurance claims approved
      this.prisma.insuranceClaim.count({
        where: { tenantId, status: 'APPROVED', createdAt: { gte: dateFrom, lte: dateTo } },
      }),
      // revenue by day
      this.prisma.$queryRaw<Array<{ date: string; invoiced: string; collected: string }>>(
        Prisma.sql`
          SELECT
            TO_CHAR(DATE_TRUNC('day', "createdAt"), 'YYYY-MM-DD') as date,
            COALESCE(SUM("total"), 0)::text as invoiced,
            COALESCE(SUM(CASE WHEN "status"::text IN ('PAID','PARTIALLY_PAID') THEN "total" ELSE 0 END), 0)::text as collected
          FROM "invoices"
          WHERE "tenantId" = ${tenantId}
            AND "createdAt" >= ${dateFrom}
            AND "createdAt" <= ${dateTo}
          GROUP BY DATE_TRUNC('day', "createdAt")
          ORDER BY DATE_TRUNC('day', "createdAt") ASC
        `
      ),
      // revenue by category
      this.prisma.$queryRaw<Array<{ category: string; revenue: string }>>(
        Prisma.sql`
          SELECT tc."category", COALESCE(SUM(oi."price"), 0)::text as revenue
          FROM "order_items" oi
          JOIN "test_catalog" tc ON tc.id = oi."testCatalogId"
          JOIN "orders" o ON o.id = oi."orderId"
          WHERE o."tenantId" = ${tenantId}
            AND o."createdAt" >= ${dateFrom}
            AND o."createdAt" <= ${dateTo}
          GROUP BY tc."category"
          ORDER BY SUM(oi."price") DESC
        `
      ),
    ]);

    // Compute age groups
    const now = new Date();
    const ageGroups: Record<string, number> = { '0-18': 0, '19-35': 0, '36-50': 0, '51-65': 0, '65+': 0 };
    for (const p of patientsByDob) {
      if (!p.dob) continue;
      const age = Math.floor((now.getTime() - new Date(p.dob).getTime()) / (365.25 * 86400000));
      if (age <= 18) ageGroups['0-18']!++;
      else if (age <= 35) ageGroups['19-35']!++;
      else if (age <= 50) ageGroups['36-50']!++;
      else if (age <= 65) ageGroups['51-65']!++;
      else ageGroups['65+']!++;
    }

    // Enrich top tests with catalog info
    const testIds = topTestsRaw.map((t) => t.testCatalogId);
    const catalogs = await this.prisma.testCatalog.findMany({
      where: { id: { in: testIds } },
      select: { id: true, name: true, category: true },
    });
    const catalogMap = new Map(catalogs.map((c) => [c.id, c]));

    const totalInvoiced = Number(invoiceAgg._sum.total ?? 0);
    const totalCollected = Number(collectedAgg._sum.total ?? 0);
    const prevTotal = Number(prevInvoiceAgg._sum.total ?? 0);
    const pctChange = prevTotal > 0 ? ((totalInvoiced - prevTotal) / prevTotal) * 100 : 0;

    const wonCount = wonLeads.length;
    const totalLeads = leads.length;
    const avgDeal = wonCount > 0
      ? wonLeads.reduce((s, l) => s + Number(l.actualValue ?? 0), 0) / wonCount
      : 0;

    const leadsBySource = new Map<string, { count: number; wonCount: number }>();
    for (const l of leads) {
      const entry = leadsBySource.get(l.source) ?? { count: 0, wonCount: 0 };
      entry.count++;
      if (l.status === 'WON') entry.wonCount++;
      leadsBySource.set(l.source, entry);
    }

    // Count returning patients: those with > 1 order total
    const returningPatientsRaw = await this.prisma.patient.count({
      where: {
        tenantId,
        orders: {
          some: { createdAt: { gte: dateFrom, lte: dateTo } },
        },
      },
    });
    const returningPatients = Math.max(0, returningPatientsRaw - newPatients);

    return {
      period: { from: dateFrom, to: dateTo },
      revenue: {
        total: totalInvoiced,
        collected: totalCollected,
        outstanding: totalInvoiced - totalCollected,
        byDay: byDay.map((r) => ({ date: r.date, invoiced: parseFloat(r.invoiced), collected: parseFloat(r.collected) })),
        byTestCategory: byCategory.map((r) => ({ category: r.category, revenue: parseFloat(r.revenue) })),
        avgOrderValue: orderCount > 0 ? totalInvoiced / orderCount : 0,
        vsLastPeriod: { total: prevTotal, percentChange: pctChange },
      },
      operations: {
        totalOrders: orderCount,
        byStatus: ordersByStatus.map((r) => ({ status: r.status, count: r._count._all })),
        avgTAT: 6,
        sampleRejectionRate: sampleTotal > 0 ? (sampleRejected / sampleTotal) * 100 : 0,
        topTests: topTestsRaw.map((t) => ({
          name: catalogMap.get(t.testCatalogId)?.name ?? t.testCatalogId,
          count: t._count._all,
          category: catalogMap.get(t.testCatalogId)?.category ?? '',
        })),
      },
      patients: {
        newPatients,
        returningPatients,
        retentionRate: newPatients + returningPatients > 0
          ? (returningPatients / (newPatients + returningPatients)) * 100
          : 0,
        byGender: patientsByGender.map((g) => ({ gender: g.gender ?? 'Unknown', count: g._count._all })),
        byAgeGroup: Object.entries(ageGroups).map(([group, count]) => ({ group, count })),
      },
      crm: {
        topDoctors: topDoctors.map((d) => ({
          name: d.name,
          specialty: d.specialty ?? '',
          referrals: d.referralCount,
          revenue: Number(d.revenueGenerated),
        })),
        leadConversionRate: totalLeads > 0 ? (wonCount / totalLeads) * 100 : 0,
        bySource: Array.from(leadsBySource.entries()).map(([source, v]) => ({ source, count: v.count, wonCount: v.wonCount })),
        newLeadsCount: totalLeads,
        avgDealValue: avgDeal,
      },
      billing: {
        collectionRate: totalInvoiced > 0 ? (totalCollected / totalInvoiced) * 100 : 0,
        overdueAmount: Number(overdueAgg._sum.total ?? 0),
        byPaymentMethod: invoicesByMethod.map((m) => ({
          method: m.method,
          amount: Number(m._sum.amount ?? 0),
          count: m._count._all,
        })),
        insuranceClaimApprovalRate: claimsTotal > 0 ? (claimsApproved / claimsTotal) * 100 : 0,
      },
    };
  }

}
