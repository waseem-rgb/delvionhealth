"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  Filter,
  RefreshCw,
  Tag,
  X,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

const fmt = (v: number) => `₹${new Intl.NumberFormat("en-IN").format(Math.abs(v))}`;

interface BankAccount {
  id: string;
  name: string;
  bankName: string;
  accountNumber: string;
}

interface Transaction {
  id: string;
  txnDate: string;
  narration: string;
  debitAmount: number | null;
  creditAmount: number | null;
  balance: number | null;
  category: string | null;
  subCategory: string | null;
  matchType: string;
  isReconciled: boolean;
  isDuplicate: boolean;
  isPosted: boolean;
  chqRefNo: string | null;
  bankAccount?: { name: string; bankName: string };
}

interface TransactionsResponse {
  data: Transaction[];
  total: number;
  page: number;
  pages: number;
}

const MATCH_TYPE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  MATCHED: { bg: "bg-green-100", text: "text-green-700", label: "Matched" },
  AI_MATCHED: { bg: "bg-teal-100", text: "text-teal-700", label: "AI Matched" },
  PARTIAL: { bg: "bg-yellow-100", text: "text-yellow-700", label: "Partial" },
  UNMATCHED: { bg: "bg-red-100", text: "text-red-700", label: "Unmatched" },
  EXCLUDED: { bg: "bg-slate-100", text: "text-slate-500", label: "Excluded" },
  DUPLICATE: { bg: "bg-orange-100", text: "text-orange-700", label: "Duplicate" },
};

const CATEGORIES = [
  "Salary/Payroll",
  "Rent",
  "Utilities",
  "Reagent/Lab Supply",
  "Consumables",
  "Patient Payment",
  "Insurance Settlement",
  "Equipment",
  "Bank Charges",
  "Internet/Telecom",
  "Loan EMI",
  "TDS Deposit",
  "PF Deposit",
  "ESIC Deposit",
  "Marketing",
  "Other",
];

export default function TransactionsPage() {
  const queryClient = useQueryClient();
  const [bankAccountId, setBankAccountId] = useState("");
  const [matchType, setMatchType] = useState("");
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [categorizingId, setCategorizingId] = useState<string | null>(null);
  const [categoryValue, setCategoryValue] = useState("");

  const { data: banks = [] } = useQuery({
    queryKey: ["finance", "bank-accounts"],
    queryFn: async () => {
      const res = await api.get("/finance/bank-accounts");
      const raw = res.data?.data ?? res.data;
      return (Array.isArray(raw) ? raw : raw?.accounts ?? []) as BankAccount[];
    },
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["finance", "transactions", { bankAccountId, matchType, month, search, page }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (bankAccountId) params.set("bankAccountId", bankAccountId);
      if (matchType) params.set("matchType", matchType);
      if (month) params.set("month", month);
      if (search) params.set("search", search);
      params.set("page", String(page));
      params.set("limit", "50");
      const res = await api.get(`/finance/transactions?${params}`);
      return (res.data?.data ?? res.data) as TransactionsResponse;
    },
  });

  const categorizeMutation = useMutation({
    mutationFn: async ({ id, category }: { id: string; category: string }) => {
      await api.patch(`/finance/transactions/${id}/categorize`, { category });
    },
    onSuccess: () => {
      toast.success("Transaction categorized");
      queryClient.invalidateQueries({ queryKey: ["finance", "transactions"] });
      setCategorizingId(null);
      setCategoryValue("");
    },
    onError: () => toast.error("Failed to categorize transaction"),
  });

  const markDuplicateMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/finance/transactions/${id}/mark-duplicate`);
    },
    onSuccess: () => {
      toast.success("Marked as duplicate");
      queryClient.invalidateQueries({ queryKey: ["finance", "transactions"] });
    },
  });

  const txns = Array.isArray(data) ? data : (data?.data ?? []);
  const total = typeof data === "object" && !Array.isArray(data) ? (data?.total ?? txns.length) : txns.length;
  const pages = typeof data === "object" && !Array.isArray(data) ? (data?.pages ?? 1) : 1;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Transactions</h1>
          <p className="text-slate-500">Review, categorize and reconcile bank transactions</p>
        </div>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ["finance", "transactions"] })}
          disabled={isFetching}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap gap-3">
          {/* Bank selector */}
          <select
            value={bankAccountId}
            onChange={(e) => { setBankAccountId(e.target.value); setPage(1); }}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none"
          >
            <option value="">All Accounts</option>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.bankName} — {b.name}
              </option>
            ))}
          </select>

          {/* Month picker */}
          <input
            type="month"
            value={month}
            onChange={(e) => { setMonth(e.target.value); setPage(1); }}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none"
          />

          {/* Match type */}
          <select
            value={matchType}
            onChange={(e) => { setMatchType(e.target.value); setPage(1); }}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none"
          >
            <option value="">All Status</option>
            <option value="UNMATCHED">Unmatched</option>
            <option value="AI_MATCHED">AI Matched</option>
            <option value="MATCHED">Matched</option>
            <option value="DUPLICATE">Duplicate</option>
            <option value="EXCLUDED">Excluded</option>
          </select>

          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search narration..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Summary badge */}
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
            <Filter className="h-3.5 w-3.5" />
            <span>{total} transactions</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
            <span className="ml-2 text-slate-500">Loading transactions...</span>
          </div>
        ) : txns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <AlertCircle className="h-10 w-10 text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">No transactions found</p>
            <p className="text-sm text-slate-400">Upload a bank statement to see transactions here</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Narration</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Debit</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Credit</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Balance</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Category</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {txns.map((txn) => {
                const matchStyle = MATCH_TYPE_COLORS[txn.matchType] ?? MATCH_TYPE_COLORS.UNMATCHED;
                const isCat = categorizingId === txn.id;
                return (
                  <tr
                    key={txn.id}
                    className={`transition-colors hover:bg-slate-50 ${
                      txn.isDuplicate ? "bg-orange-50/30" : ""
                    }`}
                  >
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                      {new Date(txn.txnDate).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-sm text-slate-900 truncate" title={txn.narration}>
                        {txn.narration}
                      </p>
                      {txn.chqRefNo && (
                        <p className="text-xs text-slate-400">Ref: {txn.chqRefNo}</p>
                      )}
                      {txn.isDuplicate && (
                        <span className="inline-flex items-center gap-1 text-xs text-orange-600 font-medium">
                          <AlertCircle className="h-3 w-3" /> Duplicate
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {txn.debitAmount && Number(txn.debitAmount) > 0 ? (
                        <span className="flex items-center justify-end gap-1 text-sm font-medium text-red-600">
                          <ArrowUpRight className="h-3 w-3" />
                          {fmt(Number(txn.debitAmount))}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {txn.creditAmount && Number(txn.creditAmount) > 0 ? (
                        <span className="flex items-center justify-end gap-1 text-sm font-medium text-green-600">
                          <ArrowDownLeft className="h-3 w-3" />
                          {fmt(Number(txn.creditAmount))}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-slate-600">
                      {txn.balance != null ? fmt(Number(txn.balance)) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {isCat ? (
                        <div className="flex items-center gap-1.5">
                          <select
                            value={categoryValue}
                            onChange={(e) => setCategoryValue(e.target.value)}
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none"
                            autoFocus
                          >
                            <option value="">Select category...</option>
                            {CATEGORIES.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => categorizeMutation.mutate({ id: txn.id, category: categoryValue })}
                            disabled={!categoryValue || categorizeMutation.isPending}
                            className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setCategorizingId(null)}
                            className="rounded p-1 text-slate-400 hover:text-slate-600"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-600">{txn.category ?? "—"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${matchStyle.bg} ${matchStyle.text}`}>
                        {txn.isPosted && <CheckCircle2 className="h-3 w-3" />}
                        {matchStyle.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {txn.matchType === "UNMATCHED" && !txn.isDuplicate && (
                          <button
                            onClick={() => {
                              setCategorizingId(txn.id);
                              setCategoryValue(txn.category ?? "");
                            }}
                            className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100"
                          >
                            <Tag className="h-3 w-3" />
                            Categorize
                          </button>
                        )}
                        {!txn.isDuplicate && txn.matchType === "UNMATCHED" && (
                          <button
                            onClick={() => markDuplicateMutation.mutate(txn.id)}
                            className="rounded bg-orange-50 px-2 py-1 text-xs font-medium text-orange-600 hover:bg-orange-100"
                          >
                            Duplicate
                          </button>
                        )}
                        {txn.isReconciled && (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Reconciled
                          </span>
                        )}
                        {txn.matchType === "AI_MATCHED" && (
                          <span className="text-xs text-slate-400">
                            <Clock className="inline h-3 w-3 mr-0.5" />
                            Pending
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <span>Page {page} of {pages} — {total} total transactions</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page >= pages}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
