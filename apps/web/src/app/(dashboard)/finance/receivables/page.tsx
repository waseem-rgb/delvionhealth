"use client";

import { useQuery } from "@tanstack/react-query";
import {
  DollarSign,
  Clock,
  AlertTriangle,
  AlertOctagon,
  Ban,
  RefreshCw,
  Inbox,
  Building2,
  User,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import api from "@/lib/api";

// ── Types ───────────────────────────────────────────────────────────────────

interface ARBucket {
  range: string;
  amount: number;
  count: number;
}

interface OverdueEntry {
  name: string;
  amount: number;
  daysPending: number;
  type: "ORGANIZATION" | "PATIENT";
}

interface ReceivablesData {
  totalOutstanding: number;
  buckets: ARBucket[];
  topOverdue: OverdueEntry[];
}

// ── Bucket Config ───────────────────────────────────────────────────────────

const BUCKET_META: Record<
  string,
  { label: string; color: string; bgColor: string; barColor: string }
> = {
  "0-30": {
    label: "0-30 Days",
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    barColor: "bg-emerald-500",
  },
  "31-60": {
    label: "31-60 Days",
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    barColor: "bg-amber-500",
  },
  "61-90": {
    label: "61-90 Days",
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    barColor: "bg-orange-500",
  },
  "90+": {
    label: "90+ Days",
    color: "text-red-600",
    bgColor: "bg-red-50",
    barColor: "bg-red-500",
  },
};

const BUCKET_ORDER = ["0-30", "31-60", "61-90", "90+"];

// ── Helpers ─────────────────────────────────────────────────────────────────

function getBucketAmount(
  buckets: ARBucket[],
  range: string
): number {
  return buckets.find((b) => b.range === range)?.amount ?? 0;
}

function getBucketCount(
  buckets: ARBucket[],
  range: string
): number {
  return buckets.find((b) => b.range === range)?.count ?? 0;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function ReceivablesPage() {
  const {
    data: receivables,
    isLoading,
    isError,
    refetch,
  } = useQuery<ReceivablesData>({
    queryKey: ["billing", "receivables"],
    queryFn: async () => {
      const res = await api.get("/billing/receivables");
      const raw = res.data?.data ?? res.data ?? {};
      const rb = raw.buckets ?? {};

      // Backend returns buckets as object { current, days_1_30, ... }
      // Transform to ARBucket[] array expected by this page
      let buckets: ARBucket[];
      if (Array.isArray(rb)) {
        buckets = rb;
      } else {
        buckets = [
          { range: "0-30", amount: (rb.current?.total ?? 0) + (rb.days_1_30?.total ?? 0), count: (rb.current?.count ?? 0) + (rb.days_1_30?.count ?? 0) },
          { range: "31-60", amount: rb.days_31_60?.total ?? 0, count: rb.days_31_60?.count ?? 0 },
          { range: "61-90", amount: rb.days_61_90?.total ?? 0, count: rb.days_61_90?.count ?? 0 },
          { range: "90+", amount: rb.days_90_plus?.total ?? 0, count: rb.days_90_plus?.count ?? 0 },
        ];
      }

      const totalOutstanding = raw.totalOutstanding ?? buckets.reduce((s, b) => s + b.amount, 0);

      const topOverdue: OverdueEntry[] = (raw.topOverdue ?? []).map((e: Record<string, unknown>) => ({
        name: (e.patient ?? e.name ?? "Unknown") as string,
        amount: Number(e.balance ?? e.amount ?? 0),
        daysPending: Number(e.daysOverdue ?? e.daysPending ?? 0),
        type: (e.type as "ORGANIZATION" | "PATIENT") ?? "PATIENT",
      }));

      return { totalOutstanding, buckets, topOverdue };
    },
  });

  // ── Loading State ───────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        {/* Header skeleton */}
        <div className="h-8 w-56 bg-slate-100 rounded animate-pulse" />

        {/* KPI skeletons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-slate-100 shadow-sm p-5"
            >
              <div className="w-10 h-10 rounded-lg bg-slate-100 animate-pulse mb-3" />
              <div className="w-24 h-7 bg-slate-100 rounded animate-pulse mb-2" />
              <div className="w-32 h-4 bg-slate-100 rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* Chart skeleton */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div className="h-6 w-48 bg-slate-100 rounded animate-pulse mb-6" />
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 bg-slate-50 rounded animate-pulse" />
            ))}
          </div>
        </div>

        {/* Table skeleton */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div className="h-6 w-40 bg-slate-100 rounded animate-pulse mb-4" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-12 bg-slate-50 rounded animate-pulse mb-2"
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Error State ─────────────────────────────────────────────────────────
  if (isError || !receivables) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-12 text-center">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-1">
            Unable to load receivables data
          </h3>
          <p className="text-sm text-slate-500 mb-4">
            There was a problem fetching the AR aging data. Please try again.
          </p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { totalOutstanding = 0, buckets = [], topOverdue = [] } = receivables ?? {};
  const maxBucketAmount = Math.max(...buckets.map((b) => b.amount), 1);

  // ── KPI Icons per bucket ────────────────────────────────────────────────
  const kpiCards = [
    {
      label: "Total Outstanding",
      value: formatCurrency(totalOutstanding),
      icon: DollarSign,
      iconColor: "bg-indigo-100 text-indigo-600",
      subtitle: `${buckets.reduce((s, b) => s + b.count, 0)} invoices`,
    },
    {
      label: "0-30 Days",
      value: formatCurrency(getBucketAmount(buckets, "0-30")),
      icon: Clock,
      iconColor: "bg-emerald-100 text-emerald-600",
      subtitle: `${getBucketCount(buckets, "0-30")} invoices`,
    },
    {
      label: "31-60 Days",
      value: formatCurrency(getBucketAmount(buckets, "31-60")),
      icon: AlertTriangle,
      iconColor: "bg-amber-100 text-amber-600",
      subtitle: `${getBucketCount(buckets, "31-60")} invoices`,
    },
    {
      label: "61-90 Days",
      value: formatCurrency(getBucketAmount(buckets, "61-90")),
      icon: AlertOctagon,
      iconColor: "bg-orange-100 text-orange-600",
      subtitle: `${getBucketCount(buckets, "61-90")} invoices`,
    },
    {
      label: "90+ Days",
      value: formatCurrency(getBucketAmount(buckets, "90+")),
      icon: Ban,
      iconColor: "bg-red-100 text-red-600",
      subtitle: `${getBucketCount(buckets, "90+")} invoices`,
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Receivables &amp; AR Aging
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Accounts receivable aging analysis and overdue tracking
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* ── KPI Cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className={`p-2.5 rounded-lg ${kpi.iconColor.split(" ")[0]}`}
                >
                  <Icon
                    className={`w-5 h-5 ${kpi.iconColor.split(" ")[1]}`}
                    size={20}
                  />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900">{kpi.value}</p>
              <p className="text-sm text-slate-500 mt-0.5">{kpi.label}</p>
              {kpi.subtitle && (
                <p className="text-xs text-slate-400 mt-0.5">{kpi.subtitle}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* ── AR Aging Horizontal Bar Chart ────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <h2 className="text-base font-semibold text-slate-900 mb-5">
          AR Aging Breakdown
        </h2>

        {buckets.length === 0 ? (
          <div className="py-12 text-center">
            <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No aging data available</p>
          </div>
        ) : (
          <div className="space-y-4">
            {BUCKET_ORDER.map((range) => {
              const bucket = buckets.find((b) => b.range === range);
              const amount = bucket?.amount ?? 0;
              const count = bucket?.count ?? 0;
              const meta = BUCKET_META[range];
              const pct =
                maxBucketAmount > 0
                  ? Math.max((amount / maxBucketAmount) * 100, 0)
                  : 0;

              return (
                <div key={range}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block w-3 h-3 rounded-sm ${meta.barColor}`}
                      />
                      <span className="text-sm font-medium text-slate-700">
                        {meta.label}
                      </span>
                      <span className="text-xs text-slate-400">
                        ({count} invoice{count !== 1 ? "s" : ""})
                      </span>
                    </div>
                    <span className={`text-sm font-semibold ${meta.color}`}>
                      {formatCurrency(amount)}
                    </span>
                  </div>
                  <div className="w-full h-8 bg-slate-50 rounded-lg overflow-hidden">
                    <div
                      className={`h-full rounded-lg transition-all duration-500 ${meta.barColor}`}
                      style={{ width: `${pct}%`, minWidth: amount > 0 ? "8px" : "0" }}
                    />
                  </div>
                </div>
              );
            })}

            {/* Total bar */}
            <div className="mt-2 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-900">
                  Total Outstanding
                </span>
                <span className="text-sm font-bold text-slate-900">
                  {formatCurrency(totalOutstanding)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Top Overdue Table ────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <h2 className="text-base font-semibold text-slate-900 mb-4">
          Top Overdue Accounts
        </h2>

        {topOverdue.length === 0 ? (
          <div className="py-12 text-center">
            <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">
              No overdue accounts found
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              All receivables are within acceptable aging limits
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Outstanding
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Days Pending
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Severity
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {topOverdue.map((entry, idx) => {
                  const severity =
                    entry.daysPending > 90
                      ? { label: "Critical", cls: "bg-red-50 text-red-700" }
                      : entry.daysPending > 60
                        ? { label: "High", cls: "bg-orange-50 text-orange-700" }
                        : entry.daysPending > 30
                          ? { label: "Medium", cls: "bg-amber-50 text-amber-700" }
                          : { label: "Low", cls: "bg-emerald-50 text-emerald-700" };

                  return (
                    <tr
                      key={`${entry.name}-${idx}`}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {entry.type === "ORGANIZATION" ? (
                            <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          ) : (
                            <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          )}
                          <span className="font-medium text-slate-900">
                            {entry.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-slate-600 capitalize">
                          {entry.type.toLowerCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-semibold text-slate-900">
                          {formatCurrency(entry.amount)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-slate-700">
                          {entry.daysPending} days
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${severity.cls}`}
                        >
                          {severity.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
