import { Injectable, NotFoundException, BadRequestException, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { PaginationMeta } from "@delvion/types";
import {
  STANDARD_TEST_PARAMETERS,
  NAME_KEYWORD_MATCHES,
  type SeedTestConfig,
} from "./seed-report-parameters";

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
    const limit = Math.min(query.limit ?? 20, 10000);
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
          _count: { select: { reportParameters: true } },
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
  // Get report parameters for a test
  // ───────────────────────────────────────────

  async getParameters(tenantId: string, testId: string) {
    const params = await this.prisma.reportParameter.findMany({
      where: { testCatalogId: testId, tenantId, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        fieldType: true,
        unit: true,
        method: true,
        sortOrder: true,
        isMandatory: true,
        referenceRanges: {
          select: { lowNormal: true, highNormal: true, unit: true, genderFilter: true },
          take: 5,
        },
      },
    });
    return { data: params, total: params.length };
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
  ): Promise<{
    totalRows: number;
    inserted: number;
    duplicates: number;
    duplicateList: { row: number; testCode: string; testName: string; reason: string }[];
    errors: number;
    errorList: { row: number; reason: string }[];
  }> {
    const inserted_list: number[] = [];
    const duplicateList: { row: number; testCode: string; testName: string; reason: string }[] = [];
    const errorList: { row: number; reason: string }[] = [];

    // Pre-load all existing codes and names for this tenant for fast lookup
    const existingTests = await this.prisma.testCatalog.findMany({
      where: { tenantId },
      select: { code: true, name: true },
    });
    const existingCodes = new Set(existingTests.map((t) => t.code.toLowerCase().trim()));
    const existingNames = new Set(existingTests.map((t) => t.name.toLowerCase().trim()));

    const BATCH_SIZE = 50;
    for (let i = 0; i < tests.length; i += BATCH_SIZE) {
      const batch = tests.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (t, batchIdx) => {
          const rowNum = i + batchIdx + 1;
          try {
            // Validate required fields
            if (!t.name || t.name.trim().length < 2) {
              errorList.push({ row: rowNum, reason: "Test name is missing or too short" });
              return;
            }
            if (!t.code || t.code.trim().length === 0) {
              errorList.push({ row: rowNum, reason: "Test code is missing" });
              return;
            }

            const normalizedCode = t.code.toLowerCase().trim();
            const normalizedName = t.name.toLowerCase().trim();

            // Duplicate check by code OR name
            if (existingCodes.has(normalizedCode)) {
              duplicateList.push({ row: rowNum, testCode: t.code, testName: t.name, reason: `Code "${t.code}" already exists` });
              return;
            }
            if (existingNames.has(normalizedName)) {
              duplicateList.push({ row: rowNum, testCode: t.code, testName: t.name, reason: `Test name "${t.name}" already exists` });
              return;
            }

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

            await this.prisma.testCatalog.create({
              data: { ...data, code: t.code.trim(), tenantId, isActive: true },
            });

            // Add to in-memory sets to prevent duplicates within same import
            existingCodes.add(normalizedCode);
            existingNames.add(normalizedName);
            inserted_list.push(rowNum);
          } catch (err) {
            this.logger.warn(`Skip row ${rowNum}: ${t.name} — ${(err as Error).message}`);
            errorList.push({ row: rowNum, reason: (err as Error).message ?? "Unknown error" });
          }
        }),
      );
    }

    return {
      totalRows: tests.length,
      inserted: inserted_list.length,
      duplicates: duplicateList.length,
      duplicateList,
      errors: errorList.length,
      errorList,
    };
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

  // ───────────────────────────────────────────
  // Seed standard report parameters
  // ───────────────────────────────────────────

  async seedReportParameters(tenantId: string) {
    const results: { code: string; name?: string; status: string; count?: number }[] = [];

    // Pass 1: Match by test code
    for (const [testCode, config] of Object.entries(STANDARD_TEST_PARAMETERS)) {
      const test = await this.prisma.testCatalog.findFirst({
        where: {
          tenantId,
          isActive: true,
          OR: [
            { code: testCode },
            { code: { contains: testCode.replace("PT_", ""), mode: "insensitive" } },
          ],
        },
        include: { _count: { select: { reportParameters: true } } },
      });

      if (!test) {
        results.push({ code: testCode, status: "NOT_FOUND" });
        continue;
      }

      if (test._count.reportParameters > 0) {
        results.push({ code: testCode, name: test.name, status: "SKIPPED_HAS_PARAMS", count: test._count.reportParameters });
        continue;
      }

      await this.seedParametersForTest(tenantId, test.id, config);
      results.push({ code: testCode, name: test.name, status: "SEEDED", count: config.parameters.length });
    }

    // Pass 2: Name-keyword matching for tests with 0 parameters
    const allTests = await this.prisma.testCatalog.findMany({
      where: { tenantId, isActive: true },
      include: { _count: { select: { reportParameters: true } } },
    });

    const seededTestIds = new Set(
      results.filter((r) => r.status === "SEEDED" || r.status === "SKIPPED_HAS_PARAMS").map((r) => r.code),
    );

    for (const test of allTests.filter((t) => t._count.reportParameters === 0)) {
      const nameLower = test.name.toLowerCase();
      const match = NAME_KEYWORD_MATCHES.find(
        (k) => !seededTestIds.has(k.configKey) && k.keywords.some((kw) => nameLower.includes(kw)),
      );

      if (match) {
        const config = STANDARD_TEST_PARAMETERS[match.configKey];
        if (!config) continue;

        await this.seedParametersForTest(tenantId, test.id, config);
        results.push({
          code: test.code,
          name: test.name,
          status: "SEEDED",
          count: config.parameters.length,
        });
      }
    }

    return results;
  }

  private async seedParametersForTest(
    tenantId: string,
    testCatalogId: string,
    config: SeedTestConfig,
  ) {
    for (const p of config.parameters) {
      const param = await this.prisma.reportParameter.upsert({
        where: {
          testCatalogId_name: { testCatalogId, name: p.name },
        },
        update: {
          fieldType: p.fieldType,
          unit: p.unit ?? null,
          sortOrder: p.sortOrder,
          isMandatory: p.isMandatory ?? true,
          options: p.options ? JSON.stringify(p.options) : null,
        },
        create: {
          tenantId,
          testCatalogId,
          name: p.name,
          fieldType: p.fieldType,
          unit: p.unit ?? null,
          sortOrder: p.sortOrder,
          isMandatory: p.isMandatory ?? true,
          options: p.options ? JSON.stringify(p.options) : null,
        },
      });

      if (p.refLow != null || p.refHigh != null || p.critLow != null || p.critHigh != null) {
        const existingRange = await this.prisma.referenceRange.findFirst({
          where: { reportParameterId: param.id },
        });

        if (existingRange) {
          await this.prisma.referenceRange.update({
            where: { id: existingRange.id },
            data: {
              lowNormal: p.refLow ?? null,
              highNormal: p.refHigh ?? null,
              lowCritical: p.critLow ?? null,
              highCritical: p.critHigh ?? null,
              unit: p.unit ?? null,
            },
          });
        } else {
          await this.prisma.referenceRange.create({
            data: {
              tenantId,
              testCatalogId,
              reportParameterId: param.id,
              genderFilter: null,
              lowNormal: p.refLow ?? null,
              highNormal: p.refHigh ?? null,
              lowCritical: p.critLow ?? null,
              highCritical: p.critHigh ?? null,
              unit: p.unit ?? null,
            },
          });
        }
      }
    }
  }

  // ───────────────────────────────────────────
  // Template management methods
  // ───────────────────────────────────────────

  async getTemplate(tenantId: string, testId: string) {
    const test = await this.prisma.testCatalog.findFirst({
      where: { id: testId, tenantId },
      select: {
        id: true,
        code: true,
        name: true,
        reportTitle: true,
        reportIntro: true,
        reportConclusion: true,
        clinicalSignificance: true,
        preparationNote: true,
        collectionNote: true,
        isTemplateComplete: true,
        templateLastEditedById: true,
        templateLastEditedAt: true,
        reportParameters: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            name: true,
            fieldType: true,
            unit: true,
            sortOrder: true,
            isMandatory: true,
            clinicalNote: true,
            abnormalityNote: true,
            footerNote: true,
            methodology: true,
            specimenNote: true,
            isEditable: true,
            displayOnReport: true,
            printOrder: true,
            options: true,
            referenceRanges: {
              select: {
                id: true,
                genderFilter: true,
                ageMinYears: true,
                ageMaxYears: true,
                lowNormal: true,
                highNormal: true,
                lowCritical: true,
                highCritical: true,
                unit: true,
                notes: true,
              },
            },
          },
        },
      },
    });
    if (!test) throw new NotFoundException(`Test ${testId} not found`);
    return test;
  }

  async updateTemplate(
    tenantId: string,
    testId: string,
    dto: {
      reportTitle?: string;
      reportIntro?: string;
      reportConclusion?: string;
      clinicalSignificance?: string;
      preparationNote?: string;
      collectionNote?: string;
      isTemplateComplete?: boolean;
    },
    userId?: string,
  ) {
    await this.findOne(tenantId, testId);
    return this.prisma.testCatalog.update({
      where: { id: testId },
      data: {
        ...(dto.reportTitle !== undefined ? { reportTitle: dto.reportTitle } : {}),
        ...(dto.reportIntro !== undefined ? { reportIntro: dto.reportIntro } : {}),
        ...(dto.reportConclusion !== undefined ? { reportConclusion: dto.reportConclusion } : {}),
        ...(dto.clinicalSignificance !== undefined ? { clinicalSignificance: dto.clinicalSignificance } : {}),
        ...(dto.preparationNote !== undefined ? { preparationNote: dto.preparationNote } : {}),
        ...(dto.collectionNote !== undefined ? { collectionNote: dto.collectionNote } : {}),
        ...(dto.isTemplateComplete !== undefined ? { isTemplateComplete: dto.isTemplateComplete } : {}),
        templateLastEditedById: userId ?? null,
        templateLastEditedAt: new Date(),
      },
      select: {
        id: true,
        reportTitle: true,
        reportIntro: true,
        reportConclusion: true,
        clinicalSignificance: true,
        preparationNote: true,
        collectionNote: true,
        isTemplateComplete: true,
      },
    });
  }

  async addParameter(
    tenantId: string,
    testId: string,
    dto: {
      name: string;
      fieldType?: string;
      unit?: string;
      sortOrder?: number;
      isMandatory?: boolean;
      clinicalNote?: string;
      abnormalityNote?: string;
      footerNote?: string;
      methodology?: string;
      specimenNote?: string;
      displayOnReport?: boolean;
      options?: string;
    },
    userId?: string,
  ) {
    await this.findOne(tenantId, testId);
    return this.prisma.reportParameter.create({
      data: {
        tenantId,
        testCatalogId: testId,
        name: dto.name,
        fieldType: dto.fieldType ?? "NUMERIC",
        unit: dto.unit ?? null,
        sortOrder: dto.sortOrder ?? 0,
        isMandatory: dto.isMandatory ?? true,
        clinicalNote: dto.clinicalNote ?? null,
        abnormalityNote: dto.abnormalityNote ?? null,
        footerNote: dto.footerNote ?? null,
        methodology: dto.methodology ?? null,
        specimenNote: dto.specimenNote ?? null,
        displayOnReport: dto.displayOnReport ?? true,
        options: dto.options ?? null,
        lastEditedById: userId ?? null,
        lastEditedAt: new Date(),
      },
    });
  }

  async updateParameter(
    tenantId: string,
    paramId: string,
    dto: Record<string, unknown>,
    userId?: string,
  ) {
    const param = await this.prisma.reportParameter.findFirst({
      where: { id: paramId, tenantId },
    });
    if (!param) throw new NotFoundException(`Parameter ${paramId} not found`);

    const allowedFields = [
      "name", "fieldType", "unit", "sortOrder", "isMandatory",
      "clinicalNote", "abnormalityNote", "footerNote", "methodology",
      "specimenNote", "isEditable", "displayOnReport", "printOrder",
      "options", "isActive", "defaultValue", "formula", "method",
    ];

    const data: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (dto[key] !== undefined) data[key] = dto[key];
    }
    data.lastEditedById = userId ?? null;
    data.lastEditedAt = new Date();

    return this.prisma.reportParameter.update({
      where: { id: paramId },
      data,
    });
  }

  async deleteParameter(tenantId: string, paramId: string) {
    const param = await this.prisma.reportParameter.findFirst({
      where: { id: paramId, tenantId },
    });
    if (!param) throw new NotFoundException(`Parameter ${paramId} not found`);

    await this.prisma.referenceRange.deleteMany({
      where: { reportParameterId: paramId },
    });
    await this.prisma.reportParameter.delete({ where: { id: paramId } });
    return { deleted: true };
  }

  async addReferenceRange(
    tenantId: string,
    paramId: string,
    dto: {
      genderFilter?: string;
      ageMinYears?: number;
      ageMaxYears?: number;
      lowNormal?: number;
      highNormal?: number;
      lowCritical?: number;
      highCritical?: number;
      unit?: string;
      notes?: string;
    },
  ) {
    const param = await this.prisma.reportParameter.findFirst({
      where: { id: paramId, tenantId },
      select: { id: true, testCatalogId: true, unit: true },
    });
    if (!param) throw new NotFoundException(`Parameter ${paramId} not found`);

    return this.prisma.referenceRange.create({
      data: {
        tenantId,
        testCatalogId: param.testCatalogId,
        reportParameterId: paramId,
        genderFilter: dto.genderFilter ?? null,
        ageMinYears: dto.ageMinYears ?? null,
        ageMaxYears: dto.ageMaxYears ?? null,
        lowNormal: dto.lowNormal ?? null,
        highNormal: dto.highNormal ?? null,
        lowCritical: dto.lowCritical ?? null,
        highCritical: dto.highCritical ?? null,
        unit: dto.unit ?? param.unit ?? null,
        notes: dto.notes ?? null,
      },
    });
  }

  async updateReferenceRange(
    tenantId: string,
    rangeId: string,
    dto: Record<string, unknown>,
  ) {
    const range = await this.prisma.referenceRange.findFirst({
      where: { id: rangeId, tenantId },
    });
    if (!range) throw new NotFoundException(`Reference range ${rangeId} not found`);

    const allowedFields = [
      "genderFilter", "ageMinYears", "ageMaxYears",
      "lowNormal", "highNormal", "lowCritical", "highCritical",
      "unit", "notes",
    ];

    const data: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (dto[key] !== undefined) data[key] = dto[key];
    }

    return this.prisma.referenceRange.update({
      where: { id: rangeId },
      data,
    });
  }

  async deleteReferenceRange(tenantId: string, rangeId: string) {
    const range = await this.prisma.referenceRange.findFirst({
      where: { id: rangeId, tenantId },
    });
    if (!range) throw new NotFoundException(`Reference range ${rangeId} not found`);

    await this.prisma.referenceRange.delete({ where: { id: rangeId } });
    return { deleted: true };
  }

  async getTemplateStatus(tenantId: string) {
    const tests = await this.prisma.testCatalog.findMany({
      where: { tenantId, isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        reportTitle: true,
        reportIntro: true,
        reportConclusion: true,
        isTemplateComplete: true,
        reportParameters: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            clinicalNote: true,
            abnormalityNote: true,
            _count: { select: { referenceRanges: true } },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    // Only score tests that have parameters
    const testsWithParams = tests.filter((t) => t.reportParameters.length > 0);

    const scored = testsWithParams.map((t) => {
      let score = 0;
      if (t.reportIntro) score += 20;
      if (t.reportConclusion) score += 10;
      const totalParams = t.reportParameters.length;
      if (totalParams > 0) {
        const withNotes = t.reportParameters.filter((p) => p.clinicalNote).length;
        score += Math.round((withNotes / totalParams) * 30);
        const withAbnormality = t.reportParameters.filter((p) => p.abnormalityNote).length;
        score += Math.round((withAbnormality / totalParams) * 25);
        const withRanges = t.reportParameters.filter((p) => p._count.referenceRanges > 0).length;
        score += Math.round((withRanges / totalParams) * 15);
      }

      const missing: string[] = [];
      if (!t.reportIntro) missing.push("reportIntro");
      if (!t.reportConclusion) missing.push("reportConclusion");
      const paramsWithoutNotes = t.reportParameters.filter((p) => !p.clinicalNote).map((p) => p.name);
      if (paramsWithoutNotes.length > 0) missing.push(`clinicalNote on ${paramsWithoutNotes.length} params`);
      const paramsWithoutAbnormality = t.reportParameters.filter((p) => !p.abnormalityNote).map((p) => p.name);
      if (paramsWithoutAbnormality.length > 0) missing.push(`abnormalityNote on ${paramsWithoutAbnormality.length} params`);

      return {
        id: t.id,
        code: t.code,
        name: t.name,
        paramCount: totalParams,
        score,
        isComplete: score >= 80,
        missing,
      };
    });

    const complete = scored.filter((s) => s.isComplete);
    const incomplete = scored.filter((s) => !s.isComplete);

    return {
      totalWithParams: testsWithParams.length,
      complete: complete.length,
      incomplete: incomplete.length,
      tests: scored,
    };
  }

  // ───────────────────────────────────────────
  // Parameter Stats (for UI progress / counts)
  // ───────────────────────────────────────────

  async getParameterStats(tenantId: string) {
    const [total, withParams] = await Promise.all([
      this.prisma.testCatalog.count({ where: { tenantId, isActive: true } }),
      this.prisma.testCatalog.count({
        where: { tenantId, isActive: true, reportParameters: { some: {} } },
      }),
    ]);

    // Count by category
    const byCategory = await this.prisma.testCatalog.groupBy({
      by: ["category"],
      where: { tenantId, isActive: true, reportParameters: { some: {} } },
      _count: { _all: true },
    });

    // Top seeded tests (with most parameters)
    const topTests = await this.prisma.testCatalog.findMany({
      where: { tenantId, isActive: true, reportParameters: { some: {} } },
      orderBy: { reportParameters: { _count: "desc" } },
      take: 50,
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
        department: true,
        isTemplateComplete: true,
        _count: { select: { reportParameters: true } },
      },
    });

    return {
      total,
      withParams,
      withoutParams: total - withParams,
      percentComplete: total > 0 ? Math.round((withParams / total) * 100) : 0,
      byCategory: byCategory.map((g) => ({ category: g.category, count: g._count._all })),
      recentlySeeded: topTests.map((t) => ({
        id: t.id,
        code: t.code,
        name: t.name,
        category: t.category,
        department: t.department,
        paramCount: t._count.reportParameters,
        isTemplateComplete: t.isTemplateComplete ?? false,
      })),
    };
  }

  // ───────────────────────────────────────────
  // Classify Investigation Types (pattern matching)
  // ───────────────────────────────────────────

  async classifyInvestigationTypes(tenantId: string) {
    const tests = await this.prisma.testCatalog.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, name: true, department: true, category: true, investigationType: true },
    });

    const patterns: Array<{ keywords: string[]; type: string; departmentCode: string; requiresDoctor: boolean; avgDurationMinutes: number }> = [
      { keywords: ["ultrasound", "usg", "sonography", "doppler", "echo", "abdominal scan", "pelvis scan", "thyroid scan"], type: "ULTRASOUND", departmentCode: "USG", requiresDoctor: true, avgDurationMinutes: 20 },
      { keywords: ["x-ray", "xray", "chest x", "bone x", "radiograph", "kub x"], type: "XRAY", departmentCode: "XR", requiresDoctor: false, avgDurationMinutes: 10 },
      { keywords: ["ecg", "ekg", "electrocardiogram", "holter", "tmt", "stress test"], type: "ECG", departmentCode: "ECG", requiresDoctor: false, avgDurationMinutes: 15 },
      { keywords: ["mri", "magnetic resonance"], type: "MRI", departmentCode: "MRI", requiresDoctor: true, avgDurationMinutes: 45 },
      { keywords: ["ct scan", "computed tomography", "hrct", "ct chest", "ct abdomen", "ct brain"], type: "CT_SCAN", departmentCode: "CT", requiresDoctor: true, avgDurationMinutes: 30 },
      { keywords: ["echocardiogram", "2d echo", "echo cardiography", "cardiac echo"], type: "ECHO", departmentCode: "ECHO", requiresDoctor: true, avgDurationMinutes: 30 },
      { keywords: ["pulmonary function", "pft", "spirometry", "lung function"], type: "PFT", departmentCode: "PFT", requiresDoctor: false, avgDurationMinutes: 20 },
      { keywords: ["dexa", "bone density", "bone mineral"], type: "DEXA", departmentCode: "DEXA", requiresDoctor: false, avgDurationMinutes: 20 },
      { keywords: ["audiometry", "hearing test", "tympanometry"], type: "AUDIOMETRY", departmentCode: "AUD", requiresDoctor: false, avgDurationMinutes: 20 },
      { keywords: ["vision", "eye test", "optometry", "refraction", "retinal"], type: "OPHTHALMOLOGY", departmentCode: "OPH", requiresDoctor: true, avgDurationMinutes: 15 },
    ];

    const updates: Array<{ id: string; investigationType: string; departmentCode: string; requiresDoctor: boolean; avgDurationMinutes: number }> = [];

    for (const test of tests) {
      const nameLower = test.name.toLowerCase();
      let matched = false;
      for (const pattern of patterns) {
        if (pattern.keywords.some((kw) => nameLower.includes(kw))) {
          updates.push({
            id: test.id,
            investigationType: pattern.type,
            departmentCode: pattern.departmentCode,
            requiresDoctor: pattern.requiresDoctor,
            avgDurationMinutes: pattern.avgDurationMinutes,
          });
          matched = true;
          break;
        }
      }
      if (!matched && test.investigationType === "PATHOLOGY") {
        // Keep as pathology — no update needed
      }
    }

    // Batch update
    let updated = 0;
    for (const u of updates) {
      await this.prisma.testCatalog.update({
        where: { id: u.id },
        data: {
          investigationType: u.investigationType,
          departmentCode: u.departmentCode,
          requiresDoctor: u.requiresDoctor,
          avgDurationMinutes: u.avgDurationMinutes,
        },
      });
      updated++;
    }

    const summary = updates.reduce((acc, u) => {
      acc[u.investigationType] = (acc[u.investigationType] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalProcessed: tests.length,
      updated,
      summary,
    };
  }
}
