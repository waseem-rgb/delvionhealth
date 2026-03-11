"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardList,
  Search,
  Plus,
  Wand2,
  Clock,
  FileText,
  History,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Download,
  Eye,
  ChevronDown,
  X,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import api from "@/lib/api";

// ── Types ────────────────────────────────────────────────────────────────────

interface FormField {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
  columns?: Array<{ id: string; label: string; type: string }>;
}

interface FormSection {
  title: string;
  fields: FormField[];
}

interface FormSchema {
  sections: FormSection[];
  acceptanceCriteria?: string;
  instructions?: string;
}

interface QualityForm {
  id: string;
  formCode: string;
  name: string;
  title?: string;
  category: string;
  frequency: string;
  department: string;
  standards: string[];
  formSchema: FormSchema | null;
  isAiGenerated: boolean;
  status: string;
  version: string;
  createdAt: string;
}

interface FormSubmission {
  id: string;
  formCode: string;
  formTitle: string;
  submittedAt: string;
  submittedByName: string;
  status: string;
  notes?: string;
  periodLabel?: string;
}

interface GenerationStatus {
  status: string;
  totalPlanned: number;
  totalGenerated: number;
  totalFailed: number;
  progressPercent: number;
  currentForm?: string;
  failedItems: Array<{ formCode: string; error: string }>;
  formsCount: number;
}

interface Stats {
  total: number;
  dailyCount: number;
  activeCount: number;
  submissionsThisMonth: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  "ALL", "IQC", "SAFETY", "MAINTENANCE", "VALIDATION", "SAMPLE_MANAGEMENT",
  "CALIBRATION", "EQUIPMENT", "AUDIT", "NCR", "MANAGEMENT", "DAILY_CHECK",
  "MICROBIOLOGY", "HAEMATOLOGY", "BIOCHEMISTRY", "MOLECULAR", "HR",
];

const FREQUENCIES = ["ALL", "DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "ANNUAL", "PER_EVENT", "AS_NEEDED"];

const CATEGORY_COLORS: Record<string, string> = {
  IQC: "bg-blue-50 text-blue-700 border-blue-200",
  SAFETY: "bg-red-50 text-red-700 border-red-200",
  MAINTENANCE: "bg-amber-50 text-amber-700 border-amber-200",
  VALIDATION: "bg-violet-50 text-violet-700 border-violet-200",
  SAMPLE_MANAGEMENT: "bg-cyan-50 text-cyan-700 border-cyan-200",
  CALIBRATION: "bg-indigo-50 text-indigo-700 border-indigo-200",
  EQUIPMENT: "bg-orange-50 text-orange-700 border-orange-200",
  AUDIT: "bg-teal-50 text-teal-700 border-teal-200",
  NCR: "bg-rose-50 text-rose-700 border-rose-200",
  MANAGEMENT: "bg-emerald-50 text-emerald-700 border-emerald-200",
  DAILY_CHECK: "bg-sky-50 text-sky-700 border-sky-200",
  MICROBIOLOGY: "bg-green-50 text-green-700 border-green-200",
  HR: "bg-pink-50 text-pink-700 border-pink-200",
};

const FREQ_COLORS: Record<string, string> = {
  DAILY: "text-cyan-600",
  WEEKLY: "text-blue-600",
  MONTHLY: "text-purple-600",
  QUARTERLY: "text-amber-600",
  ANNUAL: "text-green-600",
  PER_EVENT: "text-rose-600",
  AS_NEEDED: "text-slate-500",
};

const STATUS_BADGE: Record<string, string> = {
  SUBMITTED: "bg-blue-50 text-blue-700 border-blue-200",
  VERIFIED: "bg-green-50 text-green-700 border-green-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
  PENDING_REVIEW: "bg-amber-50 text-amber-700 border-amber-200",
};

// ── Dynamic Form Renderer ────────────────────────────────────────────────────

function DynamicFormRenderer({
  schema,
  formData,
  onChange,
}: {
  schema: FormSchema;
  formData: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}) {
  const updateField = (fieldId: string, value: unknown) => {
    onChange({ ...formData, [fieldId]: value });
  };

  const updateTableRow = (fieldId: string, rowIdx: number, colId: string, value: string) => {
    const rows = (formData[fieldId] as Record<string, string>[] | undefined) ?? [];
    const updated = [...rows];
    if (!updated[rowIdx]) updated[rowIdx] = {};
    updated[rowIdx] = { ...updated[rowIdx], [colId]: value };
    onChange({ ...formData, [fieldId]: updated });
  };

  const addTableRow = (fieldId: string, columns: Array<{ id: string }>) => {
    const rows = (formData[fieldId] as Record<string, string>[] | undefined) ?? [];
    const emptyRow: Record<string, string> = {};
    columns.forEach(c => { emptyRow[c.id] = ""; });
    onChange({ ...formData, [fieldId]: [...rows, emptyRow] });
  };

  const removeTableRow = (fieldId: string, rowIdx: number) => {
    const rows = (formData[fieldId] as Record<string, string>[] | undefined) ?? [];
    onChange({ ...formData, [fieldId]: rows.filter((_, i) => i !== rowIdx) });
  };

  const renderField = (field: FormField) => {
    const val = formData[field.id];

    if (field.type === "table" && field.columns) {
      const rows = (val as Record<string, string>[] | undefined) ?? [];
      return (
        <div key={field.id} className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">{field.label}</label>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  {field.columns.map(col => (
                    <th key={col.id} className="border border-slate-200 px-3 py-2 text-left font-medium text-slate-600">
                      {col.label}
                    </th>
                  ))}
                  <th className="border border-slate-200 px-2 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={(field.columns?.length ?? 0) + 1} className="border border-slate-200 px-3 py-3 text-center text-slate-400 text-xs">
                      No rows yet — click &quot;+ Add Row&quot;
                    </td>
                  </tr>
                ) : (
                  rows.map((row, rowIdx) => (
                    <tr key={rowIdx}>
                      {field.columns!.map(col => (
                        <td key={col.id} className="border border-slate-200 p-0">
                          <input
                            type={col.type === "number" || col.type === "temperature" ? "number" : col.type === "date" ? "date" : col.type === "time" ? "time" : "text"}
                            step={col.type === "temperature" ? "0.1" : undefined}
                            value={row[col.id] ?? ""}
                            onChange={e => updateTableRow(field.id, rowIdx, col.id, e.target.value)}
                            className="w-full px-2 py-1.5 text-xs border-0 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-[#0D7E8A]/50"
                          />
                        </td>
                      ))}
                      <td className="border border-slate-200 px-1 text-center">
                        <button
                          type="button"
                          onClick={() => removeTableRow(field.id, rowIdx)}
                          className="text-slate-400 hover:text-red-500 text-xs"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={() => addTableRow(field.id, field.columns!)}
            className="mt-1.5 text-xs text-[#0D7E8A] hover:text-[#0b6b76] font-medium"
          >
            + Add Row
          </button>
        </div>
      );
    }

    if (field.type === "select" && field.options) {
      return (
        <div key={field.id} className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          <select
            value={(val as string) ?? ""}
            onChange={e => updateField(field.id, e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]/30"
          >
            <option value="">Select...</option>
            {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
      );
    }

    if (field.type === "checkbox") {
      return (
        <div key={field.id} className="mb-4 flex items-center gap-2">
          <input
            type="checkbox"
            id={field.id}
            checked={!!(val)}
            onChange={e => updateField(field.id, e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-[#0D7E8A] focus:ring-[#0D7E8A]"
          />
          <label htmlFor={field.id} className="text-sm font-medium text-slate-700">
            {field.label}
          </label>
        </div>
      );
    }

    if (field.type === "textarea") {
      return (
        <div key={field.id} className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          <textarea
            value={(val as string) ?? ""}
            onChange={e => updateField(field.id, e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]/30 resize-none"
          />
        </div>
      );
    }

    if (field.type === "signature") {
      return (
        <div key={field.id} className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          <input
            type="text"
            value={(val as string) ?? ""}
            onChange={e => updateField(field.id, e.target.value)}
            placeholder="Name / Initials"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]/30 italic"
          />
        </div>
      );
    }

    // text, number, temperature, date, time
    const inputType =
      field.type === "number" || field.type === "temperature" ? "number" :
      field.type === "date" ? "date" :
      field.type === "time" ? "time" :
      "text";

    return (
      <div key={field.id} className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-1">
          {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        <input
          type={inputType}
          step={field.type === "temperature" ? "0.1" : undefined}
          value={(val as string) ?? ""}
          onChange={e => updateField(field.id, e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]/30"
        />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {schema.instructions && (
        <div className="bg-[#0D7E8A]/5 border border-[#0D7E8A]/20 rounded-lg px-4 py-3 text-sm text-slate-600">
          <span className="font-medium text-[#0D7E8A]">Instructions: </span>
          {schema.instructions}
        </div>
      )}
      {schema.sections.map((section, sIdx) => (
        <div key={sIdx} className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-800 border-b border-slate-100 pb-2">{section.title}</h3>
          <div className="pt-2">
            {section.fields.map(field => renderField(field))}
          </div>
        </div>
      ))}
      {schema.acceptanceCriteria && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-700">
          <span className="font-semibold">Acceptance Criteria: </span>
          {schema.acceptanceCriteria}
        </div>
      )}
    </div>
  );
}

// ── Fill Form Modal ───────────────────────────────────────────────────────────

function FillFormModal({
  form,
  onClose,
}: {
  form: QualityForm;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [periodLabel, setPeriodLabel] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleEsc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const submitMutation = useMutation({
    mutationFn: () =>
      api.post(`/quality-forms/${form.id}/submit`, {
        submittedData: formData,
        notes,
        periodLabel,
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quality-forms-submissions", form.id] });
      queryClient.invalidateQueries({ queryKey: ["quality-forms-stats"] });
      toast.success("Form submitted successfully");
      onClose();
    },
    onError: () => toast.error("Failed to submit form"),
  });

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-black/40 z-50"
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-3xl bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="border-b border-slate-200 px-6 py-4 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <span className="inline-flex px-2 py-0.5 rounded text-xs font-mono font-medium bg-slate-100 text-slate-600 border border-slate-200">
                {form.formCode}
              </span>
              <h2 className="text-lg font-bold text-slate-900 mt-1">{form.title ?? form.name}</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {form.category} · {form.frequency} · v{form.version}
              </p>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex gap-4 mt-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Period / Date</label>
              <input
                type="date"
                value={periodLabel}
                onChange={e => setPeriodLabel(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]/30"
              />
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {form.formSchema ? (
            <DynamicFormRenderer
              schema={form.formSchema}
              formData={formData}
              onChange={setFormData}
            />
          ) : (
            <div className="text-center py-12 text-slate-400">
              <ClipboardList className="w-10 h-10 mx-auto mb-3 text-slate-200" />
              <p className="text-sm">Form schema not yet generated.</p>
              <p className="text-xs mt-1">Run AI generation to create fillable form fields.</p>
            </div>
          )}

          <div className="mt-6">
            <label className="block text-sm font-medium text-slate-700 mb-1">Remarks / Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Any observations or comments..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]/30 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4 flex items-center gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending || !form.formSchema}
            className="flex-1 px-4 py-2 bg-[#0D7E8A] text-white rounded-lg text-sm font-medium hover:bg-[#0b6b76] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <FileText className="w-4 h-4" />
            {submitMutation.isPending ? "Submitting..." : "Submit Form"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Submissions Panel ─────────────────────────────────────────────────────────

function SubmissionsPanel({ formId, formCode, onClose }: { formId: string; formCode: string; onClose: () => void }) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["quality-forms-submissions", formId],
    queryFn: async () => {
      const res = await api.get(`/quality-forms/${formId}/submissions`);
      return (res.data?.items ?? res.data) as FormSubmission[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (subId: string) => api.delete(`/quality-forms/${formId}/submissions/${subId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quality-forms-submissions", formId] });
      toast.success("Submission deleted");
    },
    onError: () => toast.error("Failed to delete"),
  });

  const submissions = data ?? [];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm mt-2">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <History className="w-4 h-4 text-slate-500" />
          Submissions — {formCode}
        </h3>
        <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-600">
          Close
        </button>
      </div>
      {isLoading ? (
        <div className="text-center py-4"><Loader2 className="w-5 h-5 animate-spin text-slate-400 mx-auto" /></div>
      ) : submissions.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-4">No submissions yet</p>
      ) : (
        <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
          {submissions.map(sub => (
            <div key={sub.id} className="flex items-center justify-between py-2 text-xs">
              <div className="flex items-center gap-3">
                <span className={cn("inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border", STATUS_BADGE[sub.status] ?? "bg-slate-50 text-slate-500 border-slate-200")}>
                  {sub.status}
                </span>
                <span className="text-slate-600">
                  {new Date(sub.submittedAt).toLocaleDateString()} {new Date(sub.submittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                {sub.submittedByName && (
                  <span className="text-slate-400">by {sub.submittedByName}</span>
                )}
                {sub.periodLabel && (
                  <span className="text-slate-400">({sub.periodLabel})</span>
                )}
              </div>
              <button
                onClick={() => deleteMutation.mutate(sub.id)}
                disabled={deleteMutation.isPending}
                className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Generation Progress Banner ────────────────────────────────────────────────

function GenerationProgress({ status, onRefresh }: { status: GenerationStatus; onRefresh: () => void }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-800">Generating Quality Forms with AI...</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Creating {status.totalPlanned} NABL/CAP/ISO 15189 compliant forms for online filling
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>Generated {status.totalGenerated} of {status.totalPlanned} forms</span>
          <span className="font-semibold text-[#0D7E8A]">{status.progressPercent}%</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-3">
          <div
            className="h-3 rounded-full bg-[#0D7E8A] transition-all duration-500"
            style={{ width: `${Math.min(status.progressPercent, 100)}%` }}
          />
        </div>
        {status.currentForm && (
          <p className="text-xs text-slate-400 flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Processing: {status.currentForm}
          </p>
        )}
        {status.totalFailed > 0 && (
          <p className="text-xs text-amber-600">{status.totalFailed} forms failed (will retry)</p>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function QualityFormsPage() {
  const queryClient = useQueryClient();
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [frequencyFilter, setFrequencyFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [activeForm, setActiveForm] = useState<QualityForm | null>(null);
  const [submissionsFormId, setSubmissionsFormId] = useState<string | null>(null);
  const [showCategoryDrop, setShowCategoryDrop] = useState(false);
  const [showFreqDrop, setShowFreqDrop] = useState(false);

  // Generation status
  const { data: genStatus, refetch: refetchStatus } = useQuery<GenerationStatus>({
    queryKey: ["quality-forms-generation-status"],
    queryFn: async () => {
      const res = await api.get("/quality-forms/generation-status");
      return (res.data?.data ?? res.data) as GenerationStatus;
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.status === "RUNNING" ? 8000 : false;
    },
  });

  // Stats
  const { data: statsRaw } = useQuery({
    queryKey: ["quality-forms-stats"],
    queryFn: async () => {
      const res = await api.get("/quality-forms/stats");
      return (res.data?.data ?? res.data) as Stats;
    },
  });

  // Forms list
  const { data: formsData, isLoading } = useQuery({
    queryKey: ["quality-forms-ai", categoryFilter, frequencyFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (categoryFilter !== "ALL") params.set("category", categoryFilter);
      if (frequencyFilter !== "ALL") params.set("frequency", frequencyFilter);
      if (search) params.set("search", search);
      params.set("limit", "200");
      const res = await api.get(`/quality-forms?${params.toString()}`);
      return (res.data?.data ?? res.data) as { items: QualityForm[]; total: number };
    },
    enabled: genStatus?.status === "COMPLETED" || (genStatus?.formsCount ?? 0) > 0,
  });

  const generateMutation = useMutation({
    mutationFn: () => api.post("/quality-forms/generate-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quality-forms-generation-status"] });
      toast.success("Generation started — this may take a few minutes");
    },
    onError: () => toast.error("Failed to start generation"),
  });

  const forms = formsData?.items ?? [];
  const stats = statsRaw;

  const isRunning = genStatus?.status === "RUNNING";
  const notStarted = !genStatus || genStatus.status === "NOT_STARTED";
  const hasNoForms = (genStatus?.formsCount ?? 0) === 0;

  // Polling refresh when running
  useEffect(() => {
    if (isRunning) {
      const interval = setInterval(() => {
        void refetchStatus();
        queryClient.invalidateQueries({ queryKey: ["quality-forms-ai"] });
        queryClient.invalidateQueries({ queryKey: ["quality-forms-stats"] });
      }, 8000);
      return () => clearInterval(interval);
    }
  }, [isRunning, refetchStatus, queryClient]);

  const submissionsForm = useMemo(() => forms.find(f => f.id === submissionsFormId), [forms, submissionsFormId]);

  const exportIndex = useCallback(() => {
    const rows = forms.map(f => [f.formCode, f.title ?? f.name, f.category, f.frequency, f.department, f.standards.join("|"), f.status].join(","));
    const csv = ["Form Code,Title,Category,Frequency,Department,Standards,Status", ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "quality-forms-index.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [forms]);

  // ── NOT STARTED / NO FORMS — Show banner ────────────────────────────────────

  if (notStarted || hasNoForms) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quality Forms</h1>
          <p className="text-slate-500 text-sm mt-0.5">NABL · CAP · ISO 15189 · WHO Standards</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center shadow-sm">
          <div className="w-16 h-16 bg-[#0D7E8A]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <ClipboardList className="w-8 h-8 text-[#0D7E8A]" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Auto-generate All Quality Forms</h2>
          <p className="text-slate-500 mb-1 max-w-lg mx-auto">
            Generate 53+ NABL/CAP/ISO 15189 compliant quality forms with AI-powered online filling capability.
          </p>
          <p className="text-xs text-slate-400 mb-6 max-w-md mx-auto">
            Each form includes structured sections and fields matching real-world Indian diagnostic lab requirements.
          </p>
          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#0D7E8A] text-white rounded-lg font-medium hover:bg-[#0b6b76] disabled:opacity-50 transition-colors"
          >
            {generateMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
            {generateMutation.isPending ? "Starting..." : "Generate All Forms"}
          </button>
          <div className="mt-6 flex flex-wrap justify-center gap-3 text-xs text-slate-400">
            {["53 Forms", "NABL Compliant", "CAP Ready", "ISO 15189", "Online Fillable", "AI Generated"].map(tag => (
              <span key={tag} className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-full">{tag}</span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── RUNNING — Show progress ──────────────────────────────────────────────────

  if (isRunning) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quality Forms</h1>
          <p className="text-slate-500 text-sm mt-0.5">NABL · CAP · ISO 15189 · WHO Standards</p>
        </div>
        <GenerationProgress status={genStatus!} onRefresh={() => void refetchStatus()} />
        <p className="text-xs text-slate-400 text-center">
          This page auto-refreshes every 8 seconds. You can navigate away and return.
        </p>
      </div>
    );
  }

  // ── COMPLETED — Main Table View ──────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quality Forms</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            NABL · CAP · ISO 15189 · WHO Standards — {forms.length} forms
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportIndex}
            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export Index
          </button>
          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Re-generate
          </button>
          <button
            onClick={() => toast.info("Custom form creation coming soon")}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#0D7E8A] text-white rounded-lg text-sm font-medium hover:bg-[#0b6b76] transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Form
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total Forms", value: stats.total, icon: ClipboardList, color: "text-slate-600", bg: "bg-slate-50" },
            { label: "Daily Forms", value: stats.dailyCount, icon: Clock, color: "text-cyan-600", bg: "bg-cyan-50" },
            { label: "Active", value: stats.activeCount, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Submissions This Month", value: stats.submissionsThisMonth, icon: FileText, color: "text-[#0D7E8A]", bg: "bg-teal-50" },
          ].map(kpi => {
            const Icon = kpi.icon;
            return (
              <div key={kpi.label} className="bg-white border border-slate-100 rounded-xl shadow-sm p-5">
                <div className="flex items-center gap-3">
                  <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", kpi.bg, kpi.color)}>
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
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Category dropdown */}
        <div className="relative">
          <button
            onClick={() => { setShowCategoryDrop(v => !v); setShowFreqDrop(false); }}
            className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white hover:bg-slate-50 transition-colors"
          >
            Category: <span className="font-medium">{categoryFilter}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>
          {showCategoryDrop && (
            <div className="absolute top-full mt-1 left-0 z-20 bg-white border border-slate-200 rounded-xl shadow-lg py-1 min-w-[180px]">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => { setCategoryFilter(cat); setShowCategoryDrop(false); }}
                  className={cn(
                    "w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors",
                    categoryFilter === cat ? "text-[#0D7E8A] font-medium" : "text-slate-700"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Frequency dropdown */}
        <div className="relative">
          <button
            onClick={() => { setShowFreqDrop(v => !v); setShowCategoryDrop(false); }}
            className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white hover:bg-slate-50 transition-colors"
          >
            Frequency: <span className="font-medium">{frequencyFilter}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>
          {showFreqDrop && (
            <div className="absolute top-full mt-1 left-0 z-20 bg-white border border-slate-200 rounded-xl shadow-lg py-1 min-w-[160px]">
              {FREQUENCIES.map(freq => (
                <button
                  key={freq}
                  onClick={() => { setFrequencyFilter(freq); setShowFreqDrop(false); }}
                  className={cn(
                    "w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors",
                    frequencyFilter === freq ? "text-[#0D7E8A] font-medium" : "text-slate-700"
                  )}
                >
                  {freq}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            placeholder="Search forms..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]/30 w-64 bg-white"
          />
        </div>
      </div>

      {/* Close dropdowns on outside click */}
      {(showCategoryDrop || showFreqDrop) && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => { setShowCategoryDrop(false); setShowFreqDrop(false); }}
        />
      )}

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : forms.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-xl shadow-sm p-16 text-center">
          <AlertTriangle className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No forms match the current filters</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-40">Form Code</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Title</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-36">Category</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">Frequency</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-36">Standards</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-20">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-36">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {forms.map(form => (
                <>
                  <tr key={form.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-medium text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                        {form.formCode}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800 truncate max-w-xs">{form.title ?? form.name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{form.department}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border", CATEGORY_COLORS[form.category] ?? "bg-slate-50 text-slate-500 border-slate-200")}>
                        {form.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs font-medium", FREQ_COLORS[form.frequency] ?? "text-slate-500")}>
                        <Clock className="w-3 h-3 inline mr-1" />
                        {form.frequency}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {form.standards.slice(0, 3).map(s => (
                          <span key={s} className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">{s}</span>
                        ))}
                        {form.standards.length > 3 && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded">+{form.standards.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                        form.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        form.status === "ARCHIVED" ? "bg-slate-50 text-slate-500 border-slate-200" :
                        "bg-amber-50 text-amber-700 border-amber-200"
                      )}>
                        {form.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setSubmissionsFormId(submissionsFormId === form.id ? null : form.id)}
                          title="View submissions"
                          className={cn(
                            "p-1.5 rounded-lg transition-colors text-xs",
                            submissionsFormId === form.id ? "text-[#0D7E8A] bg-teal-50" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                          )}
                        >
                          <History className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => toast.info("View form details coming soon")}
                          title="View form schema"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setActiveForm(form)}
                          disabled={!form.formSchema}
                          title={form.formSchema ? "Fill this form" : "Schema not yet generated"}
                          className="px-3 py-1.5 bg-[#0D7E8A] text-white rounded-lg text-xs font-medium hover:bg-[#0b6b76] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          Fill Form
                        </button>
                      </div>
                    </td>
                  </tr>
                  {submissionsFormId === form.id && (
                    <tr key={`sub-${form.id}`}>
                      <td colSpan={7} className="px-4 py-2">
                        <SubmissionsPanel
                          formId={form.id}
                          formCode={form.formCode}
                          onClose={() => setSubmissionsFormId(null)}
                        />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-400">
        Showing {forms.length} forms · Generated with AI for DELViON Health
      </p>

      {/* Fill Form Modal */}
      {activeForm && (
        <FillFormModal form={activeForm} onClose={() => setActiveForm(null)} />
      )}
    </div>
  );
}
