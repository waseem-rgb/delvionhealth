import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { NonPathReportStatus } from "@prisma/client";

// ── Classification map ───────────────────────────────────────────────────────

const CLASSIFICATION_MAP: Record<
  string,
  { investigationType: string; investigationCategory: string; methodology: string; patterns: string[] }
> = {
  "X-RAY": {
    investigationType: "IMAGING",
    investigationCategory: "X-RAY",
    methodology: "Digital Radiography",
    patterns: ["x-ray", "x ray", "xray"],
  },
  CT: {
    investigationType: "IMAGING",
    investigationCategory: "CT",
    methodology: "Computed Tomography",
    patterns: ["ct ", "ct scan", "hrct", "computed tomography"],
  },
  MRI: {
    investigationType: "IMAGING",
    investigationCategory: "MRI",
    methodology: "Magnetic Resonance Imaging",
    patterns: ["mri ", "mra ", "mrv ", "mrcp", "magnetic resonance"],
  },
  USG: {
    investigationType: "IMAGING",
    investigationCategory: "USG",
    methodology: "Ultrasonography",
    patterns: [
      "usg ", "ultrasound", "ultrasonography", "sonography",
      "follicular study", "nt scan", "anomaly scan", "growth scan",
      "biophysical profile", "viability scan", "dating scan",
    ],
  },
  DOPPLER: {
    investigationType: "IMAGING",
    investigationCategory: "DOPPLER",
    methodology: "Color Doppler Ultrasonography",
    patterns: [
      "doppler", "color flow", "dvt study", "varicose vein mapping",
      "av fistula doppler", "transcranial doppler",
    ],
  },
  MOLECULAR: {
    investigationType: "MOLECULAR",
    investigationCategory: "MOLECULAR",
    methodology: "Molecular Testing",
    patterns: [
      "pcr", "real-time pcr", "rt-pcr", "qpcr", "ngs", "multiplex pcr",
      "viral load", "genotyping panel", "mutation panel", "fusion panel",
      "liquid biopsy", "line probe",
    ],
  },
  GENETIC: {
    investigationType: "GENETIC",
    investigationCategory: "GENETIC",
    methodology: "Genetic Testing",
    patterns: [
      "karyotype", "fish ", "chromosomal", "microarray", "nipt",
      "whole exome", "whole genome", "sequencing", "deletion duplication",
      "carrier screening", "targeted variant", "snp array",
      "cytogenetics", "qf-pcr",
    ],
  },
};

function classifyTest(name: string): {
  investigationType: string;
  investigationCategory: string;
  methodology: string;
} | null {
  const lower = name.toLowerCase();
  for (const [, config] of Object.entries(CLASSIFICATION_MAP)) {
    for (const pattern of config.patterns) {
      if (lower.includes(pattern)) {
        return {
          investigationType: config.investigationType,
          investigationCategory: config.investigationCategory,
          methodology: config.methodology,
        };
      }
    }
  }
  return null;
}

@Injectable()
export class NonPathService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Test Classification ──────────────────────────────────────────────────

  async classifyTests(tenantId: string) {
    const tests = await this.prisma.testCatalog.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, name: true },
    });

    const updates: Record<string, number> = {
      "X-RAY": 0, CT: 0, MRI: 0, USG: 0, DOPPLER: 0, MOLECULAR: 0, GENETIC: 0, PATHOLOGY: 0,
    };

    for (const test of tests) {
      const classification = classifyTest(test.name);
      if (classification) {
        await this.prisma.testCatalog.update({
          where: { id: test.id },
          data: {
            investigationType: classification.investigationType,
            investigationCategory: classification.investigationCategory,
          },
        });
        updates[classification.investigationCategory] = (updates[classification.investigationCategory] ?? 0) + 1;
      } else {
        updates["PATHOLOGY"]++;
      }
    }

    return { total: tests.length, breakdown: updates };
  }

  // ── Templates ────────────────────────────────────────────────────────────

  async listTemplates(tenantId: string, type?: string) {
    return this.prisma.nonPathReportTemplate.findMany({
      where: {
        tenantId,
        isActive: true,
        ...(type && { investigationType: type }),
      },
      orderBy: [{ isDefault: "desc" }, { templateName: "asc" }],
    });
  }

  async getTemplate(tenantId: string, id: string) {
    const t = await this.prisma.nonPathReportTemplate.findFirst({ where: { id, tenantId } });
    if (!t) throw new NotFoundException("Template not found");
    return t;
  }

  async createTemplate(tenantId: string, userId: string, dto: {
    investigationType: string;
    testType?: string;
    templateName: string;
    methodology: string;
    sections: unknown;
    isDefault?: boolean;
  }) {
    return this.prisma.nonPathReportTemplate.create({
      data: {
        tenantId,
        investigationType: dto.investigationType,
        testType: dto.testType,
        templateName: dto.templateName,
        methodology: dto.methodology,
        sections: dto.sections as never,
        isDefault: dto.isDefault ?? false,
        createdBy: userId,
      },
    });
  }

  async updateTemplate(tenantId: string, id: string, dto: Record<string, unknown>) {
    await this.getTemplate(tenantId, id);
    return this.prisma.nonPathReportTemplate.update({ where: { id }, data: dto as never });
  }

  // ── Worklist ─────────────────────────────────────────────────────────────

  async getWorklist(tenantId: string, opts: {
    type?: string;
    status?: string;
    date?: string;
    search?: string;
  }) {
    const { type, status, date, search } = opts;

    const dateFilter = date ? {
      gte: new Date(`${date}T00:00:00`),
      lt: new Date(`${date}T23:59:59`),
    } : {
      gte: new Date(new Date().setHours(0, 0, 0, 0)),
      lt: new Date(new Date().setHours(23, 59, 59, 999)),
    };

    // Get order items with non-path tests
    const orderItems = await this.prisma.orderItem.findMany({
      where: {
        testCatalog: {
          investigationType: type
            ? { in: ["IMAGING", "MOLECULAR", "GENETIC"] }
            : { not: "PATHOLOGY" },
          ...(type && { investigationCategory: type }),
        },
        order: {
          tenantId,
          createdAt: dateFilter,
          ...(search && {
            patient: {
              OR: [
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
                { mrn: { contains: search, mode: "insensitive" } },
              ],
            },
          }),
        },
      },
      include: {
        testCatalog: { select: { id: true, name: true, code: true, investigationCategory: true, methodology: true } },
        order: {
          select: {
            id: true,
            orderNumber: true,
            createdAt: true,
            notes: true,
            patient: {
              select: { id: true, mrn: true, firstName: true, lastName: true, dob: true, gender: true, phone: true },
            },
          },
        },
      },
      orderBy: { order: { createdAt: "desc" } },
    });

    // Get existing reports keyed by orderItemId
    const orderItemIds = orderItems.map((i) => i.id);
    const reports = await this.prisma.nonPathReport.findMany({
      where: { tenantId, orderItemId: { in: orderItemIds } },
      select: { id: true, orderItemId: true, status: true },
    });
    const reportMap = new Map(reports.map((r) => [r.orderItemId, r]));

    return orderItems
      .filter((item) => {
        if (!status) return true;
        const report = reportMap.get(item.id);
        if (status === "NOT_STARTED") return !report;
        return report?.status === status;
      })
      .map((item) => {
        const report = reportMap.get(item.id);
        const dob = item.order.patient.dob;
        const ageYears = dob
          ? Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
          : null;
        return {
          orderItemId: item.id,
          orderId: item.order.id,
          orderNumber: item.order.orderNumber,
          patientId: item.order.patient.id,
          patientName: `${item.order.patient.firstName} ${item.order.patient.lastName}`.trim(),
          patientMRN: item.order.patient.mrn,
          patientAge: ageYears,
          patientGender: item.order.patient.gender,
          patientPhone: item.order.patient.phone,
          testName: item.testCatalog.name,
          testCode: item.testCatalog.code,
          investigationCategory: item.testCatalog.investigationCategory,
          methodology: item.testCatalog.methodology,
          clinicalHistory: item.order.notes,
          registeredAt: item.order.createdAt,
          reportStatus: report ? report.status : "NOT_STARTED",
          reportId: report?.id ?? null,
        };
      });
  }

  async getWorklistStats(tenantId: string) {
    const categories = ["X-RAY", "CT", "MRI", "USG", "DOPPLER", "MOLECULAR", "GENETIC"];
    const stats: Record<string, { total: number; notStarted: number; draft: number; pendingVerification: number; verified: number; dispatched: number }> = {};

    for (const cat of categories) {
      const orderItems = await this.prisma.orderItem.count({
        where: {
          testCatalog: {
            investigationCategory: cat,
            investigationType: { not: "PATHOLOGY" },
          },
          order: {
            tenantId,
            createdAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
              lt: new Date(new Date().setHours(23, 59, 59, 999)),
            },
          },
        },
      });

      const reports = await this.prisma.nonPathReport.groupBy({
        by: ["status"],
        where: {
          tenantId,
          investigationType: cat,
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lt: new Date(new Date().setHours(23, 59, 59, 999)),
          },
        },
        _count: { status: true },
      });

      const statusMap: Record<string, number> = {};
      for (const r of reports) statusMap[r.status] = r._count.status;

      const started = Object.values(statusMap).reduce((a, b) => a + b, 0);
      stats[cat] = {
        total: orderItems,
        notStarted: Math.max(orderItems - started, 0),
        draft: statusMap["DRAFT"] ?? 0,
        pendingVerification: statusMap["PENDING_VERIFICATION"] ?? 0,
        verified: statusMap["VERIFIED"] ?? 0,
        dispatched: statusMap["DISPATCHED"] ?? 0,
      };
    }
    return stats;
  }

  // ── Report CRUD ──────────────────────────────────────────────────────────

  async getReport(tenantId: string, reportId: string) {
    const r = await this.prisma.nonPathReport.findFirst({
      where: { id: reportId, tenantId },
      include: {
        template: true,
        patient: { select: { id: true, mrn: true, firstName: true, lastName: true, dob: true, gender: true, phone: true, email: true } },
        order: { select: { id: true, orderNumber: true, createdAt: true, notes: true } },
      },
    });
    if (!r) throw new NotFoundException("Report not found");
    return r;
  }

  async getReportByOrderItem(tenantId: string, orderItemId: string) {
    return this.prisma.nonPathReport.findFirst({
      where: { tenantId, orderItemId },
      include: {
        template: true,
        patient: { select: { id: true, mrn: true, firstName: true, lastName: true, dob: true, gender: true } },
        order: { select: { id: true, orderNumber: true, createdAt: true, notes: true } },
      },
    });
  }

  async createReport(tenantId: string, userId: string, dto: {
    orderItemId: string;
    templateId?: string;
    clinicalHistory?: string;
    technique?: string;
    sectionData?: unknown;
    findings?: string;
    impression?: string;
    recommendation?: string;
    contrast?: boolean;
    contrastDose?: string;
    equipmentUsed?: string;
    imageCount?: number;
    reportedByName?: string;
    reportedByDesig?: string;
  }) {
    // Validate orderItem
    const orderItem = await this.prisma.orderItem.findFirst({
      where: { id: dto.orderItemId, order: { tenantId } },
      include: {
        testCatalog: true,
        order: { select: { id: true, patientId: true } },
      },
    });
    if (!orderItem) throw new NotFoundException("Order item not found");

    const existing = await this.prisma.nonPathReport.findFirst({
      where: { tenantId, orderItemId: dto.orderItemId },
    });
    if (existing) throw new BadRequestException("Report already exists for this order item. Use PATCH to update.");

    const methodology =
      orderItem.testCatalog.methodology ??
      orderItem.testCatalog.investigationCategory ??
      "Investigation";

    return this.prisma.nonPathReport.create({
      data: {
        tenantId,
        orderId: orderItem.order.id,
        patientId: orderItem.order.patientId,
        orderItemId: dto.orderItemId,
        testCatalogId: orderItem.testCatalogId,
        investigationType: orderItem.testCatalog.investigationCategory ?? "IMAGING",
        testName: orderItem.testCatalog.name,
        testCode: orderItem.testCatalog.code,
        methodology,
        templateId: dto.templateId,
        clinicalHistory: dto.clinicalHistory,
        technique: dto.technique,
        sectionData: dto.sectionData as never,
        findings: dto.findings,
        impression: dto.impression,
        recommendation: dto.recommendation,
        contrast: dto.contrast ?? false,
        contrastDose: dto.contrastDose,
        equipmentUsed: dto.equipmentUsed,
        imageCount: dto.imageCount,
        reportedById: userId,
        reportedByName: dto.reportedByName,
        reportedByDesig: dto.reportedByDesig,
        status: "DRAFT",
      },
    });
  }

  async updateReport(tenantId: string, id: string, dto: Record<string, unknown>) {
    await this.prisma.nonPathReport.findFirstOrThrow({ where: { id, tenantId } });
    const { status: _s, ...safeDto } = dto; // status changes only via submit/verify
    return this.prisma.nonPathReport.update({ where: { id }, data: safeDto as never });
  }

  async submitReport(tenantId: string, id: string, user: { sub: string; firstName?: string; lastName?: string }) {
    const r = await this.prisma.nonPathReport.findFirstOrThrow({ where: { id, tenantId } });
    if (!r.impression) throw new BadRequestException("Impression is required before submitting");
    return this.prisma.nonPathReport.update({
      where: { id },
      data: {
        status: "PENDING_VERIFICATION" as NonPathReportStatus,
        reportedById: user.sub,
        reportedAt: new Date(),
      },
    });
  }

  async verifyReport(tenantId: string, id: string, user: { sub: string; firstName?: string; lastName?: string }, comment?: string) {
    await this.prisma.nonPathReport.findFirstOrThrow({ where: { id, tenantId } });
    return this.prisma.nonPathReport.update({
      where: { id },
      data: {
        status: "VERIFIED" as NonPathReportStatus,
        verifiedById: user.sub,
        verifiedByName: user.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : undefined,
        verifiedAt: new Date(),
        verifierComment: comment,
      },
    });
  }

  async reopenReport(tenantId: string, id: string) {
    await this.prisma.nonPathReport.findFirstOrThrow({ where: { id, tenantId } });
    return this.prisma.nonPathReport.update({
      where: { id },
      data: { status: "DRAFT" as NonPathReportStatus, verifiedById: null, verifiedAt: null },
    });
  }

  async dispatchReport(tenantId: string, id: string, channel: string) {
    const r = await this.prisma.nonPathReport.findFirstOrThrow({ where: { id, tenantId } });
    if (r.status !== "VERIFIED") throw new BadRequestException("Report must be verified before dispatch");

    // Create notification log entry
    await this.prisma.notificationLog.create({
      data: {
        tenantId,
        patientId: r.patientId,
        channel: channel.toUpperCase(),
        type: "REPORT_DELIVERY",
        recipient: channel.toUpperCase(),
        status: "SENT",
        orderId: r.orderId,
        message: `Non-path report dispatched: ${r.testName}`,
      },
    });

    return this.prisma.nonPathReport.update({
      where: { id },
      data: {
        status: "DISPATCHED" as NonPathReportStatus,
        pdfGeneratedAt: new Date(),
      },
    });
  }

  async getVerificationQueue(tenantId: string) {
    return this.prisma.nonPathReport.findMany({
      where: { tenantId, status: "PENDING_VERIFICATION" },
      include: {
        patient: { select: { mrn: true, firstName: true, lastName: true } },
        order: { select: { orderNumber: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async getPreviousReports(tenantId: string, patientId: string, excludeReportId?: string) {
    return this.prisma.nonPathReport.findMany({
      where: {
        tenantId,
        patientId,
        ...(excludeReportId && { id: { not: excludeReportId } }),
        status: { in: ["VERIFIED", "DISPATCHED"] },
      },
      select: {
        id: true,
        testName: true,
        investigationType: true,
        impression: true,
        reportedAt: true,
        createdAt: true,
        order: { select: { orderNumber: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
  }

  // ── AI Suggestions ────────────────────────────────────────────────────────

  async getAiSuggestion(tenantId: string, reportId: string) {
    const report = await this.getReport(tenantId, reportId);
    const ageYears = report.patient.dob
      ? Math.floor((Date.now() - new Date(report.patient.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : "adult";

    // Return a structured prompt that the frontend can use to call AI
    return {
      reportId,
      testName: report.testName,
      methodology: report.methodology,
      patientAge: ageYears,
      patientGender: report.patient.gender,
      investigationType: report.investigationType,
      templateSections: report.template?.sections ?? [],
      suggestedFindings: this.buildNormalFindingsSuggestion(
        report.investigationType,
        report.testName,
        String(ageYears),
        report.patient.gender,
      ),
    };
  }

  private buildNormalFindingsSuggestion(type: string, testName: string, age: string, gender: string): Record<string, string> {
    const base = `${age} year old ${gender} patient.`;
    if (type === "X-RAY") {
      return {
        bones: `Bones are normal in density and morphology. No fracture, dislocation or erosion seen.`,
        softTissues: `Soft tissues are normal. No abnormal calcifications.`,
        airSpaces: `Lung fields are clear. No consolidation, pleural effusion or pneumothorax.`,
        other: `No significant abnormality detected.`,
      };
    }
    if (type === "CT") {
      return {
        brainParenchyma: `Normal grey-white matter differentiation. No focal lesion, hemorrhage or infarct.`,
        ventricles: `Ventricular system is normal in size. No hydrocephalus.`,
        midline: `Midline structures are central. No shift.`,
        extraAxial: `No subdural or epidural collection.`,
        skullBase: `Skull vault and base are intact.`,
      };
    }
    if (type === "USG") {
      return {
        liver: `Liver is normal in size (${gender === "FEMALE" ? "~13cm" : "~15cm"} span) and echogenicity. No focal lesion.`,
        gallbladder: `Gallbladder is well distended with thin wall. No calculi or polyp.`,
        pancreas: `Pancreas is normal in size and echogenicity. Duct not dilated.`,
        spleen: `Spleen is normal in size (${gender === "FEMALE" ? "~9cm" : "~10cm"}) and echogenicity.`,
        kidneyRight: `Right kidney: normal size, cortical thickness and CMD. No calculus or hydronephrosis.`,
        kidneyLeft: `Left kidney: normal size, cortical thickness and CMD. No calculus or hydronephrosis.`,
        ascites: `No free fluid in the peritoneal cavity.`,
      };
    }
    if (type === "MRI") {
      return {
        brainParenchyma: `Brain parenchyma shows normal signal intensity. No focal lesion.`,
        whiteMatter: `White matter shows normal signal. No periventricular changes.`,
        ventricles: `Ventricular system is normal in size and configuration.`,
        dwiFindings: `No diffusion restriction to suggest acute infarct.`,
      };
    }
    return { general: `Normal study for a ${base} No significant abnormality detected on ${testName}.` };
  }
}
