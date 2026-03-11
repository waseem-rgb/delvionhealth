"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Download,
  Send,
  Search,
  RefreshCw,
  Eye,
  CheckCircle2,
  Loader2,
  X,
  Phone,
  Mail,
} from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PriorityBadge } from "@/components/shared/PriorityBadge";
import { formatDate, formatDateTime, cn } from "@/lib/utils";
import api from "@/lib/api";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReportOrder {
  id: string;
  orderNumber: string;
  status: string;
  priority: "ROUTINE" | "URGENT" | "STAT";
  createdAt: string;
  approvedAt: string | null;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    mrn: string;
    phone: string;
    email: string | null;
  };
  _count: { items: number };
  labReports: {
    id: string;
    reportNumber: string;
    status: string;
    approvalStatus: string;
  }[];
}

interface QueryResponse {
  data: ReportOrder[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

const STATUS_TABS = [
  { label: "All", value: "" },
  { label: "Approved", value: "APPROVED" },
  { label: "Reported", value: "REPORTED" },
  { label: "Dispatched", value: "DISPATCHED" },
];

// ── Send Report Modal ─────────────────────────────────────────────────────────

function SendReportModal({
  order,
  onClose,
}: {
  order: ReportOrder;
  onClose: () => void;
}) {
  const [channel, setChannel] = useState<"WHATSAPP" | "EMAIL">("WHATSAPP");
  const [phone, setPhone] = useState(order.patient.phone ?? "");
  const [email, setEmail] = useState(order.patient.email ?? "");

  const reportId = order.labReports[0]?.id;

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!reportId) throw new Error("No report found for this order");
      await api.post(`/reports/${reportId}/deliver`, {
        channel,
        recipient: channel === "WHATSAPP" ? phone : email,
      });
    },
    onSuccess: () => {
      toast.success(`Report sent via ${channel === "WHATSAPP" ? "WhatsApp" : "Email"}`);
      onClose();
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Failed to send report";
      toast.error(message);
    },
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Send Report</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="p-4 space-y-4">
          <div className="text-sm text-slate-600">
            <span className="font-semibold">{order.patient.firstName} {order.patient.lastName}</span>
            {" · "}
            <span className="font-mono text-xs">{order.orderNumber}</span>
          </div>

          {/* Channel toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setChannel("WHATSAPP")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors",
                channel === "WHATSAPP"
                  ? "bg-green-600 text-white border-green-600"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              )}
            >
              <Phone size={14} />
              WhatsApp
            </button>
            <button
              onClick={() => setChannel("EMAIL")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors",
                channel === "EMAIL"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              )}
            >
              <Mail size={14} />
              Email
            </button>
          </div>

          {channel === "WHATSAPP" ? (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">WhatsApp Number</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91XXXXXXXXXX"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email Address</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="patient@email.com"
                type="email"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20"
              />
            </div>
          )}
        </div>
        <div className="flex gap-2 p-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            disabled={sendMutation.isPending || (!phone && channel === "WHATSAPP") || (!email && channel === "EMAIL")}
            onClick={() => sendMutation.mutate()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#1B4F8A] text-white rounded-lg text-sm font-medium hover:bg-[#163d6e] disabled:opacity-50"
          >
            {sendMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ResultsPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sendModal, setSendModal] = useState<ReportOrder | null>(null);
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["results-list", statusFilter, search, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        ...(search && { search }),
      });
      // Fetch APPROVED and REPORTED orders
      const statuses = statusFilter
        ? [statusFilter]
        : ["APPROVED", "REPORTED", "DISPATCHED"];

      const responses = await Promise.all(
        statuses.map((s) =>
          api.get<{ success: boolean; data: QueryResponse }>(
            `/orders?${params.toString()}&status=${s}`
          )
        )
      );

      const allOrders = responses.flatMap((r) => r.data.data?.data ?? []);
      const total = responses.reduce((sum, r) => sum + (r.data.data?.meta?.total ?? 0), 0);

      return {
        data: allOrders.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
        meta: { total, page, limit: 20, totalPages: Math.ceil(total / 20) },
      };
    },
    refetchInterval: 30000,
  });

  const downloadReport = async (order: ReportOrder) => {
    const reportId = order.labReports[0]?.id;
    if (!reportId) {
      toast.error("No report available for this order");
      return;
    }
    try {
      const res = await api.get(`/reports/${reportId}/download`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(new Blob([res.data as BlobPart]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `report-${order.orderNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download report");
    }
  };

  const generateReport = useMutation({
    mutationFn: async (orderId: string) => {
      await api.post(`/reports/generate/${orderId}`);
    },
    onSuccess: () => {
      toast.success("Report generated successfully");
      void qc.invalidateQueries({ queryKey: ["results-list"] });
    },
    onError: () => toast.error("Failed to generate report"),
  });

  const orders = data?.data ?? [];
  const total = data?.meta?.total ?? 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Results</h1>
          <p className="text-sm text-slate-500 mt-1">
            {total} approved & reported orders · Auto-refreshes every 30s
          </p>
        </div>
        <button
          onClick={() => void refetch()}
          className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 flex-wrap">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setStatusFilter(tab.value); setPage(1); }}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              statusFilter === tab.value
                ? "bg-[#1B4F8A] text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by order number, patient name or MRN..."
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20 focus:border-[#1B4F8A] bg-white"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-slate-400" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <FileText size={32} className="mb-3" />
            <p className="text-sm font-medium">No approved or reported orders</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Order</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Patient</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tests</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Priority</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Approved</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Report</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const hasReport = order.labReports.length > 0;
                const reportStatus = order.labReports[0]?.status ?? null;
                return (
                  <tr key={order.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-semibold text-slate-700">{order.orderNumber}</span>
                      <p className="text-[10px] text-slate-400 mt-0.5">{formatDate(order.createdAt)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-900">
                        {order.patient.firstName} {order.patient.lastName}
                      </p>
                      <p className="text-xs text-slate-400">{order.patient.mrn}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-600">{order._count.items}</span>
                    </td>
                    <td className="px-4 py-3">
                      <PriorityBadge priority={order.priority} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-500">
                        {order.approvedAt ? formatDateTime(order.approvedAt) : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {hasReport ? (
                        <div className="flex items-center gap-1">
                          <CheckCircle2 size={14} className="text-green-500" />
                          <span className="text-xs text-slate-600 capitalize">
                            {reportStatus?.toLowerCase().replace(/_/g, " ") ?? "Generated"}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Not generated</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {!hasReport && (
                          <button
                            onClick={() => generateReport.mutate(order.id)}
                            disabled={generateReport.isPending}
                            className="text-xs text-teal-600 hover:underline font-medium disabled:opacity-50"
                          >
                            Generate
                          </button>
                        )}
                        {hasReport && (
                          <>
                            <button
                              onClick={() => void downloadReport(order)}
                              className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 hover:underline"
                              title="Download PDF"
                            >
                              <Download size={12} />
                              PDF
                            </button>
                            <button
                              onClick={() => setSendModal(order)}
                              className="inline-flex items-center gap-1 text-xs text-[#1B4F8A] hover:underline font-medium"
                              title="Send report"
                            >
                              <Send size={12} />
                              Send
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {(data?.meta?.totalPages ?? 1) > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <span className="text-xs text-slate-500">
              Page {page} of {data?.meta?.totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50"
              >
                Prev
              </button>
              <button
                disabled={page >= (data?.meta?.totalPages ?? 1)}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Send Modal */}
      {sendModal && (
        <SendReportModal order={sendModal} onClose={() => setSendModal(null)} />
      )}
    </div>
  );
}
