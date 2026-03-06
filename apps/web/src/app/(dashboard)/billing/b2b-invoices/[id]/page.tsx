"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Download,
  Send,
  CreditCard,
  Building2,
  Calendar,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  X,
  MapPin,
  Phone,
  Mail,
  Receipt,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { formatDate, formatDateTime, formatCurrency, cn } from "@/lib/utils";
import api from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────

interface B2BLineItem {
  description: string;
  orderId: string;
  amount: number;
}

interface B2BPayment {
  amount: number;
  method: string;
  reference: string | null;
  paidAt: string;
}

interface B2BInvoiceDetail {
  id: string;
  invoiceNumber: string;
  status: string;
  subtotal: number;
  discountAmount: number;
  gstAmount: number;
  totalAmount: number;
  paidAmount: number;
  dueDate: string | null;
  createdAt: string;
  organization: {
    name: string;
    code: string;
    address: string | null;
    gstNumber: string | null;
  };
  lineItems: B2BLineItem[];
  payments: B2BPayment[];
}

// ── Status Badge ───────────────────────────────────────────────────────────

function B2BStatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    B2B_DRAFT: { bg: "bg-slate-50 border-slate-200 text-slate-600", text: "Draft", icon: <FileText className="w-3 h-3" /> },
    B2B_SENT: { bg: "bg-blue-50 border-blue-200 text-blue-700", text: "Sent", icon: <Send className="w-3 h-3" /> },
    B2B_PARTIAL: { bg: "bg-yellow-50 border-yellow-200 text-yellow-700", text: "Partial", icon: <TrendingUp className="w-3 h-3" /> },
    B2B_PAID: { bg: "bg-green-50 border-green-200 text-green-700", text: "Paid", icon: <CheckCircle2 className="w-3 h-3" /> },
    B2B_OVERDUE: { bg: "bg-red-50 border-red-200 text-red-700", text: "Overdue", icon: <AlertCircle className="w-3 h-3" /> },
  };
  const s = map[status] ?? { bg: "bg-slate-50 border-slate-200 text-slate-600", text: status, icon: <FileText className="w-3 h-3" /> };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${s.bg}`}>
      {s.icon}
      {s.text}
    </span>
  );
}

// ── Record Payment Modal ───────────────────────────────────────────────────

function RecordPaymentModal({
  invoice,
  onClose,
  onSuccess,
}: {
  invoice: B2BInvoiceDetail;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const balance = Number(invoice.totalAmount) - Number(invoice.paidAmount);
  const [amount, setAmount] = useState(balance > 0 ? String(balance.toFixed(2)) : "");
  const [method, setMethod] = useState("NEFT");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post(`/billing/b2b-invoices/${invoice.id}/payment`, data),
    onSuccess: () => {
      onSuccess();
      onClose();
    },
    onError: (e: unknown) => {
      setError(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to record payment"
      );
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      setError("Enter a valid amount");
      return;
    }
    mutation.mutate({ amount: amt, method, reference: reference || undefined, notes: notes || undefined });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Record Payment</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        <div className="bg-slate-50 rounded-lg p-3 text-sm">
          <p className="text-slate-600">
            Invoice: <span className="font-mono font-semibold">{invoice.invoiceNumber}</span>
          </p>
          <p className="text-slate-600">
            Organization: <span className="font-semibold">{invoice.organization.name}</span>
          </p>
          <p className="text-slate-600">
            Balance Due: <span className="font-bold text-red-600">{formatCurrency(balance)}</span>
          </p>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Amount</label>
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
              {["CASH", "CHEQUE", "NEFT", "RTGS", "UPI"].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
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

// ── Payment Method Badge ───────────────────────────────────────────────────

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    CASH: "bg-green-50 text-green-700",
    CHEQUE: "bg-purple-50 text-purple-700",
    NEFT: "bg-blue-50 text-blue-700",
    RTGS: "bg-indigo-50 text-indigo-700",
    UPI: "bg-teal-50 text-teal-700",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${colors[method] ?? "bg-slate-50 text-slate-600"}`}>
      {method}
    </span>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function B2BInvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const id = params.id as string;
  const [showPayment, setShowPayment] = useState(false);

  const { data: invoice, isLoading } = useQuery({
    queryKey: ["b2b-invoice", id],
    queryFn: async () => {
      const res = await api.get<{ data: B2BInvoiceDetail }>(`/billing/b2b-invoices/${id}`);
      return res.data.data;
    },
  });

  const sendMutation = useMutation({
    mutationFn: () => api.put(`/billing/b2b-invoices/${id}/send`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["b2b-invoice", id] }),
  });

  const downloadMutation = useMutation({
    mutationFn: async () => {
      const res = await api.get<{ data: { url: string } }>(`/billing/b2b-invoices/${id}/download`);
      window.open(res.data.data.url, "_blank");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-6 max-w-[1400px] mx-auto">
        <p className="text-center text-slate-500 py-20">Invoice not found.</p>
      </div>
    );
  }

  const balance = Number(invoice.totalAmount) - Number(invoice.paidAmount);

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push("/billing/b2b-invoices")}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{invoice.invoiceNumber}</h1>
            <B2BStatusBadge status={invoice.status} />
          </div>
          <p className="text-slate-500 text-sm mt-0.5">{invoice.organization.name}</p>
        </div>
        <div className="flex items-center gap-2">
          {invoice.status === "B2B_DRAFT" && (
            <button
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50"
            >
              <Send size={15} />
              {sendMutation.isPending ? "Sending..." : "Send Invoice"}
            </button>
          )}
          <button
            onClick={() => downloadMutation.mutate()}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            <Download size={15} />
            Download PDF
          </button>
          {invoice.status !== "B2B_PAID" && balance > 0 && (
            <button
              onClick={() => setShowPayment(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#1B4F8A] text-white rounded-lg text-sm font-semibold hover:bg-[#163d6a] transition"
            >
              <CreditCard size={15} />
              Record Payment
            </button>
          )}
        </div>
      </div>

      {/* Outstanding Balance Banner */}
      {balance > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <div className="p-2 bg-red-100 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-red-800">Outstanding Balance</p>
            <p className="text-2xl font-bold text-red-700">{formatCurrency(balance)}</p>
          </div>
          {invoice.dueDate && (
            <div className="ml-auto text-right">
              <p className="text-xs text-red-600">Due Date</p>
              <p className="text-sm font-semibold text-red-800">{formatDate(invoice.dueDate)}</p>
            </div>
          )}
        </div>
      )}

      {/* 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Invoice Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Line Items */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Line Items</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Description</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Order ID</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(invoice.lineItems ?? []).map((item, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-slate-700">{item.description}</td>
                    <td className="px-5 py-3">
                      <span className="font-mono text-xs text-slate-500">{item.orderId}</span>
                    </td>
                    <td className="px-5 py-3 text-right font-medium">{formatCurrency(Number(item.amount))}</td>
                  </tr>
                ))}
                {(invoice.lineItems ?? []).length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-5 py-8 text-center text-slate-400 text-sm">
                      No line items
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {/* Totals */}
            <div className="border-t border-slate-200 bg-slate-50 px-5 py-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-medium">{formatCurrency(Number(invoice.subtotal))}</span>
              </div>
              {Number(invoice.discountAmount) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Discount</span>
                  <span className="font-medium text-green-600">-{formatCurrency(Number(invoice.discountAmount))}</span>
                </div>
              )}
              {Number(invoice.gstAmount) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">GST</span>
                  <span className="font-medium">{formatCurrency(Number(invoice.gstAmount))}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold pt-2 border-t border-slate-200">
                <span className="text-slate-800">Total</span>
                <span className="text-slate-900">{formatCurrency(Number(invoice.totalAmount))}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Amount Paid</span>
                <span className="font-medium text-green-600">{formatCurrency(Number(invoice.paidAmount))}</span>
              </div>
              <div className="flex justify-between text-base font-bold">
                <span className="text-red-700">Balance Due</span>
                <span className="text-red-700">{formatCurrency(balance)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Organization Info + Payments */}
        <div className="space-y-6">
          {/* Organization Info */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Building2 size={16} className="text-slate-400" />
              Organization
            </h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Name</p>
                <p className="font-semibold text-slate-800">{invoice.organization.name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Code</p>
                <p className="font-mono text-slate-600">{invoice.organization.code}</p>
              </div>
              {invoice.organization.address && (
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Address</p>
                  <p className="text-slate-600">{invoice.organization.address}</p>
                </div>
              )}
              {invoice.organization.gstNumber && (
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">GST Number</p>
                  <p className="font-mono text-slate-600">{invoice.organization.gstNumber}</p>
                </div>
              )}
            </div>
          </div>

          {/* Invoice Details */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Calendar size={16} className="text-slate-400" />
              Details
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Created</span>
                <span className="text-slate-700">{formatDate(invoice.createdAt)}</span>
              </div>
              {invoice.dueDate && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Due Date</span>
                  <span className="text-slate-700">{formatDate(invoice.dueDate)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Status</span>
                <B2BStatusBadge status={invoice.status} />
              </div>
            </div>
          </div>

          {/* Payment History */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Receipt size={16} className="text-slate-400" />
              Payment History
            </h3>
            {(invoice.payments ?? []).length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No payments recorded yet</p>
            ) : (
              <div className="space-y-3">
                {(invoice.payments ?? []).map((p, i) => (
                  <div key={i} className="relative pl-6 pb-3 border-l-2 border-slate-200 last:border-transparent">
                    <div className="absolute left-[-5px] top-1 w-2 h-2 rounded-full bg-green-500" />
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {formatCurrency(Number(p.amount))}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <MethodBadge method={p.method} />
                          {p.reference && (
                            <span className="text-xs text-slate-400 font-mono">{p.reference}</span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-slate-400">{formatDate(p.paidAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPayment && invoice && (
        <RecordPaymentModal
          invoice={invoice}
          onClose={() => setShowPayment(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ["b2b-invoice", id] })}
        />
      )}
    </div>
  );
}
