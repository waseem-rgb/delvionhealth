import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { PatientSegmentsService } from "./patient-segments.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Role } from "@delvion/types";
import type { JwtPayload } from "@delvion/types";

@ApiTags("revenue-crm")
@ApiBearerAuth()
@Controller("revenue-crm")
@UseGuards(JwtAuthGuard, TenantGuard)
export class PatientSegmentsController {
  constructor(private readonly patientSegmentsService: PatientSegmentsService) {}

  // ── Segments ───────────────────────────────────────────────

  @Get("segments")
  @ApiOperation({ summary: "List patient segments" })
  findAll(@CurrentUser() user: JwtPayload) {
    return this.patientSegmentsService.findAll(user.tenantId);
  }

  @Post("segments")
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "Create a patient segment" })
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.patientSegmentsService.create(user.tenantId, dto, user.sub);
  }

  @Get("segments/:id/patients")
  @ApiOperation({ summary: "Get patients in a segment" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  getPatients(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.patientSegmentsService.getPatients(user.tenantId, id, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Post("segments/refresh")
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "Refresh estimated counts for all segments" })
  refreshCounts(@CurrentUser() user: JwtPayload) {
    return this.patientSegmentsService.refreshCounts(user.tenantId);
  }
}
