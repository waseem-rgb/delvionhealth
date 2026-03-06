import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from "@nestjs/swagger";
import { AnalyticsService, DashboardData, FullAnalyticsReport } from "./analytics.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { JwtPayload } from "@delvion/types";

@ApiTags("analytics")
@ApiBearerAuth()
@Controller("analytics")
@UseGuards(JwtAuthGuard, TenantGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("dashboard")
  @ApiOperation({ summary: "Get executive dashboard data" })
  @ApiQuery({ name: "branchId", required: false, type: String })
  getDashboard(
    @CurrentUser() user: JwtPayload,
    @Query("branchId") branchId?: string
  ): Promise<DashboardData> {
    return this.analyticsService.getDashboardData(user.tenantId, branchId);
  }

  @Get("full-report")
  @ApiOperation({ summary: "Get full analytics report for date range" })
  @ApiQuery({ name: "dateFrom", required: true, type: String })
  @ApiQuery({ name: "dateTo", required: true, type: String })
  @ApiQuery({ name: "branchId", required: false, type: String })
  async getFullReport(
    @CurrentUser() user: JwtPayload,
    @Query("dateFrom") dateFrom: string,
    @Query("dateTo") dateTo: string,
    @Query("branchId") branchId?: string
  ): Promise<FullAnalyticsReport> {
    return this.analyticsService.getFullReport(
      user.tenantId,
      new Date(dateFrom),
      new Date(dateTo),
      branchId
    );
  }
}
