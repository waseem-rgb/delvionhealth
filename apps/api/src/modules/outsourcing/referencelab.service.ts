import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class ReferencelabService {
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────────────────────────
  // List all active reference labs
  // ───────────────────────────────────────────

  async findAll(tenantId: string) {
    const labs = await this.prisma.referencelab.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: "asc" },
      include: {
        _count: { select: { tests: true } },
      },
    });

    return labs.map((lab) => ({
      ...lab,
      testCount: lab._count.tests,
      _count: undefined,
    }));
  }

  // ───────────────────────────────────────────
  // Find one with tests
  // ───────────────────────────────────────────

  async findOne(tenantId: string, id: string) {
    const lab = await this.prisma.referencelab.findFirst({
      where: { id, tenantId },
      include: {
        tests: {
          include: {
            testCatalog: { select: { id: true, name: true, code: true, category: true, price: true } },
          },
        },
      },
    });

    if (!lab) throw new NotFoundException(`Reference lab ${id} not found`);
    return lab;
  }

  // ───────────────────────────────────────────
  // Create
  // ───────────────────────────────────────────

  async create(
    tenantId: string,
    dto: {
      name: string;
      code: string;
      contactName?: string;
      email?: string;
      phone?: string;
      address?: string;
      city?: string;
    },
  ) {
    // Check unique code within tenant
    const existing = await this.prisma.referencelab.findFirst({
      where: { tenantId, code: dto.code },
    });
    if (existing) {
      throw new BadRequestException(`Reference lab code "${dto.code}" already exists`);
    }

    return this.prisma.referencelab.create({
      data: {
        tenantId,
        name: dto.name,
        code: dto.code,
        contactName: dto.contactName,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        city: dto.city,
      },
    });
  }

  // ───────────────────────────────────────────
  // Update
  // ───────────────────────────────────────────

  async update(
    tenantId: string,
    id: string,
    dto: {
      name?: string;
      code?: string;
      contactName?: string;
      email?: string;
      phone?: string;
      address?: string;
      city?: string;
    },
  ) {
    const lab = await this.findOne(tenantId, id);

    // If code is being changed, check uniqueness
    if (dto.code && dto.code !== lab.code) {
      const existing = await this.prisma.referencelab.findFirst({
        where: { tenantId, code: dto.code, NOT: { id } },
      });
      if (existing) {
        throw new BadRequestException(`Reference lab code "${dto.code}" already exists`);
      }
    }

    return this.prisma.referencelab.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.code !== undefined && { code: dto.code }),
        ...(dto.contactName !== undefined && { contactName: dto.contactName }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.city !== undefined && { city: dto.city }),
      },
    });
  }

  // ───────────────────────────────────────────
  // Soft-delete
  // ───────────────────────────────────────────

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    await this.prisma.referencelab.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ───────────────────────────────────────────
  // Add or update tests for a reflab
  // ───────────────────────────────────────────

  async addTests(
    tenantId: string,
    reflabId: string,
    tests: Array<{
      testCatalogId: string;
      externalCode?: string;
      cost: number;
      tat: number;
    }>,
  ) {
    await this.findOne(tenantId, reflabId);

    // Validate all testCatalogIds belong to the tenant
    const testIds = tests.map((t) => t.testCatalogId);
    const catalogTests = await this.prisma.testCatalog.findMany({
      where: { id: { in: testIds }, tenantId },
      select: { id: true },
    });

    const foundIds = new Set(catalogTests.map((t) => t.id));
    const missingIds = testIds.filter((id) => !foundIds.has(id));
    if (missingIds.length > 0) {
      throw new BadRequestException(`Tests not found in catalog: ${missingIds.join(", ")}`);
    }

    // Upsert each test mapping
    const results = await Promise.all(
      tests.map((t) =>
        this.prisma.reflabTest.upsert({
          where: {
            reflabId_testCatalogId: {
              reflabId,
              testCatalogId: t.testCatalogId,
            },
          },
          create: {
            reflabId,
            testCatalogId: t.testCatalogId,
            externalCode: t.externalCode,
            cost: t.cost,
            tat: t.tat,
          },
          update: {
            externalCode: t.externalCode,
            cost: t.cost,
            tat: t.tat,
          },
        }),
      ),
    );

    return results;
  }

  // ───────────────────────────────────────────
  // Remove a test mapping
  // ───────────────────────────────────────────

  async removeTest(tenantId: string, reflabId: string, testCatalogId: string) {
    await this.findOne(tenantId, reflabId);

    const mapping = await this.prisma.reflabTest.findUnique({
      where: {
        reflabId_testCatalogId: {
          reflabId,
          testCatalogId,
        },
      },
    });

    if (!mapping) {
      throw new NotFoundException("Test mapping not found for this reference lab");
    }

    await this.prisma.reflabTest.delete({
      where: { id: mapping.id },
    });
  }

  // ───────────────────────────────────────────
  // Calculate cost for selected tests
  // ───────────────────────────────────────────

  async calculateCost(tenantId: string, reflabId: string, testIds: string[]) {
    await this.findOne(tenantId, reflabId);

    const mappings = await this.prisma.reflabTest.findMany({
      where: {
        reflabId,
        testCatalogId: { in: testIds },
      },
      include: {
        testCatalog: { select: { id: true, name: true, code: true } },
      },
    });

    const breakdown = mappings.map((m) => ({
      testCatalogId: m.testCatalogId,
      testName: m.testCatalog.name,
      testCode: m.testCatalog.code,
      cost: m.cost,
      tat: m.tat,
    }));

    const totalCost = breakdown.reduce((sum, item) => sum + item.cost, 0);
    const maxTat = breakdown.length > 0 ? Math.max(...breakdown.map((b) => b.tat)) : 0;

    return {
      reflabId,
      totalCost,
      maxTatHours: maxTat,
      breakdown,
      unmappedTestIds: testIds.filter(
        (id) => !mappings.some((m) => m.testCatalogId === id),
      ),
    };
  }
}
