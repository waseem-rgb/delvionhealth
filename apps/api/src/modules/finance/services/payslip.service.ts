import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";

@Injectable()
export class PayslipService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Number to Words Helper ─────────────────────────────────────────────
  private numberToWords(num: number): string {
    if (num === 0) return "Zero";

    const ones = [
      "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
      "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
      "Seventeen", "Eighteen", "Nineteen",
    ];
    const tens = [
      "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
    ];

    const convertChunk = (n: number): string => {
      if (n === 0) return "";
      if (n < 20) return ones[n];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
      return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " and " + convertChunk(n % 100) : "");
    };

    // Indian numbering system: Lakh, Crore
    const intPart = Math.floor(Math.abs(num));
    const paisePart = Math.round((Math.abs(num) - intPart) * 100);

    let result = "";

    if (intPart >= 10000000) {
      result += convertChunk(Math.floor(intPart / 10000000)) + " Crore ";
    }
    const afterCrore = intPart % 10000000;
    if (afterCrore >= 100000) {
      result += convertChunk(Math.floor(afterCrore / 100000)) + " Lakh ";
    }
    const afterLakh = afterCrore % 100000;
    if (afterLakh >= 1000) {
      result += convertChunk(Math.floor(afterLakh / 1000)) + " Thousand ";
    }
    const afterThousand = afterLakh % 1000;
    if (afterThousand > 0) {
      result += convertChunk(afterThousand);
    }

    result = result.trim();
    if (!result) result = "Zero";

    result += " Rupees";

    if (paisePart > 0) {
      result += " and " + convertChunk(paisePart) + " Paise";
    }

    return result + " Only";
  }

  // ── Generate Payslip ───────────────────────────────────────────────────
  async generatePayslip(payrollRunId: string, employeeId: string, tenantId: string) {
    // Get payroll run
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: payrollRunId, tenantId },
    });
    if (!run) throw new NotFoundException("Payroll run not found");

    // Get payroll line for this employee
    const line = await this.prisma.payrollLine.findFirst({
      where: { payrollRunId, employeeId, tenantId },
    });
    if (!line) throw new NotFoundException("No payroll entry found for this employee in this payroll run");

    // Get employee details
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
      },
    });
    if (!employee) throw new NotFoundException("Employee not found");

    // Get tenant/company details
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    // Get salary structure for additional breakdown
    const salaryStructure = await this.prisma.salaryStructure.findFirst({
      where: { employeeId, tenantId, isActive: true },
      orderBy: { effectiveFrom: "desc" },
    });

    const basicSalary = Number(line.basicSalary);
    const hra = Number(line.hra);
    const otherAllowances = Number(line.otherAllowances);
    const grossSalary = Number(line.grossSalary);
    const lopDays = Number(line.lopDays);
    const lopDeduction = Number(line.lopDeduction);
    const pfEmployee = Number(line.pfEmployee);
    const pfEmployer = Number(line.pfEmployer);
    const esicEmployee = Number(line.esicEmployee);
    const esicEmployer = Number(line.esicEmployer);
    const pt = Number(line.pt);
    const tds = Number(line.tds);
    const totalDeductions = Number(line.totalDeductions);
    const netSalary = Number(line.netSalary);

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];

    return {
      company: {
        name: tenant?.name ?? "DELViON Health",
        address: (tenant as any)?.address ?? "",
      },
      employee: {
        id: employee.id,
        code: employee.employeeCode,
        name: `${(employee as any).user?.firstName ?? ""} ${(employee as any).user?.lastName ?? ""}`.trim() || "Unknown",
        email: (employee as any).user?.email ?? "",
        department: employee.department ?? "",
        designation: employee.designation ?? "",
        panNumber: employee.panNumber ?? "",
        pfNumber: employee.pfNumber ?? "",
        esiNumber: employee.esiNumber ?? "",
        bankAccountNumber: employee.bankAccountNumber ?? "",
        bankIfsc: employee.bankIfsc ?? "",
      },
      period: {
        month: run.month,
        year: run.year,
        monthName: monthNames[run.month - 1] ?? "",
        label: `${monthNames[run.month - 1] ?? ""} ${run.year}`,
      },
      earnings: {
        basicSalary,
        hra,
        conveyanceAllowance: salaryStructure ? Number(salaryStructure.conveyanceAllowance) : 0,
        medicalAllowance: salaryStructure ? Number(salaryStructure.medicalAllowance) : 0,
        specialAllowance: salaryStructure ? Number(salaryStructure.specialAllowance) : 0,
        otherAllowances,
        grossSalary,
      },
      deductions: {
        lopDays,
        lopDeduction,
        pfEmployee,
        esicEmployee,
        professionalTax: pt,
        tds,
        totalDeductions,
      },
      employerContributions: {
        pfEmployer,
        esicEmployer,
      },
      netSalary,
      netSalaryInWords: this.numberToWords(netSalary),
      payrollRunId: run.id,
      payrollRunStatus: run.status,
      generatedAt: new Date().toISOString(),
    };
  }
}
