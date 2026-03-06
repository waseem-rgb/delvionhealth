"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  ClipboardList,
  FlaskConical,
  BarChart3,
  Settings,
  FileText,
  Search,
  ArrowRight,
  Loader2,
} from "lucide-react";
import api from "@/lib/api";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

interface CommandItem {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: React.ElementType;
  group: "patients" | "orders" | "nav";
}

interface PatientResult {
  id: string;
  firstName: string;
  lastName: string;
  mrn: string;
  phone: string;
}

interface OrderResult {
  id: string;
  orderNumber: string;
  status: string;
  patient: { firstName: string; lastName: string };
}

const NAV_COMMANDS: CommandItem[] = [
  { id: "nav-dashboard", label: "Dashboard", description: "Executive overview", href: "/dashboard", icon: BarChart3, group: "nav" },
  { id: "nav-patients", label: "Patients", description: "View all patients", href: "/patients", icon: Users, group: "nav" },
  { id: "nav-patient-new", label: "New Patient", description: "Register a new patient", href: "/patients/new", icon: Users, group: "nav" },
  { id: "nav-orders", label: "Orders", description: "View all orders", href: "/orders", icon: ClipboardList, group: "nav" },
  { id: "nav-order-new", label: "New Order", description: "Create a new order", href: "/orders/new", icon: ClipboardList, group: "nav" },
  { id: "nav-samples", label: "Samples Queue", description: "View sample tracking", href: "/samples", icon: FlaskConical, group: "nav" },
  { id: "nav-results", label: "Results Workbench", description: "Enter & verify test results", href: "/results", icon: FileText, group: "nav" },
  { id: "nav-reports", label: "Reports", description: "View & generate reports", href: "/reports", icon: FileText, group: "nav" },
  { id: "nav-analytics", label: "Analytics", description: "View dashboards", href: "/analytics", icon: BarChart3, group: "nav" },
  { id: "nav-billing", label: "Billing", description: "Invoices & payments", href: "/billing", icon: ClipboardList, group: "nav" },
  { id: "nav-settings", label: "Settings", description: "Platform settings", href: "/settings", icon: Settings, group: "nav" },
];

const GROUP_LABELS: Record<CommandItem["group"], string> = {
  patients: "Patients",
  orders: "Orders",
  nav: "Navigation",
};

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [searching, setSearching] = useState(false);
  const [dynamicItems, setDynamicItems] = useState<CommandItem[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filtered nav commands
  const filteredNav = NAV_COMMANDS.filter(
    (c) =>
      c.label.toLowerCase().includes(query.toLowerCase()) ||
      c.description.toLowerCase().includes(query.toLowerCase())
  );

  // Combined list: dynamic results first, then nav
  const allItems: CommandItem[] = query.length >= 2
    ? [...dynamicItems, ...filteredNav]
    : filteredNav;

  // Debounced API search
  useEffect(() => {
    if (!open || query.length < 2) {
      setDynamicItems([]);
      setSearching(false);
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    setSearching(true);

    timerRef.current = setTimeout(async () => {
      try {
        const [patientRes, orderRes] = await Promise.allSettled([
          api.get<{ data: PatientResult[] }>(`/patients/search?q=${encodeURIComponent(query)}`),
          api.get<{ data: OrderResult[] }>(`/orders/search?q=${encodeURIComponent(query)}`),
        ]);

        const patients: CommandItem[] =
          patientRes.status === "fulfilled"
            ? (patientRes.value.data.data ?? []).slice(0, 5).map((p) => ({
                id: `patient-${p.id}`,
                label: `${p.firstName} ${p.lastName}`,
                description: `MRN: ${p.mrn} · ${p.phone}`,
                href: `/patients/${p.id}`,
                icon: Users,
                group: "patients" as const,
              }))
            : [];

        const orders: CommandItem[] =
          orderRes.status === "fulfilled"
            ? (orderRes.value.data.data ?? []).slice(0, 5).map((o) => ({
                id: `order-${o.id}`,
                label: o.orderNumber,
                description: `${o.patient.firstName} ${o.patient.lastName} · ${o.status.replace(/_/g, " ")}`,
                href: `/orders/${o.id}`,
                icon: ClipboardList,
                group: "orders" as const,
              }))
            : [];

        setDynamicItems([...patients, ...orders]);
      } catch {
        setDynamicItems([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, open]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onClose();
      }
      if (!open) return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown")
        setSelected((s) => Math.min(s + 1, allItems.length - 1));
      if (e.key === "ArrowUp") setSelected((s) => Math.max(s - 1, 0));
      if (e.key === "Enter" && allItems[selected]) {
        router.push(allItems[selected]!.href);
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, selected, allItems, router, onClose]);

  // Reset on open/close
  useEffect(() => {
    setSelected(0);
    setQuery("");
    setDynamicItems([]);
  }, [open]);

  if (!open) return null;

  // Group items for rendering
  const grouped = allItems.reduce<{ group: CommandItem["group"]; items: CommandItem[] }[]>(
    (acc, item) => {
      const last = acc[acc.length - 1];
      if (last && last.group === item.group) {
        last.items.push(item);
      } else {
        acc.push({ group: item.group, items: [item] });
      }
      return acc;
    },
    []
  );

  let globalIndex = 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />
      <div
        className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 p-4 border-b border-slate-100">
          {searching ? (
            <Loader2 size={18} className="text-[#1B4F8A] flex-shrink-0 animate-spin" />
          ) : (
            <Search size={18} className="text-slate-400 flex-shrink-0" />
          )}
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(0);
            }}
            placeholder="Search patients, orders, or navigate..."
            className="flex-1 text-sm text-slate-900 placeholder-slate-400 outline-none bg-transparent"
          />
          <kbd className="text-xs text-slate-400 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 font-mono">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto p-2">
          {allItems.length === 0 && !searching ? (
            <p className="text-center text-sm text-slate-400 py-8">
              {query ? `No results for "${query}"` : "Type to search or navigate..."}
            </p>
          ) : (
            grouped.map(({ group, items }) => (
              <div key={group}>
                {/* Group header */}
                <p className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  {GROUP_LABELS[group]}
                </p>
                {items.map((item) => {
                  const idx = globalIndex++;
                  const isSelected = idx === selected;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        router.push(item.href);
                        onClose();
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                        isSelected
                          ? "bg-[#1B4F8A] text-white"
                          : "hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <div
                        className={`p-1.5 rounded-md flex-shrink-0 ${
                          isSelected ? "bg-white/20" : "bg-slate-100"
                        }`}
                      >
                        <item.icon
                          size={14}
                          className={isSelected ? "text-white" : "text-slate-500"}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.label}</p>
                        <p
                          className={`text-xs truncate ${
                            isSelected ? "text-blue-200" : "text-slate-400"
                          }`}
                        >
                          {item.description}
                        </p>
                      </div>
                      <ArrowRight
                        size={14}
                        className={isSelected ? "text-blue-200" : "text-slate-300"}
                      />
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-slate-100 text-xs text-slate-400">
          <span><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono">↵</kbd> select</span>
          <span><kbd className="font-mono">esc</kbd> close</span>
          {query.length >= 2 && (
            <span className="ml-auto">
              Searching patients & orders...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
