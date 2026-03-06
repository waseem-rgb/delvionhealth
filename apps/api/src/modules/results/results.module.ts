import { Module } from "@nestjs/common";
import { ResultsService } from "./results.service";
import { ResultsController } from "./results.controller";
import { BulkResultService } from "./bulk-result.service";
import { BulkResultController } from "./bulk-result.controller";
import { RealtimeModule } from "../realtime/realtime.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [RealtimeModule, NotificationsModule],
  providers: [ResultsService, BulkResultService],
  controllers: [BulkResultController, ResultsController],
  exports: [ResultsService, BulkResultService],
})
export class ResultsModule {}
