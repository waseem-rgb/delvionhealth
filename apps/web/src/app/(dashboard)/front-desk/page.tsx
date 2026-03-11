"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  IndianRupee,
  TestTube2,
  FileCheck,
  Home,
  CalendarClock,
  Clock,
  AlertTriangle,
  Bell,
  UserPlus,
  Calendar,
  Truck,
  Search,
  Loader2,
  RefreshCw,
  ArrowRight,
  MapPin,
  CheckCircle2,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import api from "@/lib/api";
import { cn, formatCurrency } from "@/lib/utils";
import { KPICard } from "@/components/shared/KPICard";

// ── Types (matching actual API response from front-desk.service.ts) ─────────

interface AlertItem {
  type: string;
  message: string;
  severity: string;
}

interface RecentRegistration {
  id: string;
  orderNumber: string;
  patient: { id: string; firstName: string; lastName: string; mrn: string; phone: string } | null;
  tests: string[];
  totalAmount: number;
  status: string;
  createdAt: string;
}

interface TodayAppointment {
  id: string;
  appointmentNumber: string;
  patientName: string;
  type: string;
  status: string;
  scheduledAt: string;
  scheduledSlot: string | null;
  isHomeCollection: boolean;
}

interface PhlebStatus {
  phlebId: string;
  phlebName: string;
  status: string;
  shiftStart: string;
  shiftEnd: string;
  assignedSlots: string | null;
  maxSlotsPerDay: number;
  assignedCount: number;
}

interface FrontDeskOverview {
  todayPatients: number;
  todayRevenue: number;
  samplesPending: number;
  reportsReady: number;
  homeCollectionsToday: number;
  appointmentsToday: number;
  queueWaiting: number;
  queueCalled: number;
  alerts: AlertItem[];
  recentRegistrations: RecentRegistration[];
  todayAppointments: TodayAppointment[];
  phlebStatus: PhlebStatus[];
}

// ── Status helpers ───────────────────────────────────────────────────────────

const appointmentStatusBadge: Record<string, { bg: string; text: string; label: string }> = {
  SCHEDULED: { bg: "bg-blue-50", text: "text-blue-700", label: "Scheduled" },
  CHECKED_IN: { bg: "bg-green-50", text: "text-green-700", label: "Checked In" },
  COMPLETED: { bg: "bg-slate-100", text: "text-slate-600", label: "Completed" },
  CANCELLED: { bg: "bg-red-50", text: "text-red-600", label: "Cancelled" },
  NO_SHOW: { bg: "bg-amber-50", text: "text-amber-700", label: "No Show" },
};

const alertSeverityStyle: Record<string, { icon: LucideIcon; color: string }> = {
  warning: { icon: AlertTriangle, color: "text-amber-500" },
  error: { icon: XCircle, color: "text-red-500" },
  info: { icon: Bell, color: "text-blue-500" },
};

const phlebStatusBadge: Record<string, { bg: string; text: string; label: string }> = {
  AVAILABLE: { bg: "bg-green-50", text: "text-green-700", label: "Available" },
  ON_ROUTE: { bg: "bg-blue-50", text: "text-blue-700", label: "On Route" },
  COLLECTING: { bg: "bg-amber-50", text: "text-amber-700", label: "Collecting" },
  OFF_DUTY: { bg: "bg-slate-100", text: "text-slate-500", label: "Off Duty" },
};

// ── Quick Action Config ──────────────────────────────────────────────────────

interface QuickAction {
  label: string;
  href: string;
  icon: LucideIcon;
  color: string;
}

const quickActions: QuickAction[] = [
  { label: "New Walk-in", href: "/registration", icon: UserPlus, color: "bg-blue-600 hover:bg-blue-700 text-white" },
  { label: "Book Appointment", href: "/appointments", icon: Calendar, color: "bg-indigo-600 hover:bg-indigo-700 text-white" },
  { label: "Home Collection", href: "/front-desk/home-collection", icon: Truck, color: "bg-emerald-600 hover:bg-emerald-700 text-white" },
  { label: "Price Enquiry", href: "/front-desk/price-enquiry", icon: Search, color: "bg-slate-700 hover:bg-slate-800 text-white" },
];

// ── Page Component ───────────────────────────────────────────────────────────

export default function FrontDeskPage() {
  const router = useRouter();

  const { data, isLoading, isError, refetch, isFetching } = useQuery<FrontDeskOverview>({
    queryKey: ["front-desk-overview"],
    queryFn: async () => {
      const res = await api.get("/front-desk/overview");
      return res.data?.data ?? res.data;
    },
    refetchInterval: 60000,
  });

  // ── Loading State ────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm text-slate-500">Loading front desk...</p>
        </div>
      </div>
    );
  }

  // ── Error State ──────────────────────────────────────────────────────────

  if (isError || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="p-3 rounded-full bg-red-50">
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-900">Failed to load dashboard</p>
            <p className="text-sm text-slate-500 mt-1">Could not fetch front desk data. Please try again.</p>
          </div>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const alerts = data.alerts ?? [];
  const recentRegistrations = data.recentRegistrations ?? [];
  const todayAppointments = data.todayAppointments ?? [];
  const phlebStatus = data.phlebStatus ?? [];

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Front Desk</h1>
          <p className="text-sm text-slate-500 mt-0.5">Command center &mdash; live stats, queue, and actions</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className={cn(
            "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors",
            isFetching && "opacity-60 cursor-not-allowed"
          )}
        >
          <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* ── ZONE A — Queue Summary Strip ─────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            Queue Summary
          </h2>
          <button
            onClick={() => router.push("/front-desk/queue")}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            Manage Queue <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-sm text-slate-700">{data.queueWaiting} waiting</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm text-slate-700">{data.queueCalled} called</span>
          </div>
        </div>
      </div>

      {/* ── ZONE B — Middle 3-Column Layout ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: KPI Stats (2x3 grid) */}
        <div className="grid grid-cols-2 gap-4 auto-rows-min">
          <KPICard
            title="Registered Today"
            value={data.todayPatients}
            icon={Users}
            iconColor="bg-blue-50 text-blue-600"
            isLoading={false}
          />
          <KPICard
            title="Revenue Today"
            value={formatCurrency(data.todayRevenue)}
            icon={IndianRupee}
            iconColor="bg-green-50 text-green-600"
            isLoading={false}
          />
          <KPICard
            title="Samples Pending"
            value={data.samplesPending}
            icon={TestTube2}
            iconColor="bg-amber-50 text-amber-600"
            isLoading={false}
          />
          <KPICard
            title="Reports Ready"
            value={data.reportsReady}
            icon={FileCheck}
            iconColor="bg-emerald-50 text-emerald-600"
            isLoading={false}
          />
          <KPICard
            title="Home Collections"
            value={data.homeCollectionsToday}
            icon={Home}
            iconColor="bg-purple-50 text-purple-600"
            isLoading={false}
          />
          <KPICard
            title="Appointments Today"
            value={data.appointmentsToday}
            icon={CalendarClock}
            iconColor="bg-indigo-50 text-indigo-600"
            isLoading={false}
          />
        </div>

        {/* Column 2: Appointment Timeline */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col">
          <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            Today&apos;s Appointments
          </h2>

          {todayAppointments.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-slate-400">No appointments today.</p>
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-[420px] pr-1">
              {todayAppointments.map((appt) => {
                const badge = appointmentStatusBadge[appt.status] ?? appointmentStatusBadge.SCHEDULED;
                return (
                  <div
                    key={appt.id}
                    className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex-shrink-0 w-14 text-center">
                      <span className="text-xs font-semibold text-slate-700">
                        {appt.scheduledSlot ?? new Date(appt.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{appt.patientName}</p>
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {appt.type}{appt.isHomeCollection ? " (Home)" : ""}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide",
                        badge.bg,
                        badge.text
                      )}
                    >
                      {badge.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Column 3: Alerts + Quick Actions */}
        <div className="space-y-6">
          {/* Alerts Panel */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Bell className="w-4 h-4 text-blue-600" />
              Alerts
            </h2>
            {alerts.length === 0 ? (
              <div className="flex items-center justify-center py-6">
                <div className="text-center">
                  <CheckCircle2 className="w-6 h-6 text-green-400 mx-auto mb-1" />
                  <p className="text-sm text-slate-400">All clear — no alerts.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                {alerts.map((alert, idx) => {
                  const style = alertSeverityStyle[alert.severity] ?? alertSeverityStyle.info;
                  const AlertIcon = style.icon;
                  return (
                    <div
                      key={idx}
                      className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100"
                    >
                      <AlertIcon className={cn("w-4 h-4 mt-0.5 flex-shrink-0", style.color)} />
                      <div className="min-w-0">
                        <p className="text-xs text-slate-700 leading-snug">{alert.message}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{alert.type}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2">
              {quickActions.map((action) => {
                const ActionIcon = action.icon;
                return (
                  <button
                    key={action.href}
                    onClick={() => router.push(action.href)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2.5 text-xs font-medium rounded-lg transition-colors",
                      action.color
                    )}
                  >
                    <ActionIcon className="w-4 h-4" />
                    {action.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── ZONE C — Bottom 2-Column Layout ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Registrations */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              Recent Registrations
            </h2>
            <button
              onClick={() => router.push("/registration")}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              View All <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {recentRegistrations.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">No registrations yet today.</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {recentRegistrations.map((reg) => (
                <div
                  key={reg.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-semibold text-blue-600">{reg.orderNumber}</span>
                      <span className="text-xs text-slate-400">
                        {new Date(reg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-900 truncate mt-0.5">
                      {reg.patient ? `${reg.patient.firstName} ${reg.patient.lastName}` : "Unknown"}
                    </p>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{(reg.tests ?? []).join(", ")}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Phlebotomist Status */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              Phlebotomist Status
            </h2>
          </div>

          {phlebStatus.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">No phlebotomists assigned.</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {phlebStatus.map((phleb) => {
                const badge = phlebStatusBadge[phleb.status] ?? phlebStatusBadge.OFF_DUTY;
                return (
                  <div
                    key={phleb.phlebId}
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                        <span className="text-xs font-semibold text-slate-600">
                          {(phleb.phlebName ?? "?").charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{phleb.phlebName}</p>
                        <p className="text-xs text-slate-500">
                          {phleb.assignedCount} assignment{phleb.assignedCount !== 1 ? "s" : ""} | {phleb.shiftStart}–{phleb.shiftEnd}
                        </p>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide",
                        badge.bg,
                        badge.text
                      )}
                    >
                      {badge.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
