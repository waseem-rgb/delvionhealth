"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import {
  Search,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Clock,
  Filter,
  Loader2,
  Shield,
} from "lucide-react";
import api from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/tables/DataTable";
import { formatDateTime, cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────
interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: string;
  module: string;
  action: string;
  target: string;
  changes: Record<string, unknown> | null;
}

interface AuditLogsResponse {
  data: AuditLogEntry[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

const MODULES = [
  { value: "", label: "All Modules" },
  { value: "PATIENT", label: "Patient" },
  { value: "ORDER", label: "Order" },
  { value: "SAMPLE", label: "Sample" },
  { value: "RESULT", label: "Result" },
  { value: "REPORT", label: "Report" },
  { value: "BILLING", label: "Billing" },
  { value: "USER", label: "User" },
  { value: "SETTINGS", label: "Settings" },
];

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "bg-red-100 text-red-700",
  ADMIN: "bg-purple-100 text-purple-700",
  LAB_MANAGER: "bg-blue-100 text-blue-700",
  PATHOLOGIST: "bg-teal-100 text-teal-700",
  LAB_TECHNICIAN: "bg-green-100 text-green-700",
  RECEPTIONIST: "bg-amber-100 text-amber-700",
  PHLEBOTOMIST: "bg-orange-100 text-orange-700",
  ACCOUNTANT: "bg-indigo-100 text-indigo-700",
};

const MODULE_COLORS: Record<string, string> = {
  PATIENT: "bg-blue-50 text-blue-700",
  ORDER: "bg-purple-50 text-purple-700",
  SAMPLE: "bg-teal-50 text-teal-700",
  RESULT: "bg-green-50 text-green-700",
  REPORT: "bg-amber-50 text-amber-700",
  BILLING: "bg-indigo-50 text-indigo-700",
  USER: "bg-rose-50 text-rose-700",
  SETTINGS: "bg-slate-100 text-slate-700",
};

// ─── JSON Viewer Component ───────────────────────────────────────
function JsonViewer({ data }: { data: Record<string, unknown> }) {
  function renderValue(val: unknown): string {
    if (val === null) return "null";
    if (val === undefined) return "undefined";
    if (typeof val === "string") return `"${val}"`;
    if (typeof val === "object") return JSON.stringify(val, null, 2);
    return String(val);
  }

  return (
    <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 text-xs font-mono overflow-x-auto max-h-80 overflow-y-auto">
      <code>
        {"{\n"}
        {Object.entries(data).map(([key, val], idx, arr) => {
          const valStr = renderValue(val);
          const isOld = key.startsWith("old") || key === "before";
          const isNew = key.startsWith("new") || key === "after";
          const color = isOld ? "text-red-400" : isNew ? "text-green-400" : "text-blue-300";

          return (
            <span key={key}>
              {"  "}
              <span className="text-purple-300">{`"${key}"`}</span>
              <span className="text-slate-400">{": "}</span>
              <span className={color}>{valStr}</span>
              {idx < arr.length - 1 && <span className="text-slate-400">{","}</span>}
              {"\n"}
            </span>
          );
        })}
        {"}"}
      </code>
    </pre>
  );
}

// ─── Expandable Changes Cell ─────────────────────────────────────
function ChangesCell({ changes }: { changes: Record<string, unknown> | null }) {
  const [expanded, setExpanded] = useState(false);

  if (!changes || Object.keys(changes).length === 0) {
    return <span className="text-xs text-slate-300">--</span>;
  }

  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
      >
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {expanded ? "Hide" : "View"} Changes ({Object.keys(changes).length} fields)
      </button>
      {expanded && (
        <div className="mt-2">
          <JsonViewer data={changes} />
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────
export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [module, setModule] = useState("");
  const [action, setAction] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Build query params
  const buildParams = useCallback(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: "50",
    });
    if (module) params.set("module", module);
    if (action) params.set("action", action);
    if (search) params.set("search", search);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    return params.toString();
  }, [page, module, action, search, dateFrom, dateTo]);

  // ─── Fetch audit logs ──────────────────────────────────────────
  const { data, isLoading } = useQuery<AuditLogsResponse>({
    queryKey: ["audit-logs", page, module, action, search, dateFrom, dateTo],
    queryFn: async () => {
      const res = await api.get(`/audit-logs?${buildParams()}`);
      return res.data.data as AuditLogsResponse;
    },
    refetchInterval: autoRefresh ? 10000 : false,
  });

  const logs = data?.data ?? [];
  const meta = data?.meta;

  // ─── Column definitions ────────────────────────────────────────
  const columns: ColumnDef<AuditLogEntry, unknown>[] = [
    {
      accessorKey: "timestamp",
      header: "Timestamp",
      cell: ({ row }) => (
        <span className="text-xs text-slate-500 whitespace-nowrap font-mono">
          {formatDateTime(row.original.timestamp)}
        </span>
      ),
    },
    {
      id: "actor",
      header: "Actor",
      cell: ({ row }) => (
        <div>
          <p className="text-sm font-medium text-slate-800">{row.original.actorName}</p>
          <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${ROLE_COLORS[row.original.actorRole] ?? "bg-slate-100 text-slate-600"}`}>
            {row.original.actorRole.replace(/_/g, " ")}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "module",
      header: "Module",
      cell: ({ row }) => (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${MODULE_COLORS[row.original.module] ?? "bg-slate-100 text-slate-600"}`}>
          {row.original.module}
        </span>
      ),
    },
    {
      accessorKey: "action",
      header: "Action",
      cell: ({ row }) => (
        <span className="text-sm text-slate-700">{row.original.action}</span>
      ),
    },
    {
      accessorKey: "target",
      header: "Target",
      cell: ({ row }) => (
        <span className="text-xs text-slate-500 font-mono">{row.original.target}</span>
      ),
    },
    {
      id: "changes",
      header: "Changes",
      cell: ({ row }) => <ChangesCell changes={row.original.changes} />,
      enableSorting: false,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs"
        subtitle="Track all system activity and changes"
        breadcrumbs={[{ label: "Settings", href: "/settings" }]}
        actions={
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={cn(
              "inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border",
              autoRefresh
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            )}
          >
            <RefreshCw className={cn("w-4 h-4", autoRefresh && "animate-spin")} />
            {autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
          </button>
        }
      />

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Filters</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Module */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">Module</label>
            <select
              value={module}
              onChange={(e) => { setModule(e.target.value); setPage(1); }}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {MODULES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Action */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">Action</label>
            <input
              value={action}
              onChange={(e) => { setAction(e.target.value); setPage(1); }}
              placeholder="e.g. CREATE, UPDATE"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Date range */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              max={dateTo || undefined}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              min={dateFrom || undefined}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Search */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search logs..."
                className="w-full pl-9 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Active filter indicator */}
        {(module || action || search || dateFrom || dateTo) && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-50">
            <span className="text-xs text-slate-400">Active filters:</span>
            {module && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700">
                Module: {module}
                <button onClick={() => setModule("")} className="hover:text-blue-900">&times;</button>
              </span>
            )}
            {action && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-50 text-purple-700">
                Action: {action}
                <button onClick={() => setAction("")} className="hover:text-purple-900">&times;</button>
              </span>
            )}
            {search && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-teal-50 text-teal-700">
                Search: {search}
                <button onClick={() => setSearch("")} className="hover:text-teal-900">&times;</button>
              </span>
            )}
            {(dateFrom || dateTo) && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-50 text-amber-700">
                Date: {dateFrom || "..."} to {dateTo || "..."}
                <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="hover:text-amber-900">&times;</button>
              </span>
            )}
            <button
              onClick={() => { setModule(""); setAction(""); setSearch(""); setDateFrom(""); setDateTo(""); setPage(1); }}
              className="text-xs text-red-500 hover:text-red-700 ml-auto font-medium"
            >
              Clear All
            </button>
          </div>
        )}
      </div>

      {/* Auto-refresh indicator */}
      {autoRefresh && (
        <div className="flex items-center gap-2 text-xs text-green-600">
          <Clock className="w-3.5 h-3.5" />
          Auto-refreshing every 10 seconds
        </div>
      )}

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={logs}
        isLoading={isLoading}
        page={page}
        total={meta?.total ?? 0}
        pageSize={50}
        onPageChange={setPage}
      />
    </div>
  );
}
