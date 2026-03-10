import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PayrollCalculationService } from '../services/payroll.service';
import { JournalService } from '../services/journal.service';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Tests for PayrollCalculationService.
 *
 * The private calculation methods (calculatePF, calculateESIC, calculatePT,
 * calculateMonthlyTDS) are tested indirectly via createPayrollRun, which
 * invokes calculateEmployeePayroll for each employee.
 */
describe('PayrollCalculationService', () => {
  let service: PayrollCalculationService;
  let prisma: Record<string, any>;
  let journalService: Record<string, any>;

  const TENANT = 'tenant-001';
  const USER = 'user-001';

  // Helper to access private methods for unit testing
  const callPrivate = (methodName: string, ...args: any[]) =>
    (service as any)[methodName](...args);

  beforeEach(async () => {
    prisma = {
      payrollRun: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }) => ({
          id: 'pr-001',
          ...data,
          status: data.status ?? 'DRAFT',
        })),
        update: jest.fn().mockResolvedValue({}),
      },
      payrollLine: {
        create: jest.fn().mockResolvedValue({}),
      },
      employee: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
      },
      salaryStructure: {
        create: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({}),
      },
      gLAccount: {
        findFirst: jest.fn().mockResolvedValue({ id: 'gl-stub' }),
      },
      $transaction: jest.fn().mockImplementation(async (cb: any) => {
        if (typeof cb === 'function') return cb(prisma);
        return Promise.all(cb);
      }),
    };

    journalService = {
      createJournal: jest.fn().mockResolvedValue({ id: 'je-001' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayrollCalculationService,
        { provide: PrismaService, useValue: prisma },
        { provide: JournalService, useValue: journalService },
      ],
    }).compile();

    service = module.get<PayrollCalculationService>(PayrollCalculationService);
  });

  // ── PF Calculation ────────────────────────────────────────────────────────

  describe('PF calculation', () => {
    it('should calculate 12% of basic when basic <= 15000', () => {
      const result = callPrivate('calculatePF', 12000, true);

      expect(result.pfEmployee).toBe(1440); // 12000 * 0.12
      expect(result.pfEmployer).toBe(1440);
    });

    it('should cap PF at basic 15000 (max 1800 each)', () => {
      const result = callPrivate('calculatePF', 30000, true);

      expect(result.pfEmployee).toBe(1800); // 15000 * 0.12
      expect(result.pfEmployer).toBe(1800);
    });

    it('should return 0 when PF is not applicable', () => {
      const result = callPrivate('calculatePF', 30000, false);

      expect(result.pfEmployee).toBe(0);
      expect(result.pfEmployer).toBe(0);
    });

    it('should handle zero basic salary', () => {
      const result = callPrivate('calculatePF', 0, true);

      expect(result.pfEmployee).toBe(0);
      expect(result.pfEmployer).toBe(0);
    });

    it('should handle basic exactly at 15000', () => {
      const result = callPrivate('calculatePF', 15000, true);

      expect(result.pfEmployee).toBe(1800);
      expect(result.pfEmployer).toBe(1800);
    });
  });

  // ── ESIC Calculation ──────────────────────────────────────────────────────

  describe('ESIC calculation', () => {
    it('should apply ESIC when gross <= 21000', () => {
      const result = callPrivate('calculateESIC', 20000, true);

      expect(result.esicEmployee).toBe(150);  // 20000 * 0.0075
      expect(result.esicEmployer).toBe(650);  // 20000 * 0.0325
    });

    it('should NOT apply ESIC when gross > 21000', () => {
      const result = callPrivate('calculateESIC', 25000, true);

      expect(result.esicEmployee).toBe(0);
      expect(result.esicEmployer).toBe(0);
    });

    it('should return 0 when ESIC not applicable', () => {
      const result = callPrivate('calculateESIC', 15000, false);

      expect(result.esicEmployee).toBe(0);
      expect(result.esicEmployer).toBe(0);
    });

    it('should handle gross exactly at 21000', () => {
      const result = callPrivate('calculateESIC', 21000, true);

      expect(result.esicEmployee).toBe(157.5);  // 21000 * 0.0075
      expect(result.esicEmployer).toBe(682.5);  // 21000 * 0.0325
    });

    it('should return 0 for zero gross', () => {
      const result = callPrivate('calculateESIC', 0, true);

      expect(result.esicEmployee).toBe(0);
      expect(result.esicEmployer).toBe(0);
    });
  });

  // ── PT Calculation (Karnataka) ────────────────────────────────────────────

  describe('PT calculation (Karnataka)', () => {
    it('should return 200 for gross >= 15000 (non-February)', () => {
      const pt = callPrivate('calculatePT', 25000, 6);
      expect(pt).toBe(200);
    });

    it('should return 150 for gross between 10000 and 14999', () => {
      const pt = callPrivate('calculatePT', 12000, 6);
      expect(pt).toBe(150);
    });

    it('should return 0 for gross below 10000', () => {
      const pt = callPrivate('calculatePT', 8000, 6);
      expect(pt).toBe(0);
    });

    it('should return 300 in February when gross >= 15000 (annual top-up)', () => {
      const pt = callPrivate('calculatePT', 25000, 2);
      expect(pt).toBe(300);
    });

    it('should return 150 in February when gross between 10000-14999', () => {
      const pt = callPrivate('calculatePT', 12000, 2);
      expect(pt).toBe(150);
    });

    it('should return 0 for gross exactly at 9999', () => {
      const pt = callPrivate('calculatePT', 9999, 6);
      expect(pt).toBe(0);
    });

    it('should return 200 for gross exactly at 15000 (non-Feb)', () => {
      const pt = callPrivate('calculatePT', 15000, 3);
      expect(pt).toBe(200);
    });

    it('should return 150 for gross exactly at 10000', () => {
      const pt = callPrivate('calculatePT', 10000, 6);
      expect(pt).toBe(150);
    });
  });

  // ── TDS (New Regime FY 2025-26) ───────────────────────────────────────────

  describe('TDS New Regime calculation', () => {
    it('should return 0 for annual gross below standard deduction + first slab', () => {
      // grossAnnual = 300000, taxable = 300000 - 75000 = 225000
      // 225000 falls in first slab (0-300000 @ 0%) => tax = 0
      const monthlyTds = callPrivate('calculateMonthlyTDS', 300000);
      expect(monthlyTds).toBe(0);
    });

    it('should return 0 for annual gross <= 375000 (within std deduction + 0% slab)', () => {
      // grossAnnual = 375000, taxable = 375000 - 75000 = 300000
      // All within 0% slab
      const monthlyTds = callPrivate('calculateMonthlyTDS', 375000);
      expect(monthlyTds).toBe(0);
    });

    it('should correctly calculate TDS for mid-range salary', () => {
      // grossAnnual = 600000, taxable = 600000 - 75000 = 525000
      // Slab 1: 300000 @ 0% = 0
      // Slab 2: 225000 @ 5% = 11250
      // Tax before cess: 11250
      // Tax with cess: 11250 * 1.04 = 11700
      // Monthly: 11700 / 12 = 975
      const monthlyTds = callPrivate('calculateMonthlyTDS', 600000);
      expect(monthlyTds).toBe(975);
    });

    it('should correctly calculate TDS for higher salary', () => {
      // grossAnnual = 1200000, taxable = 1200000 - 75000 = 1125000
      // Slab 1: 300000 @ 0% = 0
      // Slab 2: 300000 @ 5% = 15000
      // Slab 3: 300000 @ 10% = 30000
      // Slab 4: 225000 @ 15% = 33750
      // Tax before cess: 78750
      // Tax with cess: 78750 * 1.04 = 81900
      // Monthly: 81900 / 12 = 6825
      const monthlyTds = callPrivate('calculateMonthlyTDS', 1200000);
      expect(monthlyTds).toBe(6825);
    });

    it('should handle 30% slab for very high salary', () => {
      // grossAnnual = 2400000, taxable = 2400000 - 75000 = 2325000
      // Slab 1: 300000 @ 0% = 0
      // Slab 2: 300000 @ 5% = 15000
      // Slab 3: 300000 @ 10% = 30000
      // Slab 4: 300000 @ 15% = 45000
      // Slab 5: 300000 @ 20% = 60000
      // Slab 6: 825000 @ 30% = 247500
      // Tax before cess: 397500
      // Tax with cess: 397500 * 1.04 = 413400
      // Monthly: 413400 / 12 = 34450
      const monthlyTds = callPrivate('calculateMonthlyTDS', 2400000);
      expect(monthlyTds).toBe(34450);
    });

    it('should handle zero gross annual', () => {
      const monthlyTds = callPrivate('calculateMonthlyTDS', 0);
      expect(monthlyTds).toBe(0);
    });

    it('should apply 4% cess on computed tax', () => {
      // grossAnnual = 475000, taxable = 475000 - 75000 = 400000
      // Slab 1: 300000 @ 0% = 0
      // Slab 2: 100000 @ 5% = 5000
      // Tax before cess: 5000
      // Tax with cess: 5000 * 1.04 = 5200
      // Monthly: 5200 / 12 = 433.33
      const monthlyTds = callPrivate('calculateMonthlyTDS', 475000);
      expect(monthlyTds).toBe(433.33);
    });
  });

  // ── LOP Deduction ─────────────────────────────────────────────────────────

  describe('LOP deduction', () => {
    it('should deduct per-day amount for LOP days', () => {
      const lop = callPrivate('calculateLOP', 30000, 5);
      // (30000/30) * 5 = 5000
      expect(lop).toBe(5000);
    });

    it('should return 0 for 0 LOP days', () => {
      const lop = callPrivate('calculateLOP', 30000, 0);
      expect(lop).toBe(0);
    });

    it('should handle full month LOP (30 days)', () => {
      const lop = callPrivate('calculateLOP', 30000, 30);
      expect(lop).toBe(30000);
    });
  });

  // ── createPayrollRun Integration ──────────────────────────────────────────

  describe('createPayrollRun', () => {
    it('should throw if payroll run already exists for the month', async () => {
      prisma.payrollRun.findFirst.mockResolvedValue({ id: 'existing', status: 'DRAFT' });

      await expect(service.createPayrollRun(3, 2026, TENANT, USER)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw if no employees have salary structures', async () => {
      prisma.employee.findMany.mockResolvedValue([
        { id: 'emp-1', isActive: true, salaryStructures: [], user: { firstName: 'John', lastName: 'Doe' } },
      ]);

      await expect(service.createPayrollRun(3, 2026, TENANT, USER)).rejects.toThrow(
        /No active employees with salary structures/,
      );
    });

    it('should create payroll run with correct totals for one employee', async () => {
      prisma.employee.findMany.mockResolvedValue([
        {
          id: 'emp-1',
          isActive: true,
          user: { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' },
          salaryStructures: [
            {
              basicSalary: 15000,
              hra: 7500,
              conveyanceAllowance: 1600,
              medicalAllowance: 1250,
              specialAllowance: 4650,
              otherAllowances: 0,
              grossSalary: 30000,
              pfApplicable: true,
              esicApplicable: false,
              ptApplicable: true,
            },
          ],
        },
      ]);

      const result = await service.createPayrollRun(6, 2026, TENANT, USER);

      expect(result).toBeDefined();
      expect(result.employeeCount).toBe(1);
      expect(result.status).toBe('DRAFT');
      // PF: 15000 * 0.12 = 1800 (basic is exactly at cap)
      expect(result.totalPfEmployee).toBe(1800);
      expect(result.totalPfEmployer).toBe(1800);
      // ESIC: not applicable
      expect(result.totalEsicEmployee).toBe(0);
      // PT: gross 30000 >= 15000 => 200 (non-Feb)
      expect(result.totalPt).toBe(200);
      expect(result.totalGross).toBe(30000);
    });

    it('should handle multiple employees', async () => {
      prisma.employee.findMany.mockResolvedValue([
        {
          id: 'emp-1',
          isActive: true,
          user: { firstName: 'A', lastName: 'B', email: 'a@b.com' },
          salaryStructures: [
            {
              basicSalary: 10000,
              hra: 5000,
              conveyanceAllowance: 0,
              medicalAllowance: 0,
              specialAllowance: 0,
              otherAllowances: 0,
              grossSalary: 15000,
              pfApplicable: true,
              esicApplicable: true,
              ptApplicable: true,
            },
          ],
        },
        {
          id: 'emp-2',
          isActive: true,
          user: { firstName: 'C', lastName: 'D', email: 'c@d.com' },
          salaryStructures: [
            {
              basicSalary: 20000,
              hra: 10000,
              conveyanceAllowance: 0,
              medicalAllowance: 0,
              specialAllowance: 0,
              otherAllowances: 0,
              grossSalary: 30000,
              pfApplicable: true,
              esicApplicable: false,
              ptApplicable: true,
            },
          ],
        },
      ]);

      const result = await service.createPayrollRun(6, 2026, TENANT, USER);

      expect(result.employeeCount).toBe(2);
      expect(result.totalGross).toBe(45000); // 15000 + 30000
    });
  });

  // ── Full Employee Payroll Calculation ──────────────────────────────────────

  describe('calculateEmployeePayroll (indirect)', () => {
    it('should compute correct net salary with all deductions', () => {
      const structure = {
        basicSalary: 15000,
        hra: 7500,
        conveyanceAllowance: 1600,
        medicalAllowance: 1250,
        specialAllowance: 4650,
        otherAllowances: 0,
        grossSalary: 30000,
        pfApplicable: true,
        esicApplicable: false,
        ptApplicable: true,
      };

      const result = callPrivate('calculateEmployeePayroll', structure, 6, 0);

      expect(result.grossSalary).toBe(30000);
      expect(result.pfEmployee).toBe(1800);        // 15000 * 0.12
      expect(result.pfEmployer).toBe(1800);
      expect(result.esicEmployee).toBe(0);          // not applicable
      expect(result.pt).toBe(200);                  // >= 15000, non-Feb
      expect(result.lopDays).toBe(0);
      expect(result.lopDeduction).toBe(0);
      // Net = gross - (pf + esic + pt + tds + lop)
      expect(result.netSalary).toBe(
        Math.round((30000 - result.totalDeductions) * 100) / 100,
      );
    });

    it('should apply LOP deduction correctly', () => {
      const structure = {
        basicSalary: 15000,
        hra: 7500,
        conveyanceAllowance: 0,
        medicalAllowance: 0,
        specialAllowance: 7500,
        otherAllowances: 0,
        grossSalary: 30000,
        pfApplicable: false,
        esicApplicable: false,
        ptApplicable: false,
      };

      const result = callPrivate('calculateEmployeePayroll', structure, 6, 3);

      expect(result.lopDays).toBe(3);
      expect(result.lopDeduction).toBe(3000); // (30000/30) * 3
    });
  });
});
