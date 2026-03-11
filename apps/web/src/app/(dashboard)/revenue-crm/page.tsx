"use client";

import { useQuery } from "@tanstack/react-query";
import {
  IndianRupee,
  Users,
  Building2,
  Clock,
  Megaphone,
  TrendingUp,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  BarChart3,
  Brain,
  Trophy,
  RefreshCw,
} from "lucide-react";
import api from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────────

interface KPI {
  label: string;
  value: number;
  subtitle: string;
}

interface OverviewData {
  kpis: {
    totalRevenueMTD: KPI;
    b2cRevenue: KPI;
    b2bRevenue: KPI;
    pendingCollection: KPI;
    activeCampaigns: KPI;
    pipelineValue: KPI;
  };
  revenueByChannel: Array<{
    channel: string;
    amount: number;
    color: string;
  }>;
  salesTeam: Array<{
    name: string;
    target: number;
    achieved: number;
  }>;
}

interface AIAlert {
  id: string;
  severity: "critical" | "warning" | "info";
  message: string;
  action: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const indianFormat = new Intl.NumberFormat("en-IN");

function formatINR(value: number): string {
  return `₹${indianFormat.format(value)}`;
}

function severityColor(severity: string) {
  switch (severity) {
    case "critical":
      return { bg: "bg-red-50", text: "text-red-600", border: "border-red-200", label: "Critical" };
    case "warning":
      return { bg: "bg-yellow-50", text: "text-yellow-600", border: "border-yellow-200", label: "Warning" };
    default:
      return { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-200", label: "Info" };
  }
}

// ── KPI Icon Map ───────────────────────────────────────────────────────────────

const kpiMeta: Record<string, { icon: typeof IndianRupee; gradient: string }> = {
  totalRevenueMTD: { icon: IndianRupee, gradient: "from-emerald-500 to-emerald-700" },
  b2cRevenue:      { icon: Users,       gradient: "from-blue-500 to-blue-700" },
  b2bRevenue:      { icon: Building2,   gradient: "from-violet-500 to-violet-700" },
  pendingCollection: { icon: Clock,     gradient: "from-amber-500 to-amber-700" },
  activeCampaigns: { icon: Megaphone,   gradient: "from-pink-500 to-pink-700" },
  pipelineValue:   { icon: TrendingUp,  gradient: "from-cyan-500 to-cyan-700" },
};

const kpiOrder = [
  "totalRevenueMTD",
  "b2cRevenue",
  "b2bRevenue",
  "pendingCollection",
  "activeCampaigns",
  "pipelineValue",
] as const;

// ── Skeleton Components ────────────────────────────────────────────────────────

function SkeletonKPIStrip() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 animate-pulse">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-lg bg-slate-200" />
            <div className="h-3 w-20 rounded bg-slate-200" />
          </div>
          <div className="h-6 w-24 rounded bg-slate-200 mb-2" />
          <div className="h-3 w-16 rounded bg-slate-200" />
        </div>
      ))}
    </div>
  );
}

function SkeletonColumn() {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 animate-pulse">
      <div className="h-5 w-40 rounded bg-slate-200 mb-5" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="mb-4">
          <div className="h-4 w-full rounded bg-slate-200 mb-2" />
          <div className="h-3 w-3/4 rounded bg-slate-200" />
        </div>
      ))}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function RevenueCRMPage() {
  const {
    data: overview,
    isLoading: overviewLoading,
    isError: overviewError,
    error: overviewErr,
    refetch: refetchOverview,
  } = useQuery<OverviewData>({
    queryKey: ["revenue-crm", "overview"],
    queryFn: async () => {
      const res = await api.get("/revenue-crm/overview");
      return (res.data?.data ?? res.data) as OverviewData;
    },
  });

  const {
    data: alerts,
    isLoading: alertsLoading,
    isError: alertsError,
    error: alertsErr,
  } = useQuery<AIAlert[]>({
    queryKey: ["revenue-crm", "ai-alerts"],
    queryFn: async () => {
      const res = await api.get("/revenue-crm/ai/alerts");
      return (res.data?.data ?? res.data) as AIAlert[];
    },
  });

  const isLoading = overviewLoading || alertsLoading;
  const hasError = overviewError || alertsError;
  const errorMessage =
    (overviewErr as Error)?.message || (alertsErr as Error)?.message || "Failed to load data";

  // Derive max channel value for bar scaling
  const maxChannelAmount =
    overview?.revenueByChannel?.reduce((max, ch) => Math.max(max, ch.amount), 0) || 1;

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Revenue Command Center</h1>
          <p className="text-slate-500 text-sm mt-1">
            Real-time revenue intelligence and sales performance
          </p>
        </div>
        <button
          onClick={() => refetchOverview()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white hover:bg-slate-50 text-sm text-slate-600 border border-slate-200 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* ── Error Banner ────────────────────────────────────────────────── */}
      {hasError && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          <p className="text-red-600 text-sm">{errorMessage}</p>
        </div>
      )}

      {/* ── ZONE A: KPI Strip ───────────────────────────────────────────── */}
      {isLoading ? (
        <SkeletonKPIStrip />
      ) : overview?.kpis ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {kpiOrder.map((key) => {
            const kpi = overview.kpis[key];
            if (!kpi) return null;
            const meta = kpiMeta[key];
            const Icon = meta.icon;
            return (
              <div
                key={key}
                className="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={`h-10 w-10 rounded-lg bg-gradient-to-br ${meta.gradient} flex items-center justify-center`}
                  >
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-xs text-slate-500 leading-tight">{kpi.label}</span>
                </div>
                <p className="text-xl font-bold text-slate-900">
                  {key === "activeCampaigns"
                    ? indianFormat.format(kpi.value)
                    : formatINR(kpi.value)}
                </p>
                <p className="text-xs text-slate-400 mt-1">{kpi.subtitle}</p>
              </div>
            );
          })}
        </div>
      ) : (
        !hasError && (
          <div className="text-center py-10 text-slate-400">No data available</div>
        )
      )}

      {/* ── ZONE B: Three Columns ───────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SkeletonColumn />
          <SkeletonColumn />
          <SkeletonColumn />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Column 1: Revenue by Channel ──────────────────────────── */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-5">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              <h2 className="text-base font-semibold text-slate-900">Revenue by Channel</h2>
            </div>

            {overview?.revenueByChannel && overview.revenueByChannel.length > 0 ? (
              <div className="space-y-4">
                {overview.revenueByChannel.map((ch) => {
                  const pct = Math.round((ch.amount / maxChannelAmount) * 100);
                  return (
                    <div key={ch.channel}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm text-slate-700">{ch.channel}</span>
                        <span className="text-sm font-medium text-slate-900">
                          {formatINR(ch.amount)}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: ch.color || "#3b82f6",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-6">No data available</p>
            )}
          </div>

          {/* ── Column 2: AI Intelligence Panel ──────────────────────── */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-5">
              <Brain className="h-5 w-5 text-violet-600" />
              <h2 className="text-base font-semibold text-slate-900">AI Intelligence Panel</h2>
            </div>

            {alerts && alerts.length > 0 ? (
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {alerts.map((alert) => {
                  const sev = severityColor(alert.severity);
                  return (
                    <div
                      key={alert.id}
                      className={`border ${sev.border} ${sev.bg} rounded-lg p-3.5`}
                    >
                      <div className="flex items-start gap-3">
                        {alert.severity === "critical" ? (
                          <AlertCircle className={`h-4 w-4 mt-0.5 shrink-0 ${sev.text}`} />
                        ) : alert.severity === "warning" ? (
                          <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${sev.text}`} />
                        ) : (
                          <CheckCircle2 className={`h-4 w-4 mt-0.5 shrink-0 ${sev.text}`} />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${sev.bg} ${sev.text}`}
                            >
                              {sev.label}
                            </span>
                          </div>
                          <p className="text-sm text-slate-700 leading-relaxed">
                            {alert.message}
                          </p>
                          <button
                            className={`mt-2 inline-flex items-center gap-1 text-xs font-medium ${sev.text} hover:underline`}
                          >
                            {alert.action}
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-6">No data available</p>
            )}
          </div>

          {/* ── Column 3: Sales Team Scoreboard ──────────────────────── */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-5">
              <Trophy className="h-5 w-5 text-amber-600" />
              <h2 className="text-base font-semibold text-slate-900">Sales Team Scoreboard</h2>
            </div>

            {overview?.salesTeam && overview.salesTeam.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                      <th className="text-left py-2 pr-2">Rep</th>
                      <th className="text-right py-2 px-2">Target</th>
                      <th className="text-right py-2 px-2">Achieved</th>
                      <th className="text-right py-2 pl-2 w-28">Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.salesTeam.map((rep) => {
                      const pct = rep.target > 0 ? Math.round((rep.achieved / rep.target) * 100) : 0;
                      const barColor =
                        pct >= 80
                          ? "bg-emerald-500"
                          : pct >= 60
                            ? "bg-amber-500"
                            : "bg-red-500";
                      const textColor =
                        pct >= 80
                          ? "text-emerald-400"
                          : pct >= 60
                            ? "text-amber-400"
                            : "text-red-400";
                      return (
                        <tr
                          key={rep.name}
                          className="border-b border-slate-100 last:border-0"
                        >
                          <td className="py-2.5 pr-2 text-slate-700 font-medium whitespace-nowrap">
                            {rep.name}
                          </td>
                          <td className="py-2.5 px-2 text-right text-slate-500 whitespace-nowrap">
                            {formatINR(rep.target)}
                          </td>
                          <td className="py-2.5 px-2 text-right text-slate-900 font-medium whitespace-nowrap">
                            {formatINR(rep.achieved)}
                          </td>
                          <td className="py-2.5 pl-2">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${barColor} transition-all duration-500`}
                                  style={{ width: `${Math.min(pct, 100)}%` }}
                                />
                              </div>
                              <span className={`text-xs font-semibold ${textColor} w-9 text-right`}>
                                {pct}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-6">No data available</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
