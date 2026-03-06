import {
  Injectable,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

interface TrfData {
  tenant: { name: string; config: Record<string, unknown> };
  branch: {
    name: string;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  order: {
    orderNumber: string;
    createdAt: Date;
    priority: string;
    notes?: string | null;
  };
  patient: {
    firstName: string;
    lastName: string;
    mrn: string;
    dob: Date;
    gender: string;
    phone: string;
    email?: string | null;
    address?: string | null;
  };
  referringDoctor?: { name: string; specialty?: string | null; phone?: string | null } | null;
  items: Array<{
    testName: string;
    testCode: string;
    sampleType?: string | null;
    turnaroundHours: number;
    department: string;
  }>;
  samples: Array<{
    barcodeId: string;
    type: string;
    collectedAt?: Date | null;
    status: string;
  }>;
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(d));
}

function formatDateTime(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(d));
}

function calcAge(dob: Date): number {
  return Math.floor(
    (Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25),
  );
}

function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildTrfHtml(data: TrfData): string {
  const labName = escapeHtml(String((data.tenant.config as Record<string, unknown>)?.labName ?? data.tenant.name));
  const labAddress = escapeHtml(String((data.tenant.config as Record<string, unknown>)?.labAddress ?? ""));
  const accreditation = escapeHtml(String((data.tenant.config as Record<string, unknown>)?.accreditation ?? "NABL Accredited Laboratory"));
  const labPhone = escapeHtml(String((data.tenant.config as Record<string, unknown>)?.labPhone ?? data.branch.phone ?? ""));
  const labEmail = escapeHtml(String((data.tenant.config as Record<string, unknown>)?.labEmail ?? data.branch.email ?? ""));

  const age = calcAge(data.patient.dob);
  const priorityColor =
    data.order.priority === "STAT"
      ? "#dc2626"
      : data.order.priority === "URGENT"
        ? "#d97706"
        : "#16a34a";

  const testRows = data.items
    .map(
      (item, idx) => `
    <tr>
      <td style="padding: 8px 10px; border-bottom: 1px solid #e5e7eb; text-align: center; font-size: 12px;">${idx + 1}</td>
      <td style="padding: 8px 10px; border-bottom: 1px solid #e5e7eb; font-size: 12px;">
        <strong>${escapeHtml(item.testName)}</strong>
        <br/><span style="color: #6b7280; font-size: 11px;">${escapeHtml(item.testCode)}</span>
      </td>
      <td style="padding: 8px 10px; border-bottom: 1px solid #e5e7eb; font-size: 12px;">${escapeHtml(item.department)}</td>
      <td style="padding: 8px 10px; border-bottom: 1px solid #e5e7eb; font-size: 12px;">${escapeHtml(item.sampleType ?? "—")}</td>
      <td style="padding: 8px 10px; border-bottom: 1px solid #e5e7eb; text-align: center; font-size: 12px;">${item.turnaroundHours}h</td>
    </tr>`,
    )
    .join("\n");

  const sampleRows = data.samples
    .map(
      (s) => `
    <tr>
      <td style="padding: 6px 10px; border-bottom: 1px solid #e5e7eb; font-size: 12px; font-family: monospace; font-weight: bold;">${escapeHtml(s.barcodeId)}</td>
      <td style="padding: 6px 10px; border-bottom: 1px solid #e5e7eb; font-size: 12px;">${escapeHtml(s.type)}</td>
      <td style="padding: 6px 10px; border-bottom: 1px solid #e5e7eb; font-size: 12px;">${s.collectedAt ? formatDateTime(s.collectedAt) : "Pending"}</td>
      <td style="padding: 6px 10px; border-bottom: 1px solid #e5e7eb; font-size: 12px;">${escapeHtml(s.status)}</td>
    </tr>`,
    )
    .join("\n");

  const doctorSection = data.referringDoctor
    ? `
    <tr>
      <td style="padding: 6px 10px; color: #6b7280; font-size: 12px; width: 140px;">Referring Doctor</td>
      <td style="padding: 6px 10px; font-size: 12px;">
        Dr. ${escapeHtml(data.referringDoctor.name)}
        ${data.referringDoctor.specialty ? ` (${escapeHtml(data.referringDoctor.specialty)})` : ""}
        ${data.referringDoctor.phone ? ` | ${escapeHtml(data.referringDoctor.phone)}` : ""}
      </td>
    </tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    @page { size: A4; margin: 15mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1f2937; line-height: 1.4; }
  </style>
</head>
<body>

  <!-- Lab Header -->
  <div style="border-bottom: 3px solid #0D7E8A; padding-bottom: 15px; margin-bottom: 20px;">
    <table style="width: 100%;">
      <tr>
        <td style="vertical-align: top;">
          <h1 style="font-size: 22px; color: #0D7E8A; margin-bottom: 4px;">${labName}</h1>
          ${labAddress ? `<p style="font-size: 11px; color: #6b7280;">${labAddress}</p>` : ""}
          <p style="font-size: 11px; color: #6b7280;">
            ${data.branch.name}${data.branch.city ? `, ${escapeHtml(data.branch.city)}` : ""}${data.branch.state ? `, ${escapeHtml(data.branch.state)}` : ""}
          </p>
          ${labPhone ? `<p style="font-size: 11px; color: #6b7280;">Ph: ${labPhone}</p>` : ""}
          ${labEmail ? `<p style="font-size: 11px; color: #6b7280;">Email: ${labEmail}</p>` : ""}
        </td>
        <td style="vertical-align: top; text-align: right;">
          <div style="background: #0D7E8A; color: white; padding: 10px 16px; border-radius: 6px; display: inline-block;">
            <p style="font-size: 14px; font-weight: 700; letter-spacing: 1px;">TEST REQUISITION FORM</p>
          </div>
          <p style="font-size: 11px; color: #6b7280; margin-top: 8px;">${accreditation}</p>
        </td>
      </tr>
    </table>
  </div>

  <!-- Order Info Bar -->
  <table style="width: 100%; background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 6px; margin-bottom: 16px;">
    <tr>
      <td style="padding: 10px 14px;">
        <span style="font-size: 11px; color: #6b7280;">Order No.</span><br/>
        <strong style="font-size: 14px; font-family: monospace;">${escapeHtml(data.order.orderNumber)}</strong>
      </td>
      <td style="padding: 10px 14px;">
        <span style="font-size: 11px; color: #6b7280;">Order Date</span><br/>
        <strong style="font-size: 13px;">${formatDateTime(data.order.createdAt)}</strong>
      </td>
      <td style="padding: 10px 14px;">
        <span style="font-size: 11px; color: #6b7280;">Priority</span><br/>
        <strong style="font-size: 13px; color: ${priorityColor};">${escapeHtml(data.order.priority)}</strong>
      </td>
      <td style="padding: 10px 14px;">
        <span style="font-size: 11px; color: #6b7280;">Total Tests</span><br/>
        <strong style="font-size: 13px;">${data.items.length}</strong>
      </td>
    </tr>
  </table>

  <!-- Patient Details -->
  <div style="margin-bottom: 16px;">
    <h3 style="font-size: 13px; color: #0D7E8A; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; border-bottom: 1px solid #d1d5db; padding-bottom: 4px;">Patient Information</h3>
    <table style="width: 100%;">
      <tr>
        <td style="padding: 6px 10px; color: #6b7280; font-size: 12px; width: 140px;">Patient Name</td>
        <td style="padding: 6px 10px; font-size: 12px; font-weight: 600;">${escapeHtml(data.patient.firstName)} ${escapeHtml(data.patient.lastName)}</td>
        <td style="padding: 6px 10px; color: #6b7280; font-size: 12px; width: 140px;">MRN</td>
        <td style="padding: 6px 10px; font-size: 12px; font-family: monospace;">${escapeHtml(data.patient.mrn)}</td>
      </tr>
      <tr>
        <td style="padding: 6px 10px; color: #6b7280; font-size: 12px;">Age / Gender</td>
        <td style="padding: 6px 10px; font-size: 12px;">${age} yrs / ${escapeHtml(data.patient.gender)}</td>
        <td style="padding: 6px 10px; color: #6b7280; font-size: 12px;">Date of Birth</td>
        <td style="padding: 6px 10px; font-size: 12px;">${formatDate(data.patient.dob)}</td>
      </tr>
      <tr>
        <td style="padding: 6px 10px; color: #6b7280; font-size: 12px;">Phone</td>
        <td style="padding: 6px 10px; font-size: 12px;">${escapeHtml(data.patient.phone)}</td>
        <td style="padding: 6px 10px; color: #6b7280; font-size: 12px;">Email</td>
        <td style="padding: 6px 10px; font-size: 12px;">${escapeHtml(data.patient.email ?? "—")}</td>
      </tr>
      ${data.patient.address ? `
      <tr>
        <td style="padding: 6px 10px; color: #6b7280; font-size: 12px;">Address</td>
        <td colspan="3" style="padding: 6px 10px; font-size: 12px;">${escapeHtml(data.patient.address)}</td>
      </tr>` : ""}
      ${doctorSection}
    </table>
  </div>

  <!-- Tests Ordered -->
  <div style="margin-bottom: 16px;">
    <h3 style="font-size: 13px; color: #0D7E8A; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; border-bottom: 1px solid #d1d5db; padding-bottom: 4px;">Tests Ordered</h3>
    <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 6px;">
      <thead>
        <tr style="background: #f9fafb;">
          <th style="padding: 8px 10px; text-align: center; font-size: 11px; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb; width: 40px;">#</th>
          <th style="padding: 8px 10px; text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Test Name</th>
          <th style="padding: 8px 10px; text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Department</th>
          <th style="padding: 8px 10px; text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Sample Type</th>
          <th style="padding: 8px 10px; text-align: center; font-size: 11px; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">TAT</th>
        </tr>
      </thead>
      <tbody>
        ${testRows}
      </tbody>
    </table>
  </div>

  <!-- Sample / Barcode Info -->
  <div style="margin-bottom: 16px;">
    <h3 style="font-size: 13px; color: #0D7E8A; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; border-bottom: 1px solid #d1d5db; padding-bottom: 4px;">Specimen Information</h3>
    <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 6px;">
      <thead>
        <tr style="background: #f9fafb;">
          <th style="padding: 6px 10px; text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Barcode ID</th>
          <th style="padding: 6px 10px; text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Type</th>
          <th style="padding: 6px 10px; text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Collected At</th>
          <th style="padding: 6px 10px; text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${sampleRows}
      </tbody>
    </table>
  </div>

  ${data.order.notes ? `
  <!-- Special Instructions -->
  <div style="margin-bottom: 16px;">
    <h3 style="font-size: 13px; color: #0D7E8A; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; border-bottom: 1px solid #d1d5db; padding-bottom: 4px;">Special Instructions / Notes</h3>
    <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 10px 14px; font-size: 12px;">
      ${escapeHtml(data.order.notes)}
    </div>
  </div>` : ""}

  <!-- Signature Section -->
  <div style="margin-top: 30px;">
    <table style="width: 100%;">
      <tr>
        <td style="width: 50%; padding: 10px; vertical-align: bottom;">
          <div style="border-bottom: 1px solid #9ca3af; width: 200px; margin-bottom: 4px;">&nbsp;</div>
          <p style="font-size: 11px; color: #6b7280;">Collected By (Signature & Date)</p>
        </td>
        <td style="width: 50%; padding: 10px; vertical-align: bottom; text-align: right;">
          <div style="border-bottom: 1px solid #9ca3af; width: 200px; margin-bottom: 4px; display: inline-block;">&nbsp;</div>
          <p style="font-size: 11px; color: #6b7280;">Authorized By (Signature & Date)</p>
        </td>
      </tr>
    </table>
  </div>

  <!-- Footer -->
  <div style="margin-top: 20px; border-top: 1px solid #d1d5db; padding-top: 10px; text-align: center;">
    <p style="font-size: 10px; color: #9ca3af;">
      ${accreditation} | Generated on ${formatDateTime(new Date())} | ${labName}
    </p>
    <p style="font-size: 10px; color: #9ca3af; margin-top: 2px;">
      This is a computer-generated document. No signature required on the electronic copy.
    </p>
  </div>

</body>
</html>`;
}

@Injectable()
export class TrfService {
  private readonly logger = new Logger(TrfService.name);

  constructor(private readonly prisma: PrismaService) {}

  async generateTRF(orderId: string, tenantId: string): Promise<Buffer> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: {
        patient: true,
        branch: true,
        items: {
          include: {
            testCatalog: {
              select: {
                id: true,
                name: true,
                code: true,
                sampleType: true,
                turnaroundHours: true,
                department: true,
              },
            },
          },
        },
        samples: {
          select: {
            barcodeId: true,
            type: true,
            collectedAt: true,
            status: true,
          },
        },
      },
    });

    if (!order) throw new NotFoundException("Order not found");

    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { name: true, config: true },
    });

    // Look up referring doctor if ID present
    let referringDoctor: { name: string; specialty?: string | null; phone?: string | null } | null = null;
    if (order.patient.referringDoctorId) {
      const doc = await this.prisma.doctor.findFirst({
        where: { id: order.patient.referringDoctorId, tenantId },
        select: { name: true, specialty: true, phone: true },
      }).catch(() => null);
      if (doc) {
        referringDoctor = doc;
      }
    }

    const trfData: TrfData = {
      tenant: {
        name: tenant.name,
        config: tenant.config as Record<string, unknown>,
      },
      branch: {
        name: order.branch.name,
        address: order.branch.address,
        city: order.branch.city,
        state: order.branch.state,
        phone: order.branch.phone,
        email: order.branch.email,
      },
      order: {
        orderNumber: order.orderNumber,
        createdAt: order.createdAt,
        priority: order.priority,
        notes: order.notes,
      },
      patient: {
        firstName: order.patient.firstName,
        lastName: order.patient.lastName,
        mrn: order.patient.mrn,
        dob: order.patient.dob,
        gender: order.patient.gender,
        phone: order.patient.phone,
        email: order.patient.email,
        address: order.patient.address,
      },
      referringDoctor,
      items: order.items.map((item) => ({
        testName: item.testCatalog.name,
        testCode: item.testCatalog.code,
        sampleType: item.testCatalog.sampleType,
        turnaroundHours: item.testCatalog.turnaroundHours,
        department: item.testCatalog.department,
      })),
      samples: order.samples.map((s) => ({
        barcodeId: s.barcodeId,
        type: s.type,
        collectedAt: s.collectedAt,
        status: s.status,
      })),
    };

    const html = buildTrfHtml(trfData);
    const pdfBuffer = await this.renderPdf(html);
    return pdfBuffer;
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
}
