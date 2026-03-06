import { Module } from "@nestjs/common";
import { PatientsService } from "./patients.service";
import { MergePatientsService } from "./merge-patients.service";
import { PatientsController } from "./patients.controller";

@Module({
  providers: [PatientsService, MergePatientsService],
  controllers: [PatientsController],
  exports: [PatientsService, MergePatientsService],
})
export class PatientsModule {}
