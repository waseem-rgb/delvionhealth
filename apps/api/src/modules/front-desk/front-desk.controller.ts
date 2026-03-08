import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards } from "@nestjs/common";
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
    appointmentId?: string; type?: string;
  }) {
    return this.queueService.issueToken(user.tenantId, dto);
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
