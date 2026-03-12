import { Injectable, Logger } from '@nestjs/common';
import * as https from 'https';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  async sendSms(to: string, message: string): Promise<void> {
    const apiKey = process.env.FAST2SMS_API_KEY;
    if (!apiKey) {
      this.logger.warn('FAST2SMS_API_KEY not configured — skipping SMS');
      return;
    }
    try {
      const number = to.replace('+91', '').replace(/\D/g, '').slice(-10);
      const body = JSON.stringify({
        route: 'q',
        numbers: number,
        message,
        language: 'english',
        flash: 0,
      });

      await new Promise<void>((resolve, reject) => {
        const req = https.request(
          {
            hostname: 'www.fast2sms.com',
            path: '/dev/bulkV2',
            method: 'POST',
            headers: {
              authorization: apiKey,
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(body),
            },
          },
          (res) => {
            this.logger.log(`SMS sent to ${number}, status=${res.statusCode}`);
            resolve();
          },
        );
        req.on('error', reject);
        req.write(body);
        req.end();
      });
    } catch (e: unknown) {
      this.logger.error(`SMS failed to ${to}: ${(e as Error).message}`);
    }
  }
}
