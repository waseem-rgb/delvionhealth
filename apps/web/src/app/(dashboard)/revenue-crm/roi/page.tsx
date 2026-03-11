"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart2, TrendingUp } from "lucide-react";
import api from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RoiData {
  kpis: {
    campaignRevenue: number;
    leadsConverted: number;
    repeatRevenue: number;
    totalCrmRevenue: number;
  };
  campaigns: Array<{
    name: string;
    type: string;
    revenue: number;
    converted: number;
    reached: number;
  }>;
  leadFunnel: Array<{ status: string; count: number }>;
  repeatSummary: {
    total: number;
    contacted: number;
    converted: number;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) => `₹${new Intl.NumberFormat("en-IN").format(n)}`;
const fmtNum = (n: number) => new Intl.NumberFormat("en-IN").format(n);

const channelColors: Record<string, string> = {
  SMS: "bg-blue-500",
  WHATSAPP: "bg-green-500",
  EMAIL: "bg-orange-500",
  SOCIAL: "bg-purple-500",
};

const channelDot: Record<string, string> = {
  SMS: "bg-blue-400",
  WHATSAPP: "bg-green-400",
  EMAIL: "bg-orange-400",
  SOCIAL: "bg-purple-400",
};

const defaultFunnelStages = ["UPLOADED", "VALID", "CONTACTED", "INTERESTED", "CONVERTED"];

function getDefaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

// ─── Shimmer Loading ──────────────────────────────────────────────────────────

function ShimmerCard() {
  return <div className="h-28 bg-slate-100 rounded-xl animate-pulse" />;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RoiDashboardPage() {
  const defaults = getDefaultDateRange();
  const [fromDate, setFromDate] = useState(defaults.from);
  const [toDate, setToDate] = useState(defaults.to);
  const [appliedFrom, setAppliedFrom] = useState(defaults.from);
  const [appliedTo, setAppliedTo] = useState(defaults.to);

  const { data, isLoading } = useQuery<RoiData>({
    queryKey: ["crm-roi", appliedFrom, appliedTo],
    queryFn: async () => {
      const res = await api.get(
        `/revenue-crm/roi?from=${appliedFrom}&to=${appliedTo}`
      );
      return res.data?.data ?? res.data;
    },
    retry: 1,
    staleTime: 30000,
  });

  const campaigns = data?.campaigns ?? [];
  const kpis = data?.kpis;
  const leadFunnel = data?.leadFunnel ?? [];
  const repeatSummary = data?.repeatSummary;

  const maxRevenue = campaigns.length
    ? Math.max(...campaigns.map((c) => c.revenue), 1)
    : 1;

  // Group campaigns by type for channel breakdown
  const channelRevenue: Record<string, number> = {};
  for (const c of campaigns) {
    const type = c.type?.toUpperCase() ?? "OTHER";
    channelRevenue[type] = (channelRevenue[type] ?? 0) + c.revenue;
  }

  // Build funnel counts keyed by stage name (upper)
  const funnelMap: Record<string, number> = {};
  for (const f of leadFunnel) {
    funnelMap[f.status.toUpperCase()] = f.count;
  }
  const maxFunnel = defaultFunnelStages.reduce(
    (m, s) => Math.max(m, funnelMap[s] ?? 0),
    1
  );

  const repeatConvRate =
    repeatSummary && repeatSummary.total > 0
      ? Math.round((repeatSummary.converted / repeatSummary.total) * 100)
      : 0;

  const hasData =
    !isLoading && (campaigns.length > 0 || (kpis && kpis.totalCrmRevenue > 0));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="text-emerald-400" size={24} />
            Revenue CRM Dashboard
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Campaign ROI, lead funnel and repeat test revenue insights
          </p>
        </div>

        {/* Date Range Picker */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <label className="text-slate-500 text-xs">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-slate-100 border border-slate-300 rounded-lg px-3 py-1.5 text-slate-900 text-sm focus:outline-none focus:border-teal-500"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-slate-500 text-xs">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-slate-100 border border-slate-300 rounded-lg px-3 py-1.5 text-slate-900 text-sm focus:outline-none focus:border-teal-500"
            />
          </div>
          <button
            onClick={() => {
              setAppliedFrom(fromDate);
              setAppliedTo(toDate);
            }}
            className="px-4 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Apply
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          [...Array(4)].map((_, i) => <ShimmerCard key={i} />)
        ) : (
          <>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">
                Campaign Revenue
              </p>
              <p className="text-2xl font-bold text-teal-400">
                {fmt(kpis?.campaignRevenue ?? 0)}
              </p>
              <p className="text-slate-500 text-xs mt-1">—</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">
                Leads Converted
              </p>
              <p className="text-2xl font-bold text-violet-400">
                {fmtNum(kpis?.leadsConverted ?? 0)}
              </p>
              <p className="text-slate-500 text-xs mt-1">—</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">
                Repeat Revenue
              </p>
              <p className="text-2xl font-bold text-emerald-400">
                {fmt(kpis?.repeatRevenue ?? 0)}
              </p>
              <p className="text-slate-500 text-xs mt-1">—</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">
                Total CRM Revenue
              </p>
              <p className="text-2xl font-bold text-orange-400">
                {fmt(kpis?.totalCrmRevenue ?? 0)}
              </p>
              <p className="text-slate-500 text-xs mt-1">—</p>
            </div>
          </>
        )}
      </div>

      {/* Empty State */}
      {!isLoading && !hasData && (
        <div className="bg-white border border-slate-200 rounded-xl p-16 flex flex-col items-center gap-4">
          <BarChart2 size={48} className="text-slate-600" />
          <div className="text-center">
            <p className="text-slate-900 font-medium text-lg">
              No revenue data for this period
            </p>
            <p className="text-slate-500 text-sm mt-1">
              Launch campaigns and convert leads to see ROI tracking
            </p>
          </div>
        </div>
      )}

      {/* Charts Row 1 */}
      {(isLoading || hasData) && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Campaign Performance (60%) */}
          <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h2 className="text-slate-900 font-semibold text-sm">Campaign Performance</h2>
            {isLoading ? (
              <div className="space-y-3 animate-pulse">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-6 bg-slate-100 rounded" />
                ))}
              </div>
            ) : campaigns.length === 0 ? (
              <p className="text-slate-500 text-sm">No campaigns in this period</p>
            ) : (
              <div className="space-y-2">
                {campaigns.map((c, i) => {
                  const barColor =
                    channelColors[c.type?.toUpperCase()] ?? "bg-teal-500";
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="w-32 text-xs text-slate-500 truncate">
                        {c.name.slice(0, 20)}
                      </span>
                      <div className="flex-1 bg-slate-100 rounded h-5 overflow-hidden">
                        <div
                          style={{
                            width: `${(c.revenue / maxRevenue) * 100}%`,
                          }}
                          className={`h-full ${barColor} rounded transition-all`}
                        />
                      </div>
                      <span className="w-24 text-xs text-slate-700 text-right">
                        {fmt(c.revenue)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Channel Breakdown (40%) */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h2 className="text-slate-900 font-semibold text-sm">Channel Performance</h2>
            {isLoading ? (
              <div className="space-y-3 animate-pulse">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-6 bg-slate-100 rounded" />
                ))}
              </div>
            ) : Object.keys(channelRevenue).length === 0 ? (
              <p className="text-slate-500 text-sm">No channel data</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(channelRevenue).map(([ch, rev]) => (
                  <div key={ch} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${channelDot[ch] ?? "bg-slate-400"}`}
                      />
                      <span className="text-slate-700 text-sm">{ch}</span>
                    </div>
                    <span className="text-slate-900 font-medium text-sm">
                      {fmt(rev)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Charts Row 2 */}
      {(isLoading || hasData) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Lead Funnel */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h2 className="text-slate-900 font-semibold text-sm">Lead Funnel</h2>
            {isLoading ? (
              <div className="space-y-3 animate-pulse">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-7 bg-slate-100 rounded" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {defaultFunnelStages.map((stage) => {
                  const count = funnelMap[stage] ?? 0;
                  const pct = maxFunnel > 0 ? (count / maxFunnel) * 100 : 0;
                  return (
                    <div key={stage} className="flex items-center gap-3">
                      <span className="w-24 text-xs text-slate-500 truncate capitalize">
                        {stage.charAt(0) + stage.slice(1).toLowerCase()}
                      </span>
                      <div className="flex-1 bg-slate-100 rounded h-6 overflow-hidden relative">
                        <div
                          style={{ width: `${pct}%` }}
                          className="h-full bg-teal-600/60 rounded transition-all"
                        />
                        <span className="absolute inset-0 flex items-center px-2 text-xs text-slate-900/70">
                          {fmtNum(count)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Repeat Test Summary */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h2 className="text-slate-900 font-semibold text-sm">Repeat Test Summary</h2>
            {isLoading ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-20 bg-slate-100 rounded" />
                <div className="h-6 bg-slate-100 rounded" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-100 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-violet-400">
                      {repeatSummary?.total ?? 0}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Total Identified</p>
                  </div>
                  <div className="bg-slate-100 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-teal-400">
                      {repeatSummary?.contacted ?? 0}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Contacted</p>
                  </div>
                  <div className="bg-slate-100 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-emerald-400">
                      {repeatSummary?.converted ?? 0}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Converted</p>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                    <span>Conversion Rate</span>
                    <span>{repeatConvRate}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${repeatConvRate}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Table */}
      {(isLoading || hasData) && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-slate-900 font-semibold text-sm">Top Campaigns This Period</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  {["Campaign Name", "Type", "Revenue", "Reached", "Converted", "Conv. Rate"].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading
                  ? [...Array(5)].map((_, i) => (
                      <tr key={i}>
                        {[...Array(6)].map((__, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-4 bg-slate-100 rounded animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : campaigns.slice(0, 5).map((c, i) => {
                      const convRate =
                        c.reached > 0
                          ? ((c.converted / c.reached) * 100).toFixed(1)
                          : "0.0";
                      return (
                        <tr key={i} className="hover:bg-slate-100/40 transition-colors">
                          <td className="px-4 py-3 text-slate-900 text-sm font-medium max-w-[200px] truncate">
                            {c.name}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                              {c.type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-emerald-400 text-sm font-medium">
                            {fmt(c.revenue)}
                          </td>
                          <td className="px-4 py-3 text-slate-700 text-sm">
                            {fmtNum(c.reached)}
                          </td>
                          <td className="px-4 py-3 text-teal-400 text-sm">
                            {fmtNum(c.converted)}
                          </td>
                          <td className="px-4 py-3 text-slate-700 text-sm">
                            {convRate}%
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
