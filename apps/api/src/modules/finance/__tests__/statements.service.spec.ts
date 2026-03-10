import { Test, TestingModule } from '@nestjs/testing';
import { FinanceService } from '../finance.service';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Tests for the financial statement methods in FinanceService:
 * getProfitLoss, getBalanceSheet, getCashFlow, getTrialBalance
 */
describe('FinanceService – Financial Statements', () => {
  let service: FinanceService;
  let prisma: Record<string, any>;

  const TENANT = 'tenant-001';
  const FROM = '2026-01-01';
  const TO = '2026-03-31';

  beforeEach(async () => {
    prisma = {
      gLAccount: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      journalEntry: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
      },
      journalLine: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      bankAccount: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      bankStatement: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        createMany: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn().mockImplementation(async (cb: any) => {
        if (typeof cb === 'function') return cb(prisma);
        return Promise.all(cb);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinanceService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<FinanceService>(FinanceService);
  });

  // ── getProfitLoss ─────────────────────────────────────────────────────────

  describe('getProfitLoss', () => {
    it('should correctly calculate revenue and expenses', async () => {
      prisma.journalLine.findMany.mockResolvedValue([
        // Revenue line: CREDIT-normal, credit=50000
        {
          debit: 0,
          credit: 50000,
          glAccountId: 'rev-1',
          glAccount: { type: 'REVENUE', name: 'Lab Revenue', normalBalance: 'CREDIT' },
        },
        // Revenue line: CREDIT-normal, credit=20000
        {
          debit: 0,
          credit: 20000,
          glAccountId: 'rev-2',
          glAccount: { type: 'REVENUE', name: 'Consultation Revenue', normalBalance: 'CREDIT' },
        },
        // Expense line: DEBIT-normal, debit=15000
        {
          debit: 15000,
          credit: 0,
          glAccountId: 'exp-1',
          glAccount: { type: 'EXPENSE', name: 'Reagent Expense', normalBalance: 'DEBIT' },
        },
        // Expense line: DEBIT-normal, debit=8000
        {
          debit: 8000,
          credit: 0,
          glAccountId: 'exp-2',
          glAccount: { type: 'EXPENSE', name: 'Salary Expense', normalBalance: 'DEBIT' },
        },
      ]);

      const result = await service.getProfitLoss(TENANT, FROM, TO);

      expect(result.revenue).toBe(70000);    // 50000 + 20000
      expect(result.expenses).toBe(23000);   // 15000 + 8000
      expect(result.netIncome).toBe(47000);  // 70000 - 23000
      expect(result.period).toEqual({ from: FROM, to: TO });
    });

    it('should handle empty data gracefully', async () => {
      prisma.journalLine.findMany.mockResolvedValue([]);

      const result = await service.getProfitLoss(TENANT, FROM, TO);

      expect(result.revenue).toBe(0);
      expect(result.expenses).toBe(0);
      expect(result.netIncome).toBe(0);
    });

    it('should handle revenue with debit entries (returns/adjustments)', async () => {
      prisma.journalLine.findMany.mockResolvedValue([
        {
          debit: 5000,
          credit: 0,
          glAccountId: 'rev-1',
          glAccount: { type: 'REVENUE', name: 'Revenue Adjustment', normalBalance: 'CREDIT' },
        },
      ]);

      const result = await service.getProfitLoss(TENANT, FROM, TO);
      // CREDIT-normal: net = credit - debit = 0 - 5000 = -5000
      expect(result.revenue).toBe(-5000);
    });

    it('should report net loss when expenses exceed revenue', async () => {
      prisma.journalLine.findMany.mockResolvedValue([
        {
          debit: 0,
          credit: 10000,
          glAccountId: 'rev-1',
          glAccount: { type: 'REVENUE', name: 'Revenue', normalBalance: 'CREDIT' },
        },
        {
          debit: 25000,
          credit: 0,
          glAccountId: 'exp-1',
          glAccount: { type: 'EXPENSE', name: 'Expense', normalBalance: 'DEBIT' },
        },
      ]);

      const result = await service.getProfitLoss(TENANT, FROM, TO);
      expect(result.netIncome).toBe(-15000);
    });
  });

  // ── getBalanceSheet ───────────────────────────────────────────────────────

  describe('getBalanceSheet', () => {
    it('should satisfy assets = liabilities + equity when balanced', async () => {
      prisma.gLAccount.findMany.mockResolvedValue([
        { id: '1', code: '1000', name: 'Cash', type: 'ASSET', balance: 100000 },
        { id: '2', code: '1100', name: 'Equipment', type: 'ASSET', balance: 50000 },
        { id: '3', code: '2000', name: 'Payables', type: 'LIABILITY', balance: 30000 },
        { id: '4', code: '2100', name: 'Loan', type: 'LIABILITY', balance: 20000 },
        { id: '5', code: '3000', name: 'Capital', type: 'EQUITY', balance: 100000 },
      ]);

      const result = await service.getBalanceSheet(TENANT);

      expect(result.totalAssets).toBe(150000);
      expect(result.totalLiabilities).toBe(50000);
      expect(result.totalEquity).toBe(100000);
      expect(result.totalAssets).toBe(result.totalLiabilities + result.totalEquity);
    });

    it('should handle empty balance sheet', async () => {
      prisma.gLAccount.findMany.mockResolvedValue([]);

      const result = await service.getBalanceSheet(TENANT);

      expect(result.totalAssets).toBe(0);
      expect(result.totalLiabilities).toBe(0);
      expect(result.totalEquity).toBe(0);
      expect(result.assets).toHaveLength(0);
    });

    it('should separate accounts by type correctly', async () => {
      prisma.gLAccount.findMany.mockResolvedValue([
        { id: '1', code: '1000', name: 'Cash', type: 'ASSET', balance: 10000 },
        { id: '2', code: '2000', name: 'AP', type: 'LIABILITY', balance: 5000 },
        { id: '3', code: '3000', name: 'Equity', type: 'EQUITY', balance: 5000 },
      ]);

      const result = await service.getBalanceSheet(TENANT);

      expect(result.assets).toHaveLength(1);
      expect(result.liabilities).toHaveLength(1);
      expect(result.equity).toHaveLength(1);
    });

    it('should handle accounts with zero balances', async () => {
      prisma.gLAccount.findMany.mockResolvedValue([
        { id: '1', code: '1000', name: 'Cash', type: 'ASSET', balance: 0 },
        { id: '2', code: '2000', name: 'AP', type: 'LIABILITY', balance: 0 },
      ]);

      const result = await service.getBalanceSheet(TENANT);

      expect(result.totalAssets).toBe(0);
      expect(result.totalLiabilities).toBe(0);
    });
  });

  // ── getCashFlow ───────────────────────────────────────────────────────────

  describe('getCashFlow', () => {
    it('should calculate net change = operating + investing + financing', async () => {
      prisma.journalLine.findMany.mockResolvedValue([
        // Operating: REVENUE
        { debit: 0, credit: 40000, glAccount: { type: 'REVENUE', name: 'Rev', normalBalance: 'CREDIT' } },
        // Operating: EXPENSE
        { debit: 15000, credit: 0, glAccount: { type: 'EXPENSE', name: 'Exp', normalBalance: 'DEBIT' } },
        // Investing: ASSET
        { debit: 20000, credit: 0, glAccount: { type: 'ASSET', name: 'Equipment', normalBalance: 'DEBIT' } },
        // Financing: LIABILITY
        { debit: 0, credit: 10000, glAccount: { type: 'LIABILITY', name: 'Loan', normalBalance: 'CREDIT' } },
        // Financing: EQUITY
        { debit: 0, credit: 5000, glAccount: { type: 'EQUITY', name: 'Capital', normalBalance: 'CREDIT' } },
      ]);

      const result = await service.getCashFlow(TENANT, FROM, TO);

      // operating = (0 - 40000) + (15000 - 0) = -25000
      expect(result.operating).toBe(-25000);
      // investing = (20000 - 0) = 20000
      expect(result.investing).toBe(20000);
      // financing = (0 - 10000) + (0 - 5000) = -15000
      expect(result.financing).toBe(-15000);
      expect(result.netCashFlow).toBe(result.operating + result.investing + result.financing);
    });

    it('should return zeros for empty data', async () => {
      prisma.journalLine.findMany.mockResolvedValue([]);

      const result = await service.getCashFlow(TENANT, FROM, TO);

      expect(result.operating).toBe(0);
      expect(result.investing).toBe(0);
      expect(result.financing).toBe(0);
      expect(result.netCashFlow).toBe(0);
    });

    it('should include period in the response', async () => {
      prisma.journalLine.findMany.mockResolvedValue([]);

      const result = await service.getCashFlow(TENANT, FROM, TO);

      expect(result.period).toEqual({ from: FROM, to: TO });
    });
  });

  // ── getTrialBalance (via FinanceService) ──────────────────────────────────

  describe('getTrialBalance', () => {
    it('should return rows sorted by account code with totals', async () => {
      prisma.journalLine.findMany.mockResolvedValue([
        {
          glAccountId: 'a1',
          debit: 5000,
          credit: 0,
          glAccount: { id: 'a1', code: '1000', name: 'Cash', type: 'ASSET', normalBalance: 'DEBIT' },
        },
        {
          glAccountId: 'a2',
          debit: 0,
          credit: 5000,
          glAccount: { id: 'a2', code: '4000', name: 'Revenue', type: 'REVENUE', normalBalance: 'CREDIT' },
        },
      ]);

      const result = await service.getTrialBalance(TENANT);

      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].account.code).toBe('1000');
      expect(result.totalDebit).toBe(5000);
      expect(result.totalCredit).toBe(5000);
    });

    it('should handle empty trial balance', async () => {
      prisma.journalLine.findMany.mockResolvedValue([]);

      const result = await service.getTrialBalance(TENANT);

      expect(result.rows).toHaveLength(0);
      expect(result.totalDebit).toBe(0);
      expect(result.totalCredit).toBe(0);
    });

    it('should aggregate multiple lines for the same account', async () => {
      prisma.journalLine.findMany.mockResolvedValue([
        {
          glAccountId: 'a1',
          debit: 3000,
          credit: 0,
          glAccount: { id: 'a1', code: '1000', name: 'Cash', type: 'ASSET', normalBalance: 'DEBIT' },
        },
        {
          glAccountId: 'a1',
          debit: 2000,
          credit: 0,
          glAccount: { id: 'a1', code: '1000', name: 'Cash', type: 'ASSET', normalBalance: 'DEBIT' },
        },
      ]);

      const result = await service.getTrialBalance(TENANT);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].debit).toBe(5000);
    });
  });

  // ── Financial ratio calculations ──────────────────────────────────────────

  describe('financial ratios (derived from statements)', () => {
    it('should yield correct gross margin from P&L data', async () => {
      prisma.journalLine.findMany.mockResolvedValue([
        { debit: 0, credit: 100000, glAccountId: 'r1', glAccount: { type: 'REVENUE', name: 'Rev', normalBalance: 'CREDIT' } },
        { debit: 40000, credit: 0, glAccountId: 'e1', glAccount: { type: 'EXPENSE', name: 'COGS', normalBalance: 'DEBIT' } },
      ]);

      const pl = await service.getProfitLoss(TENANT, FROM, TO);
      const grossMargin = pl.revenue > 0 ? ((pl.revenue - pl.expenses) / pl.revenue) * 100 : 0;

      expect(grossMargin).toBe(60); // (100000 - 40000) / 100000 * 100
    });

    it('should compute current ratio from balance sheet data', async () => {
      prisma.gLAccount.findMany.mockResolvedValue([
        { id: '1', code: '1000', name: 'Cash', type: 'ASSET', balance: 80000 },
        { id: '2', code: '2000', name: 'AP', type: 'LIABILITY', balance: 40000 },
        { id: '3', code: '3000', name: 'Capital', type: 'EQUITY', balance: 40000 },
      ]);

      const bs = await service.getBalanceSheet(TENANT);
      const currentRatio = bs.totalLiabilities > 0 ? bs.totalAssets / bs.totalLiabilities : 0;

      expect(currentRatio).toBe(2); // 80000 / 40000
    });

    it('should handle zero revenue gracefully for margin calculation', async () => {
      prisma.journalLine.findMany.mockResolvedValue([]);

      const pl = await service.getProfitLoss(TENANT, FROM, TO);
      const grossMargin = pl.revenue > 0 ? ((pl.revenue - pl.expenses) / pl.revenue) * 100 : 0;

      expect(grossMargin).toBe(0);
    });

    it('should handle zero liabilities for current ratio', async () => {
      prisma.gLAccount.findMany.mockResolvedValue([
        { id: '1', code: '1000', name: 'Cash', type: 'ASSET', balance: 50000 },
        { id: '2', code: '3000', name: 'Capital', type: 'EQUITY', balance: 50000 },
      ]);

      const bs = await service.getBalanceSheet(TENANT);
      const currentRatio = bs.totalLiabilities > 0 ? bs.totalAssets / bs.totalLiabilities : Infinity;

      expect(currentRatio).toBe(Infinity);
    });
  });
});
