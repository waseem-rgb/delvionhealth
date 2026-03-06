"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Activity,
  Cpu,
  Plus,
  RefreshCw,
  CheckCircle,
  Wrench,
  XCircle,
  AlertTriangle,
  Thermometer,
  ArrowUpDown,
  ArrowDown,
  ArrowUp,
  Link2,
  Link2Off,
  Clock,
} from "lucide-react";
import * as RadixTabs from "@radix-ui/react-tabs";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { DataTable } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import api from "@/lib/api";

// ── Types ────────────────────────────────────────────────────────────────────

interface Instrument {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  status: string;
  lastCalibration: string | null;
  nextCalibration: string | null;
  branch: { name: string };
  _count?: { connections: number };
}

interface Connection {
  id: string;
  instrumentId: string;
  protocol: string;
  host: string;
  port: number;
  status: string;
  apiKey: string | null;
  instrument?: { name: string };
}

interface InstrumentMessage {
  id: string;
  connectionId: string;
  direction: string;
  status: string;
  protocol: string;
  resultCount: number;
  rawPayload: string | null;
  receivedAt: string;
  connection?: { instrument?: { name: string } };
}

interface MessageStats {
  RAW: number;
  PARSED: number;
  POSTED: number;
  FAILED: number;
}

interface TempLogger {
  id: string;
  name: string;
  location: string;
  alertMin: number;
  alertMax: number;
  unit: string;
  latestReading?: { temperature: number; recordedAt: string } | null;
}

interface TempReading {
  id: string;
  temperature: number;
  recordedAt: string;
  isAlert: boolean;
}

// ── Status config ─────────────────────────────────────────────────────────────

const INSTRUMENT_STATUS: Record<
  string,
  { label: string; color: string; icon: React.ElementType }
> = {
  ACTIVE:      { label: "Active",       color: "text-green-700 bg-green-100",  icon: CheckCircle },
  MAINTENANCE: { label: "Maintenance",  color: "text-amber-700 bg-amber-100",  icon: Wrench },
  INACTIVE:    { label: "Inactive",     color: "text-red-600 bg-red-100",      icon: XCircle },
  CALIBRATION: { label: "Calibrating",  color: "text-blue-600 bg-blue-100",    icon: Clock },
};

const CONN_STATUS: Record<string, { dot: string; label: string }> = {
  CONNECTED:    { dot: "bg-green-500",  label: "Connected" },
  DISCONNECTED: { dot: "bg-slate-400",  label: "Disconnected" },
  ERROR:        { dot: "bg-red-500",    label: "Error" },
  IDLE:         { dot: "bg-amber-400",  label: "Idle" },
};

const PROTOCOL_BADGE: Record<string, string> = {
  ASTM:     "bg-blue-100 text-blue-700",
  HL7_MLLP: "bg-purple-100 text-purple-700",
  HTTP:     "bg-slate-100 text-slate-600",
};

const MSG_STATUS_BADGE: Record<string, string> = {
  RAW:    "bg-slate-100 text-slate-600",
  PARSED: "bg-blue-100 text-blue-700",
  POSTED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtTime(d: string) {
  return new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function isWithin5Min(iso: string) {
  return Date.now() - new Date(iso).getTime() < 5 * 60 * 1000;
}

// ── Tab 1: Instruments ────────────────────────────────────────────────────────

function InstrumentsTab() {
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["instruments", statusFilter],
    queryFn: () =>
      api
        .get(`/instruments?limit=100${statusFilter !== "ALL" ? `&status=${statusFilter}` : ""}`)
        .then((r) => r.data as { data: Instrument[] }),
  });

  const { data: connData } = useQuery({
    queryKey: ["instrument-connections", selectedId],
    queryFn: () =>
      api
        .get(`/instruments/${selectedId}/connections`)
        .then((r) => r.data as { data: Connection[] }),
    enabled: !!selectedId,
  });

  const instruments = data?.data ?? [];
  const connections = connData?.data ?? [];

  return (
    <div className="space-y-5">
      {/* Summary chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Active",      status: "ACTIVE",      color: "bg-green-50 border-green-100 text-green-700" },
          { label: "Maintenance", status: "MAINTENANCE",  color: "bg-amber-50 border-amber-100 text-amber-700" },
          { label: "Inactive",    status: "INACTIVE",     color: "bg-red-50 border-red-100 text-red-700" },
          { label: "Calibrating", status: "CALIBRATION",  color: "bg-blue-50 border-blue-100 text-blue-700" },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border px-4 py-3 ${s.color}`}>
            <div className="text-2xl font-bold">
              {instruments.filter((i) => i.status === s.status).length}
            </div>
            <div className="text-xs font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit flex-wrap">
        {["ALL", "ACTIVE", "MAINTENANCE", "CALIBRATION", "INACTIVE"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              statusFilter === s
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ")}
          </button>
        ))}
      </div>

      <div className="flex gap-5">
        {/* Instrument grid */}
        <div className="flex-1">
          {isLoading ? (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white border border-slate-100 rounded-xl p-5 animate-pulse">
                  <div className="h-5 w-3/4 bg-slate-200 rounded mb-3" />
                  <div className="h-4 w-1/2 bg-slate-100 rounded mb-2" />
                  <div className="h-3 w-2/3 bg-slate-100 rounded" />
                </div>
              ))}
            </div>
          ) : instruments.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-100 p-16 text-center">
              <Cpu className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">No instruments found</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {instruments.map((inst) => {
                const cfg = INSTRUMENT_STATUS[inst.status] ?? INSTRUMENT_STATUS.INACTIVE;
                const StatusIcon = cfg.icon;
                const calibDue = inst.nextCalibration
                  ? new Date(inst.nextCalibration) < new Date()
                  : false;
                const isSelected = selectedId === inst.id;
                return (
                  <div
                    key={inst.id}
                    className={`bg-white border rounded-xl p-5 hover:shadow-md transition-all ${
                      isSelected ? "border-[#0D7E8A] shadow-md" : "border-slate-100"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-900 text-sm truncate">{inst.name}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {inst.manufacturer} · {inst.model}
                        </p>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                    </div>
                    <div className="space-y-1 text-xs text-slate-500">
                      <div>
                        S/N: <span className="font-mono text-slate-700">{inst.serialNumber}</span>
                      </div>
                      <div>Branch: {inst.branch.name}</div>
                      <div>
                        Last calibration: <span className="text-slate-700">{fmt(inst.lastCalibration)}</span>
                      </div>
                      <div className={calibDue ? "text-red-500 font-medium" : ""}>
                        Next calibration:{" "}
                        <span>{calibDue ? "OVERDUE — " : ""}{fmt(inst.nextCalibration)}</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-50 flex items-center justify-between">
                      <span className="text-xs text-slate-400">
                        {inst._count?.connections ?? 0} connection(s)
                      </span>
                      <button
                        onClick={() => setSelectedId(isSelected ? null : inst.id)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                          isSelected
                            ? "bg-[#0D7E8A]/10 text-[#0D7E8A]"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {isSelected ? <Link2Off className="w-3 h-3" /> : <Link2 className="w-3 h-3" />}
                        {isSelected ? "Hide" : "Connections"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Connection panel */}
        {selectedId && (
          <div className="w-72 shrink-0 bg-white border border-slate-100 rounded-xl p-4 self-start sticky top-4 space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto">
            <h3 className="font-semibold text-slate-800 text-sm">
              Connections — {instruments.find((i) => i.id === selectedId)?.name}
            </h3>
            {connections.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No connections configured</p>
            ) : (
              connections.map((conn) => {
                const cs = CONN_STATUS[conn.status] ?? CONN_STATUS.DISCONNECTED;
                return (
                  <div key={conn.id} className="border border-slate-100 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PROTOCOL_BADGE[conn.protocol] ?? "bg-slate-100 text-slate-600"}`}>
                        {conn.protocol.replace("_", " ")}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <span className={`w-2 h-2 rounded-full ${cs.dot}`} />
                        {cs.label}
                      </span>
                    </div>
                    <p className="font-mono text-xs text-slate-600">
                      {conn.host}:{conn.port}
                    </p>
                    {conn.apiKey && (
                      <p className="text-xs text-slate-400 truncate">
                        Key: {conn.apiKey.substring(0, 12)}...
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Add Connection Modal ──────────────────────────────────────────────────────

interface AddConnModalProps {
  instrumentId: string;
  instrumentName: string;
  onClose: () => void;
  onSuccess: () => void;
}

function AddConnModal({ instrumentId, instrumentName, onClose, onSuccess }: AddConnModalProps) {
  const [protocol, setProtocol] = useState("ASTM");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/instruments/${instrumentId}/connections`, {
        protocol,
        host,
        port: Number(port),
        apiKey: apiKey || undefined,
      }),
    onSuccess: () => {
      onSuccess();
      onClose();
    },
    onError: () => setError("Failed to create connection. Please check your inputs."),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
        <h2 className="font-bold text-slate-900 text-lg mb-1">Add Connection</h2>
        <p className="text-sm text-slate-400 mb-4">{instrumentName}</p>

        {error && (
          <div className="mb-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">Protocol</label>
            <select
              value={protocol}
              onChange={(e) => setProtocol(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]/30"
            >
              <option value="ASTM">ASTM</option>
              <option value="HL7_MLLP">HL7 MLLP</option>
              <option value="HTTP">HTTP</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">Host</label>
            <input
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="192.168.1.100"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]/30"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">Port</label>
            <input
              type="number"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder="2575"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]/30"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">API Key (optional)</label>
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Optional bearer token"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]/30"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!host || !port || mutation.isPending}
            className="flex-1 px-4 py-2 bg-[#0D7E8A] text-white rounded-lg text-sm font-medium hover:bg-[#0a6b76] disabled:opacity-50"
          >
            {mutation.isPending ? "Adding..." : "Add Connection"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tab 2: Connections & Messages ─────────────────────────────────────────────

function ConnectionsTab() {
  const qc = useQueryClient();
  const [connFilter, setConnFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const [addConnFor, setAddConnFor] = useState<{ id: string; name: string } | null>(null);

  const { data: instData } = useQuery({
    queryKey: ["instruments-all"],
    queryFn: () => api.get("/instruments?limit=100").then((r) => r.data as { data: Instrument[] }),
  });

  const instruments = instData?.data ?? [];

  // Fetch all connections for all instruments (flat list)
  const { data: allConnData } = useQuery({
    queryKey: ["all-connections"],
    queryFn: async () => {
      const results = await Promise.all(
        instruments.map((inst) =>
          api
            .get(`/instruments/${inst.id}/connections`)
            .then((r) => (r.data as { data: Connection[] }).data.map((c) => ({ ...c, instrument: { name: inst.name } })))
            .catch(() => [] as Connection[])
        )
      );
      return results.flat();
    },
    enabled: instruments.length > 0,
  });

  const allConnections = allConnData ?? [];

  const msgQuery = useQuery({
    queryKey: ["instrument-messages", connFilter, statusFilter, page],
    queryFn: () =>
      api
        .get(
          `/instruments/messages?page=${page + 1}&limit=20${connFilter ? `&connectionId=${connFilter}` : ""}${statusFilter ? `&status=${statusFilter}` : ""}`
        )
        .then((r) => r.data as { data: InstrumentMessage[]; total: number }),
  });

  const statsQuery = useQuery({
    queryKey: ["instrument-message-stats"],
    queryFn: () =>
      api.get("/instruments/messages/stats").then((r) => r.data as MessageStats),
  });

  const messages = msgQuery.data?.data ?? [];
  const total = msgQuery.data?.total ?? 0;
  const stats = statsQuery.data;

  const columns: ColumnDef<InstrumentMessage>[] = [
    {
      header: "Time",
      accessorKey: "receivedAt",
      cell: ({ getValue }) => (
        <span className="text-xs text-slate-500 whitespace-nowrap">
          {fmtTime(getValue() as string)}
        </span>
      ),
    },
    {
      header: "Direction",
      accessorKey: "direction",
      cell: ({ getValue }) => {
        const dir = getValue() as string;
        return (
          <span className={`inline-flex items-center gap-1 text-xs font-medium ${dir === "IN" ? "text-blue-600" : "text-orange-500"}`}>
            {dir === "IN" ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />}
            {dir}
          </span>
        );
      },
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: ({ getValue }) => {
        const s = getValue() as string;
        return (
          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${MSG_STATUS_BADGE[s] ?? "bg-slate-100 text-slate-600"}`}>
            {s}
          </span>
        );
      },
    },
    {
      header: "Protocol",
      accessorKey: "protocol",
      cell: ({ getValue }) => {
        const p = getValue() as string;
        return (
          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${PROTOCOL_BADGE[p] ?? "bg-slate-100 text-slate-600"}`}>
            {p}
          </span>
        );
      },
    },
    {
      header: "Results",
      accessorKey: "resultCount",
      cell: ({ getValue }) => (
        <span className="text-xs text-slate-700 font-mono">{getValue() as number}</span>
      ),
    },
    {
      header: "Payload",
      accessorKey: "rawPayload",
      cell: ({ getValue }) => {
        const raw = getValue() as string | null;
        if (!raw) return <span className="text-xs text-slate-300">—</span>;
        return (
          <span className="font-mono text-xs text-slate-500" title={raw}>
            {raw.length > 60 ? raw.substring(0, 60) + "…" : raw}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex gap-5">
        {/* Left — connection list */}
        <div className="w-72 shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 text-sm">Instrument Connections</h3>
          </div>
          {instruments.length === 0 ? (
            <p className="text-xs text-slate-400">No instruments found.</p>
          ) : (
            instruments.map((inst) => {
              const instConns = allConnections.filter((c) => c.instrumentId === inst.id);
              return (
                <div key={inst.id} className="bg-white border border-slate-100 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-800 text-sm truncate flex-1">{inst.name}</p>
                    <button
                      onClick={() => setAddConnFor({ id: inst.id, name: inst.name })}
                      className="ml-2 shrink-0 inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg text-xs font-medium"
                    >
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  </div>
                  {instConns.length === 0 ? (
                    <p className="text-xs text-slate-300">No connections</p>
                  ) : (
                    instConns.map((conn) => {
                      const cs = CONN_STATUS[conn.status] ?? CONN_STATUS.DISCONNECTED;
                      return (
                        <div
                          key={conn.id}
                          className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100"
                          onClick={() => setConnFilter(connFilter === conn.id ? "" : conn.id)}
                        >
                          <span className={`w-2 h-2 rounded-full shrink-0 ${cs.dot}`} />
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${PROTOCOL_BADGE[conn.protocol] ?? "bg-slate-100 text-slate-500"}`}>
                            {conn.protocol.replace("_", " ")}
                          </span>
                          <span className="font-mono text-xs text-slate-500 truncate">
                            {conn.host}:{conn.port}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Right — message log */}
        <div className="flex-1 space-y-4">
          {/* Stats chips */}
          {stats && (
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                RAW: {stats.RAW}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                PARSED: {stats.PARSED}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                POSTED: {stats.POSTED}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                FAILED: {stats.FAILED}
              </span>
              <span className="text-xs text-slate-400 self-center ml-1">last 24h</span>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <select
              value={connFilter}
              onChange={(e) => { setConnFilter(e.target.value); setPage(0); }}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none"
            >
              <option value="">All Connections</option>
              {allConnections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.instrument?.name} — {c.host}:{c.port}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none"
            >
              <option value="">All Statuses</option>
              {["RAW", "PARSED", "POSTED", "FAILED"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none"
            />
            <span className="text-slate-300 text-sm">—</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none"
            />
            <button
              onClick={() => { qc.invalidateQueries({ queryKey: ["instrument-messages"] }); }}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-medium ml-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          {/* Message table */}
          <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
            <DataTable
              columns={columns}
              data={messages}
              isLoading={msgQuery.isLoading}
              pagination={{
                pageIndex: page,
                pageSize: 20,
                total,
                onPageChange: setPage,
              }}
              emptyMessage="No messages found"
            />
          </div>
        </div>
      </div>

      {/* Add Connection Modal */}
      {addConnFor && (
        <AddConnModal
          instrumentId={addConnFor.id}
          instrumentName={addConnFor.name}
          onClose={() => setAddConnFor(null)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["all-connections"] });
            qc.invalidateQueries({ queryKey: ["instrument-connections"] });
          }}
        />
      )}
    </div>
  );
}

// ── Add Logger Modal ──────────────────────────────────────────────────────────

interface AddLoggerModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function AddLoggerModal({ onClose, onSuccess }: AddLoggerModalProps) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [alertMin, setAlertMin] = useState("");
  const [alertMax, setAlertMax] = useState("");
  const [unit, setUnit] = useState("CELSIUS");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      api.post("/temperature/loggers", {
        name,
        location,
        alertMin: Number(alertMin),
        alertMax: Number(alertMax),
        unit,
      }),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: () => setError("Failed to create logger."),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
        <h2 className="font-bold text-slate-900 text-lg mb-4">Add Temperature Logger</h2>
        {error && (
          <div className="mb-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{error}</div>
        )}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Blood Bank Fridge 1"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]/30" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">Location</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Lab Room 2A"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]/30" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">Alert Min (°)</label>
              <input type="number" value={alertMin} onChange={(e) => setAlertMin(e.target.value)} placeholder="2"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]/30" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">Alert Max (°)</label>
              <input type="number" value={alertMax} onChange={(e) => setAlertMax(e.target.value)} placeholder="8"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]/30" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">Unit</label>
            <select value={unit} onChange={(e) => setUnit(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]/30">
              <option value="CELSIUS">Celsius (°C)</option>
              <option value="FAHRENHEIT">Fahrenheit (°F)</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!name || !location || !alertMin || !alertMax || mutation.isPending}
            className="flex-1 px-4 py-2 bg-[#0D7E8A] text-white rounded-lg text-sm font-medium hover:bg-[#0a6b76] disabled:opacity-50">
            {mutation.isPending ? "Adding..." : "Add Logger"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tab 3: Cold Chain ─────────────────────────────────────────────────────────

function ColdChainTab() {
  const qc = useQueryClient();
  const [selectedLogger, setSelectedLogger] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const { data: loggersData, isLoading } = useQuery({
    queryKey: ["temp-loggers"],
    queryFn: () =>
      api.get("/temperature/loggers").then((r) => r.data as { data: TempLogger[] }),
  });

  const { data: readingsData } = useQuery({
    queryKey: ["temp-readings", selectedLogger],
    queryFn: () =>
      api
        .get(`/temperature/loggers/${selectedLogger}/readings?limit=200`)
        .then((r) => r.data as { data: TempReading[] }),
    enabled: !!selectedLogger,
  });

  const alertSummaries = useQuery({
    queryKey: ["temp-alert-summaries"],
    queryFn: async () => {
      const loggers = loggersData?.data ?? [];
      const results = await Promise.all(
        loggers.map((l) =>
          api
            .get(`/temperature/loggers/${l.id}/alert-summary`)
            .then((r) => ({ id: l.id, count: r.data as number }))
            .catch(() => ({ id: l.id, count: 0 }))
        )
      );
      return Object.fromEntries(results.map((r) => [r.id, r.count]));
    },
    enabled: (loggersData?.data?.length ?? 0) > 0,
  });

  const loggers = loggersData?.data ?? [];
  const readings = readingsData?.data ?? [];
  const selectedLoggerData = loggers.find((l) => l.id === selectedLogger);

  const chartData = readings
    .slice()
    .reverse()
    .map((r) => ({
      time: new Date(r.recordedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      temp: r.temperature,
      isAlert: r.isAlert,
    }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-800">Temperature Loggers</h3>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-3 py-2 bg-[#0D7E8A] text-white rounded-lg text-sm font-medium hover:bg-[#0a6b76]"
        >
          <Plus className="w-4 h-4" /> Add Logger
        </button>
      </div>

      <div className="flex gap-5">
        {/* Logger cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 flex-1 content-start">
          {isLoading
            ? [...Array(4)].map((_, i) => (
                <div key={i} className="bg-white border border-slate-100 rounded-xl p-5 animate-pulse">
                  <div className="h-5 w-2/3 bg-slate-200 rounded mb-2" />
                  <div className="h-4 w-1/2 bg-slate-100 rounded mb-4" />
                  <div className="h-8 w-1/3 bg-slate-200 rounded" />
                </div>
              ))
            : loggers.length === 0
            ? (
              <div className="col-span-3 bg-white rounded-xl border border-slate-100 p-16 text-center">
                <Thermometer className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">No temperature loggers configured</p>
              </div>
            )
            : loggers.map((logger) => {
                const temp = logger.latestReading?.temperature;
                const lastAt = logger.latestReading?.recordedAt;
                const inRange = temp !== undefined
                  ? temp >= logger.alertMin && temp <= logger.alertMax
                  : true;
                const isLive = lastAt ? isWithin5Min(lastAt) : false;
                const alertCount = alertSummaries.data?.[logger.id] ?? 0;
                const isSelected = selectedLogger === logger.id;

                return (
                  <div
                    key={logger.id}
                    onClick={() => setSelectedLogger(isSelected ? null : logger.id)}
                    className={`bg-white border rounded-xl p-5 cursor-pointer hover:shadow-md transition-all ${
                      isSelected ? "border-[#0D7E8A] shadow-md" : "border-slate-100"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-slate-900 text-sm truncate">{logger.name}</h4>
                        <p className="text-xs text-slate-400">{logger.location}</p>
                      </div>
                      <div className="flex items-center gap-1.5 ml-2">
                        {alertCount > 0 && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-bold">
                            <AlertTriangle className="w-3 h-3" />
                            {alertCount}
                          </span>
                        )}
                        {isLive && (
                          <span className="relative flex w-2.5 h-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                          </span>
                        )}
                      </div>
                    </div>

                    <div className={`text-3xl font-bold mt-3 ${inRange ? "text-green-600" : "text-red-600"}`}>
                      {temp !== undefined ? `${temp.toFixed(1)}°` : "—"}
                      <span className="text-sm font-normal text-slate-400 ml-1">{logger.unit === "FAHRENHEIT" ? "F" : "C"}</span>
                    </div>

                    <div className="mt-3 text-xs text-slate-400">
                      Range: {logger.alertMin}° — {logger.alertMax}°
                      {!inRange && temp !== undefined && (
                        <span className="ml-2 text-red-500 font-semibold">OUT OF RANGE</span>
                      )}
                    </div>

                    {lastAt && (
                      <div className="mt-1 text-xs text-slate-300">
                        Last reading: {fmtTime(lastAt)}
                      </div>
                    )}
                  </div>
                );
              })}
        </div>

        {/* Chart panel */}
        {selectedLogger && selectedLoggerData && (
          <div className="w-[480px] shrink-0 bg-white border border-slate-100 rounded-xl p-5 self-start sticky top-4">
            <h4 className="font-semibold text-slate-800 text-sm mb-1">{selectedLoggerData.name} — Temperature Trend</h4>
            <p className="text-xs text-slate-400 mb-4">Last 200 readings · Range: {selectedLoggerData.alertMin}° – {selectedLoggerData.alertMax}°</p>

            {readings.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-slate-300 text-sm">No readings available</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 10 }}
                    interval="preserveStartEnd"
                    stroke="#cbd5e1"
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    stroke="#cbd5e1"
                    domain={["auto", "auto"]}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 12 }}
                    formatter={(val: number) => [`${val.toFixed(1)}°`, "Temp"]}
                  />
                  <ReferenceLine
                    y={selectedLoggerData.alertMin}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                    label={{ value: `Min ${selectedLoggerData.alertMin}°`, fontSize: 10, fill: "#ef4444" }}
                  />
                  <ReferenceLine
                    y={selectedLoggerData.alertMax}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                    label={{ value: `Max ${selectedLoggerData.alertMax}°`, fontSize: 10, fill: "#ef4444" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="temp"
                    stroke="#0D7E8A"
                    strokeWidth={1.5}
                    dot={false}
                    activeDot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        )}
      </div>

      {showAddModal && (
        <AddLoggerModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ["temp-loggers"] })}
        />
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function InstrumentsPage() {
  const [tab, setTab] = useState("instruments");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Instruments"
        subtitle="Lab equipment, interface connections, temperature monitoring"
        actions={null}
      />

      <RadixTabs.Root value={tab} onValueChange={setTab}>
        <RadixTabs.List className="flex gap-0.5 bg-slate-100 rounded-xl p-1 w-fit mb-6">
          {[
            { value: "instruments", label: "Instruments", icon: Cpu },
            { value: "connections",  label: "Connections & Messages", icon: ArrowUpDown },
            { value: "coldchain",    label: "Cold Chain", icon: Thermometer },
          ].map(({ value, label, icon: Icon }) => (
            <RadixTabs.Trigger
              key={value}
              value={value}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all
                text-slate-500 hover:text-slate-800
                data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
            >
              <Icon className="w-4 h-4" />
              {label}
            </RadixTabs.Trigger>
          ))}
        </RadixTabs.List>

        <RadixTabs.Content value="instruments">
          <InstrumentsTab />
        </RadixTabs.Content>
        <RadixTabs.Content value="connections">
          <ConnectionsTab />
        </RadixTabs.Content>
        <RadixTabs.Content value="coldchain">
          <ColdChainTab />
        </RadixTabs.Content>
      </RadixTabs.Root>
    </div>
  );
}
