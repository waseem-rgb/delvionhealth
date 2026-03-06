"use client";

import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

interface Field {
  name: string;
  type: string;
}

interface AddFormDialogProps {
  open: boolean;
  onClose: () => void;
}

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "boolean", label: "Checkbox" },
  { value: "select", label: "Dropdown" },
  { value: "textarea", label: "Long text" },
];

const FREQUENCIES = ["Daily", "Weekly", "Monthly", "Per Event", "Per Batch", "Per Round", "Annual", "Ongoing"];
const DEPARTMENTS = ["TECHNICAL", "MANAGEMENT"];

function buildSchemaFromFields(fields: Field[]): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  for (const f of fields) {
    if (!f.name.trim()) continue;
    const key = f.name.trim().replace(/\s+/g, "_").toLowerCase();
    let fieldType = "string";
    if (f.type === "number") fieldType = "number";
    else if (f.type === "boolean") fieldType = "boolean";
    properties[key] = { type: fieldType, description: f.name.trim() };
  }
  return { properties };
}

export default function AddFormDialog({ open, onClose }: AddFormDialogProps) {
  const queryClient = useQueryClient();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [category, setCategory] = useState("");
  const [frequency, setFrequency] = useState("Daily");
  const [type, setType] = useState("TECHNICAL");
  const [fields, setFields] = useState<Field[]>([{ name: "", type: "text" }]);

  const createMutation = useMutation({
    mutationFn: () =>
      api.post("/quality/forms", {
        formCode: formCode.trim(),
        name: formName.trim(),
        category: category.trim() || undefined,
        type,
        frequency,
        fields: buildSchemaFromFields(fields),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quality-forms"] });
      toast.success("Form template created");
      resetForm();
      onClose();
    },
    onError: () => toast.error("Failed to create form template"),
  });

  const resetForm = () => {
    setFormCode("");
    setFormName("");
    setCategory("");
    setFrequency("Daily");
    setType("TECHNICAL");
    setFields([{ name: "", type: "text" }]);
  };

  const addField = () => setFields([...fields, { name: "", type: "text" }]);
  const removeField = (i: number) => setFields(fields.filter((_, idx) => idx !== i));
  const updateField = (i: number, key: keyof Field, value: string) => {
    const updated = [...fields];
    updated[i] = { ...updated[i], [key]: value };
    setFields(updated);
  };

  const handleSubmit = () => {
    if (!formCode.trim()) { toast.error("Form code is required"); return; }
    if (!formName.trim()) { toast.error("Form name is required"); return; }
    createMutation.mutate();
  };

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Add Custom Form Template</h2>
            <p className="text-sm text-slate-500 mt-0.5">Create a new quality form for your lab.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Form Code *</label>
            <input
              type="text"
              value={formCode}
              onChange={(e) => setFormCode(e.target.value)}
              placeholder="e.g. CUSTOM-01"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Form Name *</label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Centrifuge Calibration Log"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Equipment, Safety, IQC"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Frequency</label>
              <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          {/* Fields builder */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Form Fields</label>
            <p className="text-xs text-slate-400 mb-2">Add the fields this form needs. You can add more later.</p>
            <div className="space-y-2">
              {fields.map((field, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={field.name}
                    onChange={(e) => updateField(i, "name", e.target.value)}
                    placeholder="Field name"
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                  <select
                    value={field.type}
                    onChange={(e) => updateField(i, "type", e.target.value)}
                    className="w-32 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  >
                    {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeField(i)}
                    disabled={fields.length === 1}
                    className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addField} className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
              <Plus className="w-3 h-3" /> Add Field
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={createMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {createMutation.isPending ? "Creating..." : "Create Form Template"}
          </button>
        </div>
      </div>
    </div>
  );
}
