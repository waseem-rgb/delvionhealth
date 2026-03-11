"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Wallet,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Truck,
  BookOpenCheck,
  Coins,
  BarChart3,
  RefreshCw,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import api from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────

interface KPIData {
  revenueThisMonth: number;
  revenueLastMonth: number;
  revenueTrend: number;
  expensesThisMonth: number;
  outstandingReceivables: number;
  outstandingPayables: number;
  cashBalance: number;
  collectionRate: number;
  pendingPayroll: number;
}

interface TrendMonth {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

interface Insight {
  type: "warning" | "success" | "info";
  title: string;
  description: string;
}

// ── Sub-module cards ────────────────────────────────────────────────────────

const MODULES = [
  {
    label: "Receivables",
    desc: "Invoices, payments & aging report",
    href: "/finance/receivables",
    icon: Coins,
    color: "text-teal-400",
    bg: "bg-teal-500/10",
    border: "border-teal-500/20",
  },
  {
    label: "Accounting",
    desc: "GL accounts, journals & bank statements",
    href: "/finance/accounting",
    icon: BookOpenCheck,
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/20",
  },
  {
    label: "Procurement",
    desc: "Vendors, purchase orders & 3-way match",
    href: "/finance/procurement",
    icon: Truck,
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
  },
  {
    label: "Statutory & Payroll",
    desc: "PF, ESI, TDS & payroll runs",
    href: "/finance/statutory",
    icon: ShieldCheck,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/20",
  },
];

// ── KPI Card ───────────────────────────────────────────────────────────────

function KPICard({
  label,
  value,
  trend,
  icon: Icon,
  sub,
}: {
  label: string;
  value: string;
  trend?: number;
  icon: React.ElementType;
  sub?: string;
}) {
  const isUp = (trend ?? 0) >= 0;
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <span className="text-slate-400 text-xs">{label}</span>
        <Icon className="h-4 w-4 text-slate-500" />
      </div>
      <p className="text-xl font-semibold text-white">{value}</p>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 mt-2 text-xs ${isUp ? "text-emerald-400" : "text-red-400"}`}>
          {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          <span>{Math.abs(trend).toFixed(1)}% vs last month</span>
        </div>
      )}
      {sub && trend === undefined && <p className="text-xs text-slate-500 mt-2">{sub}</p>}
    </div>
  );
}

// ── Mini bar chart ─────────────────────────────────────────────────────────

function MiniChart({ data }: { data: TrendMonth[] }) {
  const maxVal = Math.max(...data.map((d) => Math.max(d.revenue, d.expenses)), 1);
  return (
    <div className="space-y-3">
      {data.slice(-6).map((d) => (
        <div key={d.month} className="grid grid-cols-[64px_1fr] gap-3 items-center">
          <span className="text-xs text-slate-500 text-right truncate">{d.month.split(" ")[0]}</span>
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <div
                className="h-2.5 rounded-sm bg-teal-500"
                style={{ width: `${Math.max((d.revenue / maxVal) * 100, d.revenue > 0 ? 2 : 0)}%` }}
              />
              {d.revenue > 0 && <span className="text-[10px] text-slate-500">{formatCurrency(d.revenue)}</span>}
            </div>
            <div className="flex items-center gap-1">
              <div
                className="h-2.5 rounded-sm bg-orange-500"
                style={{ width: `${Math.max((d.expenses / maxVal) * 100, d.expenses > 0 ? 2 : 0)}%` }}
              />
              {d.expenses > 0 && <span className="text-[10px] text-slate-500">{formatCurrency(d.expenses)}</span>}
            </div>
            {d.revenue === 0 && d.expenses === 0 && (
              <span className="text-[10px] text-slate-700">no data</span>
            )}
          </div>
        </div>
      ))}
      <div className="flex gap-4 pt-1 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-teal-500" />Revenue
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-orange-500" />Expenses
        </span>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function FinanceOverviewPage() {
  const { data: kpiRaw, isLoading: kpiLoading, refetch } = useQuery({
    queryKey: ["finance-kpis"],
    queryFn: () =>
      api.get("/finance/dashboard/kpis").then((r) => r.data?.data ?? r.data),
    staleTime: 60_000,
  });

  const { data: trendRaw, isLoading: trendLoading } = useQuery({
    queryKey: ["finance-revenue-trend"],
    queryFn: () =>
      api.get("/finance/dashboard/revenue-trend").then((r) => r.data?.data ?? r.data),
    staleTime: 60_000,
  });

  const { data: insightsRaw } = useQuery({
    queryKey: ["finance-insights"],
    queryFn: () =>
      api.get("/finance/dashboard/insights").then((r) => r.data?.data ?? r.data),
    staleTime: 120_000,
  });

  const kpi = kpiRaw as KPIData | undefined;
  const trend = trendRaw as TrendMonth[] | undefined;
  const insights = insightsRaw as Insight[] | undefined;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Finance Overview</h1>
          <p className="text-slate-400 text-sm mt-1">Real-time financial health of your lab</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg border border-slate-700 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpiLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-5 animate-pulse h-28" />
            ))
          : [
              { label: "Revenue This Month", value: formatCurrency(kpi?.revenueThisMonth ?? 0), trend: kpi?.revenueTrend, icon: TrendingUp },
              { label: "Expenses This Month", value: formatCurrency(kpi?.expensesThisMonth ?? 0), icon: TrendingDown, sub: "Current month" },
              { label: "Outstanding Receivables", value: formatCurrency(kpi?.outstandingReceivables ?? 0), icon: DollarSign, sub: "Unpaid invoices" },
              { label: "Outstanding Payables", value: formatCurrency(kpi?.outstandingPayables ?? 0), icon: CreditCard, sub: "Vendor bills due" },
              { label: "Cash Balance", value: formatCurrency(kpi?.cashBalance ?? 0), icon: Wallet, sub: "Across bank accounts" },
              { label: "Collection Rate", value: `${(kpi?.collectionRate ?? 0).toFixed(1)}%`, icon: BarChart3, sub: "Invoices collected" },
            ].map((c) => (
              <KPICard key={c.label} {...c} />
            ))}
      </div>

      {/* Module cards + Revenue trend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Module navigation */}
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {MODULES.map((mod) => (
              <Link
                key={mod.href}
                href={mod.href}
                className={`group flex items-start gap-4 p-5 bg-slate-900 border ${mod.border} rounded-xl hover:bg-slate-800 transition-colors`}
              >
                <div className={`${mod.bg} rounded-lg p-2.5 shrink-0`}>
                  <mod.icon className={`h-5 w-5 ${mod.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm">{mod.label}</p>
                  <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">{mod.desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-slate-300 shrink-0 mt-0.5 transition-colors" />
              </Link>
            ))}
          </div>

          {/* Payroll alert */}
          {kpi && kpi.pendingPayroll > 0 && (
            <Link
              href="/finance/statutory"
              className="flex items-center gap-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl hover:bg-amber-500/15 transition-colors"
            >
              <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
              <div className="flex-1">
                <p className="text-amber-300 text-sm font-medium">Pending Payroll Processing</p>
                <p className="text-amber-400/70 text-xs mt-0.5">
                  {formatCurrency(kpi.pendingPayroll)} pending — go to Statutory &amp; Payroll to run
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-amber-500 shrink-0" />
            </Link>
          )}
        </div>

        {/* Revenue vs Expenses */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-5">
            <p className="text-white font-medium text-sm">Revenue vs Expenses</p>
            <span className="text-xs text-slate-500">Last 6 months</span>
          </div>
          {trendLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-6 bg-slate-800 animate-pulse rounded" />
              ))}
            </div>
          ) : trend && trend.length > 0 ? (
            <MiniChart data={trend} />
          ) : (
            <p className="text-slate-600 text-sm text-center py-8">No trend data yet</p>
          )}
        </div>
      </div>

      {/* AI Insights */}
      {insights && insights.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="h-4 w-4 text-teal-400" />
            <p className="text-white font-medium text-sm">AI Financial Insights</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {insights.map((ins, i) => (
              <div
                key={i}
                className={`flex gap-3 p-3 rounded-lg border text-sm ${
                  ins.type === "warning"
                    ? "bg-amber-500/10 border-amber-500/20"
                    : ins.type === "success"
                    ? "bg-emerald-500/10 border-emerald-500/20"
                    : "bg-blue-500/10 border-blue-500/20"
                }`}
              >
                {ins.type === "warning" ? (
                  <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                ) : ins.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <Lightbulb className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="text-white font-medium text-xs">{ins.title}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{ins.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick links to advanced tools */}
      <div>
        <p className="text-xs text-slate-500 mb-3 uppercase tracking-wide">Advanced Tools</p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Chart of Accounts", href: "/finance/accounting", icon: BookOpenCheck },
            { label: "Journal Entries", href: "/finance/accounting", icon: Receipt },
            { label: "Trial Balance", href: "/finance/accounting", icon: BarChart3 },
            { label: "P&L Statement", href: "/finance/reports", icon: TrendingUp },
            { label: "Balance Sheet", href: "/finance/reports", icon: DollarSign },
            { label: "Bank Reconciliation", href: "/finance/reconciliation", icon: CreditCard },
          ].map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg border border-slate-700 transition-colors"
            >
              <link.icon className="h-3.5 w-3.5" />
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
