"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  ClipboardList,
  Search,
  Plus,
  Wand2,
  Clock,
  FileText,
  Download,
  History,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import api from "@/lib/api";
import FormSheet from "@/components/quality/FormSheet";
import AddFormDialog from "@/components/quality/AddFormDialog";
import type { FormTemplate } from "@/components/quality/FormRenderer";

// ── Types ────────────────────────────────────────────────────────────────────

interface QualityForm {
  id: string;
  formCode: string;
  name: string;
  category: string | null;
  type: string;
  frequency: string | null;
  automation: string | null;
  description: string | null;
  fields: Record<string, unknown> | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

interface FormEntry {
  id: string;
  formId: string;
  status: string;
  submittedAt: string | null;
  createdAt: string;
}

interface ComplianceDashboard {
  summary: {
    total: number;
    submitted: number;
    overdue: number;
    due: number;
    complianceRate: number;
  };
  dailyForms: Array<{ id: string; formCode: string; name: string; status: string }>;
  monthlyForms: Array<{ id: string; formCode: string; name: string; status: string }>;
  missedForms: Array<{ id: string; formCode: string; name: string; frequency: string; lastSubmitted: string | null; daysMissed: number }>;
  trend: Array<{ date: string; filled: number; missed: number }>;
}

// ── Constants ────────────────────────────────────────────────────────────────

const FREQ_ORDER: Record<string, number> = {
  Daily: 1, Weekly: 2, Monthly: 3, "Per Batch": 4, "Per Event": 5,
  "Per Round": 6, "Per Shipment": 7, Annual: 8, Ongoing: 9, "Per Audit": 5,
};

const FREQ_TABS = [
  { label: "All", value: "ALL" },
  { label: "Daily", value: "Daily" },
  { label: "Weekly", value: "Weekly" },
  { label: "Monthly", value: "Monthly" },
  { label: "Per Event", value: "Per Event" },
  { label: "Management", value: "MANAGEMENT" },
  { label: "Maintenance", value: "MAINTENANCE" },
];

const FREQ_COLORS: Record<string, string> = {
  Daily: "text-cyan-600", Weekly: "text-blue-600", Monthly: "text-purple-600",
  Annual: "text-amber-600", "Per Event": "text-rose-600", "Per Batch": "text-green-600",
  "Per Audit": "text-indigo-600", "Per Round": "text-fuchsia-600", Ongoing: "text-slate-500",
};

// ── Status helpers ───────────────────────────────────────────────────────────

type FormStatus = "DONE" | "DUE" | "OVERDUE" | "NEVER";

function getFormStatus(form: QualityForm, entries: FormEntry[]): { status: FormStatus; lastSubmitted: string | null } {
  const formEntries = entries.filter((e) => e.formId === form.id && e.status !== "DRAFT");
  const lastEntry = formEntries.length > 0
    ? formEntries.reduce((a, b) => (new Date(a.createdAt) > new Date(b.createdAt) ? a : b))
    : null;

  const lastSubmitted = lastEntry?.submittedAt ?? lastEntry?.createdAt ?? null;

  if (!lastEntry) {
    if (["Per Event", "Per Batch", "Per Round", "Per Audit"].includes(form.frequency ?? "")) {
      return { status: "NEVER", lastSubmitted: null };
    }
    return { status: "DUE", lastSubmitted: null };
  }

  const now = new Date();
  const lastDate = new Date(lastSubmitted!);
  const freq = form.frequency;

  if (freq === "Daily") {
    const isToday = lastDate.toDateString() === now.toDateString();
    if (isToday) return { status: "DONE", lastSubmitted };
    return { status: now.getHours() >= 10 ? "OVERDUE" : "DUE", lastSubmitted };
  }
  if (freq === "Weekly") {
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    return { status: lastDate >= weekAgo ? "DONE" : "DUE", lastSubmitted };
  }
  if (freq === "Monthly") {
    const sameMonth = lastDate.getMonth() === now.getMonth() && lastDate.getFullYear() === now.getFullYear();
    return { status: sameMonth ? "DONE" : "DUE", lastSubmitted };
  }
  if (freq === "Annual") {
    return { status: lastDate.getFullYear() === now.getFullYear() ? "DONE" : "DUE", lastSubmitted };
  }
  return { status: "DONE", lastSubmitted };
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

const STATUS_BADGE: Record<FormStatus, { label: string; className: string }> = {
  DONE: { label: "Done", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  DUE: { label: "Due", className: "bg-amber-50 text-amber-700 border-amber-200" },
  OVERDUE: { label: "Overdue", className: "bg-red-50 text-red-700 border-red-200" },
  NEVER: { label: "Never", className: "bg-slate-50 text-slate-500 border-slate-200" },
};

const STATUS_DOT: Record<FormStatus, string> = {
  DONE: "bg-emerald-500", DUE: "bg-amber-500", OVERDUE: "bg-red-500", NEVER: "bg-slate-300",
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function QualityFormsPage() {
  const queryClient = useQueryClient();
  const [freqTab, setFreqTab] = useState("ALL");
  const [search, setSearch] = useState("");
  const [activeForm, setActiveForm] = useState<FormTemplate | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [downloadingBlank, setDownloadingBlank] = useState<string | null>(null);
  const [historyFormId, setHistoryFormId] = useState<string | null>(null);

  // Fetch forms
  const { data, isLoading } = useQuery({
    queryKey: ["quality-forms"],
    queryFn: async () => {
      try {
        const res = await api.get("/quality/forms?limit=200");
        const payload = res.data?.data ?? res.data;
        return payload as { data: QualityForm[]; total: number };
      } catch {
        return { data: [] as QualityForm[], total: 0 };
      }
    },
  });

  // Fetch recent entries for status tracking
  const { data: entriesData } = useQuery({
    queryKey: ["quality-form-entries"],
    queryFn: async () => {
      try {
        const res = await api.get("/quality/form-entries?limit=500");
        const payload = res.data?.data ?? res.data;
        return (payload as { data: FormEntry[] }).data ?? [];
      } catch {
        return [] as FormEntry[];
      }
    },
  });

  // Fetch compliance dashboard
  const { data: dashboard } = useQuery<ComplianceDashboard>({
    queryKey: ["quality-compliance-dashboard"],
    queryFn: async () => {
      try {
        const res = await api.get("/quality/forms/compliance-dashboard");
        return (res.data?.data ?? res.data) as ComplianceDashboard;
      } catch {
        return { summary: { total: 0, submitted: 0, overdue: 0, due: 0, complianceRate: 0 }, dailyForms: [], monthlyForms: [], missedForms: [], trend: [] };
      }
    },
  });

  const seedMutation = useMutation({
    mutationFn: () => api.post("/quality/forms/seed"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quality-forms"] });
      queryClient.invalidateQueries({ queryKey: ["quality-compliance-dashboard"] });
    },
  });

  const allForms = data?.data ?? [];
  const entries = entriesData ?? [];
  const summary = dashboard?.summary;
  const trend = dashboard?.trend ?? [];
  const missedForms = dashboard?.missedForms ?? [];

  // Download blank PDF
  const handleDownloadBlank = useCallback(async (formCode: string) => {
    setDownloadingBlank(formCode);
    try {
      const res = await api.get(`/quality/forms/download-empty/${formCode}`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${formCode}-blank.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Blank form downloaded");
    } catch {
      toast.error("Failed to download blank form");
    } finally {
      setDownloadingBlank(null);
    }
  }, []);

  // Download filled PDF
  const handleDownloadFilled = useCallback(async (submissionId: string, formCode: string) => {
    try {
      const res = await api.get(`/quality/forms/download-filled/${submissionId}`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${formCode}-filled-${submissionId.slice(0, 8)}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Filled form downloaded");
    } catch {
      toast.error("Failed to download filled form");
    }
  }, []);

  // Filter + sort
  const filtered = useMemo(() => {
    let result = [...allForms];
    if (freqTab === "MANAGEMENT") {
      result = result.filter((f) => f.type === "MANAGEMENT");
    } else if (freqTab === "MAINTENANCE") {
      result = result.filter((f) =>
        ["equipment", "safety", "maintenance"].includes(f.category?.toLowerCase() ?? "")
      );
    } else if (freqTab !== "ALL") {
      result = result.filter((f) => f.frequency === freqTab);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (f) => f.name.toLowerCase().includes(q) || f.formCode.toLowerCase().includes(q) || (f.category ?? "").toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      const fa = FREQ_ORDER[a.frequency ?? ""] ?? 99;
      const fb = FREQ_ORDER[b.frequency ?? ""] ?? 99;
      if (fa !== fb) return fa - fb;
      return a.formCode.localeCompare(b.formCode);
    });
    return result;
  }, [allForms, freqTab, search]);

  // History entries for selected form
  const historyEntries = useMemo(() => {
    if (!historyFormId) return [];
    return entries
      .filter((e) => e.formId === historyFormId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [historyFormId, entries]);

  const totalForms = allForms.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quality Forms</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            NABL/ISO 15189 quality management forms — {totalForms} templates
          </p>
        </div>
        <div className="flex gap-2">
          {totalForms === 0 && (
            <button
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50"
            >
              <Wand2 className="w-4 h-4" />
              {seedMutation.isPending ? "Seeding..." : "Seed Default Forms"}
            </button>
          )}
          <button
            onClick={() => setShowAddDialog(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Add Form Template
          </button>
        </div>
      </div>

      {/* ── Compliance Dashboard ────────────────────────────────────────── */}
      {summary && totalForms > 0 && (
        <div className="space-y-4">
          {/* Stat cards */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Total Forms", value: summary.total, icon: ClipboardList, bg: "bg-slate-50", text: "text-slate-600" },
              { label: "Submitted Today", value: summary.submitted, icon: CheckCircle2, bg: "bg-emerald-50", text: "text-emerald-600" },
              { label: "Due / Pending", value: summary.due, icon: AlertTriangle, bg: "bg-amber-50", text: "text-amber-600" },
              { label: "Overdue / Missed", value: summary.overdue, icon: XCircle, bg: "bg-red-50", text: "text-red-600" },
            ].map((kpi) => {
              const Icon = kpi.icon;
              return (
                <div key={kpi.label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", kpi.bg, kpi.text)}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{kpi.value}</p>
                      <p className="text-xs text-slate-500">{kpi.label}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Compliance rate + Trend chart + Missed forms */}
          <div className="grid grid-cols-3 gap-4">
            {/* Compliance rate */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-blue-500" />
                <h3 className="text-sm font-semibold text-slate-700">Compliance Rate</h3>
              </div>
              <div className="flex items-end gap-2">
                <span className={cn(
                  "text-4xl font-bold",
                  summary.complianceRate >= 80 ? "text-emerald-600" : summary.complianceRate >= 50 ? "text-amber-600" : "text-red-600"
                )}>
                  {summary.complianceRate}%
                </span>
                <span className="text-xs text-slate-400 mb-1">today</span>
              </div>
              <div className="mt-3 w-full bg-slate-100 rounded-full h-2">
                <div
                  className={cn(
                    "h-2 rounded-full transition-all",
                    summary.complianceRate >= 80 ? "bg-emerald-500" : summary.complianceRate >= 50 ? "bg-amber-500" : "bg-red-500"
                  )}
                  style={{ width: `${Math.min(summary.complianceRate, 100)}%` }}
                />
              </div>
            </div>

            {/* 7-day trend */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">7-Day Trend</h3>
              {trend.length > 0 ? (
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={trend} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: string) => {
                        const d = new Date(v);
                        return `${d.getMonth() + 1}/${d.getDate()}`;
                      }}
                    />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                      labelFormatter={(v: string) => new Date(v).toLocaleDateString()}
                    />
                    <Bar dataKey="filled" fill="#10b981" radius={[3, 3, 0, 0]} name="Filled" />
                    <Bar dataKey="missed" fill="#f87171" radius={[3, 3, 0, 0]} name="Missed" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-xs text-slate-400 mt-6 text-center">No trend data yet</p>
              )}
            </div>

            {/* Missed forms */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">
                Missed Forms <span className="text-red-500 font-normal">({missedForms.length})</span>
              </h3>
              {missedForms.length === 0 ? (
                <p className="text-xs text-slate-400 mt-6 text-center">All forms are up to date!</p>
              ) : (
                <div className="space-y-2 max-h-[120px] overflow-y-auto">
                  {missedForms.slice(0, 10).map((mf) => (
                    <div key={mf.id} className="flex items-center justify-between text-xs">
                      <div className="truncate">
                        <span className="font-mono text-slate-500">{mf.formCode}</span>
                        <span className="ml-1 text-slate-700">{mf.name}</span>
                      </div>
                      <span className="shrink-0 ml-2 text-red-500 font-medium">
                        {mf.daysMissed}d
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Frequency Tabs + Search ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex bg-slate-100 rounded-lg p-0.5">
          {FREQ_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFreqTab(tab.value)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                freqTab === tab.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            placeholder="Search forms..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 w-64"
          />
        </div>
      </div>

      {/* ── Form Cards ───────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-20 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-16 text-center">
          <ClipboardList className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No forms found</p>
          {totalForms === 0 && (
            <p className="text-slate-300 text-xs mt-1">
              Click &quot;Seed Default Forms&quot; to populate NABL templates
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filtered.map((form) => {
            const { status, lastSubmitted } = getFormStatus(form, entries);
            const badge = STATUS_BADGE[status];
            const dotColor = STATUS_DOT[status];
            const lastEntry = entries
              .filter((e) => e.formId === form.id && e.status !== "DRAFT")
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

            return (
              <div
                key={form.id}
                className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-lg shadow-sm hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className={cn("w-3 h-3 rounded-full shrink-0", dotColor)} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                        {form.formCode}
                      </span>
                      {form.category && (
                        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-medium bg-slate-50 text-slate-500 border border-slate-100">
                          {form.category}
                        </span>
                      )}
                    </div>
                    <div className="font-medium text-slate-800 mt-0.5 truncate">{form.name}</div>
                    <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                      <span className={FREQ_COLORS[form.frequency ?? ""] ?? "text-slate-400"}>
                        <Clock className="w-3 h-3 inline mr-0.5" />
                        {form.frequency ?? "—"}
                      </span>
                      <span>·</span>
                      <span>{lastSubmitted ? `Last: ${timeAgo(lastSubmitted)}` : "Never submitted"}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-4">
                  {/* Status badge */}
                  <span className={cn("inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border", badge.className)}>
                    {status === "DONE" && "✓ "}{badge.label}
                  </span>

                  {/* Download blank PDF */}
                  <button
                    onClick={() => handleDownloadBlank(form.formCode)}
                    disabled={downloadingBlank === form.formCode}
                    title="Download blank form"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-50 transition-colors"
                  >
                    {downloadingBlank === form.formCode ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                  </button>

                  {/* Download filled (last submission) */}
                  {lastEntry && (
                    <button
                      onClick={() => handleDownloadFilled(lastEntry.id, form.formCode)}
                      title="Download last filled form"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                  )}

                  {/* History */}
                  <button
                    onClick={() => setHistoryFormId(historyFormId === form.id ? null : form.id)}
                    title="View history"
                    className={cn(
                      "p-1.5 rounded-lg transition-colors",
                      historyFormId === form.id
                        ? "text-blue-600 bg-blue-50"
                        : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    <History className="w-4 h-4" />
                  </button>

                  {/* Fill Form */}
                  <button
                    onClick={() =>
                      setActiveForm({
                        id: form.id,
                        formCode: form.formCode,
                        name: form.name,
                        category: form.category,
                        type: form.type,
                        frequency: form.frequency,
                        fields: form.fields,
                      })
                    }
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
                  >
                    {status === "DONE" ? "View / Edit" : "Fill Form →"}
                  </button>
                </div>
              </div>
            );
          })}

          {/* Inline History Panel */}
          {historyFormId && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <History className="w-4 h-4" />
                  Submission History
                  <span className="text-xs font-normal text-slate-400">
                    ({allForms.find((f) => f.id === historyFormId)?.formCode})
                  </span>
                </h3>
                <button
                  onClick={() => setHistoryFormId(null)}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Close
                </button>
              </div>
              {historyEntries.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No submissions yet</p>
              ) : (
                <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                  {historyEntries.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between py-2 text-xs">
                      <div className="flex items-center gap-3">
                        <span className={cn(
                          "inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                          entry.status === "SUBMITTED" || entry.status === "APPROVED" || entry.status === "REVIEWED"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-50 text-slate-500 border-slate-200"
                        )}>
                          {entry.status}
                        </span>
                        <span className="text-slate-500">
                          {new Date(entry.createdAt).toLocaleDateString()} {new Date(entry.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDownloadFilled(entry.id, allForms.find((f) => f.id === historyFormId)?.formCode ?? "form")}
                        title="Download this submission"
                        className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-slate-400">
        Showing {filtered.length} of {totalForms} forms
      </p>

      {/* Form Sheet */}
      <FormSheet form={activeForm} onClose={() => setActiveForm(null)} />

      {/* Add Form Dialog */}
      <AddFormDialog open={showAddDialog} onClose={() => setShowAddDialog(false)} />
    </div>
  );
}
