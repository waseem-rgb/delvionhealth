"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  IndianRupee,
  ClipboardList,
  Download,
  CreditCard,
  Clock,
  TrendingUp,
  Loader2,
  FlaskConical,
  Users,
  TestTubes,
} from "lucide-react";
import { format } from "date-fns";
import api from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { formatCurrency } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────
interface DailyCollectionData {
  totalOrders: number;
  totalRevenue: number;
  paymentMethods: Array<{ method: string; amount: number; count: number }>;
  hourlyBreakdown: Array<{ hour: string; orders: number; revenue: number }>;
}

interface EndOfDayData {
  gross: number;
  discounts: number;
  collections: number;
  refunds: number;
  net: number;
  byMode: Array<{ mode: string; amount: number; count: number }>;
}

interface TatData {
  overallAvg: number;
  slaBreachRate: number;
  perTest: Array<{ testName: string; avgHours: number; targetHours: number; count: number; breachPct: number }>;
  distribution: Array<{ bucket: string; count: number }>;
}

interface TestWiseData {
  tests: Array<{ testName: string; count: number; revenue: number; abnormalRate: number }>;
  totalCount: number;
  totalRevenue: number;
}

interface DoctorWiseData {
  doctors: Array<{ doctorName: string; orders: number; revenue: number; commission: number }>;
}

interface SampleMovementData {
  statusBreakdown: Array<{ status: string; count: number }>;
}

// ─── Tab definitions ──────────────────────────────────────────────
const TABS = [
  { id: "daily", label: "Daily Collection" },
  { id: "eod", label: "End of Day" },
  { id: "tat", label: "TAT Analysis" },
  { id: "tests", label: "Test-wise" },
  { id: "doctors", label: "Doctor-wise" },
  { id: "samples", label: "Sample Movement" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const CHART_COLORS = ["#1B4F8A", "#0D9488", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#6366F1", "#10B981"];

const STATUS_COLORS: Record<string, string> = {
  COLLECTED: "bg-blue-100 text-blue-700",
  RECEIVED: "bg-teal-100 text-teal-700",
  IN_PROCESS: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  PENDING: "bg-slate-100 text-slate-600",
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function last30From(): string {
  return new Date(Date.now() - 29 * 86400_000).toISOString().slice(0, 10);
}

// ─── Daily Collection Tab ─────────────────────────────────────────
function DailyCollectionTab() {
  const [date, setDate] = useState(todayISO());

  const { data, isLoading } = useQuery<DailyCollectionData>({
    queryKey: ["mis-daily", date],
    queryFn: () => api.get(`/mis/daily-collection?date=${date}`).then((r) => r.data.data as DailyCollectionData),
  });

  const d = data ?? { totalOrders: 0, totalRevenue: 0, paymentMethods: [], hourlyBreakdown: [] };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={() => console.log("Export daily collection", date)}
          className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <Download className="w-3.5 h-3.5" /> Export
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 rounded-lg bg-blue-100">
                  <ClipboardList className="w-5 h-5 text-blue-600" />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900">{d.totalOrders}</p>
              <p className="text-sm text-slate-500 mt-0.5">Total Orders</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 rounded-lg bg-green-100">
                  <IndianRupee className="w-5 h-5 text-green-600" />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900">{formatCurrency(d.totalRevenue)}</p>
              <p className="text-sm text-slate-500 mt-0.5">Total Revenue</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 rounded-lg bg-purple-100">
                  <CreditCard className="w-5 h-5 text-purple-600" />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900">{d.paymentMethods.length}</p>
              <p className="text-sm text-slate-500 mt-0.5">Payment Methods</p>
            </div>
          </div>

          {/* Payment method bar chart */}
          {d.paymentMethods.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <h3 className="font-semibold text-slate-800 mb-4">Collection by Payment Method</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={d.paymentMethods}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="method" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v))}
                  />
                  <Tooltip
                    formatter={(v: number) => [formatCurrency(v), "Amount"]}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                  />
                  <Bar dataKey="amount" fill="#1B4F8A" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Hourly breakdown area chart */}
          {d.hourlyBreakdown.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <h3 className="font-semibold text-slate-800 mb-4">Hourly Breakdown</h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={d.hourlyBreakdown}>
                  <defs>
                    <linearGradient id="hourlyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0D9488" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#0D9488" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                  />
                  <Area type="monotone" dataKey="orders" stroke="#0D9488" strokeWidth={2} fill="url(#hourlyGrad)" name="Orders" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── End of Day Tab ───────────────────────────────────────────────
function EndOfDayTab() {
  const [date, setDate] = useState(todayISO());

  const { data, isLoading } = useQuery<EndOfDayData>({
    queryKey: ["mis-eod", date],
    queryFn: () => api.get(`/mis/end-of-day?date=${date}`).then((r) => r.data.data as EndOfDayData),
  });

  const d = data ?? { gross: 0, discounts: 0, collections: 0, refunds: 0, net: 0, byMode: [] };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={() => console.log("Export EOD", date)}
          className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <Download className="w-3.5 h-3.5" /> Export
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { label: "Gross", value: d.gross, color: "bg-blue-100 text-blue-600" },
              { label: "Discounts", value: d.discounts, color: "bg-amber-100 text-amber-600" },
              { label: "Collections", value: d.collections, color: "bg-green-100 text-green-600" },
              { label: "Refunds", value: d.refunds, color: "bg-red-100 text-red-600" },
              { label: "Net Amount", value: d.net, color: "bg-purple-100 text-purple-600" },
            ].map((card) => (
              <div key={card.label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${card.color.split(" ")[0]}`}>
                  <IndianRupee className={`w-4 h-4 ${card.color.split(" ")[1]}`} />
                </div>
                <p className="text-xl font-bold text-slate-900">{formatCurrency(card.value)}</p>
                <p className="text-xs text-slate-500 mt-0.5">{card.label}</p>
              </div>
            ))}
          </div>

          {d.byMode.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="font-semibold text-slate-800 text-sm">Collection by Mode</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-5 py-3 font-medium text-slate-500 text-xs uppercase">Mode</th>
                    <th className="text-right px-5 py-3 font-medium text-slate-500 text-xs uppercase">Count</th>
                    <th className="text-right px-5 py-3 font-medium text-slate-500 text-xs uppercase">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {d.byMode.map((row) => (
                    <tr key={row.mode} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium text-slate-800">{row.mode}</td>
                      <td className="px-5 py-3 text-right text-slate-600">{row.count}</td>
                      <td className="px-5 py-3 text-right font-semibold text-slate-900">{formatCurrency(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── TAT Analysis Tab ─────────────────────────────────────────────
function TatAnalysisTab() {
  const [dateFrom, setDateFrom] = useState(last30From());
  const [dateTo, setDateTo] = useState(todayISO());

  const { data, isLoading } = useQuery<TatData>({
    queryKey: ["mis-tat", dateFrom, dateTo],
    queryFn: () =>
      api.get(`/mis/tat?from=${dateFrom}&to=${dateTo}`).then((r) => r.data.data as TatData),
  });

  const d = data ?? { overallAvg: 0, slaBreachRate: 0, perTest: [], distribution: [] };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              max={dateTo}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              min={dateFrom}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <button
          onClick={() => console.log("Export TAT", dateFrom, dateTo)}
          className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <Download className="w-3.5 h-3.5" /> Export
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 rounded-lg bg-blue-100">
                  <Clock className="w-5 h-5 text-blue-600" />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900">{d.overallAvg.toFixed(1)}h</p>
              <p className="text-sm text-slate-500 mt-0.5">Overall Average TAT</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 rounded-lg bg-red-100">
                  <TrendingUp className="w-5 h-5 text-red-600" />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900">{d.slaBreachRate.toFixed(1)}%</p>
              <p className="text-sm text-slate-500 mt-0.5">SLA Breach Rate</p>
            </div>
          </div>

          {/* TAT Distribution chart */}
          {d.distribution.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <h3 className="font-semibold text-slate-800 mb-4">TAT Distribution</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={d.distribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }} />
                  <Bar dataKey="count" fill="#1B4F8A" radius={[4, 4, 0, 0]} name="Samples" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Per-test TAT table */}
          {d.perTest.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="font-semibold text-slate-800 text-sm">TAT per Test (sorted by Avg TAT desc)</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-5 py-3 font-medium text-slate-500 text-xs uppercase">Test</th>
                    <th className="text-right px-5 py-3 font-medium text-slate-500 text-xs uppercase">Count</th>
                    <th className="text-right px-5 py-3 font-medium text-slate-500 text-xs uppercase">Avg TAT</th>
                    <th className="text-right px-5 py-3 font-medium text-slate-500 text-xs uppercase">Target</th>
                    <th className="text-right px-5 py-3 font-medium text-slate-500 text-xs uppercase">Breach %</th>
                    <th className="px-5 py-3 font-medium text-slate-500 text-xs uppercase">Performance</th>
                  </tr>
                </thead>
                <tbody>
                  {[...d.perTest]
                    .sort((a, b) => b.avgHours - a.avgHours)
                    .map((row) => {
                      const onTarget = row.avgHours <= row.targetHours;
                      return (
                        <tr key={row.testName} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="px-5 py-3 font-medium text-slate-800">{row.testName}</td>
                          <td className="px-5 py-3 text-right text-slate-600">{row.count}</td>
                          <td className={`px-5 py-3 text-right font-semibold ${onTarget ? "text-green-600" : "text-red-500"}`}>
                            {row.avgHours.toFixed(1)}h
                          </td>
                          <td className="px-5 py-3 text-right text-slate-500">{row.targetHours}h</td>
                          <td className="px-5 py-3 text-right">
                            <span className={`text-xs font-medium ${row.breachPct > 20 ? "text-red-500" : row.breachPct > 10 ? "text-amber-600" : "text-green-600"}`}>
                              {row.breachPct.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-5 py-3 w-28">
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${onTarget ? "bg-green-500" : "bg-red-400"}`}
                                style={{ width: `${Math.min((row.avgHours / (row.targetHours * 1.5)) * 100, 100)}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Test-wise Tab ────────────────────────────────────────────────
function TestWiseTab() {
  const [dateFrom, setDateFrom] = useState(last30From());
  const [dateTo, setDateTo] = useState(todayISO());

  const { data, isLoading } = useQuery<TestWiseData>({
    queryKey: ["mis-tests", dateFrom, dateTo],
    queryFn: () =>
      api.get(`/mis/tests?from=${dateFrom}&to=${dateTo}`).then((r) => r.data.data as TestWiseData),
  });

  const d = data ?? { tests: [], totalCount: 0, totalRevenue: 0 };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              max={dateTo}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              min={dateFrom}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <button
          onClick={() => console.log("Export tests", dateFrom, dateTo)}
          className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <Download className="w-3.5 h-3.5" /> Export
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-3 font-medium text-slate-500 text-xs uppercase">Test Name</th>
                <th className="text-right px-5 py-3 font-medium text-slate-500 text-xs uppercase">Count</th>
                <th className="text-right px-5 py-3 font-medium text-slate-500 text-xs uppercase">Revenue</th>
                <th className="text-right px-5 py-3 font-medium text-slate-500 text-xs uppercase">Abnormal Rate</th>
              </tr>
            </thead>
            <tbody>
              {d.tests.map((row) => (
                <tr key={row.testName} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-800">{row.testName}</td>
                  <td className="px-5 py-3 text-right text-slate-600">{row.count}</td>
                  <td className="px-5 py-3 text-right text-slate-800">{formatCurrency(row.revenue)}</td>
                  <td className="px-5 py-3 text-right">
                    <span className={`text-xs font-medium ${row.abnormalRate > 30 ? "text-red-500" : row.abnormalRate > 15 ? "text-amber-600" : "text-green-600"}`}>
                      {row.abnormalRate.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
              {d.tests.length > 0 && (
                <tr className="bg-slate-50 font-semibold">
                  <td className="px-5 py-3 text-slate-900">Total</td>
                  <td className="px-5 py-3 text-right text-slate-900">{d.totalCount}</td>
                  <td className="px-5 py-3 text-right text-slate-900">{formatCurrency(d.totalRevenue)}</td>
                  <td className="px-5 py-3 text-right text-slate-400">-</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Doctor-wise Tab ──────────────────────────────────────────────
function DoctorWiseTab() {
  const [dateFrom, setDateFrom] = useState(last30From());
  const [dateTo, setDateTo] = useState(todayISO());

  const { data, isLoading } = useQuery<DoctorWiseData>({
    queryKey: ["mis-doctors", dateFrom, dateTo],
    queryFn: () =>
      api.get(`/mis/doctors?from=${dateFrom}&to=${dateTo}`).then((r) => r.data.data as DoctorWiseData),
  });

  const d = data ?? { doctors: [] };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              max={dateTo}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              min={dateFrom}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <button
          onClick={() => console.log("Export doctors", dateFrom, dateTo)}
          className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <Download className="w-3.5 h-3.5" /> Export
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-3 font-medium text-slate-500 text-xs uppercase">Doctor Name</th>
                <th className="text-right px-5 py-3 font-medium text-slate-500 text-xs uppercase">Orders</th>
                <th className="text-right px-5 py-3 font-medium text-slate-500 text-xs uppercase">Revenue</th>
                <th className="text-right px-5 py-3 font-medium text-slate-500 text-xs uppercase">Commission</th>
              </tr>
            </thead>
            <tbody>
              {d.doctors.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-slate-400 text-sm">
                    No data available for the selected period
                  </td>
                </tr>
              ) : (
                d.doctors.map((row) => (
                  <tr key={row.doctorName} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-800">{row.doctorName}</td>
                    <td className="px-5 py-3 text-right text-slate-600">{row.orders}</td>
                    <td className="px-5 py-3 text-right text-slate-800">{formatCurrency(row.revenue)}</td>
                    <td className="px-5 py-3 text-right text-green-600 font-medium">{formatCurrency(row.commission)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Sample Movement Tab ──────────────────────────────────────────
function SampleMovementTab() {
  const [date, setDate] = useState(todayISO());

  const { data, isLoading } = useQuery<SampleMovementData>({
    queryKey: ["mis-samples", date],
    queryFn: () =>
      api.get(`/mis/sample-movement?date=${date}`).then((r) => r.data.data as SampleMovementData),
  });

  const d = data ?? { statusBreakdown: [] };
  const total = d.statusBreakdown.reduce((s, r) => s + r.count, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={() => console.log("Export sample movement", date)}
          className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <Download className="w-3.5 h-3.5" /> Export
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 rounded-lg bg-blue-100">
                  <TestTubes className="w-5 h-5 text-blue-600" />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900">{total}</p>
              <p className="text-sm text-slate-500 mt-0.5">Total Samples</p>
            </div>
            {d.statusBreakdown.map((row) => (
              <div key={row.status} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mb-3 ${STATUS_COLORS[row.status] ?? "bg-slate-100 text-slate-600"}`}>
                  {row.status.replace(/_/g, " ")}
                </span>
                <p className="text-2xl font-bold text-slate-900">{row.count}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {total > 0 ? ((row.count / total) * 100).toFixed(1) : 0}% of total
                </p>
              </div>
            ))}
          </div>

          {d.statusBreakdown.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <h3 className="font-semibold text-slate-800 mb-4">Status Distribution</h3>
              <div className="flex items-center gap-6">
                <ResponsiveContainer width={200} height={200}>
                  <PieChart>
                    <Pie
                      data={d.statusBreakdown.map((r) => ({ name: r.status.replace(/_/g, " "), value: r.count }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {d.statusBreakdown.map((_, index) => (
                        <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {d.statusBreakdown.map((row, i) => (
                    <div key={row.status} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                        />
                        <span className="text-xs text-slate-600">{row.status.replace(/_/g, " ")}</span>
                      </div>
                      <span className="text-xs font-semibold text-slate-800">{row.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────
export default function MISReportsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("daily");

  const tabContent: Record<TabId, React.ReactNode> = {
    daily: <DailyCollectionTab />,
    eod: <EndOfDayTab />,
    tat: <TatAnalysisTab />,
    tests: <TestWiseTab />,
    doctors: <DoctorWiseTab />,
    samples: <SampleMovementTab />,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="MIS Reports"
        subtitle="Management Information System reports and analytics"
        breadcrumbs={[{ label: "Reports", href: "/reports" }]}
      />

      {/* Tab navigation */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>{tabContent[activeTab]}</div>
    </div>
  );
}
