import { Module } from "@nestjs/common";
import { RateListsService } from "./rate-lists.service";
import { RateListsController } from "./rate-lists.controller";

@Module({
  providers: [RateListsService],
  controllers: [RateListsController],
  exports: [RateListsService],
})
export class RateListsModule {}
