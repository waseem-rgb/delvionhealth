import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { JournalService } from '../services/journal.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('JournalService', () => {
  let service: JournalService;
  let prisma: Record<string, any>;

  // ── Helpers ───────────────────────────────────────────────────────────────
  const TENANT = 'tenant-001';
  const USER = 'user-001';

  const balancedDto = {
    tenantId: TENANT,
    date: '2026-01-15',
    narration: 'Test entry',
    refType: 'MANUAL',
    postedBy: USER,
    lines: [
      { ledgerAccountId: 'acc-cash', type: 'DEBIT' as const, amount: 1000 },
      { ledgerAccountId: 'acc-revenue', type: 'CREDIT' as const, amount: 1000 },
    ],
  };

  // Mock transaction helper: runs callback with the same mock prisma object
  const mockTx = (prismaObj: Record<string, any>) => {
    prismaObj.$transaction = jest.fn().mockImplementation(async (cb: any) => {
      if (typeof cb === 'function') return cb(prismaObj);
      // Array form: resolve each element
      return Promise.all(cb);
    });
  };

  beforeEach(async () => {
    prisma = {
      journalEntry: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation(async ({ data, include }) => ({
          id: 'je-001',
          tenantId: data.tenantId,
          entryNumber: data.entryNumber,
          description: data.description,
          date: data.date,
          status: data.status,
          reference: data.reference,
          createdById: data.createdById,
          lines: (data.lines?.create ?? []).map((l: any, i: number) => ({
            id: `jl-${i}`,
            glAccountId: l.glAccountId,
            debit: l.debit,
            credit: l.credit,
            description: l.description,
          })),
        })),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      journalLine: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      gLAccount: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn(),
    };
    mockTx(prisma);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JournalService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<JournalService>(JournalService);
  });

  // ── createJournal ─────────────────────────────────────────────────────────

  describe('createJournal', () => {
    it('should create a balanced journal entry successfully', async () => {
      prisma.gLAccount.findUnique
        .mockResolvedValueOnce({ id: 'acc-cash', normalBalance: 'DEBIT', balance: 0 })
        .mockResolvedValueOnce({ id: 'acc-revenue', normalBalance: 'CREDIT', balance: 0 });

      const result = await service.createJournal(balancedDto);

      expect(result).toBeDefined();
      expect(result.entryNumber).toBe('JE-00001');
      expect(result.status).toBe('POSTED');
      expect(result.lines).toHaveLength(2);
      expect(prisma.journalEntry.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException for unbalanced entry', async () => {
      const unbalanced = {
        ...balancedDto,
        lines: [
          { ledgerAccountId: 'acc-cash', type: 'DEBIT' as const, amount: 1000 },
          { ledgerAccountId: 'acc-revenue', type: 'CREDIT' as const, amount: 500 },
        ],
      };

      await expect(service.createJournal(unbalanced)).rejects.toThrow(BadRequestException);
      await expect(service.createJournal(unbalanced)).rejects.toThrow(/Unbalanced journal entry/);
    });

    it('should throw BadRequestException when fewer than 2 lines', async () => {
      const oneLine = {
        ...balancedDto,
        lines: [
          { ledgerAccountId: 'acc-cash', type: 'DEBIT' as const, amount: 0 },
        ],
      };
      // Total debit = 0, total credit = 0 => balanced, but only 1 line
      await expect(service.createJournal(oneLine)).rejects.toThrow(BadRequestException);
      await expect(service.createJournal(oneLine)).rejects.toThrow(/at least 2 lines/);
    });

    it('should throw for zero-amount balanced entry with only 1 line', async () => {
      const singleZero = {
        ...balancedDto,
        lines: [{ ledgerAccountId: 'acc-1', type: 'DEBIT' as const, amount: 0 }],
      };
      await expect(service.createJournal(singleZero)).rejects.toThrow(/at least 2 lines/);
    });

    it('should update GL account balance correctly for DEBIT-normal account', async () => {
      // DEBIT line on a DEBIT-normal account should increment balance
      prisma.gLAccount.findUnique
        .mockResolvedValueOnce({ id: 'acc-cash', normalBalance: 'DEBIT', balance: 5000 })
        .mockResolvedValueOnce({ id: 'acc-revenue', normalBalance: 'CREDIT', balance: 5000 });

      await service.createJournal(balancedDto);

      // First call: DEBIT 1000 on DEBIT-normal => effectiveChange = +1000
      expect(prisma.gLAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'acc-cash' },
          data: { balance: { increment: 1000 } },
        }),
      );
    });

    it('should update GL account balance correctly for CREDIT-normal account', async () => {
      prisma.gLAccount.findUnique
        .mockResolvedValueOnce({ id: 'acc-cash', normalBalance: 'DEBIT', balance: 0 })
        .mockResolvedValueOnce({ id: 'acc-revenue', normalBalance: 'CREDIT', balance: 0 });

      await service.createJournal(balancedDto);

      // Second call: CREDIT 1000 on CREDIT-normal => balanceChange = -1000, effective = +1000
      expect(prisma.gLAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'acc-revenue' },
          data: { balance: { increment: 1000 } },
        }),
      );
    });

    it('should handle negative amount lines with balanced totals', async () => {
      // Negative amounts are technically valid if totals match
      const negativeDto = {
        ...balancedDto,
        lines: [
          { ledgerAccountId: 'acc-1', type: 'DEBIT' as const, amount: -500 },
          { ledgerAccountId: 'acc-2', type: 'DEBIT' as const, amount: 500 },
          { ledgerAccountId: 'acc-3', type: 'CREDIT' as const, amount: 0 },
        ],
      };
      // totalDebit = 0, totalCredit = 0 => balanced
      prisma.gLAccount.findUnique.mockResolvedValue({ id: 'acc-1', normalBalance: 'DEBIT', balance: 0 });
      const result = await service.createJournal(negativeDto);
      expect(result).toBeDefined();
    });

    it('should generate sequential entry numbers', async () => {
      prisma.journalEntry.count.mockResolvedValue(42);
      prisma.gLAccount.findUnique.mockResolvedValue({ id: 'acc-1', normalBalance: 'DEBIT', balance: 0 });

      const result = await service.createJournal(balancedDto);
      expect(result.entryNumber).toBe('JE-00043');
    });

    it('should skip GL update when account not found', async () => {
      prisma.gLAccount.findUnique.mockResolvedValue(null);

      const result = await service.createJournal(balancedDto);
      expect(result).toBeDefined();
      // gLAccount.update should NOT have been called
      expect(prisma.gLAccount.update).not.toHaveBeenCalled();
    });
  });

  // ── reverseJournal ────────────────────────────────────────────────────────

  describe('reverseJournal', () => {
    const originalEntry = {
      id: 'je-001',
      tenantId: TENANT,
      entryNumber: 'JE-00001',
      description: 'Original entry',
      status: 'POSTED',
      lines: [
        { id: 'jl-1', glAccountId: 'acc-cash', debit: 1000, credit: 0, description: 'Cash debit' },
        { id: 'jl-2', glAccountId: 'acc-revenue', debit: 0, credit: 1000, description: 'Revenue credit' },
      ],
    };

    it('should create a mirror entry with swapped debit/credit', async () => {
      prisma.journalEntry.findUnique = jest.fn().mockResolvedValue(originalEntry);
      prisma.gLAccount.findUnique.mockResolvedValue({ id: 'acc-cash', normalBalance: 'DEBIT', balance: 1000 });

      const result = await service.reverseJournal('je-001', USER);

      expect(result).toBeDefined();
      expect(result.description).toContain('Reversal of JE-00001');
      expect(result.reference).toBe('REVERSAL:je-001');

      // Verify create was called with swapped lines
      const createCall = prisma.journalEntry.create.mock.calls[0][0];
      const createdLines = createCall.data.lines.create;
      // First original line: debit=1000, credit=0 => reversal: debit=0, credit=1000
      expect(createdLines[0].debit).toBe(0);
      expect(createdLines[0].credit).toBe(1000);
      // Second original line: debit=0, credit=1000 => reversal: debit=1000, credit=0
      expect(createdLines[1].debit).toBe(1000);
      expect(createdLines[1].credit).toBe(0);
    });

    it('should throw BadRequestException when already reversed', async () => {
      prisma.journalEntry.findUnique = jest.fn().mockResolvedValue({
        ...originalEntry,
        status: 'REVERSED',
      });

      await expect(service.reverseJournal('je-001', USER)).rejects.toThrow(BadRequestException);
      await expect(service.reverseJournal('je-001', USER)).rejects.toThrow(/Already reversed/);
    });

    it('should throw BadRequestException when entry not found', async () => {
      prisma.journalEntry.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.reverseJournal('nonexistent', USER)).rejects.toThrow(BadRequestException);
      await expect(service.reverseJournal('nonexistent', USER)).rejects.toThrow(/not found/);
    });

    it('should mark original entry as REVERSED', async () => {
      prisma.journalEntry.findUnique = jest.fn().mockResolvedValue(originalEntry);
      prisma.gLAccount.findUnique.mockResolvedValue({ id: 'acc-cash', normalBalance: 'DEBIT', balance: 1000 });

      await service.reverseJournal('je-001', USER);

      expect(prisma.journalEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'je-001' },
          data: expect.objectContaining({ status: 'REVERSED', reversedById: USER }),
        }),
      );
    });
  });

  // ── getTrialBalance ───────────────────────────────────────────────────────

  describe('getTrialBalance', () => {
    it('should return non-zero accounts sorted by code', async () => {
      prisma.gLAccount.findMany.mockResolvedValue([
        { id: '1', code: '1000', name: 'Cash', type: 'ASSET', normalBalance: 'DEBIT', balance: 5000, isActive: true },
        { id: '2', code: '2000', name: 'Payable', type: 'LIABILITY', normalBalance: 'CREDIT', balance: 3000, isActive: true },
        { id: '3', code: '3000', name: 'Zero Account', type: 'ASSET', normalBalance: 'DEBIT', balance: 0, isActive: true },
      ]);

      const result = await service.getTrialBalance(TENANT);

      expect(result).toHaveLength(2);
      expect(result[0].code).toBe('1000');
      expect(result[0].debit).toBe(5000);
      expect(result[0].credit).toBe(0);
      expect(result[1].code).toBe('2000');
      expect(result[1].debit).toBe(0);
      expect(result[1].credit).toBe(3000);
    });

    it('should return empty array when all accounts have zero balance', async () => {
      prisma.gLAccount.findMany.mockResolvedValue([
        { id: '1', code: '1000', name: 'Cash', type: 'ASSET', normalBalance: 'DEBIT', balance: 0, isActive: true },
      ]);

      const result = await service.getTrialBalance(TENANT);
      expect(result).toHaveLength(0);
    });

    it('should correctly handle negative balances on DEBIT-normal accounts', async () => {
      prisma.gLAccount.findMany.mockResolvedValue([
        { id: '1', code: '1000', name: 'Cash', type: 'ASSET', normalBalance: 'DEBIT', balance: -500, isActive: true },
      ]);

      const result = await service.getTrialBalance(TENANT);
      expect(result).toHaveLength(1);
      // Negative balance on DEBIT-normal => shows in credit column
      expect(result[0].debit).toBe(0);
      expect(result[0].credit).toBe(500);
    });

    it('should correctly handle negative balances on CREDIT-normal accounts', async () => {
      prisma.gLAccount.findMany.mockResolvedValue([
        { id: '1', code: '2000', name: 'Liability', type: 'LIABILITY', normalBalance: 'CREDIT', balance: -200, isActive: true },
      ]);

      const result = await service.getTrialBalance(TENANT);
      expect(result).toHaveLength(1);
      // Negative balance on CREDIT-normal => shows in debit column
      expect(result[0].debit).toBe(200);
      expect(result[0].credit).toBe(0);
    });
  });

  // ── getLedgerHistory ──────────────────────────────────────────────────────

  describe('getLedgerHistory', () => {
    it('should return entries with running balance', async () => {
      prisma.journalLine.findMany.mockResolvedValue([
        {
          id: 'jl-1',
          debit: 1000,
          credit: 0,
          description: 'Opening',
          journalEntry: { date: new Date('2026-01-01'), entryNumber: 'JE-00001', description: 'Opening', status: 'POSTED' },
        },
        {
          id: 'jl-2',
          debit: 0,
          credit: 300,
          description: 'Payment',
          journalEntry: { date: new Date('2026-01-05'), entryNumber: 'JE-00002', description: 'Payment', status: 'POSTED' },
        },
        {
          id: 'jl-3',
          debit: 500,
          credit: 0,
          description: 'Receipt',
          journalEntry: { date: new Date('2026-01-10'), entryNumber: 'JE-00003', description: 'Receipt', status: 'POSTED' },
        },
      ]);

      const result = await service.getLedgerHistory('acc-cash');

      expect(result).toHaveLength(3);
      expect(result[0].balance).toBe(1000);   // 1000 - 0
      expect(result[1].balance).toBe(700);    // 1000 + 0 - 300
      expect(result[2].balance).toBe(1200);   // 700 + 500 - 0
    });

    it('should return empty array for an account with no transactions', async () => {
      prisma.journalLine.findMany.mockResolvedValue([]);

      const result = await service.getLedgerHistory('acc-empty');
      expect(result).toHaveLength(0);
    });

    it('should apply date filters when provided', async () => {
      prisma.journalLine.findMany.mockResolvedValue([]);

      await service.getLedgerHistory('acc-cash', '2026-01-01', '2026-01-31');

      expect(prisma.journalLine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            glAccountId: 'acc-cash',
            journalEntry: {
              date: {
                gte: expect.any(Date),
                lte: expect.any(Date),
              },
            },
          }),
        }),
      );
    });
  });
});
