"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Receipt,
  IndianRupee,
  Landmark,
  Calculator,
  Download,
  RefreshCw,
  ChevronDown,
  Inbox,
  FileSpreadsheet,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import api from "@/lib/api";

// ── Types ───────────────────────────────────────────────────────────────────

interface GSTMonthlySummary {
  month: string; // e.g. "2026-01", "2025-12"
  monthLabel: string; // e.g. "Jan 2026"
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

interface GSTData {
  totalCGST: number;
  totalSGST: number;
  totalIGST: number;
  totalGST: number;
  monthlySummary: GSTMonthlySummary[];
}

// ── Mock Data ───────────────────────────────────────────────────────────────
// Realistic mock data for an Indian diagnostic lab.
// Structured to be easily replaced with an API call later.

function generateMockGSTData(): GSTData {
  const months: GSTMonthlySummary[] = [
    {
      month: "2026-03",
      monthLabel: "Mar 2026",
      taxableAmount: 485000,
      cgst: 21825,
      sgst: 21825,
      igst: 4850,
      total: 48500,
    },
    {
      month: "2026-02",
      monthLabel: "Feb 2026",
      taxableAmount: 512000,
      cgst: 23040,
      sgst: 23040,
      igst: 5120,
      total: 51200,
    },
    {
      month: "2026-01",
      monthLabel: "Jan 2026",
      taxableAmount: 468000,
      cgst: 21060,
      sgst: 21060,
      igst: 4680,
      total: 46800,
    },
    {
      month: "2025-12",
      monthLabel: "Dec 2025",
      taxableAmount: 498000,
      cgst: 22410,
      sgst: 22410,
      igst: 4980,
      total: 49800,
    },
    {
      month: "2025-11",
      monthLabel: "Nov 2025",
      taxableAmount: 445000,
      cgst: 20025,
      sgst: 20025,
      igst: 4450,
      total: 44500,
    },
    {
      month: "2025-10",
      monthLabel: "Oct 2025",
      taxableAmount: 476000,
      cgst: 21420,
      sgst: 21420,
      igst: 4760,
      total: 47600,
    },
    {
      month: "2025-09",
      monthLabel: "Sep 2025",
      taxableAmount: 432000,
      cgst: 19440,
      sgst: 19440,
      igst: 4320,
      total: 43200,
    },
    {
      month: "2025-08",
      monthLabel: "Aug 2025",
      taxableAmount: 458000,
      cgst: 20610,
      sgst: 20610,
      igst: 4580,
      total: 45800,
    },
    {
      month: "2025-07",
      monthLabel: "Jul 2025",
      taxableAmount: 421000,
      cgst: 18945,
      sgst: 18945,
      igst: 4210,
      total: 42100,
    },
    {
      month: "2025-06",
      monthLabel: "Jun 2025",
      taxableAmount: 395000,
      cgst: 17775,
      sgst: 17775,
      igst: 3950,
      total: 39500,
    },
    {
      month: "2025-05",
      monthLabel: "May 2025",
      taxableAmount: 410000,
      cgst: 18450,
      sgst: 18450,
      igst: 4100,
      total: 41000,
    },
    {
      month: "2025-04",
      monthLabel: "Apr 2025",
      taxableAmount: 388000,
      cgst: 17460,
      sgst: 17460,
      igst: 3880,
      total: 38800,
    },
  ];

  const totalCGST = months.reduce((s, m) => s + m.cgst, 0);
  const totalSGST = months.reduce((s, m) => s + m.sgst, 0);
  const totalIGST = months.reduce((s, m) => s + m.igst, 0);
  const totalGST = months.reduce((s, m) => s + m.total, 0);

  return { totalCGST, totalSGST, totalIGST, totalGST, monthlySummary: months };
}

// ── Financial Year Helpers ──────────────────────────────────────────────────

function getCurrentFY(): string {
  const now = new Date();
  const year = now.getFullYear();
  // Indian FY: Apr to Mar. If month >= April (3 in 0-indexed), current FY starts this year
  if (now.getMonth() >= 3) {
    return `${year}-${year + 1}`;
  }
  return `${year - 1}-${year}`;
}

function getAvailableFYs(): string[] {
  // Generate last 3 FYs
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return [
    `${year}-${year + 1}`,
    `${year - 1}-${year}`,
    `${year - 2}-${year - 1}`,
  ];
}

// ── Component ───────────────────────────────────────────────────────────────

export default function GSTReportsPage() {
  const [selectedFY, setSelectedFY] = useState(getCurrentFY());
  const availableFYs = useMemo(() => getAvailableFYs(), []);

  // Using mock data for now. When a GST endpoint is available, replace
  // the queryFn body with: const res = await api.get(`/billing/gst?fy=${selectedFY}`);
  // return res.data?.data ?? res.data;
  const {
    data: gstData,
    isLoading,
  } = useQuery<GSTData>({
    queryKey: ["finance", "gst", selectedFY],
    queryFn: async () => {
      // TODO: Replace with actual API call when endpoint is available
      // const res = await api.get(`/billing/gst?fy=${selectedFY}`);
      // return res.data?.data ?? res.data;
      return generateMockGSTData();
    },
  });

  // ── Export Handler ──────────────────────────────────────────────────────
  function handleExport() {
    if (!gstData) return;

    const header = [
      "Month",
      "Taxable Amount",
      "CGST",
      "SGST",
      "IGST",
      "Total GST",
    ];
    const rows = gstData.monthlySummary.map((m) => [
      m.monthLabel,
      m.taxableAmount.toFixed(2),
      m.cgst.toFixed(2),
      m.sgst.toFixed(2),
      m.igst.toFixed(2),
      m.total.toFixed(2),
    ]);
    // Add totals row
    rows.push([
      "TOTAL",
      gstData.monthlySummary.reduce((s, m) => s + m.taxableAmount, 0).toFixed(2),
      gstData.totalCGST.toFixed(2),
      gstData.totalSGST.toFixed(2),
      gstData.totalIGST.toFixed(2),
      gstData.totalGST.toFixed(2),
    ]);

    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `GST_Report_FY_${selectedFY}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // ── Loading State ───────────────────────────────────────────────────────
  if (isLoading || !gstData) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 w-48 bg-slate-100 rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
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
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div className="h-6 w-48 bg-slate-100 rounded animate-pulse mb-4" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-12 bg-slate-50 rounded animate-pulse mb-2"
            />
          ))}
        </div>
      </div>
    );
  }

  const { totalCGST, totalSGST, totalIGST, totalGST, monthlySummary } = gstData;
  const totalTaxable = monthlySummary.reduce((s, m) => s + m.taxableAmount, 0);

  const kpiCards = [
    {
      label: "CGST Collected",
      value: formatCurrency(totalCGST),
      icon: IndianRupee,
      iconColor: "bg-blue-100 text-blue-600",
      subtitle: "Central GST (9%)",
    },
    {
      label: "SGST Collected",
      value: formatCurrency(totalSGST),
      icon: Landmark,
      iconColor: "bg-emerald-100 text-emerald-600",
      subtitle: "State GST (9%)",
    },
    {
      label: "IGST Collected",
      value: formatCurrency(totalIGST),
      icon: Receipt,
      iconColor: "bg-purple-100 text-purple-600",
      subtitle: "Integrated GST (18%)",
    },
    {
      label: "Total GST",
      value: formatCurrency(totalGST),
      icon: Calculator,
      iconColor: "bg-indigo-100 text-indigo-600",
      subtitle: `FY ${selectedFY}`,
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">GST Reports</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Goods and Services Tax collection summary and reports
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* FY Selector */}
          <div className="relative">
            <select
              value={selectedFY}
              onChange={(e) => setSelectedFY(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors cursor-pointer"
            >
              {availableFYs.map((fy) => (
                <option key={fy} value={fy}>
                  FY {fy}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Export Button */}
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export GST Report
          </button>
        </div>
      </div>

      {/* ── KPI Cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

      {/* ── Monthly GST Summary Table ────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-slate-500" />
            <h2 className="text-base font-semibold text-slate-900">
              Monthly GST Summary
            </h2>
          </div>
          <span className="text-xs text-slate-400">
            FY {selectedFY} &middot; {monthlySummary.length} months
          </span>
        </div>

        {monthlySummary.length === 0 ? (
          <div className="py-12 text-center">
            <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">
              No GST data available for this financial year
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Month
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Taxable Amount
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    CGST
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    SGST
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    IGST
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Total GST
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {monthlySummary.map((row) => (
                  <tr
                    key={row.month}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {row.monthLabel}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-700">
                      {formatCurrency(row.taxableAmount)}
                    </td>
                    <td className="py-3 px-4 text-right text-blue-600">
                      {formatCurrency(row.cgst)}
                    </td>
                    <td className="py-3 px-4 text-right text-emerald-600">
                      {formatCurrency(row.sgst)}
                    </td>
                    <td className="py-3 px-4 text-right text-purple-600">
                      {formatCurrency(row.igst)}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-slate-900">
                      {formatCurrency(row.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Totals footer */}
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50/50">
                  <td className="py-3 px-4 font-bold text-slate-900">
                    Total
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-slate-900">
                    {formatCurrency(totalTaxable)}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-blue-700">
                    {formatCurrency(totalCGST)}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-emerald-700">
                    {formatCurrency(totalSGST)}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-purple-700">
                    {formatCurrency(totalIGST)}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-slate-900">
                    {formatCurrency(totalGST)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── Info Banner ──────────────────────────────────────────────────── */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <Receipt className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-800">
            GST data is currently generated from mock data
          </p>
          <p className="text-xs text-amber-600 mt-0.5">
            This page is structured to connect to a live GST computation
            endpoint. The figures shown are illustrative and based on typical
            diagnostic lab volumes at 18% GST (9% CGST + 9% SGST for intra-state,
            18% IGST for inter-state transactions).
          </p>
        </div>
      </div>
    </div>
  );
}
