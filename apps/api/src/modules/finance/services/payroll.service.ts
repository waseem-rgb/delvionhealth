import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { JournalService } from "./journal.service";

@Injectable()
export class PayrollCalculationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journalService: JournalService,
  ) {}

  // ── PF Calculation ─────────────────────────────────────────────────────
  private calculatePF(basic: number, pfApplicable: boolean) {
    if (!pfApplicable) return { pfEmployee: 0, pfEmployer: 0 };
    const pfBase = Math.min(basic, 15000); // CAP at 15000
    const pfEmployee = Math.round(pfBase * 0.12 * 100) / 100;
    const pfEmployer = Math.round(pfBase * 0.12 * 100) / 100;
    return { pfEmployee, pfEmployer };
  }

  // ── ESIC Calculation ───────────────────────────────────────────────────
  private calculateESIC(gross: number, esicApplicable: boolean) {
    if (!esicApplicable || gross > 21000) return { esicEmployee: 0, esicEmployer: 0 };
    const esicEmployee = Math.round(gross * 0.0075 * 100) / 100;
    const esicEmployer = Math.round(gross * 0.0325 * 100) / 100;
    return { esicEmployee, esicEmployer };
  }

  // ── PT Calculation (Karnataka) ─────────────────────────────────────────
  private calculatePT(gross: number, month: number) {
    let pt = 0;
    if (gross >= 15000) pt = 200;
    else if (gross >= 10000) pt = 150;
    // February annual top-up
    if (month === 2 && gross >= 15000) pt = 300;
    return pt;
  }

  // ── TDS Calculation (New Regime FY 2025-26) ────────────────────────────
  private calculateMonthlyTDS(grossAnnual: number) {
    const standardDeduction = 75000;
    const taxable = Math.max(grossAnnual - standardDeduction, 0);

    let tax = 0;
    const slabs = [
      { limit: 300000, rate: 0 },
      { limit: 600000, rate: 0.05 },
      { limit: 900000, rate: 0.10 },
      { limit: 1200000, rate: 0.15 },
      { limit: 1500000, rate: 0.20 },
      { limit: Infinity, rate: 0.30 },
    ];

    let remaining = taxable;
    let prevLimit = 0;
    for (const slab of slabs) {
      const slabAmount = Math.min(remaining, slab.limit - prevLimit);
      if (slabAmount <= 0) break;
      tax += slabAmount * slab.rate;
      remaining -= slabAmount;
      prevLimit = slab.limit;
    }

    // Add 4% cess
    tax = tax * 1.04;

    const monthlyTds = Math.round((tax / 12) * 100) / 100;
    return monthlyTds;
  }

  // ── LOP Deduction ──────────────────────────────────────────────────────
  private calculateLOP(grossSalary: number, lopDays: number) {
    return Math.round((grossSalary / 30) * lopDays * 100) / 100;
  }

  // ── Full payroll calculation for one employee ──────────────────────────
  private calculateEmployeePayroll(
    structure: {
      basicSalary: number;
      hra: number;
      conveyanceAllowance: number;
      medicalAllowance: number;
      specialAllowance: number;
      otherAllowances: number;
      grossSalary: number;
      pfApplicable: boolean;
      esicApplicable: boolean;
      ptApplicable: boolean;
    },
    month: number,
    lopDays: number = 0,
  ) {
    const gross = structure.grossSalary;
    const lopDeduction = this.calculateLOP(gross, lopDays);
    const effectiveGross = gross - lopDeduction;

    const { pfEmployee, pfEmployer } = this.calculatePF(structure.basicSalary, structure.pfApplicable);
    const { esicEmployee, esicEmployer } = this.calculateESIC(effectiveGross, structure.esicApplicable);
    const pt = structure.ptApplicable ? this.calculatePT(effectiveGross, month) : 0;
    const tds = this.calculateMonthlyTDS(gross * 12); // annual projection based on CTC

    const totalDeductions = pfEmployee + esicEmployee + pt + tds + lopDeduction;
    const netSalary = Math.round((gross - totalDeductions) * 100) / 100;

    return {
      basicSalary: structure.basicSalary,
      hra: structure.hra,
      otherAllowances: structure.conveyanceAllowance + structure.medicalAllowance + structure.specialAllowance + structure.otherAllowances,
      grossSalary: gross,
      lopDays,
      lopDeduction,
      pfEmployee,
      pfEmployer,
      esicEmployee,
      esicEmployer,
      pt,
      tds,
      totalDeductions,
      netSalary,
    };
  }

  // ── Create Payroll Run ─────────────────────────────────────────────────
  async createPayrollRun(month: number, year: number, tenantId: string, userId: string) {
    // Check for existing run
    const existing = await this.prisma.payrollRun.findFirst({
      where: { tenantId, month, year },
    });
    if (existing) {
      throw new BadRequestException(`Payroll run already exists for ${month}/${year} (ID: ${existing.id}, status: ${existing.status})`);
    }

    // Fetch active employees with their latest salary structure
    const payrollDate = new Date(year, month - 1, 1);
    const employees = await this.prisma.employee.findMany({
      where: { tenantId, isActive: true },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        salaryStructures: {
          where: {
            isActive: true,
            effectiveFrom: { lte: payrollDate },
          },
          orderBy: { effectiveFrom: "desc" },
          take: 1,
        },
      },
    });

    const employeesWithStructure = employees.filter(e => e.salaryStructures.length > 0);
    if (employeesWithStructure.length === 0) {
      throw new BadRequestException("No active employees with salary structures found");
    }

    // Calculate payroll for each employee
    const lineData: any[] = [];
    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;
    let totalTds = 0;
    let totalPfEmployee = 0;
    let totalPfEmployer = 0;
    let totalEsicEmployee = 0;
    let totalEsicEmployer = 0;
    let totalPt = 0;

    for (const emp of employeesWithStructure) {
      const ss = emp.salaryStructures[0];
      const calc = this.calculateEmployeePayroll(
        {
          basicSalary: Number(ss.basicSalary),
          hra: Number(ss.hra),
          conveyanceAllowance: Number(ss.conveyanceAllowance),
          medicalAllowance: Number(ss.medicalAllowance),
          specialAllowance: Number(ss.specialAllowance),
          otherAllowances: Number(ss.otherAllowances),
          grossSalary: Number(ss.grossSalary),
          pfApplicable: ss.pfApplicable,
          esicApplicable: ss.esicApplicable,
          ptApplicable: ss.ptApplicable,
        },
        month,
        0, // lopDays default 0, can be updated later
      );

      lineData.push({
        tenantId,
        employeeId: emp.id,
        basicSalary: calc.basicSalary,
        hra: calc.hra,
        otherAllowances: calc.otherAllowances,
        grossSalary: calc.grossSalary,
        lopDays: calc.lopDays,
        lopDeduction: calc.lopDeduction,
        pfEmployee: calc.pfEmployee,
        pfEmployer: calc.pfEmployer,
        esicEmployee: calc.esicEmployee,
        esicEmployer: calc.esicEmployer,
        pt: calc.pt,
        tds: calc.tds,
        totalDeductions: calc.totalDeductions,
        netSalary: calc.netSalary,
      });

      totalGross += calc.grossSalary;
      totalDeductions += calc.totalDeductions;
      totalNet += calc.netSalary;
      totalTds += calc.tds;
      totalPfEmployee += calc.pfEmployee;
      totalPfEmployer += calc.pfEmployer;
      totalEsicEmployee += calc.esicEmployee;
      totalEsicEmployer += calc.esicEmployer;
      totalPt += calc.pt;
    }

    // Create PayrollRun + lines in a transaction
    const run = await this.prisma.$transaction(async (tx) => {
      const payrollRun = await tx.payrollRun.create({
        data: {
          tenantId,
          month,
          year,
          status: "DRAFT" as any,
          totalGross,
          totalDeductions,
          totalNet,
          totalTds,
          totalPfEmployee,
          totalPfEmployer,
          totalEsicEmployee,
          totalEsicEmployer,
          totalPt,
        },
      });

      for (const line of lineData) {
        await tx.payrollLine.create({
          data: {
            ...line,
            payrollRunId: payrollRun.id,
          },
        });
      }

      return payrollRun;
    });

    return {
      id: run.id,
      month,
      year,
      status: run.status,
      employeeCount: lineData.length,
      totalGross,
      totalDeductions,
      totalNet,
      totalTds,
      totalPfEmployee,
      totalPfEmployer,
      totalEsicEmployee,
      totalEsicEmployer,
      totalPt,
    };
  }

  // ── Get Payroll Run ────────────────────────────────────────────────────
  async getPayrollRun(id: string, tenantId: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id, tenantId },
      include: {
        lines: {
          include: {
            employee: {
              include: {
                user: { select: { firstName: true, lastName: true, email: true } },
              },
            },
          },
        },
      },
    });

    if (!run) throw new NotFoundException("Payroll run not found");

    return {
      ...run,
      totalGross: Number(run.totalGross),
      totalDeductions: Number(run.totalDeductions),
      totalNet: Number(run.totalNet),
      totalTds: Number(run.totalTds),
      totalPfEmployee: Number(run.totalPfEmployee),
      totalPfEmployer: Number(run.totalPfEmployer),
      totalEsicEmployee: Number(run.totalEsicEmployee),
      totalEsicEmployer: Number(run.totalEsicEmployer),
      totalPt: Number(run.totalPt),
      lines: ((run as any).lines ?? []).map((l: any) => ({
        ...l,
        basicSalary: Number(l.basicSalary),
        hra: Number(l.hra),
        otherAllowances: Number(l.otherAllowances),
        grossSalary: Number(l.grossSalary),
        lopDays: Number(l.lopDays),
        lopDeduction: Number(l.lopDeduction),
        pfEmployee: Number(l.pfEmployee),
        pfEmployer: Number(l.pfEmployer),
        esicEmployee: Number(l.esicEmployee),
        esicEmployer: Number(l.esicEmployer),
        pt: Number(l.pt),
        tds: Number(l.tds),
        totalDeductions: Number(l.totalDeductions),
        netSalary: Number(l.netSalary),
        employeeName: l.employee?.user?.name ?? "Unknown",
      })),
    };
  }

  // ── Approve Payroll Run ────────────────────────────────────────────────
  async approvePayrollRun(id: string, tenantId: string, userId: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id, tenantId },
    });
    if (!run) throw new NotFoundException("Payroll run not found");
    if (run.status !== "DRAFT") {
      throw new BadRequestException(`Cannot approve payroll run in status: ${run.status}`);
    }

    return this.prisma.payrollRun.update({
      where: { id },
      data: {
        status: "APPROVED" as any,
        approvedById: userId,
        approvedAt: new Date(),
      },
    });
  }

  // ── Post Payroll (create journal entry) ────────────────────────────────
  async postPayroll(id: string, tenantId: string, userId: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id, tenantId },
      include: { lines: true },
    });
    if (!run) throw new NotFoundException("Payroll run not found");
    if (run.status !== "APPROVED") {
      throw new BadRequestException(`Payroll run must be APPROVED before posting. Current status: ${run.status}`);
    }

    // Aggregate totals from lines
    const totalGross = Number(run.totalGross);
    const totalNet = Number(run.totalNet);
    const totalTds = Number(run.totalTds);
    const totalPfEmployee = Number(run.totalPfEmployee);
    const totalPfEmployer = Number(run.totalPfEmployer);
    const totalEsicEmployee = Number(run.totalEsicEmployee);
    const totalEsicEmployer = Number(run.totalEsicEmployer);
    const totalPt = Number(run.totalPt);

    // Find GL accounts by code
    const getGLAccount = async (code: string) => {
      const account = await this.prisma.gLAccount.findFirst({
        where: { tenantId, code },
      });
      if (!account) throw new BadRequestException(`GL Account with code ${code} not found. Ensure chart of accounts is seeded.`);
      return account.id;
    };

    const [
      salaryExpenseId,   // 5100
      pfEmployerExpId,   // 5200
      esicEmployerExpId, // 5201
      salaryPayableId,   // 2500
      tdsPayableId,      // 2100
      pfEmpPayableId,    // 2200
      pfErPayableId,     // 2201
      esicEmpPayableId,  // 2300
      esicErPayableId,   // 2301
      ptPayableId,       // 2400
    ] = await Promise.all([
      getGLAccount("5100"),
      getGLAccount("5200"),
      getGLAccount("5201"),
      getGLAccount("2500"),
      getGLAccount("2100"),
      getGLAccount("2200"),
      getGLAccount("2201"),
      getGLAccount("2300"),
      getGLAccount("2301"),
      getGLAccount("2400"),
    ]);

    // Build journal lines
    const journalLines: Array<{ ledgerAccountId: string; type: "DEBIT" | "CREDIT"; amount: number; narration?: string }> = [];

    // DEBIT side
    if (totalGross > 0) {
      journalLines.push({ ledgerAccountId: salaryExpenseId, type: "DEBIT", amount: totalGross, narration: "Salary Expense - Lab Staff" });
    }
    if (totalPfEmployer > 0) {
      journalLines.push({ ledgerAccountId: pfEmployerExpId, type: "DEBIT", amount: totalPfEmployer, narration: "PF Contribution - Employer" });
    }
    if (totalEsicEmployer > 0) {
      journalLines.push({ ledgerAccountId: esicEmployerExpId, type: "DEBIT", amount: totalEsicEmployer, narration: "ESIC Contribution - Employer" });
    }

    // CREDIT side
    if (totalNet > 0) {
      journalLines.push({ ledgerAccountId: salaryPayableId, type: "CREDIT", amount: totalNet, narration: "Salary Payable" });
    }
    if (totalTds > 0) {
      journalLines.push({ ledgerAccountId: tdsPayableId, type: "CREDIT", amount: totalTds, narration: "TDS Payable - 192 Salary" });
    }
    if (totalPfEmployee > 0) {
      journalLines.push({ ledgerAccountId: pfEmpPayableId, type: "CREDIT", amount: totalPfEmployee, narration: "PF Payable - Employee" });
    }
    if (totalPfEmployer > 0) {
      journalLines.push({ ledgerAccountId: pfErPayableId, type: "CREDIT", amount: totalPfEmployer, narration: "PF Payable - Employer" });
    }
    if (totalEsicEmployee > 0) {
      journalLines.push({ ledgerAccountId: esicEmpPayableId, type: "CREDIT", amount: totalEsicEmployee, narration: "ESIC Payable - Employee" });
    }
    if (totalEsicEmployer > 0) {
      journalLines.push({ ledgerAccountId: esicErPayableId, type: "CREDIT", amount: totalEsicEmployer, narration: "ESIC Payable - Employer" });
    }
    if (totalPt > 0) {
      journalLines.push({ ledgerAccountId: ptPayableId, type: "CREDIT", amount: totalPt, narration: "Professional Tax Payable" });
    }

    // Verify balance before posting
    const totalDebit = journalLines.filter(l => l.type === "DEBIT").reduce((s, l) => s + l.amount, 0);
    const totalCredit = journalLines.filter(l => l.type === "CREDIT").reduce((s, l) => s + l.amount, 0);

    console.log(`[PayrollPost] Run ${id} | Debit: ${totalDebit.toFixed(2)} | Credit: ${totalCredit.toFixed(2)} | Balanced: ${Math.abs(totalDebit - totalCredit) < 0.01}`);

    if (Math.abs(totalDebit - totalCredit) >= 0.01) {
      throw new BadRequestException(
        `Journal entry is unbalanced! Debit=${totalDebit.toFixed(2)}, Credit=${totalCredit.toFixed(2)}, Diff=${(totalDebit - totalCredit).toFixed(2)}`,
      );
    }

    // Round to ensure exact balance
    const roundedLines = journalLines.map(l => ({
      ...l,
      amount: Math.round(l.amount * 100) / 100,
    }));

    const journalEntry = await this.journalService.createJournal({
      tenantId,
      date: new Date().toISOString(),
      narration: `Payroll for ${run.month}/${run.year}`,
      refType: "PAYROLL",
      refId: id,
      postedBy: userId,
      lines: roundedLines,
    });

    // Update payroll run status
    await this.prisma.payrollRun.update({
      where: { id },
      data: {
        status: "PAID" as any,
        paidAt: new Date(),
        journalEntryId: journalEntry.id,
      },
    });

    return {
      payrollRunId: id,
      journalEntryId: journalEntry.id,
      status: "PAID",
      totalDebit: totalDebit.toFixed(2),
      totalCredit: totalCredit.toFixed(2),
    };
  }

  // ── Get Employees With Salary Structures ───────────────────────────────
  async getEmployeesWithStructures(tenantId: string) {
    const employees = await this.prisma.employee.findMany({
      where: { tenantId, isActive: true },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        salaryStructures: {
          where: { isActive: true },
          orderBy: { effectiveFrom: "desc" },
          take: 1,
        },
      },
      orderBy: { employeeCode: "asc" },
    });

    return (employees as any[]).map(e => ({
      id: e.id,
      employeeCode: e.employeeCode,
      name: `${e.user?.firstName ?? ""} ${e.user?.lastName ?? ""}`.trim() || "Unknown",
      email: e.user?.email ?? "",
      department: e.department,
      designation: e.designation,
      joiningDate: e.joiningDate,
      panNumber: e.panNumber,
      pfNumber: e.pfNumber,
      esiNumber: e.esiNumber,
      currentStructure: e.salaryStructures?.[0]
        ? {
            id: e.salaryStructures[0].id,
            effectiveFrom: e.salaryStructures[0].effectiveFrom,
            basicSalary: Number(e.salaryStructures[0].basicSalary),
            hra: Number(e.salaryStructures[0].hra),
            conveyanceAllowance: Number(e.salaryStructures[0].conveyanceAllowance),
            medicalAllowance: Number(e.salaryStructures[0].medicalAllowance),
            specialAllowance: Number(e.salaryStructures[0].specialAllowance),
            otherAllowances: Number(e.salaryStructures[0].otherAllowances),
            grossSalary: Number(e.salaryStructures[0].grossSalary),
            pfApplicable: e.salaryStructures[0].pfApplicable,
            esicApplicable: e.salaryStructures[0].esicApplicable,
            ptApplicable: e.salaryStructures[0].ptApplicable,
          }
        : null,
    }));
  }

  // ── Create Salary Structure ────────────────────────────────────────────
  async createSalaryStructure(
    dto: {
      employeeId: string;
      effectiveFrom: string;
      basicSalary: number;
      hra: number;
      conveyanceAllowance?: number;
      medicalAllowance?: number;
      specialAllowance?: number;
      otherAllowances?: number;
      pfApplicable?: boolean;
      esicApplicable?: boolean;
      ptApplicable?: boolean;
    },
    tenantId: string,
  ) {
    // Verify employee belongs to tenant
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, tenantId },
    });
    if (!employee) throw new NotFoundException("Employee not found in this tenant");

    const conveyance = dto.conveyanceAllowance ?? 0;
    const medical = dto.medicalAllowance ?? 0;
    const special = dto.specialAllowance ?? 0;
    const other = dto.otherAllowances ?? 0;
    const grossSalary = dto.basicSalary + dto.hra + conveyance + medical + special + other;

    // Deactivate previous structures for this employee
    await this.prisma.salaryStructure.updateMany({
      where: { employeeId: dto.employeeId, tenantId, isActive: true },
      data: { isActive: false },
    });

    const structure = await this.prisma.salaryStructure.create({
      data: {
        tenantId,
        employeeId: dto.employeeId,
        effectiveFrom: new Date(dto.effectiveFrom),
        basicSalary: dto.basicSalary,
        hra: dto.hra,
        conveyanceAllowance: conveyance,
        medicalAllowance: medical,
        specialAllowance: special,
        otherAllowances: other,
        grossSalary,
        pfApplicable: dto.pfApplicable ?? true,
        esicApplicable: dto.esicApplicable ?? false,
        ptApplicable: dto.ptApplicable ?? true,
        isActive: true,
      },
    });

    return {
      ...structure,
      basicSalary: Number(structure.basicSalary),
      hra: Number(structure.hra),
      conveyanceAllowance: Number(structure.conveyanceAllowance),
      medicalAllowance: Number(structure.medicalAllowance),
      specialAllowance: Number(structure.specialAllowance),
      otherAllowances: Number(structure.otherAllowances),
      grossSalary: Number(structure.grossSalary),
    };
  }
}
