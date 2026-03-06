import { Module } from "@nestjs/common";
import { OrganisationsService } from "./organisations.service";
import { OrganisationsController } from "./organisations.controller";
import { ReportsModule } from "../reports/reports.module";

@Module({
  imports: [ReportsModule],
  providers: [OrganisationsService],
  controllers: [OrganisationsController],
  exports: [OrganisationsService],
})
export class OrganisationsModule {}
