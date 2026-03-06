import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { HrService } from "./hr.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { JwtPayload } from "@delvion/types";

@ApiTags("hr")
@ApiBearerAuth()
@Controller("hr")
@UseGuards(JwtAuthGuard, TenantGuard)
export class HrController {
  constructor(private readonly hrService: HrService) {}

  // ── Employees ──────────────────────────────────────────────────────────────

  @Get("employees")
  @ApiOperation({ summary: "List employees" })
  getEmployees(@CurrentUser() user: JwtPayload) {
    return this.hrService.getEmployees(user.tenantId);
  }

  // ── Attendance ─────────────────────────────────────────────────────────────

  @Get("attendance")
  @ApiOperation({ summary: "Get attendance for a date (default: today)" })
  getAttendance(@CurrentUser() user: JwtPayload, @Query("date") date?: string) {
    return this.hrService.getAttendance(user.tenantId, date);
  }

  // ── Shifts ─────────────────────────────────────────────────────────────────

  @Get("shifts")
  @ApiOperation({ summary: "Get weekly shift grid" })
  @ApiQuery({ name: "weekStart", required: true })
  @ApiQuery({ name: "branchId", required: false })
  getWeekGrid(
    @CurrentUser() user: JwtPayload,
    @Query("weekStart") weekStart: string,
    @Query("branchId") branchId?: string
  ) {
    return this.hrService.getWeekGrid(user.tenantId, weekStart, branchId);
  }

  @Post("shifts")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a shift" })
  createShift(
    @Body() dto: { name: string; startTime: string; endTime: string; branchId: string; days?: string[] },
    @CurrentUser() user: JwtPayload
  ) {
    return this.hrService.createShift(dto, user.tenantId);
  }

  @Post("shifts/:id/assign")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Assign a shift to a user for a date" })
  assignShift(
    @Param("id") shiftId: string,
    @Body() body: { userId: string; date: string },
    @CurrentUser() user: JwtPayload
  ) {
    return this.hrService.assignShift(shiftId, body.userId, body.date, user.tenantId);
  }

  @Post("shifts/assignments/:id/checkin")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Check in for a shift assignment" })
  checkIn(@Param("id") assignmentId: string, @CurrentUser() user: JwtPayload) {
    return this.hrService.checkIn(assignmentId, user.tenantId);
  }

  @Post("shifts/assignments/:id/checkout")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Check out from a shift assignment" })
  checkOut(@Param("id") assignmentId: string, @CurrentUser() user: JwtPayload) {
    return this.hrService.checkOut(assignmentId, user.tenantId);
  }

  // ── Leave Types ────────────────────────────────────────────────────────────

  @Get("leave-types")
  @ApiOperation({ summary: "List leave types" })
  findLeaveTypes(@CurrentUser() user: JwtPayload) {
    return this.hrService.findLeaveTypes(user.tenantId);
  }

  @Post("leave-types")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a leave type" })
  createLeaveType(
    @Body() dto: { name: string; allowedDays: number; carryForward?: boolean },
    @CurrentUser() user: JwtPayload
  ) {
    return this.hrService.createLeaveType(dto, user.tenantId);
  }

  // ── Leave Requests ─────────────────────────────────────────────────────────

  @Get("leave-requests")
  @ApiOperation({ summary: "List leave requests" })
  @ApiQuery({ name: "userId", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  findLeaveRequests(
    @CurrentUser() user: JwtPayload,
    @Query("userId") userId?: string,
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string
  ) {
    return this.hrService.findLeaveRequests(user.tenantId, {
      userId,
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post("leave-requests")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Submit a leave request" })
  requestLeave(
    @Body() dto: { leaveTypeId: string; fromDate: string; toDate: string; days: number; reason?: string },
    @CurrentUser() user: JwtPayload
  ) {
    return this.hrService.requestLeave(dto, user.tenantId, user.sub);
  }

  @Post("leave-requests/:id/approve")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Approve a leave request" })
  approveLeave(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.hrService.approveLeave(id, user.tenantId, user.sub);
  }

  @Post("leave-requests/:id/reject")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Reject a leave request" })
  rejectLeave(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.hrService.rejectLeave(id, user.tenantId, user.sub);
  }

  // ── Leave Balance ──────────────────────────────────────────────────────────

  @Get("leave-balance/:userId")
  @ApiOperation({ summary: "Get leave balance for a user" })
  @ApiQuery({ name: "year", required: false })
  getLeaveBalance(
    @Param("userId") userId: string,
    @CurrentUser() user: JwtPayload,
    @Query("year") year?: string
  ) {
    return this.hrService.getLeaveBalance(userId, user.tenantId, year ? Number(year) : undefined);
  }

  // ── Payroll ────────────────────────────────────────────────────────────────

  @Get("payroll")
  @ApiOperation({ summary: "List all payroll runs" })
  findPayrollRuns(@CurrentUser() user: JwtPayload) {
    return this.hrService.findPayrollRuns(user.tenantId);
  }

  @Post("payroll")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a new payroll run for a month" })
  createPayrollRun(
    @Body() body: { month: number; year: number },
    @CurrentUser() user: JwtPayload
  ) {
    return this.hrService.createPayrollRun(body.month, body.year, user.tenantId, user.sub);
  }

  @Post("payroll/:id/approve")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Approve a payroll run" })
  approvePayrollRun(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.hrService.approvePayrollRun(id, user.tenantId, user.sub);
  }

  @Post("payroll/:id/paid")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Mark a payroll run as paid" })
  markPayrollPaid(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.hrService.markPayrollPaid(id, user.tenantId, user.sub);
  }

  @Get("payroll/:id/entries")
  @ApiOperation({ summary: "Get payroll entries for a run" })
  getPayrollEntries(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.hrService.getPayrollEntries(id, user.tenantId);
  }
}
