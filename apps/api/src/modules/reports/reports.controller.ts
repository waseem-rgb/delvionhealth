import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { ReportsService } from "./reports.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "@delvion/types";
import type { JwtPayload } from "@delvion/types";

@ApiTags("reports")
@ApiBearerAuth()
@Controller("reports")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  @ApiOperation({ summary: "List reports" })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "orderId", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query("status") status?: string,
    @Query("orderId") orderId?: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number
  ) {
    return this.reportsService.findAll(user.tenantId, {
      status,
      orderId,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(":id")
  @ApiOperation({ summary: "Get single report" })
  findOne(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.reportsService.findOne(id, user.tenantId);
  }

  @Get(":id/download")
  @ApiOperation({ summary: "Get presigned PDF download URL" })
  getDownloadUrl(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.reportsService.getDownloadUrl(id, user.tenantId);
  }

  @Post("generate/:orderId")
  @Roles(
    Role.SUPER_ADMIN,
    Role.LAB_MANAGER,
    Role.PATHOLOGIST,
    Role.LAB_TECHNICIAN
  )
  @ApiOperation({ summary: "Generate PDF report for an order" })
  generateReport(
    @CurrentUser() user: JwtPayload,
    @Param("orderId") orderId: string
  ) {
    return this.reportsService.generateReport(orderId, user.tenantId, user.sub);
  }

  @Post(":id/sign")
  @Roles(Role.SUPER_ADMIN, Role.PATHOLOGIST)
  @ApiOperation({ summary: "Sign a report (pathologist)" })
  signReport(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.reportsService.signReport(id, user.tenantId, user.sub);
  }

  @Post(":id/deliver")
  @Roles(
    Role.SUPER_ADMIN,
    Role.LAB_MANAGER,
    Role.FRONT_DESK
  )
  @ApiOperation({ summary: "Mark report as delivered" })
  deliverReport(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.reportsService.deliverReport(id, user.tenantId, user.sub);
  }
}
