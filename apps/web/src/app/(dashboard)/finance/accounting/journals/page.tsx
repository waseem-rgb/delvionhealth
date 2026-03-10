"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, RotateCcw, FileText } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

const fmt = (v: number) => new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2 }).format(v);

interface JournalEntry {
  id: string;
  entryNumber: string;
  description: string;
  date: string;
  status: string;
  reference: string;
  lines: Array<{
    id: string;
    glAccountId: string;
    debit: number;
    credit: number;
    description: string;
    glAccount?: { code: string; name: string };
  }>;
}

interface LedgerAccount {
  id: string;
  code: string;
  name: string;
}

interface JournalLineInput {
  ledgerAccountId: string;
  type: "DEBIT" | "CREDIT";
  amount: string;
  narration: string;
}

export default function JournalEntriesPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [narration, setNarration] = useState("");
  const [lines, setLines] = useState<JournalLineInput[]>([
    { ledgerAccountId: "", type: "DEBIT", amount: "", narration: "" },
    { ledgerAccountId: "", type: "CREDIT", amount: "", narration: "" },
  ]);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["finance", "journal-entries"],
    queryFn: async () => {
      const res = await api.get("/finance/journal-entries?limit=50");
      const raw = res.data?.data ?? res.data;
      return (Array.isArray(raw) ? raw : raw?.data ?? []) as JournalEntry[];
    },
  });

  const { data: ledgers = [] } = useQuery({
    queryKey: ["finance", "accounts-for-je"],
    queryFn: async () => {
      const res = await api.get("/finance/accounts");
      const raw = res.data?.data ?? res.data;
      return (Array.isArray(raw) ? raw : []) as LedgerAccount[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        date,
        narration,
        refType: "MANUAL",
        lines: lines
          .filter((l) => l.ledgerAccountId && Number(l.amount) > 0)
          .map((l) => ({
            ledgerAccountId: l.ledgerAccountId,
            type: l.type,
            amount: Number(l.amount),
            narration: l.narration || undefined,
          })),
      };
      await api.post("/finance/journal-entries", payload);
    },
    onSuccess: () => {
      toast.success("Journal entry posted");
      setShowCreate(false);
      setNarration("");
      setLines([
        { ledgerAccountId: "", type: "DEBIT", amount: "", narration: "" },
        { ledgerAccountId: "", type: "CREDIT", amount: "", narration: "" },
      ]);
      queryClient.invalidateQueries({ queryKey: ["finance", "journal-entries"] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? "Failed to post journal entry");
    },
  });

  const reverseMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/finance/journal-entries/${id}/reverse`);
    },
    onSuccess: () => {
      toast.success("Journal entry reversed");
      queryClient.invalidateQueries({ queryKey: ["finance", "journal-entries"] });
    },
  });

  const addLine = () => setLines([...lines, { ledgerAccountId: "", type: "DEBIT", amount: "", narration: "" }]);

  const updateLine = (idx: number, field: string, value: string) => {
    const updated = [...lines];
    (updated[idx] as any)[field] = value;
    setLines(updated);
  };

  const totalDebit = lines.reduce((s, l) => s + (l.type === "DEBIT" ? Number(l.amount || 0) : 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (l.type === "CREDIT" ? Number(l.amount || 0) : 0), 0);
  const isBalanced = totalDebit > 0 && totalDebit === totalCredit;

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Journal Entries</h1>
          <p className="text-slate-400">View and create manual journal entries</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          New Entry
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">New Journal Entry</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Narration</label>
              <input value={narration} onChange={(e) => setNarration(e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                placeholder="Description of the entry..." />
            </div>
          </div>

          <table className="w-full mb-4">
            <thead>
              <tr className="text-xs text-slate-500">
                <th className="pb-2 text-left">Account</th>
                <th className="pb-2 text-left w-28">Type</th>
                <th className="pb-2 text-right w-32">Amount</th>
                <th className="pb-2 text-left">Note</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr key={i} className="border-b border-slate-800/30">
                  <td className="py-1 pr-2">
                    <select value={line.ledgerAccountId} onChange={(e) => updateLine(i, "ledgerAccountId", e.target.value)}
                      className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-white">
                      <option value="">Select account...</option>
                      {ledgers.map((l) => <option key={l.id} value={l.id}>{l.code} — {l.name}</option>)}
                    </select>
                  </td>
                  <td className="py-1 pr-2">
                    <select value={line.type} onChange={(e) => updateLine(i, "type", e.target.value)}
                      className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-white">
                      <option value="DEBIT">Debit</option>
                      <option value="CREDIT">Credit</option>
                    </select>
                  </td>
                  <td className="py-1 pr-2">
                    <input type="number" value={line.amount} onChange={(e) => updateLine(i, "amount", e.target.value)}
                      className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-white text-right"
                      placeholder="0.00" />
                  </td>
                  <td className="py-1">
                    <input value={line.narration} onChange={(e) => updateLine(i, "narration", e.target.value)}
                      className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-white"
                      placeholder="Optional note" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex items-center justify-between">
            <button onClick={addLine} className="text-xs text-blue-400 hover:text-blue-300">+ Add Line</button>
            <div className="flex items-center gap-4">
              <span className="text-xs text-slate-500">Dr: {fmt(totalDebit)} | Cr: {fmt(totalCredit)}</span>
              <span className={`text-xs font-bold ${isBalanced ? "text-emerald-400" : "text-red-400"}`}>
                {isBalanced ? "Balanced" : "Unbalanced"}
              </span>
              <button onClick={() => createMutation.mutate()} disabled={!isBalanced || createMutation.isPending}
                className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                Post Entry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Entries List */}
      <div className="overflow-hidden rounded-xl border border-slate-800">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900">
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Entry #</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Description</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-400">Amount</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-slate-400">Status</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-slate-400">Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Loading...</td></tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <FileText className="mx-auto h-10 w-10 text-slate-600 mb-3" />
                  <p className="text-slate-400">No journal entries yet</p>
                </td>
              </tr>
            ) : (
              entries.map((entry) => {
                const totalDr = (entry.lines ?? []).reduce((s, l) => s + Number(l.debit ?? 0), 0);
                return (
                  <tr key={entry.id} className="border-b border-slate-800/50 bg-slate-900/50 hover:bg-slate-800/50">
                    <td className="px-4 py-3 text-sm font-mono text-blue-400">{entry.entryNumber}</td>
                    <td className="px-4 py-3 text-sm text-slate-300 whitespace-nowrap">
                      {new Date(entry.date).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-4 py-3 text-sm text-white">{entry.description}</td>
                    <td className="px-4 py-3 text-sm text-right text-white font-medium">{fmt(totalDr)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        entry.status === "POSTED" ? "bg-green-500/20 text-green-400" :
                        entry.status === "REVERSED" ? "bg-red-500/20 text-red-400" :
                        "bg-slate-700 text-slate-300"
                      }`}>
                        {entry.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {entry.status === "POSTED" && (
                        <button onClick={() => reverseMutation.mutate(entry.id)}
                          disabled={reverseMutation.isPending}
                          className="rounded bg-red-600/20 px-2.5 py-1 text-xs text-red-400 hover:bg-red-600/30">
                          <RotateCcw className="inline h-3 w-3 mr-1" />Reverse
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
