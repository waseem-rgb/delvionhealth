import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class QcService {
  constructor(private readonly prisma: PrismaService) {}

  // Keep existing findAll for backward compat
  async findAll(tenantId: string): Promise<unknown[]> {
    return this.prisma.qCEntry.findMany({ where: { tenantId }, orderBy: { runAt: "desc" }, take: 50 });
  }

  private applyWestgardRules(value: number, mean: number, sd: number, prevValue?: number): { result: "PASS" | "FAIL" | "WARNING"; violations: string[] } {
    const violations: string[] = [];
    const z = Math.abs(value - mean) / sd;
    let result: "PASS" | "FAIL" | "WARNING" = "PASS";

    // 1-3s: any single value > 3 SD
    if (z > 3) {
      violations.push("1-3s");
      result = "FAIL";
    } else if (z > 2) {
      // 1-2s: warning
      violations.push("1-2s");
      if (result === "PASS") result = "WARNING";
    }

    // R-4s: range between this and previous > 4 SD
    if (prevValue !== undefined) {
      if (Math.abs(value - prevValue) / sd > 4) {
        violations.push("R-4s");
        result = "FAIL";
      }
      // 2-2s: both this and previous > 2 SD in same direction
      const prevZ = (prevValue - mean) / sd;
      const thisZ = (value - mean) / sd;
      if (Math.abs(prevZ) > 2 && Math.abs(thisZ) > 2 && Math.sign(prevZ) === Math.sign(thisZ)) {
        violations.push("2-2s");
        result = "FAIL";
      }
    }

    return { result, violations };
  }

  async recordRun(dto: { testCatalogId: string; branchId?: string; level: string; measuredValue: number; mean: number; sd: number; reagentLotNumber?: string; instrumentId?: string; runAt?: string }, tenantId: string, userId: string) {
    // Get previous run for this test/level for 2-2s and R-4s checks
    const prev = await this.prisma.qCEntry.findFirst({
      where: { tenantId, testCatalogId: dto.testCatalogId, level: dto.level },
      orderBy: { runAt: "desc" },
    });

    const { result, violations } = this.applyWestgardRules(dto.measuredValue, dto.mean, dto.sd, prev?.measuredValue);

    return this.prisma.qCEntry.create({
      data: {
        tenantId,
        testCatalogId: dto.testCatalogId,
        branchId: dto.branchId,
        level: dto.level,
        measuredValue: dto.measuredValue,
        mean: dto.mean,
        sd: dto.sd,
        result: result as never,
        westgardViolations: violations,
        reagentLotNumber: dto.reagentLotNumber,
        instrumentId: dto.instrumentId,
        runAt: dto.runAt ? new Date(dto.runAt) : new Date(),
        enteredById: userId,
      },
    });
  }

  async findRuns(tenantId: string, query: { testCatalogId?: string; level?: string; from?: string; to?: string; result?: string; page?: number; limit?: number }) {
    const { page = 1, limit = 50 } = query;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = { tenantId };
    if (query.testCatalogId) where["testCatalogId"] = query.testCatalogId;
    if (query.level) where["level"] = query.level;
    if (query.result) where["result"] = query.result;
    if (query.from || query.to) {
      where["runAt"] = {};
      if (query.from) (where["runAt"] as Record<string, unknown>)["gte"] = new Date(query.from);
      if (query.to) (where["runAt"] as Record<string, unknown>)["lte"] = new Date(query.to);
    }
    const [data, total] = await this.prisma.$transaction([
      this.prisma.qCEntry.findMany({ where, orderBy: { runAt: "desc" }, skip, take: limit }),
      this.prisma.qCEntry.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async getLeveyJenningsData(tenantId: string, testCatalogId: string, level: string, from?: string, to?: string) {
    const where: Record<string, unknown> = { tenantId, testCatalogId, level };
    if (from || to) {
      where["runAt"] = {};
      if (from) (where["runAt"] as Record<string, unknown>)["gte"] = new Date(from);
      if (to) (where["runAt"] as Record<string, unknown>)["lte"] = new Date(to);
    }

    const runs = await this.prisma.qCEntry.findMany({ where, orderBy: { runAt: "asc" } });
    if (runs.length === 0) return { mean: 0, sd: 0, runs: [] };

    const mean = runs[0]?.mean ?? 0;
    const sd = runs[0]?.sd ?? 0;

    return {
      mean,
      sd,
      runs: runs.map((r) => ({
        runAt: r.runAt,
        value: r.measuredValue,
        result: r.result,
        violations: r.westgardViolations,
      })),
    };
  }

  async createCAPA(dto: { qcEntryId?: string; description: string; rootCause?: string; correctiveAction?: string; preventiveAction?: string; dueDate?: string; assignedToId: string }, tenantId: string, userId: string) {
    return this.prisma.cAPA.create({
      data: {
        tenantId,
        qcEntryId: dto.qcEntryId,
        description: dto.description,
        rootCause: dto.rootCause,
        correctiveAction: dto.correctiveAction,
        preventiveAction: dto.preventiveAction,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        assignedToId: dto.assignedToId,
        createdById: userId,
        status: "OPEN" as never,
      },
    });
  }

  async findCAPAs(tenantId: string, query: { status?: string; page?: number; limit?: number }) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = { tenantId };
    if (query.status) where["status"] = query.status;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.cAPA.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
      this.prisma.cAPA.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async updateCAPA(id: string, dto: { rootCause?: string; correctiveAction?: string; preventiveAction?: string; status?: string; closedAt?: string }, tenantId: string) {
    const data: Record<string, unknown> = { ...dto };
    if (dto.closedAt) data["closedAt"] = new Date(dto.closedAt);
    if (dto.status) data["status"] = dto.status;
    return this.prisma.cAPA.update({ where: { id }, data });
  }

  async getTATReport(tenantId: string, from?: string, to?: string) {
    const where: Record<string, unknown> = { tenantId, isVerified: true };
    if (from || to) {
      where["verifiedAt"] = {};
      if (from) (where["verifiedAt"] as Record<string, unknown>)["gte"] = new Date(from);
      if (to) (where["verifiedAt"] as Record<string, unknown>)["lte"] = new Date(to);
    }

    const results = await this.prisma.testResult.findMany({
      where,
      include: { orderItem: { include: { testCatalog: { select: { name: true } } } }, order: { select: { createdAt: true } } },
    });

    const testMap = new Map<string, { name: string; tatValues: number[] }>();
    for (const r of results) {
      if (!r.verifiedAt || !r.order.createdAt) continue;
      const tatHours = (r.verifiedAt.getTime() - r.order.createdAt.getTime()) / 3600000;
      const testName = r.orderItem.testCatalog.name;
      const existing = testMap.get(r.orderItemId) ?? { name: testName, tatValues: [] };
      existing.tatValues.push(tatHours);
      testMap.set(r.orderItem.testCatalogId, existing);
    }

    return Array.from(testMap.entries()).map(([testCatalogId, data]) => {
      const avg = data.tatValues.reduce((s, v) => s + v, 0) / data.tatValues.length;
      const max = Math.max(...data.tatValues);
      return {
        testCatalogId,
        testName: data.name,
        avgTATHours: Math.round(avg * 10) / 10,
        maxTATHours: Math.round(max * 10) / 10,
        orderCount: data.tatValues.length,
        flagged: avg > 24,
      };
    }).sort((a, b) => b.avgTATHours - a.avgTATHours);
  }

  async getCriticalValueLog(tenantId: string, query: { page?: number; limit?: number }) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.testResult.findMany({
        where: { tenantId, interpretation: "CRITICAL" as never },
        include: {
          criticalValueAcks: { orderBy: { acknowledgedAt: "desc" }, take: 1 },
          orderItem: { include: { testCatalog: { select: { name: true } } } },
          order: { include: { patient: { select: { firstName: true, lastName: true, mrn: true } } } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.testResult.count({ where: { tenantId, interpretation: "CRITICAL" as never } }),
    ]);
    return { data, total, page, limit };
  }

  async acknowledgeCritical(resultId: string, tenantId: string, userId: string, notes?: string) {
    const result = await this.prisma.testResult.findFirst({ where: { id: resultId, tenantId } });
    if (!result) throw new Error("Result not found");
    return this.prisma.criticalValueAck.create({
      data: { tenantId, testResultId: resultId, acknowledgedById: userId, notes },
    });
  }
}
