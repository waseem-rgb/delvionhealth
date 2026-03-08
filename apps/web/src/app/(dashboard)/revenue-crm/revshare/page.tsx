"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DollarSign,
  CheckCircle2,
  Clock,
  TrendingUp,
  Stethoscope,
  UserCheck,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

// ── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (v: number) => new Intl.NumberFormat("en-IN").format(v);

type TabKey = "DOCTOR" | "SALES_REP" | "SUMMARY";

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "DOCTOR", label: "Doctors", icon: Stethoscope },
  { key: "SALES_REP", label: "Sales Reps", icon: UserCheck },
  { key: "SUMMARY", label: "Summary", icon: BarChart3 },
];

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  PAID: "bg-green-500/20 text-green-400 border-green-500/30",
  PROCESSING: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

// ── Types ───────────────────────────────────────────────────────────────────

interface LedgerEntry {
  id: string;
  entityName: string;
  entityType: string;
  revenueGenerated: number;
  revSharePercent: number;
  amountEarned: number;
  status: string;
  month: number;
  year: number;
}

interface RevShareSummary {
  entityType: string;
  totalRevenue: number;
  totalEarned: number;
  totalPaid: number;
  totalPending: number;
  count: number;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function RevSharePage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>("DOCTOR");
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  // Ledger query (for DOCTOR and SALES_REP tabs)
  const ledgerQuery = useQuery({
    queryKey: ["revenue-crm", "revshare", "ledger", activeTab, month, year],
    queryFn: async () => {
      const res = await api.get("/revenue-crm/revshare/ledger", {
        params: { entityType: activeTab, month, year },
      });
      const raw = res.data?.data ?? res.data;
      return (Array.isArray(raw) ? raw : (raw?.items ?? raw?.ledger ?? [])) as LedgerEntry[];
    },
    enabled: activeTab !== "SUMMARY",
  });

  // Summary query
  const summaryQuery = useQuery({
    queryKey: ["revenue-crm", "revshare", "summary"],
    queryFn: async () => {
      const res = await api.get("/revenue-crm/revshare/summary");
      const raw = res.data?.data ?? res.data;
      return (Array.isArray(raw) ? raw : (raw?.items ?? raw?.summary ?? [])) as RevShareSummary[];
    },
    enabled: activeTab === "SUMMARY",
  });

  // Mark paid mutation
  const markPaidMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.patch(`/revenue-crm/revshare/${id}/pay`);
      return res.data?.data ?? res.data;
    },
    onSuccess: () => {
      toast.success("Marked as paid");
      queryClient.invalidateQueries({
        queryKey: ["revenue-crm", "revshare"],
      });
    },
    onError: () => toast.error("Failed to mark as paid"),
  });

  const ledger = ledgerQuery.data ?? [];
  const summary = summaryQuery.data ?? [];

  const totalEarned = ledger.reduce((s, e) => s + e.amountEarned, 0);
  const totalPaid = ledger
    .filter((e) => e.status === "PAID")
    .reduce((s, e) => s + e.amountEarned, 0);
  const totalPending = totalEarned - totalPaid;

  const isLoading =
    activeTab === "SUMMARY" ? summaryQuery.isLoading : ledgerQuery.isLoading;
  const isError =
    activeTab === "SUMMARY" ? summaryQuery.isError : ledgerQuery.isError;
  const errorObj =
    activeTab === "SUMMARY" ? summaryQuery.error : ledgerQuery.error;

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Rev Share</h1>
        <p className="text-slate-400">
          Track and manage rev share for doctors and sales reps
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1 w-fit">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Loading */}
      {isLoading && (
        <div>
          <div className="mb-6 grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-xl bg-slate-900"
              />
            ))}
          </div>
          <div className="h-64 animate-pulse rounded-xl bg-slate-900" />
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-400">
          Failed to load rev share data:{" "}
          {errorObj instanceof Error ? errorObj.message : "Unknown error"}
        </div>
      )}

      {/* ── DOCTOR / SALES_REP Tab ─────────────────────────────────────── */}
      {!isLoading && !isError && activeTab !== "SUMMARY" && (
        <>
          {/* Month/Year Selector */}
          <div className="mb-6 flex items-center gap-3">
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2000, i).toLocaleString("default", {
                    month: "long",
                  })}
                </option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            >
              {Array.from({ length: 5 }, (_, i) => {
                const y = now.getFullYear() - 2 + i;
                return (
                  <option key={y} value={y}>
                    {y}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Header Stats */}
          <div className="mb-6 grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <TrendingUp className="h-4 w-4" />
                Total Earned
              </div>
              <p className="mt-1 text-xl font-bold text-white">
                {fmt(totalEarned)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                Paid
              </div>
              <p className="mt-1 text-xl font-bold text-green-400">
                {fmt(totalPaid)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Clock className="h-4 w-4 text-yellow-400" />
                Pending
              </div>
              <p className="mt-1 text-xl font-bold text-yellow-400">
                {fmt(totalPending)}
              </p>
            </div>
          </div>

          {/* Table */}
          {ledger.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900 py-20">
              <DollarSign className="mb-4 h-12 w-12 text-slate-600" />
              <p className="text-lg font-medium text-slate-400">
                No data found
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-800">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900">
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">
                      {activeTab === "DOCTOR" ? "Doctor" : "Sales Rep"}
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-400">
                      Revenue Generated
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-400">
                      Rev Share %
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-400">
                      Amount Earned
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-slate-400">
                      Status
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-slate-400">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b border-slate-800/50 bg-slate-900/50 hover:bg-slate-800/50"
                    >
                      <td className="px-4 py-3 text-sm text-white">
                        {entry.entityName}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-slate-300">
                        {fmt(entry.revenueGenerated)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-slate-300">
                        {entry.revSharePercent}%
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-white">
                        {fmt(entry.amountEarned)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[entry.status] ?? "bg-slate-700 text-slate-300"}`}
                        >
                          {entry.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {entry.status !== "PAID" && (
                          <button
                            onClick={() => markPaidMutation.mutate(entry.id)}
                            disabled={markPaidMutation.isPending}
                            className="rounded-lg bg-green-600/20 px-3 py-1 text-xs font-medium text-green-400 hover:bg-green-600/30 disabled:opacity-50"
                          >
                            Mark Paid
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── SUMMARY Tab ────────────────────────────────────────────────── */}
      {!isLoading && !isError && activeTab === "SUMMARY" && (
        <>
          {summary.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900 py-20">
              <BarChart3 className="mb-4 h-12 w-12 text-slate-600" />
              <p className="text-lg font-medium text-slate-400">
                No data found
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {summary.map((s) => (
                <div
                  key={s.entityType}
                  className="rounded-xl border border-slate-800 bg-slate-900 p-6"
                >
                  <h3 className="mb-4 text-lg font-semibold text-white">
                    {s.entityType === "DOCTOR" ? "Doctors" : "Sales Reps"}
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-slate-400">Total Revenue</p>
                      <p className="text-lg font-bold text-white">
                        {fmt(s.totalRevenue)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">Total Earned</p>
                      <p className="text-lg font-bold text-white">
                        {fmt(s.totalEarned)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">Paid</p>
                      <p className="text-lg font-bold text-green-400">
                        {fmt(s.totalPaid)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">Pending</p>
                      <p className="text-lg font-bold text-yellow-400">
                        {fmt(s.totalPending)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 border-t border-slate-800 pt-3">
                    <p className="text-sm text-slate-500">
                      {s.count}{" "}
                      {s.entityType === "DOCTOR" ? "doctors" : "sales reps"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
