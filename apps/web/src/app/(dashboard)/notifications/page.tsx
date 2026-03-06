"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CheckCheck,
  AlertCircle,
  Info,
  CheckCircle,
  Package,
  FileText,
} from "lucide-react";
import api from "@/lib/api";

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  entityId: string | null;
  entityType: string | null;
}

const TYPE_ICON: Record<string, React.ElementType> = {
  ORDER_CONFIRMED: CheckCircle,
  SAMPLE_COLLECTED: Package,
  REPORT_READY: FileText,
  CRITICAL_ALERT: AlertCircle,
  PAYMENT_RECEIVED: CheckCircle,
  SYSTEM: Info,
};

const TYPE_COLOR: Record<string, string> = {
  ORDER_CONFIRMED: "text-green-600 bg-green-100",
  SAMPLE_COLLECTED: "text-blue-600 bg-blue-100",
  REPORT_READY: "text-teal-600 bg-teal-100",
  CRITICAL_ALERT: "text-red-600 bg-red-100",
  PAYMENT_RECEIVED: "text-emerald-600 bg-emerald-100",
  SYSTEM: "text-slate-600 bg-slate-100",
};

function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NotificationsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"ALL" | "UNREAD">("ALL");

  const { data, isLoading } = useQuery({
    queryKey: ["notifications-list"],
    queryFn: () =>
      api
        .get("/notifications?limit=50")
        .then((r) => r.data as { data: NotificationItem[] }),
    refetchInterval: 30_000,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.put(`/notifications/${id}/read`),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["notifications-list"] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => api.put("/notifications/read-all/mark"),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["notifications-list"] }),
  });

  const notifications = data?.data ?? [];
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const displayed =
    filter === "UNREAD"
      ? notifications.filter((n) => !n.isRead)
      : notifications;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllRead.mutate()}
            className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            <CheckCheck className="w-4 h-4" /> Mark all read
          </button>
        )}
      </div>

      {/* Filter */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {(["ALL", "UNREAD"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
              filter === f
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {f === "ALL"
              ? "All"
              : `Unread${unreadCount > 0 ? ` (${unreadCount})` : ""}`}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-1">
        {isLoading ? (
          [...Array(5)].map((_, i) => (
            <div
              key={i}
              className="bg-white border border-slate-100 rounded-xl p-4 animate-pulse flex gap-3"
            >
              <div className="w-10 h-10 bg-slate-200 rounded-full flex-shrink-0" />
              <div className="flex-1">
                <div className="h-4 w-3/4 bg-slate-200 rounded mb-2" />
                <div className="h-3 w-full bg-slate-100 rounded" />
              </div>
            </div>
          ))
        ) : displayed.length === 0 ? (
          <div className="bg-white border border-slate-100 rounded-xl p-16 text-center">
            <Bell className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No notifications</p>
          </div>
        ) : (
          displayed.map((notif) => {
            const Icon = TYPE_ICON[notif.type] ?? Info;
            const colorClass =
              TYPE_COLOR[notif.type] ?? "text-slate-600 bg-slate-100";
            return (
              <div
                key={notif.id}
                className={`flex gap-3 rounded-xl border p-4 transition-colors cursor-pointer hover:bg-slate-50 ${
                  notif.isRead
                    ? "bg-white border-slate-100"
                    : "bg-blue-50/40 border-blue-100"
                }`}
                onClick={() => !notif.isRead && markRead.mutate(notif.id)}
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${colorClass}`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={`text-sm ${
                        notif.isRead
                          ? "text-slate-700 font-normal"
                          : "text-slate-900 font-semibold"
                      }`}
                    >
                      {notif.title}
                    </p>
                    <span className="text-xs text-slate-400 flex-shrink-0">
                      {timeAgo(notif.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                    {notif.body}
                  </p>
                </div>
                {!notif.isRead && (
                  <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 flex-shrink-0" />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
