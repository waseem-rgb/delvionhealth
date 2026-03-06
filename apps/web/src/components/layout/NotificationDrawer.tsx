"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {
  X,
  ClipboardList,
  FlaskConical,
  Microscope,
  AlertTriangle,
  CreditCard,
  FileText,
  Bell,
} from "lucide-react";
import Link from "next/link";
import { cn, formatRelativeTime } from "@/lib/utils";

interface Notification {
  id: string;
  type: "order" | "sample" | "result" | "critical" | "payment" | "report";
  title: string;
  body: string;
  createdAt: string;
  isRead: boolean;
  href?: string;
}

// Demo notifications — replaced with real API data when backend ready
const DEMO_NOTIFICATIONS: Notification[] = [
  {
    id: "1",
    type: "critical",
    title: "Critical Result — Patient Rajesh Kumar",
    body: "Potassium level critically high: 7.8 mEq/L. Immediate attention required.",
    createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    isRead: false,
    href: "/results",
  },
  {
    id: "2",
    type: "sample",
    title: "Sample ready for processing",
    body: "Sample DH-2025-001234 has been received and is ready for analysis.",
    createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    isRead: false,
    href: "/samples",
  },
  {
    id: "3",
    type: "order",
    title: "New order placed",
    body: "Order #ORD-2025-0089 placed for Sunita Patel. 3 tests pending.",
    createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    isRead: true,
    href: "/orders",
  },
  {
    id: "4",
    type: "report",
    title: "Report ready for review",
    body: "Report for Anil Kapoor (CBC + LFT) has been generated and awaits approval.",
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    isRead: true,
    href: "/reports",
  },
  {
    id: "5",
    type: "payment",
    title: "Invoice paid",
    body: "Invoice #INV-2025-0045 for ₹2,350 has been paid by Dr. Rajan Mehta's clinic.",
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    isRead: true,
    href: "/billing",
  },
];

const TYPE_ICON: Record<Notification["type"], React.ElementType> = {
  order: ClipboardList,
  sample: FlaskConical,
  result: Microscope,
  critical: AlertTriangle,
  payment: CreditCard,
  report: FileText,
};

const TYPE_COLOR: Record<Notification["type"], string> = {
  order: "bg-blue-100 text-blue-600",
  sample: "bg-teal-100 text-teal-600",
  result: "bg-purple-100 text-purple-600",
  critical: "bg-red-100 text-red-600",
  payment: "bg-green-100 text-green-600",
  report: "bg-slate-100 text-slate-600",
};

interface NotificationDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationDrawer({ open, onClose }: NotificationDrawerProps) {
  const unread = DEMO_NOTIFICATIONS.filter((n) => !n.isRead);

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/20 z-50" />
        <Dialog.Content className="fixed right-0 top-0 h-full w-[380px] bg-white shadow-2xl z-50 flex flex-col focus:outline-none">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Dialog.Title className="text-base font-semibold text-slate-900">
                Notifications
              </Dialog.Title>
              {unread.length > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-600 rounded-full">
                  {unread.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button className="text-xs text-[#0D7E8A] hover:underline font-medium">
                Mark all read
              </button>
              <Dialog.Close asChild>
                <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                  <X size={16} />
                </button>
              </Dialog.Close>
            </div>
          </div>

          {/* Notification list */}
          <div className="flex-1 overflow-y-auto">
            {DEMO_NOTIFICATIONS.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <Bell size={36} className="text-slate-300 mb-3" />
                <p className="text-sm font-medium text-slate-500">No notifications yet</p>
                <p className="text-xs text-slate-400 mt-1">You're all caught up!</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {DEMO_NOTIFICATIONS.map((notif) => {
                  const Icon = TYPE_ICON[notif.type];
                  const colorClass = TYPE_COLOR[notif.type];

                  return (
                    <div
                      key={notif.id}
                      className={cn(
                        "flex items-start gap-3 px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors relative",
                        !notif.isRead && "bg-blue-50/30"
                      )}
                      onClick={onClose}
                    >
                      {/* Unread dot */}
                      {!notif.isRead && (
                        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-blue-500" />
                      )}

                      <div className={cn("flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center", colorClass)}>
                        <Icon size={17} className={notif.type === "critical" ? "animate-pulse" : ""} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className={cn("text-sm leading-snug", !notif.isRead ? "font-semibold text-slate-900" : "text-slate-700")}>
                          {notif.title}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{notif.body}</p>
                        <p className="text-[11px] text-slate-400 mt-1">{formatRelativeTime(notif.createdAt)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 p-4 text-center">
            <Link
              href="/notifications"
              onClick={onClose}
              className="text-sm text-[#0D7E8A] hover:underline font-medium"
            >
              View all notifications →
            </Link>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
