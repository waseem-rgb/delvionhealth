import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Role } from "@delvion/types";
import type { JwtPayload } from "@delvion/types";
import { B2bAccountsService } from "./b2b-accounts.service";

@ApiTags("revenue-crm")
@ApiBearerAuth()
@Controller("revenue-crm")
@UseGuards(JwtAuthGuard, TenantGuard)
export class B2bAccountsController {
  constructor(private readonly b2bAccountsService: B2bAccountsService) {}

  @Get("b2b-accounts")
  @ApiOperation({ summary: "List B2B accounts with filters" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "type", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "search", required: false })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("type") type?: string,
    @Query("status") status?: string,
    @Query("search") search?: string,
  ) {
    return this.b2bAccountsService.findAll(user.tenantId, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      type,
      status,
      search,
    });
  }

  @Post("b2b-accounts")
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER, Role.FIELD_SALES_REP)
  @ApiOperation({ summary: "Create a B2B account" })
  create(@Body() dto: Record<string, unknown>, @CurrentUser() user: JwtPayload) {
    return this.b2bAccountsService.create(user.tenantId, dto, user.sub);
  }

  @Get("b2b-accounts/:id")
  @ApiOperation({ summary: "Get B2B account details" })
  findOne(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.b2bAccountsService.findOne(user.tenantId, id);
  }

  @Put("b2b-accounts/:id")
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER, Role.FIELD_SALES_REP)
  @ApiOperation({ summary: "Update B2B account" })
  update(
    @Param("id") id: string,
    @Body() dto: Record<string, unknown>,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.b2bAccountsService.update(user.tenantId, id, dto);
  }

  @Get("b2b-accounts/:id/stats")
  @ApiOperation({ summary: "Get revenue stats for B2B account" })
  getStats(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.b2bAccountsService.getStats(user.tenantId, id);
  }
}
