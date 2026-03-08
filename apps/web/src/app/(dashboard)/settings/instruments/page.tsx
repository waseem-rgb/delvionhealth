"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Cpu,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Database,
  X,
  ChevronDown,
  DollarSign,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { formatCurrency, cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface Instrument {
  id: string;
  name: string;
  model: string;
  manufacturer: string;
  brand: string;
  serialNumber: string;
  department: string;
  status: string;
  notes: string | null;
  branch: { name: string } | null;
}

interface TestCatalogSearchResult {
  id: string;
  name: string;
  code: string;
  department: string;
  mrp: number;
}

interface CptEntry {
  id: string;
  instrumentId: string;
  testCatalogId: string;
  reagentCost: number;
  controlCost: number;
  consumableCost: number;
  calibrationCost: number;
  overheadCost: number;
  totalCpt: number;
  mrpAtTime: number;
  marginAmount: number;
  marginPct: number;
  notes: string | null;
  instrument: {
    id: string;
    name: string;
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getMarginColor(pct: number): string {
  if (pct >= 60) return "text-green-400";
  if (pct >= 30) return "text-amber-400";
  return "text-red-400";
}

function getMarginBg(pct: number): string {
  if (pct >= 60) return "bg-green-500/10 border-green-500/20";
  if (pct >= 30) return "bg-amber-500/10 border-amber-500/20";
  return "bg-red-500/10 border-red-500/20";
}

function getStatusBadge(status: string) {
  if (status === "ACTIVE") return "bg-green-500/10 text-green-400 border border-green-500/20";
  return "bg-slate-700 text-slate-400 border border-slate-600";
}

// ── CPT Form ─────────────────────────────────────────────────────────────────

interface CptFormProps {
  instruments: Instrument[];
  testCatalogId: string;
  initial?: CptEntry | null;
  onSave: () => void;
  onCancel: () => void;
}

function CptForm({ instruments, testCatalogId, initial, onSave, onCancel }: CptFormProps) {
  const [instrumentId, setInstrumentId] = useState(initial?.instrumentId ?? "");
  const [reagentCost, setReagentCost] = useState(String(initial?.reagentCost ?? ""));
  const [controlCost, setControlCost] = useState(String(initial?.controlCost ?? ""));
  const [consumableCost, setConsumableCost] = useState(String(initial?.consumableCost ?? ""));
  const [calibrationCost, setCalibrationCost] = useState(String(initial?.calibrationCost ?? ""));
  const [overheadCost, setOverheadCost] = useState(String(initial?.overheadCost ?? ""));
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const totalCpt = useMemo(() => {
    return (
      (Number(reagentCost) || 0) +
      (Number(controlCost) || 0) +
      (Number(consumableCost) || 0) +
      (Number(calibrationCost) || 0) +
      (Number(overheadCost) || 0)
    );
  }, [reagentCost, controlCost, consumableCost, calibrationCost, overheadCost]);

  const mutation = useMutation({
    mutationFn: () =>
      api.post("/cpt", {
        instrumentId,
        testCatalogId,
        reagentCost: Number(reagentCost) || 0,
        controlCost: Number(controlCost) || 0,
        consumableCost: Number(consumableCost) || 0,
        calibrationCost: Number(calibrationCost) || 0,
        overheadCost: Number(overheadCost) || 0,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      toast.success("CPT entry saved");
      onSave();
    },
    onError: () => toast.error("Failed to save CPT entry"),
  });

  const inputCls =
    "w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40";

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-white">
          {initial ? "Edit CPT Entry" : "Add Instrument CPT"}
        </h4>
        <button onClick={onCancel} className="text-slate-400 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div>
        <label className="block text-xs text-slate-400 mb-1">Instrument</label>
        <select
          value={instrumentId}
          onChange={(e) => setInstrumentId(e.target.value)}
          className={inputCls}
        >
          <option value="">Select instrument...</option>
          {instruments.map((inst) => (
            <option key={inst.id} value={inst.id}>
              {inst.name} ({inst.department})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: "Reagent Cost", value: reagentCost, setter: setReagentCost },
          { label: "Control Cost", value: controlCost, setter: setControlCost },
          { label: "Consumable Cost", value: consumableCost, setter: setConsumableCost },
          { label: "Calibration Cost", value: calibrationCost, setter: setCalibrationCost },
          { label: "Overhead Cost", value: overheadCost, setter: setOverheadCost },
        ].map((field) => (
          <div key={field.label}>
            <label className="block text-xs text-slate-400 mb-1">{field.label}</label>
            <input
              type="number"
              value={field.value}
              onChange={(e) => field.setter(e.target.value)}
              placeholder="0"
              className={inputCls}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <div className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-2">
          <span className="text-xs text-slate-400">Total CPT: </span>
          <span className="text-sm font-bold text-cyan-400">{formatCurrency(totalCpt)}</span>
        </div>
      </div>

      <div>
        <label className="block text-xs text-slate-400 mb-1">Notes (optional)</label>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any additional notes..."
          className={inputCls}
        />
      </div>

      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-slate-700 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800"
        >
          Cancel
        </button>
        <button
          onClick={() => mutation.mutate()}
          disabled={!instrumentId || mutation.isPending}
          className="px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm font-medium hover:bg-cyan-700 disabled:opacity-50"
        >
          {mutation.isPending ? "Saving..." : "Save CPT"}
        </button>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function InstrumentsCptPage() {
  const queryClient = useQueryClient();

  // Instruments query
  const {
    data: instrumentsRes,
    isLoading: instrumentsLoading,
    isError: instrumentsError,
  } = useQuery({
    queryKey: ["settings-instruments"],
    queryFn: async () => {
      const res = await api.get("/instruments");
      const data = res.data?.data ?? res.data;
      return data as Instrument[];
    },
  });

  const instruments = instrumentsRes ?? [];

  // Group instruments by department
  const grouped = useMemo(() => {
    const map: Record<string, Instrument[]> = {};
    for (const inst of instruments) {
      const dept = inst.department || "Other";
      if (!map[dept]) map[dept] = [];
      map[dept].push(inst);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [instruments]);

  // Seed mutation
  const seedMutation = useMutation({
    mutationFn: () => api.post("/cpt/seed"),
    onSuccess: () => {
      toast.success("Default instruments seeded successfully");
      queryClient.invalidateQueries({ queryKey: ["settings-instruments"] });
    },
    onError: () => toast.error("Failed to seed instruments"),
  });

  // Test search
  const [testSearch, setTestSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedTest, setSelectedTest] = useState<TestCatalogSearchResult | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [editingCpt, setEditingCpt] = useState<CptEntry | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(testSearch), 300);
    return () => clearTimeout(timer);
  }, [testSearch]);

  // Search tests
  const { data: searchResults } = useQuery({
    queryKey: ["test-catalog-search", debouncedSearch],
    queryFn: async () => {
      const res = await api.get(`/test-catalog/search?q=${encodeURIComponent(debouncedSearch)}`);
      const data = res.data?.data ?? res.data;
      return data as TestCatalogSearchResult[];
    },
    enabled: debouncedSearch.length >= 2,
  });

  // CPT entries for selected test
  const {
    data: cptEntries,
    isLoading: cptLoading,
  } = useQuery({
    queryKey: ["cpt-entries", selectedTest?.id],
    queryFn: async () => {
      const res = await api.get(`/cpt/test/${selectedTest!.id}`);
      const data = res.data?.data ?? res.data;
      return data as CptEntry[];
    },
    enabled: !!selectedTest,
  });

  // Delete CPT entry
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/cpt/${id}`),
    onSuccess: () => {
      toast.success("CPT entry deleted");
      queryClient.invalidateQueries({ queryKey: ["cpt-entries", selectedTest?.id] });
    },
    onError: () => toast.error("Failed to delete CPT entry"),
  });

  const handleTestSelect = useCallback((test: TestCatalogSearchResult) => {
    setSelectedTest(test);
    setTestSearch(test.name);
    setShowDropdown(false);
    setShowAddForm(false);
    setEditingCpt(null);
  }, []);

  const handleCptSaved = useCallback(() => {
    setShowAddForm(false);
    setEditingCpt(null);
    queryClient.invalidateQueries({ queryKey: ["cpt-entries", selectedTest?.id] });
  }, [queryClient, selectedTest?.id]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Instruments &amp; CPT Management</h1>
            <p className="text-sm text-slate-400 mt-1">
              Manage lab instruments and cost-per-test (CPT) entries
            </p>
          </div>
          <button
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm font-medium hover:bg-cyan-700 disabled:opacity-50"
          >
            {seedMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Database className="w-4 h-4" />
            )}
            Seed Instruments
          </button>
        </div>

        {/* Error state */}
        {instrumentsError && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-5 py-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-sm text-red-400">
              Failed to load instruments. Please try refreshing the page.
            </p>
          </div>
        )}

        {/* Instruments by Department */}
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-white">Instruments</h2>

          {instrumentsLoading ? (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-5 animate-pulse"
                >
                  <div className="h-5 w-3/4 bg-slate-800 rounded mb-3" />
                  <div className="h-4 w-1/2 bg-slate-800 rounded mb-2" />
                  <div className="h-3 w-2/3 bg-slate-800 rounded" />
                </div>
              ))}
            </div>
          ) : instruments.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-16 text-center">
              <Cpu className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">
                No instruments found. Click &ldquo;Seed Instruments&rdquo; to load defaults.
              </p>
            </div>
          ) : (
            grouped.map(([dept, insts]) => (
              <div key={dept} className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                  {dept}
                </h3>
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {insts.map((inst) => (
                    <div
                      key={inst.id}
                      className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-white text-sm truncate">
                            {inst.name}
                          </h4>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {inst.brand} &middot; {inst.model}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                            getStatusBadge(inst.status)
                          )}
                        >
                          {inst.status}
                        </span>
                      </div>
                      <div className="space-y-1 text-xs text-slate-400">
                        <div>
                          Department:{" "}
                          <span className="text-slate-300">{inst.department}</span>
                        </div>
                        {inst.serialNumber && (
                          <div>
                            S/N:{" "}
                            <span className="font-mono text-slate-300">{inst.serialNumber}</span>
                          </div>
                        )}
                        {inst.manufacturer && (
                          <div>
                            Manufacturer:{" "}
                            <span className="text-slate-300">{inst.manufacturer}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* CPT Entry Section */}
        <div className="border-t border-slate-800 pt-8 space-y-6">
          <h2 className="text-lg font-semibold text-white">CPT Entry</h2>

          {/* Test search */}
          <div className="relative max-w-lg">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                value={testSearch}
                onChange={(e) => {
                  setTestSearch(e.target.value);
                  setShowDropdown(true);
                  if (e.target.value.length < 2) {
                    setSelectedTest(null);
                  }
                }}
                onFocus={() => {
                  if (debouncedSearch.length >= 2) setShowDropdown(true);
                }}
                placeholder="Search tests (min 2 characters)..."
                className="w-full pl-10 pr-4 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40"
              />
            </div>

            {/* Search dropdown */}
            {showDropdown && searchResults && searchResults.length > 0 && (
              <div className="absolute z-20 top-full mt-1 w-full bg-slate-900 border border-slate-700 rounded-xl shadow-xl max-h-64 overflow-y-auto">
                {searchResults.map((test) => (
                  <button
                    key={test.id}
                    onClick={() => handleTestSelect(test)}
                    className="w-full text-left px-4 py-3 hover:bg-slate-800 border-b border-slate-800 last:border-b-0"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">{test.name}</p>
                        <p className="text-xs text-slate-400">
                          {test.code} &middot; {test.department}
                        </p>
                      </div>
                      <span className="text-xs text-slate-400">
                        MRP: {formatCurrency(test.mrp)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected test CPT entries */}
          {selectedTest && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-md font-semibold text-white">{selectedTest.name}</h3>
                  <p className="text-xs text-slate-400">
                    {selectedTest.code} &middot; {selectedTest.department} &middot; MRP:{" "}
                    {formatCurrency(selectedTest.mrp)}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowAddForm(true);
                    setEditingCpt(null);
                  }}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-cyan-600 text-white rounded-lg text-sm font-medium hover:bg-cyan-700"
                >
                  <Plus className="w-4 h-4" />
                  Add Instrument CPT
                </button>
              </div>

              {/* Loading */}
              {cptLoading && (
                <div className="space-y-3">
                  {[...Array(2)].map((_, i) => (
                    <div
                      key={i}
                      className="bg-slate-900 border border-slate-800 rounded-xl p-5 animate-pulse"
                    >
                      <div className="h-5 w-1/3 bg-slate-800 rounded mb-3" />
                      <div className="h-4 w-2/3 bg-slate-800 rounded mb-2" />
                      <div className="h-4 w-1/2 bg-slate-800 rounded" />
                    </div>
                  ))}
                </div>
              )}

              {/* CPT entry cards */}
              {!cptLoading && cptEntries && cptEntries.length === 0 && !showAddForm && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
                  <DollarSign className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-slate-400 text-sm">
                    No CPT entries for this test. Add one to track costs.
                  </p>
                </div>
              )}

              {!cptLoading &&
                cptEntries &&
                cptEntries.map((entry) => {
                  const total =
                    entry.reagentCost +
                    entry.controlCost +
                    entry.consumableCost +
                    entry.calibrationCost +
                    entry.overheadCost;
                  const margin = entry.mrpAtTime - total;
                  const marginPct = entry.mrpAtTime > 0 ? (margin / entry.mrpAtTime) * 100 : 0;

                  return (
                    <div
                      key={entry.id}
                      className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-white">
                          {entry.instrument.name}
                        </h4>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setEditingCpt(entry);
                              setShowAddForm(false);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-lg text-xs font-medium"
                          >
                            <Pencil className="w-3 h-3" />
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              if (confirm("Delete this CPT entry?")) {
                                deleteMutation.mutate(entry.id);
                              }
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg text-xs font-medium"
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </button>
                        </div>
                      </div>

                      {/* Cost breakdown */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        {[
                          { label: "Reagent", value: entry.reagentCost },
                          { label: "Control", value: entry.controlCost },
                          { label: "Consumable", value: entry.consumableCost },
                          { label: "Calibration", value: entry.calibrationCost },
                          { label: "Overhead", value: entry.overheadCost },
                        ].map((cost) => (
                          <div
                            key={cost.label}
                            className="bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2"
                          >
                            <p className="text-xs text-slate-400">{cost.label}</p>
                            <p className="text-sm font-medium text-white">
                              {formatCurrency(cost.value)}
                            </p>
                          </div>
                        ))}
                      </div>

                      {/* Totals row */}
                      <div className="flex flex-wrap gap-4 items-center pt-2 border-t border-slate-800">
                        <div>
                          <span className="text-xs text-slate-400">Total CPT: </span>
                          <span className="text-sm font-bold text-cyan-400">
                            {formatCurrency(total)}
                          </span>
                        </div>
                        <div>
                          <span className="text-xs text-slate-400">MRP: </span>
                          <span className="text-sm font-medium text-white">
                            {formatCurrency(entry.mrpAtTime)}
                          </span>
                        </div>
                        <div
                          className={cn(
                            "inline-flex items-center gap-2 px-3 py-1 rounded-lg border",
                            getMarginBg(marginPct)
                          )}
                        >
                          <TrendingUp className={cn("w-3.5 h-3.5", getMarginColor(marginPct))} />
                          <span className={cn("text-sm font-bold", getMarginColor(marginPct))}>
                            {formatCurrency(margin)} ({marginPct.toFixed(1)}%)
                          </span>
                          <span className="text-xs text-slate-400">Gross Margin</span>
                        </div>
                      </div>

                      {entry.notes && (
                        <p className="text-xs text-slate-500 italic">{entry.notes}</p>
                      )}
                    </div>
                  );
                })}

              {/* Add / Edit form */}
              {(showAddForm || editingCpt) && (
                <CptForm
                  instruments={instruments}
                  testCatalogId={selectedTest.id}
                  initial={editingCpt}
                  onSave={handleCptSaved}
                  onCancel={() => {
                    setShowAddForm(false);
                    setEditingCpt(null);
                  }}
                />
              )}
            </div>
          )}

          {/* Empty state when no test selected */}
          {!selectedTest && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
              <Search className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">
                Search for a test above to view and manage its CPT entries.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
