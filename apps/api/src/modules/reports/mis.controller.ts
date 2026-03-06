import {
  Controller,
  Get,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { MisService } from "./mis.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "@delvion/types";
import type { JwtPayload } from "@delvion/types";

@ApiTags("mis")
@ApiBearerAuth()
@Controller("mis")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
export class MisController {
  constructor(private readonly misService: MisService) {}

  // GET /mis/daily-collection
  @Get("daily-collection")
  @ApiOperation({ summary: "Daily collection report (revenue, orders, breakdown)" })
  @ApiQuery({ name: "date", required: true, description: "YYYY-MM-DD" })
  @ApiQuery({ name: "branchId", required: false })
  getDailyCollection(
    @CurrentUser() user: JwtPayload,
    @Query("date") date: string,
    @Query("branchId") branchId?: string,
  ) {
    return this.misService.getDailyCollection(user.tenantId, date, branchId);
  }

  // GET /mis/end-of-day
  @Get("end-of-day")
  @ApiOperation({ summary: "End of day financial summary" })
  @ApiQuery({ name: "date", required: true, description: "YYYY-MM-DD" })
  @ApiQuery({ name: "branchId", required: false })
  getEndOfDayReport(
    @CurrentUser() user: JwtPayload,
    @Query("date") date: string,
    @Query("branchId") branchId?: string,
  ) {
    return this.misService.getEndOfDayReport(user.tenantId, date, branchId);
  }

  // GET /mis/tat
  @Get("tat")
  @ApiOperation({ summary: "Turnaround time analysis report" })
  @ApiQuery({ name: "from", required: true, description: "YYYY-MM-DD" })
  @ApiQuery({ name: "to", required: true, description: "YYYY-MM-DD" })
  getTATReport(
    @CurrentUser() user: JwtPayload,
    @Query("from") from: string,
    @Query("to") to: string,
  ) {
    return this.misService.getTATReport(user.tenantId, from, to);
  }

  // GET /mis/sample-movement
  @Get("sample-movement")
  @ApiOperation({ summary: "Sample movement report by status" })
  @ApiQuery({ name: "date", required: true, description: "YYYY-MM-DD" })
  getSampleMovement(
    @CurrentUser() user: JwtPayload,
    @Query("date") date: string,
  ) {
    return this.misService.getSampleMovement(user.tenantId, date);
  }

  // GET /mis/organizations
  @Get("organizations")
  @ApiOperation({ summary: "Organization-wise orders and revenue report" })
  @ApiQuery({ name: "from", required: true })
  @ApiQuery({ name: "to", required: true })
  getOrganizationReport(
    @CurrentUser() user: JwtPayload,
    @Query("from") from: string,
    @Query("to") to: string,
  ) {
    return this.misService.getOrganizationReport(user.tenantId, from, to);
  }

  // GET /mis/tests
  @Get("tests")
  @ApiOperation({ summary: "Test-wise count, revenue, and abnormal rate report" })
  @ApiQuery({ name: "from", required: true })
  @ApiQuery({ name: "to", required: true })
  getTestWiseReport(
    @CurrentUser() user: JwtPayload,
    @Query("from") from: string,
    @Query("to") to: string,
  ) {
    return this.misService.getTestWiseReport(user.tenantId, from, to);
  }

  // GET /mis/doctors
  @Get("doctors")
  @ApiOperation({ summary: "Doctor-wise orders, revenue, and commission report" })
  @ApiQuery({ name: "from", required: true })
  @ApiQuery({ name: "to", required: true })
  getDoctorReport(
    @CurrentUser() user: JwtPayload,
    @Query("from") from: string,
    @Query("to") to: string,
  ) {
    return this.misService.getDoctorReport(user.tenantId, from, to);
  }
}
