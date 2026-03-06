import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { CapaService } from "./capa.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "@delvion/types";
import type { JwtPayload } from "@delvion/types";

@ApiTags("quality/capas")
@ApiBearerAuth()
@Controller("quality/capas")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(Role.TENANT_ADMIN, Role.LAB_MANAGER)
export class CapaController {
  constructor(private readonly capaService: CapaService) {}

  @Post()
  @ApiOperation({ summary: "Create a CAPA" })
  createCapa(
    @CurrentUser() user: JwtPayload,
    @Body() dto: {
      title: string;
      description?: string;
      type?: string;
      source?: string;
      sourceId?: string;
      priority?: string;
      department?: string;
      rootCause?: string;
      proposedAction?: string;
      dueDate?: string;
      assignedToId?: string;
    },
  ) {
    return this.capaService.createCapa(user.tenantId, user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: "List CAPAs with filters" })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "type", required: false })
  @ApiQuery({ name: "department", required: false })
  @ApiQuery({ name: "priority", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  getCapas(
    @CurrentUser() user: JwtPayload,
    @Query("status") status?: string,
    @Query("type") type?: string,
    @Query("department") department?: string,
    @Query("priority") priority?: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
  ) {
    return this.capaService.getCapas(user.tenantId, {
      status, type, department, priority,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Get("summary")
  @ApiOperation({ summary: "Get CAPA summary counts" })
  getCapaSummary(@CurrentUser() user: JwtPayload) {
    return this.capaService.getCapaSummary(user.tenantId);
  }

  @Post("ai-suggest")
  @ApiOperation({ summary: "AI-assisted root cause suggestion for CAPA" })
  aiSuggest(@Body() dto: { source: string; description: string }) {
    return this.capaService.suggestRootCause(dto.source, dto.description);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a CAPA" })
  updateCapa(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: {
      title?: string;
      description?: string;
      status?: string;
      priority?: string;
      rootCause?: string;
      proposedAction?: string;
      actualAction?: string;
      dueDate?: string;
      assignedToId?: string;
      effectivenessCheck?: string;
      effectivenessDate?: string;
    },
  ) {
    return this.capaService.updateCapa(user.tenantId, id, user.sub, dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Soft-delete CAPA (set status to CLOSED)" })
  softDeleteCapa(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.capaService.updateCapa(user.tenantId, id, user.sub, { status: "CLOSED" });
  }
}
