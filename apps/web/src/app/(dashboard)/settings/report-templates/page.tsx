"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  X,
  Pencil,
  Trash2,
  Star,
  FileText,
  Loader2,
  CheckCircle,
  LayoutTemplate,
  Sparkles,
  Eye,
  EyeOff,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

// ─── Types ────────────────────────────────────────────────────────
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

// ─── Component ────────────────────────────────────────────────────
export default function ReportTemplatesPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ReportTemplate | null>(null);
  const [form, setForm] = useState<TemplateForm>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<ReportTemplate | null>(null);
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiSummary, setAiSummary] = useState("");
  const [showPreviewHeader, setShowPreviewHeader] = useState(false);
  const [showPreviewFooter, setShowPreviewFooter] = useState(false);

  // ─── Fetch templates ────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ["report-templates"],
    queryFn: () =>
      api.get("/report-templates").then((r) => r.data.data as ReportTemplate[]),
  });

  const templates = Array.isArray(data) ? data : [];

  // ─── Create ─────────────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: (dto: TemplateForm) => api.post("/report-templates", dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["report-templates"] });
      toast.success("Template created successfully");
      closeModal();
    },
    onError: () => toast.error("Failed to create template"),
  });

  // ─── Update ─────────────────────────────────────────────────────
  const updateMut = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: TemplateForm }) =>
      api.put(`/report-templates/${id}`, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["report-templates"] });
      toast.success("Template updated successfully");
      closeModal();
    },
    onError: () => toast.error("Failed to update template"),
  });

  // ─── Delete ─────────────────────────────────────────────────────
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/report-templates/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["report-templates"] });
      toast.success("Template deleted");
      setDeleteTarget(null);
    },
    onError: () => toast.error("Failed to delete template"),
  });

  // ─── Set default ───────────────────────────────────────────────
  const setDefaultMut = useMutation({
    mutationFn: (id: string) => api.put(`/report-templates/${id}/default`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["report-templates"] });
      toast.success("Default template updated");
    },
    onError: () => toast.error("Failed to set default"),
  });

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Report Templates"
        subtitle="Manage report layout templates for lab reports"
        breadcrumbs={[{ label: "Settings", href: "/settings" }]}
        actions={
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Template
          </button>
        }
      />

      {/* Template Grid */}
      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-100 p-5 animate-pulse">
              <div className="h-32 bg-slate-100 rounded-lg mb-4" />
              <div className="h-5 w-40 bg-slate-100 rounded mb-2" />
              <div className="h-4 w-24 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 p-12 text-center">
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
              className="bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden group"
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

                <div className="flex items-center gap-2 pt-2 border-t border-slate-50">
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

      {/* ─── Create / Edit Modal ─────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
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

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
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
