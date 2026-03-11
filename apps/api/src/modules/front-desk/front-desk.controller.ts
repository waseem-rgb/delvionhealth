import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards, Res } from "@nestjs/common";
import type { Response } from "express";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { JwtPayload } from "@delvion/types";
import { FrontDeskService } from "./front-desk.service";
import { QueueService } from "./queue.service";
import { PhlebScheduleService } from "./phleb-schedule.service";
import { PriceEnquiryService } from "./price-enquiry.service";
import { NotificationLogService } from "./notification-log.service";
import { DepartmentService } from "./department.service";
import { TokenPdfService } from "./token-pdf.service";

@ApiTags("front-desk")
@ApiBearerAuth()
@Controller("front-desk")
@UseGuards(JwtAuthGuard, TenantGuard)
export class FrontDeskController {
  constructor(
    private readonly frontDeskService: FrontDeskService,
    private readonly queueService: QueueService,
    private readonly phlebScheduleService: PhlebScheduleService,
    private readonly priceEnquiryService: PriceEnquiryService,
    private readonly notificationLogService: NotificationLogService,
    private readonly departmentService: DepartmentService,
    private readonly tokenPdfService: TokenPdfService,
  ) {}

  // ── Overview ────────────────────────────────────────────────────────────

  @Get("overview")
  @ApiOperation({ summary: "Front desk dashboard overview" })
  getOverview(@CurrentUser() user: JwtPayload) {
    return this.frontDeskService.getOverview(user.tenantId);
  }

  // ── Queue & Tokens ──────────────────────────────────────────────────────

  @Get("queue")
  @ApiOperation({ summary: "List queue tokens for a date" })
  @ApiQuery({ name: "date", required: false })
  getQueue(@CurrentUser() user: JwtPayload, @Query("date") date?: string) {
    return this.queueService.getTokens(user.tenantId, date);
  }

  @Post("queue/issue")
  @ApiOperation({ summary: "Issue new queue token" })
  issueToken(@CurrentUser() user: JwtPayload, @Body() dto: {
    patientName: string; patientId?: string; orderId?: string;
    appointmentId?: string; type?: string; phone?: string;
    departmentCode?: string; departmentName?: string; investigationType?: string;
    doctorId?: string; doctorName?: string; roomNumber?: string;
  }) {
    return this.queueService.issueToken(user.tenantId, dto);
  }

  @Post("queue/issue-investigation")
  @ApiOperation({ summary: "Issue investigation tokens for non-pathology tests in an order" })
  issueInvestigationTokens(@CurrentUser() user: JwtPayload, @Body() dto: {
    orderId: string; patientName: string; patientId: string; phone?: string;
    orderItems: Array<{ testCatalogId: string }>;
  }) {
    return this.queueService.issueInvestigationTokens(
      user.tenantId, dto.orderId, dto.patientName, dto.patientId, dto.phone ?? "", dto.orderItems,
    );
  }

  @Get("queue/next")
  @ApiOperation({ summary: "Get next waiting token" })
  getNextToken(@CurrentUser() user: JwtPayload) {
    return this.queueService.callNext(user.tenantId);
  }

  @Get("queue/display")
  @ApiOperation({ summary: "Queue display data for waiting area screen" })
  getQueueDisplay(@CurrentUser() user: JwtPayload) {
    return this.queueService.getDisplayData(user.tenantId);
  }

  @Patch("queue/:id/call")
  @ApiOperation({ summary: "Call a specific token" })
  callToken(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.queueService.callToken(user.tenantId, id);
  }

  @Patch("queue/:id/complete")
  @ApiOperation({ summary: "Mark token as done" })
  completeToken(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.queueService.completeToken(user.tenantId, id);
  }

  @Get("queue/:id/pdf")
  @ApiOperation({ summary: "Download token slip as PDF" })
  async getTokenPdf(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const pdf = await this.tokenPdfService.generatePdf(user.tenantId, id);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="token-${id.slice(-8)}.pdf"`,
      "Content-Length": pdf.length,
    });
    res.end(pdf);
  }

  @Get("queue/:id/slip-html")
  @ApiOperation({ summary: "Get token slip as HTML (for preview/print)" })
  async getTokenSlipHtml(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const html = await this.tokenPdfService.generateTokenSlipHtml(user.tenantId, id);
    res.set({ "Content-Type": "text/html" });
    res.end(html);
  }

  // ── Phlebotomist Schedule ───────────────────────────────────────────────

  @Get("phleb-schedule")
  @ApiOperation({ summary: "Get phlebotomist schedule for date range" })
  @ApiQuery({ name: "from", required: false })
  @ApiQuery({ name: "to", required: false })
  getPhlebSchedule(
    @CurrentUser() user: JwtPayload,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.phlebScheduleService.getSchedule(user.tenantId, from, to);
  }

  @Post("phleb-schedule")
  @ApiOperation({ summary: "Add phlebotomist schedule entry" })
  createPhlebSchedule(@CurrentUser() user: JwtPayload, @Body() dto: {
    phlebId: string; phlebName: string; date: string;
    shiftStart: string; shiftEnd: string; maxSlotsPerDay?: number; notes?: string;
  }) {
    return this.phlebScheduleService.create(user.tenantId, dto);
  }

  @Put("phleb-schedule/:id")
  @ApiOperation({ summary: "Update phlebotomist schedule" })
  updatePhlebSchedule(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.phlebScheduleService.update(user.tenantId, id, dto);
  }

  @Delete("phleb-schedule/:id")
  @ApiOperation({ summary: "Remove phlebotomist schedule" })
  removePhlebSchedule(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.phlebScheduleService.remove(user.tenantId, id);
  }

  @Get("phleb-schedule/available")
  @ApiOperation({ summary: "Get available phlebotomists for a date/slot" })
  @ApiQuery({ name: "date", required: true })
  @ApiQuery({ name: "slot", required: false })
  getAvailablePhlebs(
    @CurrentUser() user: JwtPayload,
    @Query("date") date: string,
    @Query("slot") slot?: string,
  ) {
    return this.phlebScheduleService.getAvailable(user.tenantId, date, slot);
  }

  // ── Price Enquiry ───────────────────────────────────────────────────────

  @Post("price-enquiry")
  @ApiOperation({ summary: "Log a price enquiry" })
  createPriceEnquiry(@CurrentUser() user: JwtPayload, @Body() dto: {
    customerName?: string; phone?: string; testIds?: string;
    testNames?: string; totalAmount?: number; notes?: string;
  }) {
    return this.priceEnquiryService.create(user.tenantId, {
      ...dto,
      createdById: user.sub,
    });
  }

  @Get("price-enquiry")
  @ApiOperation({ summary: "List price enquiries" })
  @ApiQuery({ name: "month", required: false })
  listPriceEnquiries(
    @CurrentUser() user: JwtPayload,
    @Query("month") month?: string,
  ) {
    return this.priceEnquiryService.list(user.tenantId, month);
  }

  @Patch("price-enquiry/:id/convert")
  @ApiOperation({ summary: "Mark enquiry as converted" })
  convertEnquiry(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: { orderId: string },
  ) {
    return this.priceEnquiryService.markConverted(user.tenantId, id, dto.orderId);
  }

  // ── Departments ─────────────────────────────────────────────────────────

  @Get("departments")
  @ApiOperation({ summary: "List departments" })
  getDepartments(@CurrentUser() user: JwtPayload) {
    return this.departmentService.list(user.tenantId);
  }

  @Get("departments/queue-summary")
  @ApiOperation({ summary: "Queue summary per department" })
  @ApiQuery({ name: "date", required: false })
  getDeptQueueSummary(@CurrentUser() user: JwtPayload, @Query("date") date?: string) {
    return this.departmentService.getQueueSummary(user.tenantId, date);
  }

  @Post("departments")
  @ApiOperation({ summary: "Create department" })
  createDepartment(@CurrentUser() user: JwtPayload, @Body() dto: {
    code: string; name: string; shortCode: string; roomNumbers?: string[]; avgDurationMinutes?: number;
  }) {
    return this.departmentService.create(user.tenantId, dto);
  }

  @Patch("departments/:id")
  @ApiOperation({ summary: "Update department" })
  updateDepartment(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: Record<string, unknown>) {
    return this.departmentService.update(user.tenantId, id, dto as any);
  }

  @Delete("departments/:id")
  @ApiOperation({ summary: "Delete department" })
  removeDepartment(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.departmentService.remove(user.tenantId, id);
  }

  @Post("departments/:id/staff")
  @ApiOperation({ summary: "Add staff to department" })
  addDeptStaff(@CurrentUser() user: JwtPayload, @Param("id") departmentId: string, @Body() dto: {
    staffName: string; role?: string; userId?: string; availableFrom?: string; availableTo?: string; avgPatientMins?: number;
  }) {
    return this.departmentService.addStaff(user.tenantId, departmentId, dto);
  }

  @Patch("departments/staff/:staffId")
  @ApiOperation({ summary: "Update department staff" })
  updateDeptStaff(@CurrentUser() user: JwtPayload, @Param("staffId") staffId: string, @Body() dto: Record<string, unknown>) {
    return this.departmentService.updateStaff(user.tenantId, staffId, dto as any);
  }

  @Delete("departments/staff/:staffId")
  @ApiOperation({ summary: "Remove department staff" })
  removeDeptStaff(@CurrentUser() user: JwtPayload, @Param("staffId") staffId: string) {
    return this.departmentService.removeStaff(user.tenantId, staffId);
  }

  // ── Notification Logs ───────────────────────────────────────────────────

  @Get("notifications/log")
  @ApiOperation({ summary: "Get notification logs" })
  @ApiQuery({ name: "patientId", required: false })
  @ApiQuery({ name: "channel", required: false })
  @ApiQuery({ name: "type", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  getNotificationLogs(
    @CurrentUser() user: JwtPayload,
    @Query("patientId") patientId?: string,
    @Query("channel") channel?: string,
    @Query("type") type?: string,
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.notificationLogService.getLogs(user.tenantId, {
      patientId,
      channel,
      type,
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
