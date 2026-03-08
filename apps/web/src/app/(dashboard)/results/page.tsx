"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FlaskConical,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  X,
  ChevronRight,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PriorityBadge } from "@/components/shared/PriorityBadge";
import { formatDateTime } from "@/lib/utils";
import api from "@/lib/api";
import { useCriticalAlerts } from "@/hooks/useRealtime";
import type { CriticalAlertPayload } from "@/hooks/useRealtime";

interface PendingResult {
  id: string;
  value: string;
  numericValue?: number | null;
  unit?: string | null;
  referenceRange?: string | null;
  interpretation: "NORMAL" | "ABNORMAL" | "CRITICAL" | "INCONCLUSIVE";
  isDraft: boolean;
  deltaFlagged: boolean;
  deltaPercent?: number | null;
  verifiedById?: string | null;
  autoVerified: boolean;
  pathologistNotes?: string | null;
  flags?: string | null;
  orderItem: {
    testCatalog: { id: string; name: string; code: string };
  };
  order: {
    id: string;
    orderNumber: string;
    priority: string;
    patient: { firstName: string; lastName: string; mrn: string };
  };
  sample: { barcodeId: string };
  enteredBy?: { firstName: string; lastName: string } | null;
}

interface OrderResult extends PendingResult {
  updatedAt: string;
  validatedById?: string | null;
  validatedAt?: string | null;
  verifiedBy?: { firstName: string; lastName: string } | null;
  validatedBy?: { firstName: string; lastName: string } | null;
  flags?: string | null;
}

interface WorklistItem {
  orderId: string;
  orderNumber: string;
  priority: string;
  patient: { firstName: string; lastName: string; mrn: string };
  results: PendingResult[];
}

function interpretColor(interp: string) {
  if (interp === "CRITICAL") return "text-red-600 bg-red-50 ring-red-200";
  if (interp === "ABNORMAL") return "text-orange-600 bg-orange-50 ring-orange-200";
  return "text-green-600 bg-green-50 ring-green-200";
}

function groupByOrder(results: PendingResult[]): WorklistItem[] {
  const map = new Map<string, WorklistItem>();
  for (const r of results) {
    const key = r.order.id;
    if (!map.has(key)) {
      map.set(key, {
        orderId: r.order.id,
        orderNumber: r.order.orderNumber,
        priority: r.order.priority,
        patient: r.order.patient,
        results: [],
      });
    }
    map.get(key)!.results.push(r);
  }
  return [...map.values()];
}

// ─── Result Row (editable) ────────────────────────────────────────────────────
function ResultRow({
  result,
  onValueChange,
  selected,
  onToggleSelect,
}: {
  result: OrderResult;
  onValueChange: (id: string, value: string, numericValue: number | null) => void;
  selected: boolean;
  onToggleSelect: (id: string) => void;
}) {
  const [localValue, setLocalValue] = useState(result.value ?? "");
  const [localInterp, setLocalInterp] = useState(result.interpretation);

  const computeInterpretation = useCallback(
    (val: string, refRange: string | null | undefined): "NORMAL" | "ABNORMAL" | "CRITICAL" | "INCONCLUSIVE" => {
      const num = parseFloat(val);
      if (isNaN(num) || !refRange) return result.interpretation;

      // Parse "low - high unit" pattern
      const match = refRange.match(/([\d.]+)\s*-\s*([\d.]+)/);
      if (!match) return result.interpretation;
      const low = parseFloat(match[1]!);
      const high = parseFloat(match[2]!);
      if (num < low * 0.7 || num > high * 1.5) return "CRITICAL";
      if (num < low || num > high) return "ABNORMAL";
      return "NORMAL";
    },
    [result.interpretation]
  );

  const handleBlur = () => {
    const num = parseFloat(localValue);
    const numericValue = isNaN(num) ? null : num;
    const interp = computeInterpretation(localValue, result.referenceRange);
    setLocalInterp(interp);
    onValueChange(result.id, localValue, numericValue);
  };

  const isVerified = result.verifiedById !== null || result.autoVerified;

  return (
    <tr className={`border-b border-slate-100 hover:bg-slate-50 ${selected ? "bg-blue-50" : ""}`}>
      <td className="px-3 py-2.5">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(result.id)}
          className="rounded border-slate-300"
        />
      </td>
      <td className="px-3 py-2.5">
        {result.flags ? (
          <>
            <p className="text-sm font-medium text-slate-800">{result.flags}</p>
            <p className="text-xs text-slate-400">{result.orderItem.testCatalog.name}</p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-slate-800">{result.orderItem.testCatalog.name}</p>
            <p className="text-xs text-slate-400 font-mono">{result.orderItem.testCatalog.code}</p>
          </>
        )}
      </td>
      <td className="px-3 py-2.5">
        <span className="font-mono text-xs text-slate-500">{result.sample.barcodeId}</span>
      </td>
      <td className="px-3 py-2.5">
        {isVerified ? (
          <span className="font-semibold text-sm text-slate-800">
            {result.value} {result.unit ?? ""}
          </span>
        ) : (
          <div className="flex items-center gap-1">
            <input
              value={localValue}
              onChange={(e) => setLocalValue(e.target.value)}
              onBlur={handleBlur}
              placeholder="Enter value"
              className="w-24 border border-slate-200 rounded px-2 py-1 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[#1B4F8A]/30"
            />
            {result.unit && <span className="text-xs text-slate-400">{result.unit}</span>}
          </div>
        )}
      </td>
      <td className="px-3 py-2.5 text-xs text-slate-500">{result.referenceRange ?? "—"}</td>
      <td className="px-3 py-2.5">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ring-1 ${interpretColor(localInterp)}`}>
          {localInterp}
        </span>
      </td>
      <td className="px-3 py-2.5">
        {result.deltaFlagged && (
          <span className="inline-flex items-center gap-1 text-orange-600 text-xs font-semibold">
            <AlertTriangle size={12} />
            ▲ {result.deltaPercent?.toFixed(0)}%
          </span>
        )}
      </td>
      <td className="px-3 py-2.5">
        {isVerified ? (
          <CheckCircle size={16} className="text-green-500" />
        ) : (
          <span className="w-4 h-4 rounded-full border-2 border-slate-200 inline-block" />
        )}
      </td>
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ResultsPage() {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedResultIds, setSelectedResultIds] = useState<string[]>([]);
  const [localValues, setLocalValues] = useState<Record<string, { value: string; numericValue: number | null }>>({});
  const [criticalBanner, setCriticalBanner] = useState<string | null>(null);
  const [pathNotes, setPathNotes] = useState("");
  const [showValidateModal, setShowValidateModal] = useState(false);
  const qc = useQueryClient();

  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: ["results-pending"],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: PendingResult[] }>("/results/pending");
      return res.data.data; // unwrap TransformInterceptor
    },
    refetchInterval: 30000,
  });

  const worklistItems = groupByOrder(pendingData ?? []);

  const { data: orderResults, isLoading: orderLoading } = useQuery({
    queryKey: ["order-results", selectedOrderId],
    queryFn: async () => {
      if (!selectedOrderId) return [];
      const res = await api.get<{ success: boolean; data: OrderResult[] }>(`/results/order/${selectedOrderId}`);
      return res.data.data ?? []; // unwrap TransformInterceptor
    },
    enabled: !!selectedOrderId,
  });

  // WebSocket critical alert
  useCriticalAlerts((data: CriticalAlertPayload) => {
    setCriticalBanner(data.message ?? "Critical result received");
  });

  const handleValueChange = (id: string, value: string, numericValue: number | null) => {
    setLocalValues((prev) => ({ ...prev, [id]: { value, numericValue } }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const updates = (orderResults ?? [])
        .filter((r) => !r.verifiedById && !r.autoVerified && localValues[r.id])
        .map((r) => ({
          id: r.id,
          value: localValues[r.id]?.value ?? r.value,
          numericValue: localValues[r.id]?.numericValue ?? r.numericValue ?? null,
        }));
      if (updates.length === 0) return;
      await api.post("/results/save-draft", { updates });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["order-results", selectedOrderId] });
      void qc.invalidateQueries({ queryKey: ["results-pending"] });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await api.post("/results/verify", { ids });
    },
    onSuccess: () => {
      setSelectedResultIds([]);
      void qc.invalidateQueries({ queryKey: ["order-results", selectedOrderId] });
      void qc.invalidateQueries({ queryKey: ["results-pending"] });
    },
  });

  const validateMutation = useMutation({
    mutationFn: async () => {
      const ids = selectedResultIds.length > 0
        ? selectedResultIds
        : (orderResults ?? []).map((r) => r.id);
      await api.post("/results/validate", { ids, pathologistNotes: pathNotes });
    },
    onSuccess: () => {
      setShowValidateModal(false);
      setSelectedResultIds([]);
      void qc.invalidateQueries({ queryKey: ["order-results", selectedOrderId] });
      void qc.invalidateQueries({ queryKey: ["results-pending"] });
    },
  });

  const handleAutoVerify = () => {
    const toVerify = (orderResults ?? [])
      .filter((r) => !r.verifiedById && !r.autoVerified && r.interpretation === "NORMAL" && !r.deltaFlagged)
      .map((r) => r.id);
    if (toVerify.length > 0) verifyMutation.mutate(toVerify);
  };

  const toggleSelect = (id: string) => {
    setSelectedResultIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectedOrder = worklistItems.find((w) => w.orderId === selectedOrderId);

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-0 animate-fade-in">
      {/* Critical alert banner */}
      {criticalBanner && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-600 text-white rounded-lg mb-3">
          <AlertCircle size={18} />
          <span className="font-semibold text-sm">CRITICAL ALERT: {criticalBanner}</span>
          <button onClick={() => setCriticalBanner(null)} className="ml-auto">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="flex gap-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {/* LEFT: Worklist */}
        <div className="w-[34%] border-r border-slate-200 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-700">Pending Worklist</h2>
            <p className="text-xs text-slate-400 mt-0.5">{worklistItems.length} orders pending</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {pendingLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 size={20} className="animate-spin text-slate-400" />
              </div>
            ) : worklistItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                <FlaskConical size={24} className="mb-2" />
                <p className="text-sm">No pending results</p>
              </div>
            ) : (
              worklistItems.map((item) => {
                const hasCritical = item.results.some((r) => r.interpretation === "CRITICAL");
                const hasAbnormal = item.results.some((r) => r.interpretation === "ABNORMAL");
                const isSelected = selectedOrderId === item.orderId;

                return (
                  <button
                    key={item.orderId}
                    onClick={() => {
                      setSelectedOrderId(item.orderId);
                      setSelectedResultIds([]);
                    }}
                    className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors flex items-center gap-3 ${
                      isSelected ? "bg-[#1B4F8A]/5 border-l-2 border-l-[#1B4F8A]" : ""
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono text-xs font-semibold text-slate-700">
                          {item.orderNumber}
                        </span>
                        <PriorityBadge priority={item.priority as "ROUTINE" | "URGENT" | "STAT"} />
                        {hasCritical && <AlertCircle size={12} className="text-red-500" />}
                        {!hasCritical && hasAbnormal && <AlertTriangle size={12} className="text-orange-500" />}
                      </div>
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {item.patient.firstName} {item.patient.lastName}
                      </p>
                      <p className="text-xs text-slate-400">{item.patient.mrn} · {item.results.length} test(s)</p>
                    </div>
                    <ChevronRight size={14} className="text-slate-300 shrink-0" />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT: Result Entry */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selectedOrder ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <FlaskConical size={32} className="mb-3" />
              <p className="text-sm font-medium">Select an order from the worklist</p>
              <p className="text-xs mt-1">Results will appear here for entry and verification</p>
            </div>
          ) : (
            <>
              {/* Order header */}
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-slate-800">{selectedOrder.orderNumber}</span>
                    <PriorityBadge priority={selectedOrder.priority as "ROUTINE" | "URGENT" | "STAT"} />
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedOrder.patient.firstName} {selectedOrder.patient.lastName} · {selectedOrder.patient.mrn}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => void qc.invalidateQueries({ queryKey: ["order-results", selectedOrderId] })}
                    className="p-1.5 hover:bg-slate-200 rounded"
                  >
                    <RefreshCw size={14} className="text-slate-500" />
                  </button>
                </div>
              </div>

              {/* Results table */}
              <div className="flex-1 overflow-auto">
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-white border-b border-slate-100 z-10">
                    <tr>
                      <th className="px-3 py-2.5 w-8" />
                      <th className="px-3 py-2.5 text-xs font-semibold text-slate-600">Parameter</th>
                      <th className="px-3 py-2.5 text-xs font-semibold text-slate-600">Barcode</th>
                      <th className="px-3 py-2.5 text-xs font-semibold text-slate-600">Value</th>
                      <th className="px-3 py-2.5 text-xs font-semibold text-slate-600">Ref Range</th>
                      <th className="px-3 py-2.5 text-xs font-semibold text-slate-600">Interpretation</th>
                      <th className="px-3 py-2.5 text-xs font-semibold text-slate-600">Delta</th>
                      <th className="px-3 py-2.5 text-xs font-semibold text-slate-600">Verified</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderLoading ? (
                      <tr><td colSpan={8} className="text-center py-8 text-slate-400">
                        <Loader2 size={20} className="animate-spin mx-auto" />
                      </td></tr>
                    ) : (() => {
                      const sorted = orderResults ?? [];
                      const rows: React.ReactNode[] = [];
                      let lastTestName = "";
                      for (const r of sorted) {
                        const testName = r.orderItem.testCatalog.name;
                        const hasParams = r.flags && r.flags !== r.value;
                        if (hasParams && testName !== lastTestName) {
                          rows.push(
                            <tr key={`header-${testName}`} className="bg-slate-50 border-b border-slate-100">
                              <td colSpan={8} className="px-3 py-2">
                                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                                  {testName}
                                </span>
                                <span className="ml-2 text-xs text-slate-400 font-mono">{r.orderItem.testCatalog.code}</span>
                              </td>
                            </tr>
                          );
                          lastTestName = testName;
                        }
                        rows.push(
                          <ResultRow
                            key={r.id}
                            result={r}
                            onValueChange={handleValueChange}
                            selected={selectedResultIds.includes(r.id)}
                            onToggleSelect={toggleSelect}
                          />
                        );
                      }
                      return rows;
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Action bar */}
              <div className="px-4 py-3 border-t border-slate-100 flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Save Draft
                </button>
                <button
                  onClick={() => verifyMutation.mutate(
                    selectedResultIds.length > 0 ? selectedResultIds : (orderResults ?? []).map((r) => r.id)
                  )}
                  disabled={verifyMutation.isPending}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  <CheckCircle size={14} className="inline mr-1" />
                  Verify {selectedResultIds.length > 0 ? `(${selectedResultIds.length})` : "All"}
                </button>
                <button
                  onClick={handleAutoVerify}
                  className="px-3 py-1.5 border border-green-200 text-green-700 rounded-lg text-sm hover:bg-green-50"
                >
                  Auto-Verify Normal
                </button>
                <button
                  onClick={() => setShowValidateModal(true)}
                  className="px-3 py-1.5 bg-[#1B4F8A] text-white rounded-lg text-sm font-medium hover:bg-[#163d6e]"
                >
                  Validate & Sign
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Validate modal */}
      {showValidateModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">Pathologist Validation</h3>
              <button onClick={() => setShowValidateModal(false)}><X size={18} /></button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-slate-600">
                Signing these results will mark them as pathologist-validated for order <span className="font-mono font-semibold">{selectedOrder?.orderNumber}</span>.
              </p>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Pathologist Notes (optional)</label>
                <textarea
                  value={pathNotes}
                  onChange={(e) => setPathNotes(e.target.value)}
                  rows={3}
                  placeholder="Any clinical observations or remarks..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20"
                />
              </div>
            </div>
            <div className="flex gap-2 p-4 border-t border-slate-100">
              <button onClick={() => setShowValidateModal(false)} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm">Cancel</button>
              <button
                onClick={() => validateMutation.mutate()}
                disabled={validateMutation.isPending}
                className="flex-1 px-4 py-2 bg-[#1B4F8A] text-white rounded-lg text-sm font-medium hover:bg-[#163d6e] disabled:opacity-50"
              >
                {validateMutation.isPending ? "Signing..." : "Sign & Validate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
