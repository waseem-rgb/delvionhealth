import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(private readonly prisma: PrismaService) {}

  async registerToken(userId: string, token: string, platform: string) {
    return this.prisma.pushToken.upsert({
      where: { userId_token: { userId, token } },
      create: { userId, token, platform, isActive: true },
      update: { isActive: true, platform, updatedAt: new Date() },
    });
  }

  async deactivateToken(token: string) {
    await this.prisma.pushToken.updateMany({
      where: { token },
      data: { isActive: false },
    });
  }

  async getTokensForUsers(userIds: string[]): Promise<string[]> {
    if (!userIds.length) return [];
    const tokens = await this.prisma.pushToken.findMany({
      where: { userId: { in: userIds }, isActive: true },
      select: { token: true },
    });
    return tokens.map((t) => t.token);
  }

  async sendPush(params: {
    userIds: string[];
    title: string;
    body: string;
    data?: Record<string, unknown>;
    channel?: 'default' | 'critical' | 'reports' | 'samples';
    badge?: number;
  }): Promise<void> {
    const tokens = await this.getTokensForUsers(params.userIds);
    if (!tokens.length) return;

    const expoTokens = tokens.filter(
      (t) => t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken['),
    );
    if (!expoTokens.length) return;

    const chunks: string[][] = [];
    for (let i = 0; i < expoTokens.length; i += 100) {
      chunks.push(expoTokens.slice(i, i + 100));
    }

    for (const chunk of chunks) {
      const messages = chunk.map((token) => ({
        to: token,
        sound: 'default',
        title: params.title,
        body: params.body,
        data: params.data ?? {},
        channelId: params.channel ?? 'default',
        badge: params.badge,
        priority: params.channel === 'critical' ? 'high' : 'normal',
        ttl: 86400,
      }));

      try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(messages),
        });

        const result = (await response.json()) as {
          data?: Array<{
            status: string;
            details?: { error?: string };
            message?: string;
          }>;
        };
        const tickets = result.data ?? [];

        for (let i = 0; i < tickets.length; i++) {
          const ticket = tickets[i];
          if (!ticket) continue;
          const tokenForTicket = chunk[i] ?? '';
          if (ticket.status === 'error') {
            if (ticket.details?.error === 'DeviceNotRegistered') {
              await this.deactivateToken(tokenForTicket);
            } else {
              this.logger.error(
                `Push error for token ${tokenForTicket}: ${ticket.message ?? 'unknown'}`,
              );
            }
          }
        }

        this.logger.log(
          `Push sent: "${params.title}" → ${chunk.length} devices`,
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Expo push API error: ${msg}`);
      }
    }
  }

  async notifyOrderConfirmed(
    patientUserId: string,
    orderNumber: string,
  ): Promise<void> {
    await this.sendPush({
      userIds: [patientUserId],
      title: '✅ Order Confirmed',
      body: `Your order ${orderNumber} has been confirmed.`,
      data: { type: 'ORDER_CONFIRMED', orderNumber },
      channel: 'default',
    });
  }

  async notifySampleCollected(
    patientUserId: string,
    orderNumber: string,
  ): Promise<void> {
    await this.sendPush({
      userIds: [patientUserId],
      title: '🧪 Sample Collected',
      body: `Your sample for order ${orderNumber} has been collected.`,
      data: { type: 'SAMPLE_COLLECTED', orderNumber },
      channel: 'samples',
    });
  }

  async notifyReportReady(
    patientUserId: string,
    orderNumber: string,
    hasAbnormal: boolean,
  ): Promise<void> {
    await this.sendPush({
      userIds: [patientUserId],
      title: hasAbnormal ? '⚠️ Report Ready — Review Required' : '📄 Report Ready',
      body: hasAbnormal
        ? `Your report for ${orderNumber} has some values that need attention.`
        : `Your report for ${orderNumber} is ready. All values are normal.`,
      data: { type: 'REPORT_READY', orderNumber },
      channel: hasAbnormal ? 'critical' : 'reports',
      badge: 1,
    });
  }

  async notifyCriticalValue(
    patientUserId: string,
    testName: string,
    value: string,
    unit: string,
  ): Promise<void> {
    await this.sendPush({
      userIds: [patientUserId],
      title: '🚨 Critical Lab Value',
      body: `${testName}: ${value} ${unit} — Requires immediate medical attention.`,
      data: { type: 'CRITICAL_VALUE', testName },
      channel: 'critical',
      badge: 1,
    });
  }

  async notifyAppointmentReminder(
    patientUserId: string,
    slot: string,
    collectionType: string,
  ): Promise<void> {
    await this.sendPush({
      userIds: [patientUserId],
      title: '📅 Collection Reminder',
      body:
        collectionType === 'HOME_COLLECTION'
          ? `Reminder: Your home collection is scheduled for ${slot} today.`
          : `Reminder: Your visit is scheduled for ${slot} today.`,
      data: { type: 'APPOINTMENT_REMINDER' },
      channel: 'default',
    });
  }

  async notifyNewAssignment(
    phlebotomistUserId: string,
    count: number,
  ): Promise<void> {
    await this.sendPush({
      userIds: [phlebotomistUserId],
      title: '📋 New Assignment',
      body: `You have ${count} collection${count > 1 ? 's' : ''} assigned for today.`,
      data: { type: 'NEW_ASSIGNMENT' },
      channel: 'default',
    });
  }
}
