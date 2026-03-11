"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Tag,
  Search,
  Sparkles,
  Filter,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Minus,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import api from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CptRow {
  id: string;
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
  totalCPT: number;
  grossMarginAmt: number;
  grossMarginPct: number;
  alert: "LOW_MARGIN" | null;
}

interface MarginDashboard {
  rows: CptRow[];
  summary: {
    totalTests: number;
    avgMarginPct: number;
    lowMarginCount: number;
    highMarginCount: number;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function MarginBadge({ pct }: { pct: number }) {
  if (pct >= 60)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
        <TrendingUp className="w-3 h-3" />
        {pct.toFixed(1)}%
      </span>
    );
  if (pct >= 30)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
        <Minus className="w-3 h-3" />
        {pct.toFixed(1)}%
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
      <TrendingDown className="w-3 h-3" />
      {pct.toFixed(1)}%
    </span>
  );
}

// ── Inline CPT Edit Cell ──────────────────────────────────────────────────────

function EditableCptCell({
  row,
  onSaved,
}: {
  row: CptRow;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(row.totalCPT.toString());

  const saveMutation = useMutation({
    mutationFn: (newCpt: number) =>
      api.post("/cpt", {
        instrumentId: row.instrumentId,
        testCatalogId: row.testCatalogId,
        reagentCost: newCpt,
        controlCost: 0,
        consumableCost: 0,
        calibrationCost: 0,
        overheadCost: 0,
      }),
    onSuccess: () => {
      toast.success("CPT cost updated");
      setEditing(false);
      onSaved();
    },
    onError: (err: any) => {
      toast.error("Failed to update CPT cost", {
        description: err?.response?.data?.message ?? "Please try again.",
      });
    },
  });

  function handleSave() {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) {
      toast.error("Invalid CPT cost value");
      return;
    }
    saveMutation.mutate(num);
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-1.5 group">
        <span className="font-mono text-sm text-slate-800">
          ₹{row.totalCPT.toFixed(2)}
        </span>
        <button
          onClick={() => {
            setValue(row.totalCPT.toString());
            setEditing(true);
          }}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-slate-100 transition-all"
          title="Edit CPT cost"
        >
          <Pencil className="w-3 h-3 text-slate-400" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-slate-400">₹</span>
      <input
        autoFocus
        type="number"
        min={0}
        step={0.01}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") setEditing(false);
        }}
        onBlur={handleSave}
        className="w-24 border border-[#0D7E8A] rounded px-2 py-0.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]/30"
      />
      <button
        onClick={handleSave}
        disabled={saveMutation.isPending}
        className="p-1 rounded bg-green-50 hover:bg-green-100 text-green-700"
      >
        <Check className="w-3 h-3" />
      </button>
      <button
        onClick={() => setEditing(false)}
        className="p-1 rounded bg-slate-50 hover:bg-slate-100 text-slate-500"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

// ── AI Suggest Button ─────────────────────────────────────────────────────────

function AiSuggestButton({ testName }: { testName: string }) {
  const suggestMutation = useMutation({
    mutationFn: () => api.post("/instruments/ai-cpt", { testName }),
    onSuccess: (res) => {
      const suggestion = res.data?.suggestedCpt ?? res.data?.suggestion ?? res.data;
      toast.success(`AI Suggestion for "${testName}"`, {
        description:
          typeof suggestion === "string"
            ? suggestion
            : `Suggested CPT cost: ₹${JSON.stringify(suggestion)}`,
      });
    },
    onError: (err: any) => {
      const status = err?.response?.status;
      if (status === 404 || status === 500) {
        toast.info("AI not available", {
          description: "The AI CPT suggestion service is not configured.",
        });
      } else {
        toast.error("AI suggestion failed", {
          description: err?.response?.data?.message ?? "Please try again.",
        });
      }
    },
  });

  return (
    <button
      onClick={() => suggestMutation.mutate()}
      disabled={suggestMutation.isPending}
      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg transition-colors disabled:opacity-50"
      title={`AI suggest CPT for ${testName}`}
    >
      {suggestMutation.isPending ? (
        <span className="animate-spin w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full" />
      ) : (
        <Sparkles className="w-3 h-3" />
      )}
      AI Suggest
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CptCodesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [instrumentFilter, setInstrumentFilter] = useState("ALL");

  const { data, isLoading } = useQuery<MarginDashboard>({
    queryKey: ["cpt-margin-dashboard"],
    queryFn: () =>
      api
        .get("/cpt/margin-dashboard")
        .then((r) => r.data as MarginDashboard)
        .catch(() => ({ rows: [], summary: { totalTests: 0, avgMarginPct: 0, lowMarginCount: 0, highMarginCount: 0 } })),
    retry: 1,
    staleTime: 30000,
  });

  const rows = data?.rows ?? [];
  const summary = data?.summary;

  // Unique categories and instruments for filters
  const categories = useMemo(() => {
    const cats = [...new Set(rows.map((r) => r.department).filter(Boolean))];
    return cats.sort();
  }, [rows]);

  const instruments = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => map.set(r.instrumentId, r.instrumentName));
    return [...map.entries()];
  }, [rows]);

  // Filtered rows
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const matchSearch =
        !search ||
        r.testName.toLowerCase().includes(search.toLowerCase()) ||
        r.testCode.toLowerCase().includes(search.toLowerCase()) ||
        r.instrumentName.toLowerCase().includes(search.toLowerCase());
      const matchCat = categoryFilter === "ALL" || r.department === categoryFilter;
      const matchInst = instrumentFilter === "ALL" || r.instrumentId === instrumentFilter;
      return matchSearch && matchCat && matchInst;
    });
  }, [rows, search, categoryFilter, instrumentFilter]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="CPT Code Mapping"
        subtitle="Map lab tests to CPT billing codes"
        actions={null}
      />

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-100 rounded-xl px-4 py-3">
            <div className="text-2xl font-bold text-slate-800">{summary.totalTests}</div>
            <div className="text-xs text-slate-400 font-medium mt-0.5">Total Mappings</div>
          </div>
          <div className="bg-white border border-slate-100 rounded-xl px-4 py-3">
            <div className="text-2xl font-bold text-amber-600">{summary.avgMarginPct.toFixed(1)}%</div>
            <div className="text-xs text-slate-400 font-medium mt-0.5">Avg Gross Margin</div>
          </div>
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            <div className="text-2xl font-bold text-red-600">{summary.lowMarginCount}</div>
            <div className="text-xs text-red-400 font-medium mt-0.5">Low Margin (&lt;30%)</div>
          </div>
          <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3">
            <div className="text-2xl font-bold text-green-600">{summary.highMarginCount}</div>
            <div className="text-xs text-green-600 font-medium mt-0.5">High Margin (≥60%)</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-slate-100 rounded-xl p-4">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 flex-1 min-w-[200px] max-w-xs">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by test name or instrument..."
              className="flex-1 text-sm focus:outline-none bg-transparent text-slate-700 placeholder-slate-300"
            />
          </div>

          {/* Category filter */}
          <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-sm text-slate-700 focus:outline-none bg-transparent"
            >
              <option value="ALL">All Departments</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Instrument filter */}
          <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2">
            <select
              value={instrumentFilter}
              onChange={(e) => setInstrumentFilter(e.target.value)}
              className="text-sm text-slate-700 focus:outline-none bg-transparent"
            >
              <option value="ALL">All Instruments</option>
              {instruments.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Result count */}
          <span className="text-xs text-slate-400 ml-auto">
            {filtered.length} of {rows.length} entries
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-12 bg-slate-50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <Tag className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm font-medium">
              {rows.length === 0 ? "No CPT mappings found" : "No results match your filters"}
            </p>
            {rows.length === 0 && (
              <p className="text-slate-300 text-xs mt-1">
                Use the CPT seed endpoint or add mappings via the API
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Test Name
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Test Code
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Instrument
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    MRP
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Total CPT Cost
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Gross Margin
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Department
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, idx) => (
                  <tr
                    key={row.id}
                    className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${
                      idx % 2 === 0 ? "" : "bg-slate-50/30"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {row.alert === "LOW_MARGIN" && (
                          <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                        )}
                        <span className="font-medium text-slate-800 text-sm">{row.testName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {row.testCode || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-600">{row.instrumentName}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-700 font-mono">₹{row.mrp.toFixed(2)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <EditableCptCell
                        row={row}
                        onSaved={() =>
                          qc.invalidateQueries({ queryKey: ["cpt-margin-dashboard"] })
                        }
                      />
                    </td>
                    <td className="px-4 py-3">
                      <MarginBadge pct={row.grossMarginPct} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-500">
                        {row.department || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <AiSuggestButton testName={row.testName} />
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
