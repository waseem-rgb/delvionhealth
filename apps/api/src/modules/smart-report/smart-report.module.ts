import { Module } from "@nestjs/common";
import { SmartReportService } from "./smart-report.service";
import { SmartReportController } from "./smart-report.controller";

@Module({
  providers: [SmartReportService],
  controllers: [SmartReportController],
  exports: [SmartReportService],
})
export class SmartReportModule {}
