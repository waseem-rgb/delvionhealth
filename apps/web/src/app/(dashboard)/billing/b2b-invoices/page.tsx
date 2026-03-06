"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import {
  FileText,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Download,
  Send,
  CreditCard,
  Building2,
  Clock,
  AlertCircle,
  TrendingUp,
  XCircle,
  Eye,
  X,
} from "lucide-react";
import { DataTable } from "@/components/tables/DataTable";
import { SearchInput } from "@/components/shared/SearchInput";
import { PageHeader } from "@/components/shared/PageHeader";
import { KPICard } from "@/components/shared/KPICard";
import { DateRangePicker, type DateRange } from "@/components/shared/DateRangePicker";
import { formatDate, formatCurrency } from "@/lib/utils";
import api from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────

interface B2BInvoice {
  id: string;
  invoiceNumber: string;
  status: string;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  dueDate: string | null;
  createdAt: string;
  organization: {
    id: string;
    name: string;
    code: string;
  };
}

interface Organization {
  id: string;
  name: string;
  code: string;
}

interface OutstandingData {
  totalInvoiced: number;
  totalOutstanding: number;
  totalOverdue: number;
  totalCollected: number;
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
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${s.bg}`}>
      {s.icon}
      {s.text}
    </span>
  );
}

// ── Generate Invoice Modal ─────────────────────────────────────────────────

function GenerateInvoiceModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [organizationId, setOrganizationId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [error, setError] = useState("");

  const { data: orgs } = useQuery({
    queryKey: ["organizations-dropdown"],
    queryFn: async () => {
      const res = await api.get<{ data: { data: Organization[] } }>("/organizations?limit=100");
      return res.data.data.data ?? [];
    },
  });

  const mutation = useMutation({
    mutationFn: (data: { organizationId: string; dateFrom: string; dateTo: string }) =>
      api.post("/billing/b2b-invoices/generate", data),
    onSuccess: () => {
      onSuccess();
      onClose();
    },
    onError: (e: unknown) => {
      setError(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to generate invoice"
      );
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!organizationId) {
      setError("Please select an organization");
      return;
    }
    if (!dateFrom || !dateTo) {
      setError("Please select a date range");
      return;
    }
    mutation.mutate({ organizationId, dateFrom, dateTo });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Generate B2B Invoice</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Organization *</label>
            <select
              value={organizationId}
              onChange={(e) => setOrganizationId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            >
              <option value="">Select organization...</option>
              {(orgs ?? []).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.code})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">From Date *</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">To Date *</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
              />
            </div>
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
              {mutation.isPending ? "Generating..." : "Generate Invoice"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Record Payment Modal ───────────────────────────────────────────────────

function RecordB2BPaymentModal({
  invoice,
  onClose,
  onSuccess,
}: {
  invoice: B2BInvoice;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState(invoice.balance > 0 ? String(invoice.balance.toFixed(2)) : "");
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
            Balance Due: <span className="font-bold text-red-600">{formatCurrency(invoice.balance)}</span>
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

// ── Status Tabs ────────────────────────────────────────────────────────────

const STATUS_TABS = [
  { label: "All", value: "" },
  { label: "Draft", value: "B2B_DRAFT" },
  { label: "Sent", value: "B2B_SENT" },
  { label: "Partial", value: "B2B_PARTIAL" },
  { label: "Paid", value: "B2B_PAID" },
  { label: "Overdue", value: "B2B_OVERDUE" },
];

// ── Main Page ──────────────────────────────────────────────────────────────

export default function B2BInvoicesPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusTab, setStatusTab] = useState(0);
  const [orgFilter, setOrgFilter] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>({});
  const [showGenerate, setShowGenerate] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<B2BInvoice | null>(null);

  const status = STATUS_TABS[statusTab]?.value ?? "";

  // Fetch organizations for filter
  const { data: orgs } = useQuery({
    queryKey: ["organizations-dropdown"],
    queryFn: async () => {
      const res = await api.get<{ data: { data: Organization[] } }>("/organizations?limit=100");
      return res.data.data.data ?? [];
    },
  });

  // Fetch outstanding summary
  const { data: outstanding, isLoading: outstandingLoading } = useQuery({
    queryKey: ["b2b-outstanding"],
    queryFn: async () => {
      const res = await api.get<{ data: OutstandingData }>("/billing/outstanding");
      return res.data.data;
    },
  });

  // Fetch invoices
  const params = new URLSearchParams({
    page: String(page),
    limit: "20",
    ...(status && { status }),
    ...(orgFilter && { organizationId: orgFilter }),
    ...(dateRange.from && { dateFrom: dateRange.from }),
    ...(dateRange.to && { dateTo: dateRange.to }),
  }).toString();

  const { data, isLoading } = useQuery({
    queryKey: ["b2b-invoices", params],
    queryFn: async () => {
      const res = await api.get<{ data: { data: B2BInvoice[]; meta: { total: number } } }>(
        `/billing/b2b-invoices?${params}`
      );
      return res.data.data;
    },
  });

  // Send invoice mutation
  const sendMutation = useMutation({
    mutationFn: (id: string) => api.put(`/billing/b2b-invoices/${id}/send`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["b2b-invoices"] }),
  });

  // Download
  const downloadMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.get<{ data: { url: string } }>(`/billing/b2b-invoices/${id}/download`);
      window.open(res.data.data.url, "_blank");
    },
  });

  const columns: ColumnDef<B2BInvoice>[] = [
    {
      accessorKey: "invoiceNumber",
      header: "Invoice #",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-[#1B4F8A] font-semibold">{row.original.invoiceNumber}</span>
      ),
    },
    {
      header: "Organization",
      cell: ({ row }) => (
        <div>
          <p className="font-semibold text-slate-800 text-sm">{row.original.organization.name}</p>
          <p className="text-xs text-slate-400 font-mono">{row.original.organization.code}</p>
        </div>
      ),
    },
    {
      header: "Amount",
      cell: ({ row }) => <span className="font-semibold">{formatCurrency(Number(row.original.totalAmount))}</span>,
    },
    {
      header: "Paid",
      cell: ({ row }) => (
        <span className="text-green-600 font-medium">{formatCurrency(Number(row.original.paidAmount))}</span>
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
      header: "Status",
      cell: ({ row }) => <B2BStatusBadge status={row.original.status} />,
    },
    {
      header: "Due Date",
      cell: ({ row }) =>
        row.original.dueDate ? (
          <span className="text-sm text-slate-600">{formatDate(row.original.dueDate)}</span>
        ) : (
          <span className="text-xs text-slate-400">--</span>
        ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const inv = row.original;
        return (
          <div className="flex items-center gap-1">
            <button
              onClick={() => router.push(`/billing/b2b-invoices/${inv.id}`)}
              className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-[#1B4F8A]"
              title="View"
            >
              <Eye size={15} />
            </button>
            {inv.status === "B2B_DRAFT" && (
              <button
                onClick={() => sendMutation.mutate(inv.id)}
                className="p-1.5 rounded hover:bg-blue-50 text-slate-500 hover:text-blue-600"
                title="Send"
                disabled={sendMutation.isPending}
              >
                <Send size={15} />
              </button>
            )}
            <button
              onClick={() => downloadMutation.mutate(inv.id)}
              className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-700"
              title="Download PDF"
            >
              <Download size={15} />
            </button>
            {inv.status !== "B2B_PAID" && inv.balance > 0 && (
              <button
                onClick={() => setPaymentInvoice(inv)}
                className="p-1.5 rounded hover:bg-green-50 text-slate-500 hover:text-green-600"
                title="Record Payment"
              >
                <CreditCard size={15} />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="B2B Invoices"
        subtitle="Manage invoices for corporate and organizational clients"
        breadcrumbs={[{ label: "Billing", href: "/billing" }]}
        actions={
          <button
            onClick={() => setShowGenerate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#1B4F8A] text-white rounded-lg text-sm font-semibold hover:bg-[#163d6a] transition"
          >
            <Plus size={16} />
            Generate Invoice
          </button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard
          title="Total Invoiced"
          value={formatCurrency(outstanding?.totalInvoiced ?? 0)}
          icon={FileText}
          iconColor="bg-blue-100 text-blue-600"
          isLoading={outstandingLoading}
        />
        <KPICard
          title="Outstanding"
          value={formatCurrency(outstanding?.totalOutstanding ?? 0)}
          icon={Clock}
          iconColor="bg-yellow-100 text-yellow-600"
          isLoading={outstandingLoading}
        />
        <KPICard
          title="Overdue"
          value={formatCurrency(outstanding?.totalOverdue ?? 0)}
          icon={AlertTriangle}
          iconColor="bg-red-100 text-red-600"
          isLoading={outstandingLoading}
        />
        <KPICard
          title="Collected"
          value={formatCurrency(outstanding?.totalCollected ?? 0)}
          icon={CheckCircle2}
          iconColor="bg-green-100 text-green-600"
          isLoading={outstandingLoading}
        />
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={orgFilter}
          onChange={(e) => {
            setOrgFilter(e.target.value);
            setPage(1);
          }}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30 min-w-[200px]"
        >
          <option value="">All Organizations</option>
          {(orgs ?? []).map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <DateRangePicker value={dateRange} onChange={(r) => { setDateRange(r); setPage(1); }} />
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 mb-4 flex-wrap">
        {STATUS_TABS.map((tab, i) => (
          <button
            key={tab.value || "all"}
            onClick={() => {
              setStatusTab(i);
              setPage(1);
            }}
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
      {showGenerate && (
        <GenerateInvoiceModal
          onClose={() => setShowGenerate(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["b2b-invoices"] });
            qc.invalidateQueries({ queryKey: ["b2b-outstanding"] });
          }}
        />
      )}
      {paymentInvoice && (
        <RecordB2BPaymentModal
          invoice={paymentInvoice}
          onClose={() => setPaymentInvoice(null)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["b2b-invoices"] });
            qc.invalidateQueries({ queryKey: ["b2b-outstanding"] });
          }}
        />
      )}
    </div>
  );
}
