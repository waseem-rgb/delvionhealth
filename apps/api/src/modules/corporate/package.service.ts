import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

function serializeBigInt<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
}

@Injectable()
export class PackageService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: any) {
    const { items, ...rest } = dto;
    const grossPrice = BigInt(rest.grossPrice ?? 0);
    const discountAmount = BigInt(rest.discountAmount ?? 0);
    const netPrice = grossPrice - discountAmount;

    const result = await this.prisma.corporatePackage.create({
      data: {
        ...rest,
        tenantId,
        grossPrice,
        discountAmount,
        netPrice,
        items: items
          ? {
              create: items.map((item: any) => ({
                testId: item.testId,
                testName: item.testName,
                listedPrice: BigInt(item.listedPrice),
                discountAmount: BigInt(item.discountAmount ?? 0),
                netPrice: BigInt(item.listedPrice) - BigInt(item.discountAmount ?? 0),
              })),
            }
          : undefined,
      },
      include: { items: true },
    });
    return serializeBigInt(result);
  }

  async findAll(tenantId: string, query: any) {
    const where: any = { tenantId };
    if (query.corporateId) where.corporateId = query.corporateId;
    if (query.status) where.status = query.status;
    const result = await this.prisma.corporatePackage.findMany({
      where,
      include: { items: true, corporate: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return serializeBigInt(result);
  }

  async findOne(tenantId: string, id: string) {
    const pkg = await this.prisma.corporatePackage.findFirst({
      where: { id, tenantId },
      include: { items: true, corporate: true },
    });
    if (!pkg) throw new NotFoundException('Package not found');
    return serializeBigInt(pkg);
  }

  async update(tenantId: string, id: string, dto: any) {
    await this.findOne(tenantId, id);
    const { items: _items, ...rest } = dto;
    const result = await this.prisma.corporatePackage.update({ where: { id }, data: rest });
    return serializeBigInt(result);
  }

  async getForPatient(tenantId: string, patientId: string) {
    const member = await this.prisma.corporateMember.findFirst({
      where: { patientId, tenantId, status: 'ACTIVE' },
    });
    if (!member) return [];
    const now = new Date();
    const result = await this.prisma.corporatePackage.findMany({
      where: {
        tenantId,
        corporateId: member.corporateId,
        status: 'ACTIVE',
        validFrom: { lte: now },
        validTo: { gte: now },
        OR: [{ groupId: null }, { groupId: member.groupId ?? undefined }],
      },
      include: { items: true },
    });
    return serializeBigInt(result);
  }
}
