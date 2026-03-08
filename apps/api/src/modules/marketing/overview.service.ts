import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class OverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(tenantId: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [
      activeDoctors,
      newDoctorsThisMonth,
      liveCampaigns,
      scheduledCampaigns,
      campsThisMonth,
      campsPax,
    ] = await this.prisma.$transaction([
      this.prisma.referringDoctor.count({
        where: { tenantId, isActive: true, tier: { in: ["ACTIVE", "VIP"] } },
      }),
      this.prisma.referringDoctor.count({
        where: { tenantId, createdAt: { gte: monthStart } },
      }),
      this.prisma.labCampaign.count({
        where: { tenantId, status: "RUNNING" },
      }),
      this.prisma.labCampaign.count({
        where: { tenantId, status: "SCHEDULED" },
      }),
      this.prisma.healthCamp.count({
        where: { tenantId, campDate: { gte: monthStart, lte: monthEnd } },
      }),
      this.prisma.healthCamp.aggregate({
        where: { tenantId, campDate: { gte: monthStart, lte: monthEnd } },
        _sum: { expectedPax: true },
      }),
    ]);

    // Marketing revenue (campaigns + camps)
    const [campaignRevenue, campRevenue] = await this.prisma.$transaction([
      this.prisma.labCampaign.aggregate({
        where: { tenantId, startedAt: { gte: monthStart } },
        _sum: { revenueGenerated: true, costIncurred: true },
      }),
      this.prisma.healthCamp.aggregate({
        where: { tenantId, status: "COMPLETED", campDate: { gte: monthStart, lte: monthEnd } },
        _sum: { totalRevenue: true },
      }),
    ]);

    const totalRevenue =
      Number(campaignRevenue._sum.revenueGenerated ?? 0) +
      Number(campRevenue._sum.totalRevenue ?? 0);
    const totalCost = Number(campaignRevenue._sum.costIncurred ?? 0);
    const roi = totalCost > 0 ? (totalRevenue / totalCost).toFixed(1) : "N/A";

    // Top referring doctors this month
    const topDoctors = await this.prisma.referringDoctor.findMany({
      where: { tenantId, isActive: true, totalRevenue: { gt: 0 } },
      orderBy: { totalRevenue: "desc" },
      take: 10,
      select: { id: true, name: true, specialization: true, totalReferrals: true, totalRevenue: true },
    });

    // Recent activity
    const recentContacts = await this.prisma.doctorContact.findMany({
      where: { tenantId },
      orderBy: { contactedAt: "desc" },
      take: 5,
      include: { doctor: { select: { name: true } } },
    });

    const recentCamps = await this.prisma.healthCamp.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { id: true, name: true, organiserName: true, campDate: true, status: true, expectedPax: true },
    });

    return {
      kpis: {
        activeDoctors,
        newDoctorsThisMonth,
        liveCampaigns,
        scheduledCampaigns,
        campsThisMonth,
        campsPax: campsPax._sum.expectedPax ?? 0,
        totalRevenue,
        roi,
      },
      topDoctors,
      recentActivity: {
        contacts: recentContacts.map((c) => ({
          type: c.type,
          doctorName: c.doctor.name,
          notes: c.notes,
          date: c.contactedAt,
          outcome: c.outcome,
        })),
        camps: recentCamps,
      },
    };
  }
}
