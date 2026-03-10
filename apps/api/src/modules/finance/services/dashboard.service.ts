import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Finance Dashboard KPIs ──────────────

  async getDashboardKPIs(tenantId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // 1 & 2. Revenue this month and last month
    const [revenueThisMonthLines, revenueLastMonthLines] = await Promise.all([
      this.prisma.journalLine.findMany({
        where: {
          journalEntry: {
            tenantId,
            status: "POSTED",
            date: { gte: startOfMonth, lte: now },
          },
          glAccount: { type: "REVENUE" as any },
        },
      }),
      this.prisma.journalLine.findMany({
        where: {
          journalEntry: {
            tenantId,
            status: "POSTED",
            date: { gte: startOfLastMonth, lte: endOfLastMonth },
          },
          glAccount: { type: "REVENUE" as any },
        },
      }),
    ]);

    const revenueThisMonth = revenueThisMonthLines.reduce(
      (s, l) => s + (Number(l.credit) - Number(l.debit)),
      0,
    );
    const revenueLastMonth = revenueLastMonthLines.reduce(
      (s, l) => s + (Number(l.credit) - Number(l.debit)),
      0,
    );
    const revenueTrend =
      revenueLastMonth !== 0
        ? Math.round(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 10000) / 100
        : revenueThisMonth > 0
          ? 100
          : 0;

    // 3. Expenses this month
    const expenseThisMonthLines = await this.prisma.journalLine.findMany({
      where: {
        journalEntry: {
          tenantId,
          status: "POSTED",
          date: { gte: startOfMonth, lte: now },
        },
        glAccount: { type: "EXPENSE" as any },
      },
    });
    const expensesThisMonth = expenseThisMonthLines.reduce(
      (s, l) => s + (Number(l.debit) - Number(l.credit)),
      0,
    );

    // 4. Outstanding receivables (unpaid/partially paid invoices)
    const receivableInvoices = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] as any },
      },
      select: { total: true, amountPaid: true },
    });
    const outstandingReceivables = receivableInvoices.reduce(
      (s, inv) => s + (Number(inv.total) - Number(inv.amountPaid)),
      0,
    );

    // 5. Outstanding payables (unpaid vendor invoices)
    const payableInvoices = await this.prisma.vendorInvoice.findMany({
      where: {
        tenantId,
        status: { in: ["PENDING", "PARTIALLY_PAID"] },
      },
      select: { netPayable: true, paidAmount: true },
    });
    const outstandingPayables = payableInvoices.reduce(
      (s, inv) => s + (Number(inv.netPayable) - Number(inv.paidAmount)),
      0,
    );

    // 6. Cash balance (sum of ASSET accounts in "Cash & Bank" group)
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
      select: { balance: true },
    });
    const cashBalance = cashAccounts.reduce((s, a) => s + Number(a.balance), 0);

    // 7. Collection rate (paid invoices / total invoices this month)
    const [paidInvoiceCount, totalInvoiceCount] = await Promise.all([
      this.prisma.invoice.count({
        where: {
          tenantId,
          status: "PAID" as any,
          createdAt: { gte: startOfMonth },
        },
      }),
      this.prisma.invoice.count({
        where: {
          tenantId,
          createdAt: { gte: startOfMonth },
          status: { not: "CANCELLED" as any },
        },
      }),
    ]);
    const collectionRate =
      totalInvoiceCount > 0
        ? Math.round((paidInvoiceCount / totalInvoiceCount) * 10000) / 100
        : 0;

    // 8. Pending payroll amount
    const pendingPayrolls = await this.prisma.payrollRun.findMany({
      where: {
        tenantId,
        status: { in: ["DRAFT", "APPROVED"] as any },
      },
      select: { totalNet: true },
    });
    const pendingPayroll = pendingPayrolls.reduce((s, p) => s + Number(p.totalNet), 0);

    return {
      revenueThisMonth,
      revenueLastMonth,
      revenueTrend,
      expensesThisMonth,
      outstandingReceivables,
      outstandingPayables,
      cashBalance,
      collectionRate,
      pendingPayroll,
    };
  }

  // ── Revenue Trend (Last 6 Months) ──────────────

  async getRevenueTrend(tenantId: string) {
    const now = new Date();
    const results: Array<{ month: string; revenue: number; expenses: number; profit: number }> = [];

    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);

      const [revenueLines, expenseLines] = await Promise.all([
        this.prisma.journalLine.findMany({
          where: {
            journalEntry: {
              tenantId,
              status: "POSTED",
              date: { gte: monthStart, lte: monthEnd },
            },
            glAccount: { type: "REVENUE" as any },
          },
        }),
        this.prisma.journalLine.findMany({
          where: {
            journalEntry: {
              tenantId,
              status: "POSTED",
              date: { gte: monthStart, lte: monthEnd },
            },
            glAccount: { type: "EXPENSE" as any },
          },
        }),
      ]);

      const revenue = revenueLines.reduce(
        (s, l) => s + (Number(l.credit) - Number(l.debit)),
        0,
      );
      const expenses = expenseLines.reduce(
        (s, l) => s + (Number(l.debit) - Number(l.credit)),
        0,
      );

      const monthLabel = monthStart.toLocaleString("default", { month: "short", year: "numeric" });
      results.push({
        month: monthLabel,
        revenue,
        expenses,
        profit: revenue - expenses,
      });
    }

    return results;
  }

  // ── Expense Breakdown by Category ──────────────

  async getExpenseBreakdown(tenantId: string, from?: string, to?: string) {
    const now = new Date();
    const fromDate = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), 1);
    const toDate = to ? new Date(to) : now;

    const expenseLines = await this.prisma.journalLine.findMany({
      where: {
        journalEntry: {
          tenantId,
          status: "POSTED",
          date: { gte: fromDate, lte: toDate },
        },
        glAccount: { type: "EXPENSE" as any },
      },
      include: {
        glAccount: { select: { group: true, name: true } },
      },
    });

    // Group by GL account group
    const categoryMap = new Map<string, number>();
    for (const line of expenseLines) {
      const category = (line as any).glAccount.group ?? "Other Expenses";
      const amount = Number(line.debit) - Number(line.credit);
      categoryMap.set(category, (categoryMap.get(category) ?? 0) + amount);
    }

    const totalExpenses = Array.from(categoryMap.values()).reduce((s, v) => s + v, 0);

    const breakdown = Array.from(categoryMap.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: totalExpenses !== 0 ? Math.round((amount / totalExpenses) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    return breakdown;
  }

  // ── Recent Transactions ──────────────

  async getRecentTransactions(tenantId: string) {
    const entries = await this.prisma.journalEntry.findMany({
      where: { tenantId, status: "POSTED" },
      include: {
        lines: {
          include: {
            glAccount: { select: { code: true, name: true, type: true } },
          },
        },
        createdBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { date: "desc" },
      take: 20,
    });

    return entries.map(entry => ({
      id: entry.id,
      entryNumber: entry.entryNumber,
      date: entry.date,
      description: entry.description,
      reference: entry.reference,
      createdBy: `${(entry as any).createdBy.firstName} ${(entry as any).createdBy.lastName}`.trim(),
      lines: entry.lines.map(line => ({
        account: `${(line as any).glAccount.code} - ${(line as any).glAccount.name}`,
        accountType: (line as any).glAccount.type,
        debit: Number(line.debit),
        credit: Number(line.credit),
        description: line.description,
      })),
      totalDebit: entry.lines.reduce((s, l) => s + Number(l.debit), 0),
      totalCredit: entry.lines.reduce((s, l) => s + Number(l.credit), 0),
    }));
  }

  // ── AI Insights Panel (Rule-Based) ──────────────

  async getAIInsights(tenantId: string) {
    const insights: Array<{ type: "warning" | "info" | "success"; title: string; description: string }> = [];

    // Get revenue trend
    const trend = await this.getRevenueTrend(tenantId);
    if (trend.length >= 2) {
      const current = trend[trend.length - 1]!;
      const previous = trend[trend.length - 2]!;

      if (current.revenue > previous.revenue) {
        const pctChange = previous.revenue !== 0
          ? Math.round(((current.revenue - previous.revenue) / previous.revenue) * 100)
          : 100;
        insights.push({
          type: "success",
          title: "Revenue Growing",
          description: `Revenue is up ${pctChange}% compared to last month (${previous.month}).`,
        });
      } else if (current.revenue < previous.revenue && previous.revenue > 0) {
        const pctChange = Math.round(
          ((previous.revenue - current.revenue) / previous.revenue) * 100,
        );
        insights.push({
          type: "warning",
          title: "Revenue Declining",
          description: `Revenue is down ${pctChange}% compared to last month (${previous.month}). Review pricing or volume.`,
        });
      }
    }

    // Expense anomaly detection: any category > 20% above 6-month average
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [historicalBreakdown, currentBreakdown] = await Promise.all([
      this.getExpenseBreakdown(tenantId, sixMonthsAgo.toISOString(), currentMonthStart.toISOString()),
      this.getExpenseBreakdown(tenantId, currentMonthStart.toISOString(), now.toISOString()),
    ]);

    // Monthly average per category from historical
    const historicalAvg = new Map<string, number>();
    for (const item of historicalBreakdown) {
      historicalAvg.set(item.category, item.amount / 6);
    }

    for (const item of currentBreakdown) {
      const avg = historicalAvg.get(item.category) ?? 0;
      if (avg > 0 && item.amount > avg * 1.2) {
        const pctAbove = Math.round(((item.amount - avg) / avg) * 100);
        insights.push({
          type: "warning",
          title: `High ${item.category} Spending`,
          description: `${item.category} expenses are ${pctAbove}% above the 6-month average this month.`,
        });
      }
    }

    // Outstanding receivables aging warning
    const overdueInvoices = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] as any },
        dueDate: { lt: now },
      },
      select: { total: true, amountPaid: true, dueDate: true },
    });

    if (overdueInvoices.length > 0) {
      const totalOverdue = overdueInvoices.reduce(
        (s, inv) => s + (Number(inv.total) - Number(inv.amountPaid)),
        0,
      );
      const oldestDue = overdueInvoices.reduce(
        (oldest, inv) => (inv.dueDate && inv.dueDate < oldest ? inv.dueDate : oldest),
        now,
      );
      const daysPastDue = Math.floor(
        (now.getTime() - oldestDue.getTime()) / (1000 * 60 * 60 * 24),
      );

      insights.push({
        type: "warning",
        title: `${overdueInvoices.length} Overdue Invoice(s)`,
        description: `Total overdue amount: INR ${totalOverdue.toLocaleString()}. Oldest is ${daysPastDue} days past due.`,
      });
    }

    // Cash flow projection: simple estimate based on current month run rate
    if (trend.length >= 1) {
      const currentMonth = trend[trend.length - 1]!;
      const dayOfMonth = now.getDate();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const projectedRevenue = dayOfMonth > 0 ? (currentMonth.revenue / dayOfMonth) * daysInMonth : 0;
      const projectedExpenses = dayOfMonth > 0 ? (currentMonth.expenses / dayOfMonth) * daysInMonth : 0;
      const projectedProfit = projectedRevenue - projectedExpenses;

      if (projectedProfit > 0) {
        insights.push({
          type: "info",
          title: "Month-End Projection",
          description: `Projected net income: INR ${Math.round(projectedProfit).toLocaleString()} based on current run rate.`,
        });
      } else if (projectedProfit < 0) {
        insights.push({
          type: "warning",
          title: "Projected Net Loss",
          description: `At the current run rate, the month may end with a net loss of INR ${Math.round(Math.abs(projectedProfit)).toLocaleString()}.`,
        });
      }
    }

    // Success insight if no warnings
    if (insights.filter(i => i.type === "warning").length === 0) {
      insights.push({
        type: "success",
        title: "Financials Look Healthy",
        description: "No anomalies detected. All expense categories are within normal ranges.",
      });
    }

    return insights;
  }
}
