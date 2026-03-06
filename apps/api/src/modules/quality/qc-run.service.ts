import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditLogService } from "./audit-log.service";
import { CapaService } from "./capa.service";
import { Decimal } from "@prisma/client/runtime/library";

@Injectable()
export class QcRunService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly capaService: CapaService,
  ) {}

  async createQCRun(
    tenantId: string,
    userId: string,
    dto: {
      branchId: string;
      instrumentId: string;
      analyte: string;
      level: string;
      value: number;
      mean: number;
      sd: number;
      department?: string;
      parameter?: string;
      lotNo?: string;
      expiryDate?: string;
      observedValue?: number;
    },
  ) {
    const mean = dto.mean;
    const sd = dto.sd;
    const value = dto.value;
    const observed = dto.observedValue ?? value;

    // Calculate CV and zScore
    const cv = mean !== 0 ? (sd / mean) * 100 : 0;
    const zScore = sd !== 0 ? (observed - mean) / sd : 0;

    // Westgard rules
    let westgardFlag: string | null = null;
    let isAccepted = true;
    const absZ = Math.abs(zScore);

    if (absZ <= 2.0) {
      westgardFlag = "IN_CONTROL";
    } else if (absZ > 2.0 && absZ <= 3.0) {
      westgardFlag = "1_2S";
      // 1-2s is a warning, still accepted
    } else {
      westgardFlag = "1_3S";
      isAccepted = false;
    }

    const run = await this.prisma.qCRun.create({
      data: {
        tenantId,
        branchId: dto.branchId,
        instrumentId: dto.instrumentId,
        analyte: dto.analyte,
        level: dto.level,
        value: new Decimal(value),
        mean: new Decimal(mean),
        sd: new Decimal(sd),
        cv: new Decimal(cv.toFixed(4)),
        runById: userId,
        department: dto.department,
        parameter: dto.parameter,
        lotNo: dto.lotNo,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
        observedValue: dto.observedValue != null ? new Decimal(dto.observedValue) : undefined,
        zScore: new Decimal(zScore.toFixed(3)),
        westgardFlag,
        isAccepted,
      },
    });

    // Auto-create CAPA for 1-3s rejection
    if (westgardFlag === "1_3S") {
      const dateStr = new Date().toISOString().split("T")[0];
      await this.capaService.createCapa(tenantId, userId, {
        title: `IQC Rejection: ${dto.parameter ?? dto.analyte} ${dto.department ?? ""} ${dateStr}`.trim(),
        type: "CORRECTIVE",
        source: "IQC_FAILURE",
        sourceId: run.id,
        priority: "HIGH",
        department: dto.department,
      });
    }

    await this.auditLog.log(tenantId, "QC_RUN_RECORDED", "QCRun", run.id, userId, null, {
      analyte: dto.analyte,
      westgardFlag,
      zScore: zScore.toFixed(3),
      isAccepted,
    });

    return run;
  }

  async getQCRuns(
    tenantId: string,
    filters: { department?: string; dateFrom?: string; dateTo?: string; parameter?: string; page?: number; limit?: number },
  ) {
    const { page = 1, limit = 50 } = filters;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = { tenantId };
    if (filters.department) where["department"] = filters.department;
    if (filters.parameter) where["parameter"] = filters.parameter;

    if (filters.dateFrom || filters.dateTo) {
      const runAt: Record<string, Date> = {};
      if (filters.dateFrom) runAt["gte"] = new Date(filters.dateFrom);
      if (filters.dateTo) runAt["lte"] = new Date(filters.dateTo);
      where["runAt"] = runAt;
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.qCRun.findMany({
        where,
        orderBy: { runAt: "desc" },
        skip,
        take: limit,
        include: { instrument: { select: { name: true } }, runBy: { select: { firstName: true, lastName: true } } },
      }),
      this.prisma.qCRun.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async getSingleRun(tenantId: string, id: string) {
    return this.prisma.qCRun.findFirst({
      where: { id, tenantId },
      include: {
        instrument: { select: { name: true } },
        runBy: { select: { firstName: true, lastName: true } },
        violations: true,
      },
    });
  }

  async getQCDashboardStats(tenantId: string) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const sixtyDaysFromNow = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

    const [
      totalRunsToday,
      inControlToday,
      flaggedToday,
      openCapas,
      expiringDocuments,
      documentsTotal,
    ] = await this.prisma.$transaction([
      this.prisma.qCRun.count({ where: { tenantId, runAt: { gte: todayStart } } }),
      this.prisma.qCRun.count({ where: { tenantId, runAt: { gte: todayStart }, isAccepted: true } }),
      this.prisma.qCRun.count({ where: { tenantId, runAt: { gte: todayStart }, isAccepted: false } }),
      this.prisma.qualityCapa.count({ where: { tenantId, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
      this.prisma.qualityDocument.count({ where: { tenantId, expiryDate: { gte: now, lte: sixtyDaysFromNow } } }),
      this.prisma.qualityDocument.count({ where: { tenantId } }),
    ]);

    // Runs by department (today)
    const deptRuns = await this.prisma.qCRun.groupBy({
      by: ["department"],
      where: { tenantId, runAt: { gte: todayStart }, department: { not: null } },
      _count: true,
    });
    const deptFlagged = await this.prisma.qCRun.groupBy({
      by: ["department"],
      where: { tenantId, runAt: { gte: todayStart }, department: { not: null }, isAccepted: false },
      _count: true,
    });
    const flaggedMap = new Map(deptFlagged.map((d) => [d.department ?? "", d._count]));
    const runsByDepartment = deptRuns.map((d) => ({
      dept: d.department ?? "",
      total: d._count,
      flagged: flaggedMap.get(d.department ?? "") ?? 0,
    }));

    // Last 7 days trend
    const last7Runs = await this.prisma.qCRun.findMany({
      where: { tenantId, runAt: { gte: sevenDaysAgo } },
      select: { runAt: true, isAccepted: true },
    });

    const trendMap = new Map<string, { total: number; flagged: number }>();
    for (const run of last7Runs) {
      const dateKey = run.runAt.toISOString().slice(0, 10);
      const entry = trendMap.get(dateKey) ?? { total: 0, flagged: 0 };
      entry.total++;
      if (!run.isAccepted) entry.flagged++;
      trendMap.set(dateKey, entry);
    }
    const last7DaysTrend = Array.from(trendMap.entries())
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalRunsToday,
      inControlToday,
      flaggedToday,
      openCapas,
      expiringDocuments,
      documentsTotal,
      runsByDepartment,
      last7DaysTrend,
    };
  }

  async getLeveyJenningsData(
    tenantId: string,
    department: string,
    parameter: string,
    level: string,
    days = 30,
  ) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const runs = await this.prisma.qCRun.findMany({
      where: {
        tenantId,
        department,
        parameter,
        level,
        runAt: { gte: since },
      },
      orderBy: { runAt: "asc" },
      select: {
        runAt: true,
        value: true,
        mean: true,
        sd: true,
        westgardFlag: true,
      },
    });

    return runs.map((r) => {
      const mean = Number(r.mean);
      const sd = Number(r.sd);
      return {
        date: r.runAt,
        value: Number(r.value),
        mean,
        sd,
        upperWarning: mean + 2 * sd,
        upperControl: mean + 3 * sd,
        lowerWarning: mean - 2 * sd,
        lowerControl: mean - 3 * sd,
        westgardFlag: r.westgardFlag,
      };
    });
  }
}
