import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  // ── GL Accounts ──────────────────────────────

  async getAccounts(tenantId: string, parentId?: string) {
    return this.prisma.gLAccount.findMany({
      where: {
        tenantId,
        parentId: parentId ?? null,
        isActive: true,
      },
      include: {
        children: {
          where: { isActive: true },
          include: {
            children: { where: { isActive: true } },
          },
        },
      },
      orderBy: { code: "asc" },
    });
  }

  async createAccount(dto: { code: string; name: string; type: string; group?: string; subGroup?: string; parentId?: string; normalBalance?: string }, tenantId: string) {
    if (dto.parentId) {
      const parent = await this.prisma.gLAccount.findFirst({ where: { id: dto.parentId, tenantId } });
      if (!parent) throw new NotFoundException("Parent account not found");
    }
    return this.prisma.gLAccount.create({
      data: {
        tenantId,
        code: dto.code,
        name: dto.name,
        type: dto.type as any,
        normalBalance: (dto.normalBalance as any) ?? "DEBIT",
        group: dto.group ?? dto.type,
        subGroup: dto.subGroup,
        parentId: dto.parentId ?? null,
      },
    });
  }

  // ── Journal Entries ───────────────────────────

  async findJournalEntries(tenantId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.journalEntry.findMany({
        where: { tenantId },
        include: {
          lines: { include: { glAccount: { select: { code: true, name: true } } } },
          createdBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: { date: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.journalEntry.count({ where: { tenantId } }),
    ]);
    return { data, total, page, limit };
  }

  async postJournalEntry(
    dto: {
      description?: string;
      date?: string;
      reference?: string;
      lines: Array<{ glAccountId: string; debit: number; credit: number; description?: string }>;
    },
    tenantId: string,
    userId: string
  ) {
    const totalDebit = dto.lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = dto.lines.reduce((s, l) => s + l.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      throw new BadRequestException(`Journal entry not balanced: debit=${totalDebit}, credit=${totalCredit}`);
    }

    const count = await this.prisma.journalEntry.count({ where: { tenantId } });
    const entryNumber = `JE-${String(count + 1).padStart(5, "0")}`;
    const date = dto.date ? new Date(dto.date) : new Date();

    return this.prisma.$transaction(async (tx) => {
      const je = await tx.journalEntry.create({
        data: {
          tenantId,
          entryNumber,
          description: dto.description,
          date,
          status: "POSTED",
          reference: dto.reference,
          createdById: userId,
          lines: {
            create: dto.lines.map((l) => ({
              glAccountId: l.glAccountId,
              debit: l.debit,
              credit: l.credit,
              description: l.description,
            })),
          },
        },
        include: { lines: true },
      });

      // Update GLAccount balances
      for (const line of dto.lines) {
        const account = await tx.gLAccount.findUnique({ where: { id: line.glAccountId } });
        if (!account) continue;
        const delta =
          account.normalBalance === "DEBIT"
            ? line.debit - line.credit
            : line.credit - line.debit;
        await tx.gLAccount.update({
          where: { id: line.glAccountId },
          data: { balance: { increment: delta } },
        });
      }

      return je;
    });
  }

  async reverseJournalEntry(jeId: string, tenantId: string, userId: string) {
    const original = await this.prisma.journalEntry.findFirst({
      where: { id: jeId, tenantId },
      include: { lines: true },
    });
    if (!original) throw new NotFoundException("Journal entry not found");
    if (original.status === "REVERSED") throw new BadRequestException("Already reversed");

    const reversedLines = original.lines.map((l) => ({
      glAccountId: l.glAccountId,
      debit: Number(l.credit),
      credit: Number(l.debit),
      description: l.description ?? undefined,
    }));

    const reversed = await this.postJournalEntry(
      { description: `Reversal of ${original.entryNumber}`, date: new Date().toISOString(), reference: original.entryNumber ?? undefined, lines: reversedLines },
      tenantId,
      userId
    );

    await this.prisma.journalEntry.update({
      where: { id: jeId },
      data: { status: "REVERSED", reversedById: userId, reversedAt: new Date() },
    });

    return reversed;
  }

  // ── Financial Reports ─────────────────────────

  async getTrialBalance(tenantId: string, asOf?: string) {
    const where: Record<string, unknown> = { tenantId };
    if (asOf) where["date"] = { lte: new Date(asOf) };

    const lines = await this.prisma.journalLine.findMany({
      where: { journalEntry: where },
      include: { glAccount: true },
    });

    const accountMap = new Map<string, { account: typeof lines[0]["glAccount"]; debit: number; credit: number }>();
    for (const line of lines) {
      const key = line.glAccountId;
      const existing = accountMap.get(key) ?? { account: line.glAccount, debit: 0, credit: 0 };
      existing.debit += Number(line.debit);
      existing.credit += Number(line.credit);
      accountMap.set(key, existing);
    }

    const rows = Array.from(accountMap.values()).sort((a, b) => a.account.code.localeCompare(b.account.code));
    const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
    const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
    return { rows, totalDebit, totalCredit };
  }

  async getProfitLoss(tenantId: string, from: string, to: string) {
    const lines = await this.prisma.journalLine.findMany({
      where: {
        journalEntry: {
          tenantId,
          date: { gte: new Date(from), lte: new Date(to) },
        },
        glAccount: { type: { in: ["REVENUE", "EXPENSE"] } },
      },
      include: { glAccount: { select: { type: true, name: true, normalBalance: true } } },
    });

    let revenue = 0;
    let expenses = 0;
    for (const line of lines) {
      const net =
        line.glAccount.normalBalance === "CREDIT"
          ? Number(line.credit) - Number(line.debit)
          : Number(line.debit) - Number(line.credit);
      if (line.glAccount.type === "REVENUE") revenue += net;
      else expenses += net;
    }

    return { revenue, expenses, netIncome: revenue - expenses, period: { from, to } };
  }

  async getBalanceSheet(tenantId: string, asOf?: string) {
    const accounts = await this.prisma.gLAccount.findMany({
      where: { tenantId, isActive: true, type: { in: ["ASSET", "LIABILITY", "EQUITY"] } },
      orderBy: { code: "asc" },
    });

    const assets = accounts.filter((a) => a.type === "ASSET");
    const liabilities = accounts.filter((a) => a.type === "LIABILITY");
    const equity = accounts.filter((a) => a.type === "EQUITY");

    const totalAssets = assets.reduce((s, a) => s + Number(a.balance), 0);
    const totalLiabilities = liabilities.reduce((s, a) => s + Number(a.balance), 0);
    const totalEquity = equity.reduce((s, a) => s + Number(a.balance), 0);

    return { assets, liabilities, equity, totalAssets, totalLiabilities, totalEquity, asOf: asOf ?? new Date().toISOString() };
  }

  async getCashFlow(tenantId: string, from: string, to: string) {
    const lines = await this.prisma.journalLine.findMany({
      where: {
        journalEntry: {
          tenantId,
          date: { gte: new Date(from), lte: new Date(to) },
        },
      },
      include: { glAccount: { select: { type: true, name: true, normalBalance: true } } },
    });

    let operating = 0;
    let investing = 0;
    let financing = 0;

    for (const line of lines) {
      const net = Number(line.debit) - Number(line.credit);
      if (line.glAccount.type === "REVENUE" || line.glAccount.type === "EXPENSE") operating += net;
      else if (line.glAccount.type === "ASSET") investing += net;
      else financing += net;
    }

    return { operating, investing, financing, netCashFlow: operating + investing + financing, period: { from, to } };
  }

  // ── Bank Accounts ─────────────────────────────

  async getBankAccounts(tenantId: string) {
    return this.prisma.bankAccount.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: "asc" },
    });
  }

  async createBankAccount(dto: { name: string; accountNumber: string; bankName: string; ifscCode?: string }, tenantId: string) {
    return this.prisma.bankAccount.create({
      data: { tenantId, ...dto },
    });
  }

  async importBankStatement(bankAccountId: string, rows: Array<{ transactionDate: string; description: string; amount: number; type: string; referenceNumber?: string }>, tenantId: string) {
    const bank = await this.prisma.bankAccount.findFirst({ where: { id: bankAccountId, tenantId } });
    if (!bank) throw new NotFoundException("Bank account not found");

    const created = await this.prisma.bankStatement.createMany({
      data: rows.map((r) => ({
        tenantId,
        bankAccountId,
        transactionDate: new Date(r.transactionDate),
        description: r.description,
        amount: r.amount,
        type: r.type,
        referenceNumber: r.referenceNumber,
        reconcileStatus: "UNMATCHED" as never,
      })),
    });
    return { imported: created.count };
  }

  async getBankStatement(bankAccountId: string, tenantId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const bank = await this.prisma.bankAccount.findFirst({ where: { id: bankAccountId, tenantId } });
    if (!bank) throw new NotFoundException("Bank account not found");

    const [data, total] = await this.prisma.$transaction([
      this.prisma.bankStatement.findMany({
        where: { bankAccountId, tenantId },
        orderBy: { transactionDate: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.bankStatement.count({ where: { bankAccountId, tenantId } }),
    ]);
    return { data, total, page, limit };
  }

  async reconcile(tenantId: string, bankAccountId: string, matches: Array<{ statementId: string; journalEntryId: string }>) {
    for (const match of matches) {
      await this.prisma.bankStatement.update({
        where: { id: match.statementId },
        data: { reconcileStatus: "MATCHED" as never, journalEntryId: match.journalEntryId },
      });
    }
    return { matched: matches.length };
  }

  async autoReconcile(tenantId: string, bankAccountId: string) {
    const unmatched = await this.prisma.bankStatement.findMany({
      where: { tenantId, bankAccountId, reconcileStatus: "UNMATCHED" as never },
    });

    let matched = 0;
    for (const stmt of unmatched) {
      const dateFrom = new Date(stmt.transactionDate);
      dateFrom.setDate(dateFrom.getDate() - 2);
      const dateTo = new Date(stmt.transactionDate);
      dateTo.setDate(dateTo.getDate() + 2);

      const jeMatch = await this.prisma.journalEntry.findFirst({
        where: {
          tenantId,
          date: { gte: dateFrom, lte: dateTo },
          reference: stmt.referenceNumber ?? undefined,
        },
      });

      if (jeMatch) {
        await this.prisma.bankStatement.update({
          where: { id: stmt.id },
          data: { reconcileStatus: "MATCHED" as never, journalEntryId: jeMatch.id },
        });
        matched++;
      }
    }
    return { matched, total: unmatched.length };
  }

  // Keep existing findAll for backward compat
  async findAll(tenantId: string): Promise<unknown[]> {
    return this.getAccounts(tenantId);
  }
}
