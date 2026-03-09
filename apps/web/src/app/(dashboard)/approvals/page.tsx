"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Eye,
  Check,
  X,
  Loader2,
  ClipboardCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { cn, truncate } from "@/lib/utils";
import api from "@/lib/api";

// ── Types ────────────────────────────────────────────────────────────────────

interface ApprovalStats {
  totalPending: number;
  criticalReports: number;
  approvedToday: number;
  rejectedToday: number;
}

interface ApprovalTestResult {
  id: string;
  testName: string;
  parameter: string;
  value: string;
  numericValue: number | null;
  unit: string;
  referenceRange: string;
  interpretation: string; // NORMAL | ABNORMAL | CRITICAL
  isDelta: boolean;
  previousValue: string | null;
}

interface ApprovalPatient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  age: number | null;
  gender: string;
}

interface ApprovalSubmittedBy {
  id: string;
  firstName: string;
  lastName: string;
}

interface ApprovalDoctor {
  firstName: string;
  lastName: string;
}

interface ApprovalItem {
  id: string;
  orderNumber: string;
  patient: ApprovalPatient;
  tests: string[];
  submittedBy: ApprovalSubmittedBy;
  submittedAt: string;
  priority: string; // ROUTINE | URGENT | STAT
  flagSummary?: {
    total: number;
    normal: number;
    abnormal: number;
    critical: number;
  } | null;
  results: ApprovalTestResult[];
  referringDoctor: ApprovalDoctor | null;
  interpretation: string;
  tenantName: string;
  branchName: string;
}

interface ApprovalsResponse {
  data: ApprovalItem[];
  meta: { total: number; page: number; limit: number };
}

// ── Filter tabs ──────────────────────────────────────────────────────────────

const FILTER_TABS = [
  { key: "ALL", label: "All" },
  { key: "NORMAL", label: "Normal" },
  { key: "ABNORMAL", label: "Abnormal" },
  { key: "CRITICAL", label: "Critical" },
  { key: "STAT", label: "STAT" },
] as const;

type FilterKey = (typeof FILTER_TABS)[number]["key"];

// ── Mock data ────────────────────────────────────────────────────────────────

function buildMockStats(): ApprovalStats {
  return {
    totalPending: 18,
    criticalReports: 3,
    approvedToday: 42,
    rejectedToday: 4,
  };
}

function buildMockApprovals(): ApprovalItem[] {
  const items: ApprovalItem[] = [
    {
      id: "appr-1",
      orderNumber: "DH-ORD-20260304-0012",
      patient: { id: "p1", mrn: "DH-2026-000142", firstName: "Rajesh", lastName: "Kumar", age: 54, gender: "Male" },
      tests: ["Complete Blood Count", "ESR", "Peripheral Smear"],
      submittedBy: { id: "u1", firstName: "Priya", lastName: "Sharma" },
      submittedAt: new Date(Date.now() - 2 * 60 * 60 * 1000 - 15 * 60 * 1000).toISOString(),
      priority: "ROUTINE",
      flagSummary: { total: 14, normal: 12, abnormal: 2, critical: 0 },
      results: [
        { id: "r1", testName: "CBC", parameter: "Haemoglobin", value: "11.2", numericValue: 11.2, unit: "g/dL", referenceRange: "13.0-17.0", interpretation: "ABNORMAL", isDelta: false, previousValue: null },
        { id: "r2", testName: "CBC", parameter: "WBC Count", value: "7,400", numericValue: 7400, unit: "/cumm", referenceRange: "4,000-11,000", interpretation: "NORMAL", isDelta: false, previousValue: null },
        { id: "r3", testName: "CBC", parameter: "Platelet Count", value: "1,20,000", numericValue: 120000, unit: "/cumm", referenceRange: "1,50,000-4,00,000", interpretation: "ABNORMAL", isDelta: true, previousValue: "1,80,000" },
        { id: "r4", testName: "CBC", parameter: "RBC Count", value: "4.8", numericValue: 4.8, unit: "M/uL", referenceRange: "4.5-5.5", interpretation: "NORMAL", isDelta: false, previousValue: null },
        { id: "r5", testName: "ESR", parameter: "ESR (1 Hour)", value: "12", numericValue: 12, unit: "mm/hr", referenceRange: "0-15", interpretation: "NORMAL", isDelta: false, previousValue: null },
      ],
      referringDoctor: { firstName: "Dr. Anil", lastName: "Mehta" },
      interpretation: "Mild anaemia noted with low haemoglobin. Platelet count on lower side, declining trend from previous value. Recommend follow-up in 2 weeks.",
      tenantName: "DELViON Diagnostics",
      branchName: "Main Branch - Bengaluru",
    },
    {
      id: "appr-2",
      orderNumber: "DH-ORD-20260304-0018",
      patient: { id: "p2", mrn: "DH-2026-000198", firstName: "Sunita", lastName: "Devi", age: 67, gender: "Female" },
      tests: ["Liver Function Test", "Kidney Function Test"],
      submittedBy: { id: "u2", firstName: "Amit", lastName: "Verma" },
      submittedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      priority: "URGENT",
      flagSummary: { total: 10, normal: 4, abnormal: 4, critical: 2 },
      results: [
        { id: "r6", testName: "LFT", parameter: "Bilirubin (Total)", value: "4.8", numericValue: 4.8, unit: "mg/dL", referenceRange: "0.2-1.2", interpretation: "CRITICAL", isDelta: true, previousValue: "2.1" },
        { id: "r7", testName: "LFT", parameter: "SGOT (AST)", value: "186", numericValue: 186, unit: "U/L", referenceRange: "8-40", interpretation: "CRITICAL", isDelta: false, previousValue: null },
        { id: "r8", testName: "LFT", parameter: "SGPT (ALT)", value: "142", numericValue: 142, unit: "U/L", referenceRange: "7-56", interpretation: "ABNORMAL", isDelta: false, previousValue: null },
        { id: "r9", testName: "KFT", parameter: "Creatinine", value: "1.8", numericValue: 1.8, unit: "mg/dL", referenceRange: "0.6-1.2", interpretation: "ABNORMAL", isDelta: true, previousValue: "1.4" },
        { id: "r10", testName: "KFT", parameter: "BUN", value: "32", numericValue: 32, unit: "mg/dL", referenceRange: "7-20", interpretation: "ABNORMAL", isDelta: false, previousValue: null },
      ],
      referringDoctor: { firstName: "Dr. Sanjay", lastName: "Gupta" },
      interpretation: "Significantly elevated liver enzymes with rising bilirubin indicating hepatic dysfunction. Renal markers also elevated. Urgent clinical correlation advised.",
      tenantName: "DELViON Diagnostics",
      branchName: "Main Branch - Bengaluru",
    },
    {
      id: "appr-3",
      orderNumber: "DH-ORD-20260304-0024",
      patient: { id: "p3", mrn: "DH-2026-000301", firstName: "Anand", lastName: "Iyer", age: 38, gender: "Male" },
      tests: ["Lipid Profile"],
      submittedBy: { id: "u1", firstName: "Priya", lastName: "Sharma" },
      submittedAt: new Date(Date.now() - 4 * 60 * 60 * 1000 - 30 * 60 * 1000).toISOString(),
      priority: "ROUTINE",
      flagSummary: { total: 5, normal: 5, abnormal: 0, critical: 0 },
      results: [
        { id: "r11", testName: "Lipid Profile", parameter: "Total Cholesterol", value: "182", numericValue: 182, unit: "mg/dL", referenceRange: "<200", interpretation: "NORMAL", isDelta: false, previousValue: null },
        { id: "r12", testName: "Lipid Profile", parameter: "HDL Cholesterol", value: "52", numericValue: 52, unit: "mg/dL", referenceRange: ">40", interpretation: "NORMAL", isDelta: false, previousValue: null },
        { id: "r13", testName: "Lipid Profile", parameter: "LDL Cholesterol", value: "108", numericValue: 108, unit: "mg/dL", referenceRange: "<130", interpretation: "NORMAL", isDelta: false, previousValue: null },
        { id: "r14", testName: "Lipid Profile", parameter: "Triglycerides", value: "128", numericValue: 128, unit: "mg/dL", referenceRange: "<150", interpretation: "NORMAL", isDelta: false, previousValue: null },
      ],
      referringDoctor: null,
      interpretation: "All lipid parameters within normal limits. No action required.",
      tenantName: "DELViON Diagnostics",
      branchName: "Main Branch - Bengaluru",
    },
    {
      id: "appr-4",
      orderNumber: "DH-ORD-20260304-0031",
      patient: { id: "p4", mrn: "DH-2026-000089", firstName: "Meena", lastName: "Rao", age: 72, gender: "Female" },
      tests: ["Thyroid Function Test", "HbA1c"],
      submittedBy: { id: "u2", firstName: "Amit", lastName: "Verma" },
      submittedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      priority: "STAT",
      flagSummary: { total: 4, normal: 2, abnormal: 2, critical: 0 },
      results: [
        { id: "r15", testName: "TFT", parameter: "TSH", value: "8.4", numericValue: 8.4, unit: "mIU/L", referenceRange: "0.4-4.0", interpretation: "ABNORMAL", isDelta: true, previousValue: "6.2" },
        { id: "r16", testName: "TFT", parameter: "Free T4", value: "0.7", numericValue: 0.7, unit: "ng/dL", referenceRange: "0.8-1.8", interpretation: "ABNORMAL", isDelta: false, previousValue: null },
        { id: "r17", testName: "HbA1c", parameter: "HbA1c", value: "5.4", numericValue: 5.4, unit: "%", referenceRange: "<5.7", interpretation: "NORMAL", isDelta: false, previousValue: null },
      ],
      referringDoctor: { firstName: "Dr. Kavita", lastName: "Desai" },
      interpretation: "Subclinical hypothyroidism with rising TSH and borderline low Free T4. HbA1c within normal limits. Recommend thyroid medication review.",
      tenantName: "DELViON Diagnostics",
      branchName: "Main Branch - Bengaluru",
    },
    {
      id: "appr-5",
      orderNumber: "DH-ORD-20260304-0037",
      patient: { id: "p5", mrn: "DH-2026-000415", firstName: "Vikram", lastName: "Singh", age: 45, gender: "Male" },
      tests: ["Electrolytes", "Blood Glucose (Fasting)"],
      submittedBy: { id: "u1", firstName: "Priya", lastName: "Sharma" },
      submittedAt: new Date(Date.now() - 1 * 60 * 60 * 1000 - 40 * 60 * 1000).toISOString(),
      priority: "ROUTINE",
      flagSummary: { total: 5, normal: 4, abnormal: 1, critical: 0 },
      results: [
        { id: "r18", testName: "Electrolytes", parameter: "Sodium", value: "140", numericValue: 140, unit: "mEq/L", referenceRange: "136-145", interpretation: "NORMAL", isDelta: false, previousValue: null },
        { id: "r19", testName: "Electrolytes", parameter: "Potassium", value: "4.2", numericValue: 4.2, unit: "mEq/L", referenceRange: "3.5-5.0", interpretation: "NORMAL", isDelta: false, previousValue: null },
        { id: "r20", testName: "Blood Glucose", parameter: "Fasting Blood Sugar", value: "118", numericValue: 118, unit: "mg/dL", referenceRange: "70-100", interpretation: "ABNORMAL", isDelta: false, previousValue: null },
      ],
      referringDoctor: { firstName: "Dr. Anil", lastName: "Mehta" },
      interpretation: "Electrolytes within normal range. Fasting blood sugar mildly elevated indicating pre-diabetic state. Recommend glucose tolerance test.",
      tenantName: "DELViON Diagnostics",
      branchName: "Main Branch - Bengaluru",
    },
  ];
  return items;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatWaitingTime(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  const date = new Date(isoDate);
  if (isNaN(date.getTime())) return "—";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return "just now";
  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (totalMinutes < 1) return "just now";
  if (hours === 0) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ${minutes}m ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function hasCriticalFlag(item: ApprovalItem): boolean {
  return (item.flagSummary?.critical ?? 0) > 0;
}

// ── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  iconBg,
  iconText,
  urgent,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  iconBg: string;
  iconText: string;
  urgent?: boolean;
}) {
  return (
    <div className={cn("bg-white rounded-xl p-5 shadow-sm border border-slate-100", urgent && "ring-2 ring-red-200")}>
      <div className="flex items-start justify-between mb-3">
        <div className={cn("p-2.5 rounded-lg", iconBg)}>
          <Icon className={cn("w-5 h-5", iconText)} size={20} />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-sm text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function ApprovalsPage() {
  const queryClient = useQueryClient();

  const [activeFilter, setActiveFilter] = useState<FilterKey>("ALL");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewItem, setPreviewItem] = useState<ApprovalItem | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ApprovalItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // ── Fetch stats ──────────────────────────────────────────────────────────

  const { data: stats, isLoading: statsLoading } = useQuery<ApprovalStats>({
    queryKey: ["approval-stats"],
    queryFn: () =>
      api
        .get("/lab/approvals/stats")
        .then((r) => (r.data?.data ?? r.data))
        .catch(() => buildMockStats()),
    refetchInterval: 30000,
  });

  const statData = stats ?? buildMockStats();

  // ── Fetch approvals list ─────────────────────────────────────────────────

  const { data: approvalsData, isLoading: listLoading } = useQuery<ApprovalsResponse>({
    queryKey: ["approvals-list", activeFilter, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (activeFilter !== "ALL") params.set("filter", activeFilter);
      return api
        .get(`/lab/approvals?${params.toString()}`)
        .then((r) => (r.data?.data ?? r.data) as ApprovalsResponse)
        .catch(() => ({
          data: buildMockApprovals(),
          meta: { total: 5, page: 1, limit: 20 },
        }));
    },
    refetchInterval: 30000,
  });

  const items = approvalsData?.data ?? buildMockApprovals();

  // ── Filter + sort (critical on top) ──────────────────────────────────────

  const filteredItems = useMemo(() => {
    let filtered = [...items];
    if (activeFilter === "NORMAL") {
      filtered = filtered.filter((i) => (i.flagSummary?.abnormal ?? 0) === 0 && (i.flagSummary?.critical ?? 0) === 0);
    } else if (activeFilter === "ABNORMAL") {
      filtered = filtered.filter((i) => (i.flagSummary?.abnormal ?? 0) > 0 && (i.flagSummary?.critical ?? 0) === 0);
    } else if (activeFilter === "CRITICAL") {
      filtered = filtered.filter((i) => (i.flagSummary?.critical ?? 0) > 0);
    } else if (activeFilter === "STAT") {
      filtered = filtered.filter((i) => i.priority === "STAT");
    }
    // Sort critical to top
    filtered.sort((a, b) => {
      const aCrit = (a.flagSummary?.critical ?? 0) > 0 ? 1 : 0;
      const bCrit = (b.flagSummary?.critical ?? 0) > 0 ? 1 : 0;
      return bCrit - aCrit;
    });
    return filtered;
  }, [items, activeFilter]);

  // ── Selection ────────────────────────────────────────────────────────────

  const allSelected = filteredItems.length > 0 && filteredItems.every((i) => selectedIds.has(i.id));

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map((i) => i.id)));
    }
  }, [allSelected, filteredItems]);

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // ── Approve mutation ─────────────────────────────────────────────────────

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/lab/approvals/${id}/approve`);
    },
    onSuccess: () => {
      toast.success("Report approved and dispatched");
      setPreviewItem(null);
      void queryClient.invalidateQueries({ queryKey: ["approvals-list"] });
      void queryClient.invalidateQueries({ queryKey: ["approval-stats"] });
    },
    onError: () => {
      toast.error("Failed to approve report");
    },
  });

  // ── Reject mutation ──────────────────────────────────────────────────────

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      await api.post(`/lab/approvals/${id}/reject`, { reason });
    },
    onSuccess: () => {
      toast.success("Report rejected. Returned for correction.");
      setRejectTarget(null);
      setRejectReason("");
      setPreviewItem(null);
      void queryClient.invalidateQueries({ queryKey: ["approvals-list"] });
      void queryClient.invalidateQueries({ queryKey: ["approval-stats"] });
    },
    onError: () => {
      toast.error("Failed to reject report");
    },
  });

  // ── Bulk approve mutation ────────────────────────────────────────────────

  const bulkApproveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await api.post("/lab/approvals/bulk-approve", { ids });
    },
    onSuccess: () => {
      toast.success(`${selectedIds.size} reports approved`);
      setSelectedIds(new Set());
      void queryClient.invalidateQueries({ queryKey: ["approvals-list"] });
      void queryClient.invalidateQueries({ queryKey: ["approval-stats"] });
    },
    onError: () => {
      toast.error("Bulk approval failed");
    },
  });

  const handleBulkApprove = () => {
    // Check if any selected item has CRITICAL flag
    const selectedItems = filteredItems.filter((i) => selectedIds.has(i.id));
    const criticalCount = selectedItems.filter(hasCriticalFlag).length;
    if (criticalCount > 0) {
      toast.error(
        `Cannot bulk approve: ${criticalCount} selected report${criticalCount > 1 ? "s" : ""} contain CRITICAL values. Review and approve them individually.`
      );
      return;
    }
    bulkApproveMutation.mutate(Array.from(selectedIds));
  };

  // ── Preview modal fetch ──────────────────────────────────────────────────

  const handleViewPreview = (item: ApprovalItem) => {
    // Use data already in the item (or fetch from preview endpoint)
    setPreviewItem(item);
  };

  // ── Flag column renderer ─────────────────────────────────────────────────

  const renderFlags = (item: ApprovalItem) => {
    if ((item.flagSummary?.critical ?? 0) > 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
          <ShieldAlert size={12} /> CRITICAL
        </span>
      );
    }
    if ((item.flagSummary?.abnormal ?? 0) > 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
          <AlertTriangle size={12} /> {item.flagSummary?.abnormal ?? 0} Abnormal
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
        <CheckCircle2 size={12} /> All Normal
      </span>
    );
  };

  return (
    <div className="space-y-5">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-slate-900">Pending Approvals</h1>
          <span className="inline-flex items-center justify-center min-w-[1.75rem] h-7 px-2 rounded-full text-sm font-bold bg-red-600 text-white">
            {statData.totalPending}
          </span>
        </div>
      </div>

      {/* ── Stats bar ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Pending"
          value={statData.totalPending}
          icon={ClipboardCheck}
          iconBg="bg-blue-100"
          iconText="text-blue-600"
        />
        <StatCard
          label="Critical Reports"
          value={statData.criticalReports}
          icon={ShieldAlert}
          iconBg="bg-red-100"
          iconText="text-red-600"
          urgent
        />
        <StatCard
          label="Approved Today"
          value={statData.approvedToday}
          icon={CheckCircle2}
          iconBg="bg-green-100"
          iconText="text-green-600"
        />
        <StatCard
          label="Rejected Today"
          value={statData.rejectedToday}
          icon={XCircle}
          iconBg="bg-orange-100"
          iconText="text-orange-600"
        />
      </div>

      {/* ── Filter tabs ─────────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveFilter(tab.key);
              setPage(1);
              setSelectedIds(new Set());
            }}
            className={cn(
              "px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
              activeFilter === tab.key
                ? "bg-white text-[#1B4F8A] shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Bulk actions bar ────────────────────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <span className="text-sm font-semibold text-blue-800">
            {selectedIds.size} selected
          </span>
          <button
            onClick={handleBulkApprove}
            disabled={bulkApproveMutation.isPending}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
          >
            {bulkApproveMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Check size={14} />
            )}
            Approve All Selected
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-sm text-slate-500 hover:text-slate-700 ml-auto"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {listLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 size={24} className="animate-spin text-[#1B4F8A]" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <ClipboardCheck size={32} className="mb-2" />
            <p className="text-sm">No pending approvals</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-4 py-3 text-left w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="w-4 h-4 rounded border-slate-300 text-[#1B4F8A] focus:ring-[#1B4F8A]"
                    />
                  </th>
                  {["Order #", "Patient", "Tests", "Submitted By", "Time Waiting", "Flags", "Actions"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredItems.map((item) => {
                  const isCritical = hasCriticalFlag(item);
                  return (
                    <tr
                      key={item.id}
                      className={cn(
                        "hover:bg-slate-50/50 transition-colors",
                        isCritical && "bg-red-50/60"
                      )}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleOne(item.id)}
                          className="w-4 h-4 rounded border-slate-300 text-[#1B4F8A] focus:ring-[#1B4F8A]"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-semibold text-[#1B4F8A]">
                          {item.orderNumber}
                        </span>
                        {item.priority === "STAT" && (
                          <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-500 text-white">
                            STAT
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800 text-sm">
                          {item.patient?.firstName ?? "—"} {item.patient?.lastName ?? ""}
                        </p>
                        <p className="text-xs text-slate-400">
                          {item.patient?.age ?? "—"}y / {item.patient?.gender ?? "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-slate-600" title={(item.tests ?? []).join(", ")}>
                          {truncate((item.tests ?? []).join(", "), 35) || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-700">
                          {item.submittedBy?.firstName ?? "—"} {item.submittedBy?.lastName ?? ""}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-slate-500 whitespace-nowrap">
                          {formatWaitingTime(item.submittedAt)}
                        </span>
                      </td>
                      <td className="px-4 py-3">{renderFlags(item)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleViewPreview(item)}
                            title="View Report"
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-[#1B4F8A] transition-colors"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() => approveMutation.mutate(item.id)}
                            disabled={approveMutation.isPending}
                            title="Approve"
                            className="p-1.5 hover:bg-green-50 rounded-lg text-slate-500 hover:text-green-600 transition-colors"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={() => {
                              setRejectTarget(item);
                              setRejectReason("");
                            }}
                            title="Reject"
                            className="p-1.5 hover:bg-red-50 rounded-lg text-slate-500 hover:text-red-600 transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Preview Modal (Full Screen) ─────────────────────────────────────── */}
      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[92vh] flex flex-col animate-fade-in">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
              <div>
                <h3 className="font-semibold text-slate-900">Report Preview</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {previewItem.tenantName} &mdash; {previewItem.branchName}
                </p>
              </div>
              <button
                onClick={() => setPreviewItem(null)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal body (scrollable) */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {/* Patient Info */}
              <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Patient Name</p>
                  <p className="font-semibold text-slate-800">
                    {previewItem.patient?.firstName ?? "—"} {previewItem.patient?.lastName ?? ""}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Age / Gender</p>
                  <p className="font-medium text-slate-700">
                    {previewItem.patient?.age ?? "—"} yrs / {previewItem.patient?.gender ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">MRN</p>
                  <p className="font-mono text-xs font-semibold text-slate-700">{previewItem.patient?.mrn ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Order #</p>
                  <p className="font-mono text-xs font-semibold text-[#1B4F8A]">{previewItem.orderNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Referring Doctor</p>
                  <p className="font-medium text-slate-700">
                    {previewItem.referringDoctor
                      ? `${previewItem.referringDoctor.firstName} ${previewItem.referringDoctor.lastName}`
                      : "Self / Walk-in"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Priority</p>
                  <p className={cn(
                    "font-semibold text-xs",
                    previewItem.priority === "STAT" ? "text-orange-600" : previewItem.priority === "URGENT" ? "text-red-600" : "text-slate-600"
                  )}>
                    {previewItem.priority}
                  </p>
                </div>
              </div>

              {/* Results Table */}
              <div>
                <h4 className="font-semibold text-slate-800 mb-3">Test Results</h4>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {["Test / Parameter", "Value", "Unit", "Reference Range", "Flag"].map((h) => (
                          <th
                            key={h}
                            className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(previewItem.results ?? []).length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-slate-400 text-sm">
                            No results entered yet
                          </td>
                        </tr>
                      ) : (
                        (previewItem.results ?? []).map((r) => {
                          const isCrit = r.interpretation === "CRITICAL";
                          const isAbn = r.interpretation === "ABNORMAL";
                          return (
                            <tr
                              key={r.id}
                              className={cn(
                                "transition-colors",
                                isCrit && "bg-red-50",
                                isAbn && !isCrit && "bg-orange-50/50"
                              )}
                            >
                              <td className="px-4 py-2.5">
                                <p className="text-xs text-slate-400">{r.testName}</p>
                                <p className="font-medium text-slate-800">{r.parameter}</p>
                              </td>
                              <td className={cn(
                                "px-4 py-2.5 font-bold",
                                isCrit ? "text-red-700" : isAbn ? "text-orange-700" : "text-slate-800"
                              )}>
                                {r.value}
                                {r.isDelta && r.previousValue && (
                                  <span className="block text-[10px] font-normal text-slate-400 mt-0.5">
                                    prev: {r.previousValue}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-slate-500">{r.unit}</td>
                              <td className="px-4 py-2.5 text-slate-500">{r.referenceRange}</td>
                              <td className="px-4 py-2.5">
                                {isCrit && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                                    <ShieldAlert size={10} /> CRITICAL
                                  </span>
                                )}
                                {isAbn && !isCrit && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                                    <AlertTriangle size={10} /> ABNORMAL
                                  </span>
                                )}
                                {r.interpretation === "NORMAL" && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                    Normal
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Interpretation */}
              {previewItem.interpretation && (
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                  <h4 className="font-semibold text-blue-900 text-sm mb-1.5">Interpretation</h4>
                  <p className="text-sm text-blue-800 leading-relaxed">{previewItem.interpretation}</p>
                </div>
              )}
            </div>

            {/* Modal footer actions */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 flex-shrink-0 bg-slate-50/50">
              <button
                onClick={() => {
                  setRejectTarget(previewItem);
                  setRejectReason("");
                }}
                className="inline-flex items-center gap-1.5 px-5 py-2 border border-red-200 text-red-700 hover:bg-red-50 rounded-lg text-sm font-semibold transition-colors"
              >
                <X size={14} /> Reject with Comment
              </button>
              <button
                onClick={() => approveMutation.mutate(previewItem.id)}
                disabled={approveMutation.isPending}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-60"
              >
                {approveMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Check size={14} />
                )}
                Approve &amp; Dispatch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject Modal ────────────────────────────────────────────────────── */}
      {rejectTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Reject Report</h3>
              <button
                onClick={() => {
                  setRejectTarget(null);
                  setRejectReason("");
                }}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"
              >
                <X size={16} />
              </button>
            </div>

            <div className="bg-slate-50 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Order #</span>
                <span className="font-mono font-medium text-xs">{rejectTarget.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Patient</span>
                <span className="font-medium">
                  {rejectTarget.patient?.firstName ?? "—"} {rejectTarget.patient?.lastName ?? ""}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                placeholder="Describe why this report is being rejected..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30 focus:border-[#1B4F8A] resize-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setRejectTarget(null);
                  setRejectReason("");
                }}
                className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!rejectReason.trim()) {
                    toast.error("Please provide a rejection reason");
                    return;
                  }
                  rejectMutation.mutate({ id: rejectTarget.id, reason: rejectReason.trim() });
                }}
                disabled={rejectMutation.isPending || !rejectReason.trim()}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {rejectMutation.isPending && <Loader2 size={13} className="animate-spin" />}
                <X size={13} />
                Reject Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
