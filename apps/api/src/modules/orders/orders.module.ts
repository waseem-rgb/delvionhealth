import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { OrdersService } from "./orders.service";
import { OrdersController } from "./orders.controller";
import { StandingOrdersService } from "./standing-orders.service";
import { TestCatalogService } from "./test-catalog.service";
import { TestCatalogController } from "./test-catalog.controller";
import { PdfParserService } from "./pdf-parser.service";
import { TrfService } from "./trf.service";
import { TrfController } from "./trf.controller";
import { RealtimeModule } from "../realtime/realtime.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { RateListsModule } from "../rate-lists/rate-lists.module";

@Module({
  imports: [RealtimeModule, ScheduleModule, NotificationsModule, RateListsModule],
  providers: [OrdersService, StandingOrdersService, TestCatalogService, PdfParserService, TrfService],
  controllers: [OrdersController, TestCatalogController, TrfController],
  exports: [OrdersService, StandingOrdersService, TrfService],
})
export class OrdersModule {}
