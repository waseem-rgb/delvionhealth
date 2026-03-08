import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { NotificationsService } from "./notifications.service";
import { PushService } from "./push.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { JwtPayload } from "@delvion/types";

class UpdatePreferencesDto {
  emailEnabled?: boolean;
  smsEnabled?: boolean;
  orderConfirmed?: boolean;
  sampleCollected?: boolean;
  reportReady?: boolean;
  criticalAlert?: boolean;
  paymentReceived?: boolean;
}

class RegisterPushTokenDto {
  token!: string;
  platform!: string;
}

class DeactivatePushTokenDto {
  token!: string;
}

@ApiTags("notifications")
@ApiBearerAuth()
@Controller("notifications")
@UseGuards(JwtAuthGuard, TenantGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly pushService: PushService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Get notifications for current user" })
  findAll(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.findForUser(user.tenantId, user.sub);
  }

  @Put(":id/read")
  @ApiOperation({ summary: "Mark notification as read" })
  markRead(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.notificationsService.markRead(id, user.sub);
  }

  @Put("read-all/mark")
  @ApiOperation({ summary: "Mark all notifications as read" })
  markAllRead(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.markAllRead(user.sub, user.tenantId);
  }

  @Get("preferences")
  @ApiOperation({ summary: "Get notification preferences" })
  getPreferences(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.getPreferences(user.sub, user.tenantId);
  }

  @Put("preferences")
  @ApiOperation({ summary: "Update notification preferences" })
  updatePreferences(
    @Body() dto: UpdatePreferencesDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.notificationsService.updatePreferences(
      user.sub,
      user.tenantId,
      dto,
    );
  }

  @Post("push-token")
  @ApiOperation({ summary: "Register a push notification token" })
  registerPushToken(
    @Body() dto: RegisterPushTokenDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.pushService.registerToken(user.sub, dto.token, dto.platform);
  }

  @Delete("push-token")
  @ApiOperation({ summary: "Deactivate a push notification token" })
  deactivatePushToken(@Body() dto: DeactivatePushTokenDto) {
    return this.pushService.deactivateToken(dto.token);
  }

  @Post("send")
  @ApiOperation({ summary: "Send a notification via WhatsApp/SMS/Email" })
  async sendNotification(
    @Body() dto: {
      channel: string;
      templateType: string;
      to: string;
      patientId?: string;
      orderId?: string;
      vars: Record<string, string>;
    },
    @CurrentUser() user: JwtPayload,
  ) {
    const message = Object.entries(dto.vars).reduce(
      (msg, [key, val]) => msg.replace(`{${key}}`, val),
      `Hi ${dto.vars.patientName ?? ""},\n\nYour registration is confirmed.\nTests: ${dto.vars.tests ?? ""}\nAmount: ₹${dto.vars.amount ?? ""}\n\nThank you!`,
    );

    try {
      if (dto.channel === "WHATSAPP") {
        await this.notificationsService.sendWhatsApp(dto.to, message);
      } else if (dto.channel === "EMAIL") {
        await this.notificationsService.sendEmail(
          dto.to,
          `Registration Confirmed | ${dto.vars.patientName ?? ""}`,
          `<p>${message.replace(/\n/g, "<br>")}</p>`,
        );
      }
      return { success: true, channel: dto.channel };
    } catch {
      return { success: false, channel: dto.channel, error: "Send failed" };
    }
  }
}
