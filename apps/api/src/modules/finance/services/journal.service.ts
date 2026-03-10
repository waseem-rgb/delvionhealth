import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";

@Injectable()
export class JournalService {
  constructor(private readonly prisma: PrismaService) {}

  async createJournal(dto: {
    tenantId: string;
    date: string;
    narration: string;
    refType: string;
    refId?: string;
    postedBy: string;
    lines: Array<{ ledgerAccountId: string; type: "DEBIT" | "CREDIT"; amount: number; narration?: string }>;
  }) {
    const totalDebit = dto.lines.filter(l => l.type === "DEBIT").reduce((s, l) => s + l.amount, 0);
    const totalCredit = dto.lines.filter(l => l.type === "CREDIT").reduce((s, l) => s + l.amount, 0);

    if (totalDebit !== totalCredit) {
      throw new BadRequestException(`Unbalanced journal entry: Debit=${totalDebit}, Credit=${totalCredit}`);
    }

    if (dto.lines.length < 2) {
      throw new BadRequestException("Journal entry must have at least 2 lines");
    }

    return this.prisma.$transaction(async (tx) => {
      // Get next entry number
      const count = await tx.journalEntry.count({ where: { tenantId: dto.tenantId } });
      const entryNumber = `JE-${String(count + 1).padStart(5, "0")}`;

      const entry = await tx.journalEntry.create({
        data: {
          tenantId: dto.tenantId,
          entryNumber,
          description: dto.narration,
          date: new Date(dto.date),
          status: "POSTED",
          reference: dto.refType + (dto.refId ? `:${dto.refId}` : ""),
          createdById: dto.postedBy,
          lines: {
            create: dto.lines.map(line => ({
              glAccountId: line.ledgerAccountId,
              debit: line.type === "DEBIT" ? line.amount : 0,
              credit: line.type === "CREDIT" ? line.amount : 0,
              description: line.narration ?? dto.narration,
            })),
          },
        },
        include: { lines: true },
      });

      // Update ledger balances
      for (const line of dto.lines) {
        const account = await tx.gLAccount.findUnique({ where: { id: line.ledgerAccountId } });
        if (!account) continue;

        const balanceChange = line.type === "DEBIT" ? line.amount : -line.amount;
        // For DEBIT normal accounts (ASSET, EXPENSE): debit increases balance
        // For CREDIT normal accounts (LIABILITY, INCOME, EQUITY): credit increases balance
        const normalIsDebit = account.normalBalance === "DEBIT";
        const effectiveChange = normalIsDebit ? balanceChange : -balanceChange;

        await tx.gLAccount.update({
          where: { id: line.ledgerAccountId },
          data: {
            balance: { increment: effectiveChange },
          },
        });
      }

      return entry;
    });
  }

  async reverseJournal(id: string, userId: string) {
    const original = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: { lines: true },
    });

    if (!original) throw new BadRequestException("Journal entry not found");
    if (original.status === "REVERSED") throw new BadRequestException("Already reversed");

    return this.prisma.$transaction(async (tx) => {
      // Mark original as reversed
      await tx.journalEntry.update({
        where: { id },
        data: { status: "REVERSED", reversedAt: new Date(), reversedById: userId },
      });

      // Create mirror entry
      const count = await tx.journalEntry.count({ where: { tenantId: original.tenantId } });
      const entryNumber = `JE-${String(count + 1).padStart(5, "0")}`;

      const reversal = await tx.journalEntry.create({
        data: {
          tenantId: original.tenantId,
          entryNumber,
          description: `Reversal of ${original.entryNumber}: ${original.description ?? ""}`,
          date: new Date(),
          status: "POSTED",
          reference: `REVERSAL:${original.id}`,
          createdById: userId,
          lines: {
            create: original.lines.map(line => ({
              glAccountId: line.glAccountId,
              debit: line.credit, // swap debit/credit
              credit: line.debit,
              description: `Reversal: ${line.description ?? ""}`,
            })),
          },
        },
        include: { lines: true },
      });

      // Reverse ledger balances
      for (const line of original.lines) {
        const debit = Number(line.debit);
        const credit = Number(line.credit);
        const account = await tx.gLAccount.findUnique({ where: { id: line.glAccountId } });
        if (!account) continue;

        // Reverse the original effect
        const balanceChange = debit > 0 ? -debit : credit;
        const normalIsDebit = account.normalBalance === "DEBIT";
        const effectiveChange = normalIsDebit ? balanceChange : -balanceChange;

        await tx.gLAccount.update({
          where: { id: line.glAccountId },
          data: { balance: { increment: effectiveChange } },
        });
      }

      return reversal;
    });
  }

  async getLedgerHistory(ledgerAccountId: string, dateFrom?: string, dateTo?: string) {
    const where: any = { glAccountId: ledgerAccountId };
    if (dateFrom || dateTo) {
      where.journalEntry = {
        date: {
          ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
          ...(dateTo ? { lte: new Date(dateTo) } : {}),
        },
      };
    }

    const lines = await this.prisma.journalLine.findMany({
      where,
      include: {
        journalEntry: { select: { date: true, entryNumber: true, description: true, status: true } },
      },
      orderBy: { journalEntry: { date: "asc" } },
    });

    let runningBalance = 0;
    return lines.map(line => {
      const debit = Number(line.debit);
      const credit = Number(line.credit);
      runningBalance += debit - credit;
      return {
        id: line.id,
        date: line.journalEntry.date,
        entryNumber: line.journalEntry.entryNumber,
        narration: line.description ?? line.journalEntry.description,
        debit,
        credit,
        balance: runningBalance,
        status: line.journalEntry.status,
      };
    });
  }

  async getTrialBalance(tenantId: string, asOfDate?: string) {
    const where: any = { tenantId, isActive: true };
    const accounts = await this.prisma.gLAccount.findMany({
      where,
      orderBy: { code: "asc" },
    });

    return accounts
      .filter(a => Number(a.balance) !== 0)
      .map(a => {
        const balance = Number(a.balance);
        const isDebitNormal = a.normalBalance === "DEBIT";
        return {
          id: a.id,
          code: a.code,
          name: a.name,
          type: a.type,
          group: (a as any).group ?? a.type,
          debit: isDebitNormal && balance >= 0 ? Math.abs(balance) : (!isDebitNormal && balance < 0 ? Math.abs(balance) : 0),
          credit: !isDebitNormal && balance >= 0 ? Math.abs(balance) : (isDebitNormal && balance < 0 ? Math.abs(balance) : 0),
        };
      });
  }
}
