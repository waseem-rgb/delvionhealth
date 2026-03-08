import { Module } from "@nestjs/common";
import { FrontDeskController } from "./front-desk.controller";
import { FrontDeskService } from "./front-desk.service";
import { QueueService } from "./queue.service";
import { PhlebScheduleService } from "./phleb-schedule.service";
import { PriceEnquiryService } from "./price-enquiry.service";
import { NotificationLogService } from "./notification-log.service";

@Module({
  controllers: [FrontDeskController],
  providers: [
    FrontDeskService,
    QueueService,
    PhlebScheduleService,
    PriceEnquiryService,
    NotificationLogService,
  ],
  exports: [QueueService, NotificationLogService],
})
export class FrontDeskModule {}
