"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface FieldSchema {
  type?: string;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  items?: Record<string, FieldSchema>;
  properties?: Record<string, FieldSchema>;
  description?: string;
}

interface FormSchema {
  properties?: Record<string, FieldSchema>;
  acceptanceCriteria?: string;
  sections?: { title: string; fields: string[] }[];
}

export interface FormTemplate {
  id: string;
  formCode: string;
  name: string;
  category: string | null;
  type: string;
  frequency: string | null;
  fields: FormSchema | null;
}

interface FormRendererProps {
  template: FormTemplate;
  formData: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fieldLabel(name: string): string {
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}

function isOutOfRange(value: string | number, min: number, max: number): boolean {
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(n) || value === "" || value === undefined) return false;
  return n < min || n > max;
}

const days = Array.from({ length: 31 }, (_, i) => i + 1);

// ── Temperature Log (TECH-01) ────────────────────────────────────────────────

function TemperatureLogRenderer({ formData, onChange }: Omit<FormRendererProps, "template">) {
  const rows = (formData.rows ?? days.map((d) => ({ day: d, mFridge: "", mFreezer: "", mStaff: "", aFridge: "", aFreezer: "", aStaff: "" }))) as Record<string, string | number>[];

  const updateRow = (idx: number, field: string, value: string) => {
    const updated = [...rows];
    updated[idx] = { ...updated[idx], [field]: value };
    onChange({ ...formData, rows: updated });
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-slate-50">
            <th className="border border-slate-200 px-2 py-2 text-left w-14">Day</th>
            <th colSpan={3} className="border border-slate-200 px-2 py-2 text-center bg-blue-50 text-blue-700">Morning Reading</th>
            <th colSpan={3} className="border border-slate-200 px-2 py-2 text-center bg-amber-50 text-amber-700">Afternoon Reading</th>
          </tr>
          <tr className="bg-slate-50 text-[10px] text-slate-500">
            <th className="border border-slate-200 px-2 py-1"></th>
            <th className="border border-slate-200 px-2 py-1">Fridge (°C)</th>
            <th className="border border-slate-200 px-2 py-1">Freezer (°C)</th>
            <th className="border border-slate-200 px-2 py-1">Staff</th>
            <th className="border border-slate-200 px-2 py-1">Fridge (°C)</th>
            <th className="border border-slate-200 px-2 py-1">Freezer (°C)</th>
            <th className="border border-slate-200 px-2 py-1">Staff</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-slate-50/50">
              <td className="border border-slate-200 px-2 py-1 font-mono text-slate-500 text-center">{row.day}</td>
              {(["mFridge", "mFreezer", "mStaff", "aFridge", "aFreezer", "aStaff"] as const).map((field) => {
                const isTempField = field.includes("Fridge") || field.includes("Freezer");
                const isFridge = field.includes("Fridge");
                const outOfRange = isTempField && isOutOfRange(row[field], isFridge ? 2 : -100, isFridge ? 8 : -15);
                return (
                  <td key={field} className="border border-slate-200 p-0">
                    <input
                      type={isTempField ? "number" : "text"}
                      step={isTempField ? "0.1" : undefined}
                      value={row[field] ?? ""}
                      onChange={(e) => updateRow(i, field, e.target.value)}
                      className={cn(
                        "w-full px-2 py-1.5 text-xs border-0 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-blue-400",
                        outOfRange ? "bg-red-50 text-red-700 font-semibold" : ""
                      )}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 px-2 py-1.5 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
        Acceptance Criteria: Fridge: 2-8°C | Freezer: &lt; -15°C — Out-of-range values highlighted in red
      </div>
    </div>
  );
}

// ── Temperature & Humidity (TECH-02) ─────────────────────────────────────────

function TempHumidityRenderer({ formData, onChange }: Omit<FormRendererProps, "template">) {
  const rows = (formData.rows ?? days.map((d) => ({ day: d, mTemp: "", mHumidity: "", mTime: "", mStaff: "", eTemp: "", eHumidity: "", eTime: "", eStaff: "" }))) as Record<string, string | number>[];

  const updateRow = (idx: number, field: string, value: string) => {
    const updated = [...rows];
    updated[idx] = { ...updated[idx], [field]: value };
    onChange({ ...formData, rows: updated });
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-slate-50">
            <th className="border border-slate-200 px-2 py-2 text-left w-14">Day</th>
            <th colSpan={4} className="border border-slate-200 px-2 py-2 text-center bg-blue-50 text-blue-700">Morning</th>
            <th colSpan={4} className="border border-slate-200 px-2 py-2 text-center bg-amber-50 text-amber-700">Evening</th>
          </tr>
          <tr className="bg-slate-50 text-[10px] text-slate-500">
            <th className="border border-slate-200 px-2 py-1"></th>
            <th className="border border-slate-200 px-2 py-1">Temp (°C)</th>
            <th className="border border-slate-200 px-2 py-1">Humidity (%)</th>
            <th className="border border-slate-200 px-2 py-1">Time</th>
            <th className="border border-slate-200 px-2 py-1">Staff</th>
            <th className="border border-slate-200 px-2 py-1">Temp (°C)</th>
            <th className="border border-slate-200 px-2 py-1">Humidity (%)</th>
            <th className="border border-slate-200 px-2 py-1">Time</th>
            <th className="border border-slate-200 px-2 py-1">Staff</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-slate-50/50">
              <td className="border border-slate-200 px-2 py-1 font-mono text-slate-500 text-center">{row.day}</td>
              {(["mTemp", "mHumidity", "mTime", "mStaff", "eTemp", "eHumidity", "eTime", "eStaff"] as const).map((field) => {
                const isTemp = field.includes("Temp");
                const isHumidity = field.includes("Humidity");
                const isTime = field.includes("Time");
                const outOfRange = (isTemp && isOutOfRange(row[field], 15, 30)) || (isHumidity && isOutOfRange(row[field], 10, 85));
                return (
                  <td key={field} className="border border-slate-200 p-0">
                    <input
                      type={isTemp || isHumidity ? "number" : isTime ? "time" : "text"}
                      step={isTemp || isHumidity ? "0.1" : undefined}
                      value={row[field] ?? ""}
                      onChange={(e) => updateRow(i, field, e.target.value)}
                      className={cn(
                        "w-full px-2 py-1.5 text-xs border-0 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-blue-400",
                        outOfRange ? "bg-red-50 text-red-700 font-semibold" : ""
                      )}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 px-2 py-1.5 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
        Acceptance Criteria: Temperature: 15-30°C | Humidity: 10-85% — Out-of-range values highlighted in red
      </div>
    </div>
  );
}

// ── Maintenance Checklist Renderer ───────────────────────────────────────────

function MaintenanceChecklistRenderer({ formData, onChange }: Omit<FormRendererProps, "template">) {
  const today = new Date();
  const isMonday = today.getDay() === 1;
  const isFirstOfMonth = today.getDate() === 1;

  const sections = [
    { key: "daily", label: "Daily Checks", isDue: true, tasks: ["Visual inspection of equipment", "Clean work surfaces", "Check reagent levels", "Verify calibration status", "Check waste disposal"] },
    { key: "weekly", label: "Weekly Checks", isDue: isMonday, tasks: ["Deep clean equipment", "Check backup systems", "Review maintenance logs", "Inspect safety equipment", "Test emergency procedures"] },
    { key: "monthly", label: "Monthly Checks", isDue: isFirstOfMonth, tasks: ["Full calibration verification", "Replace filters/consumables", "Comprehensive safety audit", "Review SOPs compliance", "Equipment performance review"] },
  ];

  const checks = (formData.checks ?? {}) as Record<string, Record<string, { done: boolean; remarks: string }>>;

  const updateCheck = (sectionKey: string, taskIdx: number, field: "done" | "remarks", value: boolean | string) => {
    const section = { ...(checks[sectionKey] ?? {}) };
    const task = { ...(section[taskIdx] ?? { done: false, remarks: "" }) };
    (task as Record<string, boolean | string>)[field] = value;
    section[taskIdx] = task;
    onChange({ ...formData, checks: { ...checks, [sectionKey]: section } });
  };

  return (
    <div className="space-y-4">
      {sections.map((section) => {
        const [open, setOpen] = useState(section.isDue);
        return (
          <div key={section.key} className="border border-slate-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setOpen(!open)}
              className={cn(
                "w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-left",
                section.isDue ? "bg-blue-50 text-blue-800" : "bg-slate-50 text-slate-600"
              )}
            >
              <span className="flex items-center gap-2">
                {section.label}
                {section.isDue && (
                  <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-semibold">DUE TODAY</span>
                )}
              </span>
              <span className="text-xs">{open ? "▲" : "▼"}</span>
            </button>
            {open && (
              <div className="divide-y divide-slate-100">
                {section.tasks.map((task, idx) => {
                  const check = checks[section.key]?.[idx] ?? { done: false, remarks: "" };
                  return (
                    <div key={idx} className="flex items-center gap-3 px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={check.done}
                        onChange={(e) => updateCheck(section.key, idx, "done", e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className={cn("text-sm flex-1", check.done ? "line-through text-slate-400" : "text-slate-700")}>{task}</span>
                      <input
                        type="text"
                        placeholder="Remarks"
                        value={check.remarks}
                        onChange={(e) => updateCheck(section.key, idx, "remarks", e.target.value)}
                        className="w-40 px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Checklist Table Renderer (TECH-33 First Aid, TECH-19 Spillage, etc.) ────

function ChecklistTableRenderer({ formData, onChange, columns }: Omit<FormRendererProps, "template"> & { columns: string[] }) {
  const rows = (formData.items ?? [{ item: "", qty: "", adequate: "Yes", remarks: "" }]) as Record<string, string>[];

  const updateRow = (idx: number, field: string, value: string) => {
    const updated = [...rows];
    updated[idx] = { ...updated[idx], [field]: value };
    onChange({ ...formData, items: updated });
  };

  const addRow = () => onChange({ ...formData, items: [...rows, { item: "", qty: "", adequate: "Yes", remarks: "" }] });
  const removeRow = (idx: number) => {
    const updated = rows.filter((_, i) => i !== idx);
    onChange({ ...formData, items: updated.length ? updated : [{ item: "", qty: "", adequate: "Yes", remarks: "" }] });
  };

  const colKeys = ["item", "qty", "adequate", "remarks"];

  return (
    <div>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-slate-50">
            {columns.map((col) => (
              <th key={col} className="border border-slate-200 px-3 py-2 text-left text-xs font-medium text-slate-500">{col}</th>
            ))}
            <th className="border border-slate-200 px-2 py-2 w-10"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {colKeys.slice(0, columns.length).map((key) => (
                <td key={key} className="border border-slate-200 p-0">
                  {key === "adequate" ? (
                    <select
                      value={row[key] ?? "Yes"}
                      onChange={(e) => updateRow(i, key, e.target.value)}
                      className="w-full px-2 py-2 text-sm border-0 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-blue-400"
                    >
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  ) : (
                    <input
                      type={key === "qty" ? "number" : "text"}
                      value={row[key] ?? ""}
                      onChange={(e) => updateRow(i, key, e.target.value)}
                      className="w-full px-2 py-2 text-sm border-0 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-blue-400"
                    />
                  )}
                </td>
              ))}
              <td className="border border-slate-200 px-1 text-center">
                <button type="button" onClick={() => removeRow(i)} className="text-slate-400 hover:text-red-500 text-xs">✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={addRow} className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium">+ Add Row</button>
    </div>
  );
}

// ── Repeatable Rows (generic) ────────────────────────────────────────────────

function RepeatableRowsRenderer({ fields, formData, dataKey, onChange }: {
  fields: { name: string; type?: string; enumValues?: string[] }[];
  formData: Record<string, unknown>;
  dataKey: string;
  onChange: (data: Record<string, unknown>) => void;
}) {
  const rows = (formData[dataKey] ?? [{}]) as Record<string, string>[];

  const updateRow = (idx: number, field: string, value: string) => {
    const updated = [...rows];
    updated[idx] = { ...updated[idx], [field]: value };
    onChange({ ...formData, [dataKey]: updated });
  };

  const addRow = () => onChange({ ...formData, [dataKey]: [...rows, {}] });
  const removeRow = (idx: number) => {
    const updated = rows.filter((_, i) => i !== idx);
    onChange({ ...formData, [dataKey]: updated.length ? updated : [{}] });
  };

  return (
    <div>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-slate-50">
            {fields.map((f) => (
              <th key={f.name} className="border border-slate-200 px-3 py-2 text-left text-xs font-medium text-slate-500">{fieldLabel(f.name)}</th>
            ))}
            <th className="border border-slate-200 px-2 py-2 w-10"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {fields.map((f) => (
                <td key={f.name} className="border border-slate-200 p-0">
                  {f.enumValues ? (
                    <select value={row[f.name] ?? ""} onChange={(e) => updateRow(i, f.name, e.target.value)} className="w-full px-2 py-2 text-sm border-0 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-blue-400">
                      <option value="">Select...</option>
                      {f.enumValues.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  ) : (
                    <input
                      type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                      value={row[f.name] ?? ""}
                      onChange={(e) => updateRow(i, f.name, e.target.value)}
                      className="w-full px-2 py-2 text-sm border-0 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-blue-400"
                    />
                  )}
                </td>
              ))}
              <td className="border border-slate-200 px-1 text-center">
                <button type="button" onClick={() => removeRow(i)} className="text-slate-400 hover:text-red-500 text-xs">✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={addRow} className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium">+ Add Row</button>
    </div>
  );
}

// ── Generic Field Renderer ───────────────────────────────────────────────────

function GenericFieldRenderer({ formData, onChange, schema }: Omit<FormRendererProps, "template"> & { schema?: FormSchema | null }) {
  const properties = schema?.properties ?? {};
  const fieldNames = Object.keys(properties);

  if (fieldNames.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Form Data</label>
          <textarea
            value={(formData.freeText as string) ?? ""}
            onChange={(e) => onChange({ ...formData, freeText: e.target.value })}
            rows={8}
            placeholder="Enter form data..."
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {fieldNames.map((name) => {
        const config = properties[name];
        const value = formData[name] ?? "";
        const setVal = (v: unknown) => onChange({ ...formData, [name]: v });
        const label = config.description || fieldLabel(name);

        const isDate = name.toLowerCase().includes("date");
        const isSignature = name.toLowerCase().includes("sign");
        const isLongText = name.toLowerCase().includes("remarks") || name.toLowerCase().includes("notes") || name.toLowerCase().includes("description") || name.toLowerCase().includes("comments") || name.toLowerCase().includes("observation");

        if (config.enum) {
          return (
            <div key={name}>
              <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
              <select value={value as string} onChange={(e) => setVal(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                <option value="">Select...</option>
                {config.enum.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          );
        }

        if (config.type === "boolean") {
          return (
            <div key={name} className="flex items-center gap-3">
              <input type="checkbox" checked={!!value} onChange={(e) => setVal(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
              <label className="text-sm font-medium text-slate-700">{label}</label>
            </div>
          );
        }

        if (config.type === "number") {
          return (
            <div key={name}>
              <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
              <input type="number" value={value as string} onChange={(e) => setVal(e.target.value)} min={config.minimum} max={config.maximum} step="0.01" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
          );
        }

        if (isLongText) {
          return (
            <div key={name}>
              <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
              <textarea value={value as string} onChange={(e) => setVal(e.target.value)} rows={3} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
          );
        }

        return (
          <div key={name}>
            <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
            <input
              type={isDate ? "date" : isSignature ? "text" : "text"}
              value={value as string}
              onChange={(e) => setVal(e.target.value)}
              placeholder={isSignature ? "Name / Initials" : ""}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
        );
      })}
    </div>
  );
}

// ── Built-in schemas for known forms ─────────────────────────────────────────

const KNOWN_SCHEMAS: Record<string, FormSchema> = {
  "MGT-01": {
    properties: {
      auditPeriod: { type: "string", description: "Audit Period" },
      auditObjective: { type: "string", description: "Audit Objective" },
      leadAuditor: { type: "string", description: "Lead Auditor" },
    },
  },
  "MGT-05": {
    properties: {
      ncNumber: { type: "string", description: "NC Number" },
      auditDate: { type: "string", description: "Audit Date" },
      department: { type: "string", description: "Department" },
      clauseRef: { type: "string", description: "ISO Clause Reference" },
      ncDescription: { type: "string", description: "Nonconformance Description" },
      rootCause: { type: "string", description: "Root Cause Analysis" },
      correctiveAction: { type: "string", description: "Corrective Action" },
      targetDate: { type: "string", description: "Target Completion Date" },
      responsiblePerson: { type: "string", description: "Responsible Person" },
      verificationRemarks: { type: "string", description: "Verification Remarks" },
    },
  },
  "MGT-08": {
    properties: {
      date: { type: "string", description: "Date" },
      department: { type: "string", description: "Department" },
      ncType: { type: "string", description: "NC Type", enum: ["Pre-analytical", "Analytical", "Post-analytical", "Administrative"] },
      ncDescription: { type: "string", description: "Description" },
      immediateAction: { type: "string", description: "Immediate Action Taken" },
      reportedBy: { type: "string", description: "Reported By" },
    },
  },
  "MGT-12": {
    properties: {
      month: { type: "string", description: "Month" },
      indicatorName: { type: "string", description: "Quality Indicator" },
      numerator: { type: "number", description: "Numerator" },
      denominator: { type: "number", description: "Denominator" },
      percentage: { type: "number", description: "Percentage (%)" },
      target: { type: "number", description: "Target (%)" },
      remarks: { type: "string", description: "Remarks" },
    },
  },
  "MGT-13": {
    properties: {
      paNumber: { type: "string", description: "PA Number" },
      identifiedRisk: { type: "string", description: "Identified Risk / Potential NC" },
      riskLevel: { type: "string", description: "Risk Level", enum: ["Low", "Medium", "High", "Critical"] },
      preventiveAction: { type: "string", description: "Preventive Action Planned" },
      targetDate: { type: "string", description: "Target Date" },
      responsiblePerson: { type: "string", description: "Responsible Person" },
      verificationRemarks: { type: "string", description: "Verification Remarks" },
    },
  },
  "MGT-17": {
    properties: {
      incidentDate: { type: "string", description: "Incident Date" },
      incidentTime: { type: "string", description: "Incident Time" },
      location: { type: "string", description: "Location" },
      incidentType: { type: "string", description: "Type", enum: ["Needle Stick", "Chemical Spill", "Equipment Failure", "Fire", "Slip/Fall", "Other"] },
      description: { type: "string", description: "Description of Incident" },
      injuryDetails: { type: "string", description: "Injury Details (if any)" },
      actionTaken: { type: "string", description: "Immediate Action Taken" },
      reportedBy: { type: "string", description: "Reported By" },
      supervisorRemarks: { type: "string", description: "Supervisor Remarks" },
    },
  },
  "TECH-03": {
    properties: {
      patientId: { type: "string", description: "Patient ID / MRN" },
      patientName: { type: "string", description: "Patient Name" },
      testName: { type: "string", description: "Test Name" },
      result: { type: "string", description: "Result Value" },
      alertLevel: { type: "string", description: "Alert Level", enum: ["Low Critical", "Low", "High", "High Critical"] },
      referenceRange: { type: "string", description: "Reference Range" },
      clinicianName: { type: "string", description: "Clinician Name" },
      clinicianContacted: { type: "boolean", description: "Clinician Contacted?" },
      contactTime: { type: "string", description: "Time of Contact" },
      informedBy: { type: "string", description: "Informed By" },
      remarks: { type: "string", description: "Remarks" },
    },
  },
  "TECH-04": {
    properties: {
      reagentName: { type: "string", description: "Reagent Name" },
      manufacturer: { type: "string", description: "Manufacturer" },
      lotNumber: { type: "string", description: "Lot / Batch Number" },
      expiryDate: { type: "string", description: "Expiry Date" },
      receivedDate: { type: "string", description: "Date Received" },
      verificationDate: { type: "string", description: "Verification Date" },
      testMethod: { type: "string", description: "Verification Method" },
      resultAcceptable: { type: "boolean", description: "Result Acceptable?" },
      remarks: { type: "string", description: "Remarks" },
      verifiedBy: { type: "string", description: "Verified By" },
    },
  },
  "TECH-05": {
    properties: {
      sampleId: { type: "string", description: "Sample ID" },
      testName: { type: "string", description: "Test Name" },
      originalResult: { type: "string", description: "Original Result" },
      retestResult: { type: "string", description: "Retest Result" },
      reasonForRetest: { type: "string", description: "Reason for Retest" },
      resultsMatch: { type: "boolean", description: "Results Agree?" },
      finalAction: { type: "string", description: "Final Action", enum: ["Accept Original", "Accept Retest", "Further Investigation"] },
      remarks: { type: "string", description: "Remarks" },
      performedBy: { type: "string", description: "Performed By" },
    },
  },
  "TECH-31": {
    properties: {
      instrumentName: { type: "string", description: "Instrument Name" },
      instrumentId: { type: "string", description: "Instrument / Asset ID" },
      breakdownDate: { type: "string", description: "Breakdown Date" },
      breakdownTime: { type: "string", description: "Breakdown Time" },
      natureOfProblem: { type: "string", description: "Nature of Problem" },
      immediateAction: { type: "string", description: "Immediate Action Taken" },
      engineerContacted: { type: "boolean", description: "Service Engineer Contacted?" },
      engineerName: { type: "string", description: "Engineer Name" },
      resolutionDate: { type: "string", description: "Resolution Date" },
      rootCause: { type: "string", description: "Root Cause" },
      preventiveAction: { type: "string", description: "Preventive Action" },
      reportedBy: { type: "string", description: "Reported By" },
    },
  },
  "TECH-37": {
    properties: {
      sampleId: { type: "string", description: "Sample ID" },
      patientName: { type: "string", description: "Patient Name" },
      sampleType: { type: "string", description: "Sample Type", enum: ["Blood", "Urine", "Serum", "Plasma", "CSF", "Stool", "Swab", "Other"] },
      rejectionReason: { type: "string", description: "Rejection Reason", enum: ["Hemolyzed", "Lipemic", "Clotted", "Insufficient Volume", "Wrong Container", "Unlabeled", "Mismatch", "Expired", "Contaminated", "Other"] },
      collectedBy: { type: "string", description: "Collected By" },
      collectionTime: { type: "string", description: "Collection Time" },
      receivedTime: { type: "string", description: "Received Time" },
      recollectionAdvised: { type: "boolean", description: "Recollection Advised?" },
      remarks: { type: "string", description: "Remarks" },
      rejectedBy: { type: "string", description: "Rejected By" },
    },
  },
};

// ── Main FormRenderer ────────────────────────────────────────────────────────

export default function FormRenderer({ template, formData, onChange }: FormRendererProps) {
  const code = template.formCode;

  // Special renderers for known form types
  if (code === "TECH-01") {
    return <TemperatureLogRenderer formData={formData} onChange={onChange} />;
  }
  if (code === "TECH-02") {
    return <TempHumidityRenderer formData={formData} onChange={onChange} />;
  }
  if (code === "TECH-33") {
    return <ChecklistTableRenderer formData={formData} onChange={onChange} columns={["Item", "Qty Available", "Adequate", "Remarks"]} />;
  }
  if (code === "TECH-19") {
    return <ChecklistTableRenderer formData={formData} onChange={onChange} columns={["Item", "Qty", "Adequate", "Replenishment Needed"]} />;
  }

  // Maintenance forms with checklist
  const maintenanceCodes = ["TECH-23", "TECH-24", "TECH-25", "TECH-26", "TECH-27", "TECH-42", "TECH-43", "TECH-44", "TECH-45", "TECH-46", "TECH-47", "TECH-48", "TECH-49", "TECH-50"];
  if (maintenanceCodes.includes(code)) {
    return <MaintenanceChecklistRenderer formData={formData} onChange={onChange} />;
  }

  // Management forms with repeatable rows
  if (code === "MGT-01") {
    return (
      <div className="space-y-6">
        <GenericFieldRenderer formData={formData} onChange={onChange} schema={KNOWN_SCHEMAS["MGT-01"]} />
        <div>
          <h3 className="text-sm font-medium text-slate-700 mb-2">Audit Schedule — Departments</h3>
          <RepeatableRowsRenderer
            fields={[
              { name: "department", type: "text" },
              { name: "auditor", type: "text" },
              { name: "plannedDate", type: "date" },
              { name: "status", enumValues: ["Planned", "In Progress", "Completed", "Postponed"] },
            ]}
            formData={formData}
            dataKey="departments"
            onChange={onChange}
          />
        </div>
      </div>
    );
  }

  // Use known schema if available, else use fields from API, else free text
  const schema = KNOWN_SCHEMAS[code] ?? (template.fields as FormSchema | null);
  return <GenericFieldRenderer formData={formData} onChange={onChange} schema={schema} />;
}
