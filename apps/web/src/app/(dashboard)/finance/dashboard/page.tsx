"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Wallet,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  BarChart3,
  Calendar,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import api from "@/lib/api";

// ── Types ───────────────────────────────────────────────────────────────────

interface KPIData {
  revenue: number;
  revenueTrend: number;
  expenses: number;
  expensesTrend: number;
  netIncome: number;
  netIncomeTrend: number;
  outstandingReceivables: number;
  receivablesTrend: number;
  outstandingPayables: number;
  payablesTrend: number;
  cashBalance: number;
  cashTrend: number;
}

interface RevenueTrendItem {
  month: string;
  revenue: number;
  expenses: number;
}

interface ExpenseCategory {
  category: string;
  amount: number;
  percentage: number;
}

interface RecentTransaction {
  id: string;
  reference: string;
  description: string;
  date: string;
  totalDebit: number;
  status: string;
  type: string;
}

interface Insight {
  id: string;
  type: "info" | "warning" | "success";
  title: string;
  description: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function unwrap<T>(res: any): T {
  return res.data?.data ?? res.data;
}

const STATUS_COLORS: Record<string, string> = {
  POSTED: "bg-emerald-900/60 text-emerald-300",
  DRAFT: "bg-slate-700 text-slate-300",
  REVERSED: "bg-red-900/60 text-red-300",
  PENDING: "bg-yellow-900/60 text-yellow-300",
};

const INSIGHT_ICONS = {
  info: Lightbulb,
  warning: AlertTriangle,
  success: CheckCircle2,
};

const INSIGHT_COLORS = {
  info: "text-blue-400 bg-blue-900/30 border-blue-800/50",
  warning: "text-amber-400 bg-amber-900/30 border-amber-800/50",
  success: "text-emerald-400 bg-emerald-900/30 border-emerald-800/50",
};

const BAR_COLORS = [
  "bg-teal-500",
  "bg-blue-500",
  "bg-purple-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-lime-500",
  "bg-indigo-500",
];

// ── Component ───────────────────────────────────────────────────────────────

export default function FinanceDashboardPage() {
  const { data: kpis, isLoading: kpisLoading } = useQuery<KPIData>({
    queryKey: ["finance-dashboard-kpis"],
    queryFn: async () => unwrap(await api.get("/api/v1/finance/dashboard/kpis")),
  });

  const { data: revenueTrend, isLoading: trendLoading } = useQuery<RevenueTrendItem[]>({
    queryKey: ["finance-dashboard-revenue-trend"],
    queryFn: async () => unwrap(await api.get("/api/v1/finance/dashboard/revenue-trend")),
  });

  const { data: expenseBreakdown } = useQuery<ExpenseCategory[]>({
    queryKey: ["finance-dashboard-expense-breakdown"],
    queryFn: async () => unwrap(await api.get("/api/v1/finance/dashboard/expense-breakdown")),
  });

  const { data: recentTxns } = useQuery<RecentTransaction[]>({
    queryKey: ["finance-dashboard-recent-transactions"],
    queryFn: async () => unwrap(await api.get("/api/v1/finance/dashboard/recent-transactions")),
  });

  const { data: insights } = useQuery<Insight[]>({
    queryKey: ["finance-dashboard-insights"],
    queryFn: async () => unwrap(await api.get("/api/v1/finance/dashboard/insights")),
  });

  const trendData = Array.isArray(revenueTrend) ? revenueTrend : [];
  const expenseData = Array.isArray(expenseBreakdown) ? expenseBreakdown : [];
  const txnData = Array.isArray(recentTxns) ? recentTxns : [];
  const insightData = Array.isArray(insights) ? insights : [];

  // Calculate max for revenue chart bar scaling
  const maxChartValue = trendData.length > 0
    ? Math.max(...trendData.flatMap((d) => [d.revenue, d.expenses]), 1)
    : 1;

  // Calculate max for expense breakdown
  const maxExpense = expenseData.length > 0
    ? Math.max(...expenseData.map((e) => e.amount), 1)
    : 1;

  // ── KPI cards config ──────────────────────────────────────────────────────

  const kpiCards = [
    {
      title: "Revenue (This Month)",
      value: kpis ? formatCurrency(kpis.revenue) : "--",
      trend: kpis?.revenueTrend ?? 0,
      icon: DollarSign,
      color: "text-teal-400",
    },
    {
      title: "Expenses",
      value: kpis ? formatCurrency(kpis.expenses) : "--",
      trend: kpis?.expensesTrend ?? 0,
      icon: Receipt,
      color: "text-rose-400",
    },
    {
      title: "Net Income",
      value: kpis ? formatCurrency(kpis.netIncome) : "--",
      trend: kpis?.netIncomeTrend ?? 0,
      icon: TrendingUp,
      color: "text-emerald-400",
    },
    {
      title: "Outstanding Receivables",
      value: kpis ? formatCurrency(kpis.outstandingReceivables) : "--",
      trend: kpis?.receivablesTrend ?? 0,
      icon: ArrowUpRight,
      color: "text-blue-400",
    },
    {
      title: "Outstanding Payables",
      value: kpis ? formatCurrency(kpis.outstandingPayables) : "--",
      trend: kpis?.payablesTrend ?? 0,
      icon: ArrowDownRight,
      color: "text-amber-400",
    },
    {
      title: "Cash Balance",
      value: kpis ? formatCurrency(kpis.cashBalance) : "--",
      trend: kpis?.cashTrend ?? 0,
      icon: Wallet,
      color: "text-cyan-400",
    },
  ];

  // ── Loading state ─────────────────────────────────────────────────────────

  if (kpisLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 w-72 bg-slate-800 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-32 bg-slate-900 border border-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="h-80 bg-slate-900 border border-slate-800 rounded-xl animate-pulse" />
          <div className="h-80 bg-slate-900 border border-slate-800 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 bg-slate-950 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-teal-400" />
            Finance Dashboard
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time financial overview and insights
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Calendar className="w-4 h-4" />
          {new Date().toLocaleDateString("en-IN", {
            month: "long",
            year: "numeric",
          })}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpiCards.map((card) => {
          const isPositive = card.trend >= 0;
          return (
            <div
              key={card.title}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-slate-800">
                    <card.icon className={`w-5 h-5 ${card.color}`} />
                  </div>
                  <span className="text-sm text-slate-400">{card.title}</span>
                </div>
                <div
                  className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                    isPositive
                      ? "bg-emerald-900/40 text-emerald-400"
                      : "bg-red-900/40 text-red-400"
                  }`}
                >
                  {isPositive ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {Math.abs(card.trend).toFixed(1)}%
                </div>
              </div>
              <p className="text-2xl font-bold text-white">{card.value}</p>
              <p className="text-xs text-slate-500 mt-1">vs last month</p>
            </div>
          );
        })}
      </div>

      {/* Revenue vs Expenses Chart + Expense Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue vs Expenses Bar Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-1">Revenue vs Expenses</h2>
          <p className="text-xs text-slate-400 mb-5">Last 6 months comparison</p>

          {trendData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
              No trend data available
            </div>
          ) : (
            <div className="space-y-4">
              {trendData.map((item) => (
                <div key={item.month} className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="w-16 font-medium">{item.month}</span>
                    <span>
                      {formatCurrency(item.revenue)} / {formatCurrency(item.expenses)}
                    </span>
                  </div>
                  {/* Revenue bar */}
                  <div className="flex items-center gap-2">
                    <span className="w-16 text-[10px] text-teal-400 text-right">Rev</span>
                    <div className="flex-1 bg-slate-800 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full bg-teal-500 rounded-full transition-all duration-500"
                        style={{
                          width: `${(item.revenue / maxChartValue) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                  {/* Expenses bar */}
                  <div className="flex items-center gap-2">
                    <span className="w-16 text-[10px] text-rose-400 text-right">Exp</span>
                    <div className="flex-1 bg-slate-800 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full bg-rose-500 rounded-full transition-all duration-500"
                        style={{
                          width: `${(item.expenses / maxChartValue) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}

              {/* Legend */}
              <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-800">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <div className="w-3 h-3 rounded-full bg-teal-500" />
                  Revenue
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <div className="w-3 h-3 rounded-full bg-rose-500" />
                  Expenses
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Expense Breakdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-1">Expense Breakdown</h2>
          <p className="text-xs text-slate-400 mb-5">By category this month</p>

          {expenseData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
              No expense data available
            </div>
          ) : (
            <div className="space-y-3">
              {expenseData.map((cat, i) => (
                <div key={cat.category} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">{cat.category}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500">
                        {cat.percentage?.toFixed(1) ?? "0"}%
                      </span>
                      <span className="text-white font-medium">
                        {formatCurrency(cat.amount)}
                      </span>
                    </div>
                  </div>
                  <div className="bg-slate-800 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        BAR_COLORS[i % BAR_COLORS.length]
                      }`}
                      style={{
                        width: `${(cat.amount / maxExpense) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions + AI Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Recent Transactions</h2>
              <p className="text-xs text-slate-400">Last 10 journal entries</p>
            </div>
            <CreditCard className="w-5 h-5 text-slate-500" />
          </div>

          {txnData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
              No recent transactions
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="text-left py-3 px-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Reference
                    </th>
                    <th className="text-left py-3 px-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="text-left py-3 px-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="text-right py-3 px-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="text-center py-3 px-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {txnData.slice(0, 10).map((txn) => (
                    <tr
                      key={txn.id}
                      className="hover:bg-slate-800/40 transition"
                    >
                      <td className="py-3 px-2">
                        <span className="font-mono text-xs text-teal-400">
                          {txn.reference}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-slate-300 max-w-[200px] truncate">
                        {txn.description}
                      </td>
                      <td className="py-3 px-2 text-slate-400 text-xs">
                        {formatDate(txn.date)}
                      </td>
                      <td className="py-3 px-2 text-right text-white font-medium">
                        {formatCurrency(txn.totalDebit)}
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium uppercase ${
                            STATUS_COLORS[txn.status] ?? "bg-slate-700 text-slate-300"
                          }`}
                        >
                          {txn.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* AI Insights Panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">AI Insights</h2>
              <p className="text-xs text-slate-400">Smart recommendations</p>
            </div>
            <Lightbulb className="w-5 h-5 text-amber-400" />
          </div>

          {insightData.length === 0 ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-20 bg-slate-800 rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {insightData.map((insight) => {
                const InsightIcon = INSIGHT_ICONS[insight.type] ?? Lightbulb;
                const colorClass =
                  INSIGHT_COLORS[insight.type] ?? INSIGHT_COLORS.info;
                return (
                  <div
                    key={insight.id}
                    className={`p-3 rounded-lg border ${colorClass} transition hover:brightness-110`}
                  >
                    <div className="flex items-start gap-2.5">
                      <InsightIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-white">
                          {insight.title}
                        </p>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                          {insight.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
