import { Module } from "@nestjs/common";
import { HrService } from "./hr.service";
import { HrController } from "./hr.controller";

@Module({
  providers: [HrService],
  controllers: [HrController],
  exports: [HrService],
})
export class HrModule {}
