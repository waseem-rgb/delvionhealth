import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { SalesRepsService } from "./sales-reps.service";
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
export class SalesRepsController {
  constructor(private readonly salesRepsService: SalesRepsService) {}

  // ── Sales Reps ────────────────────────────────────────────

  @Get("reps")
  @ApiOperation({ summary: "List sales reps" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "branchId", required: false })
  @ApiQuery({ name: "search", required: false })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("branchId") branchId?: string,
    @Query("search") search?: string,
  ) {
    return this.salesRepsService.findAll(user.tenantId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      branchId,
      search,
    });
  }

  @Post("reps")
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "Create a sales rep" })
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.salesRepsService.create(user.tenantId, dto);
  }

  @Get("reps/:id")
  @ApiOperation({ summary: "Get a single sales rep" })
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
  ) {
    return this.salesRepsService.findOne(user.tenantId, id);
  }

  @Put("reps/:id")
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "Update a sales rep" })
  update(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.salesRepsService.update(user.tenantId, id, dto);
  }

  @Get("reps/:id/stats")
  @ApiOperation({ summary: "Get rep performance stats" })
  getStats(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
  ) {
    return this.salesRepsService.getStats(user.tenantId, id);
  }

  @Get("reps/:id/visits")
  @ApiOperation({ summary: "Get paginated visits for a rep" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "from", required: false })
  @ApiQuery({ name: "to", required: false })
  getVisits(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.salesRepsService.getVisits(user.tenantId, id, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      from,
      to,
    });
  }

  // ── Visits ────────────────────────────────────────────────

  @Post("visits")
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "Log a sales visit" })
  logVisit(
    @CurrentUser() user: JwtPayload,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.salesRepsService.logVisit(user.tenantId, dto);
  }

  // ── Targets ───────────────────────────────────────────────

  @Get("targets")
  @ApiOperation({ summary: "List sales targets" })
  @ApiQuery({ name: "repId", required: false })
  @ApiQuery({ name: "month", required: false, type: Number })
  @ApiQuery({ name: "year", required: false, type: Number })
  getTargets(
    @CurrentUser() user: JwtPayload,
    @Query("repId") repId?: string,
    @Query("month") month?: string,
    @Query("year") year?: string,
  ) {
    return this.salesRepsService.getTargets(user.tenantId, {
      repId,
      month: month ? parseInt(month, 10) : undefined,
      year: year ? parseInt(year, 10) : undefined,
    });
  }

  @Post("targets")
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "Set (upsert) a monthly sales target" })
  setTarget(
    @CurrentUser() user: JwtPayload,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.salesRepsService.setTarget(user.tenantId, dto);
  }
}
