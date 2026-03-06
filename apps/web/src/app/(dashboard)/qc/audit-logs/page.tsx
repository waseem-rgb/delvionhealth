"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ScrollText,
  Search,
  Filter,
  Calendar,
  Shield,
  FileText,
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Wrench,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import api from "@/lib/api";

// -- Types --------------------------------------------------------------------

interface AuditEntry {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  performedById: string | null;
  performedAt: string;
  createdAt: string;
}

// -- Action config ------------------------------------------------------------

const ACTION_STYLES: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
  QC_RUN_RECORDED: {
    cls: "bg-blue-50 text-blue-700 border-blue-200",
    icon: <Shield className="w-3 h-3" />,
    label: "QC Run Recorded",
  },
  CAPA_CREATED: {
    cls: "bg-amber-50 text-amber-700 border-amber-200",
    icon: <ClipboardCheck className="w-3 h-3" />,
    label: "CAPA Created",
  },
  CAPA_CLOSED: {
    cls: "bg-green-50 text-green-700 border-green-200",
    icon: <CheckCircle2 className="w-3 h-3" />,
    label: "CAPA Closed",
  },
  NC_CREATED: {
    cls: "bg-red-50 text-red-700 border-red-200",
    icon: <AlertTriangle className="w-3 h-3" />,
    label: "NC Created",
  },
  NC_UPDATED: {
    cls: "bg-orange-50 text-orange-700 border-orange-200",
    icon: <AlertTriangle className="w-3 h-3" />,
    label: "NC Updated",
  },
  DOCUMENT_APPROVED: {
    cls: "bg-purple-50 text-purple-700 border-purple-200",
    icon: <FileText className="w-3 h-3" />,
    label: "Document Approved",
  },
  MAINTENANCE_LOGGED: {
    cls: "bg-teal-50 text-teal-700 border-teal-200",
    icon: <Wrench className="w-3 h-3" />,
    label: "Maintenance Logged",
  },
};

function ActionBadge({ action }: { action: string }) {
  const style = ACTION_STYLES[action] ?? {
    cls: "bg-slate-50 text-slate-600 border-slate-200",
    icon: <ScrollText className="w-3 h-3" />,
    label: action.replace(/_/g, " "),
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${style.cls}`}
    >
      {style.icon}
      {style.label}
    </span>
  );
}

function EntityTypeBadge({ type }: { type: string | null }) {
  if (!type) return <span className="text-slate-400 text-xs">--</span>;
  const colors: Record<string, string> = {
    QCEntry: "bg-blue-50 text-blue-600",
    CAPA: "bg-amber-50 text-amber-600",
    NonConformance: "bg-red-50 text-red-600",
    QualityDocument: "bg-purple-50 text-purple-600",
    Instrument: "bg-teal-50 text-teal-600",
  };
  const cls = colors[type] ?? "bg-slate-50 text-slate-600";
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {type}
    </span>
  );
}

// -- Filter configs -----------------------------------------------------------

const ACTION_FILTERS = [
  { label: "All", value: "ALL" },
  { label: "QC Run", value: "QC_RUN_RECORDED" },
  { label: "CAPA Created", value: "CAPA_CREATED" },
  { label: "CAPA Closed", value: "CAPA_CLOSED" },
  { label: "NC Created", value: "NC_CREATED" },
  { label: "NC Updated", value: "NC_UPDATED" },
  { label: "Doc Approved", value: "DOCUMENT_APPROVED" },
  { label: "Maintenance", value: "MAINTENANCE_LOGGED" },
];

const ENTITY_FILTERS = [
  { label: "All", value: "ALL" },
  { label: "QC Entry", value: "QCEntry" },
  { label: "CAPA", value: "CAPA" },
  { label: "Non-Conformance", value: "NonConformance" },
  { label: "Document", value: "QualityDocument" },
  { label: "Instrument", value: "Instrument" },
];

// -- Main Page ----------------------------------------------------------------

export default function QCAuditLogsPage() {
  const [actionFilter, setActionFilter] = useState("ALL");
  const [entityFilter, setEntityFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const limit = 30;

  const { data, isLoading } = useQuery({
    queryKey: ["qc-audit-entries", actionFilter, entityFilter, dateFrom, dateTo, page],
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        if (actionFilter !== "ALL") params.set("action", actionFilter);
        if (entityFilter !== "ALL") params.set("entityType", entityFilter);
        if (dateFrom) params.set("from", dateFrom);
        if (dateTo) params.set("to", dateTo);
        params.set("page", String(page));
        params.set("limit", String(limit));
        const res = await api.get(`/qc/audit-entries?${params.toString()}`);
        const payload = res.data?.data ?? res.data;
        return payload as { data: AuditEntry[]; total: number; page: number; limit: number };
      } catch {
        return { data: [] as AuditEntry[], total: 0, page: 1, limit: 30 };
      }
    },
  });

  const entries = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  const filtered = entries.filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (e.description ?? "").toLowerCase().includes(q) ||
      e.action.toLowerCase().includes(q) ||
      (e.entityType ?? "").toLowerCase().includes(q) ||
      e.id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Quality Audit Logs</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Immutable trail of all quality management activities
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Action filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            {ACTION_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        {/* Entity type filter */}
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-slate-400" />
          <select
            value={entityFilter}
            onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            {ENTITY_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        {/* Date range */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
          <span className="text-slate-400 text-xs">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>

        {/* Search */}
        <div className="relative ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 w-60"
          />
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <ScrollText className="w-4 h-4" />
        <span>
          Showing {filtered.length} of {total} entries
          {totalPages > 1 && ` — Page ${page} of ${totalPages}`}
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-8 space-y-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-16 text-center">
              <ScrollText className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">No audit entries found</p>
              <p className="text-slate-300 text-xs mt-1">
                Quality actions will appear here automatically
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 font-medium text-slate-500">
                    Timestamp
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">
                    Action
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">
                    Entity Type
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">
                    Entity ID
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">
                    Description
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">
                    Performed By
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {formatDate(entry.performedAt)}
                      <br />
                      <span className="text-slate-400">
                        {new Date(entry.performedAt).toLocaleTimeString()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ActionBadge action={entry.action} />
                    </td>
                    <td className="px-4 py-3">
                      <EntityTypeBadge type={entry.entityType} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-slate-400">
                        {entry.entityId ? `${entry.entityId.slice(0, 8)}...` : "--"}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <span
                        className="text-slate-700 truncate block text-xs"
                        title={entry.description ?? ""}
                      >
                        {entry.description ?? "--"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-slate-400">
                        {entry.performedById ? `${entry.performedById.slice(0, 8)}...` : "--"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs text-slate-500">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
