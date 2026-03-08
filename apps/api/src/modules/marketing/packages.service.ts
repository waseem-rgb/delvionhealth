import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class PackagesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, filters: { category?: string; active?: boolean }) {
    const where: Record<string, unknown> = { tenantId };
    if (filters.category) where.category = filters.category;
    if (filters.active !== undefined) where.isActive = filters.active;

    return this.prisma.labPackage.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
  }

  async create(tenantId: string, dto: {
    name: string;
    code?: string;
    category?: string;
    description?: string;
    testIds?: string;
    mrpPrice: number;
    offerPrice?: number;
    corporatePrice?: number;
    validFrom?: string;
    validTo?: string;
    targetGender?: string;
    targetAgeMin?: number;
    targetAgeMax?: number;
    brochureUrl?: string;
  }) {
    return this.prisma.labPackage.create({
      data: {
        tenantId,
        name: dto.name,
        code: dto.code,
        category: dto.category,
        description: dto.description,
        testIds: dto.testIds,
        mrpPrice: dto.mrpPrice,
        offerPrice: dto.offerPrice,
        corporatePrice: dto.corporatePrice,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validTo: dto.validTo ? new Date(dto.validTo) : undefined,
        targetGender: dto.targetGender,
        targetAgeMin: dto.targetAgeMin,
        targetAgeMax: dto.targetAgeMax,
        brochureUrl: dto.brochureUrl,
      },
    });
  }

  async update(tenantId: string, id: string, dto: Record<string, unknown>) {
    const pkg = await this.prisma.labPackage.findFirst({ where: { id, tenantId } });
    if (!pkg) throw new NotFoundException("Package not found");

    return this.prisma.labPackage.update({
      where: { id },
      data: {
        ...dto,
        validFrom: dto.validFrom ? new Date(dto.validFrom as string) : undefined,
        validTo: dto.validTo ? new Date(dto.validTo as string) : undefined,
      },
    });
  }

  async deactivate(tenantId: string, id: string) {
    await this.prisma.labPackage.updateMany({
      where: { id, tenantId },
      data: { isActive: false },
    });
    return { deactivated: true };
  }

  async generateShareMessage(tenantId: string, id: string) {
    const pkg = await this.prisma.labPackage.findFirst({ where: { id, tenantId } });
    if (!pkg) throw new NotFoundException("Package not found");

    const offerLine = pkg.offerPrice
      ? `Special Offer: Rs.${Number(pkg.offerPrice)} (MRP: Rs.${Number(pkg.mrpPrice)})`
      : `Price: Rs.${Number(pkg.mrpPrice)}`;

    const message = [
      `*${pkg.name}*`,
      pkg.description ? `\n${pkg.description}` : "",
      `\n${offerLine}`,
      pkg.corporatePrice ? `Corporate Price: Rs.${Number(pkg.corporatePrice)}/person` : "",
      pkg.validTo ? `\nValid till: ${new Date(pkg.validTo).toLocaleDateString("en-IN")}` : "",
      `\nBook now! Call us for details.`,
    ].filter(Boolean).join("\n");

    return { message, package: pkg };
  }
}
