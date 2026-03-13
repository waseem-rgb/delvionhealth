import { Module } from "@nestjs/common";
import { NonPathController } from "./non-path.controller";
import { NonPathService } from "./non-path.service";
import { NonPathPdfService } from "./non-path-pdf.service";
import { NonPathTemplateSeedService } from "./template-seed.service";
import { GenerateNonpathTemplatesService } from "./generate-nonpath-templates.service";

@Module({
  controllers: [NonPathController],
  providers: [NonPathService, NonPathPdfService, NonPathTemplateSeedService, GenerateNonpathTemplatesService],
  exports: [NonPathService, NonPathPdfService],
})
export class NonPathModule {}
