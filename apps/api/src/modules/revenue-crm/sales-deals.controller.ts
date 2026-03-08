import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { SalesDealsService } from "./sales-deals.service";
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
export class SalesDealsController {
  constructor(private readonly salesDealsService: SalesDealsService) {}

  // ── Deals ──────────────────────────────────────────────────

  @Get("deals")
  @ApiOperation({ summary: "List sales deals" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "stage", required: false })
  @ApiQuery({ name: "assignedRepId", required: false })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("stage") stage?: string,
    @Query("assignedRepId") assignedRepId?: string,
  ) {
    return this.salesDealsService.findAll(user.tenantId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      stage,
      assignedRepId,
    });
  }

  @Post("deals")
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "Create a sales deal" })
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.salesDealsService.create(user.tenantId, dto, user.sub);
  }

  @Get("deals/:id")
  @ApiOperation({ summary: "Get a single sales deal" })
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
  ) {
    return this.salesDealsService.findOne(user.tenantId, id);
  }

  @Patch("deals/:id/stage")
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "Update deal stage" })
  updateStage(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() body: { stage: string },
  ) {
    return this.salesDealsService.updateStage(user.tenantId, id, body.stage);
  }

  @Post("deals/:id/activity")
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "Log an activity on a deal" })
  logActivity(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.salesDealsService.logActivity(user.tenantId, id, dto, user.sub);
  }
}
