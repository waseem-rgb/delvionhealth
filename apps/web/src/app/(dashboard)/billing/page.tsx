"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import {
  FileText,
  CreditCard,
  Shield,
  BarChart3,
  Plus,
  Download,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  TrendingUp,
  AlertTriangle,
  Repeat,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { DataTable } from "@/components/tables/DataTable";
import { SearchInput } from "@/components/shared/SearchInput";
import { formatDate, formatCurrency } from "@/lib/utils";
import api from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────

interface Invoice {
  id: string;
  invoiceNumber: string;
  status: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  amountPaid: number;
  balance: number;
  isOverdue: boolean;
  dueDate: string | null;
  createdAt: string;
  patient: { id: string; firstName: string; lastName: string; mrn: string };
  order: { id: string; orderNumber: string };
}

interface Payment {
  id: string;
  amount: number;
  method: string;
  status: string;
  paidAt: string;
  reference: string | null;
  notes: string | null;
  invoiceId: string;
}

interface InsuranceClaim {
  id: string;
  insurerName: string | null;
  memberId: string | null;
  claimNumber: string | null;
  amount: number;
  approvedAmount: number | null;
  status: string;
  createdAt: string;
  invoice: {
    invoiceNumber: string;
    patient: { firstName: string; lastName: string; mrn: string };
    order: { orderNumber: string };
  };
}

interface ARBucket {
  count: number;
  total: number;
}

interface OverdueItem {
  patient: string;
  invoiceNumber: string;
  daysOverdue: number;
  balance: number;
}

interface SummaryData {
  total_invoiced: number;
  total_collected: number;
  total_outstanding: number;
  collection_rate: number;
  by_method: Record<string, number>;
  daily_collection: Array<{ date: string; amount: number }>;
}

interface DenialDashboard {
  totalDenied: number;
  underReview: number;
  appealSuccessRate: number;
}

interface DeniedClaim {
  id: string;
  claimNumber: string | null;
  insurerName: string | null;
  denialCode: string | null;
  denialReason: string | null;
  status: string;
  invoice: {
    invoiceNumber: string;
    patient: { firstName: string; lastName: string; mrn: string };
  };
}

interface PaymentPlan {
  id: string;
  totalAmount: number;
  amountPaid: number;
  remaining: number;
  frequency: string;
  nextDueDate: string | null;
  status: string;
  installmentCount: number;
  patient: { id: string; firstName: string; lastName: string } | null;
  invoice: { invoiceNumber: string } | null;
  installments?: PlanInstallment[];
}

interface PlanInstallment {
  id: string;
  dueDate: string;
  amount: number;
  paidAt: string | null;
  status: string;
}

// ── Status helpers ─────────────────────────────────────────────────────────

function InvoiceStatusBadge({ status, isOverdue }: { status: string; isOverdue?: boolean }) {
  if (isOverdue && status !== "PAID" && status !== "CANCELLED") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
        <AlertCircle className="w-3 h-3" />
        OVERDUE
      </span>
    );
  }
  const map: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    DRAFT: { bg: "bg-slate-50 border-slate-200 text-slate-600", text: "DRAFT", icon: <FileText className="w-3 h-3" /> },
    SENT: { bg: "bg-blue-50 border-blue-200 text-blue-700", text: "SENT", icon: <Clock className="w-3 h-3" /> },
    PAID: { bg: "bg-green-50 border-green-200 text-green-700", text: "PAID", icon: <CheckCircle2 className="w-3 h-3" /> },
    PARTIALLY_PAID: { bg: "bg-yellow-50 border-yellow-200 text-yellow-700", text: "PARTIAL", icon: <TrendingUp className="w-3 h-3" /> },
    OVERDUE: { bg: "bg-red-50 border-red-200 text-red-700", text: "OVERDUE", icon: <AlertCircle className="w-3 h-3" /> },
    CANCELLED: { bg: "bg-slate-50 border-slate-200 text-slate-400", text: "CANCELLED", icon: <XCircle className="w-3 h-3" /> },
  };
  const s = map[status] ?? map["DRAFT"];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${s.bg}`}>
      {s.icon}
      {s.text}
    </span>
  );
}

function ClaimStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT: "bg-slate-50 border-slate-200 text-slate-600",
    SUBMITTED: "bg-blue-50 border-blue-200 text-blue-700",
    PENDING: "bg-yellow-50 border-yellow-200 text-yellow-700",
    APPROVED: "bg-green-50 border-green-200 text-green-700",
    REJECTED: "bg-red-50 border-red-200 text-red-700",
    APPEALED: "bg-purple-50 border-purple-200 text-purple-700",
    SETTLED: "bg-teal-50 border-teal-200 text-teal-700",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${map[status] ?? map["DRAFT"]}`}>
      {status}
    </span>
  );
}

function PlanStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACTIVE: "bg-blue-50 border-blue-200 text-blue-700",
    COMPLETED: "bg-green-50 border-green-200 text-green-700",
    DEFAULTED: "bg-red-50 border-red-200 text-red-700",
    CANCELLED: "bg-slate-50 border-slate-200 text-slate-500",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${map[status] ?? map["ACTIVE"]}`}>
      {status}
    </span>
  );
}

// ── Record Payment Modal ───────────────────────────────────────────────────

function RecordPaymentModal({
  invoice,
  onClose,
  onSuccess,
}: {
  invoice: Invoice;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState(invoice.balance > 0 ? String(invoice.balance.toFixed(2)) : "");
  const [method, setMethod] = useState("CASH");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post("/billing/payments", data),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to record payment";
      setError(msg);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { setError("Enter a valid amount"); return; }
    mutation.mutate({ invoiceId: invoice.id, amount: amt, method, reference: reference || undefined, notes: notes || undefined });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Record Payment</h2>
        <div className="bg-slate-50 rounded-lg p-3 text-sm">
          <p className="text-slate-600">Invoice: <span className="font-mono font-semibold">{invoice.invoiceNumber}</span></p>
          <p className="text-slate-600">Patient: <span className="font-semibold">{invoice.patient.firstName} {invoice.patient.lastName}</span></p>
          <p className="text-slate-600">Balance Due: <span className="font-bold text-red-600">{formatCurrency(invoice.balance)}</span></p>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Amount (₹)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Payment Method</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            >
              {["CASH", "CARD", "UPI", "WALLET", "INSURANCE", "BANK_TRANSFER", "CREDIT"].map((m) => (
                <option key={m} value={m}>{m.replace("_", " ")}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Reference / UTR (optional)</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Transaction ID or cheque number"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            />
          </div>
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
              {mutation.isPending ? "Recording..." : "Record Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Invoices Tab ───────────────────────────────────────────────────────────

const INVOICE_STATUS_TABS = [
  { label: "All", value: "" },
  { label: "Draft", value: "DRAFT" },
  { label: "Sent", value: "SENT" },
  { label: "Partially Paid", value: "PARTIALLY_PAID" },
  { label: "Paid", value: "PAID" },
  { label: "Overdue", value: "", overdue: true },
  { label: "Cancelled", value: "CANCELLED" },
];

function InvoicesTab() {
  const router = useRouter();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [statusTab, setStatusTab] = useState(0);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);

  const tab = INVOICE_STATUS_TABS[statusTab];
  const params = new URLSearchParams({
    page: String(page),
    limit: "20",
    ...(search && { search }),
    ...(tab?.value && { status: tab.value }),
    ...(tab?.overdue && { overdue: "true" }),
  }).toString();

  const { data, isLoading } = useQuery({
    queryKey: ["billing-invoices", params],
    queryFn: async () => {
      const res = await api.get<{ data: { data: Invoice[]; meta: { total: number; totalPages: number } } }>(`/billing/invoices?${params}`);
      return res.data.data;
    },
  });

  const downloadMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.get<{ data: { url: string } }>(`/billing/invoices/${id}/download`);
      window.open(res.data.data.url, "_blank");
    },
  });

  const columns: ColumnDef<Invoice>[] = [
    {
      accessorKey: "invoiceNumber",
      header: "Invoice #",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-[#1B4F8A] font-semibold">
          {row.original.invoiceNumber}
        </span>
      ),
    },
    {
      header: "Patient",
      cell: ({ row }) => (
        <div>
          <p className="font-semibold text-slate-800 text-sm">
            {row.original.patient.firstName} {row.original.patient.lastName}
          </p>
          <p className="text-xs text-slate-400 font-mono">{row.original.patient.mrn}</p>
        </div>
      ),
    },
    {
      header: "Order",
      cell: ({ row }) => (
        <button
          className="font-mono text-xs text-slate-600 hover:text-[#1B4F8A] underline-offset-2 hover:underline"
          onClick={(e) => { e.stopPropagation(); router.push(`/orders/${row.original.order.id}`); }}
        >
          {row.original.order.orderNumber}
        </button>
      ),
    },
    {
      header: "Status",
      cell: ({ row }) => (
        <InvoiceStatusBadge status={row.original.status} isOverdue={row.original.isOverdue} />
      ),
    },
    {
      header: "Total",
      cell: ({ row }) => <span className="font-semibold">{formatCurrency(Number(row.original.total))}</span>,
    },
    {
      header: "Paid",
      cell: ({ row }) => (
        <span className="text-green-600 font-medium">{formatCurrency(Number(row.original.amountPaid))}</span>
      ),
    },
    {
      header: "Balance",
      cell: ({ row }) => {
        const bal = Number(row.original.balance);
        return (
          <span className={bal > 0 ? "text-red-600 font-semibold" : "text-slate-400"}>
            {formatCurrency(bal)}
          </span>
        );
      },
    },
    {
      header: "Due Date",
      cell: ({ row }) => row.original.dueDate ? formatDate(row.original.dueDate) : "—",
    },
    {
      header: "Created",
      cell: ({ row }) => formatDate(row.original.createdAt),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex gap-2">
          {row.original.balance > 0 && row.original.status !== "CANCELLED" && (
            <button
              onClick={(e) => { e.stopPropagation(); setPaymentInvoice(row.original); }}
              className="px-2 py-1 text-xs font-semibold bg-green-50 text-green-700 border border-green-200 rounded-md hover:bg-green-100"
            >
              + Payment
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              downloadMutation.mutate(row.original.id);
            }}
            className="p-1 text-slate-400 hover:text-[#1B4F8A] rounded"
            title="Download PDF"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {INVOICE_STATUS_TABS.map((t, i) => (
          <button
            key={i}
            onClick={() => { setStatusTab(i); setPage(1); }}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              statusTab === i
                ? "border-[#1B4F8A] text-[#1B4F8A]"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex gap-3">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search invoices, patients, MRN..." />
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

      {paymentInvoice && (
        <RecordPaymentModal
          invoice={paymentInvoice}
          onClose={() => setPaymentInvoice(null)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ["billing-invoices"] })}
        />
      )}
    </div>
  );
}

// ── Payments Tab ───────────────────────────────────────────────────────────

function PaymentsTab() {
  const qc = useQueryClient();
  const [refundId, setRefundId] = useState<string | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [summaryError, setSummaryError] = useState("");

  const { data: summary } = useQuery({
    queryKey: ["billing-summary"],
    queryFn: async () => {
      const res = await api.get<{ data: SummaryData }>("/billing/summary");
      return res.data.data;
    },
  });

  const refundMutation = useMutation({
    mutationFn: (data: { amount: number; reason: string }) =>
      api.post(`/billing/payments/${refundId}/refund`, data),
    onSuccess: () => {
      setRefundId(null);
      qc.invalidateQueries({ queryKey: ["billing-summary"] });
    },
    onError: (e: unknown) => {
      setSummaryError(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Refund failed"
      );
    },
  });

  function handleRefund(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(refundAmount);
    if (isNaN(amt) || amt <= 0) { setSummaryError("Enter valid amount"); return; }
    refundMutation.mutate({ amount: amt, reason: refundReason });
  }

  const byMethod = summary?.by_method ?? {};
  const totalCollected = summary?.total_collected ?? 0;
  const daily = summary?.daily_collection ?? [];

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Invoiced", value: formatCurrency(summary?.total_invoiced ?? 0), color: "text-slate-800" },
          { label: "Total Collected", value: formatCurrency(summary?.total_collected ?? 0), color: "text-green-600" },
          { label: "Outstanding", value: formatCurrency(summary?.total_outstanding ?? 0), color: "text-red-600" },
          { label: "Collection Rate", value: `${summary?.collection_rate ?? 0}%`, color: "text-blue-600" },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{k.label}</p>
            <p className={`text-2xl font-bold mt-1 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* By Method */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-4">Collection by Method</h3>
        {Object.keys(byMethod).length === 0 ? (
          <p className="text-slate-400 text-sm">No payments recorded this month</p>
        ) : (
          <div className="space-y-2">
            {Object.entries(byMethod)
              .sort(([, a], [, b]) => b - a)
              .map(([method, amount]) => {
                const pct = totalCollected > 0 ? (amount / totalCollected) * 100 : 0;
                return (
                  <div key={method}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-700 font-medium">{method.replace("_", " ")}</span>
                      <span className="font-semibold">{formatCurrency(amount)}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#1B4F8A] rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Daily Collection Chart (simple bars) */}
      {daily.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Daily Collection (This Month)</h3>
          <div className="flex items-end gap-1 h-24 overflow-x-auto">
            {daily.map((d) => {
              const maxAmount = Math.max(...daily.map((x) => x.amount), 1);
              const h = (d.amount / maxAmount) * 96;
              return (
                <div key={d.date} className="flex flex-col items-center gap-1 flex-shrink-0" style={{ minWidth: 24 }}>
                  <div
                    className="w-5 bg-[#1B4F8A] rounded-t"
                    style={{ height: h }}
                    title={`${d.date}: ${formatCurrency(d.amount)}`}
                  />
                  <span className="text-xs text-slate-400 rotate-45 origin-left">{d.date.slice(8)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {refundId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Issue Refund</h2>
            {summaryError && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{summaryError}</p>}
            <form onSubmit={handleRefund} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Refund Amount (₹)</label>
                <input type="number" step="0.01" min="0.01" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Reason</label>
                <textarea rows={2} value={refundReason} onChange={(e) => setRefundReason(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30" />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setRefundId(null)} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700">Cancel</button>
                <button type="submit" disabled={refundMutation.isPending} className="flex-1 px-4 py-2 bg-red-600 rounded-lg text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                  {refundMutation.isPending ? "Processing..." : "Issue Refund"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Insurance Claims Tab ───────────────────────────────────────────────────

function ClaimsTab() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState("");

  const params = new URLSearchParams({
    page: String(page),
    limit: "20",
    ...(statusFilter && { status: statusFilter }),
  }).toString();

  const { data, isLoading } = useQuery({
    queryKey: ["billing-claims", params],
    queryFn: async () => {
      const res = await api.get<{ data: { data: InsuranceClaim[]; meta: { total: number; totalPages: number } } }>(`/billing/claims?${params}`);
      return res.data.data;
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.put(`/billing/claims/${id}/status`, { status }),
    onSuccess: () => {
      setUpdatingId(null);
      qc.invalidateQueries({ queryKey: ["billing-claims"] });
    },
  });

  const claimStatuses = ["DRAFT", "SUBMITTED", "PENDING", "APPROVED", "REJECTED", "APPEALED", "SETTLED"];

  const columns: ColumnDef<InsuranceClaim>[] = [
    {
      header: "Claim #",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-slate-600">{row.original.claimNumber ?? "—"}</span>
      ),
    },
    {
      header: "Invoice",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-[#1B4F8A] font-semibold">
          {row.original.invoice.invoiceNumber}
        </span>
      ),
    },
    {
      header: "Patient",
      cell: ({ row }) => (
        <div>
          <p className="text-sm font-semibold text-slate-800">
            {row.original.invoice.patient.firstName} {row.original.invoice.patient.lastName}
          </p>
          <p className="text-xs text-slate-400">{row.original.invoice.patient.mrn}</p>
        </div>
      ),
    },
    {
      header: "Insurer",
      cell: ({ row }) => row.original.insurerName ?? "—",
    },
    {
      header: "Claim Amount",
      cell: ({ row }) => <span className="font-semibold">{formatCurrency(Number(row.original.amount))}</span>,
    },
    {
      header: "Approved",
      cell: ({ row }) => row.original.approvedAmount ? (
        <span className="text-green-600 font-semibold">{formatCurrency(Number(row.original.approvedAmount))}</span>
      ) : "—",
    },
    {
      header: "Status",
      cell: ({ row }) => <ClaimStatusBadge status={row.original.status} />,
    },
    {
      header: "Submitted",
      cell: ({ row }) => formatDate(row.original.createdAt),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex gap-1">
          {updatingId === row.original.id ? (
            <div className="flex gap-1">
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="text-xs border border-slate-200 rounded px-1 py-0.5"
              >
                <option value="">Select status</option>
                {claimStatuses.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <button
                onClick={() => newStatus && statusMutation.mutate({ id: row.original.id, status: newStatus })}
                className="text-xs px-2 py-1 bg-[#1B4F8A] text-white rounded"
              >
                Save
              </button>
              <button onClick={() => setUpdatingId(null)} className="text-xs px-2 py-1 text-slate-500">✕</button>
            </div>
          ) : (
            <button
              onClick={() => { setUpdatingId(row.original.id); setNewStatus(row.original.status); }}
              className="text-xs px-2 py-1 border border-slate-200 rounded hover:bg-slate-50"
            >
              Update
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
        >
          <option value="">All Statuses</option>
          {["DRAFT", "SUBMITTED", "PENDING", "APPROVED", "REJECTED", "APPEALED", "SETTLED"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
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
    </div>
  );
}

// ── AR Aging Tab ───────────────────────────────────────────────────────────

function ARAgingTab() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["billing-receivables"],
    queryFn: async () => {
      const res = await api.get<{ data: { buckets: Record<string, ARBucket>; topOverdue: OverdueItem[] } }>("/billing/receivables");
      return res.data.data;
    },
  });

  const buckets = data?.buckets;
  const bucketConfig = [
    { key: "current", label: "Current (Not Due)", color: "bg-green-100 text-green-800 border-green-200" },
    { key: "days_1_30", label: "1–30 Days", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
    { key: "days_31_60", label: "31–60 Days", color: "bg-orange-100 text-orange-800 border-orange-200" },
    { key: "days_61_90", label: "61–90 Days", color: "bg-red-100 text-red-800 border-red-200" },
    { key: "days_90_plus", label: "90+ Days", color: "bg-red-200 text-red-900 border-red-300" },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1B4F8A]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">AR Aging Report</h3>
        <button onClick={() => refetch()} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      {/* Aging Buckets */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {bucketConfig.map(({ key, label, color }) => {
          const b = buckets?.[key];
          return (
            <div key={key} className={`rounded-xl border p-4 ${color}`}>
              <p className="text-xs font-bold uppercase tracking-wide mb-2">{label}</p>
              <p className="text-2xl font-bold">{formatCurrency(b?.total ?? 0)}</p>
              <p className="text-xs mt-1 opacity-70">{b?.count ?? 0} invoices</p>
            </div>
          );
        })}
      </div>

      {/* Top Overdue */}
      {(data?.topOverdue.length ?? 0) > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
            <h3 className="text-sm font-bold text-slate-700">Top Overdue Invoices</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Patient</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Invoice #</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Days Overdue</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Balance</th>
              </tr>
            </thead>
            <tbody>
              {data?.topOverdue.map((item, i) => (
                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-800">{item.patient}</td>
                  <td className="px-5 py-3 font-mono text-xs text-[#1B4F8A] font-semibold">{item.invoiceNumber}</td>
                  <td className="px-5 py-3 text-right">
                    <span className={`font-bold ${item.daysOverdue > 60 ? "text-red-600" : "text-orange-500"}`}>
                      {item.daysOverdue}d
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-red-600">{formatCurrency(item.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Denial Management Tab ──────────────────────────────────────────────────

function AppealModal({
  claimId,
  onClose,
  onSuccess,
}: {
  claimId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () => api.post(`/billing/claims/${claimId}/appeal`, { appealNotes: notes }),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (e: unknown) => {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Appeal failed");
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Appeal Claim</h2>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Appeal Notes</label>
          <textarea
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Explain grounds for appeal..."
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
          />
        </div>
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !notes.trim()}
            className="flex-1 px-4 py-2 bg-purple-600 rounded-lg text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
          >
            {mutation.isPending ? "Submitting..." : "Submit Appeal"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DenialManagementTab() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [appealClaimId, setAppealClaimId] = useState<string | null>(null);
  const [resubmitId, setResubmitId] = useState<string | null>(null);

  const { data: dashboard } = useQuery({
    queryKey: ["billing-denials-dashboard"],
    queryFn: async () => {
      const res = await api.get<{ data: DenialDashboard }>("/billing/denials/dashboard");
      return res.data.data;
    },
  });

  const params = new URLSearchParams({
    page: String(page),
    limit: "20",
    status: "REJECTED",
  }).toString();

  const { data, isLoading } = useQuery({
    queryKey: ["billing-denied-claims", page],
    queryFn: async () => {
      const res = await api.get<{ data: { data: DeniedClaim[]; meta: { total: number } } }>(`/billing/claims?${params}`);
      return res.data.data;
    },
  });

  const resubmitMutation = useMutation({
    mutationFn: (id: string) => api.post(`/billing/claims/${id}/resubmit`, {}),
    onSuccess: () => {
      setResubmitId(null);
      qc.invalidateQueries({ queryKey: ["billing-denied-claims"] });
      qc.invalidateQueries({ queryKey: ["billing-denials-dashboard"] });
    },
  });

  const columns: ColumnDef<DeniedClaim>[] = [
    {
      header: "Claim #",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-slate-600 font-semibold">{row.original.claimNumber ?? "—"}</span>
      ),
    },
    {
      header: "Patient",
      cell: ({ row }) => (
        <div>
          <p className="text-sm font-semibold text-slate-800">
            {row.original.invoice.patient.firstName} {row.original.invoice.patient.lastName}
          </p>
          <p className="text-xs text-slate-400 font-mono">{row.original.invoice.patient.mrn}</p>
        </div>
      ),
    },
    {
      header: "Insurer",
      cell: ({ row }) => <span className="text-sm text-slate-700">{row.original.insurerName ?? "—"}</span>,
    },
    {
      header: "Denial Code",
      cell: ({ row }) => (
        <span className="font-mono text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded">
          {row.original.denialCode ?? "N/A"}
        </span>
      ),
    },
    {
      header: "Denial Reason",
      cell: ({ row }) => (
        <span className="text-sm text-slate-600 max-w-xs truncate block" title={row.original.denialReason ?? ""}>
          {row.original.denialReason ?? "—"}
        </span>
      ),
    },
    {
      header: "Status",
      cell: ({ row }) => <ClaimStatusBadge status={row.original.status} />,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex gap-1.5">
          <button
            onClick={() => setAppealClaimId(row.original.id)}
            className="flex items-center gap-1 px-2 py-1 text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 rounded hover:bg-purple-100"
          >
            <TrendingUp className="w-3 h-3" />
            Appeal
          </button>
          <button
            onClick={() => setResubmitId(row.original.id)}
            className="flex items-center gap-1 px-2 py-1 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100"
          >
            <Repeat className="w-3 h-3" />
            Resubmit
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">Total Denied</p>
          <p className="text-3xl font-bold text-red-700 mt-1">{dashboard?.totalDenied ?? 0}</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-yellow-700 uppercase tracking-wide">Under Review</p>
          <p className="text-3xl font-bold text-yellow-700 mt-1">{dashboard?.underReview ?? 0}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Appeal Success Rate</p>
          <p className="text-3xl font-bold text-green-700 mt-1">{dashboard?.appealSuccessRate ?? 0}%</p>
        </div>
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

      {appealClaimId && (
        <AppealModal
          claimId={appealClaimId}
          onClose={() => setAppealClaimId(null)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["billing-denied-claims"] });
            qc.invalidateQueries({ queryKey: ["billing-denials-dashboard"] });
          }}
        />
      )}

      {/* Resubmit Confirm */}
      {resubmitId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Resubmit Claim</h2>
            <p className="text-sm text-slate-600">Are you sure you want to resubmit this denied claim to the insurer?</p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setResubmitId(null)}
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => resubmitMutation.mutate(resubmitId)}
                disabled={resubmitMutation.isPending}
                className="flex-1 px-4 py-2 bg-[#1B4F8A] rounded-lg text-sm font-semibold text-white hover:bg-[#163d6a] disabled:opacity-50"
              >
                {resubmitMutation.isPending ? "Resubmitting..." : "Confirm Resubmit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Payment Plans Tab ──────────────────────────────────────────────────────

function CreatePlanModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    patientId: "",
    invoiceId: "",
    totalAmount: "",
    installmentCount: "3",
    frequency: "MONTHLY",
  });
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      api.post("/billing/payment-plans", {
        patientId: form.patientId,
        invoiceId: form.invoiceId,
        totalAmount: parseFloat(form.totalAmount),
        installmentCount: parseInt(form.installmentCount, 10),
        frequency: form.frequency,
      }),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (e: unknown) => {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to create plan");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(form.totalAmount);
    const cnt = parseInt(form.installmentCount, 10);
    if (!form.patientId.trim()) { setError("Patient ID is required"); return; }
    if (!form.invoiceId.trim()) { setError("Invoice ID is required"); return; }
    if (isNaN(amt) || amt <= 0) { setError("Enter a valid total amount"); return; }
    if (isNaN(cnt) || cnt < 1) { setError("Installment count must be at least 1"); return; }
    setError("");
    mutation.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Create Payment Plan</h2>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          {[
            { label: "Patient ID", key: "patientId", placeholder: "e.g. clxxxxx..." },
            { label: "Invoice ID", key: "invoiceId", placeholder: "e.g. clxxxxx..." },
          ].map(({ label, key, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
              <input
                type="text"
                value={form[key as keyof typeof form]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
              />
            </div>
          ))}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Total Amount (₹)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={form.totalAmount}
              onChange={(e) => setForm((f) => ({ ...f, totalAmount: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Number of Installments</label>
            <input
              type="number"
              min="1"
              max="36"
              value={form.installmentCount}
              onChange={(e) => setForm((f) => ({ ...f, installmentCount: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Frequency</label>
            <select
              value={form.frequency}
              onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            >
              <option value="WEEKLY">Weekly</option>
              <option value="BIWEEKLY">Bi-weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
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
              {mutation.isPending ? "Creating..." : "Create Plan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InstallmentPayModal({
  planId,
  installment,
  onClose,
  onSuccess,
}: {
  planId: string;
  installment: PlanInstallment;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [method, setMethod] = useState("CASH");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/billing/payment-plans/${planId}/installments/${installment.id}/pay`, {
        method,
        amount: installment.amount,
      }),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (e: unknown) => {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Payment failed");
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Pay Installment</h2>
        <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
          <p className="text-slate-600">Due Date: <span className="font-semibold">{formatDate(installment.dueDate)}</span></p>
          <p className="text-slate-600">Amount: <span className="font-bold text-slate-900">{formatCurrency(installment.amount)}</span></p>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Payment Method</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
          >
            {["CASH", "CARD", "UPI", "WALLET", "BANK_TRANSFER"].map((m) => (
              <option key={m} value={m}>{m.replace("_", " ")}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="flex-1 px-4 py-2 bg-green-600 rounded-lg text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {mutation.isPending ? "Processing..." : "Confirm Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PlanRow({ plan }: { plan: PaymentPlan }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [payingInstallment, setPayingInstallment] = useState<PlanInstallment | null>(null);

  const { data: installments, isLoading: instLoading } = useQuery({
    queryKey: ["plan-installments", plan.id],
    queryFn: async () => {
      const res = await api.get<{ data: PlanInstallment[] }>(`/billing/payment-plans/${plan.id}/installments`);
      return res.data.data;
    },
    enabled: expanded,
  });

  const instStatusColor: Record<string, string> = {
    PENDING: "bg-yellow-50 text-yellow-700 border-yellow-200",
    PAID: "bg-green-50 text-green-700 border-green-200",
    OVERDUE: "bg-red-50 text-red-700 border-red-200",
    CANCELLED: "bg-slate-50 text-slate-500 border-slate-200",
  };

  return (
    <>
      <tr className="border-b border-slate-100 hover:bg-slate-50">
        <td className="px-4 py-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
          >
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <span className="font-semibold text-slate-800">
              {plan.patient ? `${plan.patient.firstName} ${plan.patient.lastName}` : "—"}
            </span>
          </button>
        </td>
        <td className="px-4 py-3 font-mono text-xs text-[#1B4F8A] font-semibold">
          {plan.invoice?.invoiceNumber ?? "—"}
        </td>
        <td className="px-4 py-3 font-semibold">{formatCurrency(plan.totalAmount)}</td>
        <td className="px-4 py-3 text-green-600 font-medium">{formatCurrency(plan.amountPaid)}</td>
        <td className="px-4 py-3 text-red-600 font-semibold">{formatCurrency(plan.remaining)}</td>
        <td className="px-4 py-3 text-slate-600 text-xs">{plan.frequency}</td>
        <td className="px-4 py-3 text-slate-600 text-sm">
          {plan.nextDueDate ? formatDate(plan.nextDueDate) : "—"}
        </td>
        <td className="px-4 py-3"><PlanStatusBadge status={plan.status} /></td>
      </tr>
      {expanded && (
        <tr className="bg-slate-50/70">
          <td colSpan={8} className="px-6 py-3">
            {instLoading ? (
              <div className="flex gap-2 items-center text-slate-400 text-sm py-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#1B4F8A]" />
                Loading installments...
              </div>
            ) : !installments || installments.length === 0 ? (
              <p className="text-slate-400 text-sm py-2">No installments found.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 uppercase">
                    <th className="py-2 text-left font-semibold">Due Date</th>
                    <th className="py-2 text-right font-semibold">Amount</th>
                    <th className="py-2 text-right font-semibold">Paid At</th>
                    <th className="py-2 text-center font-semibold">Status</th>
                    <th className="py-2 text-right font-semibold"></th>
                  </tr>
                </thead>
                <tbody>
                  {installments.map((inst) => (
                    <tr key={inst.id} className="border-t border-slate-100">
                      <td className="py-2 text-left">{formatDate(inst.dueDate)}</td>
                      <td className="py-2 text-right font-semibold">{formatCurrency(inst.amount)}</td>
                      <td className="py-2 text-right text-slate-500">{inst.paidAt ? formatDate(inst.paidAt) : "—"}</td>
                      <td className="py-2 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${instStatusColor[inst.status] ?? instStatusColor["PENDING"]}`}>
                          {inst.status}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        {inst.status === "PENDING" || inst.status === "OVERDUE" ? (
                          <button
                            onClick={() => setPayingInstallment(inst)}
                            className="px-2 py-1 text-xs font-semibold bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100"
                          >
                            Pay
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
      {payingInstallment && (
        <InstallmentPayModal
          planId={plan.id}
          installment={payingInstallment}
          onClose={() => setPayingInstallment(null)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["plan-installments", plan.id] });
            qc.invalidateQueries({ queryKey: ["billing-payment-plans"] });
          }}
        />
      )}
    </>
  );
}

function PaymentPlansTab() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["billing-payment-plans", page],
    queryFn: async () => {
      const res = await api.get<{ data: { data: PaymentPlan[]; meta: { total: number } } }>(
        `/billing/payment-plans?page=${page}&limit=20`
      );
      return res.data.data;
    },
  });

  const plans = data?.data ?? [];
  const total = data?.meta.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{total} payment plan{total !== 1 ? "s" : ""}</p>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1B4F8A] text-white rounded-lg text-sm font-semibold hover:bg-[#163d6a]"
        >
          <Plus className="w-4 h-4" />
          Create Plan
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {["Patient", "Invoice #", "Total", "Paid", "Remaining", "Frequency", "Next Due", "Status"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-slate-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : plans.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-400 text-sm">
                  No payment plans found
                </td>
              </tr>
            ) : (
              plans.map((plan) => <PlanRow key={plan.id} plan={plan} />)
            )}
          </tbody>
        </table>
      </div>

      {/* Manual pagination for plans table */}
      {total > 20 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total} plans
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 border border-slate-200 rounded text-sm disabled:opacity-40 hover:bg-slate-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page * 20 >= total}
              className="px-3 py-1.5 border border-slate-200 rounded text-sm disabled:opacity-40 hover:bg-slate-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {showCreate && (
        <CreatePlanModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ["billing-payment-plans"] })}
        />
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

const TABS = [
  { id: "invoices", label: "Invoices", icon: FileText },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "claims", label: "Insurance Claims", icon: Shield },
  { id: "aging", label: "AR Aging", icon: BarChart3 },
  { id: "denials", label: "Denial Management", icon: AlertTriangle },
  { id: "plans", label: "Payment Plans", icon: Repeat },
];

export default function BillingPage() {
  const [activeTab, setActiveTab] = useState("invoices");

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Billing & RCM</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Invoice management, payments, insurance claims, and accounts receivable
          </p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-1.5 px-4 py-2 bg-[#1B4F8A] text-white rounded-lg text-sm font-semibold hover:bg-[#163d6a]">
            <Plus className="w-4 h-4" />
            New Claim
          </button>
        </div>
      </div>

      {/* Tab Nav */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-200 overflow-x-auto">
          {TABS.map((tab) => {
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
          {activeTab === "invoices" && <InvoicesTab />}
          {activeTab === "payments" && <PaymentsTab />}
          {activeTab === "claims" && <ClaimsTab />}
          {activeTab === "aging" && <ARAgingTab />}
          {activeTab === "denials" && <DenialManagementTab />}
          {activeTab === "plans" && <PaymentPlansTab />}
        </div>
      </div>
    </div>
  );
}
