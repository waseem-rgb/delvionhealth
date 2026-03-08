/**
 * DELViON Health — Master Seed (Additive)
 * Adds comprehensive demo data on TOP of existing seed.
 * Run: cd packages/db && npx ts-node prisma/master-seed.ts
 * Idempotent: uses upsert / createMany with skipDuplicates
 */

import { PrismaClient, Role } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const T = "tenant-delvion-001";
const B = "branch-delvion-001";

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}
function randomNear(mean: number, range: number) {
  return +(mean + (Math.random() * 2 - 1) * range).toFixed(2);
}

async function main() {
  console.log("🌱 Master Seed — Adding comprehensive demo data...\n");

  // ── Verify tenant exists ──
  const tenant = await prisma.tenant.findUnique({ where: { id: T } });
  if (!tenant) {
    console.error("❌ Tenant not found. Run the base seed first: npx prisma db seed");
    process.exit(1);
  }

  const hash = await bcrypt.hash("Admin@123", 12);

  // ── BLOCK 1: Ensure admin user exists ──
  await prisma.user.upsert({
    where: { id: "user-tenant-admin" },
    update: {},
    create: {
      id: "user-tenant-admin",
      tenantId: T,
      email: "admin@delvion.com",
      firstName: "Tenant",
      lastName: "Admin",
      role: Role.TENANT_ADMIN,
      passwordHash: hash,
      isActive: true,
    },
  });
  console.log("✓ Admin user verified");

  // ── BLOCK 2: Referring Doctors ──
  const refDoctors = [
    { id: "rd-001", name: "Dr. Priya Mehta", specialization: "General Physician", clinicName: "Mehta Clinic", area: "JP Nagar", city: "Bengaluru", phone: "9845012345", tier: "GOLD", totalReferrals: 47, totalRevenue: 68400, revShareEnabled: true, revSharePct: 5 },
    { id: "rd-002", name: "Dr. Suresh Rao", specialization: "Cardiologist", clinicName: "Heart Care Center", area: "Koramangala", city: "Bengaluru", phone: "9845023456", tier: "ACTIVE", totalReferrals: 23, totalRevenue: 34200, revShareEnabled: true, revSharePct: 4 },
    { id: "rd-003", name: "Dr. Kavya Nair", specialization: "Gynaecologist", clinicName: "Womens Wellness", area: "Indiranagar", city: "Bengaluru", phone: "9845034567", tier: "NEW", totalReferrals: 3, totalRevenue: 4500 },
    { id: "rd-004", name: "Dr. Arun Sharma", specialization: "Diabetologist", clinicName: "Diabetes Center", area: "Whitefield", city: "Bengaluru", phone: "9845045678", tier: "VIP", totalReferrals: 89, totalRevenue: 145000, revShareEnabled: true, revSharePct: 5 },
    { id: "rd-005", name: "Dr. Meena Pillai", specialization: "Nephrologist", clinicName: "Kidney Care", area: "Jayanagar", city: "Bengaluru", phone: "9845056789", tier: "ACTIVE", totalReferrals: 31, totalRevenue: 52000, revShareEnabled: true, revSharePct: 4 },
  ];
  for (const d of refDoctors) {
    await prisma.referringDoctor.upsert({
      where: { id: d.id },
      update: {},
      create: { ...d, tenantId: T, totalRevenue: d.totalRevenue, revSharePct: d.revSharePct ?? 0, isActive: true },
    });
  }
  console.log("✓", refDoctors.length, "referring doctors");

  // ── BLOCK 3: Additional Test Catalog (ensure 25 tests) ──
  const existingTests = await prisma.testCatalog.findMany({ where: { tenantId: T }, select: { code: true } });
  const existingCodes = new Set(existingTests.map((t) => t.code));

  const additionalTests = [
    { code: "CBC001", name: "Complete Blood Count (CBC)", category: "Haematology", department: "Haematology", price: 350, b2bPrice: 250, sampleType: "EDTA Blood", turnaroundHours: 4 },
    { code: "THY001", name: "Thyroid Profile (T3,T4,TSH)", category: "Biochemistry", department: "Biochemistry", price: 750, b2bPrice: 550, sampleType: "Serum", turnaroundHours: 24 },
    { code: "DIA001", name: "HbA1c", category: "Biochemistry", department: "Biochemistry", price: 350, b2bPrice: 280, sampleType: "EDTA Blood", turnaroundHours: 4 },
    { code: "DIA002", name: "Blood Sugar Fasting", category: "Biochemistry", department: "Biochemistry", price: 80, b2bPrice: 60, sampleType: "Serum", turnaroundHours: 2 },
    { code: "DIA003", name: "Blood Sugar PP", category: "Biochemistry", department: "Biochemistry", price: 80, b2bPrice: 60, sampleType: "Serum", turnaroundHours: 2 },
    { code: "LIP001", name: "Lipid Profile", category: "Biochemistry", department: "Biochemistry", price: 600, b2bPrice: 450, sampleType: "Serum", turnaroundHours: 8 },
    { code: "LFT001", name: "Liver Function Test (LFT)", category: "Biochemistry", department: "Biochemistry", price: 800, b2bPrice: 600, sampleType: "Serum", turnaroundHours: 8 },
    { code: "KFT001", name: "Kidney Function Test (KFT)", category: "Biochemistry", department: "Biochemistry", price: 700, b2bPrice: 520, sampleType: "Serum", turnaroundHours: 8 },
    { code: "URI001", name: "Urine Routine & Microscopy", category: "Urinalysis", department: "Urinalysis", price: 200, b2bPrice: 150, sampleType: "Urine", turnaroundHours: 4 },
    { code: "VIT001", name: "Vitamin D (25-OH)", category: "Immunology", department: "Immunology", price: 1200, b2bPrice: 900, sampleType: "Serum", turnaroundHours: 48 },
    { code: "VIT002", name: "Vitamin B12", category: "Immunology", department: "Immunology", price: 900, b2bPrice: 700, sampleType: "Serum", turnaroundHours: 48 },
    { code: "IRN001", name: "Ferritin", category: "Immunology", department: "Immunology", price: 800, b2bPrice: 600, sampleType: "Serum", turnaroundHours: 24 },
    { code: "IRN002", name: "Iron Studies (Iron+TIBC)", category: "Biochemistry", department: "Biochemistry", price: 600, b2bPrice: 450, sampleType: "Serum", turnaroundHours: 8 },
    { code: "DEN001", name: "Dengue NS1 Antigen", category: "Serology", department: "Serology", price: 800, b2bPrice: 600, sampleType: "Serum", turnaroundHours: 6 },
    { code: "DEN002", name: "Dengue IgM/IgG (Elisa)", category: "Serology", department: "Serology", price: 800, b2bPrice: 600, sampleType: "Serum", turnaroundHours: 6 },
    { code: "MAL001", name: "Malaria Antigen (Rapid Card)", category: "Serology", department: "Serology", price: 350, b2bPrice: 250, sampleType: "Whole Blood", turnaroundHours: 2 },
    { code: "HRT001", name: "Troponin I (Cardiac)", category: "Immunology", department: "Immunology", price: 1200, b2bPrice: 900, sampleType: "Serum", turnaroundHours: 4 },
    { code: "HRT002", name: "CK-MB", category: "Biochemistry", department: "Biochemistry", price: 600, b2bPrice: 450, sampleType: "Serum", turnaroundHours: 6 },
    { code: "HRM001", name: "FSH", category: "Immunology", department: "Immunology", price: 650, b2bPrice: 500, sampleType: "Serum", turnaroundHours: 24 },
    { code: "HRM002", name: "LH", category: "Immunology", department: "Immunology", price: 650, b2bPrice: 500, sampleType: "Serum", turnaroundHours: 24 },
    { code: "HRM003", name: "Prolactin", category: "Immunology", department: "Immunology", price: 700, b2bPrice: 520, sampleType: "Serum", turnaroundHours: 24 },
    { code: "CAN001", name: "PSA (Prostate Antigen)", category: "Immunology", department: "Immunology", price: 900, b2bPrice: 700, sampleType: "Serum", turnaroundHours: 24 },
    { code: "CAN002", name: "CA-125", category: "Immunology", department: "Immunology", price: 1100, b2bPrice: 850, sampleType: "Serum", turnaroundHours: 48 },
    { code: "CRP001", name: "CRP (C-Reactive Protein)", category: "Biochemistry", department: "Biochemistry", price: 400, b2bPrice: 300, sampleType: "Serum", turnaroundHours: 8 },
    { code: "COG001", name: "PT/INR (Coagulation)", category: "Haematology", department: "Haematology", price: 400, b2bPrice: 300, sampleType: "Citrate", turnaroundHours: 4 },
  ].filter((t) => !existingCodes.has(t.code));

  for (const t of additionalTests) {
    await prisma.testCatalog.create({
      data: { tenantId: T, code: t.code, name: t.name, category: t.category, department: t.department, price: t.price, b2bPrice: t.b2bPrice, sampleType: t.sampleType, turnaroundHours: t.turnaroundHours, isActive: true },
    });
  }
  console.log("✓", additionalTests.length, "additional tests added (total:", existingTests.length + additionalTests.length, ")");

  // ── BLOCK 4: Rate Lists ──
  const rateLists = [
    { id: "rl-walkin", name: "Walk-in (MRP)", listType: "PRICE_LIST", isDefault: true },
    { id: "rl-b2b", name: "B2B Standard", listType: "PRICE_LIST", isDefault: false },
    { id: "rl-corp", name: "Corporate Q2", listType: "PRICE_LIST", isDefault: false },
    { id: "rl-doctor", name: "Doctor Referral", listType: "PRICE_LIST", isDefault: false },
  ];
  for (const rl of rateLists) {
    await prisma.rateList.upsert({
      where: { id: rl.id },
      update: {},
      create: { ...rl, tenantId: T, isActive: true },
    });
  }
  console.log("✓", rateLists.length, "rate lists");

  // ── BLOCK 5: Organisations ──
  const orgs = [
    { id: "org-wipro", code: "ORG-001", name: "Wipro Technologies", gstNumber: "29AAACW0028X1ZF", creditDays: 30, paymentType: "POSTPAID" },
    { id: "org-infosys", code: "ORG-002", name: "Infosys Ltd", creditDays: 30, paymentType: "POSTPAID" },
    { id: "org-apollo", code: "ORG-003", name: "Apollo Hospital", creditDays: 15, paymentType: "POSTPAID" },
    { id: "org-fortis", code: "ORG-004", name: "Fortis Healthcare", creditDays: 15, paymentType: "POSTPAID" },
    { id: "org-practo", code: "ORG-005", name: "Practo Technologies", creditDays: 7, paymentType: "PREPAID" },
    { id: "org-medi", code: "ORG-006", name: "Medi Assist TPA", creditDays: 45, paymentType: "POSTPAID" },
  ];
  for (const o of orgs) {
    await prisma.organization.upsert({
      where: { id: o.id },
      update: {},
      create: { ...o, tenantId: T, isActive: true },
    });
  }
  console.log("✓", orgs.length, "organisations");

  // ── BLOCK 6: Lab Packages ──
  const allTests = await prisma.testCatalog.findMany({ where: { tenantId: T }, select: { id: true, code: true, price: true } });
  const testMap = new Map(allTests.map((t) => [t.code, t]));

  function getTestIds(codes: string[]) {
    return codes.map((c) => {
      const t = testMap.get(c);
      return t?.id ?? "";
    }).filter(Boolean);
  }
  function sumPrices(codes: string[]) {
    return codes.reduce((s, c) => s + Number(testMap.get(c)?.price ?? 0), 0);
  }

  const packages = [
    { id: "pkg-001", name: "Diabetes Care Package", code: "PKG-0001", category: "DISEASE", targetGender: "ALL", testCodes: ["CBC001", "DIA001", "DIA002", "URI001"], price: 849, discountPct: 17.6 },
    { id: "pkg-002", name: "Women's Wellness", code: "PKG-0002", category: "WELLNESS", targetGender: "FEMALE", testCodes: ["CBC001", "THY001", "DIA001", "VIT001", "VIT002", "IRN002"], price: 2999, discountPct: 26.9 },
    { id: "pkg-003", name: "Heart Health Package", code: "PKG-0003", category: "PREVENTIVE", targetGender: "ALL", testCodes: ["LIP001", "CBC001", "DIA002", "HRT001"], price: 1799, discountPct: 19.3 },
    { id: "pkg-004", name: "Fever Panel", code: "PKG-0004", category: "DISEASE", targetGender: "ALL", testCodes: ["CBC001", "DEN001", "MAL001", "CRP001"], price: 1499, discountPct: 21.1 },
    { id: "pkg-005", name: "Senior Citizen Package", code: "PKG-0005", category: "WELLNESS", targetGender: "ALL", testCodes: ["CBC001", "THY001", "LIP001", "LFT001", "KFT001", "DIA001", "URI001"], price: 2499, discountPct: 28.2 },
  ];
  for (const p of packages) {
    const ids = getTestIds(p.testCodes);
    const mrp = sumPrices(p.testCodes);
    await prisma.labPackage.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id, tenantId: T, name: p.name, code: p.code, category: p.category,
        targetGender: p.targetGender, testIds: JSON.stringify(ids), testCount: ids.length,
        mrpPrice: mrp, packagePrice: p.price, offerPrice: p.price,
        discountPct: p.discountPct, savingsAmt: mrp - p.price, isActive: true,
      },
    });
  }
  console.log("✓", packages.length, "lab packages");

  // ── BLOCK 7: Coupons ──
  const now = new Date();
  const eoy = new Date("2026-12-31");
  const coupons = [
    { id: "cpn-001", code: "WELCOME10", name: "Welcome 10% Off", type: "WALK_IN", discountType: "PERCENTAGE", discountValue: 10, isFirstVisitOnly: true },
    { id: "cpn-002", code: "WOMEN25", name: "Women's Day 25% Off", type: "PROMOTION", discountType: "PERCENTAGE", discountValue: 25, targetGender: "FEMALE" },
    { id: "cpn-003", code: "FLAT200", name: "Flat Rs 200 Off", type: "WALK_IN", discountType: "FLAT", discountValue: 200, minOrderValue: 500 },
    { id: "cpn-004", code: "CORP20", name: "Corporate 20% Off", type: "CORPORATE", discountType: "PERCENTAGE", discountValue: 20 },
    { id: "cpn-005", code: "SENIOR15", name: "Senior Citizen 15%", type: "WALK_IN", discountType: "PERCENTAGE", discountValue: 15, targetAgeMin: 60 },
    { id: "cpn-006", code: "DIABETES30", name: "Diabetes Day 30% Off", type: "PROMOTION", discountType: "PERCENTAGE", discountValue: 30 },
  ];
  for (const c of coupons) {
    await prisma.coupon.upsert({
      where: { id: c.id },
      update: {},
      create: { ...c, tenantId: T, validFrom: now, validTo: eoy, isActive: true },
    });
  }
  console.log("✓", coupons.length, "coupons");

  // ── BLOCK 8: Sales Reps ──
  const reps = [
    { id: "rep-001", name: "Rahul Kumar", designation: "SENIOR_REP", assignedAreas: "JP Nagar,Jayanagar,BTM Layout", revenueTarget: 200000, visitTarget: 25, revSharePct: 2 },
    { id: "rep-002", name: "Priya Malhotra", designation: "FIELD_REP", assignedAreas: "Koramangala,HSR Layout,Bellandur", revenueTarget: 180000, visitTarget: 22, revSharePct: 2 },
    { id: "rep-003", name: "Arun Singh", designation: "FIELD_REP", assignedAreas: "Whitefield,Marathahalli,KR Puram", revenueTarget: 220000, visitTarget: 20, revSharePct: 2.5 },
    { id: "rep-004", name: "Neha Tiwari", designation: "FIELD_REP", assignedAreas: "Indiranagar,Domlur,Ulsoor", revenueTarget: 150000, visitTarget: 18, revSharePct: 2 },
  ];
  for (const r of reps) {
    await prisma.salesRep.upsert({
      where: { id: r.id },
      update: {},
      create: { ...r, tenantId: T, isActive: true },
    });
  }
  console.log("✓", reps.length, "sales reps");

  // ── BLOCK 9: Sales Targets (current month) ──
  const curMonth = now.getMonth() + 1;
  const curYear = now.getFullYear();
  for (const r of reps) {
    await prisma.salesTarget.upsert({
      where: { tenantId_repId_month_year: { tenantId: T, repId: r.id, month: curMonth, year: curYear } },
      update: {},
      create: {
        tenantId: T, repId: r.id, month: curMonth, year: curYear,
        revenueTarget: r.revenueTarget, visitTarget: r.visitTarget,
        revenueActual: Math.round(r.revenueTarget * 0.45),
        visitActual: Math.round(r.visitTarget * 0.5),
      },
    });
  }
  console.log("✓ Sales targets for", curMonth + "/" + curYear);

  // ── BLOCK 10: Sales Visits ──
  const visits = [
    { repId: "rep-001", clientName: "Dr. Priya Mehta", clientType: "DOCTOR", visitType: "IN_PERSON", visitDate: daysAgo(3), purpose: "FOLLOW_UP", outcome: "POSITIVE" },
    { repId: "rep-001", clientName: "Dr. Suresh Rao", clientType: "DOCTOR", visitType: "IN_PERSON", visitDate: daysAgo(8), purpose: "GIFT", outcome: "POSITIVE" },
    { repId: "rep-002", clientName: "Dr. Kavya Nair", clientType: "DOCTOR", visitType: "IN_PERSON", visitDate: daysAgo(2), purpose: "INTRODUCTION", outcome: "NEUTRAL" },
    { repId: "rep-003", clientName: "Dr. Arun Sharma", clientType: "DOCTOR", visitType: "IN_PERSON", visitDate: daysAgo(1), purpose: "FOLLOW_UP", outcome: "POSITIVE" },
    { repId: "rep-004", clientName: "Dr. Meena Pillai", clientType: "DOCTOR", visitType: "PHONE", visitDate: daysAgo(4), purpose: "FOLLOW_UP", outcome: "NEUTRAL" },
  ];
  await prisma.salesVisit.createMany({ data: visits.map((v) => ({ ...v, tenantId: T, area: "Bengaluru" })), skipDuplicates: true });
  console.log("✓", visits.length, "sales visits");

  // ── BLOCK 11: Sales Deals ──
  const deals = [
    { id: "deal-001", title: "Apollo Hospital Overflow Tests", clientType: "HOSPITAL", clientName: "Apollo Hospital", estimatedValue: 800000, stage: "QUALIFIED", probability: 65 },
    { id: "deal-002", title: "Infosys AHC 2026-27", clientType: "CORPORATE", clientName: "Infosys Ltd", estimatedValue: 2400000, stage: "PROPOSAL_SENT", probability: 72 },
    { id: "deal-003", title: "Fortis Outsourcing Agreement", clientType: "HOSPITAL", clientName: "Fortis Healthcare", estimatedValue: 600000, stage: "NEGOTIATING", probability: 80 },
    { id: "deal-004", title: "Narayana Hospital Partnership", clientType: "HOSPITAL", clientName: "Narayana Hospital", estimatedValue: 1200000, stage: "PROSPECTING", probability: 35 },
    { id: "deal-005", title: "TCS Annual Health Check", clientType: "CORPORATE", clientName: "TCS", estimatedValue: 3500000, stage: "QUALIFIED", probability: 55 },
  ];
  for (const d of deals) {
    await prisma.salesDeal.upsert({
      where: { id: d.id },
      update: {},
      create: { ...d, tenantId: T, assignedRepId: "rep-001" },
    });
  }
  console.log("✓", deals.length, "sales deals");

  // ── BLOCK 12: Corporate Contract ──
  await prisma.corporateContract.upsert({
    where: { id: "cc-001" },
    update: {},
    create: {
      id: "cc-001", tenantId: T, companyName: "Wipro Technologies", accountId: "org-wipro",
      hrContactName: "Lakshmi Prasad", hrContactPhone: "9900033344",
      employeeCount: 1840, contractValue: 1840000, pricePerEmployee: 1000,
      contractStart: new Date("2026-04-01"), contractEnd: new Date("2027-03-31"),
      status: "ACTIVE", enrolledCount: 1840, completedCount: 423, revenueActual: 423000,
    },
  });
  console.log("✓ Corporate contract (Wipro)");

  // ── BLOCK 13: TPA Account + Claims ──
  await prisma.tPAAccount.upsert({
    where: { id: "tpa-001" },
    update: {},
    create: {
      id: "tpa-001", tenantId: T, name: "Medi Assist TPA", type: "TPA",
      contactPerson: "Rajan K", phone: "9845099900", avgPaymentDays: 47,
      totalClaims: 3, totalClaimValue: 7400, isActive: true,
    },
  });
  const tpaClaims = [
    { id: "tc-001", tpaId: "tpa-001", tenantId: T, patientName: "Ravi Kumar", claimAmount: 2400, status: "SUBMITTED", submittedDate: daysAgo(15) },
    { id: "tc-002", tpaId: "tpa-001", tenantId: T, patientName: "Deepa Nair", claimAmount: 1800, status: "APPROVED", approvedAmount: 1800, paidAmount: 1800, paidDate: daysAgo(5), submittedDate: daysAgo(25) },
    { id: "tc-003", tpaId: "tpa-001", tenantId: T, patientName: "Anil Gupta", claimAmount: 3200, status: "SUBMITTED", submittedDate: daysAgo(62), agingDays: 62 },
  ];
  for (const c of tpaClaims) {
    await prisma.tPAClaim.upsert({ where: { id: c.id }, update: {}, create: c });
  }
  console.log("✓ TPA + 3 claims");

  // ── BLOCK 14: Health Camps ──
  const camps = [
    { id: "camp-001", name: "Prestige Shantiniketan Health Camp", organiserName: "Prestige Group", organiserType: "APARTMENT", campDate: daysFromNow(12), startTime: "08:00", endTime: "12:00", packageName: "Diabetes Care Package", pricePerPerson: 849, minimumGuarantee: 30, expectedPax: 60, status: "CONFIRMED" },
    { id: "camp-002", name: "Wipro Wellness Day 2026", organiserName: "Wipro", organiserType: "CORPORATE", campDate: daysFromNow(18), startTime: "09:00", endTime: "17:00", packageName: "Women's Wellness", pricePerPerson: 2999, minimumGuarantee: 100, expectedPax: 200, status: "PROPOSAL_SENT" },
    { id: "camp-003", name: "Koramangala Society Camp", organiserName: "Green Woods Apt", organiserType: "APARTMENT", campDate: daysAgo(5), startTime: "07:00", endTime: "11:00", packageName: "Fever Panel", pricePerPerson: 1499, expectedPax: 45, actualPax: 38, status: "EXECUTED", totalRevenue: 56962 },
  ];
  for (const c of camps) {
    await prisma.healthCamp.upsert({ where: { id: c.id }, update: {}, create: { ...c, tenantId: T } });
  }
  console.log("✓", camps.length, "health camps");

  // ── BLOCK 15: B2B Accounts ──
  const b2bAccounts = [
    { id: "b2b-001", type: "HOSPITAL", name: "Apollo Hospital", totalRevenue: 450000, outstandingAmt: 125000, status: "ACTIVE" },
    { id: "b2b-002", type: "HOSPITAL", name: "Fortis Healthcare", totalRevenue: 320000, outstandingAmt: 85000, status: "ACTIVE" },
    { id: "b2b-003", type: "CORPORATE", name: "Wipro Technologies", totalRevenue: 423000, outstandingAmt: 0, status: "ACTIVE" },
    { id: "b2b-004", type: "CORPORATE", name: "Infosys Ltd", totalRevenue: 0, outstandingAmt: 0, status: "PROSPECT" },
    { id: "b2b-005", type: "AGGREGATOR", name: "Practo Technologies", totalRevenue: 95000, outstandingAmt: 12000, status: "ACTIVE" },
  ];
  for (const a of b2bAccounts) {
    await prisma.b2BAccount.upsert({ where: { id: a.id }, update: {}, create: { ...a, tenantId: T } });
  }
  console.log("✓", b2bAccounts.length, "B2B accounts");

  // ── BLOCK 16: Patient Segments ──
  const segments = [
    { id: "seg-001", name: "Lapsed - 6 Months", filterRules: JSON.stringify({ lastVisitDaysAgo: 180 }), isSystem: true, estimatedCount: 45 },
    { id: "seg-002", name: "Diabetic Follow-up", filterRules: JSON.stringify({ testsDone: ["HbA1c"], daysAgo: 90 }), isSystem: true, estimatedCount: 28 },
    { id: "seg-003", name: "Thyroid Follow-up", filterRules: JSON.stringify({ testsDone: ["TSH"], daysAgo: 90 }), isSystem: true, estimatedCount: 32 },
    { id: "seg-004", name: "Birthday This Week", filterRules: JSON.stringify({ birthdayInDays: 7 }), isSystem: true, estimatedCount: 5 },
    { id: "seg-005", name: "High-Value (10K+ lifetime)", filterRules: JSON.stringify({ lifetimeSpend: 10000 }), isSystem: true, estimatedCount: 15 },
    { id: "seg-006", name: "Camp Participants", filterRules: JSON.stringify({ source: "CAMP", noReturnDays: 30 }), isSystem: true, estimatedCount: 38 },
  ];
  for (const s of segments) {
    await prisma.patientSegment.upsert({ where: { id: s.id }, update: {}, create: { ...s, tenantId: T, isActive: true } });
  }
  console.log("✓", segments.length, "patient segments");

  // ── BLOCK 17: QC Runs (IQC data for Sysmex) ──
  const instruments = await prisma.instrument.findMany({ where: { tenantId: T }, select: { id: true, name: true } });
  const sysmex = instruments.find((i) => i.name.includes("Sysmex")) || instruments[0];
  if (sysmex) {
    const labTech = await prisma.user.findFirst({ where: { tenantId: T, role: "LAB_TECHNICIAN" } });
    if (labTech) {
      for (let i = 1; i <= 20; i++) {
        const val = randomNear(14.2, 0.5);
        const zScore = +((val - 14.2) / 0.3).toFixed(3);
        const isViolation = Math.abs(zScore) > 2;
        await prisma.qCRun.create({
          data: {
            tenantId: T, branchId: B, instrumentId: sysmex.id,
            analyte: "Haemoglobin", level: "NORMAL", parameter: "Haemoglobin",
            value: val, mean: 14.2, sd: 0.3, cv: +(0.3 / 14.2 * 100).toFixed(4),
            zScore: zScore, observedValue: val,
            westgardFlag: isViolation ? "2S" : null,
            isAccepted: !isViolation,
            runById: labTech.id, runAt: daysAgo(i), department: "Haematology",
          },
        });
      }
      console.log("✓ 20 QC runs for", sysmex.name);
    }
  }

  // ── BLOCK 18: Instrument CPT ──
  if (sysmex) {
    const cbcTest = allTests.find((t) => t.code === "CBC" || t.code === "CBC001");
    if (cbcTest) {
      await prisma.instrumentCPT.upsert({
        where: { tenantId_instrumentId_testCatalogId: { tenantId: T, instrumentId: sysmex.id, testCatalogId: cbcTest.id } },
        update: {},
        create: {
          tenantId: T, instrumentId: sysmex.id, testCatalogId: cbcTest.id,
          reagentCost: 28, controlCost: 8, consumableCost: 5, calibrationCost: 3, overheadCost: 4,
          totalCPT: 48, mrpAtTime: Number(cbcTest.price),
          grossMarginAmt: Number(cbcTest.price) - 48,
          grossMarginPct: +((1 - 48 / Number(cbcTest.price)) * 100).toFixed(1),
        },
      });
      console.log("✓ CPT for CBC on", sysmex.name);
    }
  }

  // ── BLOCK 19: Finance — Bank Account + Transactions ──
  await prisma.bankAccount.upsert({
    where: { id: "ba-001" },
    update: {},
    create: {
      id: "ba-001", tenantId: T, name: "HDFC Bank - Operating", accountNumber: "XXXX1234",
      bankName: "HDFC Bank", ifscCode: "HDFC0001234", currentBalance: 500000, isActive: true,
    },
  });

  const txns = [
    { txnDate: daysAgo(2), narration: "NEFT FROM WIPRO TECHNOLOGIES", creditAmount: 423000, category: "REVENUE" },
    { txnDate: daysAgo(5), narration: "SYSMEX REAGENTS PAYMENT", debitAmount: 45000, category: "REAGENTS" },
    { txnDate: daysAgo(8), narration: "STAFF SALARY MARCH 2026", debitAmount: 420000, category: "SALARY" },
    { txnDate: daysAgo(10), narration: "OFFICE RENT MARCH 2026", debitAmount: 85000, category: "RENT" },
    { txnDate: daysAgo(15), narration: "PATIENT COLLECTION CASH", creditAmount: 125000, category: "REVENUE" },
  ];
  for (const tx of txns) {
    await prisma.bankTransaction.create({
      data: { tenantId: T, bankAccountId: "ba-001", ...tx },
    });
  }
  console.log("✓ Bank account + 5 transactions");

  // ── BLOCK 20: Cash Book / Expense Entries ──
  const expenses = [
    { entryDate: daysAgo(2), type: "EXPENSE", category: "REAGENTS", description: "Sysmex reagents batch", amount: 45000, paidTo: "Sysmex India" },
    { entryDate: daysAgo(10), type: "EXPENSE", category: "RENT", description: "Office rent March 2026", amount: 85000, paidTo: "Property Owner" },
    { entryDate: daysAgo(8), type: "EXPENSE", category: "ELECTRICITY", description: "BESCOM Mar 2026", amount: 12000, paidTo: "BESCOM" },
    { entryDate: daysAgo(5), type: "EXPENSE", category: "CONSUMABLES", description: "Lab consumables", amount: 8500, paidTo: "Lab Supplies Co" },
  ];
  for (const e of expenses) {
    await prisma.cashBookEntry.create({ data: { tenantId: T, ...e } });
  }
  console.log("✓", expenses.length, "expense entries");

  // ── BLOCK 21: Quality — CAPA, Documents, Forms ──
  await prisma.qualityCapa.upsert({
    where: { id: "capa-001" },
    update: {},
    create: {
      id: "capa-001", tenantId: T, capaNumber: "CAPA-2026-001",
      title: "Haemoglobin QC Drift", description: "Observed 2S Westgard violation on Sysmex XN-330",
      type: "CORRECTIVE", source: "QC_FAILURE", priority: "HIGH", status: "IN_PROGRESS",
      rootCause: "Reagent lot variability", proposedAction: "Replace reagent lot and re-calibrate",
      dueDate: daysFromNow(7), department: "Haematology", assignedToId: "user-lab-tech",
    },
  });
  await prisma.qualityCapa.upsert({
    where: { id: "capa-002" },
    update: {},
    create: {
      id: "capa-002", tenantId: T, capaNumber: "CAPA-2026-002",
      title: "Sample labeling SOP non-compliance", description: "Unlabeled samples found in batch",
      type: "PREVENTIVE", source: "NC", priority: "MEDIUM", status: "OPEN",
      dueDate: daysFromNow(14), department: "Phlebotomy", assignedToId: "user-phlebotomist",
    },
  });

  await prisma.qualityDocument.upsert({
    where: { id: "qdoc-001" },
    update: {},
    create: {
      id: "qdoc-001", tenantId: T, title: "Sample Collection SOP", type: "SOP", category: "PRE-ANALYTICAL",
      version: "2.1", status: "APPROVED", docNumber: "SOP-PRE-001",
      effectiveAt: daysAgo(30), approvedAt: daysAgo(30),
    },
  });
  await prisma.qualityDocument.upsert({
    where: { id: "qdoc-002" },
    update: {},
    create: {
      id: "qdoc-002", tenantId: T, title: "Internal Quality Control SOP", type: "SOP", category: "ANALYTICAL",
      version: "1.3", status: "APPROVED", docNumber: "SOP-ANA-001",
      effectiveAt: daysAgo(60), approvedAt: daysAgo(60),
    },
  });
  await prisma.qualityDocument.upsert({
    where: { id: "qdoc-003" },
    update: {},
    create: {
      id: "qdoc-003", tenantId: T, title: "Report Verification Checklist", type: "CHECKLIST", category: "POST-ANALYTICAL",
      version: "1.0", status: "DRAFT", docNumber: "CHK-POST-001",
    },
  });

  // Quality Forms
  const qForms = [
    { id: "qf-001", formCode: "MGT-01", name: "Management Review Minutes", category: "Audit", type: "MANAGEMENT", frequency: "Annual" },
    { id: "qf-002", formCode: "TECH-01", name: "Daily IQC Record", category: "IQC", type: "TECHNICAL", frequency: "Daily" },
    { id: "qf-003", formCode: "TECH-02", name: "Equipment Calibration Log", category: "Maintenance", type: "TECHNICAL", frequency: "Monthly" },
    { id: "qf-004", formCode: "MGT-02", name: "CAPA Register", category: "NCR", type: "MANAGEMENT", frequency: "Per Event" },
    { id: "qf-005", formCode: "TECH-03", name: "Temperature Monitoring Log", category: "Safety", type: "TECHNICAL", frequency: "Daily" },
  ];
  for (const f of qForms) {
    await prisma.qualityForm.upsert({ where: { id: f.id }, update: {}, create: { ...f, tenantId: T, isActive: true } });
  }
  console.log("✓ Quality: 2 CAPAs, 3 documents, 5 forms");

  // ── BLOCK 22: Compliance Certs ──
  await prisma.complianceCert.upsert({
    where: { id: "cert-001" },
    update: {},
    create: {
      id: "cert-001", tenantId: T, name: "NABL Accreditation", category: "REGULATORY",
      certNumber: "MC-2024-001", issuingAuthority: "NABL",
      issueDate: new Date("2024-01-15"), expiryDate: new Date("2027-01-14"),
      status: "VALID", priority: "CRITICAL", renewalCycle: "3 Years",
    },
  });
  await prisma.complianceCert.upsert({
    where: { id: "cert-002" },
    update: {},
    create: {
      id: "cert-002", tenantId: T, name: "Trade License", category: "LICENSE",
      certNumber: "TL-BLR-2026-4567", issuingAuthority: "BBMP",
      issueDate: new Date("2026-01-01"), expiryDate: new Date("2026-12-31"),
      status: "VALID", priority: "HIGH", renewalCycle: "Annual",
    },
  });
  console.log("✓ 2 compliance certificates");

  // ── BLOCK 23: Rev Share Ledger entries ──
  await prisma.revShareLedger.createMany({
    data: [
      { tenantId: T, entityType: "DOCTOR", entityId: "rd-001", entityName: "Dr. Priya Mehta", orderId: "order-placeholder-1", orderAmount: 1200, revSharePct: 5, revShareAmount: 60, month: curMonth, year: curYear, status: "PENDING" },
      { tenantId: T, entityType: "DOCTOR", entityId: "rd-004", entityName: "Dr. Arun Sharma", orderId: "order-placeholder-2", orderAmount: 3500, revSharePct: 5, revShareAmount: 175, month: curMonth, year: curYear, status: "PENDING" },
      { tenantId: T, entityType: "REP", entityId: "rep-001", entityName: "Rahul Kumar", orderId: "order-placeholder-3", orderAmount: 8500, revSharePct: 2, revShareAmount: 170, month: curMonth, year: curYear, status: "PAID", paidAt: daysAgo(5) },
    ],
    skipDuplicates: true,
  });
  console.log("✓ 3 rev share ledger entries");

  // ── BLOCK 24: Content Templates ──
  await prisma.contentTemplate.createMany({
    data: [
      { tenantId: T, name: "Report Ready - WhatsApp", type: "NOTIFICATION", purpose: "REPORT_READY", channel: "WHATSAPP", content: "Dear {patientName}, your lab report for {testNames} is ready. Download: {reportLink}" },
      { tenantId: T, name: "Follow-up Reminder - SMS", type: "RECALL", purpose: "FOLLOW_UP", channel: "SMS", content: "Hi {patientName}, your {testName} is due for follow-up. Book now: {bookingLink}" },
      { tenantId: T, name: "Birthday Wish", type: "ENGAGEMENT", purpose: "BIRTHDAY", channel: "WHATSAPP", content: "Happy Birthday {patientName}! Enjoy 10% off on all tests today. Use code: BDAY10" },
    ],
    skipDuplicates: true,
  });
  console.log("✓ 3 content templates");

  // ── BLOCK 25: Additional Patients ──
  const existingPatients = await prisma.patient.count({ where: { tenantId: T } });
  if (existingPatients < 10) {
    const extraPatients = [
      { firstName: "Amaan", lastName: "Khan", phone: "7993448426", gender: "MALE", dob: new Date("1992-05-15"), mrn: "MRN-EXTRA-001" },
    ];
    for (const p of extraPatients) {
      const exists = await prisma.patient.findFirst({ where: { tenantId: T, phone: p.phone } });
      if (!exists) {
        await prisma.patient.create({
          data: { ...p, tenantId: T, branchId: B, isActive: true },
        });
      }
    }
    console.log("✓ Extra patients added");
  }

  // ── BLOCK 26: Attendance & Payroll ──
  const employees = await prisma.employee.findMany({ where: { tenantId: T }, select: { id: true, userId: true, salary: true } });
  // Attendance for last 7 days
  for (const emp of employees) {
    for (let d = 1; d <= 7; d++) {
      const date = daysAgo(d);
      date.setHours(0, 0, 0, 0);
      const isLeave = d === 5 && emp === employees[0]; // 1 leave
      try {
        await prisma.attendance.create({
          data: {
            tenantId: T, employeeId: emp.id, branchId: B,
            date, status: isLeave ? "LEAVE" : "PRESENT",
            checkIn: isLeave ? null : new Date(date.getTime() + 9 * 3600000),
            checkOut: isLeave ? null : new Date(date.getTime() + 18 * 3600000),
            hoursWorked: isLeave ? 0 : 9,
          },
        });
      } catch {
        // Skip duplicate
      }
    }
  }
  console.log("✓ Attendance for", employees.length, "employees x 7 days");

  // Payroll for current month
  const payrollRun = await prisma.payrollRun.upsert({
    where: { id: "pr-mar-2026" },
    update: {},
    create: {
      id: "pr-mar-2026", tenantId: T, month: curMonth, year: curYear,
      status: "DRAFT",
      totalGross: employees.reduce((s, e) => s + Number(e.salary ?? 0), 0),
      totalDeductions: employees.reduce((s, e) => s + Number(e.salary ?? 0) * 0.12, 0),
      totalNet: employees.reduce((s, e) => s + Number(e.salary ?? 0) * 0.88, 0),
    },
  });
  for (const emp of employees) {
    const basic = Number(emp.salary ?? 30000);
    const hra = Math.round(basic * 0.4);
    const conv = 1600;
    const other = Math.round(basic * 0.1);
    const gross = basic + hra + conv + other;
    const pf = Math.round(basic * 0.12);
    const esi = gross < 21000 ? Math.round(gross * 0.0075) : 0;
    const tds = gross > 50000 ? Math.round((gross - 50000) * 0.1) : 0;
    try {
      await prisma.payrollEntry.create({
        data: {
          tenantId: T, runId: payrollRun.id, userId: emp.userId,
          basicSalary: basic, hra, conveyance: conv, otherAllowances: other,
          grossSalary: gross, pf, esi, tds, otherDeductions: 0,
          netSalary: gross - pf - esi - tds, presentDays: 26, lopDays: 0,
          status: "DRAFT",
        },
      });
    } catch {
      // Skip duplicate
    }
  }
  console.log("✓ Payroll run for", curMonth + "/" + curYear);

  // ── BLOCK 27: Shifts & Leave Types ──
  const shifts = [
    { id: "shift-morning", name: "Morning Shift", startTime: "07:00", endTime: "15:00", type: "MORNING" as const },
    { id: "shift-afternoon", name: "Afternoon Shift", startTime: "14:00", endTime: "22:00", type: "AFTERNOON" as const },
    { id: "shift-night", name: "Night Shift", startTime: "22:00", endTime: "07:00", type: "NIGHT" as const },
  ];
  for (const s of shifts) {
    await prisma.shift.upsert({
      where: { id: s.id },
      update: {},
      create: { ...s, tenantId: T, branchId: B, days: ["MON", "TUE", "WED", "THU", "FRI", "SAT"], isActive: true },
    });
  }

  const leaveTypes = [
    { id: "lt-casual", name: "Casual Leave", allowedDays: 12 },
    { id: "lt-sick", name: "Sick Leave", allowedDays: 10 },
    { id: "lt-earned", name: "Earned Leave", allowedDays: 15, carryForward: true },
  ];
  for (const lt of leaveTypes) {
    await prisma.leaveType.upsert({ where: { id: lt.id }, update: {}, create: { ...lt, tenantId: T } });
  }
  console.log("✓ 3 shifts, 3 leave types");

  // ── VERIFICATION ──
  console.log("\n=== SEED VERIFICATION ===");
  const counts = {
    tenants: await prisma.tenant.count(),
    users: await prisma.user.count({ where: { tenantId: T } }),
    patients: await prisma.patient.count({ where: { tenantId: T } }),
    tests: await prisma.testCatalog.count({ where: { tenantId: T } }),
    packages: await prisma.labPackage.count({ where: { tenantId: T } }),
    coupons: await prisma.coupon.count({ where: { tenantId: T } }),
    refDoctors: await prisma.referringDoctor.count({ where: { tenantId: T } }),
    salesReps: await prisma.salesRep.count({ where: { tenantId: T } }),
    deals: await prisma.salesDeal.count({ where: { tenantId: T } }),
    camps: await prisma.healthCamp.count({ where: { tenantId: T } }),
    instruments: await prisma.instrument.count({ where: { tenantId: T } }),
    qcRuns: await prisma.qCRun.count({ where: { tenantId: T } }),
    orgs: await prisma.organization.count({ where: { tenantId: T } }),
    b2bAccounts: await prisma.b2BAccount.count({ where: { tenantId: T } }),
    tpaAccounts: await prisma.tPAAccount.count({ where: { tenantId: T } }),
    segments: await prisma.patientSegment.count({ where: { tenantId: T } }),
    bankAccounts: await prisma.bankAccount.count({ where: { tenantId: T } }),
    employees: await prisma.employee.count({ where: { tenantId: T } }),
    qualityCapas: await prisma.qualityCapa.count({ where: { tenantId: T } }),
    qualityDocs: await prisma.qualityDocument.count({ where: { tenantId: T } }),
    qualityForms: await prisma.qualityForm.count({ where: { tenantId: T } }),
    complianceCerts: await prisma.complianceCert.count({ where: { tenantId: T } }),
  };
  console.table(counts);
  console.log("\n✅ Master seed complete!");
}

main()
  .catch((e) => { console.error("❌ Seed failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
