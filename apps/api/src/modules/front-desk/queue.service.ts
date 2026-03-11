import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class QueueService {
  constructor(private readonly prisma: PrismaService) {}

  async getTokens(tenantId: string, date?: string) {
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    return this.prisma.queueToken.findMany({
      where: { tenantId, date: { gte: targetDate, lt: nextDay } },
      orderBy: { tokenNumber: "asc" },
    });
  }

  async issueToken(
    tenantId: string,
    data: {
      patientName: string;
      patientId?: string;
      orderId?: string;
      appointmentId?: string;
      type?: string;
      phone?: string;
      // Investigation fields
      departmentCode?: string;
      departmentName?: string;
      investigationType?: string;
      doctorId?: string;
      doctorName?: string;
      roomNumber?: string;
    },
  ) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Determine prefix: department shortCode takes priority for investigation tokens
    const type = data.type ?? "WALKIN";

    // Get department shortCode if departmentCode is provided
    let prefix: string;
    if (data.departmentCode) {
      const dept = await this.prisma.department.findFirst({
        where: { tenantId, code: data.departmentCode },
      });
      prefix = dept?.shortCode ?? data.departmentCode.substring(0, 3).toUpperCase();

      // Increment department token count
      if (dept) {
        await this.prisma.department.update({
          where: { id: dept.id },
          data: { currentTokenCount: { increment: 1 } },
        });
      }
    } else {
      prefix = type === "PRIORITY" ? "P" : type === "HOME" ? "H" : type === "CORPORATE" ? "C" : "A";
    }

    // Get next token number for today (scoped by department if applicable)
    const lastToken = await this.prisma.queueToken.findFirst({
      where: {
        tenantId,
        date: { gte: today, lt: tomorrow },
        ...(data.departmentCode ? { departmentCode: data.departmentCode } : {}),
      },
      orderBy: { tokenNumber: "desc" },
    });

    const nextNumber = (lastToken?.tokenNumber ?? 0) + 1;
    const tokenDisplay = `${prefix}${String(nextNumber).padStart(3, "0")}`;

    return this.prisma.queueToken.create({
      data: {
        tenantId,
        tokenNumber: nextNumber,
        tokenDisplay,
        date: today,
        patientId: data.patientId,
        patientName: data.patientName,
        orderId: data.orderId,
        appointmentId: data.appointmentId,
        type,
        status: "WAITING",
        phone: data.phone,
        departmentCode: data.departmentCode,
        departmentName: data.departmentName,
        investigationType: data.investigationType,
        doctorId: data.doctorId,
        doctorName: data.doctorName,
        roomNumber: data.roomNumber,
      },
    });
  }

  async issueInvestigationTokens(
    tenantId: string,
    orderId: string,
    patientName: string,
    patientId: string,
    phone: string,
    orderItems: Array<{ testCatalogId: string }>,
  ) {
    // Look up tests to find non-pathology ones
    const testIds = orderItems.map((i) => i.testCatalogId);
    const tests = await this.prisma.testCatalog.findMany({
      where: { id: { in: testIds }, tenantId },
    });

    const investigationTests = tests.filter((t) => t.investigationType && t.investigationType !== "PATHOLOGY");
    if (investigationTests.length === 0) return [];

    // Group by departmentCode
    const byDept = new Map<string, typeof investigationTests>();
    for (const test of investigationTests) {
      const key = test.departmentCode ?? test.investigationType ?? "GENERAL";
      if (!byDept.has(key)) byDept.set(key, []);
      byDept.get(key)!.push(test);
    }

    const tokens = [];
    for (const [deptCode, deptTests] of byDept.entries()) {
      const dept = await this.prisma.department.findFirst({
        where: { tenantId, code: deptCode },
        include: { staff: { where: { isAvailable: true } } },
      });

      const token = await this.issueToken(tenantId, {
        patientName,
        patientId,
        orderId,
        phone,
        type: "INVESTIGATION",
        departmentCode: deptCode,
        departmentName: dept?.name ?? deptCode,
        investigationType: deptTests[0].investigationType ?? undefined,
        doctorId: dept?.staff?.[0]?.userId ?? undefined,
        doctorName: dept?.staff?.[0]?.staffName ?? undefined,
      });
      tokens.push(token);
    }
    return tokens;
  }

  async callNext(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const next = await this.prisma.queueToken.findFirst({
      where: { tenantId, date: { gte: today, lt: tomorrow }, status: "WAITING" },
      orderBy: { tokenNumber: "asc" },
    });

    if (!next) return null;

    return this.prisma.queueToken.update({
      where: { id: next.id },
      data: { status: "CALLED", calledAt: new Date() },
    });
  }

  async callToken(tenantId: string, id: string) {
    return this.prisma.queueToken.update({
      where: { id },
      data: { status: "CALLED", calledAt: new Date() },
    });
  }

  async completeToken(tenantId: string, id: string) {
    const now = new Date();
    const token = await this.prisma.queueToken.findFirst({
      where: { id, tenantId },
    });
    const waitMinutes = token?.createdAt
      ? Math.round((now.getTime() - token.createdAt.getTime()) / 60000)
      : 0;

    return this.prisma.queueToken.update({
      where: { id },
      data: { status: "DONE", completedAt: now, waitMinutes },
    });
  }

  async getDisplayData(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [current, waiting] = await Promise.all([
      this.prisma.queueToken.findFirst({
        where: { tenantId, date: { gte: today, lt: tomorrow }, status: "CALLED" },
        orderBy: { calledAt: "desc" },
      }),
      this.prisma.queueToken.findMany({
        where: { tenantId, date: { gte: today, lt: tomorrow }, status: "WAITING" },
        orderBy: { tokenNumber: "asc" },
        take: 10,
      }),
    ]);

    const avgWait = await this.prisma.queueToken.aggregate({
      where: {
        tenantId,
        date: { gte: today, lt: tomorrow },
        status: "DONE",
        waitMinutes: { not: null },
      },
      _avg: { waitMinutes: true },
    });

    // Department-level display: group called tokens by department
    const calledByDept = await this.prisma.queueToken.findMany({
      where: {
        tenantId,
        date: { gte: today, lt: tomorrow },
        status: "CALLED",
        departmentCode: { not: null },
      },
      orderBy: { calledAt: "desc" },
    });

    // Deduplicate by departmentCode (latest per dept)
    const deptMap = new Map<string, typeof calledByDept[0]>();
    for (const t of calledByDept) {
      if (t.departmentCode && !deptMap.has(t.departmentCode)) {
        deptMap.set(t.departmentCode, t);
      }
    }

    return {
      currentToken: current,
      nextTokens: waiting,
      estimatedWait: Math.round(avgWait._avg.waitMinutes ?? 10),
      departmentTokens: Array.from(deptMap.values()),
    };
  }
}
