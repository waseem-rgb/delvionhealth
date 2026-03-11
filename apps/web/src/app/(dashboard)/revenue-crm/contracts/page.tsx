"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Plus,
  X,
  Eye,
  Users,
  DollarSign,
  CalendarDays,
  UserCheck,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

// ── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (v: number) => new Intl.NumberFormat("en-IN").format(v);

const STATUS_COLORS: Record<string, string> = {
  PROSPECT: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  NEGOTIATING: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  ACTIVE: "bg-green-500/20 text-green-400 border-green-500/30",
  RENEWAL_DUE: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  EXPIRED: "bg-red-500/20 text-red-400 border-red-500/30",
};

const PIPELINE_STATUSES = [
  "PROSPECT",
  "NEGOTIATING",
  "ACTIVE",
  "RENEWAL_DUE",
  "EXPIRED",
] as const;

// ── Types ───────────────────────────────────────────────────────────────────

interface Contract {
  id: string;
  companyName: string;
  hrContactName?: string;
  hrContactPhone?: string;
  hrContactEmail?: string;
  employeeCount: number;
  completedCount?: number;
  contractValue: number;
  pricePerEmployee?: number;
  revenueCollected?: number;
  packageName?: string;
  contractStart?: string;
  contractEnd?: string;
  status: string;
  assignedRep?: string;
  notes?: string;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function ContractsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    companyName: "",
    hrContactName: "",
    hrContactPhone: "",
    hrContactEmail: "",
    employeeCount: "",
    contractValue: "",
    pricePerEmployee: "",
    contractStart: "",
    contractEnd: "",
    status: "PROSPECT",
    notes: "",
  });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["revenue-crm", "contracts"],
    queryFn: async () => {
      const res = await api.get("/revenue-crm/contracts");
      const raw = res.data?.data ?? res.data;
      return (Array.isArray(raw) ? raw : (raw?.items ?? raw?.contracts ?? [])) as Contract[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      const body = {
        ...payload,
        employeeCount: Number(payload.employeeCount),
        contractValue: Number(payload.contractValue),
        pricePerEmployee: payload.pricePerEmployee
          ? Number(payload.pricePerEmployee)
          : undefined,
      };
      const res = await api.post("/revenue-crm/contracts", body);
      return res.data?.data ?? res.data;
    },
    onSuccess: () => {
      toast.success("Contract created");
      queryClient.invalidateQueries({ queryKey: ["revenue-crm", "contracts"] });
      setShowForm(false);
      setForm({
        companyName: "",
        hrContactName: "",
        hrContactPhone: "",
        hrContactEmail: "",
        employeeCount: "",
        contractValue: "",
        pricePerEmployee: "",
        contractStart: "",
        contractEnd: "",
        status: "PROSPECT",
        notes: "",
      });
    },
    onError: () => toast.error("Failed to create contract"),
  });

  const contracts = data ?? [];

  const statusCounts = PIPELINE_STATUSES.reduce(
    (acc, s) => {
      acc[s] = contracts.filter((c) => c.status === s).length;
      return acc;
    },
    {} as Record<string, number>,
  );

  // ── Loading ─────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mb-8">
          <div className="h-8 w-64 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="mb-6 flex gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-10 w-32 animate-pulse rounded-lg bg-slate-100"
            />
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-64 animate-pulse rounded-xl bg-white"
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
          Failed to load contracts:{" "}
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
          <h1 className="text-2xl font-bold text-slate-900">
            Corporates &amp; AHC
          </h1>
          <p className="text-slate-500">
            Manage corporate contracts and annual health check-ups
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          New Contract
        </button>
      </div>

      {/* Pipeline Status Counts */}
      <div className="mb-6 flex flex-wrap gap-3">
        {PIPELINE_STATUSES.map((s) => (
          <div
            key={s}
            className={`rounded-lg border px-4 py-2 text-sm font-medium ${STATUS_COLORS[s]}`}
          >
            {s.replace("_", " ")} &middot; {statusCounts[s]}
          </div>
        ))}
      </div>

      {/* Empty State */}
      {contracts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-20">
          <Building2 className="mb-4 h-12 w-12 text-slate-600" />
          <p className="text-lg font-medium text-slate-500">No data found</p>
        </div>
      ) : (
        /* Contract Cards Grid */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {contracts.map((c) => {
            const progress =
              c.employeeCount > 0
                ? ((c.completedCount ?? 0) / c.employeeCount) * 100
                : 0;
            return (
              <div
                key={c.id}
                className="rounded-xl border border-slate-200 bg-white p-5"
              >
                <div className="mb-3 flex items-start justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">
                    {c.companyName}
                  </h3>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[c.status] ?? "bg-slate-200 text-slate-700"}`}
                  >
                    {c.status.replace("_", " ")}
                  </span>
                </div>

                <div className="mb-4 space-y-2 text-sm text-slate-500">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    <span>Contract Value: {fmt(c.contractValue)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>Employees: {c.employeeCount}</span>
                  </div>
                  {c.packageName && (
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <span>Package: {c.packageName}</span>
                    </div>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="mb-1 flex justify-between text-xs text-slate-500">
                    <span>
                      Completed: {c.completedCount ?? 0} / {c.employeeCount}
                    </span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all"
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-1.5 text-sm text-slate-500">
                  {c.revenueCollected !== undefined && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-3.5 w-3.5" />
                      Revenue Collected: {fmt(c.revenueCollected)}
                    </div>
                  )}
                  {c.contractStart && (
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {new Date(c.contractStart).toLocaleDateString()} &ndash;{" "}
                      {c.contractEnd
                        ? new Date(c.contractEnd).toLocaleDateString()
                        : "Ongoing"}
                    </div>
                  )}
                  {c.assignedRep && (
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-3.5 w-3.5" />
                      Rep: {c.assignedRep}
                    </div>
                  )}
                </div>

                <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 py-2 text-sm text-slate-700 hover:bg-slate-100">
                  <Eye className="h-4 w-4" />
                  View Details
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── New Contract Modal ────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                New Contract
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
              {/* Company Name */}
              <div>
                <label className="mb-1 block text-sm text-slate-500">
                  Company Name *
                </label>
                <input
                  required
                  value={form.companyName}
                  onChange={(e) =>
                    setForm({ ...form, companyName: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* HR Contact */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-sm text-slate-500">
                    HR Name
                  </label>
                  <input
                    value={form.hrContactName}
                    onChange={(e) =>
                      setForm({ ...form, hrContactName: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-500">
                    HR Phone
                  </label>
                  <input
                    value={form.hrContactPhone}
                    onChange={(e) =>
                      setForm({ ...form, hrContactPhone: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-500">
                    HR Email
                  </label>
                  <input
                    type="email"
                    value={form.hrContactEmail}
                    onChange={(e) =>
                      setForm({ ...form, hrContactEmail: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Numbers */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-sm text-slate-500">
                    Employees *
                  </label>
                  <input
                    required
                    type="number"
                    value={form.employeeCount}
                    onChange={(e) =>
                      setForm({ ...form, employeeCount: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-500">
                    Contract Value *
                  </label>
                  <input
                    required
                    type="number"
                    value={form.contractValue}
                    onChange={(e) =>
                      setForm({ ...form, contractValue: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-500">
                    Price/Employee
                  </label>
                  <input
                    type="number"
                    value={form.pricePerEmployee}
                    onChange={(e) =>
                      setForm({ ...form, pricePerEmployee: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm text-slate-500">
                    Contract Start
                  </label>
                  <input
                    type="date"
                    value={form.contractStart}
                    onChange={(e) =>
                      setForm({ ...form, contractStart: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-500">
                    Contract End
                  </label>
                  <input
                    type="date"
                    value={form.contractEnd}
                    onChange={(e) =>
                      setForm({ ...form, contractEnd: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="mb-1 block text-sm text-slate-500">
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                >
                  {PIPELINE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="mb-1 block text-sm text-slate-500">
                  Notes
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={createMutation.isPending}
                className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {createMutation.isPending ? "Creating..." : "Create Contract"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
