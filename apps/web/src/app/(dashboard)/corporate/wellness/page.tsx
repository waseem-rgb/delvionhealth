"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  HeartHandshake,
  Plus,
  Sparkles,
  Globe,
  Trash2,
  ExternalLink,
  Copy,
  Loader2,
  Building2,
  CalendarDays,
  Users,
  FileText,
  Eye,
  X,
  RotateCcw,
  Rocket,
} from "lucide-react";
import api from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────

interface WellnessDashboard {
  id: string;
  title: string;
  corporateName: string;
  organizationId: string | null;
  organization?: { name: string } | null;
  campDateFrom: string;
  campDateTo: string;
  employeeCount: number | null;
  status: "DRAFT" | "GENERATING" | "READY" | "PUBLISHED";
  shareToken: string | null;
  htmlContent: string | null;
  aiNarrative: string | null;
  riskSummary: Record<string, number> | null;
  generatedAt: string | null;
  createdAt: string;
}

interface OrgOption {
  id: string;
  name: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  DRAFT:      { label: "Draft",      cls: "bg-gray-100 text-gray-600" },
  GENERATING: { label: "Generating", cls: "bg-amber-100 text-amber-700" },
  READY:      { label: "Ready",      cls: "bg-teal-100 text-teal-700" },
  PUBLISHED:  { label: "Published",  cls: "bg-emerald-100 text-emerald-700" },
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function WellnessDashboardPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    title: "",
    corporateName: "",
    organizationId: "",
    campDateFrom: "",
    campDateTo: "",
  });
  const [orgSearch, setOrgSearch] = useState("");
  const [orgResults, setOrgResults] = useState<OrgOption[]>([]);
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const [selectedOrgName, setSelectedOrgName] = useState("");

  const apiBase = typeof window !== "undefined"
    ? window.location.origin.replace(":3000", ":3001")
    : "http://localhost:3001";

  // ── Queries
  const { data: dashboards = [], isLoading } = useQuery<WellnessDashboard[]>({
    queryKey: ["wellness-dashboards"],
    queryFn: async () => {
      const res = await api.get("/wellness");
      return res.data?.data ?? res.data ?? [];
    },
  });

  // ── Mutations
  const createMut = useMutation({
    mutationFn: async () => {
      const res = await api.post("/wellness", {
        title: form.title,
        corporateName: form.corporateName,
        organizationId: form.organizationId || undefined,
        campDateFrom: form.campDateFrom,
        campDateTo: form.campDateTo,
      });
      return res.data?.data ?? res.data;
    },
    onSuccess: () => {
      toast.success("Dashboard created - click Generate to build it");
      qc.invalidateQueries({ queryKey: ["wellness-dashboards"] });
      setShowCreate(false);
      setForm({ title: "", corporateName: "", organizationId: "", campDateFrom: "", campDateTo: "" });
      setSelectedOrgName("");
    },
    onError: () => toast.error("Failed to create dashboard"),
  });

  const generateMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/wellness/${id}/generate`);
      return res.data?.data ?? res.data;
    },
    onSuccess: () => {
      toast.success("Dashboard generated with AI insights!");
      qc.invalidateQueries({ queryKey: ["wellness-dashboards"] });
    },
    onError: () => toast.error("Generation failed"),
  });

  const publishMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/wellness/${id}/publish`);
      return res.data?.data ?? res.data;
    },
    onSuccess: () => {
      toast.success("Dashboard published!");
      qc.invalidateQueries({ queryKey: ["wellness-dashboards"] });
    },
    onError: () => toast.error("Failed to publish"),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/wellness/${id}`);
    },
    onSuccess: () => {
      toast.success("Dashboard deleted");
      qc.invalidateQueries({ queryKey: ["wellness-dashboards"] });
    },
    onError: () => toast.error("Failed to delete"),
  });

  // ── Org search
  const handleOrgSearch = async (q: string) => {
    setOrgSearch(q);
    if (q.length < 2) {
      setOrgResults([]);
      setOrgDropdownOpen(false);
      return;
    }
    try {
      const res = await api.get("/organisations", { params: { search: q, limit: 10 } });
      const payload = res.data?.data ?? res.data ?? [];
      const list = Array.isArray(payload)
        ? payload
        : payload?.organisations ?? [];
      setOrgResults(
        list.map((o: Record<string, unknown>) => ({
          id: o.id as string,
          name: o.name as string,
        })),
      );
      setOrgDropdownOpen(true);
    } catch {
      setOrgResults([]);
    }
  };

  const getShareUrl = (d: WellnessDashboard) =>
    `${apiBase}/api/v1/wellness/share/${d.shareToken}`;

  const copyShareLink = (d: WellnessDashboard) => {
    navigator.clipboard.writeText(getShareUrl(d));
    toast.success("Share link copied to clipboard");
  };

  const previewDashboard = dashboards.find((d) => d.id === previewId);

  // ── Loading
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="w-64 h-8 bg-slate-200 rounded animate-pulse" />
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 h-28 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <HeartHandshake className="w-6 h-6 text-teal-600" />
            Wellness Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            AI-powered corporate health analytics — shareable as a live link
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-teal-700 text-white rounded-xl text-sm font-semibold hover:bg-teal-800 shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Dashboard
        </button>
      </div>

      {/* Empty state */}
      {dashboards.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-16 text-center">
          <div className="w-16 h-16 rounded-full bg-teal-50 flex items-center justify-center mx-auto mb-4">
            <HeartHandshake className="w-8 h-8 text-teal-600" />
          </div>
          <h3 className="font-bold text-gray-800 text-lg mb-2">No Wellness Dashboards Yet</h3>
          <p className="text-gray-500 text-sm max-w-sm mx-auto mb-6">
            Create a dashboard for a corporate health camp. AI analyses all employee results and builds
            a shareable analytics report with risk stratification, key findings, and recommendations.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="px-6 py-2.5 bg-teal-700 text-white rounded-xl font-semibold text-sm hover:bg-teal-800"
          >
            Create Your First Dashboard
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {dashboards.map((d) => {
            const sc = STATUS_STYLES[d.status] ?? STATUS_STYLES.DRAFT;
            const risk = d.riskSummary;
            return (
              <div key={d.id} className="bg-white border rounded-2xl p-5 hover:shadow-sm transition">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-gray-900">{d.title}</h3>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${sc.cls}`}>
                        {sc.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 font-medium">{d.corporateName}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="w-3.5 h-3.5" />
                        {fmtDate(d.campDateFrom)} &ndash; {fmtDate(d.campDateTo)}
                      </span>
                      {(d.employeeCount ?? 0) > 0 && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {d.employeeCount} employees
                        </span>
                      )}
                    </div>

                    {/* Risk summary chips */}
                    {risk && (d.employeeCount ?? 0) > 0 && (
                      <div className="flex gap-2 mt-3">
                        <span className="text-xs px-2 py-1 bg-red-50 text-red-700 rounded-lg font-medium">
                          High: {risk.HIGH ?? 0}
                        </span>
                        <span className="text-xs px-2 py-1 bg-amber-50 text-amber-700 rounded-lg font-medium">
                          Medium: {risk.MEDIUM ?? 0}
                        </span>
                        <span className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded-lg font-medium">
                          Normal: {(risk.NORMAL ?? 0) + (risk.LOW ?? 0)}
                        </span>
                      </div>
                    )}

                    {/* AI summary */}
                    {d.aiNarrative && (
                      <p className="text-xs text-gray-500 mt-2 line-clamp-2 leading-relaxed">
                        {d.aiNarrative}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 shrink-0">
                    {d.status === "DRAFT" && (
                      <button
                        onClick={() => generateMut.mutate(d.id)}
                        disabled={generateMut.isPending}
                        className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-xs font-semibold hover:bg-violet-700 disabled:opacity-50 transition"
                      >
                        {generateMut.isPending ? (
                          <><Loader2 className="w-3 h-3 animate-spin" /> Generating...</>
                        ) : (
                          <><Sparkles className="w-3.5 h-3.5" /> Generate with AI</>
                        )}
                      </button>
                    )}

                    {d.status === "GENERATING" && (
                      <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Generating...
                      </div>
                    )}

                    {(d.status === "READY" || d.status === "PUBLISHED") && (
                      <>
                        <button
                          onClick={() => window.open(getShareUrl(d), "_blank")}
                          className="flex items-center gap-2 px-4 py-2 bg-teal-700 text-white rounded-lg text-xs font-semibold hover:bg-teal-800"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> View Dashboard
                        </button>
                        <button
                          onClick={() => copyShareLink(d)}
                          className="flex items-center gap-2 px-4 py-2 border rounded-lg text-xs font-medium hover:bg-gray-50"
                        >
                          <Copy className="w-3.5 h-3.5" /> Copy Link
                        </button>
                        <button
                          onClick={() => setPreviewId(d.id)}
                          className="flex items-center gap-2 px-4 py-2 border rounded-lg text-xs font-medium hover:bg-gray-50"
                        >
                          <Eye className="w-3.5 h-3.5" /> Preview
                        </button>
                        {d.status === "READY" && (
                          <button
                            onClick={() => publishMut.mutate(d.id)}
                            disabled={publishMut.isPending}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"
                          >
                            <Rocket className="w-3.5 h-3.5" /> Publish
                          </button>
                        )}
                        <button
                          onClick={() => generateMut.mutate(d.id)}
                          disabled={generateMut.isPending}
                          className="flex items-center gap-2 px-4 py-2 border rounded-lg text-xs font-medium hover:bg-gray-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Regenerate
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => {
                        if (confirm("Delete this dashboard?")) deleteMut.mutate(d.id);
                      }}
                      className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-500 rounded-lg text-xs hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create Modal ───────────────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">New Wellness Dashboard</h2>
              <button onClick={() => setShowCreate(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Dashboard Title *</label>
                <input
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                  placeholder="e.g. Q1 2026 Health Assessment"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Corporate Name *</label>
                <input
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                  placeholder="e.g. Tata Consultancy Services"
                  value={form.corporateName}
                  onChange={(e) => setForm({ ...form, corporateName: e.target.value })}
                />
              </div>

              <div className="relative">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Organisation (optional)
                </label>
                {form.organizationId ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-teal-50 border border-teal-200 rounded-lg">
                    <Building2 className="w-4 h-4 text-teal-600" />
                    <span className="text-sm text-teal-800 flex-1">{selectedOrgName || form.corporateName}</span>
                    <button
                      onClick={() => { setForm({ ...form, organizationId: "" }); setSelectedOrgName(""); }}
                      className="text-teal-600 hover:text-teal-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <input
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                    placeholder="Search organisations..."
                    value={orgSearch}
                    onChange={(e) => handleOrgSearch(e.target.value)}
                    onFocus={() => orgResults.length > 0 && setOrgDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setOrgDropdownOpen(false), 200)}
                  />
                )}
                {orgDropdownOpen && orgResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {orgResults.map((o) => (
                      <button
                        key={o.id}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm"
                        onMouseDown={() => {
                          setForm({ ...form, organizationId: o.id, corporateName: form.corporateName || o.name });
                          setSelectedOrgName(o.name);
                          setOrgDropdownOpen(false);
                        }}
                      >
                        {o.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Camp From *</label>
                  <input
                    type="date"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                    value={form.campDateFrom}
                    onChange={(e) => setForm({ ...form, campDateFrom: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Camp To *</label>
                  <input
                    type="date"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                    value={form.campDateTo}
                    onChange={(e) => setForm({ ...form, campDateTo: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 p-5 border-t border-slate-100">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => createMut.mutate()}
                disabled={!form.title || !form.corporateName || !form.campDateFrom || !form.campDateTo || createMut.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800 text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {createMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Preview Modal ──────────────────────────────────────────── */}
      {previewId && previewDashboard && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-teal-600" />
                <h2 className="font-semibold text-slate-800">{previewDashboard.title}</h2>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${(STATUS_STYLES[previewDashboard.status] ?? STATUS_STYLES.DRAFT).cls}`}>
                  {(STATUS_STYLES[previewDashboard.status] ?? STATUS_STYLES.DRAFT).label}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {previewDashboard.shareToken && (
                  <button
                    onClick={() => copyShareLink(previewDashboard)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy Link
                  </button>
                )}
                <button onClick={() => setPreviewId(null)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              {previewDashboard.htmlContent ? (
                <iframe
                  srcDoc={previewDashboard.htmlContent}
                  className="w-full h-full min-h-[600px] border-0"
                  title="Wellness Dashboard Preview"
                />
              ) : (
                <div className="flex items-center justify-center h-64 text-slate-400">
                  No content generated yet
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
