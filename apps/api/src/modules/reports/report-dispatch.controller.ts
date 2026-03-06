import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { ReportDispatchService } from "./report-dispatch.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "@delvion/types";
import type { JwtPayload } from "@delvion/types";

@ApiTags("report-dispatch")
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class ReportDispatchController {
  constructor(
    private readonly reportDispatchService: ReportDispatchService,
  ) {}

  @Post("reports/:id/dispatch")
  @Roles(
    Role.SUPER_ADMIN,
    Role.TENANT_ADMIN,
    Role.LAB_MANAGER,
    Role.FRONT_DESK,
    Role.PATHOLOGIST,
  )
  @ApiOperation({ summary: "Dispatch report via one or more channels (EMAIL, SMS, WHATSAPP)" })
  dispatchReport(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() body: { channels: Array<"EMAIL" | "SMS" | "WHATSAPP"> },
  ) {
    return this.reportDispatchService.dispatchReport(
      id,
      user.tenantId,
      body.channels,
    );
  }

  @Get("reports/:id/dispatch-history")
  @ApiOperation({ summary: "Get dispatch history for a report" })
  getDispatchHistory(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
  ) {
    return this.reportDispatchService.getDispatchHistory(id, user.tenantId);
  }

  @Post("report-dispatches/:id/retry")
  @Roles(
    Role.SUPER_ADMIN,
    Role.TENANT_ADMIN,
    Role.LAB_MANAGER,
    Role.FRONT_DESK,
  )
  @ApiOperation({ summary: "Retry a failed dispatch" })
  retryFailedDispatch(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
  ) {
    return this.reportDispatchService.retryFailedDispatch(id, user.tenantId);
  }
}
