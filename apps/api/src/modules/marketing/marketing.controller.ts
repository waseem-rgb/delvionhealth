import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { JwtPayload } from "@delvion/types";
import { DoctorsMarketingService } from "./doctors.service";
import { CampaignsService } from "./campaigns.service";
import { CampsService } from "./camps.service";
import { PackagesService } from "./packages.service";
import { RecallService } from "./recall.service";
import { ContentService } from "./content.service";
import { OverviewService } from "./overview.service";

@ApiTags("marketing")
@ApiBearerAuth()
@Controller("marketing")
@UseGuards(JwtAuthGuard, TenantGuard)
export class MarketingController {
  constructor(
    private readonly doctorsService: DoctorsMarketingService,
    private readonly campaignsService: CampaignsService,
    private readonly campsService: CampsService,
    private readonly packagesService: PackagesService,
    private readonly recallService: RecallService,
    private readonly contentService: ContentService,
    private readonly overviewService: OverviewService,
  ) {}

  // ── Overview ──────────────────────────────────────────────────────────

  @Get("overview")
  @ApiOperation({ summary: "Marketing dashboard overview" })
  getOverview(@CurrentUser() user: JwtPayload) {
    return this.overviewService.getDashboard(user.tenantId);
  }

  // ── Referring Doctors ─────────────────────────────────────────────────

  @Get("doctors")
  @ApiOperation({ summary: "List referring doctors" })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "specialization", required: false })
  @ApiQuery({ name: "area", required: false })
  @ApiQuery({ name: "tier", required: false })
  @ApiQuery({ name: "dueFollowUp", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  listDoctors(
    @CurrentUser() user: JwtPayload,
    @Query("search") search?: string,
    @Query("specialization") specialization?: string,
    @Query("area") area?: string,
    @Query("tier") tier?: string,
    @Query("dueFollowUp") dueFollowUp?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.doctorsService.list(user.tenantId, {
      search, specialization, area, tier,
      dueFollowUp: dueFollowUp === "true",
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post("doctors")
  @ApiOperation({ summary: "Add referring doctor" })
  createDoctor(@CurrentUser() user: JwtPayload, @Body() dto: {
    name: string; specialization?: string; qualification?: string;
    clinicName?: string; clinicAddress?: string; area?: string; city?: string;
    phone?: string; whatsapp?: string; email?: string; notes?: string; nextFollowUpDate?: string;
  }) {
    return this.doctorsService.create(user.tenantId, dto, user.sub);
  }

  @Get("doctors/stats")
  @ApiOperation({ summary: "Doctor stats and top performers" })
  getDoctorStats(@CurrentUser() user: JwtPayload) {
    return this.doctorsService.getStats(user.tenantId);
  }

  @Get("doctors/due-followup")
  @ApiOperation({ summary: "Doctors with overdue follow-up" })
  getDueFollowUp(@CurrentUser() user: JwtPayload) {
    return this.doctorsService.getDueFollowUp(user.tenantId);
  }

  @Get("doctors/:id")
  @ApiOperation({ summary: "Get doctor profile" })
  getDoctor(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.doctorsService.getById(user.tenantId, id);
  }

  @Put("doctors/:id")
  @ApiOperation({ summary: "Update referring doctor" })
  updateDoctor(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: Record<string, unknown>) {
    return this.doctorsService.update(user.tenantId, id, dto);
  }

  @Get("doctors/:id/orders")
  @ApiOperation({ summary: "Orders referred by doctor" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  getDoctorOrders(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.doctorsService.getDoctorOrders(user.tenantId, id, page ? Number(page) : 1, limit ? Number(limit) : 20);
  }

  @Post("doctors/:id/contacts")
  @ApiOperation({ summary: "Log a contact/visit with doctor" })
  logContact(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: {
    type: string; notes?: string; outcome?: string; nextActionDate?: string; nextAction?: string;
  }) {
    return this.doctorsService.logContact(user.tenantId, id, dto, user.sub);
  }

  // ── Campaigns ─────────────────────────────────────────────────────────

  @Get("campaigns")
  @ApiOperation({ summary: "List campaigns" })
  @ApiQuery({ name: "type", required: false })
  @ApiQuery({ name: "status", required: false })
  listCampaigns(
    @CurrentUser() user: JwtPayload,
    @Query("type") type?: string,
    @Query("status") status?: string,
  ) {
    return this.campaignsService.list(user.tenantId, { type, status });
  }

  @Post("campaigns")
  @ApiOperation({ summary: "Create campaign" })
  createCampaign(@CurrentUser() user: JwtPayload, @Body() dto: {
    name: string; type: string; channel: string; targetAudience: string;
    subject?: string; messageTemplate?: string; scheduledAt?: string;
  }) {
    return this.campaignsService.create(user.tenantId, dto, user.sub);
  }

  @Get("campaigns/:id")
  @ApiOperation({ summary: "Get campaign detail" })
  getCampaign(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.campaignsService.getById(user.tenantId, id);
  }

  @Put("campaigns/:id")
  @ApiOperation({ summary: "Update campaign" })
  updateCampaign(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: Record<string, unknown>) {
    return this.campaignsService.update(user.tenantId, id, dto);
  }

  @Post("campaigns/:id/launch")
  @ApiOperation({ summary: "Launch campaign" })
  launchCampaign(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.campaignsService.launch(user.tenantId, id);
  }

  @Post("campaigns/:id/pause")
  @ApiOperation({ summary: "Pause/Resume campaign" })
  pauseCampaign(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.campaignsService.pause(user.tenantId, id);
  }

  @Get("campaigns/:id/members")
  @ApiOperation({ summary: "Get campaign members" })
  getCampaignMembers(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.campaignsService.getMembers(user.tenantId, id);
  }

  @Post("campaigns/:id/members")
  @ApiOperation({ summary: "Add members to campaign" })
  addCampaignMembers(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: {
    members: Array<{ audienceType: string; audienceId: string; name?: string; phone?: string; email?: string }>;
  }) {
    return this.campaignsService.addMembers(user.tenantId, id, dto.members);
  }

  @Post("campaigns/:id/doctor-members")
  @ApiOperation({ summary: "Add doctor members to campaign" })
  addDoctorMembers(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: { doctorIds: string[] }) {
    return this.campaignsService.addDoctorMembers(user.tenantId, id, dto.doctorIds);
  }

  @Patch("campaigns/:id/members/:memberId")
  @ApiOperation({ summary: "Update member status" })
  updateMemberStatus(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Param("memberId") memberId: string,
    @Body() dto: { status: string },
  ) {
    return this.campaignsService.updateMemberStatus(user.tenantId, id, memberId, dto.status);
  }

  // ── Health Camps ──────────────────────────────────────────────────────

  @Get("camps")
  @ApiOperation({ summary: "List health camps" })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "month", required: false })
  listCamps(
    @CurrentUser() user: JwtPayload,
    @Query("status") status?: string,
    @Query("month") month?: string,
  ) {
    return this.campsService.list(user.tenantId, { status, month });
  }

  @Post("camps")
  @ApiOperation({ summary: "Schedule health camp" })
  createCamp(@CurrentUser() user: JwtPayload, @Body() dto: {
    name: string; organiserName: string; organiserType?: string;
    address?: string; city?: string; campDate: string;
    startTime?: string; endTime?: string; expectedPax?: number;
    testsOffered?: string; pricePackage?: string;
    assignedStaff?: string; equipmentList?: string; notes?: string;
  }) {
    return this.campsService.create(user.tenantId, dto, user.sub);
  }

  @Get("camps/stats")
  @ApiOperation({ summary: "Camp stats for current month" })
  getCampStats(@CurrentUser() user: JwtPayload) {
    return this.campsService.getStats(user.tenantId);
  }

  @Get("camps/:id")
  @ApiOperation({ summary: "Get camp detail" })
  getCamp(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.campsService.getById(user.tenantId, id);
  }

  @Put("camps/:id")
  @ApiOperation({ summary: "Update camp" })
  updateCamp(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: Record<string, unknown>) {
    return this.campsService.update(user.tenantId, id, dto);
  }

  @Post("camps/:id/complete")
  @ApiOperation({ summary: "Mark camp as completed" })
  completeCamp(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: { actualPax: number }) {
    return this.campsService.complete(user.tenantId, id, dto.actualPax);
  }

  // ── Packages ──────────────────────────────────────────────────────────

  @Get("packages")
  @ApiOperation({ summary: "List lab packages" })
  @ApiQuery({ name: "category", required: false })
  @ApiQuery({ name: "active", required: false })
  listPackages(
    @CurrentUser() user: JwtPayload,
    @Query("category") category?: string,
    @Query("active") active?: string,
  ) {
    return this.packagesService.list(user.tenantId, {
      category,
      active: active !== undefined ? active === "true" : undefined,
    });
  }

  @Post("packages")
  @ApiOperation({ summary: "Create lab package" })
  createPackage(@CurrentUser() user: JwtPayload, @Body() dto: {
    name: string; code?: string; category?: string; description?: string;
    testIds?: string; mrpPrice: number; offerPrice?: number; corporatePrice?: number;
    validFrom?: string; validTo?: string; targetGender?: string;
    targetAgeMin?: number; targetAgeMax?: number; brochureUrl?: string;
  }) {
    return this.packagesService.create(user.tenantId, dto);
  }

  @Put("packages/:id")
  @ApiOperation({ summary: "Update package" })
  updatePackage(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: Record<string, unknown>) {
    return this.packagesService.update(user.tenantId, id, dto);
  }

  @Delete("packages/:id")
  @ApiOperation({ summary: "Deactivate package" })
  deactivatePackage(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.packagesService.deactivate(user.tenantId, id);
  }

  @Get("packages/:id/share")
  @ApiOperation({ summary: "Generate share message for package" })
  sharePackage(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.packagesService.generateShareMessage(user.tenantId, id);
  }

  // ── Patient Recall ────────────────────────────────────────────────────

  @Get("recall/rules")
  @ApiOperation({ summary: "Get recall rules with audience counts" })
  getRecallRules(@CurrentUser() user: JwtPayload) {
    return this.recallService.getRules(user.tenantId);
  }

  @Get("recall/queue")
  @ApiOperation({ summary: "Get pending recall queue" })
  getRecallQueue(@CurrentUser() user: JwtPayload) {
    return this.recallService.getQueue(user.tenantId);
  }

  @Post("recall/rules/:ruleType/send")
  @ApiOperation({ summary: "Trigger a recall rule" })
  triggerRecall(@CurrentUser() user: JwtPayload, @Param("ruleType") ruleType: string) {
    return this.recallService.triggerRule(user.tenantId, ruleType);
  }

  @Get("recall/stats")
  @ApiOperation({ summary: "Recall statistics" })
  getRecallStats(@CurrentUser() user: JwtPayload) {
    return this.recallService.getRecallStats(user.tenantId);
  }

  // ── Content Studio ────────────────────────────────────────────────────

  @Post("content/generate")
  @ApiOperation({ summary: "Generate marketing content with AI" })
  generateContent(@CurrentUser() user: JwtPayload, @Body() dto: {
    contentType: string; purpose: string; tone?: string;
    labName?: string; details?: string; language?: string;
  }) {
    return this.contentService.generate(user.tenantId, dto);
  }

  @Get("content/library")
  @ApiOperation({ summary: "Get saved content templates" })
  @ApiQuery({ name: "type", required: false })
  getContentLibrary(@CurrentUser() user: JwtPayload, @Query("type") type?: string) {
    return this.contentService.getLibrary(user.tenantId, { type });
  }

  @Post("content/library")
  @ApiOperation({ summary: "Save content to library" })
  saveContent(@CurrentUser() user: JwtPayload, @Body() dto: {
    name: string; type: string; purpose?: string; channel?: string;
    content: string; language?: string;
  }) {
    return this.contentService.saveToLibrary(user.tenantId, dto);
  }

  @Delete("content/library/:id")
  @ApiOperation({ summary: "Delete content template" })
  deleteContent(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.contentService.deleteFromLibrary(user.tenantId, id);
  }
}
