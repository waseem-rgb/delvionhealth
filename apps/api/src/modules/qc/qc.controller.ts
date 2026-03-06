import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { QcService } from "./qc.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { JwtPayload } from "@delvion/types";

@ApiTags("qc")
@ApiBearerAuth()
@Controller("qc")
@UseGuards(JwtAuthGuard, TenantGuard)
export class QcController {
  constructor(private readonly qcService: QcService) {}

  @Post("runs")
  @ApiOperation({ summary: "Record a QC run with Westgard rules" })
  recordRun(@CurrentUser() user: JwtPayload, @Body() dto: { testCatalogId: string; branchId?: string; level: string; measuredValue: number; mean: number; sd: number; reagentLotNumber?: string; instrumentId?: string; runAt?: string }) {
    return this.qcService.recordRun(dto, user.tenantId, user.sub);
  }

  @Get("runs")
  @ApiOperation({ summary: "List QC runs" })
  @ApiQuery({ name: "testCatalogId", required: false })
  @ApiQuery({ name: "level", required: false })
  @ApiQuery({ name: "from", required: false })
  @ApiQuery({ name: "to", required: false })
  @ApiQuery({ name: "result", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  findRuns(
    @CurrentUser() user: JwtPayload,
    @Query("testCatalogId") testCatalogId?: string,
    @Query("level") level?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("result") result?: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number
  ) {
    return this.qcService.findRuns(user.tenantId, { testCatalogId, level, from, to, result, page: page ? Number(page) : 1, limit: limit ? Number(limit) : 50 });
  }

  @Get("runs/levey-jennings")
  @ApiOperation({ summary: "Levey-Jennings data for chart" })
  @ApiQuery({ name: "testCatalogId", required: true })
  @ApiQuery({ name: "level", required: true })
  @ApiQuery({ name: "from", required: false })
  @ApiQuery({ name: "to", required: false })
  getLeveyJenningsData(
    @CurrentUser() user: JwtPayload,
    @Query("testCatalogId") testCatalogId: string,
    @Query("level") level: string,
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return this.qcService.getLeveyJenningsData(user.tenantId, testCatalogId, level, from, to);
  }

  @Post("capa")
  @ApiOperation({ summary: "Create CAPA" })
  createCAPA(@CurrentUser() user: JwtPayload, @Body() dto: { qcEntryId?: string; description: string; rootCause?: string; correctiveAction?: string; preventiveAction?: string; dueDate?: string; assignedToId: string }) {
    return this.qcService.createCAPA(dto, user.tenantId, user.sub);
  }

  @Get("capa")
  @ApiOperation({ summary: "List CAPAs" })
  @ApiQuery({ name: "status", required: false })
  findCAPAs(
    @CurrentUser() user: JwtPayload,
    @Query("status") status?: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number
  ) {
    return this.qcService.findCAPAs(user.tenantId, { status, page: page ? Number(page) : 1, limit: limit ? Number(limit) : 20 });
  }

  @Put("capa/:id")
  @ApiOperation({ summary: "Update CAPA" })
  updateCAPA(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: { rootCause?: string; correctiveAction?: string; preventiveAction?: string; status?: string; closedAt?: string }
  ) {
    return this.qcService.updateCAPA(id, dto, user.tenantId);
  }

  @Get("tat-report")
  @ApiOperation({ summary: "TAT analysis report" })
  @ApiQuery({ name: "from", required: false })
  @ApiQuery({ name: "to", required: false })
  getTATReport(@CurrentUser() user: JwtPayload, @Query("from") from?: string, @Query("to") to?: string) {
    return this.qcService.getTATReport(user.tenantId, from, to);
  }

  @Get("critical-values")
  @ApiOperation({ summary: "Critical value log with ack status" })
  getCriticalValueLog(
    @CurrentUser() user: JwtPayload,
    @Query("page") page?: number,
    @Query("limit") limit?: number
  ) {
    return this.qcService.getCriticalValueLog(user.tenantId, { page: page ? Number(page) : 1, limit: limit ? Number(limit) : 20 });
  }

  @Post("critical-values/:id/ack")
  @ApiOperation({ summary: "Acknowledge critical value" })
  acknowledgeCritical(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: { notes?: string }) {
    return this.qcService.acknowledgeCritical(id, user.tenantId, user.sub, dto.notes);
  }
}
