"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Loader2,
  Plus,
  ChevronDown,
  ChevronUp,
  Phone,
  SkipForward,
  CheckCircle2,
  Clock,
  Users,
  Monitor,
  Maximize2,
  AlertCircle,
  X,
  Star,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Hash,
  FileText,
} from "lucide-react";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ── Types ────────────────────────────────────────────────────────────────────

type TokenStatus = "WAITING" | "CALLED" | "IN_PROGRESS" | "DONE" | "COMPLETED" | "SKIPPED";

interface QueueToken {
  id: string;
  tokenNumber: number;
  tokenDisplay: string;
  patientName: string;
  type: string;
  status: TokenStatus;
  createdAt: string;
  calledAt: string | null;
  completedAt: string | null;
  waitMinutes: number | null;
  departmentCode?: string;
  departmentName?: string;
  investigationType?: string;
}

interface QueueDisplayData {
  currentToken: QueueToken | null;
  nextTokens: QueueToken[];
  estimatedWait: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getWaitMinutes(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
}

function getWaitColor(minutes: number): string {
  if (minutes < 10) return "text-green-600";
  if (minutes <= 20) return "text-amber-600";
  return "text-red-600";
}

function getWaitBg(minutes: number): string {
  if (minutes < 10) return "bg-green-50 border-green-200";
  if (minutes <= 20) return "bg-amber-50 border-amber-200";
  return "bg-red-50 border-red-200";
}

function typeBadge(type: string) {
  const map: Record<string, { bg: string; label: string }> = {
    REGULAR: { bg: "bg-slate-100 text-slate-700", label: "Regular" },
    WALKIN: { bg: "bg-blue-100 text-blue-700", label: "Walk-in" },
    WALK_IN: { bg: "bg-blue-100 text-blue-700", label: "Walk-in" },
    PRIORITY: { bg: "bg-red-100 text-red-700", label: "Priority" },
    HOME: { bg: "bg-green-100 text-green-700", label: "Home" },
    CORPORATE: { bg: "bg-purple-100 text-purple-700", label: "Corp" },
    APPOINTMENT: { bg: "bg-purple-100 text-purple-700", label: "Appt" },
  };
  const m = map[type] ?? map.REGULAR;
  return (
    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", m.bg)}>
      {m.label}
    </span>
  );
}

function statusBadge(status: TokenStatus) {
  const map: Record<TokenStatus, { bg: string; label: string }> = {
    WAITING: { bg: "bg-amber-100 text-amber-700", label: "Waiting" },
    CALLED: { bg: "bg-blue-100 text-blue-700", label: "Called" },
    IN_PROGRESS: { bg: "bg-indigo-100 text-indigo-700", label: "In Progress" },
    DONE: { bg: "bg-green-100 text-green-700", label: "Done" },
    COMPLETED: { bg: "bg-green-100 text-green-700", label: "Completed" },
    SKIPPED: { bg: "bg-slate-100 text-slate-500", label: "Skipped" },
  };
  const m = map[status] ?? map.WAITING;
  return (
    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", m.bg)}>
      {m.label}
    </span>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function QueuePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split("T")[0];

  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [deptFilter, setDeptFilter] = useState<string>("ALL");
  const [issueForm, setIssueForm] = useState({ patientName: "", type: "WALKIN" as string });

  // ── Queries ──────────────────────────────────────────────────────────────

  const {
    data: tokens,
    isLoading,
    isError,
    error,
  } = useQuery<QueueToken[]>({
    queryKey: ["queue-tokens", today],
    queryFn: async () => {
      const res = await api.get(`/front-desk/queue?date=${today}`);
      return res.data?.data ?? res.data;
    },
    refetchInterval: 15000,
  });

  const { data: displayData } = useQuery<QueueDisplayData>({
    queryKey: ["queue-display", today],
    queryFn: async () => {
      const res = await api.get("/front-desk/queue/display");
      return res.data?.data ?? res.data;
    },
    refetchInterval: 15000,
  });

  // ── Mutations ────────────────────────────────────────────────────────────

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["queue-tokens"] });
    queryClient.invalidateQueries({ queryKey: ["queue-display"] });
  }, [queryClient]);

  const callNextMutation = useMutation({
    mutationFn: async () => {
      const res = await api.get("/front-desk/queue/next");
      return res.data?.data ?? res.data;
    },
    onSuccess: (data) => {
      toast.success(`Token ${data?.tokenDisplay ?? ""} called`);
      invalidate();
    },
    onError: () => toast.error("No tokens to call"),
  });

  const callTokenMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.patch(`/front-desk/queue/${id}/call`);
      return res.data?.data ?? res.data;
    },
    onSuccess: (data) => {
      toast.success(`Token ${data?.tokenDisplay ?? ""} called`);
      invalidate();
    },
    onError: () => toast.error("Failed to call token"),
  });

  const completeTokenMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.patch(`/front-desk/queue/${id}/complete`);
      return res.data?.data ?? res.data;
    },
    onSuccess: () => {
      toast.success("Token completed");
      invalidate();
    },
    onError: () => toast.error("Failed to complete token"),
  });

  const issueTokenMutation = useMutation({
    mutationFn: async (payload: { patientName: string; type: string }) => {
      const res = await api.post("/front-desk/queue/issue", payload);
      return res.data?.data ?? res.data;
    },
    onSuccess: (data) => {
      toast.success(`Token ${data?.tokenDisplay ?? ""} issued`);
      setShowIssueModal(false);
      setIssueForm({ patientName: "", type: "WALKIN" });
      invalidate();
    },
    onError: () => toast.error("Failed to issue token"),
  });

  // ── Derived data ─────────────────────────────────────────────────────────

  const allTokens = tokens ?? [];

  // Unique departments in today's queue
  const departments = useMemo(() => {
    const seen = new Set<string>();
    const result: Array<{ code: string; name: string }> = [];
    for (const t of allTokens) {
      if (t.departmentCode && !seen.has(t.departmentCode)) {
        seen.add(t.departmentCode);
        result.push({ code: t.departmentCode, name: t.departmentName ?? t.departmentCode });
      }
    }
    return result;
  }, [allTokens]);

  const filteredTokens = useMemo(() => {
    if (deptFilter === "ALL") return allTokens;
    if (deptFilter === "LAB") return allTokens.filter((t) => !t.departmentCode);
    return allTokens.filter((t) => t.departmentCode === deptFilter);
  }, [allTokens, deptFilter]);

  const waitingTokens = useMemo(
    () => filteredTokens.filter((t) => t.status === "WAITING"),
    [filteredTokens]
  );
  const calledTokens = useMemo(
    () => filteredTokens.filter((t) => t.status === "CALLED" || t.status === "IN_PROGRESS"),
    [filteredTokens]
  );
  const completedTokens = useMemo(
    () => filteredTokens.filter((t) => t.status === "DONE" || t.status === "COMPLETED"),
    [filteredTokens]
  );

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/front-desk")}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Queue &amp; Tokens</h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage patient tokens and queue for today
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => invalidate()}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={() => setShowIssueModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Issue Token
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Waiting", value: waitingTokens.length, icon: Clock, color: "text-amber-600 bg-amber-50" },
          { label: "Called / In-Progress", value: calledTokens.length, icon: Phone, color: "text-blue-600 bg-blue-50" },
          { label: "Completed Today", value: completedTokens.length, icon: CheckCircle2, color: "text-green-600 bg-green-50" },
          { label: "Total Issued", value: (tokens ?? []).length, icon: Hash, color: "text-slate-600 bg-slate-100" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
            <div className={cn("p-2.5 rounded-lg", s.color)}>
              <s.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Loading / Error */}
      {isLoading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-3 text-slate-500">Loading queue...</span>
        </div>
      )}

      {isError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-700 font-medium">Failed to load queue</p>
          <p className="text-sm text-red-500 mt-1">
            {(error as Error)?.message ?? "Unknown error"}
          </p>
        </div>
      )}

      {/* Department Filter Tabs */}
      {!isLoading && !isError && departments.length > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {[{ code: "ALL", name: "All" }, { code: "LAB", name: "Lab" }, ...departments].map((d) => (
            <button
              key={d.code}
              onClick={() => setDeptFilter(d.code)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition",
                deptFilter === d.code
                  ? "bg-blue-600 text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              )}
            >
              {d.name}
            </button>
          ))}
        </div>
      )}

      {!isLoading && !isError && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* ── LEFT PANEL: Queue Management ───────────────────────────────── */}
          <div className="lg:col-span-3 space-y-6">
            {/* Call Next Token */}
            <div className="flex gap-3">
              <button
                onClick={() => callNextMutation.mutate()}
                disabled={callNextMutation.isPending || waitingTokens.length === 0}
                className="flex-1 flex items-center justify-center gap-3 px-6 py-4 text-lg font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl hover:from-blue-700 hover:to-blue-800 transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {callNextMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <ArrowRight className="h-5 w-5" />
                )}
                Call Next Token
              </button>
              <button
                onClick={() => {
                  setIssueForm({ patientName: "", type: "PRIORITY" as string });
                  setShowIssueModal(true);
                }}
                className="flex items-center gap-2 px-5 py-4 text-sm font-semibold text-red-700 bg-red-50 border-2 border-red-200 rounded-xl hover:bg-red-100 transition"
              >
                <Star className="h-4 w-4" />
                Issue Priority Token
              </button>
            </div>

            {/* Called / In-Progress */}
            {calledTokens.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Called / In-Progress
                </h3>
                <div className="space-y-2">
                  {calledTokens.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between bg-white rounded-lg border border-blue-200 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-blue-700">{t.tokenDisplay}</span>
                        <span className="text-sm text-slate-700">{t.patientName}</span>
                        {typeBadge(t.type)}
                        {statusBadge(t.status)}
                      </div>
                      <button
                        onClick={() => completeTokenMutation.mutate(t.id)}
                        disabled={completeTokenMutation.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200 transition"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Complete
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Waiting List */}
            <div className="bg-white rounded-xl border border-slate-200">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-500" />
                  Waiting ({waitingTokens.length})
                </h3>
              </div>

              {waitingTokens.length === 0 ? (
                <div className="py-12 text-center">
                  <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">No patients waiting</p>
                  <p className="text-xs text-slate-400 mt-1">Issue a token to add patients to the queue</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {waitingTokens.map((t) => {
                    const waitMin = getWaitMinutes(t.createdAt);
                    return (
                      <div
                        key={t.id}
                        className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-sm font-bold text-slate-800 w-16 shrink-0">
                            {t.tokenDisplay}
                          </span>
                          <span className="text-sm text-slate-700 truncate max-w-[120px]">
                            {t.patientName}
                          </span>
                          {t.departmentName && (
                            <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full shrink-0">
                              {t.departmentName}
                            </span>
                          )}
                          {typeBadge(t.type)}
                          <span
                            className={cn(
                              "text-xs font-medium px-2 py-0.5 rounded-full border",
                              getWaitBg(waitMin),
                              getWaitColor(waitMin)
                            )}
                          >
                            {waitMin}m
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => callTokenMutation.mutate(t.id)}
                            disabled={callTokenMutation.isPending}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
                          >
                            <Phone className="h-3.5 w-3.5" />
                            Call
                          </button>
                          <button
                            onClick={() => completeTokenMutation.mutate(t.id)}
                            disabled={completeTokenMutation.isPending}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
                          >
                            <SkipForward className="h-3.5 w-3.5" />
                            Skip
                          </button>
                          <a
                            href={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1"}/front-desk/queue/${t.id}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 rounded-lg hover:bg-teal-100 transition"
                            title="Download token slip PDF"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            Slip
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Completed Today */}
            <div className="bg-white rounded-xl border border-slate-200">
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition"
              >
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Completed Today ({completedTokens.length})
                </h3>
                {showCompleted ? (
                  <ChevronUp className="h-4 w-4 text-slate-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                )}
              </button>
              {showCompleted && completedTokens.length > 0 && (
                <div className="border-t border-slate-100 divide-y divide-slate-50">
                  {completedTokens.map((t) => (
                    <div key={t.id} className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-500">
                      <span className="font-medium w-16">{t.tokenDisplay}</span>
                      <span className="truncate">{t.patientName}</span>
                      {typeBadge(t.type)}
                      <span className="ml-auto text-xs">
                        {t.completedAt
                          ? new Date(t.completedAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "-"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT PANEL: Patient Display Preview ───────────────────────── */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-medium text-slate-400 flex items-center gap-2">
                  <Monitor className="h-4 w-4" />
                  Patient Display Preview
                </h3>
                <a
                  href="/front-desk/queue-display"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                  Open Full Screen Display
                </a>
              </div>

              {/* Now Serving */}
              <div className="text-center mb-8">
                <p className="text-xs uppercase tracking-widest text-slate-400 mb-2">
                  Now Serving
                </p>
                {displayData?.currentToken ? (
                  <div>
                    <p className="text-5xl font-black text-green-400 mb-1">
                      {displayData.currentToken.tokenDisplay}
                    </p>
                    <p className="text-sm text-slate-300">
                      {displayData.currentToken.patientName}
                    </p>
                  </div>
                ) : calledTokens.length > 0 ? (
                  <div>
                    <p className="text-5xl font-black text-green-400 mb-1">
                      {calledTokens[0].tokenDisplay}
                    </p>
                    <p className="text-sm text-slate-300">
                      {calledTokens[0].patientName}
                    </p>
                  </div>
                ) : (
                  <p className="text-3xl font-bold text-slate-600">---</p>
                )}
              </div>

              {/* Divider */}
              <div className="border-t border-slate-700 mb-6" />

              {/* Next Up */}
              <div className="mb-6">
                <p className="text-xs uppercase tracking-widest text-slate-400 mb-3">
                  Next Up
                </p>
                {(displayData?.nextTokens ?? waitingTokens.slice(0, 5)).length > 0 ? (
                  <div className="space-y-2">
                    {(displayData?.nextTokens ?? waitingTokens.slice(0, 5)).map((t, i) => (
                      <div
                        key={t.id}
                        className={cn(
                          "flex items-center justify-between px-3 py-2 rounded-lg",
                          i === 0 ? "bg-slate-700/80" : "bg-slate-800/50"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-white">
                            {t.tokenDisplay}
                          </span>
                          <span className="text-sm text-slate-300 truncate max-w-[120px]">
                            {t.patientName}
                          </span>
                        </div>
                        {t.type === "PRIORITY" && (
                          <Star className="h-3.5 w-3.5 text-yellow-400" />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-600 text-center py-4">
                    No patients in queue
                  </p>
                )}
              </div>

              {/* Estimated Wait */}
              <div className="bg-slate-700/50 rounded-lg px-4 py-3 text-center">
                <p className="text-xs text-slate-400">Estimated Wait</p>
                <p className="text-xl font-bold text-white mt-0.5">
                  ~{displayData?.estimatedWait ?? waitingTokens.length * 5} min
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Issue Token Modal ─────────────────────────────────────────────── */}
      {showIssueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900">Issue Token</h2>
              <button
                onClick={() => setShowIssueModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Patient Name
                </label>
                <input
                  type="text"
                  value={issueForm.patientName}
                  onChange={(e) =>
                    setIssueForm((f) => ({ ...f, patientName: e.target.value }))
                  }
                  placeholder="Enter patient name"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Token Type
                </label>
                <select
                  value={issueForm.type}
                  onChange={(e) =>
                    setIssueForm((f) => ({ ...f, type: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="WALKIN">Walk-in</option>
                  <option value="PRIORITY">Priority</option>
                  <option value="CORPORATE">Corporate</option>
                  <option value="HOME">Home Collection</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowIssueModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => issueTokenMutation.mutate(issueForm)}
                disabled={!issueForm.patientName.trim() || issueTokenMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {issueTokenMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Issue Token
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
