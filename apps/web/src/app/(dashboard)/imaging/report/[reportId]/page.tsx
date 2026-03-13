"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Save, Send, CheckCircle2, Loader2, ArrowLeft, FileText,
  Download, Eye, Sparkles, ChevronDown, ChevronUp, AlertCircle,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface ReportSection {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  subsections?: Array<{ id: string; label: string; type: string }>;
}

interface Template {
  id: string;
  templateName: string;
  investigationType: string;
  methodology: string;
  sections: ReportSection[];
  isDefault?: boolean;
}

interface Report {
  id: string;
  testName: string;
  testCode: string | null;
  investigationType: string;
  methodology: string;
  status: string;
  clinicalHistory: string | null;
  technique: string | null;
  findings: string | null;
  impression: string | null;
  recommendation: string | null;
  sectionData: Record<string, string> | null;
  contrast: boolean;
  contrastDose: string | null;
  equipmentUsed: string | null;
  imageCount: number | null;
  reportedByName: string | null;
  reportedByDesig: string | null;
  reportedAt: string | null;
  verifiedByName: string | null;
  verifiedAt: string | null;
  templateId: string | null;
  template: Template | null;
  patient: {
    id: string;
    mrn: string;
    firstName: string;
    lastName: string;
    dob: string | null;
    gender: string;
    phone: string | null;
    email: string | null;
  };
  order: {
    id: string;
    orderNumber: string;
    createdAt: string;
    notes: string | null;
  };
}

interface PreviousReport {
  id: string;
  testName: string;
  investigationType: string;
  impression: string | null;
  reportedAt: string | null;
  createdAt: string;
  order: { orderNumber: string };
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "Draft", cls: "bg-yellow-100 text-yellow-700" },
  PENDING_VERIFICATION: { label: "Pending Verification", cls: "bg-blue-100 text-blue-700" },
  VERIFIED: { label: "Verified ✓", cls: "bg-teal-100 text-teal-700" },
  DISPATCHED: { label: "Dispatched", cls: "bg-green-100 text-green-700" },
};

// ── Section Renderer ─────────────────────────────────────────────────────────

function SectionField({
  section,
  value,
  onChange,
  readOnly,
}: {
  section: ReportSection;
  value: string;
  onChange: (val: string) => void;
  readOnly: boolean;
}) {
  if (section.type === "richtext" || section.type === "text") {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        rows={section.type === "richtext" ? 4 : 2}
        placeholder={section.placeholder ?? `Enter ${section.label.toLowerCase()}...`}
        className={cn(
          "w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition",
          readOnly ? "bg-slate-50 text-slate-600" : "bg-white"
        )}
      />
    );
  }
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      readOnly={readOnly}
      placeholder={section.placeholder}
      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
    />
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ReportEditorPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const autosaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [sectionData, setSectionData] = useState<Record<string, string>>({});
  const [clinicalHistory, setClinicalHistory] = useState("");
  const [technique, setTechnique] = useState("");
  const [impression, setImpression] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [contrast, setContrast] = useState(false);
  const [contrastDose, setContrastDose] = useState("");
  const [equipmentUsed, setEquipmentUsed] = useState("");
  const [reportedByName, setReportedByName] = useState("");
  const [reportedByDesig, setReportedByDesig] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [showPrevious, setShowPrevious] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiLoaded, setAiLoaded] = useState(false);
  const [dispatchModal, setDispatchModal] = useState(false);
  const [verifyComment, setVerifyComment] = useState("");
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [autoSavedAt, setAutoSavedAt] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // ── Data Fetching ──────────────────────────────────────────────────────────

  const { data: report, isLoading } = useQuery<Report>({
    queryKey: ["non-path-report", reportId],
    queryFn: async () => {
      const res = await api.get(`/non-path/report/${reportId}`);
      return res.data?.data ?? res.data;
    },
  });

  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ["non-path-templates", report?.investigationType],
    queryFn: async () => {
      const res = await api.get("/non-path/templates", {
        params: { type: report?.investigationType },
      });
      return res.data?.data ?? res.data ?? [];
    },
    enabled: !!report?.investigationType,
  });

  const { data: previousReports = [] } = useQuery<PreviousReport[]>({
    queryKey: ["non-path-previous", reportId],
    queryFn: async () => {
      const res = await api.get(`/non-path/report/${reportId}/previous`);
      return res.data?.data ?? res.data ?? [];
    },
    enabled: !!reportId,
  });

  // Populate form when report loads
  useEffect(() => {
    if (!report) return;
    setClinicalHistory(report.clinicalHistory ?? "");
    setTechnique(report.technique ?? "");
    setImpression(report.impression ?? "");
    setRecommendation(report.recommendation ?? "");
    setContrast(report.contrast ?? false);
    setContrastDose(report.contrastDose ?? "");
    setEquipmentUsed(report.equipmentUsed ?? "");
    setReportedByName(report.reportedByName ?? "");
    setReportedByDesig(report.reportedByDesig ?? "");
    setSelectedTemplateId(report.templateId);
    setSectionData((report.sectionData ?? {}) as Record<string, string>);
  }, [report]);

  // Auto-select default or only template when templates load and no template is selected
  useEffect(() => {
    if (!templates.length || selectedTemplateId) return;
    // Prefer the default template, fallback to first one if only one exists
    const defaultTmpl = templates.find((t) => t.isDefault) ?? (templates.length === 1 ? templates[0] : null);
    if (defaultTmpl) {
      setSelectedTemplateId(defaultTmpl.id);
    }
  }, [templates, selectedTemplateId]);

  // Pre-fill technique default when template selected
  useEffect(() => {
    const tmpl = templates.find((t) => t.id === selectedTemplateId);
    if (!tmpl) return;
    const techSection = (tmpl.sections as ReportSection[]).find((s) => s.id === "technique");
    if (techSection?.defaultValue && !technique) {
      setTechnique(techSection.defaultValue);
    }
  }, [selectedTemplateId, templates, technique]);

  // ── Autosave ───────────────────────────────────────────────────────────────

  const savePayload = useCallback(() => ({
    clinicalHistory, technique, impression, recommendation,
    contrast, contrastDose, equipmentUsed,
    reportedByName, reportedByDesig,
    sectionData, templateId: selectedTemplateId,
  }), [clinicalHistory, technique, impression, recommendation, contrast, contrastDose, equipmentUsed, reportedByName, reportedByDesig, sectionData, selectedTemplateId]);

  const saveReport = useCallback(async (silent = false) => {
    if (!reportId || report?.status !== "DRAFT") return;
    try {
      setIsSaving(true);
      await api.patch(`/non-path/report/${reportId}`, savePayload());
      setAutoSavedAt(new Date());
      if (!silent) toast.success("Saved");
    } catch {
      if (!silent) toast.error("Save failed");
    } finally {
      setIsSaving(false);
    }
  }, [reportId, report?.status, savePayload]);

  const scheduleAutosave = useCallback(() => {
    if (autosaveRef.current) clearTimeout(autosaveRef.current);
    autosaveRef.current = setTimeout(() => saveReport(true), 2000);
  }, [saveReport]);

  const handleFieldChange = useCallback(<T extends string | boolean>(setter: React.Dispatch<React.SetStateAction<T>>, val: T) => {
    setter(val);
    scheduleAutosave();
  }, [scheduleAutosave]);

  const handleSectionDataChange = useCallback((key: string, val: string) => {
    setSectionData((prev) => ({ ...prev, [key]: val }));
    scheduleAutosave();
  }, [scheduleAutosave]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const submitMutation = useMutation({
    mutationFn: async () => {
      await saveReport(true);
      const res = await api.post(`/non-path/report/${reportId}/submit`, { reportedByDesig });
      return res.data?.data ?? res.data;
    },
    onSuccess: () => {
      toast.success("Report submitted for verification");
      qc.invalidateQueries({ queryKey: ["non-path-report", reportId] });
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Submit failed"),
  });

  const verifyMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/non-path/report/${reportId}/verify`, { comment: verifyComment });
      return res.data?.data ?? res.data;
    },
    onSuccess: () => {
      toast.success("Report verified and finalised");
      setShowVerifyModal(false);
      qc.invalidateQueries({ queryKey: ["non-path-report", reportId] });
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Verify failed"),
  });

  const reopenMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/non-path/report/${reportId}/reopen`);
      return res.data?.data ?? res.data;
    },
    onSuccess: () => {
      toast.success("Report reopened");
      qc.invalidateQueries({ queryKey: ["non-path-report", reportId] });
    },
  });

  const dispatchMutation = useMutation({
    mutationFn: async (channel: string) => {
      const res = await api.post(`/non-path/report/${reportId}/dispatch`, { channel });
      return res.data?.data ?? res.data;
    },
    onSuccess: () => {
      toast.success("Report dispatched");
      setDispatchModal(false);
      qc.invalidateQueries({ queryKey: ["non-path-report", reportId] });
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Dispatch failed"),
  });

  // ── AI Suggest ──────────────────────────────────────────────────────────────

  const handleAiSuggest = async () => {
    setAiLoading(true);
    try {
      const res = await api.get(`/non-path/report/${reportId}/ai-suggest`);
      const suggested: Record<string, string> = res.data?.data?.suggestedFindings ?? res.data?.suggestedFindings ?? {};
      if (Object.keys(suggested).length > 0) {
        setSectionData((prev) => ({ ...prev, ...suggested }));
        setAiLoaded(true);
        toast.success("AI-suggested normal findings loaded. Please review before submitting.", { duration: 5000 });
        scheduleAutosave();
      }
    } catch {
      toast.error("AI suggestion unavailable");
    } finally {
      setAiLoading(false);
    }
  };

  // ── Active template ────────────────────────────────────────────────────────

  const activeTemplate = templates.find((t) => t.id === selectedTemplateId) ?? report?.template ?? null;
  const sections = (activeTemplate?.sections ?? []) as ReportSection[];

  const isReadOnly = report?.status !== "DRAFT";
  const ageYears = report?.patient.dob
    ? Math.floor((Date.now() - new Date(report.patient.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-purple-500" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <AlertCircle className="h-12 w-12 text-red-400" />
        <p className="text-red-500 font-medium">Report not found</p>
        <button onClick={() => router.back()} className="text-sm text-slate-600 underline">Go back</button>
      </div>
    );
  }

  const statusConfig = STATUS_LABEL[report.status] ?? STATUS_LABEL.DRAFT;
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-slate-100">
            <ArrowLeft className="h-4 w-4 text-slate-500" />
          </button>
          <div>
            <p className="font-semibold text-slate-900 text-sm">{report.testName}</p>
            <p className="text-xs text-slate-400">
              {report.patient.firstName} {report.patient.lastName} · MRN: {report.patient.mrn} · Order: {report.order.orderNumber}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", statusConfig.cls)}>{statusConfig.label}</span>
          {isSaving && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
          {autoSavedAt && !isSaving && (
            <span className="text-xs text-slate-400">
              Saved {autoSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-1 gap-0 overflow-hidden">
        {/* LEFT: Form */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Patient Info Strip */}
          <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><span className="text-slate-400 text-xs">Patient</span><p className="font-semibold">{report.patient.firstName} {report.patient.lastName}</p></div>
              <div><span className="text-slate-400 text-xs">Age / Gender</span><p className="font-semibold">{ageYears ? `${ageYears}Y` : "—"} / {report.patient.gender}</p></div>
              <div><span className="text-slate-400 text-xs">Order</span><p className="font-semibold">{report.order.orderNumber}</p></div>
              <div><span className="text-slate-400 text-xs">Methodology</span><p className="font-semibold">{report.methodology}</p></div>
            </div>
          </div>

          {/* Template Selector */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Report Template</label>
            <select
              value={selectedTemplateId ?? ""}
              onChange={(e) => {
                setSelectedTemplateId(e.target.value || null);
                scheduleAutosave();
              }}
              disabled={isReadOnly}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
            >
              <option value="">— No template (free-form) —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.templateName}{t.id === report.templateId ? " (current)" : ""}</option>
              ))}
            </select>
          </div>

          {/* Clinical History */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Clinical History</label>
            <textarea
              value={clinicalHistory}
              onChange={(e) => handleFieldChange(setClinicalHistory, e.target.value)}
              readOnly={isReadOnly}
              rows={3}
              placeholder="Enter relevant clinical history and indication..."
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-purple-500/30"
            />
          </div>

          {/* Technique */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Technique</label>
            <textarea
              value={technique}
              onChange={(e) => handleFieldChange(setTechnique, e.target.value)}
              readOnly={isReadOnly}
              rows={3}
              placeholder="Describe technique used..."
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-purple-500/30"
            />
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={contrast} onChange={(e) => handleFieldChange(setContrast, e.target.checked)} disabled={isReadOnly} className="rounded" />
                <span className="text-slate-600">Contrast used</span>
              </label>
              {contrast && (
                <input
                  value={contrastDose}
                  onChange={(e) => handleFieldChange(setContrastDose, e.target.value)}
                  readOnly={isReadOnly}
                  placeholder="Dose / volume..."
                  className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-1"
                />
              )}
              <input
                value={equipmentUsed}
                onChange={(e) => handleFieldChange(setEquipmentUsed, e.target.value)}
                readOnly={isReadOnly}
                placeholder="Equipment (e.g. Siemens 128-slice)"
                className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-1"
              />
            </div>
          </div>

          {/* Dynamic Findings Sections */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Findings</label>
              {!isReadOnly && (
                <button
                  onClick={handleAiSuggest}
                  disabled={aiLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition"
                >
                  {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  AI Suggest Normal
                </button>
              )}
            </div>

            {aiLoaded && (
              <div className="flex items-start gap-2 p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-700">
                <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>AI-suggested normal findings loaded. Please review and edit before submitting — these are suggestions only.</span>
              </div>
            )}

            {sections.filter((s) => !["impression", "recommendation", "clinicalHistory", "technique", "gestationalAge"].includes(s.id)).map((section) => (
              <div key={section.id} className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1">
                  {section.label}
                  {section.required && <span className="text-red-500 text-xs">*</span>}
                </h3>
                {section.subsections?.length ? (
                  <div className="space-y-2 pl-4 border-l-2 border-slate-100">
                    {section.subsections.map((sub) => (
                      <div key={sub.id}>
                        <label className="block text-xs text-slate-500 mb-1">{sub.label}</label>
                        <SectionField
                          section={{ ...sub, required: false }}
                          value={sectionData[`${section.id}.${sub.id}`] ?? sectionData[sub.id] ?? ""}
                          onChange={(v) => handleSectionDataChange(`${section.id}.${sub.id}`, v)}
                          readOnly={isReadOnly}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <SectionField
                    section={section}
                    value={sectionData[section.id] ?? ""}
                    onChange={(v) => handleSectionDataChange(section.id, v)}
                    readOnly={isReadOnly}
                  />
                )}
              </div>
            ))}

            {/* Fallback free-form findings if no template */}
            {sections.length === 0 && (
              <textarea
                value={sectionData["findings"] ?? ""}
                onChange={(e) => handleSectionDataChange("findings", e.target.value)}
                readOnly={isReadOnly}
                rows={6}
                placeholder="Describe findings..."
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-purple-500/30"
              />
            )}
          </div>

          {/* Impression — highlighted box */}
          <div className="bg-white rounded-xl border-2 border-purple-200 border-l-4 border-l-purple-500 p-5">
            <label className="block text-xs font-bold text-purple-700 uppercase tracking-wide mb-2">
              Impression / Conclusion <span className="text-red-500">*</span>
            </label>
            <textarea
              value={impression}
              onChange={(e) => handleFieldChange(setImpression, e.target.value)}
              readOnly={isReadOnly}
              rows={5}
              placeholder="Enter the radiological impression / clinical conclusion..."
              className="w-full text-sm border border-purple-100 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-purple-500/40 bg-purple-50/30 font-medium"
            />
            <p className="text-xs text-slate-400 mt-1 text-right">{impression.length} chars</p>
          </div>

          {/* Recommendations */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Recommendations</label>
            <textarea
              value={recommendation}
              onChange={(e) => handleFieldChange(setRecommendation, e.target.value)}
              readOnly={isReadOnly}
              rows={2}
              placeholder="Optional: further imaging, clinical correlation..."
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-purple-500/30"
            />
          </div>

          {/* Reporting Doctor */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Reporting Doctor</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Name</label>
                <input
                  value={reportedByName}
                  onChange={(e) => handleFieldChange(setReportedByName, e.target.value)}
                  readOnly={isReadOnly}
                  placeholder="Dr. Name"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Designation</label>
                <input
                  value={reportedByDesig}
                  onChange={(e) => handleFieldChange(setReportedByDesig, e.target.value)}
                  readOnly={isReadOnly}
                  placeholder="MBBS, MD Radiology"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
                />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Preview + Actions */}
        <div className="w-80 xl:w-96 border-l border-slate-200 bg-white flex flex-col overflow-y-auto shrink-0">
          {/* Action Buttons */}
          <div className="p-4 border-b border-slate-100 space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Actions</p>

            {report.status === "DRAFT" && (
              <>
                <button
                  onClick={() => saveReport(false)}
                  disabled={isSaving}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Draft
                </button>
                <button
                  onClick={() => submitMutation.mutate()}
                  disabled={!impression || submitMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Submit for Verification
                </button>
              </>
            )}

            {report.status === "PENDING_VERIFICATION" && (
              <>
                <button
                  onClick={() => setShowVerifyModal(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Verify & Finalise
                </button>
                <button
                  onClick={() => reopenMutation.mutate()}
                  disabled={reopenMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
                >
                  Return for Correction
                </button>
              </>
            )}

            {report.status === "VERIFIED" && (
              <button
                onClick={() => setDispatchModal(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 transition"
              >
                Dispatch Report
              </button>
            )}

            {/* PDF Links */}
            <a
              href={`${apiBase}/non-path/report/${reportId}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </a>
            <a
              href={`${apiBase}/non-path/report/${reportId}/preview-html`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-600 bg-slate-50 rounded-lg hover:bg-slate-100 transition"
            >
              <Eye className="h-4 w-4" />
              Preview Report
            </a>
          </div>

          {/* Report Info */}
          <div className="p-4 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Study Info</p>
            <div className="space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between"><span className="text-slate-400">Test</span><span className="font-medium text-right max-w-[150px] truncate">{report.testName}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Category</span><span className="font-medium">{report.investigationType}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Method</span><span className="font-medium">{report.methodology}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Registered</span><span>{new Date(report.order.createdAt).toLocaleDateString("en-IN")}</span></div>
              {report.reportedByName && <div className="flex justify-between"><span className="text-slate-400">Reported by</span><span className="font-medium">{report.reportedByName}</span></div>}
              {report.verifiedByName && <div className="flex justify-between"><span className="text-slate-400">Verified by</span><span className="font-medium">{report.verifiedByName}</span></div>}
            </div>
          </div>

          {/* Previous Reports Accordion */}
          {previousReports.length > 0 && (
            <div className="p-4">
              <button
                onClick={() => setShowPrevious(!showPrevious)}
                className="w-full flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2"
              >
                <span>Previous Studies ({previousReports.length})</span>
                {showPrevious ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
              {showPrevious && (
                <div className="space-y-2">
                  {previousReports.map((pr) => (
                    <div key={pr.id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                      <p className="text-xs font-medium text-slate-700">{pr.testName}</p>
                      <p className="text-xs text-slate-400">{pr.order.orderNumber} · {new Date(pr.createdAt).toLocaleDateString("en-IN")}</p>
                      {pr.impression && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2 italic">{pr.impression}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Verify Modal */}
      {showVerifyModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">Verify & Finalise Report</h3>
            <p className="text-sm text-slate-600">You are verifying and finalising this report. Please review all sections before proceeding.</p>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Verifier Comment (optional)</label>
              <textarea
                value={verifyComment}
                onChange={(e) => setVerifyComment(e.target.value)}
                rows={3}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
                placeholder="Any additional comments..."
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowVerifyModal(false)} className="flex-1 px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
              <button
                onClick={() => verifyMutation.mutate()}
                disabled={verifyMutation.isPending}
                className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 flex items-center justify-center gap-2"
              >
                {verifyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Verify Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispatch Modal */}
      {dispatchModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">Dispatch Report</h3>
            <p className="text-sm text-slate-600">Select delivery channel for the report:</p>
            <div className="grid grid-cols-2 gap-3">
              {["WHATSAPP", "EMAIL", "BOTH", "DOWNLOAD"].map((ch) => (
                <button
                  key={ch}
                  onClick={() => dispatchMutation.mutate(ch)}
                  disabled={dispatchMutation.isPending}
                  className="px-4 py-3 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 transition"
                >
                  {ch === "WHATSAPP" ? "📱 WhatsApp" : ch === "EMAIL" ? "📧 Email" : ch === "BOTH" ? "📤 Both" : "⬇ Download"}
                </button>
              ))}
            </div>
            <button onClick={() => setDispatchModal(false)} className="w-full px-4 py-2 text-sm text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
