import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { ResultsService } from "./results.service";
import { CreateResultDto } from "./dto/create-result.dto";
import { BulkCreateResultsDto } from "./dto/bulk-create-results.dto";
import { VerifyResultDto } from "./dto/verify-result.dto";
import { ValidateResultDto } from "./dto/validate-result.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "@delvion/types";
import type { JwtPayload } from "@delvion/types";

@ApiTags("results")
@ApiBearerAuth()
@Controller("results")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class ResultsController {
  constructor(private readonly resultsService: ResultsService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.LAB_MANAGER, Role.LAB_TECHNICIAN, Role.PATHOLOGIST)
  @ApiOperation({ summary: "Enter a single result" })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateResultDto) {
    return this.resultsService.create(dto, user.tenantId, user.sub);
  }

  @Post("bulk")
  @Roles(Role.SUPER_ADMIN, Role.LAB_MANAGER, Role.LAB_TECHNICIAN, Role.PATHOLOGIST)
  @ApiOperation({ summary: "Bulk-enter results" })
  bulkCreate(@CurrentUser() user: JwtPayload, @Body() dto: BulkCreateResultsDto) {
    return this.resultsService.bulkCreate(dto, user.tenantId, user.sub);
  }

  @Post("verify")
  @Roles(Role.SUPER_ADMIN, Role.LAB_MANAGER, Role.LAB_TECHNICIAN)
  @ApiOperation({ summary: "Verify results" })
  verify(@CurrentUser() user: JwtPayload, @Body() dto: VerifyResultDto) {
    return this.resultsService.verify(dto, user.tenantId, user.sub);
  }

  @Post("validate")
  @Roles(Role.SUPER_ADMIN, Role.PATHOLOGIST)
  @ApiOperation({ summary: "Pathologist sign-off (validate) results" })
  validate(@CurrentUser() user: JwtPayload, @Body() dto: ValidateResultDto) {
    return this.resultsService.validate(dto, user.tenantId, user.sub);
  }

  @Get("pending")
  @ApiOperation({ summary: "Get pending results worklist" })
  @ApiQuery({ name: "branchId", required: false })
  getPendingResults(
    @CurrentUser() user: JwtPayload,
    @Query("branchId") branchId?: string
  ) {
    return this.resultsService.getPendingResults(user.tenantId, branchId);
  }

  @Get("order/:orderId")
  @ApiOperation({ summary: "Get results for an order" })
  getResultsByOrder(
    @CurrentUser() user: JwtPayload,
    @Param("orderId") orderId: string
  ) {
    return this.resultsService.getResultsByOrder(orderId, user.tenantId);
  }

  @Get("patient/:patientId/history")
  @ApiOperation({ summary: "Get result history for a patient + test" })
  @ApiQuery({ name: "testCatalogId", required: true })
  @ApiQuery({ name: "limit", required: false, type: Number })
  getPatientResultHistory(
    @CurrentUser() user: JwtPayload,
    @Param("patientId") patientId: string,
    @Query("testCatalogId") testCatalogId: string,
    @Query("limit") limit?: number
  ) {
    return this.resultsService.getPatientResultHistory(
      patientId,
      testCatalogId,
      user.tenantId,
      limit ? Number(limit) : 10
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "Get single result" })
  findOne(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.resultsService.findOne(user.tenantId, id);
  }
}
