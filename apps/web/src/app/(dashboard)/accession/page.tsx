"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Scan,
  X,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  ThumbsDown,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Printer,
  ChevronDown,
  ChevronRight,
  Package,
  ClipboardPlus,
} from "lucide-react";
import { toast } from "sonner";
import { DataTable } from "@/components/tables/DataTable";
import { KPICard } from "@/components/shared/KPICard";
import { SearchInput } from "@/components/shared/SearchInput";
import { formatDateTime, cn } from "@/lib/utils";
import api from "@/lib/api";

// ── Types ────────────────────────────────────────────────────────────────────

interface AccessionOrder {
  id: string;
  orderNumber: string;
  priority: string;
  status: string;
  collectionType: string;
  createdAt: string;
  accessionedAt: string | null;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    mrn: string;
    gender: string | null;
    dob: string | null;
    phone: string;
  };
  items: Array<{
    id: string;
    testCatalog: {
      id: string;
      name: string;
      code: string;
      sampleType: string | null;
      department: string;
      turnaroundHours: number;
    };
  }>;
  samples: Array<{
    id: string;
    barcodeId: string;
    type: string;
    status: string;
    vacutainerType: string | null;
    volumeRequired: number | null;
    isStatSample: boolean;
  }>;
  invoices?: Array<{ id: string; invoiceNumber: string }>;
  branch?: { id: string; name: string };
  createdBy?: { firstName: string; lastName: string };
}

interface AccessionStats {
  pending: number;
  received: number;
  rejected: number;
  tatBreached: number;
}

type FilterTab = "ALL" | "WALK_IN" | "HOME_COLLECTION" | "B2B" | "STAT";
type StatusTab = "PENDING" | "RECEIVED_TODAY" | "REJECTED";

const REJECTION_REASONS = [
  "HEMOLYZED", "INSUFFICIENT_QUANTITY", "WRONG_TUBE", "CLOTTED_SAMPLE",
  "LIPEMIC_SAMPLE", "UNLABELED", "DAMAGED_CONTAINER", "IMPROPER_TRANSPORT",
  "EXPIRED_SAMPLE", "PATIENT_ID_MISMATCH",
];

const TUBE_COLORS: Record<string, { bg: string; text: string; emoji: string; label: string }> = {
  EDTA:     { bg: "bg-purple-100", text: "text-purple-700", emoji: "🟣", label: "Purple EDTA" },
  SERUM:    { bg: "bg-red-100",    text: "text-red-700",    emoji: "🔴", label: "Plain Red/Serum" },
  PLAIN:    { bg: "bg-red-100",    text: "text-red-700",    emoji: "🔴", label: "Plain Red" },
  CITRATE:  { bg: "bg-blue-100",   text: "text-blue-700",   emoji: "🔵", label: "Blue Citrate" },
  FLUORIDE: { bg: "bg-gray-100",   text: "text-gray-700",   emoji: "⚪", label: "Gray Fluoride" },
  HEPARIN:  { bg: "bg-green-100",  text: "text-green-700",  emoji: "🟢", label: "Green Heparin" },
  URINE:    { bg: "bg-yellow-100", text: "text-yellow-700", emoji: "🟡", label: "Urine Cup" },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function computeTATInfo(createdAt: string, tatHours: number) {
  const elapsed = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
  const remaining = Math.max(0, tatHours - elapsed);
  const pct = tatHours > 0 ? (remaining / tatHours) * 100 : 0;
  let color = "text-green-600 bg-green-50";
  if (pct <= 0) color = "text-red-600 bg-red-50 font-semibold";
  else if (pct < 30) color = "text-red-600 bg-red-50";
  else if (pct < 50) color = "text-amber-600 bg-amber-50";
  if (remaining <= 0) {
    const over = Math.abs(tatHours - elapsed);
    return { remaining: `-${Math.floor(over)}h ${Math.floor((over % 1) * 60)}m`, pct: 0, color };
  }
  return { remaining: `${Math.floor(remaining)}h ${Math.floor((remaining % 1) * 60)}m`, pct, color };
}

function getAgeGender(dob: string | null, gender: string | null): string {
  let age = "";
  if (dob) {
    const years = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    age = `${years}Y`;
  }
  const g = gender === "MALE" ? "M" : gender === "FEMALE" ? "F" : gender ? "O" : "";
  return [age, g].filter(Boolean).join("/") || "--";
}

function aggregateTubes(items: AccessionOrder["items"]) {
  const tubeMap: Record<string, { type: string; tests: string[]; volume: string }> = {};
  for (const item of items) {
    const st = (item.testCatalog.sampleType ?? "SERUM").toUpperCase();
    if (!tubeMap[st]) {
      tubeMap[st] = { type: st, tests: [], volume: "3ml" };
    }
    tubeMap[st].tests.push(item.testCatalog.name);
  }
  return Object.values(tubeMap);
}

// ── Reject Dialog ────────────────────────────────────────────────────────────

function RejectDialog({ order, onClose }: { order: AccessionOrder; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const qc = useQueryClient();

  const rejectMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/lab/accession/${order.id}/reject`, { reason, notes });
    },
    onSuccess: () => {
      toast.success(`Order ${order.orderNumber} rejected`);
      void qc.invalidateQueries({ queryKey: ["accession"] });
      void qc.invalidateQueries({ queryKey: ["accession-stats"] });
      onClose();
    },
    onError: () => toast.error("Failed to reject"),
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <XCircle size={18} className="text-red-500" />
            <h3 className="font-semibold text-slate-900">Reject Sample</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="p-4 space-y-4">
          <div className="text-sm text-slate-600">
            <span className="font-mono font-semibold">{order.orderNumber}</span> — {order.patient.firstName} {order.patient.lastName}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Rejection Reason *</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400">
              <option value="">Select reason...</option>
              {REJECTION_REASONS.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Additional notes..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400" />
          </div>
        </div>
        <div className="flex gap-2 p-4 border-t">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
          <button disabled={!reason || rejectMutation.isPending} onClick={() => rejectMutation.mutate()}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2">
            {rejectMutation.isPending && <Loader2 size={14} className="animate-spin" />}
            Reject Sample
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tube Aggregation View ────────────────────────────────────────────────────

function TubeAggregation({ order }: { order: AccessionOrder }) {
  const tubes = useMemo(() => aggregateTubes(order.items), [order.items]);

  return (
    <div className="p-3 bg-slate-50 rounded-lg space-y-2">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
        Tubes Required ({tubes.length})
      </p>
      {tubes.map((tube) => {
        const config = TUBE_COLORS[tube.type] ?? { bg: "bg-slate-100", text: "text-slate-600", emoji: "⚪", label: tube.type };
        return (
          <div key={tube.type} className="flex items-start gap-2">
            <span className={cn("px-2 py-0.5 rounded text-[10px] font-medium", config.bg, config.text)}>
              {config.emoji} {config.label}
            </span>
            <span className="text-xs text-slate-600 flex-1">
              Tests: {tube.tests.join(", ")}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Print Token ──────────────────────────────────────────────────────────────

function printToken(order: AccessionOrder) {
  const tubes = aggregateTubes(order.items);
  const testNames = order.items.map((i) => i.testCatalog.name).join(", ");
  const tubeLines = tubes.map((t) => {
    const config = TUBE_COLORS[t.type];
    return `${config?.emoji ?? "⚪"} 1 ${config?.label ?? t.type}`;
  }).join("\n");

  const html = `
    <html>
    <head>
      <style>
        @page { size: 80mm auto; margin: 4mm; }
        body { font-family: monospace; font-size: 11px; line-height: 1.6; margin: 0; padding: 8px; }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        hr { border: none; border-top: 1px dashed #000; margin: 4px 0; }
      </style>
    </head>
    <body>
      <div class="center bold">DELViON Health</div>
      <hr />
      <div class="bold">Token: ${order.orderNumber}</div>
      <div>Patient: ${order.patient.firstName} ${order.patient.lastName}</div>
      <div>MRN: ${order.patient.mrn}</div>
      <div>Date: ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
      <hr />
      <div class="bold">Tests:</div>
      <div>${testNames}</div>
      <hr />
      <div class="bold">Tubes:</div>
      <div>${tubeLines.replace(/\n/g, "<br/>")}</div>
      <hr />
      <div class="center" style="font-size:9px">Please proceed to sample collection</div>
    </body>
    </html>
  `;

  const w = window.open("", "_blank", "width=320,height=500");
  if (w) {
    w.document.write(html);
    w.document.close();
    w.print();
  }
}

// ── Order Detail Modal ───────────────────────────────────────────────────────

function OrderDetailModal({ order, onClose, onReceive, onReject }: {
  order: AccessionOrder;
  onClose: () => void;
  onReceive: () => void;
  onReject: () => void;
}) {
  const p = order.patient;
  const isPending = ["PENDING_COLLECTION", "SAMPLE_COLLECTED"].includes(order.status);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="font-semibold text-slate-900">Order Detail</h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">{order.orderNumber}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="bg-slate-50 rounded-lg p-3 space-y-1">
            <p className="text-sm font-semibold text-slate-900">{p.firstName} {p.lastName}</p>
            <div className="flex gap-4 text-xs text-slate-500">
              <span>MRN: <span className="font-mono">{p.mrn}</span></span>
              <span>{getAgeGender(p.dob, p.gender)}</span>
              <span>{p.phone}</span>
            </div>
          </div>

          {order.invoices?.[0] && (
            <div className="text-xs text-slate-500">
              Bill ID: <span className="font-mono font-medium text-slate-700">{order.invoices[0].invoiceNumber}</span>
            </div>
          )}

          <TubeAggregation order={order} />

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Tests ({order.items.length})
            </p>
            <div className="space-y-1.5">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-1.5 px-3 bg-slate-50 rounded-lg">
                  <span className="text-sm text-slate-700">{item.testCatalog.name}</span>
                  <span className="text-xs text-slate-400">{item.testCatalog.turnaroundHours}h TAT</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2 p-4 border-t">
          <button onClick={() => printToken(order)}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
            <Printer size={14} /> Print Token
          </button>
          <div className="flex-1" />
          {isPending && (
            <>
              <button onClick={onReject}
                className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
                Reject
              </button>
              <button onClick={onReceive}
                className="px-3 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700">
                Start Accession
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function AccessionPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const highlightOrderId = searchParams.get("orderId");

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [filterTab, setFilterTab] = useState<FilterTab>("ALL");
  const [statusTab, setStatusTab] = useState<StatusTab>("PENDING");
  const [scannerMode, setScannerMode] = useState(false);
  const [scanInput, setScanInput] = useState("");
  const [rejectOrder, setRejectOrder] = useState<AccessionOrder | null>(null);
  const [viewOrder, setViewOrder] = useState<AccessionOrder | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const scanRef = useRef<HTMLInputElement>(null);

  // ── Tube-by-tube accession state ─────────────────────────────────────────
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [accessioningOrder, setAccessioningOrder] = useState<any>(null);
  const [tubeData, setTubeData] = useState<any>(null);
  const [barcodes, setBarcodes] = useState<Record<string, string>>({});
  const [verified, setVerified] = useState<Record<string, boolean>>({});
  const [currentTubeIndex, setCurrentTubeIndex] = useState(0);
  const [submittingAccession, setSubmittingAccession] = useState(false);
  const barcodeInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const openAccession = async (orderId: string) => {
    try {
      const res = await api.get(`/lab/accession/order/${orderId}/tubes`);
      const d = res.data.data ?? res.data;
      setTubeData(d);
      setAccessioningOrder(d.order);
      setCurrentTubeIndex(0);
      const existing: Record<string, string> = {};
      const existingVerified: Record<string, boolean> = {};
      (d.tubes ?? []).forEach((tube: any) => {
        if (tube.existingBarcode) {
          existing[tube.tubeKey] = tube.existingBarcode;
          existingVerified[tube.tubeKey] = true;
        }
      });
      setBarcodes(existing);
      setVerified(existingVerified);
    } catch {
      toast.error("Failed to load tube information");
    }
  };

  // Auto-focus current tube input
  useEffect(() => {
    if (tubeData?.tubes && currentTubeIndex < tubeData.tubes.length) {
      const tube = tubeData.tubes[currentTubeIndex];
      setTimeout(() => barcodeInputRefs.current[tube.tubeKey]?.focus(), 100);
    }
  }, [currentTubeIndex, tubeData]);

  // Auto-open accession panel from URL orderId param
  useEffect(() => {
    if (highlightOrderId) {
      openAccession(highlightOrderId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightOrderId]);

  const handleBarcodeInput = (tubeKey: string, value: string) => {
    setBarcodes((prev) => ({ ...prev, [tubeKey]: value }));
    setVerified((prev) => ({ ...prev, [tubeKey]: false }));
  };

  const verifyBarcode = (tubeKey: string) => {
    const barcode = barcodes[tubeKey]?.trim();
    if (!barcode || barcode.length < 4) {
      toast.error("Barcode too short — minimum 4 characters");
      return;
    }
    const others = Object.entries(barcodes).filter(([k, v]) => k !== tubeKey && v?.trim() === barcode);
    if (others.length > 0) {
      toast.error("Duplicate barcode — same barcode used for another tube");
      return;
    }
    setVerified((prev) => ({ ...prev, [tubeKey]: true }));
    toast.success(`${tubeKey} barcode verified`);
    const nextIdx = (tubeData?.tubes ?? []).findIndex(
      (t: any, i: number) => i > currentTubeIndex && !verified[t.tubeKey]
    );
    if (nextIdx >= 0) setCurrentTubeIndex(nextIdx);
  };

  const allTubesVerified = tubeData?.tubes?.every(
    (t: any) => verified[t.tubeKey] && barcodes[t.tubeKey]?.trim()
  ) ?? false;

  const handleSubmitAccession = async () => {
    if (!allTubesVerified) {
      toast.error("Verify all tube barcodes before submitting");
      return;
    }
    setSubmittingAccession(true);
    try {
      const tubes = tubeData.tubes.map((tube: any) => ({
        tubeKey: tube.tubeKey,
        barcode: barcodes[tube.tubeKey].trim(),
        testIds: tube.tests.map((t: any) => t.id),
      }));
      await api.post("/lab/accession/submit", { orderId: accessioningOrder.id, tubes });
      toast.success("Accession complete! Samples collected and sent to lab queue.");
      setAccessioningOrder(null);
      setTubeData(null);
      setBarcodes({});
      setVerified({});
      void qc.invalidateQueries({ queryKey: ["accession"] });
      void qc.invalidateQueries({ queryKey: ["accession-stats"] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Accession submission failed");
    } finally {
      setSubmittingAccession(false);
    }
  };
  /* eslint-enable @typescript-eslint/no-explicit-any */

  useEffect(() => { if (scannerMode) scanRef.current?.focus(); }, [scannerMode]);

  // Highlight order from URL param
  useEffect(() => {
    if (highlightOrderId) {
      setExpandedRows(new Set([highlightOrderId]));
    }
  }, [highlightOrderId]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["accession-stats"],
    queryFn: async () => {
      try {
        const res = await api.get<{ data: AccessionStats }>("/lab/accession/stats");
        return res.data.data ?? res.data as unknown as AccessionStats;
      } catch { return { pending: 0, received: 0, rejected: 0, tatBreached: 0 }; }
    },
    refetchInterval: 30000,
  });

  // ── Accession list ─────────────────────────────────────────────────────────
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["accession", search, page, filterTab, statusTab],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      if (filterTab !== "ALL") {
        if (filterTab === "STAT") params.set("priority", "STAT");
        else params.set("collectionType", filterTab);
      }
      if (statusTab === "PENDING") params.set("status", "PENDING_COLLECTION,SAMPLE_COLLECTED");
      else if (statusTab === "RECEIVED_TODAY") params.set("status", "RECEIVED");
      else if (statusTab === "REJECTED") params.set("status", "SAMPLE_REJECTED");

      try {
        const res = await api.get(`/lab/accession?${params.toString()}`);
        const raw = res.data.data ?? res.data;
        if (Array.isArray(raw)) return { data: raw as AccessionOrder[], meta: { total: raw.length } };
        return raw as { data: AccessionOrder[]; meta: { total: number } };
      } catch {
        return { data: [] as AccessionOrder[], meta: { total: 0 } };
      }
    },
    refetchInterval: 30000,
  });

  // ── Receive mutation ───────────────────────────────────────────────────────
  const receiveMutation = useMutation({
    mutationFn: async (orderId: string) => {
      try { await api.post(`/lab/accession/${orderId}/receive`); }
      catch { await api.put(`/orders/${orderId}/status`, { status: "RECEIVED" }); }
    },
    onSuccess: () => {
      toast.success("Order received and accessioned");
      void qc.invalidateQueries({ queryKey: ["accession"] });
      void qc.invalidateQueries({ queryKey: ["accession-stats"] });
      setViewOrder(null);
    },
    onError: () => toast.error("Failed to receive"),
  });

  // ── Scan handler ───────────────────────────────────────────────────────────
  const handleScan = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && scanInput.trim()) {
      const barcode = scanInput.trim();
      setScanInput("");
      setSearch(barcode);
      toast.info(`Searching for ${barcode}...`);
    }
  }, [scanInput]);

  // ── Toggle row expand ──────────────────────────────────────────────────────
  const toggleExpand = useCallback((id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const FILTER_TABS: { label: string; value: FilterTab }[] = [
    { label: "All", value: "ALL" },
    { label: "Walk-in", value: "WALK_IN" },
    { label: "Home Collection", value: "HOME_COLLECTION" },
    { label: "B2B", value: "B2B" },
    { label: "STAT", value: "STAT" },
  ];

  const STATUS_TABS: { label: string; value: StatusTab }[] = [
    { label: "Pending", value: "PENDING" },
    { label: "Received Today", value: "RECEIVED_TODAY" },
    { label: "Rejected", value: "REJECTED" },
  ];

  const orders = data?.data ?? [];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Accession</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            {" "}&middot; Auto-refreshes every 30s
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/registration?mode=trf")}
            className="flex items-center gap-2 px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <ClipboardPlus size={14} /> TRF Sample In
          </button>
          <button onClick={() => setScannerMode((v) => !v)}
            className={cn("flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors",
              scannerMode ? "bg-teal-600 text-white border-teal-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50")}>
            <Scan size={14} /> Scan Mode
          </button>
          <button onClick={() => void refetch()}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Scanner bar */}
      {scannerMode && (
        <div className="flex items-center gap-3 p-3 bg-teal-50 border border-teal-200 rounded-lg">
          <Scan size={16} className="text-teal-600 shrink-0" />
          <input ref={scanRef} value={scanInput} onChange={(e) => setScanInput(e.target.value)} onKeyDown={handleScan}
            placeholder="Scan barcode or type barcode ID and press Enter..."
            autoFocus className="flex-1 bg-white border border-teal-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 font-mono" />
          <button onClick={() => setScannerMode(false)} className="text-teal-600 hover:text-teal-800"><X size={16} /></button>
        </div>
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard title="Pending" value={stats?.pending ?? 0} icon={Clock} iconColor="bg-yellow-100 text-yellow-600" isLoading={statsLoading} />
        <KPICard title="Received Today" value={stats?.received ?? 0} icon={CheckCircle2} iconColor="bg-green-100 text-green-600" isLoading={statsLoading} />
        <KPICard title="Rejected" value={stats?.rejected ?? 0} icon={ThumbsDown} iconColor="bg-red-100 text-red-600" isLoading={statsLoading} />
        <KPICard title="TAT Breached" value={stats?.tatBreached ?? 0} icon={AlertTriangle} iconColor="bg-orange-100 text-orange-600" isLoading={statsLoading} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {FILTER_TABS.map((tab) => (
          <button key={tab.value} onClick={() => { setFilterTab(tab.value); setPage(1); }}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              filterTab === tab.value ? "bg-[#1B4F8A] text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50")}>
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex gap-1.5">
        {STATUS_TABS.map((tab) => (
          <button key={tab.value} onClick={() => { setStatusTab(tab.value); setPage(1); }}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              statusTab === tab.value
                ? tab.value === "REJECTED" ? "bg-red-600 text-white" : tab.value === "RECEIVED_TODAY" ? "bg-green-600 text-white" : "bg-[#0D7E8A] text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50")}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search by order #, barcode, patient name or MRN..." />

      {/* Orders with Tube Aggregation */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-slate-400" /></div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">No orders found</div>
        ) : (
          orders.map((order) => {
            const isExpanded = expandedRows.has(order.id);
            const isHighlighted = order.id === highlightOrderId;
            const isPending = ["PENDING_COLLECTION", "SAMPLE_COLLECTED"].includes(order.status);
            const maxTat = Math.max(...order.items.map((i) => i.testCatalog.turnaroundHours), 1);
            const tat = computeTATInfo(order.createdAt, maxTat);
            const tubes = aggregateTubes(order.items);

            return (
              <div key={order.id} className={cn(
                "bg-white rounded-xl card-shadow overflow-hidden transition-all",
                isHighlighted && "ring-2 ring-[#0D7E8A]"
              )}>
                {/* Row */}
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50/50" onClick={() => toggleExpand(order.id)}>
                  <button className="text-slate-400 shrink-0">
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>

                  <div className="w-20 text-xs text-slate-500">
                    {new Date(order.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </div>

                  <div className="w-32">
                    <span className="font-mono text-xs font-semibold text-[#1B4F8A]">{order.orderNumber}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 text-sm truncate">
                      {order.patient.firstName} {order.patient.lastName}
                    </p>
                    <p className="text-xs text-slate-400">
                      {order.patient.mrn} · {getAgeGender(order.patient.dob, order.patient.gender)}
                    </p>
                  </div>

                  <div className="flex gap-1 flex-wrap max-w-[120px]">
                    {tubes.map((t) => {
                      const cfg = TUBE_COLORS[t.type];
                      return (
                        <span key={t.type} className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", cfg?.bg ?? "bg-slate-100", cfg?.text ?? "text-slate-600")}>
                          {cfg?.emoji ?? "⚪"} {t.tests.length}
                        </span>
                      );
                    })}
                  </div>

                  <div className="w-24 text-xs text-slate-500">
                    {order.items.length} tests
                  </div>

                  <span className={cn("inline-flex px-2 py-0.5 rounded text-xs font-mono font-medium", tat.color)}>
                    {tat.remaining}
                  </span>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isPending && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); openAccession(order.id); }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-teal-600 text-white text-xs font-medium rounded-lg hover:bg-teal-700">
                          <Scan size={12} /> Accession
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setRejectOrder(order); }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700">
                          <XCircle size={12} />
                        </button>
                      </>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); setViewOrder(order); }}
                      className="p-1.5 text-slate-400 hover:text-[#1B4F8A] hover:bg-slate-100 rounded-lg">
                      <Eye size={14} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); printToken(order); }}
                      className="p-1.5 text-slate-400 hover:text-[#1B4F8A] hover:bg-slate-100 rounded-lg" title="Print Token">
                      <Printer size={14} />
                    </button>
                  </div>
                </div>

                {/* Expanded: Tube Aggregation */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-slate-100 pt-3">
                    <TubeAggregation order={order} />
                    {order.invoices?.[0] && (
                      <p className="mt-2 text-xs text-slate-400">
                        Bill: <span className="font-mono text-slate-600">{order.invoices[0].invoiceNumber}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {(data?.meta.total ?? 0) > 20 && (
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-slate-400">
            Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, data?.meta.total ?? 0)} of {data?.meta.total}
          </span>
          <div className="flex gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs disabled:opacity-50 hover:bg-slate-50">
              Previous
            </button>
            <button onClick={() => setPage((p) => p + 1)} disabled={page * 20 >= (data?.meta.total ?? 0)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs disabled:opacity-50 hover:bg-slate-50">
              Next
            </button>
          </div>
        </div>
      )}

      {/* ── TUBE-BY-TUBE ACCESSION PANEL ── */}
      {accessioningOrder && tubeData && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40" onClick={() => setAccessioningOrder(null)} />
          <div className="w-full max-w-2xl bg-white flex flex-col h-full shadow-2xl overflow-y-auto">
            {/* Header */}
            <div className="bg-teal-700 text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div>
                <p className="text-xs opacity-70 uppercase tracking-wide mb-0.5">Accession</p>
                <p className="font-bold text-lg font-mono">{accessioningOrder.orderNumber ?? accessioningOrder.id}</p>
                <p className="text-sm opacity-80">
                  {accessioningOrder.patient?.firstName} {accessioningOrder.patient?.lastName} &middot; MRN: {accessioningOrder.patient?.mrn}
                </p>
              </div>
              <button onClick={() => setAccessioningOrder(null)} className="text-white/70 hover:text-white text-2xl">&times;</button>
            </div>

            {/* Progress indicator */}
            <div className="px-6 py-3 bg-gray-50 border-b flex items-center gap-2 shrink-0">
              {tubeData.tubes.map((tube: any, i: number) => (
                <div key={tube.tubeKey} className="flex items-center gap-1">
                  <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition",
                    verified[tube.tubeKey] ? "bg-emerald-500 text-white" :
                      i === currentTubeIndex ? "bg-teal-700 text-white ring-2 ring-teal-300" :
                        "bg-gray-200 text-gray-500")}>
                    {verified[tube.tubeKey] ? <CheckCircle2 size={14} /> : i + 1}
                  </div>
                  {i < tubeData.tubes.length - 1 && (
                    <div className={cn("w-6 h-0.5", verified[tube.tubeKey] ? "bg-emerald-400" : "bg-gray-200")} />
                  )}
                </div>
              ))}
              <span className="ml-3 text-xs text-gray-500">
                {Object.values(verified).filter(Boolean).length} / {tubeData.tubes.length} verified
              </span>
            </div>

            {/* Tubes */}
            <div className="flex-1 px-6 py-4 space-y-4 overflow-y-auto">
              {tubeData.tubes.map((tube: any, i: number) => {
                const isCurrent = i === currentTubeIndex;
                const isVerified = verified[tube.tubeKey];

                const TUBE_PANEL_COLORS: Record<string, { bg: string; border: string; dot: string }> = {
                  EDTA:           { bg: "bg-purple-50", border: "border-purple-300", dot: "bg-purple-500" },
                  SERUM:          { bg: "bg-red-50",    border: "border-red-300",    dot: "bg-red-500" },
                  NASOPHARYNGEAL: { bg: "bg-orange-50", border: "border-orange-300", dot: "bg-orange-500" },
                  URINE:          { bg: "bg-yellow-50", border: "border-yellow-300", dot: "bg-yellow-500" },
                  STOOL:          { bg: "bg-amber-50",  border: "border-amber-300",  dot: "bg-amber-700" },
                  CSF:            { bg: "bg-blue-50",   border: "border-blue-300",   dot: "bg-blue-500" },
                  HEPARIN:        { bg: "bg-green-50",  border: "border-green-300",  dot: "bg-green-500" },
                  CITRATE:        { bg: "bg-blue-50",   border: "border-blue-300",   dot: "bg-blue-500" },
                  FLUORIDE:       { bg: "bg-gray-50",   border: "border-gray-300",   dot: "bg-gray-500" },
                };
                const colors = TUBE_PANEL_COLORS[tube.tubeKey] ?? { bg: "bg-gray-50", border: "border-gray-300", dot: "bg-gray-400" };

                return (
                  <div
                    key={tube.tubeKey}
                    onClick={() => setCurrentTubeIndex(i)}
                    className={cn("border-2 rounded-2xl overflow-hidden transition cursor-pointer",
                      isVerified ? "border-emerald-400 bg-emerald-50/30" :
                        isCurrent ? `${colors.border} ${colors.bg} shadow-lg` :
                          "border-gray-200 bg-white hover:border-gray-300")}
                  >
                    {/* Tube header */}
                    <div className={cn("flex items-center gap-3 px-5 py-3 border-b",
                      isVerified ? "border-emerald-200 bg-emerald-50" :
                        isCurrent ? `${colors.border} ${colors.bg}` : "border-gray-100")}>
                      <div className={cn("w-4 h-4 rounded-full", isVerified ? "bg-emerald-500" : colors.dot)} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={cn("font-bold text-sm", isCurrent && !isVerified ? "text-gray-800" : "text-gray-600")}>
                            Tube {i + 1} of {tubeData.tubes.length}
                          </span>
                          {isCurrent && !isVerified && (
                            <span className="text-xs bg-teal-700 text-white px-2 py-0.5 rounded-full animate-pulse">SCAN NOW</span>
                          )}
                          {isVerified && (
                            <span className="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded-full">VERIFIED</span>
                          )}
                        </div>
                        <p className={cn("font-semibold", isVerified ? "text-emerald-700" : isCurrent ? "text-gray-900" : "text-gray-600")}>
                          {tube.label}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Tests: {tube.tests.map((t: any) => t.name).join(" \u00b7 ")}
                        </p>
                      </div>
                    </div>

                    {/* Barcode input */}
                    {(isCurrent || isVerified) && (
                      <div className="px-5 py-4">
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                          {isVerified ? "Barcode" : "Scan or type barcode:"}
                        </label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Scan size={14} className="absolute left-3 top-3 text-gray-400" />
                            <input
                              ref={(el) => { barcodeInputRefs.current[tube.tubeKey] = el; }}
                              type="text"
                              className={cn("w-full pl-8 pr-3 py-2.5 border-2 rounded-xl font-mono text-sm focus:outline-none",
                                isVerified ? "border-emerald-300 bg-emerald-50 text-emerald-800" :
                                  isCurrent ? "border-teal-400 bg-white focus:border-teal-600" :
                                    "border-gray-200 bg-gray-50")}
                              placeholder={`Scan ${tube.label} barcode...`}
                              value={barcodes[tube.tubeKey] ?? ""}
                              onChange={(e) => handleBarcodeInput(tube.tubeKey, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && barcodes[tube.tubeKey]?.trim()) {
                                  verifyBarcode(tube.tubeKey);
                                }
                              }}
                              disabled={isVerified}
                              autoComplete="off"
                            />
                          </div>
                          {!isVerified ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); verifyBarcode(tube.tubeKey); }}
                              disabled={!barcodes[tube.tubeKey]?.trim()}
                              className="px-4 py-2.5 bg-teal-700 text-white rounded-xl text-sm font-semibold disabled:opacity-40 hover:bg-teal-800 whitespace-nowrap"
                            >
                              Verify
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setVerified((prev) => ({ ...prev, [tube.tubeKey]: false }));
                                setCurrentTubeIndex(i);
                                setTimeout(() => barcodeInputRefs.current[tube.tubeKey]?.focus(), 50);
                              }}
                              className="px-4 py-2.5 border border-gray-300 text-gray-500 rounded-xl text-sm hover:bg-gray-50 whitespace-nowrap"
                            >
                              Re-scan
                            </button>
                          )}
                        </div>
                        {isVerified && barcodes[tube.tubeKey] && (
                          <p className="text-xs text-emerald-600 mt-1.5 font-mono">{barcodes[tube.tubeKey]}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Submit footer */}
            <div className="px-6 py-5 border-t bg-white shrink-0">
              {!allTubesVerified && (
                <p className="text-xs text-amber-600 text-center mb-3">
                  Verify all {tubeData.tubes.length} tube{tubeData.tubes.length !== 1 ? "s" : ""} before submitting
                </p>
              )}
              <button
                onClick={handleSubmitAccession}
                disabled={!allTubesVerified || submittingAccession}
                className={cn("w-full py-4 rounded-xl font-bold text-base transition",
                  allTubesVerified && !submittingAccession
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed")}
              >
                {submittingAccession
                  ? "Submitting..."
                  : allTubesVerified
                    ? `Submit Accession \u2014 ${tubeData.tubes.length} Tube${tubeData.tubes.length !== 1 ? "s" : ""}`
                    : `Complete all ${tubeData.tubes.length - Object.values(verified).filter(Boolean).length} remaining tubes`}
              </button>
              <p className="text-xs text-center text-gray-400 mt-2">
                Submitting will create sample records and send to lab processing queue
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {rejectOrder && <RejectDialog order={rejectOrder} onClose={() => setRejectOrder(null)} />}
      {viewOrder && (
        <OrderDetailModal
          order={viewOrder}
          onClose={() => setViewOrder(null)}
          onReceive={() => { setViewOrder(null); openAccession(viewOrder.id); }}
          onReject={() => { setViewOrder(null); setRejectOrder(viewOrder); }}
        />
      )}
    </div>
  );
}
