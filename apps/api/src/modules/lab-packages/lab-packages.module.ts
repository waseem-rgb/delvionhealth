import { Module } from "@nestjs/common";
import { LabPackagesService } from "./lab-packages.service";
import { AiPackageService } from "./ai-package.service";
import { QuotesService } from "./quotes.service";
import { LabPackagesController } from "./lab-packages.controller";
import { QuotesController } from "./quotes.controller";

@Module({
  controllers: [LabPackagesController, QuotesController],
  providers: [LabPackagesService, AiPackageService, QuotesService],
  exports: [LabPackagesService, QuotesService],
})
export class LabPackagesModule {}
