import { Controller, Get, Post, Body, Param, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { QcRunService } from "./qc-run.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "@delvion/types";
import type { JwtPayload } from "@delvion/types";

@ApiTags("quality/qc-runs")
@ApiBearerAuth()
@Controller("quality/qc-runs")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(Role.TENANT_ADMIN, Role.LAB_MANAGER)
export class QcRunController {
  constructor(private readonly qcRunService: QcRunService) {}

  @Post()
  @ApiOperation({ summary: "Record a new QC run with Westgard evaluation" })
  createQCRun(
    @CurrentUser() user: JwtPayload,
    @Body() dto: {
      branchId: string;
      instrumentId: string;
      analyte: string;
      level: string;
      value: number;
      mean: number;
      sd: number;
      department?: string;
      parameter?: string;
      lotNo?: string;
      expiryDate?: string;
      observedValue?: number;
    },
  ) {
    return this.qcRunService.createQCRun(user.tenantId, user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: "List QC runs with filters" })
  @ApiQuery({ name: "department", required: false })
  @ApiQuery({ name: "dateFrom", required: false })
  @ApiQuery({ name: "dateTo", required: false })
  @ApiQuery({ name: "parameter", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  getQCRuns(
    @CurrentUser() user: JwtPayload,
    @Query("department") department?: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("parameter") parameter?: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
  ) {
    return this.qcRunService.getQCRuns(user.tenantId, {
      department, dateFrom, dateTo, parameter,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
    });
  }

  @Get("dashboard")
  @ApiOperation({ summary: "Get QC dashboard stats" })
  getQCDashboardStats(@CurrentUser() user: JwtPayload) {
    return this.qcRunService.getQCDashboardStats(user.tenantId);
  }

  @Get("levey-jennings")
  @ApiOperation({ summary: "Get Levey-Jennings chart data" })
  @ApiQuery({ name: "department", required: true })
  @ApiQuery({ name: "parameter", required: true })
  @ApiQuery({ name: "level", required: true })
  @ApiQuery({ name: "days", required: false, type: Number })
  getLeveyJenningsData(
    @CurrentUser() user: JwtPayload,
    @Query("department") department: string,
    @Query("parameter") parameter: string,
    @Query("level") level: string,
    @Query("days") days?: number,
  ) {
    return this.qcRunService.getLeveyJenningsData(
      user.tenantId, department, parameter, level, days ? Number(days) : 30,
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a single QC run" })
  getSingleRun(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.qcRunService.getSingleRun(user.tenantId, id);
  }
}
