"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Loader2,
  Printer,
  User,
  FlaskConical,
  FileText,
  X,
  FilePlus2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PriorityBadge } from "@/components/shared/PriorityBadge";
import { BarcodeDisplay } from "@/components/shared/BarcodeDisplay";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  getInitials,
  getAvatarColor,
} from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

interface TestCatalog {
  id: string;
  name: string;
  code: string;
  loincCode: string | null;
  tatHours: number;
}

interface OrderItem {
  id: string;
  quantity: number;
  price: string;
  discount: string;
  status: string;
  testCatalog: TestCatalog;
}

interface Sample {
  id: string;
  barcodeId: string;
  type: string;
  status: string;
  createdAt: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  total: string;
  status: string;
}

interface Patient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  dob: string;
  gender: string;
}

interface Branch {
  id: string;
  name: string;
}

interface CreatedBy {
  id: string;
  firstName: string;
  lastName: string;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  priority: "ROUTINE" | "URGENT" | "STAT";
  totalAmount: string;
  discountAmount: string;
  netAmount: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  patient: Patient;
  branch: Branch;
  items: OrderItem[];
  samples: Sample[];
  invoices: Invoice[];
  createdBy: CreatedBy;
}

interface LabReport {
  id: string;
  reportNumber: string;
  status: string;
}

// ── Constants ─────────────────────────────────────────────────────────────

const STATUS_FLOW = [
  "PENDING_COLLECTION",
  "SAMPLE_COLLECTED",
  "RECEIVED",
  "IN_PROCESSING",
  "RESULTED",
  "REPORTED",
] as const;

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  PENDING_COLLECTION: "Pending Collection",
  CONFIRMED: "Confirmed",
  SAMPLE_COLLECTED: "Sample Collected",
  RECEIVED: "Received",
  IN_PROCESSING: "In Processing",
  RESULTED: "Resulted",
  REPORTED: "Reported",
  CANCELLED: "Cancelled",
  SAMPLE_REJECTED: "Sample Rejected",
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["PENDING_COLLECTION", "CANCELLED"],
  PENDING_COLLECTION: ["SAMPLE_COLLECTED", "CANCELLED"],
  SAMPLE_COLLECTED: ["RECEIVED", "SAMPLE_REJECTED"],
  RECEIVED: ["IN_PROCESSING"],
  IN_PROCESSING: ["RESULTED"],
  RESULTED: ["REPORTED"],
  REPORTED: [],
  CANCELLED: [],
  SAMPLE_REJECTED: ["PENDING_COLLECTION"],
};

// ── Component ──────────────────────────────────────────────────────────────

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState<string | null>(null);
  const [statusNotes, setStatusNotes] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const res = await api.get<{ data: Order }>(`/orders/${id}`);
      return res.data.data;
    },
  });

  const { data: existingReport } = useQuery({
    queryKey: ["order-report", id],
    queryFn: async () => {
      const res = await api.get<{ data: LabReport[] }>(`/reports?orderId=${id}&limit=1`);
      return res.data.data?.[0] ?? null;
    },
    enabled: !!order && (order.status === "RESULTED" || order.status === "REPORTED"),
  });

  const generateReportMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/reports/generate/${id}`);
    },
    onSuccess: () => {
      toast.success("Report generated successfully");
      void queryClient.invalidateQueries({ queryKey: ["order", id] });
      void queryClient.invalidateQueries({ queryKey: ["order-report", id] });
      router.push("/reports");
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to generate report";
      toast.error(msg);
    },
  });

  const nextStatuses = order ? STATUS_TRANSITIONS[order.status] ?? [] : [];
  const isCancelled = order?.status === "CANCELLED";
  const isTerminal = order ? nextStatuses.length === 0 : false;

  const handleStatusUpdate = async () => {
    if (!confirmStatus || !order) return;
    setIsUpdating(true);
    try {
      await api.put(`/orders/${order.id}/status`, {
        status: confirmStatus,
        notes: statusNotes || undefined,
      });
      toast.success(`Status updated to ${STATUS_LABEL[confirmStatus]}`);
      setConfirmStatus(null);
      setStatusNotes("");
      await queryClient.invalidateQueries({ queryKey: ["order", id] });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to update status";
      toast.error(msg);
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={28} className="animate-spin text-[#1B4F8A]" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <FlaskConical size={36} className="mb-2" />
        <p className="text-sm">Order not found</p>
      </div>
    );
  }

  const statusIndex = STATUS_FLOW.indexOf(order.status as (typeof STATUS_FLOW)[number]);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors mt-0.5"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-slate-900 font-mono">
              {order.orderNumber}
            </h1>
            <StatusBadge status={order.status} />
            <PriorityBadge priority={order.priority} />
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            {order.patient.firstName} {order.patient.lastName}
            <span className="mx-2 text-slate-300">·</span>
            <span className="font-mono text-xs">{order.patient.mrn}</span>
            <span className="mx-2 text-slate-300">·</span>
            Created {formatDate(order.createdAt)} by {order.createdBy.firstName}{" "}
            {order.createdBy.lastName}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Printer size={14} />
            Print
          </button>

          {/* Generate Report — shown when RESULTED and no report yet */}
          {order?.status === "RESULTED" && !existingReport && (
            <button
              onClick={() => generateReportMutation.mutate()}
              disabled={generateReportMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
            >
              {generateReportMutation.isPending ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <FilePlus2 size={13} />
              )}
              Generate Report
            </button>
          )}

          {/* View Report — shown when report exists */}
          {existingReport && (
            <button
              onClick={() => router.push("/reports")}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-sm font-medium rounded-lg transition-colors"
            >
              <ExternalLink size={13} />
              View Report
            </button>
          )}

          {/* Status update dropdown */}
          {!isTerminal && (
            <div className="relative">
              <button
                onClick={() => setShowStatusMenu((o) => !o)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1B4F8A] hover:bg-[#143C6B] text-white text-sm font-medium rounded-lg transition-colors"
              >
                Update Status
                <ChevronDown size={13} />
              </button>
              {showStatusMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowStatusMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden min-w-[180px]">
                    {nextStatuses.map((s) => (
                      <button
                        key={s}
                        onClick={() => {
                          setConfirmStatus(s);
                          setShowStatusMenu(false);
                        }}
                        className={`w-full text-left px-3 py-2.5 text-sm hover:bg-slate-50 transition-colors ${
                          s === "CANCELLED" ? "text-red-600" : "text-slate-700"
                        }`}
                      >
                        → {STATUS_LABEL[s]}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Progress stepper */}
      {!isCancelled && (
        <div className="bg-white rounded-xl card-shadow px-6 py-4">
          <div className="flex items-center">
            {STATUS_FLOW.map((s, i) => {
              const done = statusIndex > i;
              const active = statusIndex === i;
              return (
                <div key={s} className="flex items-center flex-1 last:flex-none">
                  <div
                    className={`flex flex-col items-center gap-1 ${
                      active ? "text-[#1B4F8A]" : done ? "text-green-600" : "text-slate-300"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                        done
                          ? "border-green-500 bg-green-500 text-white"
                          : active
                          ? "border-[#1B4F8A] bg-[#1B4F8A] text-white"
                          : "border-slate-200 bg-white text-slate-300"
                      }`}
                    >
                      {done ? <Check size={13} /> : <span className="text-xs font-bold">{i + 1}</span>}
                    </div>
                    <span className="text-[10px] font-medium whitespace-nowrap hidden sm:block">
                      {STATUS_LABEL[s]}
                    </span>
                  </div>
                  {i < STATUS_FLOW.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-2 mb-3 transition-colors ${
                        statusIndex > i ? "bg-green-400" : "bg-slate-100"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main content — 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column (2/3) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Order items */}
          <div className="bg-white rounded-xl card-shadow overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
              <FlaskConical size={16} className="text-[#1B4F8A]" />
              <h2 className="font-semibold text-slate-900">
                Order Items ({order.items.length})
              </h2>
            </div>
            <div className="divide-y divide-slate-100">
              <div className="px-5 py-2 grid grid-cols-[1fr_60px_70px_80px_80px] gap-3 text-xs font-medium text-slate-400 uppercase tracking-wide">
                <span>Test</span>
                <span className="text-center">Qty</span>
                <span className="text-right">Price</span>
                <span className="text-right">Disc%</span>
                <span className="text-right">Total</span>
              </div>
              {order.items.map((item) => {
                const unitPrice = Number(item.price);
                const discPct = Number(item.discount);
                const lineTotal = unitPrice * item.quantity * (1 - discPct / 100);
                return (
                  <div
                    key={item.id}
                    className="px-5 py-3 grid grid-cols-[1fr_60px_70px_80px_80px] gap-3 items-center"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {item.testCatalog.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        <span className="font-mono">{item.testCatalog.code}</span>
                        {item.testCatalog.loincCode && (
                          <span className="ml-2 text-slate-300">
                            LOINC: {item.testCatalog.loincCode}
                          </span>
                        )}
                      </p>
                    </div>
                    <span className="text-sm text-slate-600 text-center">{item.quantity}</span>
                    <span className="text-sm text-slate-600 text-right">
                      {formatCurrency(unitPrice)}
                    </span>
                    <span className="text-sm text-slate-500 text-right">
                      {discPct > 0 ? `${discPct}%` : "—"}
                    </span>
                    <span className="text-sm font-semibold text-slate-800 text-right">
                      {formatCurrency(lineTotal)}
                    </span>
                  </div>
                );
              })}
              {/* Totals footer */}
              <div className="px-5 py-3 bg-slate-50">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-500">Subtotal</span>
                  <span>{formatCurrency(Number(order.totalAmount))}</span>
                </div>
                {Number(order.discountAmount) > 0 && (
                  <div className="flex justify-between text-sm text-red-500 mb-1">
                    <span>Discount</span>
                    <span>−{formatCurrency(Number(order.discountAmount))}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base border-t border-slate-200 pt-2">
                  <span>Net Amount</span>
                  <span className="text-[#1B4F8A]">
                    {formatCurrency(Number(order.netAmount))}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Samples / Barcodes */}
          {order.samples.length > 0 && (
            <div className="bg-white rounded-xl card-shadow p-5">
              <h2 className="font-semibold text-slate-900 mb-4">
                Sample Barcodes ({order.samples.length})
              </h2>
              <div className="flex flex-wrap gap-6">
                {order.samples.map((sample) => (
                  <div key={sample.id} className="flex flex-col items-center gap-2">
                    <BarcodeDisplay
                      value={sample.barcodeId}
                      label={`${sample.type} · ${sample.status.replace(/_/g, " ")}`}
                    />
                    <StatusBadge status={sample.status} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column (1/3) */}
        <div className="space-y-4">
          {/* Patient card */}
          <div className="bg-white rounded-xl card-shadow p-5">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                style={{ backgroundColor: getAvatarColor(`${order.patient.firstName} ${order.patient.lastName}`) }}
              >
                {getInitials(order.patient.firstName, order.patient.lastName)}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 truncate">
                  {order.patient.firstName} {order.patient.lastName}
                </p>
                <p className="text-xs text-slate-500 font-mono">{order.patient.mrn}</p>
              </div>
              <button
                onClick={() => router.push(`/patients/${order.patient.id}`)}
                className="ml-auto p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-[#1B4F8A] transition-colors flex-shrink-0"
                title="View patient"
              >
                <User size={14} />
              </button>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Phone</span>
                <span className="font-medium">{order.patient.phone}</span>
              </div>
              {order.patient.email && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Email</span>
                  <span className="font-medium truncate ml-4">{order.patient.email}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Gender</span>
                <span className="font-medium capitalize">{order.patient.gender.toLowerCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">DOB</span>
                <span className="font-medium">{formatDate(order.patient.dob)}</span>
              </div>
            </div>
          </div>

          {/* Invoice card */}
          {order.invoices.length > 0 && (
            <div className="bg-white rounded-xl card-shadow p-5">
              <div className="flex items-center gap-2 mb-3">
                <FileText size={15} className="text-[#1B4F8A]" />
                <h3 className="font-semibold text-slate-900 text-sm">Invoice</h3>
              </div>
              {order.invoices.map((inv) => (
                <div key={inv.id} className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Invoice #</span>
                    <span className="font-mono font-medium text-xs">{inv.invoiceNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Amount</span>
                    <span className="font-bold text-[#1B4F8A]">
                      {formatCurrency(Number(inv.total))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Status</span>
                    <StatusBadge status={inv.status} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Order info */}
          <div className="bg-white rounded-xl card-shadow p-5 space-y-2.5 text-sm">
            <h3 className="font-semibold text-slate-900 text-sm mb-3">Order Details</h3>
            <div className="flex justify-between">
              <span className="text-slate-500">Branch</span>
              <span className="font-medium">{order.branch.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Priority</span>
              <PriorityBadge priority={order.priority} />
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Created</span>
              <span className="font-medium text-xs">{formatDateTime(order.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Last updated</span>
              <span className="font-medium text-xs">{formatDateTime(order.updatedAt)}</span>
            </div>
            {order.notes && (
              <div className="pt-2 border-t border-slate-100">
                <p className="text-slate-500 mb-1">Notes</p>
                <p className="text-slate-700">{order.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status confirmation modal */}
      {confirmStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Confirm Status Update</h3>
              <button
                onClick={() => { setConfirmStatus(null); setStatusNotes(""); }}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-sm text-slate-600">
              Change status from{" "}
              <span className="font-semibold">{STATUS_LABEL[order.status]}</span> to{" "}
              <span
                className={`font-semibold ${confirmStatus === "CANCELLED" ? "text-red-600" : "text-[#1B4F8A]"}`}
              >
                {STATUS_LABEL[confirmStatus]}
              </span>
              ?
            </p>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Notes (optional)
              </label>
              <textarea
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
                rows={2}
                placeholder="Add a note about this status change..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20 focus:border-[#1B4F8A] resize-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { setConfirmStatus(null); setStatusNotes(""); }}
                className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleStatusUpdate}
                disabled={isUpdating}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2 ${
                  confirmStatus === "CANCELLED"
                    ? "bg-red-600 hover:bg-red-700 disabled:opacity-60"
                    : "bg-[#1B4F8A] hover:bg-[#143C6B] disabled:opacity-60"
                }`}
              >
                {isUpdating && <Loader2 size={13} className="animate-spin" />}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
