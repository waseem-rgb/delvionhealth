import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { OperationsService } from "./operations.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "@delvion/types";
import type { JwtPayload } from "@delvion/types";

@ApiTags("lab-operations")
@ApiBearerAuth()
@Controller("lab/operations")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(
  Role.SUPER_ADMIN,
  Role.TENANT_ADMIN,
  Role.LAB_MANAGER,
  Role.LAB_TECHNICIAN,
)
export class OperationsController {
  constructor(private readonly operationsService: OperationsService) {}

  @Get("dashboard")
  @ApiOperation({ summary: "Get lab operations dashboard stats" })
  getDashboardStats(@CurrentUser() user: JwtPayload) {
    return this.operationsService.getDashboardStats(user.tenantId);
  }

  @Get("departments")
  @ApiOperation({ summary: "Get department-wise workload" })
  getDepartmentWorkload(@CurrentUser() user: JwtPayload) {
    return this.operationsService.getDepartmentWorkload(user.tenantId);
  }

  @Get("hourly")
  @ApiOperation({ summary: "Get hourly order volume for today" })
  getHourlyVolume(@CurrentUser() user: JwtPayload) {
    return this.operationsService.getHourlyVolume(user.tenantId);
  }

  @Get()
  @ApiOperation({ summary: "Get operations queue" })
  @ApiQuery({ name: "department", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "isStatOnly", required: false })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  getOperationsQueue(
    @CurrentUser() user: JwtPayload,
    @Query("department") department?: string,
    @Query("status") status?: string,
    @Query("isStatOnly") isStatOnly?: string,
    @Query("search") search?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.operationsService.getOperationsQueue(user.tenantId, {
      department,
      status,
      isStatOnly: isStatOnly === "true",
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get("waiting-list")
  @ApiOperation({ summary: "Get waiting list (LiveHealth-style)" })
  getWaitingList(
    @CurrentUser() user: JwtPayload,
    @Query("statusFilter") statusFilter?: string,
    @Query("department") department?: string,
    @Query("search") search?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.operationsService.getWaitingList(user.tenantId, {
      statusFilter,
      department,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get("status-counts")
  @ApiOperation({ summary: "Get status bucket counts (sidebar)" })
  getStatusCounts(@CurrentUser() user: JwtPayload) {
    return this.operationsService.getStatusCounts(user.tenantId);
  }

  @Post(":id/start")
  @ApiOperation({ summary: "Start processing an order" })
  startProcessing(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.operationsService.startProcessing(id, user.sub, user.tenantId);
  }
}
