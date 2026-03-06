"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Banknote,
  Plus,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Clock,
  DollarSign,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import api from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────

interface PayrollRun {
  id: string;
  month: number;
  year: number;
  status: string;
  totalGross: number;
  totalNet: number;
  totalDeductions: number;
  createdAt: string;
}

interface PayrollEntry {
  id: string;
  userId: string;
  basic: number;
  hra: number;
  conveyance: number;
  otherAllowances: number;
  gross: number;
  pf: number;
  esi: number;
  tds: number;
  totalDeductions: number;
  net: number;
  lopDays: number;
  presentDays: number;
  status: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function monthName(m: number): string {
  return MONTH_NAMES[(m - 1 + 12) % 12] ?? String(m);
}

// ── Status Badges ──────────────────────────────────────────────────────────

function RunStatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; icon: React.ReactNode }> = {
    DRAFT: {
      cls: "bg-amber-50 border-amber-200 text-amber-700",
      icon: <Clock className="w-3 h-3" />,
    },
    APPROVED: {
      cls: "bg-blue-50 border-blue-200 text-blue-700",
      icon: <CheckCircle2 className="w-3 h-3" />,
    },
    PAID: {
      cls: "bg-green-50 border-green-200 text-green-700",
      icon: <Banknote className="w-3 h-3" />,
    },
  };
  const s = map[status] ?? map["DRAFT"];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${s.cls}`}>
      {s.icon}
      {status}
    </span>
  );
}

function EntryStatusBadge({ status }: { status: string }) {
  const cls =
    status === "PAID"
      ? "bg-green-50 border-green-200 text-green-700"
      : status === "APPROVED"
      ? "bg-blue-50 border-blue-200 text-blue-700"
      : "bg-amber-50 border-amber-200 text-amber-700";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {status}
    </span>
  );
}

// ── Run Payroll Modal ──────────────────────────────────────────────────────

function RunPayrollModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [month, setMonth] = useState(String(currentMonth));
  const [year, setYear] = useState(String(currentYear));
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      api.post("/hr/payroll", {
        month: parseInt(month, 10),
        year: parseInt(year, 10),
      }),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (e: unknown) => {
      setError(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "Failed to run payroll"
      );
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Run Payroll</h2>
        <p className="text-sm text-slate-500">
          This will generate payroll entries for all active employees for the selected month.
        </p>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Month</label>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{MONTH_NAMES[m - 1]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Year</label>
            <input
              type="number"
              min={currentYear - 2}
              max={currentYear + 1}
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            />
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
          Payroll for <strong>{monthName(parseInt(month, 10))} {year}</strong> will be created in DRAFT status. You can review and approve before payment.
        </div>
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="flex-1 px-4 py-2 bg-[#1B4F8A] rounded-lg text-sm font-semibold text-white hover:bg-[#163d6a] disabled:opacity-50"
          >
            {mutation.isPending ? "Running..." : "Run Payroll"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Expanded Entries ───────────────────────────────────────────────────────

function PayrollEntriesExpanded({ runId }: { runId: string }) {
  const { data: entries, isLoading } = useQuery({
    queryKey: ["payroll-entries", runId],
    queryFn: async () => {
      const res = await api.get<{ data: PayrollEntry[] }>(`/hr/payroll/${runId}/entries`);
      return res.data.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-slate-400 text-sm py-3 px-6">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#1B4F8A]" />
        Loading entries...
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return <p className="text-slate-400 text-sm py-3 px-6">No payroll entries found.</p>;
  }

  return (
    <div className="px-4 py-3 overflow-x-auto">
      <table className="w-full text-xs min-w-[900px]">
        <thead>
          <tr className="text-slate-500 uppercase border-b border-slate-200">
            {["Employee ID", "Basic", "HRA", "Conv.", "Other", "Gross", "PF", "ESI", "TDS", "Net", "LOP Days", "Present Days", "Status"].map((h) => (
              <th key={h} className="py-2 px-2 text-left font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="py-2 px-2 font-mono text-slate-600">{entry.userId.slice(0, 8)}...</td>
              <td className="py-2 px-2 text-slate-700">{formatCurrency(entry.basic)}</td>
              <td className="py-2 px-2 text-slate-700">{formatCurrency(entry.hra)}</td>
              <td className="py-2 px-2 text-slate-700">{formatCurrency(entry.conveyance)}</td>
              <td className="py-2 px-2 text-slate-700">{formatCurrency(entry.otherAllowances)}</td>
              <td className="py-2 px-2 font-semibold text-slate-800">{formatCurrency(entry.gross)}</td>
              <td className="py-2 px-2 text-red-600">-{formatCurrency(entry.pf)}</td>
              <td className="py-2 px-2 text-red-600">-{formatCurrency(entry.esi)}</td>
              <td className="py-2 px-2 text-red-600">-{formatCurrency(entry.tds)}</td>
              <td className="py-2 px-2 font-bold text-green-700">{formatCurrency(entry.net)}</td>
              <td className="py-2 px-2 text-slate-500">{entry.lopDays}</td>
              <td className="py-2 px-2 text-slate-500">{entry.presentDays}</td>
              <td className="py-2 px-2"><EntryStatusBadge status={entry.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Payroll Run Row ────────────────────────────────────────────────────────

function PayrollRunRow({ run }: { run: PayrollRun }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const approveMutation = useMutation({
    mutationFn: () => api.post(`/hr/payroll/${run.id}/approve`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr-payroll-runs"] }),
  });

  const paidMutation = useMutation({
    mutationFn: () => api.post(`/hr/payroll/${run.id}/paid`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr-payroll-runs"] }),
  });

  return (
    <>
      <tr className="border-b border-slate-100 hover:bg-slate-50">
        <td className="px-4 py-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 text-sm text-slate-700 hover:text-slate-900 font-semibold"
          >
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            {monthName(run.month)} {run.year}
          </button>
        </td>
        <td className="px-4 py-3"><RunStatusBadge status={run.status} /></td>
        <td className="px-4 py-3 font-semibold text-slate-800">{formatCurrency(run.totalGross)}</td>
        <td className="px-4 py-3 font-bold text-green-700">{formatCurrency(run.totalNet)}</td>
        <td className="px-4 py-3 text-red-600 font-medium">{formatCurrency(run.totalDeductions)}</td>
        <td className="px-4 py-3">
          <div className="flex gap-1.5">
            {run.status === "DRAFT" && (
              <button
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
                className="flex items-center gap-1 px-2 py-1 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100 disabled:opacity-50"
              >
                <CheckCircle2 className="w-3 h-3" />
                Approve
              </button>
            )}
            {run.status === "APPROVED" && (
              <button
                onClick={() => paidMutation.mutate()}
                disabled={paidMutation.isPending}
                className="flex items-center gap-1 px-2 py-1 text-xs font-semibold bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100 disabled:opacity-50"
              >
                <DollarSign className="w-3 h-3" />
                Mark Paid
              </button>
            )}
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 px-2 py-1 text-xs font-semibold bg-slate-50 text-slate-600 border border-slate-200 rounded hover:bg-slate-100"
            >
              {expanded ? "Hide" : "View"} Entries
            </button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-slate-50/70">
          <td colSpan={6} className="border-b border-slate-200">
            <PayrollEntriesExpanded runId={run.id} />
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function PayrollPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [showRun, setShowRun] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["hr-payroll-runs", page],
    queryFn: async () => {
      const res = await api.get<{ data: { data: PayrollRun[]; meta: { total: number } } }>(
        `/hr/payroll?page=${page}&limit=20`
      );
      return res.data.data;
    },
  });

  const runs = data?.data ?? [];
  const total = data?.meta.total ?? 0;

  // Summary across all displayed runs
  const totalGross = runs.reduce((s, r) => s + r.totalGross, 0);
  const totalNet = runs.reduce((s, r) => s + r.totalNet, 0);
  const totalDeductions = runs.reduce((s, r) => s + r.totalDeductions, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payroll</h1>
          <p className="text-sm text-slate-500 mt-0.5">Monthly salary runs, approval workflow, and payroll history</p>
        </div>
        <button
          onClick={() => setShowRun(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1B4F8A] text-white rounded-lg text-sm font-semibold hover:bg-[#163d6a]"
        >
          <Plus className="w-4 h-4" />
          Run Payroll
        </button>
      </div>

      {/* Summary Banner */}
      {runs.length > 0 && (
        <div className="bg-gradient-to-r from-[#1B4F8A] to-[#0D9488] rounded-2xl text-white p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-medium text-white/70 uppercase tracking-wider mb-1">
                Payroll Summary — Page {page}
              </p>
              <p className="text-3xl font-bold">{formatCurrency(totalNet)}</p>
              <p className="text-white/70 text-sm mt-0.5">Total net payout</p>
            </div>
            <Banknote className="w-12 h-12 text-white/20" />
          </div>
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/20 text-sm">
            <div>
              <p className="text-white/60 text-xs">Total Gross</p>
              <p className="font-semibold">{formatCurrency(totalGross)}</p>
            </div>
            <div>
              <p className="text-white/60 text-xs">Total Deductions</p>
              <p className="font-semibold">{formatCurrency(totalDeductions)}</p>
            </div>
            <div>
              <p className="text-white/60 text-xs">Payroll Runs</p>
              <p className="font-semibold">{runs.length}</p>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {["Month / Year", "Status", "Total Gross", "Total Net", "Total Deductions", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <td key={j} className="px-4 py-4">
                      <div className="h-4 bg-slate-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : runs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center">
                  <Banknote className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">No payroll runs found. Click "Run Payroll" to get started.</p>
                </td>
              </tr>
            ) : (
              runs.map((run) => <PayrollRunRow key={run.id} run={run} />)
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total} payroll runs
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 border border-slate-200 rounded text-sm disabled:opacity-40 hover:bg-slate-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page * 20 >= total}
              className="px-3 py-1.5 border border-slate-200 rounded text-sm disabled:opacity-40 hover:bg-slate-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {showRun && (
        <RunPayrollModal
          onClose={() => setShowRun(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["hr-payroll-runs"] });
          }}
        />
      )}
    </div>
  );
}
