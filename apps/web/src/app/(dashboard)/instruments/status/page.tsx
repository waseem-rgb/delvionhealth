"use client";

import { useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ExternalLink,
  Clock,
  Cpu,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";
import api from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Instrument {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  status: string;
  lastCalibration: string | null;
  nextCalibration: string | null;
  updatedAt: string;
  branch: { name: string };
  connections: Array<{
    id: string;
    status: string;
    isActive: boolean;
    updatedAt: string;
  }>;
  _count?: { connections: number };
}

// ── Status Config ─────────────────────────────────────────────────────────────

type DisplayStatus = "Online" | "Offline" | "Syncing" | "Error" | "Maintenance";

function getDisplayStatus(instrument: Instrument): DisplayStatus {
  const s = instrument.status;
  if (s === "ACTIVE") {
    const hasConnected = instrument.connections?.some(
      (c) => c.status === "CONNECTED" && c.isActive,
    );
    return hasConnected ? "Online" : "Online";
  }
  if (s === "MAINTENANCE" || s === "CALIBRATION") return "Maintenance";
  if (s === "INACTIVE") return "Offline";
  return "Offline";
}

const STATUS_CONFIG: Record<
  DisplayStatus,
  { dot: string; pulse: boolean; badge: string; label: string; icon: React.ElementType }
> = {
  Online: {
    dot: "bg-green-500",
    pulse: true,
    badge: "bg-green-100 text-green-700",
    label: "Online",
    icon: CheckCircle2,
  },
  Offline: {
    dot: "bg-red-500",
    pulse: false,
    badge: "bg-red-100 text-red-700",
    label: "Offline",
    icon: XCircle,
  },
  Syncing: {
    dot: "bg-blue-500",
    pulse: true,
    badge: "bg-blue-100 text-blue-700",
    label: "Syncing",
    icon: Loader2,
  },
  Error: {
    dot: "bg-orange-500",
    pulse: false,
    badge: "bg-orange-100 text-orange-700",
    label: "Error",
    icon: AlertTriangle,
  },
  Maintenance: {
    dot: "bg-amber-400",
    pulse: false,
    badge: "bg-amber-100 text-amber-700",
    label: "Maintenance",
    icon: Clock,
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(isoString: string | null | undefined): string {
  if (!isoString) return "Never";
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 10) return "Just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

function isOfflineMoreThan1Hour(instrument: Instrument): boolean {
  if (instrument.status !== "INACTIVE") return false;
  const lastSeen = instrument.updatedAt;
  if (!lastSeen) return true;
  const diffMs = Date.now() - new Date(lastSeen).getTime();
  return diffMs > 60 * 60 * 1000;
}

// ── Instrument Status Card ────────────────────────────────────────────────────

function InstrumentStatusCard({ instrument }: { instrument: Instrument }) {
  const displayStatus = getDisplayStatus(instrument);
  const cfg = STATUS_CONFIG[displayStatus];
  const StatusIcon = cfg.icon;

  // Error count: connections with ERROR status
  const errorCount =
    instrument.connections?.filter((c) => c.status === "ERROR").length ?? 0;

  // Last sync: latest updatedAt among connections, fallback to instrument updatedAt
  const lastSync =
    instrument.connections?.length > 0
      ? instrument.connections.reduce((latest, c) => {
          const ct = new Date(c.updatedAt ?? 0).getTime();
          const lt = new Date(latest ?? 0).getTime();
          return ct > lt ? c.updatedAt : latest;
        }, instrument.updatedAt)
      : instrument.updatedAt;

  return (
    <div className="bg-white border border-slate-100 rounded-xl p-5 hover:shadow-md transition-all space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 text-sm truncate">{instrument.name}</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {instrument.manufacturer} · {instrument.model}
          </p>
        </div>

        {/* Status Badge */}
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ml-2 ${cfg.badge}`}
        >
          {/* Pulsing dot */}
          <span className="relative flex w-2 h-2 shrink-0">
            {cfg.pulse && (
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${cfg.dot}`}
              />
            )}
            <span className={`relative inline-flex rounded-full w-2 h-2 ${cfg.dot}`} />
          </span>
          {cfg.label}
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="bg-slate-50 rounded-lg p-2.5">
          <div className="text-slate-400 mb-1 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Last Sync
          </div>
          <p className="text-slate-700 font-medium">{relativeTime(lastSync)}</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-2.5">
          <div className="text-slate-400 mb-1 flex items-center gap-1">
            <Activity className="w-3 h-3" />
            Connections
          </div>
          <p className="text-slate-700 font-medium">
            {instrument._count?.connections ?? instrument.connections?.length ?? 0}
          </p>
        </div>
      </div>

      {/* Error count */}
      {errorCount > 0 && (
        <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-100 rounded-lg">
          <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
          <span className="text-xs text-red-600 font-medium">
            {errorCount} connection error{errorCount > 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Branch */}
      <div className="text-xs text-slate-400">
        Branch: <span className="text-slate-600">{instrument.branch?.name ?? "—"}</span>
      </div>

      {/* View Logs */}
      <div className="pt-1 border-t border-slate-50">
        <Link
          href={`/instruments?instrument=${instrument.id}`}
          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-medium transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          View Logs
        </Link>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function InstrumentStatusPage() {
  const qc = useQueryClient();

  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["instruments-status-monitor"],
    queryFn: () =>
      api
        .get("/instruments?limit=100")
        .then((r) => {
          const raw = r.data;
          if (Array.isArray(raw)) return raw as Instrument[];
          if (raw?.data) return raw.data as Instrument[];
          return [] as Instrument[];
        })
        .catch(() => [] as Instrument[]),
    refetchInterval: 30_000, // auto-refresh every 30s
    retry: 1,
    staleTime: 30000,
  });

  const instruments = data ?? [];

  // Alert: any instrument offline > 1 hour
  const offlineAlerts = instruments.filter(isOfflineMoreThan1Hour);

  // Status counts
  const counts = instruments.reduce(
    (acc, inst) => {
      const ds = getDisplayStatus(inst);
      acc[ds] = (acc[ds] ?? 0) + 1;
      return acc;
    },
    {} as Record<DisplayStatus, number>,
  );

  function handleRefresh() {
    qc.invalidateQueries({ queryKey: ["instruments-status-monitor"] });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Status Monitor"
        subtitle="Real-time instrument status and logs"
        actions={
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        }
      />

      {/* Offline Alert Banner */}
      {offlineAlerts.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700">
              {offlineAlerts.length} instrument{offlineAlerts.length > 1 ? "s" : ""} offline for
              more than 1 hour
            </p>
            <p className="text-xs text-red-500 mt-0.5">
              {offlineAlerts.map((i) => i.name).join(", ")}
            </p>
          </div>
        </div>
      )}

      {/* Summary Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {(
          [
            { key: "Online",      color: "bg-green-50 border-green-100 text-green-700" },
            { key: "Offline",     color: "bg-red-50 border-red-100 text-red-700" },
            { key: "Maintenance", color: "bg-amber-50 border-amber-100 text-amber-700" },
            { key: "Syncing",     color: "bg-blue-50 border-blue-100 text-blue-700" },
            { key: "Error",       color: "bg-orange-50 border-orange-100 text-orange-700" },
          ] as { key: DisplayStatus; color: string }[]
        ).map(({ key, color }) => (
          <div key={key} className={`rounded-xl border px-4 py-3 ${color}`}>
            <div className="text-2xl font-bold">{counts[key] ?? 0}</div>
            <div className="text-xs font-medium">{key}</div>
          </div>
        ))}
      </div>

      {/* Auto-refresh notice */}
      <p className="text-xs text-slate-400 flex items-center gap-1">
        <Activity className="w-3 h-3" />
        Auto-refreshing every 30 seconds
        {dataUpdatedAt ? (
          <span className="ml-1">· Last updated {relativeTime(new Date(dataUpdatedAt).toISOString())}</span>
        ) : null}
      </p>

      {/* Instrument Grid */}
      {isLoading ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="bg-white border border-slate-100 rounded-xl p-5 animate-pulse"
            >
              <div className="h-5 w-3/4 bg-slate-200 rounded mb-3" />
              <div className="h-4 w-1/2 bg-slate-100 rounded mb-4" />
              <div className="h-16 bg-slate-50 rounded-lg mb-3" />
              <div className="h-8 bg-slate-100 rounded-lg" />
            </div>
          ))}
        </div>
      ) : instruments.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 p-16 text-center">
          <Cpu className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm font-medium">No instruments found</p>
          <p className="text-slate-300 text-xs mt-1">
            Add instruments to monitor their status
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {instruments.map((inst) => (
            <InstrumentStatusCard key={inst.id} instrument={inst} />
          ))}
        </div>
      )}
    </div>
  );
}
