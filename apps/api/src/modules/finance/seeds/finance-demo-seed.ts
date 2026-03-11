import { PrismaClient } from "@prisma/client";

const TENANT_ID = "tenant-delvion-001";
const BRANCH_ID = "branch-delvion-001";
const PASSWORD_HASH =
  "$2a$12$LJ3rRVp5g0JDpz0lBpSsWOqXzXqN9dJJyELPXXXcYX0iUF5d9YdFO";

// ---------------------------------------------------------------------------
// Helper: date builder
// ---------------------------------------------------------------------------
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateOf(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

// ---------------------------------------------------------------------------
// 1. Users + Employees + SalaryStructures
// ---------------------------------------------------------------------------
const employeeData = [
  {
    userId: "fin-demo-user-priya",
    empId: "fin-demo-emp-priya",
    salId: "fin-demo-sal-priya",
    firstName: "Priya",
    lastName: "Sharma",
    email: "priya.sharma@delvion-demo.in",
    role: "LAB_MANAGER" as const,
    employeeCode: "EMP-FIN-001",
    department: "Laboratory",
    designation: "Lab Manager",
    salary: 32000,
    pan: "ABCPS1234A",
    aadhaar: "2345 6789 0123",
    bankAcc: "9876543210001",
    ifsc: "HDFC0001234",
    pf: "KNPF0012345000001",
    esi: null as string | null,
    basic: 25000,
    hra: 5000,
    special: 2000,
    gross: 32000,
    pfApplicable: true,
    esicApplicable: false,
    ptApplicable: true,
  },
  {
    userId: "fin-demo-user-ravi",
    empId: "fin-demo-emp-ravi",
    salId: "fin-demo-sal-ravi",
    firstName: "Ravi",
    lastName: "Kumar",
    email: "ravi.kumar@delvion-demo.in",
    role: "PHLEBOTOMIST" as const,
    employeeCode: "EMP-FIN-002",
    department: "Phlebotomy",
    designation: "Phlebotomist",
    salary: 18000,
    pan: "ABCPK5678B",
    aadhaar: "3456 7890 1234",
    bankAcc: "9876543210002",
    ifsc: "HDFC0001234",
    pf: "KNPF0012345000002",
    esi: "31-00-123456-000-0002",
    basic: 12000,
    hra: 3000,
    special: 3000,
    gross: 18000,
    pfApplicable: true,
    esicApplicable: true,
    ptApplicable: true,
  },
  {
    userId: "fin-demo-user-anita",
    empId: "fin-demo-emp-anita",
    salId: "fin-demo-sal-anita",
    firstName: "Anita",
    lastName: "Nair",
    email: "anita.nair@delvion-demo.in",
    role: "FRONT_DESK" as const,
    employeeCode: "EMP-FIN-003",
    department: "Front Desk",
    designation: "Receptionist",
    salary: 14000,
    pan: "ABCPN9012C",
    aadhaar: "4567 8901 2345",
    bankAcc: "9876543210003",
    ifsc: "HDFC0001234",
    pf: "KNPF0012345000003",
    esi: "31-00-123456-000-0003",
    basic: 9000,
    hra: 2500,
    special: 2500,
    gross: 14000,
    pfApplicable: true,
    esicApplicable: true,
    ptApplicable: true,
  },
  {
    userId: "fin-demo-user-suresh",
    empId: "fin-demo-emp-suresh",
    salId: "fin-demo-sal-suresh",
    firstName: "Suresh",
    lastName: "Iyer",
    email: "suresh.iyer@delvion-demo.in",
    role: "PATHOLOGIST" as const,
    employeeCode: "EMP-FIN-004",
    department: "Pathology",
    designation: "Senior Pathologist",
    salary: 65000,
    pan: "ABCPI3456D",
    aadhaar: "5678 9012 3456",
    bankAcc: "9876543210004",
    ifsc: "HDFC0001234",
    pf: "KNPF0012345000004",
    esi: null as string | null,
    basic: 45000,
    hra: 12000,
    special: 8000,
    gross: 65000,
    pfApplicable: true,
    esicApplicable: false,
    ptApplicable: true,
  },
  {
    userId: "fin-demo-user-meena",
    empId: "fin-demo-emp-meena",
    salId: "fin-demo-sal-meena",
    firstName: "Meena",
    lastName: "Pillai",
    email: "meena.pillai@delvion-demo.in",
    role: "FRONT_DESK" as const,
    employeeCode: "EMP-FIN-005",
    department: "Front Desk",
    designation: "Receptionist",
    salary: 12000,
    pan: "ABCPP7890E",
    aadhaar: "6789 0123 4567",
    bankAcc: "9876543210005",
    ifsc: "HDFC0001234",
    pf: "KNPF0012345000005",
    esi: "31-00-123456-000-0005",
    basic: 8000,
    hra: 2000,
    special: 2000,
    gross: 12000,
    pfApplicable: true,
    esicApplicable: true,
    ptApplicable: true,
  },
];

// ---------------------------------------------------------------------------
// 2. Vendors
// ---------------------------------------------------------------------------
const vendorData = [
  {
    id: "fin-demo-vendor-sigma",
    name: "Sigma Diagnostics",
    code: "VND-001",
    contactPerson: "Arun Mehta",
    email: "arun@sigmadiag.in",
    phone: "9876500001",
    paymentTerms: 30,
    gstNumber: "29AAACS1234H1ZP",
    panNumber: "AAACS1234H",
    tdsSection: "194C",
  },
  {
    id: "fin-demo-vendor-medsupply",
    name: "MedSupply India",
    code: "VND-002",
    contactPerson: "Sneha Reddy",
    email: "sneha@medsupply.in",
    phone: "9876500002",
    paymentTerms: 15,
    gstNumber: "29AABCM5678J1ZQ",
    panNumber: "AABCM5678J",
    tdsSection: "194C",
  },
  {
    id: "fin-demo-vendor-labtech",
    name: "LabTech Solutions",
    code: "VND-003",
    contactPerson: "Vikram Joshi",
    email: "vikram@labtech.in",
    phone: "9876500003",
    paymentTerms: 45,
    gstNumber: "29AADCL9012K1ZR",
    panNumber: "AADCL9012K",
    tdsSection: "194J",
  },
  {
    id: "fin-demo-vendor-fastcourier",
    name: "FastCourier Ltd",
    code: "VND-004",
    contactPerson: "Deepak Shah",
    email: "deepak@fastcourier.in",
    phone: "9876500004",
    paymentTerms: 7,
    gstNumber: "29AAECF3456L1ZS",
    panNumber: "AAECF3456L",
    tdsSection: "194C",
  },
];

// ---------------------------------------------------------------------------
// 3. Bank Statement Lines
// ---------------------------------------------------------------------------
const statementLines: Array<{
  id: string;
  date: Date;
  description: string;
  amount: number;
  type: string;
  referenceNumber?: string;
}> = [
  { id: "fin-demo-stmt-01", date: dateOf(2026, 3, 2), description: "NEFT SIGMA DIAGNOSTICS LTD REF TXN8821", amount: 45000, type: "DEBIT" },
  { id: "fin-demo-stmt-02", date: dateOf(2026, 3, 3), description: "UPI PATIENT RAJESH KUMAR INV2026001", amount: 8500, type: "CREDIT" },
  { id: "fin-demo-stmt-03", date: dateOf(2026, 3, 5), description: "NACH HDFC BANK EMI LOAN ACC 8821", amount: 25000, type: "DEBIT" },
  { id: "fin-demo-stmt-04", date: dateOf(2026, 3, 7), description: "NEFT MEDSUPPLY INDIA PVT LTD", amount: 12800, type: "DEBIT" },
  { id: "fin-demo-stmt-05", date: dateOf(2026, 3, 8), description: "UPI PATIENT SUNITA VERMA INV2026002", amount: 12000, type: "CREDIT" },
  { id: "fin-demo-stmt-06", date: dateOf(2026, 3, 10), description: "IMPS APOLLO INSURANCE SETTLEMENT", amount: 85000, type: "CREDIT" },
  { id: "fin-demo-stmt-07", date: dateOf(2026, 3, 10), description: "NEFT LABTECH SOLUTIONS MAINT CHARGES", amount: 28500, type: "DEBIT" },
  { id: "fin-demo-stmt-08", date: dateOf(2026, 3, 12), description: "UPI PATIENT MOHAN DAS INV2026003", amount: 3500, type: "CREDIT" },
  { id: "fin-demo-stmt-09", date: dateOf(2026, 3, 13), description: "NEFT OFFICE RENT MARCH 2026", amount: 35000, type: "DEBIT" },
  { id: "fin-demo-stmt-10", date: dateOf(2026, 3, 14), description: "ELECTRICITY BILL BESCOM MARCH", amount: 4200, type: "DEBIT" },
  { id: "fin-demo-stmt-11", date: dateOf(2026, 3, 15), description: "TDS DEPOSIT 194C MARCH CHALLAN", amount: 8500, type: "DEBIT" },
  { id: "fin-demo-stmt-12", date: dateOf(2026, 3, 15), description: "PF DEPOSIT MARCH 2026 ECR", amount: 14400, type: "DEBIT" },
  { id: "fin-demo-stmt-13", date: dateOf(2026, 3, 17), description: "UPI PATIENT PRIYA NAIR INV2026004", amount: 9200, type: "CREDIT" },
  { id: "fin-demo-stmt-14", date: dateOf(2026, 3, 18), description: "NEFT SIGMA DIAGNOSTICS REAGENTS", amount: 18000, type: "DEBIT", referenceNumber: "TXN9901" },
  { id: "fin-demo-stmt-15", date: dateOf(2026, 3, 18), description: "NEFT SIGMA DIAGNOSTICS REAGENTS", amount: 18000, type: "DEBIT", referenceNumber: "TXN9902" },
  { id: "fin-demo-stmt-16", date: dateOf(2026, 3, 20), description: "SALARY TRANSFER MARCH 2026 BATCH", amount: 91350, type: "DEBIT" },
  { id: "fin-demo-stmt-17", date: dateOf(2026, 3, 22), description: "INTERNET BILL AIRTEL MARCH", amount: 2100, type: "DEBIT" },
  { id: "fin-demo-stmt-18", date: dateOf(2026, 3, 25), description: "CORPORATE BILLING HEALTHHUB LABS", amount: 125000, type: "CREDIT" },
  { id: "fin-demo-stmt-19", date: dateOf(2026, 3, 31), description: "BANK CHARGES MARCH 2026", amount: 350, type: "DEBIT" },
];

// ---------------------------------------------------------------------------
// 4. Patient stubs (needed for Invoice.patientId FK)
// ---------------------------------------------------------------------------
const patientData = [
  {
    id: "fin-demo-patient-rajesh",
    mrn: "MRN-FIN-DEMO-001",
    firstName: "Rajesh",
    lastName: "Kumar",
    phone: "9800000001",
    gender: "MALE",
    dob: dateOf(1985, 6, 15),
  },
  {
    id: "fin-demo-patient-sunita",
    mrn: "MRN-FIN-DEMO-002",
    firstName: "Sunita",
    lastName: "Verma",
    phone: "9800000002",
    gender: "FEMALE",
    dob: dateOf(1990, 3, 22),
  },
  {
    id: "fin-demo-patient-mohan",
    mrn: "MRN-FIN-DEMO-003",
    firstName: "Mohan",
    lastName: "Das",
    phone: "9800000003",
    gender: "MALE",
    dob: dateOf(1978, 11, 8),
  },
  {
    id: "fin-demo-patient-priyan",
    mrn: "MRN-FIN-DEMO-004",
    firstName: "Priya",
    lastName: "Nair",
    phone: "9800000004",
    gender: "FEMALE",
    dob: dateOf(1992, 1, 30),
  },
  {
    id: "fin-demo-patient-apollo",
    mrn: "MRN-FIN-DEMO-005",
    firstName: "Apollo",
    lastName: "Insurance",
    phone: "9800000005",
    gender: "MALE",
    dob: dateOf(2000, 1, 1),
  },
  {
    id: "fin-demo-patient-healthhub",
    mrn: "MRN-FIN-DEMO-006",
    firstName: "HealthHub",
    lastName: "Labs",
    phone: "9800000006",
    gender: "MALE",
    dob: dateOf(2000, 1, 1),
  },
];

// ---------------------------------------------------------------------------
// 5. Invoices
// ---------------------------------------------------------------------------
const invoiceData = [
  {
    id: "fin-demo-inv-001",
    invoiceNumber: "INV-DEMO-001",
    patientId: "fin-demo-patient-rajesh",
    total: 8500,
    amountPaid: 8500,
    status: "PAID" as const,
    dueDate: daysAgo(20),
    paidAt: dateOf(2026, 3, 3),
    invoiceType: "PATIENT",
    createdAt: dateOf(2026, 2, 25),
  },
  {
    id: "fin-demo-inv-002",
    invoiceNumber: "INV-DEMO-002",
    patientId: "fin-demo-patient-sunita",
    total: 12000,
    amountPaid: 5000,
    status: "PARTIALLY_PAID" as const,
    dueDate: daysAgo(45),
    paidAt: null as Date | null,
    invoiceType: "PATIENT",
    createdAt: dateOf(2026, 1, 20),
  },
  {
    id: "fin-demo-inv-003",
    invoiceNumber: "INV-DEMO-003",
    patientId: "fin-demo-patient-mohan",
    total: 3500,
    amountPaid: 3500,
    status: "PAID" as const,
    dueDate: daysAgo(15),
    paidAt: dateOf(2026, 3, 12),
    invoiceType: "PATIENT",
    createdAt: dateOf(2026, 3, 1),
  },
  {
    id: "fin-demo-inv-004",
    invoiceNumber: "INV-DEMO-004",
    patientId: "fin-demo-patient-priyan",
    total: 9200,
    amountPaid: 0,
    status: "SENT" as const,
    dueDate: daysAgo(5),
    paidAt: null as Date | null,
    invoiceType: "PATIENT",
    createdAt: dateOf(2026, 2, 28),
  },
  {
    id: "fin-demo-inv-005",
    invoiceNumber: "INV-DEMO-005",
    patientId: "fin-demo-patient-apollo",
    total: 85000,
    amountPaid: 85000,
    status: "PAID" as const,
    dueDate: daysAgo(10),
    paidAt: dateOf(2026, 3, 10),
    invoiceType: "INSURANCE",
    createdAt: dateOf(2026, 2, 15),
  },
  {
    id: "fin-demo-inv-006",
    invoiceNumber: "INV-DEMO-006",
    patientId: "fin-demo-patient-healthhub",
    total: 125000,
    amountPaid: 0,
    status: "SENT" as const,
    dueDate: daysAgo(95),
    paidAt: null as Date | null,
    invoiceType: "CORPORATE",
    createdAt: dateOf(2025, 12, 1),
  },
];

// ===========================================================================
// Main seed function
// ===========================================================================
export async function seedFinanceDemo(prisma: PrismaClient) {
  console.log("\n--- Finance Demo Seed: START ---\n");

  // -----------------------------------------------------------------------
  // 1a. Users
  // -----------------------------------------------------------------------
  console.log("[1/7] Seeding demo users...");
  for (const e of employeeData) {
    await prisma.user.upsert({
      where: {
        tenantId_email: { tenantId: TENANT_ID, email: e.email },
      },
      update: {
        id: e.userId,
        firstName: e.firstName,
        lastName: e.lastName,
        role: e.role,
        isActive: true,
      },
      create: {
        id: e.userId,
        tenantId: TENANT_ID,
        email: e.email,
        firstName: e.firstName,
        lastName: e.lastName,
        role: e.role,
        passwordHash: PASSWORD_HASH,
        isActive: true,
      },
    });
  }
  console.log(`  -> ${employeeData.length} users upserted.`);

  // -----------------------------------------------------------------------
  // 1b. Employees
  // -----------------------------------------------------------------------
  console.log("[2/7] Seeding demo employees...");
  for (const e of employeeData) {
    await prisma.employee.upsert({
      where: {
        tenantId_employeeCode: {
          tenantId: TENANT_ID,
          employeeCode: e.employeeCode,
        },
      },
      update: {
        id: e.empId,
        userId: e.userId,
        department: e.department,
        designation: e.designation,
        salary: e.salary,
        panNumber: e.pan,
        aadhaarNumber: e.aadhaar,
        bankAccountNumber: e.bankAcc,
        bankIfsc: e.ifsc,
        pfNumber: e.pf,
        esiNumber: e.esi,
        isActive: true,
      },
      create: {
        id: e.empId,
        tenantId: TENANT_ID,
        userId: e.userId,
        employeeCode: e.employeeCode,
        department: e.department,
        designation: e.designation,
        branchId: BRANCH_ID,
        joiningDate: dateOf(2024, 4, 1),
        salary: e.salary,
        panNumber: e.pan,
        aadhaarNumber: e.aadhaar,
        bankAccountNumber: e.bankAcc,
        bankIfsc: e.ifsc,
        pfNumber: e.pf,
        esiNumber: e.esi,
        isActive: true,
      },
    });
  }
  console.log(`  -> ${employeeData.length} employees upserted.`);

  // -----------------------------------------------------------------------
  // 1c. SalaryStructures
  // -----------------------------------------------------------------------
  console.log("[3/7] Seeding salary structures...");
  for (const e of employeeData) {
    await prisma.salaryStructure.upsert({
      where: { id: e.salId },
      update: {
        basicSalary: e.basic,
        hra: e.hra,
        specialAllowance: e.special,
        grossSalary: e.gross,
        pfApplicable: e.pfApplicable,
        esicApplicable: e.esicApplicable,
        ptApplicable: e.ptApplicable,
        isActive: true,
      },
      create: {
        id: e.salId,
        tenantId: TENANT_ID,
        employeeId: e.empId,
        effectiveFrom: dateOf(2024, 4, 1),
        basicSalary: e.basic,
        hra: e.hra,
        conveyanceAllowance: 0,
        medicalAllowance: 0,
        specialAllowance: e.special,
        otherAllowances: 0,
        grossSalary: e.gross,
        pfApplicable: e.pfApplicable,
        esicApplicable: e.esicApplicable,
        ptApplicable: e.ptApplicable,
        isActive: true,
      },
    });
  }
  console.log(`  -> ${employeeData.length} salary structures upserted.`);

  // -----------------------------------------------------------------------
  // 2. Vendors
  // -----------------------------------------------------------------------
  console.log("[4/7] Seeding demo vendors...");
  for (const v of vendorData) {
    await prisma.vendor.upsert({
      where: { id: v.id },
      update: {
        name: v.name,
        code: v.code,
        contactPerson: v.contactPerson,
        email: v.email,
        phone: v.phone,
        paymentTerms: v.paymentTerms,
        gstNumber: v.gstNumber,
        panNumber: v.panNumber,
        tdsApplicable: true,
        tdsSection: v.tdsSection,
        isActive: true,
      },
      create: {
        id: v.id,
        tenantId: TENANT_ID,
        name: v.name,
        code: v.code,
        contactPerson: v.contactPerson,
        email: v.email,
        phone: v.phone,
        paymentTerms: v.paymentTerms,
        gstNumber: v.gstNumber,
        panNumber: v.panNumber,
        tdsApplicable: true,
        tdsSection: v.tdsSection,
        isActive: true,
      },
    });
  }
  console.log(`  -> ${vendorData.length} vendors upserted.`);

  // -----------------------------------------------------------------------
  // 3. Bank Account
  // -----------------------------------------------------------------------
  console.log("[5/7] Seeding demo bank account...");
  await prisma.bankAccount.upsert({
    where: { id: "fin-demo-bank-hdfc" },
    update: {
      name: "HDFC Current Account - Demo",
      accountNumber: "50100012345678",
      bankName: "HDFC Bank",
      ifscCode: "HDFC0001234",
      currentBalance: 440000,
      isActive: true,
    },
    create: {
      id: "fin-demo-bank-hdfc",
      tenantId: TENANT_ID,
      name: "HDFC Current Account - Demo",
      accountNumber: "50100012345678",
      bankName: "HDFC Bank",
      ifscCode: "HDFC0001234",
      currentBalance: 440000,
      isActive: true,
    },
  });
  console.log("  -> 1 bank account upserted.");

  // -----------------------------------------------------------------------
  // 4. Bank Statement Lines
  // -----------------------------------------------------------------------
  console.log("[6/7] Seeding demo bank statement lines...");
  for (const s of statementLines) {
    await prisma.bankStatement.upsert({
      where: { id: s.id },
      update: {
        transactionDate: s.date,
        description: s.description,
        amount: s.amount,
        type: s.type,
        referenceNumber: s.referenceNumber ?? null,
        reconcileStatus: "UNMATCHED",
      },
      create: {
        id: s.id,
        tenantId: TENANT_ID,
        bankAccountId: "fin-demo-bank-hdfc",
        transactionDate: s.date,
        description: s.description,
        amount: s.amount,
        type: s.type,
        referenceNumber: s.referenceNumber ?? null,
        reconcileStatus: "UNMATCHED",
      },
    });
  }
  console.log(`  -> ${statementLines.length} bank statement lines upserted.`);

  // -----------------------------------------------------------------------
  // 5. Patient stubs (required FK for invoices)
  // -----------------------------------------------------------------------
  console.log("[7/7] Seeding demo patients & invoices...");
  for (const p of patientData) {
    await prisma.patient.upsert({
      where: {
        tenantId_mrn: { tenantId: TENANT_ID, mrn: p.mrn },
      },
      update: {
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        phone: p.phone,
        gender: p.gender,
        dob: p.dob,
      },
      create: {
        id: p.id,
        tenantId: TENANT_ID,
        branchId: BRANCH_ID,
        mrn: p.mrn,
        firstName: p.firstName,
        lastName: p.lastName,
        phone: p.phone,
        gender: p.gender,
        dob: p.dob,
      },
    });
  }
  console.log(`  -> ${patientData.length} patients upserted.`);

  // -----------------------------------------------------------------------
  // 6. Invoices
  // -----------------------------------------------------------------------
  for (const inv of invoiceData) {
    await prisma.invoice.upsert({
      where: {
        tenantId_invoiceNumber: {
          tenantId: TENANT_ID,
          invoiceNumber: inv.invoiceNumber,
        },
      },
      update: {
        id: inv.id,
        patientId: inv.patientId,
        subtotal: inv.total,
        total: inv.total,
        amountPaid: inv.amountPaid,
        balance: inv.total - inv.amountPaid,
        status: inv.status,
        dueDate: inv.dueDate,
        paidAt: inv.paidAt,
        invoiceType: inv.invoiceType,
      },
      create: {
        id: inv.id,
        tenantId: TENANT_ID,
        invoiceNumber: inv.invoiceNumber,
        patientId: inv.patientId,
        subtotal: inv.total,
        discount: 0,
        tax: 0,
        total: inv.total,
        amountPaid: inv.amountPaid,
        balance: inv.total - inv.amountPaid,
        status: inv.status,
        dueDate: inv.dueDate,
        paidAt: inv.paidAt,
        invoiceType: inv.invoiceType,
        createdAt: inv.createdAt,
      },
    });
  }
  console.log(`  -> ${invoiceData.length} invoices upserted.`);

  console.log("\n--- Finance Demo Seed: COMPLETE ---\n");
}
