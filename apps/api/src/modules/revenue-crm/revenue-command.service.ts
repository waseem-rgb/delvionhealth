import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class RevenueCommandService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Aggregate dashboard overview data.
   */
  async getOverview(tenantId: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const [
      revenueMTD,
      ordersToday,
      pendingCollections,
      activeCampaigns,
      pipelineValue,
      topDoctors,
      salesScoreboard,
    ] = await Promise.all([
      // Total revenue MTD
      this.prisma.order.aggregate({
        where: {
          tenantId,
          createdAt: { gte: monthStart },
        },
        _sum: { netAmount: true },
      }),

      // Orders today count
      this.prisma.order.count({
        where: {
          tenantId,
          createdAt: { gte: todayStart, lte: todayEnd },
        },
      }),

      // Pending collections
      this.prisma.order.aggregate({
        where: {
          tenantId,
          paymentStatus: "UNPAID",
        },
        _sum: { netAmount: true },
      }),

      // Active campaigns
      this.prisma.labCampaign.count({
        where: {
          tenantId,
          status: "ACTIVE",
        },
      }),

      // Pipeline value (deals not WON or LOST)
      this.prisma.salesDeal.aggregate({
        where: {
          tenantId,
          stage: { notIn: ["WON", "LOST"] },
        },
        _sum: { estimatedValue: true },
      }),

      // Top 5 referring doctors by totalRevenue
      this.prisma.referringDoctor.findMany({
        where: { tenantId },
        orderBy: { totalRevenue: "desc" },
        take: 5,
        select: {
          id: true,
          name: true,
          totalRevenue: true,
          totalReferrals: true,
          revShareEarned: true,
        },
      }),

      // Sales team scoreboard — top 10 reps
      this.prisma.salesRep.findMany({
        where: { tenantId },
        orderBy: { revenueMTD: "desc" },
        take: 10,
        select: {
          id: true,
          name: true,
          revenueTarget: true,
          revenueMTD: true,
          revShareEarned: true,
        },
      }),
    ]);

    return {
      revenueMTD: revenueMTD._sum.netAmount ?? 0,
      ordersToday,
      pendingCollections: pendingCollections._sum.netAmount ?? 0,
      activeCampaigns,
      pipelineValue: pipelineValue._sum.estimatedValue ?? 0,
      topDoctors,
      salesScoreboard,
    };
  }

  /**
   * AI-driven alerts (mock structure — actual AI integration later).
   */
  async getAlerts(tenantId: string) {
    // Static mock alerts; replace with actual AI engine when ready.
    return [
      {
        type: "REVENUE_DROP",
        severity: "HIGH",
        message:
          "Revenue is 12% below target this month. Consider activating dormant doctor relationships.",
        actionLabel: "View Doctors",
        actionUrl: `/revenue-crm/doctors?tenantId=${tenantId}`,
      },
      {
        type: "DEAL_STALE",
        severity: "MEDIUM",
        message:
          "3 deals have been in the same stage for over 14 days without activity.",
        actionLabel: "View Stale Deals",
        actionUrl: `/revenue-crm/deals?stale=true`,
      },
      {
        type: "COLLECTION_PENDING",
        severity: "HIGH",
        message:
          "Pending collections have exceeded the monthly threshold. Follow up on unpaid orders.",
        actionLabel: "View Collections",
        actionUrl: `/revenue-crm/revshare/ledger?status=PENDING`,
      },
      {
        type: "TOP_PERFORMER",
        severity: "LOW",
        message:
          "Sales rep has achieved 120% of monthly target. Consider recognizing their performance.",
        actionLabel: "View Scoreboard",
        actionUrl: `/revenue-crm/overview`,
      },
    ];
  }
}
