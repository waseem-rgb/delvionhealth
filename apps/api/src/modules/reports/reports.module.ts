import { Module } from "@nestjs/common";
import { ReportsService } from "./reports.service";
import { ReportsController } from "./reports.controller";
import { ReportTemplatesService } from "./report-templates.service";
import { ReportTemplatesController } from "./report-templates.controller";
import { ReportApprovalService } from "./report-approval.service";
import { ReportApprovalController } from "./report-approval.controller";
import { ReportDispatchService } from "./report-dispatch.service";
import { ReportDispatchController } from "./report-dispatch.controller";
import { MisService } from "./mis.service";
import { MisController } from "./mis.controller";
import { MinioService } from "./minio.service";
import { RealtimeModule } from "../realtime/realtime.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [RealtimeModule, NotificationsModule],
  providers: [ReportsService, ReportTemplatesService, ReportApprovalService, ReportDispatchService, MisService, MinioService],
  controllers: [ReportsController, ReportTemplatesController, ReportApprovalController, ReportDispatchController, MisController],
  exports: [ReportsService, ReportTemplatesService, ReportApprovalService, ReportDispatchService, MisService, MinioService],
})
export class ReportsModule {}
