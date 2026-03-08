import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { TpaAccountsService } from "./tpa-accounts.service";
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
export class TpaAccountsController {
  constructor(private readonly tpaAccountsService: TpaAccountsService) {}

  @Get("tpa")
  findAll(@CurrentUser() user: JwtPayload) {
    return this.tpaAccountsService.findAll(user.tenantId);
  }

  @Post("tpa")
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.tpaAccountsService.create(user.tenantId, dto);
  }

  @Get("tpa/:id")
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
  ) {
    return this.tpaAccountsService.findOne(user.tenantId, id);
  }

  @Get("tpa/:id/claims")
  getClaims(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.tpaAccountsService.getClaims(user.tenantId, id, {
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Post("tpa/:id/claims")
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  addClaim(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.tpaAccountsService.addClaim(user.tenantId, id, dto);
  }

  @Put("tpa/claims/:claimId")
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  updateClaim(
    @CurrentUser() user: JwtPayload,
    @Param("claimId") claimId: string,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.tpaAccountsService.updateClaim(user.tenantId, claimId, dto);
  }
}
