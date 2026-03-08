"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
  BookOpen,
  FileText,
  BarChart3,
  Landmark,
  TrendingUp,
  Plus,
  RefreshCw,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  ArrowDownCircle,
  ArrowUpCircle,
} from "lucide-react";
import { DataTable } from "@/components/tables/DataTable";
import { KPICard } from "@/components/shared/KPICard";
import { formatCurrency, formatDate } from "@/lib/utils";
import api from "@/lib/api";

// ── Types ───────────────────────────────────────────────────────────────────

interface LedgerAccount {
  id: string;
  code: string;
  name: string;
  type: string;
  normalBalance: string;
  balance: number;
  level: number;
  parentId: string | null;
}

interface JournalEntry {
  id: string;
  reference: string;
  description: string;
  date: string;
  totalDebit: number;
  status: string;
}

interface NewJournalLine {
  accountId: string;
  description: string;
  debit: string;
  credit: string;
}

interface TrialBalanceLine {
  accountId: string;
  accountName: string;
  normalBalance: string;
  totalDebit: number;
  totalCredit: number;
}

interface PLItem {
  name: string;
  amount: number;
}

interface PLData {
  revenue: PLItem[];
  expenses: PLItem[];
  netIncome: number;
  totalRevenue: number;
  totalExpenses: number;
}

interface BSItem {
  name: string;
  amount: number;
}

interface BalanceSheetData {
  assets: BSItem[];
  liabilities: BSItem[];
  equity: BSItem[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
}

interface BankAccount {
  id: string;
  name: string;
  accountNumber: string;
  balance: number;
}

interface BankStatement {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: string;
}

interface UnmatchedJELine {
  id: string;
  date: string;
  description: string;
  amount: number;
  reference: string;
}

interface CashFlowData {
  operating: number;
  investing: number;
  financing: number;
  netCashFlow: number;
  openingBalance: number;
  closingBalance: number;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonthStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function JEStatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; icon: React.ReactNode }> = {
    DRAFT: { cls: "bg-slate-100 text-slate-600 border-slate-200", icon: <Clock className="w-3 h-3" /> },
    POSTED: { cls: "bg-green-50 text-green-700 border-green-200", icon: <CheckCircle2 className="w-3 h-3" /> },
    REVERSED: { cls: "bg-red-50 text-red-700 border-red-200", icon: <XCircle className="w-3 h-3" /> },
  };
  const s = map[status] ?? map["DRAFT"];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${s.cls}`}>
      {s.icon}
      {status}
    </span>
  );
}

// ── Add Account Modal ────────────────────────────────────────────────────────

function AddAccountModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("ASSET");
  const [parentId, setParentId] = useState("");
  const [error, setError] = useState("");

  const normalBalanceMap: Record<string, string> = {
    ASSET: "DEBIT",
    EXPENSE: "DEBIT",
    LIABILITY: "CREDIT",
    EQUITY: "CREDIT",
    REVENUE: "CREDIT",
  };

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post("/finance/accounts", data),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to create account";
      setError(msg);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Account name is required"); return; }
    mutation.mutate({
      name: name.trim(),
      type,
      normalBalance: normalBalanceMap[type],
      ...(parentId.trim() && { parentId: parentId.trim() }),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Add Ledger Account</h2>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Account Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Cash and Cash Equivalents"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Account Type *</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            >
              {["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Normal Balance (auto)</label>
            <input
              type="text"
              readOnly
              value={normalBalanceMap[type]}
              className="w-full border border-slate-100 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Parent Account ID (optional)</label>
            <input
              type="text"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              placeholder="UUID of parent account"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 px-4 py-2 bg-[#1B4F8A] rounded-lg text-sm font-semibold text-white hover:bg-[#163d6a] disabled:opacity-50"
            >
              {mutation.isPending ? "Creating..." : "Create Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Tab 1 — General Ledger ───────────────────────────────────────────────────

function GeneralLedgerTab() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);

  const { data: accounts, isLoading } = useQuery({
    queryKey: ["finance-accounts"],
    queryFn: async () => {
      const res = await api.get<{ data: LedgerAccount[] }>("/finance/accounts");
      return res.data.data;
    },
  });

  const typeColors: Record<string, string> = {
    ASSET: "text-blue-600",
    LIABILITY: "text-orange-600",
    EQUITY: "text-purple-600",
    REVENUE: "text-green-600",
    EXPENSE: "text-red-600",
  };

  const columns: ColumnDef<LedgerAccount>[] = [
    {
      header: "Account Name",
      cell: ({ row }) => (
        <span
          style={{ paddingLeft: `${row.original.level * 16}px` }}
          className="font-medium text-slate-800 text-sm"
        >
          {row.original.level > 0 && <span className="text-slate-300 mr-1">└</span>}
          {row.original.name}
          {row.original.code && (
            <span className="ml-2 text-xs text-slate-400 font-mono">{row.original.code}</span>
          )}
        </span>
      ),
    },
    {
      header: "Type",
      cell: ({ row }) => (
        <span className={`text-xs font-semibold ${typeColors[row.original.type] ?? "text-slate-600"}`}>
          {row.original.type}
        </span>
      ),
    },
    {
      header: "Normal Balance",
      cell: ({ row }) => (
        <span className="text-xs text-slate-500 uppercase">{row.original.normalBalance}</span>
      ),
    },
    {
      header: "Balance",
      cell: ({ row }) => (
        <span
          className={`font-semibold text-sm ${row.original.balance < 0 ? "text-red-600" : "text-slate-800"}`}
        >
          {formatCurrency(row.original.balance)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Chart of Accounts — all ledger accounts with balances</p>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1B4F8A] text-white rounded-lg text-sm font-semibold hover:bg-[#163d6a]"
        >
          <Plus className="w-4 h-4" />
          Add Account
        </button>
      </div>
      <DataTable
        columns={columns}
        data={accounts ?? []}
        isLoading={isLoading}
        page={1}
        pageSize={100}
      />
      {showAdd && (
        <AddAccountModal
          onClose={() => setShowAdd(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ["finance-accounts"] })}
        />
      )}
    </div>
  );
}

// ── Post Journal Entry Modal ─────────────────────────────────────────────────

function PostJournalEntryModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [lines, setLines] = useState<NewJournalLine[]>([
    { accountId: "", description: "", debit: "", credit: "" },
    { accountId: "", description: "", debit: "", credit: "" },
  ]);
  const [error, setError] = useState("");

  const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.001 && totalDebit > 0;

  function addLine() {
    setLines((prev) => [...prev, { accountId: "", description: "", debit: "", credit: "" }]);
  }

  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateLine(i: number, field: keyof NewJournalLine, value: string) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)));
  }

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post("/finance/journal-entries", data),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to post journal entry";
      setError(msg);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) { setError("Description is required"); return; }
    if (!isBalanced) { setError("Debits must equal credits"); return; }
    const validLines = lines.filter(
      (l) => l.accountId.trim() && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0)
    );
    if (validLines.length < 2) { setError("At least 2 lines required"); return; }
    mutation.mutate({
      description: description.trim(),
      reference: reference.trim() || undefined,
      lines: validLines.map((l) => ({
        accountId: l.accountId.trim(),
        description: l.description.trim(),
        debit: parseFloat(l.debit) || 0,
        credit: parseFloat(l.credit) || 0,
      })),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-y-auto py-8">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 space-y-4 mx-4">
        <h2 className="text-lg font-bold text-slate-900">Post Journal Entry</h2>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Description *</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Reference (optional)</label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
              />
            </div>
          </div>

          {/* Line items header */}
          <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-slate-500 uppercase mb-1 px-1">
            <div className="col-span-4">Account ID</div>
            <div className="col-span-3">Description</div>
            <div className="col-span-2 text-right">Debit</div>
            <div className="col-span-2 text-right">Credit</div>
            <div className="col-span-1" />
          </div>
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <input
                className="col-span-4 border border-slate-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1B4F8A]/30"
                placeholder="Account UUID"
                value={line.accountId}
                onChange={(e) => updateLine(i, "accountId", e.target.value)}
              />
              <input
                className="col-span-3 border border-slate-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1B4F8A]/30"
                placeholder="Note"
                value={line.description}
                onChange={(e) => updateLine(i, "description", e.target.value)}
              />
              <input
                type="number"
                step="0.01"
                min="0"
                className="col-span-2 border border-slate-200 rounded px-2 py-1.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-[#1B4F8A]/30"
                placeholder="0.00"
                value={line.debit}
                onChange={(e) => updateLine(i, "debit", e.target.value)}
              />
              <input
                type="number"
                step="0.01"
                min="0"
                className="col-span-2 border border-slate-200 rounded px-2 py-1.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-[#1B4F8A]/30"
                placeholder="0.00"
                value={line.credit}
                onChange={(e) => updateLine(i, "credit", e.target.value)}
              />
              <button
                type="button"
                onClick={() => removeLine(i)}
                className="col-span-1 text-slate-300 hover:text-red-400 text-sm text-center"
              >
                ✕
              </button>
            </div>
          ))}
          <button type="button" onClick={addLine} className="text-xs text-[#1B4F8A] hover:underline mt-1">
            + Add Line
          </button>

          {/* Totals */}
          <div
            className={`rounded-lg p-3 flex justify-end gap-8 text-sm ${
              isBalanced ? "bg-green-50" : "bg-red-50"
            }`}
          >
            <div className="text-right">
              <p className="text-xs text-slate-500 font-semibold uppercase">Total Debit</p>
              <p className="font-bold text-slate-800">{formatCurrency(totalDebit)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 font-semibold uppercase">Total Credit</p>
              <p className="font-bold text-slate-800">{formatCurrency(totalCredit)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 font-semibold uppercase">Balance</p>
              <p className={`font-bold ${isBalanced ? "text-green-600" : "text-red-600"}`}>
                {isBalanced
                  ? "Balanced"
                  : `Off by ${formatCurrency(Math.abs(totalDebit - totalCredit))}`}
              </p>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || !isBalanced}
              className="flex-1 px-4 py-2 bg-[#1B4F8A] rounded-lg text-sm font-semibold text-white hover:bg-[#163d6a] disabled:opacity-50"
            >
              {mutation.isPending ? "Posting..." : "Post Entry"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Tab 2 — Journal Entries ──────────────────────────────────────────────────

function JournalEntriesTab() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [showPost, setShowPost] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["finance-je", page],
    queryFn: async () => {
      const res = await api.get<{ data: PaginatedResponse<JournalEntry> }>(
        `/finance/journal-entries?page=${page}&limit=20`
      );
      return res.data.data;
    },
  });

  const reverseMutation = useMutation({
    mutationFn: (id: string) => api.post(`/finance/journal-entries/${id}/reverse`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance-je"] }),
  });

  const columns: ColumnDef<JournalEntry>[] = [
    {
      header: "Reference",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-[#1B4F8A] font-semibold">
          {row.original.reference || "—"}
        </span>
      ),
    },
    {
      header: "Description",
      cell: ({ row }) => <span className="text-sm text-slate-700">{row.original.description}</span>,
    },
    {
      header: "Date",
      cell: ({ row }) => <span className="text-sm">{formatDate(row.original.date)}</span>,
    },
    {
      header: "Total Debit",
      cell: ({ row }) => (
        <span className="font-semibold text-sm">{formatCurrency(Number(row.original.totalDebit))}</span>
      ),
    },
    {
      header: "Status",
      cell: ({ row }) => <JEStatusBadge status={row.original.status} />,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) =>
        row.original.status === "POSTED" ? (
          <button
            onClick={() => reverseMutation.mutate(row.original.id)}
            disabled={reverseMutation.isPending}
            className="flex items-center gap-1 text-xs px-2 py-1 border border-slate-200 rounded hover:bg-slate-50 text-slate-600 disabled:opacity-50"
          >
            <RotateCcw className="w-3 h-3" />
            Reverse
          </button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">All general ledger journal entries</p>
        <button
          onClick={() => setShowPost(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1B4F8A] text-white rounded-lg text-sm font-semibold hover:bg-[#163d6a]"
        >
          <Plus className="w-4 h-4" />
          Post Journal Entry
        </button>
      </div>
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        page={page}
        total={data?.meta?.total}
        pageSize={20}
        onPageChange={setPage}
      />
      {showPost && (
        <PostJournalEntryModal
          onClose={() => setShowPost(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ["finance-je"] })}
        />
      )}
    </div>
  );
}

// ── Tab 3 — Reports ──────────────────────────────────────────────────────────

const REPORT_TABS = ["Trial Balance", "P&L", "Balance Sheet"] as const;
type ReportTabType = (typeof REPORT_TABS)[number];

function TrialBalanceReport() {
  const { data, isLoading } = useQuery({
    queryKey: ["finance-trial-balance"],
    queryFn: async () => {
      const res = await api.get<{ data: TrialBalanceLine[] }>("/finance/trial-balance");
      return res.data.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1B4F8A]" />
      </div>
    );
  }

  const totalDebit = (data ?? []).reduce((s, l) => s + l.totalDebit, 0);
  const totalCredit = (data ?? []).reduce((s, l) => s + l.totalCredit, 0);

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            {["Account", "Normal Balance", "Total Debit", "Total Credit"].map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {(data ?? []).map((line) => (
            <tr key={line.accountId} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-800">{line.accountName}</td>
              <td className="px-4 py-3 text-xs text-slate-500 uppercase">{line.normalBalance}</td>
              <td className="px-4 py-3 font-mono text-sm">{formatCurrency(line.totalDebit)}</td>
              <td className="px-4 py-3 font-mono text-sm">{formatCurrency(line.totalCredit)}</td>
            </tr>
          ))}
          <tr className="bg-slate-100 font-bold">
            <td className="px-4 py-3 text-slate-700">Totals</td>
            <td />
            <td className="px-4 py-3 font-mono">{formatCurrency(totalDebit)}</td>
            <td className="px-4 py-3 font-mono">{formatCurrency(totalCredit)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function PLReport() {
  const [from, setFrom] = useState(firstOfMonthStr());
  const [to, setTo] = useState(todayStr());

  const { data, isLoading } = useQuery({
    queryKey: ["finance-pl", from, to],
    queryFn: async () => {
      const res = await api.get<{ data: PLData }>(`/finance/profit-loss?from=${from}&to=${to}`);
      return res.data.data;
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-end">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
          />
        </div>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1B4F8A]" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-green-50 rounded-xl p-4 border border-green-200">
            <h4 className="text-sm font-bold text-green-800 mb-3 uppercase tracking-wide">Revenue</h4>
            {(data?.revenue ?? []).map((r, i) => (
              <div
                key={i}
                className="flex justify-between py-1.5 border-b border-green-100 last:border-0 text-sm"
              >
                <span className="text-slate-700">{r.name}</span>
                <span className="font-semibold text-green-700">{formatCurrency(r.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-2 font-bold text-green-800 text-sm border-t border-green-200 mt-2">
              <span>Total Revenue</span>
              <span>{formatCurrency(data?.totalRevenue ?? 0)}</span>
            </div>
          </div>
          <div className="bg-red-50 rounded-xl p-4 border border-red-200">
            <h4 className="text-sm font-bold text-red-800 mb-3 uppercase tracking-wide">Expenses</h4>
            {(data?.expenses ?? []).map((r, i) => (
              <div
                key={i}
                className="flex justify-between py-1.5 border-b border-red-100 last:border-0 text-sm"
              >
                <span className="text-slate-700">{r.name}</span>
                <span className="font-semibold text-red-700">{formatCurrency(r.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-2 font-bold text-red-800 text-sm border-t border-red-200 mt-2">
              <span>Total Expenses</span>
              <span>{formatCurrency(data?.totalExpenses ?? 0)}</span>
            </div>
          </div>
          <div className="md:col-span-2">
            <div
              className={`rounded-xl p-5 border-2 ${
                (data?.netIncome ?? 0) >= 0
                  ? "bg-green-50 border-green-300"
                  : "bg-red-50 border-red-300"
              }`}
            >
              <p className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Net Income</p>
              <p
                className={`text-3xl font-bold mt-1 ${
                  (data?.netIncome ?? 0) >= 0 ? "text-green-700" : "text-red-700"
                }`}
              >
                {formatCurrency(data?.netIncome ?? 0)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BalanceSheetReport() {
  const { data, isLoading } = useQuery({
    queryKey: ["finance-balance-sheet"],
    queryFn: async () => {
      const res = await api.get<{ data: BalanceSheetData }>("/finance/balance-sheet");
      return res.data.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1B4F8A]" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
        <h4 className="text-sm font-bold text-blue-800 mb-3 uppercase tracking-wide">Assets</h4>
        {(data?.assets ?? []).map((a, i) => (
          <div
            key={i}
            className="flex justify-between py-1.5 border-b border-blue-100 last:border-0 text-sm"
          >
            <span className="text-slate-700">{a.name}</span>
            <span className="font-semibold text-blue-700">{formatCurrency(a.amount)}</span>
          </div>
        ))}
        <div className="flex justify-between pt-2 font-bold text-blue-800 text-sm border-t border-blue-200 mt-2">
          <span>Total Assets</span>
          <span>{formatCurrency(data?.totalAssets ?? 0)}</span>
        </div>
      </div>
      <div className="space-y-4">
        <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
          <h4 className="text-sm font-bold text-orange-800 mb-3 uppercase tracking-wide">Liabilities</h4>
          {(data?.liabilities ?? []).map((l, i) => (
            <div
              key={i}
              className="flex justify-between py-1.5 border-b border-orange-100 last:border-0 text-sm"
            >
              <span className="text-slate-700">{l.name}</span>
              <span className="font-semibold text-orange-700">{formatCurrency(l.amount)}</span>
            </div>
          ))}
          <div className="flex justify-between pt-2 font-bold text-orange-800 text-sm border-t border-orange-200 mt-2">
            <span>Total Liabilities</span>
            <span>{formatCurrency(data?.totalLiabilities ?? 0)}</span>
          </div>
        </div>
        <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
          <h4 className="text-sm font-bold text-purple-800 mb-3 uppercase tracking-wide">Equity</h4>
          {(data?.equity ?? []).map((eq, i) => (
            <div
              key={i}
              className="flex justify-between py-1.5 border-b border-purple-100 last:border-0 text-sm"
            >
              <span className="text-slate-700">{eq.name}</span>
              <span className="font-semibold text-purple-700">{formatCurrency(eq.amount)}</span>
            </div>
          ))}
          <div className="flex justify-between pt-2 font-bold text-purple-800 text-sm border-t border-purple-200 mt-2">
            <span>Total Equity</span>
            <span>{formatCurrency(data?.totalEquity ?? 0)}</span>
          </div>
        </div>
        <div className="bg-slate-100 rounded-xl p-4 border border-slate-300">
          <div className="flex justify-between font-bold text-slate-800">
            <span>Liabilities + Equity</span>
            <span>
              {formatCurrency((data?.totalLiabilities ?? 0) + (data?.totalEquity ?? 0))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportsTab() {
  const [activeReport, setActiveReport] = useState<ReportTabType>("Trial Balance");

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-slate-200">
        {REPORT_TABS.map((r) => (
          <button
            key={r}
            onClick={() => setActiveReport(r)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeReport === r
                ? "border-[#1B4F8A] text-[#1B4F8A]"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {r}
          </button>
        ))}
      </div>
      <div className="pt-2">
        {activeReport === "Trial Balance" && <TrialBalanceReport />}
        {activeReport === "P&L" && <PLReport />}
        {activeReport === "Balance Sheet" && <BalanceSheetReport />}
      </div>
    </div>
  );
}

// ── Tab 4 — Bank Reconciliation ─────────────────────────────────────────────

function BankReconciliationTab() {
  const [selectedBankId, setSelectedBankId] = useState("");

  const { data: bankAccounts } = useQuery({
    queryKey: ["finance-bank-accounts"],
    queryFn: async () => {
      const res = await api.get<{ data: BankAccount[] }>("/finance/bank-accounts");
      return res.data.data;
    },
  });

  const { data: reconData, isLoading: reconLoading, refetch } = useQuery({
    queryKey: ["finance-recon", selectedBankId],
    queryFn: async () => {
      const res = await api.get<{
        data: { unmatchedStatements: BankStatement[]; unmatchedJELines: UnmatchedJELine[] };
      }>(`/finance/bank-accounts/${selectedBankId}/reconciliation`);
      return res.data.data;
    },
    enabled: !!selectedBankId,
  });

  const autoReconcileMutation = useMutation({
    mutationFn: () => api.post(`/finance/bank-accounts/${selectedBankId}/auto-reconcile`, {}),
    onSuccess: () => void refetch(),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Bank Account</label>
          <select
            value={selectedBankId}
            onChange={(e) => setSelectedBankId(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30 min-w-48"
          >
            <option value="">Select bank account...</option>
            {(bankAccounts ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.accountNumber}) — {formatCurrency(b.balance)}
              </option>
            ))}
          </select>
        </div>
        {selectedBankId && (
          <button
            onClick={() => autoReconcileMutation.mutate()}
            disabled={autoReconcileMutation.isPending}
            className="mt-5 flex items-center gap-1.5 px-4 py-2 bg-[#1B4F8A] text-white rounded-lg text-sm font-semibold hover:bg-[#163d6a] disabled:opacity-50"
          >
            <RefreshCw className="w-4 h-4" />
            {autoReconcileMutation.isPending ? "Reconciling..." : "Auto Reconcile"}
          </button>
        )}
      </div>

      {!selectedBankId && (
        <div className="text-center py-12 text-slate-400">
          <Landmark className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Select a bank account to start reconciliation</p>
        </div>
      )}

      {selectedBankId && reconLoading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1B4F8A]" />
        </div>
      )}

      {selectedBankId && !reconLoading && reconData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-orange-50 border-b border-orange-200">
              <h3 className="text-sm font-bold text-orange-800">
                Unmatched Bank Statements ({reconData.unmatchedStatements.length})
              </h3>
            </div>
            {reconData.unmatchedStatements.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">All statements matched</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Date</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Description</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reconData.unmatchedStatements.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-xs text-slate-500 font-mono">
                        {formatDate(s.date)}
                      </td>
                      <td className="px-3 py-2 text-slate-700">{s.description}</td>
                      <td
                        className={`px-3 py-2 text-right font-semibold ${
                          s.type === "CREDIT" ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {s.type === "CREDIT" ? "+" : "-"}
                        {formatCurrency(Math.abs(s.amount))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-blue-50 border-b border-blue-200">
              <h3 className="text-sm font-bold text-blue-800">
                Unmatched Journal Entry Lines ({reconData.unmatchedJELines.length})
              </h3>
            </div>
            {reconData.unmatchedJELines.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">All JE lines matched</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Date</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Reference</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Description</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reconData.unmatchedJELines.map((j) => (
                    <tr key={j.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-xs text-slate-500 font-mono">
                        {formatDate(j.date)}
                      </td>
                      <td className="px-3 py-2 text-xs font-mono text-[#1B4F8A]">{j.reference}</td>
                      <td className="px-3 py-2 text-slate-700">{j.description}</td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {formatCurrency(j.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab 5 — Cash Flow ────────────────────────────────────────────────────────

function CashFlowTab() {
  const [from, setFrom] = useState(firstOfMonthStr());
  const [to, setTo] = useState(todayStr());

  const { data, isLoading } = useQuery({
    queryKey: ["finance-cash-flow", from, to],
    queryFn: async () => {
      const res = await api.get<{ data: CashFlowData }>(
        `/finance/cash-flow?from=${from}&to=${to}`
      );
      return res.data.data;
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex gap-3 items-end">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1B4F8A]" />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KPICard
              title="Net from Operations"
              value={formatCurrency(data?.operating ?? 0)}
              icon={TrendingUp}
              iconColor="bg-green-100 text-green-600"
            />
            <KPICard
              title="Net from Investing"
              value={formatCurrency(data?.investing ?? 0)}
              icon={ArrowDownCircle}
              iconColor="bg-blue-100 text-blue-600"
            />
            <KPICard
              title="Net from Financing"
              value={formatCurrency(data?.financing ?? 0)}
              icon={ArrowUpCircle}
              iconColor="bg-purple-100 text-purple-600"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KPICard
              title="Opening Balance"
              value={formatCurrency(data?.openingBalance ?? 0)}
              icon={DollarSign}
              iconColor="bg-slate-100 text-slate-500"
            />
            <KPICard
              title="Net Cash Flow"
              value={formatCurrency(data?.netCashFlow ?? 0)}
              icon={BarChart3}
              iconColor={
                (data?.netCashFlow ?? 0) >= 0
                  ? "bg-green-100 text-green-600"
                  : "bg-red-100 text-red-600"
              }
            />
            <KPICard
              title="Closing Balance"
              value={formatCurrency(data?.closingBalance ?? 0)}
              icon={DollarSign}
              iconColor="bg-teal-100 text-teal-600"
            />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-bold text-slate-700 mb-4">Cash Flow Summary</h3>
            <div className="space-y-3">
              {[
                { label: "Cash from Operations", value: data?.operating ?? 0, color: "bg-green-500" },
                { label: "Cash from Investing", value: data?.investing ?? 0, color: "bg-blue-500" },
                { label: "Cash from Financing", value: data?.financing ?? 0, color: "bg-purple-500" },
              ].map((row) => {
                const maxVal = Math.max(
                  Math.abs(data?.operating ?? 0),
                  Math.abs(data?.investing ?? 0),
                  Math.abs(data?.financing ?? 0),
                  1
                );
                const pct = (Math.abs(row.value) / maxVal) * 100;
                return (
                  <div key={row.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-700 font-medium">{row.label}</span>
                      <span className={`font-semibold ${row.value >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {formatCurrency(row.value)}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${row.color} rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

const FINANCE_TABS = [
  { id: "ledger", label: "General Ledger", icon: BookOpen },
  { id: "journal", label: "Journal Entries", icon: FileText },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "reconciliation", label: "Bank Reconciliation", icon: Landmark },
  { id: "cashflow", label: "Cash Flow", icon: TrendingUp },
] as const;

type FinanceTabId = (typeof FINANCE_TABS)[number]["id"];

export default function FinancePage() {
  const [activeTab, setActiveTab] = useState<FinanceTabId>("ledger");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Finance</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            General ledger, journal entries, financial reports, bank reconciliation, and cash flow
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-200 overflow-x-auto">
          {FINANCE_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-[#1B4F8A] text-[#1B4F8A] bg-blue-50/30"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-5">
          {activeTab === "ledger" && <GeneralLedgerTab />}
          {activeTab === "journal" && <JournalEntriesTab />}
          {activeTab === "reports" && <ReportsTab />}
          {activeTab === "reconciliation" && <BankReconciliationTab />}
          {activeTab === "cashflow" && <CashFlowTab />}
        </div>
      </div>
    </div>
  );
}
