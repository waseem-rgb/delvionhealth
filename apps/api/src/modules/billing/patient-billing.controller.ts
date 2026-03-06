import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { PatientBillingService } from "./patient-billing.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "@delvion/types";
import type { JwtPayload } from "@delvion/types";

@ApiTags("patient-billing")
@ApiBearerAuth()
@Controller("billing/patient")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(
  Role.SUPER_ADMIN,
  Role.TENANT_ADMIN,
  Role.LAB_MANAGER,
  Role.FRONT_DESK,
  Role.FINANCE_EXECUTIVE,
)
export class PatientBillingController {
  constructor(
    private readonly patientBillingService: PatientBillingService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Create patient bill — order + invoice + payment" })
  createBill(
    @Body()
    body: {
      patientId: string;
      branchId?: string;
      tests: { testCatalogId: string; price?: number; concession?: number }[];
      paymentMode: string;
      amountPaid: number;
      rateListId?: string;
      organizationId?: string;
      notes?: string;
      priority?: string;
      collectionType?: string;
    },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.patientBillingService.createBill(user.tenantId, user.sub, {
      patientId: body.patientId,
      branchId: body.branchId ?? "",
      tests: body.tests,
      paymentMode: body.paymentMode,
      amountPaid: body.amountPaid,
      rateListId: body.rateListId,
      organizationId: body.organizationId,
      notes: body.notes,
      priority: body.priority,
      collectionType: body.collectionType,
    });
  }

  @Get("recent-tests")
  @ApiOperation({ summary: "Get recent tests ordered for a patient" })
  getRecentTests(
    @Query("patientId") patientId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.patientBillingService.getRecentTests(
      patientId,
      user.tenantId,
    );
  }
}
