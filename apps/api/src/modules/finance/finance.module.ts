import { Module } from "@nestjs/common";
import { FinanceService } from "./finance.service";
import { FinanceController } from "./finance.controller";
import { AccountingService } from "./accounting.service";
import { NarrationEngineService } from "./narration-engine.service";
import { StatementParserService } from "./statement-parser.service";

@Module({
  providers: [FinanceService, AccountingService, NarrationEngineService, StatementParserService],
  controllers: [FinanceController],
  exports: [FinanceService, AccountingService],
})
export class FinanceModule {}
