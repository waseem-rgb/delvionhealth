import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class QuotesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, filters: { status?: string; date?: string }) {
    return this.prisma.customQuote.findMany({
      where: {
        tenantId,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.date
          ? { createdAt: { gte: new Date(filters.date) } }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async findOne(tenantId: string, id: string) {
    const quote = await this.prisma.customQuote.findFirst({
      where: { id, tenantId },
    });
    if (!quote) throw new NotFoundException("Quote not found");
    return quote;
  }

  async create(tenantId: string, dto: Record<string, any>, userId: string) {
    // Generate quote number
    const count = await this.prisma.customQuote.count({ where: { tenantId } });
    const year = new Date().getFullYear();
    const quoteNumber = `QT-${year}-${String(count + 1).padStart(4, "0")}`;

    const subtotal = Number(dto.subtotal ?? 0);
    const discountPct = Number(dto.discountPct ?? 0);
    const discountAmt = dto.discountAmt
      ? Number(dto.discountAmt)
      : Math.round(((subtotal * discountPct) / 100) * 100) / 100;
    const finalPrice = subtotal - discountAmt;

    return this.prisma.customQuote.create({
      data: {
        tenantId,
        quoteNumber,
        patientName: dto.patientName,
        patientPhone: dto.patientPhone,
        patientAge: dto.patientAge ? Number(dto.patientAge) : undefined,
        patientGender: dto.patientGender,
        symptoms: dto.symptoms,
        aiPromptUsed: dto.aiPromptUsed,
        testIds: dto.testIds,
        testNames: dto.testNames,
        subtotal,
        discountAmt,
        discountPct,
        finalPrice: Math.max(0, finalPrice),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24hr validity
        createdById: userId,
      },
    });
  }

  async markSent(tenantId: string, id: string) {
    const quote = await this.prisma.customQuote.findFirst({
      where: { id, tenantId },
    });
    if (!quote) throw new NotFoundException("Quote not found");
    return this.prisma.customQuote.update({
      where: { id },
      data: { status: "SENT", sentAt: new Date() },
    });
  }

  async convert(tenantId: string, id: string) {
    const quote = await this.prisma.customQuote.findFirst({
      where: { id, tenantId },
    });
    if (!quote) throw new NotFoundException("Quote not found");
    return this.prisma.customQuote.update({
      where: { id },
      data: { status: "CONVERTED" },
    });
  }

  async saveAsPackage(
    tenantId: string,
    id: string,
    packageName: string,
    userId: string,
  ) {
    const quote = await this.prisma.customQuote.findFirst({
      where: { id, tenantId },
    });
    if (!quote) throw new NotFoundException("Quote not found");

    const count = await this.prisma.labPackage.count({ where: { tenantId } });
    const code = `PKG-${String(count + 1).padStart(4, "0")}`;

    const pkg = await this.prisma.labPackage.create({
      data: {
        tenantId,
        name: packageName,
        code,
        category: "CUSTOM",
        testIds: quote.testIds,
        testCount: quote.testIds ? JSON.parse(quote.testIds).length : 0,
        mrpPrice: quote.subtotal,
        packagePrice: quote.finalPrice,
        offerPrice: quote.finalPrice,
        discountPct: quote.discountPct,
        savingsAmt: quote.discountAmt,
        createdById: userId,
      },
    });

    await this.prisma.customQuote.update({
      where: { id },
      data: { savedAsPackageId: pkg.id },
    });

    return pkg;
  }
}
