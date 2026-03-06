import { Injectable, NotFoundException, BadRequestException, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { PaginationMeta } from "@delvion/types";

export interface CreateProfileDto {
  name: string;
  category?: string;
  department?: string;
  sampleType?: string;
  componentTestIds: string[];
  discountAmount?: number;
}

export interface TestCatalogQuery {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  department?: string;
}

export interface TestsByCategory {
  category: string;
  tests: {
    id: string;
    code: string;
    name: string;
    price: number;
    turnaroundHours: number;
    sampleType: string | null;
    methodology: string | null;
    loincCode: string | null;
  }[];
}

@Injectable()
export class TestCatalogService {
  private readonly logger = new Logger(TestCatalogService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────────────────────────
  // List (paginated)
  // ───────────────────────────────────────────

  async findAll(
    tenantId: string,
    query: TestCatalogQuery
  ): Promise<{ data: unknown[]; meta: PaginationMeta }> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 1000);
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      isActive: true,
      ...(query.category && { category: { equals: query.category, mode: "insensitive" as const } }),
      ...(query.department && { department: { equals: query.department, mode: "insensitive" as const } }),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" as const } },
              { code: { contains: query.search, mode: "insensitive" as const } },
              { loincCode: { contains: query.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [tests, total] = await Promise.all([
      this.prisma.testCatalog.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ department: "asc" }, { name: "asc" }],
        select: {
          id: true,
          code: true,
          name: true,
          category: true,
          department: true,
          type: true,
          price: true,
          turnaroundHours: true,
          sampleType: true,
          sampleVolume: true,
          methodology: true,
          schedule: true,
          loincCode: true,
          snomedCode: true,
          cptCode: true,
          cogs: true,
          b2bPrice: true,
          isActive: true,
        },
      }),
      this.prisma.testCatalog.count({ where }),
    ]);

    return {
      data: tests.map((t) => ({
        ...t,
        price: Number(t.price),
        cogs: t.cogs ? Number(t.cogs) : null,
        b2bPrice: t.b2bPrice ? Number(t.b2bPrice) : null,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ───────────────────────────────────────────
  // Search (test browser / CommandPalette)
  // ───────────────────────────────────────────

  async search(tenantId: string, q: string) {
    const tests = await this.prisma.testCatalog.findMany({
      where: {
        tenantId,
        isActive: true,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { code: { contains: q, mode: "insensitive" } },
          { loincCode: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 20,
      orderBy: { name: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
        department: true,
        price: true,
        turnaroundHours: true,
        sampleType: true,
      },
    });

    return tests.map((t) => ({ ...t, price: Number(t.price) }));
  }

  // ───────────────────────────────────────────
  // Grouped by category (order wizard grid)
  // ───────────────────────────────────────────

  async findByCategory(tenantId: string): Promise<TestsByCategory[]> {
    const tests = await this.prisma.testCatalog.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
        price: true,
        turnaroundHours: true,
        sampleType: true,
        methodology: true,
        loincCode: true,
      },
    });

    const grouped = new Map<string, TestsByCategory["tests"]>();
    for (const t of tests) {
      if (!grouped.has(t.category)) grouped.set(t.category, []);
      grouped.get(t.category)!.push({
        id: t.id,
        code: t.code,
        name: t.name,
        price: Number(t.price),
        turnaroundHours: t.turnaroundHours,
        sampleType: t.sampleType,
        methodology: t.methodology,
        loincCode: t.loincCode,
      });
    }

    return Array.from(grouped.entries()).map(([category, tests]) => ({
      category,
      tests,
    }));
  }

  // ───────────────────────────────────────────
  // Find one
  // ───────────────────────────────────────────

  async findOne(tenantId: string, id: string) {
    const test = await this.prisma.testCatalog.findFirst({
      where: { id, tenantId },
    });
    if (!test) throw new NotFoundException(`Test ${id} not found`);
    return {
      ...test,
      price: Number(test.price),
      cogs: test.cogs ? Number(test.cogs) : null,
      b2bPrice: test.b2bPrice ? Number(test.b2bPrice) : null,
    };
  }

  // ───────────────────────────────────────────
  // Create
  // ───────────────────────────────────────────

  async create(dto: Record<string, unknown>, tenantId: string) {
    return this.prisma.testCatalog.create({
      data: {
        tenantId,
        code: dto.code as string,
        name: dto.name as string,
        category: (dto.category as string) || "General",
        department: (dto.department as string) || "General",
        price: (dto.price as number) ?? 0,
        turnaroundHours: (dto.turnaroundHours as number) ?? 24,
        sampleType: (dto.sampleType as string) || null,
        sampleVolume: (dto.sampleVolume as string) || null,
        methodology: (dto.methodology as string) || null,
        type: (dto.type as string) || null,
        schedule: (dto.schedule as string) || null,
        cptCode: (dto.cptCode as string) || null,
        cogs: dto.cogs != null ? (dto.cogs as number) : null,
        b2bPrice: dto.b2bPrice != null ? (dto.b2bPrice as number) : null,
        isActive: dto.isActive !== undefined ? (dto.isActive as boolean) : true,
      },
    });
  }

  // ───────────────────────────────────────────
  // Update
  // ───────────────────────────────────────────

  async update(id: string, dto: Record<string, unknown>, tenantId: string) {
    await this.findOne(tenantId, id);
    return this.prisma.testCatalog.update({
      where: { id },
      data: {
        ...(dto.code !== undefined ? { code: dto.code as string } : {}),
        ...(dto.name !== undefined ? { name: dto.name as string } : {}),
        ...(dto.category !== undefined ? { category: dto.category as string } : {}),
        ...(dto.department !== undefined ? { department: dto.department as string } : {}),
        ...(dto.price !== undefined ? { price: dto.price as number } : {}),
        ...(dto.turnaroundHours !== undefined ? { turnaroundHours: dto.turnaroundHours as number } : {}),
        ...(dto.sampleType !== undefined ? { sampleType: (dto.sampleType as string) || null } : {}),
        ...(dto.sampleVolume !== undefined ? { sampleVolume: (dto.sampleVolume as string) || null } : {}),
        ...(dto.methodology !== undefined ? { methodology: (dto.methodology as string) || null } : {}),
        ...(dto.type !== undefined ? { type: (dto.type as string) || null } : {}),
        ...(dto.schedule !== undefined ? { schedule: (dto.schedule as string) || null } : {}),
        ...(dto.cptCode !== undefined ? { cptCode: (dto.cptCode as string) || null } : {}),
        ...(dto.cogs !== undefined ? { cogs: dto.cogs != null ? (dto.cogs as number) : null } : {}),
        ...(dto.b2bPrice !== undefined ? { b2bPrice: dto.b2bPrice != null ? (dto.b2bPrice as number) : null } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive as boolean } : {}),
      },
    });
  }

  // ───────────────────────────────────────────
  // Deactivate
  // ───────────────────────────────────────────

  async deactivate(id: string, tenantId: string) {
    await this.findOne(tenantId, id);
    return this.prisma.testCatalog.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ───────────────────────────────────────────
  // Bulk Upload (batched for performance)
  // ───────────────────────────────────────────

  async bulkUpload(
    tenantId: string,
    tests: {
      code: string;
      name: string;
      department?: string;
      category?: string;
      type?: string;
      sampleType?: string;
      sampleVolume?: string;
      schedule?: string;
      tatHours?: number;
      price: number;
      b2bPrice?: number;
      methodology?: string;
      cptCode?: string;
      cogs?: number;
    }[],
  ): Promise<{ imported: number; updated: number; skipped: number; errors: string[] }> {
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];
    const BATCH_SIZE = 50;

    for (let i = 0; i < tests.length; i += BATCH_SIZE) {
      const batch = tests.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (t) => {
          try {
            if (!t.name || t.name.length < 2) {
              skipped++;
              return;
            }

            const code = (
              t.code ||
              t.name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) + "_" + i
            ).trim();

            const data = {
              name: t.name.slice(0, 255),
              price: Number(t.price) || 0,
              department: t.department || "General",
              category: t.category || t.type || t.department || "General",
              sampleType: t.sampleType || "Serum",
              turnaroundHours: Number(t.tatHours) || 24,
              ...(t.type !== undefined && { type: t.type }),
              ...(t.methodology !== undefined && { methodology: t.methodology }),
              ...(t.sampleVolume !== undefined && { sampleVolume: t.sampleVolume }),
              ...(t.schedule !== undefined && { schedule: t.schedule }),
              ...(t.cptCode !== undefined && { cptCode: t.cptCode }),
              ...(t.cogs !== undefined && { cogs: Number(t.cogs) }),
              ...(t.b2bPrice !== undefined && { b2bPrice: Number(t.b2bPrice) }),
            };

            const existing = await this.prisma.testCatalog.findFirst({
              where: { code, tenantId },
              select: { id: true },
            });

            if (existing) {
              await this.prisma.testCatalog.update({
                where: { id: existing.id },
                data,
              });
              updated++;
            } else {
              await this.prisma.testCatalog.create({
                data: { ...data, code, tenantId, isActive: true },
              });
              imported++;
            }
          } catch (err) {
            this.logger.warn(`Skip row: ${t.name} — ${(err as Error).message}`);
            skipped++;
          }
        }),
      );
    }

    return { imported, updated, skipped, errors };
  }

  // ───────────────────────────────────────────
  // Clear All
  // ───────────────────────────────────────────

  async clearAll(tenantId: string): Promise<{ deleted: number; deactivated: number }> {
    const tests = await this.prisma.testCatalog.findMany({
      where: { tenantId },
      select: { id: true },
    });
    const testIds = tests.map((t) => t.id);
    if (testIds.length === 0) return { deleted: 0, deactivated: 0 };

    const referencedItems = await this.prisma.orderItem.findMany({
      where: { testCatalogId: { in: testIds } },
      select: { testCatalogId: true },
      distinct: ["testCatalogId"],
    });
    const referencedIds = new Set(referencedItems.map((i) => i.testCatalogId));

    const deletableIds = testIds.filter((id) => !referencedIds.has(id));
    const deactivatableIds = testIds.filter((id) => referencedIds.has(id));

    if (deletableIds.length > 0) {
      await this.prisma.rateListItem.deleteMany({
        where: { testCatalogId: { in: deletableIds } },
      });
      await this.prisma.testCatalog.deleteMany({
        where: { id: { in: deletableIds } },
      });
    }

    if (deactivatableIds.length > 0) {
      await this.prisma.testCatalog.updateMany({
        where: { id: { in: deactivatableIds } },
        data: { isActive: false },
      });
    }

    return { deleted: deletableIds.length, deactivated: deactivatableIds.length };
  }

  // ───────────────────────────────────────────
  // DOS Download (all active tests for tenant)
  // ───────────────────────────────────────────

  async getDosData(tenantId: string) {
    const tests = await this.prisma.testCatalog.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ department: "asc" }, { name: "asc" }],
    });

    return tests.map((t) => ({
      code: t.code,
      name: t.name,
      department: t.department,
      category: t.category,
      type: t.type ?? "",
      cptCode: t.cptCode ?? "",
      sampleType: t.sampleType ?? "",
      sampleVolume: t.sampleVolume ?? "",
      schedule: t.schedule ?? "",
      turnaroundHours: t.turnaroundHours,
      price: Number(t.price),
      b2bPrice: t.b2bPrice ? Number(t.b2bPrice) : 0,
      cogs: t.cogs ? Number(t.cogs) : 0,
      methodology: t.methodology ?? "",
    }));
  }

  // ───────────────────────────────────────────
  // Profile / Panel Management
  // ───────────────────────────────────────────

  private async generateProfileCode(tenantId: string): Promise<string> {
    const count = await this.prisma.testCatalog.count({
      where: { tenantId, type: "PROFILE" },
    });
    return `PRF-${String(count + 1).padStart(6, "0")}`;
  }

  async createProfile(tenantId: string, dto: CreateProfileDto) {
    if (!dto.componentTestIds || dto.componentTestIds.length < 2) {
      throw new BadRequestException("A profile must have at least 2 component tests");
    }

    const components = await this.prisma.testCatalog.findMany({
      where: { id: { in: dto.componentTestIds }, tenantId, isActive: true },
      select: { id: true, code: true, name: true, price: true, turnaroundHours: true },
    });

    if (components.length !== dto.componentTestIds.length) {
      throw new BadRequestException(
        `Found ${components.length} of ${dto.componentTestIds.length} tests. Some tests may be inactive or not found.`
      );
    }

    const componentTotal = components.reduce((sum, c) => sum + Number(c.price), 0);
    const discount = Math.min(Math.max(dto.discountAmount ?? 0, 0), componentTotal);
    const profilePrice = componentTotal - discount;
    const maxTat = Math.max(...components.map((c) => c.turnaroundHours));
    const code = await this.generateProfileCode(tenantId);

    const items = components.map((c) => ({
      testId: c.id,
      code: c.code,
      name: c.name,
      price: Number(c.price),
    }));

    const [catalogEntry] = await this.prisma.$transaction(async (tx) => {
      const catalog = await tx.testCatalog.create({
        data: {
          tenantId,
          code,
          name: dto.name,
          category: dto.category || "Profile",
          department: dto.department || "General",
          price: profilePrice,
          turnaroundHours: maxTat,
          type: "PROFILE",
          sampleType: dto.sampleType || null,
          isActive: true,
        },
      });

      const pkg = await tx.testPackage.create({
        data: {
          tenantId,
          testCatalogId: catalog.id,
          name: dto.name,
          price: profilePrice,
          discountAmount: discount,
          componentTotal,
          items,
          isActive: true,
        },
      });

      return [catalog, pkg] as const;
    });

    return {
      id: catalogEntry.id,
      code: catalogEntry.code,
      name: catalogEntry.name,
      category: catalogEntry.category,
      department: catalogEntry.department,
      type: catalogEntry.type,
      price: Number(catalogEntry.price),
      componentTotal,
      discountAmount: discount,
      turnaroundHours: catalogEntry.turnaroundHours,
      components: items,
    };
  }

  async findAllProfiles(
    tenantId: string,
    query: { search?: string; page?: number; limit?: number }
  ): Promise<{ data: unknown[]; meta: PaginationMeta }> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      type: "PROFILE" as const,
      isActive: true,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" as const } },
              { code: { contains: query.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [profiles, total] = await Promise.all([
      this.prisma.testCatalog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          code: true,
          name: true,
          category: true,
          department: true,
          price: true,
          turnaroundHours: true,
          isActive: true,
          testPackage: {
            select: { items: true, discountAmount: true, componentTotal: true },
          },
        },
      }),
      this.prisma.testCatalog.count({ where }),
    ]);

    return {
      data: profiles.map((p) => {
        const items = (p.testPackage?.items ?? []) as unknown[];
        return {
          id: p.id,
          code: p.code,
          name: p.name,
          category: p.category,
          department: p.department,
          price: Number(p.price),
          turnaroundHours: p.turnaroundHours,
          isActive: p.isActive,
          type: "PROFILE",
          componentCount: Array.isArray(items) ? items.length : 0,
          componentTotal: p.testPackage ? Number(p.testPackage.componentTotal) : 0,
          discountAmount: p.testPackage ? Number(p.testPackage.discountAmount) : 0,
        };
      }),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOneProfile(tenantId: string, id: string) {
    const profile = await this.prisma.testCatalog.findFirst({
      where: { id, tenantId, type: "PROFILE" },
      include: {
        testPackage: true,
      },
    });
    if (!profile) throw new NotFoundException("Profile not found");

    const items = (profile.testPackage?.items ?? []) as Array<{
      testId: string;
      code: string;
      name: string;
      price: number;
    }>;

    return {
      id: profile.id,
      code: profile.code,
      name: profile.name,
      category: profile.category,
      department: profile.department,
      price: Number(profile.price),
      turnaroundHours: profile.turnaroundHours,
      isActive: profile.isActive,
      type: "PROFILE",
      componentTotal: profile.testPackage ? Number(profile.testPackage.componentTotal) : 0,
      discountAmount: profile.testPackage ? Number(profile.testPackage.discountAmount) : 0,
      components: items,
    };
  }

  async updateProfile(id: string, tenantId: string, dto: Partial<CreateProfileDto>) {
    const existing = await this.prisma.testCatalog.findFirst({
      where: { id, tenantId, type: "PROFILE" },
      include: { testPackage: true },
    });
    if (!existing) throw new NotFoundException("Profile not found");

    let items = (existing.testPackage?.items ?? []) as Array<{
      testId: string; code: string; name: string; price: number;
    }>;
    let componentTotal = existing.testPackage ? Number(existing.testPackage.componentTotal) : 0;
    let maxTat = existing.turnaroundHours;

    if (dto.componentTestIds && dto.componentTestIds.length >= 2) {
      const components = await this.prisma.testCatalog.findMany({
        where: { id: { in: dto.componentTestIds }, tenantId, isActive: true },
        select: { id: true, code: true, name: true, price: true, turnaroundHours: true },
      });
      if (components.length !== dto.componentTestIds.length) {
        throw new BadRequestException("Some component tests not found or inactive");
      }
      items = components.map((c) => ({
        testId: c.id, code: c.code, name: c.name, price: Number(c.price),
      }));
      componentTotal = components.reduce((sum, c) => sum + Number(c.price), 0);
      maxTat = Math.max(...components.map((c) => c.turnaroundHours));
    }

    const discount = Math.min(Math.max(dto.discountAmount ?? Number(existing.testPackage?.discountAmount ?? 0), 0), componentTotal);
    const profilePrice = componentTotal - discount;

    await this.prisma.$transaction(async (tx) => {
      await tx.testCatalog.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.category !== undefined ? { category: dto.category } : {}),
          ...(dto.department !== undefined ? { department: dto.department } : {}),
          ...(dto.sampleType !== undefined ? { sampleType: dto.sampleType || null } : {}),
          price: profilePrice,
          turnaroundHours: maxTat,
        },
      });

      if (existing.testPackage) {
        await tx.testPackage.update({
          where: { id: existing.testPackage.id },
          data: {
            ...(dto.name !== undefined ? { name: dto.name } : {}),
            price: profilePrice,
            discountAmount: discount,
            componentTotal,
            items,
          },
        });
      }
    });

    return this.findOneProfile(tenantId, id);
  }
}
