import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

function serializeBigInt<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
}

@Injectable()
export class InvoiceService {
  constructor(private readonly prisma: PrismaService) {}

  private async generateInvoiceNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.corporateInvoice.count({ where: { tenantId } });
    return `CINV-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  async generateB2B(tenantId: string, userId: string, dto: any) {
    const invoiceNumber = await this.generateInvoiceNumber(tenantId);
    const orders = await this.prisma.corporateOrder.findMany({
      where: {
        tenantId,
        corporateId: dto.corporateId,
        invoiceTo: 'CORPORATE',
        createdAt: { gte: new Date(dto.fromDate), lte: new Date(dto.toDate) },
      },
    });
    const orderCount = orders.length;
    const grossAmount = BigInt(dto.grossAmount ?? 0);
    const discountAmount = BigInt(dto.discountAmount ?? 0);
    const netAmount = grossAmount - discountAmount;

    const result = await this.prisma.corporateInvoice.create({
      data: {
        tenantId,
        corporateId: dto.corporateId,
        locationId: dto.locationId,
        packageId: dto.packageId,
        invoiceNumber,
        invoiceType: 'B2B',
        fromDate: new Date(dto.fromDate),
        toDate: new Date(dto.toDate),
        orderCount,
        grossAmount,
        discountAmount,
        netAmount,
        generatedById: userId,
      },
    });
    return serializeBigInt(result);
  }

  async generateLounge(tenantId: string, userId: string, dto: any) {
    const invoiceNumber = await this.generateInvoiceNumber(tenantId);
    const grossAmount = BigInt(dto.grossAmount);
    const discountAmount = BigInt(dto.discountAmount ?? 0);
    const netAmount = grossAmount - discountAmount;
    const result = await this.prisma.corporateInvoice.create({
      data: {
        tenantId,
        corporateId: dto.corporateId,
        invoiceNumber,
        invoiceType: 'LOUNGE',
        fromDate: new Date(dto.fromDate),
        toDate: new Date(dto.toDate),
        orderCount: 0,
        grossAmount,
        discountAmount,
        netAmount,
        remarks: dto.remarks,
        generatedById: userId,
      },
    });
    return serializeBigInt(result);
  }

  async findAll(tenantId: string, query: any) {
    const where: any = { tenantId };
    if (query.corporateId) where.corporateId = query.corporateId;
    if (query.status) where.status = query.status;
    const result = await this.prisma.corporateInvoice.findMany({
      where,
      include: { corporate: { select: { name: true, corporateCode: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return serializeBigInt(result);
  }

  async findOne(tenantId: string, id: string) {
    const inv = await this.prisma.corporateInvoice.findFirst({
      where: { id, tenantId },
      include: { corporate: true, location: true, package: true },
    });
    if (!inv) throw new NotFoundException('Invoice not found');
    return serializeBigInt(inv);
  }

  async updatePayment(tenantId: string, id: string, dto: any) {
    await this.findOne(tenantId, id);
    const result = await this.prisma.corporateInvoice.update({
      where: { id },
      data: {
        status: dto.status,
        paymentMode: dto.paymentMode,
        paidAmount: BigInt(dto.paidAmount ?? 0),
      },
    });
    return serializeBigInt(result);
  }
}
