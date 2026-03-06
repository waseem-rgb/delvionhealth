import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { RealtimeGateway } from "../realtime/realtime.gateway";
import { EmailService } from "../email/email.service";
import type { Role } from "@delvion/types";

interface NotificationPayload {
  title: string;
  body: string;
  type: string;
  entityId?: string;
  entityType?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
  ) {}

  async send(
    tenantId: string,
    userId: string,
    payload: NotificationPayload
  ): Promise<void> {
    await this.prisma.notification.create({
      data: {
        tenantId,
        userId,
        title: payload.title,
        body: payload.body,
        type: payload.type,
        metadata: {
          entityId: payload.entityId,
          entityType: payload.entityType,
        },
      },
    });

    this.realtime.emitNotification(userId, {
      title: payload.title,
      body: payload.body,
      type: payload.type,
    });
  }

  async sendToRole(
    tenantId: string,
    role: Role,
    payload: NotificationPayload
  ): Promise<void> {
    const users = await this.prisma.user.findMany({
      where: { tenantId, role, isActive: true },
      select: { id: true },
    });

    await Promise.all(users.map((u) => this.send(tenantId, u.id, payload)));
  }

  // ─── Multi-channel methods ─────────────────────────────────────────────────

  /** Send email: SendGrid (if SENDGRID_API_KEY set) → SMTP/MailHog fallback */
  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    const sendgridKey = this.config.get<string>("SENDGRID_API_KEY");
    try {
      if (sendgridKey) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const sgMail = require("@sendgrid/mail") as {
          setApiKey(key: string): void;
          send(msg: { to: string; from: string; subject: string; html: string }): Promise<unknown>;
        };
        sgMail.setApiKey(sendgridKey);
        await sgMail.send({
          to,
          from: "DELViON Health <noreply@delvion.com>",
          subject,
          html,
        });
        this.logger.log(`[SendGrid] Email sent to ${to}`);
      } else {
        await this.emailService.sendMail({ to, subject, html });
        this.logger.log(`[SMTP] Email sent to ${to}`);
      }
    } catch (err) {
      this.logger.warn(`sendEmail failed for ${to}: ${err}`);
    }
  }

  /** Send SMS: MSG91 → Twilio → stub (non-throwing, always safe to call) */
  async sendSMS(to: string, message: string): Promise<void> {
    const msg91Key = this.config.get<string>("MSG91_AUTH_KEY");
    const msg91Sender = this.config.get<string>("MSG91_SENDER_ID", "DLVION");
    const twilioSid = this.config.get<string>("TWILIO_ACCOUNT_SID");
    const twilioToken = this.config.get<string>("TWILIO_AUTH_TOKEN");
    const twilioPhone = this.config.get<string>("TWILIO_PHONE");

    try {
      if (msg91Key) {
        const url = "https://control.msg91.com/api/v5/flow/";
        const bodyPayload = {
          flow_id: this.config.get<string>("MSG91_FLOW_ID", ""),
          sender: msg91Sender,
          mobiles: to.replace(/[^0-9]/g, ""),
          VAR1: message,
        };
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", authkey: msg91Key },
          body: JSON.stringify(bodyPayload),
        });
        this.logger.log(`[MSG91] SMS sent to ${to}, status=${resp.status}`);
        return;
      }

      if (twilioSid && twilioToken && twilioPhone) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const twilio = require("twilio") as (sid: string, token: string) => {
          messages: { create(opts: { body: string; from: string; to: string }): Promise<unknown> };
        };
        const client = twilio(twilioSid, twilioToken);
        await client.messages.create({ body: message, from: twilioPhone, to });
        this.logger.log(`[Twilio] SMS sent to ${to}`);
        return;
      }

      this.logger.warn(`[SMS] No SMS provider configured — message not sent to ${to}`);
    } catch (err) {
      this.logger.warn(`sendSMS failed for ${to}: ${err}`);
    }
  }

  /** Send WhatsApp via Meta Business API → stub (non-throwing) */
  async sendWhatsApp(to: string, message: string): Promise<void> {
    const token = this.config.get<string>("WHATSAPP_TOKEN");
    const phoneNumberId = this.config.get<string>("WHATSAPP_PHONE_NUMBER_ID");

    try {
      if (token && phoneNumberId) {
        const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
        const bodyPayload = {
          messaging_product: "whatsapp",
          to: to.replace(/[^0-9]/g, ""),
          type: "text",
          text: { body: message },
        };
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(bodyPayload),
        });
        this.logger.log(`[WhatsApp] Message sent to ${to}, status=${resp.status}`);
        return;
      }

      this.logger.warn(`[WhatsApp] Not configured — message not sent to ${to}`);
    } catch (err) {
      this.logger.warn(`sendWhatsApp failed for ${to}: ${err}`);
    }
  }

  // ─── CRUD helpers ──────────────────────────────────────────────────────────

  async findAll(tenantId: string): Promise<unknown[]> {
    return this.prisma.notification.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async findForUser(tenantId: string, userId: string) {
    const notifications = await this.prisma.notification.findMany({
      where: { tenantId, userId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return { data: notifications, unreadCount: notifications.filter((n) => !n.isRead).length };
  }

  async markRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string, tenantId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, tenantId, isRead: false },
      data: { isRead: true },
    });
  }

  async getPreferences(userId: string, tenantId: string) {
    const pref = await this.prisma.notificationPreference.findUnique({ where: { userId } });
    if (pref) return pref;
    return this.prisma.notificationPreference.create({
      data: { userId, tenantId },
    });
  }

  async updatePreferences(userId: string, tenantId: string, data: Partial<{
    emailEnabled: boolean;
    smsEnabled: boolean;
    orderConfirmed: boolean;
    sampleCollected: boolean;
    reportReady: boolean;
    criticalAlert: boolean;
    paymentReceived: boolean;
  }>) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      update: data,
      create: { userId, tenantId, ...data },
    });
  }
}
