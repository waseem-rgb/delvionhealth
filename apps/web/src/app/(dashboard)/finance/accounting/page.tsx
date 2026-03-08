"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  Settings,
  ArrowUpCircle,
  ArrowDownCircle,
  Search,
  Plus,
  Trash2,
  Tag,
  RefreshCw,
  Filter,
  Eye,
  Send,
  XCircle,
  Copy,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import api from "@/lib/api";

// ── Types ───────────────────────────────────────────────────────────────────

interface UploadedStatement {
  id: string;
  fileName: string;
  bankName: string;
  accountName: string;
  uploadedAt: string;
  totalRows: number;
  matchedRows: number;
  suspenseRows: number;
  status: string;
}

interface BankTransaction {
  id: string;
  txnDate: string;
  narration: string;
  debitAmount: number;
  creditAmount: number;
  balance: number;
  category: string | null;
  subCategory: string | null;
  description: string | null;
  matchType: string;
  isDuplicate: boolean;
  isPosted: boolean;
  bankAccount?: { name: string; bankName: string };
}

interface TransactionResponse {
  data: BankTransaction[];
  meta: { total: number; page: number; limit: number; totalPages: number };
  summary: {
    totalCredits: number;
    creditCount: number;
    totalDebits: number;
    debitCount: number;
    net: number;
  };
}

interface CashBookDay {
  date: string;
  openingBalance: number;
  receipts: Array<{ id: string; voucherNumber: string; description: string; amount: number; category: string; receivedFrom: string }>;
  payments: Array<{ id: string; voucherNumber: string; description: string; amount: number; category: string; paidTo: string }>;
  totalReceipts: number;
  totalPayments: number;
  closingBalance: number;
}

interface LedgerEntry {
  id: string;
  date: string;
  source: string;
  description: string;
  category: string | null;
  debit: number;
  credit: number;
  narration: string;
  balance: number;
}

interface NarrationRule {
  id: string;
  pattern: string;
  matchType: string;
  category: string;
  subCategory: string | null;
  description: string | null;
  confidence: number;
  usageCount: number;
}

interface BankAccount {
  id: string;
  name: string;
  accountNumber: string;
  bankName: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: "upload", label: "Upload Statement", icon: Upload },
  { id: "suspense", label: "Suspense Inbox", icon: AlertTriangle },
  { id: "transactions", label: "Transactions", icon: FileText },
  { id: "cashbook", label: "Cash Book", icon: BookOpen },
  { id: "ledger", label: "Ledger", icon: Eye },
  { id: "rules", label: "Rules", icon: Settings },
] as const;

type TabId = (typeof TABS)[number]["id"];

const CATEGORIES = [
  "REVENUE", "REAGENTS", "SALARY", "RENT", "UTILITIES",
  "MAINTENANCE", "TAX", "BANK_CHARGES", "IT", "TRANSFER",
  "EQUIPMENT", "MARKETING", "INSURANCE", "PROFESSIONAL_FEES",
  "TRAVEL", "MISCELLANEOUS", "SUSPENSE",
];

const categoryColors: Record<string, string> = {
  REVENUE: "bg-emerald-100 text-emerald-700",
  REAGENTS: "bg-blue-100 text-blue-700",
  SALARY: "bg-purple-100 text-purple-700",
  RENT: "bg-orange-100 text-orange-700",
  UTILITIES: "bg-yellow-100 text-yellow-700",
  MAINTENANCE: "bg-cyan-100 text-cyan-700",
  TAX: "bg-red-100 text-red-700",
  BANK_CHARGES: "bg-slate-100 text-slate-700",
  IT: "bg-indigo-100 text-indigo-700",
  TRANSFER: "bg-gray-100 text-gray-600",
  SUSPENSE: "bg-amber-100 text-amber-700",
};

function CategoryBadge({ category }: { category: string | null }) {
  if (!category) return <span className="text-slate-400 text-xs">—</span>;
  const color = categoryColors[category] ?? "bg-slate-100 text-slate-600";
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>
      {category.replace(/_/g, " ")}
    </span>
  );
}

function MatchBadge({ type }: { type: string }) {
  if (type === "AUTO_MATCHED") return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Auto</span>;
  if (type === "MANUAL") return <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Manual</span>;
  if (type === "SUSPENSE") return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Suspense</span>;
  return <span className="text-xs text-slate-400">{type}</span>;
}

// ── Upload Tab ──────────────────────────────────────────────────────────────

function UploadTab() {
  const qc = useQueryClient();
  const [selectedBank, setSelectedBank] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const { data: banks = [] } = useQuery<BankAccount[]>({
    queryKey: ["finance", "bank-accounts"],
    queryFn: async () => {
      const res = await api.get("/finance/bank-accounts");
      const raw = res.data?.data ?? res.data ?? [];
      return Array.isArray(raw) ? raw : (raw?.items ?? raw?.accounts ?? []);
    },
  });

  const { data: statements = [], isLoading } = useQuery<UploadedStatement[]>({
    queryKey: ["finance", "statements"],
    queryFn: async () => {
      const res = await api.get("/finance/statements");
      const raw = res.data?.data ?? res.data ?? [];
      return Array.isArray(raw) ? raw : (raw?.items ?? raw?.statements ?? []);
    },
  });

  const uploadMut = useMutation({
    mutationFn: async () => {
      if (!file || !selectedBank) return;
      const fd = new FormData();
      fd.append("file", file);
      fd.append("bankAccountId", selectedBank);
      const res = await api.post("/finance/statements/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data?.data ?? res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance", "statements"] });
      qc.invalidateQueries({ queryKey: ["finance", "transactions"] });
      setFile(null);
    },
  });

  const postMut = useMutation({
    mutationFn: async (stmtId: string) => {
      const res = await api.post(`/finance/statements/${stmtId}/post`);
      return res.data?.data ?? res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance", "statements"] }),
  });

  return (
    <div className="space-y-6">
      {/* Upload Form */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Upload Bank Statement</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Bank Account</label>
            <select
              value={selectedBank}
              onChange={(e) => setSelectedBank(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select account...</option>
              {banks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bankName} — {b.name} ({b.accountNumber.slice(-4)})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Statement File (CSV / Excel)</label>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-blue-50 file:px-3 file:py-1 file:text-sm file:text-blue-600"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => uploadMut.mutate()}
              disabled={!file || !selectedBank || uploadMut.isPending}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Upload className="h-4 w-4" />
              {uploadMut.isPending ? "Uploading..." : "Upload & Parse"}
            </button>
          </div>
        </div>
        {uploadMut.isSuccess && (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
            <CheckCircle2 className="h-4 w-4 inline mr-1" />
            Statement uploaded. {(uploadMut.data as Record<string, number>)?.totalRows ?? 0} rows parsed,{" "}
            {(uploadMut.data as Record<string, number>)?.autoMatched ?? 0} auto-matched,{" "}
            {(uploadMut.data as Record<string, number>)?.suspenseCount ?? 0} suspense.
          </div>
        )}
        {uploadMut.isError && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
            <XCircle className="h-4 w-4 inline mr-1" />
            Upload failed. Check file format and try again.
          </div>
        )}
      </div>

      {/* Uploaded Statements List */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">Uploaded Statements</h3>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Loading...</div>
        ) : statements.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No statements uploaded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">File</th>
                  <th className="px-4 py-3 text-left font-medium">Bank</th>
                  <th className="px-4 py-3 text-center font-medium">Rows</th>
                  <th className="px-4 py-3 text-center font-medium">Matched</th>
                  <th className="px-4 py-3 text-center font-medium">Suspense</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Uploaded</th>
                  <th className="px-4 py-3 text-center font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {statements.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{s.fileName}</td>
                    <td className="px-4 py-3 text-slate-600">{s.bankName} — {s.accountName}</td>
                    <td className="px-4 py-3 text-center">{s.totalRows}</td>
                    <td className="px-4 py-3 text-center text-green-600 font-medium">{s.matchedRows}</td>
                    <td className="px-4 py-3 text-center">
                      {s.suspenseRows > 0 ? (
                        <span className="text-amber-600 font-medium">{s.suspenseRows}</span>
                      ) : (
                        <span className="text-green-600">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${s.status === "REVIEWED" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                        {s.status === "REVIEWED" ? "Reviewed" : "Needs Review"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(s.uploadedAt)}</td>
                    <td className="px-4 py-3 text-center">
                      {s.status === "REVIEWED" && (
                        <button
                          onClick={() => postMut.mutate(s.id)}
                          disabled={postMut.isPending}
                          className="text-xs px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          <Send className="h-3 w-3 inline mr-1" />Post
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Suspense Inbox Tab ──────────────────────────────────────────────────────

function SuspenseTab() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [catForm, setCatForm] = useState({ category: "", subCategory: "", description: "", saveAsRule: false });

  const { data, isLoading } = useQuery<TransactionResponse>({
    queryKey: ["finance", "transactions", "suspense"],
    queryFn: async () => {
      const res = await api.get("/finance/transactions", { params: { matchType: "SUSPENSE", limit: 100 } });
      return res.data?.data ?? res.data;
    },
  });

  const categorizeMut = useMutation({
    mutationFn: async ({ id, ...dto }: { id: string; category: string; subCategory?: string; description?: string; saveAsRule?: boolean }) => {
      await api.patch(`/finance/transactions/${id}/categorize`, dto);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance", "transactions"] });
      qc.invalidateQueries({ queryKey: ["finance", "statements"] });
      setEditingId(null);
      setCatForm({ category: "", subCategory: "", description: "", saveAsRule: false });
    },
  });

  const dupMut = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/finance/transactions/${id}/mark-duplicate`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance", "transactions"] }),
  });

  const txns = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <h3 className="text-lg font-semibold text-slate-900">Suspense Items ({txns.length})</h3>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          These transactions could not be auto-categorized. Assign a category to resolve them.
        </p>

        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Loading...</div>
        ) : txns.length === 0 ? (
          <div className="p-8 text-center text-green-600">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2" />
            All clear! No suspense items.
          </div>
        ) : (
          <div className="space-y-3">
            {txns.map((txn) => (
              <div key={txn.id} className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-xs text-slate-500">{formatDate(txn.txnDate)}</span>
                      {txn.creditAmount > 0 ? (
                        <span className="text-sm font-semibold text-green-600">
                          <ArrowDownCircle className="h-3.5 w-3.5 inline mr-0.5" />
                          +{formatCurrency(txn.creditAmount)}
                        </span>
                      ) : (
                        <span className="text-sm font-semibold text-red-600">
                          <ArrowUpCircle className="h-3.5 w-3.5 inline mr-0.5" />
                          -{formatCurrency(txn.debitAmount)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-800 font-medium truncate">{txn.narration}</p>
                    {txn.bankAccount && (
                      <p className="text-xs text-slate-400 mt-0.5">{txn.bankAccount.bankName} — {txn.bankAccount.name}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => { setEditingId(editingId === txn.id ? null : txn.id); setCatForm({ category: "", subCategory: "", description: "", saveAsRule: false }); }}
                      className="text-xs px-3 py-1.5 rounded-lg border border-blue-300 text-blue-600 hover:bg-blue-50"
                    >
                      <Tag className="h-3 w-3 inline mr-1" />Categorize
                    </button>
                    <button
                      onClick={() => dupMut.mutate(txn.id)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
                    >
                      <Copy className="h-3 w-3 inline mr-1" />Duplicate
                    </button>
                  </div>
                </div>

                {editingId === txn.id && (
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <select
                        value={catForm.category}
                        onChange={(e) => setCatForm({ ...catForm, category: e.target.value })}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                      >
                        <option value="">Category...</option>
                        {CATEGORIES.filter((c) => c !== "SUSPENSE").map((c) => (
                          <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Sub-category"
                        value={catForm.subCategory}
                        onChange={(e) => setCatForm({ ...catForm, subCategory: e.target.value })}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                      />
                      <input
                        type="text"
                        placeholder="Description"
                        value={catForm.description}
                        onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                      />
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 text-xs text-slate-600">
                          <input
                            type="checkbox"
                            checked={catForm.saveAsRule}
                            onChange={(e) => setCatForm({ ...catForm, saveAsRule: e.target.checked })}
                            className="rounded border-slate-300"
                          />
                          Save as rule
                        </label>
                        <button
                          onClick={() => catForm.category && categorizeMut.mutate({ id: txn.id, ...catForm })}
                          disabled={!catForm.category || categorizeMut.isPending}
                          className="text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Transactions Tab ────────────────────────────────────────────────────────

function TransactionsTab() {
  const [filters, setFilters] = useState({
    category: "", matchType: "", type: "", month: "", search: "", page: 1,
  });

  const { data, isLoading } = useQuery<TransactionResponse>({
    queryKey: ["finance", "transactions", filters],
    queryFn: async () => {
      const params: Record<string, string | number> = { page: filters.page, limit: 50 };
      if (filters.category) params.category = filters.category;
      if (filters.matchType) params.matchType = filters.matchType;
      if (filters.type) params.type = filters.type;
      if (filters.month) params.month = filters.month;
      if (filters.search) params.search = filters.search;
      const res = await api.get("/finance/transactions", { params });
      return res.data?.data ?? res.data;
    },
  });

  const txns = data?.data ?? [];
  const meta = data?.meta ?? { total: 0, page: 1, limit: 50, totalPages: 1 };
  const summary = data?.summary ?? { totalCredits: 0, creditCount: 0, totalDebits: 0, debitCount: 0, net: 0 };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-green-600 mb-1">
            <ArrowDownCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Credits</span>
          </div>
          <p className="text-xl font-bold text-slate-900">{formatCurrency(summary.totalCredits)}</p>
          <p className="text-xs text-slate-500">{summary.creditCount} transactions</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-red-600 mb-1">
            <ArrowUpCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Debits</span>
          </div>
          <p className="text-xl font-bold text-slate-900">{formatCurrency(summary.totalDebits)}</p>
          <p className="text-xs text-slate-500">{summary.debitCount} transactions</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <FileText className="h-4 w-4" />
            <span className="text-sm font-medium">Net</span>
          </div>
          <p className={`text-xl font-bold ${summary.net >= 0 ? "text-green-600" : "text-red-600"}`}>
            {formatCurrency(summary.net)}
          </p>
          <p className="text-xs text-slate-500">{meta.total} total transactions</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">Filters</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search narration..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
              className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm"
            />
          </div>
          <select
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value, page: 1 })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
            ))}
          </select>
          <select
            value={filters.matchType}
            onChange={(e) => setFilters({ ...filters, matchType: e.target.value, page: 1 })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">All Match Types</option>
            <option value="AUTO_MATCHED">Auto Matched</option>
            <option value="MANUAL">Manual</option>
            <option value="SUSPENSE">Suspense</option>
          </select>
          <select
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value, page: 1 })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Credit & Debit</option>
            <option value="CREDIT">Credits Only</option>
            <option value="DEBIT">Debits Only</option>
          </select>
          <input
            type="month"
            value={filters.month}
            onChange={(e) => setFilters({ ...filters, month: e.target.value, page: 1 })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Loading...</div>
        ) : txns.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No transactions found.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Date</th>
                    <th className="px-4 py-3 text-left font-medium">Narration</th>
                    <th className="px-4 py-3 text-right font-medium">Debit</th>
                    <th className="px-4 py-3 text-right font-medium">Credit</th>
                    <th className="px-4 py-3 text-left font-medium">Category</th>
                    <th className="px-4 py-3 text-center font-medium">Match</th>
                    <th className="px-4 py-3 text-center font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {txns.map((txn) => (
                    <tr key={txn.id} className={`hover:bg-slate-50 ${txn.isDuplicate ? "opacity-50 line-through" : ""}`}>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(txn.txnDate)}</td>
                      <td className="px-4 py-3 text-slate-900 max-w-xs truncate" title={txn.narration}>{txn.narration}</td>
                      <td className="px-4 py-3 text-right text-red-600 font-medium">
                        {txn.debitAmount > 0 ? formatCurrency(txn.debitAmount) : ""}
                      </td>
                      <td className="px-4 py-3 text-right text-green-600 font-medium">
                        {txn.creditAmount > 0 ? formatCurrency(txn.creditAmount) : ""}
                      </td>
                      <td className="px-4 py-3"><CategoryBadge category={txn.category} /></td>
                      <td className="px-4 py-3 text-center"><MatchBadge type={txn.matchType} /></td>
                      <td className="px-4 py-3 text-center">
                        {txn.isPosted ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Posted</span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Pending</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {meta.totalPages > 1 && (
              <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between">
                <span className="text-sm text-slate-500">
                  Page {meta.page} of {meta.totalPages} ({meta.total} total)
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                    disabled={filters.page <= 1}
                    className="px-3 py-1 text-sm rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                    disabled={filters.page >= meta.totalPages}
                    className="px-3 py-1 text-sm rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Cash Book Tab ───────────────────────────────────────────────────────────

function CashBookTab() {
  const qc = useQueryClient();
  const [month, setMonth] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ entryDate: "", type: "RECEIPT", category: "", description: "", amount: "", paidTo: "", receivedFrom: "" });

  const { data: days = [], isLoading } = useQuery<CashBookDay[]>({
    queryKey: ["finance", "cashbook", month],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (month) params.month = month;
      const res = await api.get("/finance/cashbook", { params });
      return res.data?.data ?? res.data ?? [];
    },
  });

  const addMut = useMutation({
    mutationFn: async () => {
      await api.post("/finance/cashbook", { ...form, amount: parseFloat(form.amount) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance", "cashbook"] });
      setShowForm(false);
      setForm({ entryDate: "", type: "RECEIPT", category: "", description: "", amount: "", paidTo: "", receivedFrom: "" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/finance/cashbook/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance", "cashbook"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />Add Entry
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">New Cash Book Entry</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input type="date" value={form.entryDate} onChange={(e) => setForm({ ...form, entryDate: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="RECEIPT">Receipt</option>
              <option value="PAYMENT">Payment</option>
            </select>
            <input type="text" placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input type="number" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input type="text" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm col-span-2" />
            {form.type === "RECEIPT" ? (
              <input type="text" placeholder="Received from" value={form.receivedFrom} onChange={(e) => setForm({ ...form, receivedFrom: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            ) : (
              <input type="text" placeholder="Paid to" value={form.paidTo} onChange={(e) => setForm({ ...form, paidTo: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            )}
            <button onClick={() => addMut.mutate()} disabled={!form.entryDate || !form.description || !form.amount || addMut.isPending} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
              {addMut.isPending ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}

      {/* Daily Groups */}
      {isLoading ? (
        <div className="p-8 text-center text-slate-500">Loading...</div>
      ) : days.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">No cash book entries found.</div>
      ) : (
        days.map((day) => (
          <div key={day.date} className="bg-white rounded-xl border border-slate-200">
            <div className="px-6 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-xl">
              <span className="font-semibold text-slate-900">{day.date}</span>
              <div className="flex gap-6 text-sm">
                <span className="text-slate-500">Opening: <span className="font-medium text-slate-700">{formatCurrency(day.openingBalance)}</span></span>
                <span className="text-green-600">Receipts: <span className="font-medium">{formatCurrency(day.totalReceipts)}</span></span>
                <span className="text-red-600">Payments: <span className="font-medium">{formatCurrency(day.totalPayments)}</span></span>
                <span className="text-blue-600">Closing: <span className="font-bold">{formatCurrency(day.closingBalance)}</span></span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-slate-500">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Voucher</th>
                    <th className="px-4 py-2 text-left font-medium">Description</th>
                    <th className="px-4 py-2 text-left font-medium">Party</th>
                    <th className="px-4 py-2 text-left font-medium">Category</th>
                    <th className="px-4 py-2 text-right font-medium">Receipt</th>
                    <th className="px-4 py-2 text-right font-medium">Payment</th>
                    <th className="px-4 py-2 text-center font-medium w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {day.receipts.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-mono text-xs text-slate-600">{r.voucherNumber}</td>
                      <td className="px-4 py-2 text-slate-800">{r.description}</td>
                      <td className="px-4 py-2 text-slate-600">{r.receivedFrom || "—"}</td>
                      <td className="px-4 py-2"><CategoryBadge category={r.category} /></td>
                      <td className="px-4 py-2 text-right text-green-600 font-medium">{formatCurrency(r.amount)}</td>
                      <td className="px-4 py-2 text-right"></td>
                      <td className="px-4 py-2 text-center">
                        <button onClick={() => deleteMut.mutate(r.id)} className="text-slate-400 hover:text-red-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {day.payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-mono text-xs text-slate-600">{p.voucherNumber}</td>
                      <td className="px-4 py-2 text-slate-800">{p.description}</td>
                      <td className="px-4 py-2 text-slate-600">{p.paidTo || "—"}</td>
                      <td className="px-4 py-2"><CategoryBadge category={p.category} /></td>
                      <td className="px-4 py-2 text-right"></td>
                      <td className="px-4 py-2 text-right text-red-600 font-medium">{formatCurrency(p.amount)}</td>
                      <td className="px-4 py-2 text-center">
                        <button onClick={() => deleteMut.mutate(p.id)} className="text-slate-400 hover:text-red-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── Ledger Tab ──────────────────────────────────────────────────────────────

function LedgerTab() {
  const [filters, setFilters] = useState({ month: "", category: "", source: "" });

  const { data: entries = [], isLoading } = useQuery<LedgerEntry[]>({
    queryKey: ["finance", "ledger", filters],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filters.month) params.month = filters.month;
      if (filters.category) params.category = filters.category;
      if (filters.source) params.source = filters.source;
      const res = await api.get("/finance/ledger", { params });
      return res.data?.data ?? res.data ?? [];
    },
  });

  const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="month"
            value={filters.month}
            onChange={(e) => setFilters({ ...filters, month: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Month"
          />
          <select
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
            ))}
          </select>
          <select
            value={filters.source}
            onChange={(e) => setFilters({ ...filters, source: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">All Sources</option>
            <option value="BANK">Bank Only</option>
            <option value="CASH">Cash Only</option>
          </select>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-red-600">Debit: <strong>{formatCurrency(totalDebit)}</strong></span>
            <span className="text-green-600">Credit: <strong>{formatCurrency(totalCredit)}</strong></span>
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-xl border border-slate-200">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Loading...</div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No ledger entries found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Date</th>
                  <th className="px-4 py-3 text-left font-medium">Source</th>
                  <th className="px-4 py-3 text-left font-medium">Description</th>
                  <th className="px-4 py-3 text-left font-medium">Category</th>
                  <th className="px-4 py-3 text-right font-medium">Debit</th>
                  <th className="px-4 py-3 text-right font-medium">Credit</th>
                  <th className="px-4 py-3 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(e.date)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${e.source === "Cash" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                        {e.source}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-800 max-w-xs truncate" title={e.narration}>{e.description}</td>
                    <td className="px-4 py-3"><CategoryBadge category={e.category} /></td>
                    <td className="px-4 py-3 text-right text-red-600 font-medium">{e.debit > 0 ? formatCurrency(e.debit) : ""}</td>
                    <td className="px-4 py-3 text-right text-green-600 font-medium">{e.credit > 0 ? formatCurrency(e.credit) : ""}</td>
                    <td className={`px-4 py-3 text-right font-bold ${e.balance >= 0 ? "text-green-700" : "text-red-700"}`}>
                      {formatCurrency(e.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Rules Tab ───────────────────────────────────────────────────────────────

function RulesTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ pattern: "", matchType: "CONTAINS", category: "", subCategory: "", description: "" });

  const { data: rules = [], isLoading } = useQuery<NarrationRule[]>({
    queryKey: ["finance", "narration-rules"],
    queryFn: async () => {
      const res = await api.get("/finance/narration-rules");
      return res.data?.data ?? res.data ?? [];
    },
  });

  const addMut = useMutation({
    mutationFn: async () => {
      await api.post("/finance/narration-rules", form);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance", "narration-rules"] });
      setShowForm(false);
      setForm({ pattern: "", matchType: "CONTAINS", category: "", subCategory: "", description: "" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/finance/narration-rules/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance", "narration-rules"] }),
  });

  // Group rules by category
  const grouped: Record<string, NarrationRule[]> = {};
  for (const r of rules) {
    if (!grouped[r.category]) grouped[r.category] = [];
    grouped[r.category].push(r);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{rules.length} narration rules configured</p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />Add Rule
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">New Narration Rule</h3>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <input type="text" placeholder="Pattern (e.g. RAZORPAY)" value={form.pattern} onChange={(e) => setForm({ ...form, pattern: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm col-span-2" />
            <select value={form.matchType} onChange={(e) => setForm({ ...form, matchType: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="CONTAINS">Contains</option>
              <option value="STARTS_WITH">Starts With</option>
              <option value="REGEX">Regex</option>
            </select>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">Category...</option>
              {CATEGORIES.filter((c) => c !== "SUSPENSE").map((c) => (
                <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
              ))}
            </select>
            <input type="text" placeholder="Sub-category" value={form.subCategory} onChange={(e) => setForm({ ...form, subCategory: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <button onClick={() => addMut.mutate()} disabled={!form.pattern || !form.category || addMut.isPending} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
              Save
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="p-8 text-center text-slate-500">Loading...</div>
      ) : (
        Object.entries(grouped).map(([cat, catRules]) => (
          <div key={cat} className="bg-white rounded-xl border border-slate-200">
            <div className="px-6 py-3 border-b border-slate-200 bg-slate-50 rounded-t-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CategoryBadge category={cat} />
                <span className="text-xs text-slate-500">({catRules.length} rules)</span>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {catRules.map((rule) => (
                <div key={rule.id} className="px-6 py-3 flex items-center justify-between hover:bg-slate-50">
                  <div className="flex items-center gap-4">
                    <code className="text-sm font-mono bg-slate-100 px-2 py-0.5 rounded">{rule.pattern}</code>
                    <span className="text-xs text-slate-500">{rule.matchType}</span>
                    {rule.subCategory && <span className="text-xs text-slate-400">{rule.subCategory}</span>}
                    {rule.description && <span className="text-xs text-slate-500 italic">{rule.description}</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">Used {rule.usageCount}x</span>
                    <button onClick={() => deleteMut.mutate(rule.id)} className="text-slate-400 hover:text-red-500">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function AccountingPage() {
  const [activeTab, setActiveTab] = useState<TabId>("upload");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Accounting</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Bank statement upload, auto-categorization, cash book, and combined ledger
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex gap-1 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "upload" && <UploadTab />}
      {activeTab === "suspense" && <SuspenseTab />}
      {activeTab === "transactions" && <TransactionsTab />}
      {activeTab === "cashbook" && <CashBookTab />}
      {activeTab === "ledger" && <LedgerTab />}
      {activeTab === "rules" && <RulesTab />}
    </div>
  );
}
