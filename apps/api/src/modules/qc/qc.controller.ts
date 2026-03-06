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

  // ── Dashboard Stats ───────────────────────────────────────────────────

  @Get("dashboard-stats")
  @ApiOperation({ summary: "QC dashboard statistics (30-day)" })
  getDashboardStats(@CurrentUser() user: JwtPayload) {
    return this.qcService.getDashboardStats(user.tenantId);
  }

  // ── Audit Entries ─────────────────────────────────────────────────────

  @Get("audit-entries")
  @ApiOperation({ summary: "List quality audit entries" })
  @ApiQuery({ name: "action", required: false })
  @ApiQuery({ name: "entityType", required: false })
  @ApiQuery({ name: "from", required: false })
  @ApiQuery({ name: "to", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  findAuditEntries(
    @CurrentUser() user: JwtPayload,
    @Query("action") action?: string,
    @Query("entityType") entityType?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
  ) {
    return this.qcService.findAuditEntries(user.tenantId, { action, entityType, from, to, page: page ? Number(page) : 1, limit: limit ? Number(limit) : 30 });
  }

  // ── Non-Conformances ──────────────────────────────────────────────────

  @Post("non-conformances")
  @ApiOperation({ summary: "Create non-conformance" })
  createNonConformance(@CurrentUser() user: JwtPayload, @Body() dto: { title: string; description?: string; category?: string; severity?: string; source?: string; assignedToId?: string }) {
    return this.qcService.createNonConformance(user.tenantId, user.sub, dto);
  }

  @Get("non-conformances")
  @ApiOperation({ summary: "List non-conformances" })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "severity", required: false })
  @ApiQuery({ name: "category", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  findNonConformances(
    @CurrentUser() user: JwtPayload,
    @Query("status") status?: string,
    @Query("severity") severity?: string,
    @Query("category") category?: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
  ) {
    return this.qcService.findNonConformances(user.tenantId, { status, severity, category, page: page ? Number(page) : 1, limit: limit ? Number(limit) : 20 });
  }

  @Put("non-conformances/:id")
  @ApiOperation({ summary: "Update non-conformance" })
  updateNonConformance(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: { status?: string; rootCause?: string; resolution?: string; capaId?: string; resolvedAt?: string; closedAt?: string }) {
    return this.qcService.updateNonConformance(id, user.tenantId, user.sub, dto);
  }

  // ── EQAS Rounds & Results ─────────────────────────────────────────────

  @Post("eqas-rounds")
  @ApiOperation({ summary: "Create EQAS round" })
  createEQASRound(@CurrentUser() user: JwtPayload, @Body() dto: { programName: string; roundNumber: string; year: number; startDate?: string; endDate?: string; notes?: string }) {
    return this.qcService.createEQASRound(user.tenantId, user.sub, dto);
  }

  @Get("eqas-rounds")
  @ApiOperation({ summary: "List EQAS rounds" })
  @ApiQuery({ name: "year", required: false, type: Number })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  findEQASRounds(
    @CurrentUser() user: JwtPayload,
    @Query("year") year?: number,
    @Query("status") status?: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
  ) {
    return this.qcService.findEQASRounds(user.tenantId, { year: year ? Number(year) : undefined, status, page: page ? Number(page) : 1, limit: limit ? Number(limit) : 20 });
  }

  @Post("eqas-rounds/:id/results")
  @ApiOperation({ summary: "Add results to EQAS round (calculates SDI)" })
  addEQASResults(@Param("id") id: string, @Body() dto: { results: { analyte: string; assignedValue?: number; reportedValue?: number; acceptableRange?: string; notes?: string }[] }) {
    return this.qcService.addEQASResults(id, dto.results);
  }

  // ── Instrument Maintenance Logs ───────────────────────────────────────

  @Post("maintenance-logs")
  @ApiOperation({ summary: "Create instrument maintenance log" })
  createMaintenanceLog(@CurrentUser() user: JwtPayload, @Body() dto: { instrumentId: string; type?: string; description?: string; performedAt?: string; nextDueAt?: string; notes?: string; status?: string }) {
    return this.qcService.createMaintenanceLog(user.tenantId, user.sub, dto);
  }

  @Get("maintenance-logs")
  @ApiOperation({ summary: "List instrument maintenance logs" })
  @ApiQuery({ name: "instrumentId", required: false })
  @ApiQuery({ name: "type", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  findMaintenanceLogs(
    @CurrentUser() user: JwtPayload,
    @Query("instrumentId") instrumentId?: string,
    @Query("type") type?: string,
    @Query("status") status?: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
  ) {
    return this.qcService.findMaintenanceLogs(user.tenantId, { instrumentId, type, status, page: page ? Number(page) : 1, limit: limit ? Number(limit) : 20 });
  }

  // ── Quality Documents ─────────────────────────────────────────────────

  @Post("documents")
  @ApiOperation({ summary: "Create quality document" })
  createDocument(@CurrentUser() user: JwtPayload, @Body() dto: { title: string; type?: string; category?: string; version?: string; content?: string; effectiveAt?: string; expiresAt?: string }) {
    return this.qcService.createDocument(user.tenantId, user.sub, dto);
  }

  @Get("documents")
  @ApiOperation({ summary: "List quality documents" })
  @ApiQuery({ name: "type", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  findDocuments(
    @CurrentUser() user: JwtPayload,
    @Query("type") type?: string,
    @Query("status") status?: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
  ) {
    return this.qcService.findDocuments(user.tenantId, { type, status, page: page ? Number(page) : 1, limit: limit ? Number(limit) : 20 });
  }

  @Post("documents/:id/approve")
  @ApiOperation({ summary: "Approve quality document" })
  approveDocument(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.qcService.approveDocument(id, user.tenantId, user.sub);
  }

  // ── AI CAPA Assist ────────────────────────────────────────────────────

  @Post("capa/ai-assist")
  @ApiOperation({ summary: "AI-powered CAPA recommendation" })
  aiCapaAssist(@CurrentUser() user: JwtPayload, @Body() dto: { description: string; rootCause?: string }) {
    return this.qcService.aiCapaAssist(user.tenantId, dto.description, dto.rootCause);
  }
}
