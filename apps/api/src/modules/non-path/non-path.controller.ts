import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Res,
} from "@nestjs/common";
import type { Response } from "express";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { JwtPayload } from "@delvion/types";
import { NonPathService } from "./non-path.service";
import { NonPathPdfService } from "./non-path-pdf.service";
import { NonPathTemplateSeedService } from "./template-seed.service";

@ApiTags("non-path")
@ApiBearerAuth()
@Controller("non-path")
@UseGuards(JwtAuthGuard, TenantGuard)
export class NonPathController {
  constructor(
    private readonly service: NonPathService,
    private readonly pdfService: NonPathPdfService,
    private readonly seedService: NonPathTemplateSeedService,
  ) {}

  // ── Test Classification ──────────────────────────────────────────────────

  @Post("classify-tests")
  @ApiOperation({ summary: "Classify all test catalog items by investigation type" })
  classifyTests(@CurrentUser() user: JwtPayload) {
    return this.service.classifyTests(user.tenantId);
  }

  // ── Templates ────────────────────────────────────────────────────────────

  @Get("templates")
  @ApiOperation({ summary: "List report templates" })
  @ApiQuery({ name: "type", required: false })
  listTemplates(@CurrentUser() user: JwtPayload, @Query("type") type?: string) {
    return this.service.listTemplates(user.tenantId, type);
  }

  @Get("templates/:id")
  @ApiOperation({ summary: "Get a specific template" })
  getTemplate(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.service.getTemplate(user.tenantId, id);
  }

  @Post("templates")
  @ApiOperation({ summary: "Create a custom report template" })
  createTemplate(@CurrentUser() user: JwtPayload, @Body() dto: {
    investigationType: string;
    testType?: string;
    templateName: string;
    methodology: string;
    sections: unknown;
    isDefault?: boolean;
  }) {
    return this.service.createTemplate(user.tenantId, user.sub, dto);
  }

  @Patch("templates/:id")
  @ApiOperation({ summary: "Update a report template" })
  updateTemplate(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.service.updateTemplate(user.tenantId, id, dto);
  }

  @Post("templates/seed")
  @ApiOperation({ summary: "Seed default report templates for this tenant" })
  seedTemplates(@CurrentUser() user: JwtPayload) {
    return this.seedService.seedTemplates(user.tenantId);
  }

  // ── Worklist ─────────────────────────────────────────────────────────────

  @Get("worklist")
  @ApiOperation({ summary: "Get non-path worklist" })
  @ApiQuery({ name: "type", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "date", required: false })
  @ApiQuery({ name: "search", required: false })
  getWorklist(
    @CurrentUser() user: JwtPayload,
    @Query("type") type?: string,
    @Query("status") status?: string,
    @Query("date") date?: string,
    @Query("search") search?: string,
  ) {
    return this.service.getWorklist(user.tenantId, { type, status, date, search });
  }

  @Get("worklist/stats")
  @ApiOperation({ summary: "Get worklist stats per category" })
  getWorklistStats(@CurrentUser() user: JwtPayload) {
    return this.service.getWorklistStats(user.tenantId);
  }

  @Get("verify/queue")
  @ApiOperation({ summary: "Get all reports pending verification" })
  getVerificationQueue(@CurrentUser() user: JwtPayload) {
    return this.service.getVerificationQueue(user.tenantId);
  }

  // ── Report CRUD ──────────────────────────────────────────────────────────

  @Get("report/by-order-item/:orderItemId")
  @ApiOperation({ summary: "Get report for a specific order item" })
  getReportByOrderItem(@CurrentUser() user: JwtPayload, @Param("orderItemId") orderItemId: string) {
    return this.service.getReportByOrderItem(user.tenantId, orderItemId);
  }

  @Get("report/:id")
  @ApiOperation({ summary: "Get a non-path report by ID" })
  getReport(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.service.getReport(user.tenantId, id);
  }

  @Get("report/:id/previous")
  @ApiOperation({ summary: "Get previous reports for same patient" })
  getPreviousReports(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.service.getReport(user.tenantId, id).then((r) =>
      this.service.getPreviousReports(user.tenantId, r.patientId, id),
    );
  }

  @Post("report")
  @ApiOperation({ summary: "Create a new non-path report" })
  createReport(@CurrentUser() user: JwtPayload, @Body() dto: {
    orderItemId: string;
    templateId?: string;
    clinicalHistory?: string;
    technique?: string;
    sectionData?: unknown;
    findings?: string;
    impression?: string;
    recommendation?: string;
    contrast?: boolean;
    contrastDose?: string;
    equipmentUsed?: string;
    imageCount?: number;
    reportedByName?: string;
    reportedByDesig?: string;
  }) {
    return this.service.createReport(user.tenantId, user.sub, dto);
  }

  @Patch("report/:id")
  @ApiOperation({ summary: "Update report (autosave)" })
  updateReport(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.service.updateReport(user.tenantId, id, dto);
  }

  @Post("report/:id/submit")
  @ApiOperation({ summary: "Submit report for verification" })
  submitReport(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: { reportedByDesig?: string }) {
    return this.service.submitReport(user.tenantId, id, {
      sub: user.sub,
      firstName: (user as unknown as Record<string, string>)["firstName"],
      lastName: (user as unknown as Record<string, string>)["lastName"],
    });
  }

  @Post("report/:id/verify")
  @ApiOperation({ summary: "Verify and finalise report" })
  verifyReport(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: { comment?: string },
  ) {
    return this.service.verifyReport(user.tenantId, id, {
      sub: user.sub,
      firstName: (user as unknown as Record<string, string>)["firstName"],
      lastName: (user as unknown as Record<string, string>)["lastName"],
    }, dto.comment);
  }

  @Post("report/:id/reopen")
  @ApiOperation({ summary: "Reopen report for corrections" })
  reopenReport(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.service.reopenReport(user.tenantId, id);
  }

  @Post("report/:id/dispatch")
  @ApiOperation({ summary: "Dispatch report via chosen channel" })
  dispatchReport(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: { channel: string },
  ) {
    return this.service.dispatchReport(user.tenantId, id, dto.channel);
  }

  @Get("report/:id/ai-suggest")
  @ApiOperation({ summary: "Get AI suggestion context for normal findings" })
  getAiSuggestion(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.service.getAiSuggestion(user.tenantId, id);
  }

  // ── PDF Endpoints ─────────────────────────────────────────────────────────

  @Get("report/:id/pdf")
  @ApiOperation({ summary: "Download individual investigation report PDF" })
  async getReportPdf(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const report = await this.service.getReport(user.tenantId, id);
    const pdf = await this.pdfService.generatePdf(user.tenantId, id);
    const filename = `DELViON_${report.testName.replace(/\s+/g, "_")}_${report.patient.mrn}_${new Date().toISOString().slice(0, 10)}.pdf`;
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Content-Length": pdf.length,
    });
    res.end(pdf);
  }

  @Post("report/:id/generate-pdf")
  @ApiOperation({ summary: "Force regenerate PDF" })
  async generatePdf(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    await this.pdfService.generatePdf(user.tenantId, id);
    return { message: "PDF generated" };
  }

  @Post("report/merged/:orderId")
  @ApiOperation({ summary: "Generate merged PDF for entire order" })
  async getMergedPdf(
    @CurrentUser() user: JwtPayload,
    @Param("orderId") orderId: string,
    @Res() res: Response,
  ) {
    const pdf = await this.pdfService.generateMergedPdf(user.tenantId, orderId);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="DELViON_Comprehensive_Report_${orderId.slice(-8)}.pdf"`,
      "Content-Length": pdf.length,
    });
    res.end(pdf);
  }

  @Get("report/:id/preview-html")
  @ApiOperation({ summary: "Get report preview as HTML" })
  async getPreviewHtml(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const html = await this.pdfService.generateReportHtml(user.tenantId, id);
    res.set({ "Content-Type": "text/html" });
    res.end(html);
  }
}
