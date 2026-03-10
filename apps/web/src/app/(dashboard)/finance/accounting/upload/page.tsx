"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

const fmt = (v: number) => new Intl.NumberFormat("en-IN").format(v);
const fmtPaise = (v: number) => fmt(Math.round(v / 100));

interface BankAccount {
  id: string;
  name: string;
  bankName: string;
  accountNumber: string;
}

interface StatementLine {
  id: string;
  txnDate: string;
  narration: string;
  debit: number;
  credit: number;
  balance: number;
  suggestedLedgerId: string | null;
  confirmedLedgerId: string | null;
  aiConfidence: number | null;
  aiCategory: string | null;
  status: string;
}

interface UploadResult {
  id: string;
  totalRows: number;
  parsedRows: number;
  confirmedRows: number;
  status: string;
  lines: StatementLine[];
}

interface LedgerAccount {
  id: string;
  code: string;
  name: string;
  group: string;
}

const STATUS_COLORS: Record<string, string> = {
  AI_MATCHED: "text-green-400",
  MANUALLY_MATCHED: "text-blue-400",
  CONFIRMED: "text-emerald-400",
  UNMATCHED: "text-red-400",
  EXCLUDED: "text-slate-500",
};

function getConfidenceColor(confidence: number | null): string {
  if (!confidence) return "bg-red-500/20 text-red-400";
  if (confidence >= 0.85) return "bg-green-500/20 text-green-400";
  if (confidence >= 0.60) return "bg-yellow-500/20 text-yellow-400";
  return "bg-red-500/20 text-red-400";
}

export default function BankUploadPage() {
  const queryClient = useQueryClient();
  const [selectedBank, setSelectedBank] = useState("");
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [editingRow, setEditingRow] = useState<string | null>(null);

  // Fetch bank accounts
  const { data: banks = [] } = useQuery({
    queryKey: ["finance", "bank-accounts"],
    queryFn: async () => {
      const res = await api.get("/finance/bank-accounts");
      const raw = res.data?.data ?? res.data;
      return (Array.isArray(raw) ? raw : raw?.accounts ?? []) as BankAccount[];
    },
  });

  // Fetch ledger accounts for dropdown
  const { data: ledgers = [] } = useQuery({
    queryKey: ["finance", "ledgers"],
    queryFn: async () => {
      const res = await api.get("/finance/accounts");
      const raw = res.data?.data ?? res.data;
      return (Array.isArray(raw) ? raw : []) as LedgerAccount[];
    },
  });

  // Fetch upload result
  const { data: upload, isLoading: loadingUpload } = useQuery({
    queryKey: ["finance", "statement-upload", uploadId],
    queryFn: async () => {
      const res = await api.get(`/finance/statements/${uploadId}`);
      return (res.data?.data ?? res.data) as UploadResult;
    },
    enabled: !!uploadId,
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.status === "PARSING" ? 2000 : false;
    },
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("bankAccountId", selectedBank);
      const res = await api.post("/finance/statements/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return (res.data?.data ?? res.data) as { id: string };
    },
    onSuccess: (data) => {
      setUploadId(data.id);
      toast.success("Statement uploaded — parsing in progress");
    },
    onError: () => toast.error("Failed to upload statement"),
  });

  // Confirm line mutation
  const confirmMutation = useMutation({
    mutationFn: async ({ lineId, ledgerId }: { lineId: string; ledgerId: string }) => {
      await api.patch(`/finance/bank-statement-lines/${lineId}/confirm`, { confirmedLedgerId: ledgerId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance", "statement-upload", uploadId] });
      setEditingRow(null);
    },
  });

  // Bulk confirm mutation
  const bulkConfirmMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/finance/bank-statements/${uploadId}/bulk-confirm`);
    },
    onSuccess: () => {
      toast.success("All high-confidence lines confirmed");
      queryClient.invalidateQueries({ queryKey: ["finance", "statement-upload", uploadId] });
    },
  });

  // Post to ledgers mutation
  const postMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/finance/statements/${uploadId}/post`);
    },
    onSuccess: () => {
      toast.success("All transactions posted to ledgers");
      queryClient.invalidateQueries({ queryKey: ["finance", "statement-upload", uploadId] });
    },
  });

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file && selectedBank) uploadMutation.mutate(file);
    },
    [selectedBank, uploadMutation]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && selectedBank) uploadMutation.mutate(file);
    },
    [selectedBank, uploadMutation]
  );

  const lines = upload?.lines ?? [];
  const totalRows = lines.length;
  const matchedRows = lines.filter((l) => l.status === "AI_MATCHED" || l.status === "MANUALLY_MATCHED").length;
  const confirmedRows = lines.filter((l) => l.status === "CONFIRMED").length;
  const unmatchedRows = lines.filter((l) => l.status === "UNMATCHED").length;
  const allConfirmed = totalRows > 0 && confirmedRows === totalRows;
  const matchPct = totalRows > 0 ? Math.round((matchedRows / totalRows) * 100) : 0;

  const filteredLedgers = ledgers.filter(
    (l) =>
      l.name.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
      l.code.includes(ledgerSearch)
  );

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Upload Bank Statement</h1>
        <p className="text-slate-400">Upload CSV or Excel bank statements for AI-powered categorization</p>
      </div>

      {/* Bank Selector + Upload Zone */}
      {!uploadId && (
        <div className="space-y-6">
          <div className="max-w-md">
            <label className="block text-sm font-medium text-slate-400 mb-2">Select Bank Account</label>
            <select
              value={selectedBank}
              onChange={(e) => setSelectedBank(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="">Choose bank account...</option>
              {banks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bankName} - {b.name} ({b.accountNumber})
                </option>
              ))}
            </select>
          </div>

          <div
            className={`rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
              dragActive
                ? "border-blue-500 bg-blue-500/10"
                : selectedBank
                ? "border-slate-700 bg-slate-900 hover:border-slate-600"
                : "border-slate-800 bg-slate-900/50 opacity-50 cursor-not-allowed"
            }`}
            onDragOver={(e) => { e.preventDefault(); if (selectedBank) setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={selectedBank ? handleDrop : undefined}
          >
            {uploadMutation.isPending ? (
              <div className="flex flex-col items-center">
                <Loader2 className="h-12 w-12 text-blue-400 animate-spin mb-4" />
                <p className="text-white font-medium">Uploading & parsing...</p>
              </div>
            ) : (
              <>
                <FileSpreadsheet className="mx-auto h-12 w-12 text-slate-500 mb-4" />
                <p className="text-white font-medium mb-1">Drag & drop your bank statement here</p>
                <p className="text-sm text-slate-500 mb-4">CSV or Excel (.xlsx), max 10MB</p>
                <label className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
                  selectedBank
                    ? "bg-blue-600 text-white cursor-pointer hover:bg-blue-700"
                    : "bg-slate-800 text-slate-500 cursor-not-allowed"
                }`}>
                  <Upload className="h-4 w-4" />
                  Browse Files
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileInput}
                    disabled={!selectedBank}
                    className="hidden"
                  />
                </label>
              </>
            )}
          </div>
        </div>
      )}

      {/* Upload Results */}
      {uploadId && loadingUpload && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
          <p className="ml-3 text-slate-400">Loading statement data...</p>
        </div>
      )}

      {upload && upload.status !== "PARSING" && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <p className="text-sm text-slate-400">Total Rows</p>
              <p className="text-2xl font-bold text-white">{totalRows}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <p className="text-sm text-slate-400">AI Matched</p>
              <p className="text-2xl font-bold text-green-400">{matchPct}%</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <p className="text-sm text-slate-400">Confirmed</p>
              <p className="text-2xl font-bold text-emerald-400">{confirmedRows}/{totalRows}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <p className="text-sm text-slate-400">Unmatched</p>
              <p className="text-2xl font-bold text-red-400">{unmatchedRows}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => bulkConfirmMutation.mutate()}
              disabled={bulkConfirmMutation.isPending || matchedRows === 0}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              Confirm All Green ({lines.filter(l => l.status === "AI_MATCHED" && (l.aiConfidence ?? 0) >= 0.85).length})
            </button>
            <button
              onClick={() => postMutation.mutate()}
              disabled={!allConfirmed || postMutation.isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Post to Ledgers
            </button>
            <button
              onClick={() => { setUploadId(null); }}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-400 hover:text-white"
            >
              Upload Another
            </button>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>{confirmedRows} of {totalRows} rows confirmed</span>
              <span>{totalRows > 0 ? Math.round((confirmedRows / totalRows) * 100) : 0}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-800">
              <div
                className="h-2 rounded-full bg-emerald-500 transition-all"
                style={{ width: `${totalRows > 0 ? (confirmedRows / totalRows) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Transaction Table */}
          <div className="overflow-hidden rounded-xl border border-slate-800">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900">
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Narration</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-400">Debit</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-400">Credit</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Suggested Ledger</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-400">Confidence</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-400">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-400">Action</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id} className="border-b border-slate-800/50 bg-slate-900/50 hover:bg-slate-800/50">
                    <td className="px-4 py-3 text-sm text-slate-300 whitespace-nowrap">
                      {new Date(line.txnDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    </td>
                    <td className="px-4 py-3 text-sm text-white max-w-xs truncate" title={line.narration}>
                      {line.narration}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-red-400">
                      {line.debit > 0 ? fmtPaise(line.debit) : ""}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-green-400">
                      {line.credit > 0 ? fmtPaise(line.credit) : ""}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">
                      {editingRow === line.id ? (
                        <div className="relative">
                          <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-500" />
                          <input
                            value={ledgerSearch}
                            onChange={(e) => setLedgerSearch(e.target.value)}
                            className="w-full rounded border border-slate-600 bg-slate-800 pl-7 pr-2 py-1.5 text-xs text-white focus:outline-none"
                            placeholder="Search ledger..."
                            autoFocus
                          />
                          {ledgerSearch && (
                            <div className="absolute z-10 mt-1 max-h-40 w-64 overflow-y-auto rounded border border-slate-700 bg-slate-800 shadow-lg">
                              {filteredLedgers.slice(0, 10).map((l) => (
                                <button
                                  key={l.id}
                                  onClick={() => {
                                    confirmMutation.mutate({ lineId: line.id, ledgerId: l.id });
                                    setLedgerSearch("");
                                  }}
                                  className="block w-full px-3 py-1.5 text-left text-xs text-slate-300 hover:bg-slate-700"
                                >
                                  {l.code} — {l.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        line.aiCategory ?? "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {line.aiConfidence != null && (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getConfidenceColor(line.aiConfidence)}`}>
                          {Math.round(line.aiConfidence * 100)}%
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-medium ${STATUS_COLORS[line.status] ?? "text-slate-400"}`}>
                        {line.status === "AI_MATCHED" ? "Matched" : line.status === "CONFIRMED" ? "Confirmed" : line.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {line.status === "UNMATCHED" && (
                        <button
                          onClick={() => { setEditingRow(line.id); setLedgerSearch(""); }}
                          className="rounded bg-blue-600/20 px-2.5 py-1 text-xs text-blue-400 hover:bg-blue-600/30"
                        >
                          Assign
                        </button>
                      )}
                      {line.status === "AI_MATCHED" && (
                        <button
                          onClick={() => confirmMutation.mutate({ lineId: line.id, ledgerId: line.suggestedLedgerId! })}
                          disabled={confirmMutation.isPending}
                          className="rounded bg-green-600/20 px-2.5 py-1 text-xs text-green-400 hover:bg-green-600/30"
                        >
                          Confirm
                        </button>
                      )}
                      {line.status === "CONFIRMED" && (
                        <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-400" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
