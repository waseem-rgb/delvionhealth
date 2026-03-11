import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class TokenPdfService {
  constructor(private readonly prisma: PrismaService) {}

  async generateTokenSlipHtml(tenantId: string, tokenId: string): Promise<string> {
    const token = await this.prisma.queueToken.findFirst({
      where: { id: tokenId, tenantId },
    });
    if (!token) throw new NotFoundException("Token not found");

    const issuedAt = new Date(token.createdAt).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    const deptBadge = token.departmentCode
      ? `<div class="dept-badge">${token.departmentName ?? token.departmentCode}</div>`
      : "";
    const roomLine = token.roomNumber
      ? `<p class="meta">Room: <strong>${token.roomNumber}</strong></p>`
      : "";
    const doctorLine = token.doctorName
      ? `<p class="meta">Doctor: <strong>${token.doctorName}</strong></p>`
      : "";
    const typeLine = token.investigationType && token.investigationType !== "PATHOLOGY"
      ? `<p class="meta">Type: <strong>${token.investigationType.replace(/_/g, " ")}</strong></p>`
      : "";

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f8fafc; display: flex; justify-content: center; padding: 20px; }
  .slip { width: 300px; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.15); }
  .header { background: linear-gradient(135deg, #0d9488, #0f766e); color: white; padding: 16px; text-align: center; }
  .header .logo { font-size: 13px; opacity: 0.8; margin-bottom: 2px; }
  .header h2 { font-size: 16px; font-weight: 700; }
  .body { padding: 20px 16px; text-align: center; }
  .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.15em; color: #64748b; margin-bottom: 6px; }
  .token-num { font-size: 64px; font-weight: 900; font-family: monospace; color: #0f172a; letter-spacing: 0.1em; line-height: 1; }
  .patient-name { font-size: 14px; font-weight: 600; color: #334155; margin-top: 8px; }
  .dept-badge { display: inline-block; background: #f0fdf4; color: #15803d; border: 1px solid #86efac; border-radius: 999px; font-size: 11px; font-weight: 600; padding: 3px 12px; margin-top: 8px; }
  .meta { font-size: 12px; color: #64748b; margin-top: 4px; }
  .meta strong { color: #334155; }
  .divider { border: none; border-top: 1px dashed #e2e8f0; margin: 14px 0; }
  .issued { font-size: 11px; color: #94a3b8; }
  .footer { background: #f1f5f9; padding: 10px 16px; text-align: center; font-size: 11px; color: #64748b; }
  .barcode-placeholder { font-size: 28px; letter-spacing: 4px; color: #0f172a; margin: 8px 0 4px; }
</style>
</head>
<body>
<div class="slip">
  <div class="header">
    <div class="logo">DELViON Health</div>
    <h2>Queue Token Slip</h2>
  </div>
  <div class="body">
    <p class="label">Your Token Number</p>
    <div class="token-num">${token.tokenDisplay}</div>
    <div class="patient-name">${token.patientName}</div>
    ${deptBadge}
    <hr class="divider"/>
    ${typeLine}
    ${doctorLine}
    ${roomLine}
    <div class="barcode-placeholder">|||||||||||</div>
    <p class="meta" style="font-size:10px;letter-spacing:0.05em;color:#94a3b8">${token.id.slice(-12).toUpperCase()}</p>
    <hr class="divider"/>
    <p class="issued">Issued: ${issuedAt}</p>
  </div>
  <div class="footer">
    Please wait for your number to be called.<br/>
    <strong>Do not lose this slip.</strong>
  </div>
</div>
</body>
</html>`;
  }

  async generatePdf(tenantId: string, tokenId: string): Promise<Buffer> {
    const html = await this.generateTokenSlipHtml(tenantId, tokenId);
    // Dynamic import to avoid startup overhead
    const puppeteer = await import("puppeteer");
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      const pdf = await page.pdf({
        width: "340px",
        height: "520px",
        printBackground: true,
        margin: { top: "0", right: "0", bottom: "0", left: "0" },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }
}
