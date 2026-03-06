"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  HeartPulse,
  Tent,
  Users,
  IndianRupee,
  PlayCircle,
  Plus,
  ArrowRight,
  FileBarChart,
  CalendarDays,
  Building2,
  MapPin,
} from "lucide-react";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import api from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────

type CampStatus = "PLANNED" | "ACTIVE" | "COMPLETED" | "CANCELLED";

interface Camp {
  id: string;
  name: string;
  organization: string;
  location: string;
  campDate: string;
  endDate: string | null;
  expectedCount: number;
  actualCount: number;
  revenue: number;
  status: CampStatus;
  notes: string | null;
  createdAt: string;
}

interface CampMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ── Constants ──────────────────────────────────────────────────────────────

const PIE_COLORS: Record<CampStatus, string> = {
  PLANNED:   "#3b82f6",
  ACTIVE:    "#22c55e",
  COMPLETED: "#64748b",
  CANCELLED: "#ef4444",
};

const PIE_COLOR_LIST = ["#3b82f6", "#22c55e", "#64748b", "#ef4444"];

const STATUS_LABELS: Record<CampStatus, string> = {
  PLANNED:   "Planned",
  ACTIVE:    "Active",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

// ── Status Badge ──────────────────────────────────────────────────────────

function CampStatusBadge({ status }: { status: CampStatus }) {
  const map: Record<CampStatus, string> = {
    PLANNED:   "bg-blue-50 text-blue-700 border-blue-200",
    ACTIVE:    "bg-green-50 text-green-700 border-green-200",
    COMPLETED: "bg-slate-100 text-slate-600 border-slate-200",
    CANCELLED: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${map[status]}`}>
      {status}
    </span>
  );
}

// ── Helper: Compact currency ──────────────────────────────────────────────

function fmtCompact(v: number): string {
  if (v >= 10000000) return `${(v / 10000000).toFixed(1)}Cr`;
  if (v >= 100000) return `${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
  return String(v);
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function WellnessDashboardPage() {
  // ── Fetch camps data ──
  const { data, isLoading } = useQuery({
    queryKey: ["corporate-camps-wellness"],
    queryFn: async () => {
      try {
        const res = await api.get("/corporate/camps", { params: { page: 1, limit: 100 } });
        const payload = res.data?.data ?? res.data;
        if (Array.isArray(payload)) {
          return { data: payload as Camp[], meta: { total: payload.length, page: 1, limit: 100, totalPages: 1 } };
        }
        if (payload && typeof payload === "object" && "data" in payload) {
          return payload as { data: Camp[]; meta: CampMeta };
        }
        return { data: [] as Camp[], meta: { total: 0, page: 1, limit: 100, totalPages: 0 } };
      } catch {
        return { data: [] as Camp[], meta: { total: 0, page: 1, limit: 100, totalPages: 0 } };
      }
    },
  });

  const camps = data?.data ?? [];

  // ── Computed KPIs ──
  const kpis = useMemo(() => {
    const totalPrograms = camps.length;
    const activeCamps = camps.filter((c) => c.status === "ACTIVE").length;
    const totalParticipants = camps.reduce((sum, c) => sum + (c.actualCount || 0), 0);
    const totalRevenue = camps.reduce((sum, c) => sum + (c.revenue || 0), 0);
    return { totalPrograms, activeCamps, totalParticipants, totalRevenue };
  }, [camps]);

  // ── Pie chart data: Status distribution ──
  const statusDistribution = useMemo(() => {
    const counts: Record<CampStatus, number> = { PLANNED: 0, ACTIVE: 0, COMPLETED: 0, CANCELLED: 0 };
    camps.forEach((c) => {
      if (counts[c.status] !== undefined) counts[c.status]++;
    });
    return (Object.entries(counts) as [CampStatus, number][])
      .filter(([, count]) => count > 0)
      .map(([status, count]) => ({ name: STATUS_LABELS[status], value: count, status }));
  }, [camps]);

  // ── Area chart data: Monthly wellness revenue trend ──
  const monthlyRevenue = useMemo(() => {
    const monthMap: Record<string, number> = {};
    camps.forEach((c) => {
      if (!c.campDate) return;
      const d = new Date(c.campDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthMap[key] = (monthMap[key] || 0) + (c.revenue || 0);
    });

    const sorted = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, revenue]) => {
        const [y, m] = month.split("-");
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return {
          month: `${monthNames[parseInt(m, 10) - 1]} ${y.slice(2)}`,
          revenue,
        };
      });

    return sorted;
  }, [camps]);

  // ── Recent camps (latest 5) ──
  const recentCamps = useMemo(() => {
    return [...camps]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [camps]);

  // ── KPI card items ──
  const kpiCards = [
    { label: "Total Programs", value: kpis.totalPrograms, icon: HeartPulse, color: "bg-blue-50 text-blue-600" },
    { label: "Active Camps", value: kpis.activeCamps, icon: PlayCircle, color: "bg-green-50 text-green-600" },
    { label: "Total Participants", value: kpis.totalParticipants.toLocaleString(), icon: Users, color: "bg-purple-50 text-purple-600" },
    { label: "Revenue from Wellness", value: formatCurrency(kpis.totalRevenue), icon: IndianRupee, color: "bg-amber-50 text-amber-600" },
  ];

  // ── Quick links ──
  const quickLinks = [
    { label: "Plan New Camp", href: "/corporate/camps", icon: Plus, description: "Schedule a new corporate health camp" },
    { label: "View All Camps", href: "/corporate/camps", icon: Tent, description: "Manage existing health camps" },
    { label: "Generate Report", href: "/analytics", icon: FileBarChart, description: "View wellness analytics and reports" },
  ];

  // ── Loading skeleton ──
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="w-64 h-8 bg-slate-200 rounded animate-pulse mb-2" />
          <div className="w-80 h-4 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <div className="w-10 h-10 bg-slate-100 rounded-lg animate-pulse mb-3" />
              <div className="w-20 h-7 bg-slate-100 rounded animate-pulse mb-2" />
              <div className="w-28 h-4 bg-slate-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 h-72 animate-pulse" />
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 h-72 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Corporate Wellness</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Overview of wellness programs, camp performance, and participant analytics
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2.5 rounded-lg ${kpi.color.split(" ")[0]}`}>
                  <Icon className={`w-5 h-5 ${kpi.color.split(" ")[1]}`} />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900">{kpi.value}</p>
              <p className="text-sm text-slate-500 mt-0.5">{kpi.label}</p>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Camp Status Distribution — Pie Chart */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div className="mb-4">
            <h3 className="font-semibold text-slate-800">Camp Status Distribution</h3>
            <p className="text-xs text-slate-400 mt-0.5">Breakdown of camps by current status</p>
          </div>
          {statusDistribution.length > 0 ? (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statusDistribution.map((entry) => (
                      <Cell key={entry.name} fill={PIE_COLORS[entry.status]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2.5">
                {statusDistribution.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ background: PIE_COLORS[item.status] }}
                      />
                      <span className="text-sm text-slate-600">{item.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-800">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-40">
              <p className="text-sm text-slate-400">No camp data available to display</p>
            </div>
          )}
        </div>

        {/* Monthly Wellness Revenue — Area Chart */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div className="mb-4">
            <h3 className="font-semibold text-slate-800">Monthly Wellness Revenue</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Revenue trend from corporate wellness programs
            </p>
          </div>
          {monthlyRevenue.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={monthlyRevenue}>
                <defs>
                  <linearGradient id="wellnessRevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1B4F8A" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#1B4F8A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `${fmtCompact(v)}`}
                />
                <Tooltip
                  formatter={(v: number) => [formatCurrency(v), "Revenue"]}
                  contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#1B4F8A"
                  strokeWidth={2}
                  fill="url(#wellnessRevGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40">
              <p className="text-sm text-slate-400">No revenue data available yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Camps + Quick Links Row */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Recent Camps (takes 2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-800">Recent Camps</h3>
              <p className="text-xs text-slate-400 mt-0.5">Latest health camp activities</p>
            </div>
            <Link
              href="/corporate/camps"
              className="text-xs font-medium text-[#1B4F8A] hover:underline flex items-center gap-1"
            >
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {recentCamps.length > 0 ? (
            <div className="space-y-3">
              {recentCamps.map((camp) => (
                <div
                  key={camp.id}
                  className="flex items-center justify-between p-3.5 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                      <Tent className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{camp.name}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {camp.organization}
                        </span>
                        <span className="flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          {formatDate(camp.campDate)}
                        </span>
                        {camp.location && (
                          <span className="flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3" />
                            {camp.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 ml-4">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-800">
                        {camp.actualCount || 0}
                        <span className="text-slate-400 font-normal"> / {camp.expectedCount || 0}</span>
                      </p>
                      <p className="text-[11px] text-slate-400">participants</p>
                    </div>
                    <CampStatusBadge status={camp.status} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10">
              <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <Tent className="w-7 h-7 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-600 mb-1">No camps yet</p>
              <p className="text-xs text-slate-400 max-w-xs text-center">
                Once you create health camps, they will appear here with their latest status and participant counts.
              </p>
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div className="mb-4">
            <h3 className="font-semibold text-slate-800">Quick Actions</h3>
            <p className="text-xs text-slate-400 mt-0.5">Common wellness operations</p>
          </div>
          <div className="space-y-2.5">
            {quickLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  className="flex items-center gap-3 p-3.5 rounded-lg border border-slate-100 hover:bg-slate-50 hover:border-slate-200 transition-colors group"
                >
                  <div className="w-9 h-9 rounded-lg bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center shrink-0 transition-colors">
                    <Icon className="w-4 h-4 text-[#1B4F8A]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 group-hover:text-[#1B4F8A] transition-colors">
                      {link.label}
                    </p>
                    <p className="text-xs text-slate-400">{link.description}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[#1B4F8A] shrink-0 ml-auto transition-colors" />
                </Link>
              );
            })}
          </div>

          {/* Summary stat at bottom */}
          {camps.length > 0 && (
            <div className="mt-5 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Total wellness revenue</span>
                <span className="font-bold text-slate-900">{formatCurrency(kpis.totalRevenue)}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1.5">
                <span className="text-slate-500">Avg. participants / camp</span>
                <span className="font-bold text-slate-900">
                  {kpis.totalPrograms > 0
                    ? Math.round(kpis.totalParticipants / kpis.totalPrograms)
                    : 0}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
