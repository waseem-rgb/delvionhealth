import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  async sendWhatsApp(to: string, message: string): Promise<void> {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_WHATSAPP_FROM;
    if (!sid || !token || !from) {
      this.logger.warn('Twilio not configured — skipping WhatsApp');
      return;
    }
    try {
      // Dynamic import to avoid crash if twilio not installed
      const { Twilio } = await import('twilio');
      const client = new Twilio(sid, token);
      const formattedTo = to.startsWith('+') ? to : `+91${to}`;
      await client.messages.create({
        from,
        to: `whatsapp:${formattedTo}`,
        body: message,
      });
      this.logger.log(`WhatsApp sent to ${formattedTo}`);
    } catch (e: unknown) {
      this.logger.error(`WhatsApp failed to ${to}: ${(e as Error).message}`);
    }
  }
}
