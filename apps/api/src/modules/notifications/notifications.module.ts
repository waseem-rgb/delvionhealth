import { Module } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { NotificationsController } from "./notifications.controller";
import { PushService } from "./push.service";
import { RealtimeModule } from "../realtime/realtime.module";

@Module({
  imports: [RealtimeModule],
  providers: [NotificationsService, PushService],
  controllers: [NotificationsController],
  exports: [NotificationsService, PushService],
})
export class NotificationsModule {}
