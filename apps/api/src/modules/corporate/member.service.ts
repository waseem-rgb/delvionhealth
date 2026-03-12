import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MemberService {
  constructor(private readonly prisma: PrismaService) {}

  async getMembers(tenantId: string, corporateId: string, query: any) {
    const where: any = { tenantId, corporateId };
    if (query.status) where.status = query.status;
    if (query.locationId) where.locationId = query.locationId;
    if (query.groupId) where.groupId = query.groupId;
    const page = parseInt(query.page ?? '1', 10);
    const [data, total] = await Promise.all([
      this.prisma.corporateMember.findMany({
        where,
        include: {
          patient: { select: { id: true, mrn: true, firstName: true, lastName: true, phone: true } },
          group: { select: { name: true, groupCode: true } },
          location: { select: { locationName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * 20,
        take: 20,
      }),
      this.prisma.corporateMember.count({ where }),
    ]);
    return { data, meta: { total, page } };
  }

  async exitMember(tenantId: string, memberId: string) {
    const member = await this.prisma.corporateMember.findFirst({ where: { id: memberId, tenantId } });
    if (!member) throw new NotFoundException('Member not found');
    return this.prisma.corporateMember.update({
      where: { id: memberId },
      data: { status: 'EXITED', exitDate: new Date() },
    });
  }

  async addDependent(tenantId: string, dto: any) {
    return this.prisma.corporateDependent.create({ data: { ...dto, tenantId } });
  }

  async getDependents(tenantId: string, memberId: string) {
    return this.prisma.corporateDependent.findMany({
      where: { memberId },
      include: { patient: { select: { id: true, mrn: true, firstName: true, lastName: true } } },
    });
  }

  async getMemberOrders(tenantId: string, memberId: string) {
    return this.prisma.corporateOrder.findMany({
      where: { memberId, tenantId },
      include: {
        package: { select: { name: true } },
        event: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async globalSearch(tenantId: string, query: any) {
    const where: any = { tenantId };
    if (query.corporateId) where.corporateId = query.corporateId;
    if (query.status) where.status = query.status;
    return this.prisma.corporateMember.findMany({
      where,
      include: {
        patient: { select: { mrn: true, firstName: true, lastName: true, phone: true } },
        corporate: { select: { name: true, corporateCode: true } },
        group: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
