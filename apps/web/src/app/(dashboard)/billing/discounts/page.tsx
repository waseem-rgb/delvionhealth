"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Percent,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { DataTable } from "@/components/tables/DataTable";
import { KPICard } from "@/components/shared/KPICard";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { formatDate, formatDateTime, formatCurrency } from "@/lib/utils";
import api from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────

interface DiscountRequest {
  id: string;
  orderNumber: string;
  patient: { firstName: string; lastName: string; mrn: string };
  requestedBy: { firstName: string; lastName: string };
  originalAmount: number;
  discountPercent: number;
  discountAmount: number;
  netAmount: number;
  reason: string;
  status: string;
  createdAt: string;
}

interface DiscountStats {
  pending: number;
  approvedToday: number;
  rejectedToday: number;
  avgDiscountPercent: number;
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function DiscountsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  // Approve confirmation
  const [approveTarget, setApproveTarget] = useState<DiscountRequest | null>(null);
  // Reject modal
  const [rejectTarget, setRejectTarget] = useState<DiscountRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Success message
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ── Data fetching ──
  const { data: discounts, isLoading } = useQuery({
    queryKey: ["discounts-pending", page],
    queryFn: async () => {
      const res = await api.get<{
        data: {
          data: DiscountRequest[];
          meta: { total: number; page: number; limit: number; totalPages: number };
        };
      }>("/discounts/pending", { params: { page, limit: 20 } });
      return res.data.data;
    },
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["discounts-stats"],
    queryFn: async () => {
      const res = await api.get<{ data: DiscountStats }>("/discounts/pending");
      // Stats may come embedded or separately — derive from list if needed
      return res.data.data;
    },
    // We'll compute stats locally if needed
    enabled: false,
  });

  // Compute stats from the full list
  const pendingCount = discounts?.meta?.total ?? 0;
  const rows = discounts?.data ?? [];

  // ── Mutations ──
  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.put(`/discounts/${id}/approve`);
    },
    onSuccess: () => {
      setApproveTarget(null);
      setSuccessMessage("Discount approved successfully.");
      void queryClient.invalidateQueries({ queryKey: ["discounts-pending"] });
      void queryClient.invalidateQueries({ queryKey: ["discounts-stats"] });
      setTimeout(() => setSuccessMessage(null), 3000);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      await api.put(`/discounts/${id}/reject`, { reason });
    },
    onSuccess: () => {
      setRejectTarget(null);
      setRejectReason("");
      setSuccessMessage("Discount rejected.");
      void queryClient.invalidateQueries({ queryKey: ["discounts-pending"] });
      void queryClient.invalidateQueries({ queryKey: ["discounts-stats"] });
      setTimeout(() => setSuccessMessage(null), 3000);
    },
  });

  // ── Table columns ──
  const columns: ColumnDef<DiscountRequest>[] = [
    {
      accessorKey: "orderNumber",
      header: "Order #",
      cell: ({ row }) => (
        <span className="font-mono text-xs font-semibold text-[#1B4F8A]">
          {row.original.orderNumber}
        </span>
      ),
    },
    {
      id: "patient",
      header: "Patient",
      cell: ({ row }) => {
        const p = row.original.patient;
        return (
          <div>
            <p className="font-medium text-slate-900 text-sm">
              {p.firstName} {p.lastName}
            </p>
            <p className="text-xs text-slate-400 font-mono">{p.mrn}</p>
          </div>
        );
      },
    },
    {
      id: "requestedBy",
      header: "Requested By",
      cell: ({ row }) => {
        const r = row.original.requestedBy;
        return (
          <span className="text-sm text-slate-700">
            {r.firstName} {r.lastName}
          </span>
        );
      },
    },
    {
      accessorKey: "originalAmount",
      header: "Original Amt",
      cell: ({ row }) => (
        <span className="text-sm font-medium text-slate-800">
          {formatCurrency(row.original.originalAmount)}
        </span>
      ),
    },
    {
      accessorKey: "discountPercent",
      header: "Discount %",
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-xs font-semibold ring-1 ring-amber-200">
          {row.original.discountPercent.toFixed(1)}%
        </span>
      ),
    },
    {
      accessorKey: "discountAmount",
      header: "Discount Amt",
      cell: ({ row }) => (
        <span className="text-sm text-red-600 font-medium">
          -{formatCurrency(row.original.discountAmount)}
        </span>
      ),
    },
    {
      accessorKey: "netAmount",
      header: "Net Amount",
      cell: ({ row }) => (
        <span className="text-sm font-semibold text-slate-900">
          {formatCurrency(row.original.netAmount)}
        </span>
      ),
    },
    {
      accessorKey: "reason",
      header: "Reason",
      cell: ({ row }) => (
        <span className="text-xs text-slate-600 max-w-[160px] truncate block" title={row.original.reason}>
          {row.original.reason}
        </span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Requested At",
      cell: ({ row }) => (
        <span className="text-xs text-slate-500">{formatDateTime(row.original.createdAt)}</span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setApproveTarget(row.original);
            }}
            className="p-1.5 rounded hover:bg-green-100 text-green-600 hover:text-green-700 transition"
            title="Approve"
          >
            <Check size={16} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setRejectTarget(row.original);
              setRejectReason("");
            }}
            className="p-1.5 rounded hover:bg-red-100 text-red-500 hover:text-red-600 transition"
            title="Reject"
          >
            <X size={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Discount Approvals"
        subtitle="Review and approve pending discount requests"
        breadcrumbs={[{ label: "Billing", href: "/billing" }]}
      />

      {/* Success toast */}
      {successMessage && (
        <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 text-green-800 rounded-lg">
          <CheckCircle2 size={16} className="text-green-600 shrink-0" />
          <span className="text-sm font-medium">{successMessage}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Pending Approvals"
          value={pendingCount}
          icon={Clock}
          iconColor="bg-amber-100 text-amber-600"
          isLoading={isLoading}
        />
        <KPICard
          title="Approved Today"
          value={stats?.approvedToday ?? "—"}
          icon={CheckCircle2}
          iconColor="bg-green-100 text-green-600"
          isLoading={statsLoading}
        />
        <KPICard
          title="Rejected Today"
          value={stats?.rejectedToday ?? "—"}
          icon={XCircle}
          iconColor="bg-red-100 text-red-600"
          isLoading={statsLoading}
        />
        <KPICard
          title="Avg Discount %"
          value={
            rows.length > 0
              ? `${(rows.reduce((sum, r) => sum + r.discountPercent, 0) / rows.length).toFixed(1)}%`
              : "—"
          }
          icon={Percent}
          iconColor="bg-blue-100 text-blue-600"
          isLoading={isLoading}
        />
      </div>

      {/* Table or empty state */}
      {!isLoading && rows.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="No Pending Approvals"
          description="All discount requests have been processed. New requests will appear here."
        />
      ) : (
        <div className="bg-white rounded-xl card-shadow overflow-hidden">
          <DataTable
            columns={columns}
            data={rows}
            total={discounts?.meta?.total}
            page={page}
            pageSize={20}
            onPageChange={setPage}
            isLoading={isLoading}
          />
        </div>
      )}

      {/* Approve confirmation dialog */}
      <ConfirmDialog
        open={approveTarget !== null}
        onClose={() => setApproveTarget(null)}
        onConfirm={() => {
          if (approveTarget) approveMutation.mutate(approveTarget.id);
        }}
        title="Approve Discount"
        message={
          approveTarget
            ? `Approve ${approveTarget.discountPercent.toFixed(1)}% discount (${formatCurrency(approveTarget.discountAmount)}) on order ${approveTarget.orderNumber}? Net amount will be ${formatCurrency(approveTarget.netAmount)}.`
            : ""
        }
        confirmText="Approve"
        variant="info"
        isLoading={approveMutation.isPending}
      />

      {/* Reject modal with reason */}
      {rejectTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <XCircle size={20} className="text-red-600" />
                </div>
                <h3 className="font-semibold text-slate-900">Reject Discount</h3>
              </div>
              <button
                onClick={() => {
                  setRejectTarget(null);
                  setRejectReason("");
                }}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="bg-slate-50 rounded-lg p-3 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Order</span>
                  <span className="font-mono font-semibold text-slate-700">
                    {rejectTarget.orderNumber}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Patient</span>
                  <span className="text-slate-700">
                    {rejectTarget.patient.firstName} {rejectTarget.patient.lastName}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Discount</span>
                  <span className="font-semibold text-red-600">
                    {rejectTarget.discountPercent.toFixed(1)}% ({formatCurrency(rejectTarget.discountAmount)})
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  placeholder="Provide a reason for rejecting this discount request..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300 transition"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-100">
              <button
                onClick={() => {
                  setRejectTarget(null);
                  setRejectReason("");
                }}
                disabled={rejectMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (rejectTarget && rejectReason.trim()) {
                    rejectMutation.mutate({ id: rejectTarget.id, reason: rejectReason.trim() });
                  }
                }}
                disabled={!rejectReason.trim() || rejectMutation.isPending}
                className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition flex items-center gap-2 disabled:opacity-50"
              >
                {rejectMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                Reject Discount
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
