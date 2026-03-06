import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { AuditLogService } from "./audit-log.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "@delvion/types";
import type { JwtPayload } from "@delvion/types";

@ApiTags("quality/audit-log")
@ApiBearerAuth()
@Controller("quality/audit-log")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(Role.TENANT_ADMIN, Role.LAB_MANAGER)
export class AuditController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @ApiOperation({ summary: "Get paginated quality audit log (read-only)" })
  @ApiQuery({ name: "entity", required: false })
  @ApiQuery({ name: "dateFrom", required: false })
  @ApiQuery({ name: "dateTo", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  getAuditLog(
    @CurrentUser() user: JwtPayload,
    @Query("entity") entity?: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
  ) {
    return this.auditLogService.getAuditLog(
      user.tenantId,
      { entity, dateFrom, dateTo },
      page ? Number(page) : 1,
      limit ? Number(limit) : 50,
    );
  }
}
