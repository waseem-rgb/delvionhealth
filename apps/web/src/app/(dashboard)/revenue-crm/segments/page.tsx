"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  Plus,
  X,
  Tag,
  Hash,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

// ── Types ───────────────────────────────────────────────────────────────────

interface Segment {
  id: string;
  name: string;
  description?: string;
  type: "DYNAMIC" | "STATIC";
  estimatedCount?: number;
  isSystem?: boolean;
  filterRules?: unknown;
}

const TYPE_COLORS: Record<string, string> = {
  DYNAMIC: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  STATIC: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
};

// ── Component ───────────────────────────────────────────────────────────────

export default function SegmentsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    type: "DYNAMIC",
    filterRules: "",
  });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["revenue-crm", "segments"],
    queryFn: async () => {
      const res = await api.get("/revenue-crm/segments");
      return (res.data?.data ?? res.data) as Segment[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      const body = {
        name: payload.name,
        description: payload.description || undefined,
        type: payload.type,
        filterRules: payload.filterRules
          ? JSON.parse(payload.filterRules)
          : undefined,
      };
      const res = await api.post("/revenue-crm/segments", body);
      return res.data?.data ?? res.data;
    },
    onSuccess: () => {
      toast.success("Segment created");
      queryClient.invalidateQueries({ queryKey: ["revenue-crm", "segments"] });
      setShowForm(false);
      setForm({ name: "", description: "", type: "DYNAMIC", filterRules: "" });
    },
    onError: () => toast.error("Failed to create segment"),
  });

  const segments = data ?? [];

  // ── Loading ─────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mb-8">
          <div className="h-8 w-52 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-xl bg-white"
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────

  if (isError) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-400">
          Failed to load segments:{" "}
          {error instanceof Error ? error.message : "Unknown error"}
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Patient Segments</h1>
          <p className="text-slate-500">
            Define and manage patient segments for targeted outreach
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Create Segment
        </button>
      </div>

      {/* Empty State */}
      {segments.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-20">
          <Users className="mb-4 h-12 w-12 text-slate-600" />
          <p className="text-lg font-medium text-slate-500">No data found</p>
        </div>
      ) : (
        /* Segment Cards */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {segments.map((seg) => (
            <div
              key={seg.id}
              className="rounded-xl border border-slate-200 bg-white p-5"
            >
              <div className="mb-3 flex items-start justify-between">
                <h3 className="text-lg font-semibold text-slate-900">{seg.name}</h3>
                <div className="flex gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${TYPE_COLORS[seg.type] ?? "bg-slate-200 text-slate-700"}`}
                  >
                    {seg.type}
                  </span>
                  {seg.isSystem && (
                    <span className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/20 px-2.5 py-0.5 text-xs font-medium text-amber-400">
                      <Shield className="h-3 w-3" />
                      System
                    </span>
                  )}
                </div>
              </div>

              {seg.description && (
                <p className="mb-3 text-sm text-slate-500">{seg.description}</p>
              )}

              <div className="flex items-center gap-4 text-sm text-slate-500">
                {seg.estimatedCount !== undefined && (
                  <div className="flex items-center gap-1">
                    <Hash className="h-3.5 w-3.5" />
                    <span>~{seg.estimatedCount.toLocaleString()} patients</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Tag className="h-3.5 w-3.5" />
                  <span>{seg.type}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Create Segment Modal ──────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Create Segment
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-slate-500 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate(form);
              }}
              className="space-y-4"
            >
              <div>
                <label className="mb-1 block text-sm text-slate-500">
                  Segment Name *
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-500">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-500">
                  Type
                </label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                >
                  <option value="DYNAMIC">DYNAMIC</option>
                  <option value="STATIC">STATIC</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-500">
                  Filter Rules (JSON)
                </label>
                <textarea
                  value={form.filterRules}
                  onChange={(e) =>
                    setForm({ ...form, filterRules: e.target.value })
                  }
                  rows={5}
                  placeholder='{"ageRange": {"min": 30, "max": 60}, "gender": "FEMALE"}'
                  className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 font-mono text-sm text-slate-900 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={createMutation.isPending}
                className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {createMutation.isPending ? "Creating..." : "Create Segment"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
