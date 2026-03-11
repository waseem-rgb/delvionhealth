"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  RefreshCw,
  Brain,
  CheckCircle,
  AlertCircle,
  X,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RepeatSummary {
  total: number;
  high: number;
  medium: number;
  low: number;
  contacted: number;
  converted: number;
}

interface AnalysisStatus {
  status: "NOT_STARTED" | "RUNNING" | "COMPLETED" | "FAILED";
  totalPatients: number;
  processed: number;
  startedAt: string | null;
  completedAt: string | null;
}

interface RepeatCandidate {
  id: string;
  patientId: string;
  testName: string;
  lastTestDate: string;
  recommendedDate: string;
  daysOverdue: number;
  priority: "HIGH" | "MEDIUM" | "LOW";
  contacted: boolean;
  converted: boolean;
  aiReason: string | null;
  createdAt: string;
}

interface CandidatesResponse {
  items: RepeatCandidate[];
  total: number;
  page: number;
  pages: number;
}

interface ReminderResponse {
  message: string;
  whatsapp: string;
  sms: string;
  patient: { name: string; phone: string };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const priorityBadge: Record<string, string> = {
  HIGH: "bg-red-500/10 text-red-400 border border-red-500/30",
  MEDIUM: "bg-orange-500/10 text-orange-400 border border-orange-500/30",
  LOW: "bg-blue-500/10 text-blue-400 border border-blue-500/30",
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

type PriorityFilter = "ALL" | "HIGH" | "MEDIUM" | "LOW" | "CONTACTED";

// ─── Reminder Modal ───────────────────────────────────────────────────────────

function ReminderModal({
  candidateId,
  onClose,
}: {
  candidateId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [channel, setChannel] = useState<"whatsapp" | "sms">("whatsapp");
  const [message, setMessage] = useState("");

  const { data, isLoading } = useQuery<ReminderResponse>({
    queryKey: ["remind", candidateId],
    queryFn: async () => {
      const res = await api.post(
        `/revenue-crm/repeat-analytics/candidates/${candidateId}/remind`
      );
      return res.data?.data ?? res.data;
    },
    retry: 1,
    staleTime: 30000,
  });

  useEffect(() => {
    if (data) {
      setMessage(channel === "whatsapp" ? data.whatsapp : data.sms);
    }
  }, [data, channel]);

  const contactMutation = useMutation({
    mutationFn: async () => {
      await api.post(
        `/revenue-crm/repeat-analytics/candidates/${candidateId}/contacted`
      );
    },
    onSuccess: () => {
      toast.success("Reminder sent and patient marked as contacted");
      queryClient.invalidateQueries({ queryKey: ["repeat-candidates"] });
      queryClient.invalidateQueries({ queryKey: ["repeat-summary"] });
      onClose();
    },
    onError: () => toast.error("Failed to mark as contacted"),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white border border-slate-300 rounded-xl w-full max-w-lg mx-4 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-slate-900 font-semibold text-lg">Send Reminder</h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-900 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {isLoading ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-4 bg-slate-100 rounded w-3/4" />
              <div className="h-4 bg-slate-100 rounded w-1/2" />
              <div className="h-24 bg-slate-100 rounded" />
            </div>
          ) : data ? (
            <>
              <div className="space-y-1">
                <p className="text-slate-500 text-xs uppercase tracking-wide">Patient</p>
                <p className="text-slate-900 font-medium">{data.patient.name}</p>
                <p className="text-slate-500 text-sm">{data.patient.phone}</p>
              </div>

              <div className="flex gap-2">
                {(["whatsapp", "sms"] as const).map((ch) => (
                  <button
                    key={ch}
                    onClick={() => setChannel(ch)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      channel === ch
                        ? "bg-teal-600 text-white"
                        : "bg-slate-100 text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    {ch === "whatsapp" ? "WhatsApp" : "SMS"}
                  </button>
                ))}
              </div>

              <div>
                <label className="text-slate-500 text-xs uppercase tracking-wide block mb-1.5">
                  Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  className="w-full bg-slate-100 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 text-sm resize-none focus:outline-none focus:border-teal-500"
                />
              </div>
            </>
          ) : (
            <p className="text-slate-500 text-sm">Failed to load reminder details.</p>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-slate-500 hover:text-slate-900 text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => contactMutation.mutate()}
            disabled={contactMutation.isPending || isLoading}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            {contactMutation.isPending && (
              <RefreshCw size={14} className="animate-spin" />
            )}
            Send Reminder
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RepeatAnalyticsPage() {
  const queryClient = useQueryClient();
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("ALL");
  const [page, setPage] = useState(1);
  const [reminderCandidateId, setReminderCandidateId] = useState<string | null>(null);

  // Status query — refetch every 3s when RUNNING
  const { data: statusData } = useQuery<AnalysisStatus>({
    queryKey: ["repeat-status"],
    queryFn: async () => {
      const res = await api.get("/revenue-crm/repeat-analytics/status");
      return res.data?.data ?? res.data;
    },
    retry: 1,
    staleTime: 30000,
    refetchInterval: (query) => {
      const d = query.state.data as AnalysisStatus | undefined;
      return d?.status === "RUNNING" ? 3000 : false;
    },
  });

  // Invalidate summary when status transitions to COMPLETED
  useEffect(() => {
    if (statusData?.status === "COMPLETED") {
      queryClient.invalidateQueries({ queryKey: ["repeat-summary"] });
      queryClient.invalidateQueries({ queryKey: ["repeat-candidates"] });
    }
  }, [statusData?.status, queryClient]);

  const { data: summaryData } = useQuery<RepeatSummary>({
    queryKey: ["repeat-summary"],
    queryFn: async () => {
      const res = await api.get("/revenue-crm/repeat-analytics/summary");
      return res.data?.data ?? res.data;
    },
    retry: 1,
    staleTime: 30000,
  });

  const candidatesQueryParams: Record<string, string | number> = { page };
  if (priorityFilter !== "ALL" && priorityFilter !== "CONTACTED") {
    candidatesQueryParams.priority = priorityFilter;
  }
  if (priorityFilter === "CONTACTED") {
    candidatesQueryParams.contacted = "true";
  }

  const { data: candidatesData, isLoading: candidatesLoading } =
    useQuery<CandidatesResponse>({
      queryKey: ["repeat-candidates", priorityFilter, page],
      queryFn: async () => {
        const params = new URLSearchParams();
        params.set("page", String(page));
        if (priorityFilter !== "ALL" && priorityFilter !== "CONTACTED") {
          params.set("priority", priorityFilter);
        }
        if (priorityFilter === "CONTACTED") {
          params.set("contacted", "true");
        }
        const res = await api.get(
          `/revenue-crm/repeat-analytics/candidates?${params.toString()}`
        );
        return res.data?.data ?? res.data;
      },
      retry: 1,
      staleTime: 30000,
    });

  const runMutation = useMutation({
    mutationFn: async () => {
      await api.post("/revenue-crm/repeat-analytics/run");
    },
    onSuccess: () => {
      toast.success("Analysis started — this may take a few minutes");
      queryClient.invalidateQueries({ queryKey: ["repeat-status"] });
    },
    onError: () => toast.error("Failed to start analysis"),
  });

  const status = statusData?.status ?? "NOT_STARTED";
  const summary = summaryData;
  const candidates = candidatesData?.items ?? [];
  const totalPages = candidatesData?.pages ?? 1;

  const filterTabs: { label: string; value: PriorityFilter }[] = [
    { label: "All", value: "ALL" },
    { label: "High Priority", value: "HIGH" },
    { label: "Medium", value: "MEDIUM" },
    { label: "Low", value: "LOW" },
    { label: "Contacted", value: "CONTACTED" },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Repeat Test Analytics</h1>
          <p className="text-slate-500 text-sm mt-1">
            AI-powered identification of patients due for repeat diagnostics
          </p>
        </div>
        <button
          onClick={() => runMutation.mutate()}
          disabled={status === "RUNNING" || runMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {status === "RUNNING" || runMutation.isPending ? (
            <RefreshCw size={15} className="animate-spin" />
          ) : (
            <RefreshCw size={15} />
          )}
          {status === "RUNNING"
            ? "Running..."
            : status === "COMPLETED"
            ? "Re-run Analysis"
            : "Run Analysis"}
        </button>
      </div>

      {/* Running Banner */}
      {status === "RUNNING" && statusData && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-amber-400 font-medium text-sm">
            <RefreshCw size={15} className="animate-spin" />
            Analysis running… {statusData.processed} of {statusData.totalPatients} patients
            analyzed
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-500"
              style={{
                width:
                  statusData.totalPatients > 0
                    ? `${(statusData.processed / statusData.totalPatients) * 100}%`
                    : "5%",
              }}
            />
          </div>
        </div>
      )}

      {/* Failed Banner */}
      {status === "FAILED" && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle size={15} />
            Analysis failed. Please retry.
          </div>
          <button
            onClick={() => runMutation.mutate()}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">Total Due</p>
          <p className="text-2xl font-bold text-violet-400">{summary?.total ?? 0}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">High Priority</p>
          <p className="text-2xl font-bold text-red-400">{summary?.high ?? 0}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">Medium Priority</p>
          <p className="text-2xl font-bold text-orange-400">{summary?.medium ?? 0}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">Contacted</p>
          <p className="text-2xl font-bold text-teal-400">{summary?.contacted ?? 0}</p>
        </div>
      </div>

      {/* Empty State: NOT_STARTED */}
      {status === "NOT_STARTED" && candidates.length === 0 && !candidatesLoading && (
        <div className="bg-white border border-slate-200 rounded-xl p-16 flex flex-col items-center gap-4">
          <Brain size={48} className="text-slate-600" />
          <div className="text-center">
            <p className="text-slate-900 font-medium text-lg">
              Run analysis to identify patients due for repeat tests
            </p>
            <p className="text-slate-500 text-sm mt-1">
              AI analyzes your patient history to find who needs to come back
            </p>
          </div>
          <button
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending}
            className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <RefreshCw size={15} />
            Run Analysis
          </button>
        </div>
      )}

      {/* Empty State: COMPLETED but 0 results */}
      {status === "COMPLETED" && candidates.length === 0 && !candidatesLoading && (
        <div className="bg-white border border-slate-200 rounded-xl p-16 flex flex-col items-center gap-4">
          <CheckCircle size={48} className="text-emerald-500" />
          <div className="text-center">
            <p className="text-slate-900 font-medium text-lg">All patients are up to date</p>
            <p className="text-slate-500 text-sm mt-1">
              No repeat test candidates identified at this time
            </p>
          </div>
        </div>
      )}

      {/* Candidates Table */}
      {(candidates.length > 0 || (status !== "NOT_STARTED" && !candidatesLoading)) &&
        !(status === "COMPLETED" && candidates.length === 0) && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1 px-4 pt-4 pb-0 border-b border-slate-200 overflow-x-auto">
              {filterTabs.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => {
                    setPriorityFilter(tab.value);
                    setPage(1);
                  }}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors ${
                    priorityFilter === tab.value
                      ? "bg-slate-100 text-slate-900 border-b-2 border-teal-500"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    {[
                      "Patient ID",
                      "Test",
                      "Priority",
                      "Last Done",
                      "Due Date",
                      "Days Overdue",
                      "Status",
                      "Actions",
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {candidatesLoading
                    ? [...Array(5)].map((_, i) => (
                        <tr key={i}>
                          {[...Array(8)].map((__, j) => (
                            <td key={j} className="px-4 py-3">
                              <div className="h-4 bg-slate-100 rounded animate-pulse" />
                            </td>
                          ))}
                        </tr>
                      ))
                    : candidates.map((c) => (
                        <tr
                          key={c.id}
                          className="hover:bg-slate-100/40 transition-colors"
                        >
                          <td className="px-4 py-3 text-slate-700 text-sm font-mono">
                            …{c.patientId.slice(-6)}
                          </td>
                          <td className="px-4 py-3 text-slate-900 text-sm max-w-[160px] truncate">
                            {c.testName}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityBadge[c.priority]}`}
                            >
                              {c.priority}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-500 text-sm">
                            {fmtDate(c.lastTestDate)}
                          </td>
                          <td className="px-4 py-3 text-slate-500 text-sm">
                            {fmtDate(c.recommendedDate)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={
                                c.daysOverdue > 0
                                  ? "text-red-400 text-sm font-medium"
                                  : "text-slate-500 text-sm"
                              }
                            >
                              {c.daysOverdue > 0 ? `+${c.daysOverdue}d` : "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {c.converted ? (
                              <span className="text-emerald-400 text-xs font-medium">
                                Converted
                              </span>
                            ) : c.contacted ? (
                              <span className="text-teal-400 text-xs font-medium">
                                Contacted
                              </span>
                            ) : (
                              <span className="text-slate-500 text-xs">Pending</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setReminderCandidateId(c.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 transition-colors"
                            >
                              <MessageSquare size={12} />
                              Send Reminder
                            </button>
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
                <span className="text-slate-500 text-sm">
                  Page {page} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm disabled:opacity-40 hover:bg-slate-200 transition-colors"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm disabled:opacity-40 hover:bg-slate-200 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      {/* Revenue Opportunity Card */}
      {summary && summary.total > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-amber-400 font-medium text-sm">Revenue Opportunity</p>
            <p className="text-slate-700 text-sm mt-1">
              If all{" "}
              <span className="text-slate-900 font-semibold">{summary.high}</span> high priority
              patients return for tests:
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500 mb-0.5">Estimated Revenue</p>
            <p className="text-2xl font-bold text-amber-400">
              ₹{(summary.high * 1200).toLocaleString("en-IN")}
            </p>
            <p className="text-xs text-slate-500">@ avg ₹1,200 per test</p>
          </div>
        </div>
      )}

      {/* Reminder Modal */}
      {reminderCandidateId && (
        <ReminderModal
          candidateId={reminderCandidateId}
          onClose={() => setReminderCandidateId(null)}
        />
      )}
    </div>
  );
}
