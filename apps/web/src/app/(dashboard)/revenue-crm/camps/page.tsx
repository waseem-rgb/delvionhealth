"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Tent,
  Plus,
  X,
  MapPin,
  CalendarDays,
  Users,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

// ── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (v: number) => new Intl.NumberFormat("en-IN").format(v);

const STATUS_COLORS: Record<string, string> = {
  LEAD: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  PROPOSAL_SENT: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  CONFIRMED: "bg-green-500/20 text-green-400 border-green-500/30",
  EXECUTED: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  INVOICED: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

const PIPELINE_STATUSES = [
  "LEAD",
  "PROPOSAL_SENT",
  "CONFIRMED",
  "EXECUTED",
  "INVOICED",
] as const;

const ORGANISER_TYPES = [
  "CORPORATE",
  "RWA",
  "NGO",
  "HOSPITAL",
  "GOVERNMENT",
  "OTHER",
];

// ── Types ───────────────────────────────────────────────────────────────────

interface Camp {
  id: string;
  name: string;
  organiserName: string;
  organiserType?: string;
  contactName?: string;
  contactPhone?: string;
  address?: string;
  city?: string;
  campDate?: string;
  packageName?: string;
  pricePerPerson?: number;
  expectedPax: number;
  actualPax?: number;
  revenue?: number;
  status: string;
  notes?: string;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function CampsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    organiserName: "",
    organiserType: "CORPORATE",
    contactName: "",
    contactPhone: "",
    address: "",
    city: "",
    campDate: "",
    packageName: "",
    pricePerPerson: "",
    expectedPax: "",
    notes: "",
  });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["revenue-crm", "camps"],
    queryFn: async () => {
      const res = await api.get("/revenue-crm/camps");
      const raw = res.data?.data ?? res.data;
      return Array.isArray(raw) ? raw : (raw?.items ?? raw?.camps ?? []) as Camp[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      const body = {
        ...payload,
        expectedPax: Number(payload.expectedPax),
        pricePerPerson: payload.pricePerPerson
          ? Number(payload.pricePerPerson)
          : undefined,
      };
      const res = await api.post("/revenue-crm/camps", body);
      return res.data?.data ?? res.data;
    },
    onSuccess: () => {
      toast.success("Camp created");
      queryClient.invalidateQueries({ queryKey: ["revenue-crm", "camps"] });
      setShowForm(false);
      setForm({
        name: "",
        organiserName: "",
        organiserType: "CORPORATE",
        contactName: "",
        contactPhone: "",
        address: "",
        city: "",
        campDate: "",
        packageName: "",
        pricePerPerson: "",
        expectedPax: "",
        notes: "",
      });
    },
    onError: () => toast.error("Failed to create camp"),
  });

  const camps = data ?? [];

  const statusCounts = PIPELINE_STATUSES.reduce(
    (acc, s) => {
      acc[s] = camps.filter((c) => c.status === s).length;
      return acc;
    },
    {} as Record<string, number>,
  );

  // ── Loading ─────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 p-6">
        <div className="mb-8">
          <div className="h-8 w-48 animate-pulse rounded bg-slate-800" />
        </div>
        <div className="mb-6 flex gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-10 w-36 animate-pulse rounded-lg bg-slate-800"
            />
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-56 animate-pulse rounded-xl bg-slate-900"
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────

  if (isError) {
    return (
      <div className="min-h-screen bg-slate-950 p-6">
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-400">
          Failed to load camps:{" "}
          {error instanceof Error ? error.message : "Unknown error"}
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Health Camps</h1>
          <p className="text-slate-400">
            Plan and track health camp events
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          New Camp
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
      {camps.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900 py-20">
          <Tent className="mb-4 h-12 w-12 text-slate-600" />
          <p className="text-lg font-medium text-slate-400">No data found</p>
        </div>
      ) : (
        /* Camp Cards Grid */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {camps.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-slate-800 bg-slate-900 p-5"
            >
              <div className="mb-3 flex items-start justify-between">
                <h3 className="text-lg font-semibold text-white">{c.name}</h3>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[c.status] ?? "bg-slate-700 text-slate-300"}`}
                >
                  {c.status.replace("_", " ")}
                </span>
              </div>

              <div className="space-y-2 text-sm text-slate-400">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>Organiser: {c.organiserName}</span>
                </div>
                {c.campDate && (
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    <span>
                      {new Date(c.campDate).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {c.city && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>{c.city}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>
                    Expected: {c.expectedPax}
                    {c.actualPax !== undefined && ` | Actual: ${c.actualPax}`}
                  </span>
                </div>
                {c.revenue !== undefined && (
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    <span>Revenue: {fmt(c.revenue)}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── New Camp Modal ─────────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-800 bg-slate-900 p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">New Camp</h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-slate-400 hover:text-white"
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
                <label className="mb-1 block text-sm text-slate-400">
                  Camp Name *
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm text-slate-400">
                    Organiser Name *
                  </label>
                  <input
                    required
                    value={form.organiserName}
                    onChange={(e) =>
                      setForm({ ...form, organiserName: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-400">
                    Organiser Type
                  </label>
                  <select
                    value={form.organiserType}
                    onChange={(e) =>
                      setForm({ ...form, organiserType: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  >
                    {ORGANISER_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm text-slate-400">
                    Contact Name
                  </label>
                  <input
                    value={form.contactName}
                    onChange={(e) =>
                      setForm({ ...form, contactName: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-400">
                    Contact Phone
                  </label>
                  <input
                    value={form.contactPhone}
                    onChange={(e) =>
                      setForm({ ...form, contactPhone: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-400">
                  Address
                </label>
                <input
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm text-slate-400">
                    City
                  </label>
                  <input
                    value={form.city}
                    onChange={(e) =>
                      setForm({ ...form, city: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-400">
                    Camp Date
                  </label>
                  <input
                    type="date"
                    value={form.campDate}
                    onChange={(e) =>
                      setForm({ ...form, campDate: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-sm text-slate-400">
                    Package Name
                  </label>
                  <input
                    value={form.packageName}
                    onChange={(e) =>
                      setForm({ ...form, packageName: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-400">
                    Price/Person
                  </label>
                  <input
                    type="number"
                    value={form.pricePerPerson}
                    onChange={(e) =>
                      setForm({ ...form, pricePerPerson: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-400">
                    Expected Pax *
                  </label>
                  <input
                    required
                    type="number"
                    value={form.expectedPax}
                    onChange={(e) =>
                      setForm({ ...form, expectedPax: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-400">
                  Notes
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={createMutation.isPending}
                className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {createMutation.isPending ? "Creating..." : "Create Camp"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
