import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class CptService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertCPT(
    tenantId: string,
    dto: {
      instrumentId: string;
      testCatalogId: string;
      reagentCost?: number;
      controlCost?: number;
      consumableCost?: number;
      calibrationCost?: number;
      overheadCost?: number;
      notes?: string;
    },
    userId: string,
  ) {
    const totalCPT =
      (dto.reagentCost || 0) +
      (dto.controlCost || 0) +
      (dto.consumableCost || 0) +
      (dto.calibrationCost || 0) +
      (dto.overheadCost || 0);

    const test = await this.prisma.testCatalog.findFirst({
      where: { id: dto.testCatalogId, tenantId },
    });
    const mrp = Number(test?.price ?? 0);
    const grossMarginAmt = mrp - totalCPT;
    const grossMarginPct = mrp > 0 ? (grossMarginAmt / mrp) * 100 : 0;

    return this.prisma.instrumentCPT.upsert({
      where: {
        tenantId_instrumentId_testCatalogId: {
          tenantId,
          instrumentId: dto.instrumentId,
          testCatalogId: dto.testCatalogId,
        },
      },
      update: {
        reagentCost: dto.reagentCost ?? 0,
        controlCost: dto.controlCost ?? 0,
        consumableCost: dto.consumableCost ?? 0,
        calibrationCost: dto.calibrationCost ?? 0,
        overheadCost: dto.overheadCost ?? 0,
        totalCPT,
        mrpAtTime: mrp,
        grossMarginAmt: Math.round(grossMarginAmt * 100) / 100,
        grossMarginPct: Math.round(grossMarginPct * 10) / 10,
        notes: dto.notes,
        lastEditedById: userId,
        lastEditedAt: new Date(),
      },
      create: {
        tenantId,
        instrumentId: dto.instrumentId,
        testCatalogId: dto.testCatalogId,
        reagentCost: dto.reagentCost ?? 0,
        controlCost: dto.controlCost ?? 0,
        consumableCost: dto.consumableCost ?? 0,
        calibrationCost: dto.calibrationCost ?? 0,
        overheadCost: dto.overheadCost ?? 0,
        totalCPT,
        mrpAtTime: mrp,
        grossMarginAmt: Math.round(grossMarginAmt * 100) / 100,
        grossMarginPct: Math.round(grossMarginPct * 10) / 10,
        notes: dto.notes,
        lastEditedById: userId,
      },
    });
  }

  async getCPTForTest(tenantId: string, testCatalogId: string) {
    return this.prisma.instrumentCPT.findMany({
      where: { tenantId, testCatalogId },
      include: { instrument: true },
      orderBy: { totalCPT: "asc" },
    });
  }

  async deleteCPT(tenantId: string, id: string) {
    const existing = await this.prisma.instrumentCPT.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException("CPT entry not found");
    await this.prisma.instrumentCPT.delete({ where: { id } });
    return { deleted: true };
  }

  async getMarginDashboard(
    tenantId: string,
    filters: {
      instrumentId?: string;
      department?: string;
      minMarginPct?: number;
      maxMarginPct?: number;
    },
  ) {
    const where: any = { tenantId };
    if (filters.instrumentId) where.instrumentId = filters.instrumentId;

    const cpts = await this.prisma.instrumentCPT.findMany({
      where,
      include: { instrument: true },
    });

    const testIds = [...new Set(cpts.map((c) => c.testCatalogId))];
    const tests = await this.prisma.testCatalog.findMany({
      where: { tenantId, id: { in: testIds } },
      select: { id: true, name: true, code: true, price: true, department: true },
    });
    const testMap = Object.fromEntries(tests.map((t) => [t.id, t]));

    let rows = cpts.map((cpt) => ({
      id: cpt.id,
      testCatalogId: cpt.testCatalogId,
      testCode: testMap[cpt.testCatalogId]?.code ?? "",
      testName: testMap[cpt.testCatalogId]?.name ?? "",
      department: testMap[cpt.testCatalogId]?.department ?? "",
      mrp: Number(testMap[cpt.testCatalogId]?.price ?? 0),
      instrumentId: cpt.instrumentId,
      instrumentName: cpt.instrument.name,
      reagentCost: Number(cpt.reagentCost),
      controlCost: Number(cpt.controlCost),
      consumableCost: Number(cpt.consumableCost),
      calibrationCost: Number(cpt.calibrationCost),
      overheadCost: Number(cpt.overheadCost),
      totalCPT: Number(cpt.totalCPT),
      grossMarginAmt: Number(cpt.grossMarginAmt ?? 0),
      grossMarginPct: Number(cpt.grossMarginPct ?? 0),
      alert: Number(cpt.grossMarginPct ?? 0) < 30 ? ("LOW_MARGIN" as const) : null,
    }));

    if (filters.department) {
      rows = rows.filter((r) => r.department === filters.department);
    }
    if (filters.minMarginPct !== undefined) {
      rows = rows.filter((r) => r.grossMarginPct >= (filters.minMarginPct as number));
    }
    if (filters.maxMarginPct !== undefined) {
      rows = rows.filter((r) => r.grossMarginPct <= (filters.maxMarginPct as number));
    }

    return {
      rows,
      summary: {
        totalTests: rows.length,
        avgMarginPct:
          rows.length > 0
            ? Math.round(
                (rows.reduce((s, r) => s + r.grossMarginPct, 0) / rows.length) * 10,
              ) / 10
            : 0,
        lowMarginCount: rows.filter((r) => r.grossMarginPct < 30).length,
        highMarginCount: rows.filter((r) => r.grossMarginPct >= 60).length,
      },
    };
  }

  /**
   * Seed default CPT values for common tests.
   * Maps instrument names to test names with approximate costs.
   */
  async seedDefaultCPT(tenantId: string, userId: string) {
    const CPT_SEEDS = [
      { instrumentName: "Sysmex XN-330", testName: "CBC", reagent: 28, control: 8, consumable: 5, calibration: 3, overhead: 4 },
      { instrumentName: "Mindray BC-30", testName: "CBC", reagent: 20, control: 6, consumable: 4, calibration: 2, overhead: 3 },
      { instrumentName: "Roche Cobas E411", testName: "TSH", reagent: 60, control: 15, consumable: 5, calibration: 10, overhead: 5 },
      { instrumentName: "Abbott Architect i1000", testName: "TSH", reagent: 55, control: 12, consumable: 5, calibration: 8, overhead: 5 },
      { instrumentName: "Beckman AU480", testName: "Blood Sugar", reagent: 8, control: 3, consumable: 2, calibration: 1, overhead: 2 },
      { instrumentName: "Beckman AU480", testName: "LFT", reagent: 45, control: 12, consumable: 5, calibration: 3, overhead: 5 },
      { instrumentName: "Beckman AU480", testName: "HbA1c", reagent: 90, control: 20, consumable: 8, calibration: 10, overhead: 7 },
      { instrumentName: "Beckman AU480", testName: "Lipid", reagent: 55, control: 15, consumable: 5, calibration: 3, overhead: 5 },
      { instrumentName: "Sysmex UX-2000", testName: "Urine", reagent: 12, control: 5, consumable: 8, calibration: 2, overhead: 3 },
    ];

    let created = 0;

    for (const seed of CPT_SEEDS) {
      // Find instrument
      const instrument = await this.prisma.instrument.findFirst({
        where: { tenantId, name: seed.instrumentName },
      });
      if (!instrument) continue;

      // Find test (partial name match)
      const test = await this.prisma.testCatalog.findFirst({
        where: {
          tenantId,
          isActive: true,
          name: { contains: seed.testName, mode: "insensitive" },
        },
      });
      if (!test) continue;

      // Check if already exists
      const existing = await this.prisma.instrumentCPT.findFirst({
        where: {
          tenantId,
          instrumentId: instrument.id,
          testCatalogId: test.id,
        },
      });
      if (existing) continue;

      await this.upsertCPT(
        tenantId,
        {
          instrumentId: instrument.id,
          testCatalogId: test.id,
          reagentCost: seed.reagent,
          controlCost: seed.control,
          consumableCost: seed.consumable,
          calibrationCost: seed.calibration,
          overheadCost: seed.overhead,
        },
        userId,
      );
      created++;
    }

    return { message: "Default CPT values seeded", cptEntriesCreated: created };
  }
}
