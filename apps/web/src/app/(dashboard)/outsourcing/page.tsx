"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Package,
  Truck,
  Clock,
  CheckCircle2,
  Plus,
  Send,
  FlaskConical,
  Building2,
  Users,
  Phone,
  Mail,
  MapPin,
  Edit2,
  Trash2,
  X,
  Eye,
  ChevronDown,
  ChevronRight,
  FileText,
  AlertCircle,
  Clipboard,
} from "lucide-react";
import * as Tabs from "@radix-ui/react-tabs";
import { DataTable } from "@/components/tables/DataTable";
import { SearchInput } from "@/components/shared/SearchInput";
import { PageHeader } from "@/components/shared/PageHeader";
import { KPICard } from "@/components/shared/KPICard";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DateRangePicker, type DateRange } from "@/components/shared/DateRangePicker";
import { formatDate, formatDateTime, cn } from "@/lib/utils";
import api from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────

interface OutsourceRecord {
  id: string;
  sampleBarcode: string;
  status: string;
  dispatchedAt: string | null;
  receivedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
  };
  order: {
    id: string;
    orderNumber: string;
  };
  referenceLab: {
    id: string;
    name: string;
    code: string;
  };
  tests: string[];
}

interface OutsourceStats {
  pendingDispatch: number;
  dispatched: number;
  awaitingResults: number;
  completed: number;
}

interface ReferenceLab {
  id: string;
  name: string;
  code: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  testCount: number;
  isActive: boolean;
  createdAt: string;
  tests?: RefLabTest[];
}

interface RefLabTest {
  id: string;
  testName: string;
  cost: number;
  tat: string | null;
}

// ── Status Badge ───────────────────────────────────────────────────────────

function OutsourceStatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    PENDING_DISPATCH: { bg: "bg-yellow-50 border-yellow-200 text-yellow-700", text: "Pending Dispatch", icon: <Clock className="w-3 h-3" /> },
    DISPATCHED: { bg: "bg-blue-50 border-blue-200 text-blue-700", text: "Dispatched", icon: <Truck className="w-3 h-3" /> },
    RECEIVED_BY_REFLAB: { bg: "bg-indigo-50 border-indigo-200 text-indigo-700", text: "Received", icon: <Package className="w-3 h-3" /> },
    RESULTS_PENDING: { bg: "bg-purple-50 border-purple-200 text-purple-700", text: "Results Pending", icon: <FlaskConical className="w-3 h-3" /> },
    RESULTS_RECEIVED: { bg: "bg-teal-50 border-teal-200 text-teal-700", text: "Results Received", icon: <FileText className="w-3 h-3" /> },
    COMPLETED: { bg: "bg-green-50 border-green-200 text-green-700", text: "Completed", icon: <CheckCircle2 className="w-3 h-3" /> },
  };
  const s = map[status] ?? { bg: "bg-slate-50 border-slate-200 text-slate-600", text: status, icon: <Clock className="w-3 h-3" /> };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${s.bg}`}>
      {s.icon}
      {s.text}
    </span>
  );
}

// ── New Outsource Modal ────────────────────────────────────────────────────

function NewOutsourceModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [orderSearch, setOrderSearch] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [reflabId, setReflabId] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  // Search orders
  const { data: orders } = useQuery({
    queryKey: ["outsource-order-search", orderSearch],
    queryFn: async () => {
      if (orderSearch.length < 2) return [];
      const res = await api.get<{ data: { data: Array<{ id: string; orderNumber: string; patient: { firstName: string; lastName: string } }> } }>(
        `/orders/search?q=${encodeURIComponent(orderSearch)}&limit=10`
      );
      return res.data.data.data ?? [];
    },
    enabled: orderSearch.length >= 2,
  });

  // Fetch reference labs
  const { data: reflabs } = useQuery({
    queryKey: ["reference-labs-dropdown"],
    queryFn: async () => {
      const res = await api.get<{ data: { data: ReferenceLab[] } }>("/reference-labs?limit=100");
      return res.data.data.data ?? [];
    },
  });

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post("/outsourcing", data),
    onSuccess: () => {
      onSuccess();
      onClose();
    },
    onError: (e: unknown) => {
      setError(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to create outsource record"
      );
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOrderId) { setError("Please select an order"); return; }
    if (selectedTests.length === 0) { setError("Please enter at least one test"); return; }
    if (!reflabId) { setError("Please select a reference lab"); return; }
    mutation.mutate({
      orderId: selectedOrderId,
      tests: selectedTests,
      referenceLabId: reflabId,
      notes: notes || undefined,
    });
  }

  function toggleTest(test: string) {
    setSelectedTests((prev) =>
      prev.includes(test) ? prev.filter((t) => t !== test) : [...prev, test]
    );
  }

  const [testInput, setTestInput] = useState("");

  function addTest() {
    const t = testInput.trim();
    if (t && !selectedTests.includes(t)) {
      setSelectedTests((prev) => [...prev, t]);
      setTestInput("");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">New Outsource Request</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Order Search */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Order *</label>
            <input
              type="text"
              value={orderSearch}
              onChange={(e) => setOrderSearch(e.target.value)}
              placeholder="Search by order number..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            />
            {(orders ?? []).length > 0 && !selectedOrderId && (
              <div className="mt-1 border border-slate-200 rounded-lg max-h-40 overflow-y-auto">
                {(orders ?? []).map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => {
                      setSelectedOrderId(o.id);
                      setOrderSearch(`${o.orderNumber} - ${o.patient.firstName} ${o.patient.lastName}`);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0"
                  >
                    <span className="font-mono text-xs text-[#1B4F8A]">{o.orderNumber}</span>
                    <span className="ml-2 text-slate-600">
                      {o.patient.firstName} {o.patient.lastName}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {selectedOrderId && (
              <button
                type="button"
                onClick={() => {
                  setSelectedOrderId("");
                  setOrderSearch("");
                }}
                className="text-xs text-red-500 hover:text-red-700 mt-1"
              >
                Clear selection
              </button>
            )}
          </div>

          {/* Tests */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Tests *</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); addTest(); }
                }}
                placeholder="Type test name and press Enter"
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
              />
              <button
                type="button"
                onClick={addTest}
                className="px-3 py-2 bg-slate-100 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-200"
              >
                Add
              </button>
            </div>
            {selectedTests.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {selectedTests.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium"
                  >
                    {t}
                    <button type="button" onClick={() => toggleTest(t)} className="hover:text-red-500">
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Reference Lab */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Reference Lab *</label>
            <select
              value={reflabId}
              onChange={(e) => setReflabId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            >
              <option value="">Select reference lab...</option>
              {(reflabs ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.code})
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
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
              {mutation.isPending ? "Creating..." : "Create Outsource"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Enter Results Modal ────────────────────────────────────────────────────

function EnterResultsModal({
  record,
  onClose,
  onSuccess,
}: {
  record: OutsourceRecord;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [results, setResults] = useState<Array<{ testName: string; value: string; unit: string; normalRange: string }>>
    (record.tests.map((t) => ({ testName: t, value: "", unit: "", normalRange: "" })));
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post(`/outsourcing/${record.id}/results`, data),
    onSuccess: () => {
      onSuccess();
      onClose();
    },
    onError: (e: unknown) => {
      setError(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to enter results"
      );
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const filled = results.filter((r) => r.value.trim());
    if (filled.length === 0) {
      setError("Please enter at least one result");
      return;
    }
    mutation.mutate({ results: filled });
  }

  function updateResult(idx: number, field: string, value: string) {
    setResults((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Enter Results</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        <div className="bg-slate-50 rounded-lg p-3 text-sm">
          <p className="text-slate-600">
            Sample: <span className="font-mono font-semibold">{record.sampleBarcode}</span>
          </p>
          <p className="text-slate-600">
            Patient: <span className="font-semibold">{record.patient.firstName} {record.patient.lastName}</span>
          </p>
          <p className="text-slate-600">
            Reference Lab: <span className="font-semibold">{record.referenceLab.name}</span>
          </p>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 text-xs font-semibold text-slate-500">Test</th>
                <th className="text-left py-2 text-xs font-semibold text-slate-500">Value</th>
                <th className="text-left py-2 text-xs font-semibold text-slate-500">Unit</th>
                <th className="text-left py-2 text-xs font-semibold text-slate-500">Normal Range</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {results.map((r, i) => (
                <tr key={i}>
                  <td className="py-2 text-slate-700 font-medium">{r.testName}</td>
                  <td className="py-2 pr-2">
                    <input
                      type="text"
                      value={r.value}
                      onChange={(e) => updateResult(i, "value", e.target.value)}
                      className="w-full border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="text"
                      value={r.unit}
                      onChange={(e) => updateResult(i, "unit", e.target.value)}
                      placeholder="e.g. mg/dL"
                      className="w-full border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
                    />
                  </td>
                  <td className="py-2">
                    <input
                      type="text"
                      value={r.normalRange}
                      onChange={(e) => updateResult(i, "normalRange", e.target.value)}
                      placeholder="e.g. 70-100"
                      className="w-full border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
              {mutation.isPending ? "Saving..." : "Save Results"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Add Reference Lab Modal ────────────────────────────────────────────────

function AddRefLabModal({
  lab,
  onClose,
  onSuccess,
}: {
  lab?: ReferenceLab;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    name: lab?.name ?? "",
    code: lab?.code ?? "",
    contactPerson: lab?.contactPerson ?? "",
    phone: lab?.phone ?? "",
    email: lab?.email ?? "",
    address: lab?.address ?? "",
    city: lab?.city ?? "",
  });
  const [error, setError] = useState("");
  const isEdit = !!lab;

  const mutation = useMutation({
    mutationFn: (data: typeof form) => {
      if (isEdit) return api.put(`/reference-labs/${lab.id}`, data);
      return api.post("/reference-labs", data);
    },
    onSuccess: () => {
      onSuccess();
      onClose();
    },
    onError: (e: unknown) => {
      setError(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          `Failed to ${isEdit ? "update" : "add"} reference lab`
      );
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Name is required"); return; }
    if (!form.code.trim()) { setError("Code is required"); return; }
    mutation.mutate(form);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">
            {isEdit ? "Edit Reference Lab" : "Add Reference Lab"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          {(
            [
              { key: "name", label: "Lab Name *", placeholder: "SRL Diagnostics" },
              { key: "code", label: "Code *", placeholder: "SRL" },
              { key: "contactPerson", label: "Contact Person", placeholder: "Dr. Sharma" },
              { key: "phone", label: "Phone", placeholder: "+91 98765 43210" },
              { key: "email", label: "Email", placeholder: "lab@srl.com" },
              { key: "address", label: "Address", placeholder: "456 Lab Avenue" },
              { key: "city", label: "City", placeholder: "Mumbai" },
            ] as Array<{ key: keyof typeof form; label: string; placeholder?: string }>
          ).map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
              <input
                type="text"
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
              />
            </div>
          ))}
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
              {mutation.isPending ? "Saving..." : isEdit ? "Update" : "Add Lab"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Pipeline Status Tabs ───────────────────────────────────────────────────

const PIPELINE_STATUS_TABS = [
  { label: "All", value: "" },
  { label: "Pending Dispatch", value: "PENDING_DISPATCH" },
  { label: "Dispatched", value: "DISPATCHED" },
  { label: "Received", value: "RECEIVED_BY_REFLAB" },
  { label: "Results Pending", value: "RESULTS_PENDING" },
  { label: "Results Received", value: "RESULTS_RECEIVED" },
  { label: "Completed", value: "COMPLETED" },
];

// ── Pipeline Tab Content ───────────────────────────────────────────────────

function PipelineTab() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusTab, setStatusTab] = useState(0);
  const [reflabFilter, setReflabFilter] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>({});
  const [showNew, setShowNew] = useState(false);
  const [resultsRecord, setResultsRecord] = useState<OutsourceRecord | null>(null);

  const status = PIPELINE_STATUS_TABS[statusTab]?.value ?? "";

  // Fetch reference labs for filter
  const { data: reflabs } = useQuery({
    queryKey: ["reference-labs-dropdown"],
    queryFn: async () => {
      const res = await api.get<{ data: { data: ReferenceLab[] } }>("/reference-labs?limit=100");
      return res.data.data.data ?? [];
    },
  });

  // Fetch stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["outsourcing-stats"],
    queryFn: async () => {
      const [pending, awaiting] = await Promise.all([
        api.get<{ data: { total: number } }>("/outsourcing/pending-dispatch"),
        api.get<{ data: { total: number } }>("/outsourcing/awaiting-results"),
      ]);
      return {
        pendingDispatch: pending.data.data.total ?? 0,
        dispatched: 0,
        awaitingResults: awaiting.data.data.total ?? 0,
        completed: 0,
      } as OutsourceStats;
    },
  });

  // Fetch records
  const params = new URLSearchParams({
    page: String(page),
    limit: "20",
    ...(status && { status }),
    ...(reflabFilter && { reflabId: reflabFilter }),
    ...(dateRange.from && { dateFrom: dateRange.from }),
    ...(dateRange.to && { dateTo: dateRange.to }),
  }).toString();

  const { data, isLoading } = useQuery({
    queryKey: ["outsourcing", params],
    queryFn: async () => {
      const res = await api.get<{ data: { data: OutsourceRecord[]; meta: { total: number } } }>(
        `/outsourcing?${params}`
      );
      return res.data.data;
    },
  });

  // Dispatch mutation
  const dispatchMutation = useMutation({
    mutationFn: (id: string) => api.put(`/outsourcing/${id}/dispatch`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["outsourcing"] });
      qc.invalidateQueries({ queryKey: ["outsourcing-stats"] });
    },
  });

  // Mark received mutation
  const receivedMutation = useMutation({
    mutationFn: (id: string) => api.put(`/outsourcing/${id}/received`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["outsourcing"] });
      qc.invalidateQueries({ queryKey: ["outsourcing-stats"] });
    },
  });

  const columns: ColumnDef<OutsourceRecord>[] = [
    {
      header: "Sample",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-[#1B4F8A] font-semibold">{row.original.sampleBarcode}</span>
      ),
    },
    {
      header: "Patient",
      cell: ({ row }) => (
        <p className="text-sm font-semibold text-slate-800">
          {row.original.patient.firstName} {row.original.patient.lastName}
        </p>
      ),
    },
    {
      header: "Order #",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-slate-600">{row.original.order.orderNumber}</span>
      ),
    },
    {
      header: "Reference Lab",
      cell: ({ row }) => (
        <div>
          <p className="text-sm text-slate-700 font-medium">{row.original.referenceLab.name}</p>
          <p className="text-xs text-slate-400">{row.original.referenceLab.code}</p>
        </div>
      ),
    },
    {
      header: "Tests",
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1 max-w-[200px]">
          {(row.original.tests ?? []).slice(0, 3).map((t) => (
            <span key={t} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">
              {t}
            </span>
          ))}
          {(row.original.tests ?? []).length > 3 && (
            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-xs">
              +{row.original.tests.length - 3}
            </span>
          )}
        </div>
      ),
    },
    {
      header: "Status",
      cell: ({ row }) => <OutsourceStatusBadge status={row.original.status} />,
    },
    {
      header: "Dispatched At",
      cell: ({ row }) =>
        row.original.dispatchedAt ? (
          <span className="text-sm text-slate-600">{formatDate(row.original.dispatchedAt)}</span>
        ) : (
          <span className="text-xs text-slate-400">--</span>
        ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const rec = row.original;
        return (
          <div className="flex items-center gap-1">
            {rec.status === "PENDING_DISPATCH" && (
              <button
                onClick={() => dispatchMutation.mutate(rec.id)}
                disabled={dispatchMutation.isPending}
                className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded text-xs font-semibold hover:bg-blue-100 transition"
                title="Dispatch"
              >
                <Truck size={13} className="inline mr-1" />
                Dispatch
              </button>
            )}
            {rec.status === "DISPATCHED" && (
              <button
                onClick={() => receivedMutation.mutate(rec.id)}
                disabled={receivedMutation.isPending}
                className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-semibold hover:bg-indigo-100 transition"
                title="Mark Received"
              >
                <Package size={13} className="inline mr-1" />
                Received
              </button>
            )}
            {rec.status === "RESULTS_PENDING" && (
              <button
                onClick={() => setResultsRecord(rec)}
                className="px-2.5 py-1 bg-purple-50 text-purple-700 rounded text-xs font-semibold hover:bg-purple-100 transition"
                title="Enter Results"
              >
                <Clipboard size={13} className="inline mr-1" />
                Results
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Pending Dispatch"
          value={stats?.pendingDispatch ?? 0}
          icon={Clock}
          iconColor="bg-yellow-100 text-yellow-600"
          isLoading={statsLoading}
        />
        <KPICard
          title="Dispatched"
          value={stats?.dispatched ?? 0}
          icon={Truck}
          iconColor="bg-blue-100 text-blue-600"
          isLoading={statsLoading}
        />
        <KPICard
          title="Awaiting Results"
          value={stats?.awaitingResults ?? 0}
          icon={FlaskConical}
          iconColor="bg-purple-100 text-purple-600"
          isLoading={statsLoading}
        />
        <KPICard
          title="Completed"
          value={stats?.completed ?? 0}
          icon={CheckCircle2}
          iconColor="bg-green-100 text-green-600"
          isLoading={statsLoading}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={reflabFilter}
          onChange={(e) => { setReflabFilter(e.target.value); setPage(1); }}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30 min-w-[200px]"
        >
          <option value="">All Reference Labs</option>
          {(reflabs ?? []).map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <DateRangePicker value={dateRange} onChange={(r) => { setDateRange(r); setPage(1); }} />
        <div className="ml-auto">
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#1B4F8A] text-white rounded-lg text-sm font-semibold hover:bg-[#163d6a] transition"
          >
            <Plus size={16} />
            New Outsource
          </button>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 flex-wrap">
        {PIPELINE_STATUS_TABS.map((tab, i) => (
          <button
            key={tab.value || "all"}
            onClick={() => { setStatusTab(i); setPage(1); }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              statusTab === i
                ? "bg-[#1B4F8A] text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        total={data?.meta?.total ?? 0}
        page={page}
        pageSize={20}
        onPageChange={setPage}
        isLoading={isLoading}
      />

      {/* Modals */}
      {showNew && (
        <NewOutsourceModal
          onClose={() => setShowNew(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["outsourcing"] });
            qc.invalidateQueries({ queryKey: ["outsourcing-stats"] });
          }}
        />
      )}
      {resultsRecord && (
        <EnterResultsModal
          record={resultsRecord}
          onClose={() => setResultsRecord(null)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["outsourcing"] });
            qc.invalidateQueries({ queryKey: ["outsourcing-stats"] });
          }}
        />
      )}
    </div>
  );
}

// ── Reference Labs Tab Content ─────────────────────────────────────────────

function ReferenceLabsTab() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editLab, setEditLab] = useState<ReferenceLab | undefined>(undefined);
  const [deleteLab, setDeleteLab] = useState<ReferenceLab | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const params = new URLSearchParams({
    page: String(page),
    limit: "20",
    ...(search && { search }),
  }).toString();

  const { data, isLoading } = useQuery({
    queryKey: ["reference-labs", params],
    queryFn: async () => {
      const res = await api.get<{ data: { data: ReferenceLab[]; meta: { total: number } } }>(
        `/reference-labs?${params}`
      );
      return res.data.data;
    },
  });

  // Fetch tests for expanded lab
  const { data: labTests } = useQuery({
    queryKey: ["reference-lab-tests", expandedId],
    queryFn: async () => {
      if (!expandedId) return [];
      const res = await api.get<{ data: RefLabTest[] }>(`/reference-labs/${expandedId}/tests`);
      return res.data.data ?? [];
    },
    enabled: !!expandedId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/reference-labs/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reference-labs"] });
      setDeleteLab(null);
    },
  });

  const columns: ColumnDef<ReferenceLab>[] = [
    {
      id: "expand",
      header: "",
      cell: ({ row }) => (
        <button
          onClick={() => setExpandedId(expandedId === row.original.id ? null : row.original.id)}
          className="p-1 rounded hover:bg-slate-100 text-slate-400"
        >
          {expandedId === row.original.id ? (
            <ChevronDown size={14} />
          ) : (
            <ChevronRight size={14} />
          )}
        </button>
      ),
    },
    {
      header: "Name",
      cell: ({ row }) => (
        <div>
          <p className="font-semibold text-slate-800 text-sm">{row.original.name}</p>
          <p className="text-xs text-slate-400 font-mono">{row.original.code}</p>
        </div>
      ),
    },
    {
      header: "Contact",
      cell: ({ row }) => (
        <span className="text-sm text-slate-600">{row.original.contactPerson ?? "--"}</span>
      ),
    },
    {
      header: "Phone",
      cell: ({ row }) => (
        <span className="text-sm text-slate-600">{row.original.phone ?? "--"}</span>
      ),
    },
    {
      header: "Test Count",
      cell: ({ row }) => (
        <span className="text-sm font-medium text-slate-700">{row.original.testCount}</span>
      ),
    },
    {
      header: "Status",
      cell: ({ row }) => (
        <span
          className={cn(
            "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border",
            row.original.isActive
              ? "bg-green-50 border-green-200 text-green-700"
              : "bg-slate-50 border-slate-200 text-slate-500"
          )}
        >
          {row.original.isActive ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const lab = row.original;
        return (
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setEditLab(lab); setShowForm(true); }}
              className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-700"
              title="Edit"
            >
              <Edit2 size={15} />
            </button>
            <button
              onClick={() => setDeleteLab(lab)}
              className="p-1.5 rounded hover:bg-red-50 text-slate-500 hover:text-red-600"
              title="Delete"
            >
              <Trash2 size={15} />
            </button>
          </div>
        );
      },
    },
  ];

  // Build rows with expanded tests
  const rows = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <SearchInput
          value={search}
          onChange={(v) => { setSearch(v); setPage(1); }}
          placeholder="Search reference labs..."
          className="max-w-sm"
        />
        <div className="ml-auto">
          <button
            onClick={() => { setEditLab(undefined); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-[#1B4F8A] text-white rounded-lg text-sm font-semibold hover:bg-[#163d6a] transition"
          >
            <Plus size={16} />
            Add Reference Lab
          </button>
        </div>
      </div>

      {/* Custom table with expandable rows */}
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-3 py-3 w-8" />
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Phone</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Test Count</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-slate-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-400 text-sm">
                  No reference labs found
                </td>
              </tr>
            ) : (
              rows.map((lab) => (
                <>
                  <tr key={lab.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-3">
                      <button
                        onClick={() => setExpandedId(expandedId === lab.id ? null : lab.id)}
                        className="p-1 rounded hover:bg-slate-100 text-slate-400"
                      >
                        {expandedId === lab.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{lab.name}</p>
                      <p className="text-xs text-slate-400 font-mono">{lab.code}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{lab.contactPerson ?? "--"}</td>
                    <td className="px-4 py-3 text-slate-600">{lab.phone ?? "--"}</td>
                    <td className="px-4 py-3 font-medium text-slate-700">{lab.testCount}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border",
                          lab.isActive
                            ? "bg-green-50 border-green-200 text-green-700"
                            : "bg-slate-50 border-slate-200 text-slate-500"
                        )}
                      >
                        {lab.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setEditLab(lab); setShowForm(true); }}
                          className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-700"
                          title="Edit"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => setDeleteLab(lab)}
                          className="p-1.5 rounded hover:bg-red-50 text-slate-500 hover:text-red-600"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {/* Expanded row for mapped tests */}
                  {expandedId === lab.id && (
                    <tr key={`${lab.id}-expanded`}>
                      <td colSpan={7} className="bg-slate-50 px-8 py-4">
                        <p className="text-xs font-bold text-slate-500 uppercase mb-2">Mapped Tests</p>
                        {(labTests ?? []).length === 0 ? (
                          <p className="text-sm text-slate-400">No tests mapped to this lab</p>
                        ) : (
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-slate-200">
                                <th className="text-left py-1.5 text-xs font-semibold text-slate-500">Test Name</th>
                                <th className="text-left py-1.5 text-xs font-semibold text-slate-500">Cost</th>
                                <th className="text-left py-1.5 text-xs font-semibold text-slate-500">TAT</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {(labTests ?? []).map((t) => (
                                <tr key={t.id}>
                                  <td className="py-1.5 text-slate-700">{t.testName}</td>
                                  <td className="py-1.5 text-slate-600">{t.cost ? `Rs. ${t.cost}` : "--"}</td>
                                  <td className="py-1.5 text-slate-600">{t.tat ?? "--"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {(data?.meta?.total ?? 0) > 20 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Showing {(page - 1) * 20 + 1}--{Math.min(page * 20, data?.meta?.total ?? 0)} of {data?.meta?.total} records
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= Math.ceil((data?.meta?.total ?? 0) / 20)}
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {showForm && (
        <AddRefLabModal
          lab={editLab}
          onClose={() => { setShowForm(false); setEditLab(undefined); }}
          onSuccess={() => qc.invalidateQueries({ queryKey: ["reference-labs"] })}
        />
      )}

      <ConfirmDialog
        open={!!deleteLab}
        onClose={() => setDeleteLab(null)}
        onConfirm={() => {
          if (deleteLab) deleteMutation.mutate(deleteLab.id);
        }}
        title="Delete Reference Lab"
        message={`Are you sure you want to delete "${deleteLab?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function OutsourcingPage() {
  const [activeTab, setActiveTab] = useState("pipeline");

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Outsourcing"
        subtitle="Manage outsourced tests and reference lab partnerships"
      />

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab("pipeline")}
          className={cn(
            "px-4 py-2 text-sm font-semibold rounded-md transition",
            activeTab === "pipeline"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          )}
        >
          <Truck size={14} className="inline mr-1.5 -mt-0.5" />
          Pipeline
        </button>
        <button
          onClick={() => setActiveTab("reflabs")}
          className={cn(
            "px-4 py-2 text-sm font-semibold rounded-md transition",
            activeTab === "reflabs"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          )}
        >
          <Building2 size={14} className="inline mr-1.5 -mt-0.5" />
          Reference Labs
        </button>
      </div>

      {activeTab === "pipeline" ? <PipelineTab /> : <ReferenceLabsTab />}
    </div>
  );
}
