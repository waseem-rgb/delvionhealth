"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  Download,
  FileSpreadsheet,
  Calendar,
  BarChart3,
  Scale,
  Banknote,
  BookOpen,
  ChevronRight,
  Minus,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import api from "@/lib/api";

// ── Types ───────────────────────────────────────────────────────────────────

interface LineItem {
  name: string;
  amount: number;
  items?: LineItem[];
}

interface PLData {
  revenue: LineItem[];
  expenses: LineItem[];
  totalRevenue: number;
  totalExpenses: number;
  grossProfit: number;
  netIncome: number;
}

interface BSData {
  assets: { current: LineItem[]; fixed: LineItem[]; totalCurrent: number; totalFixed: number };
  liabilities: { current: LineItem[]; longTerm: LineItem[]; totalCurrent: number; totalLongTerm: number };
  equity: LineItem[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
}

interface CashFlowData {
  operating: LineItem[];
  investing: LineItem[];
  financing: LineItem[];
  totalOperating: number;
  totalInvesting: number;
  totalFinancing: number;
  netChange: number;
  openingBalance: number;
  closingBalance: number;
}

interface TrialBalanceLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
}

interface TrialBalanceData {
  lines: TrialBalanceLine[];
  totalDebit: number;
  totalCredit: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function unwrap<T>(res: any): T {
  return res.data?.data ?? res.data;
}

function getDefaultFrom(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().split("T")[0];
}

function getDefaultTo(): string {
  return new Date().toISOString().split("T")[0];
}

const TABS = ["P&L", "Balance Sheet", "Cash Flow", "Trial Balance"] as const;
type Tab = (typeof TABS)[number];

const TAB_ICONS: Record<Tab, typeof FileText> = {
  "P&L": BarChart3,
  "Balance Sheet": Scale,
  "Cash Flow": Banknote,
  "Trial Balance": BookOpen,
};

// ── Sub-components ──────────────────────────────────────────────────────────

function SectionRow({
  label,
  amount,
  bold,
  indent,
  highlight,
}: {
  label: string;
  amount: number;
  bold?: boolean;
  indent?: boolean;
  highlight?: "green" | "red" | "none";
}) {
  const textColor =
    highlight === "green"
      ? "text-emerald-400"
      : highlight === "red"
        ? "text-red-400"
        : "text-white";

  return (
    <div
      className={`flex items-center justify-between py-2 px-3 ${
        bold ? "font-semibold" : ""
      } ${indent ? "pl-8" : ""} ${bold ? "border-t border-slate-700" : ""}`}
    >
      <span className={bold ? "text-white" : "text-slate-300"}>{label}</span>
      <span className={`font-mono text-sm ${textColor}`}>
        {formatCurrency(amount)}
      </span>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 py-2 px-3 bg-slate-800/50 rounded-md mt-4 first:mt-0">
      <ChevronRight className="w-4 h-4 text-teal-400" />
      <span className="text-sm font-semibold text-teal-400 uppercase tracking-wider">
        {title}
      </span>
    </div>
  );
}

function SectionDivider() {
  return <div className="border-t border-dashed border-slate-700 my-1" />;
}

function ExportButtons({
  onPdf,
  onExcel,
}: {
  onPdf: () => void;
  onExcel: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onPdf}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition"
      >
        <Download className="w-3.5 h-3.5" />
        Export PDF
      </button>
      <button
        onClick={onExcel}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition"
      >
        <FileSpreadsheet className="w-3.5 h-3.5" />
        Export Excel
      </button>
    </div>
  );
}

function DateRangeFilter({
  from,
  to,
  onFromChange,
  onToChange,
}: {
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400">From</label>
        <input
          type="date"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
          className="px-2.5 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-300 focus:outline-none focus:border-teal-500"
        />
      </div>
      <Minus className="w-3 h-3 text-slate-600" />
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400">To</label>
        <input
          type="date"
          value={to}
          onChange={(e) => onToChange(e.target.value)}
          className="px-2.5 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-300 focus:outline-none focus:border-teal-500"
        />
      </div>
    </div>
  );
}

function AsOfFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-slate-400">As of</label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-2.5 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-300 focus:outline-none focus:border-teal-500"
      />
    </div>
  );
}

// ── Toast helper ────────────────────────────────────────────────────────────

function showToast(message: string) {
  const el = document.createElement("div");
  el.className =
    "fixed bottom-6 right-6 z-50 bg-teal-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg animate-fade-in";
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity 0.3s";
    setTimeout(() => el.remove(), 300);
  }, 2500);
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function FinancialReportsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("P&L");
  const [plFrom, setPlFrom] = useState(getDefaultFrom);
  const [plTo, setPlTo] = useState(getDefaultTo);
  const [bsAsOf, setBsAsOf] = useState(getDefaultTo);
  const [cfFrom, setCfFrom] = useState(getDefaultFrom);
  const [cfTo, setCfTo] = useState(getDefaultTo);

  // ── Queries ─────────────────────────────────────────────────────────────

  const {
    data: plData,
    isLoading: plLoading,
  } = useQuery<PLData>({
    queryKey: ["finance-pl", plFrom, plTo],
    queryFn: async () =>
      unwrap(
        await api.get("/finance/statements/profit-loss", {
          params: { from: plFrom, to: plTo },
        })
      ),
    enabled: activeTab === "P&L",
  });

  const {
    data: bsData,
    isLoading: bsLoading,
  } = useQuery<BSData>({
    queryKey: ["finance-bs", bsAsOf],
    queryFn: async () =>
      unwrap(
        await api.get("/finance/statements/balance-sheet", {
          params: { asOf: bsAsOf },
        })
      ),
    enabled: activeTab === "Balance Sheet",
  });

  const {
    data: cfData,
    isLoading: cfLoading,
  } = useQuery<CashFlowData>({
    queryKey: ["finance-cf", cfFrom, cfTo],
    queryFn: async () =>
      unwrap(
        await api.get("/finance/statements/cash-flow", {
          params: { from: cfFrom, to: cfTo },
        })
      ),
    enabled: activeTab === "Cash Flow",
  });

  const {
    data: tbData,
    isLoading: tbLoading,
  } = useQuery<TrialBalanceData>({
    queryKey: ["finance-tb"],
    queryFn: async () =>
      unwrap(await api.get("/finance/trial-balance")),
    enabled: activeTab === "Trial Balance",
  });

  // ── Export handlers ─────────────────────────────────────────────────────

  const handleExport = (type: string, format: string) => {
    showToast(`Export initiated: ${type} (${format.toUpperCase()})`);
  };

  // ── Statement header ──────────────────────────────────────────────────

  function StatementHeader({ title, subtitle }: { title: string; subtitle: string }) {
    return (
      <div className="text-center py-4 border-b border-slate-800 mb-4">
        <h3 className="text-xl font-bold text-white">DELViON Health</h3>
        <p className="text-sm font-semibold text-teal-400 mt-1">{title}</p>
        <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
      </div>
    );
  }

  // ── Loading placeholder ───────────────────────────────────────────────

  function StatementSkeleton() {
    return (
      <div className="space-y-3 animate-pulse">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="flex justify-between px-3">
            <div className="h-4 bg-slate-800 rounded w-48" />
            <div className="h-4 bg-slate-800 rounded w-24" />
          </div>
        ))}
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 bg-slate-950 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-teal-400" />
            Financial Reports
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Statements, analysis and exports
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
        {TABS.map((tab) => {
          const TabIcon = TAB_ICONS[tab];
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md transition ${
                activeTab === tab
                  ? "bg-teal-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <TabIcon className="w-4 h-4" />
              {tab}
            </button>
          );
        })}
      </div>

      {/* ── P&L Tab ──────────────────────────────────────────────────────── */}
      {activeTab === "P&L" && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between p-5 border-b border-slate-800">
            <DateRangeFilter
              from={plFrom}
              to={plTo}
              onFromChange={setPlFrom}
              onToChange={setPlTo}
            />
            <ExportButtons
              onPdf={() => handleExport("profit-loss", "pdf")}
              onExcel={() => handleExport("profit-loss", "excel")}
            />
          </div>

          <div className="p-5">
            <StatementHeader
              title="Profit & Loss Statement"
              subtitle={`${formatDate(plFrom)} to ${formatDate(plTo)}`}
            />

            {plLoading ? (
              <StatementSkeleton />
            ) : plData ? (
              <div className="space-y-1">
                {/* Revenue */}
                <SectionHeader title="Revenue" />
                {(plData.revenue ?? []).map((item) => (
                  <SectionRow
                    key={item.name}
                    label={item.name}
                    amount={item.amount}
                    indent
                  />
                ))}
                <SectionRow
                  label="Total Revenue"
                  amount={plData.totalRevenue ?? 0}
                  bold
                />

                {/* Expenses */}
                <SectionHeader title="Expenses" />
                {(plData.expenses ?? []).map((item) => (
                  <SectionRow
                    key={item.name}
                    label={item.name}
                    amount={item.amount}
                    indent
                  />
                ))}
                <SectionRow
                  label="Total Expenses"
                  amount={plData.totalExpenses ?? 0}
                  bold
                />

                <SectionDivider />

                {/* Gross Profit */}
                <SectionRow
                  label="Gross Profit"
                  amount={plData.grossProfit ?? (plData.totalRevenue ?? 0) - (plData.totalExpenses ?? 0)}
                  bold
                  highlight={
                    (plData.grossProfit ?? (plData.totalRevenue ?? 0) - (plData.totalExpenses ?? 0)) >= 0
                      ? "green"
                      : "red"
                  }
                />

                {/* Net Income */}
                <div className="mt-2 bg-slate-800/50 rounded-lg">
                  <SectionRow
                    label="Net Income"
                    amount={plData.netIncome ?? 0}
                    bold
                    highlight={
                      (plData.netIncome ?? 0) >= 0 ? "green" : "red"
                    }
                  />
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500">
                No data available for the selected period
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Balance Sheet Tab ────────────────────────────────────────────── */}
      {activeTab === "Balance Sheet" && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between p-5 border-b border-slate-800">
            <AsOfFilter value={bsAsOf} onChange={setBsAsOf} />
            <ExportButtons
              onPdf={() => handleExport("balance-sheet", "pdf")}
              onExcel={() => handleExport("balance-sheet", "excel")}
            />
          </div>

          <div className="p-5">
            <StatementHeader
              title="Balance Sheet"
              subtitle={`As of ${formatDate(bsAsOf)}`}
            />

            {bsLoading ? (
              <StatementSkeleton />
            ) : bsData ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Assets */}
                <div className="space-y-1">
                  <SectionHeader title="Assets" />

                  <div className="pl-2 mt-2">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider px-3 py-1">
                      Current Assets
                    </p>
                    {(bsData.assets?.current ?? []).map((item) => (
                      <SectionRow
                        key={item.name}
                        label={item.name}
                        amount={item.amount}
                        indent
                      />
                    ))}
                    <SectionRow
                      label="Total Current Assets"
                      amount={bsData.assets?.totalCurrent ?? 0}
                      bold
                    />
                  </div>

                  <div className="pl-2 mt-2">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider px-3 py-1">
                      Fixed Assets
                    </p>
                    {(bsData.assets?.fixed ?? []).map((item) => (
                      <SectionRow
                        key={item.name}
                        label={item.name}
                        amount={item.amount}
                        indent
                      />
                    ))}
                    <SectionRow
                      label="Total Fixed Assets"
                      amount={bsData.assets?.totalFixed ?? 0}
                      bold
                    />
                  </div>

                  <div className="mt-3 bg-teal-900/20 border border-teal-800/30 rounded-lg">
                    <SectionRow
                      label="Total Assets"
                      amount={bsData.totalAssets ?? 0}
                      bold
                      highlight="green"
                    />
                  </div>
                </div>

                {/* Right: Liabilities + Equity */}
                <div className="space-y-1">
                  <SectionHeader title="Liabilities" />

                  <div className="pl-2 mt-2">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider px-3 py-1">
                      Current Liabilities
                    </p>
                    {(bsData.liabilities?.current ?? []).map((item) => (
                      <SectionRow
                        key={item.name}
                        label={item.name}
                        amount={item.amount}
                        indent
                      />
                    ))}
                    <SectionRow
                      label="Total Current Liabilities"
                      amount={bsData.liabilities?.totalCurrent ?? 0}
                      bold
                    />
                  </div>

                  <div className="pl-2 mt-2">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider px-3 py-1">
                      Long-term Liabilities
                    </p>
                    {(bsData.liabilities?.longTerm ?? []).map((item) => (
                      <SectionRow
                        key={item.name}
                        label={item.name}
                        amount={item.amount}
                        indent
                      />
                    ))}
                    <SectionRow
                      label="Total Long-term Liabilities"
                      amount={bsData.liabilities?.totalLongTerm ?? 0}
                      bold
                    />
                  </div>

                  <SectionHeader title="Equity" />
                  {(bsData.equity ?? []).map((item) => (
                    <SectionRow
                      key={item.name}
                      label={item.name}
                      amount={item.amount}
                      indent
                    />
                  ))}
                  <SectionRow
                    label="Total Equity"
                    amount={bsData.totalEquity ?? 0}
                    bold
                  />

                  <div className="mt-3 bg-teal-900/20 border border-teal-800/30 rounded-lg">
                    <SectionRow
                      label="Total Liabilities + Equity"
                      amount={(bsData.totalLiabilities ?? 0) + (bsData.totalEquity ?? 0)}
                      bold
                      highlight="green"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500">
                No data available
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Cash Flow Tab ────────────────────────────────────────────────── */}
      {activeTab === "Cash Flow" && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between p-5 border-b border-slate-800">
            <DateRangeFilter
              from={cfFrom}
              to={cfTo}
              onFromChange={setCfFrom}
              onToChange={setCfTo}
            />
            <ExportButtons
              onPdf={() => handleExport("cash-flow", "pdf")}
              onExcel={() => handleExport("cash-flow", "excel")}
            />
          </div>

          <div className="p-5">
            <StatementHeader
              title="Cash Flow Statement"
              subtitle={`${formatDate(cfFrom)} to ${formatDate(cfTo)}`}
            />

            {cfLoading ? (
              <StatementSkeleton />
            ) : cfData ? (
              <div className="space-y-1">
                {/* Operating */}
                <SectionHeader title="Operating Activities" />
                {(cfData.operating ?? []).map((item) => (
                  <SectionRow
                    key={item.name}
                    label={item.name}
                    amount={item.amount}
                    indent
                  />
                ))}
                <SectionRow
                  label="Net Cash from Operations"
                  amount={cfData.totalOperating ?? 0}
                  bold
                  highlight={
                    (cfData.totalOperating ?? 0) >= 0 ? "green" : "red"
                  }
                />

                {/* Investing */}
                <SectionHeader title="Investing Activities" />
                {(cfData.investing ?? []).map((item) => (
                  <SectionRow
                    key={item.name}
                    label={item.name}
                    amount={item.amount}
                    indent
                  />
                ))}
                <SectionRow
                  label="Net Cash from Investing"
                  amount={cfData.totalInvesting ?? 0}
                  bold
                  highlight={
                    (cfData.totalInvesting ?? 0) >= 0 ? "green" : "red"
                  }
                />

                {/* Financing */}
                <SectionHeader title="Financing Activities" />
                {(cfData.financing ?? []).map((item) => (
                  <SectionRow
                    key={item.name}
                    label={item.name}
                    amount={item.amount}
                    indent
                  />
                ))}
                <SectionRow
                  label="Net Cash from Financing"
                  amount={cfData.totalFinancing ?? 0}
                  bold
                  highlight={
                    (cfData.totalFinancing ?? 0) >= 0 ? "green" : "red"
                  }
                />

                <SectionDivider />

                {/* Summary */}
                <div className="mt-3 space-y-1 bg-slate-800/40 rounded-lg p-2">
                  <SectionRow
                    label="Net Change in Cash"
                    amount={cfData.netChange ?? 0}
                    bold
                    highlight={
                      (cfData.netChange ?? 0) >= 0 ? "green" : "red"
                    }
                  />
                  <SectionRow
                    label="Opening Balance"
                    amount={cfData.openingBalance ?? 0}
                  />
                  <div className="bg-teal-900/20 border border-teal-800/30 rounded-lg mt-1">
                    <SectionRow
                      label="Closing Balance"
                      amount={cfData.closingBalance ?? 0}
                      bold
                      highlight="green"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500">
                No data available for the selected period
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Trial Balance Tab ────────────────────────────────────────────── */}
      {activeTab === "Trial Balance" && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between p-5 border-b border-slate-800">
            <div className="text-sm text-slate-400 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              As of current date
            </div>
            <ExportButtons
              onPdf={() => handleExport("trial-balance", "pdf")}
              onExcel={() => handleExport("trial-balance", "excel")}
            />
          </div>

          <div className="p-5">
            <StatementHeader
              title="Trial Balance"
              subtitle={`As of ${formatDate(new Date().toISOString())}`}
            />

            {tbLoading ? (
              <StatementSkeleton />
            ) : tbData ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Account Code
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Account Name
                      </th>
                      <th className="text-right py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Debit
                      </th>
                      <th className="text-right py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Credit
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {(tbData.lines ?? []).map((line) => (
                      <tr
                        key={line.accountId}
                        className="hover:bg-slate-800/40 transition"
                      >
                        <td className="py-2.5 px-4 font-mono text-xs text-teal-400">
                          {line.accountCode}
                        </td>
                        <td className="py-2.5 px-4 text-slate-300">
                          {line.accountName}
                        </td>
                        <td className="py-2.5 px-4 text-right text-white font-mono">
                          {line.debit > 0 ? formatCurrency(line.debit) : ""}
                        </td>
                        <td className="py-2.5 px-4 text-right text-white font-mono">
                          {line.credit > 0 ? formatCurrency(line.credit) : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-teal-600/50 bg-slate-800/50">
                      <td
                        colSpan={2}
                        className="py-3 px-4 text-sm font-bold text-white"
                      >
                        Totals
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-400 font-mono">
                        {formatCurrency(tbData.totalDebit ?? 0)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-400 font-mono">
                        {formatCurrency(tbData.totalCredit ?? 0)}
                      </td>
                    </tr>
                    {tbData.totalDebit !== undefined &&
                      tbData.totalCredit !== undefined &&
                      Math.abs((tbData.totalDebit ?? 0) - (tbData.totalCredit ?? 0)) > 0.01 && (
                        <tr className="bg-red-900/20">
                          <td
                            colSpan={2}
                            className="py-2 px-4 text-xs font-medium text-red-400"
                          >
                            Difference (out of balance)
                          </td>
                          <td
                            colSpan={2}
                            className="py-2 px-4 text-right text-xs font-bold text-red-400 font-mono"
                          >
                            {formatCurrency(
                              Math.abs(
                                (tbData.totalDebit ?? 0) - (tbData.totalCredit ?? 0)
                              )
                            )}
                          </td>
                        </tr>
                      )}
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500">
                No trial balance data available
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
