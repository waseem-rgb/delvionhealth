import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { InsuranceService } from "./insurance.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { JwtPayload } from "@delvion/types";

@ApiTags("insurance")
@ApiBearerAuth()
@Controller("insurance")
@UseGuards(JwtAuthGuard, TenantGuard)
export class InsuranceController {
  constructor(private readonly insuranceService: InsuranceService) {}

  @Get()
  @ApiOperation({ summary: "List insurance" })
  findAll(@CurrentUser() user: JwtPayload): Promise<unknown[]> {
    return this.insuranceService.findAll(user.tenantId);
  }
}
