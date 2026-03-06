"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { formatDate } from "@/lib/utils";
import api from "@/lib/api";

// ── Types ───────────────────────────────────────────────────────────────────

interface RecentResult {
  testName: string;
  value: string;
  interpretation: string;
  date: string;
}

interface TrendDataPoint {
  date: string;
  value: number;
}

interface Trend {
  testName: string;
  dataPoints: TrendDataPoint[];
}

interface HealthInsightsData {
  healthScore: number;
  riskFlags: string[];
  recentResults: RecentResult[];
  trends: Trend[];
}

// ── Health Score Gauge (SVG arc) ────────────────────────────────────────────

function HealthScoreGauge({ score }: { score: number }) {
  const r = 80;
  const cx = 100;
  const cy = 100;
  // 270° arc: total arc length = 2*PI*r * (270/360)
  const totalArc = 2 * Math.PI * r * 0.75; // ≈ 376.99
  const dashOffset = totalArc * (1 - score / 100);

  const color =
    score > 70 ? "#10B981" : score > 40 ? "#F59E0B" : "#EF4444";

  // Track arc: starts at 225° (bottom-left), goes 270° clockwise
  // We use transform to rotate the whole arc
  return (
    <svg
      viewBox="0 0 200 200"
      width="200"
      height="200"
      className="block"
      aria-label={`Health score: ${score}`}
    >
      {/* Background track */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="#E2E8F0"
        strokeWidth="14"
        strokeLinecap="round"
        strokeDasharray={`${totalArc} ${2 * Math.PI * r}`}
        transform={`rotate(-135 ${cx} ${cy})`}
      />
      {/* Foreground arc */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="14"
        strokeLinecap="round"
        strokeDasharray={`${totalArc} ${2 * Math.PI * r}`}
        strokeDashoffset={dashOffset}
        transform={`rotate(-135 ${cx} ${cy})`}
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
      {/* Center text */}
      <text
        x={cx}
        y={cy - 6}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="32"
        fontWeight="bold"
        fill="#1E293B"
      >
        {score}
      </text>
      <text
        x={cx}
        y={cy + 22}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="12"
        fill="#64748B"
      >
        Health Score
      </text>
    </svg>
  );
}

// ── Interpretation Badge ────────────────────────────────────────────────────

function InterpretationBadge({
  interpretation,
}: {
  interpretation: string;
}) {
  const map: Record<string, string> = {
    NORMAL: "bg-green-50 text-green-700 border-green-200",
    ABNORMAL: "bg-amber-50 text-amber-700 border-amber-200",
    CRITICAL: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${
        map[interpretation] ?? "bg-slate-50 text-slate-600 border-slate-200"
      }`}
    >
      {interpretation}
    </span>
  );
}

// ── Sparkline ───────────────────────────────────────────────────────────────

function Sparkline({ dataPoints }: { dataPoints: TrendDataPoint[] }) {
  if (dataPoints.length < 2) {
    return (
      <div className="w-full h-16 flex items-center justify-center text-slate-300 text-xs">
        Insufficient data
      </div>
    );
  }

  const values = dataPoints.map((p) => p.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const W = 200;
  const H = 60;
  const pad = 4;

  const points = dataPoints.map((p, i) => {
    const x = pad + (i / (dataPoints.length - 1)) * (W - pad * 2);
    const y = pad + ((maxVal - p.value) / range) * (H - pad * 2);
    return `${x},${y}`;
  });

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-16"
      preserveAspectRatio="none"
    >
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="#10B981"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Dots at each data point */}
      {dataPoints.map((p, i) => {
        const x = pad + (i / (dataPoints.length - 1)) * (W - pad * 2);
        const y = pad + ((maxVal - p.value) / range) * (H - pad * 2);
        return (
          <circle key={i} cx={x} cy={y} r="3" fill="#10B981">
            <title>
              {p.date}: {p.value}
            </title>
          </circle>
        );
      })}
    </svg>
  );
}

// ── Loading Skeleton ────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-48 h-48 rounded-full bg-slate-100" />
        <div className="space-y-2">
          <div className="h-4 w-32 bg-slate-100 rounded" />
          <div className="h-4 w-48 bg-slate-100 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 bg-slate-100 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function HealthInsightsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["portal-health-insights"],
    queryFn: async () => {
      const res = await api.get<{ data: HealthInsightsData }>(
        "/portal/health-insights"
      );
      return res.data.data;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Health Insights</h1>
        <LoadingSkeleton />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Health Insights</h1>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-amber-700 text-sm">
          Health insights are not available at this time. Please check back
          after your first test results are processed.
        </div>
      </div>
    );
  }

  const scoreColor =
    data.healthScore > 70
      ? "text-green-600"
      : data.healthScore > 40
      ? "text-amber-600"
      : "text-red-600";

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Health Insights</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          AI-powered analysis of your lab results and health trends
        </p>
      </div>

      {/* Score + Risk Flags */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Score Gauge */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col items-center">
          <HealthScoreGauge score={data.healthScore} />
          <p className={`text-lg font-bold mt-2 ${scoreColor}`}>
            {data.healthScore > 70
              ? "Good"
              : data.healthScore > 40
              ? "Moderate"
              : "Needs Attention"}
          </p>
          <p className="text-xs text-slate-400 mt-1 text-center">
            Based on your recent lab results
          </p>
        </div>

        {/* Risk Flags */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-base font-bold text-slate-800 mb-4">
            Risk Flags
          </h2>
          {data.riskFlags.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-green-600">
              <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mb-2">
                <span className="text-2xl">✓</span>
              </div>
              <p className="text-sm font-semibold">No risk flags identified</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Keep up the good work!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.riskFlags.map((flag, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800 font-medium">{flag}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Results */}
      {data.recentResults.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-slate-800 mb-4">
            Recent Results
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {data.recentResults.map((result, i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-slate-100 shadow-sm p-4"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-sm font-bold text-slate-800 leading-tight">
                    {result.testName}
                  </p>
                  <InterpretationBadge
                    interpretation={result.interpretation}
                  />
                </div>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {result.value}
                </p>
                <p className="text-xs text-slate-400 mt-2">
                  {formatDate(result.date)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trends Sparklines */}
      {data.trends.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-slate-800 mb-4">Trends</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.trends.map((trend, i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-slate-100 shadow-sm p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold text-slate-800">
                    {trend.testName}
                  </p>
                  <p className="text-xs text-slate-400">
                    {trend.dataPoints.length} data points
                  </p>
                </div>
                {trend.dataPoints.length > 0 && (
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span>{formatDate(trend.dataPoints[0].date)}</span>
                    <span>
                      {formatDate(
                        trend.dataPoints[trend.dataPoints.length - 1].date
                      )}
                    </span>
                  </div>
                )}
                <Sparkline dataPoints={trend.dataPoints} />
                {trend.dataPoints.length >= 2 && (
                  <div className="flex items-center justify-between mt-1 text-xs">
                    <span className="text-slate-400">
                      Min:{" "}
                      <span className="font-semibold text-slate-600">
                        {Math.min(...trend.dataPoints.map((p) => p.value))}
                      </span>
                    </span>
                    <span className="text-slate-400">
                      Max:{" "}
                      <span className="font-semibold text-slate-600">
                        {Math.max(...trend.dataPoints.map((p) => p.value))}
                      </span>
                    </span>
                    <span className="text-slate-400">
                      Latest:{" "}
                      <span className="font-semibold text-slate-600">
                        {
                          trend.dataPoints[trend.dataPoints.length - 1]
                            .value
                        }
                      </span>
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state if no data at all */}
      {data.recentResults.length === 0 && data.trends.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center">
          <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">🔬</span>
          </div>
          <p className="text-slate-700 font-semibold">No results yet</p>
          <p className="text-sm text-slate-400 mt-1">
            Your health insights will appear here after your first test results
            are available.
          </p>
        </div>
      )}
    </div>
  );
}
