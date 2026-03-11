"use client";

import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Upload,
  X,
  Loader2,
  Save,
  Eye,
  EyeOff,
  FileText,
  Image as ImageIcon,
  Plus,
  Pencil,
  Trash2,
  Star,
  LayoutTemplate,
  Sparkles,
  CheckCircle,
  RotateCcw,
  Search,
  AlertTriangle,
  RefreshCw,
  FlaskConical,
  BarChart3,
  Play,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

// ── Types ──────────────────────────────────────────────────────────────────

interface ReportSettings {
  reportHeaderHtml: string | null;
  reportFooterHtml: string | null;
  reportHeaderImageUrl: string | null;
  reportFooterImageUrl: string | null;
  showHeaderFooter: boolean;
  name: string;
}

// ── Template Types ─────────────────────────────────────────────────────────

type TemplateType = "STANDARD" | "LETTERHEAD" | "MINIMAL" | "DETAILED";

interface ReportTemplate {
  id: string;
  name: string;
  type: TemplateType;
  isDefault: boolean;
  headerHtml: string;
  footerHtml: string;
  showLetterhead: boolean;
  showWatermark: boolean;
  showQRCode: boolean;
  paperSize: string;
  margins: { top: number; right: number; bottom: number; left: number };
  font: string;
  fontSize: number;
  lineHeight: number;
  createdAt: string;
  updatedAt: string;
}

interface TemplateForm {
  name: string;
  type: TemplateType;
  headerHtml: string;
  footerHtml: string;
  showLetterhead: boolean;
  showWatermark: boolean;
  showQRCode: boolean;
  paperSize: string;
  margins: { top: number; right: number; bottom: number; left: number };
  font: string;
  fontSize: number;
  lineHeight: number;
}

const EMPTY_FORM: TemplateForm = {
  name: "",
  type: "STANDARD",
  headerHtml: "",
  footerHtml: "",
  showLetterhead: true,
  showWatermark: false,
  showQRCode: true,
  paperSize: "A4",
  margins: { top: 20, right: 15, bottom: 20, left: 15 },
  font: "Helvetica",
  fontSize: 10,
  lineHeight: 1.5,
};

const TEMPLATE_TYPES: TemplateType[] = ["STANDARD", "LETTERHEAD", "MINIMAL", "DETAILED"];
const PAPER_SIZES = ["A4", "A5", "Letter"];

const TYPE_COLORS: Record<TemplateType, string> = {
  STANDARD: "bg-blue-100 text-blue-700",
  LETTERHEAD: "bg-purple-100 text-purple-700",
  MINIMAL: "bg-slate-100 text-slate-700",
  DETAILED: "bg-teal-100 text-teal-700",
};

const TYPE_ICONS: Record<TemplateType, string> = {
  STANDARD: "bg-blue-50 border-blue-200",
  LETTERHEAD: "bg-purple-50 border-purple-200",
  MINIMAL: "bg-slate-50 border-slate-200",
  DETAILED: "bg-teal-50 border-teal-200",
};

// ── Tab type ────────────────────────────────────────────────────────────────

type Tab = "header-footer" | "templates" | "default-templates" | "param-templates";

// ── Parameter Stats Types ────────────────────────────────────────────────────

interface ParamStats {
  total: number;
  withParams: number;
  withoutParams: number;
  percentComplete: number;
  byCategory: { category: string; count: number }[];
  recentlySeeded: {
    id: string;
    code: string;
    name: string;
    category: string | null;
    department: string | null;
    paramCount: number;
    isTemplateComplete: boolean;
  }[];
}

interface SeedParamResult {
  seeded: number;
  skipped: number;
  total: number;
  details: { code: string; name: string; action: string; paramCount: number }[];
}

// ── AI Generator Types ──────────────────────────────────────────────────────

type GeneratorJobStatus = 'NOT_STARTED' | 'RUNNING' | 'COMPLETED' | 'FAILED';

interface GeneratorStatus {
  status: GeneratorJobStatus;
  totalTests: number;
  processed: number;
  failed: number;
  progressPercent: number;
  startedAt: string | null;
  completedAt: string | null;
  failedTests: { testCode: string; testName: string; error: string }[];
}

interface TestReportTemplate {
  id: string;
  testId: string;
  testCode: string;
  testName: string;
  status: string;
  isAiGenerated: boolean;
  isCustomized: boolean;
  referenceRanges: unknown;
  methodology: string | null;
  specimenRequirement: string | null;
  patientPreparation: string | null;
  supplementaryNotes: string | null;
  clinicalSignificance: string | null;
  aiGeneratedAt: string | null;
}

export default function ReportSettingsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("header-footer");

  // ── Header/Footer state ────────────────────────────────────────────────
  const [headerHtml, setHeaderHtml] = useState("");
  const [footerHtml, setFooterHtml] = useState("");
  const [headerImageUrl, setHeaderImageUrl] = useState("");
  const [footerImageUrl, setFooterImageUrl] = useState("");
  const [showHeaderFooter, setShowHeaderFooter] = useState(true);
  const [loaded, setLoaded] = useState(false);

  const headerInputRef = useRef<HTMLInputElement>(null);
  const footerInputRef = useRef<HTMLInputElement>(null);

  // ── AI Default Templates state ─────────────────────────────────────────
  const [dtSearch, setDtSearch] = useState("");
  const [dtEditTarget, setDtEditTarget] = useState<TestReportTemplate | null>(null);
  const [dtEditForm, setDtEditForm] = useState<{
    referenceRanges: string;
    methodology: string;
    specimenRequirement: string;
    patientPreparation: string;
    supplementaryNotes: string;
    clinicalSignificance: string;
  }>({ referenceRanges: "[]", methodology: "", specimenRequirement: "", patientPreparation: "", supplementaryNotes: "", clinicalSignificance: "" });

  // ── Template state ─────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ReportTemplate | null>(null);
  const [form, setForm] = useState<TemplateForm>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<ReportTemplate | null>(null);
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiSummary, setAiSummary] = useState("");
  const [showPreviewHeader, setShowPreviewHeader] = useState(false);
  const [showPreviewFooter, setShowPreviewFooter] = useState(false);

  // ── Fetch report settings ─────────────────────────────────────────────

  const { data: settings, isLoading } = useQuery<ReportSettings>({
    queryKey: ["report-settings"],
    queryFn: async () => {
      const res = await api.get("/tenants/report-settings");
      return (res.data?.data ?? res.data) as ReportSettings;
    },
  });

  // Sync state from fetched settings (once)
  if (settings && !loaded) {
    setHeaderHtml(settings.reportHeaderHtml || "");
    setFooterHtml(settings.reportFooterHtml || "");
    setHeaderImageUrl(settings.reportHeaderImageUrl || "");
    setFooterImageUrl(settings.reportFooterImageUrl || "");
    setShowHeaderFooter(settings.showHeaderFooter);
    setLoaded(true);
  }

  // ── Fetch templates ───────────────────────────────────────────────────

  const { data: templatesData, isLoading: templatesLoading } = useQuery({
    queryKey: ["report-templates"],
    queryFn: () =>
      api.get("/report-templates").then((r) => r.data.data as ReportTemplate[]),
    enabled: tab === "templates",
  });

  const templates = Array.isArray(templatesData) ? templatesData : [];

  // ── Parameter Stats query ─────────────────────────────────────────────

  const { data: paramStats, isLoading: paramStatsLoading, refetch: refetchParamStats } = useQuery<ParamStats>({
    queryKey: ["param-stats"],
    queryFn: () => api.get("/test-catalog/parameter-stats").then((r) => (r.data?.data ?? r.data) as ParamStats),
    enabled: tab === "param-templates",
    staleTime: 30_000,
  });

  const seedParamsMut = useMutation({
    mutationFn: () => api.post("/test-catalog/seed-parameters"),
    onSuccess: (res) => {
      const result = (res.data?.data ?? res.data) as SeedParamResult;
      toast.success(`Seeded ${result.seeded} tests (${result.skipped} skipped)`);
      refetchParamStats();
    },
    onError: () => toast.error("Failed to seed parameters"),
  });

  // ── AI Generator: status query ─────────────────────────────────────────

  const { data: generatorStatus, isLoading: generatorStatusLoading } = useQuery<GeneratorStatus>({
    queryKey: ["report-generator-status"],
    queryFn: async () => {
      const res = await api.get("/report-generator/status");
      return (res.data?.data ?? res.data) as GeneratorStatus;
    },
    enabled: tab === "default-templates",
    staleTime: 10000,
    refetchInterval: (query) => {
      const data = query.state.data as GeneratorStatus | undefined;
      return data?.status === 'RUNNING' ? 5000 : false;
    },
  });

  // ── AI Generator: templates list query ────────────────────────────────

  const { data: dtTemplatesData, isLoading: dtTemplatesLoading } = useQuery<TestReportTemplate[]>({
    queryKey: ["report-generator-templates", dtSearch],
    queryFn: async () => {
      const params = dtSearch ? `?search=${encodeURIComponent(dtSearch)}` : "";
      const res = await api.get(`/report-generator/templates${params}`);
      return (res.data?.data ?? res.data) as TestReportTemplate[];
    },
    enabled: tab === "default-templates" && generatorStatus?.status === "COMPLETED",
  });

  const dtTemplates = Array.isArray(dtTemplatesData) ? dtTemplatesData : [];

  // ── AI Generator: start mutation ──────────────────────────────────────

  const startGeneratorMut = useMutation({
    mutationFn: () => api.post("/report-generator/start"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report-generator-status"] });
      toast.success("Template generation started!");
    },
    onError: () => toast.error("Failed to start generation"),
  });

  // ── AI Generator: update template mutation ────────────────────────────

  const updateDtMut = useMutation({
    mutationFn: ({ testId, dto }: { testId: string; dto: Record<string, unknown> }) =>
      api.patch(`/report-generator/templates/${testId}`, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report-generator-templates"] });
      toast.success("Template updated");
      setDtEditTarget(null);
    },
    onError: () => toast.error("Failed to update template"),
  });

  // ── AI Generator: regenerate one mutation ─────────────────────────────

  const regenerateDtMut = useMutation({
    mutationFn: (testId: string) => api.post(`/report-generator/templates/${testId}/regenerate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report-generator-templates"] });
      toast.success("Template regenerated");
    },
    onError: () => toast.error("Failed to regenerate"),
  });

  function openDtEdit(tpl: TestReportTemplate) {
    setDtEditTarget(tpl);
    setDtEditForm({
      referenceRanges: JSON.stringify(tpl.referenceRanges ?? [], null, 2),
      methodology: tpl.methodology ?? "",
      specimenRequirement: tpl.specimenRequirement ?? "",
      patientPreparation: tpl.patientPreparation ?? "",
      supplementaryNotes: tpl.supplementaryNotes ?? "",
      clinicalSignificance: tpl.clinicalSignificance ?? "",
    });
  }

  function handleDtSave() {
    if (!dtEditTarget) return;
    let parsedRanges: unknown = [];
    try {
      parsedRanges = JSON.parse(dtEditForm.referenceRanges);
    } catch {
      toast.error("Invalid JSON in reference ranges");
      return;
    }
    updateDtMut.mutate({
      testId: dtEditTarget.testId,
      dto: {
        referenceRanges: parsedRanges,
        methodology: dtEditForm.methodology || null,
        specimenRequirement: dtEditForm.specimenRequirement || null,
        patientPreparation: dtEditForm.patientPreparation || null,
        supplementaryNotes: dtEditForm.supplementaryNotes || null,
        clinicalSignificance: dtEditForm.clinicalSignificance || null,
      },
    });
  }

  // ── Save settings mutation ────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await api.put("/tenants/report-settings", {
        reportHeaderHtml: headerHtml || null,
        reportFooterHtml: footerHtml || null,
        reportHeaderImageUrl: headerImageUrl || null,
        reportFooterImageUrl: footerImageUrl || null,
        showHeaderFooter,
      });
      return (res.data?.data ?? res.data) as ReportSettings;
    },
    onSuccess: () => {
      toast.success("Report settings saved");
      queryClient.invalidateQueries({ queryKey: ["report-settings"] });
    },
    onError: () => toast.error("Failed to save settings"),
  });

  // ── Template mutations ────────────────────────────────────────────────

  const createMut = useMutation({
    mutationFn: (dto: TemplateForm) => api.post("/report-templates", dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report-templates"] });
      toast.success("Template created successfully");
      closeModal();
    },
    onError: () => toast.error("Failed to create template"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: TemplateForm }) =>
      api.put(`/report-templates/${id}`, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report-templates"] });
      toast.success("Template updated successfully");
      closeModal();
    },
    onError: () => toast.error("Failed to update template"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/report-templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report-templates"] });
      toast.success("Template deleted");
      setDeleteTarget(null);
    },
    onError: () => toast.error("Failed to delete template"),
  });

  const setDefaultMut = useMutation({
    mutationFn: (id: string) => api.put(`/report-templates/${id}/default`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report-templates"] });
      toast.success("Default template updated");
    },
    onError: () => toast.error("Failed to set default"),
  });

  // ── Image upload ──────────────────────────────────────────────────────

  const uploadImage = useCallback(
    async (file: File, type: "header" | "footer") => {
      const formData = new FormData();
      formData.append("file", file);
      try {
        const res = await api.post(`/tenants/upload-report-image?type=${type}`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        const data = (res.data?.data ?? res.data) as { url: string };
        if (type === "header") setHeaderImageUrl(data.url);
        else setFooterImageUrl(data.url);
        toast.success(`${type === "header" ? "Header" : "Footer"} image uploaded`);
      } catch {
        toast.error("Upload failed");
      }
    },
    [],
  );

  // ── Template helpers ──────────────────────────────────────────────────

  function openCreate() {
    setEditingTemplate(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(tpl: ReportTemplate) {
    setEditingTemplate(tpl);
    setForm({
      name: tpl.name,
      type: tpl.type,
      headerHtml: tpl.headerHtml,
      footerHtml: tpl.footerHtml,
      showLetterhead: tpl.showLetterhead,
      showWatermark: tpl.showWatermark,
      showQRCode: tpl.showQRCode,
      paperSize: tpl.paperSize,
      margins: tpl.margins ?? { top: 20, right: 15, bottom: 20, left: 15 },
      font: tpl.font ?? "Helvetica",
      fontSize: tpl.fontSize ?? 10,
      lineHeight: tpl.lineHeight ?? 1.5,
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingTemplate(null);
    setForm(EMPTY_FORM);
    setAiInstruction("");
    setAiSummary("");
    setShowPreviewHeader(false);
    setShowPreviewFooter(false);
  }

  const handleAiGenerate = async (isRebuild = false) => {
    if (!aiInstruction.trim() && !isRebuild) {
      toast.error("Please describe what you want the template to look like");
      return;
    }
    setAiGenerating(true);
    try {
      const res = await api.post("/report-templates/ai-generate", {
        instruction: aiInstruction || "Create a professional standard lab report template",
        templateType: form.type ?? "STANDARD",
        existingHeader: isRebuild ? form.headerHtml : undefined,
        existingFooter: isRebuild ? form.footerHtml : undefined,
      });
      const d = (res.data?.data ?? res.data) as { headerHtml: string; footerHtml: string; summary: string };
      setForm((f) => ({ ...f, headerHtml: d.headerHtml, footerHtml: d.footerHtml }));
      setAiSummary(d.summary);
      toast.success("Template generated successfully");
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Generation failed";
      toast.error(msg);
    } finally {
      setAiGenerating(false);
    }
  };

  function handleSubmit() {
    if (editingTemplate) {
      updateMut.mutate({ id: editingTemplate.id, dto: form });
    } else {
      createMut.mutate(form);
    }
  }

  const isSaving = createMut.isPending || updateMut.isPending;

  // ── Render ────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-[#0D7E8A]" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Report Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Configure how your lab reports look — header, footer, and branding
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {([
          { key: "header-footer" as Tab, label: "Header & Footer" },
          { key: "templates" as Tab, label: "Report Templates" },
          { key: "default-templates" as Tab, label: "Default Templates" },
          { key: "param-templates" as Tab, label: "Parameter Templates" },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-md transition",
              tab === t.key
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── TAB 1: Header & Footer ─────────────────────────────────────── */}
      {tab === "header-footer" && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left Side — Upload options */}
          <div className="lg:col-span-3 space-y-6">
            {/* Show toggle */}
            <div className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl">
              <div>
                <p className="text-sm font-semibold text-slate-800">Show Header & Footer on Reports</p>
                <p className="text-xs text-slate-500">When enabled, your custom header/footer will appear on all generated report PDFs</p>
              </div>
              <button
                onClick={() => setShowHeaderFooter(!showHeaderFooter)}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  showHeaderFooter ? "bg-[#0D7E8A]" : "bg-slate-300"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    showHeaderFooter ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
            </div>

            {/* Report Header Section */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#0D7E8A]" />
                Report Header
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {/* Image upload */}
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-2">Upload Image</p>
                  {headerImageUrl ? (
                    <div className="relative">
                      <img
                        src={headerImageUrl}
                        alt="Header"
                        className="w-full h-20 object-contain border rounded-lg bg-slate-50 p-1"
                      />
                      <button
                        onClick={() => setHeaderImageUrl("")}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center hover:bg-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-20 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-[#0D7E8A] hover:bg-[#0D7E8A]/5 transition">
                      <Upload className="w-4 h-4 text-slate-400" />
                      <span className="text-xs text-slate-400 mt-1">Upload Image</span>
                      <input
                        ref={headerInputRef}
                        type="file"
                        accept=".png,.jpg,.jpeg"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadImage(f, "header");
                        }}
                      />
                    </label>
                  )}
                  <p className="text-[10px] text-slate-400 mt-1">Recommended: 1200×200px · PNG, JPEG</p>
                </div>

                {/* HTML option */}
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-2">Or custom HTML</p>
                  <textarea
                    value={headerHtml}
                    onChange={(e) => setHeaderHtml(e.target.value)}
                    placeholder="<div>Your header content...</div>"
                    rows={4}
                    className="w-full text-xs font-mono border border-slate-200 rounded-lg p-2 resize-none focus:ring-1 focus:ring-[#0D7E8A] focus:border-[#0D7E8A] outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">HTML will be rendered inside the report PDF</p>
                </div>
              </div>
            </div>

            {/* Report Footer Section */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#0D7E8A]" />
                Report Footer
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {/* Image upload */}
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-2">Upload Image</p>
                  {footerImageUrl ? (
                    <div className="relative">
                      <img
                        src={footerImageUrl}
                        alt="Footer"
                        className="w-full h-20 object-contain border rounded-lg bg-slate-50 p-1"
                      />
                      <button
                        onClick={() => setFooterImageUrl("")}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center hover:bg-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-20 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-[#0D7E8A] hover:bg-[#0D7E8A]/5 transition">
                      <Upload className="w-4 h-4 text-slate-400" />
                      <span className="text-xs text-slate-400 mt-1">Upload Image</span>
                      <input
                        ref={footerInputRef}
                        type="file"
                        accept=".png,.jpg,.jpeg"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadImage(f, "footer");
                        }}
                      />
                    </label>
                  )}
                  <p className="text-[10px] text-slate-400 mt-1">Recommended: 1200×100px · PNG, JPEG</p>
                </div>

                {/* HTML option */}
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-2">Or custom HTML</p>
                  <textarea
                    value={footerHtml}
                    onChange={(e) => setFooterHtml(e.target.value)}
                    placeholder="<div>Your footer content...</div>"
                    rows={4}
                    className="w-full text-xs font-mono border border-slate-200 rounded-lg p-2 resize-none focus:ring-1 focus:ring-[#0D7E8A] focus:border-[#0D7E8A] outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Save Button */}
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="px-6 py-2.5 bg-[#0D7E8A] text-white text-sm font-medium rounded-lg hover:bg-[#0B6B75] disabled:opacity-50 flex items-center gap-2"
            >
              {saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Settings
            </button>
          </div>

          {/* Right Side — Live Preview */}
          <div className="lg:col-span-2">
            <div className="sticky top-6">
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Live Preview
              </h3>
              <div className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
                <div className="p-3 bg-slate-50 border-b border-slate-200">
                  <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Report Preview (A4 scaled)</p>
                </div>
                <div className="p-4 space-y-3" style={{ fontSize: "8px" }}>
                  {/* Header preview */}
                  {showHeaderFooter && (
                    <div className="border-b border-slate-200 pb-3">
                      {headerImageUrl ? (
                        <img src={headerImageUrl} alt="Header" className="w-full h-12 object-contain" />
                      ) : headerHtml ? (
                        <div
                          className="text-[8px]"
                          dangerouslySetInnerHTML={{ __html: headerHtml }}
                        />
                      ) : (
                        <div className="text-center">
                          <p className="text-[11px] font-bold text-[#0D7E8A]">{settings?.name || "Lab Name"}</p>
                          <p className="text-[7px] text-slate-400">Address Line · Phone · Email</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Sample body */}
                  <div className="space-y-2">
                    <div className="bg-sky-50 border border-sky-200 rounded p-2 grid grid-cols-4 gap-1">
                      {["Patient: John Doe", "MRN: DH-2026-000001", "Age: 32Y / Male", "Phone: +91 9876543210"].map((t) => (
                        <div key={t}>
                          <p className="text-[6px] text-slate-400">{t.split(":")[0]}</p>
                          <p className="text-[7px] font-semibold text-slate-700">{t.split(":")[1]}</p>
                        </div>
                      ))}
                    </div>

                    <p className="text-center text-[9px] font-bold text-slate-700 py-1">LABORATORY TEST REPORT</p>

                    <table className="w-full text-[7px]">
                      <thead>
                        <tr className="bg-[#0D7E8A] text-white">
                          <th className="p-1 text-left">Test</th>
                          <th className="p-1 text-left">Result</th>
                          <th className="p-1 text-left">Range</th>
                          <th className="p-1 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-100">
                          <td className="p-1">Hemoglobin</td>
                          <td className="p-1 font-semibold">13.5 g/dL</td>
                          <td className="p-1">12-16</td>
                          <td className="p-1 text-green-600 font-bold">NORMAL</td>
                        </tr>
                        <tr className="border-b border-slate-100 bg-slate-50">
                          <td className="p-1">Blood Sugar</td>
                          <td className="p-1 font-semibold">210 mg/dL</td>
                          <td className="p-1">70-110</td>
                          <td className="p-1 text-amber-600 font-bold">ABNORMAL</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Footer preview */}
                  {showHeaderFooter && (
                    <div className="border-t border-slate-200 pt-3">
                      {footerImageUrl ? (
                        <img src={footerImageUrl} alt="Footer" className="w-full h-8 object-contain" />
                      ) : footerHtml ? (
                        <div
                          className="text-[8px]"
                          dangerouslySetInnerHTML={{ __html: footerHtml }}
                        />
                      ) : (
                        <div className="text-center">
                          <p className="text-[7px] text-slate-400">This report is for medical use only</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: Report Templates ─────────────────────────────────────── */}
      {tab === "templates" && (
        <div className="space-y-4">
          {/* Tab header actions */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-800">Report Templates</h2>
              <p className="text-sm text-slate-500">Manage report layout templates for lab reports</p>
            </div>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Template
            </button>
          </div>

          {/* Template Grid */}
          {templatesLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
                  <div className="h-32 bg-slate-100 rounded-lg mb-4" />
                  <div className="h-5 w-40 bg-slate-100 rounded mb-2" />
                  <div className="h-4 w-24 bg-slate-100 rounded" />
                </div>
              ))}
            </div>
          ) : templates.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <LayoutTemplate className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-slate-700 mb-1">No templates yet</h3>
              <p className="text-sm text-slate-400 mb-4">Create your first report template to get started.</p>
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" /> Create Template
              </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden group"
                >
                  {/* Preview thumbnail area */}
                  <div className={`h-36 border-b flex items-center justify-center ${TYPE_ICONS[tpl.type]}`}>
                    <div className="w-20 h-28 bg-white rounded shadow-sm border border-slate-200 flex flex-col items-center justify-center gap-1 p-2">
                      <div className="w-full h-1 bg-slate-200 rounded" />
                      <div className="w-3/4 h-1 bg-slate-100 rounded" />
                      <FileText className="w-6 h-6 text-slate-300 mt-1" />
                      <div className="w-full space-y-0.5 mt-1">
                        <div className="w-full h-0.5 bg-slate-100 rounded" />
                        <div className="w-4/5 h-0.5 bg-slate-100 rounded" />
                        <div className="w-3/4 h-0.5 bg-slate-100 rounded" />
                      </div>
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">{tpl.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[tpl.type]}`}>
                            {tpl.type}
                          </span>
                          {tpl.isDefault && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                              <Star className="w-3 h-3" /> Default
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-slate-400 mb-3">
                      {tpl.paperSize} &middot; {tpl.font} {tpl.fontSize}pt
                      {tpl.showLetterhead && " · Letterhead"}
                      {tpl.showQRCode && " · QR Code"}
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                      {!tpl.isDefault && (
                        <button
                          onClick={() => setDefaultMut.mutate(tpl.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
                        >
                          <Star className="w-3 h-3" /> Set Default
                        </button>
                      )}
                      <button
                        onClick={() => openEdit(tpl)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                      >
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(tpl)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors ml-auto"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Create / Edit Modal ─────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-800">
                {editingTemplate ? "Edit Template" : "Create Template"}
              </h3>
              <button onClick={closeModal}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Name & Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Template Name</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Standard Report"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as TemplateType }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {TEMPLATE_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* AI Builder Section */}
              <div className="p-4 bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl border border-violet-200">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 text-violet-600" />
                  <span className="text-sm font-semibold text-violet-800">Build with AI</span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-violet-200 text-violet-700 rounded-full font-medium">Recommended</span>
                </div>
                <p className="text-xs text-violet-600 mb-3">
                  Describe your ideal report template and AI will generate professional HTML header and footer instantly.
                </p>
                <textarea
                  rows={2}
                  className="w-full border border-violet-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400 bg-white resize-none mb-2"
                  placeholder='e.g. "Professional dark teal header with lab logo on left, NABL and ISO badges on right, patient info in a two-column grid. Footer with address, QR code placeholder, and page numbers."'
                  value={aiInstruction}
                  onChange={(e) => setAiInstruction(e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAiGenerate(false)}
                    disabled={aiGenerating}
                    className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 transition"
                  >
                    {aiGenerating ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <><Sparkles className="w-3.5 h-3.5" /> Build Template</>
                    )}
                  </button>
                  {(form.headerHtml || form.footerHtml) && (
                    <button
                      onClick={() => handleAiGenerate(true)}
                      disabled={aiGenerating}
                      className="flex items-center gap-2 px-4 py-2 border border-violet-300 text-violet-700 rounded-lg text-sm font-semibold hover:bg-violet-50 disabled:opacity-50 transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Rebuild
                    </button>
                  )}
                </div>
                {aiSummary && (
                  <p className="mt-2 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg">
                    <CheckCircle className="w-3 h-3 inline mr-1" />
                    {aiSummary}
                  </p>
                )}
              </div>

              {/* Header HTML */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-500">Header HTML</label>
                  {form.headerHtml && (
                    <button
                      onClick={() => setShowPreviewHeader((v) => !v)}
                      className="text-xs text-teal-600 hover:text-teal-800 flex items-center gap-1"
                    >
                      {showPreviewHeader ? <><EyeOff className="w-3 h-3" /> Hide</> : <><Eye className="w-3 h-3" /> Preview</>}
                    </button>
                  )}
                </div>
                <textarea
                  value={form.headerHtml}
                  onChange={(e) => setForm((f) => ({ ...f, headerHtml: e.target.value }))}
                  rows={3}
                  placeholder="<div>Your header content...</div>"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {showPreviewHeader && form.headerHtml && (
                  <div className="mt-2 border rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border-b">
                      <span className="text-xs font-medium text-slate-500">Header Preview</span>
                      <span className="text-[10px] text-slate-400">A4 width scale</span>
                    </div>
                    <div className="p-3 bg-white overflow-x-auto" style={{ maxWidth: "100%" }}>
                      <div dangerouslySetInnerHTML={{ __html: form.headerHtml }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Footer HTML */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-500">Footer HTML</label>
                  {form.footerHtml && (
                    <button
                      onClick={() => setShowPreviewFooter((v) => !v)}
                      className="text-xs text-teal-600 hover:text-teal-800 flex items-center gap-1"
                    >
                      {showPreviewFooter ? <><EyeOff className="w-3 h-3" /> Hide</> : <><Eye className="w-3 h-3" /> Preview</>}
                    </button>
                  )}
                </div>
                <textarea
                  value={form.footerHtml}
                  onChange={(e) => setForm((f) => ({ ...f, footerHtml: e.target.value }))}
                  rows={3}
                  placeholder="<div>Your footer content...</div>"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {showPreviewFooter && form.footerHtml && (
                  <div className="mt-2 border rounded-lg overflow-hidden">
                    <div className="px-3 py-1.5 bg-slate-50 border-b">
                      <span className="text-xs font-medium text-slate-500">Footer Preview</span>
                    </div>
                    <div className="p-3 bg-white overflow-x-auto">
                      <div dangerouslySetInnerHTML={{ __html: form.footerHtml }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Toggles */}
              <div className="flex flex-wrap gap-6">
                {([
                  { key: "showLetterhead" as const, label: "Show Letterhead" },
                  { key: "showWatermark" as const, label: "Show Watermark" },
                  { key: "showQRCode" as const, label: "Show QR Code" },
                ] as const).map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form[key]}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    {label}
                  </label>
                ))}
              </div>

              {/* Paper, Font, Size, Line Height */}
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Paper Size</label>
                  <select
                    value={form.paperSize}
                    onChange={(e) => setForm((f) => ({ ...f, paperSize: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {PAPER_SIZES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Font</label>
                  <input
                    value={form.font}
                    onChange={(e) => setForm((f) => ({ ...f, font: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Font Size</label>
                  <input
                    type="number"
                    value={form.fontSize}
                    onChange={(e) => setForm((f) => ({ ...f, fontSize: Number(e.target.value) }))}
                    min={6}
                    max={24}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Line Height</label>
                  <input
                    type="number"
                    step={0.1}
                    value={form.lineHeight}
                    onChange={(e) => setForm((f) => ({ ...f, lineHeight: Number(e.target.value) }))}
                    min={1}
                    max={3}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Margins */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-2">Margins (mm)</label>
                <div className="grid grid-cols-4 gap-3">
                  {(["top", "right", "bottom", "left"] as const).map((side) => (
                    <div key={side}>
                      <label className="block text-xs text-slate-400 mb-0.5 capitalize">{side}</label>
                      <input
                        type="number"
                        value={form.margins[side]}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            margins: { ...f.margins, [side]: Number(e.target.value) },
                          }))
                        }
                        min={0}
                        max={50}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!form.name || isSaving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingTemplate ? "Save Changes" : "Create Template"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 3: Default Templates ─────────────────────────────────── */}
      {tab === "default-templates" && (
        <div className="space-y-4">
          {generatorStatusLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
            </div>
          ) : generatorStatus?.status === "NOT_STARTED" || !generatorStatus ? (
            /* NOT_STARTED */
            <div className="bg-white border border-slate-200 rounded-2xl p-12 flex flex-col items-center text-center max-w-lg mx-auto">
              <div className="w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-violet-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Generate Default Report Templates</h2>
              <p className="text-sm text-slate-500 mb-6">
                AI will automatically create professional report templates with bio-reference ranges and clinical notes for all tests in your catalog.
              </p>
              <button
                onClick={() => startGeneratorMut.mutate()}
                disabled={startGeneratorMut.isPending}
                className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 disabled:opacity-50 transition-colors"
              >
                {startGeneratorMut.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Generate All Templates
              </button>
            </div>
          ) : generatorStatus.status === "RUNNING" ? (
            /* RUNNING */
            <div className="bg-white border border-slate-200 rounded-2xl p-10 flex flex-col items-center text-center max-w-lg mx-auto">
              <Loader2 className="w-10 h-10 text-teal-500 animate-spin mb-4" />
              <h2 className="text-lg font-semibold text-slate-800 mb-1">Generating templates...</h2>
              <p className="text-sm text-slate-500 mb-6">
                {generatorStatus.processed} of {generatorStatus.totalTests} complete
              </p>
              <div className="w-full bg-slate-100 rounded-full h-3 mb-3">
                <div
                  className="bg-teal-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${generatorStatus.progressPercent}%` }}
                />
              </div>
              <p className="text-3xl font-bold text-teal-600">{generatorStatus.progressPercent}%</p>
            </div>
          ) : generatorStatus.status === "FAILED" ? (
            /* FAILED */
            <div className="bg-red-50 border border-red-200 rounded-2xl p-10 flex flex-col items-center text-center max-w-lg mx-auto">
              <AlertTriangle className="w-10 h-10 text-red-500 mb-4" />
              <h2 className="text-lg font-semibold text-red-800 mb-2">Generation Failed</h2>
              <p className="text-sm text-red-600 mb-6">Something went wrong during template generation.</p>
              <button
                onClick={() => startGeneratorMut.mutate()}
                disabled={startGeneratorMut.isPending}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {startGeneratorMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Retry
              </button>
            </div>
          ) : (
            /* COMPLETED */
            <div className="space-y-4">
              {/* Success Banner */}
              <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-sm font-semibold text-green-800">
                      All {generatorStatus.totalTests} templates generated
                    </p>
                    {generatorStatus.failed > 0 && (
                      <p className="text-xs text-amber-700 mt-0.5">
                        <AlertTriangle className="w-3 h-3 inline mr-1" />
                        {generatorStatus.failed} test(s) failed
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => startGeneratorMut.mutate()}
                  disabled={startGeneratorMut.isPending}
                  className="inline-flex items-center gap-2 px-3 py-1.5 border border-green-300 text-green-700 text-xs font-medium rounded-lg hover:bg-green-100 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" /> Regenerate All
                </button>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={dtSearch}
                  onChange={(e) => setDtSearch(e.target.value)}
                  placeholder="Search by test name or code..."
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              {/* Table */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                {dtTemplatesLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="w-5 h-5 animate-spin text-violet-600" />
                  </div>
                ) : dtTemplates.length === 0 ? (
                  <div className="p-10 text-center">
                    <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">No templates found</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        <th className="px-4 py-3 text-left">Code</th>
                        <th className="px-4 py-3 text-left">Test Name</th>
                        <th className="px-4 py-3 text-left">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dtTemplates.map((tpl) => (
                        <tr key={tpl.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-slate-600">{tpl.testCode}</td>
                          <td className="px-4 py-3 font-medium text-slate-800">{tpl.testName}</td>
                          <td className="px-4 py-3">
                            {tpl.status === "COMPLETED" && !tpl.isCustomized && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Completed</span>
                            )}
                            {tpl.isCustomized && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Customized</span>
                            )}
                            {tpl.status === "FAILED" && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Failed</span>
                            )}
                            {tpl.status === "PENDING" && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Pending</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => openDtEdit(tpl)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                              >
                                <Pencil className="w-3 h-3" /> Edit
                              </button>
                              <button
                                onClick={() => regenerateDtMut.mutate(tpl.testId)}
                                disabled={regenerateDtMut.isPending}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-violet-600 bg-violet-50 rounded-lg hover:bg-violet-100 transition-colors disabled:opacity-50"
                              >
                                <RefreshCw className="w-3 h-3" /> Regenerate
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Default Template Edit Modal ──────────────────────────── */}
      {dtEditTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h3 className="font-semibold text-slate-800">Edit Template</h3>
                <p className="text-xs text-slate-400 mt-0.5">{dtEditTarget.testCode} — {dtEditTarget.testName}</p>
              </div>
              <button onClick={() => setDtEditTarget(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Reference Ranges (JSON)</label>
                <textarea
                  value={dtEditForm.referenceRanges}
                  onChange={(e) => setDtEditForm((f) => ({ ...f, referenceRanges: e.target.value }))}
                  rows={6}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Methodology</label>
                  <input
                    value={dtEditForm.methodology}
                    onChange={(e) => setDtEditForm((f) => ({ ...f, methodology: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Specimen Requirement</label>
                  <input
                    value={dtEditForm.specimenRequirement}
                    onChange={(e) => setDtEditForm((f) => ({ ...f, specimenRequirement: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Patient Preparation</label>
                <input
                  value={dtEditForm.patientPreparation}
                  onChange={(e) => setDtEditForm((f) => ({ ...f, patientPreparation: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Supplementary Notes</label>
                <textarea
                  value={dtEditForm.supplementaryNotes}
                  onChange={(e) => setDtEditForm((f) => ({ ...f, supplementaryNotes: e.target.value }))}
                  rows={3}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Clinical Significance</label>
                <textarea
                  value={dtEditForm.clinicalSignificance}
                  onChange={(e) => setDtEditForm((f) => ({ ...f, clinicalSignificance: e.target.value }))}
                  rows={3}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <button
                onClick={() => setDtEditTarget(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleDtSave}
                disabled={updateDtMut.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors"
              >
                {updateDtMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 4: Parameter Templates ──────────────────────────────────── */}
      {tab === "param-templates" && (
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-800">Parameter Templates</h2>
              <p className="text-sm text-slate-500">Seed structured report parameters for all tests in your catalog</p>
            </div>
            <button
              onClick={() => seedParamsMut.mutate()}
              disabled={seedParamsMut.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              {seedParamsMut.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              {seedParamsMut.isPending ? "Seeding..." : "Run Seed"}
            </button>
          </div>

          {paramStatsLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
            </div>
          ) : !paramStats ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
              <FlaskConical className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No stats available. Run seed first.</p>
            </div>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Total Tests", value: paramStats.total, color: "text-slate-800", bg: "bg-slate-50 border-slate-200" },
                  { label: "With Parameters", value: paramStats.withParams, color: "text-teal-700", bg: "bg-teal-50 border-teal-200" },
                  { label: "Without Parameters", value: paramStats.withoutParams, color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
                  { label: "Complete", value: `${paramStats.percentComplete}%`, color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
                ].map((card) => (
                  <div key={card.label} className={`border rounded-xl p-4 ${card.bg}`}>
                    <p className="text-xs font-medium text-slate-500 mb-1">{card.label}</p>
                    <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
                  </div>
                ))}
              </div>

              {/* Progress bar */}
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-teal-600" />
                    <span className="text-sm font-medium text-slate-700">Parameter Coverage</span>
                  </div>
                  <span className="text-sm font-bold text-teal-700">{paramStats.percentComplete}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3">
                  <div
                    className="bg-teal-500 h-3 rounded-full transition-all duration-700"
                    style={{ width: `${paramStats.percentComplete}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1.5">
                  {paramStats.withParams} of {paramStats.total} tests have structured parameters
                </p>
              </div>

              {/* Category breakdown + Seeded tests table */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Category breakdown */}
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">By Category</h3>
                  {(paramStats.byCategory ?? []).length === 0 ? (
                    <p className="text-xs text-slate-400">No data yet</p>
                  ) : (
                    <div className="space-y-2">
                      {(paramStats.byCategory ?? []).sort((a, b) => b.count - a.count).map((cat) => (
                        <div key={cat.category} className="flex items-center justify-between">
                          <span className="text-xs text-slate-600 truncate flex-1">{cat.category || "Uncategorised"}</span>
                          <span className="text-xs font-semibold text-teal-700 ml-2">{cat.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Seeded tests table */}
                <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                    <h3 className="text-sm font-semibold text-slate-700">Top Seeded Tests (by param count)</h3>
                  </div>
                  {(paramStats.recentlySeeded ?? []).length === 0 ? (
                    <div className="p-8 text-center">
                      <FlaskConical className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm text-slate-400">Run seed to populate parameters</p>
                    </div>
                  ) : (
                    <div className="overflow-y-auto max-h-80">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-slate-50">
                          <tr className="border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                            <th className="px-4 py-2 text-left">Code</th>
                            <th className="px-4 py-2 text-left">Test Name</th>
                            <th className="px-4 py-2 text-center">Params</th>
                            <th className="px-4 py-2 text-center">Complete</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(paramStats.recentlySeeded ?? []).map((t) => (
                            <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-2 font-mono text-xs text-slate-500">{t.code}</td>
                              <td className="px-4 py-2 text-slate-800 font-medium">{t.name}</td>
                              <td className="px-4 py-2 text-center">
                                <span className="inline-block px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 text-xs font-semibold">
                                  {t.paramCount}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-center">
                                {t.isTemplateComplete ? (
                                  <CheckCircle className="w-4 h-4 text-emerald-500 mx-auto" />
                                ) : (
                                  <span className="w-4 h-4 rounded-full border-2 border-slate-300 inline-block" />
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Seed result details (shown after seeding) */}
              {seedParamsMut.isSuccess && seedParamsMut.data && (() => {
                const result = (seedParamsMut.data.data ?? seedParamsMut.data) as SeedParamResult;
                return (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      <span className="text-sm font-semibold text-emerald-800">
                        Seed complete — {result.seeded} seeded, {result.skipped} skipped, {result.total} total
                      </span>
                    </div>
                    {result.details && result.details.length > 0 && (
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {result.details.map((d, i) => (
                          <div key={i} className="flex items-center gap-3 text-xs text-emerald-700">
                            <span className="font-mono w-28 truncate">{d.code}</span>
                            <span className="flex-1 truncate">{d.name}</span>
                            <span className="font-medium capitalize">{d.action}</span>
                            <span className="text-emerald-600 font-semibold">{d.paramCount} params</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}

      {/* ─── Delete Confirm ──────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
        title="Delete Template"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        isLoading={deleteMut.isPending}
      />
    </div>
  );
}
