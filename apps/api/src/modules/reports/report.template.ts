export interface DoctorSignature {
  name: string;
  specialty?: string | null;
  signatureImageUrl?: string | null;
  signatureHtml?: string | null;
}

export interface ReportBranding {
  headerImageUrl?: string | null;
  footerImageUrl?: string | null;
  headerHtml?: string | null;
  footerHtml?: string | null;
}

export interface ReportTemplateData {
  reportNumber: string;
  generatedAt: Date;
  isSigned: boolean;
  signedBy?: { firstName: string; lastName: string } | null;
  signedAt?: Date | null;
  tenant: { name: string; config: Record<string, unknown> };
  branch: { name: string; address?: string | null; city?: string | null; state?: string | null; phone?: string | null };
  patient: {
    firstName: string;
    lastName: string;
    mrn: string;
    dob: Date;
    gender: string;
    phone: string;
    email?: string | null;
  };
  order: { orderNumber: string; createdAt: Date; priority: string };
  results: Array<{
    testName: string;
    testCode: string;
    loincCode?: string | null;
    value: string;
    numericValue?: number | null;
    unit?: string | null;
    referenceRange?: string | null;
    interpretation: string;
    deltaFlagged: boolean;
    pathologistNotes?: string | null;
    clinicalNote?: string | null;
    abnormalityNote?: string | null;
    footerNote?: string | null;
  }>;
  testSections?: Array<{
    testCode: string;
    reportTitle?: string | null;
    reportIntro?: string | null;
    reportConclusion?: string | null;
  }>;
  branding?: ReportBranding | null;
  signingDoctors?: DoctorSignature[];
}

function interpretColor(interpretation: string): string {
  if (interpretation === "CRITICAL") return "#dc2626";
  if (interpretation === "ABNORMAL") return "#d97706";
  return "#16a34a";
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(d));
}

function calcAge(dob: Date): number {
  return Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
}

function buildHeaderHtml(data: ReportTemplateData): string {
  const b = data.branding;
  const gstNumber = (data.tenant.config["gstNumber"] as string | undefined) ?? "";
  const accreditation = (data.tenant.config["labAccreditation"] as string | undefined) ?? "";

  // Priority: branding image > branding HTML > default lab name
  if (b?.headerImageUrl) {
    return `<div class="header" style="border-bottom:2px solid #0e7490;padding-bottom:10px;margin-bottom:12px;">
      <img src="${b.headerImageUrl}" style="width:100%;max-height:120px;object-fit:contain;" />
    </div>`;
  }

  if (b?.headerHtml) {
    return `<div class="header" style="border-bottom:2px solid #0e7490;padding-bottom:10px;margin-bottom:12px;">
      ${b.headerHtml}
    </div>`;
  }

  // Default header
  return `<div class="header">
    <div>
      <div class="lab-name">${data.tenant.name}</div>
      <div class="lab-sub">${data.branch.name} · ${data.branch.address ?? ""}, ${data.branch.city ?? ""}</div>
      <div class="lab-sub">${data.branch.phone ?? ""} · ${gstNumber ? "GST: " + gstNumber : ""} · ${accreditation ? accreditation + " Accredited" : ""}</div>
    </div>
    <div>
      <div class="report-title">LABORATORY REPORT</div>
      <div class="report-meta">Report No: <strong>${data.reportNumber}</strong></div>
      <div class="report-meta">Generated: ${formatDate(data.generatedAt)}</div>
      <div class="report-meta" style="margin-top:4px">
        <span class="badge ${data.isSigned ? "badge-signed" : "badge-draft"}">${data.isSigned ? "SIGNED" : "DRAFT"}</span>
      </div>
    </div>
  </div>`;
}

function buildFooterHtml(data: ReportTemplateData): string {
  const b = data.branding;

  if (b?.footerImageUrl) {
    return `<div style="border-top:1px solid #cbd5e1;padding-top:10px;margin-top:10px;">
      <img src="${b.footerImageUrl}" style="width:100%;max-height:80px;object-fit:contain;" />
    </div>`;
  }

  if (b?.footerHtml) {
    return `<div style="border-top:1px solid #cbd5e1;padding-top:10px;margin-top:10px;">
      ${b.footerHtml}
    </div>`;
  }

  return "";
}

function buildSignatureBlock(data: ReportTemplateData): string {
  const doctors = data.signingDoctors ?? [];

  if (doctors.length > 0) {
    return doctors.map((doc) => `
      <div class="sig-block">
        ${doc.signatureImageUrl
          ? `<img src="${doc.signatureImageUrl}" style="height:60px;margin:0 auto 4px;" />`
          : doc.signatureHtml
            ? doc.signatureHtml
            : `<div class="sig-line"></div>`}
        <div class="sig-name">${doc.name}</div>
        <div class="sig-title">${doc.specialty || "Pathologist"}</div>
      </div>
    `).join("");
  }

  // Fallback: use signedBy from report
  if (data.isSigned && data.signedBy) {
    return `<div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-name">Dr. ${data.signedBy.firstName} ${data.signedBy.lastName}</div>
      <div class="sig-title">Pathologist</div>
      <div class="sig-title">Signed: ${data.signedAt ? formatDate(data.signedAt) : ""}</div>
    </div>`;
  }

  return `<div class="sig-block">
    <div class="sig-line"></div>
    <div class="sig-name">Authorized Signatory</div>
    <div class="sig-title">Pathologist / Lab Director</div>
  </div>`;
}

function buildAbnormalityHtml(result: ReportTemplateData["results"][0]): string {
  if (!result.abnormalityNote || result.interpretation === "NORMAL") return "";

  try {
    const notes = JSON.parse(result.abnormalityNote) as { direction: string; reasons: string[] }[];
    let isLow = false;
    if (result.interpretation === "ABNORMAL" && result.numericValue != null && result.referenceRange) {
      const parts = result.referenceRange.split("–").map(Number);
      if (parts.length === 2 && !isNaN(parts[0]!) && result.numericValue < parts[0]!) isLow = true;
    }
    const direction = isLow ? "LOW" : "HIGH";
    const matching = notes.find((n) => n.direction === direction);
    if (!matching || matching.reasons.length === 0) return "";

    return `<div style="background:#fef3c7;border-left:3px solid #f59e0b;padding:6px 10px;margin:4px 0 8px 0;font-size:10px;color:#92400e;">
      <strong>Possible reasons for ${direction.toLowerCase()} ${result.testName}:</strong>
      <ul style="margin:2px 0 0 16px;padding:0;">${matching.reasons.slice(0, 5).map((r) => `<li>${r}</li>`).join("")}</ul>
      <em style="font-size:9px;color:#b45309;">These are general possibilities — please consult your physician for interpretation.</em>
    </div>`;
  } catch {
    return "";
  }
}

export function buildReportHtml(data: ReportTemplateData): string {
  const age = calcAge(data.patient.dob);
  const sections = data.testSections ?? [];

  // Group results by test code and add section headers
  const testCodes = [...new Set(data.results.map((r) => r.testCode))];
  let resultRows = "";

  for (const code of testCodes) {
    const section = sections.find((s) => s.testCode === code);
    const codeResults = data.results.filter((r) => r.testCode === code);

    // Section header with reportTitle
    if (section?.reportTitle) {
      resultRows += `<tr><td colspan="5" style="background:#f0f9ff;padding:8px;font-weight:700;font-size:12px;color:#0e7490;border-bottom:2px solid #0e7490;">${section.reportTitle}</td></tr>`;
    }

    // Report intro
    if (section?.reportIntro) {
      resultRows += `<tr><td colspan="5" style="padding:6px 8px;font-size:10px;color:#475569;font-style:italic;background:#f8fafc;border-bottom:1px solid #e2e8f0;">${section.reportIntro}</td></tr>`;
    }

    // Result rows
    for (const r of codeResults) {
      resultRows += `
      <tr>
        <td>${r.testName}</td>
        <td>${r.testCode}</td>
        <td style="font-weight:600">${r.value}${r.unit ? " " + r.unit : ""}</td>
        <td>${r.referenceRange ?? "—"}</td>
        <td style="color:${interpretColor(r.interpretation)};font-weight:700">${r.interpretation}${r.deltaFlagged ? " ▲" : ""}</td>
      </tr>`;

      // Abnormality reasons for out-of-range values
      const abnormalHtml = buildAbnormalityHtml(r);
      if (abnormalHtml) {
        resultRows += `<tr><td colspan="5" style="padding:0 8px;">${abnormalHtml}</td></tr>`;
      }
    }

    // Report conclusion
    if (section?.reportConclusion) {
      resultRows += `<tr><td colspan="5" style="padding:6px 8px;font-size:10px;color:#475569;background:#f8fafc;border-bottom:1px solid #cbd5e1;"><strong>Note:</strong> ${section.reportConclusion}</td></tr>`;
    }
  }

  const watermark = data.isSigned ? "" : `
    <div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);
      font-size:80px;color:rgba(0,0,0,0.07);font-weight:900;pointer-events:none;z-index:0;white-space:nowrap;">
      DRAFT
    </div>`;

  const headerSection = buildHeaderHtml(data);
  const footerSection = buildFooterHtml(data);
  const signatureSection = buildSignatureBlock(data);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Lab Report — ${data.reportNumber}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1e293b; background: #fff; }
  .page { width: 210mm; min-height: 297mm; padding: 16mm 18mm; position: relative; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0e7490; padding-bottom: 10px; margin-bottom: 12px; }
  .lab-name { font-size: 20px; font-weight: 700; color: #0e7490; }
  .lab-sub { font-size: 10px; color: #64748b; margin-top: 2px; }
  .report-title { font-size: 14px; font-weight: 700; text-align: right; color: #1e293b; }
  .report-meta { font-size: 10px; color: #64748b; text-align: right; }
  .patient-bar { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; padding: 10px 14px; margin-bottom: 14px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px 14px; }
  .pf label { font-size: 9px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
  .pf span { font-size: 11px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th { background: #0e7490; color: #fff; padding: 6px 8px; text-align: left; font-size: 11px; }
  td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; vertical-align: middle; }
  tr:nth-child(even) td { background: #f8fafc; }
  .footer { border-top: 1px solid #cbd5e1; padding-top: 10px; display: flex; justify-content: space-between; margin-top: 20px; }
  .sig-block { text-align: center; display: inline-block; margin: 0 16px; }
  .sig-line { border-top: 1px solid #1e293b; width: 160px; margin: 0 auto 4px; }
  .sig-name { font-size: 11px; font-weight: 600; }
  .sig-title { font-size: 10px; color: #64748b; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 700; }
  .badge-signed { background:#dcfce7;color:#16a34a; }
  .badge-draft { background:#fef9c3;color:#ca8a04; }
  .signatures { display: flex; justify-content: flex-end; gap: 24px; margin-top: 20px; }
</style>
</head>
<body>
${watermark}
<div class="page">
  ${headerSection}

  <div class="patient-bar">
    <div class="pf"><label>Patient Name</label><span>${data.patient.firstName} ${data.patient.lastName}</span></div>
    <div class="pf"><label>MRN</label><span>${data.patient.mrn}</span></div>
    <div class="pf"><label>Age / Gender</label><span>${age}Y / ${data.patient.gender}</span></div>
    <div class="pf"><label>Phone</label><span>${data.patient.phone}</span></div>
    <div class="pf"><label>Order No</label><span>${data.order.orderNumber}</span></div>
    <div class="pf"><label>Sample Date</label><span>${formatDate(data.order.createdAt)}</span></div>
    <div class="pf"><label>Priority</label><span>${data.order.priority}</span></div>
    <div class="pf"><label>Branch</label><span>${data.branch.name}</span></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Test Name</th>
        <th>Code</th>
        <th>Result</th>
        <th>Reference Range</th>
        <th>Interpretation</th>
      </tr>
    </thead>
    <tbody>
      ${resultRows}
    </tbody>
  </table>

  ${data.results.some((r) => r.pathologistNotes) ? `
  <div style="background:#fef3c7;border:1px solid #fbbf24;border-radius:4px;padding:8px 12px;margin-bottom:12px;font-size:11px;">
    <strong>Pathologist Notes:</strong>
    ${data.results.filter((r) => r.pathologistNotes).map((r) => `<div style="margin-top:4px"><em>${r.testName}:</em> ${r.pathologistNotes}</div>`).join("")}
  </div>` : ""}

  <div class="footer">
    <div style="font-size:10px;color:#64748b;max-width:300px">
      <strong>Disclaimer:</strong> This report is for medical use only. Results should be interpreted by a qualified healthcare professional.
    </div>
    <div class="signatures">
      ${signatureSection}
    </div>
  </div>

  ${footerSection}
</div>
</body>
</html>`;
}
