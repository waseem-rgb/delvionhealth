import {
  Controller,
  Get,
  Post,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { RevenueCommandService } from "./revenue-command.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { JwtPayload } from "@delvion/types";
import { Role } from "@delvion/types";
import { PrismaService } from "../../prisma/prisma.service";
import { seedRevenueCrm } from "./seed-revenue-crm";

@ApiTags("revenue-crm")
@ApiBearerAuth()
@Controller("revenue-crm")
@UseGuards(JwtAuthGuard, TenantGuard)
export class RevenueCommandController {
  constructor(
    private readonly revenueCommandService: RevenueCommandService,
    private readonly prisma: PrismaService,
  ) {}

  @Post("seed")
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN)
  @ApiOperation({ summary: "Seed default Revenue CRM data" })
  async seed(@CurrentUser() user: JwtPayload) {
    return seedRevenueCrm(this.prisma, user.tenantId);
  }

  @Get("overview")
  @ApiOperation({ summary: "Revenue command center overview" })
  getOverview(@CurrentUser() user: JwtPayload) {
    return this.revenueCommandService.getOverview(user.tenantId);
  }

  @Get("ai/alerts")
  @ApiOperation({ summary: "AI-driven revenue alerts" })
  getAlerts(@CurrentUser() user: JwtPayload) {
    return this.revenueCommandService.getAlerts(user.tenantId);
  }
}
