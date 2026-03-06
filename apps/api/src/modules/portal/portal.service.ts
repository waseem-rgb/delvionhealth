import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class PortalService {
  constructor(private readonly prisma: PrismaService) {}

  async getBookings(patientId: string, tenantId: string) {
    return this.prisma.appointment.findMany({
      where: { patientId, tenantId },
      include: { branch: { select: { name: true, address: true } } },
      orderBy: { scheduledAt: "desc" },
      take: 10,
    });
  }

  async getReports(patientId: string, tenantId: string) {
    return this.prisma.labReport.findMany({
      where: { order: { patientId }, tenantId },
      include: { order: { select: { orderNumber: true, createdAt: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async trackSample(mrn: string, tenantId: string) {
    const patient = await this.prisma.patient.findFirst({ where: { mrn, tenantId } });
    if (!patient) throw new NotFoundException("Patient not found");
    return this.prisma.sample.findMany({
      where: { order: { patientId: patient.id }, tenantId },
      include: {
        order: { select: { orderNumber: true, createdAt: true } },
        movements: { orderBy: { movedAt: "desc" }, take: 5 },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
  }

  async getProfile(patientId: string, tenantId: string) {
    return this.prisma.patient.findFirst({
      where: { id: patientId, tenantId },
    });
  }

  async updateProfile(patientId: string, dto: Record<string, unknown>, tenantId: string) {
    return this.prisma.patient.update({ where: { id: patientId }, data: dto });
  }

  // ── Health Insights ───────────────────────────

  async getHealthInsights(patientId: string, tenantId: string) {
    const patient = await this.prisma.patient.findFirst({ where: { id: patientId, tenantId } });
    if (!patient) throw new NotFoundException("Patient not found");

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const results = await this.prisma.testResult.findMany({
      where: {
        tenantId,
        order: { patientId },
        createdAt: { gte: ninetyDaysAgo },
      },
      include: {
        orderItem: { include: { testCatalog: { select: { name: true, category: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Compute health score
    let healthScore = 100;
    for (const r of results) {
      if (r.interpretation === "CRITICAL") healthScore -= 10;
      else if (r.interpretation === "ABNORMAL") healthScore -= 5;
    }
    healthScore = Math.max(0, healthScore);

    // Risk flags: check if last 3 results for any test are all ABNORMAL
    const byTest = new Map<string, typeof results>();
    for (const r of results) {
      const key = r.orderItem.testCatalog.name;
      const existing = byTest.get(key) ?? [];
      existing.push(r);
      byTest.set(key, existing);
    }

    const riskFlags: string[] = [];
    for (const [testName, testResults] of byTest.entries()) {
      const last3 = testResults.slice(0, 3);
      if (last3.length === 3 && last3.every((r) => r.interpretation === "ABNORMAL")) {
        riskFlags.push(`${testName} trending abnormal`);
      }
      if (testResults[0]?.interpretation === "CRITICAL") {
        riskFlags.push(`Critical value: ${testName}`);
      }
    }

    // Recent results (last 5 per test)
    const recentResults = Array.from(byTest.entries())
      .slice(0, 5)
      .map(([testName, testResults]) => ({
        testName,
        value: testResults[0]?.value ?? "",
        interpretation: testResults[0]?.interpretation ?? "NORMAL",
        date: testResults[0]?.createdAt ?? new Date(),
      }));

    // Trends (per test, last 10 numeric values)
    const trends = Array.from(byTest.entries())
      .filter(([, r]) => r.some((x) => x.numericValue !== null))
      .slice(0, 5)
      .map(([testName, testResults]) => ({
        testName,
        dataPoints: testResults
          .filter((r) => r.numericValue !== null)
          .slice(0, 10)
          .map((r) => ({ date: r.createdAt, value: r.numericValue!, interpretation: r.interpretation })),
      }));

    // Update or create PatientHealthProfile
    await this.prisma.patientHealthProfile.upsert({
      where: { patientId },
      create: { tenantId, patientId, healthScore, riskFlags, lastUpdated: new Date() },
      update: { healthScore, riskFlags, lastUpdated: new Date() },
    });

    return { healthScore, riskFlags, recentResults, trends };
  }

  async getHealthTrends(patientId: string, testCatalogId: string, tenantId: string) {
    const results = await this.prisma.testResult.findMany({
      where: { tenantId, order: { patientId }, orderItem: { testCatalogId } },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    return results.map((r) => ({ date: r.createdAt, value: r.numericValue, interpretation: r.interpretation }));
  }

  // ── Family Profiles ───────────────────────────

  async getFamilyProfiles(primaryPatientId: string, tenantId: string) {
    return this.prisma.familyProfile.findMany({
      where: { primaryPatientId, tenantId },
      include: {
        memberPatient: { select: { id: true, firstName: true, lastName: true, mrn: true, dob: true, gender: true } },
      },
    });
  }

  async addFamilyMember(primaryPatientId: string, memberPatientId: string, relationship: string, tenantId: string) {
    const [primary, member] = await Promise.all([
      this.prisma.patient.findFirst({ where: { id: primaryPatientId, tenantId } }),
      this.prisma.patient.findFirst({ where: { id: memberPatientId, tenantId } }),
    ]);
    if (!primary) throw new NotFoundException("Primary patient not found");
    if (!member) throw new NotFoundException("Member patient not found");

    return this.prisma.familyProfile.create({
      data: { tenantId, primaryPatientId, memberPatientId, relationship },
      include: { memberPatient: { select: { firstName: true, lastName: true, mrn: true } } },
    });
  }

  async removeFamilyMember(id: string, primaryPatientId: string, tenantId: string) {
    await this.prisma.familyProfile.deleteMany({ where: { id, primaryPatientId, tenantId } });
    return { deleted: true };
  }
}
