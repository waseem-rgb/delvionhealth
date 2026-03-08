import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { NarrationEngineService } from "./narration-engine.service";
import { StatementParserService } from "./statement-parser.service";

@Injectable()
export class AccountingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly narrationEngine: NarrationEngineService,
    private readonly statementParser: StatementParserService,
  ) {}

  // ── Statement Upload ────────────────────────────────────────────────────

  async uploadStatement(
    tenantId: string,
    bankAccountId: string,
    file: { buffer: Buffer; originalname: string },
    userId: string,
  ) {
    const bank = await this.prisma.bankAccount.findFirst({
      where: { id: bankAccountId, tenantId },
    });
    if (!bank) throw new NotFoundException("Bank account not found");

    // Seed default rules if none exist
    await this.narrationEngine.seedDefaultRules(tenantId);

    // Determine file type
    const ext = file.originalname.split(".").pop()?.toUpperCase() ?? "";
    const fileType = ext === "CSV" ? "CSV" : "EXCEL";

    // Parse the file
    const parsedRows = await this.statementParser.parseFile(file.buffer, fileType);
    if (parsedRows.length === 0) {
      throw new BadRequestException("No transactions found in the file. Check the format.");
    }

    // Create a tracking record in BankStatement (reusing existing model)
    const stmt = await this.prisma.bankStatement.create({
      data: {
        tenantId,
        bankAccountId,
        transactionDate: new Date(),
        description: `Upload: ${file.originalname} (${parsedRows.length} rows)`,
        amount: 0,
        type: "UPLOAD",
        referenceNumber: `UPLOAD-${Date.now()}`,
      },
    });

    // Process and categorize each row
    const result = await this.statementParser.processUpload(
      tenantId,
      bankAccountId,
      stmt.id,
      parsedRows,
    );

    return {
      statementId: stmt.id,
      fileName: file.originalname,
      ...result,
    };
  }

  async getUploadedStatements(tenantId: string) {
    const stmts = await this.prisma.bankStatement.findMany({
      where: { tenantId, type: "UPLOAD" },
      include: { bankAccount: { select: { name: true, bankName: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Enrich with transaction stats
    const enriched = await Promise.all(
      stmts.map(async (s) => {
        const stats = await this.prisma.bankTransaction.groupBy({
          by: ["matchType"],
          where: { tenantId, statementId: s.id },
          _count: { id: true },
        });
        const total = stats.reduce((sum, g) => sum + g._count.id, 0);
        const matched = stats.find((g) => g.matchType === "AUTO_MATCHED")?._count.id ?? 0;
        const suspense = stats.find((g) => g.matchType === "SUSPENSE")?._count.id ?? 0;
        const manual = stats.find((g) => g.matchType === "MANUAL")?._count.id ?? 0;

        return {
          id: s.id,
          fileName: s.description,
          bankName: s.bankAccount?.bankName ?? "",
          accountName: s.bankAccount?.name ?? "",
          uploadedAt: s.createdAt,
          totalRows: total,
          matchedRows: matched + manual,
          suspenseRows: suspense,
          status: suspense > 0 ? "NEEDS_REVIEW" : "REVIEWED",
        };
      })
    );

    return enriched;
  }

  // ── Transactions ────────────────────────────────────────────────────────

  async getTransactions(
    tenantId: string,
    filters: {
      bankAccountId?: string;
      category?: string;
      matchType?: string;
      type?: string; // CREDIT | DEBIT
      month?: string; // YYYY-MM
      search?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId };
    if (filters.bankAccountId) where.bankAccountId = filters.bankAccountId;
    if (filters.category) where.category = filters.category;
    if (filters.matchType) where.matchType = filters.matchType;
    if (filters.search) where.narration = { contains: filters.search, mode: "insensitive" };
    if (filters.type === "CREDIT") where.creditAmount = { gt: 0 };
    if (filters.type === "DEBIT") where.debitAmount = { gt: 0 };

    if (filters.month) {
      const [year, month] = filters.month.split("-").map(Number);
      const from = new Date(year!, month! - 1, 1);
      const to = new Date(year!, month!, 0, 23, 59, 59);
      where.txnDate = { gte: from, lte: to };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.bankTransaction.findMany({
        where,
        include: { bankAccount: { select: { name: true, bankName: true } } },
        orderBy: { txnDate: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.bankTransaction.count({ where }),
    ]);

    // Summary
    const summaryWhere = { ...where };
    delete summaryWhere.creditAmount;
    delete summaryWhere.debitAmount;

    const [creditAgg, debitAgg] = await Promise.all([
      this.prisma.bankTransaction.aggregate({
        where: { ...summaryWhere, creditAmount: { gt: 0 } },
        _sum: { creditAmount: true },
        _count: { id: true },
      }),
      this.prisma.bankTransaction.aggregate({
        where: { ...summaryWhere, debitAmount: { gt: 0 } },
        _sum: { debitAmount: true },
        _count: { id: true },
      }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      summary: {
        totalCredits: Number(creditAgg._sum.creditAmount ?? 0),
        creditCount: creditAgg._count.id,
        totalDebits: Number(debitAgg._sum.debitAmount ?? 0),
        debitCount: debitAgg._count.id,
        net: Number(creditAgg._sum.creditAmount ?? 0) - Number(debitAgg._sum.debitAmount ?? 0),
      },
    };
  }

  async categorizeTransaction(
    tenantId: string,
    txnId: string,
    dto: { category: string; subCategory?: string; description?: string; saveAsRule?: boolean },
  ) {
    const txn = await this.prisma.bankTransaction.findFirst({
      where: { id: txnId, tenantId },
    });
    if (!txn) throw new NotFoundException("Transaction not found");

    await this.prisma.bankTransaction.update({
      where: { id: txnId },
      data: {
        category: dto.category,
        subCategory: dto.subCategory,
        description: dto.description,
        matchType: "MANUAL",
      },
    });

    if (dto.saveAsRule && txn.narration) {
      // Extract a useful keyword from the narration
      const words = txn.narration.split(/[\s-/]+/).filter((w) => w.length > 3);
      const keyword = words.slice(0, 3).join(" ").toUpperCase();
      if (keyword) {
        await this.narrationEngine.addRule(tenantId, {
          pattern: keyword,
          category: dto.category,
          subCategory: dto.subCategory,
          description: dto.description,
        });
      }
    }

    return { updated: true };
  }

  async markDuplicate(tenantId: string, txnId: string) {
    await this.prisma.bankTransaction.updateMany({
      where: { id: txnId, tenantId },
      data: { isDuplicate: true },
    });
    return { marked: true };
  }

  async postTransactions(tenantId: string, statementId: string) {
    const suspenseCount = await this.prisma.bankTransaction.count({
      where: { tenantId, statementId, matchType: "SUSPENSE" },
    });
    if (suspenseCount > 0) {
      throw new BadRequestException(
        `${suspenseCount} suspense items must be resolved before posting.`
      );
    }

    await this.prisma.bankTransaction.updateMany({
      where: { tenantId, statementId, isDuplicate: false },
      data: { isPosted: true, postedAt: new Date() },
    });

    return { posted: true };
  }

  // ── Cash Book ───────────────────────────────────────────────────────────

  async getCashBookEntries(tenantId: string, month?: string) {
    const where: Record<string, unknown> = { tenantId };
    if (month) {
      const [year, m] = month.split("-").map(Number);
      const from = new Date(year!, m! - 1, 1);
      const to = new Date(year!, m!, 0, 23, 59, 59);
      where.entryDate = { gte: from, lte: to };
    }

    const entries = await this.prisma.cashBookEntry.findMany({
      where,
      orderBy: { entryDate: "asc" },
    });

    // Group by date
    const grouped: Record<string, typeof entries> = {};
    for (const e of entries) {
      const dateKey = e.entryDate.toISOString().slice(0, 10);
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(e);
    }

    // Compute daily summaries
    const days = Object.entries(grouped).map(([date, dayEntries]) => {
      const receipts = dayEntries.filter((e) => e.type === "RECEIPT");
      const payments = dayEntries.filter((e) => e.type === "PAYMENT");
      const opening = dayEntries.find((e) => e.type === "OPENING_BALANCE");
      const totalReceipts = receipts.reduce((s, e) => s + Number(e.amount), 0);
      const totalPayments = payments.reduce((s, e) => s + Number(e.amount), 0);
      const openingBal = opening ? Number(opening.amount) : 0;

      return {
        date,
        openingBalance: openingBal,
        receipts: receipts.map((e) => ({
          id: e.id,
          voucherNumber: e.voucherNumber,
          description: e.description,
          amount: Number(e.amount),
          category: e.category,
          receivedFrom: e.receivedFrom,
        })),
        payments: payments.map((e) => ({
          id: e.id,
          voucherNumber: e.voucherNumber,
          description: e.description,
          amount: Number(e.amount),
          category: e.category,
          paidTo: e.paidTo,
        })),
        totalReceipts,
        totalPayments,
        closingBalance: openingBal + totalReceipts - totalPayments,
      };
    });

    return days;
  }

  async addCashBookEntry(
    tenantId: string,
    dto: {
      entryDate: string;
      type: string;
      category?: string;
      description: string;
      amount: number;
      paidTo?: string;
      receivedFrom?: string;
      orderId?: string;
    },
    userId: string,
  ) {
    const prefix = dto.type === "RECEIPT" ? "RCPT" : "PMT";
    const count = await this.prisma.cashBookEntry.count({ where: { tenantId } });
    const voucherNumber = `${prefix}-${String(count + 1).padStart(4, "0")}`;

    return this.prisma.cashBookEntry.create({
      data: {
        tenantId,
        entryDate: new Date(dto.entryDate),
        type: dto.type,
        category: dto.category,
        description: dto.description,
        amount: dto.amount,
        voucherNumber,
        paidTo: dto.paidTo,
        receivedFrom: dto.receivedFrom,
        orderId: dto.orderId,
        createdById: userId,
      },
    });
  }

  async deleteCashBookEntry(tenantId: string, id: string) {
    await this.prisma.cashBookEntry.deleteMany({ where: { id, tenantId } });
    return { deleted: true };
  }

  // ── Combined Ledger ─────────────────────────────────────────────────────

  async getLedger(
    tenantId: string,
    filters: { month?: string; category?: string; source?: string },
  ) {
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (filters.month) {
      const [year, m] = filters.month.split("-").map(Number);
      dateFilter.gte = new Date(year!, m! - 1, 1);
      dateFilter.lte = new Date(year!, m!, 0, 23, 59, 59);
    }

    const bankWhere: Record<string, unknown> = { tenantId, isDuplicate: false };
    if (Object.keys(dateFilter).length) bankWhere.txnDate = dateFilter;
    if (filters.category) bankWhere.category = filters.category;

    const cashWhere: Record<string, unknown> = { tenantId };
    if (Object.keys(dateFilter).length) cashWhere.entryDate = dateFilter;
    if (filters.category) cashWhere.category = filters.category;

    const showBank = !filters.source || filters.source === "ALL" || filters.source === "BANK";
    const showCash = !filters.source || filters.source === "ALL" || filters.source === "CASH";

    const bankTxns = showBank
      ? await this.prisma.bankTransaction.findMany({
          where: bankWhere,
          include: { bankAccount: { select: { name: true } } },
          orderBy: { txnDate: "asc" },
        })
      : [];

    const cashEntries = showCash
      ? await this.prisma.cashBookEntry.findMany({
          where: cashWhere,
          orderBy: { entryDate: "asc" },
        })
      : [];

    // Merge and sort
    interface LedgerEntry {
      id: string;
      date: Date;
      source: string;
      description: string;
      category: string | null;
      debit: number;
      credit: number;
      narration: string;
    }

    const ledger: LedgerEntry[] = [];

    for (const t of bankTxns) {
      ledger.push({
        id: t.id,
        date: t.txnDate,
        source: t.bankAccount?.name ?? "Bank",
        description: t.description ?? t.narration.slice(0, 60),
        category: t.category,
        debit: Number(t.debitAmount ?? 0),
        credit: Number(t.creditAmount ?? 0),
        narration: t.narration,
      });
    }

    for (const c of cashEntries) {
      ledger.push({
        id: c.id,
        date: c.entryDate,
        source: "Cash",
        description: c.description,
        category: c.category,
        debit: c.type === "PAYMENT" ? Number(c.amount) : 0,
        credit: c.type === "RECEIPT" ? Number(c.amount) : 0,
        narration: c.description,
      });
    }

    ledger.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Compute running balance
    let balance = 0;
    const withBalance = ledger.map((e) => {
      balance += e.credit - e.debit;
      return { ...e, balance };
    });

    return withBalance;
  }
}
