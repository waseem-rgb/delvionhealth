import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class DepartmentService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string) {
    return this.prisma.department.findMany({
      where: { tenantId },
      include: { staff: true },
      orderBy: { name: "asc" },
    });
  }

  async create(tenantId: string, data: {
    code: string;
    name: string;
    shortCode: string;
    roomNumbers?: string[];
    avgDurationMinutes?: number;
  }) {
    return this.prisma.department.create({
      data: {
        tenantId,
        code: data.code,
        name: data.name,
        shortCode: data.shortCode,
        roomNumbers: data.roomNumbers ?? [],
        avgDurationMinutes: data.avgDurationMinutes ?? 15,
      },
      include: { staff: true },
    });
  }

  async update(tenantId: string, id: string, data: Partial<{
    name: string;
    shortCode: string;
    roomNumbers: string[];
    avgDurationMinutes: number;
    isActive: boolean;
  }>) {
    const dept = await this.prisma.department.findFirst({ where: { id, tenantId } });
    if (!dept) throw new NotFoundException("Department not found");
    return this.prisma.department.update({ where: { id }, data, include: { staff: true } });
  }

  async remove(tenantId: string, id: string) {
    const dept = await this.prisma.department.findFirst({ where: { id, tenantId } });
    if (!dept) throw new NotFoundException("Department not found");
    await this.prisma.department.delete({ where: { id } });
    return { success: true };
  }

  async addStaff(tenantId: string, departmentId: string, data: {
    staffName: string;
    role?: string;
    userId?: string;
    availableFrom?: string;
    availableTo?: string;
    avgPatientMins?: number;
  }) {
    const dept = await this.prisma.department.findFirst({ where: { id: departmentId, tenantId } });
    if (!dept) throw new NotFoundException("Department not found");
    return this.prisma.departmentStaff.create({
      data: {
        tenantId,
        departmentId,
        staffName: data.staffName,
        role: data.role ?? "TECHNICIAN",
        userId: data.userId,
        availableFrom: data.availableFrom,
        availableTo: data.availableTo,
        avgPatientMins: data.avgPatientMins ?? 10,
      },
    });
  }

  async updateStaff(tenantId: string, staffId: string, data: Partial<{
    staffName: string;
    role: string;
    isAvailable: boolean;
    availableFrom: string;
    availableTo: string;
    avgPatientMins: number;
  }>) {
    return this.prisma.departmentStaff.update({ where: { id: staffId }, data });
  }

  async removeStaff(tenantId: string, staffId: string) {
    await this.prisma.departmentStaff.delete({ where: { id: staffId } });
    return { success: true };
  }

  async getQueueSummary(tenantId: string, date?: string) {
    const today = date ? new Date(date) : new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const departments = await this.prisma.department.findMany({
      where: { tenantId, isActive: true },
      include: { staff: true },
    });

    const tokens = await this.prisma.queueToken.findMany({
      where: {
        tenantId,
        date: { gte: today, lt: tomorrow },
        departmentCode: { not: null },
      },
    });

    return departments.map((dept) => {
      const deptTokens = tokens.filter((t) => t.departmentCode === dept.code);
      const waiting = deptTokens.filter((t) => t.status === "WAITING");
      const called = deptTokens.find((t) => t.status === "CALLED");
      const availableStaff = dept.staff.filter((s) => s.isAvailable);
      const estimatedWait = waiting.length * (dept.avgDurationMinutes / Math.max(availableStaff.length, 1));
      return {
        ...dept,
        waitingCount: waiting.length,
        currentToken: called,
        estimatedWaitMinutes: Math.round(estimatedWait),
      };
    });
  }
}
