import { Module } from "@nestjs/common";
import { BulkRegistrationService } from "./bulk-registration.service";
import { BulkRegistrationController } from "./bulk-registration.controller";

@Module({
  providers: [BulkRegistrationService],
  controllers: [BulkRegistrationController],
  exports: [BulkRegistrationService],
})
export class BulkRegistrationModule {}
