import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { JournalService } from "./journal.service";

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly journalService: JournalService,
  ) {}

  // ── Smart Auto-Reconcile ──────────────

  async smartAutoReconcile(tenantId: string, bankAccountId: string) {
    // Get unmatched bank statements for the given bank account
    const unmatchedStatements = await this.prisma.bankStatement.findMany({
      where: {
        tenantId,
        bankAccountId,
        reconcileStatus: "UNMATCHED" as any,
      },
      orderBy: { transactionDate: "asc" },
    });

    const matched: Array<{ statementId: string; journalEntryId: string }> = [];
    const suggested: Array<{ statementId: string; journalEntryId: string; confidence: number; reason: string }> = [];
    let unmatchedCount = 0;

    for (const stmt of unmatchedStatements) {
      const stmtAmount = Math.abs(Number(stmt.amount));
      const stmtDate = new Date(stmt.transactionDate);

      // Define search window: amount within 1%, date within ±3 days
      const amountLow = stmtAmount * 0.99;
      const amountHigh = stmtAmount * 1.01;
      const dateLow = new Date(stmtDate);
      dateLow.setDate(dateLow.getDate() - 3);
      const dateHigh = new Date(stmtDate);
      dateHigh.setDate(dateHigh.getDate() + 3);

      // Find candidate journal entries matching amount and date range
      const candidates = await this.prisma.journalEntry.findMany({
        where: {
          tenantId,
          status: "POSTED",
          date: { gte: dateLow, lte: dateHigh },
          lines: {
            some: {
              OR: [
                { debit: { gte: amountLow, lte: amountHigh } },
                { credit: { gte: amountLow, lte: amountHigh } },
              ],
            },
          },
        },
        include: {
          lines: { include: { glAccount: { select: { code: true, name: true } } } },
        },
      });

      // Score each candidate
      let bestCandidate: { journalEntryId: string; confidence: number; reason: string } | null = null;

      for (const candidate of candidates) {
        let confidence = 0;
        const reasons: string[] = [];

        // Check for exact amount match on any line
        const matchingLines = candidate.lines.filter(l => {
          const lineAmount = Math.max(Number(l.debit), Number(l.credit));
          return Math.abs(lineAmount - stmtAmount) < 0.01;
        });

        if (matchingLines.length > 0) {
          confidence += 0.5;
          reasons.push("Exact amount match");
        } else {
          // Approximate amount match
          const approxLines = candidate.lines.filter(l => {
            const lineAmount = Math.max(Number(l.debit), Number(l.credit));
            return lineAmount >= amountLow && lineAmount <= amountHigh;
          });
          if (approxLines.length > 0) {
            confidence += 0.3;
            reasons.push("Approximate amount match");
          }
        }

        // Date proximity scoring
        const daysDiff = Math.abs(
          (stmtDate.getTime() - new Date(candidate.date).getTime()) / (1000 * 60 * 60 * 24),
        );
        if (daysDiff === 0) {
          confidence += 0.2;
          reasons.push("Same day");
        } else if (daysDiff <= 1) {
          confidence += 0.15;
          reasons.push("±1 day");
        } else {
          confidence += 0.05;
          reasons.push(`±${Math.round(daysDiff)} days`);
        }

        // Reference / description similarity
        const stmtDesc = (stmt.description ?? "").toLowerCase();
        const stmtRef = (stmt.referenceNumber ?? "").toLowerCase();
        const jeRef = (candidate.reference ?? "").toLowerCase();
        const jeDesc = (candidate.description ?? "").toLowerCase();

        if (stmtRef && jeRef && (stmtRef.includes(jeRef) || jeRef.includes(stmtRef))) {
          confidence += 0.3;
          reasons.push("Reference match");
        } else if (stmtDesc && jeDesc) {
          // Simple token overlap
          const stmtTokens = stmtDesc.split(/\s+/).filter(t => t.length > 2);
          const jeTokens = jeDesc.split(/\s+/).filter(t => t.length > 2);
          const overlap = stmtTokens.filter(t => jeTokens.includes(t)).length;
          if (overlap > 0) {
            const overlapScore = Math.min(overlap * 0.1, 0.2);
            confidence += overlapScore;
            reasons.push(`Description overlap (${overlap} tokens)`);
          }
        }

        // Cap confidence at 1.0
        confidence = Math.min(confidence, 1.0);

        if (!bestCandidate || confidence > bestCandidate.confidence) {
          bestCandidate = {
            journalEntryId: candidate.id,
            confidence,
            reason: reasons.join("; "),
          };
        }
      }

      if (bestCandidate && bestCandidate.confidence > 0.8) {
        // Auto-match with high confidence
        await this.prisma.bankStatement.update({
          where: { id: stmt.id },
          data: {
            reconcileStatus: "MATCHED" as any,
            journalEntryId: bestCandidate.journalEntryId,
          },
        });
        matched.push({ statementId: stmt.id, journalEntryId: bestCandidate.journalEntryId });
      } else if (bestCandidate && bestCandidate.confidence >= 0.5) {
        suggested.push({
          statementId: stmt.id,
          journalEntryId: bestCandidate.journalEntryId,
          confidence: Math.round(bestCandidate.confidence * 100) / 100,
          reason: bestCandidate.reason,
        });
        unmatchedCount++;
      } else {
        unmatchedCount++;
      }
    }

    this.logger.log(
      `Reconciliation for bank ${bankAccountId}: ${matched.length} matched, ${suggested.length} suggested, ${unmatchedCount} unmatched`,
    );

    return { matched: matched.length, suggested, unmatched: unmatchedCount };
  }

  // ── Reconciliation Summary ──────────────

  async getReconciliationSummary(tenantId: string, bankAccountId: string) {
    const [matchedCount, unmatchedCount, reconciledCount] = await Promise.all([
      this.prisma.bankStatement.count({
        where: { tenantId, bankAccountId, reconcileStatus: "MATCHED" as any },
      }),
      this.prisma.bankStatement.count({
        where: { tenantId, bankAccountId, reconcileStatus: "UNMATCHED" as any },
      }),
      this.prisma.bankStatement.count({
        where: { tenantId, bankAccountId, reconcileStatus: "RECONCILED" as any },
      }),
    ]);

    // Bank balance from bank account record
    const bankAccount = await this.prisma.bankAccount.findUnique({
      where: { id: bankAccountId },
    });
    const bankBalance = Number(bankAccount?.currentBalance ?? 0);

    // Book balance: sum of cash/bank GL account balances for this tenant
    const cashAccounts = await this.prisma.gLAccount.findMany({
      where: {
        tenantId,
        type: "ASSET" as any,
        isActive: true,
        OR: [
          { group: { contains: "Cash", mode: "insensitive" } },
          { group: { contains: "Bank", mode: "insensitive" } },
        ],
      },
    });
    const bookBalance = cashAccounts.reduce((s, a) => s + Number(a.balance), 0);

    // Reconciling items: unmatched statements
    const reconcilingItems = await this.prisma.bankStatement.findMany({
      where: {
        tenantId,
        bankAccountId,
        reconcileStatus: "UNMATCHED" as any,
      },
      orderBy: { transactionDate: "desc" },
      take: 50,
    });

    return {
      bankBalance,
      bookBalance,
      difference: bankBalance - bookBalance,
      matched: matchedCount,
      unmatched: unmatchedCount,
      reconciled: reconciledCount,
      reconcilingItems: reconcilingItems.map(item => ({
        id: item.id,
        date: item.transactionDate,
        description: item.description,
        amount: Number(item.amount),
        type: item.type,
        reference: item.referenceNumber,
      })),
    };
  }

  // ── Suggested Matches for Review ──────────────

  async getSuggestedMatches(tenantId: string, bankAccountId: string) {
    const unmatchedStatements = await this.prisma.bankStatement.findMany({
      where: {
        tenantId,
        bankAccountId,
        reconcileStatus: "UNMATCHED" as any,
      },
      orderBy: { transactionDate: "desc" },
      take: 100,
    });

    const results: Array<{
      statement: {
        id: string;
        date: Date;
        description: string;
        amount: number;
        reference: string | null;
      };
      possibleMatches: Array<{
        journalEntryId: string;
        entryNumber: string;
        date: Date;
        description: string | null;
        amount: number;
        confidence: number;
      }>;
    }> = [];

    for (const stmt of unmatchedStatements) {
      const stmtAmount = Math.abs(Number(stmt.amount));
      const stmtDate = new Date(stmt.transactionDate);
      const dateLow = new Date(stmtDate);
      dateLow.setDate(dateLow.getDate() - 5);
      const dateHigh = new Date(stmtDate);
      dateHigh.setDate(dateHigh.getDate() + 5);

      const amountLow = stmtAmount * 0.95;
      const amountHigh = stmtAmount * 1.05;

      const candidates = await this.prisma.journalEntry.findMany({
        where: {
          tenantId,
          status: "POSTED",
          date: { gte: dateLow, lte: dateHigh },
          lines: {
            some: {
              OR: [
                { debit: { gte: amountLow, lte: amountHigh } },
                { credit: { gte: amountLow, lte: amountHigh } },
              ],
            },
          },
        },
        include: {
          lines: true,
        },
        take: 5,
      });

      const possibleMatches = candidates.map(candidate => {
        const maxLineAmount = Math.max(
          ...candidate.lines.map(l => Math.max(Number(l.debit), Number(l.credit))),
        );
        const amountDiffPct = Math.abs(maxLineAmount - stmtAmount) / stmtAmount;
        const daysDiff = Math.abs(
          (stmtDate.getTime() - new Date(candidate.date).getTime()) / (1000 * 60 * 60 * 24),
        );

        let confidence = 0;
        if (amountDiffPct < 0.001) confidence += 0.5;
        else if (amountDiffPct < 0.01) confidence += 0.4;
        else confidence += 0.2;

        if (daysDiff === 0) confidence += 0.3;
        else if (daysDiff <= 1) confidence += 0.2;
        else confidence += 0.1;

        const stmtRef = (stmt.referenceNumber ?? "").toLowerCase();
        const jeRef = (candidate.reference ?? "").toLowerCase();
        if (stmtRef && jeRef && (stmtRef.includes(jeRef) || jeRef.includes(stmtRef))) {
          confidence += 0.2;
        }

        return {
          journalEntryId: candidate.id,
          entryNumber: candidate.entryNumber,
          date: candidate.date,
          description: candidate.description,
          amount: maxLineAmount,
          confidence: Math.min(Math.round(confidence * 100) / 100, 1.0),
        };
      });

      possibleMatches.sort((a, b) => b.confidence - a.confidence);

      results.push({
        statement: {
          id: stmt.id,
          date: stmt.transactionDate,
          description: stmt.description,
          amount: Number(stmt.amount),
          reference: stmt.referenceNumber,
        },
        possibleMatches,
      });
    }

    return results;
  }

  // ── Accept a Suggested Match ──────────────

  async acceptMatch(tenantId: string, statementId: string, journalEntryId: string) {
    // Verify both records belong to the tenant
    const statement = await this.prisma.bankStatement.findFirst({
      where: { id: statementId, tenantId },
    });
    if (!statement) {
      throw new Error("Bank statement not found");
    }

    const journalEntry = await this.prisma.journalEntry.findFirst({
      where: { id: journalEntryId, tenantId },
    });
    if (!journalEntry) {
      throw new Error("Journal entry not found");
    }

    const updated = await this.prisma.bankStatement.update({
      where: { id: statementId },
      data: {
        reconcileStatus: "MATCHED" as any,
        journalEntryId,
      },
    });

    this.logger.log(`Statement ${statementId} matched to JE ${journalEntryId}`);
    return updated;
  }

  // ── Reject a Match ──────────────

  async rejectMatch(tenantId: string, statementId: string) {
    const statement = await this.prisma.bankStatement.findFirst({
      where: { id: statementId, tenantId },
    });
    if (!statement) {
      throw new Error("Bank statement not found");
    }

    // Keep as UNMATCHED but clear any prior journalEntryId and add a reviewed note
    const updated = await this.prisma.bankStatement.update({
      where: { id: statementId },
      data: {
        reconcileStatus: "UNMATCHED" as any,
        journalEntryId: null,
      },
    });

    this.logger.log(`Statement ${statementId} match rejected, kept as UNMATCHED`);
    return updated;
  }

  // ── Create Adjustment Entry for Unreconciled Items ──────────────

  async createAdjustmentEntry(
    tenantId: string,
    dto: { statementId: string; description: string; glAccountId: string },
    userId: string,
  ) {
    const statement = await this.prisma.bankStatement.findFirst({
      where: { id: dto.statementId, tenantId },
    });
    if (!statement) {
      throw new Error("Bank statement not found");
    }

    const amount = Math.abs(Number(statement.amount));

    // Find the bank's GL account (Cash & Bank type)
    const bankAccount = await this.prisma.bankAccount.findUnique({
      where: { id: statement.bankAccountId },
    });

    // Look for a GL account linked to this bank
    const bankGlAccount = await this.prisma.gLAccount.findFirst({
      where: {
        tenantId,
        type: "ASSET" as any,
        isActive: true,
        OR: [
          { name: { contains: bankAccount?.bankName ?? "", mode: "insensitive" } },
          { group: { contains: "Bank", mode: "insensitive" } },
        ],
      },
    });

    const bankGlAccountId = bankGlAccount?.id ?? dto.glAccountId;

    // Determine debit/credit based on statement type
    // CREDIT type statement = money coming in = debit bank, credit target account
    // DEBIT type statement = money going out = credit bank, debit target account
    const isCredit = statement.type === "CREDIT" || Number(statement.amount) > 0;

    const lines = isCredit
      ? [
          { ledgerAccountId: bankGlAccountId, type: "DEBIT" as const, amount, narration: dto.description },
          { ledgerAccountId: dto.glAccountId, type: "CREDIT" as const, amount, narration: dto.description },
        ]
      : [
          { ledgerAccountId: dto.glAccountId, type: "DEBIT" as const, amount, narration: dto.description },
          { ledgerAccountId: bankGlAccountId, type: "CREDIT" as const, amount, narration: dto.description },
        ];

    // Create journal entry via journal service
    const journalEntry = await this.journalService.createJournal({
      tenantId,
      date: new Date(statement.transactionDate).toISOString(),
      narration: dto.description || `Bank reconciliation adjustment for ${statement.description}`,
      refType: "BANK_RECONCILIATION",
      refId: dto.statementId,
      postedBy: userId,
      lines,
    });

    // Mark statement as RECONCILED
    await this.prisma.bankStatement.update({
      where: { id: dto.statementId },
      data: {
        reconcileStatus: "RECONCILED" as any,
        journalEntryId: journalEntry.id,
      },
    });

    this.logger.log(`Adjustment entry ${journalEntry.entryNumber} created for statement ${dto.statementId}`);
    return journalEntry;
  }
}
