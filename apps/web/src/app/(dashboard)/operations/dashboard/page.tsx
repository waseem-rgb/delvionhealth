"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
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
  FileText,
  FlaskConical,
  Cpu,
  CheckCircle,
  Send,
  Clock,
  AlertTriangle,
  Zap,
  ChevronRight,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { cn, formatTAT, getTATColor } from "@/lib/utils";
import api from "@/lib/api";

// ── Types ────────────────────────────────────────────────────────────────────

interface DashboardStats {
  registeredToday: number;
  accessioned: number;
  processing: number;
  approved: number;
  dispatched: number;
  avgTatHours: number;
}

interface PipelineStage {
  label: string;
  count: number;
  color: string;
}

interface LiveSample {
  id: string;
  orderNumber: string;
  patientName: string;
  stage: string;
  createdAt: string;
  tatStatus: "on_track" | "warning" | "breached";
}

interface TatBreachedOrder {
  id: string;
  orderNumber: string;
  patientName: string;
  exceededBy: string;
}

interface StatSample {
  id: string;
  orderNumber: string;
  patientName: string;
  stage: string;
}

interface DepartmentWorkload {
  department: string;
  count: number;
}

interface HourlyVolume {
  hour: string;
  orders: number;
}

interface TopTest {
  name: string;
  count: number;
}

// ── Mock data ────────────────────────────────────────────────────────────────

function buildMockDashboard(): DashboardStats {
  return {
    registeredToday: 84,
    accessioned: 72,
    processing: 38,
    approved: 56,
    dispatched: 48,
    avgTatHours: 2.4,
  };
}

function buildMockPipeline(): PipelineStage[] {
  return [
    { label: "Registration", count: 84, color: "#3B82F6" },
    { label: "Accession", count: 72, color: "#6366F1" },
    { label: "Processing", count: 38, color: "#8B5CF6" },
    { label: "Approval", count: 56, color: "#0D9488" },
    { label: "Dispatched", count: 48, color: "#22C55E" },
  ];
}

function buildMockLiveSamples(): LiveSample[] {
  return [
    { id: "s1", orderNumber: "DH-ORD-20260304-0012", patientName: "Rajesh Kumar", stage: "Processing", createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), tatStatus: "on_track" },
    { id: "s2", orderNumber: "DH-ORD-20260304-0018", patientName: "Sunita Devi", stage: "Approval", createdAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(), tatStatus: "on_track" },
    { id: "s3", orderNumber: "DH-ORD-20260304-0024", patientName: "Anand Iyer", stage: "Processing", createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), tatStatus: "warning" },
    { id: "s4", orderNumber: "DH-ORD-20260304-0031", patientName: "Meena Rao", stage: "Accession", createdAt: new Date(Date.now() - 0.5 * 60 * 60 * 1000).toISOString(), tatStatus: "on_track" },
    { id: "s5", orderNumber: "DH-ORD-20260304-0037", patientName: "Vikram Singh", stage: "Processing", createdAt: new Date(Date.now() - 9 * 60 * 60 * 1000).toISOString(), tatStatus: "breached" },
    { id: "s6", orderNumber: "DH-ORD-20260304-0042", patientName: "Lakshmi Nair", stage: "Registration", createdAt: new Date(Date.now() - 0.25 * 60 * 60 * 1000).toISOString(), tatStatus: "on_track" },
    { id: "s7", orderNumber: "DH-ORD-20260304-0048", patientName: "Arun Patel", stage: "Approval", createdAt: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(), tatStatus: "breached" },
    { id: "s8", orderNumber: "DH-ORD-20260304-0053", patientName: "Deepa Shetty", stage: "Processing", createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), tatStatus: "on_track" },
  ];
}

function buildMockTatBreached(): TatBreachedOrder[] {
  return [
    { id: "b1", orderNumber: "DH-ORD-20260304-0037", patientName: "Vikram Singh", exceededBy: "+3h 12m" },
    { id: "b2", orderNumber: "DH-ORD-20260304-0048", patientName: "Arun Patel", exceededBy: "+1h 45m" },
    { id: "b3", orderNumber: "DH-ORD-20260303-0089", patientName: "Geeta Reddy", exceededBy: "+4h 30m" },
  ];
}

function buildMockStatSamples(): StatSample[] {
  return [
    { id: "st1", orderNumber: "DH-ORD-20260304-0031", patientName: "Meena Rao", stage: "Accession" },
    { id: "st2", orderNumber: "DH-ORD-20260304-0055", patientName: "Ravi Menon", stage: "Processing" },
  ];
}

function buildMockDepartments(): DepartmentWorkload[] {
  return [
    { department: "Biochemistry", count: 28 },
    { department: "Haematology", count: 22 },
    { department: "Microbiology", count: 12 },
    { department: "Immunology", count: 8 },
    { department: "Pathology", count: 6 },
  ];
}

function buildMockHourly(): HourlyVolume[] {
  const hours: HourlyVolume[] = [];
  for (let h = 6; h <= 22; h++) {
    const label = h <= 12 ? `${h}AM` : h === 12 ? "12PM" : `${h - 12}PM`;
    const isPast = h <= new Date().getHours();
    hours.push({
      hour: label,
      orders: isPast ? Math.floor(Math.random() * 12 + 2) : 0,
    });
  }
  return hours;
}

function buildMockTopTests(): TopTest[] {
  return [
    { name: "CBC", count: 18 },
    { name: "Lipid Profile", count: 14 },
    { name: "LFT", count: 12 },
    { name: "KFT", count: 10 },
    { name: "Thyroid (TFT)", count: 9 },
    { name: "HbA1c", count: 8 },
    { name: "Blood Sugar", count: 7 },
    { name: "Urine R/E", count: 6 },
    { name: "ESR", count: 5 },
    { name: "Electrolytes", count: 4 },
  ];
}

const PIE_COLORS = [
  "#1B4F8A", "#0D9488", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#6366F1", "#14B8A6", "#F97316", "#64748B",
];

const TAT_ROW_COLORS: Record<string, string> = {
  on_track: "",
  warning: "bg-amber-50",
  breached: "bg-red-50",
};

const TAT_BADGE_COLORS: Record<string, string> = {
  on_track: "bg-green-100 text-green-700",
  warning: "bg-amber-100 text-amber-700",
  breached: "bg-red-100 text-red-700",
};

const TAT_LABEL: Record<string, string> = {
  on_track: "On Track",
  warning: "Warning",
  breached: "Breached",
};

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  suffix,
  icon: Icon,
  iconBg,
  iconText,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  icon: React.ElementType;
  iconBg: string;
  iconText: string;
}) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3">
        <div className={cn("p-2.5 rounded-lg flex-shrink-0", iconBg)}>
          <Icon className={cn("w-5 h-5", iconText)} size={20} />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold text-slate-900 leading-tight">
            {value}{suffix}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">{label}</p>
        </div>
      </div>
    </div>
  );
}

// ── Funnel Arrow ─────────────────────────────────────────────────────────────

function FunnelArrow() {
  return (
    <div className="flex items-center justify-center flex-shrink-0 text-slate-300">
      <ChevronRight size={24} />
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function OperationsDashboardPage() {
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // ── Fetch dashboard stats ──────────────────────────────────────────────

  const { data: dashboard, isLoading: dashLoading } = useQuery<DashboardStats>({
    queryKey: ["ops-dashboard"],
    queryFn: () =>
      api
        .get("/lab/operations/dashboard")
        .then((r) => r.data.data ?? r.data)
        .catch(() => buildMockDashboard()),
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  const stats = dashboard ?? buildMockDashboard();

  // ── Fetch live samples ─────────────────────────────────────────────────

  const { data: liveData } = useQuery({
    queryKey: ["ops-live-samples"],
    queryFn: () =>
      api
        .get("/lab/operations/live-samples")
        .then((r) => (r.data.data ?? r.data) as LiveSample[])
        .catch(() => buildMockLiveSamples()),
    refetchInterval: 30000,
  });

  const liveSamples = liveData ?? buildMockLiveSamples();

  // ── Fetch TAT breached ─────────────────────────────────────────────────

  const { data: breachedData } = useQuery({
    queryKey: ["ops-tat-breached"],
    queryFn: () =>
      api
        .get("/lab/operations/tat-breached")
        .then((r) => (r.data.data ?? r.data) as TatBreachedOrder[])
        .catch(() => buildMockTatBreached()),
    refetchInterval: 30000,
  });

  const breachedOrders = breachedData ?? buildMockTatBreached();

  // ── Fetch STAT samples ─────────────────────────────────────────────────

  const { data: statData } = useQuery({
    queryKey: ["ops-stat-samples"],
    queryFn: () =>
      api
        .get("/lab/operations/stat-samples")
        .then((r) => (r.data.data ?? r.data) as StatSample[])
        .catch(() => buildMockStatSamples()),
    refetchInterval: 30000,
  });

  const statSamples = statData ?? buildMockStatSamples();

  // ── Fetch departments ──────────────────────────────────────────────────

  const { data: deptData } = useQuery({
    queryKey: ["ops-departments"],
    queryFn: () =>
      api
        .get("/lab/operations/departments")
        .then((r) => (r.data.data ?? r.data) as DepartmentWorkload[])
        .catch(() => buildMockDepartments()),
    refetchInterval: 30000,
  });

  const departments = deptData ?? buildMockDepartments();

  // ── Fetch hourly ───────────────────────────────────────────────────────

  const { data: hourlyData } = useQuery({
    queryKey: ["ops-hourly"],
    queryFn: () =>
      api
        .get("/lab/operations/hourly")
        .then((r) => (r.data.data ?? r.data) as HourlyVolume[])
        .catch(() => buildMockHourly()),
    refetchInterval: 30000,
  });

  const hourlyVolume = hourlyData ?? buildMockHourly();

  // ── Fetch top tests ────────────────────────────────────────────────────

  const { data: topTestsData } = useQuery({
    queryKey: ["ops-top-tests"],
    queryFn: () =>
      api
        .get("/lab/operations/top-tests")
        .then((r) => (r.data.data ?? r.data) as TopTest[])
        .catch(() => buildMockTopTests()),
    refetchInterval: 30000,
  });

  const topTests = topTestsData ?? buildMockTopTests();

  // Pipeline from stats
  const pipeline = buildMockPipeline();
  pipeline[0].count = stats.registeredToday;
  pipeline[1].count = stats.accessioned;
  pipeline[2].count = stats.processing;
  pipeline[3].count = stats.approved;
  pipeline[4].count = stats.dispatched;

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Lab Operations Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time overview of today&apos;s lab operations
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <RefreshCw size={12} className={dashLoading ? "animate-spin" : ""} />
          <span>Auto-refresh 30s</span>
        </div>
      </div>

      {/* ── ROW 1: KPI Cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="Registered Today" value={stats.registeredToday} icon={FileText} iconBg="bg-blue-100" iconText="text-blue-600" />
        <KpiCard label="Accessioned" value={stats.accessioned} icon={FlaskConical} iconBg="bg-indigo-100" iconText="text-indigo-600" />
        <KpiCard label="Processing" value={stats.processing} icon={Cpu} iconBg="bg-purple-100" iconText="text-purple-600" />
        <KpiCard label="Approved" value={stats.approved} icon={CheckCircle} iconBg="bg-teal-100" iconText="text-teal-600" />
        <KpiCard label="Dispatched" value={stats.dispatched} icon={Send} iconBg="bg-green-100" iconText="text-green-600" />
        <KpiCard label="Avg TAT Today" value={`${stats.avgTatHours.toFixed(1)}h`} icon={Clock} iconBg="bg-amber-100" iconText="text-amber-600" />
      </div>

      {/* ── ROW 2: Pipeline Funnel ──────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-semibold text-slate-800 mb-4">Sample Pipeline</h2>
        <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1">
          {pipeline.map((stage, i) => (
            <div key={stage.label} className="flex items-center gap-1 flex-1 min-w-0">
              <div
                className="flex-1 rounded-xl px-4 py-4 text-center min-w-[100px]"
                style={{ backgroundColor: `${stage.color}12`, borderLeft: `4px solid ${stage.color}` }}
              >
                <p className="text-2xl font-bold" style={{ color: stage.color }}>
                  {stage.count}
                </p>
                <p className="text-xs text-slate-500 mt-1 font-medium">{stage.label}</p>
              </div>
              {i < pipeline.length - 1 && <FunnelArrow />}
            </div>
          ))}
        </div>
      </div>

      {/* ── ROW 3: Split view ───────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-5 gap-4">
        {/* Left 60%: Live sample tracking */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Live Sample Tracking</h2>
            <span className="text-xs text-slate-400">{liveSamples.length} active orders</span>
          </div>
          <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                <tr>
                  {["Order #", "Patient", "Stage", "TAT", "Status"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {liveSamples.map((sample) => (
                  <tr key={sample.id} className={cn("transition-colors", TAT_ROW_COLORS[sample.tatStatus])}>
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-xs font-semibold text-[#1B4F8A]">
                        {sample.orderNumber}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-slate-700">{sample.patientName}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs font-medium text-slate-600">{sample.stage}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-slate-500">{formatTAT(sample.createdAt)}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold", TAT_BADGE_COLORS[sample.tatStatus])}>
                        {TAT_LABEL[sample.tatStatus]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right 40%: TAT Breached + STAT + Department Workload */}
        <div className="lg:col-span-2 space-y-4">
          {/* TAT Breached */}
          <div className="bg-white rounded-xl border border-red-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-red-100 bg-red-50/50 flex items-center gap-2">
              <AlertTriangle size={14} className="text-red-600" />
              <h3 className="font-semibold text-red-800 text-sm">TAT Breached ({breachedOrders.length})</h3>
            </div>
            <div className="divide-y divide-red-50 max-h-[160px] overflow-y-auto">
              {breachedOrders.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-slate-400">No breaches today</div>
              ) : (
                breachedOrders.map((order) => (
                  <div key={order.id} className="px-4 py-2.5 flex items-center justify-between">
                    <div>
                      <p className="font-mono text-xs font-semibold text-red-700">{order.orderNumber}</p>
                      <p className="text-xs text-slate-500">{order.patientName}</p>
                    </div>
                    <span className="text-xs font-bold text-red-600">{order.exceededBy}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* STAT Samples */}
          <div className="bg-white rounded-xl border border-orange-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-orange-100 bg-orange-50/50 flex items-center gap-2">
              <Zap size={14} className="text-orange-600" />
              <h3 className="font-semibold text-orange-800 text-sm">STAT Samples ({statSamples.length})</h3>
            </div>
            <div className="divide-y divide-orange-50 max-h-[120px] overflow-y-auto">
              {statSamples.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-slate-400">No STAT orders</div>
              ) : (
                statSamples.map((sample) => (
                  <div key={sample.id} className="px-4 py-2.5 flex items-center justify-between">
                    <div>
                      <p className="font-mono text-xs font-semibold text-orange-700">{sample.orderNumber}</p>
                      <p className="text-xs text-slate-500">{sample.patientName}</p>
                    </div>
                    <span className="text-xs font-medium text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
                      {sample.stage}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Department Workload */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <h3 className="font-semibold text-slate-800 text-sm mb-3">Department Workload</h3>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={departments} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="department"
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={false}
                  width={90}
                />
                <Tooltip
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                />
                <Bar dataKey="count" fill="#1B4F8A" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── ROW 4: Charts ───────────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Hourly Order Volume */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-semibold text-slate-800 mb-4">Hourly Order Volume (Today)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={hourlyVolume}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }}
              />
              <Bar dataKey="orders" fill="#6366F1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top 10 Tests Today */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-semibold text-slate-800 mb-4">Top 10 Tests Today</h2>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width={180} height={180}>
              <PieChart>
                <Pie
                  data={topTests}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="count"
                >
                  {topTests.map((_, index) => (
                    <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-1.5 max-h-[200px] overflow-y-auto">
              {topTests.map((test, i) => (
                <div key={test.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    <span className="text-xs text-slate-600 truncate">{test.name}</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-800 ml-2">{test.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
