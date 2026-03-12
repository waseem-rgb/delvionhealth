import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

function serializeBigInt<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
}

@Injectable()
export class WellnessService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(tenantId: string, corporateId: string, locationId?: string) {
    const memberWhere: any = { tenantId, corporateId };
    if (locationId) memberWhere.locationId = locationId;

    const [totalMembers, activeMembers, exitedMembers] = await Promise.all([
      this.prisma.corporateMember.count({ where: memberWhere }),
      this.prisma.corporateMember.count({ where: { ...memberWhere, status: 'ACTIVE' } }),
      this.prisma.corporateMember.count({ where: { ...memberWhere, status: 'EXITED' } }),
    ]);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [thisMonthOrders, lastMonthOrders] = await Promise.all([
      this.prisma.corporateOrder.count({
        where: { tenantId, corporateId, createdAt: { gte: monthStart } },
      }),
      this.prisma.corporateOrder.count({
        where: { tenantId, corporateId, createdAt: { gte: lastMonthStart, lt: monthStart } },
      }),
    ]);

    const upcomingEvents = await this.prisma.corporateEvent.findMany({
      where: { tenantId, corporateId, scheduledDate: { gte: now }, status: 'SCHEDULED' },
      orderBy: { scheduledDate: 'asc' },
      take: 5,
    });

    const packages = await this.prisma.corporatePackage.findMany({
      where: { tenantId, corporateId, status: 'ACTIVE' },
      select: { id: true, name: true, maxUses: true, usedCount: true },
    });

    return serializeBigInt({
      memberStats: { totalMembers, activeMembers, exitedMembers },
      orders: { thisMonth: thisMonthOrders, lastMonth: lastMonthOrders },
      upcomingEvents,
      packageUtilization: packages.map((p) => ({
        ...p,
        remaining: p.maxUses ? p.maxUses - p.usedCount : null,
        percent: p.maxUses ? Math.round((p.usedCount / p.maxUses) * 100) : null,
      })),
    });
  }
}
