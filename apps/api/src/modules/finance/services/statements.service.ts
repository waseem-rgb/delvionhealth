import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";

@Injectable()
export class StatementsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Enhanced P&L with line items grouped by account ──────────────

  async getProfitAndLoss(tenantId: string, from: string, to: string) {
    const fromDate = new Date(from);
    const toDate = new Date(to);

    // Get all journal lines for REVENUE and EXPENSE accounts within the date range
    const journalLines = await this.prisma.journalLine.findMany({
      where: {
        journalEntry: {
          tenantId,
          status: "POSTED",
          date: { gte: fromDate, lte: toDate },
        },
        glAccount: {
          type: { in: ["REVENUE", "EXPENSE"] as any },
        },
      },
      include: {
        glAccount: { select: { id: true, code: true, name: true, type: true, normalBalance: true, group: true } },
      },
    });

    // Aggregate by GL account
    const accountMap = new Map<string, { code: string; name: string; type: string; group: string; totalDebit: number; totalCredit: number }>();

    for (const line of journalLines) {
      const acct = (line as any).glAccount;
      const key = acct.id as string;
      if (!accountMap.has(key)) {
        accountMap.set(key, {
          code: acct.code,
          name: acct.name,
          type: acct.type,
          group: acct.group ?? acct.type,
          totalDebit: 0,
          totalCredit: 0,
        });
      }
      const entry = accountMap.get(key)!;
      entry.totalDebit += Number(line.debit);
      entry.totalCredit += Number(line.credit);
    }

    const revenue: Array<{ code: string; name: string; group: string; amount: number }> = [];
    const expenses: Array<{ code: string; name: string; group: string; amount: number }> = [];

    for (const [, acct] of accountMap) {
      // REVENUE accounts have CREDIT normalBalance: net = credit - debit
      // EXPENSE accounts have DEBIT normalBalance: net = debit - credit
      if (acct.type === "REVENUE") {
        const amount = acct.totalCredit - acct.totalDebit;
        revenue.push({ code: acct.code, name: acct.name, group: acct.group, amount });
      } else if (acct.type === "EXPENSE") {
        const amount = acct.totalDebit - acct.totalCredit;
        expenses.push({ code: acct.code, name: acct.name, group: acct.group, amount });
      }
    }

    revenue.sort((a, b) => a.code.localeCompare(b.code));
    expenses.sort((a, b) => a.code.localeCompare(b.code));

    const totalRevenue = revenue.reduce((s, r) => s + r.amount, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const grossProfit = totalRevenue; // In a lab, revenue ~= gross profit (no COGS concept unless explicitly tracked)
    const netIncome = totalRevenue - totalExpenses;

    return {
      revenue,
      expenses,
      totalRevenue,
      totalExpenses,
      grossProfit,
      netIncome,
      period: { from: fromDate.toISOString(), to: toDate.toISOString() },
    };
  }

  // ── Enhanced Balance Sheet with grouped sections ──────────────

  async getBalanceSheet(tenantId: string, asOf?: string) {
    const asOfDate = asOf ? new Date(asOf) : new Date();

    // Get all active GL accounts with their balances
    const accounts = await this.prisma.gLAccount.findMany({
      where: { tenantId, isActive: true },
      orderBy: { code: "asc" },
    });

    // Compute actual balances from journal lines up to the asOf date
    const journalLines = await this.prisma.journalLine.findMany({
      where: {
        journalEntry: {
          tenantId,
          status: "POSTED",
          date: { lte: asOfDate },
        },
      },
      include: {
        glAccount: { select: { id: true, type: true, normalBalance: true } },
      },
    });

    // Calculate running balances from journal lines
    const balanceMap = new Map<string, number>();
    for (const line of journalLines) {
      const acctId = (line as any).glAccount.id as string;
      const normalBalance = (line as any).glAccount.normalBalance as string;
      const prev = balanceMap.get(acctId) ?? 0;
      // DEBIT normal: debit increases, credit decreases
      // CREDIT normal: credit increases, debit decreases
      const change = normalBalance === "DEBIT"
        ? Number(line.debit) - Number(line.credit)
        : Number(line.credit) - Number(line.debit);
      balanceMap.set(acctId, prev + change);
    }

    // Build grouped sections
    const currentAssets: Array<{ code: string; name: string; group: string; balance: number }> = [];
    const fixedAssets: Array<{ code: string; name: string; group: string; balance: number }> = [];
    const currentLiabilities: Array<{ code: string; name: string; group: string; balance: number }> = [];
    const longTermLiabilities: Array<{ code: string; name: string; group: string; balance: number }> = [];
    const equityItems: Array<{ code: string; name: string; group: string; balance: number }> = [];

    let retainedEarnings = 0;

    for (const acct of accounts) {
      const balance = balanceMap.get(acct.id) ?? 0;
      const item = { code: acct.code, name: acct.name, group: acct.group, balance };
      const groupLower = (acct.group ?? "").toLowerCase();

      switch (acct.type as string) {
        case "ASSET":
          if (groupLower.includes("fixed") || groupLower.includes("non-current") || groupLower.includes("property")) {
            fixedAssets.push(item);
          } else {
            currentAssets.push(item);
          }
          break;
        case "LIABILITY":
          if (groupLower.includes("long") || groupLower.includes("non-current")) {
            longTermLiabilities.push(item);
          } else {
            currentLiabilities.push(item);
          }
          break;
        case "EQUITY":
          equityItems.push(item);
          break;
        case "REVENUE":
          retainedEarnings += balance;
          break;
        case "EXPENSE":
          retainedEarnings -= balance;
          break;
      }
    }

    const totalCurrentAssets = currentAssets.reduce((s, a) => s + a.balance, 0);
    const totalFixedAssets = fixedAssets.reduce((s, a) => s + a.balance, 0);
    const totalAssets = totalCurrentAssets + totalFixedAssets;

    const totalCurrentLiabilities = currentLiabilities.reduce((s, l) => s + l.balance, 0);
    const totalLongTermLiabilities = longTermLiabilities.reduce((s, l) => s + l.balance, 0);
    const totalLiabilities = totalCurrentLiabilities + totalLongTermLiabilities;

    const totalEquityItems = equityItems.reduce((s, e) => s + e.balance, 0);
    const totalEquity = totalEquityItems + retainedEarnings;

    return {
      assets: {
        current: currentAssets,
        fixed: fixedAssets,
        totalCurrent: totalCurrentAssets,
        totalFixed: totalFixedAssets,
        total: totalAssets,
      },
      liabilities: {
        current: currentLiabilities,
        longTerm: longTermLiabilities,
        totalCurrent: totalCurrentLiabilities,
        totalLongTerm: totalLongTermLiabilities,
        total: totalLiabilities,
      },
      equity: {
        items: equityItems,
        retainedEarnings,
        total: totalEquity,
      },
      totalAssets,
      totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
      asOf: asOfDate.toISOString(),
    };
  }

  // ── Cash Flow Statement (Indirect Method) ──────────────

  async getCashFlowStatement(tenantId: string, from: string, to: string) {
    const fromDate = new Date(from);
    const toDate = new Date(to);

    // Get all accounts
    const accounts = await this.prisma.gLAccount.findMany({
      where: { tenantId, isActive: true },
    });

    // Get journal lines for the period
    const periodLines = await this.prisma.journalLine.findMany({
      where: {
        journalEntry: {
          tenantId,
          status: "POSTED",
          date: { gte: fromDate, lte: toDate },
        },
      },
      include: {
        glAccount: { select: { id: true, code: true, name: true, type: true, normalBalance: true, group: true } },
      },
    });

    // Calculate net changes per account for the period
    const changeMap = new Map<string, number>();
    for (const line of periodLines) {
      const acctId = (line as any).glAccount.id as string;
      const normalBalance = (line as any).glAccount.normalBalance as string;
      const prev = changeMap.get(acctId) ?? 0;
      const change = normalBalance === "DEBIT"
        ? Number(line.debit) - Number(line.credit)
        : Number(line.credit) - Number(line.debit);
      changeMap.set(acctId, prev + change);
    }

    // Net income from P&L
    let netIncome = 0;
    const operatingAdjustments: Array<{ name: string; amount: number }> = [];
    const investingItems: Array<{ name: string; amount: number }> = [];
    const financingItems: Array<{ name: string; amount: number }> = [];

    // Track cash accounts for opening/closing balance
    const cashAccountIds: string[] = [];

    for (const acct of accounts) {
      const change = changeMap.get(acct.id) ?? 0;
      const groupLower = (acct.group ?? "").toLowerCase();

      switch (acct.type as string) {
        case "REVENUE":
          netIncome += change;
          break;
        case "EXPENSE":
          netIncome -= change;
          break;
        case "ASSET":
          if (groupLower.includes("cash") || groupLower.includes("bank")) {
            cashAccountIds.push(acct.id);
          } else if (groupLower.includes("fixed") || groupLower.includes("property") || groupLower.includes("equipment")) {
            // Fixed asset changes = investing activities (increase in assets = cash outflow)
            if (change !== 0) {
              investingItems.push({ name: acct.name, amount: -change });
            }
          } else {
            // Current assets (excl cash): increase = cash used, decrease = cash provided
            if (change !== 0) {
              operatingAdjustments.push({ name: `Change in ${acct.name}`, amount: -change });
            }
          }
          break;
        case "LIABILITY":
          if (groupLower.includes("long") || groupLower.includes("non-current") || groupLower.includes("loan")) {
            // Long-term liabilities = financing
            if (change !== 0) {
              financingItems.push({ name: acct.name, amount: change });
            }
          } else {
            // Current liabilities: increase = cash provided, decrease = cash used
            if (change !== 0) {
              operatingAdjustments.push({ name: `Change in ${acct.name}`, amount: change });
            }
          }
          break;
        case "EQUITY":
          // Equity changes (excluding retained earnings) = financing
          if (change !== 0) {
            financingItems.push({ name: acct.name, amount: change });
          }
          break;
      }
    }

    // Add depreciation back (look for depreciation expense accounts)
    for (const acct of accounts) {
      if ((acct.type as string) === "EXPENSE") {
        const nameLower = acct.name.toLowerCase();
        if (nameLower.includes("depreciation") || nameLower.includes("amortization")) {
          const change = changeMap.get(acct.id) ?? 0;
          if (change !== 0) {
            operatingAdjustments.push({ name: `Add back: ${acct.name}`, amount: change });
          }
        }
      }
    }

    const operatingTotal = netIncome + operatingAdjustments.reduce((s, a) => s + a.amount, 0);
    const investingTotal = investingItems.reduce((s, i) => s + i.amount, 0);
    const financingTotal = financingItems.reduce((s, f) => s + f.amount, 0);
    const netChange = operatingTotal + investingTotal + financingTotal;

    // Opening cash balance: sum cash accounts from journal lines BEFORE fromDate
    const priorCashLines = await this.prisma.journalLine.findMany({
      where: {
        journalEntry: {
          tenantId,
          status: "POSTED",
          date: { lt: fromDate },
        },
        glAccountId: { in: cashAccountIds },
      },
    });

    let openingCash = 0;
    for (const line of priorCashLines) {
      // Cash accounts are DEBIT normal: debit increases
      openingCash += Number(line.debit) - Number(line.credit);
    }

    const closingCash = openingCash + netChange;

    return {
      operating: {
        netIncome,
        adjustments: operatingAdjustments,
        total: operatingTotal,
      },
      investing: {
        items: investingItems,
        total: investingTotal,
      },
      financing: {
        items: financingItems,
        total: financingTotal,
      },
      netChange,
      openingCash,
      closingCash,
      period: { from: fromDate.toISOString(), to: toDate.toISOString() },
    };
  }

  // ── Financial Ratios ──────────────

  async getFinancialRatios(tenantId: string) {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Get balance sheet data
    const balanceSheet = await this.getBalanceSheet(tenantId);

    // Get P&L for the current year to date
    const pnl = await this.getProfitAndLoss(tenantId, startOfYear.toISOString(), now.toISOString());

    const totalCurrentAssets = balanceSheet.assets.totalCurrent;
    const totalCurrentLiabilities = balanceSheet.liabilities.totalCurrent;
    const totalLiabilities = balanceSheet.liabilities.total;
    const totalEquity = balanceSheet.equity.total;

    // Identify inventory from current assets
    const inventoryBalance = balanceSheet.assets.current
      .filter(a => a.group.toLowerCase().includes("inventory") || a.name.toLowerCase().includes("inventory"))
      .reduce((s, a) => s + a.balance, 0);

    const currentRatio = totalCurrentLiabilities !== 0
      ? Math.round((totalCurrentAssets / totalCurrentLiabilities) * 100) / 100
      : null;

    const quickRatio = totalCurrentLiabilities !== 0
      ? Math.round(((totalCurrentAssets - inventoryBalance) / totalCurrentLiabilities) * 100) / 100
      : null;

    const debtToEquity = totalEquity !== 0
      ? Math.round((totalLiabilities / totalEquity) * 100) / 100
      : null;

    const grossMargin = pnl.totalRevenue !== 0
      ? Math.round((pnl.grossProfit / pnl.totalRevenue) * 10000) / 100
      : null;

    const netMargin = pnl.totalRevenue !== 0
      ? Math.round((pnl.netIncome / pnl.totalRevenue) * 10000) / 100
      : null;

    return {
      currentRatio,
      quickRatio,
      debtToEquity,
      grossMargin,
      netMargin,
    };
  }
}
