import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class PriceEnquiryService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, data: {
    customerName?: string;
    phone?: string;
    testIds?: string;
    testNames?: string;
    totalAmount?: number;
    notes?: string;
    createdById?: string;
  }) {
    return this.prisma.priceEnquiry.create({
      data: {
        tenantId,
        customerName: data.customerName,
        phone: data.phone,
        testIds: data.testIds,
        testNames: data.testNames,
        totalAmount: data.totalAmount,
        notes: data.notes,
        createdById: data.createdById,
      },
    });
  }

  async list(tenantId: string, month?: string) {
    const where: Record<string, unknown> = { tenantId };

    if (month) {
      const parts = month.split("-").map(Number);
      const year = parts[0]!;
      const m = parts[1]!;
      const start = new Date(year, m - 1, 1);
      const end = new Date(year, m, 1);
      where.createdAt = { gte: start, lt: end };
    }

    const [enquiries, totalCount, unconverted] = await Promise.all([
      this.prisma.priceEnquiry.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      this.prisma.priceEnquiry.count({ where }),
      this.prisma.priceEnquiry.count({ where: { ...where, converted: false } }),
    ]);

    return { enquiries, totalCount, unconverted };
  }

  async markConverted(tenantId: string, id: string, orderId: string) {
    return this.prisma.priceEnquiry.update({
      where: { id },
      data: { converted: true, convertedOrderId: orderId },
    });
  }
}
