"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Plus,
  Search,
  FlaskConical,
  X,
  BarChart3,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import api from "@/lib/api";

interface EQASRound {
  id: string;
  programName: string;
  roundNumber: string;
  year: number;
  startDate: string | null;
  endDate: string | null;
  status: string;
  overallScore: number | null;
  notes: string | null;
  results: EQASResult[];
  createdAt: string;
}

interface EQASResult {
  id: string;
  analyte: string;
  assignedValue: number | null;
  reportedValue: number | null;
  sdi: number | null;
  acceptableRange: string | null;
  evaluation: string | null;
}

interface DashboardStats {
  totalRuns: number;
  failedRuns: number;
  warningRuns: number;
  passRate: number;
  openCapas: number;
  openNCs: number;
  activeDocuments: number;
  overdueMaintenanceLogs: number;
}

const EVAL_STYLES: Record<string, { cls: string; icon: React.ReactNode }> = {
  ACCEPTABLE: { cls: "bg-green-50 text-green-700 border-green-200", icon: <CheckCircle2 className="w-3 h-3" /> },
  NEEDS_REVIEW: { cls: "bg-amber-50 text-amber-700 border-amber-200", icon: <AlertTriangle className="w-3 h-3" /> },
  UNACCEPTABLE: { cls: "bg-red-50 text-red-700 border-red-200", icon: <XCircle className="w-3 h-3" /> },
};

const ROUND_STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-slate-50 text-slate-600 border-slate-200",
  IN_PROGRESS: "bg-blue-50 text-blue-700 border-blue-200",
  SUBMITTED: "bg-green-50 text-green-700 border-green-200",
  EVALUATED: "bg-purple-50 text-purple-700 border-purple-200",
};

function AddRoundModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [programName, setProgramName] = useState("");
  const [roundNumber, setRoundNumber] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      api.post("/qc/eqas-rounds", {
        programName: programName.trim(), roundNumber: roundNumber.trim(), year,
        startDate: startDate || undefined, endDate: endDate || undefined,
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (e: unknown) => { setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed"); },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">New EQAS Round</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-400"><X className="w-5 h-5" /></button>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>}
        <form onSubmit={(e) => { e.preventDefault(); if (!programName.trim() || !roundNumber.trim()) { setError("Program and round required"); return; } mutation.mutate(); }} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Program Name *</label>
            <input type="text" value={programName} onChange={(e) => setProgramName(e.target.value)} placeholder="e.g. RIQAS, Bio-Rad, CAP" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Round Number *</label>
              <input type="text" value={roundNumber} onChange={(e) => setRoundNumber(e.target.value)} placeholder="e.g. R1, Cycle 3" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Year *</label>
              <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-semibold text-slate-600 mb-1">Start Date</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" /></div>
            <div><label className="block text-xs font-semibold text-slate-600 mb-1">End Date</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" /></div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Notes</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="flex-1 px-4 py-2 bg-blue-600 rounded-lg text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              {mutation.isPending ? "Creating..." : "Create Round"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function IQCEQASPage() {
  const queryClient = useQueryClient();
  const [showAddRound, setShowAddRound] = useState(false);
  const [search, setSearch] = useState("");

  const { data: qcStats } = useQuery({
    queryKey: ["qc-dashboard-stats"],
    queryFn: async () => {
      try {
        const res = await api.get("/qc/dashboard-stats");
        return (res.data?.data ?? res.data) as DashboardStats;
      } catch { return null; }
    },
  });

  const { data: eqasData, isLoading } = useQuery({
    queryKey: ["eqas-rounds"],
    queryFn: async () => {
      try {
        const res = await api.get("/qc/eqas-rounds?limit=50");
        const payload = res.data?.data ?? res.data;
        return payload as { data: EQASRound[]; total: number };
      } catch { return { data: [] as EQASRound[], total: 0 }; }
    },
  });

  const rounds = (eqasData?.data ?? []).filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.programName.toLowerCase().includes(q) || r.roundNumber.toLowerCase().includes(q);
  });

  const st = qcStats ?? { totalRuns: 0, failedRuns: 0, warningRuns: 0, passRate: 100, openCapas: 0, openNCs: 0, activeDocuments: 0, overdueMaintenanceLogs: 0 };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">IQC & EQAS Hub</h1>
          <p className="text-slate-500 text-sm mt-0.5">Internal Quality Control + External Quality Assessment</p>
        </div>
        <button onClick={() => setShowAddRound(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus className="w-4 h-4" /> New EQAS Round
        </button>
      </div>

      {/* IQC Stats (30-day) */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "QC Runs (30d)", value: st.totalRuns, icon: Activity, color: "bg-blue-50 text-blue-600" },
          { label: "Pass Rate", value: `${st.passRate}%`, icon: CheckCircle2, color: st.passRate >= 95 ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600" },
          { label: "Failures", value: st.failedRuns, icon: XCircle, color: st.failedRuns > 0 ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600" },
          { label: "Warnings", value: st.warningRuns, icon: AlertTriangle, color: st.warningRuns > 0 ? "bg-amber-50 text-amber-600" : "bg-green-50 text-green-600" },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${kpi.color}`}><Icon className="w-5 h-5" /></div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{kpi.value}</p>
                  <p className="text-xs text-slate-500">{kpi.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* EQAS Rounds */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">EQAS Rounds</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="search" placeholder="Search rounds..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 w-60" />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-slate-100 rounded-xl animate-pulse" />)}</div>
        ) : rounds.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-16 text-center">
            <FlaskConical className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No EQAS rounds found</p>
            <p className="text-slate-300 text-xs mt-1">Create a new round to start tracking external QC</p>
          </div>
        ) : (
          <div className="space-y-4">
            {rounds.map((round) => (
              <div key={round.id} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center">
                      <BarChart3 className="w-5 h-5 text-violet-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{round.programName} — {round.roundNumber}</h3>
                      <p className="text-xs text-slate-500">
                        Year: {round.year}
                        {round.startDate && ` · Start: ${formatDate(round.startDate)}`}
                        {round.endDate && ` · End: ${formatDate(round.endDate)}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {round.overallScore !== null && (
                      <span className={`text-lg font-bold ${round.overallScore >= 80 ? "text-green-600" : round.overallScore >= 60 ? "text-amber-600" : "text-red-600"}`}>
                        {round.overallScore}%
                      </span>
                    )}
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${ROUND_STATUS_STYLES[round.status] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}>
                      {round.status}
                    </span>
                  </div>
                </div>

                {/* Results table */}
                {round.results.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="text-left px-4 py-2 font-medium text-slate-500">Analyte</th>
                          <th className="text-left px-4 py-2 font-medium text-slate-500">Assigned</th>
                          <th className="text-left px-4 py-2 font-medium text-slate-500">Reported</th>
                          <th className="text-left px-4 py-2 font-medium text-slate-500">SDI</th>
                          <th className="text-left px-4 py-2 font-medium text-slate-500">Evaluation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {round.results.map((r) => {
                          const evalStyle = EVAL_STYLES[r.evaluation ?? ""] ?? { cls: "bg-slate-50 text-slate-600 border-slate-200", icon: null };
                          return (
                            <tr key={r.id} className="border-b border-slate-50 last:border-0">
                              <td className="px-4 py-2 font-medium text-slate-800">{r.analyte}</td>
                              <td className="px-4 py-2 text-slate-600">{r.assignedValue ?? "--"}</td>
                              <td className="px-4 py-2 text-slate-600">{r.reportedValue ?? "--"}</td>
                              <td className="px-4 py-2">
                                {r.sdi !== null ? (
                                  <span className={`font-mono text-xs ${Math.abs(r.sdi) > 2 ? "text-red-600 font-bold" : "text-slate-600"}`}>
                                    {r.sdi.toFixed(2)}
                                  </span>
                                ) : "--"}
                              </td>
                              <td className="px-4 py-2">
                                {r.evaluation && (
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${evalStyle.cls}`}>
                                    {evalStyle.icon} {r.evaluation}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {round.results.length === 0 && (
                  <div className="px-6 py-4 text-center text-xs text-slate-400">No results submitted yet</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showAddRound && (
        <AddRoundModal onClose={() => setShowAddRound(false)} onSuccess={() => queryClient.invalidateQueries({ queryKey: ["eqas-rounds"] })} />
      )}
    </div>
  );
}
