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
  ],
  controllers: [FinanceController],
  exports: [FinanceService, AccountingService, JournalService, ReceivablesService, ProcurementService],
})
export class FinanceModule {}
