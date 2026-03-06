"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollText, Search, Download } from "lucide-react";
import { formatDate } from "@/lib/utils";
import api from "@/lib/api";

interface AuditEntry {
  id: string;
  action: string;
  entityType: string | null;
  entity: string | null;
  entityId: string | null;
  description: string | null;
  performedById: string | null;
  actorId: string | null;
  actorName: string | null;
  details: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  performedAt: string;
  createdAt: string;
}

const ACTION_STYLES: Record<string, string> = {
  QC_RUN_RECORDED: "bg-blue-50 text-blue-700 border-blue-200",
  QC_RUN_FLAGGED: "bg-amber-50 text-amber-700 border-amber-200",
  CAPA_CREATED: "bg-blue-50 text-blue-700 border-blue-200",
  CAPA_UPDATED: "bg-purple-50 text-purple-700 border-purple-200",
  CAPA_OVERDUE: "bg-red-50 text-red-700 border-red-200",
  DOCUMENT_CREATED: "bg-teal-50 text-teal-700 border-teal-200",
  DOCUMENT_APPROVED: "bg-green-50 text-green-700 border-green-200",
  DOCUMENT_UPDATED: "bg-slate-50 text-slate-600 border-slate-200",
  EQAS_ROUND_CREATED: "bg-violet-50 text-violet-700 border-violet-200",
  EQAS_RESULTS_SUBMITTED: "bg-indigo-50 text-indigo-700 border-indigo-200",
};

const ENTITY_OPTIONS = [
  { label: "All Entities", value: "" },
  { label: "QC Runs", value: "QCRun" },
  { label: "CAPAs", value: "QualityCapa" },
  { label: "Documents", value: "QualityDocument" },
  { label: "EQAS Rounds", value: "EQASRound" },
];

export default function QualityAuditLogsPage() {
  const [entityFilter, setEntityFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 50;

  const { data, isLoading } = useQuery({
    queryKey: ["quality-audit-log", entityFilter, dateFrom, dateTo, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (entityFilter) params.set("entity", entityFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      params.set("page", String(page));
      params.set("limit", String(limit));
      const res = await api.get(`/quality/audit-log?${params.toString()}`);
      return (res.data?.data ?? res.data) as { data: AuditEntry[]; total: number };
    },
  });

  const entries = (data?.data ?? []).filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.action.toLowerCase().includes(q) ||
      (e.entityType ?? "").toLowerCase().includes(q) ||
      (e.actorName ?? "").toLowerCase().includes(q) ||
      (e.description ?? "").toLowerCase().includes(q)
    );
  });

  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  const handleExport = () => {
    const rows = entries.map((e) => [
      e.performedAt,
      e.action,
      e.entityType ?? e.entity ?? "",
      e.entityId ?? "",
      e.actorName ?? e.actorId ?? "",
      JSON.stringify(e.details ?? e.metadata ?? {}),
    ]);
    const csv = [
      ["Timestamp", "Action", "Entity", "Entity ID", "Actor", "Details"].join(","),
      ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quality-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quality Audit Log</h1>
          <p className="text-slate-500 text-sm mt-0.5">Immutable record of all quality actions</p>
        </div>
        <button onClick={handleExport} className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={entityFilter} onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
          {ENTITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          <span className="text-slate-400 text-xs">to</span>
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
        </div>
        <div className="relative ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="search" placeholder="Search log..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 w-60" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-3">{[...Array(8)].map((_, i) => <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />)}</div>
        ) : entries.length === 0 ? (
          <div className="p-16 text-center">
            <ScrollText className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No audit entries found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-4 py-2 font-medium text-slate-500 w-40">Timestamp</th>
                <th className="text-left px-4 py-2 font-medium text-slate-500 w-48">Action</th>
                <th className="text-left px-4 py-2 font-medium text-slate-500 w-32">Entity</th>
                <th className="text-left px-4 py-2 font-medium text-slate-500 w-32">Actor</th>
                <th className="text-left px-4 py-2 font-medium text-slate-500">Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-2 text-xs text-slate-500 font-mono">
                    {new Date(entry.performedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${ACTION_STYLES[entry.action] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}>
                      {entry.action}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-600">{entry.entity ?? entry.entityType ?? "—"}</td>
                  <td className="px-4 py-2 text-xs text-slate-700">{entry.actorName ?? entry.actorId ?? entry.performedById ?? "System"}</td>
                  <td className="px-4 py-2 text-xs text-slate-500 max-w-[300px] truncate">
                    {entry.description ?? (entry.details ? JSON.stringify(entry.details).slice(0, 100) : "—")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400">Showing page {page} of {totalPages} ({total} entries)</p>
          <div className="flex gap-1">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}
              className="px-3 py-1 border border-slate-200 rounded text-xs disabled:opacity-40">Prev</button>
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages}
              className="px-3 py-1 border border-slate-200 rounded text-xs disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
