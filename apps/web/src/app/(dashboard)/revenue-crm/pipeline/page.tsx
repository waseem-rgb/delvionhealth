"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  IndianRupee,
  TrendingUp,
  Target,
  Clock,
  Plus,
  X,
  ArrowRight,
  AlertCircle,
  ChevronRight,
  User,
  Calendar,
  FileText,
  MessageSquare,
} from "lucide-react";
import api from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Deal {
  id: string;
  title: string;
  clientType: string;
  clientName: string;
  dealType: string;
  estimatedValue: number;
  probability: number;
  expectedCloseDate: string | null;
  stage: string;
  assignedRepId: string | null;
  notes: string | null;
  createdAt: string;
  activities?: Activity[];
}

interface Activity {
  id: string;
  type: string;
  description: string;
  createdAt: string;
  createdBy: string | null;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const STAGES = [
  "PROSPECTING",
  "QUALIFIED",
  "PROPOSAL_SENT",
  "NEGOTIATING",
  "WON",
  "LOST",
] as const;

const stageColors: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  PROSPECTING:   { bg: "bg-blue-500/10",    border: "border-blue-500/30",    text: "text-blue-400",    dot: "bg-blue-400" },
  QUALIFIED:     { bg: "bg-violet-500/10",   border: "border-violet-500/30",  text: "text-violet-400",  dot: "bg-violet-400" },
  PROPOSAL_SENT: { bg: "bg-cyan-500/10",    border: "border-cyan-500/30",    text: "text-cyan-400",    dot: "bg-cyan-400" },
  NEGOTIATING:   { bg: "bg-amber-500/10",   border: "border-amber-500/30",   text: "text-amber-400",   dot: "bg-amber-400" },
  WON:           { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400", dot: "bg-emerald-400" },
  LOST:          { bg: "bg-red-500/10",     border: "border-red-500/30",     text: "text-red-400",     dot: "bg-red-400" },
};

const clientTypeBadge: Record<string, string> = {
  B2B: "bg-violet-500/20 text-violet-400",
  B2C: "bg-blue-500/20 text-blue-400",
  CORPORATE: "bg-cyan-500/20 text-cyan-400",
  HOSPITAL: "bg-emerald-500/20 text-emerald-400",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmt = (v: number) => new Intl.NumberFormat("en-IN").format(v);

function probColor(p: number) {
  if (p >= 70) return "text-emerald-400";
  if (p >= 40) return "text-amber-400";
  return "text-red-400";
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="h-3 w-20 bg-slate-800 rounded mb-3" />
            <div className="h-7 w-28 bg-slate-800 rounded mb-2" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4 min-h-[300px]">
            <div className="h-5 w-24 bg-slate-800 rounded mb-4" />
            {Array.from({ length: 2 }).map((__, j) => (
              <div key={j} className="h-28 bg-slate-800/50 rounded-lg mb-3" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function PipelinePage() {
  const qc = useQueryClient();
  const [showAddDeal, setShowAddDeal] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [moveStage, setMoveStage] = useState<{ dealId: string; current: string } | null>(null);

  const [form, setForm] = useState({
    title: "",
    clientType: "B2B",
    clientName: "",
    dealType: "",
    estimatedValue: "",
    probability: "",
    expectedCloseDate: "",
    assignedRepId: "",
    notes: "",
  });

  // ── Queries ──

  const {
    data: deals,
    isLoading,
    isError,
    error,
  } = useQuery<Deal[]>({
    queryKey: ["revenue-crm", "deals"],
    queryFn: async () => {
      const res = await api.get("/revenue-crm/deals");
      const raw = res.data?.data ?? res.data;
      return Array.isArray(raw) ? raw : (raw?.items ?? raw?.deals ?? []);
    },
  });

  // ── Mutations ──

  const createDeal = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title,
        clientType: form.clientType,
        clientName: form.clientName,
        dealType: form.dealType || undefined,
        estimatedValue: Number(form.estimatedValue),
        probability: Number(form.probability),
        expectedCloseDate: form.expectedCloseDate || undefined,
        assignedRepId: form.assignedRepId || undefined,
        notes: form.notes || undefined,
      };
      const res = await api.post("/revenue-crm/deals", payload);
      return res.data?.data ?? res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["revenue-crm", "deals"] });
      setShowAddDeal(false);
      setForm({
        title: "", clientType: "B2B", clientName: "", dealType: "",
        estimatedValue: "", probability: "", expectedCloseDate: "",
        assignedRepId: "", notes: "",
      });
    },
  });

  const changeStage = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const res = await api.patch(`/revenue-crm/deals/${id}/stage`, { stage });
      return res.data?.data ?? res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["revenue-crm", "deals"] });
      setMoveStage(null);
    },
  });

  // ── Derived stats ──

  const grouped: Record<string, Deal[]> = {};
  STAGES.forEach((s) => (grouped[s] = []));
  (deals ?? []).forEach((d) => {
    if (grouped[d.stage]) grouped[d.stage].push(d);
    else grouped.PROSPECTING.push(d);
  });

  const totalPipeline = (deals ?? [])
    .filter((d) => d.stage !== "WON" && d.stage !== "LOST")
    .reduce((s, d) => s + (d.estimatedValue ?? 0), 0);

  const now = new Date();
  const expectedThisMonth = (deals ?? [])
    .filter((d) => {
      if (!d.expectedCloseDate || d.stage === "WON" || d.stage === "LOST") return false;
      const close = new Date(d.expectedCloseDate);
      return close.getMonth() === now.getMonth() && close.getFullYear() === now.getFullYear();
    })
    .reduce((s, d) => s + (d.estimatedValue ?? 0), 0);

  const wonDeals = (deals ?? []).filter((d) => d.stage === "WON").length;
  const closedDeals = (deals ?? []).filter((d) => d.stage === "WON" || d.stage === "LOST").length;
  const winRate = closedDeals > 0 ? Math.round((wonDeals / closedDeals) * 100) : 0;

  const avgCycle = (() => {
    const won = (deals ?? []).filter((d) => d.stage === "WON" && d.expectedCloseDate && d.createdAt);
    if (won.length === 0) return 0;
    const totalDays = won.reduce((s, d) => {
      const diff = (new Date(d.expectedCloseDate!).getTime() - new Date(d.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      return s + Math.max(diff, 0);
    }, 0);
    return Math.round(totalDays / won.length);
  })();

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales Pipeline</h1>
          <p className="text-slate-400 text-sm mt-1">Track deals through every stage of the sales process</p>
        </div>
        <button
          onClick={() => setShowAddDeal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-medium transition-colors"
        >
          <Plus className="h-4 w-4" /> Add Deal
        </button>
      </div>

      {/* Error */}
      {isError && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-4">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          <p className="text-red-300 text-sm">{(error as Error)?.message ?? "Failed to load deals"}</p>
        </div>
      )}

      {isLoading ? (
        <Skeleton />
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Pipeline Value", value: `₹${fmt(totalPipeline)}`, icon: IndianRupee, gradient: "from-emerald-500 to-emerald-700" },
              { label: "Expected This Month", value: `₹${fmt(expectedThisMonth)}`, icon: TrendingUp, gradient: "from-blue-500 to-blue-700" },
              { label: "Win Rate", value: `${winRate}%`, icon: Target, gradient: "from-violet-500 to-violet-700" },
              { label: "Avg Cycle Days", value: `${avgCycle}`, icon: Clock, gradient: "from-amber-500 to-amber-700" },
            ].map((stat) => (
              <div key={stat.label} className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${stat.gradient} flex items-center justify-center`}>
                    <stat.icon className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-xs text-slate-400">{stat.label}</span>
                </div>
                <p className="text-xl font-bold">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Kanban */}
          {!deals || deals.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl py-16 text-center">
              <Target className="h-10 w-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">No deals in the pipeline</p>
              <p className="text-slate-600 text-xs mt-1">Click &quot;Add Deal&quot; to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {STAGES.map((stage) => {
                const sc = stageColors[stage];
                const stageDeals = grouped[stage];
                const stageTotal = stageDeals.reduce((s, d) => s + (d.estimatedValue ?? 0), 0);
                return (
                  <div key={stage} className={`${sc.bg} border ${sc.border} rounded-xl p-4 min-h-[300px]`}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`h-2 w-2 rounded-full ${sc.dot}`} />
                      <h3 className={`text-xs font-semibold uppercase tracking-wider ${sc.text}`}>
                        {stage.replace("_", " ")}
                      </h3>
                    </div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs text-slate-500">{stageDeals.length} deals</span>
                      <span className="text-xs text-slate-400 font-medium">₹{fmt(stageTotal)}</span>
                    </div>

                    <div className="space-y-3">
                      {stageDeals.map((deal) => (
                        <div
                          key={deal.id}
                          onClick={() => setSelectedDeal(deal)}
                          className="bg-slate-900 border border-slate-800 rounded-lg p-3 cursor-pointer hover:border-slate-600 transition-colors"
                        >
                          <p className="text-sm font-medium text-white mb-1 truncate">{deal.title}</p>
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${clientTypeBadge[deal.clientType] ?? "bg-slate-700 text-slate-300"}`}>
                              {deal.clientType}
                            </span>
                            <span className="text-xs text-slate-400 truncate">{deal.clientName}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-white">₹{fmt(deal.estimatedValue)}</span>
                            <span className={`text-xs font-semibold ${probColor(deal.probability)}`}>
                              {deal.probability}%
                            </span>
                          </div>
                          {deal.assignedRepId && (
                            <div className="flex items-center gap-1 mt-2">
                              <User className="h-3 w-3 text-slate-500" />
                              <span className="text-[10px] text-slate-500 truncate">{deal.assignedRepId}</span>
                            </div>
                          )}
                          {/* Move stage button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMoveStage({ dealId: deal.id, current: deal.stage });
                            }}
                            className="mt-2 flex items-center gap-1 text-[10px] text-slate-500 hover:text-white transition-colors"
                          >
                            Move <ChevronRight className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Move Stage Modal ──────────────────────────────────────────────── */}
      {moveStage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold">Move Deal</h2>
              <button onClick={() => setMoveStage(null)} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-4">Select the new stage:</p>
            <div className="space-y-2">
              {STAGES.filter((s) => s !== moveStage.current).map((stage) => {
                const sc = stageColors[stage];
                return (
                  <button
                    key={stage}
                    onClick={() => changeStage.mutate({ id: moveStage.dealId, stage })}
                    disabled={changeStage.isPending}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg ${sc.bg} border ${sc.border} hover:opacity-80 transition-all disabled:opacity-50`}
                  >
                    <div className={`h-2 w-2 rounded-full ${sc.dot}`} />
                    <span className={`text-sm font-medium ${sc.text}`}>{stage.replace("_", " ")}</span>
                    <ArrowRight className={`h-3.5 w-3.5 ml-auto ${sc.text}`} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Deal Detail Sheet ─────────────────────────────────────────────── */}
      {selectedDeal && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm">
          <div className="bg-slate-900 border-l border-slate-700 w-full max-w-lg h-full overflow-y-auto p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">{selectedDeal.title}</h2>
              <button onClick={() => setSelectedDeal(null)} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Deal info */}
            <div className="space-y-4 mb-6">
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded ${clientTypeBadge[selectedDeal.clientType] ?? "bg-slate-700 text-slate-300"}`}>
                  {selectedDeal.clientType}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded ${stageColors[selectedDeal.stage]?.bg ?? ""} ${stageColors[selectedDeal.stage]?.text ?? "text-slate-300"}`}>
                  {selectedDeal.stage.replace("_", " ")}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <User className="h-3.5 w-3.5 text-slate-500" />
                    <span className="text-xs text-slate-400">Client</span>
                  </div>
                  <p className="text-sm font-medium">{selectedDeal.clientName}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <IndianRupee className="h-3.5 w-3.5 text-slate-500" />
                    <span className="text-xs text-slate-400">Value</span>
                  </div>
                  <p className="text-sm font-medium">₹{fmt(selectedDeal.estimatedValue)}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Target className="h-3.5 w-3.5 text-slate-500" />
                    <span className="text-xs text-slate-400">Probability</span>
                  </div>
                  <p className={`text-sm font-medium ${probColor(selectedDeal.probability)}`}>
                    {selectedDeal.probability}%
                  </p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="h-3.5 w-3.5 text-slate-500" />
                    <span className="text-xs text-slate-400">Expected Close</span>
                  </div>
                  <p className="text-sm font-medium">
                    {selectedDeal.expectedCloseDate
                      ? new Date(selectedDeal.expectedCloseDate).toLocaleDateString("en-IN")
                      : "Not set"}
                  </p>
                </div>
              </div>

              {selectedDeal.dealType && (
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="h-3.5 w-3.5 text-slate-500" />
                    <span className="text-xs text-slate-400">Deal Type</span>
                  </div>
                  <p className="text-sm font-medium">{selectedDeal.dealType}</p>
                </div>
              )}

              {selectedDeal.notes && (
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <MessageSquare className="h-3.5 w-3.5 text-slate-500" />
                    <span className="text-xs text-slate-400">Notes</span>
                  </div>
                  <p className="text-sm text-slate-300">{selectedDeal.notes}</p>
                </div>
              )}

              {selectedDeal.assignedRepId && (
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <User className="h-3.5 w-3.5 text-slate-500" />
                    <span className="text-xs text-slate-400">Assigned Rep</span>
                  </div>
                  <p className="text-sm font-medium">{selectedDeal.assignedRepId}</p>
                </div>
              )}
            </div>

            {/* Activities Timeline */}
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Activities</h3>
              {(!selectedDeal.activities || selectedDeal.activities.length === 0) ? (
                <div className="py-8 text-center text-slate-500 text-sm">No activities recorded yet</div>
              ) : (
                <div className="relative border-l-2 border-slate-800 ml-2 space-y-4">
                  {selectedDeal.activities.map((act) => (
                    <div key={act.id} className="pl-5 relative">
                      <div className="absolute -left-[9px] top-1.5 h-4 w-4 rounded-full bg-slate-800 border-2 border-slate-600" />
                      <p className="text-xs text-slate-500 mb-0.5">
                        {new Date(act.createdAt).toLocaleDateString("en-IN")}
                        {act.createdBy ? ` - ${act.createdBy}` : ""}
                      </p>
                      <p className="text-sm text-slate-300">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 mr-2">{act.type}</span>
                        {act.description}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Move stage from detail */}
            <div className="mt-6 pt-4 border-t border-slate-800">
              <button
                onClick={() => {
                  setMoveStage({ dealId: selectedDeal.id, current: selectedDeal.stage });
                  setSelectedDeal(null);
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-slate-300 transition-colors"
              >
                Move to different stage <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Deal Modal ────────────────────────────────────────────────── */}
      {showAddDeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">Add Deal</h2>
              <button onClick={() => setShowAddDeal(false)} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Title</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Deal title"
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Client Type</label>
                  <select
                    value={form.clientType}
                    onChange={(e) => setForm({ ...form, clientType: e.target.value })}
                    className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    {["B2B", "B2C", "CORPORATE", "HOSPITAL"].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Client Name</label>
                  <input
                    value={form.clientName}
                    onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                    placeholder="Client name"
                    className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Deal Type</label>
                <input
                  value={form.dealType}
                  onChange={(e) => setForm({ ...form, dealType: e.target.value })}
                  placeholder="e.g. Annual Contract, One-time"
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Estimated Value (₹)</label>
                  <input
                    type="number"
                    value={form.estimatedValue}
                    onChange={(e) => setForm({ ...form, estimatedValue: e.target.value })}
                    placeholder="0"
                    className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Probability (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={form.probability}
                    onChange={(e) => setForm({ ...form, probability: e.target.value })}
                    placeholder="0-100"
                    className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Expected Close Date</label>
                  <input
                    type="date"
                    value={form.expectedCloseDate}
                    onChange={(e) => setForm({ ...form, expectedCloseDate: e.target.value })}
                    className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Assigned Rep ID</label>
                  <input
                    value={form.assignedRepId}
                    onChange={(e) => setForm({ ...form, assignedRepId: e.target.value })}
                    placeholder="Optional"
                    className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  placeholder="Additional notes..."
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-800">
              <button
                onClick={() => setShowAddDeal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => createDeal.mutate()}
                disabled={createDeal.isPending || !form.title || !form.clientName || !form.estimatedValue}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
              >
                {createDeal.isPending ? "Creating..." : "Add Deal"}
              </button>
            </div>

            {createDeal.isError && (
              <p className="mt-3 text-sm text-red-400">
                {(createDeal.error as Error)?.message ?? "Failed to create deal"}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
