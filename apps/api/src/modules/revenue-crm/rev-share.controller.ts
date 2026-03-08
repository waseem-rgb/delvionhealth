import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { RevShareService } from "./rev-share.service";
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
export class RevShareController {
  constructor(private readonly revShareService: RevShareService) {}

  // ── Rev-Share Ledger ───────────────────────────────────────

  @Get("revshare/ledger")
  @ApiOperation({ summary: "List rev-share ledger entries" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "entityType", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "month", required: false, type: Number })
  @ApiQuery({ name: "year", required: false, type: Number })
  getLedger(
    @CurrentUser() user: JwtPayload,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("entityType") entityType?: string,
    @Query("status") status?: string,
    @Query("month") month?: string,
    @Query("year") year?: string,
  ) {
    return this.revShareService.getLedger(user.tenantId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      entityType,
      status,
      month: month ? parseInt(month, 10) : undefined,
      year: year ? parseInt(year, 10) : undefined,
    });
  }

  @Get("revshare/summary")
  @ApiOperation({ summary: "Rev-share summary by entity type" })
  @ApiQuery({ name: "month", required: false, type: Number })
  @ApiQuery({ name: "year", required: false, type: Number })
  getSummary(
    @CurrentUser() user: JwtPayload,
    @Query("month") month?: string,
    @Query("year") year?: string,
  ) {
    return this.revShareService.getSummary(user.tenantId, {
      month: month ? parseInt(month, 10) : undefined,
      year: year ? parseInt(year, 10) : undefined,
    });
  }

  @Patch("revshare/:id/pay")
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN)
  @ApiOperation({ summary: "Mark rev-share entry as paid (admin only)" })
  markPaid(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
  ) {
    return this.revShareService.markPaid(user.tenantId, id, user.sub);
  }

  @Get("revshare/statement/:entityType/:entityId")
  @ApiOperation({ summary: "Get rev-share statement for an entity" })
  getStatement(
    @CurrentUser() user: JwtPayload,
    @Param("entityType") entityType: string,
    @Param("entityId") entityId: string,
  ) {
    return this.revShareService.getStatement(user.tenantId, entityType, entityId);
  }
}
