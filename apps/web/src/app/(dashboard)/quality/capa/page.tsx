"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardList,
  Plus,
  Search,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Sparkles,
  X,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import api from "@/lib/api";

interface QualityCapa {
  id: string;
  capaNumber: string | null;
  title: string;
  description: string | null;
  type: string | null;
  source: string | null;
  priority: string | null;
  status: string;
  rootCause: string | null;
  proposedAction: string | null;
  actualAction: string | null;
  dueDate: string | null;
  completedAt: string | null;
  department: string | null;
  assignedToId: string | null;
  effectivenessCheck: string | null;
  createdAt: string;
}

interface CapaSummary {
  open: number;
  inProgress: number;
  completed: number;
  closed: number;
  overdue: number;
}

const STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-blue-50 text-blue-700 border-blue-200",
  IN_PROGRESS: "bg-amber-50 text-amber-700 border-amber-200",
  COMPLETED: "bg-green-50 text-green-700 border-green-200",
  VERIFIED: "bg-purple-50 text-purple-700 border-purple-200",
  CLOSED: "bg-slate-50 text-slate-600 border-slate-200",
};

const PRIORITY_STYLES: Record<string, string> = {
  CRITICAL: "bg-red-50 text-red-700 border-red-200",
  HIGH: "bg-amber-50 text-amber-700 border-amber-200",
  MEDIUM: "bg-blue-50 text-blue-700 border-blue-200",
  LOW: "bg-slate-50 text-slate-600 border-slate-200",
};

const SOURCES = ["IQC_FAILURE", "EQAS", "NCR", "AUDIT", "INCIDENT", "CUSTOMER_COMPLAINT", "OTHER"];
const DEPARTMENTS = ["Biochemistry", "Haematology", "Urine", "Immunoassay", "Microbiology", "Serology", "Admin", "Pre-analytics"];

function CreateCapaModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    title: "", type: "CORRECTIVE", source: "", department: "", priority: "MEDIUM",
    description: "", rootCause: "", proposedAction: "", actualAction: "", dueDate: "", assignedToId: "",
  });
  const [error, setError] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const mutation = useMutation({
    mutationFn: () => api.post("/quality/capas", {
      ...form,
      dueDate: form.dueDate || undefined,
      assignedToId: form.assignedToId || undefined,
    }),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (e: unknown) => {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed");
    },
  });

  const set = (key: string, val: string) => setForm((p) => ({ ...p, [key]: val }));

  const handleAiAssist = async () => {
    if (!form.source || !form.description) return;
    setAiLoading(true);
    try {
      const res = await api.post("/quality/capas/ai-suggest", { source: form.source, description: form.description });
      const suggestion = (res.data?.data ?? res.data)?.suggestion;
      if (suggestion) set("rootCause", suggestion);
    } catch { /* ignore */ }
    setAiLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Raise CAPA — Step {step}/3</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-400"><X className="w-5 h-5" /></button>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>}

        {/* Step indicators */}
        <div className="flex gap-2">
          {["Identify", "Analyse", "Plan"].map((label, i) => (
            <div key={label} className={`flex-1 text-center text-xs py-1 rounded ${step === i + 1 ? "bg-blue-600 text-white" : step > i + 1 ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"}`}>
              {label}
            </div>
          ))}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); if (step < 3) { setStep(step + 1); return; } if (!form.title) { setError("Title is required"); return; } mutation.mutate(); }} className="space-y-3">
          {step === 1 && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Title *</label>
                <input type="text" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Brief description of the issue" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Type</label>
                  <select value={form.type} onChange={(e) => set("type", e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                    <option value="CORRECTIVE">Corrective</option>
                    <option value="PREVENTIVE">Preventive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Source</label>
                  <select value={form.source} onChange={(e) => set("source", e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                    <option value="">Select...</option>
                    {SOURCES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Department</label>
                  <select value={form.department} onChange={(e) => set("department", e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                    <option value="">Select...</option>
                    {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Priority</label>
                  <select value={form.priority} onChange={(e) => set("priority", e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                    {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
                <textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-600">Root Cause Analysis</label>
                  <button type="button" onClick={handleAiAssist} disabled={aiLoading || !form.source || !form.description}
                    className="inline-flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 disabled:opacity-40 disabled:cursor-not-allowed">
                    <Sparkles className="w-3 h-3" /> {aiLoading ? "Generating..." : "AI Assist"}
                  </button>
                </div>
                <textarea rows={4} value={form.rootCause} onChange={(e) => set("rootCause", e.target.value)} placeholder="Describe the root cause..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Immediate Action Taken</label>
                <textarea rows={2} value={form.actualAction} onChange={(e) => set("actualAction", e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Corrective / Preventive Action Plan</label>
                <textarea rows={3} value={form.proposedAction} onChange={(e) => set("proposedAction", e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Target Date</label>
                  <input type="date" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Assign To (User ID)</label>
                  <input type="text" value={form.assignedToId} onChange={(e) => set("assignedToId", e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                </div>
              </div>
            </>
          )}

          <div className="flex gap-2 pt-2">
            {step > 1 && (
              <button type="button" onClick={() => setStep(step - 1)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50">
                <ChevronLeft className="w-4 h-4 inline" /> Back
              </button>
            )}
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="flex-1 px-4 py-2 bg-blue-600 rounded-lg text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              {step < 3 ? (<>Next <ChevronRight className="w-4 h-4 inline" /></>) : mutation.isPending ? "Creating..." : "Create CAPA"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CapaDetail({ capa, onClose, onUpdate }: { capa: QualityCapa; onClose: () => void; onUpdate: () => void }) {
  const updateMutation = useMutation({
    mutationFn: (status: string) => api.patch(`/quality/capas/${capa.id}`, { status }),
    onSuccess: () => onUpdate(),
  });

  const isOverdue = capa.dueDate && new Date(capa.dueDate) < new Date() && !["COMPLETED", "VERIFIED", "CLOSED"].includes(capa.status);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <div className="bg-white w-full max-w-lg h-full overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <h2 className="font-bold text-slate-900">{capa.capaNumber ?? "CAPA"}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-400"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">{capa.title}</h3>
          <div className="flex gap-2 flex-wrap">
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_STYLES[capa.status] ?? ""}`}>{capa.status}</span>
            {capa.priority && <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${PRIORITY_STYLES[capa.priority] ?? ""}`}>{capa.priority}</span>}
            {capa.type && <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border bg-slate-50 text-slate-600 border-slate-200">{capa.type}</span>}
            {isOverdue && <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border bg-red-50 text-red-700 border-red-200">OVERDUE</span>}
          </div>
          {capa.description && <div><p className="text-xs font-semibold text-slate-500 mb-1">Description</p><p className="text-sm text-slate-700">{capa.description}</p></div>}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-xs text-slate-400">Source</p><p className="text-slate-700">{capa.source ?? "—"}</p></div>
            <div><p className="text-xs text-slate-400">Department</p><p className="text-slate-700">{capa.department ?? "—"}</p></div>
            <div><p className="text-xs text-slate-400">Created</p><p className="text-slate-700">{formatDate(capa.createdAt)}</p></div>
            <div><p className="text-xs text-slate-400">Target Date</p><p className={`${isOverdue ? "text-red-600 font-semibold" : "text-slate-700"}`}>{formatDate(capa.dueDate)}</p></div>
          </div>
          {capa.rootCause && <div><p className="text-xs font-semibold text-slate-500 mb-1">Root Cause</p><p className="text-sm text-slate-700 whitespace-pre-wrap">{capa.rootCause}</p></div>}
          {capa.proposedAction && <div><p className="text-xs font-semibold text-slate-500 mb-1">Proposed Action</p><p className="text-sm text-slate-700 whitespace-pre-wrap">{capa.proposedAction}</p></div>}
          {capa.actualAction && <div><p className="text-xs font-semibold text-slate-500 mb-1">Actual Action</p><p className="text-sm text-slate-700 whitespace-pre-wrap">{capa.actualAction}</p></div>}
          {capa.effectivenessCheck && <div><p className="text-xs font-semibold text-slate-500 mb-1">Effectiveness Check</p><p className="text-sm text-slate-700 whitespace-pre-wrap">{capa.effectivenessCheck}</p></div>}

          <div className="flex gap-2 pt-4 border-t border-slate-100">
            {capa.status === "OPEN" && (
              <button onClick={() => updateMutation.mutate("IN_PROGRESS")} disabled={updateMutation.isPending} className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 disabled:opacity-50">Mark In Progress</button>
            )}
            {capa.status === "IN_PROGRESS" && (
              <button onClick={() => updateMutation.mutate("COMPLETED")} disabled={updateMutation.isPending} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 disabled:opacity-50">Mark Completed</button>
            )}
            {capa.status === "COMPLETED" && (
              <button onClick={() => updateMutation.mutate("VERIFIED")} disabled={updateMutation.isPending} className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700 disabled:opacity-50">Verify</button>
            )}
            {["COMPLETED", "VERIFIED"].includes(capa.status) && (
              <button onClick={() => updateMutation.mutate("CLOSED")} disabled={updateMutation.isPending} className="px-3 py-1.5 bg-slate-600 text-white rounded-lg text-xs font-semibold hover:bg-slate-700 disabled:opacity-50">Close CAPA</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CapaPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCapa, setSelectedCapa] = useState<QualityCapa | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");

  const { data: summary } = useQuery({
    queryKey: ["capa-summary"],
    queryFn: async () => {
      const res = await api.get("/quality/capas/summary");
      return (res.data?.data ?? res.data) as CapaSummary;
    },
  });

  const { data: capasData, isLoading } = useQuery({
    queryKey: ["capas", statusFilter, typeFilter, deptFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (typeFilter) params.set("type", typeFilter);
      if (deptFilter) params.set("department", deptFilter);
      params.set("limit", "100");
      const res = await api.get(`/quality/capas?${params.toString()}`);
      return (res.data?.data ?? res.data) as { data: QualityCapa[]; total: number };
    },
  });

  const capas = (capasData?.data ?? []).filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.title.toLowerCase().includes(q) || (c.capaNumber ?? "").toLowerCase().includes(q);
  });

  const sm = summary ?? { open: 0, inProgress: 0, completed: 0, closed: 0, overdue: 0 };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["capas"] });
    queryClient.invalidateQueries({ queryKey: ["capa-summary"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">CAPA Register</h1>
          <p className="text-slate-500 text-sm mt-0.5">Corrective & Preventive Actions — ISO 15189</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Raise CAPA
        </button>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: "Open", value: sm.open, icon: AlertTriangle, color: "bg-blue-50 text-blue-600" },
          { label: "In Progress", value: sm.inProgress, icon: Clock, color: "bg-amber-50 text-amber-600" },
          { label: "Overdue", value: sm.overdue, icon: XCircle, color: sm.overdue > 0 ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600" },
          { label: "Completed", value: sm.completed, icon: CheckCircle2, color: "bg-green-50 text-green-600" },
          { label: "Closed", value: sm.closed, icon: ClipboardList, color: "bg-slate-50 text-slate-600" },
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

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
          <option value="">All Types</option>
          <option value="CORRECTIVE">Corrective</option>
          <option value="PREVENTIVE">Preventive</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
          <option value="">All Status</option>
          {["OPEN", "IN_PROGRESS", "COMPLETED", "VERIFIED", "CLOSED"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
          <option value="">All Departments</option>
          {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <div className="relative ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="search" placeholder="Search CAPAs..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 w-60" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />)}</div>
        ) : capas.length === 0 ? (
          <div className="p-16 text-center">
            <ClipboardList className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No CAPAs found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-4 py-2 font-medium text-slate-500">CAPA#</th>
                <th className="text-left px-4 py-2 font-medium text-slate-500">Title</th>
                <th className="text-left px-4 py-2 font-medium text-slate-500">Type</th>
                <th className="text-left px-4 py-2 font-medium text-slate-500">Source</th>
                <th className="text-left px-4 py-2 font-medium text-slate-500">Priority</th>
                <th className="text-left px-4 py-2 font-medium text-slate-500">Status</th>
                <th className="text-left px-4 py-2 font-medium text-slate-500">Target</th>
              </tr>
            </thead>
            <tbody>
              {capas.map((c) => {
                const isOverdue = c.dueDate && new Date(c.dueDate) < new Date() && !["COMPLETED", "VERIFIED", "CLOSED"].includes(c.status);
                return (
                  <tr key={c.id} onClick={() => setSelectedCapa(c)}
                    className={`border-b border-slate-50 last:border-0 cursor-pointer hover:bg-slate-50 ${isOverdue ? "bg-red-50/40" : ""}`}>
                    <td className="px-4 py-2 font-mono text-xs text-slate-500">{c.capaNumber ?? "—"}</td>
                    <td className="px-4 py-2 font-medium text-slate-800 max-w-[200px] truncate">{c.title}</td>
                    <td className="px-4 py-2 text-slate-600">{c.type ?? "—"}</td>
                    <td className="px-4 py-2 text-slate-600 text-xs">{c.source?.replace(/_/g, " ") ?? "—"}</td>
                    <td className="px-4 py-2">
                      {c.priority && <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${PRIORITY_STYLES[c.priority] ?? ""}`}>{c.priority}</span>}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_STYLES[c.status] ?? ""}`}>{c.status}</span>
                    </td>
                    <td className={`px-4 py-2 text-xs ${isOverdue ? "text-red-600 font-semibold" : "text-slate-600"}`}>{formatDate(c.dueDate)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && <CreateCapaModal onClose={() => setShowCreate(false)} onSuccess={invalidate} />}
      {selectedCapa && <CapaDetail capa={selectedCapa} onClose={() => setSelectedCapa(null)} onUpdate={() => { invalidate(); setSelectedCapa(null); }} />}
    </div>
  );
}
