import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class QualityService {
  constructor(private readonly prisma: PrismaService) {}

  // ── PDF Rendering (same pattern as reports.service.ts) ──────────────────

  private async renderPdf(html: string): Promise<Buffer> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const puppeteer = require("puppeteer") as typeof import("puppeteer");
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      const pdf = await page.pdf({ format: "A4", printBackground: true, margin: { top: "15mm", bottom: "15mm", left: "10mm", right: "10mm" } });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  // ── Form Compliance Dashboard ──────────────────────────────────────────

  async getFormComplianceDashboard(tenantId: string) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000 - 1);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const allForms = await this.prisma.qualityForm.findMany({
      where: { tenantId, isActive: true },
    });

    const todayEntries = await this.prisma.qualityFormEntry.findMany({
      where: { tenantId, createdAt: { gte: todayStart, lte: todayEnd }, status: { not: "DRAFT" } },
      select: { formId: true, submittedAt: true, createdAt: true },
    });

    const monthEntries = await this.prisma.qualityFormEntry.findMany({
      where: { tenantId, createdAt: { gte: monthStart, lte: monthEnd }, status: { not: "DRAFT" } },
      select: { formId: true, submittedAt: true, createdAt: true },
    });

    const todaySubmittedIds = new Set(todayEntries.map((e) => e.formId));
    const monthSubmittedIds = new Set(monthEntries.map((e) => e.formId));
    const hour = now.getHours();

    const formsWithStatus = allForms.map((form) => {
      let status: "SUBMITTED" | "DUE" | "OVERDUE" | "NA" = "NA";

      if (form.frequency === "Daily") {
        status = todaySubmittedIds.has(form.id) ? "SUBMITTED" : hour >= 18 ? "OVERDUE" : "DUE";
      } else if (form.frequency === "Weekly") {
        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const hasThisWeek = monthEntries.some(
          (e) => e.formId === form.id && new Date(e.createdAt) >= weekStart
        );
        status = hasThisWeek ? "SUBMITTED" : "DUE";
      } else if (form.frequency === "Monthly") {
        status = monthSubmittedIds.has(form.id) ? "SUBMITTED" : "DUE";
      }

      const lastEntry = todayEntries.find((e) => e.formId === form.id);
      return {
        id: form.id,
        formCode: form.formCode,
        name: form.name,
        category: form.category,
        type: form.type,
        frequency: form.frequency,
        status,
        submittedAt: lastEntry?.submittedAt ?? lastEntry?.createdAt ?? null,
      };
    });

    const trackable = formsWithStatus.filter((f) => f.status !== "NA");
    const submitted = trackable.filter((f) => f.status === "SUBMITTED").length;
    const overdue = trackable.filter((f) => f.status === "OVERDUE").length;
    const due = trackable.filter((f) => f.status === "DUE").length;
    const total = trackable.length;
    const complianceRate = total > 0 ? Math.round((submitted / total) * 100) : 100;
    const missedForms = formsWithStatus.filter((f) => f.status === "OVERDUE");

    // 7-day trend
    const dailyFormCount = allForms.filter((f) => f.frequency === "Daily").length;
    const trend: { date: string; submitted: number; expected: number; missed: number; complianceRate: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(todayStart);
      day.setDate(day.getDate() - i);
      const dayEnd = new Date(day.getTime() + 86400000 - 1);
      const dayCount = await this.prisma.qualityFormEntry.count({
        where: { tenantId, createdAt: { gte: day, lte: dayEnd }, status: { not: "DRAFT" } },
      });
      trend.push({
        date: day.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        submitted: dayCount,
        expected: dailyFormCount,
        missed: Math.max(0, dailyFormCount - dayCount),
        complianceRate: dailyFormCount > 0 ? Math.round((dayCount / dailyFormCount) * 100) : 100,
      });
    }

    return {
      summary: { total, submitted, overdue, due, complianceRate },
      dailyForms: formsWithStatus.filter((f) => f.frequency === "Daily"),
      monthlyForms: formsWithStatus.filter((f) => f.frequency === "Monthly"),
      missedForms,
      trend,
    };
  }

  // ── Empty Form PDF ─────────────────────────────────────────────────────

  async generateEmptyFormPDF(formCode: string, tenantId: string): Promise<Buffer> {
    const form = await this.prisma.qualityForm.findFirst({ where: { tenantId, formCode } });
    if (!form) throw new Error(`Form template ${formCode} not found`);
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    return this.renderPdf(this.buildFormHTML({ form, tenantName: tenant?.name ?? "Laboratory", formData: null, isEmpty: true }));
  }

  // ── Filled Form PDF ────────────────────────────────────────────────────

  async generateFilledFormPDF(entryId: string, tenantId: string): Promise<Buffer> {
    const entry = await this.prisma.qualityFormEntry.findFirst({
      where: { id: entryId, tenantId },
      include: { form: true },
    });
    if (!entry) throw new Error(`Submission ${entryId} not found`);
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    return this.renderPdf(this.buildFormHTML({
      form: entry.form,
      tenantName: tenant?.name ?? "Laboratory",
      formData: entry.data as Record<string, unknown> | null,
      isEmpty: false,
      periodDate: entry.submittedAt ?? entry.createdAt,
      notes: entry.notes ?? undefined,
    }));
  }

  // ── Monthly Compliance Report PDF ──────────────────────────────────────

  async generateComplianceReportPDF(tenantId: string, month: number, year: number): Promise<Buffer> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59);
    const monthName = monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" });

    const forms = await this.prisma.qualityForm.findMany({ where: { tenantId, isActive: true } });
    const entries = await this.prisma.qualityFormEntry.findMany({
      where: { tenantId, createdAt: { gte: monthStart, lte: monthEnd }, status: { not: "DRAFT" } },
      select: { formId: true, createdAt: true },
    });

    const dailyForms = forms.filter((f) => f.frequency === "Daily");
    const daysInMonth = monthEnd.getDate();
    const expectedDaily = dailyForms.length * daysInMonth;
    const monthlyForms = forms.filter((f) => f.frequency === "Monthly");
    const totalExpected = expectedDaily + monthlyForms.length;
    const totalSubmitted = entries.length;
    const complianceRate = totalExpected > 0 ? Math.round((totalSubmitted / totalExpected) * 100) : 100;

    const dailyRows = Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1;
      const dayStart = new Date(year, month - 1, d);
      const dayEnd = new Date(year, month - 1, d, 23, 59, 59);
      const dayCount = entries.filter((e) => { const dt = new Date(e.createdAt); return dt >= dayStart && dt <= dayEnd; }).length;
      const expected = dailyForms.length;
      const missed = Math.max(0, expected - dayCount);
      const pct = expected > 0 ? Math.round((dayCount / expected) * 100) : 100;
      const dateLabel = dayStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return `<tr>
        <td style="padding:4px 8px;font-size:11px;">${dateLabel}</td>
        <td style="padding:4px 8px;"><div style="background:#e5e7eb;border-radius:4px;height:16px;width:100%;position:relative;"><div style="background:${pct >= 80 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444"};height:100%;width:${pct}%;border-radius:4px;"></div></div></td>
        <td style="padding:4px 8px;font-size:11px;text-align:center;">${pct}%</td>
        <td style="padding:4px 8px;font-size:11px;text-align:center;color:${missed > 0 ? "#ef4444" : "#22c55e"}">${missed > 0 ? missed + " missed" : "OK"}</td>
      </tr>`;
    }).join("");

    const html = `<!DOCTYPE html><html><head><style>
      body{font-family:Arial,sans-serif;color:#1e293b;margin:0;padding:20px;}
      h1{font-size:18px;margin:0;} h2{font-size:14px;color:#475569;margin:20px 0 8px;}
      table{width:100%;border-collapse:collapse;margin-bottom:16px;}
      th{background:#f1f5f9;text-align:left;padding:6px 8px;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0;}
      td{border-bottom:1px solid #f1f5f9;}
      .stat-box{display:inline-block;text-align:center;padding:12px 20px;border:1px solid #e2e8f0;border-radius:8px;margin-right:8px;}
      .stat-value{font-size:24px;font-weight:bold;} .stat-label{font-size:10px;color:#64748b;}
      .sign-block{display:inline-block;width:30%;text-align:center;}
      .sign-line{border-top:1px solid #94a3b8;margin-top:40px;padding-top:4px;font-size:10px;color:#64748b;}
    </style></head><body>
      <div style="display:flex;justify-content:space-between;border-bottom:2px solid #0d7e8a;padding-bottom:12px;margin-bottom:16px;">
        <div><h1>${tenant?.name ?? "Laboratory"}</h1><p style="font-size:11px;color:#64748b;margin:2px 0;">Monthly Forms Compliance Report</p></div>
        <div style="text-align:right;"><p style="font-size:16px;font-weight:bold;color:#0d7e8a;margin:0;">${monthName}</p><p style="font-size:10px;color:#64748b;margin:2px 0;">Generated: ${new Date().toLocaleDateString()}</p></div>
      </div>
      <div style="margin-bottom:20px;">
        <div class="stat-box"><div class="stat-value">${totalExpected}</div><div class="stat-label">Expected</div></div>
        <div class="stat-box"><div class="stat-value" style="color:#22c55e;">${totalSubmitted}</div><div class="stat-label">Submitted</div></div>
        <div class="stat-box"><div class="stat-value" style="color:#ef4444;">${Math.max(0, totalExpected - totalSubmitted)}</div><div class="stat-label">Missed</div></div>
        <div class="stat-box"><div class="stat-value" style="color:#0d7e8a;">${complianceRate}%</div><div class="stat-label">Compliance</div></div>
      </div>
      <h2>Daily Compliance Breakdown</h2>
      <table><thead><tr><th style="width:80px;">Date</th><th>Compliance</th><th style="width:60px;text-align:center;">%</th><th style="width:80px;text-align:center;">Status</th></tr></thead><tbody>${dailyRows}</tbody></table>
      <div style="margin-top:30px;border-top:1px solid #e2e8f0;padding-top:16px;">
        <div class="sign-block"><div class="sign-line">Quality Manager</div></div>
        <div class="sign-block"><div class="sign-line">Lab Director</div></div>
        <div class="sign-block"><div class="sign-line">Date</div></div>
      </div>
      <p style="font-size:9px;color:#94a3b8;text-align:center;margin-top:20px;">Prepared by QAD Team | Issued and Approved by Quality Manager</p>
    </body></html>`;

    return this.renderPdf(html);
  }

  // ── Build Form HTML (shared for empty + filled) ────────────────────────

  private buildFormHTML(opts: {
    form: { formCode: string; name: string; category: string | null; frequency: string | null };
    tenantName: string;
    formData: Record<string, unknown> | null;
    isEmpty: boolean;
    periodDate?: Date;
    notes?: string;
  }): string {
    const { form, tenantName, formData, isEmpty, periodDate, notes } = opts;
    const dateStr = periodDate ? periodDate.toLocaleDateString() : new Date().toLocaleDateString();
    const emptyCell = `<td style="height:24px;border:1px solid #cbd5e1;"></td>`;

    let bodyContent = "";
    if (form.formCode === "TECH-01") bodyContent = this.buildTempLogTable(formData, isEmpty, emptyCell);
    else if (form.formCode === "TECH-02") bodyContent = this.buildTempHumidityTable(formData, isEmpty, emptyCell);
    else if (form.formCode === "TECH-33" || form.formCode === "TECH-42") bodyContent = this.buildChecklistTable(formData, isEmpty, ["Item", "Qty Available", "Adequate", "Remarks"]);
    else if (form.formCode === "TECH-19") bodyContent = this.buildChecklistTable(formData, isEmpty, ["Item", "Qty", "Adequate", "Replenishment Needed"]);
    else bodyContent = this.buildGenericFormTable(formData, isEmpty, form.formCode);

    return `<!DOCTYPE html><html><head><style>
      body{font-family:Arial,sans-serif;color:#1e293b;margin:0;padding:20px;font-size:11px;}
      table{width:100%;border-collapse:collapse;margin-bottom:12px;}
      th,td{border:1px solid #cbd5e1;padding:4px 6px;}
      th{background:#f1f5f9;font-size:10px;color:#475569;text-align:left;}
      .oor{background:#fef2f2;color:#dc2626;font-weight:bold;}
      .sign-block{display:inline-block;width:30%;text-align:center;}
      .sign-line{border-top:1px solid #94a3b8;margin-top:40px;padding-top:4px;font-size:10px;color:#64748b;}
    </style></head><body>
      <div style="display:flex;justify-content:space-between;border-bottom:2px solid #0d7e8a;padding-bottom:8px;margin-bottom:12px;">
        <div><div style="font-size:16px;font-weight:bold;">${tenantName}</div><div style="font-size:9px;color:#64748b;">Quality Management System</div></div>
        <div style="text-align:right;"><div style="font-size:10px;color:#64748b;">Doc No: <strong>${form.formCode}</strong></div><div style="font-size:10px;color:#64748b;">Issue Date: ${dateStr}</div></div>
      </div>
      <h2 style="font-size:14px;margin:0 0 4px;">${form.name}</h2>
      <div style="font-size:10px;color:#64748b;margin-bottom:12px;">Category: ${form.category ?? "-"} | Frequency: ${form.frequency ?? "-"} | Period: ${dateStr}</div>
      ${bodyContent}
      ${notes ? `<div style="margin-top:8px;"><strong>Remarks:</strong> ${notes}</div>` : ""}
      <div style="margin-top:20px;border-top:1px solid #e2e8f0;padding-top:12px;">
        <div class="sign-block"><div class="sign-line">Prepared By</div></div>
        <div class="sign-block"><div class="sign-line">Reviewed By</div></div>
        <div class="sign-block"><div class="sign-line">Approved By</div></div>
      </div>
      <p style="font-size:8px;color:#94a3b8;text-align:center;margin-top:12px;">Prepared by QAD Team | Issued and Approved by Quality Manager</p>
    </body></html>`;
  }

  private buildTempLogTable(formData: Record<string, unknown> | null, isEmpty: boolean, emptyCell: string): string {
    const rows = (formData?.rows ?? []) as Record<string, string | number>[];
    const tableRows = Array.from({ length: 31 }, (_, i) => {
      const day = i + 1;
      if (isEmpty) return `<tr><td style="text-align:center;">${day}</td>${emptyCell}${emptyCell}<td style="height:24px;border:1px solid #cbd5e1;width:60px;"></td>${emptyCell}${emptyCell}<td style="height:24px;border:1px solid #cbd5e1;width:60px;"></td></tr>`;
      const r = rows[i] ?? {};
      const oor = (v: string | number | undefined, lo: number, hi: number) => v !== undefined && v !== "" && (Number(v) < lo || Number(v) > hi);
      return `<tr><td style="text-align:center;">${day}</td><td class="${oor(r.mFridge, 2, 8) ? "oor" : ""}">${r.mFridge ?? ""}</td><td class="${oor(r.mFreezer, -100, -15) ? "oor" : ""}">${r.mFreezer ?? ""}</td><td>${r.mStaff ?? ""}</td><td class="${oor(r.aFridge, 2, 8) ? "oor" : ""}">${r.aFridge ?? ""}</td><td class="${oor(r.aFreezer, -100, -15) ? "oor" : ""}">${r.aFreezer ?? ""}</td><td>${r.aStaff ?? ""}</td></tr>`;
    }).join("");
    return `<table><thead><tr><th rowspan="2" style="width:40px;text-align:center;">Date</th><th colspan="3" style="text-align:center;background:#dbeafe;color:#1d4ed8;">Morning</th><th colspan="3" style="text-align:center;background:#fef3c7;color:#92400e;">Afternoon</th></tr><tr><th>Fridge (°C)</th><th>Freezer (°C)</th><th>Staff Sign</th><th>Fridge (°C)</th><th>Freezer (°C)</th><th>Staff Sign</th></tr></thead><tbody>${tableRows}</tbody></table><p style="font-size:10px;color:#2563eb;">Acceptance: Fridge 2-8°C | Freezer &lt; -15°C</p>`;
  }

  private buildTempHumidityTable(formData: Record<string, unknown> | null, isEmpty: boolean, emptyCell: string): string {
    const rows = (formData?.rows ?? []) as Record<string, string | number>[];
    const tableRows = Array.from({ length: 31 }, (_, i) => {
      const day = i + 1;
      if (isEmpty) return `<tr><td style="text-align:center;">${day}</td>${emptyCell}${emptyCell}${emptyCell}<td style="height:24px;border:1px solid #cbd5e1;width:50px;"></td>${emptyCell}${emptyCell}${emptyCell}<td style="height:24px;border:1px solid #cbd5e1;width:50px;"></td></tr>`;
      const r = rows[i] ?? {};
      const oor = (v: string | number | undefined, lo: number, hi: number) => v !== undefined && v !== "" && (Number(v) < lo || Number(v) > hi);
      return `<tr><td style="text-align:center;">${day}</td><td class="${oor(r.mTemp, 15, 30) ? "oor" : ""}">${r.mTemp ?? ""}</td><td class="${oor(r.mHumidity, 10, 85) ? "oor" : ""}">${r.mHumidity ?? ""}</td><td>${r.mTime ?? ""}</td><td>${r.mStaff ?? ""}</td><td class="${oor(r.eTemp, 15, 30) ? "oor" : ""}">${r.eTemp ?? ""}</td><td class="${oor(r.eHumidity, 10, 85) ? "oor" : ""}">${r.eHumidity ?? ""}</td><td>${r.eTime ?? ""}</td><td>${r.eStaff ?? ""}</td></tr>`;
    }).join("");
    return `<table><thead><tr><th rowspan="2" style="width:40px;text-align:center;">Date</th><th colspan="4" style="text-align:center;background:#dbeafe;color:#1d4ed8;">Morning</th><th colspan="4" style="text-align:center;background:#fef3c7;color:#92400e;">Evening</th></tr><tr><th>Temp</th><th>Humidity</th><th>Time</th><th>Staff</th><th>Temp</th><th>Humidity</th><th>Time</th><th>Staff</th></tr></thead><tbody>${tableRows}</tbody></table><p style="font-size:10px;color:#2563eb;">Acceptance: Temp 15-30°C | Humidity 10-85%</p>`;
  }

  private buildChecklistTable(formData: Record<string, unknown> | null, isEmpty: boolean, columns: string[]): string {
    const items = (formData?.items ?? []) as Record<string, string>[];
    const headerCells = columns.map((c) => `<th>${c}</th>`).join("");
    const colKeys = ["item", "qty", "adequate", "remarks"];
    const bodyRows = isEmpty
      ? Array.from({ length: 15 }, () => `<tr><td style="width:24px;text-align:center;">☐</td>${columns.map(() => `<td style="height:22px;"></td>`).join("")}</tr>`).join("")
      : items.map((row) => `<tr><td style="width:24px;text-align:center;">${row.adequate === "Yes" ? "☑" : "☐"}</td>${colKeys.slice(0, columns.length).map((k) => `<td>${row[k] ?? ""}</td>`).join("")}</tr>`).join("");
    return `<table><thead><tr><th style="width:24px;">✓</th>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
  }

  private buildGenericFormTable(formData: Record<string, unknown> | null, isEmpty: boolean, formCode: string): string {
    const KNOWN_FIELDS: Record<string, string[]> = {
      "TECH-03": ["Patient ID", "Patient Name", "Test Name", "Result", "Alert Level", "Reference Range", "Clinician", "Contacted?", "Contact Time", "Informed By", "Remarks"],
      "TECH-04": ["Reagent Name", "Manufacturer", "Lot Number", "Expiry Date", "Received Date", "Verification Date", "Method", "Acceptable?", "Remarks", "Verified By"],
      "TECH-05": ["Sample ID", "Test Name", "Original Result", "Retest Result", "Reason", "Results Agree?", "Final Action", "Remarks", "Performed By"],
      "TECH-31": ["Instrument Name", "Asset ID", "Breakdown Date", "Time", "Problem", "Action Taken", "Engineer Contacted?", "Engineer", "Resolution Date", "Root Cause", "Preventive Action", "Reported By"],
      "TECH-37": ["Sample ID", "Patient Name", "Sample Type", "Rejection Reason", "Collected By", "Collection Time", "Received Time", "Recollection?", "Remarks", "Rejected By"],
      "MGT-05": ["NC Number", "Audit Date", "Department", "ISO Clause", "Description", "Root Cause", "Corrective Action", "Target Date", "Responsible Person", "Verification Remarks"],
      "MGT-08": ["Date", "Department", "NC Type", "Description", "Immediate Action", "Reported By"],
      "MGT-12": ["Month", "Quality Indicator", "Numerator", "Denominator", "Percentage", "Target", "Remarks"],
      "MGT-13": ["PA Number", "Identified Risk", "Risk Level", "Preventive Action", "Target Date", "Responsible Person", "Verification"],
      "MGT-17": ["Incident Date", "Time", "Location", "Type", "Description", "Injury Details", "Action Taken", "Reported By", "Supervisor Remarks"],
    };

    if (isEmpty || !formData) {
      const fields = KNOWN_FIELDS[formCode] ?? ["Field 1", "Field 2", "Field 3", "Field 4", "Field 5", "Remarks"];
      return `<table>${fields.map((f) => `<tr><td style="font-weight:600;width:35%;background:#f8fafc;">${f}</td><td style="height:28px;"></td></tr>`).join("")}</table>`;
    }

    const entries = Object.entries(formData).filter(([k]) => k !== "periodDate" && k !== "filledBy");
    return `<table>${entries.map(([key, value]) => {
      const label = key.replace(/([A-Z])/g, " $1").replace(/[_-]/g, " ").replace(/^\w/, (c) => c.toUpperCase()).trim();
      const displayVal = typeof value === "boolean" ? (value ? "☑ Yes" : "☐ No") : String(value ?? "");
      return `<tr><td style="font-weight:600;width:35%;background:#f8fafc;">${label}</td><td>${displayVal}</td></tr>`;
    }).join("")}</table>`;
  }

  // ── Compliance Certificates (Document Vault) ──────────────────────────

  async createCert(tenantId: string, userId: string, dto: {
    name: string; category?: string; priority?: string; certNumber?: string;
    issuingAuthority?: string; issueDate?: string; expiryDate?: string;
    renewalCycle?: string; fileUrl?: string; fileSize?: number; notes?: string;
  }) {
    return this.prisma.complianceCert.create({
      data: {
        tenantId,
        name: dto.name,
        category: dto.category,
        priority: dto.priority,
        certNumber: dto.certNumber,
        issuingAuthority: dto.issuingAuthority,
        issueDate: dto.issueDate ? new Date(dto.issueDate) : undefined,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
        renewalCycle: dto.renewalCycle,
        fileUrl: dto.fileUrl,
        fileSize: dto.fileSize,
        notes: dto.notes,
        uploadedById: userId,
      },
    });
  }

  async findCerts(tenantId: string, query: { status?: string; category?: string; page?: number; limit?: number }) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = { tenantId };
    if (query.status) where["status"] = query.status;
    if (query.category) where["category"] = query.category;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.complianceCert.findMany({ where, orderBy: { expiryDate: "asc" }, skip, take: limit }),
      this.prisma.complianceCert.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async updateCert(id: string, tenantId: string, dto: {
    status?: string; certNumber?: string; issueDate?: string; expiryDate?: string;
    fileUrl?: string; fileSize?: number; notes?: string;
  }) {
    const data: Record<string, unknown> = {};
    if (dto.status) data["status"] = dto.status;
    if (dto.certNumber) data["certNumber"] = dto.certNumber;
    if (dto.issueDate) data["issueDate"] = new Date(dto.issueDate);
    if (dto.expiryDate) data["expiryDate"] = new Date(dto.expiryDate);
    if (dto.fileUrl) data["fileUrl"] = dto.fileUrl;
    if (dto.fileSize !== undefined) data["fileSize"] = dto.fileSize;
    if (dto.notes !== undefined) data["notes"] = dto.notes;
    return this.prisma.complianceCert.update({ where: { id }, data });
  }

  async deleteCert(id: string, tenantId: string) {
    return this.prisma.complianceCert.delete({ where: { id } });
  }

  async getVaultSummary(tenantId: string) {
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const sixtyDays = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

    const [totalCerts, validCerts, expiringSoon, expired, criticalCount] = await this.prisma.$transaction([
      this.prisma.complianceCert.count({ where: { tenantId } }),
      this.prisma.complianceCert.count({ where: { tenantId, status: "VALID" } }),
      this.prisma.complianceCert.count({ where: { tenantId, expiryDate: { gte: now, lte: sixtyDays } } }),
      this.prisma.complianceCert.count({ where: { tenantId, expiryDate: { lt: now } } }),
      this.prisma.complianceCert.count({ where: { tenantId, priority: "CRITICAL" } }),
    ]);

    const upcomingRenewals = await this.prisma.complianceCert.findMany({
      where: { tenantId, expiryDate: { gte: now, lte: sixtyDays } },
      orderBy: { expiryDate: "asc" },
      take: 10,
    });

    return { totalCerts, validCerts, expiringSoon, expired, criticalCount, upcomingRenewals };
  }

  // ── Quality Forms (Form Engine) ───────────────────────────────────────

  async createForm(tenantId: string, userId: string, dto: {
    formCode: string; name: string; category?: string; type?: string;
    frequency?: string; automation?: string; description?: string; fields?: unknown;
  }) {
    return this.prisma.qualityForm.create({
      data: {
        tenantId,
        formCode: dto.formCode,
        name: dto.name,
        category: dto.category,
        type: dto.type ?? "TECHNICAL",
        frequency: dto.frequency,
        automation: dto.automation,
        description: dto.description,
        fields: dto.fields ? JSON.parse(JSON.stringify(dto.fields)) : undefined,
        createdById: userId,
      },
    });
  }

  async findForms(tenantId: string, query: { type?: string; category?: string; isActive?: boolean; page?: number; limit?: number }) {
    const { page = 1, limit = 50 } = query;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = { tenantId };
    if (query.type) where["type"] = query.type;
    if (query.category) where["category"] = query.category;
    if (query.isActive !== undefined) where["isActive"] = query.isActive;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.qualityForm.findMany({ where, orderBy: { sortOrder: "asc" }, skip, take: limit }),
      this.prisma.qualityForm.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async seedDefaultForms(tenantId: string, userId: string) {
    const existing = await this.prisma.qualityForm.count({ where: { tenantId } });
    if (existing > 0) return { seeded: false, message: "Forms already exist for this tenant" };

    const mgmtForms = [
      { formCode: "MGT-01", name: "Internal Audit Plan", category: "Audit", frequency: "Annual" },
      { formCode: "MGT-04", name: "Audit Checklist", category: "Audit", frequency: "Per Audit" },
      { formCode: "MGT-05", name: "Nonconformance Report (Audit)", category: "NCR", frequency: "Per Event" },
      { formCode: "MGT-06", name: "Internal Audit Report", category: "Audit", frequency: "Per Audit" },
      { formCode: "MGT-07", name: "Management Review", category: "Management", frequency: "Annual" },
      { formCode: "MGT-08", name: "Daily Service Nonconformance", category: "NCR", frequency: "Daily" },
      { formCode: "MGT-11", name: "Risk Assessment Format", category: "Risk", frequency: "Annual" },
      { formCode: "MGT-12", name: "Quality Indicator Format", category: "Quality", frequency: "Monthly" },
      { formCode: "MGT-13", name: "Preventive Action Form", category: "CAPA", frequency: "Per Event" },
      { formCode: "MGT-17", name: "Incident/Accident Record", category: "Incident", frequency: "Per Event" },
      { formCode: "MGT-23", name: "Annual Training Plan", category: "Training", frequency: "Annual" },
      { formCode: "MGT-27", name: "Staff Competence Assessment", category: "Training", frequency: "Annual" },
      { formCode: "MGT-31", name: "Proficiency Testing Plan", category: "PT/EQUAS", frequency: "Annual" },
    ];

    const techForms = [
      { formCode: "TECH-01", name: "Temperature Log (Fridge/Freezer)", category: "Environment", frequency: "Daily" },
      { formCode: "TECH-03", name: "Alert Value Information Format", category: "Patient Safety", frequency: "Per Event" },
      { formCode: "TECH-04", name: "New Reagent Verification", category: "Reagents", frequency: "Per Batch" },
      { formCode: "TECH-05", name: "Retest Format", category: "Testing", frequency: "Per Event" },
      { formCode: "TECH-07", name: "Equipment History Card", category: "Equipment", frequency: "Ongoing" },
      { formCode: "TECH-08", name: "ILC / Split Performance Format", category: "IQC", frequency: "Monthly" },
      { formCode: "TECH-17", name: "IQC Corrective Action Checklist", category: "IQC", frequency: "Per Event" },
      { formCode: "TECH-20", name: "EQAS Corrective Action Checklist", category: "EQUAS", frequency: "Per Round" },
      { formCode: "TECH-28", name: "IQC/EQAS/Calibrator Monitoring", category: "IQC", frequency: "Monthly" },
      { formCode: "TECH-31", name: "Instrument Breakdown Format", category: "Equipment", frequency: "Per Event" },
      { formCode: "TECH-34", name: "Precision Exercise Format", category: "IQC", frequency: "Monthly" },
      { formCode: "TECH-37", name: "Sample Rejection Format", category: "Pre-analytics", frequency: "Per Event" },
      { formCode: "TECH-42", name: "Fire Extinguisher Inspection", category: "Safety", frequency: "Monthly" },
    ];

    const allForms = [
      ...mgmtForms.map((f, i) => ({ ...f, type: "MANAGEMENT", automation: "High", sortOrder: i })),
      ...techForms.map((f, i) => ({ ...f, type: "TECHNICAL", automation: "High", sortOrder: 100 + i })),
    ];

    await this.prisma.qualityForm.createMany({
      data: allForms.map((f) => ({
        tenantId,
        formCode: f.formCode,
        name: f.name,
        category: f.category,
        type: f.type,
        frequency: f.frequency,
        automation: f.automation,
        sortOrder: f.sortOrder,
        createdById: userId,
      })),
    });

    return { seeded: true, count: allForms.length };
  }

  // ── Form Entries ──────────────────────────────────────────────────────

  async submitFormEntry(tenantId: string, userId: string, dto: { formId: string; data: unknown; notes?: string }) {
    return this.prisma.qualityFormEntry.create({
      data: {
        formId: dto.formId,
        tenantId,
        data: JSON.parse(JSON.stringify(dto.data)),
        status: "SUBMITTED",
        submittedAt: new Date(),
        notes: dto.notes,
        enteredById: userId,
      },
    });
  }

  async findFormEntries(tenantId: string, query: { formId?: string; status?: string; page?: number; limit?: number }) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = { tenantId };
    if (query.formId) where["formId"] = query.formId;
    if (query.status) where["status"] = query.status;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.qualityFormEntry.findMany({
        where, orderBy: { createdAt: "desc" }, skip, take: limit,
        include: { form: { select: { formCode: true, name: true, category: true } } },
      }),
      this.prisma.qualityFormEntry.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async reviewFormEntry(id: string, tenantId: string, userId: string, status: string) {
    return this.prisma.qualityFormEntry.update({
      where: { id },
      data: { status, reviewedById: userId, reviewedAt: new Date() },
    });
  }

  // ── Compliance Dashboard Stats ────────────────────────────────────────

  async getComplianceStats(tenantId: string) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalForms, activeForms, totalEntries, recentEntries,
      totalCerts, expiredCerts, expiringSoonCerts,
      openCAPAs, openNCs, totalAuditEntries,
    ] = await this.prisma.$transaction([
      this.prisma.qualityForm.count({ where: { tenantId } }),
      this.prisma.qualityForm.count({ where: { tenantId, isActive: true } }),
      this.prisma.qualityFormEntry.count({ where: { tenantId } }),
      this.prisma.qualityFormEntry.count({ where: { tenantId, createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.complianceCert.count({ where: { tenantId } }),
      this.prisma.complianceCert.count({ where: { tenantId, expiryDate: { lt: now } } }),
      this.prisma.complianceCert.count({ where: { tenantId, expiryDate: { gte: now, lte: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000) } } }),
      this.prisma.cAPA.count({ where: { tenantId, status: { in: ["OPEN", "IN_PROGRESS"] as never[] } } }),
      this.prisma.nonConformance.count({ where: { tenantId, status: { in: ["OPEN", "UNDER_INVESTIGATION"] } } }),
      this.prisma.qualityAuditEntry.count({ where: { tenantId, performedAt: { gte: thirtyDaysAgo } } }),
    ]);

    // Compliance score: weighted combination
    const certScore = totalCerts > 0 ? ((totalCerts - expiredCerts) / totalCerts) * 100 : 100;
    const capaScore = openCAPAs === 0 ? 100 : Math.max(0, 100 - openCAPAs * 10);
    const ncScore = openNCs === 0 ? 100 : Math.max(0, 100 - openNCs * 15);
    const complianceScore = Math.round((certScore * 0.4 + capaScore * 0.3 + ncScore * 0.3));

    return {
      complianceScore,
      totalForms,
      activeForms,
      totalEntries,
      recentEntries,
      totalCerts,
      expiredCerts,
      expiringSoonCerts,
      openCAPAs,
      openNCs,
      totalAuditEntries,
    };
  }
}
