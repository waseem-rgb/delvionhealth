"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Download, ChevronRight } from "lucide-react";
import api from "@/lib/api";

const fmt = (v: number) => new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2 }).format(v);

interface LedgerAccount {
  id: string;
  code: string;
  name: string;
  type: string;
  group: string;
  subGroup: string;
  balance: number;
}

interface LedgerLine {
  id: string;
  date: string;
  entryNumber: string;
  narration: string;
  debit: number;
  credit: number;
  balance: number;
}

interface TrialBalanceLine {
  id: string;
  code: string;
  name: string;
  group: string;
  debit: number;
  credit: number;
}

type TabKey = "ledgers" | "trial-balance";

const GROUPS = ["ASSET", "LIABILITY", "INCOME", "EXPENSE"];

export default function LedgersPage() {
  const [tab, setTab] = useState<TabKey>("ledgers");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));

  // Fetch all accounts
  const { data: accounts = [] } = useQuery({
    queryKey: ["finance", "accounts-list"],
    queryFn: async () => {
      const res = await api.get("/finance/accounts");
      const raw = res.data?.data ?? res.data;
      return (Array.isArray(raw) ? raw : []) as LedgerAccount[];
    },
  });

  // Fetch ledger history for selected account
  const { data: history = [], isLoading: loadingHistory } = useQuery({
    queryKey: ["finance", "ledger-history", selectedId, dateFrom, dateTo],
    queryFn: async () => {
      const res = await api.get(`/finance/ledgers/${selectedId}/history`, {
        params: { from: dateFrom, to: dateTo },
      });
      const raw = res.data?.data ?? res.data;
      return (Array.isArray(raw) ? raw : []) as LedgerLine[];
    },
    enabled: !!selectedId && tab === "ledgers",
  });

  // Fetch trial balance
  const { data: trialBalance = [] } = useQuery({
    queryKey: ["finance", "trial-balance"],
    queryFn: async () => {
      const res = await api.get("/finance/trial-balance");
      const raw = res.data?.data ?? res.data;
      return (Array.isArray(raw) ? raw : []) as TrialBalanceLine[];
    },
    enabled: tab === "trial-balance",
  });

  const groupedAccounts = useMemo(() => {
    const groups: Record<string, LedgerAccount[]> = {};
    for (const g of GROUPS) groups[g] = [];
    for (const a of accounts) {
      const g = (a as any).group ?? a.type;
      if (!groups[g]) groups[g] = [];
      groups[g].push(a);
    }
    return groups;
  }, [accounts]);

  const selectedAccount = accounts.find((a) => a.id === selectedId);

  const tbTotalDebit = trialBalance.reduce((s, r) => s + r.debit, 0);
  const tbTotalCredit = trialBalance.reduce((s, r) => s + r.credit, 0);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ledgers & Trial Balance</h1>
          <p className="text-slate-500">View account ledgers and trial balance</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-lg border border-slate-200 bg-white p-1 w-fit">
        {(["ledgers", "trial-balance"] as TabKey[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === t ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            {t === "ledgers" ? "Ledgers" : "Trial Balance"}
          </button>
        ))}
      </div>

      {tab === "ledgers" && (
        <div className="flex gap-6">
          {/* Sidebar: Account List */}
          <div className="w-72 shrink-0 rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="p-3 border-b border-slate-200">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Chart of Accounts</p>
            </div>
            <div className="overflow-y-auto max-h-[calc(100vh-240px)]">
              {GROUPS.map((group) => (
                <div key={group}>
                  <div className="px-3 py-2 bg-slate-100/50">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{group}</p>
                  </div>
                  {(groupedAccounts[group] ?? []).map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setSelectedId(a.id)}
                      className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-slate-100/70 ${
                        selectedId === a.id ? "bg-blue-600/20 text-blue-400" : "text-slate-700"
                      }`}
                    >
                      <span className="text-xs text-slate-500 font-mono w-10">{a.code}</span>
                      <span className="truncate flex-1">{a.name}</span>
                      <ChevronRight className="h-3 w-3 text-slate-600" />
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Main: Ledger Detail */}
          <div className="flex-1">
            {!selectedId ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-20">
                <BookOpen className="mb-4 h-12 w-12 text-slate-600" />
                <p className="text-lg font-medium text-slate-500">Select an account to view its ledger</p>
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      {selectedAccount?.code} — {selectedAccount?.name}
                    </h2>
                    <p className="text-sm text-slate-500">Balance: {fmt(Number(selectedAccount?.balance ?? 0))}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="rounded border border-slate-300 bg-slate-100 px-2 py-1 text-sm text-slate-900"
                    />
                    <span className="text-slate-500">to</span>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="rounded border border-slate-300 bg-slate-100 px-2 py-1 text-sm text-slate-900"
                    />
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200 bg-white">
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Entry #</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Narration</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Debit</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Credit</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingHistory ? (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Loading...</td></tr>
                      ) : history.length === 0 ? (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No entries found</td></tr>
                      ) : (
                        history.map((line) => (
                          <tr key={line.id} className="border-b border-slate-200/50 bg-white hover:bg-slate-100/50">
                            <td className="px-4 py-2.5 text-sm text-slate-700 whitespace-nowrap">
                              {new Date(line.date).toLocaleDateString("en-IN")}
                            </td>
                            <td className="px-4 py-2.5 text-sm text-blue-400 font-mono">{line.entryNumber}</td>
                            <td className="px-4 py-2.5 text-sm text-slate-900">{line.narration}</td>
                            <td className="px-4 py-2.5 text-sm text-right text-red-400">
                              {line.debit > 0 ? fmt(line.debit) : ""}
                            </td>
                            <td className="px-4 py-2.5 text-sm text-right text-green-400">
                              {line.credit > 0 ? fmt(line.credit) : ""}
                            </td>
                            <td className="px-4 py-2.5 text-sm text-right text-slate-900 font-medium">
                              {fmt(line.balance)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {history.length > 0 && (
                      <tfoot>
                        <tr className="border-t border-slate-300 bg-white">
                          <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-slate-500">Totals</td>
                          <td className="px-4 py-3 text-sm text-right font-bold text-red-400">
                            {fmt(history.reduce((s, l) => s + l.debit, 0))}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-bold text-green-400">
                            {fmt(history.reduce((s, l) => s + l.credit, 0))}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-bold text-slate-900">
                            {fmt(history[history.length - 1]?.balance ?? 0)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Trial Balance Tab */}
      {tab === "trial-balance" && (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-white">
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Account Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Group</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Debit</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Credit</th>
              </tr>
            </thead>
            <tbody>
              {trialBalance.map((row) => (
                <tr key={row.id} className="border-b border-slate-200/50 bg-white hover:bg-slate-100/50">
                  <td className="px-4 py-2.5 text-sm font-mono text-slate-500">{row.code}</td>
                  <td className="px-4 py-2.5 text-sm text-slate-900">{row.name}</td>
                  <td className="px-4 py-2.5 text-sm text-slate-500">{row.group}</td>
                  <td className="px-4 py-2.5 text-sm text-right text-red-400">{row.debit > 0 ? fmt(row.debit) : ""}</td>
                  <td className="px-4 py-2.5 text-sm text-right text-green-400">{row.credit > 0 ? fmt(row.credit) : ""}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-white">
                <td colSpan={3} className="px-4 py-3 text-sm font-bold text-slate-900">Total</td>
                <td className="px-4 py-3 text-sm text-right font-bold text-red-400">{fmt(tbTotalDebit)}</td>
                <td className="px-4 py-3 text-sm text-right font-bold text-green-400">{fmt(tbTotalCredit)}</td>
              </tr>
              <tr className="bg-white">
                <td colSpan={3} className="px-4 py-2 text-sm text-slate-500">Difference</td>
                <td colSpan={2} className={`px-4 py-2 text-sm text-right font-bold ${
                  Math.abs(tbTotalDebit - tbTotalCredit) < 0.01 ? "text-emerald-400" : "text-red-400"
                }`}>
                  {Math.abs(tbTotalDebit - tbTotalCredit) < 0.01 ? "Balanced ✓" : fmt(Math.abs(tbTotalDebit - tbTotalCredit))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
