import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { CptService } from "./cpt.service";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Role } from "@delvion/types";
import type { JwtPayload } from "@delvion/types";

@ApiTags("cpt")
@ApiBearerAuth()
@Controller("cpt")
@UseGuards(JwtAuthGuard, TenantGuard)
export class CptController {
  constructor(
    private readonly cptService: CptService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN)
  @ApiOperation({ summary: "Upsert CPT entry for instrument+test" })
  upsertCPT(@CurrentUser() user: JwtPayload, @Body() dto: any) {
    return this.cptService.upsertCPT(user.tenantId, dto, user.sub);
  }

  @Get("test/:testId")
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "Get CPT entries for a test" })
  getCPTForTest(
    @CurrentUser() user: JwtPayload,
    @Param("testId") testId: string,
  ) {
    return this.cptService.getCPTForTest(user.tenantId, testId);
  }

  @Delete(":id")
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN)
  @ApiOperation({ summary: "Delete CPT entry" })
  deleteCPT(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.cptService.deleteCPT(user.tenantId, id);
  }

  @Get("margin-dashboard")
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN)
  @ApiOperation({ summary: "Margin dashboard" })
  getMarginDashboard(
    @CurrentUser() user: JwtPayload,
    @Query("instrumentId") instrumentId?: string,
    @Query("department") department?: string,
    @Query("minMarginPct") minMarginPct?: string,
    @Query("maxMarginPct") maxMarginPct?: string,
  ) {
    return this.cptService.getMarginDashboard(user.tenantId, {
      instrumentId,
      department,
      minMarginPct: minMarginPct ? parseFloat(minMarginPct) : undefined,
      maxMarginPct: maxMarginPct ? parseFloat(maxMarginPct) : undefined,
    });
  }

  @Post("seed")
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN)
  @ApiOperation({ summary: "Seed default instruments" })
  async seedInstruments(@CurrentUser() user: JwtPayload) {
    const { seedInstruments } = await import("./seed-instruments");
    return seedInstruments(this.prisma as any, user.tenantId);
  }

  @Post("seed-cpt")
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN)
  @ApiOperation({ summary: "Seed default CPT values for common tests" })
  seedDefaultCPT(@CurrentUser() user: JwtPayload) {
    return this.cptService.seedDefaultCPT(user.tenantId, user.sub);
  }
}
