import { Module } from "@nestjs/common";
import { QcService } from "./qc.service";
import { QcController } from "./qc.controller";

@Module({
  providers: [QcService],
  controllers: [QcController],
  exports: [QcService],
})
export class QcModule {}
