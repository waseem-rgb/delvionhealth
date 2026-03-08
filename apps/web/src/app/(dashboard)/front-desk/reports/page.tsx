"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Loader2,
  Send,
  Mail,
  Printer,
  CheckCircle2,
  Clock,
  AlertTriangle,
  MessageCircle,
  FileText,
  Package,
  Filter,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { formatDate, cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface OrderItem {
  id: string;
  testName: string;
}

interface Order {
  id: string;
  orderNumber: string;
  patientName: string;
  patientPhone: string;
  patientEmail: string | null;
  tests: string[];
  status: string;
  orderDate: string;
  readySince: string | null;
  deliveredAt: string | null;
  tat: string | null;
  tatOverdue: boolean;
}

interface OrdersResponse {
  data: Order[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

type TabKey = "ready" | "pending" | "delivered" | "search";

const TABS: { key: TabKey; label: string }[] = [
  { key: "ready", label: "Ready to Send" },
  { key: "pending", label: "Pending" },
  { key: "delivered", label: "Delivered Today" },
  { key: "search", label: "Search" },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsDeliveryPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>("ready");
  const [searchTerm, setSearchTerm] = useState("");

  // ── Queries ──────────────────────────────────────────────────────────────

  const readyQuery = useQuery<OrdersResponse>({
    queryKey: ["reports-delivery", "ready"],
    queryFn: async () => {
      const res = await api.get("/orders", {
        params: { status: "APPROVED,REPORTED", limit: 50 },
      });
      return res.data?.data ?? res.data;
    },
    enabled: activeTab === "ready",
  });

  const pendingQuery = useQuery<OrdersResponse>({
    queryKey: ["reports-delivery", "pending"],
    queryFn: async () => {
      const res = await api.get("/orders", {
        params: { status: "IN_PROCESSING,RESULTED", limit: 50 },
      });
      return res.data?.data ?? res.data;
    },
    enabled: activeTab === "pending",
  });

  const deliveredQuery = useQuery<OrdersResponse>({
    queryKey: ["reports-delivery", "delivered-today"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const res = await api.get("/orders", {
        params: { status: "DELIVERED", deliveredDate: today, limit: 50 },
      });
      return res.data?.data ?? res.data;
    },
    enabled: activeTab === "delivered",
  });

  const searchQuery = useQuery<OrdersResponse>({
    queryKey: ["reports-delivery", "search", searchTerm],
    queryFn: async () => {
      const res = await api.get("/orders", {
        params: { q: searchTerm, limit: 30 },
      });
      return res.data?.data ?? res.data;
    },
    enabled: activeTab === "search" && searchTerm.length >= 2,
  });

  // ── Mutations ────────────────────────────────────────────────────────────

  const sendWhatsApp = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await api.post("/notifications/send-whatsapp", { orderId, type: "REPORT_READY" });
      return res.data;
    },
    onSuccess: () => toast.success("WhatsApp notification sent"),
    onError: () => toast.error("Failed to send WhatsApp notification"),
  });

  const sendEmail = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await api.post("/notifications/send-email", { orderId, type: "REPORT_READY" });
      return res.data;
    },
    onSuccess: () => toast.success("Email sent successfully"),
    onError: () => toast.error("Failed to send email"),
  });

  const markDelivered = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await api.put(`/orders/${orderId}/deliver`);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Report marked as delivered");
      queryClient.invalidateQueries({ queryKey: ["reports-delivery"] });
    },
    onError: () => toast.error("Failed to mark as delivered"),
  });

  const sendAllReady = useMutation({
    mutationFn: async () => {
      const res = await api.post("/notifications/send-bulk", { type: "REPORT_READY" });
      return res.data;
    },
    onSuccess: () => {
      toast.success("All notifications sent");
      queryClient.invalidateQueries({ queryKey: ["reports-delivery"] });
    },
    onError: () => toast.error("Failed to send bulk notifications"),
  });

  const handlePrint = (orderId: string) => {
    window.open(`/api/orders/${orderId}/report/pdf`, "_blank");
  };

  // ── Helpers ──────────────────────────────────────────────────────────────

  const extractOrders = (d: unknown): Order[] => {
    if (!d) return [];
    if (Array.isArray(d)) return d;
    if (typeof d === "object" && d !== null && "data" in d && Array.isArray((d as any).data)) return (d as any).data;
    return [];
  };

  const getActiveData = (): { orders: Order[]; isLoading: boolean; isError: boolean } => {
    switch (activeTab) {
      case "ready":
        return {
          orders: extractOrders(readyQuery.data),
          isLoading: readyQuery.isLoading,
          isError: readyQuery.isError,
        };
      case "pending":
        return {
          orders: extractOrders(pendingQuery.data),
          isLoading: pendingQuery.isLoading,
          isError: pendingQuery.isError,
        };
      case "delivered":
        return {
          orders: extractOrders(deliveredQuery.data),
          isLoading: deliveredQuery.isLoading,
          isError: deliveredQuery.isError,
        };
      case "search":
        return {
          orders: extractOrders(searchQuery.data),
          isLoading: searchQuery.isLoading,
          isError: searchQuery.isError,
        };
    }
  };

  const { orders, isLoading, isError } = getActiveData();

  // ── Status badge ─────────────────────────────────────────────────────────

  const statusBadge = (status: string, tatOverdue?: boolean) => {
    const map: Record<string, { bg: string; text: string; label: string }> = {
      APPROVED: { bg: "bg-green-50", text: "text-green-700", label: "Approved" },
      REPORTED: { bg: "bg-blue-50", text: "text-blue-700", label: "Reported" },
      IN_PROCESSING: { bg: "bg-yellow-50", text: "text-yellow-700", label: "In Processing" },
      RESULTED: { bg: "bg-purple-50", text: "text-purple-700", label: "Resulted" },
      DELIVERED: { bg: "bg-slate-100", text: "text-slate-600", label: "Delivered" },
    };
    const s = map[status] ?? { bg: "bg-slate-50", text: "text-slate-600", label: status };
    return (
      <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", s.bg, s.text)}>
        {tatOverdue && <AlertTriangle className="h-3 w-3 text-amber-500" />}
        {s.label}
      </span>
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports Delivery</h1>
          <p className="mt-1 text-sm text-slate-500">
            Send reports to patients via WhatsApp, Email or Print
          </p>
        </div>
        {activeTab === "ready" && (
          <button
            onClick={() => sendAllReady.mutate()}
            disabled={sendAllReady.isPending || !orders.length}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {sendAllReady.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send All Ready
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex gap-6">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium transition-colors",
                activeTab === tab.key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Search bar (only on search tab) */}
      {activeTab === "search" && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by patient name, phone number, or order number..."
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      )}

      {/* Content */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-3 text-sm text-slate-500">Loading orders...</span>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-20">
            <AlertTriangle className="h-10 w-10 text-red-400" />
            <p className="mt-3 text-sm text-slate-600">Failed to load orders. Please try again.</p>
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: ["reports-delivery"] })}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <FileText className="h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm text-slate-500">
              {activeTab === "search" && searchTerm.length < 2
                ? "Type at least 2 characters to search"
                : activeTab === "ready"
                ? "No reports ready for delivery"
                : activeTab === "pending"
                ? "No pending orders"
                : activeTab === "delivered"
                ? "No reports delivered today"
                : "No results found"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-4 py-3 font-medium text-slate-600">Patient</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Tests</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Order Date</th>
                  <th className="px-4 py-3 font-medium text-slate-600">
                    {activeTab === "ready" ? "Ready Since" : activeTab === "delivered" ? "Delivered At" : "Status"}
                  </th>
                  <th className="px-4 py-3 font-medium text-slate-600">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-slate-900">{order.patientName}</p>
                        <p className="text-xs text-slate-500">{order.orderNumber}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(order.tests ?? []).slice(0, 3).map((t, i) => (
                          <span key={i} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                            {t}
                          </span>
                        ))}
                        {(order.tests ?? []).length > 3 && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                            +{order.tests.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {order.orderDate ? formatDate(order.orderDate) : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {activeTab === "ready" && order.readySince
                        ? formatDate(order.readySince)
                        : activeTab === "delivered" && order.deliveredAt
                        ? formatDate(order.deliveredAt)
                        : order.tat ?? "—"}
                    </td>
                    <td className="px-4 py-3">{statusBadge(order.status, order.tatOverdue)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => sendWhatsApp.mutate(order.id)}
                          disabled={sendWhatsApp.isPending}
                          title="Send via WhatsApp"
                          className="rounded-lg p-1.5 text-green-600 hover:bg-green-50 transition-colors"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => sendEmail.mutate(order.id)}
                          disabled={sendEmail.isPending}
                          title="Send via Email"
                          className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Mail className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handlePrint(order.id)}
                          title="Print Report"
                          className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                        {activeTab !== "delivered" && (
                          <button
                            onClick={() => markDelivered.mutate(order.id)}
                            disabled={markDelivered.isPending}
                            title="Mark Delivered"
                            className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 transition-colors"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
