import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export interface RecallRule {
  id: string;
  name: string;
  description: string;
  triggerType: string;
  channel: string;
  messageTemplate: string;
  audienceCount: number;
  enabled: boolean;
}

@Injectable()
export class RecallService {
  constructor(private readonly prisma: PrismaService) {}

  async getRules(tenantId: string): Promise<RecallRule[]> {
    const now = new Date();

    // 6-month routine recall
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const routineCount = await this.prisma.patient.count({
      where: {
        tenantId,
        isActive: true,
        orders: { every: { createdAt: { lt: sixMonthsAgo } } },
        NOT: { orders: { none: {} } },
      },
    });

    // Birthday recall (next 7 days)
    const birthdayCount = await this.countUpcomingBirthdays(tenantId, 7);

    // Retest reminder (patients with results > 90 days ago — simplified)
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const retestCount = await this.prisma.patient.count({
      where: {
        tenantId,
        isActive: true,
        orders: {
          some: {
            createdAt: { gte: ninetyDaysAgo, lte: new Date(now.getTime() - 80 * 86400000) },
          },
        },
      },
    });

    // Annual renewal (11 months ago)
    const elevenMonthsAgo = new Date(now);
    elevenMonthsAgo.setMonth(elevenMonthsAgo.getMonth() - 11);
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const renewalCount = await this.prisma.patient.count({
      where: {
        tenantId,
        isActive: true,
        orders: {
          some: { createdAt: { gte: twelveMonthsAgo, lte: elevenMonthsAgo } },
        },
      },
    });

    return [
      {
        id: "routine-6month",
        name: "6-Month Routine Recall",
        description: "Patients with no order in the last 6 months",
        triggerType: "RECALL",
        channel: "WHATSAPP",
        messageTemplate: "Dear {name}, it's been a while since your last visit. Time for your routine health check. Book now!",
        audienceCount: routineCount,
        enabled: true,
      },
      {
        id: "retest-reminder",
        name: "Retest Reminder — Abnormal Results",
        description: "Patients who had tests 90 days ago and may need follow-up",
        triggerType: "RETEST",
        channel: "WHATSAPP",
        messageTemplate: "Dear {name}, your doctor may recommend a follow-up test. Please schedule your next visit.",
        audienceCount: retestCount,
        enabled: true,
      },
      {
        id: "birthday-offer",
        name: "Birthday Health Offer",
        description: "Patients with birthdays in the next 7 days",
        triggerType: "BIRTHDAY",
        channel: "WHATSAPP",
        messageTemplate: "Happy Birthday {name}! Get 20% off on any health check package this month.",
        audienceCount: birthdayCount,
        enabled: true,
      },
      {
        id: "annual-renewal",
        name: "Annual Health Check Renewal",
        description: "Last annual checkup was approximately 11 months ago",
        triggerType: "RENEWAL",
        channel: "SMS",
        messageTemplate: "Dear {name}, it's almost a year since your last comprehensive health check. Time to renew!",
        audienceCount: renewalCount,
        enabled: false,
      },
    ];
  }

  async getQueue(tenantId: string) {
    return this.prisma.patientEngagement.findMany({
      where: { tenantId, status: "PENDING" },
      orderBy: { triggerDate: "asc" },
      take: 100,
    });
  }

  async triggerRule(tenantId: string, ruleType: string) {
    const now = new Date();
    let patients: Array<{ id: string; firstName: string; lastName: string; phone: string }> = [];

    if (ruleType === "routine-6month") {
      const sixMonthsAgo = new Date(now);
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      patients = await this.prisma.patient.findMany({
        where: {
          tenantId,
          isActive: true,
          orders: { every: { createdAt: { lt: sixMonthsAgo } } },
          NOT: { orders: { none: {} } },
        },
        select: { id: true, firstName: true, lastName: true, phone: true },
        take: 500,
      });
    } else if (ruleType === "birthday-offer") {
      patients = await this.getUpcomingBirthdayPatients(tenantId, 7);
    }

    // Create engagement records
    const engagements = patients.map((p) => ({
      tenantId,
      patientId: p.id,
      type: ruleType === "birthday-offer" ? "BIRTHDAY" : "RECALL",
      triggerDate: now,
      channel: "WHATSAPP",
      status: "SENT",
      sentAt: now,
    }));

    if (engagements.length > 0) {
      await this.prisma.patientEngagement.createMany({ data: engagements });
    }

    return { sent: engagements.length, patients: patients.slice(0, 10) };
  }

  async getRecallStats(tenantId: string) {
    const [total, sent, responded, converted] = await this.prisma.$transaction([
      this.prisma.patientEngagement.count({ where: { tenantId } }),
      this.prisma.patientEngagement.count({ where: { tenantId, status: "SENT" } }),
      this.prisma.patientEngagement.count({ where: { tenantId, status: "RESPONDED" } }),
      this.prisma.patientEngagement.count({ where: { tenantId, status: "CONVERTED" } }),
    ]);
    return { total, sent, responded, converted };
  }

  private async countUpcomingBirthdays(tenantId: string, days: number): Promise<number> {
    const patients = await this.getUpcomingBirthdayPatients(tenantId, days);
    return patients.length;
  }

  private async getUpcomingBirthdayPatients(tenantId: string, days: number) {
    const now = new Date();
    const patients = await this.prisma.patient.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, firstName: true, lastName: true, phone: true, dob: true },
    });

    return patients.filter((p) => {
      if (!p.dob) return false;
      const dob = new Date(p.dob);
      const thisYearBirthday = new Date(now.getFullYear(), dob.getMonth(), dob.getDate());
      if (thisYearBirthday < now) thisYearBirthday.setFullYear(now.getFullYear() + 1);
      const diff = (thisYearBirthday.getTime() - now.getTime()) / 86400000;
      return diff >= 0 && diff <= days;
    });
  }
}
