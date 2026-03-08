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
import { ReferringDoctorsService } from "./referring-doctors.service";

@ApiTags("revenue-crm")
@ApiBearerAuth()
@Controller("revenue-crm")
@UseGuards(JwtAuthGuard, TenantGuard)
export class ReferringDoctorsController {
  constructor(private readonly referringDoctorsService: ReferringDoctorsService) {}

  @Get("doctors")
  @ApiOperation({ summary: "List referring doctors with filters" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "tier", required: false })
  @ApiQuery({ name: "area", required: false })
  @ApiQuery({ name: "repId", required: false })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("search") search?: string,
    @Query("tier") tier?: string,
    @Query("area") area?: string,
    @Query("repId") repId?: string,
  ) {
    return this.referringDoctorsService.findAll(user.tenantId, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
      tier,
      area,
      repId,
    });
  }

  @Post("doctors")
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER, Role.FIELD_SALES_REP)
  @ApiOperation({ summary: "Create a referring doctor" })
  create(@Body() dto: Record<string, unknown>, @CurrentUser() user: JwtPayload) {
    return this.referringDoctorsService.create(user.tenantId, dto, user.sub);
  }

  @Get("doctors/due-followup")
  @ApiOperation({ summary: "Get doctors with due follow-ups" })
  getDueFollowups(@CurrentUser() user: JwtPayload) {
    return this.referringDoctorsService.getDueFollowups(user.tenantId);
  }

  @Get("doctors/:id")
  @ApiOperation({ summary: "Get 360-degree doctor profile" })
  findOne(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.referringDoctorsService.findOne(user.tenantId, id);
  }

  @Put("doctors/:id")
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER, Role.FIELD_SALES_REP)
  @ApiOperation({ summary: "Update referring doctor" })
  update(
    @Param("id") id: string,
    @Body() dto: Record<string, unknown>,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.referringDoctorsService.update(user.tenantId, id, dto);
  }

  @Get("doctors/:id/orders")
  @ApiOperation({ summary: "Get orders referred by this doctor" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  getOrders(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.referringDoctorsService.getOrders(user.tenantId, id, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get("doctors/:id/revshare")
  @ApiOperation({ summary: "Get revenue share ledger for doctor" })
  getRevShare(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.referringDoctorsService.getRevShare(user.tenantId, id);
  }

  @Post("doctors/:id/visits")
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER, Role.FIELD_SALES_REP)
  @ApiOperation({ summary: "Log a contact/visit with doctor" })
  logContact(
    @Param("id") id: string,
    @Body() dto: Record<string, unknown>,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.referringDoctorsService.logContact(user.tenantId, id, dto, user.sub);
  }
}
