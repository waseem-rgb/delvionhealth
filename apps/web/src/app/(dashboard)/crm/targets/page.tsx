"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Target, TrendingUp, X } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import api from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────

type TargetType = "REVENUE" | "ORDERS" | "PATIENTS";

interface RevenueTarget {
  id: string;
  type: TargetType;
  targetValue: number;
  achievedValue: number;
  periodStart: string;
  periodEnd: string;
  progressPercent: number;
}

interface CreateTargetForm {
  type: TargetType;
  targetValue: string;
  periodStart: string;
  periodEnd: string;
}

// ── Radial Progress Gauge ──────────────────────────────────────────────────

function RadialGauge({ percent }: { percent: number }) {
  const r = 40;
  const circumference = 2 * Math.PI * r; // ≈ 251.327
  const clampedPercent = Math.min(100, Math.max(0, percent));
  const offset = circumference * (1 - clampedPercent / 100);

  const strokeColor =
    clampedPercent >= 75
      ? "#10B981" // green
      : clampedPercent >= 40
      ? "#F59E0B" // amber
      : "#EF4444"; // red

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="100" height="100" viewBox="0 0 100 100">
        {/* Background track */}
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="#E2E8F0"
          strokeWidth="8"
        />
        {/* Progress arc */}
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={strokeColor}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 50 50)"
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      {/* Center text */}
      <span
        className="absolute text-lg font-bold"
        style={{ color: strokeColor }}
      >
        {clampedPercent.toFixed(0)}%
      </span>
    </div>
  );
}

// ── Type Badge ─────────────────────────────────────────────────────────────

function TargetTypeBadge({ type }: { type: TargetType }) {
  const map: Record<TargetType, string> = {
    REVENUE:  "bg-green-50 text-green-700 border-green-200",
    ORDERS:   "bg-blue-50 text-blue-700 border-blue-200",
    PATIENTS: "bg-purple-50 text-purple-700 border-purple-200",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${map[type]}`}>
      {type}
    </span>
  );
}

// ── Format value based on type ─────────────────────────────────────────────

function formatTargetValue(value: number, type: TargetType): string {
  if (type === "REVENUE") return formatCurrency(value);
  return value.toLocaleString();
}

// ── Add Target Modal ───────────────────────────────────────────────────────

function AddTargetModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState<CreateTargetForm>({
    type: "REVENUE",
    targetValue: "",
    periodStart: "",
    periodEnd: "",
  });
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post("/crm/targets", data),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (e: unknown) => {
      setError(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "Failed to create target"
      );
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.targetValue) { setError("Target value is required"); return; }
    if (!form.periodStart) { setError("Period start is required"); return; }
    if (!form.periodEnd) { setError("Period end is required"); return; }
    mutation.mutate({
      type: form.type,
      targetValue: parseFloat(form.targetValue),
      periodStart: form.periodStart,
      periodEnd: form.periodEnd,
    });
  }

  const TARGET_TYPES: TargetType[] = ["REVENUE", "ORDERS", "PATIENTS"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Add Revenue Target</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as TargetType }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            >
              {TARGET_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Target Value *</label>
            <input
              type="number"
              min="0"
              step="1"
              value={form.targetValue}
              onChange={(e) => setForm((f) => ({ ...f, targetValue: e.target.value }))}
              placeholder={form.type === "REVENUE" ? "500000" : "100"}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Period Start *</label>
              <input
                type="date"
                value={form.periodStart}
                onChange={(e) => setForm((f) => ({ ...f, periodStart: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Period End *</label>
              <input
                type="date"
                value={form.periodEnd}
                onChange={(e) => setForm((f) => ({ ...f, periodEnd: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 px-4 py-2 bg-[#1B4F8A] rounded-lg text-sm font-semibold text-white hover:bg-[#163d6a] disabled:opacity-50"
            >
              {mutation.isPending ? "Adding..." : "Add Target"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Target Card ────────────────────────────────────────────────────────────

function TargetCard({ target }: { target: RevenueTarget }) {
  const progressColor =
    target.progressPercent >= 75
      ? "text-green-600"
      : target.progressPercent >= 40
      ? "text-amber-600"
      : "text-red-500";

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <TargetTypeBadge type={target.type} />
          <p className="text-xs text-slate-500 mt-2">
            {formatDate(target.periodStart)} — {formatDate(target.periodEnd)}
          </p>
        </div>
        <RadialGauge percent={target.progressPercent} />
      </div>

      {/* Progress detail */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Achieved</span>
          <span className={`font-bold ${progressColor}`}>
            {formatTargetValue(target.achievedValue, target.type)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Target</span>
          <span className="font-semibold text-slate-700">
            {formatTargetValue(target.targetValue, target.type)}
          </span>
        </div>
        {/* Progress bar */}
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden mt-1">
          <div
            className={`h-full rounded-full transition-all ${
              target.progressPercent >= 75
                ? "bg-green-500"
                : target.progressPercent >= 40
                ? "bg-amber-400"
                : "bg-red-400"
            }`}
            style={{ width: `${Math.min(100, target.progressPercent)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function TargetsPage() {
  const qc = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);

  const { data: targets, isLoading } = useQuery({
    queryKey: ["revenue-targets-dashboard"],
    queryFn: async () => {
      const res = await api.get<{ data: RevenueTarget[] }>("/crm/targets/dashboard");
      return res.data.data;
    },
  });

  // Summary stats derived from targets
  const totalTargets = targets?.length ?? 0;
  const onTrack = targets?.filter((t) => t.progressPercent >= 75).length ?? 0;
  const atRisk = targets?.filter((t) => t.progressPercent < 40).length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Revenue Targets</h1>
          <p className="text-sm text-slate-500 mt-0.5">Monitor and manage performance targets across the team</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1B4F8A] text-white rounded-lg text-sm font-semibold hover:bg-[#163d6a]"
        >
          <Plus className="w-4 h-4" />
          Add Target
        </button>
      </div>

      {/* Summary KPI strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Targets", value: totalTargets, Icon: Target, color: "text-slate-800", bg: "bg-slate-50" },
          { label: "On Track (≥75%)", value: onTrack, Icon: TrendingUp, color: "text-green-600", bg: "bg-green-50" },
          { label: "At Risk (<40%)", value: atRisk, Icon: TrendingUp, color: "text-red-500", bg: "bg-red-50" },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${k.bg} flex items-center justify-center`}>
              <k.Icon className={`w-5 h-5 ${k.color}`} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">{k.label}</p>
              <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Target Cards Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1B4F8A]" />
        </div>
      ) : targets && targets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {targets.map((target) => (
            <TargetCard key={target.id} target={target} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
          <Target className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p className="font-medium">No targets defined yet</p>
          <p className="text-sm mt-1">Click "Add Target" to get started</p>
        </div>
      )}

      {showAddModal && (
        <AddTargetModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["revenue-targets-dashboard"] });
          }}
        />
      )}
    </div>
  );
}
