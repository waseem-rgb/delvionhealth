import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditLogService } from "./audit-log.service";
import { CapaService } from "./capa.service";

@Injectable()
export class EqasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly capaService: CapaService,
  ) {}

  async createRound(
    tenantId: string,
    userId: string,
    dto: {
      programName: string;
      roundNumber: string;
      year: number;
      scheme?: string;
      department?: string;
      startDate?: string;
      endDate?: string;
      dueDate?: string;
      notes?: string;
    },
  ) {
    const round = await this.prisma.eQASRound.create({
      data: {
        tenantId,
        programName: dto.programName,
        roundNumber: dto.roundNumber,
        year: dto.year,
        scheme: dto.scheme,
        department: dto.department,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        notes: dto.notes,
        createdById: userId,
      },
    });

    await this.auditLog.log(tenantId, "EQAS_ROUND_CREATED", "EQASRound", round.id, userId, null, {
      programName: dto.programName,
      roundNumber: dto.roundNumber,
    });

    return round;
  }

  async submitResults(
    tenantId: string,
    userId: string,
    roundId: string,
    results: Array<{
      analyte: string;
      parameter?: string;
      assignedValue?: number;
      reportedValue?: number;
      yourValue?: number;
      peerMean?: number;
      peerSD?: number;
      acceptableRange?: string;
      evaluation?: string;
      notes?: string;
    }>,
  ) {
    const created = [];

    for (const r of results) {
      // Calculate SDI if peer data available
      let sdi: number | null = null;
      let sdiScore: number | null = null;
      let capaRequired = false;

      const yv = r.yourValue ?? r.reportedValue;
      if (yv != null && r.peerMean != null && r.peerSD != null && r.peerSD !== 0) {
        sdi = (yv - r.peerMean) / r.peerSD;
        sdiScore = sdi;
        if (Math.abs(sdi) > 2) capaRequired = true;
      } else if (r.reportedValue != null && r.assignedValue != null) {
        // Fallback SDI from assigned value
        const denom = r.assignedValue * 0.1 || 1;
        sdi = (r.reportedValue - r.assignedValue) / denom;
        sdiScore = sdi;
        if (Math.abs(sdi) > 2) capaRequired = true;
      }

      const result = await this.prisma.eQASResult.create({
        data: {
          roundId,
          analyte: r.analyte,
          parameter: r.parameter,
          assignedValue: r.assignedValue,
          reportedValue: r.reportedValue,
          yourValue: r.yourValue,
          peerMean: r.peerMean,
          peerSD: r.peerSD,
          sdi: sdi != null ? Number(sdi.toFixed(3)) : null,
          sdiScore: sdiScore,
          acceptableRange: r.acceptableRange,
          evaluation: r.evaluation ?? (capaRequired ? "UNACCEPTABLE" : sdi != null ? (Math.abs(sdi) <= 1.5 ? "ACCEPTABLE" : "NEEDS_REVIEW") : null),
          capaRequired,
          notes: r.notes,
        },
      });

      // Auto-create CAPA for unacceptable results
      if (capaRequired) {
        await this.capaService.createCapa(tenantId, userId, {
          title: `EQAS Rejection: ${r.analyte} SDI=${sdi?.toFixed(2)}`,
          type: "CORRECTIVE",
          source: "EQAS",
          sourceId: result.id,
          priority: "HIGH",
        });
      }

      created.push(result);
    }

    // Update round status
    await this.prisma.eQASRound.update({
      where: { id: roundId },
      data: { status: "SUBMITTED", submittedAt: new Date() },
    });

    await this.auditLog.log(tenantId, "EQAS_RESULTS_SUBMITTED", "EQASRound", roundId, userId, null, {
      resultCount: results.length,
      capaCreated: created.filter((r) => r.capaRequired).length,
    });

    return created;
  }

  async getRounds(
    tenantId: string,
    filters: { year?: number; department?: string; status?: string; page?: number; limit?: number },
  ) {
    const { page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = { tenantId };
    if (filters.year) where["year"] = filters.year;
    if (filters.department) where["department"] = filters.department;
    if (filters.status) where["status"] = filters.status;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.eQASRound.findMany({
        where,
        include: { results: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.eQASRound.count({ where }),
    ]);

    return { data, total, page, limit };
  }
}
