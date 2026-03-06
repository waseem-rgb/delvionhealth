"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
  DndContext,
  type DragEndEvent,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import {
  FlaskConical,
  Search,
  RefreshCw,
  Barcode,
  LayoutGrid,
  List,
  Scan,
  X,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/tables/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PriorityBadge } from "@/components/shared/PriorityBadge";
import { formatTAT, formatDateTime } from "@/lib/utils";
import api from "@/lib/api";

interface TatPrediction {
  predictedHours: number;
  expectedAt: string;
  expectedAtDisplay: string;
  message: string;
  confidence: number;
}

interface Sample {
  id: string;
  barcodeId: string;
  type: string;
  status: string;
  location?: string | null;
  collectedAt?: string | null;
  createdAt: string;
  notes?: string | null;
  order: {
    orderNumber: string;
    priority: string;
    createdAt: string;
    _count: { items: number };
    patient: { firstName: string; lastName: string; mrn: string };
  };
  branch?: { name: string };
  tatPrediction?: TatPrediction | null;
}

interface SampleCounts {
  pendingCollection: number;
  collected: number;
  inTransit: number;
  received: number;
  processing: number;
  stored: number;
  rejected: number;
}

type ModalType = "collect" | "move" | "reject" | "custody" | null;

const KANBAN_COLUMNS: { key: string; label: string; status: string }[] = [
  { key: "PENDING_COLLECTION", label: "Pending Collection", status: "PENDING_COLLECTION" },
  { key: "COLLECTED",          label: "Collected",          status: "COLLECTED" },
  { key: "IN_TRANSIT",         label: "In Transit",         status: "IN_TRANSIT" },
  { key: "RECEIVED",           label: "Received",           status: "RECEIVED" },
  { key: "PROCESSING",         label: "Processing",         status: "PROCESSING" },
];

const STATUS_TABS = ["ALL", "PENDING_COLLECTION", "COLLECTED", "IN_TRANSIT", "RECEIVED", "PROCESSING", "STORED", "REJECTED"];

// ─── Draggable Card ──────────────────────────────────────────────────────────
function DraggableSampleCard({
  sample,
  onAction,
}: {
  sample: Sample;
  onAction: (s: Sample, type: ModalType) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: sample.id,
    data: { sample },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px,${transform.y}px,0)`, opacity: isDragging ? 0.5 : 1 }
    : undefined;

  const priority = sample.order.priority as "ROUTINE" | "URGENT" | "STAT";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="bg-white border border-slate-200 rounded-lg p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-xs font-semibold text-slate-700">{sample.barcodeId}</span>
        <PriorityBadge priority={priority} />
      </div>
      <p className="text-xs font-medium text-slate-800">
        {sample.order.patient.firstName} {sample.order.patient.lastName}
      </p>
      <p className="text-xs text-slate-400">{sample.order.patient.mrn}</p>
      <div className="flex items-center justify-between mt-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-slate-400">{formatTAT(sample.order.createdAt)}</span>
          {sample.tatPrediction && (
            <span className="text-[10px] font-medium text-teal-600 leading-tight">
              {sample.tatPrediction.expectedAtDisplay || sample.tatPrediction.message}
            </span>
          )}
        </div>
        <div className="flex gap-1">
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onAction(sample, "collect"); }}
            className="text-xs text-teal-600 hover:underline"
          >
            Action
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Droppable Column ────────────────────────────────────────────────────────
function KanbanColumn({
  column,
  samples,
  onAction,
}: {
  column: { key: string; label: string; status: string };
  samples: Sample[];
  onAction: (s: Sample, type: ModalType) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.key });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col gap-2 min-h-[200px] p-3 rounded-xl border-2 transition-colors ${
        isOver ? "border-teal-400 bg-teal-50" : "border-slate-200 bg-slate-50"
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
          {column.label}
        </span>
        <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-medium">
          {samples.length}
        </span>
      </div>
      {samples.map((s) => (
        <DraggableSampleCard key={s.id} sample={s} onAction={onAction} />
      ))}
    </div>
  );
}

// ─── Table Columns ───────────────────────────────────────────────────────────
function buildColumns(onAction: (s: Sample, type: ModalType) => void): ColumnDef<Sample>[] {
  return [
    {
      accessorKey: "barcodeId",
      header: "Barcode",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Barcode size={14} className="text-slate-400" />
          <span className="font-mono text-xs font-semibold text-slate-700">
            {row.original.barcodeId}
          </span>
        </div>
      ),
    },
    {
      id: "patient",
      header: "Patient",
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-slate-900 text-sm">
            {row.original.order.patient.firstName} {row.original.order.patient.lastName}
          </p>
          <p className="text-xs text-slate-400">{row.original.order.patient.mrn}</p>
        </div>
      ),
    },
    {
      id: "order",
      header: "Order",
      cell: ({ row }) => (
        <Link
          href={`/orders/${row.original.order.orderNumber}`}
          className="text-xs text-[#1B4F8A] hover:underline font-mono"
        >
          {row.original.order.orderNumber}
        </Link>
      ),
    },
    {
      id: "tests",
      header: "Tests",
      cell: ({ row }) => (
        <span className="text-sm text-slate-600">{row.original.order._count.items}</span>
      ),
    },
    {
      id: "priority",
      header: "Priority",
      cell: ({ row }) => (
        <PriorityBadge priority={row.original.order.priority as "ROUTINE" | "URGENT" | "STAT"} />
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "tat",
      header: "TAT",
      cell: ({ row }) => (
        <span className="text-xs font-mono text-slate-500">
          {formatTAT(row.original.order.createdAt)}
        </span>
      ),
    },
    {
      accessorKey: "location",
      header: "Location",
      cell: ({ row }) => (
        <span className="text-sm text-slate-500">{row.original.location ?? "—"}</span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => onAction(row.original, "collect")}
            className="text-xs text-teal-600 hover:underline font-medium"
          >
            Update
          </button>
          <button
            onClick={() => onAction(row.original, "custody")}
            className="text-xs text-slate-500 hover:underline"
          >
            Custody
          </button>
          <Link href={`/samples/${row.original.id}`} className="text-xs text-[#1B4F8A] hover:underline font-medium">
            View
          </Link>
        </div>
      ),
    },
  ];
}

// ─── Status Update Modal ─────────────────────────────────────────────────────
function ActionModal({
  sample,
  modalType,
  onClose,
}: {
  sample: Sample;
  modalType: ModalType;
  onClose: () => void;
}) {
  const [location, setLocation] = useState(sample.location ?? "");
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");
  const [custodyData, setCustodyData] = useState<unknown[]>([]);
  const qc = useQueryClient();

  const statusMutation = useMutation({
    mutationFn: async (status: string) => {
      await api.put(`/samples/${sample.id}/status`, { status, location, notes });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["samples"] });
      void qc.invalidateQueries({ queryKey: ["sample-counts"] });
      onClose();
    },
  });

  const moveMutation = useMutation({
    mutationFn: async () => {
      await api.put(`/samples/${sample.id}/move`, { toLocation: location, notes });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["samples"] });
      onClose();
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      await api.put(`/samples/${sample.id}/reject`, { reason, notes });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["samples"] });
      void qc.invalidateQueries({ queryKey: ["sample-counts"] });
      onClose();
    },
  });

  useEffect(() => {
    if (modalType === "custody") {
      void api
        .get<{ data: unknown[] }>(`/samples/${sample.id}/custody`)
        .then((r) => setCustodyData(r.data.data ?? r.data));
    }
  }, [modalType, sample.id]);

  if (modalType === "custody") {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900">Chain of Custody — {sample.barcodeId}</h3>
            <button onClick={onClose}><X size={18} /></button>
          </div>
          <div className="p-4 max-h-96 overflow-y-auto space-y-3">
            {(custodyData as Array<{ movedAt: string; fromLocation?: string; toLocation: string; notes?: string; movedBy?: { firstName: string; lastName: string } }>).map((m, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-2 h-2 rounded-full bg-teal-500 mt-1.5 shrink-0" />
                <div>
                  <p className="text-sm text-slate-700">
                    {m.fromLocation ? `${m.fromLocation} → ` : ""}{m.toLocation}
                  </p>
                  <p className="text-xs text-slate-400">
                    {m.movedBy ? `${m.movedBy.firstName} ${m.movedBy.lastName}` : ""} · {formatDateTime(m.movedAt)}
                  </p>
                  {m.notes && <p className="text-xs text-slate-500 italic">{m.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const NEXT_STATUS: Record<string, string> = {
    PENDING_COLLECTION: "COLLECTED",
    COLLECTED: "IN_TRANSIT",
    IN_TRANSIT: "RECEIVED",
    RECEIVED: "PROCESSING",
    PROCESSING: "STORED",
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">
            {modalType === "collect" ? "Update Sample Status" :
             modalType === "move" ? "Move Sample" : "Reject Sample"}
          </h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="p-4 space-y-4">
          <div className="text-sm text-slate-600">
            <span className="font-mono font-semibold">{sample.barcodeId}</span>{" "}
            — {sample.order.patient.firstName} {sample.order.patient.lastName}
          </div>

          {modalType === "reject" && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Rejection Reason *</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20"
              >
                <option value="">Select reason...</option>
                <option>Haemolysed sample</option>
                <option>Incorrect tube</option>
                <option>Insufficient volume</option>
                <option>Clotted sample</option>
                <option>Lipemic sample</option>
                <option>Unlabeled specimen</option>
              </select>
            </div>
          )}

          {(modalType === "collect" || modalType === "move") && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Location</label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Centrifuge Room 2"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20"
            />
          </div>
        </div>
        <div className="flex gap-2 p-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            disabled={
              (modalType === "reject" && !reason) ||
              statusMutation.isPending || moveMutation.isPending || rejectMutation.isPending
            }
            onClick={() => {
              if (modalType === "collect") {
                const next = NEXT_STATUS[sample.status] ?? sample.status;
                statusMutation.mutate(next);
              } else if (modalType === "move") {
                moveMutation.mutate();
              } else {
                rejectMutation.mutate();
              }
            }}
            className="flex-1 px-4 py-2 bg-[#1B4F8A] text-white rounded-lg text-sm font-medium hover:bg-[#163d6e] disabled:opacity-50"
          >
            {modalType === "reject" ? "Reject Sample" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function SamplesPage() {
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"table" | "kanban">("table");
  const [scannerMode, setScannerMode] = useState(false);
  const [scanInput, setScanInput] = useState("");
  const [activeModal, setActiveModal] = useState<{ sample: Sample; type: ModalType } | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  useEffect(() => {
    if (scannerMode) scanRef.current?.focus();
  }, [scannerMode]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["samples", statusFilter, search, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        ...(search && { search }),
        ...(statusFilter !== "ALL" && { status: statusFilter }),
      });
      const res = await api.get<{ success: boolean; data: { data: Sample[]; meta: { total: number; totalPages: number } } }>(
        `/samples?${params.toString()}`
      );
      return res.data.data; // unwrap TransformInterceptor
    },
    refetchInterval: 30000,
  });

  const { data: counts } = useQuery({
    queryKey: ["sample-counts"],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: SampleCounts }>("/samples/counts");
      return res.data.data; // unwrap TransformInterceptor
    },
    refetchInterval: 30000,
  });

  const { data: queueData } = useQuery({
    queryKey: ["sample-queue"],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Sample[] }>("/samples/queue");
      return res.data.data; // unwrap TransformInterceptor
    },
    enabled: view === "kanban",
    refetchInterval: 15000,
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await api.put(`/samples/${id}/status`, { status });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["sample-queue"] });
      void qc.invalidateQueries({ queryKey: ["sample-counts"] });
    },
  });

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const newStatus = over.id as string;
      statusMutation.mutate({ id: active.id as string, status: newStatus });
    },
    [statusMutation]
  );

  const handleScan = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && scanInput.trim()) {
        setSearch(scanInput.trim());
        setScanInput("");
        setView("table");
      }
    },
    [scanInput]
  );

  const kanbanSamples = queueData ?? [];

  const columns = buildColumns((sample, type) => setActiveModal({ sample, type }));

  const countChips = [
    { label: "Pending", count: counts?.pendingCollection ?? 0, color: "bg-yellow-100 text-yellow-700" },
    { label: "Collected", count: counts?.collected ?? 0, color: "bg-blue-100 text-blue-700" },
    { label: "In Transit", count: counts?.inTransit ?? 0, color: "bg-purple-100 text-purple-700" },
    { label: "Received", count: counts?.received ?? 0, color: "bg-indigo-100 text-indigo-700" },
    { label: "Processing", count: counts?.processing ?? 0, color: "bg-orange-100 text-orange-700" },
    { label: "Rejected", count: counts?.rejected ?? 0, color: "bg-red-100 text-red-700" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sample Queue</h1>
          <p className="text-sm text-slate-500 mt-1">
            {data?.meta.total ?? 0} samples · Auto-refreshes every 30s
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex border border-slate-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setView("table")}
              className={`p-2 ${view === "table" ? "bg-[#1B4F8A] text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
            >
              <List size={16} />
            </button>
            <button
              onClick={() => setView("kanban")}
              className={`p-2 ${view === "kanban" ? "bg-[#1B4F8A] text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
            >
              <LayoutGrid size={16} />
            </button>
          </div>
          {/* Scanner mode */}
          <button
            onClick={() => setScannerMode((v) => !v)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
              scannerMode
                ? "bg-teal-600 text-white border-teal-600"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Scan size={14} />
            Scanner
          </button>
          <button
            onClick={() => void refetch()}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {/* Scanner input (hidden, only captures keystrokes when scanner mode on) */}
      {scannerMode && (
        <div className="flex items-center gap-3 p-3 bg-teal-50 border border-teal-200 rounded-lg">
          <AlertCircle size={16} className="text-teal-600 shrink-0" />
          <span className="text-sm text-teal-700 font-medium">Scanner mode active — scan a barcode to search</span>
          <input
            ref={scanRef}
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            onKeyDown={handleScan}
            className="sr-only"
            aria-label="barcode scanner input"
          />
          <button onClick={() => setScannerMode(false)} className="ml-auto text-teal-600">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Count chips */}
      <div className="flex gap-2 flex-wrap">
        {countChips.map((c) => (
          <span key={c.label} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${c.color}`}>
            {c.label}
            <span className="bg-white/60 px-1.5 py-0.5 rounded-full text-xs">{c.count}</span>
          </span>
        ))}
      </div>

      {/* Table view */}
      {view === "table" && (
        <>
          {/* Status tabs */}
          <div className="flex gap-1 flex-wrap">
            {STATUS_TABS.map((status) => (
              <button
                key={status}
                onClick={() => { setStatusFilter(status); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  statusFilter === status
                    ? "bg-[#1B4F8A] text-white"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {status === "ALL" ? "All" : status.replace(/_/g, " ")}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by barcode, patient name or MRN..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20 focus:border-[#1B4F8A] bg-white"
            />
          </div>

          <div className="bg-white rounded-xl card-shadow overflow-hidden">
            <DataTable
              columns={columns}
              data={data?.data ?? []}
              total={data?.meta.total}
              page={page}
              pageSize={20}
              onPageChange={setPage}
              isLoading={isLoading}
            />
          </div>
        </>
      )}

      {/* Kanban view */}
      {view === "kanban" && (
        <DndContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-5 gap-3 overflow-x-auto">
            {KANBAN_COLUMNS.map((col) => (
              <KanbanColumn
                key={col.key}
                column={col}
                samples={kanbanSamples.filter((s) => s.status === col.status)}
                onAction={(sample, type) => setActiveModal({ sample, type })}
              />
            ))}
          </div>
        </DndContext>
      )}

      {/* Action Modal */}
      {activeModal && (
        <ActionModal
          sample={activeModal.sample}
          modalType={activeModal.type}
          onClose={() => setActiveModal(null)}
        />
      )}
    </div>
  );
}
