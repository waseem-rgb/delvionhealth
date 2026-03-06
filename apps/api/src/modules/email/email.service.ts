import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly fromAddress: string;

  constructor(private readonly config: ConfigService) {
    const host = config.get<string>("SMTP_HOST", "localhost");
    const port = config.get<number>("SMTP_PORT", 1025);
    const user = config.get<string>("SMTP_USER", "");
    const pass = config.get<string>("SMTP_PASS", "");

    this.fromAddress = "DELViON Health <noreply@delvion.com>";

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: false,
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  async sendMail(options: SendMailOptions): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });
      this.logger.log(`Email sent to ${options.to}: ${options.subject}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${options.to}`, error);
      throw error;
    }
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const appUrl = this.config.get<string>("APP_URL", "http://localhost:3000");
    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    await this.sendMail({
      to: email,
      subject: "Reset your DELViON Health password",
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; margin: 0; padding: 20px;">
          <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="background: linear-gradient(135deg, #0F1923 0%, #1B4F8A 60%, #0D7E8A 100%); padding: 32px 24px; text-align: center;">
              <div style="display: inline-flex; align-items: center; gap: 10px;">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M16 2L4 8v8c0 7.73 5.16 14.97 12 16.93C22.84 30.97 28 23.73 28 16V8L16 2z" fill="#0D7E8A"/>
                  <path d="M12 16l3 3 5-6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span style="color: white; font-size: 20px; font-weight: 700;">DELViON Health</span>
              </div>
            </div>
            <div style="padding: 32px 24px;">
              <h2 style="margin: 0 0 8px; color: #111827; font-size: 22px;">Reset your password</h2>
              <p style="margin: 0 0 24px; color: #6B7280; font-size: 15px; line-height: 1.6;">
                We received a request to reset your password. Click the button below to create a new password.
                This link will expire in <strong>1 hour</strong>.
              </p>
              <a href="${resetUrl}" style="display: block; text-align: center; background: #0D7E8A; color: white; padding: 14px 24px; border-radius: 8px; font-size: 16px; font-weight: 600; text-decoration: none;">
                Reset Password
              </a>
              <p style="margin: 24px 0 0; color: #9CA3AF; font-size: 13px; text-align: center;">
                If you didn't request a password reset, you can safely ignore this email.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
  }

  async sendInviteEmail(to: string, firstName: string, tempPassword: string): Promise<void> {
    await this.transporter.sendMail({
      from: '"DELViON Health" <noreply@delvion.com>',
      to,
      subject: "You're invited to DELViON Health",
      html: `
        <h2>Welcome to DELViON Health, ${firstName}!</h2>
        <p>Your account has been created. Use the credentials below to log in:</p>
        <p><strong>Email:</strong> ${to}</p>
        <p><strong>Temporary Password:</strong> <code>${tempPassword}</code></p>
        <p>Please change your password after first login.</p>
        <a href="http://localhost:3000/login">Login to DELViON Health &rarr;</a>
      `,
    });
  }

  async sendWelcomeEmail(email: string, firstName: string): Promise<void> {
    await this.sendMail({
      to: email,
      subject: "Welcome to DELViON Health",
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; margin: 0; padding: 20px;">
          <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <h2 style="color: #111827;">Welcome, ${firstName}!</h2>
            <p style="color: #6B7280;">Your DELViON Health account is ready. You can now log in to the platform.</p>
          </div>
        </body>
        </html>
      `,
    });
  }
}
