import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { DiscountService } from "./discount.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "@delvion/types";
import type { JwtPayload } from "@delvion/types";

@ApiTags("discounts")
@ApiBearerAuth()
@Controller("discounts")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class DiscountController {
  constructor(private readonly discountService: DiscountService) {}

  // POST /discounts/apply
  @Post("apply")
  @Roles(
    Role.SUPER_ADMIN,
    Role.TENANT_ADMIN,
    Role.LAB_MANAGER,
    Role.FRONT_DESK,
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Apply a discount to an order (may require approval)",
  })
  apply(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      orderId: string;
      pct: number;
      reason?: string;
    },
  ) {
    return this.discountService.applyDiscount(
      body.orderId,
      body.pct,
      body.reason,
      user.sub,
      user.tenantId,
    );
  }

  // PUT /discounts/:id/approve
  @Put(":id/approve")
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "Approve a pending discount request" })
  approve(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
  ) {
    return this.discountService.approveDiscount(id, user.sub, user.tenantId);
  }

  // PUT /discounts/:id/reject
  @Put(":id/reject")
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "Reject a pending discount request" })
  reject(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() body: { reason?: string },
  ) {
    return this.discountService.rejectDiscount(
      id,
      body.reason,
      user.sub,
      user.tenantId,
    );
  }

  // GET /discounts/pending
  @Get("pending")
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "List all pending discount approvals" })
  getPending(@CurrentUser() user: JwtPayload) {
    return this.discountService.getPendingApprovals(user.tenantId);
  }
}
