"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import api from "@/lib/api";
import {
  DollarSign,
  Clock,
  AlertTriangle,
  TrendingUp,
  Plus,
  CreditCard,
  FileText,
  Shield,
  BarChart3,
  X,
  ChevronDown,
  RefreshCw,
  Search,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface Invoice {
  id: string;
  invoiceNumber: string;
  patient?: any;
  patientName?: string;
  type: string;
  total: number;
  paid: number;
  balance: number;
  status: string;
  dueDate: string;
  createdAt: string;
}

interface Payment {
  id: string;
  invoiceId: string;
  invoiceNumber?: string;
  amount: number;
  method: string;
  reference: string;
  status: string;
  createdAt: string;
}

interface InsuranceClaim {
  id: string;
  claimNumber: string;
  invoiceNumber: string;
  insurer: string;
  claimedAmount: number;
  approvedAmount: number;
  status: string;
}

interface AgingBucket {
  label: string;
  amount: number;
  count: number;
}

interface AgingReport {
  buckets: AgingBucket[];
  overdueInvoices: Invoice[];
}

// ── Status badge config ──────────────────────────────────────────────────────

const INVOICE_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  SENT: "bg-blue-100 text-blue-700",
  PARTIALLY_PAID: "bg-yellow-100 text-yellow-700",
  PAID: "bg-emerald-100 text-emerald-700",
  OVERDUE: "bg-red-100 text-red-700",
  CANCELLED: "bg-slate-100 text-slate-500",
};

const CLAIM_STATUS_COLORS: Record<string, string> = {
  SUBMITTED: "bg-blue-100 text-blue-700",
  IN_REVIEW: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  PARTIALLY_APPROVED: "bg-orange-100 text-orange-700",
  REJECTED: "bg-red-100 text-red-700",
  APPEALED: "bg-purple-100 text-purple-700",
};

const TYPE_COLORS: Record<string, string> = {
  PATIENT: "bg-teal-100 text-teal-700",
  INSURANCE: "bg-indigo-100 text-indigo-700",
  CORPORATE: "bg-amber-100 text-amber-700",
};

const AGING_BAR_COLORS = [
  "bg-emerald-500",
  "bg-yellow-500",
  "bg-orange-500",
  "bg-red-500",
  "bg-red-700",
];

const AGING_BG_COLORS = [
  "bg-emerald-50 border-emerald-200",
  "bg-yellow-50 border-yellow-200",
  "bg-orange-50 border-orange-200",
  "bg-red-50 border-red-200",
  "bg-red-100 border-red-300",
];

const TABS = ["Invoices", "Payments", "Insurance Claims", "Aging Report"] as const;
type Tab = (typeof TABS)[number];

// ── Component ────────────────────────────────────────────────────────────────

export default function ReceivablesPage() {
  const searchParams = useSearchParams();

  const urlTab = searchParams.get("tab");
  const urlDate = searchParams.get("date");
  const todayISO = new Date().toISOString().split("T")[0]!;

  // Map ?tab=invoices → "Invoices" etc.
  const TAB_MAP: Record<string, Tab> = {
    invoices: "Invoices",
    payments: "Payments",
    insurance: "Insurance Claims",
    aging: "Aging Report",
  };
  const initialTab: Tab = (urlTab && TAB_MAP[urlTab]) ? TAB_MAP[urlTab]! : "Invoices";
  const initialDateFrom = urlDate === "today" ? todayISO : "";

  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [loading, setLoading] = useState(true);

  // Invoices state
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const invoiceDateFrom = initialDateFrom;
  const [invoiceFilter, setInvoiceFilter] = useState({ status: "", type: "" });
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Payments state
  const [payments, setPayments] = useState<Payment[]>([]);

  // Insurance claims state
  const [claims, setClaims] = useState<InsuranceClaim[]>([]);

  // Aging report state
  const [agingReport, setAgingReport] = useState<AgingReport | null>(null);

  // Stats
  const [stats, setStats] = useState({ totalOutstanding: 0, overdueAmount: 0, collectedThisMonth: 0 });

  // Invoice form
  const [invoiceForm, setInvoiceForm] = useState({
    type: "PATIENT",
    patientName: "",
    items: [{ description: "", quantity: 1, unitPrice: 0 }],
    discount: 0,
  });

  // Payment form
  const [paymentForm, setPaymentForm] = useState({ amount: 0, method: "CASH", reference: "" });

  // ── Data Loading ───────────────────────────────────────────────────────────

  const fetchInvoices = async () => {
    try {
      const params: any = { page: 1, limit: 50 };
      if (invoiceFilter.status) params.status = invoiceFilter.status;
      if (invoiceFilter.type) params.type = invoiceFilter.type;
      if (invoiceDateFrom) { params.dateFrom = invoiceDateFrom; params.dateTo = invoiceDateFrom; }
      const res = await api.get("/finance/invoices", { params });
      const raw = res.data?.data ?? res.data;
      setInvoices(Array.isArray(raw) ? raw : raw?.invoices ?? raw?.items ?? []);
    } catch {
      setInvoices([]);
    }
  };

  const fetchPayments = async () => {
    try {
      const res = await api.get("/finance/payments", { params: { limit: 50 } });
      const raw = res.data?.data ?? res.data;
      setPayments(Array.isArray(raw) ? raw : raw?.payments ?? raw?.items ?? []);
    } catch {
      setPayments([]);
    }
  };

  const fetchClaims = async () => {
    try {
      const res = await api.get("/finance/insurance-claims");
      const raw = res.data?.data ?? res.data;
      setClaims(Array.isArray(raw) ? raw : raw?.claims ?? raw?.items ?? []);
    } catch {
      setClaims([]);
    }
  };

  const fetchAgingReport = async () => {
    try {
      const res = await api.get("/finance/aging-report");
      const raw = res.data?.data ?? res.data;
      setAgingReport({
        buckets: raw?.buckets ?? [],
        overdueInvoices: raw?.overdueInvoices ?? raw?.invoices ?? [],
      });
    } catch {
      setAgingReport(null);
    }
  };

  const computeStats = () => {
    const totalOutstanding = invoices.reduce((s, i) => s + (i.balance ?? 0), 0);
    const overdueAmount = invoices
      .filter((i) => i.status === "OVERDUE")
      .reduce((s, i) => s + (i.balance ?? 0), 0);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const collectedThisMonth = payments
      .filter((p) => new Date(p.createdAt) >= monthStart)
      .reduce((s, p) => s + (p.amount ?? 0), 0);
    setStats({ totalOutstanding, overdueAmount, collectedThisMonth });
  };

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([fetchInvoices(), fetchPayments(), fetchClaims(), fetchAgingReport()]);
      setLoading(false);
    };
    loadAll();
  }, []);

  useEffect(() => {
    computeStats();
  }, [invoices, payments]);

  useEffect(() => {
    fetchInvoices();
  }, [invoiceFilter, invoiceDateFrom]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleCreateInvoice = async () => {
    try {
      const items = invoiceForm.items.map((it) => ({
        description: it.description,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        amount: it.quantity * it.unitPrice,
      }));
      const subtotal = items.reduce((s, i) => s + i.amount, 0);
      await api.post("/finance/invoices", {
        type: invoiceForm.type,
        patientName: invoiceForm.patientName,
        items,
        subtotal,
        discount: invoiceForm.discount,
        total: subtotal - invoiceForm.discount,
      });
      setShowCreateInvoice(false);
      setInvoiceForm({ type: "PATIENT", patientName: "", items: [{ description: "", quantity: 1, unitPrice: 0 }], discount: 0 });
      fetchInvoices();
    } catch (err) {
      console.error("Failed to create invoice", err);
    }
  };

  const handleRecordPayment = async () => {
    if (!selectedInvoice) return;
    try {
      await api.post("/finance/payments", {
        invoiceId: selectedInvoice.id,
        amount: paymentForm.amount,
        method: paymentForm.method,
        reference: paymentForm.reference,
      });
      setShowPaymentModal(false);
      setPaymentForm({ amount: 0, method: "CASH", reference: "" });
      setSelectedInvoice(null);
      fetchInvoices();
      fetchPayments();
    } catch (err) {
      console.error("Failed to record payment", err);
    }
  };

  const handleClaimStatusUpdate = async (claimId: string, status: string) => {
    try {
      await api.patch(`/finance/insurance-claims/${claimId}`, { status });
      fetchClaims();
    } catch (err) {
      console.error("Failed to update claim", err);
    }
  };

  const addInvoiceItem = () => {
    setInvoiceForm((f) => ({ ...f, items: [...f.items, { description: "", quantity: 1, unitPrice: 0 }] }));
  };

  const removeInvoiceItem = (idx: number) => {
    setInvoiceForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  };

  const updateInvoiceItem = (idx: number, field: string, value: any) => {
    setInvoiceForm((f) => ({
      ...f,
      items: f.items.map((it, i) => (i === idx ? { ...it, [field]: value } : it)),
    }));
  };

  const invoiceSubtotal = invoiceForm.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 w-64 bg-slate-200 rounded animate-pulse" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-white border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-96 bg-white border border-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Receivables Management</h1>
          <p className="text-sm text-slate-500 mt-1">Invoices, payments, insurance claims & aging</p>
        </div>
        <button
          onClick={() => { fetchInvoices(); fetchPayments(); fetchClaims(); fetchAgingReport(); }}
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Total Outstanding", value: stats.totalOutstanding, icon: DollarSign, color: "text-teal-400" },
          { label: "Overdue Amount", value: stats.overdueAmount, icon: AlertTriangle, color: "text-red-400" },
          { label: "Collected This Month", value: stats.collectedThisMonth, icon: TrendingUp, color: "text-emerald-400" },
        ].map((card) => (
          <div key={card.label} className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-slate-100">
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <span className="text-sm text-slate-500">{card.label}</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{`\u20B9${card.value.toLocaleString()}`}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-1">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition ${
              activeTab === tab
                ? "bg-teal-600 text-white"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "Invoices" && (
        <div className="space-y-4">
          {/* Filters + Create */}
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={invoiceFilter.status}
              onChange={(e) => setInvoiceFilter((f) => ({ ...f, status: e.target.value }))}
              className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-teal-500"
            >
              <option value="">All Statuses</option>
              {["DRAFT", "SENT", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"].map((s) => (
                <option key={s} value={s}>{s.replace("_", " ")}</option>
              ))}
            </select>
            <select
              value={invoiceFilter.type}
              onChange={(e) => setInvoiceFilter((f) => ({ ...f, type: e.target.value }))}
              className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-teal-500"
            >
              <option value="">All Types</option>
              {["PATIENT", "INSURANCE", "CORPORATE"].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <div className="flex-1" />
            <button
              onClick={() => setShowCreateInvoice(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-500 transition"
            >
              <Plus className="w-4 h-4" /> Create Invoice
            </button>
          </div>

          {/* Invoices Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    {["Invoice #", "Patient", "Type", "Total", "Paid", "Balance", "Status", "Due Date", "Actions"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                        No invoices found
                      </td>
                    </tr>
                  ) : (
                    invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3 text-slate-900 font-medium">{inv.invoiceNumber}</td>
                        <td className="px-4 py-3 text-slate-700">{inv.patient?.name ?? inv.patientName ?? "-"}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[inv.type] ?? "bg-slate-100 text-slate-500"}`}>
                            {inv.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{`\u20B9${(inv.total ?? 0).toLocaleString()}`}</td>
                        <td className="px-4 py-3 text-slate-700">{`\u20B9${(inv.paid ?? 0).toLocaleString()}`}</td>
                        <td className="px-4 py-3 text-slate-900 font-medium">{`\u20B9${(inv.balance ?? 0).toLocaleString()}`}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${INVOICE_STATUS_COLORS[inv.status] ?? "bg-slate-100 text-slate-500"}`}>
                            {inv.status?.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "-"}</td>
                        <td className="px-4 py-3">
                          {inv.status !== "PAID" && inv.status !== "CANCELLED" && (
                            <button
                              onClick={() => { setSelectedInvoice(inv); setPaymentForm({ amount: inv.balance ?? 0, method: "CASH", reference: "" }); setShowPaymentModal(true); }}
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-teal-50 text-teal-700 rounded hover:bg-teal-100 transition"
                            >
                              <CreditCard className="w-3 h-3" /> Pay
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "Payments" && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  {["Date", "Invoice #", "Amount", "Method", "Reference", "Status"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                      No payments recorded yet
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3 text-slate-700">{new Date(p.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-slate-900 font-medium">{p.invoiceNumber ?? p.invoiceId}</td>
                      <td className="px-4 py-3 text-emerald-400 font-medium">{`\u20B9${(p.amount ?? 0).toLocaleString()}`}</td>
                      <td className="px-4 py-3 text-slate-700">{p.method}</td>
                      <td className="px-4 py-3 text-slate-500">{p.reference || "-"}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700">
                          {p.status ?? "COMPLETED"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "Insurance Claims" && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  {["Claim #", "Invoice #", "Insurer", "Claimed", "Approved", "Status", "Actions"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {claims.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                      No insurance claims found
                    </td>
                  </tr>
                ) : (
                  claims.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3 text-slate-900 font-medium">{c.claimNumber}</td>
                      <td className="px-4 py-3 text-slate-700">{c.invoiceNumber}</td>
                      <td className="px-4 py-3 text-slate-700">{c.insurer}</td>
                      <td className="px-4 py-3 text-slate-700">{`\u20B9${(c.claimedAmount ?? 0).toLocaleString()}`}</td>
                      <td className="px-4 py-3 text-emerald-400 font-medium">{`\u20B9${(c.approvedAmount ?? 0).toLocaleString()}`}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${CLAIM_STATUS_COLORS[c.status] ?? "bg-slate-100 text-slate-500"}`}>
                          {c.status?.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={c.status}
                          onChange={(e) => handleClaimStatusUpdate(c.id, e.target.value)}
                          className="px-2 py-1 text-xs bg-white border border-slate-300 rounded text-slate-700 focus:outline-none focus:border-teal-500"
                        >
                          {["SUBMITTED", "IN_REVIEW", "APPROVED", "PARTIALLY_APPROVED", "REJECTED", "APPEALED"].map((s) => (
                            <option key={s} value={s}>{s.replace("_", " ")}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "Aging Report" && (
        <div className="space-y-6">
          {/* Aging Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {(agingReport?.buckets ?? [
              { label: "Current", amount: 0, count: 0 },
              { label: "1-30 Days", amount: 0, count: 0 },
              { label: "31-60 Days", amount: 0, count: 0 },
              { label: "61-90 Days", amount: 0, count: 0 },
              { label: "90+ Days", amount: 0, count: 0 },
            ]).map((bucket, idx) => (
              <div
                key={bucket.label}
                className={`rounded-xl border p-4 ${AGING_BG_COLORS[idx] ?? "bg-white border-slate-200"}`}
              >
                <p className="text-xs text-slate-500 mb-1">{bucket.label}</p>
                <p className="text-lg font-bold text-slate-900">{`\u20B9${(bucket.amount ?? 0).toLocaleString()}`}</p>
                <p className="text-xs text-slate-400">{bucket.count ?? 0} invoices</p>
              </div>
            ))}
          </div>

          {/* Horizontal Bar Chart */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Aging Distribution</h3>
            {(() => {
              const buckets = agingReport?.buckets ?? [];
              const maxAmount = Math.max(...buckets.map((b) => b.amount), 1);
              return (
                <div className="space-y-3">
                  {buckets.map((bucket, idx) => {
                    const pct = Math.max((bucket.amount / maxAmount) * 100, bucket.amount > 0 ? 3 : 0);
                    return (
                      <div key={bucket.label}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-slate-500">{bucket.label}</span>
                          <span className="text-xs text-slate-700 font-medium">{`\u20B9${bucket.amount.toLocaleString()}`}</span>
                        </div>
                        <div className="w-full h-6 bg-slate-100 rounded-md overflow-hidden">
                          <div
                            className={`h-full rounded-md transition-all duration-500 ${AGING_BAR_COLORS[idx] ?? "bg-slate-600"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Overdue Invoices Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900">Overdue Invoices</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    {["Invoice #", "Patient", "Type", "Balance", "Due Date", "Status"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(agingReport?.overdueInvoices ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                        No overdue invoices - great job!
                      </td>
                    </tr>
                  ) : (
                    (agingReport?.overdueInvoices ?? []).map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3 text-slate-900 font-medium">{inv.invoiceNumber}</td>
                        <td className="px-4 py-3 text-slate-700">{inv.patient?.name ?? inv.patientName ?? "-"}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[inv.type] ?? "bg-slate-100 text-slate-500"}`}>
                            {inv.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-red-400 font-medium">{`\u20B9${(inv.balance ?? 0).toLocaleString()}`}</td>
                        <td className="px-4 py-3 text-slate-500">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "-"}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${INVOICE_STATUS_COLORS[inv.status] ?? "bg-slate-100 text-slate-500"}`}>
                            {inv.status?.replace("_", " ")}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Invoice Modal ─────────────────────────────────────────────── */}
      {showCreateInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-900">Create Invoice</h2>
              <button onClick={() => setShowCreateInvoice(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Type */}
              <div>
                <label className="block text-sm text-slate-500 mb-1">Invoice Type</label>
                <select
                  value={invoiceForm.type}
                  onChange={(e) => setInvoiceForm((f) => ({ ...f, type: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-500"
                >
                  <option value="PATIENT">Patient</option>
                  <option value="INSURANCE">Insurance</option>
                  <option value="CORPORATE">Corporate</option>
                </select>
              </div>

              {/* Patient */}
              <div>
                <label className="block text-sm text-slate-500 mb-1">Patient / Entity Name</label>
                <input
                  type="text"
                  value={invoiceForm.patientName}
                  onChange={(e) => setInvoiceForm((f) => ({ ...f, patientName: e.target.value }))}
                  placeholder="Search patient..."
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500"
                />
              </div>

              {/* Items */}
              <div>
                <label className="block text-sm text-slate-500 mb-2">Line Items</label>
                <div className="space-y-2">
                  {invoiceForm.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateInvoiceItem(idx, "description", e.target.value)}
                        placeholder="Description"
                        className="flex-1 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500"
                      />
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateInvoiceItem(idx, "quantity", Number(e.target.value))}
                        placeholder="Qty"
                        className="w-20 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-500"
                      />
                      <input
                        type="number"
                        value={item.unitPrice}
                        onChange={(e) => updateInvoiceItem(idx, "unitPrice", Number(e.target.value))}
                        placeholder="Price"
                        className="w-28 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-500"
                      />
                      <span className="text-sm text-slate-500 w-24 text-right">{`\u20B9${(item.quantity * item.unitPrice).toLocaleString()}`}</span>
                      {invoiceForm.items.length > 1 && (
                        <button onClick={() => removeInvoiceItem(idx)} className="text-red-400 hover:text-red-300">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={addInvoiceItem} className="mt-2 text-sm text-teal-400 hover:text-teal-300 flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add item
                </button>
              </div>

              {/* Totals */}
              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="text-slate-900">{`\u20B9${invoiceSubtotal.toLocaleString()}`}</span>
                </div>
                <div className="flex justify-between text-sm items-center">
                  <span className="text-slate-500">Discount</span>
                  <input
                    type="number"
                    value={invoiceForm.discount}
                    onChange={(e) => setInvoiceForm((f) => ({ ...f, discount: Number(e.target.value) }))}
                    className="w-28 px-2 py-1 text-sm bg-white border border-slate-300 rounded text-slate-900 text-right focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div className="flex justify-between text-sm font-bold border-t border-slate-200 pt-2">
                  <span className="text-slate-900">Total</span>
                  <span className="text-teal-600">{`\u20B9${(invoiceSubtotal - invoiceForm.discount).toLocaleString()}`}</span>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button onClick={() => setShowCreateInvoice(false)} className="px-4 py-2 text-sm text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition">
                  Cancel
                </button>
                <button onClick={handleCreateInvoice} className="px-4 py-2 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-500 transition">
                  Create Invoice
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Record Payment Modal ─────────────────────────────────────────────── */}
      {showPaymentModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-900">Record Payment</h2>
              <button onClick={() => { setShowPaymentModal(false); setSelectedInvoice(null); }} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4 bg-slate-50 rounded-lg p-3">
              <p className="text-sm text-slate-500">Invoice: <span className="text-slate-900 font-medium">{selectedInvoice.invoiceNumber}</span></p>
              <p className="text-sm text-slate-500">Outstanding: <span className="text-teal-600 font-medium">{`\u20B9${(selectedInvoice.balance ?? 0).toLocaleString()}`}</span></p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-500 mb-1">Amount</label>
                <input
                  type="number"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, amount: Number(e.target.value) }))}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-1">Payment Method</label>
                <select
                  value={paymentForm.method}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, method: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-500"
                >
                  {["CASH", "CARD", "UPI", "NEFT", "CHEQUE", "ONLINE"].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-1">Reference</label>
                <input
                  type="text"
                  value={paymentForm.reference}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, reference: e.target.value }))}
                  placeholder="Transaction ID / Cheque #"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => { setShowPaymentModal(false); setSelectedInvoice(null); }} className="px-4 py-2 text-sm text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition">
                  Cancel
                </button>
                <button onClick={handleRecordPayment} className="px-4 py-2 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-500 transition">
                  Record Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
