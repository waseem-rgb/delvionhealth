import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { MinioService } from "./minio.service";
import { NotificationsService } from "../notifications/notifications.service";

type DispatchChannel = "EMAIL" | "SMS" | "WHATSAPP";
type DispatchStatus = "NOT_SENT" | "SENT" | "DELIVERED" | "FAILED";

@Injectable()
export class ReportDispatchService {
  private readonly logger = new Logger(ReportDispatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
    private readonly notifications: NotificationsService,
  ) {}

  // ─── Dispatch report to multiple channels ──────────────────────────────────

  async dispatchReport(
    reportId: string,
    tenantId: string,
    channels: DispatchChannel[],
  ) {
    const report = await this.prisma.labReport.findFirst({
      where: { id: reportId, tenantId },
      include: {
        order: {
          include: {
            patient: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    if (!report) throw new NotFoundException("Report not found");
    if (!report.pdfUrl) {
      throw new BadRequestException("Report PDF has not been generated yet");
    }

    const patient = report.order.patient;
    const orderNumber = report.order.orderNumber;
    const patientName = `${patient.firstName} ${patient.lastName}`;

    // Generate presigned URL for 7 days (604800 seconds)
    const reportUrl = await this.generateReportUrl(reportId, tenantId);

    // Download the PDF buffer for email attachment
    let pdfBuffer: Buffer | null = null;
    if (channels.includes("EMAIL")) {
      try {
        pdfBuffer = await this.downloadPdf(report.pdfUrl);
      } catch (err) {
        this.logger.warn(`Failed to download PDF for email attachment: ${err}`);
      }
    }

    const results: Array<{
      channel: DispatchChannel;
      status: DispatchStatus;
      dispatchId: string;
    }> = [];

    for (const channel of channels) {
      let status: DispatchStatus = "FAILED";
      let failReason: string | null = null;
      let messageId: string | null = null;

      try {
        switch (channel) {
          case "EMAIL": {
            if (!patient.email) {
              failReason = "Patient has no email address on file";
              break;
            }
            await this.sendViaEmail(
              patient.email,
              pdfBuffer,
              patientName,
              orderNumber,
              reportUrl,
            );
            status = "SENT";
            break;
          }
          case "SMS": {
            if (!patient.phone) {
              failReason = "Patient has no phone number on file";
              break;
            }
            await this.sendViaSMS(
              patient.phone,
              patientName,
              orderNumber,
              reportUrl,
            );
            status = "SENT";
            break;
          }
          case "WHATSAPP": {
            if (!patient.phone) {
              failReason = "Patient has no phone number on file";
              break;
            }
            await this.sendViaWhatsApp(
              patient.phone,
              patientName,
              orderNumber,
            );
            status = "SENT";
            break;
          }
          default:
            failReason = `Unsupported channel: ${channel}`;
        }
      } catch (err) {
        status = "FAILED";
        failReason = String(err);
        this.logger.warn(`Dispatch via ${channel} failed: ${err}`);
      }

      const recipient =
        channel === "EMAIL"
          ? (patient.email ?? "")
          : (patient.phone ?? "");

      const dispatch = await this.prisma.reportDispatch.create({
        data: {
          reportId,
          tenantId,
          channel,
          recipient,
          status,
          sentAt: status === "SENT" ? new Date() : null,
          failedAt: status === "FAILED" ? new Date() : null,
          failReason,
          messageId,
        },
      });

      results.push({ channel, status, dispatchId: dispatch.id });
    }

    // Update report dispatch status
    const allSent = results.every((r) => r.status === "SENT");
    const anySent = results.some((r) => r.status === "SENT");

    await this.prisma.labReport.update({
      where: { id: reportId },
      data: {
        dispatchStatus: allSent ? "SENT" : anySent ? "SENT" : "FAILED",
        dispatchedAt: anySent ? new Date() : undefined,
      },
    });

    return {
      reportId,
      dispatches: results,
      overallStatus: allSent ? "SENT" : anySent ? "PARTIALLY_SENT" : "FAILED",
    };
  }

  // ─── Send via Email ────────────────────────────────────────────────────────

  private async sendViaEmail(
    to: string,
    pdfBuffer: Buffer | null,
    patientName: string,
    orderNumber: string,
    reportUrl: string,
  ): Promise<void> {
    const subject = `Your Lab Report is Ready - ${orderNumber}`;
    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0D7E8A; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 22px;">DELViON Health</h1>
        </div>
        <div style="padding: 30px 20px; background: #ffffff; border: 1px solid #e5e7eb;">
          <p style="font-size: 16px;">Dear ${patientName},</p>
          <p>Your lab report for order <strong>${orderNumber}</strong> is now ready.</p>
          <p>You can download your report by clicking the button below. The link is valid for 7 days.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${reportUrl}"
               style="background: #0D7E8A; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
              Download Report
            </a>
          </div>
          <p style="color: #6b7280; font-size: 13px;">
            You can also view your report in the DELViON Health patient portal.
          </p>
        </div>
        <div style="padding: 15px; text-align: center; color: #9ca3af; font-size: 12px;">
          <p>This is an automated message from DELViON Health. Please do not reply.</p>
        </div>
      </div>
    `;

    await this.notifications.sendEmail(to, subject, html);
    this.logger.log(`Report email dispatched to ${to} for ${orderNumber}`);
  }

  // ─── Send via SMS ──────────────────────────────────────────────────────────

  private async sendViaSMS(
    phone: string,
    patientName: string,
    orderNumber: string,
    reportUrl: string,
  ): Promise<void> {
    const message = `DELViON Health: Dear ${patientName}, your lab report (${orderNumber}) is ready. Download: ${reportUrl} (valid 7 days)`;
    await this.notifications.sendSMS(phone, message);
    this.logger.log(`Report SMS dispatched to ${phone} for ${orderNumber}`);
  }

  // ─── Send via WhatsApp ─────────────────────────────────────────────────────

  private async sendViaWhatsApp(
    phone: string,
    patientName: string,
    orderNumber: string,
  ): Promise<void> {
    const message = `Hello ${patientName}, your lab report for order ${orderNumber} is now ready. Please visit the DELViON Health patient portal to view and download your report.`;
    await this.notifications.sendWhatsApp(phone, message);
    this.logger.log(`Report WhatsApp dispatched to ${phone} for ${orderNumber}`);
  }

  // ─── Generate presigned URL valid 7 days ───────────────────────────────────

  async generateReportUrl(
    reportId: string,
    tenantId: string,
  ): Promise<string> {
    const report = await this.prisma.labReport.findFirst({
      where: { id: reportId, tenantId },
      select: { pdfUrl: true },
    });
    if (!report?.pdfUrl) throw new NotFoundException("Report PDF not found");

    // 7 days = 604800 seconds
    return this.minio.getPresignedUrl(report.pdfUrl, 604800);
  }

  // ─── Download PDF buffer from MinIO ────────────────────────────────────────

  private async downloadPdf(objectKey: string): Promise<Buffer> {
    // Get a presigned URL and fetch the PDF
    const url = await this.minio.getPresignedUrl(objectKey, 300);
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`Failed to download PDF: ${resp.status}`);
    }
    const arrayBuffer = await resp.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  // ─── Get dispatch history for a report ─────────────────────────────────────

  async getDispatchHistory(reportId: string, tenantId: string) {
    const report = await this.prisma.labReport.findFirst({
      where: { id: reportId, tenantId },
      select: { id: true },
    });
    if (!report) throw new NotFoundException("Report not found");

    const dispatches = await this.prisma.reportDispatch.findMany({
      where: { reportId, tenantId },
      orderBy: { createdAt: "desc" },
    });

    return { data: dispatches };
  }

  // ─── Retry a failed dispatch ───────────────────────────────────────────────

  async retryFailedDispatch(dispatchId: string, tenantId: string) {
    const dispatch = await this.prisma.reportDispatch.findFirst({
      where: { id: dispatchId, tenantId },
      include: {
        report: {
          include: {
            order: {
              include: {
                patient: {
                  select: {
                    firstName: true,
                    lastName: true,
                    email: true,
                    phone: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!dispatch) throw new NotFoundException("Dispatch record not found");
    if (dispatch.status !== "FAILED") {
      throw new BadRequestException("Only failed dispatches can be retried");
    }

    const report = dispatch.report;
    const patient = report.order.patient;
    const orderNumber = report.order.orderNumber;
    const patientName = `${patient.firstName} ${patient.lastName}`;

    let newStatus: DispatchStatus = "FAILED";
    let failReason: string | null = null;

    try {
      const reportUrl = await this.generateReportUrl(report.id, tenantId);

      switch (dispatch.channel) {
        case "EMAIL": {
          if (!patient.email) {
            failReason = "Patient has no email address on file";
            break;
          }
          let pdfBuffer: Buffer | null = null;
          if (report.pdfUrl) {
            pdfBuffer = await this.downloadPdf(report.pdfUrl).catch(() => null);
          }
          await this.sendViaEmail(
            patient.email,
            pdfBuffer,
            patientName,
            orderNumber,
            reportUrl,
          );
          newStatus = "SENT";
          break;
        }
        case "SMS": {
          if (!patient.phone) {
            failReason = "Patient has no phone number on file";
            break;
          }
          await this.sendViaSMS(patient.phone, patientName, orderNumber, reportUrl);
          newStatus = "SENT";
          break;
        }
        case "WHATSAPP": {
          if (!patient.phone) {
            failReason = "Patient has no phone number on file";
            break;
          }
          await this.sendViaWhatsApp(patient.phone, patientName, orderNumber);
          newStatus = "SENT";
          break;
        }
        default:
          failReason = `Unsupported channel: ${dispatch.channel}`;
      }
    } catch (err) {
      newStatus = "FAILED";
      failReason = String(err);
      this.logger.warn(`Retry dispatch via ${dispatch.channel} failed: ${err}`);
    }

    const updated = await this.prisma.reportDispatch.update({
      where: { id: dispatchId },
      data: {
        status: newStatus,
        sentAt: newStatus === "SENT" ? new Date() : undefined,
        failedAt: newStatus === "FAILED" ? new Date() : undefined,
        failReason,
      },
    });

    // Recalculate overall report dispatch status
    if (newStatus === "SENT") {
      const allDispatches = await this.prisma.reportDispatch.findMany({
        where: { reportId: report.id },
        select: { status: true },
      });
      const allSent = allDispatches.every((d) => d.status === "SENT" || d.status === "DELIVERED");
      if (allSent) {
        await this.prisma.labReport.update({
          where: { id: report.id },
          data: {
            dispatchStatus: "SENT",
            dispatchedAt: new Date(),
          },
        });
      }
    }

    return updated;
  }
}
