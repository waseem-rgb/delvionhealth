"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Filter,
  Search,
} from "lucide-react";
import api from "@/lib/api";
import { formatCurrency, cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface Instrument {
  id: string;
  name: string;
  department: string;
}

interface MarginRow {
  testCatalogId: string;
  testCode: string;
  testName: string;
  department: string;
  mrp: number;
  instrumentId: string;
  instrumentName: string;
  reagentCost: number;
  controlCost: number;
  consumableCost: number;
  calibrationCost: number;
  overheadCost: number;
  totalCpt: number;
  marginAmount: number;
  marginPct: number;
}

interface MarginSummary {
  totalTests: number;
  avgMarginPct: number;
  lowMarginCount: number;
  highMarginCount: number;
}

interface MarginDashboardResponse {
  rows: MarginRow[];
  summary: MarginSummary;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getMarginColor(pct: number): string {
  if (pct >= 60) return "text-green-600";
  if (pct >= 30) return "text-amber-600";
  return "text-red-600";
}

function getMarginBadge(pct: number): string {
  if (pct >= 60) return "bg-green-50 text-green-700 border-green-200";
  if (pct >= 30) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-red-50 text-red-700 border-red-200";
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function MarginDashboardPage() {
  const [instrumentId, setInstrumentId] = useState("");
  const [department, setDepartment] = useState("");
  const [marginFilter, setMarginFilter] = useState<"ALL" | "LOW" | "HIGH">("ALL");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Fetch instruments for filter dropdown
  const { data: instrumentsRes } = useQuery({
    queryKey: ["margin-instruments"],
    queryFn: async () => {
      const res = await api.get("/instruments");
      const data = res.data?.data ?? res.data;
      return data as Instrument[];
    },
  });

  const instruments = instrumentsRes ?? [];

  // Build margin dashboard query params
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (instrumentId) params.set("instrumentId", instrumentId);
    if (department) params.set("department", department);
    if (marginFilter === "LOW") {
      params.set("maxMarginPct", "30");
    } else if (marginFilter === "HIGH") {
      params.set("minMarginPct", "60");
    }
    return params.toString();
  }, [instrumentId, department, marginFilter]);

  // Fetch margin dashboard
  const {
    data: dashboardRes,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["margin-dashboard", queryParams],
    queryFn: async () => {
      const res = await api.get(`/cpt/margin-dashboard?${queryParams}`);
      const data = res.data?.data ?? res.data;
      return data as MarginDashboardResponse;
    },
  });

  const rows = dashboardRes?.rows ?? [];
  const summary = dashboardRes?.summary ?? {
    totalTests: 0,
    avgMarginPct: 0,
    lowMarginCount: 0,
    highMarginCount: 0,
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Margin Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            Analyze cost-per-test margins across instruments and departments
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Filters
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Instrument dropdown */}
            <div>
              <label className="block text-xs text-slate-500 mb-1">Instrument</label>
              <select
                value={instrumentId}
                onChange={(e) => setInstrumentId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              >
                <option value="">All Instruments</option>
                {instruments.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Department filter */}
            <div>
              <label className="block text-xs text-slate-500 mb-1">Department</label>
              <input
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Filter by department..."
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              />
            </div>

            {/* Margin filter */}
            <div>
              <label className="block text-xs text-slate-500 mb-1">Margin</label>
              <div className="flex gap-1 bg-slate-100 border border-slate-200 rounded-lg p-1">
                {(["ALL", "LOW", "HIGH"] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setMarginFilter(opt)}
                    className={cn(
                      "flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                      marginFilter === opt
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-900"
                    )}
                  >
                    {opt === "ALL" ? "All" : opt === "LOW" ? "Low (<30%)" : "High (>=60%)"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Error state */}
        {isError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <p className="text-sm text-red-600">
              Failed to load margin dashboard data. Please try again.
            </p>
          </div>
        )}

        {/* Summary cards */}
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="bg-white border border-slate-200 rounded-xl p-5 animate-pulse"
              >
                <div className="h-4 w-1/2 bg-slate-200 rounded mb-3" />
                <div className="h-8 w-2/3 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-cyan-600" />
                <span className="text-xs text-slate-500">Tests with CPT</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{summary.totalTests}</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-cyan-600" />
                <span className="text-xs text-slate-500">Avg Margin %</span>
              </div>
              <p className={cn("text-2xl font-bold", getMarginColor(summary.avgMarginPct))}>
                {(summary.avgMarginPct ?? 0).toFixed(1)}%
              </p>
            </div>

            <div className="bg-white border border-red-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-4 h-4 text-red-400" />
                <span className="text-xs text-slate-500">Low Margin Tests</span>
              </div>
              <p className="text-2xl font-bold text-red-400">{summary.lowMarginCount}</p>
            </div>

            <div className="bg-white border border-green-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <span className="text-xs text-slate-500">High Margin Tests</span>
              </div>
              <p className="text-2xl font-bold text-green-400">{summary.highMarginCount}</p>
            </div>
          </div>
        )}

        {/* Data table */}
        {isLoading ? (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-5 space-y-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-10 bg-slate-200 rounded animate-pulse" />
              ))}
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
            <BarChart3 className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">
              No margin data found. Add CPT entries to see analysis.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Test Code
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Test Name
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Dept
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      MRP
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Instrument
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Total CPT
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Margin
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Margin %
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Alert
                    </th>
                    <th className="w-8" />
                  </tr>
                </thead>
                {rows.map((row) => {
                  const rowKey = `${row.testCatalogId}-${row.instrumentId}`;
                  const isExpanded = expandedRow === rowKey;

                  return (
                    <tbody key={rowKey}>
                      <tr
                        className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                        onClick={() => setExpandedRow(isExpanded ? null : rowKey)}
                      >
                        <td className="px-4 py-3 text-sm font-mono text-slate-700">
                          {row.testCode}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-900 font-medium">
                          {row.testName}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500">{row.department}</td>
                        <td className="px-4 py-3 text-sm text-slate-900 text-right">
                          {formatCurrency(row.mrp)}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {row.instrumentName}
                        </td>
                        <td className="px-4 py-3 text-sm text-cyan-600 text-right font-medium">
                          {formatCurrency(row.totalCpt)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium">
                          <span className={getMarginColor(row.marginPct)}>
                            {formatCurrency(row.marginAmount)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border",
                              getMarginBadge(row.marginPct)
                            )}
                          >
                            {(row.marginPct ?? 0).toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {row.marginPct < 30 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-600 border border-red-200 rounded-full text-xs font-bold">
                              LOW MARGIN
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-3">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          )}
                        </td>
                      </tr>

                      {/* Expanded detail row */}
                      {isExpanded && (
                        <tr className="bg-slate-50">
                          <td colSpan={10} className="px-6 py-4">
                            <div className="grid grid-cols-5 gap-4">
                              {[
                                { label: "Reagent Cost", value: row.reagentCost },
                                { label: "Control Cost", value: row.controlCost },
                                { label: "Consumable Cost", value: row.consumableCost },
                                { label: "Calibration Cost", value: row.calibrationCost },
                                { label: "Overhead Cost", value: row.overheadCost },
                              ].map((cost) => (
                                <div
                                  key={cost.label}
                                  className="bg-white border border-slate-200 rounded-lg px-4 py-3"
                                >
                                  <p className="text-xs text-slate-500 mb-1">{cost.label}</p>
                                  <p className="text-sm font-semibold text-slate-900">
                                    {formatCurrency(cost.value)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  );
                })}
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
