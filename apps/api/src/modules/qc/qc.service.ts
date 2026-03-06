import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AiService } from "../ai/ai.service";

@Injectable()
export class QcService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

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

  // ── Quality Audit Entries ──────────────────────────────────────────────

  async logAuditEntry(tenantId: string, dto: { action: string; entityType?: string; entityId?: string; description?: string; metadata?: Record<string, unknown>; performedById?: string }) {
    return this.prisma.qualityAuditEntry.create({
      data: {
        tenantId,
        action: dto.action,
        entityType: dto.entityType,
        entityId: dto.entityId,
        description: dto.description,
        metadata: dto.metadata ? JSON.parse(JSON.stringify(dto.metadata)) : undefined,
        performedById: dto.performedById,
      },
    });
  }

  async findAuditEntries(tenantId: string, query: { action?: string; entityType?: string; from?: string; to?: string; page?: number; limit?: number }) {
    const { page = 1, limit = 30 } = query;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = { tenantId };
    if (query.action) where["action"] = query.action;
    if (query.entityType) where["entityType"] = query.entityType;
    if (query.from || query.to) {
      where["performedAt"] = {};
      if (query.from) (where["performedAt"] as Record<string, unknown>)["gte"] = new Date(query.from);
      if (query.to) (where["performedAt"] as Record<string, unknown>)["lte"] = new Date(query.to);
    }
    const [data, total] = await this.prisma.$transaction([
      this.prisma.qualityAuditEntry.findMany({ where, orderBy: { performedAt: "desc" }, skip, take: limit }),
      this.prisma.qualityAuditEntry.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  // ── Non-Conformances ──────────────────────────────────────────────────

  async createNonConformance(tenantId: string, userId: string, dto: { title: string; description?: string; category?: string; severity?: string; source?: string; assignedToId?: string }) {
    const count = await this.prisma.nonConformance.count({ where: { tenantId } });
    const ncNumber = `NC-${String(count + 1).padStart(4, "0")}`;
    const nc = await this.prisma.nonConformance.create({
      data: {
        tenantId,
        ncNumber,
        title: dto.title,
        description: dto.description,
        category: dto.category,
        severity: dto.severity,
        source: dto.source,
        assignedToId: dto.assignedToId,
        createdById: userId,
      },
    });
    await this.logAuditEntry(tenantId, { action: "NC_CREATED", entityType: "NonConformance", entityId: nc.id, description: `Non-conformance ${ncNumber} created`, performedById: userId });
    return nc;
  }

  async findNonConformances(tenantId: string, query: { status?: string; severity?: string; category?: string; page?: number; limit?: number }) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = { tenantId };
    if (query.status) where["status"] = query.status;
    if (query.severity) where["severity"] = query.severity;
    if (query.category) where["category"] = query.category;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.nonConformance.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
      this.prisma.nonConformance.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async updateNonConformance(id: string, tenantId: string, userId: string, dto: { status?: string; rootCause?: string; resolution?: string; capaId?: string; resolvedAt?: string; closedAt?: string }) {
    const data: Record<string, unknown> = {};
    if (dto.status) data["status"] = dto.status;
    if (dto.rootCause) data["rootCause"] = dto.rootCause;
    if (dto.resolution) data["resolution"] = dto.resolution;
    if (dto.capaId) data["capaId"] = dto.capaId;
    if (dto.resolvedAt) data["resolvedAt"] = new Date(dto.resolvedAt);
    if (dto.closedAt) data["closedAt"] = new Date(dto.closedAt);
    const nc = await this.prisma.nonConformance.update({ where: { id }, data });
    await this.logAuditEntry(tenantId, { action: "NC_UPDATED", entityType: "NonConformance", entityId: id, description: `Non-conformance updated: ${dto.status ?? "fields changed"}`, performedById: userId });
    return nc;
  }

  // ── EQAS Rounds & Results ─────────────────────────────────────────────

  async createEQASRound(tenantId: string, userId: string, dto: { programName: string; roundNumber: string; year: number; startDate?: string; endDate?: string; notes?: string }) {
    return this.prisma.eQASRound.create({
      data: {
        tenantId,
        programName: dto.programName,
        roundNumber: dto.roundNumber,
        year: dto.year,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        notes: dto.notes,
        createdById: userId,
      },
    });
  }

  async findEQASRounds(tenantId: string, query: { year?: number; status?: string; page?: number; limit?: number }) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = { tenantId };
    if (query.year) where["year"] = query.year;
    if (query.status) where["status"] = query.status;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.eQASRound.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit, include: { results: true } }),
      this.prisma.eQASRound.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async addEQASResults(roundId: string, results: { analyte: string; assignedValue?: number; reportedValue?: number; acceptableRange?: string; notes?: string }[]) {
    const created = await this.prisma.eQASResult.createMany({
      data: results.map((r) => {
        const sdi = r.assignedValue && r.reportedValue ? (r.reportedValue - r.assignedValue) / (r.assignedValue * 0.1 || 1) : null;
        const evaluation = sdi !== null ? (Math.abs(sdi) <= 2 ? "ACCEPTABLE" : Math.abs(sdi) <= 3 ? "NEEDS_REVIEW" : "UNACCEPTABLE") : null;
        return {
          roundId,
          analyte: r.analyte,
          assignedValue: r.assignedValue,
          reportedValue: r.reportedValue,
          sdi,
          acceptableRange: r.acceptableRange,
          evaluation,
          notes: r.notes,
        };
      }),
    });
    // Compute overall score for the round
    const allResults = await this.prisma.eQASResult.findMany({ where: { roundId } });
    const acceptable = allResults.filter((r) => r.evaluation === "ACCEPTABLE").length;
    const overallScore = allResults.length > 0 ? Math.round((acceptable / allResults.length) * 100) : 0;
    await this.prisma.eQASRound.update({ where: { id: roundId }, data: { overallScore, status: "SUBMITTED" } });
    return created;
  }

  // ── Instrument Maintenance Logs ───────────────────────────────────────

  async createMaintenanceLog(tenantId: string, userId: string, dto: { instrumentId: string; type?: string; description?: string; performedAt?: string; nextDueAt?: string; notes?: string; status?: string }) {
    return this.prisma.instrumentMaintenanceLog.create({
      data: {
        tenantId,
        instrumentId: dto.instrumentId,
        type: dto.type ?? "PREVENTIVE",
        description: dto.description,
        performedAt: dto.performedAt ? new Date(dto.performedAt) : new Date(),
        nextDueAt: dto.nextDueAt ? new Date(dto.nextDueAt) : undefined,
        notes: dto.notes,
        status: dto.status ?? "COMPLETED",
        performedById: userId,
      },
    });
  }

  async findMaintenanceLogs(tenantId: string, query: { instrumentId?: string; type?: string; status?: string; page?: number; limit?: number }) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = { tenantId };
    if (query.instrumentId) where["instrumentId"] = query.instrumentId;
    if (query.type) where["type"] = query.type;
    if (query.status) where["status"] = query.status;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.instrumentMaintenanceLog.findMany({ where, orderBy: { performedAt: "desc" }, skip, take: limit, include: { instrument: { select: { name: true, serialNumber: true } } } }),
      this.prisma.instrumentMaintenanceLog.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  // ── Quality Documents (extended) ──────────────────────────────────────

  async createDocument(tenantId: string, userId: string, dto: { title: string; type?: string; category?: string; version?: string; content?: string; effectiveAt?: string; expiresAt?: string }) {
    return this.prisma.qualityDocument.create({
      data: {
        tenantId,
        title: dto.title,
        type: dto.type ?? "SOP",
        category: dto.category,
        version: dto.version ?? "1.0",
        content: dto.content,
        effectiveAt: dto.effectiveAt ? new Date(dto.effectiveAt) : undefined,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        createdById: userId,
      },
    });
  }

  async findDocuments(tenantId: string, query: { type?: string; status?: string; page?: number; limit?: number }) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = { tenantId };
    if (query.type) where["type"] = query.type;
    if (query.status) where["status"] = query.status;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.qualityDocument.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
      this.prisma.qualityDocument.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async approveDocument(id: string, tenantId: string, userId: string) {
    const doc = await this.prisma.qualityDocument.update({
      where: { id },
      data: { status: "ACTIVE", approvedById: userId, approvedAt: new Date() },
    });
    await this.logAuditEntry(tenantId, { action: "DOCUMENT_APPROVED", entityType: "QualityDocument", entityId: id, description: `Document "${doc.title}" approved`, performedById: userId });
    return doc;
  }

  // ── QC Dashboard Stats ────────────────────────────────────────────────

  async getDashboardStats(tenantId: string) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [totalRuns, failedRuns, warningRuns, openCapas, openNCs, activeDocuments, overdueMaintenanceLogs] = await this.prisma.$transaction([
      this.prisma.qCEntry.count({ where: { tenantId, runAt: { gte: thirtyDaysAgo } } }),
      this.prisma.qCEntry.count({ where: { tenantId, runAt: { gte: thirtyDaysAgo }, result: "FAIL" as never } }),
      this.prisma.qCEntry.count({ where: { tenantId, runAt: { gte: thirtyDaysAgo }, result: "WARNING" as never } }),
      this.prisma.cAPA.count({ where: { tenantId, status: { in: ["OPEN", "IN_PROGRESS"] as never[] } } }),
      this.prisma.nonConformance.count({ where: { tenantId, status: { in: ["OPEN", "UNDER_INVESTIGATION"] } } }),
      this.prisma.qualityDocument.count({ where: { tenantId, status: "ACTIVE" } }),
      this.prisma.instrumentMaintenanceLog.count({ where: { tenantId, status: "OVERDUE" } }),
    ]);

    const passRate = totalRuns > 0 ? Math.round(((totalRuns - failedRuns) / totalRuns) * 100) : 100;

    return {
      totalRuns,
      failedRuns,
      warningRuns,
      passRate,
      openCapas,
      openNCs,
      activeDocuments,
      overdueMaintenanceLogs,
    };
  }

  // ── AI CAPA Assist ────────────────────────────────────────────────────

  async aiCapaAssist(tenantId: string, capaDescription: string, rootCause?: string) {
    const systemPrompt = `You are a quality management expert for a diagnostic laboratory (NABL/CAP accredited).
Given a CAPA (Corrective and Preventive Action) description and optional root cause, provide:
1. **Root Cause Analysis**: If not provided, suggest probable root causes using 5-Why or Fishbone method
2. **Corrective Actions**: Immediate steps to fix the issue (2-3 bullet points)
3. **Preventive Actions**: Long-term steps to prevent recurrence (2-3 bullet points)
4. **Risk Assessment**: Brief assessment of patient safety risk (LOW/MEDIUM/HIGH)
5. **Timeline**: Suggested timeline for implementation

Be specific to diagnostic laboratory operations. Keep response under 500 words. Use markdown formatting.`;

    const userMessage = `CAPA Description: ${capaDescription}${rootCause ? `\nRoot Cause: ${rootCause}` : "\nRoot cause not yet identified — please suggest."}`;

    try {
      const response = await this.aiService.complete(systemPrompt, userMessage, 1200);
      return { suggestion: response.text, generatedAt: new Date().toISOString() };
    } catch {
      return { suggestion: "AI service is temporarily unavailable. Please try again later.", generatedAt: new Date().toISOString() };
    }
  }
}
