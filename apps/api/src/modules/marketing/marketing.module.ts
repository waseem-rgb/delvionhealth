import { Module } from "@nestjs/common";
import { MarketingController } from "./marketing.controller";
import { DoctorsMarketingService } from "./doctors.service";
import { CampaignsService } from "./campaigns.service";
import { CampsService } from "./camps.service";
import { PackagesService } from "./packages.service";
import { RecallService } from "./recall.service";
import { ContentService } from "./content.service";
import { OverviewService } from "./overview.service";

@Module({
  controllers: [MarketingController],
  providers: [
    DoctorsMarketingService,
    CampaignsService,
    CampsService,
    PackagesService,
    RecallService,
    ContentService,
    OverviewService,
  ],
  exports: [DoctorsMarketingService],
})
export class MarketingModule {}
