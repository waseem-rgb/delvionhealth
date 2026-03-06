import { Module } from "@nestjs/common";
import { ReportBuilderService } from "./report-builder.service";
import { ReportBuilderController } from "./report-builder.controller";

@Module({
  providers: [ReportBuilderService],
  controllers: [ReportBuilderController],
  exports: [ReportBuilderService],
})
export class ReportBuilderModule {}
