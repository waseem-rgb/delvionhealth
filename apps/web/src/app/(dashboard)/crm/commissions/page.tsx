"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, CheckCircle, DollarSign, Clock, X } from "lucide-react";
import { DataTable } from "@/components/tables/DataTable";
import { KPICard } from "@/components/shared/KPICard";
import { formatCurrency, formatDate } from "@/lib/utils";
import api from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────

type CommissionRule = "FLAT" | "PERCENTAGE" | "TIERED";
type CommissionStatus = "PENDING" | "APPROVED" | "PAID";

interface Commission {
  id: string;
  doctorId: string;
  invoiceId: string;
  amount: number;
  rule: CommissionRule;
  rate: number | null;
  status: CommissionStatus;
  paidAt: string | null;
  createdAt: string;
  doctor?: { name: string } | null;
}

interface CommissionSummary {
  pendingTotal: number;
  approvedTotal: number;
  paidTotal: number;
}

interface CommissionMeta {
  total: number;
  totalPages: number;
}

interface CreateCommissionForm {
  doctorId: string;
  invoiceId: string;
  amount: string;
  rule: CommissionRule;
  rate: string;
}

// ── Badge Helpers ──────────────────────────────────────────────────────────

function RuleBadge({ rule }: { rule: CommissionRule }) {
  const map: Record<CommissionRule, string> = {
    FLAT:       "bg-slate-100 text-slate-600 border-slate-200",
    PERCENTAGE: "bg-blue-50 text-blue-700 border-blue-200",
    TIERED:     "bg-purple-50 text-purple-700 border-purple-200",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${map[rule]}`}>
      {rule}
    </span>
  );
}

function CommissionStatusBadge({ status }: { status: CommissionStatus }) {
  const map: Record<CommissionStatus, string> = {
    PENDING:  "bg-amber-50 text-amber-700 border-amber-200",
    APPROVED: "bg-blue-50 text-blue-700 border-blue-200",
    PAID:     "bg-green-50 text-green-700 border-green-200",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${map[status]}`}>
      {status}
    </span>
  );
}

// ── Create Commission Modal ────────────────────────────────────────────────

function CreateCommissionModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState<CreateCommissionForm>({
    doctorId: "",
    invoiceId: "",
    amount: "",
    rule: "PERCENTAGE",
    rate: "",
  });
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post("/crm/commissions", data),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (e: unknown) => {
      setError(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "Failed to create commission"
      );
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.doctorId.trim()) { setError("Doctor ID is required"); return; }
    if (!form.invoiceId.trim()) { setError("Invoice ID is required"); return; }
    if (!form.amount) { setError("Amount is required"); return; }
    mutation.mutate({
      doctorId: form.doctorId,
      invoiceId: form.invoiceId,
      amount: parseFloat(form.amount),
      rule: form.rule,
      rate: form.rate ? parseFloat(form.rate) : undefined,
    });
  }

  const RULES: CommissionRule[] = ["FLAT", "PERCENTAGE", "TIERED"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Create Commission</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Doctor ID *</label>
            <input
              type="text"
              value={form.doctorId}
              onChange={(e) => setForm((f) => ({ ...f, doctorId: e.target.value }))}
              placeholder="doctor-uuid"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Invoice ID *</label>
            <input
              type="text"
              value={form.invoiceId}
              onChange={(e) => setForm((f) => ({ ...f, invoiceId: e.target.value }))}
              placeholder="DH-INV-20260101-0001"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Amount (₹) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="5000"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Rate (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={form.rate}
                onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))}
                placeholder="10"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Rule</label>
            <select
              value={form.rule}
              onChange={(e) => setForm((f) => ({ ...f, rule: e.target.value as CommissionRule }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            >
              {RULES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
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
              {mutation.isPending ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function CommissionsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);

  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const todayStr = today.toISOString().split("T")[0];

  const { data: summary } = useQuery({
    queryKey: ["commission-summary"],
    queryFn: async () => {
      const res = await api.get<{ data: CommissionSummary }>(
        `/crm/commissions/summary?from=${firstDayOfMonth}&to=${todayStr}`
      );
      return res.data.data;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["commissions", page],
    queryFn: async () => {
      const res = await api.get<{ data: { data: Commission[]; meta: CommissionMeta } }>(
        `/crm/commissions?page=${page}&limit=20`
      );
      return res.data.data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/crm/commissions/${id}/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commissions"] });
      qc.invalidateQueries({ queryKey: ["commission-summary"] });
    },
  });

  const payMutation = useMutation({
    mutationFn: (id: string) => api.post(`/crm/commissions/${id}/pay`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commissions"] });
      qc.invalidateQueries({ queryKey: ["commission-summary"] });
    },
  });

  const columns: ColumnDef<Commission>[] = [
    {
      header: "Doctor",
      cell: ({ row }) => (
        <div>
          <p className="text-xs font-mono text-slate-500">{row.original.doctorId.slice(0, 8)}…</p>
          {row.original.doctor?.name && (
            <p className="text-sm font-semibold text-slate-800">{row.original.doctor.name}</p>
          )}
        </div>
      ),
    },
    {
      header: "Invoice ID",
      cell: ({ row }) => (
        <span className="text-xs font-mono text-slate-600">{row.original.invoiceId}</span>
      ),
    },
    {
      header: "Amount",
      cell: ({ row }) => (
        <span className="font-semibold text-slate-800">{formatCurrency(row.original.amount)}</span>
      ),
    },
    {
      header: "Rule",
      cell: ({ row }) => <RuleBadge rule={row.original.rule} />,
    },
    {
      header: "Rate",
      cell: ({ row }) =>
        row.original.rate != null ? (
          <span className="text-sm text-slate-600">{row.original.rate}%</span>
        ) : (
          <span className="text-slate-400 text-xs">—</span>
        ),
    },
    {
      header: "Status",
      cell: ({ row }) => <CommissionStatusBadge status={row.original.status} />,
    },
    {
      header: "Paid At",
      cell: ({ row }) =>
        row.original.paidAt ? (
          <span className="text-xs text-slate-500">{formatDate(row.original.paidAt)}</span>
        ) : (
          <span className="text-slate-400 text-xs">—</span>
        ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const c = row.original;
        return (
          <div className="flex gap-1.5">
            {c.status === "PENDING" && (
              <button
                onClick={() => approveMutation.mutate(c.id)}
                disabled={approveMutation.isPending}
                className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Approve
              </button>
            )}
            {c.status === "APPROVED" && (
              <button
                onClick={() => payMutation.mutate(c.id)}
                disabled={payMutation.isPending}
                className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50"
              >
                <DollarSign className="w-3.5 h-3.5" />
                Mark Paid
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Doctor Commissions</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track and manage referral commissions for doctors</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1B4F8A] text-white rounded-lg text-sm font-semibold hover:bg-[#163d6a]"
        >
          <Plus className="w-4 h-4" />
          Create Commission
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard
          title="Pending Total"
          value={formatCurrency(summary?.pendingTotal ?? 0)}
          icon={Clock}
          iconColor="bg-amber-100 text-amber-600"
        />
        <KPICard
          title="Approved Total"
          value={formatCurrency(summary?.approvedTotal ?? 0)}
          icon={CheckCircle}
          iconColor="bg-blue-100 text-blue-600"
        />
        <KPICard
          title="Paid Total"
          value={formatCurrency(summary?.paidTotal ?? 0)}
          icon={DollarSign}
          iconColor="bg-green-100 text-green-600"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-700">All Commissions</h2>
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
        <CreateCommissionModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["commissions"] });
            qc.invalidateQueries({ queryKey: ["commission-summary"] });
          }}
        />
      )}
    </div>
  );
}
