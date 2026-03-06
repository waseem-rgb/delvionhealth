import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { TenantId } from "../../common/decorators/tenant-id.decorator";
import { Role } from "@delvion/types";
import {
  ReportBuilderService,
  CreateParameterDto,
  UpdateParameterDto,
  UpdateSettingsDto,
  ReorderDto,
} from "./report-builder.service";

@Controller("report-builder")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(Role.TENANT_ADMIN, Role.LAB_MANAGER, Role.PATHOLOGIST)
export class ReportBuilderController {
  constructor(private readonly service: ReportBuilderService) {}

  // ─── PARAMETERS ──────────────────────────────

  @Get(":testCatalogId/parameters")
  getParameters(
    @Param("testCatalogId") testCatalogId: string,
    @TenantId() tenantId: string,
  ) {
    return this.service.getParameters(testCatalogId, tenantId);
  }

  @Post(":testCatalogId/parameters")
  createParameter(
    @Param("testCatalogId") testCatalogId: string,
    @TenantId() tenantId: string,
    @Body() dto: CreateParameterDto,
  ) {
    return this.service.createParameter(testCatalogId, tenantId, dto);
  }

  @Post(":testCatalogId/parameters/bulk")
  bulkCreateParameters(
    @Param("testCatalogId") testCatalogId: string,
    @TenantId() tenantId: string,
    @Body() dto: { parameters: CreateParameterDto[] },
  ) {
    return this.service.bulkCreateParameters(
      testCatalogId,
      tenantId,
      dto.parameters,
    );
  }

  @Put("parameters/:parameterId")
  updateParameter(
    @Param("parameterId") parameterId: string,
    @TenantId() tenantId: string,
    @Body() dto: UpdateParameterDto,
  ) {
    return this.service.updateParameter(parameterId, tenantId, dto);
  }

  @Delete("parameters/:parameterId")
  deleteParameter(
    @Param("parameterId") parameterId: string,
    @TenantId() tenantId: string,
  ) {
    return this.service.deleteParameter(parameterId, tenantId);
  }

  @Post(":testCatalogId/parameters/reorder")
  reorderParameters(
    @Param("testCatalogId") testCatalogId: string,
    @TenantId() tenantId: string,
    @Body() dto: ReorderDto,
  ) {
    return this.service.reorderParameters(testCatalogId, tenantId, dto);
  }

  // ─── SETTINGS ────────────────────────────────

  @Get(":testCatalogId/settings")
  getSettings(
    @Param("testCatalogId") testCatalogId: string,
    @TenantId() tenantId: string,
  ) {
    return this.service.getSettings(testCatalogId, tenantId);
  }

  @Put(":testCatalogId/settings")
  updateSettings(
    @Param("testCatalogId") testCatalogId: string,
    @TenantId() tenantId: string,
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.service.updateSettings(testCatalogId, tenantId, dto);
  }

  // ─── AI AUTO-FILL ────────────────────────────

  @Post(":testCatalogId/auto-fill")
  autoFill(
    @Param("testCatalogId") testCatalogId: string,
    @TenantId() tenantId: string,
  ) {
    return this.service.autoFillParameters(testCatalogId, tenantId);
  }

  // ─── PREVIEW ─────────────────────────────────

  @Get(":testCatalogId/preview")
  getPreview(
    @Param("testCatalogId") testCatalogId: string,
    @TenantId() tenantId: string,
  ) {
    return this.service.getPreviewHtml(testCatalogId, tenantId);
  }
}
