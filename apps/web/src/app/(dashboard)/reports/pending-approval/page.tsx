"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import {
  ClipboardCheck,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  X,
  ShieldAlert,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { KPICard } from "@/components/shared/KPICard";
import { DataTable } from "@/components/tables/DataTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { formatDateTime } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────
interface PendingReport {
  id: string;
  reportNumber: string;
  patientName: string;
  orderNumber: string;
  priority: "ROUTINE" | "URGENT" | "STAT";
  tests: string[];
  generatedAt: string;
  isCritical: boolean;
}

interface PendingApprovalResponse {
  data: PendingReport[];
  meta: { total: number; page: number; limit: number; totalPages: number };
  stats: {
    totalPending: number;
    criticalCount: number;
    approvedToday: number;
    rejectedToday: number;
  };
}

const PRIORITY_COLORS: Record<string, string> = {
  ROUTINE: "bg-slate-100 text-slate-600",
  URGENT: "bg-amber-100 text-amber-700",
  STAT: "bg-red-100 text-red-700",
};

const PRIORITY_ORDER: Record<string, number> = {
  STAT: 0,
  URGENT: 1,
  ROUTINE: 2,
};

// ─── Component ────────────────────────────────────────────────────
export default function PendingApprovalPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [approveTarget, setApproveTarget] = useState<PendingReport | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PendingReport | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [bulkApproveOpen, setBulkApproveOpen] = useState(false);

  // ─── Fetch pending reports ──────────────────────────────────────
  const { data, isLoading } = useQuery<PendingApprovalResponse>({
    queryKey: ["pending-approval", page],
    queryFn: async () => {
      const res = await api.get(`/report-approval/pending?page=${page}&limit=20`);
      return res.data.data as PendingApprovalResponse;
    },
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  const reports = useMemo(() => {
    const items = data?.data ?? [];
    return [...items].sort(
      (a, b) => (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2)
    );
  }, [data]);

  const meta = data?.meta;
  const stats = data?.stats ?? { totalPending: 0, criticalCount: 0, approvedToday: 0, rejectedToday: 0 };

  // ─── Approve single ────────────────────────────────────────────
  const approveMut = useMutation({
    mutationFn: (id: string) => api.post(`/report-approval/${id}/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-approval"] });
      toast.success("Report approved");
      setApproveTarget(null);
    },
    onError: () => toast.error("Failed to approve report"),
  });

  // ─── Reject single ─────────────────────────────────────────────
  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/report-approval/${id}/reject`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-approval"] });
      toast.success("Report rejected");
      setRejectTarget(null);
      setRejectionReason("");
    },
    onError: () => toast.error("Failed to reject report"),
  });

  // ─── Bulk approve ──────────────────────────────────────────────
  const bulkApproveMut = useMutation({
    mutationFn: (reportIds: string[]) =>
      api.post("/report-approval/bulk-approve", { reportIds }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-approval"] });
      toast.success(`${selectedIds.size} reports approved`);
      setSelectedIds(new Set());
      setBulkApproveOpen(false);
    },
    onError: () => toast.error("Failed to approve selected reports"),
  });

  // ─── Selection helpers ─────────────────────────────────────────
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedIds.size === reports.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(reports.map((r) => r.id)));
    }
  }

  // ─── Column definitions ────────────────────────────────────────
  const columns: ColumnDef<PendingReport, unknown>[] = [
    {
      id: "select",
      header: () => (
        <input
          type="checkbox"
          checked={reports.length > 0 && selectedIds.size === reports.length}
          onChange={toggleAll}
          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={selectedIds.has(row.original.id)}
          onChange={() => toggleSelect(row.original.id)}
          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
      ),
      enableSorting: false,
    },
    {
      accessorKey: "reportNumber",
      header: "Report #",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs font-semibold text-[#1B4F8A]">
            {row.original.reportNumber}
          </span>
          {row.original.isCritical && (
            <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
          )}
        </div>
      ),
    },
    {
      accessorKey: "patientName",
      header: "Patient Name",
      cell: ({ row }) => (
        <span className="text-sm font-medium text-slate-800">
          {row.original.patientName}
        </span>
      ),
    },
    {
      accessorKey: "orderNumber",
      header: "Order #",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-slate-600">
          {row.original.orderNumber}
        </span>
      ),
    },
    {
      accessorKey: "priority",
      header: "Priority",
      cell: ({ row }) => (
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
            PRIORITY_COLORS[row.original.priority] ?? "bg-slate-100 text-slate-600"
          }`}
        >
          {row.original.priority}
        </span>
      ),
    },
    {
      accessorKey: "tests",
      header: "Tests",
      cell: ({ row }) => {
        const tests = row.original.tests;
        const display = tests.length > 2 ? `${tests.slice(0, 2).join(", ")} +${tests.length - 2}` : tests.join(", ");
        return (
          <span className="text-xs text-slate-600" title={tests.join(", ")}>
            {display}
          </span>
        );
      },
    },
    {
      accessorKey: "generatedAt",
      header: "Generated At",
      cell: ({ row }) => (
        <span className="text-xs text-slate-500 whitespace-nowrap">
          {formatDateTime(row.original.generatedAt)}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setApproveTarget(row.original)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-medium hover:bg-green-100 transition-colors"
          >
            <CheckCircle className="w-3 h-3" /> Approve
          </button>
          <button
            onClick={() => setRejectTarget(row.original)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors"
          >
            <XCircle className="w-3 h-3" /> Reject
          </button>
        </div>
      ),
      enableSorting: false,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pending Approval"
        subtitle="Review and approve lab reports before delivery"
        breadcrumbs={[{ label: "Reports", href: "/reports" }]}
        actions={
          selectedIds.size > 0 ? (
            <button
              onClick={() => setBulkApproveOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
            >
              <CheckCircle className="w-4 h-4" /> Approve Selected ({selectedIds.size})
            </button>
          ) : undefined
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Pending"
          value={stats.totalPending}
          icon={ClipboardCheck}
          iconColor="bg-blue-100 text-blue-600"
          isLoading={isLoading}
        />
        <KPICard
          title="Critical Reports"
          value={stats.criticalCount}
          icon={AlertTriangle}
          iconColor="bg-red-100 text-red-600"
          isLoading={isLoading}
        />
        <KPICard
          title="Approved Today"
          value={stats.approvedToday}
          icon={CheckCircle}
          iconColor="bg-green-100 text-green-600"
          isLoading={isLoading}
        />
        <KPICard
          title="Rejected Today"
          value={stats.rejectedToday}
          icon={XCircle}
          iconColor="bg-amber-100 text-amber-600"
          isLoading={isLoading}
        />
      </div>

      {/* Auto-refresh indicator */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Clock className="w-3.5 h-3.5" />
        Auto-refreshes every 30 seconds
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={reports}
        isLoading={isLoading}
        page={page}
        total={meta?.total ?? 0}
        pageSize={20}
        onPageChange={setPage}
      />

      {/* ─── Approve Confirm Dialog ──────────────────────────── */}
      <ConfirmDialog
        open={!!approveTarget}
        onClose={() => setApproveTarget(null)}
        onConfirm={() => approveTarget && approveMut.mutate(approveTarget.id)}
        title="Approve Report"
        message={`Approve report ${approveTarget?.reportNumber ?? ""} for patient ${approveTarget?.patientName ?? ""}? This will mark the report as signed and ready for delivery.`}
        confirmText="Approve"
        variant="info"
        isLoading={approveMut.isPending}
      />

      {/* ─── Bulk Approve Confirm Dialog ─────────────────────── */}
      <ConfirmDialog
        open={bulkApproveOpen}
        onClose={() => setBulkApproveOpen(false)}
        onConfirm={() => bulkApproveMut.mutate(Array.from(selectedIds))}
        title="Bulk Approve Reports"
        message={`Are you sure you want to approve ${selectedIds.size} selected reports? This action cannot be undone.`}
        confirmText={`Approve ${selectedIds.size} Reports`}
        variant="info"
        isLoading={bulkApproveMut.isPending}
      />

      {/* ─── Reject Modal ────────────────────────────────────── */}
      {rejectTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Reject Report</h3>
              <button
                onClick={() => { setRejectTarget(null); setRejectionReason(""); }}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"
              >
                <X size={16} />
              </button>
            </div>

            <div className="bg-slate-50 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Report #</span>
                <span className="font-mono font-medium text-xs">{rejectTarget.reportNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Patient</span>
                <span className="font-medium">{rejectTarget.patientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Order #</span>
                <span className="font-mono text-xs">{rejectTarget.orderNumber}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                placeholder="Please provide a reason for rejection..."
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { setRejectTarget(null); setRejectionReason(""); }}
                className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  rejectMut.mutate({ id: rejectTarget.id, reason: rejectionReason })
                }
                disabled={!rejectionReason.trim() || rejectMut.isPending}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {rejectMut.isPending && <Loader2 size={13} className="animate-spin" />}
                <XCircle size={13} />
                Reject Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
