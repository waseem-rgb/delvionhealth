"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BookOpenCheck, Plus, Search, ChevronDown, ChevronUp,
  Edit3, Copy, CheckCircle, X, Loader2, Save,
} from "lucide-react";
import api from "@/lib/api";

type ReportSection = {
  id: string;
  label: string;
  type: "text" | "richtext" | "select" | "checkbox";
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  subsections?: ReportSection[];
};

type Template = {
  id: string;
  investigationType: string;
  testType?: string;
  templateName: string;
  methodology: string;
  isDefault: boolean;
  isActive: boolean;
  sections: ReportSection[];
  createdAt: string;
};

const MODALITIES = [
  "ALL", "X-RAY", "CT", "MRI", "USG", "DOPPLER", "MOLECULAR", "GENETIC",
];

const MODALITY_COLORS: Record<string, string> = {
  "X-RAY": "bg-blue-100 text-blue-700 border-blue-200",
  "CT": "bg-purple-100 text-purple-700 border-purple-200",
  "MRI": "bg-pink-100 text-pink-700 border-pink-200",
  "USG": "bg-cyan-100 text-cyan-700 border-cyan-200",
  "DOPPLER": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "MOLECULAR": "bg-orange-100 text-orange-700 border-orange-200",
  "GENETIC": "bg-rose-100 text-rose-700 border-rose-200",
};

function SectionEditor({
  sections,
  onChange,
}: {
  sections: ReportSection[];
  onChange: (s: ReportSection[]) => void;
}) {
  const addSection = () => {
    onChange([
      ...sections,
      {
        id: `s_${Date.now()}`,
        label: "New Section",
        type: "richtext",
        placeholder: "Enter findings...",
      },
    ]);
  };

  const updateSection = (idx: number, patch: Partial<ReportSection>) => {
    const next = [...sections];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  const removeSection = (idx: number) => {
    onChange(sections.filter((_, i) => i !== idx));
  };

  const addSubsection = (idx: number) => {
    const next = [...sections];
    next[idx] = {
      ...next[idx],
      subsections: [
        ...(next[idx].subsections ?? []),
        {
          id: `sub_${Date.now()}`,
          label: "New Subsection",
          type: "text",
          placeholder: "Normal / Unremarkable",
        },
      ],
    };
    onChange(next);
  };

  const updateSubsection = (sIdx: number, subIdx: number, patch: Partial<ReportSection>) => {
    const next = [...sections];
    const subs = [...(next[sIdx].subsections ?? [])];
    subs[subIdx] = { ...subs[subIdx], ...patch };
    next[sIdx] = { ...next[sIdx], subsections: subs };
    onChange(next);
  };

  const removeSubsection = (sIdx: number, subIdx: number) => {
    const next = [...sections];
    next[sIdx] = {
      ...next[sIdx],
      subsections: (next[sIdx].subsections ?? []).filter((_, i) => i !== subIdx),
    };
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {sections.map((sec, idx) => (
        <div key={sec.id} className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <input
              value={sec.label}
              onChange={(e) => updateSection(idx, { label: e.target.value })}
              className="flex-1 bg-white text-slate-800 text-sm rounded px-2 py-1 border border-slate-300 focus:border-purple-500 outline-none"
              placeholder="Section label"
            />
            <select
              value={sec.type}
              onChange={(e) => updateSection(idx, { type: e.target.value as ReportSection["type"] })}
              className="bg-white text-slate-700 text-xs rounded px-2 py-1 border border-slate-300 focus:border-purple-500 outline-none"
            >
              <option value="text">Text</option>
              <option value="richtext">Rich Text</option>
            </select>
            <label className="flex items-center gap-1 text-xs text-slate-500 cursor-pointer">
              <input
                type="checkbox"
                checked={sec.required ?? false}
                onChange={(e) => updateSection(idx, { required: e.target.checked })}
                className="accent-purple-500"
              />
              Req
            </label>
            <button
              onClick={() => addSubsection(idx)}
              className="text-xs text-purple-600 hover:text-purple-500 px-1"
              title="Add subsection"
            >
              + Sub
            </button>
            <button onClick={() => removeSection(idx)} className="text-red-400 hover:text-red-500">
              <X className="w-4 h-4" />
            </button>
          </div>
          <input
            value={sec.placeholder ?? ""}
            onChange={(e) => updateSection(idx, { placeholder: e.target.value })}
            className="w-full bg-slate-50 text-slate-500 text-xs rounded px-2 py-1 border border-slate-200 focus:border-slate-400 outline-none mb-2"
            placeholder="Placeholder text..."
          />
          {/* Subsections */}
          {(sec.subsections ?? []).length > 0 && (
            <div className="ml-4 space-y-2 border-l-2 border-slate-200 pl-3">
              {(sec.subsections ?? []).map((sub, subIdx) => (
                <div key={sub.id} className="flex items-center gap-2">
                  <input
                    value={sub.label}
                    onChange={(e) => updateSubsection(idx, subIdx, { label: e.target.value })}
                    className="flex-1 bg-white text-slate-800 text-xs rounded px-2 py-1 border border-slate-300 focus:border-purple-500 outline-none"
                    placeholder="Subsection label"
                  />
                  <input
                    value={sub.placeholder ?? ""}
                    onChange={(e) => updateSubsection(idx, subIdx, { placeholder: e.target.value })}
                    className="flex-1 bg-slate-50 text-slate-500 text-xs rounded px-2 py-1 border border-slate-200 focus:border-slate-400 outline-none"
                    placeholder="Placeholder..."
                  />
                  <button
                    onClick={() => removeSubsection(idx, subIdx)}
                    className="text-red-400 hover:text-red-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      <button
        onClick={addSection}
        className="w-full border border-dashed border-slate-300 rounded-lg py-2 text-sm text-slate-500 hover:border-purple-400 hover:text-purple-600 transition-colors"
      >
        <Plus className="w-4 h-4 inline mr-1" /> Add Section
      </button>
    </div>
  );
}

function TemplateCard({
  template,
  onEdit,
  onClone,
}: {
  template: Template;
  onEdit: (t: Template) => void;
  onClone: (t: Template) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors shadow-sm">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                MODALITY_COLORS[template.investigationType] ?? "bg-slate-100 text-slate-600 border-slate-200"
              }`}
            >
              {template.investigationType}
            </span>
            {template.isDefault && (
              <span className="text-xs bg-yellow-100 text-yellow-700 border border-yellow-200 px-2 py-0.5 rounded-full">
                Default
              </span>
            )}
            {!template.isActive && (
              <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                Inactive
              </span>
            )}
          </div>
          <h3 className="text-slate-900 font-medium text-sm">{template.templateName}</h3>
          {template.testType && (
            <p className="text-slate-500 text-xs mt-0.5">{template.testType}</p>
          )}
        </div>
        <div className="flex items-center gap-1 ml-2 shrink-0">
          <button
            onClick={() => onEdit(template)}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
            title="Edit template"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onClone(template)}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
            title="Clone template"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span>{template.sections.length} sections</span>
        <span>•</span>
        <span>{template.methodology}</span>
      </div>
      {expanded && (
        <div className="mt-3 pt-3 border-t border-slate-200">
          <div className="space-y-1">
            {template.sections.map((sec) => (
              <div key={sec.id} className="text-xs">
                <span className="text-slate-600">{sec.label}</span>
                {(sec.subsections ?? []).length > 0 && (
                  <span className="text-slate-400 ml-2">
                    ({sec.subsections!.length} subsections)
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const EMPTY_TEMPLATE: Omit<Template, "id" | "createdAt" | "isActive"> = {
  investigationType: "X-RAY",
  testType: "",
  templateName: "",
  methodology: "",
  isDefault: false,
  sections: [],
};

export default function TemplatesPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"list" | "editor">("list");
  const [search, setSearch] = useState("");
  const [modalityFilter, setModalityFilter] = useState("ALL");
  const [editingTemplate, setEditingTemplate] = useState<Partial<Template> & typeof EMPTY_TEMPLATE | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ["non-path-templates"],
    queryFn: () =>
      api.get("/non-path/templates").then((r) => r.data as Template[]),
  });

  const saveMutation = useMutation({
    mutationFn: (data: typeof EMPTY_TEMPLATE & { id?: string }) => {
      if (data.id) {
        return api.patch(`/non-path/templates/${data.id}`, data);
      }
      return api.post("/non-path/templates", data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["non-path-templates"] });
      setActiveTab("list");
      setEditingTemplate(null);
      setSaveError(null);
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Save failed";
      setSaveError(msg);
    },
  });

  const seedMutation = useMutation({
    mutationFn: () => api.post("/non-path/templates/seed"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["non-path-templates"] }),
  });

  const filtered = templates.filter((t) => {
    const matchesSearch =
      !search ||
      t.templateName.toLowerCase().includes(search.toLowerCase()) ||
      t.testType?.toLowerCase().includes(search.toLowerCase());
    const matchesModality = modalityFilter === "ALL" || t.investigationType === modalityFilter;
    return matchesSearch && matchesModality;
  });

  const grouped = MODALITIES.slice(1).reduce<Record<string, Template[]>>((acc, mod) => {
    const items = filtered.filter((t) => t.investigationType === mod);
    if (items.length > 0) acc[mod] = items;
    return acc;
  }, {});

  const handleEdit = (t: Template) => {
    setEditingTemplate({ ...t });
    setActiveTab("editor");
  };

  const handleClone = (t: Template) => {
    setEditingTemplate({
      ...t,
      id: undefined,
      templateName: `${t.templateName} (Copy)`,
      isDefault: false,
    });
    setActiveTab("editor");
  };

  const handleNew = () => {
    setEditingTemplate({ ...EMPTY_TEMPLATE });
    setActiveTab("editor");
  };

  const handleSave = () => {
    if (!editingTemplate) return;
    if (!editingTemplate.templateName.trim()) {
      setSaveError("Template name is required");
      return;
    }
    if (!editingTemplate.investigationType) {
      setSaveError("Modality is required");
      return;
    }
    setSaveError(null);
    saveMutation.mutate(editingTemplate as typeof EMPTY_TEMPLATE & { id?: string });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <BookOpenCheck className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Report Templates</h1>
              <p className="text-sm text-slate-500">{templates.length} templates configured</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {seedMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Seed Defaults
            </button>
            <button
              onClick={handleNew}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" /> New Template
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 mb-6">
          <button
            onClick={() => setActiveTab("list")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "list"
                ? "border-purple-500 text-purple-600"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            All Templates
          </button>
          <button
            onClick={() => {
              if (!editingTemplate) handleNew();
              else setActiveTab("editor");
            }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "editor"
                ? "border-purple-500 text-purple-600"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            Template Editor
            {editingTemplate && (
              <span className="ml-1.5 text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded">
                editing
              </span>
            )}
          </button>
        </div>

        {/* List Tab */}
        {activeTab === "list" && (
          <>
            {/* Filters */}
            <div className="flex items-center gap-3 mb-5">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search templates..."
                  className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-purple-500 outline-none"
                />
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {MODALITIES.map((m) => (
                  <button
                    key={m}
                    onClick={() => setModalityFilter(m)}
                    className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                      modalityFilter === m
                        ? "bg-purple-600 text-white"
                        : "bg-white border border-slate-200 text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                <BookOpenCheck className="w-10 h-10 mb-3 opacity-40" />
                <p>No templates found</p>
                <button
                  onClick={() => seedMutation.mutate()}
                  className="mt-3 text-sm text-purple-600 hover:text-purple-500"
                >
                  Seed default templates →
                </button>
              </div>
            ) : modalityFilter !== "ALL" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {filtered.map((t) => (
                  <TemplateCard key={t.id} template={t} onEdit={handleEdit} onClone={handleClone} />
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(grouped).map(([mod, items]) => (
                  <div key={mod}>
                    <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
                      {mod}
                      <span className="ml-2 text-slate-400 normal-case text-xs">{items.length} templates</span>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {items.map((t) => (
                        <TemplateCard key={t.id} template={t} onEdit={handleEdit} onClone={handleClone} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Editor Tab */}
        {activeTab === "editor" && editingTemplate && (
          <div className="max-w-3xl">
            {saveError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
                <X className="w-4 h-4 shrink-0" />
                {saveError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Template Name *</label>
                <input
                  value={editingTemplate.templateName}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, templateName: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-purple-500 outline-none"
                  placeholder="e.g. CT Brain Standard"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Modality *</label>
                <select
                  value={editingTemplate.investigationType}
                  onChange={(e) =>
                    setEditingTemplate({ ...editingTemplate, investigationType: e.target.value })
                  }
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-purple-500 outline-none"
                >
                  {MODALITIES.slice(1).map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Test Type / Sub-category</label>
                <input
                  value={editingTemplate.testType ?? ""}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, testType: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-purple-500 outline-none"
                  placeholder="e.g. Brain with Contrast"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Methodology</label>
                <input
                  value={editingTemplate.methodology}
                  onChange={(e) =>
                    setEditingTemplate({ ...editingTemplate, methodology: e.target.value })
                  }
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-purple-500 outline-none"
                  placeholder="e.g. 1.5T MRI, 64-slice CT"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingTemplate.isDefault}
                  onChange={(e) =>
                    setEditingTemplate({ ...editingTemplate, isDefault: e.target.checked })
                  }
                  className="accent-purple-500"
                />
                <span className="text-sm text-slate-700">Set as default template for this modality</span>
              </label>
            </div>

            <div className="mb-6">
              <label className="block text-xs font-medium text-slate-500 mb-2">
                Sections
                <span className="ml-2 text-slate-400">(drag to reorder — coming soon)</span>
              </label>
              <SectionEditor
                sections={editingTemplate.sections}
                onChange={(s) => setEditingTemplate({ ...editingTemplate, sections: s })}
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saveMutation.isPending ? "Saving..." : "Save Template"}
              </button>
              <button
                onClick={() => {
                  setEditingTemplate(null);
                  setActiveTab("list");
                  setSaveError(null);
                }}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
