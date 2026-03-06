"use client";

import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import Link from "next/link";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  ClipboardList,
  FlaskConical,
  FileText,
  Activity,
  ArrowRight,
  Clock,
  Users,
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronRight,
  Beaker,
} from "lucide-react";
import { KPICard } from "@/components/shared/KPICard";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import api from "@/lib/api";

/* ─── Types ─────────────────────────────────── */

interface RecentOrder {
  id: string;
  orderNumber: string;
  status: string;
  priority: string;
  netAmount: number;
  createdAt: string;
  patient: { firstName: string; lastName: string; mrn: string };
  items: Array<{ testName: string }>;
}

interface PendingReport {
  id: string;
  orderNumber: string;
  createdAt: string;
  patient: { firstName: string; lastName: string };
}

interface DashboardAlert {
  id: string;
  type: "CRITICAL" | "WARNING" | "INFO";
  title: string;
  description: string;
  timestamp: string;
}

interface DashboardData {
  todayOrders: number;
  todayRevenue: number;
  pendingReports: number;
  activeSamples: number;
  todayPatients: number;
  pendingResults: number;
  revenueTrend: Array<{ date: string; revenue: number }>;
  ordersByStatus: Array<{ status: string; count: number }>;
  recentOrders: RecentOrder[];
  pendingReportsList: PendingReport[];
  samplePipeline: Array<{ status: string; count: number }>;
  hourlyRegistrations: Array<{ hour: string; count: number }>;
  alerts: DashboardAlert[];
}

/* ─── Constants ─────────────────────────────── */

const ORDER_STATUS_COLORS: Record<string, string> = {
  PENDING: "#94a3b8",
  CONFIRMED: "#3b82f6",
  SAMPLE_COLLECTED: "#8b5cf6",
  IN_PROCESSING: "#f59e0b",
  RESULTED: "#0D7E8A",
  REPORTED: "#22c55e",
  CANCELLED: "#ef4444",
};

const PIPELINE_STEPS = [
  { status: "PENDING_COLLECTION", label: "Pending", icon: "🕐", color: "from-slate-50 to-slate-100 border-slate-200", text: "text-slate-700" },
  { status: "COLLECTED", label: "Collected", icon: "🧪", color: "from-blue-50 to-blue-100 border-blue-200", text: "text-blue-700" },
  { status: "IN_TRANSIT", label: "Transit", icon: "🚚", color: "from-violet-50 to-violet-100 border-violet-200", text: "text-violet-700" },
  { status: "RECEIVED", label: "Received", icon: "📥", color: "from-orange-50 to-orange-100 border-orange-200", text: "text-orange-700" },
  { status: "PROCESSING", label: "Processing", icon: "⚗️", color: "from-amber-50 to-amber-100 border-amber-200", text: "text-amber-700" },
  { status: "STORED", label: "Stored", icon: "🗄️", color: "from-green-50 to-green-100 border-green-200", text: "text-green-700" },
];

const ALERT_CONFIG: Record<string, { bg: string; border: string; icon: typeof AlertTriangle; iconColor: string }> = {
  CRITICAL: { bg: "bg-red-50", border: "border-red-200", icon: AlertCircle, iconColor: "text-red-600" },
  WARNING: { bg: "bg-amber-50", border: "border-amber-200", icon: AlertTriangle, iconColor: "text-amber-600" },
  INFO: { bg: "bg-blue-50", border: "border-blue-200", icon: Info, iconColor: "text-blue-600" },
};

/* ─── Helpers ───────────────────────────────── */

function formatRevenue(value: number): string {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(0)}K`;
  return `₹${value.toFixed(0)}`;
}

function formatAxisDate(dateStr: string): string {
  try { return format(parseISO(dateStr), "MMM d"); } catch { return dateStr; }
}

function formatTooltipDate(dateStr: string): string {
  try { return format(parseISO(dateStr), "MMM d, yyyy"); } catch { return dateStr; }
}

/* ─── Page ──────────────────────────────────── */

export default function DashboardPage() {
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["analytics-dashboard"],
    queryFn: async () => {
      const res = await api.get("/analytics/dashboard");
      return (res.data?.data ?? res.data) as DashboardData;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const alerts = data?.alerts ?? [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-0.5">{today}</p>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert) => {
            const cfg = ALERT_CONFIG[alert.type] ?? ALERT_CONFIG.INFO;
            const IconComp = cfg.icon;
            return (
              <div
                key={alert.id}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${cfg.bg} ${cfg.border}`}
              >
                <IconComp size={18} className={cfg.iconColor} />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-slate-900">{alert.title}</span>
                  <span className="text-sm text-slate-600 ml-2">{alert.description}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 6 KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <KPICard
          title="Today's Orders"
          value={data?.todayOrders ?? 0}
          icon={ClipboardList}
          iconColor="bg-blue-50 text-blue-600"
          isLoading={isLoading}
        />
        <KPICard
          title="Today's Revenue"
          value={formatRevenue(data?.todayRevenue ?? 0)}
          icon={Activity}
          iconColor="bg-green-50 text-green-600"
          isLoading={isLoading}
        />
        <KPICard
          title="Today's Patients"
          value={data?.todayPatients ?? 0}
          icon={Users}
          iconColor="bg-indigo-50 text-indigo-600"
          isLoading={isLoading}
        />
        <KPICard
          title="Active Samples"
          value={data?.activeSamples ?? 0}
          subtitle="In pipeline"
          icon={FlaskConical}
          iconColor="bg-teal-50 text-teal-600"
          isLoading={isLoading}
        />
        <KPICard
          title="Pending Results"
          value={data?.pendingResults ?? 0}
          icon={Beaker}
          iconColor="bg-amber-50 text-amber-600"
          isLoading={isLoading}
        />
        <KPICard
          title="Pending Reports"
          value={data?.pendingReports ?? 0}
          subtitle="Awaiting sign-off"
          icon={FileText}
          iconColor="bg-orange-50 text-orange-500"
          isLoading={isLoading}
        />
      </div>

      {/* Lab Pipeline Flow */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Lab Pipeline</h2>
            <p className="text-xs text-slate-400 mt-0.5">Current sample status flow</p>
          </div>
          <Link href="/samples" className="text-xs text-[#0D7E8A] hover:underline flex items-center gap-1">
            View queue <ArrowRight size={12} />
          </Link>
        </div>
        {isLoading ? (
          <div className="flex gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[76px] flex-1 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-1">
            {PIPELINE_STEPS.map(({ status, label, icon, color, text }, idx) => {
              const entry = (data?.samplePipeline ?? []).find((s) => s.status === status);
              const count = entry?.count ?? 0;
              return (
                <div key={status} className="flex items-center flex-1 min-w-0">
                  <div
                    className={`flex-1 flex flex-col items-center px-2 py-3 rounded-xl border bg-gradient-to-b ${color}`}
                  >
                    <span className="text-lg mb-0.5">{icon}</span>
                    <span className={`text-xl font-bold leading-none ${text}`}>{count}</span>
                    <span className={`text-[10px] font-medium mt-1 ${text} opacity-70`}>{label}</span>
                  </div>
                  {idx < PIPELINE_STEPS.length - 1 && (
                    <ChevronRight size={14} className="text-slate-300 flex-shrink-0 mx-0.5" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Revenue Trend */}
        <div className="xl:col-span-2 bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Revenue Trend</h2>
              <p className="text-xs text-slate-400 mt-0.5">Last 30 days — paid invoices</p>
            </div>
          </div>
          {isLoading ? (
            <div className="h-48 flex items-center justify-center"><LoadingSpinner size="md" /></div>
          ) : (
            <ResponsiveContainer width="100%" height={190}>
              <AreaChart data={data?.revenueTrend ?? []}>
                <defs>
                  <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0D7E8A" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#0D7E8A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tickFormatter={formatAxisDate} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tickFormatter={formatRevenue} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={60} />
                <Tooltip
                  labelFormatter={(label) => formatTooltipDate(String(label))}
                  formatter={(value) => [formatRevenue(Number(value)), "Revenue"]}
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: 12 }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#0D7E8A" strokeWidth={2} fill="url(#revGradient)" dot={false} activeDot={{ r: 4, fill: "#0D7E8A" }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Orders by Status */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-900">Orders by Status</h2>
            <p className="text-xs text-slate-400 mt-0.5">All orders breakdown</p>
          </div>
          {isLoading ? (
            <div className="h-48 flex items-center justify-center"><LoadingSpinner size="md" /></div>
          ) : (
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={data?.ordersByStatus ?? []} layout="vertical" margin={{ left: 0, right: 10, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="status" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={90} tickFormatter={(s: string) => s.replace(/_/g, " ")} />
                <Tooltip formatter={(value) => [Number(value), "Orders"]} contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {(data?.ordersByStatus ?? []).map((entry) => (
                    <Cell key={entry.status} fill={ORDER_STATUS_COLORS[entry.status] ?? "#94a3b8"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Hourly Registrations + Recent Orders + Pending Reports */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Hourly Registrations */}
        <div className="xl:col-span-2 bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-900">Hourly Registrations</h2>
            <p className="text-xs text-slate-400 mt-0.5">Today&apos;s order registrations by hour</p>
          </div>
          {isLoading ? (
            <div className="h-40 flex items-center justify-center"><LoadingSpinner size="md" /></div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={data?.hourlyRegistrations ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Bar dataKey="count" fill="#1B4F8A" radius={[4, 4, 0, 0]} name="Orders" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Recent Orders */}
        <div className="xl:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
            <h2 className="text-sm font-semibold text-slate-900">Recent Orders</h2>
            <Link href="/orders" className="text-xs text-[#0D7E8A] hover:underline flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          {isLoading ? (
            <div className="p-8 flex justify-center"><LoadingSpinner size="md" /></div>
          ) : (
            <div className="divide-y divide-slate-50">
              {(data?.recentOrders ?? []).slice(0, 6).map((order) => (
                <div key={order.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-semibold text-[#1B4F8A]">{order.orderNumber}</span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{
                          backgroundColor: `${ORDER_STATUS_COLORS[order.status] ?? "#94a3b8"}20`,
                          color: ORDER_STATUS_COLORS[order.status] ?? "#94a3b8",
                        }}
                      >
                        {order.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 mt-0.5 truncate">
                      {order.patient.firstName} {order.patient.lastName}
                      <span className="text-slate-400"> — {order.patient.mrn}</span>
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-slate-900">₹{order.netAmount.toLocaleString("en-IN")}</p>
                    <p className="text-[10px] text-slate-400">{format(parseISO(order.createdAt), "hh:mm a")}</p>
                  </div>
                </div>
              ))}
              {(data?.recentOrders ?? []).length === 0 && (
                <p className="text-center text-sm text-slate-400 py-8">No orders yet today</p>
              )}
            </div>
          )}
        </div>

        {/* Pending Reports */}
        <div className="xl:col-span-1 bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-4 border-b border-slate-50">
            <h2 className="text-sm font-semibold text-slate-900">
              Pending Reports
              {(data?.pendingReports ?? 0) > 0 && (
                <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded-full font-semibold">
                  {data?.pendingReports}
                </span>
              )}
            </h2>
          </div>
          {isLoading ? (
            <div className="p-8 flex justify-center"><LoadingSpinner size="md" /></div>
          ) : (
            <div className="divide-y divide-slate-50">
              {(data?.pendingReportsList ?? []).slice(0, 8).map((report) => (
                <div key={report.id} className="flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50 transition-colors">
                  <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                    <Clock size={12} className="text-orange-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-900 truncate">
                      {report.patient.firstName} {report.patient.lastName}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {report.orderNumber}
                    </p>
                  </div>
                </div>
              ))}
              {(data?.pendingReportsList ?? []).length === 0 && (
                <p className="text-center text-xs text-slate-400 py-6">All reports signed off</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
