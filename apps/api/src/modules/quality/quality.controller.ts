import { Controller, Get, Post, Put, Delete, Body, Param, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { QualityService } from "./quality.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "@delvion/types";
import type { JwtPayload } from "@delvion/types";

@ApiTags("quality")
@ApiBearerAuth()
@Controller("quality")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class QualityController {
  constructor(private readonly qualityService: QualityService) {}

  // ── Compliance Dashboard ──────────────────────────────────────────────

  @Get("compliance-stats")
  @ApiOperation({ summary: "Get compliance dashboard statistics" })
  @Roles(Role.TENANT_ADMIN, Role.SUPER_ADMIN, Role.LAB_MANAGER, Role.PATHOLOGIST)
  getComplianceStats(@CurrentUser() user: JwtPayload) {
    return this.qualityService.getComplianceStats(user.tenantId);
  }

  // ── Vault Summary ─────────────────────────────────────────────────────

  @Get("vault/summary")
  @ApiOperation({ summary: "Get document vault summary with expiry alerts" })
  @Roles(Role.TENANT_ADMIN, Role.SUPER_ADMIN, Role.LAB_MANAGER)
  getVaultSummary(@CurrentUser() user: JwtPayload) {
    return this.qualityService.getVaultSummary(user.tenantId);
  }

  // ── Compliance Certificates ───────────────────────────────────────────

  @Post("certs")
  @ApiOperation({ summary: "Add compliance certificate" })
  @Roles(Role.TENANT_ADMIN, Role.SUPER_ADMIN, Role.LAB_MANAGER)
  createCert(@CurrentUser() user: JwtPayload, @Body() dto: {
    name: string; category?: string; priority?: string; certNumber?: string;
    issuingAuthority?: string; issueDate?: string; expiryDate?: string;
    renewalCycle?: string; fileUrl?: string; fileSize?: number; notes?: string;
  }) {
    return this.qualityService.createCert(user.tenantId, user.sub, dto);
  }

  @Get("certs")
  @ApiOperation({ summary: "List compliance certificates" })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "category", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @Roles(Role.TENANT_ADMIN, Role.SUPER_ADMIN, Role.LAB_MANAGER, Role.PATHOLOGIST)
  findCerts(
    @CurrentUser() user: JwtPayload,
    @Query("status") status?: string,
    @Query("category") category?: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
  ) {
    return this.qualityService.findCerts(user.tenantId, { status, category, page: page ? Number(page) : 1, limit: limit ? Number(limit) : 20 });
  }

  @Put("certs/:id")
  @ApiOperation({ summary: "Update compliance certificate" })
  @Roles(Role.TENANT_ADMIN, Role.SUPER_ADMIN, Role.LAB_MANAGER)
  updateCert(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: {
    status?: string; certNumber?: string; issueDate?: string; expiryDate?: string;
    fileUrl?: string; fileSize?: number; notes?: string;
  }) {
    return this.qualityService.updateCert(id, user.tenantId, dto);
  }

  @Delete("certs/:id")
  @ApiOperation({ summary: "Delete compliance certificate" })
  @Roles(Role.TENANT_ADMIN, Role.SUPER_ADMIN)
  deleteCert(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.qualityService.deleteCert(id, user.tenantId);
  }

  // ── Quality Forms ─────────────────────────────────────────────────────

  @Post("forms/seed")
  @ApiOperation({ summary: "Seed default NABL quality forms for tenant" })
  @Roles(Role.TENANT_ADMIN, Role.SUPER_ADMIN)
  seedForms(@CurrentUser() user: JwtPayload) {
    return this.qualityService.seedDefaultForms(user.tenantId, user.sub);
  }

  @Post("forms")
  @ApiOperation({ summary: "Create quality form template" })
  @Roles(Role.TENANT_ADMIN, Role.SUPER_ADMIN, Role.LAB_MANAGER)
  createForm(@CurrentUser() user: JwtPayload, @Body() dto: {
    formCode: string; name: string; category?: string; type?: string;
    frequency?: string; automation?: string; description?: string; fields?: unknown;
  }) {
    return this.qualityService.createForm(user.tenantId, user.sub, dto);
  }

  @Get("forms/compliance-dashboard")
  @ApiOperation({ summary: "Get form compliance dashboard with stats, trends, and missed forms" })
  @Roles(Role.TENANT_ADMIN, Role.SUPER_ADMIN, Role.LAB_MANAGER, Role.PATHOLOGIST)
  getFormComplianceDashboard(@CurrentUser() user: JwtPayload) {
    return this.qualityService.getFormComplianceDashboard(user.tenantId);
  }

  @Get("forms/download-empty/:formCode")
  @ApiOperation({ summary: "Download blank PDF for a form template" })
  async downloadEmptyForm(
    @CurrentUser() user: JwtPayload,
    @Param("formCode") formCode: string,
    @Res() res: Response,
  ) {
    const pdf = await this.qualityService.generateEmptyFormPDF(user.tenantId, formCode);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${formCode}-blank.pdf"`,
      "Content-Length": pdf.length,
    });
    res.end(pdf);
  }

  @Get("forms/download-filled/:submissionId")
  @ApiOperation({ summary: "Download filled PDF for a form submission" })
  async downloadFilledForm(
    @CurrentUser() user: JwtPayload,
    @Param("submissionId") submissionId: string,
    @Res() res: Response,
  ) {
    const pdf = await this.qualityService.generateFilledFormPDF(user.tenantId, submissionId);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="submission-${submissionId}.pdf"`,
      "Content-Length": pdf.length,
    });
    res.end(pdf);
  }

  @Get("forms/compliance-report")
  @ApiOperation({ summary: "Download monthly compliance report PDF" })
  @ApiQuery({ name: "month", required: false, type: Number })
  @ApiQuery({ name: "year", required: false, type: Number })
  async downloadComplianceReport(
    @CurrentUser() user: JwtPayload,
    @Query("month") month?: number,
    @Query("year") year?: number,
    @Res() res?: Response,
  ) {
    const now = new Date();
    const m = month ? Number(month) : now.getMonth() + 1;
    const y = year ? Number(year) : now.getFullYear();
    const pdf = await this.qualityService.generateComplianceReportPDF(user.tenantId, m, y);
    res!.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="compliance-report-${y}-${String(m).padStart(2, "0")}.pdf"`,
      "Content-Length": pdf.length,
    });
    res!.end(pdf);
  }

  @Get("forms")
  @ApiOperation({ summary: "List quality form templates" })
  @ApiQuery({ name: "type", required: false })
  @ApiQuery({ name: "category", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  findForms(
    @CurrentUser() user: JwtPayload,
    @Query("type") type?: string,
    @Query("category") category?: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
  ) {
    return this.qualityService.findForms(user.tenantId, { type, category, page: page ? Number(page) : 1, limit: limit ? Number(limit) : 50 });
  }

  // ── Form Entries ──────────────────────────────────────────────────────

  @Post("form-entries")
  @ApiOperation({ summary: "Submit a form entry" })
  submitFormEntry(@CurrentUser() user: JwtPayload, @Body() dto: { formId: string; data: unknown; notes?: string }) {
    return this.qualityService.submitFormEntry(user.tenantId, user.sub, dto);
  }

  @Get("form-entries")
  @ApiOperation({ summary: "List form entries" })
  @ApiQuery({ name: "formId", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  findFormEntries(
    @CurrentUser() user: JwtPayload,
    @Query("formId") formId?: string,
    @Query("status") status?: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
  ) {
    return this.qualityService.findFormEntries(user.tenantId, { formId, status, page: page ? Number(page) : 1, limit: limit ? Number(limit) : 20 });
  }

  @Put("form-entries/:id/review")
  @ApiOperation({ summary: "Review/approve a form entry" })
  @Roles(Role.TENANT_ADMIN, Role.SUPER_ADMIN, Role.LAB_MANAGER, Role.PATHOLOGIST)
  reviewFormEntry(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: { status: string }) {
    return this.qualityService.reviewFormEntry(id, user.tenantId, user.sub, dto.status);
  }
}
