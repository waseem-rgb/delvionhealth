import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

function bigintReplacer(_: string, v: unknown): unknown {
  return typeof v === 'bigint' ? v.toString() : v;
}

function serializeBigInt<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj, bigintReplacer));
}

@Injectable()
export class CorporateService {
  constructor(private readonly prisma: PrismaService) {}

  private generateCorporateCode(name: string, city: string, seq: number): string {
    const namePart = name.replace(/[^A-Za-z]/g, '').substring(0, 4).toUpperCase();
    const cityPart = city.replace(/[^A-Za-z]/g, '').substring(0, 3).toUpperCase();
    return `${namePart}-${cityPart}-${String(seq).padStart(3, '0')}`;
  }

  async create(tenantId: string, userId: string, dto: any) {
    let code = dto.corporateCode;
    if (!code) {
      const count = await this.prisma.corporate.count({ where: { tenantId } });
      code = this.generateCorporateCode(dto.name, dto.city, count + 1);
    }
    const existing = await this.prisma.corporate.findUnique({ where: { corporateCode: code } });
    if (existing) throw new BadRequestException(`Corporate code ${code} already exists`);

    const corporate = await this.prisma.corporate.create({
      data: {
        tenantId,
        name: dto.name,
        corporateCode: code,
        industry: dto.industry,
        address: dto.address,
        city: dto.city,
        pincode: dto.pincode,
        contactName: dto.contactName,
        contactPhone: dto.contactPhone,
        contactEmail: dto.contactEmail,
        notes: dto.notes,
        createdById: userId,
        locations: {
          create: {
            tenantId,
            locationName: 'HQ',
            locationCode: `${code}-HQ`,
            city: dto.city,
            address: dto.address,
          },
        },
      },
      include: { locations: true },
    });

    if (dto.adminEmail) {
      const bcrypt = await import('bcryptjs');
      const tmpPass = Math.random().toString(36).substring(2, 10);
      const hash = await bcrypt.hash(tmpPass, 10);
      await this.prisma.corporateAdminPortal.create({
        data: {
          corporateId: corporate.id,
          tenantId,
          adminName: dto.adminName ?? dto.contactName,
          designation: dto.adminDesignation,
          email: dto.adminEmail,
          phone: dto.adminPhone ?? dto.contactPhone,
          passwordHash: hash,
        },
      });
    }

    return serializeBigInt(corporate);
  }

  async findAll(tenantId: string, query: any) {
    const where: any = { tenantId };
    if (query.status) where.status = query.status;
    if (query.city) where.city = { contains: query.city, mode: 'insensitive' };
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { corporateCode: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const page = parseInt(query.page ?? '1', 10);
    const limit = parseInt(query.limit ?? '20', 10);
    const [data, total] = await Promise.all([
      this.prisma.corporate.findMany({
        where,
        include: { _count: { select: { members: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.corporate.count({ where }),
    ]);
    return { data: serializeBigInt(data), meta: { total, page, limit } };
  }

  async findOne(tenantId: string, id: string) {
    const c = await this.prisma.corporate.findFirst({
      where: { id, tenantId },
      include: {
        locations: true,
        groups: true,
        adminPortals: { select: { id: true, adminName: true, email: true, isActive: true, lastLoginAt: true } },
        _count: { select: { members: true, events: true, invoices: true } },
      },
    });
    if (!c) throw new NotFoundException('Corporate not found');
    return serializeBigInt(c);
  }

  async update(tenantId: string, id: string, dto: any) {
    await this.findOne(tenantId, id);
    const result = await this.prisma.corporate.update({ where: { id }, data: dto });
    return serializeBigInt(result);
  }

  async addLocation(tenantId: string, corporateId: string, dto: any) {
    const corp = await this.findOne(tenantId, corporateId);
    const seq = (await this.prisma.corporateLocation.count({ where: { corporateId } })) + 1;
    const cityCode = dto.city.replace(/[^A-Za-z]/g, '').substring(0, 3).toUpperCase();
    const locationCode = `${(corp as any).corporateCode}-${cityCode}-${String(seq).padStart(2, '0')}`;
    return this.prisma.corporateLocation.create({
      data: { ...dto, corporateId, tenantId, locationCode },
    });
  }

  async createGroup(tenantId: string, corporateId: string, dto: any) {
    const corp = await this.findOne(tenantId, corporateId);
    const groupCode = `${(corp as any).corporateCode}-${dto.codeSuffix ?? dto.name.substring(0, 2).toUpperCase()}`;
    return this.prisma.corporateGroup.create({
      data: { ...dto, corporateId, tenantId, groupCode },
    });
  }

  async getDashboard(tenantId: string) {
    const [totalCorporates, activeMembers, thisMonthOrders, upcomingEvents, pendingInvoices] = await Promise.all([
      this.prisma.corporate.count({ where: { tenantId } }),
      this.prisma.corporateMember.count({ where: { tenantId, status: 'ACTIVE' } }),
      this.prisma.corporateOrder.count({
        where: {
          tenantId,
          createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
      }),
      this.prisma.corporateEvent.count({
        where: { tenantId, scheduledDate: { gte: new Date() }, status: 'SCHEDULED' },
      }),
      this.prisma.corporateInvoice.count({
        where: { tenantId, status: { in: ['RAISED', 'SENT', 'PARTIALLY_PAID', 'OVERDUE'] } },
      }),
    ]);

    const recentCorporates = await this.prisma.corporate.findMany({
      where: { tenantId },
      include: { _count: { select: { members: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const upcomingEventsList = await this.prisma.corporateEvent.findMany({
      where: { tenantId, scheduledDate: { gte: new Date() } },
      include: { corporate: { select: { name: true } } },
      orderBy: { scheduledDate: 'asc' },
      take: 5,
    });

    const pendingInvoicesList = await this.prisma.corporateInvoice.findMany({
      where: { tenantId, status: { in: ['RAISED', 'SENT', 'PARTIALLY_PAID', 'OVERDUE'] } },
      include: { corporate: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return serializeBigInt({
      stats: { totalCorporates, activeMembers, thisMonthOrders, upcomingEvents, pendingInvoices },
      recentCorporates,
      upcomingEvents: upcomingEventsList,
      pendingInvoices: pendingInvoicesList,
    });
  }

  async getEffectiveDiscount(tenantId: string, patientId: string, _testId: string) {
    const member = await this.prisma.corporateMember.findFirst({
      where: { patientId, tenantId, status: 'ACTIVE' },
      include: { group: true, corporate: true },
    });
    if (!member) return { discount: 0, corporate: null };

    let discount = 0;
    if (member.group) {
      discount = member.group.discountPercent;
    }
    return serializeBigInt({
      discount,
      corporate: member.corporate,
      group: member.group,
      member,
    });
  }

  // Industry masters
  async getIndustries(tenantId: string) {
    return this.prisma.industryMaster.findMany({ where: { tenantId, isActive: true } });
  }

  async createIndustry(tenantId: string, dto: any) {
    return this.prisma.industryMaster.create({ data: { ...dto, tenantId } });
  }

  async updateIndustry(id: string, dto: any) {
    return this.prisma.industryMaster.update({ where: { id }, data: dto });
  }

  // Feedback helpers
  async getFeedback(tenantId: string, query: any) {
    return this.prisma.corporateFeedback.findMany({
      where: { tenantId, ...(query.status && { status: query.status }) },
      include: { corporate: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async replyFeedback(id: string, userId: string, dto: any) {
    return this.prisma.corporateFeedback.update({
      where: { id },
      data: { reply: dto.reply, status: 'REPLIED', repliedById: userId, repliedAt: new Date() },
    });
  }

  // Mailer
  async sendMailer(tenantId: string, userId: string, dto: any) {
    return this.prisma.corporateMailer.create({
      data: { ...dto, tenantId, sentById: userId, sentAt: new Date() },
    });
  }

  // Location update
  async updateLocation(id: string, dto: any) {
    return this.prisma.corporateLocation.update({ where: { id }, data: dto });
  }

  // Group update
  async updateGroup(id: string, dto: any) {
    return this.prisma.corporateGroup.update({ where: { id }, data: dto });
  }
}
