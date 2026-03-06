"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Plus,
  Tent,
  CalendarCheck,
  PlayCircle,
  CheckCircle2,
  Users,
  X,
  MapPin,
  Building2,
  CalendarDays,
  FileText,
} from "lucide-react";
import { DataTable } from "@/components/tables/DataTable";
import { formatCurrency, formatDate } from "@/lib/utils";
import api from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────

type CampStatus = "PLANNED" | "ACTIVE" | "COMPLETED" | "CANCELLED";

interface Camp {
  id: string;
  name: string;
  organization: string;
  location: string;
  campDate: string;
  endDate: string | null;
  expectedCount: number;
  actualCount: number;
  revenue: number;
  status: CampStatus;
  notes: string | null;
  createdAt: string;
}

interface CampMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface CreateCampForm {
  name: string;
  organization: string;
  location: string;
  campDate: string;
  endDate: string;
  expectedCount: string;
  notes: string;
}

const STATUS_TABS: Array<{ label: string; value: CampStatus | "ALL" }> = [
  { label: "All", value: "ALL" },
  { label: "Planned", value: "PLANNED" },
  { label: "Active", value: "ACTIVE" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Cancelled", value: "CANCELLED" },
];

// ── Status Badge ──────────────────────────────────────────────────────────

function CampStatusBadge({ status }: { status: CampStatus }) {
  const map: Record<CampStatus, string> = {
    PLANNED:   "bg-blue-50 text-blue-700 border-blue-200",
    ACTIVE:    "bg-green-50 text-green-700 border-green-200",
    COMPLETED: "bg-slate-100 text-slate-600 border-slate-200",
    CANCELLED: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${map[status]}`}>
      {status}
    </span>
  );
}

// ── Create Camp Modal ──────────────────────────────────────────────────────

function CreateCampModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState<CreateCampForm>({
    name: "",
    organization: "",
    location: "",
    campDate: "",
    endDate: "",
    expectedCount: "",
    notes: "",
  });
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post("/corporate/camps", data),
    onSuccess: () => {
      onSuccess();
      onClose();
    },
    onError: (e: unknown) => {
      setError(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "Failed to create camp"
      );
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Camp name is required"); return; }
    if (!form.organization.trim()) { setError("Organization is required"); return; }
    if (!form.campDate) { setError("Camp date is required"); return; }
    setError("");
    mutation.mutate({
      name: form.name.trim(),
      organization: form.organization.trim(),
      location: form.location.trim() || undefined,
      campDate: form.campDate,
      endDate: form.endDate || undefined,
      expectedCount: form.expectedCount ? parseInt(form.expectedCount, 10) : undefined,
      notes: form.notes.trim() || undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Tent className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">New Health Camp</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2.5">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Camp Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Annual Employee Health Screening"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Organization *</label>
            <input
              type="text"
              value={form.organization}
              onChange={(e) => setForm((f) => ({ ...f, organization: e.target.value }))}
              placeholder="Infosys Ltd."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Location</label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              placeholder="Corporate Office, Whitefield, Bengaluru"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Camp Date *</label>
              <input
                type="date"
                value={form.campDate}
                onChange={(e) => setForm((f) => ({ ...f, campDate: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">End Date</label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Expected Participants</label>
            <input
              type="number"
              min="0"
              value={form.expectedCount}
              onChange={(e) => setForm((f) => ({ ...f, expectedCount: e.target.value }))}
              placeholder="500"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              placeholder="Any special instructions, test packages, logistics notes..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 px-4 py-2 bg-[#1B4F8A] rounded-lg text-sm font-semibold text-white hover:bg-[#163d6a] disabled:opacity-50 transition"
            >
              {mutation.isPending ? "Creating..." : "Create Camp"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function CampsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<CampStatus | "ALL">("ALL");
  const [showCreate, setShowCreate] = useState(false);

  // ── Fetch camps ──
  const { data, isLoading, isError } = useQuery({
    queryKey: ["corporate-camps", page, statusFilter],
    queryFn: async () => {
      try {
        const params: Record<string, unknown> = { page, limit: 20 };
        if (statusFilter !== "ALL") params.status = statusFilter;
        const res = await api.get("/corporate/camps", { params });
        const payload = res.data?.data ?? res.data;
        // Normalize: payload may be { data: Camp[], meta } or Camp[] directly
        if (Array.isArray(payload)) {
          return { data: payload as Camp[], meta: { total: payload.length, page: 1, limit: 20, totalPages: 1 } };
        }
        if (payload && typeof payload === "object" && "data" in payload) {
          return payload as { data: Camp[]; meta: CampMeta };
        }
        return { data: [] as Camp[], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } };
      } catch {
        return { data: [] as Camp[], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } };
      }
    },
  });

  const camps = data?.data ?? [];
  const meta = data?.meta ?? { total: 0, page: 1, limit: 20, totalPages: 0 };

  // ── Compute KPIs ──
  const totalCamps = meta.total || camps.length;
  const upcoming = camps.filter((c) => c.status === "PLANNED").length;
  const inProgress = camps.filter((c) => c.status === "ACTIVE").length;
  const completed = camps.filter((c) => c.status === "COMPLETED").length;
  const totalParticipants = camps.reduce((sum, c) => sum + (c.actualCount || 0), 0);

  // ── Table columns ──
  const columns: ColumnDef<Camp>[] = [
    {
      accessorKey: "name",
      header: "Camp Name",
      cell: ({ row }) => (
        <div>
          <p className="font-semibold text-slate-800 text-sm">{row.original.name}</p>
          {row.original.notes && (
            <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[200px]" title={row.original.notes}>
              {row.original.notes}
            </p>
          )}
        </div>
      ),
    },
    {
      accessorKey: "organization",
      header: "Organization",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="text-sm text-slate-700">{row.original.organization}</span>
        </div>
      ),
    },
    {
      accessorKey: "campDate",
      header: "Date",
      cell: ({ row }) => (
        <div className="text-xs text-slate-600">
          <div>{formatDate(row.original.campDate)}</div>
          {row.original.endDate && (
            <div className="text-slate-400">to {formatDate(row.original.endDate)}</div>
          )}
        </div>
      ),
    },
    {
      accessorKey: "location",
      header: "Location",
      cell: ({ row }) =>
        row.original.location ? (
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-xs text-slate-600 max-w-[160px] truncate" title={row.original.location}>
              {row.original.location}
            </span>
          </div>
        ) : (
          <span className="text-slate-400 text-xs">--</span>
        ),
    },
    {
      id: "participants",
      header: "Participants",
      cell: ({ row }) => {
        const c = row.original;
        return (
          <div className="text-sm">
            <span className="font-semibold text-slate-800">{c.actualCount || 0}</span>
            <span className="text-slate-400"> / {c.expectedCount || 0}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "revenue",
      header: "Revenue",
      cell: ({ row }) =>
        row.original.revenue > 0 ? (
          <span className="text-sm font-medium text-slate-800">{formatCurrency(row.original.revenue)}</span>
        ) : (
          <span className="text-slate-400 text-xs">--</span>
        ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <CampStatusBadge status={row.original.status} />,
    },
  ];

  // ── KPI items ──
  const kpis = [
    { label: "Total Camps", value: totalCamps, icon: Tent, color: "bg-blue-50 text-blue-600" },
    { label: "Upcoming", value: upcoming, icon: CalendarCheck, color: "bg-amber-50 text-amber-600" },
    { label: "In Progress", value: inProgress, icon: PlayCircle, color: "bg-green-50 text-green-600" },
    { label: "Completed", value: completed, icon: CheckCircle2, color: "bg-slate-100 text-slate-600" },
    { label: "Total Participants", value: totalParticipants.toLocaleString(), icon: Users, color: "bg-purple-50 text-purple-600" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Camp Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Plan, schedule, and track corporate health camps
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1B4F8A] text-white rounded-lg text-sm font-semibold hover:bg-[#163d6a] transition"
        >
          <Plus className="w-4 h-4" />
          New Camp
        </button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2.5 rounded-lg ${kpi.color.split(" ")[0]}`}>
                  <Icon className={`w-5 h-5 ${kpi.color.split(" ")[1]}`} />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900">{isLoading ? "--" : kpi.value}</p>
              <p className="text-sm text-slate-500 mt-0.5">{kpi.label}</p>
            </div>
          );
        })}
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setStatusFilter(tab.value);
              setPage(1);
            }}
            className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
              statusFilter === tab.value
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table or Empty State */}
      {!isLoading && camps.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <Tent className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-1">No camps found</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">
            {statusFilter !== "ALL"
              ? `No ${statusFilter.toLowerCase()} camps at the moment. Try a different filter or create a new camp.`
              : "Get started by planning your first corporate health camp. Click the button below to create one."}
          </p>
          {statusFilter === "ALL" && (
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1B4F8A] text-white rounded-lg text-sm font-semibold hover:bg-[#163d6a] transition"
            >
              <Plus className="w-4 h-4" />
              Plan New Camp
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">
              {statusFilter === "ALL" ? "All Camps" : `${statusFilter.charAt(0) + statusFilter.slice(1).toLowerCase()} Camps`}
            </h2>
            <span className="text-xs text-slate-400">{meta.total || camps.length} total</span>
          </div>
          <div className="p-5">
            <DataTable
              columns={columns}
              data={camps}
              isLoading={isLoading}
              page={page}
              total={meta.total}
              pageSize={20}
              onPageChange={setPage}
            />
          </div>
        </div>
      )}

      {/* Create Camp Modal */}
      {showCreate && (
        <CreateCampModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ["corporate-camps"] });
          }}
        />
      )}
    </div>
  );
}
