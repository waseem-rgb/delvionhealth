"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  CalendarDays,
} from "lucide-react";
import { DataTable } from "@/components/tables/DataTable";
import { formatDate } from "@/lib/utils";
import api from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────

interface LeaveType {
  id: string;
  name: string;
  allowedDays: number;
}

interface LeaveRequest {
  id: string;
  userId: string;
  fromDate: string;
  toDate: string;
  days: number;
  reason: string | null;
  status: string;
  leaveType: { name: string };
}

// ── Status Badge ───────────────────────────────────────────────────────────

function LeaveStatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; icon: React.ReactNode }> = {
    PENDING: {
      cls: "bg-yellow-50 border-yellow-200 text-yellow-700",
      icon: <Clock className="w-3 h-3" />,
    },
    APPROVED: {
      cls: "bg-green-50 border-green-200 text-green-700",
      icon: <CheckCircle2 className="w-3 h-3" />,
    },
    REJECTED: {
      cls: "bg-red-50 border-red-200 text-red-700",
      icon: <XCircle className="w-3 h-3" />,
    },
    CANCELLED: {
      cls: "bg-slate-50 border-slate-200 text-slate-500",
      icon: <XCircle className="w-3 h-3" />,
    },
  };
  const s = map[status] ?? map["PENDING"];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${s.cls}`}>
      {s.icon}
      {status}
    </span>
  );
}

// ── Create Leave Type Modal ────────────────────────────────────────────────

function CreateLeaveTypeModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState("");
  const [allowedDays, setAllowedDays] = useState("12");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      api.post("/hr/leave-types", {
        name: name.trim(),
        allowedDays: parseInt(allowedDays, 10),
      }),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (e: unknown) => {
      setError(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to create leave type"
      );
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Leave type name is required"); return; }
    const days = parseInt(allowedDays, 10);
    if (isNaN(days) || days < 1) { setError("Allowed days must be at least 1"); return; }
    setError("");
    mutation.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Create Leave Type</h2>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Leave Type Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Casual Leave, Sick Leave"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Allowed Days per Year</label>
            <input
              type="number"
              min="1"
              max="365"
              value={allowedDays}
              onChange={(e) => setAllowedDays(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50"
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

// ── Request Leave Modal ────────────────────────────────────────────────────

function RequestLeaveModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const { data: leaveTypes } = useQuery({
    queryKey: ["hr-leave-types"],
    queryFn: async () => {
      const res = await api.get<{ data: LeaveType[] }>("/hr/leave-types");
      return res.data.data;
    },
  });

  function calcDays(): number {
    if (!fromDate || !toDate) return 0;
    const from = new Date(fromDate);
    const to = new Date(toDate);
    const diff = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(0, diff);
  }

  const days = calcDays();

  const mutation = useMutation({
    mutationFn: () =>
      api.post("/hr/leave-requests", {
        leaveTypeId,
        fromDate,
        toDate,
        days,
        reason: reason.trim() || undefined,
      }),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (e: unknown) => {
      setError(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to submit request"
      );
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!leaveTypeId) { setError("Please select a leave type"); return; }
    if (!fromDate || !toDate) { setError("Please select both from and to dates"); return; }
    if (new Date(toDate) < new Date(fromDate)) { setError("To date must be after from date"); return; }
    setError("");
    mutation.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Request Leave</h2>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Leave Type</label>
            <select
              value={leaveTypeId}
              onChange={(e) => setLeaveTypeId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            >
              <option value="">Select leave type...</option>
              {(leaveTypes ?? []).map((lt) => (
                <option key={lt.id} value={lt.id}>
                  {lt.name} ({lt.allowedDays} days/yr)
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
              />
            </div>
          </div>
          {days > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-700">
              Duration: <span className="font-bold">{days} day{days !== 1 ? "s" : ""}</span>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Reason (optional)</label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Briefly describe the reason..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 px-4 py-2 bg-[#1B4F8A] rounded-lg text-sm font-semibold text-white hover:bg-[#163d6a] disabled:opacity-50"
            >
              {mutation.isPending ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Status Tabs ────────────────────────────────────────────────────────────

const STATUS_TABS = [
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
];

// ── Main Page ──────────────────────────────────────────────────────────────

export default function LeaveManagementPage() {
  const qc = useQueryClient();
  const [statusTab, setStatusTab] = useState("PENDING");
  const [page, setPage] = useState(1);
  const [showCreateType, setShowCreateType] = useState(false);
  const [showRequest, setShowRequest] = useState(false);

  const params = new URLSearchParams({
    status: statusTab,
    page: String(page),
    limit: "20",
  }).toString();

  const { data, isLoading } = useQuery({
    queryKey: ["hr-leave-requests", statusTab, page],
    queryFn: async () => {
      const res = await api.get<{ data: { data: LeaveRequest[]; meta: { total: number } } }>(
        `/hr/leave-requests?${params}`
      );
      return res.data.data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/hr/leave-requests/${id}/approve`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr-leave-requests"] }),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.post(`/hr/leave-requests/${id}/reject`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr-leave-requests"] }),
  });

  const columns: ColumnDef<LeaveRequest>[] = [
    {
      header: "Employee",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-slate-600 font-medium">
          {row.original.userId.slice(0, 8)}...
        </span>
      ),
    },
    {
      header: "Leave Type",
      cell: ({ row }) => (
        <span className="text-sm font-semibold text-slate-800">{row.original.leaveType.name}</span>
      ),
    },
    {
      header: "From",
      cell: ({ row }) => <span className="text-sm text-slate-700">{formatDate(row.original.fromDate)}</span>,
    },
    {
      header: "To",
      cell: ({ row }) => <span className="text-sm text-slate-700">{formatDate(row.original.toDate)}</span>,
    },
    {
      header: "Days",
      cell: ({ row }) => (
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
          {row.original.days}
        </span>
      ),
    },
    {
      header: "Reason",
      cell: ({ row }) => (
        <span className="text-sm text-slate-600 max-w-xs truncate block" title={row.original.reason ?? ""}>
          {row.original.reason ?? "—"}
        </span>
      ),
    },
    {
      header: "Status",
      cell: ({ row }) => <LeaveStatusBadge status={row.original.status} />,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        if (row.original.status !== "PENDING") return null;
        return (
          <div className="flex gap-1.5">
            <button
              onClick={() => approveMutation.mutate(row.original.id)}
              disabled={approveMutation.isPending}
              className="flex items-center gap-1 px-2 py-1 text-xs font-semibold bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100 disabled:opacity-50"
            >
              <CheckCircle2 className="w-3 h-3" />
              Approve
            </button>
            <button
              onClick={() => rejectMutation.mutate(row.original.id)}
              disabled={rejectMutation.isPending}
              className="flex items-center gap-1 px-2 py-1 text-xs font-semibold bg-red-50 text-red-700 border border-red-200 rounded hover:bg-red-100 disabled:opacity-50"
            >
              <XCircle className="w-3 h-3" />
              Reject
            </button>
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
          <h1 className="text-2xl font-bold text-slate-900">Leave Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Employee leave requests, approvals, and leave type configuration
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreateType(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Plus className="w-4 h-4" />
            Leave Type
          </button>
          <button
            onClick={() => setShowRequest(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#1B4F8A] text-white rounded-lg text-sm font-semibold hover:bg-[#163d6a]"
          >
            <CalendarDays className="w-4 h-4" />
            Request Leave
          </button>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-200">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => { setStatusTab(tab.value); setPage(1); }}
              className={`px-5 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                statusTab === tab.value
                  ? "border-[#1B4F8A] text-[#1B4F8A] bg-blue-50/30"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          <DataTable
            columns={columns}
            data={Array.isArray(data) ? data : (data?.data ?? [])}
            isLoading={isLoading}
            page={page}
            total={data?.meta?.total}
            pageSize={20}
            onPageChange={(p) => setPage(p)}
          />
        </div>
      </div>

      {/* Modals */}
      {showCreateType && (
        <CreateLeaveTypeModal
          onClose={() => setShowCreateType(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ["hr-leave-types"] })}
        />
      )}
      {showRequest && (
        <RequestLeaveModal
          onClose={() => setShowRequest(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ["hr-leave-requests"] })}
        />
      )}
    </div>
  );
}
