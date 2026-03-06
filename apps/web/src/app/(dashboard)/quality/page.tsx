"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck,
  Plus,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingUp,
  FileText,
  X,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import api from "@/lib/api";

interface DashboardStats {
  totalRunsToday: number;
  inControlToday: number;
  flaggedToday: number;
  openCapas: number;
  expiringDocuments: number;
  documentsTotal: number;
  runsByDepartment: { dept: string; total: number; flagged: number }[];
  last7DaysTrend: { date: string; total: number; flagged: number }[];
}

interface QCRun {
  id: string;
  analyte: string;
  department: string | null;
  parameter: string | null;
  level: string;
  value: string;
  mean: string;
  sd: string;
  zScore: string | null;
  westgardFlag: string | null;
  isAccepted: boolean;
  runAt: string;
  instrument: { name: string } | null;
  runBy: { firstName: string; lastName: string } | null;
}

interface VaultStatus {
  total: number;
  byType: Record<string, { total: number; valid: number; expiring: number; expired: number }>;
}

const FLAG_STYLES: Record<string, string> = {
  IN_CONTROL: "bg-green-50 text-green-700 border-green-200",
  "1_2S": "bg-amber-50 text-amber-700 border-amber-200",
  "1_3S": "bg-red-50 text-red-700 border-red-200",
};

function NewQCRunModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (data: QCRun) => void }) {
  const [form, setForm] = useState({
    department: "", instrumentId: "", parameter: "", level: "L1",
    lotNo: "", expiryDate: "", observedValue: "", mean: "", sd: "", branchId: "",
    analyte: "",
  });
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/quality/qc-runs", {
        branchId: form.branchId || "default",
        instrumentId: form.instrumentId || "default",
        analyte: form.analyte || form.parameter,
        level: form.level,
        value: Number(form.observedValue),
        mean: Number(form.mean),
        sd: Number(form.sd),
        department: form.department || undefined,
        parameter: form.parameter || undefined,
        lotNo: form.lotNo || undefined,
        expiryDate: form.expiryDate || undefined,
        observedValue: Number(form.observedValue),
      });
      return (res.data?.data ?? res.data) as QCRun;
    },
    onSuccess: (data) => { onSuccess(data); onClose(); },
    onError: (e: unknown) => {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to record QC run");
    },
  });

  const set = (key: string, val: string) => setForm((p) => ({ ...p, [key]: val }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">New QC Run</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-400"><X className="w-5 h-5" /></button>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>}
        <form onSubmit={(e) => {
          e.preventDefault();
          if (!form.observedValue || !form.mean || !form.sd) { setError("Value, Mean, SD are required"); return; }
          mutation.mutate();
        }} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Department</label>
              <select value={form.department} onChange={(e) => set("department", e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                <option value="">Select...</option>
                {["Biochemistry", "Haematology", "Urine", "Immunoassay", "Microbiology", "Serology"].map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Instrument ID</label>
              <input type="text" value={form.instrumentId} onChange={(e) => set("instrumentId", e.target.value)} placeholder="Instrument ID" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Parameter / Analyte *</label>
              <input type="text" value={form.parameter} onChange={(e) => { set("parameter", e.target.value); set("analyte", e.target.value); }} placeholder="e.g. Glucose, HbA1c" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Level *</label>
              <select value={form.level} onChange={(e) => set("level", e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                <option value="L1">Level 1 (Normal)</option>
                <option value="L2">Level 2 (Abnormal)</option>
                <option value="L3">Level 3 (Critical)</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Lot No</label>
              <input type="text" value={form.lotNo} onChange={(e) => set("lotNo", e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Expiry Date</label>
              <input type="date" value={form.expiryDate} onChange={(e) => set("expiryDate", e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Observed Value *</label>
              <input type="number" step="any" value={form.observedValue} onChange={(e) => set("observedValue", e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Mean *</label>
              <input type="number" step="any" value={form.mean} onChange={(e) => set("mean", e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">SD *</label>
              <input type="number" step="any" value={form.sd} onChange={(e) => set("sd", e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="flex-1 px-4 py-2 bg-blue-600 rounded-lg text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              {mutation.isPending ? "Recording..." : "Record Run"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ToastBanner({ flag, onDismiss }: { flag: string | null; onDismiss: () => void }) {
  if (!flag) return null;
  const styles: Record<string, { bg: string; text: string }> = {
    IN_CONTROL: { bg: "bg-green-50 border-green-200", text: "IN CONTROL — QC passed" },
    "1_2S": { bg: "bg-amber-50 border-amber-200", text: "1-2S WARNING — Review recommended" },
    "1_3S": { bg: "bg-red-50 border-red-200", text: "1-3S REJECTION — CAPA auto-created" },
  };
  const s = styles[flag] ?? styles["IN_CONTROL"];
  return (
    <div className={`${s.bg} border rounded-lg px-4 py-3 flex items-center justify-between`}>
      <span className="text-sm font-semibold">{s.text}</span>
      <button onClick={onDismiss} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
    </div>
  );
}

export default function QualityDashboardPage() {
  const queryClient = useQueryClient();
  const [showNewRun, setShowNewRun] = useState(false);
  const [lastFlag, setLastFlag] = useState<string | null>(null);

  const { data: stats, isLoading } = useQuery({
    queryKey: ["quality-dashboard-stats"],
    queryFn: async () => {
      const res = await api.get("/quality/qc-runs/dashboard");
      return (res.data?.data ?? res.data) as DashboardStats;
    },
  });

  const { data: runsData } = useQuery({
    queryKey: ["quality-recent-runs"],
    queryFn: async () => {
      const res = await api.get("/quality/qc-runs?limit=10");
      return (res.data?.data ?? res.data) as { data: QCRun[]; total: number };
    },
  });

  const { data: vaultStatus } = useQuery({
    queryKey: ["quality-vault-status"],
    queryFn: async () => {
      const res = await api.get("/quality/documents/vault-status");
      return (res.data?.data ?? res.data) as VaultStatus;
    },
  });

  const st = stats ?? {
    totalRunsToday: 0, inControlToday: 0, flaggedToday: 0, openCapas: 0,
    expiringDocuments: 0, documentsTotal: 0, runsByDepartment: [], last7DaysTrend: [],
  };

  const auditReadiness = st.totalRunsToday > 0
    ? Math.round((st.inControlToday / st.totalRunsToday) * 100)
    : 100;

  const runs = runsData?.data ?? [];
  const vault = vaultStatus?.byType ?? {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quality & Compliance</h1>
          <p className="text-slate-500 text-sm mt-0.5">Today: {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
        <button onClick={() => setShowNewRun(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus className="w-4 h-4" /> New QC Run
        </button>
      </div>

      {lastFlag && <ToastBanner flag={lastFlag} onDismiss={() => setLastFlag(null)} />}

      {isLoading ? (
        <div className="grid grid-cols-6 gap-4">{[...Array(6)].map((_, i) => <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="grid grid-cols-6 gap-4">
          {[
            { label: "Runs Today", value: st.totalRunsToday, icon: Activity, color: "bg-blue-50 text-blue-600" },
            { label: "In Control", value: st.inControlToday, icon: CheckCircle2, color: "bg-green-50 text-green-600" },
            { label: "Flagged Today", value: st.flaggedToday, icon: XCircle, color: st.flaggedToday > 0 ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600" },
            { label: "Open CAPAs", value: st.openCapas, icon: AlertTriangle, color: st.openCapas > 0 ? "bg-amber-50 text-amber-600" : "bg-green-50 text-green-600" },
            { label: "Expiring Certs", value: st.expiringDocuments, icon: FileText, color: st.expiringDocuments > 0 ? "bg-amber-50 text-amber-600" : "bg-green-50 text-green-600" },
            { label: "Audit Readiness", value: `${auditReadiness}%`, icon: ShieldCheck, color: auditReadiness >= 95 ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600" },
          ].map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div key={kpi.label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${kpi.color}`}><Icon className="w-4 h-4" /></div>
                  <div>
                    <p className="text-xl font-bold text-slate-900">{kpi.value}</p>
                    <p className="text-[11px] text-slate-500">{kpi.label}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Department status + 7-day trend */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
          <h3 className="font-semibold text-slate-900 mb-4">IQC Status by Department</h3>
          {st.runsByDepartment.length === 0 ? (
            <p className="text-sm text-slate-400">No department data yet today</p>
          ) : (
            <div className="space-y-3">
              {st.runsByDepartment.map((d) => {
                const passRate = d.total > 0 ? Math.round(((d.total - d.flagged) / d.total) * 100) : 100;
                return (
                  <div key={d.dept}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700">{d.dept}</span>
                      <span className={`text-sm font-bold ${passRate >= 95 ? "text-green-600" : passRate >= 80 ? "text-amber-600" : "text-red-600"}`}>{passRate}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div className={`h-2 rounded-full ${passRate >= 95 ? "bg-green-500" : passRate >= 80 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${passRate}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
          <h3 className="font-semibold text-slate-900 mb-4">7-Day Trend</h3>
          {st.last7DaysTrend.length === 0 ? (
            <p className="text-sm text-slate-400">No trend data yet</p>
          ) : (
            <div className="space-y-2">
              {st.last7DaysTrend.map((d) => (
                <div key={d.date} className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-20">{d.date}</span>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 bg-slate-100 rounded-full h-4 relative overflow-hidden">
                      <div className="bg-green-500 h-4 rounded-full" style={{ width: `${d.total > 0 ? ((d.total - d.flagged) / d.total) * 100 : 0}%` }} />
                      {d.flagged > 0 && <div className="bg-red-400 h-4 absolute right-0 top-0 rounded-r-full" style={{ width: `${(d.flagged / d.total) * 100}%` }} />}
                    </div>
                    <span className="text-xs text-slate-500 w-12 text-right">{d.total} runs</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent QC Runs */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-50">
          <h3 className="font-semibold text-slate-900">Recent QC Runs</h3>
        </div>
        {runs.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">No QC runs recorded yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-4 py-2 font-medium text-slate-500">Date</th>
                <th className="text-left px-4 py-2 font-medium text-slate-500">Dept</th>
                <th className="text-left px-4 py-2 font-medium text-slate-500">Parameter</th>
                <th className="text-left px-4 py-2 font-medium text-slate-500">Level</th>
                <th className="text-left px-4 py-2 font-medium text-slate-500">Value</th>
                <th className="text-left px-4 py-2 font-medium text-slate-500">Z-Score</th>
                <th className="text-left px-4 py-2 font-medium text-slate-500">Flag</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className={`border-b border-slate-50 last:border-0 ${!run.isAccepted ? "bg-red-50/50" : run.westgardFlag === "1_2S" ? "bg-amber-50/30" : ""}`}>
                  <td className="px-4 py-2 text-slate-600">{formatDate(run.runAt)}</td>
                  <td className="px-4 py-2 text-slate-600">{run.department ?? "—"}</td>
                  <td className="px-4 py-2 font-medium text-slate-800">{run.parameter ?? run.analyte}</td>
                  <td className="px-4 py-2 text-slate-600">{run.level}</td>
                  <td className="px-4 py-2 font-mono text-slate-700">{run.value}</td>
                  <td className="px-4 py-2 font-mono text-slate-700">{run.zScore ?? "—"}</td>
                  <td className="px-4 py-2">
                    {run.westgardFlag && (
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${FLAG_STYLES[run.westgardFlag] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}>
                        {run.westgardFlag}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Document Vault Status */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Document Vault Status</h3>
        {Object.keys(vault).length === 0 ? (
          <p className="text-sm text-slate-400">No documents in vault</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {Object.entries(vault).map(([type, counts]) => {
              let badge = "bg-green-50 text-green-700 border-green-200";
              let label = "VALID";
              if (counts.expired > 0) { badge = "bg-red-50 text-red-700 border-red-200"; label = "EXPIRED"; }
              else if (counts.expiring > 0) { badge = "bg-amber-50 text-amber-700 border-amber-200"; label = `${counts.expiring} expiring`; }
              return (
                <div key={type} className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${badge}`}>
                  <span className="text-sm font-semibold">{type}</span>
                  <span className="text-xs">{label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showNewRun && (
        <NewQCRunModal
          onClose={() => setShowNewRun(false)}
          onSuccess={(data) => {
            setLastFlag(data.westgardFlag);
            queryClient.invalidateQueries({ queryKey: ["quality-dashboard-stats"] });
            queryClient.invalidateQueries({ queryKey: ["quality-recent-runs"] });
          }}
        />
      )}
    </div>
  );
}
