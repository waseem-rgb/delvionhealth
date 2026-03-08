import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { CouponsService } from "./coupons.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { JwtPayload } from "@delvion/types";
import { Role } from "@delvion/types";

@ApiTags("coupons")
@ApiBearerAuth()
@Controller("coupons")
@UseGuards(JwtAuthGuard, TenantGuard)
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "List all coupons" })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("type") type?: string,
    @Query("isActive") isActive?: string,
  ) {
    return this.couponsService.findAll(user.tenantId, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      type,
      isActive,
    });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "Create a coupon" })
  create(@Body() dto: Record<string, unknown>, @CurrentUser() user: JwtPayload) {
    return this.couponsService.create(user.tenantId, dto, user.sub);
  }

  @Get(":id")
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "Get coupon details" })
  findOne(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.couponsService.findOne(user.tenantId, id);
  }

  @Put(":id")
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "Update coupon" })
  update(@Param("id") id: string, @Body() dto: Record<string, unknown>, @CurrentUser() user: JwtPayload) {
    return this.couponsService.update(user.tenantId, id, dto);
  }

  @Patch(":id/toggle")
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "Toggle coupon active/inactive" })
  toggle(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.couponsService.toggleActive(user.tenantId, id);
  }

  @Get(":id/usage")
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "Get coupon usage history" })
  getUsage(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.couponsService.getUsage(user.tenantId, id);
  }

  @Post("validate")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Validate a coupon code" })
  validate(@Body() dto: Record<string, unknown>, @CurrentUser() user: JwtPayload) {
    return this.couponsService.validateCoupon(user.tenantId, dto.code as string, {
      patientPhone: dto.patientPhone as string,
      orderAmount: dto.orderAmount as number,
      testIds: (dto.testIds as string[]) || [],
      patientGender: dto.patientGender as string | undefined,
      patientAge: dto.patientAge as number | undefined,
      isFirstVisit: dto.isFirstVisit as boolean | undefined,
    });
  }

  @Post("apply")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Apply coupon to an order (internal)" })
  apply(@Body() dto: Record<string, unknown>, @CurrentUser() user: JwtPayload) {
    return this.couponsService.applyCoupon(
      user.tenantId,
      dto.couponId as string,
      dto.orderId as string,
      dto.patientId as string,
      dto.patientPhone as string,
      dto.discountAmt as number,
      dto.orderTotal as number,
    );
  }
}
