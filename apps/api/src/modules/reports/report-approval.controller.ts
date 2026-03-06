import {
  Controller,
  Get,
  Put,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { ReportApprovalService } from "./report-approval.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "@delvion/types";
import type { JwtPayload } from "@delvion/types";

@ApiTags("report-approval")
@ApiBearerAuth()
@Controller("reports")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class ReportApprovalController {
  constructor(
    private readonly reportApprovalService: ReportApprovalService
  ) {}

  @Get("pending-approval")
  @Roles(
    Role.SUPER_ADMIN,
    Role.TENANT_ADMIN,
    Role.LAB_MANAGER,
    Role.PATHOLOGIST
  )
  @ApiOperation({ summary: "Get reports pending approval" })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "from", required: false })
  @ApiQuery({ name: "to", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  getPendingApprovals(
    @CurrentUser() user: JwtPayload,
    @Query("search") search?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number
  ) {
    return this.reportApprovalService.getPendingApprovals(user.tenantId, {
      search,
      from,
      to,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Put(":id/approve")
  @Roles(
    Role.SUPER_ADMIN,
    Role.TENANT_ADMIN,
    Role.LAB_MANAGER,
    Role.PATHOLOGIST
  )
  @ApiOperation({ summary: "Approve a report" })
  approveReport(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string
  ) {
    return this.reportApprovalService.approveReport(
      id,
      user.sub,
      user.tenantId
    );
  }

  @Put(":id/reject")
  @Roles(
    Role.SUPER_ADMIN,
    Role.TENANT_ADMIN,
    Role.LAB_MANAGER,
    Role.PATHOLOGIST
  )
  @ApiOperation({ summary: "Reject a report" })
  rejectReport(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() body: { reason: string }
  ) {
    return this.reportApprovalService.rejectReport(
      id,
      user.sub,
      body.reason,
      user.tenantId
    );
  }

  @Post("bulk-approve")
  @Roles(
    Role.SUPER_ADMIN,
    Role.TENANT_ADMIN,
    Role.LAB_MANAGER,
    Role.PATHOLOGIST
  )
  @ApiOperation({ summary: "Bulk approve multiple reports" })
  bulkApprove(
    @CurrentUser() user: JwtPayload,
    @Body() body: { reportIds: string[] }
  ) {
    return this.reportApprovalService.bulkApprove(
      body.reportIds,
      user.sub,
      user.tenantId
    );
  }

  @Put("signature")
  @ApiOperation({ summary: "Upload/update user digital signature URL" })
  uploadSignature(
    @CurrentUser() user: JwtPayload,
    @Body() body: { signatureUrl: string }
  ) {
    return this.reportApprovalService.uploadSignature(
      user.sub,
      body.signatureUrl
    );
  }
}
