"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Users,
  ClipboardList,
  FlaskConical,
  IndianRupee,
  Download,
  Calendar,
  Sparkles,
  RefreshCw,
  Building2,
  Stethoscope,
  TestTubes,
  BarChart3,
  Activity,
  Brain,
} from "lucide-react";
import api from "@/lib/api";
import { format, subDays } from "date-fns";

/* ─── Types (matches backend FullAnalyticsReport) ─── */

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

/* ─── Constants ─── */

const RANGES = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "1Y", days: 365 },
] as const;

const TABS = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "revenue", label: "Revenue", icon: IndianRupee },
  { id: "operations", label: "Operations", icon: Activity },
  { id: "tests", label: "Tests", icon: TestTubes },
  { id: "doctors", label: "Doctors & Orgs", icon: Stethoscope },
  { id: "patients", label: "Patients", icon: Users },
  { id: "ai", label: "Smart Insights", icon: Brain },
] as const;

type TabId = (typeof TABS)[number]["id"];

const PIE_COLORS = ["#1B4F8A", "#0D9488", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#22c55e", "#94a3b8"];

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#94a3b8", CONFIRMED: "#3b82f6", SAMPLE_COLLECTED: "#8b5cf6",
  IN_PROCESSING: "#f59e0b", RESULTED: "#0D7E8A", REPORTED: "#22c55e",
  COMPLETED: "#22c55e", CANCELLED: "#ef4444",
};

/* ─── Helpers ─── */

function fmt(v: number): string {
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(0)}K`;
  return `₹${v.toFixed(0)}`;
}

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function safe(report: AnalyticsReport | null): AnalyticsReport {
  const empty: AnalyticsReport = {
    period: { from: "", to: "" },
    revenue: { total: 0, collected: 0, outstanding: 0, byDay: [], byTestCategory: [], avgOrderValue: 0, vsLastPeriod: { total: 0, percentChange: 0 } },
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

/* ─── KPI Card ─── */

function KpiCard({ label, value, growth, icon: Icon, prefix = "", suffix = "", invertGrowth = false }: {
  label: string; value: number | string; growth?: number; icon: React.ElementType;
  prefix?: string; suffix?: string; invertGrowth?: boolean;
}) {
  const hasGrowth = growth !== undefined && growth !== null;
  const isPositive = hasGrowth && (invertGrowth ? growth < 0 : growth >= 0);
  const GrowthIcon = isPositive ? TrendingUp : TrendingDown;
  const displayValue = typeof value === "number"
    ? value >= 10000000 ? `${(value / 10000000).toFixed(1)}Cr`
      : value >= 100000 ? `${(value / 100000).toFixed(1)}L`
        : value >= 1000 ? `${(value / 1000).toFixed(1)}K`
          : String(value)
    : value;
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">{label}</div>
        <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
          <Icon className="w-4 h-4 text-blue-600" />
        </div>
      </div>
      <div className="text-xl font-bold text-slate-900">{prefix}{displayValue}{suffix}</div>
      {hasGrowth && (
        <div className={`flex items-center gap-1 text-xs mt-1 font-medium ${isPositive ? "text-green-600" : "text-red-500"}`}>
          <GrowthIcon className="w-3 h-3" />
          {Math.abs(growth).toFixed(1)}% vs prev period
        </div>
      )}
    </div>
  );
}

/* ─── Section Card ─── */

function Card({ title, subtitle, children, className = "" }: {
  title: string; subtitle?: string; children: React.ReactNode; className?: string;
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

/* ─── Tab: Overview ─── */

function OverviewTab({ r }: { r: AnalyticsReport }) {
  const statusData = r.operations.byStatus.map((s) => ({ name: s.status.replace(/_/g, " "), value: s.count }));
  const totalPatients = r.patients.newPatients + r.patients.returningPatients;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total Revenue" value={r.revenue.total} growth={r.revenue.vsLastPeriod.percentChange} icon={IndianRupee} prefix="₹" />
        <KpiCard label="Total Orders" value={r.operations.totalOrders} icon={ClipboardList} />
        <KpiCard label="Total Patients" value={totalPatients} icon={Users} />
        <KpiCard label="Avg TAT" value={`${r.operations.avgTAT}h`} icon={Calendar} />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Revenue Trend" subtitle={`Total: ${fmt(r.revenue.total)}`}>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={r.revenue.byDay}>
              <defs>
                <linearGradient id="aRevGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1B4F8A" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#1B4F8A" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmt(v)} />
              <Tooltip formatter={(v: number) => [fmt(v), "Invoiced"]} contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
              <Area type="monotone" dataKey="invoiced" stroke="#1B4F8A" strokeWidth={2} fill="url(#aRevGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Order Status Distribution">
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={150} height={150}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={2} dataKey="value">
                  {statusData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-1.5">
              {statusData.map((item, i) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-xs text-slate-600">{item.name}</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-800">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ─── Tab: Revenue ─── */

function RevenueTab({ r }: { r: AnalyticsReport }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total Invoiced" value={r.revenue.total} icon={IndianRupee} prefix="₹" growth={r.revenue.vsLastPeriod.percentChange} />
        <KpiCard label="Collected" value={r.revenue.collected} icon={IndianRupee} prefix="₹" />
        <KpiCard label="Outstanding" value={r.revenue.outstanding} icon={IndianRupee} prefix="₹" />
        <KpiCard label="Avg Order Value" value={`₹${r.revenue.avgOrderValue.toFixed(0)}`} icon={ClipboardList} />
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Revenue Trend (Invoiced vs Collected)" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={r.revenue.byDay}>
              <defs>
                <linearGradient id="invGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1B4F8A" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#1B4F8A" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0D9488" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#0D9488" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmt(v)} />
              <Tooltip formatter={(v: number, name: string) => [fmt(v), name === "invoiced" ? "Invoiced" : "Collected"]} contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
              <Area type="monotone" dataKey="invoiced" stroke="#1B4F8A" strokeWidth={2} fill="url(#invGrad)" />
              <Area type="monotone" dataKey="collected" stroke="#0D9488" strokeWidth={2} fill="url(#colGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Revenue by Category">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={r.revenue.byTestCategory} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmt(v)} />
              <YAxis type="category" dataKey="category" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} width={100} />
              <Tooltip formatter={(v: number) => [fmt(v), "Revenue"]} contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
              <Bar dataKey="revenue" fill="#1B4F8A" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Collection Rate">
          <div className="flex items-center gap-6">
            <div className="text-3xl font-bold text-slate-900">{pct(r.billing.collectionRate)}</div>
            <div className="flex-1">
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${Math.min(r.billing.collectionRate, 100)}%` }} />
              </div>
              <div className="flex justify-between mt-1 text-xs text-slate-400">
                <span>Collected: {fmt(r.revenue.collected)}</span>
                <span>Outstanding: {fmt(r.revenue.outstanding)}</span>
              </div>
            </div>
          </div>
        </Card>
        <Card title="Payment Methods">
          <div className="space-y-2">
            {r.billing.byPaymentMethod.map((m, i) => (
              <div key={m.method} className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                <span className="text-sm text-slate-700 flex-1">{m.method}</span>
                <span className="text-sm font-semibold text-slate-900">{fmt(m.amount)}</span>
                <span className="text-xs text-slate-400">({m.count})</span>
              </div>
            ))}
            {r.billing.byPaymentMethod.length === 0 && <p className="text-sm text-slate-400">No payment data</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ─── Tab: Operations ─── */

function OperationsTab({ r }: { r: AnalyticsReport }) {
  const statusBarData = r.operations.byStatus.map((s) => ({ name: s.status.replace(/_/g, " "), count: s.count, fill: STATUS_COLORS[s.status] ?? "#94a3b8" }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total Orders" value={r.operations.totalOrders} icon={ClipboardList} />
        <KpiCard label="Avg TAT" value={`${r.operations.avgTAT}h`} icon={Calendar} />
        <KpiCard label="Sample Rejection" value={pct(r.operations.sampleRejectionRate)} icon={FlaskConical} />
        <KpiCard label="Overdue Amount" value={r.billing.overdueAmount} icon={IndianRupee} prefix="₹" />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Orders by Status">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={statusBarData} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} width={110} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {statusBarData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Top Tests">
          <div className="space-y-2">
            {r.operations.topTests.slice(0, 8).map((t, i) => (
              <div key={t.name} className="flex items-center gap-3">
                <span className="text-xs text-slate-400 w-5 text-right">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800 truncate">{t.name}</p>
                  <p className="text-[10px] text-slate-400">{t.category}</p>
                </div>
                <span className="text-sm font-semibold text-slate-900">{t.count}</span>
              </div>
            ))}
            {r.operations.topTests.length === 0 && <p className="text-sm text-slate-400">No test data</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ─── Tab: Tests ─── */

function TestsTab({ r }: { r: AnalyticsReport }) {
  const total = r.operations.topTests.reduce((s, t) => s + t.count, 0);
  const byCategory = new Map<string, { count: number; revenue: number }>();
  for (const t of r.operations.topTests) {
    const e = byCategory.get(t.category) ?? { count: 0, revenue: 0 };
    e.count += t.count;
    byCategory.set(t.category, e);
  }
  for (const c of r.revenue.byTestCategory) {
    const e = byCategory.get(c.category) ?? { count: 0, revenue: 0 };
    e.revenue = c.revenue;
    byCategory.set(c.category, e);
  }
  const catData = Array.from(byCategory.entries()).map(([category, v]) => ({ category, ...v })).sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <KpiCard label="Total Tests Ordered" value={total} icon={TestTubes} />
        <KpiCard label="Unique Tests" value={r.operations.topTests.length} icon={FlaskConical} />
        <KpiCard label="Categories" value={catData.length} icon={BarChart3} />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Top Tests by Volume">
          <div className="space-y-2">
            {r.operations.topTests.slice(0, 10).map((t) => {
              const pctVal = total > 0 ? (t.count / total) * 100 : 0;
              return (
                <div key={t.name}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-slate-700 truncate mr-2">{t.name}</span>
                    <span className="text-slate-500 flex-shrink-0">{t.count} ({pctVal.toFixed(0)}%)</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pctVal}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
        <Card title="Tests by Category">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={catData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="category" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
              <Bar dataKey="count" fill="#0D9488" radius={[4, 4, 0, 0]} name="Orders" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

/* ─── Tab: Doctors & Orgs ─── */

function DoctorsTab({ r }: { r: AnalyticsReport }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Lead Conversion" value={pct(r.crm.leadConversionRate)} icon={TrendingUp} />
        <KpiCard label="New Leads" value={r.crm.newLeadsCount} icon={Users} />
        <KpiCard label="Avg Deal Value" value={r.crm.avgDealValue} icon={IndianRupee} prefix="₹" />
        <KpiCard label="Insurance Approval" value={pct(r.billing.insuranceClaimApprovalRate)} icon={Building2} />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Top Referring Doctors">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 px-2 font-medium text-slate-500 text-xs">Doctor</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-500 text-xs">Specialty</th>
                  <th className="text-right py-2 px-2 font-medium text-slate-500 text-xs">Referrals</th>
                  <th className="text-right py-2 px-2 font-medium text-slate-500 text-xs">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {r.crm.topDoctors.map((d) => (
                  <tr key={d.name} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2 px-2 text-slate-800">{d.name}</td>
                    <td className="py-2 px-2 text-slate-500">{d.specialty || "—"}</td>
                    <td className="py-2 px-2 text-right font-semibold">{d.referrals}</td>
                    <td className="py-2 px-2 text-right text-slate-700">{fmt(d.revenue)}</td>
                  </tr>
                ))}
                {r.crm.topDoctors.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-6 text-slate-400 text-sm">No doctor data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Lead Sources">
          {r.crm.bySource.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={r.crm.bySource}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="source" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Bar dataKey="count" fill="#1B4F8A" name="Total" radius={[4, 4, 0, 0]} />
                <Bar dataKey="wonCount" fill="#22c55e" name="Won" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-400 text-center py-8">No lead data</p>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ─── Tab: Patients ─── */

function PatientsTab({ r }: { r: AnalyticsReport }) {
  const total = r.patients.newPatients + r.patients.returningPatients;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total Patients" value={total} icon={Users} />
        <KpiCard label="New Patients" value={r.patients.newPatients} icon={Users} />
        <KpiCard label="Returning" value={r.patients.returningPatients} icon={Users} />
        <KpiCard label="Retention Rate" value={pct(r.patients.retentionRate)} icon={TrendingUp} />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Patients by Age Group">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={r.patients.byAgeGroup}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="group" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
              <Bar dataKey="count" fill="#0D9488" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Patient Mix">
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>New Patients</span>
                <span>{r.patients.newPatients}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full" style={{ width: total > 0 ? `${(r.patients.newPatients / total) * 100}%` : "0%" }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>Returning Patients</span>
                <span>{r.patients.returningPatients}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-teal-500 rounded-full" style={{ width: total > 0 ? `${(r.patients.returningPatients / total) * 100}%` : "0%" }} />
              </div>
            </div>
            <hr className="border-slate-100" />
            <div className="flex gap-3">
              {r.patients.byGender.map((g, i) => (
                <div key={g.gender} className="flex-1 text-center py-3 rounded-lg" style={{ background: `${PIE_COLORS[i]}15` }}>
                  <div className="text-xl font-bold" style={{ color: PIE_COLORS[i] }}>{g.count}</div>
                  <div className="text-xs text-slate-500">{g.gender}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ─── Types for AI Insights ─── */

interface AiInsightsResult {
  summary: string;
  opportunities: string[];
  issues: string[];
  recommendations: string[];
  forecastNote: string;
}

/* ─── Tab: Smart Insights ─── */

function AiInsightsTab({ r }: { r: AnalyticsReport }) {
  const [insights, setInsights] = useState<AiInsightsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPatients = r.patients.newPatients + r.patients.returningPatients;

  const generateInsights = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post("/ai/insights/analytics", {
        totalRevenue: r.revenue.total,
        totalPatients,
        avgDailyOrders: r.operations.totalOrders > 0 ? Math.round(r.operations.totalOrders / 30) : 0,
        tatBreachRate: r.operations.sampleRejectionRate,
        topTest: r.operations.topTests[0]?.name ?? "N/A",
        outstandingDues: r.revenue.outstanding,
        revenueGrowth: r.revenue.vsLastPeriod.percentChange,
        topOrg: r.crm.topDoctors[0]?.name ?? "N/A",
        rejectionRate: r.operations.sampleRejectionRate,
        topDoctor: r.crm.topDoctors[0]?.name ?? "N/A",
        period: "Selected period",
      });
      const data = (res.data?.data ?? res.data) as AiInsightsResult;
      setInsights(data);
    } catch {
      setError("Smart Insights are not available right now. Please check your AI configuration in Settings.");
    } finally {
      setLoading(false);
    }
  }, [r, totalPatients]);

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-violet-50 to-blue-50 rounded-xl border border-violet-200 p-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-violet-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900">Smart Lab Performance Analysis</h3>
            <p className="text-sm text-slate-600 mt-1">
              Get intelligent insights on your lab&apos;s performance, revenue trends, operational efficiency,
              and actionable recommendations based on your analytics data.
            </p>
            <button
              onClick={generateInsights}
              disabled={loading}
              className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {loading ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Analyzing...</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Generate Insights</>
              )}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-800">{error}</p>
        </div>
      )}

      {insights && (
        <div className="space-y-4">
          <Card title="Summary">
            <p className="text-sm leading-relaxed text-slate-700">{insights.summary}</p>
            {insights.forecastNote && (
              <p className="text-xs text-slate-500 mt-3 italic">{insights.forecastNote}</p>
            )}
          </Card>

          <div className="grid lg:grid-cols-3 gap-4">
            <Card title="Growth Opportunities">
              <ul className="space-y-2">
                {insights.opportunities.map((o, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="text-green-500 mt-0.5 flex-shrink-0">+</span> {o}
                  </li>
                ))}
                {insights.opportunities.length === 0 && <p className="text-sm text-slate-400">No specific opportunities identified</p>}
              </ul>
            </Card>
            <Card title="Issues to Address">
              <ul className="space-y-2">
                {insights.issues.map((issue, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="text-amber-500 mt-0.5 flex-shrink-0">!</span> {issue}
                  </li>
                ))}
                {insights.issues.length === 0 && <p className="text-sm text-green-600">No issues detected</p>}
              </ul>
            </Card>
            <Card title="Recommendations">
              <ul className="space-y-2">
                {insights.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="text-blue-500 mt-0.5 flex-shrink-0">{i + 1}.</span> {rec}
                  </li>
                ))}
                {insights.recommendations.length === 0 && <p className="text-sm text-slate-400">No recommendations</p>}
              </ul>
            </Card>
          </div>
        </div>
      )}

      {!insights && !loading && !error && (
        <div className="grid lg:grid-cols-3 gap-4">
          <Card title="What You&apos;ll Get">
            <ul className="space-y-2 text-sm text-slate-600">
              <li className="flex items-start gap-2"><span className="text-violet-500 mt-0.5">1.</span> Revenue analysis &amp; growth opportunities</li>
              <li className="flex items-start gap-2"><span className="text-violet-500 mt-0.5">2.</span> Operational bottleneck identification</li>
              <li className="flex items-start gap-2"><span className="text-violet-500 mt-0.5">3.</span> Patient retention strategies</li>
              <li className="flex items-start gap-2"><span className="text-violet-500 mt-0.5">4.</span> CRM and doctor engagement tips</li>
              <li className="flex items-start gap-2"><span className="text-violet-500 mt-0.5">5.</span> Actionable next steps</li>
            </ul>
          </Card>
          <Card title="Data Analyzed">
            <ul className="space-y-2 text-sm text-slate-600">
              <li>Revenue: {fmt(r.revenue.total)}</li>
              <li>Orders: {r.operations.totalOrders}</li>
              <li>Patients: {totalPatients}</li>
              <li>Avg TAT: {r.operations.avgTAT}h</li>
              <li>Collection Rate: {pct(r.billing.collectionRate)}</li>
            </ul>
          </Card>
          <Card title="DELViON Smart Insights">
            <div className="flex items-center gap-3 mb-3">
              <Brain className="w-8 h-8 text-violet-600" />
              <div>
                <p className="font-semibold text-slate-800">Smart Insights</p>
                <p className="text-xs text-slate-400">by DELViON</p>
              </div>
            </div>
            <p className="text-sm text-slate-600">
              Intelligent analysis of your lab metrics with domain-specific diagnostic lab expertise.
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ─── */

export default function AnalyticsPage() {
  const [rangeDays, setRangeDays] = useState(30);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const dateFrom = format(subDays(new Date(), rangeDays), "yyyy-MM-dd");
  const dateTo = format(new Date(), "yyyy-MM-dd");

  const { data: rawData, isLoading } = useQuery({
    queryKey: ["analytics-full", rangeDays],
    queryFn: async () => {
      const res = await api.get(`/analytics/full-report?dateFrom=${dateFrom}&dateTo=${dateTo}`);
      return (res.data?.data ?? res.data) as AnalyticsReport;
    },
    staleTime: 5 * 60 * 1000,
  });

  const report = safe(rawData ?? null);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {format(subDays(new Date(), rangeDays), "dd MMM yyyy")} — {format(new Date(), "dd MMM yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 rounded-lg p-1 gap-0.5">
            {RANGES.map((r) => (
              <button
                key={r.label}
                onClick={() => setRangeDays(r.days)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  rangeDays === r.days ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-100 p-5 animate-pulse">
                <div className="h-4 w-24 bg-slate-200 rounded mb-3" />
                <div className="h-8 w-20 bg-slate-200 rounded mb-2" />
                <div className="h-3 w-28 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-100 p-5 h-64 animate-pulse">
                <div className="h-4 w-32 bg-slate-200 rounded mb-4" />
                <div className="h-48 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {activeTab === "overview" && <OverviewTab r={report} />}
          {activeTab === "revenue" && <RevenueTab r={report} />}
          {activeTab === "operations" && <OperationsTab r={report} />}
          {activeTab === "tests" && <TestsTab r={report} />}
          {activeTab === "doctors" && <DoctorsTab r={report} />}
          {activeTab === "patients" && <PatientsTab r={report} />}
          {activeTab === "ai" && <AiInsightsTab r={report} />}
        </>
      )}
    </div>
  );
}
