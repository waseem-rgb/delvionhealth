"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  IndianRupee,
  Wallet,
  ShoppingCart,
  Building2,
  Stethoscope,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import api from "@/lib/api";
import { format, subDays } from "date-fns";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface AnalyticsReport {
  period: { from: string; to: string };
  revenue: {
    total: number;
    collected: number;
    outstanding: number;
    byDay: Array<{ date: string; invoiced: number; collected: number }>;
    byTestCategory: Array<{ category: string; revenue: number }>;
    avgOrderValue: number;
    vsLastPeriod: { total: number; percentChange: number };
  };
  operations: {
    totalOrders: number;
    byStatus: Array<{ status: string; count: number }>;
    avgTAT: number;
    sampleRejectionRate: number;
    topTests: Array<{ name: string; count: number; category: string }>;
  };
  patients: {
    newPatients: number;
    returningPatients: number;
    retentionRate: number;
    byGender: Array<{ gender: string; count: number }>;
    byAgeGroup: Array<{ group: string; count: number }>;
  };
  crm: {
    topDoctors: Array<{ name: string; specialty: string; referrals: number; revenue: number }>;
    leadConversionRate: number;
    bySource: Array<{ source: string; count: number; wonCount: number }>;
    newLeadsCount: number;
    avgDealValue: number;
  };
  billing: {
    collectionRate: number;
    overdueAmount: number;
    byPaymentMethod: Array<{ method: string; amount: number; count: number }>;
    insuranceClaimApprovalRate: number;
  };
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const RANGES = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "1Y", days: 365 },
] as const;

const BAR_COLORS = [
  "#1B4F8A", "#0D9488", "#8B5CF6", "#F59E0B",
  "#EF4444", "#EC4899", "#22c55e", "#06b6d4",
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function fmt(v: number): string {
  if (v >= 10000000) return `\u20B9${(v / 10000000).toFixed(1)}Cr`;
  if (v >= 100000) return `\u20B9${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `\u20B9${(v / 1000).toFixed(0)}K`;
  return `\u20B9${v.toFixed(0)}`;
}

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function safe(report: AnalyticsReport | null): AnalyticsReport {
  const empty: AnalyticsReport = {
    period: { from: "", to: "" },
    revenue: {
      total: 0,
      collected: 0,
      outstanding: 0,
      byDay: [],
      byTestCategory: [],
      avgOrderValue: 0,
      vsLastPeriod: { total: 0, percentChange: 0 },
    },
    operations: { totalOrders: 0, byStatus: [], avgTAT: 0, sampleRejectionRate: 0, topTests: [] },
    patients: { newPatients: 0, returningPatients: 0, retentionRate: 0, byGender: [], byAgeGroup: [] },
    crm: { topDoctors: [], leadConversionRate: 0, bySource: [], newLeadsCount: 0, avgDealValue: 0 },
    billing: { collectionRate: 0, overdueAmount: 0, byPaymentMethod: [], insuranceClaimApprovalRate: 0 },
  };
  if (!report) return empty;
  return {
    ...empty,
    ...report,
    revenue: { ...empty.revenue, ...report.revenue },
    operations: { ...empty.operations, ...report.operations },
    patients: { ...empty.patients, ...report.patients },
    crm: { ...empty.crm, ...report.crm },
    billing: { ...empty.billing, ...report.billing },
  };
}

/* ------------------------------------------------------------------ */
/*  KPI Card                                                           */
/* ------------------------------------------------------------------ */

function KpiCard({
  label,
  value,
  growth,
  icon: Icon,
  iconBg = "bg-blue-50",
  iconColor = "text-blue-600",
}: {
  label: string;
  value: string;
  growth?: number;
  icon: React.ElementType;
  iconBg?: string;
  iconColor?: string;
}) {
  const hasGrowth = growth !== undefined && growth !== null;
  const isPositive = hasGrowth && growth >= 0;
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
          {label}
        </div>
        <div className={`w-8 h-8 ${iconBg} rounded-lg flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
      </div>
      <div className="text-xl font-bold text-slate-900">{value}</div>
      {hasGrowth && (
        <div
          className={`flex items-center gap-1 text-xs mt-1 font-medium ${
            isPositive ? "text-green-600" : "text-red-500"
          }`}
        >
          {isPositive ? (
            <ArrowUpRight className="w-3 h-3" />
          ) : (
            <ArrowDownRight className="w-3 h-3" />
          )}
          {Math.abs(growth).toFixed(1)}% vs prev period
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section Card                                                       */
/* ------------------------------------------------------------------ */

function Card({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-xl border border-slate-100 shadow-sm p-5 ${className}`}>
      <div className="mb-4">
        <h3 className="font-semibold text-slate-800">{title}</h3>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Aggregate helpers                                                   */
/* ------------------------------------------------------------------ */

/** Group daily revenue data into monthly buckets for the trend chart */
function aggregateMonthly(
  byDay: Array<{ date: string; invoiced: number; collected: number }>
): Array<{ month: string; invoiced: number; collected: number }> {
  const map = new Map<string, { invoiced: number; collected: number }>();
  for (const d of byDay) {
    const month = d.date.slice(0, 7); // "YYYY-MM"
    const entry = map.get(month) ?? { invoiced: 0, collected: 0 };
    entry.invoiced += d.invoiced;
    entry.collected += d.collected;
    map.set(month, entry);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, vals]) => ({
      month: format(new Date(month + "-01"), "MMM yy"),
      ...vals,
    }));
}

/** Build a pseudo-organization revenue table from top doctors (grouped by clinic/specialty) */
function buildOrgRevenue(
  topDoctors: Array<{ name: string; specialty: string; referrals: number; revenue: number }>
): Array<{ organization: string; doctors: number; referrals: number; revenue: number }> {
  const orgMap = new Map<
    string,
    { doctors: number; referrals: number; revenue: number }
  >();
  for (const doc of topDoctors) {
    const org = doc.specialty || "General";
    const entry = orgMap.get(org) ?? { doctors: 0, referrals: 0, revenue: 0 };
    entry.doctors += 1;
    entry.referrals += doc.referrals;
    entry.revenue += doc.revenue;
    orgMap.set(org, entry);
  }
  return Array.from(orgMap.entries())
    .map(([organization, vals]) => ({ organization, ...vals }))
    .sort((a, b) => b.revenue - a.revenue);
}

/* ------------------------------------------------------------------ */
/*  Loading Skeleton                                                   */
/* ------------------------------------------------------------------ */

function LoadingSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-100 p-5 animate-pulse">
            <div className="h-3 w-24 bg-slate-200 rounded mb-3" />
            <div className="h-7 w-20 bg-slate-200 rounded mb-2" />
            <div className="h-3 w-28 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-100 p-5 h-72 animate-pulse">
            <div className="h-4 w-40 bg-slate-200 rounded mb-4" />
            <div className="h-52 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function RevenueCrmDashboardPage() {
  const [rangeDays, setRangeDays] = useState(90);
  const dateFrom = format(subDays(new Date(), rangeDays), "yyyy-MM-dd");
  const dateTo = format(new Date(), "yyyy-MM-dd");

  const { data: rawData, isLoading } = useQuery({
    queryKey: ["crm-revenue", rangeDays],
    queryFn: async () => {
      const res = await api.get(
        `/analytics/full-report?dateFrom=${dateFrom}&dateTo=${dateTo}`
      );
      return (res.data?.data ?? res.data) as AnalyticsReport;
    },
    staleTime: 5 * 60 * 1000,
  });

  const r = safe(rawData ?? null);

  /* derived data */
  const monthlyTrend = aggregateMonthly(r.revenue.byDay);
  const orgRevenue = buildOrgRevenue(r.crm.topDoctors);
  const topDocs = [...r.crm.topDoctors].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  const categoryData = [...r.revenue.byTestCategory].sort((a, b) => b.revenue - a.revenue);

  const totalFromDoctors = topDocs.reduce((s, d) => s + d.revenue, 0);

  /* current-month revenue estimate (sum of byDay entries in the current month) */
  const now = new Date();
  const thisMonthPrefix = format(now, "yyyy-MM");
  const revenueThisMonth = r.revenue.byDay
    .filter((d) => d.date.startsWith(thisMonthPrefix))
    .reduce((s, d) => s + d.invoiced, 0);

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Revenue CRM Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {format(subDays(new Date(), rangeDays), "dd MMM yyyy")} &mdash;{" "}
            {format(new Date(), "dd MMM yyyy")}
          </p>
        </div>
        <div className="flex bg-slate-100 rounded-lg p-1 gap-0.5">
          {RANGES.map((range) => (
            <button
              key={range.label}
              onClick={() => setRangeDays(range.days)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                rangeDays === range.days
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <>
          {/* ── KPI Row ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              label="Total Revenue"
              value={fmt(r.revenue.total)}
              growth={r.revenue.vsLastPeriod.percentChange}
              icon={IndianRupee}
              iconBg="bg-emerald-50"
              iconColor="text-emerald-600"
            />
            <KpiCard
              label="Revenue This Month"
              value={fmt(revenueThisMonth)}
              icon={Calendar}
              iconBg="bg-blue-50"
              iconColor="text-blue-600"
            />
            <KpiCard
              label="Outstanding"
              value={fmt(r.revenue.outstanding)}
              icon={Wallet}
              iconBg="bg-amber-50"
              iconColor="text-amber-600"
            />
            <KpiCard
              label="Avg Order Value"
              value={fmt(r.revenue.avgOrderValue)}
              icon={ShoppingCart}
              iconBg="bg-violet-50"
              iconColor="text-violet-600"
            />
          </div>

          {/* ── Revenue Trend (Area Chart) ── */}
          <Card
            title="Revenue Trend"
            subtitle={
              monthlyTrend.length > 0
                ? `${monthlyTrend[0].month} \u2014 ${monthlyTrend[monthlyTrend.length - 1].month}`
                : "Monthly invoiced vs collected"
            }
          >
            {monthlyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={monthlyTrend}>
                  <defs>
                    <linearGradient id="crmRevInvGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1B4F8A" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#1B4F8A" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="crmRevColGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0D9488" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#0D9488" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => fmt(v)}
                  />
                  <Tooltip
                    formatter={(v: number, name: string) => [
                      fmt(v),
                      name === "invoiced" ? "Invoiced" : "Collected",
                    ]}
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="invoiced"
                    stroke="#1B4F8A"
                    strokeWidth={2}
                    fill="url(#crmRevInvGrad)"
                    name="invoiced"
                  />
                  <Area
                    type="monotone"
                    dataKey="collected"
                    stroke="#0D9488"
                    strokeWidth={2}
                    fill="url(#crmRevColGrad)"
                    name="collected"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-48 text-sm text-slate-400">
                No revenue data for the selected period
              </div>
            )}
          </Card>

          {/* ── Revenue by Organization / Corporate + Top Doctors ── */}
          <div className="grid lg:grid-cols-2 gap-4">
            {/* Revenue by Organization */}
            <Card title="Revenue by Organization / Specialty" subtitle="Grouped by referring doctor specialty">
              {orgRevenue.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left py-2 px-2 font-medium text-slate-500 text-xs">
                          Organization / Specialty
                        </th>
                        <th className="text-right py-2 px-2 font-medium text-slate-500 text-xs">
                          Doctors
                        </th>
                        <th className="text-right py-2 px-2 font-medium text-slate-500 text-xs">
                          Referrals
                        </th>
                        <th className="text-right py-2 px-2 font-medium text-slate-500 text-xs">
                          Revenue
                        </th>
                        <th className="text-right py-2 px-2 font-medium text-slate-500 text-xs w-28">
                          Share
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {orgRevenue.map((org) => {
                        const share =
                          r.revenue.total > 0
                            ? (org.revenue / r.revenue.total) * 100
                            : 0;
                        return (
                          <tr
                            key={org.organization}
                            className="border-b border-slate-50 hover:bg-slate-50"
                          >
                            <td className="py-2.5 px-2">
                              <div className="flex items-center gap-2">
                                <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                <span className="text-slate-800 font-medium">
                                  {org.organization}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-2 text-right text-slate-600">
                              {org.doctors}
                            </td>
                            <td className="py-2.5 px-2 text-right text-slate-600">
                              {org.referrals}
                            </td>
                            <td className="py-2.5 px-2 text-right font-semibold text-slate-900">
                              {fmt(org.revenue)}
                            </td>
                            <td className="py-2.5 px-2">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-blue-500 rounded-full"
                                    style={{ width: `${Math.min(share, 100)}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-slate-500 w-8 text-right">
                                  {pct(share)}
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex items-center justify-center h-32 text-sm text-slate-400">
                  No organization data available
                </div>
              )}
            </Card>

            {/* Top Referring Doctors */}
            <Card
              title="Top Referring Doctors"
              subtitle={
                totalFromDoctors > 0
                  ? `Combined revenue: ${fmt(totalFromDoctors)}`
                  : "Revenue contribution by doctor"
              }
            >
              {topDocs.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left py-2 px-2 font-medium text-slate-500 text-xs">
                          #
                        </th>
                        <th className="text-left py-2 px-2 font-medium text-slate-500 text-xs">
                          Doctor
                        </th>
                        <th className="text-left py-2 px-2 font-medium text-slate-500 text-xs">
                          Specialty
                        </th>
                        <th className="text-right py-2 px-2 font-medium text-slate-500 text-xs">
                          Referrals
                        </th>
                        <th className="text-right py-2 px-2 font-medium text-slate-500 text-xs">
                          Revenue
                        </th>
                        <th className="text-right py-2 px-2 font-medium text-slate-500 text-xs w-20">
                          Share
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {topDocs.map((doc, i) => {
                        const share =
                          totalFromDoctors > 0
                            ? (doc.revenue / totalFromDoctors) * 100
                            : 0;
                        return (
                          <tr
                            key={doc.name + i}
                            className="border-b border-slate-50 hover:bg-slate-50"
                          >
                            <td className="py-2.5 px-2 text-xs text-slate-400">{i + 1}</td>
                            <td className="py-2.5 px-2">
                              <div className="flex items-center gap-2">
                                <Stethoscope className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                <span className="text-slate-800 font-medium">{doc.name}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-2 text-slate-500">
                              {doc.specialty || "\u2014"}
                            </td>
                            <td className="py-2.5 px-2 text-right font-semibold text-[#1B4F8A]">
                              {doc.referrals}
                            </td>
                            <td className="py-2.5 px-2 text-right font-semibold text-slate-900">
                              {fmt(doc.revenue)}
                            </td>
                            <td className="py-2.5 px-2 text-right text-xs text-slate-500">
                              {pct(share)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex items-center justify-center h-32 text-sm text-slate-400">
                  No doctor referral data available
                </div>
              )}
            </Card>
          </div>

          {/* ── Revenue by Test Category (Bar Chart) + Collection Summary ── */}
          <div className="grid lg:grid-cols-3 gap-4">
            <Card title="Revenue by Test Category" className="lg:col-span-2">
              {categoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={categoryData} layout="vertical" margin={{ left: 8 }}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#f1f5f9"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => fmt(v)}
                    />
                    <YAxis
                      type="category"
                      dataKey="category"
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      tickLine={false}
                      axisLine={false}
                      width={110}
                    />
                    <Tooltip
                      formatter={(v: number) => [fmt(v), "Revenue"]}
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid #e2e8f0",
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                      {categoryData.map((_, i) => (
                        <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-48 text-sm text-slate-400">
                  No category revenue data
                </div>
              )}
            </Card>

            {/* Collection summary sidebar */}
            <div className="space-y-4">
              <Card title="Collection Rate">
                <div className="space-y-3">
                  <div className="text-3xl font-bold text-slate-900">
                    {pct(r.billing.collectionRate)}
                  </div>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{
                        width: `${Math.min(r.billing.collectionRate, 100)}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Collected: {fmt(r.revenue.collected)}</span>
                    <span>Outstanding: {fmt(r.revenue.outstanding)}</span>
                  </div>
                </div>
              </Card>

              <Card title="Payment Methods">
                <div className="space-y-2.5">
                  {r.billing.byPaymentMethod.map((m, i) => {
                    const totalPayments = r.billing.byPaymentMethod.reduce(
                      (s, p) => s + p.amount,
                      0
                    );
                    const share =
                      totalPayments > 0 ? (m.amount / totalPayments) * 100 : 0;
                    return (
                      <div key={m.method} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ background: BAR_COLORS[i % BAR_COLORS.length] }}
                            />
                            <span className="text-sm text-slate-700">{m.method}</span>
                          </div>
                          <span className="text-sm font-semibold text-slate-900">
                            {fmt(m.amount)}
                          </span>
                        </div>
                        <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${share}%`,
                              background: BAR_COLORS[i % BAR_COLORS.length],
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {r.billing.byPaymentMethod.length === 0 && (
                    <p className="text-sm text-slate-400">No payment data</p>
                  )}
                </div>
              </Card>
            </div>
          </div>

          {/* ── Bottom summary strip ── */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
              {[
                { label: "Total Invoiced", value: fmt(r.revenue.total), color: "text-slate-900" },
                { label: "Total Collected", value: fmt(r.revenue.collected), color: "text-green-600" },
                { label: "Outstanding", value: fmt(r.revenue.outstanding), color: "text-amber-600" },
                { label: "Overdue", value: fmt(r.billing.overdueAmount), color: "text-red-500" },
                {
                  label: "Insurance Approval",
                  value: pct(r.billing.insuranceClaimApprovalRate),
                  color: "text-blue-600",
                },
              ].map((item) => (
                <div key={item.label}>
                  <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wide mb-1">
                    {item.label}
                  </div>
                  <div className={`text-lg font-bold ${item.color}`}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
