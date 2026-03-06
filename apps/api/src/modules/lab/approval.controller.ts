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
import { ApprovalService } from "./approval.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "@delvion/types";
import type { JwtPayload } from "@delvion/types";

@ApiTags("lab-approvals")
@ApiBearerAuth()
@Controller("lab/approvals")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(
  Role.SUPER_ADMIN,
  Role.TENANT_ADMIN,
  Role.LAB_MANAGER,
  Role.PATHOLOGIST,
)
export class ApprovalController {
  constructor(private readonly approvalService: ApprovalService) {}

  @Get("stats")
  @ApiOperation({ summary: "Get approval stats" })
  getApprovalStats(@CurrentUser() user: JwtPayload) {
    return this.approvalService.getApprovalStats(user.tenantId);
  }

  @Get()
  @ApiOperation({ summary: "Get pending approvals" })
  @ApiQuery({ name: "priority", required: false })
  @ApiQuery({ name: "hasCritical", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  getPendingApprovals(
    @CurrentUser() user: JwtPayload,
    @Query("priority") priority?: string,
    @Query("hasCritical") hasCritical?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.approvalService.getPendingApprovals(user.tenantId, {
      priority,
      hasCritical: hasCritical === "true",
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(":id/preview")
  @ApiOperation({ summary: "Get full report preview data" })
  getReportPreview(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.approvalService.getReportPreview(id, user.tenantId);
  }

  @Post(":id/approve")
  @ApiOperation({ summary: "Approve an order's results" })
  approveOrder(
    @Param("id") id: string,
    @Body() body: { signatureUrl?: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.approvalService.approveOrder(
      id,
      user.sub,
      user.tenantId,
      body.signatureUrl,
    );
  }

  @Post(":id/reject")
  @ApiOperation({ summary: "Reject order results (send back for re-entry)" })
  rejectOrder(
    @Param("id") id: string,
    @Body() body: { reason: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.approvalService.rejectOrder(
      id,
      body.reason,
      user.sub,
      user.tenantId,
    );
  }

  @Post("bulk-approve")
  @ApiOperation({ summary: "Bulk approve multiple orders" })
  bulkApprove(
    @Body() body: { orderIds: string[] },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.approvalService.bulkApprove(
      body.orderIds,
      user.sub,
      user.tenantId,
    );
  }
}
