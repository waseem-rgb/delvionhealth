import type { PrismaClient } from "@prisma/client";

const SYSTEM_SEGMENTS = [
  { name: "Lapsed — 6 Months", filterRules: { lastVisitDaysAgo: 180 } },
  { name: "Diabetic Follow-up", filterRules: { testsDone: ["HbA1c"], daysSinceTest: 90 } },
  { name: "Thyroid Follow-up", filterRules: { testsDone: ["TSH"], daysSinceTest: 90 } },
  { name: "Abnormal Result — No Return", filterRules: { hasAbnormalFlag: true, noVisitSince: 60 } },
  { name: "Birthday This Week", filterRules: { birthdayInDays: 7 } },
  { name: "High-Value Patients", filterRules: { lifetimeSpend: 10000 } },
  { name: "Camp Participants — Not Returned", filterRules: { source: "CAMP", noVisitSince: 30 } },
  { name: "New This Month", filterRules: { firstVisitDaysAgo: 30 } },
];

const PLACEHOLDER_REPS = [
  { name: "Sales Manager (Demo)", designation: "MANAGER", isActive: false },
  { name: "Field Rep 1 (Demo)", designation: "FIELD_REP", isActive: false },
  { name: "Field Rep 2 (Demo)", designation: "FIELD_REP", isActive: false },
  { name: "Field Rep 3 (Demo)", designation: "FIELD_REP", isActive: false },
  { name: "Senior Rep (Demo)", designation: "SENIOR_REP", isActive: false },
];

export async function seedRevenueCrm(prisma: PrismaClient, tenantId: string) {
  const results = { segments: 0, reps: 0 };

  // Seed patient segments
  for (const seg of SYSTEM_SEGMENTS) {
    const existing = await prisma.patientSegment.findFirst({
      where: { tenantId, name: seg.name },
    });
    if (!existing) {
      await prisma.patientSegment.create({
        data: {
          tenantId,
          name: seg.name,
          type: "DYNAMIC",
          filterRules: JSON.stringify(seg.filterRules),
          isSystem: true,
          isActive: true,
        },
      });
      results.segments++;
    }
  }

  // Seed placeholder sales reps
  for (const rep of PLACEHOLDER_REPS) {
    const existing = await prisma.salesRep.findFirst({
      where: { tenantId, name: rep.name },
    });
    if (!existing) {
      await prisma.salesRep.create({
        data: {
          tenantId,
          name: rep.name,
          designation: rep.designation,
          isActive: rep.isActive,
        },
      });
      results.reps++;
    }
  }

  return {
    message: "Revenue CRM seed complete",
    segmentsCreated: results.segments,
    repsCreated: results.reps,
  };
}
