import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { FinanceService } from '../finance.service';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Tests for reconciliation-related methods in FinanceService:
 * autoReconcile, reconcile (manual match), getBankStatement, getBankAccounts
 *
 * FinanceService.autoReconcile matches bank statements to journal entries
 * based on date proximity (+/- 2 days) and reference number.
 */
describe('FinanceService – Reconciliation', () => {
  let service: FinanceService;
  let prisma: Record<string, any>;

  const TENANT = 'tenant-001';
  const BANK_ACCOUNT_ID = 'ba-001';

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
        findFirst: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
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
        updateMany: jest.fn(),
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

  // ── autoReconcile ─────────────────────────────────────────────────────────

  describe('autoReconcile', () => {
    it('should match statement with same reference number within date window', async () => {
      const stmtDate = new Date('2026-01-15');
      prisma.bankStatement.findMany.mockResolvedValue([
        {
          id: 'stmt-1',
          tenantId: TENANT,
          bankAccountId: BANK_ACCOUNT_ID,
          transactionDate: stmtDate,
          description: 'Payment received',
          amount: 5000,
          type: 'CREDIT',
          referenceNumber: 'REF-001',
          reconcileStatus: 'UNMATCHED',
        },
      ]);

      prisma.journalEntry.findFirst.mockResolvedValue({
        id: 'je-001',
        tenantId: TENANT,
        date: new Date('2026-01-15'),
        reference: 'REF-001',
      });

      const result = await service.autoReconcile(TENANT, BANK_ACCOUNT_ID);

      expect(result.matched).toBe(1);
      expect(result.total).toBe(1);
      expect(prisma.bankStatement.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'stmt-1' },
          data: expect.objectContaining({
            reconcileStatus: 'MATCHED',
            journalEntryId: 'je-001',
          }),
        }),
      );
    });

    it('should not match when no journal entry has matching reference', async () => {
      prisma.bankStatement.findMany.mockResolvedValue([
        {
          id: 'stmt-1',
          tenantId: TENANT,
          bankAccountId: BANK_ACCOUNT_ID,
          transactionDate: new Date('2026-01-15'),
          description: 'Random payment',
          amount: 9999,
          type: 'DEBIT',
          referenceNumber: 'NO-MATCH-REF',
          reconcileStatus: 'UNMATCHED',
        },
      ]);

      prisma.journalEntry.findFirst.mockResolvedValue(null);

      const result = await service.autoReconcile(TENANT, BANK_ACCOUNT_ID);

      expect(result.matched).toBe(0);
      expect(result.total).toBe(1);
      expect(prisma.bankStatement.update).not.toHaveBeenCalled();
    });

    it('should handle empty unmatched statements', async () => {
      prisma.bankStatement.findMany.mockResolvedValue([]);

      const result = await service.autoReconcile(TENANT, BANK_ACCOUNT_ID);

      expect(result.matched).toBe(0);
      expect(result.total).toBe(0);
    });

    it('should match multiple statements independently', async () => {
      prisma.bankStatement.findMany.mockResolvedValue([
        {
          id: 'stmt-1',
          transactionDate: new Date('2026-01-10'),
          referenceNumber: 'REF-A',
          reconcileStatus: 'UNMATCHED',
        },
        {
          id: 'stmt-2',
          transactionDate: new Date('2026-01-15'),
          referenceNumber: 'REF-B',
          reconcileStatus: 'UNMATCHED',
        },
        {
          id: 'stmt-3',
          transactionDate: new Date('2026-01-20'),
          referenceNumber: 'REF-C',
          reconcileStatus: 'UNMATCHED',
        },
      ]);

      prisma.journalEntry.findFirst
        .mockResolvedValueOnce({ id: 'je-1' })   // matches stmt-1
        .mockResolvedValueOnce(null)              // no match for stmt-2
        .mockResolvedValueOnce({ id: 'je-3' });   // matches stmt-3

      const result = await service.autoReconcile(TENANT, BANK_ACCOUNT_ID);

      expect(result.matched).toBe(2);
      expect(result.total).toBe(3);
    });

    it('should search within +/- 2 day date window', async () => {
      const txnDate = new Date('2026-02-15');
      prisma.bankStatement.findMany.mockResolvedValue([
        {
          id: 'stmt-1',
          transactionDate: txnDate,
          referenceNumber: 'REF-100',
          reconcileStatus: 'UNMATCHED',
        },
      ]);

      prisma.journalEntry.findFirst.mockResolvedValue(null);
      await service.autoReconcile(TENANT, BANK_ACCOUNT_ID);

      // Verify the date range in the query
      const findFirstCall = prisma.journalEntry.findFirst.mock.calls[0][0];
      const dateQuery = findFirstCall.where.date;

      const expectedFrom = new Date(txnDate);
      expectedFrom.setDate(expectedFrom.getDate() - 2);
      const expectedTo = new Date(txnDate);
      expectedTo.setDate(expectedTo.getDate() + 2);

      expect(dateQuery.gte.toISOString().slice(0, 10)).toBe(expectedFrom.toISOString().slice(0, 10));
      expect(dateQuery.lte.toISOString().slice(0, 10)).toBe(expectedTo.toISOString().slice(0, 10));
    });
  });

  // ── Manual reconcile ──────────────────────────────────────────────────────

  describe('reconcile (manual match)', () => {
    it('should update statement status for each match', async () => {
      const matches = [
        { statementId: 'stmt-1', journalEntryId: 'je-1' },
        { statementId: 'stmt-2', journalEntryId: 'je-2' },
      ];

      const result = await service.reconcile(TENANT, BANK_ACCOUNT_ID, matches);

      expect(result.matched).toBe(2);
      expect(prisma.bankStatement.update).toHaveBeenCalledTimes(2);

      expect(prisma.bankStatement.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'stmt-1' },
          data: expect.objectContaining({
            reconcileStatus: 'MATCHED',
            journalEntryId: 'je-1',
          }),
        }),
      );

      expect(prisma.bankStatement.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'stmt-2' },
          data: expect.objectContaining({
            reconcileStatus: 'MATCHED',
            journalEntryId: 'je-2',
          }),
        }),
      );
    });

    it('should handle empty matches array', async () => {
      const result = await service.reconcile(TENANT, BANK_ACCOUNT_ID, []);

      expect(result.matched).toBe(0);
      expect(prisma.bankStatement.update).not.toHaveBeenCalled();
    });

    it('should handle single match', async () => {
      const result = await service.reconcile(TENANT, BANK_ACCOUNT_ID, [
        { statementId: 'stmt-only', journalEntryId: 'je-only' },
      ]);

      expect(result.matched).toBe(1);
    });
  });

  // ── getBankStatement ──────────────────────────────────────────────────────

  describe('getBankStatement', () => {
    it('should return paginated bank statements', async () => {
      prisma.bankAccount.findFirst.mockResolvedValue({
        id: BANK_ACCOUNT_ID,
        tenantId: TENANT,
        name: 'Main Account',
      });

      prisma.bankStatement.findMany.mockResolvedValue([
        { id: 'stmt-1', amount: 1000, description: 'Test' },
      ]);
      prisma.bankStatement.count.mockResolvedValue(1);

      const result = await service.getBankStatement(BANK_ACCOUNT_ID, TENANT);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it('should throw NotFoundException for invalid bank account', async () => {
      prisma.bankAccount.findFirst.mockResolvedValue(null);

      await expect(
        service.getBankStatement('bad-id', TENANT),
      ).rejects.toThrow(NotFoundException);
    });

    it('should respect pagination parameters', async () => {
      prisma.bankAccount.findFirst.mockResolvedValue({ id: BANK_ACCOUNT_ID, tenantId: TENANT });
      prisma.bankStatement.findMany.mockResolvedValue([]);
      prisma.bankStatement.count.mockResolvedValue(100);

      const result = await service.getBankStatement(BANK_ACCOUNT_ID, TENANT, 3, 10);

      expect(result.page).toBe(3);
      expect(result.limit).toBe(10);

      // Verify skip was calculated correctly: (3-1) * 10 = 20
      const findManyCall = prisma.bankStatement.findMany.mock.calls[0][0];
      expect(findManyCall.skip).toBe(20);
      expect(findManyCall.take).toBe(10);
    });
  });

  // ── importBankStatement ───────────────────────────────────────────────────

  describe('importBankStatement', () => {
    it('should import rows and return count', async () => {
      prisma.bankAccount.findFirst.mockResolvedValue({ id: BANK_ACCOUNT_ID, tenantId: TENANT });
      prisma.bankStatement.createMany.mockResolvedValue({ count: 3 });

      const rows = [
        { transactionDate: '2026-01-01', description: 'Payment 1', amount: 1000, type: 'CREDIT' },
        { transactionDate: '2026-01-02', description: 'Payment 2', amount: 2000, type: 'DEBIT' },
        { transactionDate: '2026-01-03', description: 'Payment 3', amount: 500, type: 'CREDIT' },
      ];

      const result = await service.importBankStatement(BANK_ACCOUNT_ID, rows, TENANT);

      expect(result.imported).toBe(3);
      expect(prisma.bankStatement.createMany).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException for invalid bank account', async () => {
      prisma.bankAccount.findFirst.mockResolvedValue(null);

      await expect(
        service.importBankStatement('bad-id', [], TENANT),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── Reconciliation Summary (derived) ──────────────────────────────────────

  describe('reconciliation summary', () => {
    it('should provide correct counts via autoReconcile result', async () => {
      // 5 statements, 3 match
      const statements = Array.from({ length: 5 }, (_, i) => ({
        id: `stmt-${i}`,
        transactionDate: new Date('2026-01-15'),
        referenceNumber: `REF-${i}`,
        reconcileStatus: 'UNMATCHED',
      }));

      prisma.bankStatement.findMany.mockResolvedValue(statements);

      prisma.journalEntry.findFirst
        .mockResolvedValueOnce({ id: 'je-0' })
        .mockResolvedValueOnce({ id: 'je-1' })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'je-3' })
        .mockResolvedValueOnce(null);

      const result = await service.autoReconcile(TENANT, BANK_ACCOUNT_ID);

      expect(result.matched).toBe(3);
      expect(result.total).toBe(5);
      // Unmatched = total - matched
      const unmatched = result.total - result.matched;
      expect(unmatched).toBe(2);
    });

    it('should report 0/0 for empty bank account', async () => {
      prisma.bankStatement.findMany.mockResolvedValue([]);

      const result = await service.autoReconcile(TENANT, BANK_ACCOUNT_ID);

      expect(result.matched).toBe(0);
      expect(result.total).toBe(0);
    });

    it('should report all matched when every statement has a JE match', async () => {
      prisma.bankStatement.findMany.mockResolvedValue([
        { id: 's1', transactionDate: new Date(), referenceNumber: 'R1', reconcileStatus: 'UNMATCHED' },
        { id: 's2', transactionDate: new Date(), referenceNumber: 'R2', reconcileStatus: 'UNMATCHED' },
      ]);

      prisma.journalEntry.findFirst
        .mockResolvedValueOnce({ id: 'j1' })
        .mockResolvedValueOnce({ id: 'j2' });

      const result = await service.autoReconcile(TENANT, BANK_ACCOUNT_ID);

      expect(result.matched).toBe(2);
      expect(result.total).toBe(2);
    });

    it('should report none matched when no JE matches exist', async () => {
      prisma.bankStatement.findMany.mockResolvedValue([
        { id: 's1', transactionDate: new Date(), referenceNumber: 'X1', reconcileStatus: 'UNMATCHED' },
        { id: 's2', transactionDate: new Date(), referenceNumber: 'X2', reconcileStatus: 'UNMATCHED' },
        { id: 's3', transactionDate: new Date(), referenceNumber: 'X3', reconcileStatus: 'UNMATCHED' },
      ]);

      prisma.journalEntry.findFirst.mockResolvedValue(null);

      const result = await service.autoReconcile(TENANT, BANK_ACCOUNT_ID);

      expect(result.matched).toBe(0);
      expect(result.total).toBe(3);
    });
  });
});
