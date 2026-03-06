"use client";

import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Upload,
  Download,
  FileSpreadsheet,
  Search,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Loader2,
  X,
  Info,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { SearchInput } from "@/components/shared/SearchInput";
import { formatDate, formatCurrency } from "@/lib/utils";
import api from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────

interface OrderRow {
  id: string;
  orderNumber: string;
  status: string;
  priority: string;
  createdAt: string;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    mrn: string;
  };
  items: { id: string; testCatalog: { name: string } }[];
}

interface OrdersResponse {
  data: OrderRow[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface UploadError {
  row: number;
  orderNumber: string;
  test: string;
  error: string;
}

interface UploadResult {
  saved: number;
  failed: number;
  critical: number;
  errors: UploadError[];
}

const STEPS = [
  { number: 1, label: "Select Orders" },
  { number: 2, label: "Download Template" },
  { number: 3, label: "Upload Results" },
];

// ── Main Page ──────────────────────────────────────────────────────────────

export default function BulkEntryPage() {
  const [step, setStep] = useState(1);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedOrders, setSelectedOrders] = useState<Map<string, OrderRow>>(new Map());
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Step 1: Fetch orders ──
  const queryParams = new URLSearchParams({
    page: String(page),
    limit: "20",
    status: "SAMPLE_COLLECTED",
    ...(search && { search }),
  }).toString();

  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ["bulk-entry-orders", queryParams],
    queryFn: async () => {
      const res = await api.get<{ data: OrdersResponse }>(`/orders?${queryParams}`);
      return res.data.data;
    },
    enabled: step === 1,
  });

  const toggleOrder = useCallback((order: OrderRow) => {
    setSelectedOrders((prev) => {
      const next = new Map(prev);
      if (next.has(order.id)) {
        next.delete(order.id);
      } else {
        next.set(order.id, order);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (!ordersData?.data) return;
    setSelectedOrders((prev) => {
      const allOnPage = ordersData.data;
      const allSelected = allOnPage.every((o) => prev.has(o.id));
      const next = new Map(prev);
      if (allSelected) {
        allOnPage.forEach((o) => next.delete(o.id));
      } else {
        allOnPage.forEach((o) => next.set(o.id, o));
      }
      return next;
    });
  }, [ordersData?.data]);

  // ── Step 2: Download template ──
  const downloadMutation = useMutation({
    mutationFn: async () => {
      const orderIds = Array.from(selectedOrders.keys()).join(",");
      const res = await api.get("/results/bulk-template", {
        params: { orderIds },
        responseType: "blob",
      });
      const blob = new Blob([res.data as BlobPart], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bulk-results-template-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    },
  });

  // ── Step 3: Upload results ──
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post<{ data: UploadResult }>("/results/bulk-upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data.data;
    },
    onSuccess: (data) => {
      setUploadResult(data);
      setSelectedFile(null);
    },
  });

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) setSelectedFile(file);
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  }, []);

  const canGoNext = step === 1 ? selectedOrders.size > 0 : step === 2 ? true : false;

  const allOnPageSelected =
    ordersData?.data && ordersData.data.length > 0
      ? ordersData.data.every((o) => selectedOrders.has(o.id))
      : false;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Bulk Result Entry"
        subtitle="Upload results via Excel template"
        breadcrumbs={[{ label: "Results", href: "/results" }]}
      />

      {/* ── Stepper ── */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.number} className="flex items-center gap-2">
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                step === s.number
                  ? "bg-[#1B4F8A] text-white"
                  : step > s.number
                  ? "bg-green-100 text-green-700"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              {step > s.number ? (
                <CheckCircle2 size={16} />
              ) : (
                <span className="w-5 h-5 rounded-full border-2 border-current flex items-center justify-center text-xs font-bold">
                  {s.number}
                </span>
              )}
              {s.label}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-8 h-0.5 ${step > s.number ? "bg-green-300" : "bg-slate-200"}`} />
            )}
          </div>
        ))}
      </div>

      {/* ── Step 1: Select Orders ── */}
      {step === 1 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Select Orders</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Choose orders with collected samples to generate results template
              </p>
            </div>
            {selectedOrders.size > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#1B4F8A]/10 text-[#1B4F8A] rounded-full text-xs font-semibold">
                <CheckCircle2 size={12} />
                {selectedOrders.size} selected
              </span>
            )}
          </div>

          <div className="px-5 py-3 border-b border-slate-100">
            <SearchInput
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
              placeholder="Search by order number or patient name..."
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left w-10">
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={toggleAll}
                      className="rounded border-slate-300"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Order #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Patient
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    MRN
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Tests
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {ordersLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-slate-100 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (ordersData?.data ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400 text-sm">
                      No orders with collected samples found
                    </td>
                  </tr>
                ) : (
                  (ordersData?.data ?? []).map((order) => {
                    const isChecked = selectedOrders.has(order.id);
                    const priorityCls =
                      order.priority === "STAT"
                        ? "bg-red-50 text-red-700 ring-red-200"
                        : order.priority === "URGENT"
                        ? "bg-orange-50 text-orange-700 ring-orange-200"
                        : "bg-slate-50 text-slate-600 ring-slate-200";
                    return (
                      <tr
                        key={order.id}
                        className={`hover:bg-slate-50 transition-colors cursor-pointer ${isChecked ? "bg-blue-50/50" : ""}`}
                        onClick={() => toggleOrder(order)}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleOrder(order)}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded border-slate-300"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs font-semibold text-[#1B4F8A]">
                            {order.orderNumber}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {order.patient.firstName} {order.patient.lastName}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">
                          {order.patient.mrn}
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs">
                          {order.items.length} test{order.items.length !== 1 ? "s" : ""}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ${priorityCls}`}
                          >
                            {order.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {formatDate(order.createdAt)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Simple pagination */}
          {(ordersData?.meta.total ?? 0) > 20 && (
            <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Page {page} of {ordersData?.meta.totalPages ?? 1} ({ordersData?.meta.total ?? 0} orders)
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 text-xs border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-30"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= (ordersData?.meta.totalPages ?? 1)}
                  className="px-3 py-1.5 text-xs border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Step 2: Download Template ── */}
      {step === 2 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-900">Download Template</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Download the pre-filled Excel template for {selectedOrders.size} selected order{selectedOrders.size !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="p-6 space-y-6">
            {/* Selected orders summary */}
            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Selected Orders</h3>
              <div className="flex flex-wrap gap-2">
                {Array.from(selectedOrders.values()).map((order) => (
                  <span
                    key={order.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs"
                  >
                    <span className="font-mono font-semibold text-[#1B4F8A]">{order.orderNumber}</span>
                    <span className="text-slate-400">-</span>
                    <span className="text-slate-600">{order.patient.firstName} {order.patient.lastName}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Download button */}
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <FileSpreadsheet size={32} className="text-green-600" />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-slate-900">Excel Template Ready</p>
                <p className="text-sm text-slate-500 mt-1">
                  The template contains pre-filled order and test information
                </p>
              </div>
              <button
                onClick={() => downloadMutation.mutate()}
                disabled={downloadMutation.isPending}
                className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-60"
              >
                {downloadMutation.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Download size={16} />
                )}
                {downloadMutation.isPending ? "Generating..." : "Download Template (.xlsx)"}
              </button>
              {downloadMutation.isSuccess && (
                <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                  <CheckCircle2 size={12} /> Template downloaded successfully
                </p>
              )}
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info size={16} className="text-blue-600 mt-0.5 shrink-0" />
                <div className="text-sm text-blue-800 space-y-2">
                  <p className="font-semibold">How to fill the template:</p>
                  <ol className="list-decimal ml-4 space-y-1 text-blue-700">
                    <li>Open the downloaded .xlsx file in Excel or Google Sheets</li>
                    <li>Each row represents a test result for an order item</li>
                    <li>Fill in the <strong>Value</strong> column with the test result values</li>
                    <li>The <strong>Unit</strong> and <strong>Reference Range</strong> columns are pre-filled for reference</li>
                    <li>Do not modify the Order Number, Test Code, or Sample Barcode columns</li>
                    <li>Save the file and proceed to the Upload step</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 3: Upload Results ── */}
      {step === 3 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-900">Upload Results</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload the filled Excel template to import results
            </p>
          </div>

          <div className="p-6 space-y-6">
            {!uploadResult ? (
              <>
                {/* Drop zone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-10 cursor-pointer transition ${
                    dragOver
                      ? "border-[#1B4F8A] bg-[#1B4F8A]/5"
                      : selectedFile
                      ? "border-green-300 bg-green-50"
                      : "border-slate-300 hover:border-slate-400 bg-slate-50"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  {selectedFile ? (
                    <>
                      <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-3">
                        <FileSpreadsheet size={24} className="text-green-600" />
                      </div>
                      <p className="text-sm font-semibold text-slate-900">{selectedFile.name}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                        className="mt-2 text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                      >
                        <X size={12} /> Remove file
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                        <Upload size={24} className="text-slate-400" />
                      </div>
                      <p className="text-sm font-semibold text-slate-700">
                        Drag and drop your file here
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        or click to browse (.xlsx, .xls, .csv)
                      </p>
                    </>
                  )}
                </div>

                {/* Upload button */}
                <div className="flex justify-center">
                  <button
                    onClick={() => selectedFile && uploadMutation.mutate(selectedFile)}
                    disabled={!selectedFile || uploadMutation.isPending}
                    className="flex items-center gap-2 px-6 py-2.5 bg-[#1B4F8A] hover:bg-[#163d6e] text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
                  >
                    {uploadMutation.isPending ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Upload size={16} />
                    )}
                    {uploadMutation.isPending ? "Uploading & Processing..." : "Upload Results"}
                  </button>
                </div>

                {uploadMutation.isError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                    <AlertCircle size={16} className="text-red-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-red-800">Upload Failed</p>
                      <p className="text-xs text-red-600 mt-0.5">
                        Please check the file format and try again. Ensure the template columns have not been modified.
                      </p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* ── Upload Summary ── */
              <div className="space-y-4">
                <div className="text-center py-4">
                  <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 size={28} className="text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">Upload Complete</h3>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-green-700">{uploadResult.saved}</p>
                    <p className="text-xs text-green-600 font-medium mt-1">Results Saved</p>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-red-700">{uploadResult.failed}</p>
                    <p className="text-xs text-red-600 font-medium mt-1">Failed</p>
                  </div>
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-orange-700">{uploadResult.critical}</p>
                    <p className="text-xs text-orange-600 font-medium mt-1">Critical Values</p>
                  </div>
                </div>

                {/* Errors table */}
                {uploadResult.errors.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                      <AlertTriangle size={14} className="text-red-500" />
                      Errors ({uploadResult.errors.length})
                    </h4>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">
                              Row #
                            </th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">
                              Order #
                            </th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">
                              Test
                            </th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">
                              Error
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {uploadResult.errors.map((err, i) => (
                            <tr key={i} className="hover:bg-red-50/50">
                              <td className="px-4 py-2.5 font-mono text-xs text-slate-600">
                                {err.row}
                              </td>
                              <td className="px-4 py-2.5 font-mono text-xs text-slate-700 font-medium">
                                {err.orderNumber}
                              </td>
                              <td className="px-4 py-2.5 text-slate-600 text-xs">{err.test}</td>
                              <td className="px-4 py-2.5 text-red-600 text-xs">{err.error}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Reset button */}
                <div className="flex justify-center pt-2">
                  <button
                    onClick={() => {
                      setUploadResult(null);
                      setSelectedFile(null);
                      setSelectedOrders(new Map());
                      setStep(1);
                      setSearch("");
                      setPage(1);
                    }}
                    className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 transition"
                  >
                    Upload Another Batch
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Navigation buttons ── */}
      {!(step === 3 && uploadResult) && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 transition disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ArrowLeft size={14} />
            Back
          </button>
          {step < 3 && (
            <button
              onClick={() => setStep((s) => Math.min(3, s + 1))}
              disabled={!canGoNext}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-[#1B4F8A] hover:bg-[#163d6e] text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
