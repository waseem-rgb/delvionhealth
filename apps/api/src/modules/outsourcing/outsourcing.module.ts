import { Module } from "@nestjs/common";
import { OutsourcingService } from "./outsourcing.service";
import { OutsourcingController } from "./outsourcing.controller";
import { ReferencelabService } from "./referencelab.service";
import { ReferencelabController } from "./referencelab.controller";

@Module({
  providers: [OutsourcingService, ReferencelabService],
  controllers: [OutsourcingController, ReferencelabController],
  exports: [OutsourcingService, ReferencelabService],
})
export class OutsourcingModule {}
