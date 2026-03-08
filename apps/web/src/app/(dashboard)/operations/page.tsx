"use client";

import { useState, useCallback, useMemo, useEffect, useRef, Fragment } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  List,
  Zap,
  Clock,
  CheckCircle2,
  FileCheck,
  AlertTriangle,
  AlertCircle,
  XCircle,
  Send,
  Settings,
  Download,
  ArrowLeft,
  Phone,
  User,
  FileText,
  ClipboardList,
  History,
  TrendingUp,
  X,
  ExternalLink,
  FlaskConical,
} from "lucide-react";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ── Types ────────────────────────────────────────────────────────────────────

interface WaitingListPatient {
  id: string;
  firstName: string;
  lastName: string;
  mrn: string;
  gender: string;
  dob: string;
  phone: string;
}

interface WaitingListItem {
  id: string;
  orderNumber: string;
  status: string;
  priority: "ROUTINE" | "URGENT" | "STAT";
  createdAt: string;
  accessionedAt: string | null;
  patient: WaitingListPatient;
  tests: string[];
  testDetails?: { id: string; name: string }[];
  totalTests: number;
  completedTests: number;
  incompleteTests: number;
  signedTests: number;
  invoiceNumber: string;
  accessionNumbers: string[];
  isTatBreached: boolean;
  maxTatHours: number;
  elapsedHours: number;
  createdBy: { firstName: string; lastName: string } | null;
}

interface StatusCounts {
  allTests: number;
  incomplete: number;
  partiallyCompleted: number;
  activeReruns: number;
  completed: number;
  partiallySigned: number;
  signed: number;
  emergency: number;
  critical: number;
  tatExceeded: number;
  outsourced: number;
  dispatched: number;
  cancelled: number;
}

interface DepartmentCount {
  department: string;
  count: number;
}

type StatusFilterKey =
  | "all"
  | "incomplete"
  | "partiallyCompleted"
  | "activeReruns"
  | "completed"
  | "partiallySigned"
  | "signed"
  | "emergency"
  | "critical"
  | "tatExceeded"
  | "outsourced"
  | "dispatched"
  | "cancelled";

type CenterTab = "patients" | "testwise" | "instrumentwise";

// ── Helpers ──────────────────────────────────────────────────────────────────

function computeAge(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function formatDateGroupHeader(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDate();
  const suffix =
    day % 10 === 1 && day !== 11
      ? "st"
      : day % 10 === 2 && day !== 12
        ? "nd"
        : day % 10 === 3 && day !== 13
          ? "rd"
          : "th";
  const month = d.toLocaleDateString("en-US", { month: "short" });
  const year = d.getFullYear();
  return `${day}${suffix} ${month}, ${year}`;
}

function getDateKey(dateStr: string): string {
  return new Date(dateStr).toISOString().split("T")[0];
}

function getGenderLabel(gender: string): string {
  const map: Record<string, string> = {
    MALE: "M",
    FEMALE: "F",
    OTHER: "O",
    Male: "M",
    Female: "F",
    Other: "O",
    M: "M",
    F: "F",
  };
  return map[gender] ?? gender?.charAt(0) ?? "";
}

function formatElapsedTat(hours: number): string {
  if (hours < 1) {
    const mins = Math.round(hours * 60);
    return `${mins}m`;
  }
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ── Status Sidebar Config ────────────────────────────────────────────────────

interface SidebarItem {
  key: StatusFilterKey;
  label: string;
  countKey: keyof StatusCounts;
  icon: typeof Clock;
  redWhenPositive?: boolean;
}

const SIDEBAR_SECTIONS: (SidebarItem | "separator" | "link")[][] = [
  [
    { key: "incomplete", label: "Incomplete", countKey: "incomplete", icon: Clock },
    { key: "partiallyCompleted", label: "Partially Completed", countKey: "partiallyCompleted", icon: ClipboardList },
    { key: "activeReruns", label: "Active Reruns", countKey: "activeReruns", icon: RefreshCw },
    { key: "completed", label: "Completed", countKey: "completed", icon: CheckCircle2 },
  ],
  [
    { key: "partiallySigned", label: "Partially Signed", countKey: "partiallySigned", icon: FileCheck },
    { key: "signed", label: "Signed", countKey: "signed", icon: FileText },
  ],
  [
    { key: "emergency", label: "Emergency Reports", countKey: "emergency", icon: AlertTriangle },
    { key: "critical", label: "Critical Reports", countKey: "critical", icon: AlertCircle, redWhenPositive: true },
    { key: "tatExceeded", label: "TAT Exceeded", countKey: "tatExceeded", icon: Clock, redWhenPositive: true },
    { key: "outsourced", label: "Outsourced", countKey: "outsourced", icon: ExternalLink },
  ],
  [
    { key: "dispatched", label: "History / Dispatched", countKey: "dispatched", icon: Send },
    { key: "cancelled", label: "Cancelled Reports", countKey: "cancelled", icon: XCircle },
  ],
];

// ── Left Sidebar Component ───────────────────────────────────────────────────

function LeftSidebar({
  counts,
  activeFilter,
  onFilterChange,
}: {
  counts: StatusCounts | undefined;
  activeFilter: StatusFilterKey;
  onFilterChange: (f: StatusFilterKey) => void;
}) {
  const allCount = counts?.allTests ?? 0;

  return (
    <div className="w-[200px] shrink-0 bg-slate-800 text-slate-200 flex flex-col overflow-y-auto rounded-l-xl">
      {/* All Tests Header */}
      <button
        onClick={() => onFilterChange("all")}
        className={cn(
          "flex items-center justify-between px-4 py-3 text-sm font-semibold border-b border-slate-700 transition-colors",
          activeFilter === "all"
            ? "bg-slate-700 text-white"
            : "hover:bg-slate-700/50"
        )}
      >
        <span>All Tests</span>
        <span className="bg-slate-600 text-slate-200 text-xs font-bold px-2 py-0.5 rounded-full">
          {allCount}
        </span>
      </button>

      {/* Status Filter Links */}
      <div className="flex-1 py-1">
        {SIDEBAR_SECTIONS.map((section, si) => (
          <div key={si}>
            {si > 0 && (
              <div className="mx-3 my-1 border-t border-slate-700" />
            )}
            {section.map((item) => {
              if (item === "separator" || item === "link") return null;
              const sItem = item as SidebarItem;
              const count = counts?.[sItem.countKey] ?? 0;
              const isActive = activeFilter === sItem.key;
              const isRed = sItem.redWhenPositive && count > 0;
              const Icon = sItem.icon;

              return (
                <button
                  key={sItem.key}
                  onClick={() => onFilterChange(sItem.key)}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-2 text-xs transition-colors group",
                    isActive
                      ? "bg-slate-600 text-white font-semibold"
                      : "hover:bg-slate-700/50 text-slate-300"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon size={13} className={cn(isRed ? "text-red-400" : "text-slate-400", isActive && "text-white")} />
                    <span className={cn("truncate", isRed && !isActive && "text-red-400")}>
                      {sItem.label}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1 shrink-0",
                      isActive
                        ? "bg-white/20 text-white"
                        : isRed
                          ? "bg-red-500/20 text-red-400"
                          : "bg-slate-700 text-slate-400"
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        ))}

        {/* Bottom links */}
        <div className="mx-3 my-1 border-t border-slate-700" />
        <Link
          href="/settings"
          className="w-full flex items-center gap-2 px-4 py-2 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors"
        >
          <Settings size={13} />
          Settings
        </Link>
        <button
          className="w-full flex items-center gap-2 px-4 py-2 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors"
          onClick={() => toast.info("Operational export will be available soon")}
        >
          <Download size={13} />
          Operational Export
        </button>
      </div>
    </div>
  );
}

// ── Patient Row Component ────────────────────────────────────────────────────

function PatientRow({
  item,
  isSelected,
  onSelect,
}: {
  item: WaitingListItem;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const isStat = item.priority === "STAT";
  const age = item.patient.dob ? computeAge(item.patient.dob) : null;
  const genderLabel = getGenderLabel(item.patient.gender);

  return (
    <tr
      onClick={onSelect}
      className={cn(
        "border-b border-slate-100 cursor-pointer transition-colors text-xs",
        isSelected
          ? "bg-blue-50 border-l-2 border-l-blue-500"
          : "hover:bg-slate-50",
        item.isTatBreached && "bg-red-50/40"
      )}
    >
      {/* Patient ID */}
      <td className="px-3 py-2.5 whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          {isStat && <Zap size={12} className="text-red-500 fill-red-500 shrink-0" />}
          <span className="font-mono font-semibold text-slate-700">{item.patient.mrn}</span>
        </div>
      </td>

      {/* Patient Details */}
      <td className="px-3 py-2.5">
        <div className="min-w-0">
          <p className={cn("font-medium text-slate-900 truncate", isStat && "text-red-700")}>
            {item.patient.firstName} {item.patient.lastName}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {age !== null && `${age}y`}
            {genderLabel && `/${genderLabel}`}
            {item.patient.dob && ` | DOB: ${new Date(item.patient.dob).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`}
          </p>
          <p className="text-[11px] text-slate-400 truncate mt-0.5" title={item.tests.join(", ")}>
            {item.tests.length > 3
              ? `${item.tests.slice(0, 3).join(", ")}... +${item.tests.length - 3}`
              : item.tests.join(", ")}
          </p>
        </div>
      </td>

      {/* Bill ID */}
      <td className="px-3 py-2.5 whitespace-nowrap">
        <span className="font-mono text-slate-600">{item.invoiceNumber || "—"}</span>
      </td>

      {/* Accession No */}
      <td className="px-3 py-2.5 whitespace-nowrap">
        {item.accessionNumbers.length > 0 ? (
          <div className="space-y-0.5">
            {item.accessionNumbers.slice(0, 2).map((acc) => (
              <span key={acc} className="block font-mono text-slate-600">{acc}</span>
            ))}
            {item.accessionNumbers.length > 2 && (
              <span className="text-[10px] text-slate-400">
                +{item.accessionNumbers.length - 2} more
              </span>
            )}
          </div>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>

      {/* Referral */}
      <td className="px-3 py-2.5 whitespace-nowrap">
        <span className="text-slate-500">{item.createdBy ? `${item.createdBy.firstName} ${item.createdBy.lastName}` : "—"}</span>
      </td>

      {/* Organisation */}
      <td className="px-3 py-2.5 whitespace-nowrap">
        <span className="text-slate-500">—</span>
      </td>

      {/* Incomplete */}
      <td className="px-3 py-2.5 text-center">
        {item.incompleteTests > 0 ? (
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-gray-100 text-gray-700 font-semibold">
            {item.incompleteTests}
          </span>
        ) : (
          <span className="text-slate-300">0</span>
        )}
      </td>

      {/* Completed */}
      <td className="px-3 py-2.5 text-center">
        {item.completedTests > 0 ? (
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-green-100 text-green-700 font-semibold">
            {item.completedTests}
          </span>
        ) : (
          <span className="text-slate-300">0</span>
        )}
      </td>

      {/* Signed */}
      <td className="px-3 py-2.5 text-center">
        {item.signedTests > 0 ? (
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-teal-100 text-teal-700 font-semibold">
            {item.signedTests}
          </span>
        ) : (
          <span className="text-slate-300">0</span>
        )}
      </td>

      {/* TAT indicator */}
      <td className="px-2 py-2.5 text-center">
        {item.isTatBreached ? (
          <span className="inline-flex items-center gap-0.5 text-red-600 font-semibold" title={`Elapsed: ${formatElapsedTat(item.elapsedHours)} / Max: ${item.maxTatHours}h`}>
            <AlertTriangle size={11} />
            <span className="text-[10px]">TAT</span>
          </span>
        ) : item.elapsedHours > 0 ? (
          <span className="text-[10px] text-slate-400" title={`Elapsed: ${formatElapsedTat(item.elapsedHours)}`}>
            {formatElapsedTat(item.elapsedHours)}
          </span>
        ) : null}
      </td>
    </tr>
  );
}

// ── Right Panel Component ────────────────────────────────────────────────────

function RightPanel({
  item,
  onClose,
}: {
  item: WaitingListItem;
  onClose: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"pending" | "history" | "overview" | "trends">("pending");
  const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set());
  const [testParamsCache, setTestParamsCache] = useState<Record<string, any[]>>({});
  const age = item.patient.dob ? computeAge(item.patient.dob) : null;

  const toggleTestExpand = useCallback(async (testId: string) => {
    if (expandedTests.has(testId)) {
      setExpandedTests((prev) => { const next = new Set(prev); next.delete(testId); return next; });
      return;
    }
    if (!testParamsCache[testId]) {
      try {
        const res = await api.get(`/test-catalog/${testId}/parameters`);
        const params = res.data?.data?.data ?? res.data?.data ?? [];
        setTestParamsCache((prev) => ({ ...prev, [testId]: params }));
      } catch { /* ignore */ }
    }
    setExpandedTests((prev) => new Set(prev).add(testId));
  }, [expandedTests, testParamsCache]);

  const startMutation = useMutation({
    mutationFn: async (orderId: string) => {
      await api.post(`/lab/operations/${orderId}/start`);
    },
    onSuccess: () => {
      toast.success("Processing started");
      void queryClient.invalidateQueries({ queryKey: ["waiting-list"] });
      void queryClient.invalidateQueries({ queryKey: ["status-counts"] });
    },
    onError: () => {
      toast.error("Failed to start processing");
    },
  });

  const submitAllMutation = useMutation({
    mutationFn: async () => {
      // Submit all results for this order
      const res = await api.get(`/lab/results/${item.id}`);
      const orderData = res.data.data ?? res.data;
      const results = (orderData.items ?? [])
        .filter((i: any) => (i.testResults ?? []).length > 0)
        .map((i: any) => ({
          orderItemId: i.id,
          value: i.testResults[0]?.value ?? "",
          unit: i.testResults[0]?.unit ?? "",
        }))
        .filter((r: any) => r.value);
      if (results.length === 0) {
        throw new Error("No results to submit");
      }
      await api.post(`/lab/results/${item.id}/submit`, { results });
    },
    onSuccess: () => {
      toast.success("All results submitted for approval");
      void queryClient.invalidateQueries({ queryKey: ["waiting-list"] });
      void queryClient.invalidateQueries({ queryKey: ["status-counts"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Submit failed"),
  });

  const signAllMutation = useMutation({
    mutationFn: async () => {
      // Get all result IDs and sign each
      const res = await api.get(`/lab/results/${item.id}`);
      const orderData = res.data.data ?? res.data;
      const resultIds = (orderData.items ?? [])
        .flatMap((i: any) => (i.testResults ?? []))
        .filter((r: any) => !r.isDraft && !r.signedAt)
        .map((r: any) => r.id);
      if (resultIds.length === 0) throw new Error("No results to sign");
      for (const rid of resultIds) {
        await api.post(`/lab/results/${rid}/sign`);
      }
    },
    onSuccess: () => {
      toast.success("All results signed");
      void queryClient.invalidateQueries({ queryKey: ["waiting-list"] });
      void queryClient.invalidateQueries({ queryKey: ["status-counts"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Sign failed"),
  });

  const statusBadgeClass = (status: string) => {
    switch (status) {
      case "INCOMPLETE":
      case "PENDING":
        return "bg-gray-100 text-gray-700";
      case "PARTIALLY_COMPLETED":
      case "IN_PROCESSING":
        return "bg-amber-100 text-amber-700";
      case "COMPLETED":
      case "RESULTED":
        return "bg-green-100 text-green-700";
      case "SIGNED":
      case "REPORTED":
        return "bg-teal-100 text-teal-700";
      default:
        return "bg-slate-100 text-slate-600";
    }
  };

  return (
    <div className="w-[380px] shrink-0 bg-white border-l border-slate-200 flex flex-col overflow-hidden rounded-r-xl">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft size={16} className="text-slate-500" />
          </button>
          <div className="text-xs text-slate-400 truncate">
            Waiting List / <span className="text-slate-700 font-medium">{item.patient.firstName} {item.patient.lastName}</span>
          </div>
        </div>

        {/* Patient Info */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
            <User size={18} className="text-slate-500" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-slate-900 truncate">
              {item.patient.firstName} {item.patient.lastName}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {getGenderLabel(item.patient.gender)}
              {age !== null && ` | ${age}y`}
              {item.patient.dob && ` | DOB: ${new Date(item.patient.dob).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`}
            </p>
            <div className="flex items-center gap-3 mt-1.5">
              {item.patient.phone && (
                <span className="flex items-center gap-1 text-[11px] text-slate-400">
                  <Phone size={10} />
                  {item.patient.phone}
                </span>
              )}
              <span className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                <User size={10} />
                {item.patient.mrn}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 mt-3">
          <Link
            href={`/billing?search=${item.invoiceNumber}`}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium border border-slate-200 rounded-md hover:bg-slate-50 text-slate-600 transition-colors"
          >
            <FileText size={11} />
            Bill Updates
          </Link>
          <button
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium border border-slate-200 rounded-md hover:bg-slate-50 text-slate-600 transition-colors"
            onClick={() => toast.info("Audit trail coming soon")}
          >
            <History size={11} />
            Audit Trail
          </button>
          <button
            onClick={() => {
              void queryClient.invalidateQueries({ queryKey: ["waiting-list"] });
            }}
            className="p-1.5 border border-slate-200 rounded-md hover:bg-slate-50 text-slate-500 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={12} />
          </button>
          <button
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            onClick={() => submitAllMutation.mutate()}
            disabled={submitAllMutation.isPending}
          >
            <Send size={11} />
            {submitAllMutation.isPending ? "Submitting..." : "Submit All"}
          </button>
          <button
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium bg-teal-600 text-white rounded-md hover:bg-teal-700 transition-colors disabled:opacity-50"
            onClick={() => signAllMutation.mutate()}
            disabled={signAllMutation.isPending}
          >
            <FileCheck size={11} />
            {signAllMutation.isPending ? "Signing..." : "Sign All"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-100">
        {(
          [
            { key: "pending", label: "Pending Reports" },
            { key: "history", label: "History" },
            { key: "overview", label: "Overview" },
            { key: "trends", label: "Trends" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex-1 px-2 py-2.5 text-[11px] font-medium transition-colors text-center",
              activeTab === tab.key
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-slate-400 hover:text-slate-600"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "pending" && (
          <div className="divide-y divide-slate-100">
            {/* Accession group */}
            <div className="px-4 py-2 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-medium">
                  Order: <span className="font-mono text-slate-700">{item.orderNumber}</span>
                </span>
                <span className="text-[10px] text-slate-400">
                  {item.totalTests} test{item.totalTests !== 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {/* Test rows */}
            {item.tests.map((test, idx) => {
              const isCompleted = idx < item.completedTests;
              const isSigned = idx < item.signedTests;
              const testStatus = isSigned
                ? "SIGNED"
                : isCompleted
                  ? "COMPLETED"
                  : "INCOMPLETE";

              return (
                <div
                  key={`${test}-${idx}`}
                  className="px-4 py-2.5 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {item.testDetails?.[idx] ? (
                        <button
                          onClick={() => toggleTestExpand(item.testDetails![idx].id)}
                          className="flex items-center gap-1 text-xs font-medium text-slate-800 hover:text-blue-600 transition-colors"
                        >
                          {expandedTests.has(item.testDetails![idx].id)
                            ? <ChevronDown size={12} />
                            : <ChevronRight size={12} />}
                          {test}
                        </button>
                      ) : (
                        <p className="text-xs font-medium text-slate-800 truncate">{test}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        {item.accessionNumbers[0] && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            {item.accessionNumbers[0]}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400">
                          {item.invoiceNumber}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={cn(
                          "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold",
                          statusBadgeClass(testStatus)
                        )}
                      >
                        {testStatus === "INCOMPLETE"
                          ? "Incomplete"
                          : testStatus === "COMPLETED"
                            ? "Completed"
                            : "Signed"}
                      </span>
                      {testStatus === "INCOMPLETE" && (
                        <button
                          onClick={() => router.push(`/operations/result-entry/${item.id}`)}
                          className="p-1 rounded hover:bg-blue-50 text-blue-600 transition-colors"
                          title="Enter results"
                        >
                          <FlaskConical size={12} />
                        </button>
                      )}
                      {testStatus === "COMPLETED" && (
                        <button
                          onClick={() => router.push(`/operations/result-entry/${item.id}`)}
                          className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors"
                          title="Review & Sign"
                        >
                          Sign
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-slate-400">
                      {new Date(item.createdAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {item.isTatBreached && testStatus === "INCOMPLETE" && (
                      <span className="flex items-center gap-0.5 text-[10px] text-red-600 font-medium">
                        <AlertTriangle size={9} />
                        TAT Breached
                      </span>
                    )}
                  </div>
                  {/* Expanded parameters */}
                  {item.testDetails?.[idx] && expandedTests.has(item.testDetails[idx].id) && (
                    <div className="ml-5 mt-2 border-l-2 border-slate-200 pl-3 pb-1">
                      {testParamsCache[item.testDetails[idx].id] ? (
                        testParamsCache[item.testDetails[idx].id].length > 0 ? (
                          <table className="w-full text-[10px]">
                            <thead>
                              <tr className="text-slate-400">
                                <th className="text-left py-0.5 font-medium">Parameter</th>
                                <th className="text-left py-0.5 font-medium">Unit</th>
                                <th className="text-left py-0.5 font-medium">Reference Range</th>
                              </tr>
                            </thead>
                            <tbody>
                              {testParamsCache[item.testDetails[idx].id].map((param: any, pi: number) => (
                                <tr key={pi} className="border-t border-slate-50">
                                  <td className="py-1 text-slate-700">{param.name}</td>
                                  <td className="py-1 text-slate-500">{param.unit || "—"}</td>
                                  <td className="py-1 text-slate-500">
                                    {param.referenceRanges?.[0]
                                      ? `${param.referenceRanges[0].lowNormal ?? ""} – ${param.referenceRanges[0].highNormal ?? ""}`
                                      : "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <p className="text-[10px] text-slate-400 py-1">No parameters defined</p>
                        )
                      ) : (
                        <p className="text-[10px] text-slate-400 py-1">Loading parameters...</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {item.tests.length === 0 && (
              <div className="px-4 py-8 text-center">
                <p className="text-xs text-slate-400">No tests found for this order</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div className="p-4 text-center">
            <History size={32} className="mx-auto text-slate-300 mb-2" />
            <p className="text-xs text-slate-400">Historical reports for this patient</p>
            <Link
              href={`/patients/${item.patient.id}?tab=orders`}
              className="inline-flex items-center gap-1 mt-2 text-xs text-blue-600 hover:underline"
            >
              View patient history
              <ChevronRight size={12} />
            </Link>
          </div>
        )}

        {activeTab === "overview" && (
          <div className="p-4 space-y-4">
            <div>
              <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Order Summary
              </h4>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                  <p className="text-lg font-bold text-gray-700">{item.incompleteTests}</p>
                  <p className="text-[10px] text-gray-500">Incomplete</p>
                </div>
                <div className="bg-green-50 rounded-lg p-2.5 text-center">
                  <p className="text-lg font-bold text-green-700">{item.completedTests}</p>
                  <p className="text-[10px] text-green-600">Completed</p>
                </div>
                <div className="bg-teal-50 rounded-lg p-2.5 text-center">
                  <p className="text-lg font-bold text-teal-700">{item.signedTests}</p>
                  <p className="text-[10px] text-teal-600">Signed</p>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                TAT Information
              </h4>
              <div className="bg-slate-50 rounded-lg p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Max TAT</span>
                  <span className="text-xs font-semibold text-slate-700">{item.maxTatHours}h</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Elapsed</span>
                  <span className={cn("text-xs font-semibold", item.isTatBreached ? "text-red-600" : "text-slate-700")}>
                    {formatElapsedTat(item.elapsedHours)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Status</span>
                  {item.isTatBreached ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-red-600">
                      <AlertTriangle size={11} />
                      Breached
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-green-600">On Track</span>
                  )}
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Tests
              </h4>
              <div className="space-y-1">
                {item.tests.map((test, idx) => (
                  <div key={`${test}-${idx}`} className="flex items-center gap-2 py-1">
                    <div
                      className={cn(
                        "w-1.5 h-1.5 rounded-full shrink-0",
                        idx < item.signedTests
                          ? "bg-teal-500"
                          : idx < item.completedTests
                            ? "bg-green-500"
                            : "bg-gray-300"
                      )}
                    />
                    <span className="text-xs text-slate-700 truncate">{test}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "trends" && (
          <div className="p-4 text-center">
            <TrendingUp size={32} className="mx-auto text-slate-300 mb-2" />
            <p className="text-xs text-slate-400">Trend analysis for patient test results</p>
            <Link
              href={`/patients/${item.patient.id}?tab=results`}
              className="inline-flex items-center gap-1 mt-2 text-xs text-blue-600 hover:underline"
            >
              View trends
              <ChevronRight size={12} />
            </Link>
          </div>
        )}
      </div>

      {/* Bottom action */}
      <div className="px-4 py-3 border-t border-slate-100 bg-slate-50">
        <button
          onClick={() => router.push(`/operations/result-entry/${item.id}`)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#1B4F8A] text-white rounded-lg text-xs font-semibold hover:bg-[#163d6e] transition-colors"
        >
          <FlaskConical size={13} />
          Enter Results
        </button>
      </div>
    </div>
  );
}

// ── Date Group Header ────────────────────────────────────────────────────────

function DateGroupHeader({
  dateKey,
  count,
  isExpanded,
  onToggle,
}: {
  dateKey: string;
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <tr className="bg-slate-50 border-b border-slate-200">
      <td colSpan={10} className="px-3 py-1.5">
        <button
          onClick={onToggle}
          className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors"
        >
          {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          <span>{formatDateGroupHeader(dateKey)}</span>
          <span className="text-[10px] font-normal text-slate-400">({count})</span>
        </button>
      </td>
    </tr>
  );
}

// ── Loading Skeleton ─────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="space-y-1 p-2">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-3 py-3 animate-pulse">
          <div className="w-20 h-4 bg-slate-100 rounded" />
          <div className="flex-1 space-y-1.5">
            <div className="w-40 h-3.5 bg-slate-100 rounded" />
            <div className="w-24 h-3 bg-slate-100 rounded" />
          </div>
          <div className="w-16 h-4 bg-slate-100 rounded" />
          <div className="w-20 h-4 bg-slate-100 rounded" />
          <div className="w-12 h-4 bg-slate-100 rounded" />
          <div className="w-12 h-4 bg-slate-100 rounded" />
          <div className="w-12 h-4 bg-slate-100 rounded" />
        </div>
      ))}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function OperationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // State
  const [statusFilter, setStatusFilter] = useState<StatusFilterKey>("all");
  const [department, setDepartment] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [centerTab, setCenterTab] = useState<CenterTab>("patients");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [selectedItem, setSelectedItem] = useState<WaitingListItem | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [deptDropdownOpen, setDeptDropdownOpen] = useState(false);
  const deptDropdownRef = useRef<HTMLDivElement>(null);
  const limit = 50;

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Close dept dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (deptDropdownRef.current && !deptDropdownRef.current.contains(e.target as Node)) {
        setDeptDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ── Queries ──────────────────────────────────────────────────────────────

  const {
    data: waitingListData,
    isLoading: listLoading,
    isError: listError,
    refetch: refetchList,
  } = useQuery({
    queryKey: ["waiting-list", statusFilter, department, debouncedSearch, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (statusFilter !== "all") params.set("statusFilter", statusFilter);
      if (department !== "all") params.set("department", department);
      if (debouncedSearch) params.set("search", debouncedSearch);

      const res = await api.get<{
        success: boolean;
        data: { data: WaitingListItem[]; meta: { total: number; page: number; limit: number } };
      }>(`/lab/operations/waiting-list?${params.toString()}`);
      return res.data.data;
    },
    refetchInterval: 30000,
    staleTime: 10000,
  });

  const { data: statusCounts } = useQuery({
    queryKey: ["status-counts"],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: StatusCounts }>(
        "/lab/operations/status-counts"
      );
      return res.data.data;
    },
    refetchInterval: 30000,
    staleTime: 10000,
  });

  const { data: departments } = useQuery({
    queryKey: ["operations-departments"],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: DepartmentCount[] }>(
        "/lab/operations/departments"
      );
      return res.data.data;
    },
    refetchInterval: 60000,
    staleTime: 30000,
  });

  // ── Derived Data ─────────────────────────────────────────────────────────

  const items = waitingListData?.data ?? [];
  const totalItems = waitingListData?.meta?.total ?? 0;
  const totalPages = Math.ceil(totalItems / limit);

  // Sort: STAT items first, then by createdAt desc
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      if (a.priority === "STAT" && b.priority !== "STAT") return -1;
      if (a.priority !== "STAT" && b.priority === "STAT") return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [items]);

  // Group by date
  const groupedItems = useMemo(() => {
    const groups: { dateKey: string; items: WaitingListItem[] }[] = [];
    const groupMap = new Map<string, WaitingListItem[]>();

    for (const item of sortedItems) {
      const dk = getDateKey(item.createdAt);
      if (!groupMap.has(dk)) {
        groupMap.set(dk, []);
      }
      groupMap.get(dk)!.push(item);
    }

    // Sort date keys descending
    const sortedKeys = Array.from(groupMap.keys()).sort((a, b) => b.localeCompare(a));
    for (const dk of sortedKeys) {
      groups.push({ dateKey: dk, items: groupMap.get(dk)! });
    }

    return groups;
  }, [sortedItems]);

  const toggleGroup = useCallback((dateKey: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(dateKey)) {
        next.delete(dateKey);
      } else {
        next.add(dateKey);
      }
      return next;
    });
  }, []);

  const handleRefresh = useCallback(() => {
    void refetchList();
    void queryClient.invalidateQueries({ queryKey: ["status-counts"] });
    void queryClient.invalidateQueries({ queryKey: ["operations-departments"] });
    toast.success("Refreshed");
  }, [refetchList, queryClient]);

  const handleFilterChange = useCallback((filter: StatusFilterKey) => {
    setStatusFilter(filter);
    setPage(1);
    setSelectedItem(null);
  }, []);

  const todayStr = new Date().toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden animate-fade-in -m-6">
      {/* LEFT SIDEBAR */}
      <LeftSidebar
        counts={statusCounts}
        activeFilter={statusFilter}
        onFilterChange={handleFilterChange}
      />

      {/* CENTER PANEL */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        {/* Top Bar */}
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-2">
            {/* Department Dropdown */}
            <div className="relative" ref={deptDropdownRef}>
              <button
                onClick={() => setDeptDropdownOpen((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-md bg-white hover:bg-slate-50 text-slate-700 transition-colors"
              >
                {department === "all" ? "All Departments" : department}
                <ChevronDown size={12} className="text-slate-400" />
              </button>
              {deptDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-30 py-1">
                  <button
                    onClick={() => { setDepartment("all"); setDeptDropdownOpen(false); setPage(1); }}
                    className={cn(
                      "w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 transition-colors",
                      department === "all" ? "bg-blue-50 text-blue-700 font-semibold" : "text-slate-600"
                    )}
                  >
                    All Departments
                  </button>
                  {(departments ?? []).map((d) => (
                    <button
                      key={d.department}
                      onClick={() => { setDepartment(d.department); setDeptDropdownOpen(false); setPage(1); }}
                      className={cn(
                        "w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 transition-colors flex items-center justify-between",
                        department === d.department ? "bg-blue-50 text-blue-700 font-semibold" : "text-slate-600"
                      )}
                    >
                      <span>{d.department}</span>
                      <span className="text-[10px] text-slate-400">{d.count}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Date */}
            <span className="text-xs text-slate-500 hidden sm:inline">{todayStr}</span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Submit All */}
            <button
              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              onClick={() => toast.info("Submit all will be available soon")}
            >
              <Send size={11} />
              Submit All
            </button>

            {/* Refresh */}
            <button
              onClick={handleRefresh}
              className="p-1.5 border border-slate-200 rounded-md hover:bg-slate-50 text-slate-500 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={13} />
            </button>

            {/* Work List */}
            <button
              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium border border-slate-200 rounded-md bg-white hover:bg-slate-50 text-slate-600 transition-colors"
              onClick={() => toast.info("Work list options coming soon")}
            >
              <ClipboardList size={11} />
              Work List
              <ChevronDown size={10} />
            </button>

            {/* View Toggle */}
            <div className="flex border border-slate-200 rounded-md overflow-hidden">
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "p-1.5 transition-colors",
                  viewMode === "list"
                    ? "bg-[#1B4F8A] text-white"
                    : "bg-white text-slate-400 hover:bg-slate-50"
                )}
                title="List view"
              >
                <List size={13} />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={cn(
                  "p-1.5 transition-colors",
                  viewMode === "grid"
                    ? "bg-[#1B4F8A] text-white"
                    : "bg-white text-slate-400 hover:bg-slate-50"
                )}
                title="Grid view"
              >
                <LayoutGrid size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-4 py-2.5 border-b border-slate-100">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Select by Patient ID / Name / Accession Number / DOB..."
              className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 bg-white transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex items-center justify-between px-4 py-0 border-b border-slate-100">
          <div className="flex">
            {(
              [
                { key: "patients", label: "Patients Waiting List" },
                { key: "testwise", label: "Test-wise Waiting List" },
                { key: "instrumentwise", label: "Instrument-wise Waiting List" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setCenterTab(tab.key)}
                className={cn(
                  "px-4 py-2.5 text-xs font-medium border-b-2 transition-colors",
                  centerTab === tab.key
                    ? "text-blue-600 border-blue-600"
                    : "text-slate-400 border-transparent hover:text-slate-600"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-slate-400">
            Rows: <span className="font-semibold text-slate-600">{totalItems}</span>
          </span>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto">
          {centerTab === "patients" && (
            <>
              {listLoading && <TableSkeleton />}

              {listError && (
                <div className="flex flex-col items-center justify-center py-16">
                  <AlertCircle size={36} className="text-red-400 mb-3" />
                  <p className="text-sm text-slate-600 font-medium">Failed to load waiting list</p>
                  <p className="text-xs text-slate-400 mt-1">Check your connection and try again</p>
                  <button
                    onClick={() => void refetchList()}
                    className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-[#1B4F8A] text-white rounded-md text-xs font-medium hover:bg-[#163d6e] transition-colors"
                  >
                    <RefreshCw size={12} />
                    Retry
                  </button>
                </div>
              )}

              {!listLoading && !listError && sortedItems.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16">
                  <ClipboardList size={36} className="text-slate-300 mb-3" />
                  <p className="text-sm text-slate-600 font-medium">No patients in the waiting list</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {debouncedSearch
                      ? "Try adjusting your search criteria"
                      : "New orders will appear here automatically"}
                  </p>
                </div>
              )}

              {!listLoading && !listError && sortedItems.length > 0 && (
                <>
                  <table className="w-full text-left">
                    <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider w-[110px]">
                          Patient ID
                        </th>
                        <th className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider min-w-[180px]">
                          Patient Details
                        </th>
                        <th className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider w-[100px]">
                          Bill ID
                        </th>
                        <th className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider w-[110px]">
                          Accession No.
                        </th>
                        <th className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider w-[90px]">
                          Referral
                        </th>
                        <th className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider w-[90px]">
                          Organisation
                        </th>
                        <th className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center w-[75px]">
                          <span className="text-gray-500">Incomplete</span>
                          <span className="block text-[9px] text-gray-400 font-normal">
                            ({statusCounts?.incomplete ?? 0})
                          </span>
                        </th>
                        <th className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center w-[75px]">
                          <span className="text-green-600">Completed</span>
                          <span className="block text-[9px] text-green-500 font-normal">
                            ({statusCounts?.completed ?? 0})
                          </span>
                        </th>
                        <th className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center w-[60px]">
                          <span className="text-teal-600">Signed</span>
                          <span className="block text-[9px] text-teal-500 font-normal">
                            ({statusCounts?.signed ?? 0})
                          </span>
                        </th>
                        <th className="px-2 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center w-[40px]">
                          TAT
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedItems.map((group) => {
                        const isCollapsed = collapsedGroups.has(group.dateKey);
                        return (
                          <Fragment key={group.dateKey}>
                            <DateGroupHeader
                              dateKey={group.dateKey}
                              count={group.items.length}
                              isExpanded={!isCollapsed}
                              onToggle={() => toggleGroup(group.dateKey)}
                            />
                            {!isCollapsed &&
                              group.items.map((item) => (
                                <PatientRow
                                  key={item.id}
                                  item={item}
                                  isSelected={selectedItem?.id === item.id}
                                  onSelect={() =>
                                    setSelectedItem(
                                      selectedItem?.id === item.id ? null : item
                                    )
                                  }
                                />
                              ))}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 bg-slate-50/50">
                      <span className="text-xs text-slate-400">
                        Showing {(page - 1) * limit + 1}–{Math.min(page * limit, totalItems)} of {totalItems}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          disabled={page <= 1}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          className="px-2.5 py-1 text-xs font-medium border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 transition-colors"
                        >
                          Prev
                        </button>
                        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                          let pageNum: number;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (page <= 3) {
                            pageNum = i + 1;
                          } else if (page >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = page - 2 + i;
                          }
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setPage(pageNum)}
                              className={cn(
                                "w-7 h-7 flex items-center justify-center text-xs font-medium rounded-md transition-colors",
                                page === pageNum
                                  ? "bg-[#1B4F8A] text-white"
                                  : "text-slate-500 hover:bg-slate-100"
                              )}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                        <button
                          disabled={page >= totalPages}
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          className="px-2.5 py-1 text-xs font-medium border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 transition-colors"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {centerTab === "testwise" && (
            <div className="flex flex-col items-center justify-center py-16">
              <FlaskConical size={36} className="text-slate-300 mb-3" />
              <p className="text-sm text-slate-600 font-medium">Test-wise Waiting List</p>
              <p className="text-xs text-slate-400 mt-1">
                View tests grouped by test type across all patients
              </p>

              {!listLoading && sortedItems.length > 0 && (
                <div className="mt-6 w-full max-w-2xl px-6">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase">Test Name</th>
                        <th className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase text-center">Count</th>
                        <th className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase text-center">Incomplete</th>
                        <th className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase text-center">Completed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const testMap = new Map<string, { total: number; incomplete: number; completed: number }>();
                        for (const item of sortedItems) {
                          for (let ti = 0; ti < item.tests.length; ti++) {
                            const testName = item.tests[ti];
                            const existing = testMap.get(testName) ?? { total: 0, incomplete: 0, completed: 0 };
                            existing.total++;
                            if (ti < item.completedTests) {
                              existing.completed++;
                            } else {
                              existing.incomplete++;
                            }
                            testMap.set(testName, existing);
                          }
                        }
                        return Array.from(testMap.entries())
                          .sort((a, b) => b[1].total - a[1].total)
                          .slice(0, 20)
                          .map(([name, data]) => (
                            <tr key={name} className="border-b border-slate-100 text-xs hover:bg-slate-50">
                              <td className="px-3 py-2 text-slate-700 font-medium">{name}</td>
                              <td className="px-3 py-2 text-center text-slate-600">{data.total}</td>
                              <td className="px-3 py-2 text-center">
                                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-gray-100 text-gray-700 font-semibold text-[10px]">
                                  {data.incomplete}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-green-100 text-green-700 font-semibold text-[10px]">
                                  {data.completed}
                                </span>
                              </td>
                            </tr>
                          ));
                      })()}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {centerTab === "instrumentwise" && (
            <div className="flex flex-col items-center justify-center py-16">
              <Settings size={36} className="text-slate-300 mb-3" />
              <p className="text-sm text-slate-600 font-medium">Instrument-wise Waiting List</p>
              <p className="text-xs text-slate-400 mt-1">
                View tests grouped by instrument/analyser
              </p>
              <Link
                href="/instruments"
                className="inline-flex items-center gap-1 mt-3 text-xs text-blue-600 hover:underline"
              >
                Go to Instruments
                <ChevronRight size={12} />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL */}
      {selectedItem && (
        <RightPanel
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}
