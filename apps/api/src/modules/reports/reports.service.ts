import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { MinioService } from "./minio.service";
import { RealtimeGateway } from "../realtime/realtime.gateway";
import { NotificationsService } from "../notifications/notifications.service";
import { buildReportHtml } from "./report.template";
import type { ReportTemplateData, ReportBranding, DoctorSignature } from "./report.template";
import { ReportStatus, OrderStatus, Role } from "@delvion/types";
import type { Prisma } from "@prisma/client";

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
    private readonly realtime: RealtimeGateway,
    private readonly notifications: NotificationsService
  ) {}

  // ─── Resolve report branding: org > tenant > default ──────────────

  private async resolveBranding(tenantId: string, organisationId?: string | null): Promise<ReportBranding | null> {
    // Check org branding first
    if (organisationId) {
      const org = await this.prisma.organization.findFirst({
        where: { id: organisationId, tenantId },
        select: { showHeaderFooter: true, headerImageUrl: true, footerImageUrl: true, reportHeaderHtml: true, reportFooterHtml: true },
      });
      if (org?.showHeaderFooter && (org.headerImageUrl || org.reportHeaderHtml || org.footerImageUrl || org.reportFooterHtml)) {
        return {
          headerImageUrl: org.headerImageUrl,
          footerImageUrl: org.footerImageUrl,
          headerHtml: org.reportHeaderHtml,
          footerHtml: org.reportFooterHtml,
        };
      }
    }

    // Fallback to tenant branding
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { showHeaderFooter: true, reportHeaderImageUrl: true, reportFooterImageUrl: true, reportHeaderHtml: true, reportFooterHtml: true },
    });
    if (tenant?.showHeaderFooter && (tenant.reportHeaderImageUrl || tenant.reportHeaderHtml || tenant.reportFooterImageUrl || tenant.reportFooterHtml)) {
      return {
        headerImageUrl: tenant.reportHeaderImageUrl,
        footerImageUrl: tenant.reportFooterImageUrl,
        headerHtml: tenant.reportHeaderHtml,
        footerHtml: tenant.reportFooterHtml,
      };
    }

    return null;
  }

  // ─── Resolve signing doctors for an order ─────────────────────────

  private async resolveSigningDoctors(tenantId: string): Promise<DoctorSignature[]> {
    const defaultDoctors = await this.prisma.doctor.findMany({
      where: { tenantId, isActive: true, isDefault: true },
      select: { name: true, specialty: true, signatureImageUrl: true, signatureHtml: true },
    });
    return defaultDoctors.map((d) => ({
      name: d.name,
      specialty: d.specialty,
      signatureImageUrl: d.signatureImageUrl,
      signatureHtml: d.signatureHtml,
    }));
  }

  private async generateReportNumber(tenantId: string): Promise<string> {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");

    return this.prisma.$transaction(async (tx) => {
      const count = await tx.labReport.count({
        where: {
          tenantId,
          createdAt: {
            gte: new Date(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}T00:00:00.000Z`),
          },
        },
      });
      const seq = String(count + 1).padStart(4, "0");
      return `DH-RPT-${dateStr}-${seq}`;
    });
  }

  private async renderPdf(html: string): Promise<Buffer> {
    // Lazy require to avoid crash if binary not present in dev
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const puppeteer = require("puppeteer") as typeof import("puppeteer");
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      const pdf = await page.pdf({ format: "A4", printBackground: true });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  async generateReport(orderId: string, tenantId: string, userId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: {
        patient: true,
        branch: true,
        items: {
          include: {
            testCatalog: {
              select: {
                id: true, name: true, code: true, loincCode: true,
                reportTitle: true, reportIntro: true, reportConclusion: true,
              },
            },
            testResults: {
              where: { tenantId },
              orderBy: { createdAt: "desc" },
              take: 1,
              include: {
                validatedBy: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
      },
    });

    if (!order) throw new NotFoundException("Order not found");

    // Ensure all items have at least one result
    const unresulted = order.items.filter((i) => i.testResults.length === 0);
    if (unresulted.length > 0) {
      throw new BadRequestException(
        `${unresulted.length} test(s) have no results yet`
      );
    }

    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { name: true, config: true },
    });

    const reportNumber = await this.generateReportNumber(tenantId);

    // Fetch parameter-level clinical notes for abnormality display
    const testCatalogIds = [...new Set(order.items.map((i) => i.testCatalogId))];
    const paramNotes = await this.prisma.reportParameter.findMany({
      where: { testCatalogId: { in: testCatalogIds }, isActive: true },
      select: { testCatalogId: true, name: true, clinicalNote: true, abnormalityNote: true, footerNote: true },
    });
    const paramNotesMap = new Map(paramNotes.map((p) => [`${p.testCatalogId}:${p.name}`, p]));

    const results: ReportTemplateData["results"] = order.items.map((item) => {
      const r = item.testResults[0]!;
      const pNote = paramNotesMap.get(`${item.testCatalogId}:${r.flags ?? r.value}`);
      return {
        testName: item.testCatalog.name,
        testCode: item.testCatalog.code,
        loincCode: item.testCatalog.loincCode,
        value: r.value,
        numericValue: r.numericValue,
        unit: r.unit,
        referenceRange: r.referenceRange,
        interpretation: r.interpretation,
        deltaFlagged: r.deltaFlagged,
        pathologistNotes: r.pathologistNotes,
        clinicalNote: pNote?.clinicalNote ?? null,
        abnormalityNote: pNote?.abnormalityNote ?? null,
        footerNote: pNote?.footerNote ?? null,
      };
    });

    const testSections: ReportTemplateData["testSections"] = [...new Set(order.items.map((i) => i.testCatalog.code))].map((code) => {
      const item = order.items.find((i) => i.testCatalog.code === code)!;
      return {
        testCode: code,
        reportTitle: item.testCatalog.reportTitle ?? null,
        reportIntro: item.testCatalog.reportIntro ?? null,
        reportConclusion: item.testCatalog.reportConclusion ?? null,
      };
    });

    const templateData: ReportTemplateData = {
      reportNumber,
      generatedAt: new Date(),
      isSigned: false,
      tenant: { name: tenant.name, config: tenant.config as Record<string, unknown> },
      branch: {
        name: order.branch.name,
        address: order.branch.address,
        city: order.branch.city,
        state: order.branch.state,
        phone: order.branch.phone,
      },
      patient: {
        firstName: order.patient.firstName,
        lastName: order.patient.lastName,
        mrn: order.patient.mrn,
        dob: order.patient.dob,
        gender: order.patient.gender,
        phone: order.patient.phone,
        email: order.patient.email,
      },
      order: {
        orderNumber: order.orderNumber,
        createdAt: order.createdAt,
        priority: order.priority,
      },
      results,
      testSections,
      branding: await this.resolveBranding(tenantId, order.organizationId),
      signingDoctors: await this.resolveSigningDoctors(tenantId),
    };

    let html = buildReportHtml(templateData);

    // ── Inject Test Notes (Clinical Legends) ──
    const testNotesSections: string[] = [];
    const uniqueTestIds = [...new Set(order.items.map((i) => i.testCatalogId))];
    for (const tcId of uniqueTestIds) {
      const notes = await this.prisma.testNote.findFirst({
        where: { testCatalogId: tcId, tenantId },
      });
      if (notes) {
        const noteRows = [
          notes.highValueNote && `<tr><td style="padding:2px 8px 2px 0;font-weight:bold;white-space:nowrap;vertical-align:top;color:#6b7280;width:130px;">Elevated values:</td><td>${notes.highValueNote}</td></tr>`,
          notes.lowValueNote && `<tr><td style="padding:2px 8px 2px 0;font-weight:bold;white-space:nowrap;vertical-align:top;color:#6b7280;">Reduced values:</td><td>${notes.lowValueNote}</td></tr>`,
          notes.ageNote && `<tr><td style="padding:2px 8px 2px 0;font-weight:bold;white-space:nowrap;vertical-align:top;color:#6b7280;">Age note:</td><td>${notes.ageNote}</td></tr>`,
          notes.pregnancyNote && `<tr><td style="padding:2px 8px 2px 0;font-weight:bold;white-space:nowrap;vertical-align:top;color:#6b7280;">Pregnancy:</td><td>${notes.pregnancyNote}</td></tr>`,
          notes.fastingNote && `<tr><td style="padding:2px 8px 2px 0;font-weight:bold;white-space:nowrap;vertical-align:top;color:#6b7280;">Fasting:</td><td>${notes.fastingNote}</td></tr>`,
          notes.interferenceNote && `<tr><td style="padding:2px 8px 2px 0;font-weight:bold;white-space:nowrap;vertical-align:top;color:#6b7280;">Interferences:</td><td>${notes.interferenceNote}</td></tr>`,
          notes.criticalValueNote && `<tr><td style="padding:2px 8px 2px 0;font-weight:bold;white-space:nowrap;vertical-align:top;color:#dc2626;">Critical values:</td><td style="color:#dc2626;">${notes.criticalValueNote}</td></tr>`,
          notes.generalNote && `<tr><td style="padding:2px 8px 2px 0;font-weight:bold;white-space:nowrap;vertical-align:top;color:#6b7280;">Note:</td><td>${notes.generalNote}</td></tr>`,
        ].filter(Boolean).join("");

        if (noteRows) {
          testNotesSections.push(noteRows);
        }
      }
    }

    if (testNotesSections.length) {
      const notesHtml = `<div style="margin-top:16px;padding:12px 14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;page-break-inside:avoid;">
  <p style="font-size:7.5pt;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;color:#6b7280;margin-bottom:6px;">Clinical Notes</p>
  <table style="width:100%;border-collapse:collapse;font-size:8pt;color:#374151;line-height:1.5;">${testNotesSections.join("")}</table>
</div>`;
      // Insert before closing </div></body>
      html = html.replace("</div>\n</body>", `${notesHtml}\n</div>\n</body>`);
    }

    // ── Inject Smart Report (abnormal params appendix) ──
    try {
      const smartSettings = await this.prisma.smartReportSettings.findFirst({ where: { tenantId } });
      if (smartSettings?.enabled !== false) {
        const abnormalResults = results.filter(
          (r) => r.interpretation === "ABNORMAL" || r.interpretation === "CRITICAL",
        );
        if (abnormalResults.length > 0) {
          const { SmartReportService } = await import("../smart-report/smart-report.service");
          // Use dynamic resolution since we can't inject across modules easily
          const smartSvc = new SmartReportService(this.prisma);
          const patientAge = Math.floor(
            (Date.now() - new Date(order.patient.dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25),
          );
          const { smartReportHtml } = await smartSvc.generateSmartReport(
            abnormalResults.map((r) => ({
              name: r.testName,
              value: r.value,
              unit: r.unit ?? "",
              referenceRange: r.referenceRange ?? "",
              flag: r.interpretation,
              testName: r.testName,
            })),
            patientAge,
            order.patient.gender,
            tenantId,
          );
          if (smartReportHtml) {
            html = html.replace("</body>", `${smartReportHtml}\n</body>`);
          }
        }
      }
    } catch (err) {
      this.logger.warn(`Smart report injection skipped: ${err instanceof Error ? err.message : String(err)}`);
    }

    const pdfBuffer = await this.renderPdf(html);
    const objectKey = `reports/${tenantId}/${reportNumber}.pdf`;
    await this.minio.upload(objectKey, pdfBuffer, "application/pdf");

    const report = await this.prisma.labReport.upsert({
      where: { tenantId_reportNumber: { tenantId, reportNumber } },
      create: {
        tenantId,
        orderId,
        reportNumber,
        status: ReportStatus.GENERATED,
        pdfUrl: objectKey,
      },
      update: {
        status: ReportStatus.GENERATED,
        pdfUrl: objectKey,
      },
    });

    // Update order status to REPORTED
    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.RESULTED },
    });

    this.realtime.emitOrderUpdate(tenantId, {
      orderId,
      orderNumber: order.orderNumber,
      status: OrderStatus.RESULTED,
    });

    return report;
  }

  async signReport(reportId: string, tenantId: string, userId: string) {
    const report = await this.prisma.labReport.findFirst({
      where: { id: reportId, tenantId },
      include: {
        order: {
          include: {
            patient: true,
            branch: true,
            items: {
              include: {
                testCatalog: {
                  select: {
                    id: true, name: true, code: true, loincCode: true,
                    reportTitle: true, reportIntro: true, reportConclusion: true,
                  },
                },
                testResults: {
                  where: { tenantId },
                  orderBy: { createdAt: "desc" },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    if (!report) throw new NotFoundException("Report not found");

    const signedBy = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });

    const now = new Date();

    // Regenerate PDF with signature
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { name: true, config: true },
    });

    const results: ReportTemplateData["results"] = report.order.items.map((item) => {
      const r = item.testResults[0]!;
      return {
        testName: item.testCatalog.name,
        testCode: item.testCatalog.code,
        loincCode: item.testCatalog.loincCode,
        value: r.value,
        numericValue: r.numericValue,
        unit: r.unit,
        referenceRange: r.referenceRange,
        interpretation: r.interpretation,
        deltaFlagged: r.deltaFlagged,
        pathologistNotes: r.pathologistNotes,
      };
    });

    const signTestSections: ReportTemplateData["testSections"] = [...new Set(report.order.items.map((i) => i.testCatalog.code))].map((code) => {
      const item = report.order.items.find((i) => i.testCatalog.code === code)!;
      return {
        testCode: code,
        reportTitle: item.testCatalog.reportTitle ?? null,
        reportIntro: item.testCatalog.reportIntro ?? null,
        reportConclusion: item.testCatalog.reportConclusion ?? null,
      };
    });

    const html = buildReportHtml({
      reportNumber: report.reportNumber,
      generatedAt: report.createdAt,
      isSigned: true,
      signedBy,
      signedAt: now,
      tenant: { name: tenant.name, config: tenant.config as Record<string, unknown> },
      branch: {
        name: report.order.branch.name,
        address: report.order.branch.address,
        city: report.order.branch.city,
        state: report.order.branch.state,
        phone: report.order.branch.phone,
      },
      patient: {
        firstName: report.order.patient.firstName,
        lastName: report.order.patient.lastName,
        mrn: report.order.patient.mrn,
        dob: report.order.patient.dob,
        gender: report.order.patient.gender,
        phone: report.order.patient.phone,
        email: report.order.patient.email,
      },
      order: {
        orderNumber: report.order.orderNumber,
        createdAt: report.order.createdAt,
        priority: report.order.priority,
      },
      results,
      testSections: signTestSections,
      branding: await this.resolveBranding(tenantId, report.order.organizationId),
      signingDoctors: await this.resolveSigningDoctors(tenantId),
    });

    const pdfBuffer = await this.renderPdf(html);
    const objectKey = report.pdfUrl ?? `reports/${tenantId}/${report.reportNumber}.pdf`;
    await this.minio.upload(objectKey, pdfBuffer, "application/pdf");

    const updated = await this.prisma.labReport.update({
      where: { id: reportId },
      data: {
        status: ReportStatus.SIGNED,
        signedById: userId,
        signedAt: now,
        pdfUrl: objectKey,
      },
    });

    await this.notifications.sendToRole(tenantId, Role.FRONT_DESK, {
      title: "Report Signed",
      body: `Report ${report.reportNumber} has been signed by Dr. ${signedBy.firstName} ${signedBy.lastName}`,
      type: "REPORT_SIGNED",
      entityId: reportId,
      entityType: "LabReport",
    });

    return updated;
  }

  async deliverReport(reportId: string, tenantId: string, userId: string) {
    const report = await this.prisma.labReport.findFirst({
      where: { id: reportId, tenantId },
    });
    if (!report) throw new NotFoundException("Report not found");

    const now = new Date();
    const updated = await this.prisma.labReport.update({
      where: { id: reportId },
      data: {
        status: ReportStatus.DELIVERED,
        deliveredAt: now,
        reportedAt: now,
      },
    });

    // Update order status to REPORTED
    await this.prisma.order.update({
      where: { id: report.orderId },
      data: { status: OrderStatus.REPORTED },
    });

    // Email patient: report ready
    this.prisma.order.findUnique({
      where: { id: report.orderId },
      include: { patient: { select: { email: true, firstName: true } } },
    }).then(async (order) => {
      if (order?.patient?.email) {
        const downloadUrl = updated.pdfUrl ?? "#";
        await this.notifications.sendEmail(
          order.patient.email,
          "Your Lab Report is Ready – DELViON Health",
          `<p>Dear ${order.patient.firstName},</p>
           <p>Your lab report is ready. You can download it from the patient portal or click below:</p>
           <p><a href="${downloadUrl}" style="background:#0D7E8A;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">Download Report</a></p>
           <p>— DELViON Health</p>`,
        ).catch(() => {});
      }
    }).catch(() => {});

    return updated;
  }

  async getDownloadUrl(reportId: string, tenantId: string): Promise<{ url: string }> {
    const report = await this.prisma.labReport.findFirst({
      where: { id: reportId, tenantId },
      select: { pdfUrl: true },
    });
    if (!report?.pdfUrl) throw new NotFoundException("Report PDF not found");

    const url = await this.minio.getPresignedUrl(report.pdfUrl, 3600);
    return { url };
  }

  async findAll(tenantId: string, query?: { status?: string; orderId?: string; page?: number; limit?: number }) {
    const page = query?.page ?? 1;
    const limit = Math.min(query?.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.LabReportWhereInput = {
      tenantId,
      ...(query?.status && { status: query.status as ReportStatus }),
      ...(query?.orderId && { orderId: query.orderId }),
    };

    const [reports, total] = await Promise.all([
      this.prisma.labReport.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
            },
          },
          signedBy: { select: { firstName: true, lastName: true } },
        },
      }),
      this.prisma.labReport.count({ where }),
    ]);

    return {
      data: reports,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(reportId: string, tenantId: string) {
    const report = await this.prisma.labReport.findFirst({
      where: { id: reportId, tenantId },
      include: {
        order: {
          include: {
            patient: { select: { firstName: true, lastName: true, mrn: true } },
          },
        },
        signedBy: { select: { firstName: true, lastName: true } },
      },
    });
    if (!report) throw new NotFoundException("Report not found");
    return report;
  }
}
