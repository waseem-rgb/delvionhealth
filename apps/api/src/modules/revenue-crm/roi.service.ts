import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RoiService {
  constructor(private prisma: PrismaService) {}

  async getRoiData(tenantId: string, from?: string, to?: string) {
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();

    const [campaigns, leadStats, repeatStats] = await Promise.all([
      this.prisma.campaign.findMany({
        where: { tenantId, createdAt: { gte: fromDate, lte: toDate } },
        select: { id: true, name: true, type: true, revenue: true, totalRecipients: true, converted: true, sent: true },
        orderBy: { revenue: 'desc' },
        take: 20,
      }),
      this.prisma.marketingLead.groupBy({
        by: ['status'],
        where: { tenantId, createdAt: { gte: fromDate, lte: toDate } },
        _count: true,
      }),
      this.prisma.repeatTestCandidate.groupBy({
        by: ['contacted', 'converted'],
        where: { tenantId },
        _count: true,
      }),
    ]);

    const campaignRevenue = campaigns.reduce((s, c) => s + Number(c.revenue || 0), 0);
    const leadConversions = leadStats.find(l => l.status === 'CONVERTED')?._count || 0;

    return {
      kpis: {
        campaignRevenue,
        leadsConverted: leadConversions,
        repeatRevenue: 0, // would need to link to orders
        totalCrmRevenue: campaignRevenue,
      },
      campaigns: campaigns.map(c => ({
        name: c.name,
        type: c.type,
        revenue: Number(c.revenue),
        converted: c.converted,
        reached: c.totalRecipients,
      })),
      leadFunnel: leadStats.map(l => ({ status: l.status, count: l._count })),
      repeatSummary: {
        total: repeatStats.reduce((s, r) => s + r._count, 0),
        contacted: repeatStats.filter(r => r.contacted).reduce((s, r) => s + r._count, 0),
        converted: repeatStats.find(r => r.converted)?._count || 0,
      },
    };
  }
}
