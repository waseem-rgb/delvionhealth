import { Module } from "@nestjs/common";
import { FinanceService } from "./finance.service";
import { FinanceController } from "./finance.controller";
import { AccountingService } from "./accounting.service";
import { NarrationEngineService } from "./narration-engine.service";
import { StatementParserService } from "./statement-parser.service";
import { JournalService } from "./services/journal.service";
import { AiCategorizeService } from "./services/ai-categorize.service";
import { ReceivablesService } from "./services/receivables.service";
import { ProcurementService } from "./services/procurement.service";
import { PayrollCalculationService } from "./services/payroll.service";
import { ComplianceService } from "./services/compliance.service";
import { PayslipService } from "./services/payslip.service";
import { StatementsService } from "./services/statements.service";
import { ReconciliationService } from "./services/reconciliation.service";
import { DashboardService } from "./services/dashboard.service";

@Module({
  providers: [
    FinanceService,
    AccountingService,
    NarrationEngineService,
    StatementParserService,
    JournalService,
    AiCategorizeService,
    ReceivablesService,
    ProcurementService,
    PayrollCalculationService,
    ComplianceService,
    PayslipService,
    StatementsService,
    ReconciliationService,
    DashboardService,
  ],
  controllers: [FinanceController],
  exports: [FinanceService, AccountingService, JournalService, ReceivablesService, ProcurementService, PayrollCalculationService, ComplianceService, PayslipService, StatementsService, ReconciliationService, DashboardService],
})
export class FinanceModule {}
