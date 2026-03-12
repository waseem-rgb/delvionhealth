import { Module } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { NotificationsController } from "./notifications.controller";
import { PushService } from "./push.service";
import { RealtimeModule } from "../realtime/realtime.module";
import { WhatsAppService } from "./services/whatsapp.service";
import { SmsService } from "./services/sms.service";

@Module({
  imports: [RealtimeModule],
  providers: [NotificationsService, PushService, WhatsAppService, SmsService],
  controllers: [NotificationsController],
  exports: [NotificationsService, PushService, WhatsAppService, SmsService],
})
export class NotificationsModule {}
