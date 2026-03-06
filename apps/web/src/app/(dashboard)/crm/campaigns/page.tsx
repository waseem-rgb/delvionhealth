"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, BarChart2, X } from "lucide-react";
import { DataTable } from "@/components/tables/DataTable";
import { formatCurrency, formatDate } from "@/lib/utils";
import api from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────

type CampaignType = "EMAIL" | "SMS" | "WHATSAPP" | "CALL" | "VISIT";
type CampaignStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";

interface Campaign {
  id: string;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  sentCount: number;
  openCount: number;
  conversionRate: number;
  budget: number | null;
  startDate: string | null;
  endDate: string | null;
  targetSegment: string | null;
  createdAt: string;
}

interface CampaignMeta {
  total: number;
  totalPages: number;
}

interface CampaignStats {
  sentCount: number;
  openRate: number;
  conversionRate: number;
  roi: number;
}

interface CreateCampaignForm {
  name: string;
  type: CampaignType;
  startDate: string;
  endDate: string;
  budget: string;
  targetSegment: string;
}

// ── Badge Helpers ──────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: CampaignType }) {
  const map: Record<CampaignType, string> = {
    EMAIL:    "bg-blue-50 text-blue-700 border-blue-200",
    SMS:      "bg-purple-50 text-purple-700 border-purple-200",
    WHATSAPP: "bg-green-50 text-green-700 border-green-200",
    CALL:     "bg-orange-50 text-orange-700 border-orange-200",
    VISIT:    "bg-teal-50 text-teal-700 border-teal-200",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${map[type]}`}>
      {type}
    </span>
  );
}

function StatusBadge({ status }: { status: CampaignStatus }) {
  const map: Record<CampaignStatus, string> = {
    DRAFT:     "bg-slate-100 text-slate-600 border-slate-200",
    ACTIVE:    "bg-green-50 text-green-700 border-green-200",
    PAUSED:    "bg-amber-50 text-amber-700 border-amber-200",
    COMPLETED: "bg-blue-50 text-blue-700 border-blue-200",
    CANCELLED: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${map[status]}`}>
      {status}
    </span>
  );
}

// ── Create Campaign Modal ──────────────────────────────────────────────────

function CreateCampaignModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState<CreateCampaignForm>({
    name: "",
    type: "EMAIL",
    startDate: "",
    endDate: "",
    budget: "",
    targetSegment: "",
  });
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post("/crm/campaigns", data),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (e: unknown) => {
      setError(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "Failed to create campaign"
      );
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Name is required"); return; }
    mutation.mutate({
      name: form.name,
      type: form.type,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      budget: form.budget ? parseFloat(form.budget) : undefined,
      targetSegment: form.targetSegment || undefined,
    });
  }

  const CAMPAIGN_TYPES: CampaignType[] = ["EMAIL", "SMS", "WHATSAPP", "CALL", "VISIT"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Create Campaign</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Campaign Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Q1 Doctor Outreach"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as CampaignType }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            >
              {CAMPAIGN_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Start Date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
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
            <label className="block text-xs font-semibold text-slate-600 mb-1">Budget (₹)</label>
            <input
              type="number"
              min="0"
              value={form.budget}
              onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
              placeholder="50000"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Target Segment</label>
            <input
              type="text"
              value={form.targetSegment}
              onChange={(e) => setForm((f) => ({ ...f, targetSegment: e.target.value }))}
              placeholder="Cardiologists, Bengaluru"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            />
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
              {mutation.isPending ? "Creating..." : "Create Campaign"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── View Stats Modal ───────────────────────────────────────────────────────

function ViewStatsModal({
  campaignId,
  campaignName,
  onClose,
}: {
  campaignId: string;
  campaignName: string;
  onClose: () => void;
}) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["campaign-stats", campaignId],
    queryFn: async () => {
      const res = await api.get<{ data: CampaignStats }>(`/crm/campaigns/${campaignId}/stats`);
      return res.data.data;
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Campaign Stats</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-slate-500">{campaignName}</p>
        {isLoading ? (
          <div className="flex items-center justify-center h-24">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#1B4F8A]" />
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Sent", value: stats.sentCount.toLocaleString(), color: "text-slate-800" },
              { label: "Open Rate", value: `${(stats.openRate * 100).toFixed(1)}%`, color: "text-blue-600" },
              { label: "Conversion Rate", value: `${(stats.conversionRate * 100).toFixed(1)}%`, color: "text-green-600" },
              { label: "ROI", value: `${stats.roi.toFixed(1)}x`, color: stats.roi >= 1 ? "text-green-600" : "text-red-500" },
            ].map((s) => (
              <div key={s.label} className="bg-slate-50 rounded-lg p-3 text-center">
                <p className="text-xs text-slate-500 mb-1">{s.label}</p>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400 text-center py-4">No stats available</p>
        )}
        <button
          onClick={onClose}
          className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function CampaignsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [statsFor, setStatsFor] = useState<{ id: string; name: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["campaigns", page],
    queryFn: async () => {
      const res = await api.get<{ data: { data: Campaign[]; meta: CampaignMeta } }>(
        `/crm/campaigns?page=${page}&limit=20`
      );
      return res.data.data;
    },
  });

  const columns: ColumnDef<Campaign>[] = [
    {
      header: "Name",
      cell: ({ row }) => (
        <div>
          <p className="font-semibold text-slate-800">{row.original.name}</p>
          {row.original.targetSegment && (
            <p className="text-xs text-slate-400 mt-0.5">{row.original.targetSegment}</p>
          )}
        </div>
      ),
    },
    {
      header: "Type",
      cell: ({ row }) => <TypeBadge type={row.original.type} />,
    },
    {
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      header: "Sent",
      cell: ({ row }) => <span className="font-medium text-slate-700">{row.original.sentCount.toLocaleString()}</span>,
    },
    {
      header: "Open Rate",
      cell: ({ row }) => {
        const rate = row.original.sentCount > 0
          ? ((row.original.openCount / row.original.sentCount) * 100).toFixed(1)
          : "0.0";
        return <span className="text-sm text-blue-600 font-medium">{rate}%</span>;
      },
    },
    {
      header: "Conversion Rate",
      cell: ({ row }) => (
        <span className="text-sm text-green-600 font-medium">
          {(row.original.conversionRate * 100).toFixed(1)}%
        </span>
      ),
    },
    {
      header: "Budget",
      cell: ({ row }) =>
        row.original.budget != null ? (
          <span className="text-sm font-medium text-slate-700">{formatCurrency(row.original.budget)}</span>
        ) : (
          <span className="text-slate-400 text-xs">—</span>
        ),
    },
    {
      header: "Period",
      cell: ({ row }) => {
        const c = row.original;
        if (!c.startDate) return <span className="text-slate-400 text-xs">—</span>;
        return (
          <div className="text-xs text-slate-500">
            <div>{formatDate(c.startDate)}</div>
            {c.endDate && <div>→ {formatDate(c.endDate)}</div>}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <button
          onClick={() => setStatsFor({ id: row.original.id, name: row.original.name })}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#1B4F8A] bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
        >
          <BarChart2 className="w-3.5 h-3.5" />
          View Stats
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Marketing Campaigns</h1>
          <p className="text-sm text-slate-500 mt-0.5">Performance tracking, ROI analysis, and outreach management</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1B4F8A] text-white rounded-lg text-sm font-semibold hover:bg-[#163d6a]"
        >
          <Plus className="w-4 h-4" />
          Create Campaign
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-700">All Campaigns</h2>
        </div>
        <div className="p-5">
          <DataTable
            columns={columns}
            data={data?.data ?? []}
            isLoading={isLoading}
            page={page}
            total={data?.meta.total}
            pageSize={20}
            onPageChange={setPage}
          />
        </div>
      </div>

      {showCreate && (
        <CreateCampaignModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["campaigns"] });
          }}
        />
      )}

      {statsFor && (
        <ViewStatsModal
          campaignId={statsFor.id}
          campaignName={statsFor.name}
          onClose={() => setStatsFor(null)}
        />
      )}
    </div>
  );
}
