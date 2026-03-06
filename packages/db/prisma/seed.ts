/**
 * DELViON Health — Database Seed
 * Run: npx ts-node prisma/seed.ts
 * Demo credentials: Admin@123
 */

import { PrismaClient, Role, InstrumentStatus, AttendanceStatus, AppointmentType, AppointmentStatus, OrderStatus, SampleStatus, CollectionType, ResultInterpretation, InvoiceStatus } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding DELViON Health database...");

  // ─── Tenant ──────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: "delvion-demo" },
    update: {},
    create: {
      id: "tenant-delvion-001",
      name: "DELViON Health Demo Lab",
      slug: "delvion-demo",
      plan: "enterprise",
      isActive: true,
      config: {
        timezone: "Asia/Kolkata",
        currency: "INR",
        country: "IN",
        gstNumber: "29AADCD1234A1Z5",
        labAccreditation: "NABL",
      },
    },
  });
  console.log("✓ Tenant:", tenant.name);

  // ─── Branch ──────────────────────────────────────────────
  const branch = await prisma.tenantBranch.upsert({
    where: { id: "branch-delvion-001" },
    update: {},
    create: {
      id: "branch-delvion-001",
      tenantId: tenant.id,
      name: "Main Branch - Bengaluru",
      address: "No. 42, 4th Cross, Indiranagar",
      city: "Bengaluru",
      state: "Karnataka",
      country: "IN",
      phone: "+91-80-4567-8901",
      email: "bengaluru@delvion.com",
      isActive: true,
    },
  });
  console.log("✓ Branch:", branch.name);

  // ─── Users ───────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("Admin@123", 12);

  const usersData = [
    { id: "user-super-admin",  email: "superadmin@delvion.com", firstName: "Super",       lastName: "Admin",    role: Role.SUPER_ADMIN },
    { id: "user-tenant-admin", email: "admin@delvion.com",      firstName: "Tenant",      lastName: "Admin",    role: Role.TENANT_ADMIN },
    { id: "user-lab-manager",  email: "labmanager@delvion.com", firstName: "Anita",       lastName: "Rao",      role: Role.LAB_MANAGER },
    { id: "user-pathologist",  email: "pathologist@delvion.com",firstName: "Dr. Vikram",  lastName: "Nair",     role: Role.PATHOLOGIST },
    { id: "user-lab-tech",     email: "labtech@delvion.com",    firstName: "Ramesh",      lastName: "Kumar",    role: Role.LAB_TECHNICIAN },
    { id: "user-front-desk",   email: "frontdesk@delvion.com",  firstName: "Kavya",       lastName: "Sharma",   role: Role.FRONT_DESK },
    { id: "user-phlebotomist", email: "phlebotomist@delvion.com",firstName: "Suresh",     lastName: "Pillai",   role: Role.PHLEBOTOMIST },
    { id: "user-field-sales",  email: "fieldsales@delvion.com", firstName: "Arjun",       lastName: "Mehta",    role: Role.FIELD_SALES_REP },
    { id: "user-finance",      email: "finance@delvion.com",    firstName: "Sunita",      lastName: "Patel",    role: Role.FINANCE_EXECUTIVE },
    { id: "user-hr",           email: "hr@delvion.com",         firstName: "Pradeep",     lastName: "Verma",    role: Role.HR_MANAGER },
  ];

  for (const u of usersData) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: {},
      create: { ...u, tenantId: tenant.id, passwordHash, isActive: true },
    });
  }
  console.log("✓", usersData.length, "users created (password: Admin@123)");

  const adminUserId = "user-front-desk";

  // ─── Test Catalog (20 tests with LOINC codes) ─────────────
  const tests = [
    { code: "CBC",          name: "Complete Blood Count",                 category: "Haematology",   department: "Haematology",  price: 350,  loincCode: "58410-2", sampleType: "EDTA Blood",           turnaroundHours: 4  },
    { code: "LFT",          name: "Liver Function Test",                  category: "Biochemistry",  department: "Biochemistry", price: 650,  loincCode: "24325-3", sampleType: "Serum",                turnaroundHours: 6  },
    { code: "KFT",          name: "Kidney Function Test",                 category: "Biochemistry",  department: "Biochemistry", price: 550,  loincCode: "24362-6", sampleType: "Serum",                turnaroundHours: 6  },
    { code: "TFT",          name: "Thyroid Function Test",                category: "Endocrinology", department: "Biochemistry", price: 750,  loincCode: "83519-7", sampleType: "Serum",                turnaroundHours: 8  },
    { code: "FBS",          name: "Fasting Blood Sugar",                  category: "Biochemistry",  department: "Biochemistry", price: 120,  loincCode: "76629-5", sampleType: "Serum",                turnaroundHours: 2  },
    { code: "PPBS",         name: "Post Prandial Blood Sugar",            category: "Biochemistry",  department: "Biochemistry", price: 120,  loincCode: "14743-9", sampleType: "Serum",                turnaroundHours: 2  },
    { code: "HBA1C",        name: "Glycated Haemoglobin (HbA1c)",         category: "Biochemistry",  department: "Biochemistry", price: 550,  loincCode: "4548-4",  sampleType: "EDTA Blood",           turnaroundHours: 6  },
    { code: "LIPID",        name: "Lipid Profile",                        category: "Biochemistry",  department: "Biochemistry", price: 600,  loincCode: "57698-3", sampleType: "Serum",                turnaroundHours: 6  },
    { code: "VIT_D",        name: "Vitamin D (25-OH)",                    category: "Endocrinology", department: "Biochemistry", price: 1200, loincCode: "62292-8", sampleType: "Serum",                turnaroundHours: 24 },
    { code: "VIT_B12",      name: "Vitamin B12",                          category: "Haematology",   department: "Biochemistry", price: 900,  loincCode: "2132-9",  sampleType: "Serum",                turnaroundHours: 24 },
    { code: "URINE_RE",     name: "Urine Routine & Microscopy",           category: "Urinalysis",    department: "Microbiology", price: 150,  loincCode: "24357-6", sampleType: "Urine",                turnaroundHours: 2  },
    { code: "DENGUE_NS1",   name: "Dengue NS1 Antigen",                   category: "Serology",      department: "Microbiology", price: 800,  loincCode: "80383-4", sampleType: "Serum",                turnaroundHours: 4  },
    { code: "WIDAL",        name: "Widal Test",                           category: "Serology",      department: "Microbiology", price: 300,  loincCode: "22337-6", sampleType: "Serum",                turnaroundHours: 4  },
    { code: "MALARIA_MP",   name: "Malaria Parasite (Peripheral Smear)",  category: "Microbiology",  department: "Microbiology", price: 250,  loincCode: "32700-7", sampleType: "EDTA Blood",           turnaroundHours: 2  },
    { code: "CRP",          name: "C-Reactive Protein (CRP)",             category: "Immunology",    department: "Biochemistry", price: 400,  loincCode: "30522-7", sampleType: "Serum",                turnaroundHours: 4  },
    { code: "ESR",          name: "Erythrocyte Sedimentation Rate",       category: "Haematology",   department: "Haematology",  price: 100,  loincCode: "30341-2", sampleType: "EDTA Blood",           turnaroundHours: 2  },
    { code: "PT_INR",       name: "Prothrombin Time with INR",            category: "Coagulation",   department: "Haematology",  price: 350,  loincCode: "6301-6",  sampleType: "Citrate Blood",        turnaroundHours: 4  },
    { code: "PSA",          name: "Prostate Specific Antigen (PSA)",      category: "Tumour Markers",department: "Biochemistry", price: 1100, loincCode: "10508-0", sampleType: "Serum",                turnaroundHours: 24 },
    { code: "FERRITIN",     name: "Ferritin",                             category: "Haematology",   department: "Biochemistry", price: 800,  loincCode: "2276-4",  sampleType: "Serum",                turnaroundHours: 8  },
    { code: "COVID_RT_PCR", name: "COVID-19 RT-PCR",                      category: "Molecular",     department: "Microbiology", price: 500,  loincCode: "94500-6", sampleType: "Nasopharyngeal Swab",  turnaroundHours: 24 },
  ];

  for (const t of tests) {
    await prisma.testCatalog.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: t.code } },
      update: {},
      create: { tenantId: tenant.id, ...t, isActive: true },
    });
  }
  console.log("✓", tests.length, "test catalog items created");

  // ─── Test Packages ────────────────────────────────────────
  const packages = [
    { name: "Aarogya Basic Health Package",      description: "CBC, FBS, Urine RE, ESR, CRP",              price: 999,  items: ["CBC","FBS","URINE_RE","ESR","CRP"] },
    { name: "Aarogya Comprehensive Package",     description: "LFT, KFT, Lipid, TFT, HbA1c, CBC, Vit D, B12", price: 4499, items: ["CBC","LFT","KFT","LIPID","TFT","HBA1C","VIT_D","VIT_B12"] },
    { name: "Diabetic Care Panel",               description: "FBS, PPBS, HbA1c, Lipid, KFT, Urine RE",   price: 1499, items: ["FBS","PPBS","HBA1C","LIPID","KFT","URINE_RE"] },
  ];

  for (const pkg of packages) {
    const existing = await prisma.testPackage.findFirst({ where: { tenantId: tenant.id, name: pkg.name } });
    if (!existing) {
      await prisma.testPackage.create({ data: { tenantId: tenant.id, ...pkg, isActive: true } });
    }
  }
  console.log("✓", packages.length, "test packages created");

  // ─── Doctors ──────────────────────────────────────────────
  const doctors = [
    { id: "doctor-delvion-001", name: "Dr. Priya Sharma", specialty: "General Physician", phone: "+91-98765-43210", email: "dr.priya@delvion.com", clinicName: "Sharma Clinic", address: "Indiranagar, Bengaluru" },
    { id: "doctor-delvion-002", name: "Dr. Rajan Mehta",  specialty: "Diabetologist",     phone: "+91-99876-54321", email: "dr.rajan@delvion.com", clinicName: "Mehta Diabetes Centre", address: "Koramangala, Bengaluru" },
  ];

  for (const d of doctors) {
    await prisma.doctor.upsert({
      where: { id: d.id },
      update: {},
      create: { ...d, tenantId: tenant.id, referralCount: 0, revenueGenerated: 0, engagementScore: 75, isActive: true },
    });
  }
  console.log("✓", doctors.length, "doctors created");

  // ─── Patients ─────────────────────────────────────────────
  const patientsData = [
    { mrn: "MRN-2024-0001", firstName: "Rajesh",  lastName: "Kumar",    dob: "1978-03-15", gender: "M", phone: "+91-98765-11001" },
    { mrn: "MRN-2024-0002", firstName: "Sunita",  lastName: "Patel",    dob: "1985-07-22", gender: "F", phone: "+91-98765-11002" },
    { mrn: "MRN-2024-0003", firstName: "Arun",    lastName: "Nair",     dob: "1990-11-08", gender: "M", phone: "+91-98765-11003" },
    { mrn: "MRN-2024-0004", firstName: "Meena",   lastName: "Krishnan", dob: "1972-05-30", gender: "F", phone: "+91-98765-11004" },
    { mrn: "MRN-2024-0005", firstName: "Vikram",  lastName: "Singh",    dob: "1965-09-17", gender: "M", phone: "+91-98765-11005" },
    { mrn: "MRN-2024-0006", firstName: "Ananya",  lastName: "Rao",      dob: "1998-01-25", gender: "F", phone: "+91-98765-11006" },
    { mrn: "MRN-2024-0007", firstName: "Suresh",  lastName: "Iyer",     dob: "1955-12-03", gender: "M", phone: "+91-98765-11007" },
    { mrn: "MRN-2024-0008", firstName: "Lakshmi", lastName: "Devi",     dob: "1982-04-14", gender: "F", phone: "+91-98765-11008" },
    { mrn: "MRN-2024-0009", firstName: "Deepak",  lastName: "Sharma",   dob: "1975-08-20", gender: "M", phone: "+91-98765-11009" },
    { mrn: "MRN-2024-0010", firstName: "Priya",   lastName: "Reddy",    dob: "1993-06-11", gender: "F", phone: "+91-98765-11010" },
  ];

  const createdPatientIds: string[] = [];
  for (const p of patientsData) {
    const patient = await prisma.patient.upsert({
      where: { tenantId_mrn: { tenantId: tenant.id, mrn: p.mrn } },
      update: {},
      create: {
        tenantId: tenant.id,
        branchId: branch.id,
        mrn: p.mrn,
        firstName: p.firstName,
        lastName: p.lastName,
        dob: new Date(p.dob),
        gender: p.gender,
        phone: p.phone,
        email: `${p.firstName.toLowerCase()}.${p.lastName.toLowerCase()}@gmail.com`,
        referringDoctorId: "doctor-delvion-001",
        isActive: true,
      },
    });
    createdPatientIds.push(patient.id);
  }
  console.log("✓", patientsData.length, "patients created");

  // ─── Orders ───────────────────────────────────────────────
  const cbcTest  = await prisma.testCatalog.findUniqueOrThrow({ where: { tenantId_code: { tenantId: tenant.id, code: "CBC"   } } });
  const lftTest  = await prisma.testCatalog.findUniqueOrThrow({ where: { tenantId_code: { tenantId: tenant.id, code: "LFT"   } } });
  const tftTest  = await prisma.testCatalog.findUniqueOrThrow({ where: { tenantId_code: { tenantId: tenant.id, code: "TFT"   } } });
  const hba1cTest= await prisma.testCatalog.findUniqueOrThrow({ where: { tenantId_code: { tenantId: tenant.id, code: "HBA1C" } } });
  const lipidTest= await prisma.testCatalog.findUniqueOrThrow({ where: { tenantId_code: { tenantId: tenant.id, code: "LIPID" } } });

  const ordersToCreate = [
    { orderNumber: "ORD-2024-00001", patientIdx: 0, status: "REPORTED"      as const, tests: [{ t: cbcTest,   discount: 0 }, { t: lftTest,   discount: 50 }], totalDiscount: 50 },
    { orderNumber: "ORD-2024-00002", patientIdx: 1, status: "IN_PROCESSING" as const, tests: [{ t: tftTest,   discount: 0 }, { t: hba1cTest, discount: 0  }], totalDiscount: 0  },
    { orderNumber: "ORD-2024-00003", patientIdx: 2, status: "PENDING"       as const, tests: [{ t: lipidTest, discount: 0 }, { t: cbcTest,   discount: 0  }], totalDiscount: 0  },
  ];

  for (const o of ordersToCreate) {
    const existing = await prisma.order.findFirst({ where: { tenantId: tenant.id, orderNumber: o.orderNumber } });
    if (existing) continue;

    const total = o.tests.reduce((sum, item) => sum + Number(item.t.price), 0);
    const net   = total - o.totalDiscount;

    const order = await prisma.order.create({
      data: {
        tenantId:      tenant.id,
        branchId:      branch.id,
        patientId:     createdPatientIds[o.patientIdx]!,
        orderNumber:   o.orderNumber,
        status:        o.status,
        priority:      "ROUTINE",
        totalAmount:   total,
        discountAmount: o.totalDiscount,
        netAmount:     net,
        paymentStatus: o.status === "REPORTED" ? "PAID" : "UNPAID",
        createdById:   adminUserId,
      },
    });

    for (const item of o.tests) {
      await prisma.orderItem.create({
        data: {
          orderId:       order.id,
          testCatalogId: item.t.id,
          quantity:      1,
          price:         item.t.price,
          discount:      item.discount,
          status:        o.status === "REPORTED" ? "REPORTED" : "PENDING",
        },
      });
    }
  }
  console.log("✓", ordersToCreate.length, "orders created");

  // ─── Reference Ranges ─────────────────────────────────────
  const refRangeData = [
    // FBS – Fasting Blood Sugar (mg/dL)
    { code: "FBS",      gender: null,     lowNormal: 70,   highNormal: 99,   lowCritical: 50,  highCritical: 500, unit: "mg/dL" },
    // PPBS – Post Prandial Blood Sugar (mg/dL)
    { code: "PPBS",     gender: null,     lowNormal: 70,   highNormal: 140,  lowCritical: 50,  highCritical: 500, unit: "mg/dL" },
    // HbA1c (%)
    { code: "HBA1C",    gender: null,     lowNormal: 4.0,  highNormal: 5.6,  lowCritical: 2.0, highCritical: 9.0, unit: "%" },
    // CRP – C-Reactive Protein (mg/L)
    { code: "CRP",      gender: null,     lowNormal: 0,    highNormal: 5.0,  lowCritical: null, highCritical: 100, unit: "mg/L" },
    // ESR – Male (mm/hr)
    { code: "ESR",      gender: "MALE",   lowNormal: 0,    highNormal: 15,   lowCritical: null, highCritical: 60, unit: "mm/hr" },
    // ESR – Female (mm/hr)
    { code: "ESR",      gender: "FEMALE", lowNormal: 0,    highNormal: 20,   lowCritical: null, highCritical: 60, unit: "mm/hr" },
    // Vitamin D (ng/mL)
    { code: "VIT_D",    gender: null,     lowNormal: 30,   highNormal: 100,  lowCritical: 10,  highCritical: null, unit: "ng/mL" },
    // Vitamin B12 (pg/mL)
    { code: "VIT_B12",  gender: null,     lowNormal: 211,  highNormal: 911,  lowCritical: 150, highCritical: null, unit: "pg/mL" },
    // Ferritin – Male (ng/mL)
    { code: "FERRITIN", gender: "MALE",   lowNormal: 12,   highNormal: 300,  lowCritical: 5,   highCritical: 500, unit: "ng/mL" },
    // Ferritin – Female (ng/mL)
    { code: "FERRITIN", gender: "FEMALE", lowNormal: 12,   highNormal: 150,  lowCritical: 5,   highCritical: 500, unit: "ng/mL" },
    // PT/INR (ratio)
    { code: "PT_INR",   gender: null,     lowNormal: 0.9,  highNormal: 1.2,  lowCritical: null, highCritical: 3.5, unit: "ratio" },
    // PSA – Prostate Specific Antigen (ng/mL) – male only
    { code: "PSA",      gender: "MALE",   lowNormal: 0,    highNormal: 4.0,  lowCritical: null, highCritical: 20, unit: "ng/mL" },
  ];

  for (const r of refRangeData) {
    const catalog = await prisma.testCatalog.findFirst({
      where: { tenantId: tenant.id, code: r.code },
    });
    if (!catalog) continue;

    const existing = await prisma.referenceRange.findFirst({
      where: { tenantId: tenant.id, testCatalogId: catalog.id, genderFilter: r.gender ?? null },
    });
    if (!existing) {
      await prisma.referenceRange.create({
        data: {
          tenantId:      tenant.id,
          testCatalogId: catalog.id,
          genderFilter:  r.gender,
          lowNormal:     r.lowNormal,
          highNormal:    r.highNormal,
          lowCritical:   r.lowCritical ?? null,
          highCritical:  r.highCritical ?? null,
          unit:          r.unit,
        },
      });
    }
  }
  console.log("✓", refRangeData.length, "reference ranges seeded");

  // ─── Instruments ──────────────────────────────────────────
  const instrumentsData: Array<{
    id: string; name: string; model: string; manufacturer: string;
    serialNumber: string; status: InstrumentStatus;
    lastCalibration: Date; nextCalibration: Date;
  }> = [
    {
      id: "inst-hematology-001",
      name: "Hematology Analyzer",
      model: "CELL-DYN Ruby",
      manufacturer: "Abbott Diagnostics",
      serialNumber: "AB-HD-2023-001",
      status: InstrumentStatus.ACTIVE,
      lastCalibration: new Date("2026-02-01"),
      nextCalibration: new Date("2026-05-01"),
    },
    {
      id: "inst-biochem-001",
      name: "Biochemistry Analyzer",
      model: "ARCHITECT c8000",
      manufacturer: "Abbott Diagnostics",
      serialNumber: "AB-BC-2023-002",
      status: InstrumentStatus.ACTIVE,
      lastCalibration: new Date("2026-02-15"),
      nextCalibration: new Date("2026-05-15"),
    },
    {
      id: "inst-urine-001",
      name: "Urine Analyzer",
      model: "iQ200 SPRINT",
      manufacturer: "Beckman Coulter",
      serialNumber: "BC-UA-2023-003",
      status: InstrumentStatus.ACTIVE,
      lastCalibration: new Date("2026-01-20"),
      nextCalibration: new Date("2026-04-20"),
    },
    {
      id: "inst-centrifuge-001",
      name: "Refrigerated Centrifuge",
      model: "Allegra X-30R",
      manufacturer: "Beckman Coulter",
      serialNumber: "BC-CF-2022-004",
      status: InstrumentStatus.MAINTENANCE,
      lastCalibration: new Date("2025-12-01"),
      nextCalibration: new Date("2026-03-01"),
    },
    {
      id: "inst-pcr-001",
      name: "Real-Time PCR System",
      model: "7500 Fast",
      manufacturer: "Applied Biosystems",
      serialNumber: "AB-PCR-2023-005",
      status: InstrumentStatus.ACTIVE,
      lastCalibration: new Date("2026-02-28"),
      nextCalibration: new Date("2026-08-28"),
    },
  ];

  for (const inst of instrumentsData) {
    await prisma.instrument.upsert({
      where: { id: inst.id },
      update: {},
      create: {
        id: inst.id,
        tenantId: tenant.id,
        branchId: branch.id,
        name: inst.name,
        model: inst.model,
        manufacturer: inst.manufacturer,
        serialNumber: inst.serialNumber,
        status: inst.status,
        lastCalibration: inst.lastCalibration,
        nextCalibration: inst.nextCalibration,
      },
    });
  }
  console.log("✓", instrumentsData.length, "instruments seeded");

  // ─── Employees ────────────────────────────────────────────
  const employeesData = [
    {
      id: "emp-lab-manager",
      userId: "user-lab-manager",
      employeeCode: "EMP-001",
      department: "Operations",
      designation: "Lab Manager",
      salary: 65000,
      joiningDate: new Date("2022-12-01"),
    },
    {
      id: "emp-pathologist",
      userId: "user-pathologist",
      employeeCode: "EMP-002",
      department: "Pathology",
      designation: "Senior Pathologist",
      salary: 120000,
      joiningDate: new Date("2023-01-15"),
    },
    {
      id: "emp-lab-tech",
      userId: "user-lab-tech",
      employeeCode: "EMP-003",
      department: "Biochemistry",
      designation: "Lab Technician",
      salary: 35000,
      joiningDate: new Date("2023-03-01"),
    },
    {
      id: "emp-front-desk",
      userId: "user-front-desk",
      employeeCode: "EMP-004",
      department: "Front Desk",
      designation: "Senior Receptionist",
      salary: 25000,
      joiningDate: new Date("2023-06-15"),
    },
    {
      id: "emp-phlebotomist",
      userId: "user-phlebotomist",
      employeeCode: "EMP-005",
      department: "Sample Collection",
      designation: "Senior Phlebotomist",
      salary: 30000,
      joiningDate: new Date("2023-09-01"),
    },
  ];

  for (const emp of employeesData) {
    await prisma.employee.upsert({
      where: { userId: emp.userId },
      update: {},
      create: {
        id: emp.id,
        tenantId: tenant.id,
        branchId: branch.id,
        userId: emp.userId,
        employeeCode: emp.employeeCode,
        department: emp.department,
        designation: emp.designation,
        salary: emp.salary,
        joiningDate: emp.joiningDate,
        isActive: true,
      },
    });
  }
  console.log("✓", employeesData.length, "employees seeded");

  // ─── Attendance (today) ───────────────────────────────────
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const attendanceData: Array<{
    employeeId: string;
    status: AttendanceStatus;
    checkIn: Date | null;
    checkOut: Date | null;
    hoursWorked: number | null;
  }> = [
    {
      employeeId: "emp-lab-manager",
      status: AttendanceStatus.PRESENT,
      checkIn: new Date(today.getTime() + 3 * 3600000 + 15 * 60000),   // 08:45 IST (UTC+5:30 → 03:15 UTC)
      checkOut: new Date(today.getTime() + 12 * 3600000),               // 17:30 IST
      hoursWorked: 8.75,
    },
    {
      employeeId: "emp-pathologist",
      status: AttendanceStatus.PRESENT,
      checkIn: new Date(today.getTime() + 3 * 3600000 + 30 * 60000),   // 09:00 IST
      checkOut: null,
      hoursWorked: null,
    },
    {
      employeeId: "emp-lab-tech",
      status: AttendanceStatus.PRESENT,
      checkIn: new Date(today.getTime() + 3 * 3600000),                 // 08:30 IST
      checkOut: new Date(today.getTime() + 11 * 3600000 + 30 * 60000), // 17:00 IST
      hoursWorked: 8.5,
    },
    {
      employeeId: "emp-front-desk",
      status: AttendanceStatus.PRESENT,
      checkIn: new Date(today.getTime() + 3 * 3600000 + 45 * 60000),   // 09:15 IST
      checkOut: new Date(today.getTime() + 12 * 3600000 + 30 * 60000), // 18:00 IST
      hoursWorked: 8.75,
    },
    {
      employeeId: "emp-phlebotomist",
      status: AttendanceStatus.LEAVE,
      checkIn: null,
      checkOut: null,
      hoursWorked: null,
    },
  ];

  for (const att of attendanceData) {
    const existing = await prisma.attendance.findFirst({
      where: { tenantId: tenant.id, employeeId: att.employeeId, date: today },
    });
    if (!existing) {
      await prisma.attendance.create({
        data: {
          tenantId: tenant.id,
          employeeId: att.employeeId,
          date: today,
          status: att.status,
          checkIn: att.checkIn,
          checkOut: att.checkOut,
          hoursWorked: att.hoursWorked,
        },
      });
    }
  }
  console.log("✓", attendanceData.length, "attendance records seeded");

  // ─── Appointments ─────────────────────────────────────────
  const appointmentPatients = await prisma.patient.findMany({
    where: { tenantId: tenant.id },
    select: { id: true, mrn: true },
    take: 5,
  });
  const patientByMrn = Object.fromEntries(
    appointmentPatients.map((p) => [p.mrn, p.id])
  );

  const appointmentsData: Array<{
    type: AppointmentType;
    status: AppointmentStatus;
    patientMrn: string;
    scheduledAt: Date;
    notes: string | null;
  }> = [
    {
      patientMrn: "MRN-2024-0001",
      type: AppointmentType.WALK_IN,
      status: AppointmentStatus.SCHEDULED,
      scheduledAt: new Date(today.getTime() + 4 * 3600000 + 30 * 60000), // 10:00 IST
      notes: "Fasting sample required",
    },
    {
      patientMrn: "MRN-2024-0002",
      type: AppointmentType.HOME_COLLECTION,
      status: AppointmentStatus.CONFIRMED,
      scheduledAt: new Date(today.getTime() + 3 * 3600000 + 30 * 60000), // 09:00 IST
      notes: "Flat no 4B, HSR Layout",
    },
    {
      patientMrn: "MRN-2024-0003",
      type: AppointmentType.WALK_IN,
      status: AppointmentStatus.COLLECTED,
      scheduledAt: new Date(today.getTime() + 6 * 3600000),               // 11:30 IST
      notes: null,
    },
    {
      patientMrn: "MRN-2024-0004",
      type: AppointmentType.CORPORATE,
      status: AppointmentStatus.SCHEDULED,
      scheduledAt: new Date(today.getTime() + 32 * 3600000 + 30 * 60000), // tomorrow 14:00 IST
      notes: "Infosys campus annual health check",
    },
    {
      patientMrn: "MRN-2024-0005",
      type: AppointmentType.WALK_IN,
      status: AppointmentStatus.CANCELLED,
      scheduledAt: new Date(today.getTime() + 3 * 3600000),               // 08:30 IST
      notes: "Patient cancelled via call",
    },
  ];

  for (const appt of appointmentsData) {
    const patientId = patientByMrn[appt.patientMrn];
    if (!patientId) continue;
    const existing = await prisma.appointment.findFirst({
      where: { tenantId: tenant.id, patientId, scheduledAt: appt.scheduledAt },
    });
    if (!existing) {
      await prisma.appointment.create({
        data: {
          tenantId: tenant.id,
          branchId: branch.id,
          patientId,
          type: appt.type,
          status: appt.status,
          scheduledAt: appt.scheduledAt,
          notes: appt.notes,
        },
      });
    }
  }
  console.log("✓", appointmentsData.length, "appointments seeded");

  // ─── Lab Pipeline Demo Orders ──────────────────────────────
  // 8 orders at different pipeline stages to demo the full workflow
  const kftTest   = await prisma.testCatalog.findUniqueOrThrow({ where: { tenantId_code: { tenantId: tenant.id, code: "KFT"       } } });
  const fbsTest   = await prisma.testCatalog.findUniqueOrThrow({ where: { tenantId_code: { tenantId: tenant.id, code: "FBS"       } } });
  const ppbsTest  = await prisma.testCatalog.findUniqueOrThrow({ where: { tenantId_code: { tenantId: tenant.id, code: "PPBS"      } } });
  const urineTest = await prisma.testCatalog.findUniqueOrThrow({ where: { tenantId_code: { tenantId: tenant.id, code: "URINE_RE"  } } });
  const crpTest   = await prisma.testCatalog.findUniqueOrThrow({ where: { tenantId_code: { tenantId: tenant.id, code: "CRP"       } } });
  const esrTest   = await prisma.testCatalog.findUniqueOrThrow({ where: { tenantId_code: { tenantId: tenant.id, code: "ESR"       } } });
  const vitDTest  = await prisma.testCatalog.findUniqueOrThrow({ where: { tenantId_code: { tenantId: tenant.id, code: "VIT_D"     } } });
  const ptTest    = await prisma.testCatalog.findUniqueOrThrow({ where: { tenantId_code: { tenantId: tenant.id, code: "PT_INR"    } } });

  const now = new Date();
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600000);
  const labTechId = "user-lab-tech";
  const pathologistId = "user-pathologist";

  interface LabPipelineOrder {
    orderNumber: string;
    patientIdx: number;
    status: OrderStatus;
    collectionType: CollectionType;
    priority: string;
    tests: Array<{ t: typeof cbcTest; discount: number }>;
    sample?: {
      barcodeId: string;
      type: string;
      vacutainerType: string;
      volumeRequired: number;
      volumeCollected?: number;
      tubeCount: number;
      status: SampleStatus;
      collectedAt?: Date;
      receivedAt?: Date;
      isStatSample: boolean;
    };
    accessionedAt?: Date;
    processingStartedAt?: Date;
    resultSubmittedAt?: Date;
    approvedAt?: Date;
    results?: Array<{
      testCode: string;
      value: string;
      numericValue: number;
      unit: string;
      refRange: string;
      interpretation: ResultInterpretation;
      isDraft: boolean;
    }>;
  }

  const labOrders: LabPipelineOrder[] = [
    // Stage 1: PENDING_COLLECTION — walk-in, awaiting sample
    {
      orderNumber: "DH-ORD-20260304-0001",
      patientIdx: 3,
      status: OrderStatus.PENDING_COLLECTION,
      collectionType: CollectionType.WALK_IN,
      priority: "ROUTINE",
      tests: [{ t: cbcTest, discount: 0 }, { t: esrTest, discount: 0 }],
    },
    // Stage 1: PENDING_COLLECTION — home collection, STAT
    {
      orderNumber: "DH-ORD-20260304-0002",
      patientIdx: 4,
      status: OrderStatus.PENDING_COLLECTION,
      collectionType: CollectionType.HOME_COLLECTION,
      priority: "STAT",
      tests: [{ t: fbsTest, discount: 0 }, { t: lipidTest, discount: 0 }, { t: hba1cTest, discount: 0 }],
    },
    // Stage 2: RECEIVED — sample accessioned, awaiting processing
    {
      orderNumber: "DH-ORD-20260304-0003",
      patientIdx: 5,
      status: OrderStatus.RECEIVED,
      collectionType: CollectionType.WALK_IN,
      priority: "ROUTINE",
      tests: [{ t: lftTest, discount: 0 }, { t: kftTest, discount: 0 }],
      accessionedAt: hoursAgo(3),
      sample: {
        barcodeId: "DH-S-20260304-0001",
        type: "Serum",
        vacutainerType: "Red (Plain)",
        volumeRequired: 5,
        volumeCollected: 6,
        tubeCount: 1,
        status: SampleStatus.RECEIVED,
        collectedAt: hoursAgo(4),
        receivedAt: hoursAgo(3),
        isStatSample: false,
      },
    },
    // Stage 2: RECEIVED — urine sample accessioned
    {
      orderNumber: "DH-ORD-20260304-0004",
      patientIdx: 6,
      status: OrderStatus.RECEIVED,
      collectionType: CollectionType.WALK_IN,
      priority: "ROUTINE",
      tests: [{ t: urineTest, discount: 0 }, { t: crpTest, discount: 0 }],
      accessionedAt: hoursAgo(2),
      sample: {
        barcodeId: "DH-S-20260304-0002",
        type: "Urine",
        vacutainerType: "Sterile Container",
        volumeRequired: 30,
        volumeCollected: 40,
        tubeCount: 1,
        status: SampleStatus.RECEIVED,
        collectedAt: hoursAgo(3),
        receivedAt: hoursAgo(2),
        isStatSample: false,
      },
    },
    // Stage 3: IN_PROCESSING — lab tech working on results
    {
      orderNumber: "DH-ORD-20260304-0005",
      patientIdx: 7,
      status: OrderStatus.IN_PROCESSING,
      collectionType: CollectionType.WALK_IN,
      priority: "URGENT",
      tests: [{ t: cbcTest, discount: 0 }, { t: crpTest, discount: 0 }, { t: esrTest, discount: 0 }],
      accessionedAt: hoursAgo(5),
      processingStartedAt: hoursAgo(4),
      sample: {
        barcodeId: "DH-S-20260304-0003",
        type: "EDTA Blood",
        vacutainerType: "Lavender (EDTA)",
        volumeRequired: 3,
        volumeCollected: 4,
        tubeCount: 2,
        status: SampleStatus.PROCESSING,
        collectedAt: hoursAgo(6),
        receivedAt: hoursAgo(5),
        isStatSample: false,
      },
    },
    // Stage 4: PENDING_APPROVAL — results entered, awaiting pathologist
    {
      orderNumber: "DH-ORD-20260304-0006",
      patientIdx: 8,
      status: OrderStatus.PENDING_APPROVAL,
      collectionType: CollectionType.WALK_IN,
      priority: "ROUTINE",
      tests: [{ t: fbsTest, discount: 0 }, { t: ppbsTest, discount: 0 }, { t: hba1cTest, discount: 100 }],
      accessionedAt: hoursAgo(8),
      processingStartedAt: hoursAgo(7),
      resultSubmittedAt: hoursAgo(2),
      sample: {
        barcodeId: "DH-S-20260304-0004",
        type: "Serum",
        vacutainerType: "Red (Plain)",
        volumeRequired: 5,
        volumeCollected: 5,
        tubeCount: 1,
        status: SampleStatus.PROCESSING,
        collectedAt: hoursAgo(9),
        receivedAt: hoursAgo(8),
        isStatSample: false,
      },
      results: [
        { testCode: "FBS",   value: "142",  numericValue: 142, unit: "mg/dL", refRange: "70 - 99",   interpretation: ResultInterpretation.ABNORMAL, isDraft: false },
        { testCode: "PPBS",  value: "210",  numericValue: 210, unit: "mg/dL", refRange: "70 - 140",  interpretation: ResultInterpretation.ABNORMAL, isDraft: false },
        { testCode: "HBA1C", value: "7.8",  numericValue: 7.8, unit: "%",     refRange: "4.0 - 5.6", interpretation: ResultInterpretation.ABNORMAL, isDraft: false },
      ],
    },
    // Stage 4: PENDING_APPROVAL — STAT with critical values
    {
      orderNumber: "DH-ORD-20260304-0007",
      patientIdx: 9,
      status: OrderStatus.PENDING_APPROVAL,
      collectionType: CollectionType.B2B,
      priority: "STAT",
      tests: [{ t: ptTest, discount: 0 }, { t: cbcTest, discount: 0 }],
      accessionedAt: hoursAgo(6),
      processingStartedAt: hoursAgo(5),
      resultSubmittedAt: hoursAgo(1),
      sample: {
        barcodeId: "DH-S-20260304-0005",
        type: "Citrate Blood",
        vacutainerType: "Light Blue (Citrate)",
        volumeRequired: 3,
        volumeCollected: 3,
        tubeCount: 2,
        status: SampleStatus.PROCESSING,
        collectedAt: hoursAgo(7),
        receivedAt: hoursAgo(6),
        isStatSample: true,
      },
      results: [
        { testCode: "PT_INR", value: "3.8", numericValue: 3.8, unit: "ratio", refRange: "0.9 - 1.2", interpretation: ResultInterpretation.CRITICAL, isDraft: false },
      ],
    },
    // Stage 5: APPROVED — pathologist signed off, ready for dispatch
    {
      orderNumber: "DH-ORD-20260304-0008",
      patientIdx: 0,
      status: OrderStatus.APPROVED,
      collectionType: CollectionType.WALK_IN,
      priority: "ROUTINE",
      tests: [{ t: vitDTest, discount: 0 }, { t: cbcTest, discount: 0 }],
      accessionedAt: hoursAgo(20),
      processingStartedAt: hoursAgo(18),
      resultSubmittedAt: hoursAgo(6),
      approvedAt: hoursAgo(1),
      sample: {
        barcodeId: "DH-S-20260304-0006",
        type: "Serum",
        vacutainerType: "Red (Plain)",
        volumeRequired: 5,
        volumeCollected: 6,
        tubeCount: 2,
        status: SampleStatus.STORED,
        collectedAt: hoursAgo(22),
        receivedAt: hoursAgo(20),
        isStatSample: false,
      },
      results: [
        { testCode: "VIT_D", value: "18.5", numericValue: 18.5, unit: "ng/mL", refRange: "30 - 100", interpretation: ResultInterpretation.ABNORMAL, isDraft: false },
      ],
    },
  ];

  let labOrderCount = 0;
  for (const lo of labOrders) {
    const existingLabOrder = await prisma.order.findFirst({
      where: { tenantId: tenant.id, orderNumber: lo.orderNumber },
    });
    if (existingLabOrder) continue;

    const total = lo.tests.reduce((sum, item) => sum + Number(item.t.price), 0);
    const disc = lo.tests.reduce((sum, item) => sum + item.discount, 0);
    const net = total - disc;

    const labOrder = await prisma.order.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        patientId: createdPatientIds[lo.patientIdx]!,
        orderNumber: lo.orderNumber,
        status: lo.status,
        priority: lo.priority,
        totalAmount: total,
        discountAmount: disc,
        netAmount: net,
        paymentStatus: lo.status === OrderStatus.APPROVED ? "PAID" : "UNPAID",
        createdById: adminUserId,
        collectionType: lo.collectionType,
        accessionedAt: lo.accessionedAt ?? null,
        accessionedById: lo.accessionedAt ? labTechId : null,
        processingStartedAt: lo.processingStartedAt ?? null,
        resultSubmittedAt: lo.resultSubmittedAt ?? null,
        approvedAt: lo.approvedAt ?? null,
      },
    });

    // Create order items
    const createdItems: Array<{ id: string; testCatalogId: string }> = [];
    for (const item of lo.tests) {
      const oi = await prisma.orderItem.create({
        data: {
          orderId: labOrder.id,
          testCatalogId: item.t.id,
          quantity: 1,
          price: item.t.price,
          discount: item.discount,
          status: lo.results ? "RESULTED" : lo.processingStartedAt ? "IN_PROCESSING" : "PENDING",
        },
      });
      createdItems.push({ id: oi.id, testCatalogId: item.t.id });
    }

    // Create sample if defined
    let sampleId: string | null = null;
    if (lo.sample) {
      const sample = await prisma.sample.create({
        data: {
          tenantId: tenant.id,
          orderId: labOrder.id,
          barcodeId: lo.sample.barcodeId,
          type: lo.sample.type,
          branchId: branch.id,
          status: lo.sample.status,
          collectedAt: lo.sample.collectedAt ?? null,
          collectedById: lo.sample.collectedAt ? "user-phlebotomist" : null,
          receivedAt: lo.sample.receivedAt ?? null,
          receivedById: lo.sample.receivedAt ? labTechId : null,
          vacutainerType: lo.sample.vacutainerType,
          volumeRequired: lo.sample.volumeRequired,
          volumeCollected: lo.sample.volumeCollected ?? null,
          tubeCount: lo.sample.tubeCount,
          isStatSample: lo.sample.isStatSample,
        },
      });
      sampleId = sample.id;
    }

    // Create test results if defined
    if (lo.results && sampleId) {
      for (const r of lo.results) {
        const matchedItem = createdItems.find((ci) => {
          const test = lo.tests.find((t) => t.t.id === ci.testCatalogId);
          return test && test.t.code === r.testCode;
        });
        if (!matchedItem) continue;

        await prisma.testResult.create({
          data: {
            tenantId: tenant.id,
            orderId: labOrder.id,
            orderItemId: matchedItem.id,
            sampleId: sampleId,
            value: r.value,
            numericValue: r.numericValue,
            unit: r.unit,
            referenceRange: r.refRange,
            interpretation: r.interpretation,
            isDraft: r.isDraft,
            enteredById: labTechId,
            verifiedById: lo.approvedAt ? pathologistId : null,
            verifiedAt: lo.approvedAt ? hoursAgo(2) : null,
            validatedById: lo.approvedAt ? pathologistId : null,
            validatedAt: lo.approvedAt ?? null,
          },
        });
      }
    }

    // Create invoice for pipeline orders
    await prisma.invoice.create({
      data: {
        tenantId: tenant.id,
        orderId: labOrder.id,
        patientId: createdPatientIds[lo.patientIdx]!,
        invoiceNumber: lo.orderNumber.replace("ORD", "INV"),
        subtotal: total,
        discount: disc,
        tax: 0,
        total: net,
        status: lo.status === OrderStatus.APPROVED ? InvoiceStatus.PAID : InvoiceStatus.DRAFT,
        createdById: adminUserId,
      },
    });

    labOrderCount++;
  }
  console.log("✓", labOrderCount, "lab pipeline orders seeded (PENDING_COLLECTION × 2, RECEIVED × 2, IN_PROCESSING × 1, PENDING_APPROVAL × 2, APPROVED × 1)");

  // ─── Additional CBC Reference Ranges ───────────────────────
  const cbcParams = [
    { name: "Haemoglobin",     code: "HGB",  lowN: 13.0, highN: 17.0, lowC: 7.0,  highC: 20.0, unit: "g/dL",       gender: "MALE" },
    { name: "Haemoglobin",     code: "HGB",  lowN: 12.0, highN: 15.5, lowC: 7.0,  highC: 20.0, unit: "g/dL",       gender: "FEMALE" },
    { name: "WBC Count",       code: "WBC",  lowN: 4000, highN: 11000, lowC: 2000, highC: 30000, unit: "cells/cumm", gender: null },
    { name: "Platelet Count",  code: "PLT",  lowN: 150000, highN: 400000, lowC: 50000, highC: 800000, unit: "cells/cumm", gender: null },
    { name: "RBC Count",       code: "RBC",  lowN: 4.5,  highN: 5.5,  lowC: 2.5,  highC: 7.0,  unit: "million/cumm", gender: "MALE" },
    { name: "RBC Count",       code: "RBC",  lowN: 3.8,  highN: 4.8,  lowC: 2.5,  highC: 7.0,  unit: "million/cumm", gender: "FEMALE" },
    { name: "PCV/Hematocrit",  code: "HCT",  lowN: 40,   highN: 50,   lowC: 20,   highC: 60,   unit: "%",           gender: "MALE" },
    { name: "PCV/Hematocrit",  code: "HCT",  lowN: 36,   highN: 44,   lowC: 20,   highC: 60,   unit: "%",           gender: "FEMALE" },
    { name: "MCV",             code: "MCV",  lowN: 83,   highN: 101,  lowC: null,  highC: null,  unit: "fL",          gender: null },
    { name: "MCH",             code: "MCH",  lowN: 27,   highN: 32,   lowC: null,  highC: null,  unit: "pg",          gender: null },
    { name: "MCHC",            code: "MCHC", lowN: 31.5, highN: 34.5, lowC: null,  highC: null,  unit: "g/dL",        gender: null },
  ];

  // Add CBC sub-tests to catalog for result entry
  for (const param of cbcParams) {
    const existing = await prisma.testCatalog.findFirst({
      where: { tenantId: tenant.id, code: param.code },
    });
    if (existing) continue;

    const tc = await prisma.testCatalog.create({
      data: {
        tenantId: tenant.id,
        code: param.code,
        name: param.name,
        category: "Haematology",
        department: "Haematology",
        price: 0,
        sampleType: "EDTA Blood",
        turnaroundHours: 4,
        isActive: true,
        loincCode: `CBC-${param.code}`,
      },
    });

    // Add reference range
    await prisma.referenceRange.create({
      data: {
        tenantId: tenant.id,
        testCatalogId: tc.id,
        genderFilter: param.gender,
        lowNormal: param.lowN,
        highNormal: param.highN,
        lowCritical: param.lowC,
        highCritical: param.highC,
        unit: param.unit,
      },
    });
  }
  console.log("✓ CBC sub-test parameters + reference ranges seeded");

  // ─── LFT Sub-test Parameters ─────────────────────────────
  const lftParams = [
    { name: "Total Bilirubin",     code: "TBIL",  lowN: 0.1, highN: 1.2,  lowC: null, highC: 10, unit: "mg/dL" },
    { name: "Direct Bilirubin",    code: "DBIL",  lowN: 0.0, highN: 0.3,  lowC: null, highC: 5,  unit: "mg/dL" },
    { name: "SGPT (ALT)",          code: "ALT",   lowN: 7,   highN: 56,   lowC: null, highC: 300, unit: "U/L"   },
    { name: "SGOT (AST)",          code: "AST",   lowN: 10,  highN: 40,   lowC: null, highC: 300, unit: "U/L"   },
    { name: "Alkaline Phosphatase",code: "ALP",   lowN: 44,  highN: 147,  lowC: null, highC: 500, unit: "U/L"   },
    { name: "Total Protein",       code: "TP",    lowN: 6.0, highN: 8.3,  lowC: null, highC: null, unit: "g/dL"  },
    { name: "Albumin",             code: "ALB",   lowN: 3.5, highN: 5.5,  lowC: 2.0,  highC: null, unit: "g/dL"  },
    { name: "Globulin",            code: "GLOB",  lowN: 2.0, highN: 3.5,  lowC: null, highC: null, unit: "g/dL"  },
    { name: "A/G Ratio",           code: "AGR",   lowN: 1.0, highN: 2.2,  lowC: null, highC: null, unit: "ratio" },
    { name: "GGT",                 code: "GGT",   lowN: 0,   highN: 61,   lowC: null, highC: 300, unit: "U/L"   },
  ];

  for (const param of lftParams) {
    const existing = await prisma.testCatalog.findFirst({
      where: { tenantId: tenant.id, code: param.code },
    });
    if (existing) continue;

    const tc = await prisma.testCatalog.create({
      data: {
        tenantId: tenant.id,
        code: param.code,
        name: param.name,
        category: "Biochemistry",
        department: "Biochemistry",
        price: 0,
        sampleType: "Serum",
        turnaroundHours: 6,
        isActive: true,
        loincCode: `LFT-${param.code}`,
      },
    });

    await prisma.referenceRange.create({
      data: {
        tenantId: tenant.id,
        testCatalogId: tc.id,
        genderFilter: null,
        lowNormal: param.lowN,
        highNormal: param.highN,
        lowCritical: param.lowC,
        highCritical: param.highC,
        unit: param.unit,
      },
    });
  }
  console.log("✓ LFT sub-test parameters + reference ranges seeded");

  // ─── KFT Sub-test Parameters ─────────────────────────────
  const kftParams = [
    { name: "Blood Urea",      code: "UREA",   lowN: 15,   highN: 40,    lowC: null, highC: 100, unit: "mg/dL" },
    { name: "Serum Creatinine", code: "CREAT",  lowN: 0.7,  highN: 1.3,   lowC: null, highC: 10,  unit: "mg/dL" },
    { name: "Uric Acid",       code: "UA",     lowN: 3.4,  highN: 7.0,   lowC: null, highC: 12,  unit: "mg/dL" },
    { name: "BUN",              code: "BUN",    lowN: 7,    highN: 20,    lowC: null, highC: 50,  unit: "mg/dL" },
    { name: "Sodium",           code: "NA",     lowN: 136,  highN: 145,   lowC: 120,  highC: 160, unit: "mEq/L" },
    { name: "Potassium",        code: "K",      lowN: 3.5,  highN: 5.1,   lowC: 2.5,  highC: 6.5, unit: "mEq/L" },
    { name: "Chloride",         code: "CL",     lowN: 98,   highN: 106,   lowC: 80,   highC: 120, unit: "mEq/L" },
    { name: "Calcium",          code: "CA",     lowN: 8.5,  highN: 10.5,  lowC: 6.0,  highC: 14,  unit: "mg/dL" },
  ];

  for (const param of kftParams) {
    const existing = await prisma.testCatalog.findFirst({
      where: { tenantId: tenant.id, code: param.code },
    });
    if (existing) continue;

    const tc = await prisma.testCatalog.create({
      data: {
        tenantId: tenant.id,
        code: param.code,
        name: param.name,
        category: "Biochemistry",
        department: "Biochemistry",
        price: 0,
        sampleType: "Serum",
        turnaroundHours: 6,
        isActive: true,
        loincCode: `KFT-${param.code}`,
      },
    });

    await prisma.referenceRange.create({
      data: {
        tenantId: tenant.id,
        testCatalogId: tc.id,
        genderFilter: null,
        lowNormal: param.lowN,
        highNormal: param.highN,
        lowCritical: param.lowC,
        highCritical: param.highC,
        unit: param.unit,
      },
    });
  }
  console.log("✓ KFT sub-test parameters + reference ranges seeded");

  // ─── Lipid Profile Sub-test Parameters ────────────────────
  const lipidParams = [
    { name: "Total Cholesterol",  code: "TCHOL",  lowN: 0,   highN: 200,  lowC: null, highC: 300, unit: "mg/dL" },
    { name: "Triglycerides",      code: "TG",     lowN: 0,   highN: 150,  lowC: null, highC: 500, unit: "mg/dL" },
    { name: "HDL Cholesterol",    code: "HDL",    lowN: 40,  highN: 60,   lowC: null, highC: null, unit: "mg/dL" },
    { name: "LDL Cholesterol",    code: "LDL",    lowN: 0,   highN: 100,  lowC: null, highC: 190, unit: "mg/dL" },
    { name: "VLDL Cholesterol",   code: "VLDL",   lowN: 0,   highN: 30,   lowC: null, highC: null, unit: "mg/dL" },
    { name: "TC/HDL Ratio",       code: "TCHDL",  lowN: 0,   highN: 4.5,  lowC: null, highC: null, unit: "ratio" },
  ];

  for (const param of lipidParams) {
    const existing = await prisma.testCatalog.findFirst({
      where: { tenantId: tenant.id, code: param.code },
    });
    if (existing) continue;

    const tc = await prisma.testCatalog.create({
      data: {
        tenantId: tenant.id,
        code: param.code,
        name: param.name,
        category: "Biochemistry",
        department: "Biochemistry",
        price: 0,
        sampleType: "Serum",
        turnaroundHours: 6,
        isActive: true,
        loincCode: `LIPID-${param.code}`,
      },
    });

    await prisma.referenceRange.create({
      data: {
        tenantId: tenant.id,
        testCatalogId: tc.id,
        genderFilter: null,
        lowNormal: param.lowN,
        highNormal: param.highN,
        lowCritical: param.lowC,
        highCritical: param.highC,
        unit: param.unit,
      },
    });
  }
  console.log("✓ Lipid Profile sub-test parameters + reference ranges seeded");

  // ─── Thyroid Sub-test Parameters ──────────────────────────
  const thyroidParams = [
    { name: "T3 (Total)",   code: "T3",    lowN: 0.8,  highN: 2.0,  lowC: null, highC: null, unit: "ng/mL" },
    { name: "T4 (Total)",   code: "T4",    lowN: 5.1,  highN: 14.1, lowC: null, highC: null, unit: "µg/dL" },
    { name: "TSH",          code: "TSH",   lowN: 0.27, highN: 4.2,  lowC: 0.05, highC: 50,   unit: "µIU/mL" },
  ];

  for (const param of thyroidParams) {
    const existing = await prisma.testCatalog.findFirst({
      where: { tenantId: tenant.id, code: param.code },
    });
    if (existing) continue;

    const tc = await prisma.testCatalog.create({
      data: {
        tenantId: tenant.id,
        code: param.code,
        name: param.name,
        category: "Endocrinology",
        department: "Biochemistry",
        price: 0,
        sampleType: "Serum",
        turnaroundHours: 8,
        isActive: true,
        loincCode: `TFT-${param.code}`,
      },
    });

    await prisma.referenceRange.create({
      data: {
        tenantId: tenant.id,
        testCatalogId: tc.id,
        genderFilter: null,
        lowNormal: param.lowN,
        highNormal: param.highN,
        lowCritical: param.lowC,
        highCritical: param.highC,
        unit: param.unit,
      },
    });
  }
  console.log("✓ Thyroid sub-test parameters + reference ranges seeded");

  // ─── Subscription Plans ───────────────────────────────────
  const plans = [
    {
      name: 'STARTER',
      displayName: 'Starter',
      monthlyPrice: 4999,
      annualPrice: 49999,
      maxUsers: 10,
      maxBranches: 1,
      maxOrdersPerMonth: 500,
      storageGB: 10,
      features: ['patient_management','order_entry','sample_tracking','result_entry','report_generation','basic_billing','patient_portal'],
    },
    {
      name: 'PRO',
      displayName: 'Pro',
      monthlyPrice: 12999,
      annualPrice: 129999,
      maxUsers: 50,
      maxBranches: 5,
      maxOrdersPerMonth: 5000,
      storageGB: 100,
      features: ['patient_management','order_entry','sample_tracking','result_entry','report_generation','basic_billing','patient_portal','crm_module','analytics_module','ai_features','hr_module','finance_module','procurement_module','meilisearch_search'],
    },
    {
      name: 'ENTERPRISE',
      displayName: 'Enterprise',
      monthlyPrice: 29999,
      annualPrice: 299999,
      maxUsers: -1,
      maxBranches: -1,
      maxOrdersPerMonth: -1,
      storageGB: 1000,
      features: ['patient_management','order_entry','sample_tracking','result_entry','report_generation','basic_billing','patient_portal','crm_module','analytics_module','ai_features','hr_module','finance_module','procurement_module','meilisearch_search','fhir_api','hl7_integration','instrument_interface','iot_monitoring','custom_domain','white_label','api_access','sso','priority_support'],
    },
  ];

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { name: plan.name },
      update: {},
      create: plan,
    });
  }
  console.log('✓ Subscription plans seeded');

  // ─── Feature Flags ────────────────────────────────────────
  const featureFlags = [
    { key: 'patient_management', name: 'Patient Management', category: 'modules', defaultValue: true },
    { key: 'order_entry', name: 'Order Entry', category: 'modules', defaultValue: true },
    { key: 'sample_tracking', name: 'Sample Tracking', category: 'modules', defaultValue: true },
    { key: 'result_entry', name: 'Result Entry', category: 'modules', defaultValue: true },
    { key: 'report_generation', name: 'Report Generation', category: 'modules', defaultValue: true },
    { key: 'basic_billing', name: 'Basic Billing', category: 'modules', defaultValue: true },
    { key: 'patient_portal', name: 'Patient Portal', category: 'modules', defaultValue: true },
    { key: 'crm_module', name: 'CRM & Referrals', category: 'modules', defaultValue: false },
    { key: 'analytics_module', name: 'Analytics Dashboard', category: 'modules', defaultValue: false },
    { key: 'finance_module', name: 'Finance & GL', category: 'modules', defaultValue: false },
    { key: 'hr_module', name: 'HR & Payroll', category: 'modules', defaultValue: false },
    { key: 'procurement_module', name: 'Procurement', category: 'modules', defaultValue: false },
    { key: 'ai_features', name: 'AI Suggestions', category: 'ai', defaultValue: false },
    { key: 'meilisearch_search', name: 'Smart Search', category: 'ai', defaultValue: false },
    { key: 'fhir_api', name: 'FHIR R4 API', category: 'integrations', defaultValue: false },
    { key: 'hl7_integration', name: 'HL7 Instrument Interface', category: 'integrations', defaultValue: false },
    { key: 'instrument_interface', name: 'Analyzer Integration', category: 'integrations', defaultValue: false },
    { key: 'iot_monitoring', name: 'IoT / Cold Chain', category: 'integrations', defaultValue: false },
    { key: 'api_access', name: 'API Access', category: 'integrations', defaultValue: false },
    { key: 'custom_domain', name: 'Custom Domain', category: 'enterprise', defaultValue: false },
    { key: 'white_label', name: 'White Labelling', category: 'enterprise', defaultValue: false },
    { key: 'sso', name: 'SSO / SAML2', category: 'enterprise', defaultValue: false },
    { key: 'priority_support', name: 'Priority Support', category: 'enterprise', defaultValue: false },
  ];

  for (const flag of featureFlags) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: {},
      create: flag,
    });
  }
  console.log('✓ Feature flags seeded');

  // ─── Default Rate List ──────────────────────────────────
  const allTests = await prisma.testCatalog.findMany({ where: { tenantId: tenant.id } });

  const existingRateList = await prisma.rateList.findFirst({
    where: { tenantId: tenant.id, name: 'DIRECT' },
  });
  if (!existingRateList) {
    const rateList = await prisma.rateList.create({
      data: {
        tenantId: tenant.id,
        name: 'DIRECT',
        description: 'Default walk-in patient rate list',
        isDefault: true,
      },
    });
    // Create rate list items for all tests (same as catalog price)
    if (allTests.length > 0) {
      await prisma.rateListItem.createMany({
        data: allTests.map((t) => ({
          rateListId: rateList.id,
          testCatalogId: t.id,
          price: t.price,
          isActive: true,
        })),
      });
    }
    console.log('✓ Default DIRECT rate list seeded with', allTests.length, 'items');
  } else {
    console.log('✓ DIRECT rate list already exists');
  }

  // Second rate list: discounted corporate rate
  const existingCorpRateList = await prisma.rateList.findFirst({
    where: { tenantId: tenant.id, name: 'CORPORATE' },
  });
  if (!existingCorpRateList) {
    const corpRateList = await prisma.rateList.create({
      data: {
        tenantId: tenant.id,
        name: 'CORPORATE',
        description: 'Corporate / B2B discounted rates (10% off)',
        isDefault: false,
      },
    });
    if (allTests.length > 0) {
      await prisma.rateListItem.createMany({
        data: allTests.map((t) => ({
          rateListId: corpRateList.id,
          testCatalogId: t.id,
          price: Math.round(Number(t.price) * 0.9 * 100) / 100,
          isActive: true,
        })),
      });
    }
    console.log('✓ CORPORATE rate list seeded with', allTests.length, 'items (10% discount)');
  } else {
    console.log('✓ CORPORATE rate list already exists');
  }

  // ─── Corporate Camps ───────────────────────
  const existingCamps = await prisma.corporateCamp.count({ where: { tenantId: tenant.id } });
  if (existingCamps === 0) {
    const now = new Date();
    const campData = [
      {
        tenantId: tenant.id,
        name: "Annual Health Checkup - TCS Bengaluru",
        location: "TCS Electronic City Campus",
        campDate: new Date(now.getFullYear(), now.getMonth() + 1, 15),
        endDate: new Date(now.getFullYear(), now.getMonth() + 1, 16),
        status: "PLANNED",
        expectedCount: 200,
        actualCount: 0,
        totalRevenue: 0,
        notes: "Annual employee wellness screening program",
      },
      {
        tenantId: tenant.id,
        name: "Executive Health Screening - Infosys",
        location: "Infosys Hebbal Office",
        campDate: new Date(now.getFullYear(), now.getMonth(), 10),
        endDate: new Date(now.getFullYear(), now.getMonth(), 10),
        status: "COMPLETED",
        expectedCount: 50,
        actualCount: 47,
        totalRevenue: 141000,
        notes: "Executive health screening package",
      },
      {
        tenantId: tenant.id,
        name: "Wellness Drive - Wipro Sarjapur",
        location: "Wipro Sarjapur Campus",
        campDate: new Date(now.getFullYear(), now.getMonth(), 25),
        status: "ACTIVE",
        expectedCount: 150,
        actualCount: 82,
        totalRevenue: 246000,
        notes: "Ongoing wellness drive",
      },
    ];
    for (const c of campData) {
      await prisma.corporateCamp.create({ data: c });
    }
    console.log("✓ Corporate camps seeded:", campData.length);
  } else {
    console.log("✓ Corporate camps already exist:", existingCamps);
  }

  // ─── Quality Documents ─────────────────────
  const existingDocs = await prisma.qualityDocument.count({ where: { tenantId: tenant.id } });
  if (existingDocs === 0) {
    const docs = [
      {
        tenantId: tenant.id,
        title: "Standard Operating Procedure - Sample Collection",
        type: "SOP",
        category: "Pre-Analytical",
        version: "2.1",
        status: "ACTIVE",
        effectiveAt: new Date("2025-01-01"),
        expiresAt: new Date("2026-12-31"),
        content: "This SOP covers the standard procedures for venipuncture, capillary collection, and urine sample collection...",
      },
      {
        tenantId: tenant.id,
        title: "Quality Policy Statement",
        type: "Policy",
        category: "Quality Management",
        version: "1.0",
        status: "ACTIVE",
        effectiveAt: new Date("2024-06-01"),
      },
      {
        tenantId: tenant.id,
        title: "Internal Quality Control - Hematology",
        type: "SOP",
        category: "Analytical",
        version: "3.0",
        status: "ACTIVE",
        effectiveAt: new Date("2025-03-01"),
        expiresAt: new Date("2027-02-28"),
        content: "IQC procedures for hematology analyzers including daily calibration, L-J charts, and Westgard rules...",
      },
      {
        tenantId: tenant.id,
        title: "Specimen Rejection Criteria",
        type: "SOP",
        category: "Pre-Analytical",
        version: "1.2",
        status: "ACTIVE",
        effectiveAt: new Date("2025-01-15"),
        expiresAt: new Date("2026-01-14"),
      },
      {
        tenantId: tenant.id,
        title: "NABL Audit Preparation Checklist",
        type: "Form",
        category: "Accreditation",
        version: "1.0",
        status: "DRAFT",
      },
    ];
    for (const d of docs) {
      await prisma.qualityDocument.create({ data: d });
    }
    console.log("✓ Quality documents seeded:", docs.length);
  } else {
    console.log("✓ Quality documents already exist:", existingDocs);
  }

  console.log("");
  console.log("🎉 DELViON Health seed complete!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Tenant:    DELViON Health Demo Lab");
  console.log("  Branch:    Main Branch - Bengaluru");
  console.log("  Password:  Admin@123");
  console.log("  Admin:     admin@delvion.com");
  console.log("  SuperAdmin:superadmin@delvion.com");
  console.log("  Tests:     20 master + 38 sub-params (LOINC-coded, ₹ INR)");
  console.log("  Packages:  3");
  console.log("  Patients:  10 (Indian names, +91 phones)");
  console.log("  Doctors:   2 (Dr. Priya Sharma, Dr. Rajan Mehta)");
  console.log("  Orders:    3 general + 8 lab pipeline");
  console.log("  Lab Pipeline: PENDING_COLLECTION×2, RECEIVED×2, IN_PROCESSING×1, PENDING_APPROVAL×2, APPROVED×1");
  console.log("  Results:   4 orders with test results (incl. abnormal+critical)");
  console.log("  Ref Ranges:12 base + CBC×11 + LFT×10 + KFT×8 + Lipid×6 + Thyroid×3");
  console.log("  Instruments: 5 (4 ACTIVE, 1 MAINTENANCE)");
  console.log("  Employees: 5 (Lab Manager, Pathologist, Lab Tech, Front Desk, Phlebotomist)");
  console.log("  Appointments: 5 (Walk-in, Home Collection, Corporate)");
  console.log("  Plans:     3 (STARTER, PRO, ENTERPRISE)");
  console.log("  Flags:     23 feature flags");
  console.log("  RateLists: 2 (DIRECT + CORPORATE)");
  console.log("  Camps:     3 (TCS, Infosys, Wipro)");
  console.log("  QC Docs:   5 (SOPs, Policy, Form)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    void prisma.$disconnect();
    process.exit(1);
  });
