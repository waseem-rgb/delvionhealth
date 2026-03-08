"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, X, Users, MapPin, Phone, Mail, Target, Eye, Calendar,
  TrendingUp, BarChart3, Loader2, AlertCircle, Briefcase,
  ClipboardList, DollarSign, ChevronDown, Search,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface Rep {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  designation: string;
  branchId: string | null;
  branch?: { id: string; name: string } | null;
  revSharePct: number;
  revenueMTD: number;
  revenueTarget: number;
  visitsMTD: number;
  isActive: boolean;
}

interface Visit {
  id: string;
  repId: string;
  rep?: { id: string; name: string };
  visitType: string;
  clientName: string;
  visitDate: string;
  purpose: string;
  outcome: string;
  notes: string | null;
  nextActionDate: string | null;
}

interface TargetRow {
  id: string;
  repId: string;
  rep: { id: string; name: string };
  month: number;
  year: number;
  revenueTarget: number;
  revenueActual: number;
  visitTarget: number;
  visitActual: number;
  newDoctorTarget: number;
  newDoctorActual: number;
}

interface RevShareRow {
  repId: string;
  repName: string;
  revenueGenerated: number;
  revSharePct: number;
  amountEarned: number;
  status: string;
}

type TabKey = "team" | "visits" | "targets" | "revshare";

const TABS: { key: TabKey; label: string }[] = [
  { key: "team", label: "Team" },
  { key: "visits", label: "Visit Log" },
  { key: "targets", label: "Targets" },
  { key: "revshare", label: "Rev Share" },
];

const DESIGNATIONS = ["SALES_REP", "TEAM_LEAD", "MANAGER", "SENIOR_REP", "EXECUTIVE"];
const VISIT_TYPES = ["DOCTOR", "HOSPITAL", "CORPORATE", "COLD_CALL"];
const PURPOSES = ["INTRODUCTION", "FOLLOW_UP", "RATE_NEGOTIATION", "COMPLAINT", "COLLECTION", "RELATIONSHIP"];
const OUTCOMES = ["POSITIVE", "NEUTRAL", "NEGATIVE", "FOLLOW_UP_NEEDED", "DEAL_CLOSED"];

const fmt = (v: number) => new Intl.NumberFormat("en-IN").format(v);

// ── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-24 rounded-xl bg-slate-800 animate-pulse" />
      ))}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-red-950/60 border border-red-800 p-4 text-red-300">
      <AlertCircle className="h-5 w-5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
      <ClipboardList className="h-12 w-12 mb-3 opacity-40" />
      <p>{text}</p>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SalesTeamPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>("team");

  // ── Add Rep Modal ──
  const [showAddRep, setShowAddRep] = useState(false);
  const [repForm, setRepForm] = useState({
    name: "", phone: "", email: "", designation: "SALES_REP", branchId: "", revSharePct: 0,
  });

  // ── Visit Form ──
  const [showVisitForm, setShowVisitForm] = useState(false);
  const [visitForm, setVisitForm] = useState({
    repId: "", visitType: "DOCTOR", clientName: "", visitDate: "",
    purpose: "INTRODUCTION", outcome: "NEUTRAL", notes: "", nextActionDate: "",
  });

  // ── Target Form ──
  const [showTargetForm, setShowTargetForm] = useState(false);
  const [targetForm, setTargetForm] = useState({
    repId: "", revenueTarget: 0, visitTarget: 0, newDoctorTarget: 0,
  });
  const now = new Date();
  const [targetMonth, setTargetMonth] = useState(now.getMonth() + 1);
  const [targetYear, setTargetYear] = useState(now.getFullYear());

  // ── Visit log rep filter ──
  const [visitRepId, setVisitRepId] = useState("");

  // ── Queries ──
  const repsQuery = useQuery({
    queryKey: ["revenue-crm", "reps"],
    queryFn: async () => {
      const res = await api.get("/revenue-crm/reps");
      return (res.data?.data ?? res.data) as Rep[];
    },
  });

  const visitsQuery = useQuery({
    queryKey: ["revenue-crm", "visits", visitRepId],
    queryFn: async () => {
      if (!visitRepId) return [] as Visit[];
      const res = await api.get(`/revenue-crm/reps/${visitRepId}/visits`);
      return (res.data?.data ?? res.data) as Visit[];
    },
    enabled: activeTab === "visits",
  });

  const targetsQuery = useQuery({
    queryKey: ["revenue-crm", "targets", targetMonth, targetYear],
    queryFn: async () => {
      const res = await api.get(`/revenue-crm/targets?month=${targetMonth}&year=${targetYear}`);
      return (res.data?.data ?? res.data) as TargetRow[];
    },
    enabled: activeTab === "targets",
  });

  const revShareQuery = useQuery({
    queryKey: ["revenue-crm", "revshare", "summary"],
    queryFn: async () => {
      const res = await api.get("/revenue-crm/revshare/summary");
      return (res.data?.data ?? res.data) as RevShareRow[];
    },
    enabled: activeTab === "revshare",
  });

  // ── Mutations ──
  const addRepMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...repForm,
        revSharePct: Number(repForm.revSharePct),
        branchId: repForm.branchId || undefined,
      };
      await api.post("/revenue-crm/reps", payload);
    },
    onSuccess: () => {
      toast.success("Rep added successfully");
      queryClient.invalidateQueries({ queryKey: ["revenue-crm", "reps"] });
      setShowAddRep(false);
      setRepForm({ name: "", phone: "", email: "", designation: "SALES_REP", branchId: "", revSharePct: 0 });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to add rep"),
  });

  const logVisitMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...visitForm,
        nextActionDate: visitForm.nextActionDate || undefined,
        notes: visitForm.notes || undefined,
      };
      await api.post("/revenue-crm/visits", payload);
    },
    onSuccess: () => {
      toast.success("Visit logged");
      queryClient.invalidateQueries({ queryKey: ["revenue-crm", "visits"] });
      setShowVisitForm(false);
      setVisitForm({ repId: "", visitType: "DOCTOR", clientName: "", visitDate: "", purpose: "INTRODUCTION", outcome: "NEUTRAL", notes: "", nextActionDate: "" });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to log visit"),
  });

  const setTargetMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...targetForm,
        month: targetMonth,
        year: targetYear,
        revenueTarget: Number(targetForm.revenueTarget),
        visitTarget: Number(targetForm.visitTarget),
        newDoctorTarget: Number(targetForm.newDoctorTarget),
      };
      await api.post("/revenue-crm/targets", payload);
    },
    onSuccess: () => {
      toast.success("Target set");
      queryClient.invalidateQueries({ queryKey: ["revenue-crm", "targets"] });
      setShowTargetForm(false);
      setTargetForm({ repId: "", revenueTarget: 0, visitTarget: 0, newDoctorTarget: 0 });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to set target"),
  });

  const reps = repsQuery.data ?? [];

  // ── Helpers ──
  const progressColor = (pct: number) => {
    if (pct >= 80) return "bg-emerald-500";
    if (pct >= 60) return "bg-amber-500";
    return "bg-red-500";
  };

  const progressTextColor = (pct: number) => {
    if (pct >= 80) return "text-emerald-400";
    if (pct >= 60) return "text-amber-400";
    return "text-red-400";
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-7 w-7 text-blue-400" />
            Sales Team
          </h1>
          <p className="text-slate-400 text-sm mt-1">Manage reps, visits, targets and rev share</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900 rounded-xl p-1 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all",
              activeTab === tab.key
                ? "bg-blue-600 text-white shadow"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TEAM TAB ── */}
      {activeTab === "team" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowAddRep(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition"
            >
              <Plus className="h-4 w-4" />
              Add Rep
            </button>
          </div>

          {repsQuery.isLoading && <Skeleton rows={6} />}
          {repsQuery.isError && <ErrorBanner message="Failed to load sales reps" />}
          {repsQuery.isSuccess && reps.length === 0 && <EmptyState text="No sales reps found" />}

          {repsQuery.isSuccess && reps.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {reps.map((rep) => {
                const pct = rep.revenueTarget > 0 ? Math.round((rep.revenueMTD / rep.revenueTarget) * 100) : 0;
                return (
                  <div key={rep.id} className="bg-slate-900 rounded-xl p-5 border border-slate-800 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-lg">{rep.name}</h3>
                        <span className="inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-900/60 text-blue-300">
                          {rep.designation?.replace(/_/g, " ")}
                        </span>
                      </div>
                      <button className="text-slate-400 hover:text-white transition">
                        <Eye className="h-4 w-4" />
                      </button>
                    </div>

                    {rep.branch && (
                      <p className="text-xs text-slate-400 flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {rep.branch.name}
                      </p>
                    )}

                    {/* Revenue progress */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Revenue MTD / Target</span>
                        <span className={progressTextColor(pct)}>{pct}%</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{fmt(rep.revenueMTD)}</span>
                        <span className="text-slate-500">/</span>
                        <span className="text-slate-400">{fmt(rep.revenueTarget)}</span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all", progressColor(pct))}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Visits MTD</span>
                      <span className="font-medium">{rep.visitsMTD ?? 0}</span>
                    </div>

                    <button className="w-full mt-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-medium text-slate-300 transition flex items-center justify-center gap-2">
                      <Eye className="h-4 w-4" />
                      View Profile
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add Rep Modal */}
          {showAddRep && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Add Sales Rep</h2>
                  <button onClick={() => setShowAddRep(false)} className="text-slate-400 hover:text-white">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs text-slate-400 mb-1 block">Name *</label>
                    <input
                      value={repForm.name}
                      onChange={(e) => setRepForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Phone *</label>
                    <input
                      value={repForm.phone}
                      onChange={(e) => setRepForm((f) => ({ ...f, phone: e.target.value }))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Email</label>
                    <input
                      value={repForm.email}
                      onChange={(e) => setRepForm((f) => ({ ...f, email: e.target.value }))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Designation</label>
                    <select
                      value={repForm.designation}
                      onChange={(e) => setRepForm((f) => ({ ...f, designation: e.target.value }))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {DESIGNATIONS.map((d) => (
                        <option key={d} value={d}>{d.replace(/_/g, " ")}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Branch ID</label>
                    <input
                      value={repForm.branchId}
                      onChange={(e) => setRepForm((f) => ({ ...f, branchId: e.target.value }))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Rev Share %</label>
                    <input
                      type="number"
                      value={repForm.revSharePct}
                      onChange={(e) => setRepForm((f) => ({ ...f, revSharePct: Number(e.target.value) }))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setShowAddRep(false)}
                    className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => addRepMutation.mutate()}
                    disabled={addRepMutation.isPending || !repForm.name || !repForm.phone}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm font-medium transition"
                  >
                    {addRepMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Add Rep
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── VISIT LOG TAB ── */}
      {activeTab === "visits" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={visitRepId}
              onChange={(e) => setVisitRepId(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Rep to view visits</option>
              {reps.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>

            <button
              onClick={() => setShowVisitForm(true)}
              className="ml-auto flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition"
            >
              <Plus className="h-4 w-4" />
              Log Visit
            </button>
          </div>

          {!visitRepId && <EmptyState text="Select a rep to view their visit log" />}

          {visitRepId && visitsQuery.isLoading && <Skeleton rows={5} />}
          {visitRepId && visitsQuery.isError && <ErrorBanner message="Failed to load visits" />}
          {visitRepId && visitsQuery.isSuccess && (visitsQuery.data ?? []).length === 0 && (
            <EmptyState text="No visits logged for this rep" />
          )}

          {visitRepId && visitsQuery.isSuccess && (visitsQuery.data ?? []).length > 0 && (
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-left">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Rep</th>
                    <th className="px-4 py-3 font-medium">Client</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Purpose</th>
                    <th className="px-4 py-3 font-medium">Outcome</th>
                    <th className="px-4 py-3 font-medium">Next Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(visitsQuery.data ?? []).map((v) => (
                    <tr key={v.id} className="border-b border-slate-800/50 hover:bg-slate-800/40 transition">
                      <td className="px-4 py-3">{v.visitDate ? new Date(v.visitDate).toLocaleDateString("en-IN") : "-"}</td>
                      <td className="px-4 py-3">{v.rep?.name ?? "-"}</td>
                      <td className="px-4 py-3 font-medium">{v.clientName}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300">
                          {v.visitType?.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{v.purpose?.replace(/_/g, " ")}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-medium",
                          v.outcome === "POSITIVE" && "bg-emerald-900/60 text-emerald-300",
                          v.outcome === "DEAL_CLOSED" && "bg-emerald-900/60 text-emerald-300",
                          v.outcome === "NEGATIVE" && "bg-red-900/60 text-red-300",
                          v.outcome === "NEUTRAL" && "bg-slate-800 text-slate-300",
                          v.outcome === "FOLLOW_UP_NEEDED" && "bg-amber-900/60 text-amber-300",
                        )}>
                          {v.outcome?.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {v.nextActionDate ? new Date(v.nextActionDate).toLocaleDateString("en-IN") : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Log Visit Form Modal */}
          {showVisitForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Log Visit</h2>
                  <button onClick={() => setShowVisitForm(false)} className="text-slate-400 hover:text-white">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Rep *</label>
                    <select
                      value={visitForm.repId}
                      onChange={(e) => setVisitForm((f) => ({ ...f, repId: e.target.value }))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select rep</option>
                      {reps.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Visit Type *</label>
                      <select
                        value={visitForm.visitType}
                        onChange={(e) => setVisitForm((f) => ({ ...f, visitType: e.target.value }))}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {VISIT_TYPES.map((t) => (
                          <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Visit Date *</label>
                      <input
                        type="date"
                        value={visitForm.visitDate}
                        onChange={(e) => setVisitForm((f) => ({ ...f, visitDate: e.target.value }))}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Client Name *</label>
                    <input
                      value={visitForm.clientName}
                      onChange={(e) => setVisitForm((f) => ({ ...f, clientName: e.target.value }))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Purpose *</label>
                      <select
                        value={visitForm.purpose}
                        onChange={(e) => setVisitForm((f) => ({ ...f, purpose: e.target.value }))}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {PURPOSES.map((p) => (
                          <option key={p} value={p}>{p.replace(/_/g, " ")}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Outcome *</label>
                      <select
                        value={visitForm.outcome}
                        onChange={(e) => setVisitForm((f) => ({ ...f, outcome: e.target.value }))}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {OUTCOMES.map((o) => (
                          <option key={o} value={o}>{o.replace(/_/g, " ")}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Notes</label>
                    <textarea
                      value={visitForm.notes}
                      onChange={(e) => setVisitForm((f) => ({ ...f, notes: e.target.value }))}
                      rows={3}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Next Action Date</label>
                    <input
                      type="date"
                      value={visitForm.nextActionDate}
                      onChange={(e) => setVisitForm((f) => ({ ...f, nextActionDate: e.target.value }))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setShowVisitForm(false)}
                    className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => logVisitMutation.mutate()}
                    disabled={logVisitMutation.isPending || !visitForm.repId || !visitForm.clientName || !visitForm.visitDate}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm font-medium transition"
                  >
                    {logVisitMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Log Visit
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TARGETS TAB ── */}
      {activeTab === "targets" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <select
                value={targetMonth}
                onChange={(e) => setTargetMonth(Number(e.target.value))}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(2024, i).toLocaleString("default", { month: "long" })}
                  </option>
                ))}
              </select>
              <select
                value={targetYear}
                onChange={(e) => setTargetYear(Number(e.target.value))}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setShowTargetForm(true)}
              className="ml-auto flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition"
            >
              <Plus className="h-4 w-4" />
              Set Target
            </button>
          </div>

          {targetsQuery.isLoading && <Skeleton rows={5} />}
          {targetsQuery.isError && <ErrorBanner message="Failed to load targets" />}
          {targetsQuery.isSuccess && (targetsQuery.data ?? []).length === 0 && (
            <EmptyState text="No targets set for this period" />
          )}

          {targetsQuery.isSuccess && (targetsQuery.data ?? []).length > 0 && (
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-left">
                    <th className="px-4 py-3 font-medium">Rep</th>
                    <th className="px-4 py-3 font-medium text-right">Revenue Target</th>
                    <th className="px-4 py-3 font-medium text-right">Actual</th>
                    <th className="px-4 py-3 font-medium text-right">%</th>
                    <th className="px-4 py-3 font-medium text-right">Visits Target</th>
                    <th className="px-4 py-3 font-medium text-right">Actual</th>
                  </tr>
                </thead>
                <tbody>
                  {(targetsQuery.data ?? []).map((t) => {
                    const revPct = t.revenueTarget > 0 ? Math.round((t.revenueActual / t.revenueTarget) * 100) : 0;
                    return (
                      <tr key={t.id} className="border-b border-slate-800/50 hover:bg-slate-800/40 transition">
                        <td className="px-4 py-3 font-medium">{t.rep?.name ?? "-"}</td>
                        <td className="px-4 py-3 text-right text-slate-300">{fmt(t.revenueTarget)}</td>
                        <td className="px-4 py-3 text-right font-medium">{fmt(t.revenueActual)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={cn("font-medium", progressTextColor(revPct))}>
                            {revPct}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-300">{t.visitTarget}</td>
                        <td className="px-4 py-3 text-right font-medium">{t.visitActual}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Set Target Modal */}
          {showTargetForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Set Target</h2>
                  <button onClick={() => setShowTargetForm(false)} className="text-slate-400 hover:text-white">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Rep *</label>
                    <select
                      value={targetForm.repId}
                      onChange={(e) => setTargetForm((f) => ({ ...f, repId: e.target.value }))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select rep</option>
                      {reps.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Revenue Target</label>
                    <input
                      type="number"
                      value={targetForm.revenueTarget}
                      onChange={(e) => setTargetForm((f) => ({ ...f, revenueTarget: Number(e.target.value) }))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Visit Target</label>
                    <input
                      type="number"
                      value={targetForm.visitTarget}
                      onChange={(e) => setTargetForm((f) => ({ ...f, visitTarget: Number(e.target.value) }))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">New Doctor Target</label>
                    <input
                      type="number"
                      value={targetForm.newDoctorTarget}
                      onChange={(e) => setTargetForm((f) => ({ ...f, newDoctorTarget: Number(e.target.value) }))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setShowTargetForm(false)}
                    className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setTargetMutation.mutate()}
                    disabled={setTargetMutation.isPending || !targetForm.repId}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm font-medium transition"
                  >
                    {setTargetMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Set Target
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── REV SHARE TAB ── */}
      {activeTab === "revshare" && (
        <div className="space-y-4">
          {revShareQuery.isLoading && <Skeleton rows={5} />}
          {revShareQuery.isError && <ErrorBanner message="Failed to load rev share summary" />}
          {revShareQuery.isSuccess && (revShareQuery.data ?? []).length === 0 && (
            <EmptyState text="No rev share data available" />
          )}

          {revShareQuery.isSuccess && (revShareQuery.data ?? []).length > 0 && (
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-left">
                    <th className="px-4 py-3 font-medium">Rep</th>
                    <th className="px-4 py-3 font-medium text-right">Revenue Generated</th>
                    <th className="px-4 py-3 font-medium text-right">Rev Share %</th>
                    <th className="px-4 py-3 font-medium text-right">Amount Earned</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(revShareQuery.data ?? []).map((row) => (
                    <tr key={row.repId} className="border-b border-slate-800/50 hover:bg-slate-800/40 transition">
                      <td className="px-4 py-3 font-medium">{row.repName}</td>
                      <td className="px-4 py-3 text-right">{fmt(row.revenueGenerated)}</td>
                      <td className="px-4 py-3 text-right text-slate-300">{row.revSharePct}%</td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-400">{fmt(row.amountEarned)}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-medium",
                          row.status === "PAID" && "bg-emerald-900/60 text-emerald-300",
                          row.status === "PENDING" && "bg-amber-900/60 text-amber-300",
                          row.status === "PROCESSING" && "bg-blue-900/60 text-blue-300",
                          (!row.status || !["PAID", "PENDING", "PROCESSING"].includes(row.status)) && "bg-slate-800 text-slate-300",
                        )}>
                          {row.status ?? "N/A"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
