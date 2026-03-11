"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import {
  Plus, Pencil, Trash2, Users, Clock, RefreshCw,
  Building2, Tag, ChevronDown, ChevronUp, UserPlus, CheckCircle2, XCircle,
} from "lucide-react";

interface DepartmentStaff {
  id: string;
  staffName: string;
  role: string;
  isAvailable: boolean;
  availableFrom?: string;
  availableTo?: string;
  avgPatientMins: number;
}

interface Department {
  id: string;
  code: string;
  name: string;
  shortCode: string;
  roomNumbers: string[];
  avgDurationMinutes: number;
  isActive: boolean;
  currentTokenCount: number;
  staff: DepartmentStaff[];
}

const CLASSIFY_TYPES = ["PATHOLOGY", "ULTRASOUND", "XRAY", "ECG", "MRI", "CT_SCAN", "ECHO", "PFT", "DEXA", "AUDIOMETRY", "OPHTHALMOLOGY"];

export default function DepartmentsPage() {
  const qc = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showStaffForm, setShowStaffForm] = useState<string | null>(null);
  const [editDept, setEditDept] = useState<Department | null>(null);
  const [classifyResult, setClassifyResult] = useState<Record<string, number> | null>(null);

  const [form, setForm] = useState({ code: "", name: "", shortCode: "", roomNumbers: "", avgDurationMinutes: 15 });
  const [staffForm, setStaffForm] = useState({ staffName: "", role: "TECHNICIAN", availableFrom: "", availableTo: "", avgPatientMins: 10 });

  const { data: departments = [], isLoading } = useQuery<Department[]>({
    queryKey: ["departments"],
    queryFn: async () => {
      const res = await api.get("/front-desk/departments");
      return res.data?.data ?? res.data ?? [];
    },
  });

  const createMut = useMutation({
    mutationFn: (data: typeof form) => api.post("/front-desk/departments", {
      ...data,
      roomNumbers: data.roomNumbers ? data.roomNumbers.split(",").map((s) => s.trim()).filter(Boolean) : [],
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["departments"] }); resetForm(); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<typeof form> }) => api.patch(`/front-desk/departments/${id}`, {
      ...data,
      roomNumbers: typeof data.roomNumbers === "string" ? (data.roomNumbers as string).split(",").map((s) => s.trim()).filter(Boolean) : data.roomNumbers,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["departments"] }); resetForm(); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/front-desk/departments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["departments"] }),
  });

  const addStaffMut = useMutation({
    mutationFn: ({ deptId, data }: { deptId: string; data: typeof staffForm }) =>
      api.post(`/front-desk/departments/${deptId}/staff`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["departments"] }); setShowStaffForm(null); setStaffForm({ staffName: "", role: "TECHNICIAN", availableFrom: "", availableTo: "", avgPatientMins: 10 }); },
  });

  const toggleStaffMut = useMutation({
    mutationFn: ({ staffId, isAvailable }: { staffId: string; isAvailable: boolean }) =>
      api.patch(`/front-desk/departments/staff/${staffId}`, { isAvailable }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["departments"] }),
  });

  const removeStaffMut = useMutation({
    mutationFn: (staffId: string) => api.delete(`/front-desk/departments/staff/${staffId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["departments"] }),
  });

  const classifyMut = useMutation({
    mutationFn: () => api.post("/test-catalog/classify-investigation-types"),
    onSuccess: (res) => setClassifyResult(res.data?.data?.summary ?? res.data?.summary ?? {}),
  });

  function resetForm() {
    setForm({ code: "", name: "", shortCode: "", roomNumbers: "", avgDurationMinutes: 15 });
    setEditDept(null);
    setShowForm(false);
  }

  function startEdit(dept: Department) {
    setEditDept(dept);
    setForm({ code: dept.code, name: dept.name, shortCode: dept.shortCode, roomNumbers: dept.roomNumbers.join(", "), avgDurationMinutes: dept.avgDurationMinutes });
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editDept) {
      updateMut.mutate({ id: editDept.id, data: form });
    } else {
      createMut.mutate(form);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Departments</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage imaging & investigation departments, staff, and queue settings</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => classifyMut.mutate()}
            disabled={classifyMut.isPending}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-sm text-slate-600 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${classifyMut.isPending ? "animate-spin" : ""}`} />
            Auto-Classify Tests
          </button>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Department
          </button>
        </div>
      </div>

      {classifyResult && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">
          <strong>Classification complete!</strong> {" "}
          {Object.entries(classifyResult).map(([k, v]) => `${k}: ${v}`).join(", ")}
          <button onClick={() => setClassifyResult(null)} className="ml-3 text-emerald-400/60 hover:text-emerald-300">✕</button>
        </div>
      )}

      {showForm && (
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">{editDept ? "Edit Department" : "New Department"}</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Department Code *</label>
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 text-sm focus:outline-none focus:border-teal-500" placeholder="e.g. USG" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 text-sm focus:outline-none focus:border-teal-500" placeholder="e.g. Ultrasound" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Token Prefix (Short Code) *</label>
              <input value={form.shortCode} onChange={(e) => setForm({ ...form, shortCode: e.target.value })} required
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 text-sm focus:outline-none focus:border-teal-500" placeholder="e.g. U" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Avg Duration (min)</label>
              <input type="number" value={form.avgDurationMinutes} onChange={(e) => setForm({ ...form, avgDurationMinutes: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 text-sm focus:outline-none focus:border-teal-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-500 mb-1">Room Numbers (comma separated)</label>
              <input value={form.roomNumbers} onChange={(e) => setForm({ ...form, roomNumbers: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 text-sm focus:outline-none focus:border-teal-500" placeholder="e.g. Room 1, Room 2" />
            </div>
            <div className="col-span-2 flex justify-end gap-2">
              <button type="button" onClick={resetForm} className="px-4 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-500 border border-slate-200 text-sm">Cancel</button>
              <button type="submit" disabled={createMut.isPending || updateMut.isPending}
                className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium">
                {editDept ? "Save Changes" : "Create"}
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-20 text-slate-400">Loading departments...</div>
      ) : departments.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No departments configured yet.</p>
          <p className="text-sm mt-1">Add departments like Ultrasound, X-Ray, ECG for investigation token management.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {departments.map((dept) => (
            <div key={dept.id} className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center">
                    <span className="text-teal-600 font-bold text-sm">{dept.shortCode}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{dept.name}</span>
                      <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{dept.code}</span>
                      {!dept.isActive && <span className="text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded">Inactive</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{dept.avgDurationMinutes}min avg</span>
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{dept.staff.length} staff</span>
                      {dept.roomNumbers.length > 0 && (
                        <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{dept.roomNumbers.join(", ")}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => startEdit(dept)} className="p-2 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-slate-700 transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => { if (confirm("Delete department?")) deleteMut.mutate(dept.id); }}
                    className="p-2 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => setExpandedId(expandedId === dept.id ? null : dept.id)}
                    className="p-2 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-slate-700 transition-colors">
                    {expandedId === dept.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {expandedId === dept.id && (
                <div className="border-t border-slate-100 px-5 py-4 space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Staff</span>
                    <button onClick={() => setShowStaffForm(showStaffForm === dept.id ? null : dept.id)}
                      className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-500">
                      <UserPlus className="w-3.5 h-3.5" /> Add Staff
                    </button>
                  </div>

                  {showStaffForm === dept.id && (
                    <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <input value={staffForm.staffName} onChange={(e) => setStaffForm({ ...staffForm, staffName: e.target.value })}
                          placeholder="Staff Name" className="px-2 py-1.5 rounded bg-white border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-teal-500" />
                        <select value={staffForm.role} onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}
                          className="px-2 py-1.5 rounded bg-white border border-slate-300 text-slate-900 text-xs focus:outline-none">
                          <option value="TECHNICIAN">Technician</option>
                          <option value="DOCTOR">Doctor</option>
                          <option value="RADIOLOGIST">Radiologist</option>
                        </select>
                        <input value={staffForm.availableFrom} onChange={(e) => setStaffForm({ ...staffForm, availableFrom: e.target.value })}
                          placeholder="Available From (e.g. 09:00)" className="px-2 py-1.5 rounded bg-white border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-teal-500" />
                        <input value={staffForm.availableTo} onChange={(e) => setStaffForm({ ...staffForm, availableTo: e.target.value })}
                          placeholder="Available To (e.g. 17:00)" className="px-2 py-1.5 rounded bg-white border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-teal-500" />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setShowStaffForm(null)} className="text-xs text-slate-500 hover:text-slate-900 px-2 py-1 rounded">Cancel</button>
                        <button onClick={() => addStaffMut.mutate({ deptId: dept.id, data: staffForm })} disabled={!staffForm.staffName || addStaffMut.isPending}
                          className="text-xs bg-teal-600 hover:bg-teal-500 text-white px-3 py-1 rounded">Add</button>
                      </div>
                    </div>
                  )}

                  {dept.staff.length === 0 ? (
                    <p className="text-xs text-slate-400 py-2">No staff added yet</p>
                  ) : (
                    <div className="space-y-2">
                      {dept.staff.map((s) => (
                        <div key={s.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50 border border-slate-100">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${s.isAvailable ? "bg-emerald-400" : "bg-red-400"}`} />
                            <div>
                              <span className="text-sm text-slate-900">{s.staffName}</span>
                              <span className="text-xs text-slate-400 ml-2">{s.role}</span>
                              {s.availableFrom && <span className="text-xs text-slate-400 ml-2">{s.availableFrom}–{s.availableTo}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => toggleStaffMut.mutate({ staffId: s.id, isAvailable: !s.isAvailable })}
                              className={`text-xs px-2 py-0.5 rounded border ${s.isAvailable ? "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10" : "border-red-500/30 text-red-400 hover:bg-red-500/10"}`}>
                              {s.isAvailable ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={() => { if (confirm("Remove staff?")) removeStaffMut.mutate(s.id); }}
                              className="text-slate-400 hover:text-red-400 p-1 rounded transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
        <p className="text-sm font-semibold text-blue-700 mb-1">Investigation Type Classification</p>
        <p className="text-xs text-blue-600 mb-3">
          Click <strong>Auto-Classify Tests</strong> to scan your test catalog and mark tests like X-Ray, Ultrasound, ECG as non-pathology.
          These tests will get department-specific tokens at registration instead of lab tokens.
        </p>
        <div className="flex flex-wrap gap-2">
          {CLASSIFY_TYPES.map((t) => (
            <span key={t} className="text-xs bg-blue-50 border border-blue-200 text-blue-600 px-2 py-0.5 rounded">{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
