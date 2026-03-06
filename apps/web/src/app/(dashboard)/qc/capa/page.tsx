"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  ShieldAlert,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Search,
  X,
  ClipboardList,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import api from "@/lib/api";

// -- Types --------------------------------------------------------------------

interface CAPA {
  id: string;
  description: string;
  rootCause: string | null;
  correctiveAction: string | null;
  preventiveAction: string | null;
  status: string;
  dueDate: string | null;
  assignedToId: string | null;
  assignedTo?: { firstName: string; lastName: string } | null;
  createdAt: string;
}

// -- Status helpers -----------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-amber-50 text-amber-700 border-amber-200",
  IN_PROGRESS: "bg-blue-50 text-blue-700 border-blue-200",
  CLOSED: "bg-green-50 text-green-700 border-green-200",
  OVERDUE: "bg-red-50 text-red-700 border-red-200",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  OPEN: <AlertTriangle className="w-3 h-3" />,
  IN_PROGRESS: <Clock className="w-3 h-3" />,
  CLOSED: <CheckCircle2 className="w-3 h-3" />,
  OVERDUE: <ShieldAlert className="w-3 h-3" />,
};

function CAPAStatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? "bg-slate-50 text-slate-600 border-slate-200";
  const icon = STATUS_ICONS[status] ?? null;
  const label = status.replace(/_/g, " ");
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cls}`}
    >
      {icon}
      {label}
    </span>
  );
}

// -- Status Tabs --------------------------------------------------------------

const STATUS_TABS = [
  { label: "All", value: "ALL" },
  { label: "Open", value: "OPEN" },
  { label: "In Progress", value: "IN_PROGRESS" },
  { label: "Closed", value: "CLOSED" },
];

// -- New CAPA Modal -----------------------------------------------------------

function NewCAPAModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [description, setDescription] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [correctiveAction, setCorrectiveAction] = useState("");
  const [preventiveAction, setPreventiveAction] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      api.post("/qc/capas", {
        description: description.trim(),
        rootCause: rootCause.trim() || undefined,
        correctiveAction: correctiveAction.trim() || undefined,
        preventiveAction: preventiveAction.trim() || undefined,
        dueDate: dueDate || undefined,
        assignedToId: assignedToId.trim() || undefined,
      }),
    onSuccess: () => {
      onSuccess();
      onClose();
    },
    onError: (e: unknown) => {
      setError(
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to create CAPA"
      );
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) {
      setError("Description is required");
      return;
    }
    setError("");
    mutation.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">New CAPA</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-100 text-slate-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Description *
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue or non-conformance..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Root Cause
            </label>
            <textarea
              rows={2}
              value={rootCause}
              onChange={(e) => setRootCause(e.target.value)}
              placeholder="Identified root cause..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Corrective Action
            </label>
            <textarea
              rows={2}
              value={correctiveAction}
              onChange={(e) => setCorrectiveAction(e.target.value)}
              placeholder="Steps to correct the issue..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Preventive Action
            </label>
            <textarea
              rows={2}
              value={preventiveAction}
              onChange={(e) => setPreventiveAction(e.target.value)}
              placeholder="Steps to prevent recurrence..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Assigned To (User ID)
              </label>
              <input
                type="text"
                value={assignedToId}
                onChange={(e) => setAssignedToId(e.target.value)}
                placeholder="User ID"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
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
              className="flex-1 px-4 py-2 bg-blue-600 rounded-lg text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {mutation.isPending ? "Creating..." : "Create CAPA"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -- Main Page ----------------------------------------------------------------

export default function CAPAPage() {
  const queryClient = useQueryClient();
  const [statusTab, setStatusTab] = useState("ALL");
  const [search, setSearch] = useState("");
  const [showNewModal, setShowNewModal] = useState(false);

  const { data: capas, isLoading } = useQuery({
    queryKey: ["qc-capas", statusTab],
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        if (statusTab !== "ALL") params.set("status", statusTab);
        const res = await api.get(`/qc/capas?${params.toString()}`);
        const payload = res.data?.data ?? res.data;
        return (Array.isArray(payload) ? payload : payload?.data ?? []) as CAPA[];
      } catch {
        return [] as CAPA[];
      }
    },
  });

  const items = (capas ?? []).filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.description.toLowerCase().includes(q) ||
      (c.rootCause ?? "").toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q)
    );
  });

  // Determine if a CAPA is overdue
  function getDisplayStatus(capa: CAPA): string {
    if (capa.status === "CLOSED") return "CLOSED";
    if (
      capa.dueDate &&
      capa.status !== "CLOSED" &&
      new Date(capa.dueDate) < new Date()
    ) {
      return "OVERDUE";
    }
    return capa.status;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            CAPA Management
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Corrective and Preventive Actions tracking
          </p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> New CAPA
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          {
            label: "Total CAPAs",
            value: capas?.length ?? 0,
            icon: ClipboardList,
            color: "bg-slate-50 text-slate-600",
          },
          {
            label: "Open",
            value: capas?.filter((c) => c.status === "OPEN").length ?? 0,
            icon: AlertTriangle,
            color: "bg-amber-50 text-amber-600",
          },
          {
            label: "In Progress",
            value:
              capas?.filter((c) => c.status === "IN_PROGRESS").length ?? 0,
            icon: Clock,
            color: "bg-blue-50 text-blue-600",
          },
          {
            label: "Overdue",
            value:
              capas?.filter(
                (c) =>
                  c.status !== "CLOSED" &&
                  c.dueDate &&
                  new Date(c.dueDate) < new Date()
              ).length ?? 0,
            icon: ShieldAlert,
            color: "bg-red-50 text-red-600",
          },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="bg-white rounded-xl border border-slate-100 shadow-sm p-5"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${kpi.color}`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">
                    {kpi.value}
                  </p>
                  <p className="text-xs text-slate-500">{kpi.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Status Tabs + Search */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-2">
          <div className="flex">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusTab(tab.value)}
                className={`px-5 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  statusTab === tab.value
                    ? "border-blue-600 text-blue-600 bg-blue-50/30"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="relative mr-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="search"
              placeholder="Search CAPAs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 w-60"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-8 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="h-14 bg-slate-100 rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="p-16 text-center">
              <ClipboardList className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">No CAPAs found</p>
              <p className="text-slate-300 text-xs mt-1">
                Create a new CAPA to get started
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 font-medium text-slate-500">
                    ID
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">
                    Description
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">
                    Root Cause
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">
                    Due Date
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">
                    Assigned To
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((capa) => {
                  const displayStatus = getDisplayStatus(capa);
                  const assigneeName = capa.assignedTo
                    ? `${capa.assignedTo.firstName} ${capa.assignedTo.lastName}`
                    : "--";
                  return (
                    <tr
                      key={capa.id}
                      className="border-b border-slate-50 last:border-0 hover:bg-slate-50"
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-slate-500">
                          {capa.id.slice(0, 8)}...
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <span
                          className="text-slate-800 font-medium truncate block"
                          title={capa.description}
                        >
                          {capa.description}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <span
                          className="text-slate-600 truncate block text-xs"
                          title={capa.rootCause ?? ""}
                        >
                          {capa.rootCause ?? "--"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <CAPAStatusBadge status={displayStatus} />
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {capa.dueDate ? formatDate(capa.dueDate) : "--"}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-sm">
                        {assigneeName}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {formatDate(capa.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal */}
      {showNewModal && (
        <NewCAPAModal
          onClose={() => setShowNewModal(false)}
          onSuccess={() =>
            queryClient.invalidateQueries({ queryKey: ["qc-capas"] })
          }
        />
      )}
    </div>
  );
}
