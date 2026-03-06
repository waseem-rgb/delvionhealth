import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { ResultEntryService } from "./result-entry.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "@delvion/types";
import type { JwtPayload } from "@delvion/types";

@ApiTags("lab-results")
@ApiBearerAuth()
@Controller("lab/results")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(
  Role.SUPER_ADMIN,
  Role.TENANT_ADMIN,
  Role.LAB_MANAGER,
  Role.LAB_TECHNICIAN,
  Role.PATHOLOGIST,
)
export class ResultEntryController {
  constructor(private readonly resultEntryService: ResultEntryService) {}

  @Post("validate")
  @ApiOperation({ summary: "Validate a single result value against reference ranges" })
  validateResult(
    @Body()
    body: {
      testCatalogId: string;
      value: string;
      age: number;
      gender: string;
    },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.resultEntryService.validateResult(
      body.testCatalogId,
      body.value,
      body.age,
      body.gender,
      user.tenantId,
    );
  }

  @Get(":orderId")
  @ApiOperation({ summary: "Get full result entry context for an order" })
  getResultEntry(
    @Param("orderId") orderId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.resultEntryService.getResultEntry(orderId, user.tenantId);
  }

  @Post(":orderId/draft")
  @ApiOperation({ summary: "Save draft results (does not change order status)" })
  saveResultDraft(
    @Param("orderId") orderId: string,
    @Body()
    body: {
      results: {
        orderItemId: string;
        value: string;
        unit?: string;
        parameterName?: string;
      }[];
      interpretation?: string;
    },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.resultEntryService.saveResultDraft(
      orderId,
      body.results,
      body.interpretation ?? null,
      user.sub,
      user.tenantId,
    );
  }

  @Post(":orderId/submit")
  @ApiOperation({ summary: "Submit results for approval" })
  submitResults(
    @Param("orderId") orderId: string,
    @Body()
    body: {
      results: {
        orderItemId: string;
        value: string;
        unit?: string;
        parameterName?: string;
      }[];
      interpretation?: string;
    },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.resultEntryService.submitResults(
      orderId,
      body.results,
      body.interpretation ?? null,
      user.sub,
      user.tenantId,
    );
  }

  @Post(":resultId/sign")
  @ApiOperation({ summary: "Sign a single result" })
  signResult(
    @Param("resultId") resultId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.resultEntryService.signResult(resultId, user.tenantId, user.sub);
  }

  @Get("compute-flag")
  @ApiOperation({ summary: "Compute flag from value and reference range" })
  computeFlag(
    @Query("value") value: string,
    @Query("range") range: string,
  ) {
    const flag = this.resultEntryService.computeFlag(parseFloat(value), range);
    return { flag };
  }
}
