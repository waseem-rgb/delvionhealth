import { Module } from "@nestjs/common";
import { QualityService } from "./quality.service";
import { QualityController } from "./quality.controller";
import { QcRunService } from "./qc-run.service";
import { QcRunController } from "./qc-run.controller";
import { CapaService } from "./capa.service";
import { CapaController } from "./capa.controller";
import { DocumentService } from "./document.service";
import { DocumentController } from "./document.controller";
import { AuditLogService } from "./audit-log.service";
import { AuditController } from "./audit.controller";
import { EqasService } from "./eqas.service";
import { EqasController } from "./eqas.controller";

@Module({
  controllers: [
    QualityController,
    QcRunController,
    CapaController,
    DocumentController,
    AuditController,
    EqasController,
  ],
  providers: [
    QualityService,
    QcRunService,
    CapaService,
    DocumentService,
    AuditLogService,
    EqasService,
  ],
  exports: [QualityService, AuditLogService, CapaService],
})
export class QualityModule {}
