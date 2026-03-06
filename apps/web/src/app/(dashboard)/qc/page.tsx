"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Activity,
  FlaskConical,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  ShieldAlert,
} from "lucide-react";
import { DataTable } from "@/components/tables/DataTable";
import { QCLeveyJennings } from "@/components/charts/QCLeveyJennings";
import { formatDate } from "@/lib/utils";
import api from "@/lib/api";

// ── Types ───────────────────────────────────────────────────────────────────

interface TestCatalogItem {
  id: string;
  name: string;
  code: string;
  category: string;
}

interface LeveyJenningsPoint {
  x: string;
  y: number;
  result: string;
}

interface LeveyJenningsData {
  mean: number;
  sd: number;
  dataPoints: LeveyJenningsPoint[];
}

interface QCRun {
  id: string;
  createdAt: string;
  testCatalogId: string;
  level: string;
  measuredValue: number;
  mean: number;
  sd: number;
  result: string;
  violations: string[];
  reagentLotNumber: string | null;
  instrumentId: string | null;
}

interface CAPARecord {
  id: string;
  description: string;
  status: string;
  assignedToId: string | null;
  dueDate: string | null;
  correctiveAction: string | null;
  preventiveAction: string | null;
}

interface TATRow {
  testName: string;
  avgTAT: number;
  maxTAT: number;
  orderCount: number;
}

interface CriticalValue {
  id: string;
  patientId: string;
  testCatalogId: string;
  value: number;
  interpretation: string;
  createdAt: string;
  acknowledgedAt: string | null;
  acknowledgedById: string | null;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function thirtyDaysAgoStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function QCResultBadge({ result }: { result: string }) {
  const map: Record<string, { cls: string; icon: React.ReactNode }> = {
    PASS: { cls: "bg-green-50 text-green-700 border-green-200", icon: <CheckCircle2 className="w-3 h-3" /> },
    FAIL: { cls: "bg-red-50 text-red-700 border-red-200", icon: <XCircle className="w-3 h-3" /> },
    WARNING: { cls: "bg-amber-50 text-amber-700 border-amber-200", icon: <AlertTriangle className="w-3 h-3" /> },
  };
  const s = map[result] ?? map["PASS"];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${s.cls}`}>
      {s.icon}
      {result}
    </span>
  );
}

function CAPAStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    OPEN: "bg-red-50 text-red-700 border-red-200",
    IN_PROGRESS: "bg-amber-50 text-amber-700 border-amber-200",
    CLOSED: "bg-green-50 text-green-700 border-green-200",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${
        map[status] ?? "bg-slate-100 text-slate-600 border-slate-200"
      }`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function AckStatusBadge({ acked }: { acked: boolean }) {
  return acked ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border bg-green-50 text-green-700 border-green-200">
      <CheckCircle2 className="w-3 h-3" />
      Acked
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border bg-red-50 text-red-700 border-red-200">
      <Clock className="w-3 h-3" />
      Pending
    </span>
  );
}

const LEVELS = ["LEVEL1", "LEVEL2", "LEVEL3"] as const;
type Level = (typeof LEVELS)[number];

// ── Tab 1 — Levey-Jennings ───────────────────────────────────────────────────

function LeveyJenningsTab() {
  const [selectedTestId, setSelectedTestId] = useState("");
  const [level, setLevel] = useState<Level>("LEVEL1");
  const [from, setFrom] = useState(thirtyDaysAgoStr());
  const [to, setTo] = useState(todayStr());

  const { data: tests } = useQuery({
    queryKey: ["test-catalog-by-category"],
    queryFn: async () => {
      const res = await api.get<{ data: TestCatalogItem[] }>("/test-catalog/by-category");
      return res.data.data;
    },
  });

  const { data: ljData, isLoading } = useQuery({
    queryKey: ["qc-levey-jennings", selectedTestId, level, from, to],
    queryFn: async () => {
      const res = await api.get<{ data: LeveyJenningsData }>(
        `/qc/runs/levey-jennings?testCatalogId=${selectedTestId}&level=${level}&from=${from}&to=${to}`
      );
      return res.data.data;
    },
    enabled: !!selectedTestId,
  });

  // Map API dataPoints (x: string, y: number) to chart format (run: number, value: number, flag?: string)
  const chartData = (ljData?.dataPoints ?? []).map((pt, i) => ({
    run: i + 1,
    value: pt.y,
    flag: pt.result !== "PASS" ? pt.result : undefined,
  }));

  const selectedTest = (tests ?? []).find((t) => t.id === selectedTestId);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Test</label>
          <select
            value={selectedTestId}
            onChange={(e) => setSelectedTestId(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30 min-w-56"
          >
            <option value="">Select a test...</option>
            {(tests ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.code})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Level</label>
          <div className="flex gap-1">
            {LEVELS.map((l) => (
              <button
                key={l}
                onClick={() => setLevel(l)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  level === l
                    ? "bg-[#1B4F8A] text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {l.replace("LEVEL", "L")}
              </button>
            ))}
          </div>
        </div>
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

      {!selectedTestId && (
        <div className="text-center py-16 text-slate-400">
          <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Select a test to view its Levey-Jennings chart</p>
        </div>
      )}

      {selectedTestId && isLoading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1B4F8A]" />
        </div>
      )}

      {selectedTestId && !isLoading && ljData && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-4 mb-4 text-sm text-slate-500">
            <span>
              Test: <strong className="text-slate-700">{selectedTest?.name}</strong>
            </span>
            <span>
              Mean: <strong className="text-slate-700">{ljData.mean}</strong>
            </span>
            <span>
              SD: <strong className="text-slate-700">{ljData.sd}</strong>
            </span>
            <span>
              Runs: <strong className="text-slate-700">{chartData.length}</strong>
            </span>
            <span>
              Level: <strong className="text-slate-700">{level.replace("LEVEL", "L")}</strong>
            </span>
          </div>

          {chartData.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <p className="text-sm">No QC runs found for this selection</p>
            </div>
          ) : (
            <>
              <QCLeveyJennings
                data={chartData}
                mean={ljData.mean}
                sd={ljData.sd}
                title={`${selectedTest?.name ?? "Test"} — ${level.replace("LEVEL", "L")} (${from} to ${to})`}
              />
              <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-slate-100 text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-0.5 bg-green-500" />
                  <span>Mean</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-0.5 bg-yellow-500" />
                  <span>±1SD / ±2SD</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-0.5 bg-red-500" />
                  <span>±3SD (action limit)</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Record QC Run Modal ──────────────────────────────────────────────────────

function RecordQCRunModal({
  tests,
  onClose,
  onSuccess,
}: {
  tests: TestCatalogItem[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [testCatalogId, setTestCatalogId] = useState("");
  const [level, setLevel] = useState<Level>("LEVEL1");
  const [measuredValue, setMeasuredValue] = useState("");
  const [mean, setMean] = useState("");
  const [sd, setSd] = useState("");
  const [reagentLotNumber, setReagentLotNumber] = useState("");
  const [instrumentId, setInstrumentId] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post("/qc/runs", data),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to record QC run";
      setError(msg);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!testCatalogId) { setError("Select a test"); return; }
    const mv = parseFloat(measuredValue);
    const m = parseFloat(mean);
    const s = parseFloat(sd);
    if (isNaN(mv) || isNaN(m) || isNaN(s) || s <= 0) {
      setError("Enter valid numeric values for measured value, mean, and SD (SD > 0)");
      return;
    }
    mutation.mutate({
      testCatalogId,
      level,
      measuredValue: mv,
      mean: m,
      sd: s,
      ...(reagentLotNumber.trim() && { reagentLotNumber: reagentLotNumber.trim() }),
      ...(instrumentId.trim() && { instrumentId: instrumentId.trim() }),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Record QC Run</h2>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Test *</label>
            <select
              value={testCatalogId}
              onChange={(e) => setTestCatalogId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            >
              <option value="">Select test...</option>
              {tests.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Level *</label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as Level)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            >
              {LEVELS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Measured Value *</label>
              <input
                type="number"
                step="any"
                value={measuredValue}
                onChange={(e) => setMeasuredValue(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Mean *</label>
              <input
                type="number"
                step="any"
                value={mean}
                onChange={(e) => setMean(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">SD *</label>
              <input
                type="number"
                step="any"
                min="0.0001"
                value={sd}
                onChange={(e) => setSd(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Reagent Lot Number</label>
            <input
              type="text"
              value={reagentLotNumber}
              onChange={(e) => setReagentLotNumber(e.target.value)}
              placeholder="e.g. LOT-2024-001"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Instrument ID (optional)</label>
            <input
              type="text"
              value={instrumentId}
              onChange={(e) => setInstrumentId(e.target.value)}
              placeholder="Instrument UUID"
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
              {mutation.isPending ? "Recording..." : "Record Run"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Tab 2 — QC Runs ──────────────────────────────────────────────────────────

function QCRunsTab() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [showRecord, setShowRecord] = useState(false);

  const { data: tests } = useQuery({
    queryKey: ["test-catalog-by-category"],
    queryFn: async () => {
      const res = await api.get<{ data: TestCatalogItem[] }>("/test-catalog/by-category");
      return res.data.data;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["qc-runs", page],
    queryFn: async () => {
      const res = await api.get<{ data: PaginatedResponse<QCRun> }>(
        `/qc/runs?page=${page}&limit=20`
      );
      return res.data.data;
    },
  });

  const columns: ColumnDef<QCRun>[] = [
    {
      header: "Date",
      cell: ({ row }) => (
        <span className="text-sm text-slate-600 font-mono">{formatDate(row.original.createdAt)}</span>
      ),
    },
    {
      header: "Test",
      cell: ({ row }) => (
        <span className="text-xs font-mono text-[#1B4F8A]">
          {row.original.testCatalogId.slice(0, 8)}…
        </span>
      ),
    },
    {
      header: "Level",
      cell: ({ row }) => (
        <span className="text-xs font-semibold text-slate-600">
          {row.original.level.replace("LEVEL", "L")}
        </span>
      ),
    },
    {
      header: "Value",
      cell: ({ row }) => (
        <span className="font-mono text-sm font-semibold">{row.original.measuredValue}</span>
      ),
    },
    {
      header: "Mean",
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.mean}</span>,
    },
    {
      header: "SD",
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.sd}</span>,
    },
    {
      header: "Result",
      cell: ({ row }) => <QCResultBadge result={row.original.result} />,
    },
    {
      header: "Violations",
      cell: ({ row }) => (
        <span className="text-xs text-slate-500">
          {row.original.violations.length > 0 ? row.original.violations.join(", ") : "—"}
        </span>
      ),
    },
    {
      header: "Lot #",
      cell: ({ row }) => (
        <span className="text-xs text-slate-500 font-mono">
          {row.original.reagentLotNumber ?? "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">All QC runs with Westgard rule analysis</p>
        <button
          onClick={() => setShowRecord(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1B4F8A] text-white rounded-lg text-sm font-semibold hover:bg-[#163d6a]"
        >
          <Plus className="w-4 h-4" />
          Record QC Run
        </button>
      </div>
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        page={page}
        total={data?.meta.total}
        pageSize={20}
        onPageChange={setPage}
      />
      {showRecord && (
        <RecordQCRunModal
          tests={tests ?? []}
          onClose={() => setShowRecord(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ["qc-runs"] })}
        />
      )}
    </div>
  );
}

// ── Update CAPA Modal ─────────────────────────────────────────────────────────

function UpdateCAPAModal({
  capa,
  onClose,
  onSuccess,
}: {
  capa: CAPARecord;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [status, setStatus] = useState(capa.status);
  const [correctiveAction, setCorrectiveAction] = useState(capa.correctiveAction ?? "");
  const [preventiveAction, setPreventiveAction] = useState(capa.preventiveAction ?? "");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.put(`/qc/capa/${capa.id}`, data),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to update CAPA";
      setError(msg);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate({
      status,
      ...(correctiveAction.trim() && { correctiveAction: correctiveAction.trim() }),
      ...(preventiveAction.trim() && { preventiveAction: preventiveAction.trim() }),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Update CAPA</h2>
        <p className="text-sm text-slate-500">{capa.description}</p>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            >
              {["OPEN", "IN_PROGRESS", "CLOSED"].map((s) => (
                <option key={s} value={s}>{s.replace("_", " ")}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Corrective Action</label>
            <textarea
              rows={3}
              value={correctiveAction}
              onChange={(e) => setCorrectiveAction(e.target.value)}
              placeholder="Describe the corrective action taken..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Preventive Action</label>
            <textarea
              rows={3}
              value={preventiveAction}
              onChange={(e) => setPreventiveAction(e.target.value)}
              placeholder="Describe the preventive action planned..."
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
              {mutation.isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Create CAPA Modal ─────────────────────────────────────────────────────────

function CreateCAPAModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [description, setDescription] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post("/qc/capa", data),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to create CAPA";
      setError(msg);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) { setError("Description is required"); return; }
    mutation.mutate({
      description: description.trim(),
      ...(assignedToId.trim() && { assignedToId: assignedToId.trim() }),
      ...(dueDate && { dueDate }),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Create CAPA</h2>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Description *</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the non-conformance or issue..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Assigned To (User ID)</label>
            <input
              type="text"
              value={assignedToId}
              onChange={(e) => setAssignedToId(e.target.value)}
              placeholder="UUID of assignee"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
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
              {mutation.isPending ? "Creating..." : "Create CAPA"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Tab 3 — CAPA ─────────────────────────────────────────────────────────────

const CAPA_STATUS_FILTERS = ["ALL", "OPEN", "IN_PROGRESS", "CLOSED"] as const;
type CAPAStatusFilter = (typeof CAPA_STATUS_FILTERS)[number];

function CAPATab() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<CAPAStatusFilter>("ALL");
  const [updateCapa, setUpdateCapa] = useState<CAPARecord | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (statusFilter !== "ALL") params.set("status", statusFilter);

  const { data, isLoading } = useQuery({
    queryKey: ["qc-capa", page, statusFilter],
    queryFn: async () => {
      const res = await api.get<{ data: PaginatedResponse<CAPARecord> }>(
        `/qc/capa?${params.toString()}`
      );
      return res.data.data;
    },
  });

  const columns: ColumnDef<CAPARecord>[] = [
    {
      header: "Description",
      cell: ({ row }) => (
        <span className="text-sm text-slate-700 line-clamp-2 max-w-xs">
          {row.original.description}
        </span>
      ),
    },
    {
      header: "Status",
      cell: ({ row }) => <CAPAStatusBadge status={row.original.status} />,
    },
    {
      header: "Assigned To",
      cell: ({ row }) =>
        row.original.assignedToId ? (
          <span className="text-xs font-mono text-slate-500">
            {row.original.assignedToId.slice(0, 8)}…
          </span>
        ) : (
          <span className="text-slate-300">—</span>
        ),
    },
    {
      header: "Due Date",
      cell: ({ row }) =>
        row.original.dueDate ? (
          <span className="text-sm">{formatDate(row.original.dueDate)}</span>
        ) : (
          <span className="text-slate-300">—</span>
        ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <button
          onClick={() => setUpdateCapa(row.original)}
          className="text-xs px-2 py-1 border border-slate-200 rounded hover:bg-slate-50 text-slate-600"
        >
          Update
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1">
          {CAPA_STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                statusFilter === s
                  ? "bg-[#1B4F8A] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {s.replace("_", " ")}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1B4F8A] text-white rounded-lg text-sm font-semibold hover:bg-[#163d6a]"
        >
          <Plus className="w-4 h-4" />
          Create CAPA
        </button>
      </div>
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        page={page}
        total={data?.meta.total}
        pageSize={20}
        onPageChange={setPage}
      />
      {updateCapa && (
        <UpdateCAPAModal
          capa={updateCapa}
          onClose={() => setUpdateCapa(null)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ["qc-capa"] })}
        />
      )}
      {showCreate && (
        <CreateCAPAModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ["qc-capa"] })}
        />
      )}
    </div>
  );
}

// ── Acknowledge Modal ────────────────────────────────────────────────────────

function AckCriticalValueModal({
  cvId,
  onClose,
  onSuccess,
}: {
  cvId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post(`/qc/critical-values/${cvId}/ack`, data),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to acknowledge";
      setError(msg);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate({ notes: notes.trim() || undefined });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Acknowledge Critical Value</h2>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Notes (optional)</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Action taken or comments..."
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
              {mutation.isPending ? "Acknowledging..." : "Acknowledge"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Tab 4 — TAT Monitor ──────────────────────────────────────────────────────

function TATMonitorTab() {
  const qc = useQueryClient();
  const [from, setFrom] = useState(thirtyDaysAgoStr());
  const [to, setTo] = useState(todayStr());
  const [cvPage, setCvPage] = useState(1);
  const [ackId, setAckId] = useState<string | null>(null);

  const { data: tatData, isLoading: tatLoading } = useQuery({
    queryKey: ["qc-tat-report", from, to],
    queryFn: async () => {
      const res = await api.get<{ data: TATRow[] }>(`/qc/tat-report?from=${from}&to=${to}`);
      return res.data.data;
    },
  });

  const { data: cvData, isLoading: cvLoading } = useQuery({
    queryKey: ["qc-critical-values", cvPage],
    queryFn: async () => {
      const res = await api.get<{ data: PaginatedResponse<CriticalValue> }>(
        `/qc/critical-values?page=${cvPage}&limit=20`
      );
      return res.data.data;
    },
  });

  const cvColumns: ColumnDef<CriticalValue>[] = [
    {
      header: "Patient ID",
      cell: ({ row }) => (
        <span className="text-xs font-mono text-[#1B4F8A]">
          {row.original.patientId.slice(0, 8)}…
        </span>
      ),
    },
    {
      header: "Test",
      cell: ({ row }) => (
        <span className="text-xs font-mono text-slate-600">
          {row.original.testCatalogId.slice(0, 8)}…
        </span>
      ),
    },
    {
      header: "Value",
      cell: ({ row }) => (
        <span className="font-mono text-sm font-bold text-red-600">{row.original.value}</span>
      ),
    },
    {
      header: "Interpretation",
      cell: ({ row }) => (
        <span className="text-sm text-slate-700">{row.original.interpretation}</span>
      ),
    },
    {
      header: "Date",
      cell: ({ row }) => (
        <span className="text-sm">{formatDate(row.original.createdAt)}</span>
      ),
    },
    {
      header: "Ack Status",
      cell: ({ row }) => <AckStatusBadge acked={!!row.original.acknowledgedAt} />,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) =>
        !row.original.acknowledgedAt ? (
          <button
            onClick={() => setAckId(row.original.id)}
            className="text-xs px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded hover:bg-amber-100"
          >
            Acknowledge
          </button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      {/* TAT Date Range */}
      <div className="flex gap-3 items-end flex-wrap">
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

      {/* TAT Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#1B4F8A]" />
          <h3 className="font-semibold text-slate-800 text-sm">Turnaround Time Analysis</h3>
        </div>
        {tatLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1B4F8A]" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {["Test Name", "Avg TAT (h)", "Max TAT (h)", "Orders", "Flag"].map((h) => (
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
              {(tatData ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-sm">
                    No TAT data available
                  </td>
                </tr>
              ) : (
                (tatData ?? []).map((row, i) => (
                  <tr key={i} className={`hover:bg-slate-50 ${row.avgTAT > 24 ? "bg-amber-50/50" : ""}`}>
                    <td className="px-4 py-3 font-medium text-slate-800">{row.testName}</td>
                    <td className="px-4 py-3 font-mono font-semibold">{row.avgTAT.toFixed(1)}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">{row.maxTAT.toFixed(1)}</td>
                    <td className="px-4 py-3 text-slate-600">{row.orderCount}</td>
                    <td className="px-4 py-3">
                      {row.avgTAT > 24 ? (
                        <span className="text-amber-600 font-bold text-base" title="Avg TAT exceeds 24h">
                          ⚠
                        </span>
                      ) : (
                        <span className="text-green-500">
                          <CheckCircle2 className="w-4 h-4" />
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Critical Values */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <ShieldAlert className="w-4 h-4 text-red-600" />
          <h3 className="font-semibold text-slate-800 text-sm">Critical Values</h3>
          <span className="ml-auto text-xs text-slate-400 bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full">
            Requires acknowledgement
          </span>
        </div>
        <DataTable
          columns={cvColumns}
          data={cvData?.data ?? []}
          isLoading={cvLoading}
          page={cvPage}
          total={cvData?.meta.total}
          pageSize={20}
          onPageChange={setCvPage}
        />
      </div>

      {ackId && (
        <AckCriticalValueModal
          cvId={ackId}
          onClose={() => setAckId(null)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ["qc-critical-values"] })}
        />
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

const QC_TABS = [
  { id: "levey-jennings", label: "Levey-Jennings Chart", icon: Activity },
  { id: "runs", label: "QC Runs", icon: FlaskConical },
  { id: "capa", label: "CAPA", icon: AlertTriangle },
  { id: "tat", label: "TAT Monitor", icon: Clock },
] as const;

type QCTabId = (typeof QC_TABS)[number]["id"];

export default function QCPage() {
  const [activeTab, setActiveTab] = useState<QCTabId>("levey-jennings");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quality Control</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Levey-Jennings charts, Westgard rules, CAPA management, and TAT monitoring
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-200 overflow-x-auto">
          {QC_TABS.map((tab) => {
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
          {activeTab === "levey-jennings" && <LeveyJenningsTab />}
          {activeTab === "runs" && <QCRunsTab />}
          {activeTab === "capa" && <CAPATab />}
          {activeTab === "tat" && <TATMonitorTab />}
        </div>
      </div>
    </div>
  );
}
