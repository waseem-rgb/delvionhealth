import { Module, forwardRef } from "@nestjs/common";
import { ResultsModule } from "../results/results.module";
import { ReportsModule } from "../reports/reports.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { AccessionService } from "./accession.service";
import { AccessionController } from "./accession.controller";
import { OperationsService } from "./operations.service";
import { OperationsController } from "./operations.controller";
import { ResultEntryService } from "./result-entry.service";
import { ResultEntryController } from "./result-entry.controller";
import { ApprovalService } from "./approval.service";
import { ApprovalController } from "./approval.controller";
import { VacutainerService } from "./vacutainer.service";

@Module({
  imports: [
    forwardRef(() => ResultsModule),
    ReportsModule,
    NotificationsModule,
  ],
  providers: [
    AccessionService,
    OperationsService,
    ResultEntryService,
    ApprovalService,
    VacutainerService,
  ],
  controllers: [
    AccessionController,
    OperationsController,
    ResultEntryController,
    ApprovalController,
  ],
  exports: [
    AccessionService,
    OperationsService,
    ResultEntryService,
    ApprovalService,
    VacutainerService,
  ],
})
export class LabModule {}
