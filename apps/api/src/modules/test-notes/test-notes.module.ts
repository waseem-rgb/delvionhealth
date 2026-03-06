import { Module } from "@nestjs/common";
import { TestNotesService } from "./test-notes.service";
import { TestNotesController } from "./test-notes.controller";

@Module({
  providers: [TestNotesService],
  controllers: [TestNotesController],
  exports: [TestNotesService],
})
export class TestNotesModule {}
