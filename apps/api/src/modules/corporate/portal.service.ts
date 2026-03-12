import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class CorporatePortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string) {
    const admin = await this.prisma.corporateAdminPortal.findUnique({ where: { email } });
    if (!admin || !admin.isActive) throw new UnauthorizedException('Invalid credentials');
    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    await this.prisma.corporateAdminPortal.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });
    const token = this.jwt.sign({
      sub: admin.id,
      corporateId: admin.corporateId,
      role: 'CORPORATE_ADMIN',
    });
    return { token, corporateId: admin.corporateId, adminName: admin.adminName };
  }

  async getPortalDashboard(corporateId: string) {
    const [memberCount, upcomingEvents, recentOrders] = await Promise.all([
      this.prisma.corporateMember.count({ where: { corporateId, status: 'ACTIVE' } }),
      this.prisma.corporateEvent.findMany({
        where: { corporateId, scheduledDate: { gte: new Date() } },
        orderBy: { scheduledDate: 'asc' },
        take: 5,
      }),
      this.prisma.corporateOrder.count({
        where: {
          corporateId,
          createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
      }),
    ]);
    return { memberCount, upcomingEvents, thisMonthOrders: recentOrders };
  }

  async submitFeedback(corporateId: string, tenantId: string, dto: any) {
    return this.prisma.corporateFeedback.create({
      data: { corporateId, tenantId, ...dto, status: 'OPEN' },
    });
  }
}
