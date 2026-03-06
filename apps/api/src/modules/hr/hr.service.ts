import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class HrService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Existing Methods ───────────────────────────────────────────────────────

  async getEmployees(tenantId: string) {
    return this.prisma.employee.findMany({
      where: { tenantId, isActive: true },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            isActive: true,
            lastLoginAt: true,
          },
        },
        branch: { select: { name: true } },
      },
      orderBy: { joiningDate: "asc" },
    });
  }

  async getAttendance(tenantId: string, dateStr?: string) {
    const target = dateStr ? new Date(dateStr) : new Date();
    const start = new Date(target);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(target);
    end.setUTCHours(23, 59, 59, 999);

    const attendances = await this.prisma.attendance.findMany({
      where: {
        tenantId,
        date: { gte: start, lte: end },
      },
      orderBy: { checkIn: "asc" },
    });

    if (attendances.length === 0) return [];

    const employeeIds = attendances.map((a) => a.employeeId);
    const employees = await this.prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      include: {
        user: { select: { firstName: true, lastName: true, role: true } },
      },
    });

    const empMap = new Map(employees.map((e) => [e.id, e]));

    return attendances.map((a) => ({
      ...a,
      employee: empMap.get(a.employeeId) ?? null,
    }));
  }

  // ── Shifts ─────────────────────────────────────────────────────────────────

  async createShift(
    dto: { name: string; startTime: string; endTime: string; branchId: string; days?: string[] },
    tenantId: string
  ) {
    return this.prisma.shift.create({
      data: { tenantId, branchId: dto.branchId, name: dto.name, startTime: dto.startTime, endTime: dto.endTime, days: dto.days ?? [] },
    });
  }

  async assignShift(shiftId: string, userId: string, date: string, tenantId: string) {
    return this.prisma.shiftAssignment.create({
      data: { tenantId, shiftId, userId, date: new Date(date), status: "SCHEDULED" as never },
      include: { shift: { select: { name: true, startTime: true, endTime: true } } },
    });
  }

  async getWeekGrid(tenantId: string, weekStart: string, branchId?: string) {
    const start = new Date(weekStart);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);

    const assignmentsWhere: Record<string, unknown> = { tenantId, date: { gte: start, lte: end } };

    const assignments = await this.prisma.shiftAssignment.findMany({
      where: assignmentsWhere,
      include: { shift: { select: { name: true, startTime: true, endTime: true, type: true } } },
    });

    const usersWhere: Record<string, unknown> = { tenantId, isActive: true };
    if (branchId) {
      // Filter by employees in branch
      const branchEmployees = await this.prisma.employee.findMany({
        where: { tenantId, branchId, isActive: true },
        select: { userId: true },
      });
      usersWhere["id"] = { in: branchEmployees.map((e) => e.userId) };
    }

    const users = await this.prisma.user.findMany({
      where: usersWhere,
      select: { id: true, firstName: true, lastName: true, role: true },
    });

    const grid = users.map((u) => {
      const days = Array.from({ length: 7 }, (_, i) => {
        const day = new Date(start);
        day.setDate(day.getDate() + i);
        const dayStr = day.toISOString().split("T")[0];
        const assignment = assignments.find(
          (a) => a.userId === u.id && a.date.toISOString().split("T")[0] === dayStr
        );
        return { date: dayStr, assignment: assignment ?? null };
      });
      return { user: u, days };
    });

    return grid;
  }

  async checkIn(assignmentId: string, tenantId: string) {
    return this.prisma.shiftAssignment.update({ where: { id: assignmentId }, data: { checkIn: new Date() } });
  }

  async checkOut(assignmentId: string, tenantId: string) {
    return this.prisma.shiftAssignment.update({
      where: { id: assignmentId },
      data: { checkOut: new Date(), status: "COMPLETED" as never },
    });
  }

  // ── Leave ──────────────────────────────────────────────────────────────────

  async createLeaveType(dto: { name: string; allowedDays: number; carryForward?: boolean }, tenantId: string) {
    return this.prisma.leaveType.create({
      data: { tenantId, name: dto.name, allowedDays: dto.allowedDays, carryForward: dto.carryForward ?? false },
    });
  }

  async findLeaveTypes(tenantId: string) {
    return this.prisma.leaveType.findMany({ where: { tenantId }, orderBy: { name: "asc" } });
  }

  async requestLeave(
    dto: { leaveTypeId: string; fromDate: string; toDate: string; days: number; reason?: string },
    tenantId: string,
    userId: string
  ) {
    return this.prisma.leaveRequest.create({
      data: {
        tenantId,
        userId,
        leaveTypeId: dto.leaveTypeId,
        fromDate: new Date(dto.fromDate),
        toDate: new Date(dto.toDate),
        days: dto.days,
        reason: dto.reason,
      },
      include: { leaveType: { select: { name: true } } },
    });
  }

  async findLeaveRequests(
    tenantId: string,
    query: { userId?: string; status?: string; page?: number; limit?: number }
  ) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = { tenantId };
    if (query.userId) where["userId"] = query.userId;
    if (query.status) where["status"] = query.status;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.leaveRequest.findMany({
        where,
        include: { leaveType: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.leaveRequest.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async approveLeave(id: string, tenantId: string, userId: string) {
    return this.prisma.leaveRequest.update({
      where: { id },
      data: { status: "APPROVED" as never, approvedById: userId, approvedAt: new Date() },
    });
  }

  async rejectLeave(id: string, tenantId: string, userId: string) {
    return this.prisma.leaveRequest.update({
      where: { id },
      data: { status: "REJECTED" as never, approvedById: userId, approvedAt: new Date() },
    });
  }

  async getLeaveBalance(userId: string, tenantId: string, year?: number) {
    const targetYear = year ?? new Date().getFullYear();
    const leaveTypes = await this.prisma.leaveType.findMany({ where: { tenantId } });
    const approvedLeaves = await this.prisma.leaveRequest.findMany({
      where: {
        tenantId,
        userId,
        status: "APPROVED" as never,
        fromDate: { gte: new Date(`${targetYear}-01-01`), lte: new Date(`${targetYear}-12-31`) },
      },
      include: { leaveType: true },
    });

    return leaveTypes.map((lt) => {
      const used = approvedLeaves.filter((l) => l.leaveTypeId === lt.id).reduce((s, l) => s + l.days, 0);
      return { leaveType: lt, allowed: lt.allowedDays, used, remaining: Math.max(0, lt.allowedDays - used) };
    });
  }

  // ── Payroll ────────────────────────────────────────────────────────────────

  async createPayrollRun(month: number, year: number, tenantId: string, userId: string) {
    const employees = await this.prisma.employee.findMany({
      where: { tenantId, isActive: true },
      include: { user: { select: { firstName: true, lastName: true, id: true } } },
    });

    // Count working days in month (approximate: 26 days)
    const workingDays = 26;

    // Get approved leaves for the month
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);
    const approvedLeaves = await this.prisma.leaveRequest.findMany({
      where: { tenantId, status: "APPROVED" as never, fromDate: { gte: monthStart, lte: monthEnd } },
    });

    const lopMap = new Map<string, number>();
    for (const leave of approvedLeaves) {
      const current = lopMap.get(leave.userId) ?? 0;
      lopMap.set(leave.userId, current + leave.days);
    }

    const entries = employees.map((emp) => {
      const monthlySalary = Number(emp.salary ?? 50000);
      const lopDays = lopMap.get(emp.userId) ?? 0;
      const presentDays = workingDays - lopDays;
      const grossSalary = (monthlySalary * presentDays) / workingDays;

      const basic = grossSalary * 0.4;
      const hra = grossSalary * 0.2;
      const conveyance = grossSalary * 0.1;
      const otherAllowances = grossSalary * 0.3;

      const pf = basic * 0.12;
      const esi = grossSalary <= 21000 ? grossSalary * 0.0075 : 0;
      const tds = grossSalary > 50000 ? grossSalary * 0.05 : 0;
      const otherDeductions = 0;
      const netSalary = grossSalary - pf - esi - tds - otherDeductions;

      return {
        tenantId,
        userId: emp.userId,
        basicSalary: Math.round(basic * 100) / 100,
        hra: Math.round(hra * 100) / 100,
        conveyance: Math.round(conveyance * 100) / 100,
        otherAllowances: Math.round(otherAllowances * 100) / 100,
        grossSalary: Math.round(grossSalary * 100) / 100,
        pf: Math.round(pf * 100) / 100,
        esi: Math.round(esi * 100) / 100,
        tds: Math.round(tds * 100) / 100,
        otherDeductions: 0,
        netSalary: Math.round(netSalary * 100) / 100,
        lopDays,
        presentDays,
        status: "DRAFT" as never,
      };
    });

    const totalGross = entries.reduce((s, e) => s + e.grossSalary, 0);
    const totalDeductions = entries.reduce((s, e) => s + e.pf + e.esi + e.tds, 0);
    const totalNet = entries.reduce((s, e) => s + e.netSalary, 0);

    return this.prisma.$transaction(async (tx) => {
      const run = await tx.payrollRun.create({
        data: { tenantId, month, year, status: "DRAFT" as never, totalGross, totalDeductions, totalNet },
      });
      await tx.payrollEntry.createMany({ data: entries.map((e) => ({ ...e, runId: run.id })) });
      return tx.payrollRun.findUnique({ where: { id: run.id }, include: { entries: { take: 5 } } });
    });
  }

  async findPayrollRuns(tenantId: string) {
    return this.prisma.payrollRun.findMany({
      where: { tenantId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });
  }

  async approvePayrollRun(runId: string, tenantId: string, userId: string) {
    return this.prisma.payrollRun.update({
      where: { id: runId },
      data: { status: "APPROVED" as never, approvedById: userId, approvedAt: new Date() },
    });
  }

  async markPayrollPaid(runId: string, tenantId: string, userId: string) {
    await this.prisma.payrollEntry.updateMany({ where: { runId, tenantId }, data: { status: "PAID" as never } });
    return this.prisma.payrollRun.update({
      where: { id: runId },
      data: { status: "PAID" as never, paidAt: new Date() },
    });
  }

  async getPayrollEntries(runId: string, tenantId: string) {
    return this.prisma.payrollEntry.findMany({
      where: { runId, tenantId },
      orderBy: { createdAt: "asc" },
    });
  }
}
