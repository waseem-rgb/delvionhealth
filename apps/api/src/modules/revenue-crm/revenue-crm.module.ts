import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { SalesRepsController } from "./sales-reps.controller";
import { SalesRepsService } from "./sales-reps.service";
import { ReferringDoctorsController } from "./referring-doctors.controller";
import { ReferringDoctorsService } from "./referring-doctors.service";
import { B2bAccountsController } from "./b2b-accounts.controller";
import { B2bAccountsService } from "./b2b-accounts.service";
import { CorporateContractsController } from "./corporate-contracts.controller";
import { CorporateContractsService } from "./corporate-contracts.service";
import { TpaAccountsController } from "./tpa-accounts.controller";
import { TpaAccountsService } from "./tpa-accounts.service";
import { HealthCampsController } from "./health-camps.controller";
import { HealthCampsService } from "./health-camps.service";
import { SalesDealsController } from "./sales-deals.controller";
import { SalesDealsService } from "./sales-deals.service";
import { RevShareController } from "./rev-share.controller";
import { RevShareService } from "./rev-share.service";
import { PatientSegmentsController } from "./patient-segments.controller";
import { PatientSegmentsService } from "./patient-segments.service";
import { RevenueCommandController } from "./revenue-command.controller";
import { RevenueCommandService } from "./revenue-command.service";

@Module({
  imports: [PrismaModule],
  controllers: [
    RevenueCommandController,
    SalesRepsController,
    ReferringDoctorsController,
    B2bAccountsController,
    CorporateContractsController,
    TpaAccountsController,
    HealthCampsController,
    SalesDealsController,
    RevShareController,
    PatientSegmentsController,
  ],
  providers: [
    RevenueCommandService,
    SalesRepsService,
    ReferringDoctorsService,
    B2bAccountsService,
    CorporateContractsService,
    TpaAccountsService,
    HealthCampsService,
    SalesDealsService,
    RevShareService,
    PatientSegmentsService,
  ],
  exports: [RevShareService],
})
export class RevenueCrmModule {}
