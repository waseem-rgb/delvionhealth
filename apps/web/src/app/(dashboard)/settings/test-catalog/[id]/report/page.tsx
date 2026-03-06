"use client";

import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Plus,
  GripVertical,
  Trash2,
  Save,
  Sparkles,
  Eye,
  Settings2,
  ListOrdered,
  FileText,
  Loader2,
  ChevronDown,
  ChevronRight,
  X,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

// ─── Types ────────────────────────────────────

interface ReferenceRange {
  id?: string;
  genderFilter?: string;
  ageMinYears?: number | null;
  ageMaxYears?: number | null;
  lowNormal?: number | null;
  highNormal?: number | null;
  lowCritical?: number | null;
  highCritical?: number | null;
  unit?: string | null;
  notes?: string | null;
}

interface ReportParameter {
  id: string;
  name: string;
  fieldType: string;
  unit: string | null;
  method: string | null;
  defaultValue: string | null;
  options: string | null;
  formula: string | null;
  isHighlighted: boolean;
  isMandatory: boolean;
  sortOrder: number;
  isActive: boolean;
  referenceRanges: ReferenceRange[];
}

interface ReportSettings {
  id: string;
  paperSize: string;
  orientation: string;
  fontFamily: string;
  fontSize: number;
  showMethod: boolean;
  showUnit: boolean;
  showRefRange: boolean;
  showPrevResult: boolean;
  showInterpretation: boolean;
  interpretationTemplate: string | null;
  footerNotes: string | null;
  supplementary: string | null;
}

interface TestInfo {
  id: string;
  code: string;
  name: string;
  category: string;
  department: string;
}

interface AutoFillParam {
  name: string;
  fieldType: string;
  unit: string | null;
  method: string | null;
  sortOrder: number;
  referenceRanges: {
    genderFilter: string;
    ageMinYears: number | null;
    ageMaxYears: number | null;
    lowNormal: number | null;
    highNormal: number | null;
    unit: string | null;
  }[];
}

const FIELD_TYPES = [
  { value: "NUMERIC", label: "Numeric" },
  { value: "TEXT", label: "Text" },
  { value: "OPTION", label: "Option (Dropdown)" },
  { value: "FORMULA", label: "Formula" },
  { value: "HEADING", label: "Heading" },
  { value: "NOTE", label: "Note" },
];

const PAPER_SIZES = ["A4", "A5", "LETTER"];
const ORIENTATIONS = ["PORTRAIT", "LANDSCAPE"];
const FONTS = ["Arial", "Times New Roman", "Helvetica", "Courier New", "Georgia"];
const TABS = [
  { id: "parameters", label: "Report Parameters", icon: ListOrdered },
  { id: "settings", label: "Report Settings", icon: Settings2 },
  { id: "supplementary", label: "Supplementary", icon: FileText },
];

export default function ReportBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const testId = params.id as string;

  const [activeTab, setActiveTab] = useState("parameters");
  const [selectedParamId, setSelectedParamId] = useState<string | null>(null);
  const [showAutoFill, setShowAutoFill] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newParam, setNewParam] = useState({ name: "", fieldType: "NUMERIC", unit: "", method: "" });
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  // ─── Queries ──────────────────────────────────

  const { data: testInfo } = useQuery<TestInfo>({
    queryKey: ["test-catalog", testId],
    queryFn: () => api.get(`/test-catalog/${testId}`).then((r) => r.data.data ?? r.data),
  });

  const { data: parameters = [], isLoading: paramsLoading } = useQuery<ReportParameter[]>({
    queryKey: ["report-parameters", testId],
    queryFn: () => api.get(`/report-builder/${testId}/parameters`).then((r) => r.data.data ?? r.data),
  });

  const { data: settings } = useQuery<ReportSettings>({
    queryKey: ["report-settings", testId],
    queryFn: () => api.get(`/report-builder/${testId}/settings`).then((r) => r.data.data ?? r.data),
  });

  const { data: previewHtml } = useQuery<string>({
    queryKey: ["report-preview", testId],
    queryFn: () => api.get(`/report-builder/${testId}/preview`).then((r) => r.data.data ?? r.data),
    enabled: showPreview,
  });

  const selectedParam = parameters.find((p) => p.id === selectedParamId);

  // ─── Mutations ────────────────────────────────

  const createParamMutation = useMutation({
    mutationFn: (dto: { name: string; fieldType: string; unit?: string; method?: string }) =>
      api.post(`/report-builder/${testId}/parameters`, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report-parameters", testId] });
      queryClient.invalidateQueries({ queryKey: ["report-preview", testId] });
      setShowAddForm(false);
      setNewParam({ name: "", fieldType: "NUMERIC", unit: "", method: "" });
      toast.success("Parameter added");
    },
    onError: () => toast.error("Failed to add parameter"),
  });

  const updateParamMutation = useMutation({
    mutationFn: ({ id, ...dto }: { id: string } & Record<string, unknown>) =>
      api.put(`/report-builder/parameters/${id}`, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report-parameters", testId] });
      queryClient.invalidateQueries({ queryKey: ["report-preview", testId] });
      toast.success("Parameter updated");
    },
    onError: () => toast.error("Failed to update parameter"),
  });

  const deleteParamMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/report-builder/parameters/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report-parameters", testId] });
      queryClient.invalidateQueries({ queryKey: ["report-preview", testId] });
      setSelectedParamId(null);
      toast.success("Parameter deleted");
    },
    onError: () => toast.error("Failed to delete parameter"),
  });

  const reorderMutation = useMutation({
    mutationFn: (parameterIds: string[]) =>
      api.post(`/report-builder/${testId}/parameters/reorder`, { parameterIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report-parameters", testId] });
      queryClient.invalidateQueries({ queryKey: ["report-preview", testId] });
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (dto: Partial<ReportSettings>) =>
      api.put(`/report-builder/${testId}/settings`, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report-settings", testId] });
      queryClient.invalidateQueries({ queryKey: ["report-preview", testId] });
      toast.success("Settings saved");
    },
    onError: () => toast.error("Failed to save settings"),
  });

  const autoFillMutation = useMutation({
    mutationFn: () => api.post(`/report-builder/${testId}/auto-fill`).then((r) => (r.data.data ?? r.data) as AutoFillParam[]),
    onSuccess: () => setShowAutoFill(true),
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Auto-fill unavailable";
      toast.error(msg);
    },
  });

  const bulkCreateMutation = useMutation({
    mutationFn: (params: AutoFillParam[]) =>
      api.post(`/report-builder/${testId}/parameters/bulk`, { parameters: params }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report-parameters", testId] });
      queryClient.invalidateQueries({ queryKey: ["report-preview", testId] });
      setShowAutoFill(false);
      toast.success("Parameters added from auto-fill");
    },
    onError: () => toast.error("Failed to apply auto-fill"),
  });

  // ─── Drag & Drop ─────────────────────────────

  const handleDragStart = useCallback((idx: number) => setDraggedIdx(idx), []);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) return;

    const newOrder = [...parameters];
    const [dragged] = newOrder.splice(draggedIdx, 1);
    newOrder.splice(idx, 0, dragged);

    queryClient.setQueryData(["report-parameters", testId], newOrder);
    setDraggedIdx(idx);
  }, [draggedIdx, parameters, queryClient, testId]);

  const handleDragEnd = useCallback(() => {
    setDraggedIdx(null);
    const ids = parameters.map((p) => p.id);
    reorderMutation.mutate(ids);
  }, [parameters, reorderMutation]);

  // ─── Helpers ──────────────────────────────────

  function handleUpdateField(field: string, value: unknown) {
    if (!selectedParamId) return;
    updateParamMutation.mutate({ id: selectedParamId, [field]: value });
  }

  function handleUpdateRefRange(paramId: string, ranges: ReferenceRange[]) {
    updateParamMutation.mutate({
      id: paramId,
      referenceRanges: ranges.map((r) => ({
        genderFilter: r.genderFilter ?? "ALL",
        ageMinYears: r.ageMinYears,
        ageMaxYears: r.ageMaxYears,
        lowNormal: r.lowNormal,
        highNormal: r.highNormal,
        lowCritical: r.lowCritical,
        highCritical: r.highCritical,
        unit: r.unit,
        notes: r.notes,
      })),
    });
  }

  // ─── Render ───────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/settings")}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">
                Report Builder
              </h1>
              <p className="text-sm text-slate-500">
                {testInfo ? `${testInfo.name} (${testInfo.code})` : "Loading..."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => autoFillMutation.mutate()}
              disabled={autoFillMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-violet-700 bg-violet-50 rounded-lg hover:bg-violet-100 disabled:opacity-50 transition-colors"
            >
              {autoFillMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Auto-Fill
            </button>
            <button
              onClick={() => setShowPreview(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <Eye className="w-4 h-4" />
              Preview
            </button>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="bg-white border-b border-slate-200 px-6">
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-teal-600 text-teal-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === "parameters" && (
          <ParametersTab
            parameters={parameters}
            isLoading={paramsLoading}
            selectedParamId={selectedParamId}
            selectedParam={selectedParam ?? null}
            showAddForm={showAddForm}
            newParam={newParam}
            onSelectParam={setSelectedParamId}
            onSetShowAdd={setShowAddForm}
            onSetNewParam={setNewParam}
            onCreateParam={() => {
              if (!newParam.name.trim()) return;
              createParamMutation.mutate(newParam);
            }}
            isCreating={createParamMutation.isPending}
            onUpdateField={handleUpdateField}
            onDeleteParam={(id) => deleteParamMutation.mutate(id)}
            onUpdateRefRange={handleUpdateRefRange}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          />
        )}

        {activeTab === "settings" && settings && (
          <SettingsTab
            settings={settings}
            onSave={(dto) => updateSettingsMutation.mutate(dto)}
            isSaving={updateSettingsMutation.isPending}
          />
        )}

        {activeTab === "supplementary" && settings && (
          <SupplementaryTab
            settings={settings}
            onSave={(dto) => updateSettingsMutation.mutate(dto)}
            isSaving={updateSettingsMutation.isPending}
          />
        )}
      </div>

      {/* Auto-Fill Modal */}
      {showAutoFill && autoFillMutation.data && (
        <AutoFillModal
          params={autoFillMutation.data}
          onApply={(selected) => bulkCreateMutation.mutate(selected)}
          onClose={() => setShowAutoFill(false)}
          isApplying={bulkCreateMutation.isPending}
        />
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">Report Preview</h3>
              <button onClick={() => setShowPreview(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              {previewHtml ? (
                <iframe
                  srcDoc={previewHtml}
                  className="w-full h-[600px] border border-slate-200 rounded-lg"
                  title="Report Preview"
                />
              ) : (
                <div className="flex items-center justify-center h-64 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mr-2" />
                  Loading preview...
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Parameters Tab ────────────────────────────

function ParametersTab({
  parameters,
  isLoading,
  selectedParamId,
  selectedParam,
  showAddForm,
  newParam,
  onSelectParam,
  onSetShowAdd,
  onSetNewParam,
  onCreateParam,
  isCreating,
  onUpdateField,
  onDeleteParam,
  onUpdateRefRange,
  onDragStart,
  onDragOver,
  onDragEnd,
}: {
  parameters: ReportParameter[];
  isLoading: boolean;
  selectedParamId: string | null;
  selectedParam: ReportParameter | null;
  showAddForm: boolean;
  newParam: { name: string; fieldType: string; unit: string; method: string };
  onSelectParam: (id: string | null) => void;
  onSetShowAdd: (v: boolean) => void;
  onSetNewParam: (v: { name: string; fieldType: string; unit: string; method: string }) => void;
  onCreateParam: () => void;
  isCreating: boolean;
  onUpdateField: (field: string, value: unknown) => void;
  onDeleteParam: (id: string) => void;
  onUpdateRefRange: (paramId: string, ranges: ReferenceRange[]) => void;
  onDragStart: (idx: number) => void;
  onDragOver: (e: React.DragEvent, idx: number) => void;
  onDragEnd: () => void;
}) {
  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Left — Parameter List */}
      <div className="col-span-5">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="font-medium text-slate-800 text-sm">
              Parameters ({parameters.length})
            </h3>
            <button
              onClick={() => onSetShowAdd(true)}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-teal-700 bg-teal-50 rounded-lg hover:bg-teal-100"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          </div>

          {/* Add Form */}
          {showAddForm && (
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 space-y-2">
              <input
                value={newParam.name}
                onChange={(e) => onSetNewParam({ ...newParam, name: e.target.value })}
                placeholder="Parameter name..."
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-1 focus:ring-teal-500 focus:border-teal-500 outline-none"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && onCreateParam()}
              />
              <div className="flex gap-2">
                <select
                  value={newParam.fieldType}
                  onChange={(e) => onSetNewParam({ ...newParam, fieldType: e.target.value })}
                  className="flex-1 px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                >
                  {FIELD_TYPES.map((ft) => (
                    <option key={ft.value} value={ft.value}>{ft.label}</option>
                  ))}
                </select>
                <input
                  value={newParam.unit}
                  onChange={(e) => onSetNewParam({ ...newParam, unit: e.target.value })}
                  placeholder="Unit"
                  className="w-20 px-2 py-1.5 text-xs border border-slate-200 rounded-lg"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => onSetShowAdd(false)}
                  className="px-3 py-1 text-xs text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={onCreateParam}
                  disabled={isCreating || !newParam.name.trim()}
                  className="px-3 py-1 text-xs font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50"
                >
                  {isCreating ? "Adding..." : "Add Parameter"}
                </button>
              </div>
            </div>
          )}

          {/* List */}
          <div className="max-h-[600px] overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center text-slate-400 text-sm">Loading...</div>
            ) : parameters.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                No parameters yet. Add manually or use Auto-Fill.
              </div>
            ) : (
              parameters.map((p, idx) => (
                <div
                  key={p.id}
                  draggable
                  onDragStart={() => onDragStart(idx)}
                  onDragOver={(e) => onDragOver(e, idx)}
                  onDragEnd={onDragEnd}
                  onClick={() => onSelectParam(p.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 border-b border-slate-50 cursor-pointer transition-colors ${
                    selectedParamId === p.id
                      ? "bg-teal-50 border-l-2 border-l-teal-600"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <GripVertical className="w-4 h-4 text-slate-300 flex-shrink-0 cursor-grab" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${p.fieldType === "HEADING" ? "text-slate-900" : "text-slate-700"}`}>
                        {p.name}
                      </span>
                      {p.isHighlighted && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-400">{p.fieldType}</span>
                      {p.unit && <span className="text-xs text-slate-400">• {p.unit}</span>}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Right — Parameter Detail / Editor */}
      <div className="col-span-7">
        {selectedParam ? (
          <ParameterEditor
            param={selectedParam}
            onUpdateField={onUpdateField}
            onDelete={() => onDeleteParam(selectedParam.id)}
            onUpdateRefRange={(ranges) => onUpdateRefRange(selectedParam.id, ranges)}
          />
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
            <ListOrdered className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="text-sm">Select a parameter to edit its details and reference ranges</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Parameter Editor ──────────────────────────

function ParameterEditor({
  param,
  onUpdateField,
  onDelete,
  onUpdateRefRange,
}: {
  param: ReportParameter;
  onUpdateField: (field: string, value: unknown) => void;
  onDelete: () => void;
  onUpdateRefRange: (ranges: ReferenceRange[]) => void;
}) {
  const [expandRanges, setExpandRanges] = useState(true);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
        <h3 className="font-medium text-slate-800">{param.name}</h3>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 space-y-4">
        {/* Name */}
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Name</label>
          <input
            defaultValue={param.name}
            onBlur={(e) => e.target.value !== param.name && onUpdateField("name", e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-1 focus:ring-teal-500 focus:border-teal-500 outline-none"
          />
        </div>

        {/* Field Type + Unit Row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Field Type</label>
            <select
              defaultValue={param.fieldType}
              onChange={(e) => onUpdateField("fieldType", e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
            >
              {FIELD_TYPES.map((ft) => (
                <option key={ft.value} value={ft.value}>{ft.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Unit</label>
            <input
              defaultValue={param.unit ?? ""}
              onBlur={(e) => onUpdateField("unit", e.target.value || null)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
            />
          </div>
        </div>

        {/* Method */}
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Method</label>
          <input
            defaultValue={param.method ?? ""}
            onBlur={(e) => onUpdateField("method", e.target.value || null)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
          />
        </div>

        {/* Options (for OPTION type) */}
        {param.fieldType === "OPTION" && (
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">
              Options (comma-separated)
            </label>
            <input
              defaultValue={(() => {
                try { return JSON.parse(param.options ?? "[]").join(", "); } catch { return param.options ?? ""; }
              })()}
              onBlur={(e) => {
                const opts = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
                onUpdateField("options", JSON.stringify(opts));
              }}
              placeholder="e.g. Positive, Negative, Equivocal"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
            />
          </div>
        )}

        {/* Formula (for FORMULA type) */}
        {param.fieldType === "FORMULA" && (
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Formula</label>
            <input
              defaultValue={param.formula ?? ""}
              onBlur={(e) => onUpdateField("formula", e.target.value || null)}
              placeholder="e.g. (param1 / param2) * 100"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono text-xs"
            />
          </div>
        )}

        {/* Default Value */}
        {!["HEADING", "NOTE"].includes(param.fieldType) && (
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Default Value</label>
            <input
              defaultValue={param.defaultValue ?? ""}
              onBlur={(e) => onUpdateField("defaultValue", e.target.value || null)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
            />
          </div>
        )}

        {/* Toggles */}
        <div className="flex gap-6 pt-2">
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={param.isHighlighted}
              onChange={(e) => onUpdateField("isHighlighted", e.target.checked)}
              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            Highlighted
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={param.isMandatory}
              onChange={(e) => onUpdateField("isMandatory", e.target.checked)}
              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            Mandatory
          </label>
        </div>

        {/* Reference Ranges */}
        {["NUMERIC", "FORMULA"].includes(param.fieldType) && (
          <div className="pt-2">
            <button
              onClick={() => setExpandRanges((v) => !v)}
              className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-2"
            >
              {expandRanges ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              Reference Ranges ({param.referenceRanges.length})
            </button>

            {expandRanges && (
              <div className="space-y-3">
                {param.referenceRanges.map((rr, i) => (
                  <div key={rr.id ?? i} className="p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-2">
                    <div className="flex items-center gap-2">
                      <select
                        defaultValue={rr.genderFilter ?? "ALL"}
                        onChange={(e) => {
                          const updated = [...param.referenceRanges];
                          updated[i] = { ...updated[i], genderFilter: e.target.value };
                          onUpdateRefRange(updated);
                        }}
                        className="px-2 py-1 text-xs border border-slate-200 rounded bg-white"
                      >
                        <option value="ALL">All</option>
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                      </select>
                      <input
                        type="number"
                        defaultValue={rr.ageMinYears ?? ""}
                        onBlur={(e) => {
                          const updated = [...param.referenceRanges];
                          updated[i] = { ...updated[i], ageMinYears: e.target.value ? Number(e.target.value) : null };
                          onUpdateRefRange(updated);
                        }}
                        placeholder="Age min"
                        className="w-16 px-2 py-1 text-xs border border-slate-200 rounded"
                      />
                      <span className="text-xs text-slate-400">–</span>
                      <input
                        type="number"
                        defaultValue={rr.ageMaxYears ?? ""}
                        onBlur={(e) => {
                          const updated = [...param.referenceRanges];
                          updated[i] = { ...updated[i], ageMaxYears: e.target.value ? Number(e.target.value) : null };
                          onUpdateRefRange(updated);
                        }}
                        placeholder="Age max"
                        className="w-16 px-2 py-1 text-xs border border-slate-200 rounded"
                      />
                      <span className="text-xs text-slate-400">yrs</span>
                      <button
                        onClick={() => {
                          const updated = param.referenceRanges.filter((_, j) => j !== i);
                          onUpdateRefRange(updated);
                        }}
                        className="ml-auto p-1 text-red-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400">Low Normal</label>
                        <input
                          type="number"
                          step="any"
                          defaultValue={rr.lowNormal ?? ""}
                          onBlur={(e) => {
                            const updated = [...param.referenceRanges];
                            updated[i] = { ...updated[i], lowNormal: e.target.value ? Number(e.target.value) : null };
                            onUpdateRefRange(updated);
                          }}
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400">High Normal</label>
                        <input
                          type="number"
                          step="any"
                          defaultValue={rr.highNormal ?? ""}
                          onBlur={(e) => {
                            const updated = [...param.referenceRanges];
                            updated[i] = { ...updated[i], highNormal: e.target.value ? Number(e.target.value) : null };
                            onUpdateRefRange(updated);
                          }}
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400">Low Critical</label>
                        <input
                          type="number"
                          step="any"
                          defaultValue={rr.lowCritical ?? ""}
                          onBlur={(e) => {
                            const updated = [...param.referenceRanges];
                            updated[i] = { ...updated[i], lowCritical: e.target.value ? Number(e.target.value) : null };
                            onUpdateRefRange(updated);
                          }}
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400">High Critical</label>
                        <input
                          type="number"
                          step="any"
                          defaultValue={rr.highCritical ?? ""}
                          onBlur={(e) => {
                            const updated = [...param.referenceRanges];
                            updated[i] = { ...updated[i], highCritical: e.target.value ? Number(e.target.value) : null };
                            onUpdateRefRange(updated);
                          }}
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  onClick={() =>
                    onUpdateRefRange([
                      ...param.referenceRanges,
                      { genderFilter: "ALL", lowNormal: null, highNormal: null, lowCritical: null, highCritical: null },
                    ])
                  }
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-teal-700 bg-teal-50 rounded hover:bg-teal-100"
                >
                  <Plus className="w-3 h-3" />
                  Add Range
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Settings Tab ──────────────────────────────

function SettingsTab({
  settings,
  onSave,
  isSaving,
}: {
  settings: ReportSettings;
  onSave: (dto: Partial<ReportSettings>) => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState({
    paperSize: settings.paperSize,
    orientation: settings.orientation,
    fontFamily: settings.fontFamily,
    fontSize: settings.fontSize,
    showMethod: settings.showMethod,
    showUnit: settings.showUnit,
    showRefRange: settings.showRefRange,
    showPrevResult: settings.showPrevResult,
    showInterpretation: settings.showInterpretation,
    interpretationTemplate: settings.interpretationTemplate ?? "",
    footerNotes: settings.footerNotes ?? "",
  });

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h3 className="font-medium text-slate-800">Report Layout Settings</h3>
        </div>
        <div className="p-5 space-y-5">
          {/* Paper + Orientation */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Paper Size</label>
              <select
                value={form.paperSize}
                onChange={(e) => setForm((f) => ({ ...f, paperSize: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              >
                {PAPER_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Orientation</label>
              <select
                value={form.orientation}
                onChange={(e) => setForm((f) => ({ ...f, orientation: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              >
                {ORIENTATIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>

          {/* Font + Size */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Font Family</label>
              <select
                value={form.fontFamily}
                onChange={(e) => setForm((f) => ({ ...f, fontFamily: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              >
                {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Font Size (px)</label>
              <input
                type="number"
                min={8}
                max={16}
                value={form.fontSize}
                onChange={(e) => setForm((f) => ({ ...f, fontSize: Number(e.target.value) }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider">Display Fields</h4>
            {([
              ["showMethod", "Show Method"],
              ["showUnit", "Show Unit"],
              ["showRefRange", "Show Reference Range"],
              ["showPrevResult", "Show Previous Result"],
              ["showInterpretation", "Show Interpretation"],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-3 text-sm text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))}
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                {label}
              </label>
            ))}
          </div>

          {/* Interpretation Template */}
          {form.showInterpretation && (
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Interpretation Template</label>
              <textarea
                value={form.interpretationTemplate}
                onChange={(e) => setForm((f) => ({ ...f, interpretationTemplate: e.target.value }))}
                rows={3}
                placeholder="Default interpretation text..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg resize-none"
              />
            </div>
          )}

          {/* Footer Notes */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Footer Notes</label>
            <textarea
              value={form.footerNotes}
              onChange={(e) => setForm((f) => ({ ...f, footerNotes: e.target.value }))}
              rows={2}
              placeholder="Notes to appear at the bottom of the report..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg resize-none"
            />
          </div>

          {/* Save */}
          <div className="pt-2 flex justify-end">
            <button
              onClick={() => onSave(form)}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Supplementary Tab ─────────────────────────

function SupplementaryTab({
  settings,
  onSave,
  isSaving,
}: {
  settings: ReportSettings;
  onSave: (dto: Partial<ReportSettings>) => void;
  isSaving: boolean;
}) {
  const [supplementary, setSupplementary] = useState(settings.supplementary ?? "");

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h3 className="font-medium text-slate-800">Supplementary Information</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Additional notes, methodology details, or disclaimers that appear at the end of the report
          </p>
        </div>
        <div className="p-5 space-y-4">
          <textarea
            value={supplementary}
            onChange={(e) => setSupplementary(e.target.value)}
            rows={12}
            placeholder="Enter supplementary information for this test report..."
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg resize-none font-mono"
          />
          <div className="flex justify-end">
            <button
              onClick={() => onSave({ supplementary: supplementary || null })}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Auto-Fill Modal ───────────────────────────

function AutoFillModal({
  params,
  onApply,
  onClose,
  isApplying,
}: {
  params: AutoFillParam[];
  onApply: (selected: AutoFillParam[]) => void;
  onClose: () => void;
  isApplying: boolean;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set(params.map((_, i) => i)));

  function toggleAll() {
    if (selected.size === params.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(params.map((_, i) => i)));
    }
  }

  function toggle(idx: number) {
    const next = new Set(selected);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setSelected(next);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-slate-900">Auto-Fill Results</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {params.length} parameters generated. Select which ones to add.
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="w-10 px-4 py-2">
                  <input
                    type="checkbox"
                    checked={selected.size === params.length}
                    onChange={toggleAll}
                    className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                </th>
                <th className="text-left px-4 py-2 font-medium text-slate-500">Parameter</th>
                <th className="text-left px-4 py-2 font-medium text-slate-500">Type</th>
                <th className="text-left px-4 py-2 font-medium text-slate-500">Unit</th>
                <th className="text-left px-4 py-2 font-medium text-slate-500">Ref. Range</th>
              </tr>
            </thead>
            <tbody>
              {params.map((p, i) => {
                const range = p.referenceRanges[0];
                return (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(i)}
                        onChange={() => toggle(i)}
                        className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                    </td>
                    <td className="px-4 py-2 font-medium text-slate-800">{p.name}</td>
                    <td className="px-4 py-2 text-slate-500">{p.fieldType}</td>
                    <td className="px-4 py-2 text-slate-500">{p.unit ?? "—"}</td>
                    <td className="px-4 py-2 text-slate-500">
                      {range ? `${range.lowNormal ?? ""} – ${range.highNormal ?? ""}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
          <span className="text-sm text-slate-500">{selected.size} of {params.length} selected</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">
              Cancel
            </button>
            <button
              onClick={() => {
                const selectedParams = params.filter((_, i) => selected.has(i));
                if (selectedParams.length > 0) onApply(selectedParams);
              }}
              disabled={isApplying || selected.size === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50"
            >
              {isApplying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add Selected
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
