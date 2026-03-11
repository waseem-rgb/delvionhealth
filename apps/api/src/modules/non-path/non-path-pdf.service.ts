import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

interface ReportSection {
  id: string;
  label: string;
  type: string;
  subsections?: Array<{ id: string; label: string }>;
}

@Injectable()
export class NonPathPdfService {
  constructor(private readonly prisma: PrismaService) {}

  async generateReportHtml(tenantId: string, reportId: string): Promise<string> {
    const report = await this.prisma.nonPathReport.findFirst({
      where: { id: reportId, tenantId },
      include: {
        template: true,
        patient: { select: { mrn: true, firstName: true, lastName: true, dob: true, gender: true, phone: true } },
        order: {
          select: {
            orderNumber: true,
            createdAt: true,
            notes: true,
          },
        },
      },
    });
    if (!report) throw new NotFoundException("Report not found");

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, reportFooterHtml: true },
    });

    const ageYears = report.patient.dob
      ? Math.floor((Date.now() - new Date(report.patient.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : null;

    const patientAge = ageYears ? `${ageYears}Y` : "—";
    const reportDate = report.reportedAt ?? report.createdAt;
    const verifyDate = report.verifiedAt;

    // Render section data
    const sections = (report.template?.sections ?? []) as unknown as ReportSection[];
    const sectionData = (report.sectionData ?? {}) as unknown as Record<string, string>;

    let findingsHtml = "";
    if (sections.length > 0) {
      for (const section of sections) {
        if (["impression", "recommendation", "clinicalHistory", "technique"].includes(section.id)) continue;
        if (section.type === "disc_table") {
          const val = sectionData[section.id] ?? "";
          findingsHtml += `<div class="subsection"><span class="sub-label">${section.label}:</span> <span>${val || "—"}</span></div>`;
          continue;
        }
        if (section.subsections?.length) {
          findingsHtml += `<div class="section-group"><div class="section-group-title">${section.label}</div>`;
          for (const sub of section.subsections) {
            const val = sectionData[`${section.id}.${sub.id}`] ?? sectionData[sub.id] ?? "";
            findingsHtml += `<div class="subsection"><span class="sub-label">&#9658; ${sub.label}:</span> <span>${val || "—"}</span></div>`;
          }
          findingsHtml += `</div>`;
        } else {
          const val = sectionData[section.id] ?? "";
          if (val) {
            findingsHtml += `<div class="subsection"><span class="sub-label">&#9658; ${section.label}:</span> <span>${val}</span></div>`;
          }
        }
      }
    }

    // Fall back to plain findings field
    if (!findingsHtml && report.findings) {
      findingsHtml = `<p>${report.findings}</p>`;
    }

    const reportTitle = {
      "X-RAY": "RADIOLOGY REPORT",
      CT: "CT SCAN REPORT",
      MRI: "MRI REPORT",
      USG: "ULTRASOUND REPORT",
      DOPPLER: "DOPPLER STUDY REPORT",
      MOLECULAR: "MOLECULAR DIAGNOSTIC REPORT",
      GENETIC: "GENETIC REPORT",
    }[report.investigationType] ?? "INVESTIGATION REPORT";

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Times New Roman', Georgia, serif; font-size: 11pt; color: #1a1a1a; background: white; padding: 20px; }
  .page { max-width: 750px; margin: 0 auto; }

  .header { border-bottom: 3px solid #0d9488; padding-bottom: 12px; margin-bottom: 14px; }
  .header-top { display: flex; justify-content: space-between; align-items: flex-start; }
  .lab-name { font-size: 20pt; font-weight: bold; color: #0d9488; letter-spacing: 0.04em; }
  .lab-sub { font-size: 9pt; color: #555; margin-top: 2px; }
  .nabl-badge { background: #0d9488; color: white; padding: 4px 10px; border-radius: 4px; font-size: 8pt; font-weight: bold; }

  .report-title { text-align: center; font-size: 15pt; font-weight: bold; letter-spacing: 0.08em; color: #0f172a; margin: 12px 0 10px; border-top: 1px solid #ccc; border-bottom: 1px solid #ccc; padding: 6px; }

  .patient-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; font-size: 10pt; margin-bottom: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; }
  .patient-grid .row { display: flex; gap: 6px; }
  .patient-grid .lbl { color: #64748b; min-width: 110px; }
  .patient-grid .val { font-weight: 600; }

  .test-header { background: #0d9488; color: white; padding: 8px 14px; border-radius: 6px 6px 0 0; margin-bottom: 0; }
  .test-header h2 { font-size: 12pt; font-weight: bold; letter-spacing: 0.05em; }
  .test-header p { font-size: 9pt; opacity: 0.85; margin-top: 2px; }

  .section { margin: 12px 0; }
  .section-title { font-size: 10pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.06em; color: #0d9488; border-bottom: 1px solid #0d9488; padding-bottom: 3px; margin-bottom: 6px; }
  .section-content { font-size: 10.5pt; line-height: 1.6; }
  .section-group { margin: 6px 0; }
  .section-group-title { font-weight: bold; font-size: 10pt; margin-bottom: 4px; }
  .subsection { display: flex; gap: 6px; margin-bottom: 3px; font-size: 10.5pt; line-height: 1.5; }
  .sub-label { font-weight: bold; min-width: 200px; color: #334155; }

  .impression-box { border: 2px solid #0d9488; border-left: 6px solid #0d9488; border-radius: 4px; padding: 12px 14px; background: #f0fdf9; margin: 12px 0; }
  .impression-box .section-title { color: #065f46; border-color: #065f46; }
  .impression-box .section-content { font-weight: 600; font-size: 11pt; }

  .signoff { margin-top: 20px; border-top: 1px dashed #ccc; padding-top: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .signoff-block { font-size: 10pt; }
  .signoff-block .name { font-weight: bold; font-size: 11pt; }
  .signoff-block .desig { color: #555; font-size: 9.5pt; }
  .signoff-block .sig-line { border-bottom: 1px solid #333; height: 30px; margin-bottom: 4px; }

  .footer-note { margin-top: 16px; padding: 8px 12px; background: #f1f5f9; border-radius: 4px; font-size: 8.5pt; color: #64748b; text-align: center; }
  .ai-watermark { display: none; }
  @media print { .ai-watermark { display: none !important; } }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="header-top">
      <div>
        <div class="lab-name">DELViON Health</div>
        <div class="lab-sub">Diagnostics &amp; Imaging Centre | Accredited Laboratory</div>
      </div>
      <div class="nabl-badge">NABL / NABH</div>
    </div>
  </div>

  <div class="report-title">${reportTitle}</div>

  <div class="patient-grid">
    <div class="row"><span class="lbl">Patient Name:</span><span class="val">${report.patient.firstName} ${report.patient.lastName}</span></div>
    <div class="row"><span class="lbl">MRN / Reg No:</span><span class="val">${report.patient.mrn}</span></div>
    <div class="row"><span class="lbl">Age / Gender:</span><span class="val">${patientAge} / ${report.patient.gender}</span></div>
    <div class="row"><span class="lbl">Order No:</span><span class="val">${report.order.orderNumber}</span></div>
    <div class="row"><span class="lbl">Contact:</span><span class="val">${report.patient.phone ?? "—"}</span></div>
    <div class="row"><span class="lbl">Report Date:</span><span class="val">${reportDate ? new Date(reportDate).toLocaleDateString("en-IN") : new Date().toLocaleDateString("en-IN")}</span></div>
  </div>

  <div class="test-header">
    <h2>${report.testName.toUpperCase()}</h2>
    <p>Methodology: ${report.methodology}${report.equipmentUsed ? ` &nbsp;|&nbsp; Equipment: ${report.equipmentUsed}` : ""}</p>
  </div>

  ${report.clinicalHistory ? `
  <div class="section">
    <div class="section-title">Clinical History</div>
    <div class="section-content">${report.clinicalHistory}</div>
  </div>` : ""}

  ${report.technique ? `
  <div class="section">
    <div class="section-title">Technique</div>
    <div class="section-content">${report.technique}${report.contrast ? ` Contrast administered: ${report.contrastDose ?? "IV contrast given"}.` : ""}</div>
  </div>` : ""}

  <div class="section">
    <div class="section-title">Findings</div>
    <div class="section-content">
      ${findingsHtml || "<p>—</p>"}
    </div>
  </div>

  <div class="impression-box">
    <div class="section-title">Impression / Conclusion</div>
    <div class="section-content">${report.impression ?? "—"}</div>
  </div>

  ${report.recommendation ? `
  <div class="section">
    <div class="section-title">Recommendations</div>
    <div class="section-content">${report.recommendation}</div>
  </div>` : ""}

  <div class="signoff">
    <div class="signoff-block">
      <div class="sig-line"></div>
      <div class="name">${report.reportedByName ?? "Reporting Doctor"}</div>
      <div class="desig">${report.reportedByDesig ?? ""}</div>
      <div style="font-size:9pt;color:#64748b;margin-top:3px;">
        Date: ${reportDate ? new Date(reportDate).toLocaleDateString("en-IN") : "—"} &nbsp;
        Time: ${reportDate ? new Date(reportDate).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}
      </div>
    </div>
    ${report.verifiedByName ? `
    <div class="signoff-block">
      <div class="sig-line"></div>
      <div class="name">${report.verifiedByName}</div>
      <div class="desig">Verified By</div>
      <div style="font-size:9pt;color:#64748b;margin-top:3px;">
        Date: ${verifyDate ? new Date(verifyDate).toLocaleDateString("en-IN") : "—"}
      </div>
    </div>` : ""}
  </div>

  <div class="footer-note">
    *** This is a computer-generated report *** &nbsp;|&nbsp; ${tenant?.name ?? "DELViON Health"}<br/>
    For queries, contact the laboratory. This report is valid only with the authorised signature.
  </div>
</div>
</body>
</html>`;
  }

  async generatePdf(tenantId: string, reportId: string): Promise<Buffer> {
    const html = await this.generateReportHtml(tenantId, reportId);
    const puppeteer = await import("puppeteer");
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "15mm", right: "15mm", bottom: "15mm", left: "15mm" },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  async generateMergedPdf(tenantId: string, orderId: string): Promise<Buffer> {
    // Get all verified non-path reports for the order
    const reports = await this.prisma.nonPathReport.findMany({
      where: { tenantId, orderId, status: { in: ["VERIFIED", "DISPATCHED"] } },
      include: {
        patient: { select: { mrn: true, firstName: true, lastName: true, dob: true, gender: true } },
        order: { select: { orderNumber: true, createdAt: true } },
      },
      orderBy: { investigationType: "asc" },
    });

    if (reports.length === 0) throw new NotFoundException("No verified reports found for this order");

    const puppeteer = await import("puppeteer");
    const { PDFDocument } = await import("pdf-lib");

    const browser = await puppeteer.default.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
      const mergedDoc = await PDFDocument.create();

      // Cover page
      const patient = reports[0].patient;
      const ageYears = patient.dob
        ? Math.floor((Date.now() - new Date(patient.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
        : null;

      const coverHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
      <style>
        body { font-family: Arial, sans-serif; background: #f8fafc; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
        .cover { max-width: 650px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.12); }
        .cover-header { background: linear-gradient(135deg,#0d9488,#0f766e); color: white; padding: 36px; text-align: center; }
        .cover-header h1 { font-size: 26pt; margin-bottom: 4px; }
        .cover-header p { opacity: 0.8; font-size: 10pt; }
        .cover-body { padding: 32px; }
        .cover-title { font-size: 18pt; font-weight: bold; text-align: center; margin-bottom: 20px; color: #0f172a; }
        .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 11pt; }
        .info-label { color: #64748b; }
        .info-val { font-weight: 600; }
        .sections-list { margin-top: 20px; background: #f0fdf4; border-radius: 8px; padding: 16px; }
        .sections-list h3 { font-size: 11pt; color: #065f46; margin-bottom: 10px; }
        .section-item { display: flex; align-items: center; gap: 8px; padding: 6px 0; font-size: 10pt; color: #334155; }
        .section-bullet { width: 8px; height: 8px; background: #0d9488; border-radius: 50%; flex-shrink: 0; }
        .cover-footer { padding: 16px 32px; background: #f1f5f9; text-align: center; font-size: 8.5pt; color: #64748b; }
      </style></head>
      <body><div class="cover">
        <div class="cover-header">
          <h1>DELViON Health</h1>
          <p>Diagnostics &amp; Imaging Centre | Comprehensive Diagnostic Report</p>
        </div>
        <div class="cover-body">
          <div class="cover-title">COMPREHENSIVE DIAGNOSTIC REPORT</div>
          <div class="info-row"><span class="info-label">Patient Name</span><span class="info-val">${patient.firstName} ${patient.lastName}</span></div>
          <div class="info-row"><span class="info-label">MRN</span><span class="info-val">${patient.mrn}</span></div>
          <div class="info-row"><span class="info-label">Age / Gender</span><span class="info-val">${ageYears ? `${ageYears}Y` : "—"} / ${patient.gender}</span></div>
          <div class="info-row"><span class="info-label">Order Number</span><span class="info-val">${reports[0].order.orderNumber}</span></div>
          <div class="info-row"><span class="info-label">Report Generated</span><span class="info-val">${new Date().toLocaleDateString("en-IN")}</span></div>
          <div class="sections-list">
            <h3>This report contains:</h3>
            ${reports.map((r) => `<div class="section-item"><div class="section-bullet"></div>${r.testName} (${r.investigationType})</div>`).join("")}
          </div>
        </div>
        <div class="cover-footer">*** Computer-generated Comprehensive Report *** | DELViON Health Diagnostics</div>
      </div></body></html>`;

      const coverPage = await browser.newPage();
      await coverPage.setContent(coverHtml, { waitUntil: "networkidle0" });
      const coverPdfBytes = await coverPage.pdf({ format: "A4", printBackground: true });
      const coverDoc = await PDFDocument.load(coverPdfBytes);
      const coverPages = await mergedDoc.copyPages(coverDoc, coverDoc.getPageIndices());
      coverPages.forEach((p) => mergedDoc.addPage(p));

      // Each report
      for (const report of reports) {
        const reportPage = await browser.newPage();
        const html = await this.generateReportHtml(tenantId, report.id);
        await reportPage.setContent(html, { waitUntil: "networkidle0" });
        const pdfBytes = await reportPage.pdf({ format: "A4", printBackground: true, margin: { top: "15mm", right: "15mm", bottom: "15mm", left: "15mm" } });
        const doc = await PDFDocument.load(pdfBytes);
        const pages = await mergedDoc.copyPages(doc, doc.getPageIndices());
        pages.forEach((p) => mergedDoc.addPage(p));
      }

      const mergedBytes = await mergedDoc.save();
      return Buffer.from(mergedBytes);
    } finally {
      await browser.close();
    }
  }
}
