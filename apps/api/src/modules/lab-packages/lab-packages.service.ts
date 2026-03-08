import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class LabPackagesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    filters: {
      category?: string;
      gender?: string;
      isActive?: boolean;
      search?: string;
    },
  ) {
    return this.prisma.labPackage.findMany({
      where: {
        tenantId,
        ...(filters.isActive !== undefined
          ? { isActive: filters.isActive }
          : {}),
        ...(filters.category ? { category: filters.category } : {}),
        ...(filters.gender && filters.gender !== "ALL"
          ? { targetGender: { in: [filters.gender, "ALL"] } }
          : {}),
        ...(filters.search
          ? {
              name: {
                contains: filters.search,
                mode: "insensitive" as const,
              },
            }
          : {}),
      },
      orderBy: [{ isFeatured: "desc" }, { name: "asc" }],
    });
  }

  async findOne(tenantId: string, id: string) {
    const pkg = await this.prisma.labPackage.findFirst({
      where: { id, tenantId },
    });
    if (!pkg) throw new NotFoundException("Package not found");
    return pkg;
  }

  async create(tenantId: string, dto: Record<string, any>, userId: string) {
    const testIds: string[] = dto.testIds ? JSON.parse(dto.testIds) : [];
    const tests = await this.prisma.testCatalog.findMany({
      where: { id: { in: testIds }, tenantId },
      select: { id: true, price: true },
    });
    const individualMRP = tests.reduce(
      (s: number, t: any) => s + Number(t.price),
      0,
    );
    const packagePrice = dto.packagePrice ?? dto.offerPrice ?? individualMRP;
    const savingsAmt = individualMRP - Number(packagePrice);
    const discountPct =
      individualMRP > 0 ? (savingsAmt / individualMRP) * 100 : 0;

    const count = await this.prisma.labPackage.count({ where: { tenantId } });
    const code = `PKG-${String(count + 1).padStart(4, "0")}`;

    return this.prisma.labPackage.create({
      data: {
        tenantId,
        name: dto.name,
        code,
        category: dto.category,
        description: dto.description,
        aiGeneratedDesc: dto.aiGeneratedDesc,
        aiPromptUsed: dto.aiPromptUsed,
        testIds: dto.testIds,
        testCount: testIds.length,
        mrpPrice: individualMRP,
        offerPrice: dto.offerPrice ? Number(dto.offerPrice) : undefined,
        packagePrice: Number(packagePrice),
        corporatePrice: dto.corporatePrice
          ? Number(dto.corporatePrice)
          : undefined,
        discountPct: Math.round(discountPct * 10) / 10,
        savingsAmt: Math.round(savingsAmt * 100) / 100,
        targetGender: dto.targetGender ?? "ALL",
        targetAgeMin: dto.targetAgeMin ? Number(dto.targetAgeMin) : undefined,
        targetAgeMax: dto.targetAgeMax ? Number(dto.targetAgeMax) : undefined,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validTo: dto.validTo ? new Date(dto.validTo) : undefined,
        fastingRequired: dto.fastingRequired ?? false,
        prepInstructions: dto.prepInstructions,
        assignedOrgIds: dto.assignedOrgIds,
        assignedRateListIds: dto.assignedRateListIds,
        createdByAI: dto.createdByAI ?? false,
        createdById: userId,
      },
    });
  }

  async update(tenantId: string, id: string, dto: Record<string, any>) {
    const existing = await this.prisma.labPackage.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException("Package not found");

    // Recalculate pricing if testIds or packagePrice changed
    const data: Record<string, any> = { ...dto };
    if (dto.testIds) {
      const testIds: string[] = JSON.parse(dto.testIds);
      const tests = await this.prisma.testCatalog.findMany({
        where: { id: { in: testIds }, tenantId },
        select: { price: true },
      });
      const individualMRP = tests.reduce(
        (s: number, t: any) => s + Number(t.price),
        0,
      );
      const packagePrice = dto.packagePrice ?? dto.offerPrice ?? individualMRP;
      const savingsAmt = individualMRP - Number(packagePrice);
      data.mrpPrice = individualMRP;
      data.testCount = testIds.length;
      data.savingsAmt = Math.round(savingsAmt * 100) / 100;
      data.discountPct =
        individualMRP > 0
          ? Math.round((savingsAmt / individualMRP) * 1000) / 10
          : 0;
    }

    return this.prisma.labPackage.update({
      where: { id },
      data: data as any,
    });
  }

  async toggleActive(tenantId: string, id: string) {
    const pkg = await this.prisma.labPackage.findFirst({
      where: { id, tenantId },
    });
    if (!pkg) throw new NotFoundException("Package not found");
    return this.prisma.labPackage.update({
      where: { id },
      data: { isActive: !pkg.isActive },
    });
  }

  async duplicate(tenantId: string, id: string, userId: string) {
    const pkg = await this.prisma.labPackage.findFirst({
      where: { id, tenantId },
    });
    if (!pkg) throw new NotFoundException("Package not found");

    const count = await this.prisma.labPackage.count({ where: { tenantId } });
    const {
      id: _id,
      code: _code,
      createdAt: _ca,
      updatedAt: _ua,
      ...rest
    } = pkg as any;
    return this.prisma.labPackage.create({
      data: {
        ...rest,
        name: `Copy of ${pkg.name}`,
        code: `PKG-${String(count + 1).padStart(4, "0")}`,
        createdById: userId,
      },
    });
  }
}
