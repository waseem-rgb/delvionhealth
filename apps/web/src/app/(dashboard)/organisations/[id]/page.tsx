"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, Building2, Phone, Mail, MapPin, CreditCard,
  FileText, TrendingUp, Sparkles, Loader2, X, Download,
  ChevronLeft, ChevronRight, IndianRupee,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart,
} from "recharts";
import { toast } from "sonner";
import api from "@/lib/api";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

interface Organisation {
  id: string;
  name: string;
  code: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  gstNumber: string | null;
  panNumber: string | null;
  paymentType: string;
  creditDays: number;
  creditLimit: number | null;
  currentBalance: number;
  currentOutstanding: number;
  totalOrders: number;
  totalRevenue: number;
  isActive: boolean;
  rateList: { id: string; name: string } | null;
  parentOrg: { id: string; name: string } | null;
}

interface OverviewData {
  organisation: Organisation;
  kpis: {
    totalOrders: number;
    totalRevenue: number;
    totalOutstanding: number;
    avgOrderValue: number;
    grossMargin: number;
  };
  revenueByMonth: { month: string; revenue: number; cogs: number }[];
  topTests: { testName: string; count: number; revenue: number }[];
}

interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  total: number | string;
  amountPaid: number | string;
  balance: number | string;
  status: string;
  createdAt: string;
  order: { orderNumber: string } | null;
}

interface LedgerEntry {
  id: string;
  type: string;
  description: string | null;
  amount: number | string;
  runningTotal: number | string;
  createdAt: string;
}

interface PaginatedMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

type TabId = "overview" | "ledger" | "invoices" | "ai";

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: TrendingUp },
  { id: "ledger", label: "Ledger", icon: CreditCard },
  { id: "invoices", label: "Invoices", icon: FileText },
  { id: "ai", label: "AI Insights", icon: Sparkles },
];

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  WALKIN: "Walk-In", PREPAID: "Pre-Paid", POSTPAID: "Post-Paid", FLEXIBLE_PREPAID: "Flexible Pre-Paid",
};

const INVOICE_STATUS_TABS = [
  { label: "All", value: "" },
  { label: "Paid", value: "PAID" },
  { label: "Partial", value: "PARTIALLY_PAID" },
  { label: "Unpaid", value: "UNPAID" },
  { label: "Cancelled", value: "CANCELLED" },
];

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]/20 focus:border-[#0D7E8A] bg-white";

// ── Main Page ──────────────────────────────────────────────────────────────

export default function OrganisationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const orgId = params.id as string;

  const initialTab = (searchParams.get("tab") as TabId) || "overview";
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // ── Overview Query ────────────────────────────────────────────────────
  const { data: overview, isLoading } = useQuery<OverviewData>({
    queryKey: ["org-overview", orgId],
    queryFn: async () => {
      const res = await api.get<{ data: OverviewData }>(`/organisations/${orgId}/overview`);
      return res.data.data ?? (res.data as unknown as OverviewData);
    },
  });

  const org = overview?.organisation;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="animate-spin text-[#0D7E8A]" size={32} />
      </div>
    );
  }

  if (!org) {
    return (
      <div className="p-8 text-center text-slate-500">Organisation not found</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/organisations")} className="p-2 rounded-lg hover:bg-slate-100 transition">
            <ArrowLeft size={18} className="text-slate-600" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">{org.name}</h1>
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-600">{org.code}</span>
              <span className={cn(
                "px-2 py-0.5 text-xs font-medium rounded-full",
                org.paymentType === "POSTPAID" ? "bg-red-100 text-red-700" :
                org.paymentType === "PREPAID" ? "bg-blue-100 text-blue-700" :
                "bg-slate-100 text-slate-600"
              )}>
                {PAYMENT_TYPE_LABELS[org.paymentType] || org.paymentType}
              </span>
              {!org.isActive && <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">Inactive</span>}
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              {[org.contactPerson, org.city].filter(Boolean).join(" · ") || "No contact info"}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowPaymentModal(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-[#0D7E8A] rounded-lg hover:bg-[#0a6b75] flex items-center gap-2"
        >
          <IndianRupee size={14} /> Record Payment
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition",
              activeTab === tab.id
                ? "border-[#0D7E8A] text-[#0D7E8A]"
                : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && overview && <OverviewTab overview={overview} />}
      {activeTab === "ledger" && <LedgerTab orgId={orgId} />}
      {activeTab === "invoices" && <InvoicesTab orgId={orgId} />}
      {activeTab === "ai" && <AiInsightsTab orgId={orgId} />}

      {/* Payment Modal */}
      {showPaymentModal && (
        <RecordPaymentModal
          orgId={orgId}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={() => {
            setShowPaymentModal(false);
            void qc.invalidateQueries({ queryKey: ["org-overview", orgId] });
            void qc.invalidateQueries({ queryKey: ["org-ledger", orgId] });
          }}
        />
      )}
    </div>
  );
}

// ── Overview Tab ────────────────────────────────────────────────────────────

function OverviewTab({ overview }: { overview: OverviewData }) {
  const { kpis, revenueByMonth, topTests, organisation: org } = overview;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard label="Total Orders" value={String(kpis.totalOrders)} />
        <KPICard label="Total Revenue" value={formatCurrency(kpis.totalRevenue)} />
        <KPICard label="Outstanding" value={formatCurrency(kpis.totalOutstanding)} color={kpis.totalOutstanding > 0 ? "red" : "green"} />
        <KPICard label="Gross Margin" value={`${kpis.grossMargin.toFixed(1)}%`} color={kpis.grossMargin >= 40 ? "green" : kpis.grossMargin >= 20 ? "amber" : "red"} />
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Monthly Revenue & COGS</h3>
          {revenueByMonth.some((m) => m.revenue > 0) ? (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={revenueByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="revenue" fill="#0D7E8A" radius={[4, 4, 0, 0]} name="Revenue" />
                <Line dataKey="cogs" stroke="#ef4444" strokeWidth={2} dot={false} name="COGS" />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-sm text-slate-400">No revenue data yet</div>
          )}
        </div>

        {/* Org Info Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">Organisation Info</h3>
          <div className="space-y-3 text-sm">
            {org.contactPerson && (
              <div className="flex items-center gap-2 text-slate-600">
                <Building2 size={14} className="text-slate-400" />
                {org.contactPerson}
              </div>
            )}
            {org.phone && (
              <div className="flex items-center gap-2 text-slate-600">
                <Phone size={14} className="text-slate-400" />
                {org.phone}
              </div>
            )}
            {org.email && (
              <div className="flex items-center gap-2 text-slate-600">
                <Mail size={14} className="text-slate-400" />
                {org.email}
              </div>
            )}
            {(org.address || org.city) && (
              <div className="flex items-start gap-2 text-slate-600">
                <MapPin size={14} className="text-slate-400 mt-0.5" />
                <span>{[org.address, org.city, org.state, org.pincode].filter(Boolean).join(", ")}</span>
              </div>
            )}
            <div className="border-t border-slate-100 pt-3 space-y-2">
              {org.gstNumber && <InfoRow label="GST" value={org.gstNumber} />}
              {org.panNumber && <InfoRow label="PAN" value={org.panNumber} />}
              <InfoRow label="Credit Limit" value={org.creditLimit ? formatCurrency(Number(org.creditLimit)) : "—"} />
              <InfoRow label="Credit Days" value={String(org.creditDays)} />
              {org.rateList && <InfoRow label="Rate List" value={org.rateList.name} />}
            </div>
          </div>
        </div>
      </div>

      {/* Top Tests */}
      {topTests.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Top Tests by Revenue</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 border-b border-slate-100">
                <th className="text-left py-2 px-3 font-medium">Test Name</th>
                <th className="text-right py-2 px-3 font-medium">Orders</th>
                <th className="text-right py-2 px-3 font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {topTests.map((t, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="py-2 px-3 text-slate-700">{t.testName}</td>
                  <td className="py-2 px-3 text-right text-slate-600">{t.count}</td>
                  <td className="py-2 px-3 text-right font-medium text-slate-900">{formatCurrency(t.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Ledger Tab ──────────────────────────────────────────────────────────────

function LedgerTab({ orgId }: { orgId: string }) {
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["org-ledger", orgId, page, from, to],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await api.get<{
        data: {
          data: LedgerEntry[];
          meta: PaginatedMeta;
          summary: { totalBilled: number; totalPaid: number; outstanding: number };
        };
      }>(`/organisations/${orgId}/ledger-entries?${params}`);
      return res.data.data ?? res.data;
    },
  });

  const summary = data?.summary;
  const entries = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-4">
      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Total Billed</p>
            <p className="text-lg font-bold text-slate-900 mt-1">{formatCurrency(summary.totalBilled)}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Total Paid</p>
            <p className="text-lg font-bold text-emerald-600 mt-1">{formatCurrency(summary.totalPaid)}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Outstanding</p>
            <p className="text-lg font-bold text-red-600 mt-1">{formatCurrency(summary.outstanding)}</p>
          </div>
        </div>
      )}

      {/* Filters + Actions */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className={cn(inputCls, "w-40")} />
          <span className="text-xs text-slate-400">to</span>
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className={cn(inputCls, "w-40")} />
        </div>
        {(from || to) && (
          <button onClick={() => { setFrom(""); setTo(""); setPage(1); }} className="text-xs text-[#0D7E8A] hover:underline">Clear</button>
        )}
        <div className="flex-1" />
        <button className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 flex items-center gap-1.5 opacity-50 cursor-not-allowed" disabled>
          <Download size={13} /> Download
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-slate-300" size={24} /></div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 text-sm text-slate-400">No ledger entries</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs text-slate-500">
                <th className="text-left py-2.5 px-4 font-medium">Date</th>
                <th className="text-left py-2.5 px-4 font-medium">Type</th>
                <th className="text-left py-2.5 px-4 font-medium">Description</th>
                <th className="text-right py-2.5 px-4 font-medium">Amount</th>
                <th className="text-right py-2.5 px-4 font-medium">Running Total</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-slate-50 hover:bg-slate-50/50">
                  <td className="py-2.5 px-4 text-slate-600">{formatDate(e.createdAt)}</td>
                  <td className="py-2.5 px-4">
                    <LedgerTypeBadge type={e.type} />
                  </td>
                  <td className="py-2.5 px-4 text-slate-600">{e.description || "—"}</td>
                  <td className={cn("py-2.5 px-4 text-right font-medium", e.type === "PAYMENT_RECEIVED" ? "text-emerald-600" : "text-slate-900")}>
                    {e.type === "PAYMENT_RECEIVED" ? "+" : ""}
                    {formatCurrency(Number(e.amount))}
                  </td>
                  <td className="py-2.5 px-4 text-right text-slate-600">{formatCurrency(Number(e.runningTotal))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={setPage} />
      )}
    </div>
  );
}

// ── Invoices Tab ────────────────────────────────────────────────────────────

function InvoicesTab({ orgId }: { orgId: string }) {
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["org-invoices", orgId, statusFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (statusFilter) params.set("status", statusFilter);
      const res = await api.get<{
        data: { data: InvoiceRow[]; meta: PaginatedMeta };
      }>(`/organisations/${orgId}/invoices?${params}`);
      return res.data.data ?? res.data;
    },
  });

  const invoices = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-4">
      {/* Status Tabs */}
      <div className="flex gap-1">
        {INVOICE_STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setStatusFilter(tab.value); setPage(1); }}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-lg border transition",
              statusFilter === tab.value
                ? "border-[#0D7E8A] bg-[#0D7E8A]/10 text-[#0D7E8A]"
                : "border-slate-200 text-slate-500 hover:border-slate-300"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-slate-300" size={24} /></div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-12 text-sm text-slate-400">No invoices found</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs text-slate-500">
                <th className="text-left py-2.5 px-4 font-medium">Invoice #</th>
                <th className="text-left py-2.5 px-4 font-medium">Order #</th>
                <th className="text-left py-2.5 px-4 font-medium">Date</th>
                <th className="text-right py-2.5 px-4 font-medium">Total</th>
                <th className="text-right py-2.5 px-4 font-medium">Paid</th>
                <th className="text-right py-2.5 px-4 font-medium">Balance</th>
                <th className="text-center py-2.5 px-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-t border-slate-50 hover:bg-slate-50/50">
                  <td className="py-2.5 px-4 font-medium text-slate-900">{inv.invoiceNumber}</td>
                  <td className="py-2.5 px-4 text-slate-600">{inv.order?.orderNumber || "—"}</td>
                  <td className="py-2.5 px-4 text-slate-600">{formatDate(inv.createdAt)}</td>
                  <td className="py-2.5 px-4 text-right font-medium text-slate-900">{formatCurrency(Number(inv.total))}</td>
                  <td className="py-2.5 px-4 text-right text-emerald-600">{formatCurrency(Number(inv.amountPaid))}</td>
                  <td className="py-2.5 px-4 text-right text-slate-600">{formatCurrency(Number(inv.balance))}</td>
                  <td className="py-2.5 px-4 text-center">
                    <InvoiceStatusBadge status={inv.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {meta && meta.totalPages > 1 && (
        <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={setPage} />
      )}
    </div>
  );
}

// ── AI Insights Tab ─────────────────────────────────────────────────────────

function AiInsightsTab({ orgId }: { orgId: string }) {
  const [insights, setInsights] = useState<{ text: string; generatedAt: string; provider: string | null } | null>(null);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.get<{
        data: { insights: string; generatedAt: string; provider: string | null };
      }>(`/organisations/${orgId}/ai-insights`);
      return res.data.data ?? res.data;
    },
    onSuccess: (data) => {
      setInsights({ text: data.insights, generatedAt: data.generatedAt, provider: data.provider });
    },
    onError: () => toast.error("Failed to generate AI insights"),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">AI Business Insights</h3>
          <p className="text-xs text-slate-400 mt-0.5">AI-generated analysis of this organisation&apos;s business patterns</p>
        </div>
        <button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="px-4 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50 flex items-center gap-2"
        >
          {generateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {generateMutation.isPending ? "Generating..." : "Generate Insights"}
        </button>
      </div>

      {generateMutation.isPending && !insights && (
        <div className="bg-white rounded-xl border border-slate-200 p-8">
          <div className="space-y-3 animate-pulse">
            <div className="h-4 bg-slate-100 rounded w-3/4" />
            <div className="h-4 bg-slate-100 rounded w-full" />
            <div className="h-4 bg-slate-100 rounded w-5/6" />
            <div className="h-4 bg-slate-100 rounded w-2/3" />
          </div>
        </div>
      )}

      {insights && (
        <div className="bg-white rounded-xl border border-violet-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={16} className="text-violet-500" />
            <span className="text-xs font-medium text-violet-600">AI Insights</span>
            {insights.provider && (
              <span className="text-[10px] text-slate-400 ml-auto">via {insights.provider}</span>
            )}
          </div>
          <div className="prose prose-sm prose-slate max-w-none whitespace-pre-wrap text-sm text-slate-700 leading-relaxed">
            {insights.text}
          </div>
          <p className="text-[10px] text-slate-400 mt-4">
            Generated at {new Date(insights.generatedAt).toLocaleString()}
          </p>
        </div>
      )}

      {!insights && !generateMutation.isPending && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-12 text-center">
          <Sparkles size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Click &quot;Generate Insights&quot; to get AI-powered analysis</p>
          <p className="text-xs text-slate-400 mt-1">Analysis includes revenue trends, payment behavior, and growth opportunities</p>
        </div>
      )}
    </div>
  );
}

// ── Record Payment Modal ────────────────────────────────────────────────────

function RecordPaymentModal({
  orgId,
  onClose,
  onSuccess,
}: {
  orgId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      await api.post(`/organisations/${orgId}/payment`, {
        amount: parseFloat(amount),
        method,
        reference: reference || undefined,
        notes: notes || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Payment recorded successfully");
      onSuccess();
    },
    onError: () => toast.error("Failed to record payment"),
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-slate-900">Record Payment</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Amount (₹) *</label>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} inputMode="decimal" placeholder="0.00" autoFocus />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Payment Method</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputCls}>
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
              <option value="UPI">UPI</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="CHEQUE">Cheque</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Reference Number</label>
            <input value={reference} onChange={(e) => setReference(e.target.value)} className={inputCls} placeholder="Transaction ID / Cheque #" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={cn(inputCls, "resize-none")} rows={2} placeholder="Optional notes" />
          </div>
        </div>
        <div className="flex gap-2 p-4 border-t">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!amount || parseFloat(amount) <= 0 || mutation.isPending}
            className="flex-1 px-4 py-2 bg-[#0D7E8A] text-white rounded-lg text-sm font-medium hover:bg-[#0a6b75] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {mutation.isPending && <Loader2 size={14} className="animate-spin" />}
            Record Payment
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Shared Components ───────────────────────────────────────────────────────

function KPICard({ label, value, color }: { label: string; value: string; color?: "red" | "green" | "amber" }) {
  const colorCls = color === "red" ? "text-red-600" : color === "green" ? "text-emerald-600" : color === "amber" ? "text-amber-600" : "text-slate-900";
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={cn("text-lg font-bold mt-1", colorCls)}>{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-700">{value}</span>
    </div>
  );
}

function LedgerTypeBadge({ type }: { type: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    CREDIT_SALE: { bg: "bg-blue-100", text: "text-blue-700", label: "Credit Sale" },
    PAYMENT_RECEIVED: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Payment" },
    ADJUSTMENT: { bg: "bg-amber-100", text: "text-amber-700", label: "Adjustment" },
  };
  const c = config[type] ?? { bg: "bg-slate-100", text: "text-slate-600", label: type };
  return <span className={cn("px-2 py-0.5 text-xs font-medium rounded-full", c.bg, c.text)}>{c.label}</span>;
}

function InvoiceStatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    PAID: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Paid" },
    PARTIALLY_PAID: { bg: "bg-amber-100", text: "text-amber-700", label: "Partial" },
    UNPAID: { bg: "bg-red-100", text: "text-red-700", label: "Unpaid" },
    CANCELLED: { bg: "bg-slate-100", text: "text-slate-500", label: "Cancelled" },
  };
  const c = config[status] ?? { bg: "bg-slate-100", text: "text-slate-600", label: status };
  return <span className={cn("px-2 py-0.5 text-xs font-medium rounded-full", c.bg, c.text)}>{c.label}</span>;
}

function Pagination({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (p: number) => void }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-xs text-slate-400">Page {page} of {totalPages}</p>
      <div className="flex gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30"
        >
          <ChevronLeft size={14} />
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
