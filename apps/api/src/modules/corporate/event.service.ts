import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class EventService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: any) {
    return this.prisma.corporateEvent.create({
      data: { ...dto, tenantId },
      include: {
        corporate: { select: { name: true } },
        package: { select: { name: true } },
      },
    });
  }

  async findAll(tenantId: string, query: any) {
    const where: any = { tenantId };
    if (query.corporateId) where.corporateId = query.corporateId;
    if (query.status) where.status = query.status;
    return this.prisma.corporateEvent.findMany({
      where,
      include: {
        corporate: { select: { name: true, corporateCode: true } },
        location: { select: { locationName: true } },
        package: { select: { name: true } },
        _count: { select: { orders: true } },
      },
      orderBy: { scheduledDate: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const ev = await this.prisma.corporateEvent.findFirst({
      where: { id, tenantId },
      include: {
        corporate: true,
        location: true,
        package: { include: { items: true } },
        orders: {
          include: {
            member: {
              include: {
                patient: { select: { mrn: true, firstName: true, lastName: true } },
              },
            },
          },
        },
      },
    });
    if (!ev) throw new NotFoundException('Event not found');
    return ev;
  }

  async update(tenantId: string, id: string, dto: any) {
    await this.findOne(tenantId, id);
    return this.prisma.corporateEvent.update({ where: { id }, data: dto });
  }
}
