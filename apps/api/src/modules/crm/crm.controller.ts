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
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { CrmService } from "./crm.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { JwtPayload } from "@delvion/types";
import { CreateDoctorDto } from "./dto/create-doctor.dto";
import { UpdateDoctorDto } from "./dto/update-doctor.dto";
import { LogVisitDto } from "./dto/log-visit.dto";
import { DoctorQueryDto } from "./dto/doctor-query.dto";
import { CreateLeadDto } from "./dto/create-lead.dto";
import { UpdateLeadStatusDto } from "./dto/update-lead-status.dto";
import { AddLeadNoteDto } from "./dto/add-lead-note.dto";

@ApiTags("crm")
@ApiBearerAuth()
@Controller("crm")
@UseGuards(JwtAuthGuard, TenantGuard)
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  // ── Doctors ───────────────────────────────────────────────────────────────

  @Get("doctors/stats")
  @ApiOperation({ summary: "Doctor engagement stats and top leaderboard" })
  getDoctorStats(@CurrentUser() user: JwtPayload) {
    return this.crmService.getDoctorStats(user.tenantId);
  }

  @Get("doctors")
  @ApiOperation({ summary: "List doctors with search and filters" })
  findAllDoctors(@CurrentUser() user: JwtPayload, @Query() query: DoctorQueryDto) {
    return this.crmService.findAllDoctors(user.tenantId, query);
  }

  @Post("doctors")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Add a new doctor" })
  createDoctor(@Body() dto: CreateDoctorDto, @CurrentUser() user: JwtPayload) {
    return this.crmService.createDoctor(dto, user.tenantId);
  }

  @Get("doctors/:id")
  @ApiOperation({ summary: "Get doctor details with recent visits" })
  findOneDoctor(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.crmService.findOneDoctor(id, user.tenantId);
  }

  @Put("doctors/:id")
  @ApiOperation({ summary: "Update doctor profile" })
  updateDoctor(
    @Param("id") id: string,
    @Body() dto: UpdateDoctorDto,
    @CurrentUser() user: JwtPayload
  ) {
    return this.crmService.updateDoctor(id, dto, user.tenantId);
  }

  @Post("doctors/:id/visits")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Log a visit to a doctor" })
  logVisit(
    @Param("id") id: string,
    @Body() dto: LogVisitDto,
    @CurrentUser() user: JwtPayload
  ) {
    return this.crmService.logVisit(id, dto, user.tenantId, user.sub);
  }

  @Get("doctors/:id/visits")
  @ApiOperation({ summary: "Get visit history for a doctor" })
  getVisits(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
    @Query("page") page?: string,
    @Query("limit") limit?: string
  ) {
    return this.crmService.getVisits(
      id,
      user.tenantId,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20
    );
  }

  // ── Leads ─────────────────────────────────────────────────────────────────

  @Get("leads/board")
  @ApiOperation({ summary: "Leads Kanban board grouped by status" })
  getLeadsBoard(@CurrentUser() user: JwtPayload) {
    return this.crmService.getLeadsBoard(user.tenantId);
  }

  @Get("leads/stats")
  @ApiOperation({ summary: "Lead pipeline stats" })
  getLeadStats(@CurrentUser() user: JwtPayload) {
    return this.crmService.getLeadStats(user.tenantId);
  }

  @Get("leads")
  @ApiOperation({ summary: "List leads with filters" })
  findAllLeads(
    @CurrentUser() user: JwtPayload,
    @Query("status") status?: string,
    @Query("source") source?: string,
    @Query("assignedToId") assignedToId?: string,
    @Query("search") search?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string
  ) {
    return this.crmService.findAllLeads(user.tenantId, {
      status,
      source,
      assignedToId,
      search,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post("leads")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a new lead" })
  createLead(@Body() dto: CreateLeadDto, @CurrentUser() user: JwtPayload) {
    return this.crmService.createLead(dto, user.tenantId, user.sub);
  }

  @Get("leads/:id")
  @ApiOperation({ summary: "Get lead details with notes" })
  findOneLead(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.crmService.findOneLead(id, user.tenantId);
  }

  @Patch("leads/:id/status")
  @ApiOperation({ summary: "Update lead status (pipeline stage)" })
  updateLeadStatus(
    @Param("id") id: string,
    @Body() dto: UpdateLeadStatusDto,
    @CurrentUser() user: JwtPayload
  ) {
    return this.crmService.updateLeadStatus(id, dto, user.tenantId);
  }

  @Post("leads/:id/notes")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Add a note to a lead" })
  addLeadNote(
    @Param("id") id: string,
    @Body() dto: AddLeadNoteDto,
    @CurrentUser() user: JwtPayload
  ) {
    return this.crmService.addLeadNote(id, dto, user.tenantId, user.sub);
  }

  // ── Campaigns ─────────────────────────────────────────────────────────────

  @Get("campaigns")
  @ApiOperation({ summary: "List all campaigns with optional filters" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "status", required: false, type: String })
  @ApiQuery({ name: "type", required: false, type: String })
  findAllCampaigns(
    @CurrentUser() user: JwtPayload,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("status") status?: string,
    @Query("type") type?: string
  ) {
    return this.crmService.findAllCampaigns(user.tenantId, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      status,
      type,
    });
  }

  @Post("campaigns")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a new marketing campaign" })
  createCampaign(@Body() dto: Record<string, unknown>, @CurrentUser() user: JwtPayload) {
    return this.crmService.createCampaign(
      dto as Parameters<typeof this.crmService.createCampaign>[0],
      user.tenantId,
      user.sub
    );
  }

  @Get("campaigns/:id/stats")
  @ApiOperation({ summary: "Get campaign performance stats" })
  getCampaignStats(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.crmService.getCampaignStats(id, user.tenantId);
  }

  @Put("campaigns/:id")
  @ApiOperation({ summary: "Update campaign details or status" })
  updateCampaign(
    @Param("id") id: string,
    @Body() dto: Record<string, unknown>,
    @CurrentUser() user: JwtPayload
  ) {
    return this.crmService.updateCampaign(id, dto, user.tenantId);
  }

  // ── Commissions ───────────────────────────────────────────────────────────

  @Get("commissions/summary")
  @ApiOperation({ summary: "Commission summary totals by status" })
  @ApiQuery({ name: "from", required: false, type: String })
  @ApiQuery({ name: "to", required: false, type: String })
  getCommissionSummary(
    @CurrentUser() user: JwtPayload,
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return this.crmService.getCommissionSummary(user.tenantId, from, to);
  }

  @Get("commissions")
  @ApiOperation({ summary: "List doctor commissions with filters" })
  @ApiQuery({ name: "doctorId", required: false, type: String })
  @ApiQuery({ name: "status", required: false, type: String })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  findCommissions(
    @CurrentUser() user: JwtPayload,
    @Query("doctorId") doctorId?: string,
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string
  ) {
    return this.crmService.findCommissions(user.tenantId, {
      doctorId,
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post("commissions")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a doctor commission record" })
  createCommission(@Body() dto: Record<string, unknown>, @CurrentUser() user: JwtPayload) {
    return this.crmService.createCommission(
      dto as Parameters<typeof this.crmService.createCommission>[0],
      user.tenantId
    );
  }

  @Post("commissions/:id/approve")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Approve a pending commission" })
  approveCommission(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.crmService.approveCommission(id, user.tenantId, user.sub);
  }

  @Post("commissions/:id/pay")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Mark a commission as paid" })
  markCommissionPaid(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.crmService.markCommissionPaid(id, user.tenantId, user.sub);
  }

  // ── Revenue Targets ───────────────────────────────────────────────────────

  @Get("targets/dashboard")
  @ApiOperation({ summary: "Active revenue targets with progress percentages" })
  getTargetDashboard(@CurrentUser() user: JwtPayload) {
    return this.crmService.getTargetDashboard(user.tenantId);
  }

  @Get("targets")
  @ApiOperation({ summary: "List all revenue targets" })
  findTargets(@CurrentUser() user: JwtPayload) {
    return this.crmService.findTargets(user.tenantId);
  }

  @Post("targets")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a revenue/orders/patients target" })
  createTarget(@Body() dto: Record<string, unknown>, @CurrentUser() user: JwtPayload) {
    return this.crmService.createTarget(
      dto as Parameters<typeof this.crmService.createTarget>[0],
      user.tenantId
    );
  }

  // ── Territory Heatmap ─────────────────────────────────────────────────────

  @Get("territory")
  @ApiOperation({ summary: "Doctor territory data grouped by city for heatmap" })
  getTerritoryData(@CurrentUser() user: JwtPayload) {
    return this.crmService.getTerritoryData(user.tenantId);
  }
}
