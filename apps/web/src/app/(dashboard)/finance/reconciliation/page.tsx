"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Landmark,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Zap,
  ArrowRightLeft,
  Scale,
  AlertCircle,
  ChevronDown,
  Link2,
  Unlink2,
  PlusCircle,
  Percent,
  Calendar,
  Hash,
  DollarSign,
  ArrowRight,
  Check,
  X,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import api from "@/lib/api";

// ── Types ───────────────────────────────────────────────────────────────────

interface BankAccount {
  id: string;
  name: string;
  accountNumber: string;
  bankName: string;
  balance: number;
}

interface ReconciliationSummary {
  bankBalance: number;
  bookBalance: number;
  difference: number;
  matchedCount: number;
  unmatchedCount: number;
  suggestedCount: number;
}

interface MatchedPair {
  id: string;
  statementId: string;
  statementDate: string;
  statementDescription: string;
  statementAmount: number;
  journalEntryId: string;
  journalReference: string;
  journalDescription: string;
  journalAmount: number;
  matchedAt: string;
}

interface SuggestedMatch {
  id: string;
  statementId: string;
  statementDate: string;
  statementDescription: string;
  statementAmount: number;
  journalEntryId: string;
  journalReference: string;
  journalDescription: string;
  journalAmount: number;
  confidence: number;
  reason: string;
}

interface StatementLine {
  id: string;
  date: string;
  description: string;
  reference: string;
  amount: number;
  type: "DEBIT" | "CREDIT";
  status: "MATCHED" | "UNMATCHED" | "SUGGESTED";
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function unwrap<T>(res: any): T {
  return res.data?.data ?? res.data;
}

function showToast(message: string, type: "success" | "error" = "success") {
  const el = document.createElement("div");
  el.className = `fixed bottom-6 right-6 z-50 ${
    type === "success" ? "bg-teal-600" : "bg-red-600"
  } text-slate-900 px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity 0.3s";
    setTimeout(() => el.remove(), 300);
  }, 2500);
}

const SUB_TABS = ["Matched", "Suggested", "Unmatched"] as const;
type SubTab = (typeof SUB_TABS)[number];

function ConfidenceBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 90
      ? "bg-emerald-100 text-emerald-700 border-emerald-700/50"
      : pct >= 70
        ? "bg-yellow-100 text-yellow-700 border-yellow-700/50"
        : "bg-red-100 text-red-700 border-red-700/50";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${color}`}
    >
      <Percent className="w-2.5 h-2.5" />
      {pct}%
    </span>
  );
}

// ── Component ───────────────────────────────────────────────────────────────

export default function BankReconciliationPage() {
  const queryClient = useQueryClient();
  const [selectedBankId, setSelectedBankId] = useState<string>("");
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("Suggested");

  // ── Queries ─────────────────────────────────────────────────────────────

  const { data: bankAccounts, isLoading: banksLoading } = useQuery<BankAccount[]>({
    queryKey: ["finance-bank-accounts"],
    queryFn: async () => {
      const result = unwrap<BankAccount[] | { accounts: BankAccount[] }>(
        await api.get("/finance/bank-accounts")
      );
      return Array.isArray(result) ? result : (result as any)?.accounts ?? [];
    },
  });

  const accounts = bankAccounts ?? [];

  // Auto-select first bank account
  const activeBankId = selectedBankId || (accounts.length > 0 ? accounts[0].id : "");

  const { data: summary, isLoading: summaryLoading } = useQuery<ReconciliationSummary>({
    queryKey: ["finance-recon-summary", activeBankId],
    queryFn: async () =>
      unwrap(
        await api.get("/finance/reconciliation/summary", {
          params: { bankAccountId: activeBankId },
        })
      ),
    enabled: !!activeBankId,
  });

  const { data: suggestedRaw } = useQuery<SuggestedMatch[]>({
    queryKey: ["finance-recon-suggested", activeBankId],
    queryFn: async () => {
      const result = unwrap<SuggestedMatch[] | { matches: SuggestedMatch[] }>(
        await api.get("/finance/reconciliation/suggested", {
          params: { bankAccountId: activeBankId },
        })
      );
      return Array.isArray(result) ? result : (result as any)?.matches ?? [];
    },
    enabled: !!activeBankId,
  });

  const { data: statementsRaw } = useQuery<StatementLine[]>({
    queryKey: ["finance-recon-statements", activeBankId],
    queryFn: async () => {
      const result = unwrap<StatementLine[] | { lines: StatementLine[] }>(
        await api.get(`/finance/bank-accounts/${activeBankId}/statement`)
      );
      return Array.isArray(result) ? result : (result as any)?.lines ?? [];
    },
    enabled: !!activeBankId,
  });

  const suggested = suggestedRaw ?? [];
  const allStatements = statementsRaw ?? [];
  const matchedStatements = allStatements.filter((s) => s.status === "MATCHED");
  const unmatchedStatements = allStatements.filter((s) => s.status === "UNMATCHED");

  // ── Mutations ───────────────────────────────────────────────────────────

  const autoReconcile = useMutation({
    mutationFn: async () => {
      const res = await api.post("/finance/reconciliation/auto-reconcile", {
        bankAccountId: activeBankId,
      });
      return unwrap(res);
    },
    onSuccess: () => {
      showToast("Auto-reconciliation completed");
      queryClient.invalidateQueries({ queryKey: ["finance-recon-summary", activeBankId] });
      queryClient.invalidateQueries({ queryKey: ["finance-recon-suggested", activeBankId] });
      queryClient.invalidateQueries({ queryKey: ["finance-recon-statements", activeBankId] });
    },
    onError: () => showToast("Auto-reconciliation failed", "error"),
  });

  const acceptMatch = useMutation({
    mutationFn: async ({
      statementId,
      journalEntryId,
    }: {
      statementId: string;
      journalEntryId: string;
    }) => {
      const res = await api.post("/finance/reconciliation/accept-match", {
        statementId,
        journalEntryId,
      });
      return unwrap(res);
    },
    onSuccess: () => {
      showToast("Match accepted");
      queryClient.invalidateQueries({ queryKey: ["finance-recon-summary", activeBankId] });
      queryClient.invalidateQueries({ queryKey: ["finance-recon-suggested", activeBankId] });
      queryClient.invalidateQueries({ queryKey: ["finance-recon-statements", activeBankId] });
    },
    onError: () => showToast("Failed to accept match", "error"),
  });

  const rejectMatch = useMutation({
    mutationFn: async ({ statementId }: { statementId: string }) => {
      const res = await api.post("/finance/reconciliation/reject-match", {
        statementId,
      });
      return unwrap(res);
    },
    onSuccess: () => {
      showToast("Match rejected");
      queryClient.invalidateQueries({ queryKey: ["finance-recon-suggested", activeBankId] });
      queryClient.invalidateQueries({ queryKey: ["finance-recon-statements", activeBankId] });
    },
    onError: () => showToast("Failed to reject match", "error"),
  });

  // ── Summary cards config ──────────────────────────────────────────────

  const summaryCards = summary
    ? [
        {
          label: "Bank Balance",
          value: formatCurrency(summary.bankBalance),
          icon: Landmark,
          color: "text-teal-400",
        },
        {
          label: "Book Balance",
          value: formatCurrency(summary.bookBalance),
          icon: DollarSign,
          color: "text-blue-400",
        },
        {
          label: "Difference",
          value: formatCurrency(Math.abs(summary.difference)),
          icon: Scale,
          color: summary.difference === 0 ? "text-emerald-400" : "text-amber-400",
          highlight: summary.difference === 0,
        },
        {
          label: "Matched",
          value: String(summary.matchedCount),
          icon: Link2,
          color: "text-emerald-400",
        },
        {
          label: "Unmatched",
          value: String(summary.unmatchedCount),
          icon: Unlink2,
          color: summary.unmatchedCount > 0 ? "text-red-400" : "text-slate-500",
        },
      ]
    : [];

  // ── Loading state ─────────────────────────────────────────────────────

  if (banksLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 w-72 bg-slate-100 rounded animate-pulse" />
        <div className="h-12 w-64 bg-white border border-slate-200 rounded-xl animate-pulse" />
        <div className="grid grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-28 bg-white border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ArrowRightLeft className="w-6 h-6 text-teal-400" />
            Bank Reconciliation
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Match bank statements to journal entries
          </p>
        </div>
        <button
          onClick={() => autoReconcile.mutate()}
          disabled={!activeBankId || autoReconcile.isPending}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg- rounded-lg hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {autoReconcile.isPending ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Zap className="w-4 h-4" />
          )}
          Smart Auto-Reconcile
        </button>
      </div>

      {/* Bank Account Selector */}
      <div className="flex items-center gap-4">
        <label className="text-sm text-slate-500 font-medium">Bank Account</label>
        <div className="relative">
          <select
            value={activeBankId}
            onChange={(e) => setSelectedBankId(e.target.value)}
            className="appearance-none px-4 py-2.5 pr-10 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-teal-500 min-w-[320px]"
          >
            {accounts.length === 0 && (
              <option value="">No bank accounts found</option>
            )}
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name} — {acc.bankName ?? ""} ({acc.accountNumber})
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        </div>
      </div>

      {/* Summary Cards */}
      {summaryLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-28 bg-white border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : summaryCards.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className={`bg-white border rounded-xl p-4 ${
                (card as any).highlight
                  ? "border-emerald-700/40 bg-emerald-950/20"
                  : "border-slate-200"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-slate-100">
                  <card.icon className={`w-4 h-4 ${card.color}`} />
                </div>
                <span className="text-xs text-slate-500">{card.label}</span>
              </div>
              <p className="text-xl font-bold text-slate-900">{card.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {/* Sub-tabs */}
      {activeBankId && (
        <>
          <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-1">
            {SUB_TABS.map((tab) => {
              let count = 0;
              if (tab === "Matched") count = matchedStatements.length;
              if (tab === "Suggested") count = suggested.length;
              if (tab === "Unmatched") count = unmatchedStatements.length;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveSubTab(tab)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md transition ${
                    activeSubTab === tab
                      ? "bg-teal-600 text-white"
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  {tab === "Matched" && <Link2 className="w-4 h-4" />}
                  {tab === "Suggested" && <Zap className="w-4 h-4" />}
                  {tab === "Unmatched" && <AlertCircle className="w-4 h-4" />}
                  {tab}
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                      activeSubTab === tab
                        ? "bg-white/20 text-slate-900"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── Matched Tab ────────────────────────────────────────────────── */}
          {activeSubTab === "Matched" && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-200">
                <h3 className="text-sm font-semibold text-slate-900">
                  Matched Pairs ({matchedStatements.length})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Statement lines matched to journal entries
                </p>
              </div>

              {matchedStatements.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                  <Link2 className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-sm">No matched pairs yet</p>
                  <p className="text-xs mt-1">Run auto-reconcile to find matches</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100/60">
                  {matchedStatements.map((stmt) => (
                    <div
                      key={stmt.id}
                      className="flex items-center gap-4 p-4 hover:bg-slate-50 transition"
                    >
                      {/* Statement side */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/50 text-blue-300 font-medium uppercase">
                            Statement
                          </span>
                          <span className="text-xs text-slate-500">
                            {formatDate(stmt.date)}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700 truncate">
                          {stmt.description}
                        </p>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">
                          Ref: {stmt.reference}
                        </p>
                      </div>

                      {/* Amount + match icon */}
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-sm font-semibold font-mono ${
                            stmt.type === "CREDIT"
                              ? "text-emerald-400"
                              : "text-red-400"
                          }`}
                        >
                          {stmt.type === "CREDIT" ? "+" : "-"}
                          {formatCurrency(Math.abs(stmt.amount))}
                        </span>
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Suggested Tab ──────────────────────────────────────────────── */}
          {activeSubTab === "Suggested" && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-200">
                <h3 className="text-sm font-semibold text-slate-900">
                  Suggested Matches ({suggested.length})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  AI-suggested matches with confidence scores — review and accept or reject
                </p>
              </div>

              {suggested.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                  <Zap className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-sm">No suggested matches</p>
                  <p className="text-xs mt-1">
                    Run auto-reconcile to generate suggestions
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100/60">
                  {suggested.map((match) => (
                    <div
                      key={match.id ?? `${match.statementId}-${match.journalEntryId}`}
                      className="p-4 hover:bg-slate-50 transition"
                    >
                      <div className="flex items-start justify-between gap-4">
                        {/* Left: match details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <ConfidenceBadge score={match.confidence} />
                            {match.reason && (
                              <span className="text-[10px] text-slate-500">
                                {match.reason}
                              </span>
                            )}
                          </div>

                          {/* Two-column layout: Statement vs JE */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {/* Statement */}
                            <div className="bg-slate-100/50 rounded-lg p-3 border border-slate-300/50">
                              <p className="text-[10px] font-medium text-blue-400 uppercase tracking-wider mb-1.5">
                                Bank Statement
                              </p>
                              <p className="text-sm text-slate-700 truncate">
                                {match.statementDescription}
                              </p>
                              <div className="flex items-center gap-3 mt-1.5">
                                <span className="text-xs text-slate-500 flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {formatDate(match.statementDate)}
                                </span>
                                <span className="text-sm font-semibold text-slate-900 font-mono">
                                  {formatCurrency(match.statementAmount)}
                                </span>
                              </div>
                            </div>

                            {/* Journal Entry */}
                            <div className="bg-slate-100/50 rounded-lg p-3 border border-slate-300/50">
                              <p className="text-[10px] font-medium text-teal-400 uppercase tracking-wider mb-1.5">
                                Journal Entry
                              </p>
                              <p className="text-sm text-slate-700 truncate">
                                {match.journalDescription}
                              </p>
                              <div className="flex items-center gap-3 mt-1.5">
                                <span className="text-xs text-slate-500 flex items-center gap-1 font-mono">
                                  <Hash className="w-3 h-3" />
                                  {match.journalReference}
                                </span>
                                <span className="text-sm font-semibold text-slate-900 font-mono">
                                  {formatCurrency(match.journalAmount)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Right: action buttons */}
                        <div className="flex flex-col gap-2 flex-shrink-0">
                          <button
                            onClick={() =>
                              acceptMatch.mutate({
                                statementId: match.statementId,
                                journalEntryId: match.journalEntryId,
                              })
                            }
                            disabled={acceptMatch.isPending}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg- rounded-lg hover:bg-emerald-500 disabled:opacity-50 transition"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Accept
                          </button>
                          <button
                            onClick={() =>
                              rejectMatch.mutate({
                                statementId: match.statementId,
                              })
                            }
                            disabled={rejectMatch.isPending}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 disabled:opacity-50 transition"
                          >
                            <X className="w-3.5 h-3.5" />
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Unmatched Tab ──────────────────────────────────────────────── */}
          {activeSubTab === "Unmatched" && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-200">
                <h3 className="text-sm font-semibold text-slate-900">
                  Unmatched Statements ({unmatchedStatements.length})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Statement lines with no matching journal entry
                </p>
              </div>

              {unmatchedStatements.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                  <CheckCircle2 className="w-8 h-8 mb-2 opacity-50 text-emerald-500" />
                  <p className="text-sm text-emerald-400">All statements matched</p>
                  <p className="text-xs mt-1">No unmatched items remaining</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-300">
                        <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Description
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Reference
                        </th>
                        <th className="text-center py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="text-right py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="text-center py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/60">
                      {unmatchedStatements.map((stmt) => (
                        <tr
                          key={stmt.id}
                          className="hover:bg-slate-50 transition"
                        >
                          <td className="py-3 px-4 text-slate-500 text-xs">
                            {formatDate(stmt.date)}
                          </td>
                          <td className="py-3 px-4 text-slate-700 max-w-[250px] truncate">
                            {stmt.description}
                          </td>
                          <td className="py-3 px-4 font-mono text-xs text-teal-400">
                            {stmt.reference || "—"}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium uppercase ${
                                stmt.type === "CREDIT"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {stmt.type}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-900 font-medium">
                            {formatCurrency(Math.abs(stmt.amount))}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() =>
                                showToast("Adjustment creation coming soon")
                              }
                              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-teal-400 bg-teal-900/30 border border-teal-800/50 rounded-lg hover:bg-teal-900/50 transition mx-auto"
                            >
                              <PlusCircle className="w-3 h-3" />
                              Create Adjustment
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Empty state when no bank account */}
      {!activeBankId && !banksLoading && (
        <div className="flex flex-col items-center justify-center py-24 text-slate-500">
          <Landmark className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-lg font-medium text-slate-500">No Bank Accounts</p>
          <p className="text-sm mt-1">Add a bank account to start reconciliation</p>
        </div>
      )}
    </div>
  );
}
