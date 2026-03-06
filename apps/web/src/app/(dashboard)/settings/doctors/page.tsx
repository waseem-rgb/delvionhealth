"use client";

import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Search, Loader2, X, MoreVertical, Eye, EyeOff, Upload, Download,
  User, Settings as SettingsIcon, FileSignature, KeyRound, Trash2, Edit2,
  Shield, Clock, Check,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

interface Doctor {
  id: string;
  name: string;
  salutation: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  specialty: string | null;
  phone: string | null;
  email: string | null;
  alternateEmail: string | null;
  dob: string | null;
  registrationNumber: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  departments: string[];
  passkey: string | null;
  isDefault: boolean;
  showOnAppointment: boolean;
  showOnlyAssigned: boolean;
  notifySMS: boolean;
  notifyEmail: boolean;
  signatureImageUrl: string | null;
  signatureHtml: string | null;
  loginUsername: string | null;
  loginEnabled: boolean;
  language: string;
  availability: AvailabilitySlot[] | null;
  isActive: boolean;
  createdAt: string;
}

interface AvailabilitySlot {
  day: string;
  startTime: string;
  endTime: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const SPECIALTIES = [
  "Pathologist", "Radiologist", "Biochemist", "Microbiologist",
  "Haematologist", "Cytologist", "Histopathologist", "Physician", "Other",
];

const DEPARTMENTS = [
  "Biochemistry", "Haematology", "Microbiology", "Serology", "Hormones",
  "Immunology", "Urinalysis", "Molecular", "Histopathology", "Cytology",
  "Radiology", "General",
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type ModalTab = 1 | 2 | 3 | 4;

const TAB_LABELS: { tab: ModalTab; label: string; icon: React.ElementType }[] = [
  { tab: 1, label: "Doctor Info", icon: User },
  { tab: 2, label: "Configuration", icon: SettingsIcon },
  { tab: 3, label: "Signature", icon: FileSignature },
  { tab: 4, label: "Login and Access", icon: KeyRound },
];

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]/20 focus:border-[#0D7E8A] bg-white transition";
const labelCls = "block text-xs font-semibold text-slate-600 mb-1.5";

const INITIAL_FORM = {
  salutation: "Dr.",
  firstName: "",
  lastName: "",
  displayName: "",
  phone: "",
  email: "",
  alternateEmail: "",
  dob: "",
  registrationNumber: "",
  specialty: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  departments: [] as string[],
  isDefault: false,
  showOnAppointment: true,
  showOnlyAssigned: false,
  notifySMS: false,
  notifyEmail: false,
  passkey: "",
  signatureHtml: "",
  loginUsername: "",
  loginPassword: "",
  language: "en",
  availability: [] as AvailabilitySlot[],
};

// ── Toggle Component ──────────────────────────────────────────────────────

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center justify-between py-2 cursor-pointer">
      <span className="text-sm text-slate-700">{label}</span>
      <button type="button" onClick={() => onChange(!checked)} className={cn(
        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
        checked ? "bg-[#0D7E8A]" : "bg-slate-300",
      )}>
        <span className={cn("inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform", checked ? "translate-x-[18px]" : "translate-x-[3px]")} />
      </button>
    </label>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════════════════════

export default function DoctorsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);

  // ── Fetch doctors ────────────────────────────────────────────────────

  const { data: doctors = [], isLoading } = useQuery<Doctor[]>({
    queryKey: ["doctors"],
    queryFn: async () => {
      const res = await api.get("/doctors");
      return res.data.data ?? res.data;
    },
  });

  // ── Create/Update mutations ──────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await api.post("/doctors", data);
      return res.data.data ?? res.data;
    },
    onSuccess: () => {
      toast.success("Doctor created");
      queryClient.invalidateQueries({ queryKey: ["doctors"] });
      setModalOpen(false);
    },
    onError: () => toast.error("Failed to create doctor"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await api.put(`/doctors/${id}`, data);
      return res.data.data ?? res.data;
    },
    onSuccess: () => {
      toast.success("Doctor updated");
      queryClient.invalidateQueries({ queryKey: ["doctors"] });
      setModalOpen(false);
      setEditingDoctor(null);
    },
    onError: () => toast.error("Failed to update doctor"),
  });

  const disableMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/doctors/${id}`);
    },
    onSuccess: () => {
      toast.success("Doctor disabled");
      queryClient.invalidateQueries({ queryKey: ["doctors"] });
    },
    onError: () => toast.error("Failed to disable doctor"),
  });

  // ── Filter ────────────────────────────────────────────────────────────

  const filtered = doctors.filter((d) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      d.name.toLowerCase().includes(q) ||
      d.phone?.toLowerCase().includes(q) ||
      d.email?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Doctors & Signing Authorities</h1>
          <p className="text-sm text-slate-500 mt-1">Manage pathologists, radiologists and other signing doctors</p>
        </div>
        <button
          onClick={() => { setEditingDoctor(null); setModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#0D7E8A] text-white text-sm font-medium rounded-lg hover:bg-[#0B6B75]"
        >
          <Plus className="w-4 h-4" />
          Add Doctor
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or phone..."
          className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]/20 focus:border-[#0D7E8A]"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 animate-spin text-[#0D7E8A]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm">No doctors found</div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Speciality</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Phone</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Departments</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Passkey</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Login</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-slate-900">{d.displayName || d.name}</p>
                      {d.email && <p className="text-xs text-slate-400">{d.email}</p>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{d.specialty || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{d.phone || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {d.departments.length > 0 ? d.departments.slice(0, 3).map((dept) => (
                        <span key={dept} className="px-1.5 py-0.5 bg-sky-50 text-sky-700 text-[10px] rounded font-medium">{dept}</span>
                      )) : <span className="text-slate-400 text-xs">—</span>}
                      {d.departments.length > 3 && <span className="text-[10px] text-slate-400">+{d.departments.length - 3}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {d.passkey ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded">
                        <Shield className="w-3 h-3" /> Set
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Not set</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {d.loginEnabled ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded">
                        <Check className="w-3 h-3" /> Enabled
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Disabled</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-xs font-medium",
                      d.isActive ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
                    )}>
                      {d.isActive ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right relative">
                    <button
                      onClick={() => setActionMenuId(actionMenuId === d.id ? null : d.id)}
                      className="p-1 rounded hover:bg-slate-100"
                    >
                      <MoreVertical className="w-4 h-4 text-slate-500" />
                    </button>
                    {actionMenuId === d.id && (
                      <>
                        <div className="fixed inset-0 z-30" onClick={() => setActionMenuId(null)} />
                        <div className="absolute right-4 top-10 z-40 bg-white border border-slate-200 rounded-lg shadow-lg py-1 w-32">
                          <button
                            className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                            onClick={() => { setEditingDoctor(d); setModalOpen(true); setActionMenuId(null); }}
                          >
                            <Edit2 className="w-3.5 h-3.5" /> Edit
                          </button>
                          {d.isActive && (
                            <button
                              className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                              onClick={() => { disableMutation.mutate(d.id); setActionMenuId(null); }}
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Disable
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <DoctorModal
          editingDoctor={editingDoctor}
          onClose={() => { setModalOpen(false); setEditingDoctor(null); }}
          onCreate={(data) => createMutation.mutate(data)}
          onUpdate={(id, data) => updateMutation.mutate({ id, data })}
          isPending={createMutation.isPending || updateMutation.isPending}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Doctor Modal
// ═══════════════════════════════════════════════════════════════════════════

function DoctorModal({
  editingDoctor,
  onClose,
  onCreate,
  onUpdate,
  isPending,
}: {
  editingDoctor: Doctor | null;
  onClose: () => void;
  onCreate: (data: Record<string, unknown>) => void;
  onUpdate: (id: string, data: Record<string, unknown>) => void;
  isPending: boolean;
}) {
  const [tab, setTab] = useState<ModalTab>(1);
  const [showPasskey, setShowPasskey] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const sigInputRef = useRef<HTMLInputElement>(null);
  const [signaturePreview, setSignaturePreview] = useState<string>(editingDoctor?.signatureImageUrl || "");

  const [form, setForm] = useState(() => {
    if (editingDoctor) {
      return {
        salutation: editingDoctor.salutation || "Dr.",
        firstName: editingDoctor.firstName || "",
        lastName: editingDoctor.lastName || "",
        displayName: editingDoctor.displayName || "",
        phone: editingDoctor.phone || "",
        email: editingDoctor.email || "",
        alternateEmail: editingDoctor.alternateEmail || "",
        dob: editingDoctor.dob ? editingDoctor.dob.split("T")[0] : "",
        registrationNumber: editingDoctor.registrationNumber || "",
        specialty: editingDoctor.specialty || "",
        address: editingDoctor.address || "",
        city: editingDoctor.city || "",
        state: editingDoctor.state || "",
        pincode: editingDoctor.pincode || "",
        departments: editingDoctor.departments || [],
        isDefault: editingDoctor.isDefault,
        showOnAppointment: editingDoctor.showOnAppointment,
        showOnlyAssigned: editingDoctor.showOnlyAssigned,
        notifySMS: editingDoctor.notifySMS,
        notifyEmail: editingDoctor.notifyEmail,
        passkey: "",
        signatureHtml: editingDoctor.signatureHtml || "",
        loginUsername: editingDoctor.loginUsername || "",
        loginPassword: "",
        language: editingDoctor.language || "en",
        availability: (editingDoctor.availability || []) as AvailabilitySlot[],
      };
    }
    return { ...INITIAL_FORM };
  });

  const updateField = useCallback(<K extends keyof typeof form>(key: K, val: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  }, []);

  // ── New availability slot ─────────────────────────────────────────────

  const [newSlot, setNewSlot] = useState<AvailabilitySlot>({ day: "Monday", startTime: "09:00", endTime: "17:00" });

  const addSlot = () => {
    updateField("availability", [...form.availability, { ...newSlot }]);
  };

  const removeSlot = (idx: number) => {
    updateField("availability", form.availability.filter((_, i) => i !== idx));
  };

  const addAllDays = () => {
    const existing = new Set(form.availability.map((s) => s.day));
    const toAdd = DAYS.filter((d) => !existing.has(d)).map((d) => ({ day: d, startTime: "09:00", endTime: "17:00" }));
    updateField("availability", [...form.availability, ...toAdd]);
  };

  // ── Passkey generation ────────────────────────────────────────────────

  const generatePasskey = useCallback(async () => {
    if (!editingDoctor) {
      const pk = Math.floor(100000 + Math.random() * 900000).toString();
      updateField("passkey", pk);
      return;
    }
    try {
      const res = await api.post(`/doctors/${editingDoctor.id}/generate-passkey`);
      const data = res.data.data ?? res.data;
      updateField("passkey", data.passkey);
      toast.success("Passkey generated");
    } catch {
      toast.error("Failed to generate passkey");
    }
  }, [editingDoctor, updateField]);

  // ── Signature upload ──────────────────────────────────────────────────

  const handleSignatureUpload = useCallback(async (file: File) => {
    if (!editingDoctor) {
      const reader = new FileReader();
      reader.onload = () => setSignaturePreview(reader.result as string);
      reader.readAsDataURL(file);
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await api.post(`/doctors/${editingDoctor.id}/upload-signature`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const data = res.data.data ?? res.data;
      setSignaturePreview(data.signatureImageUrl);
      toast.success("Signature uploaded");
    } catch {
      toast.error("Upload failed");
    }
  }, [editingDoctor]);

  // ── Password generation ───────────────────────────────────────────────

  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
    let pwd = "";
    for (let i = 0; i < 12; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    updateField("loginPassword", pwd);
  };

  // ── Save ──────────────────────────────────────────────────────────────

  const handleSave = () => {
    if (!form.firstName.trim()) { toast.error("First name is required"); return; }
    const payload: Record<string, unknown> = {
      salutation: form.salutation,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim() || undefined,
      displayName: form.displayName.trim() || undefined,
      phone: form.phone || undefined,
      email: form.email || undefined,
      alternateEmail: form.alternateEmail || undefined,
      dob: form.dob || undefined,
      registrationNumber: form.registrationNumber || undefined,
      specialty: form.specialty || undefined,
      address: form.address || undefined,
      city: form.city || undefined,
      state: form.state || undefined,
      pincode: form.pincode || undefined,
      departments: form.departments,
      isDefault: form.isDefault,
      showOnAppointment: form.showOnAppointment,
      showOnlyAssigned: form.showOnlyAssigned,
      notifySMS: form.notifySMS,
      notifyEmail: form.notifyEmail,
      signatureHtml: form.signatureHtml || undefined,
      language: form.language,
      availability: form.availability.length > 0 ? form.availability : undefined,
    };
    if (form.passkey) payload.passkey = form.passkey;
    if (form.loginUsername) payload.loginUsername = form.loginUsername;
    if (form.loginPassword) payload.loginPassword = form.loginPassword;
    if (form.loginUsername && form.loginPassword) payload.loginEnabled = true;

    if (editingDoctor) {
      onUpdate(editingDoctor.id, payload);
    } else {
      onCreate(payload);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-[780px] max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold text-slate-900">
            {editingDoctor ? "Edit Doctor" : "Add Doctor"}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar tabs */}
          <div className="w-48 bg-slate-50 border-r border-slate-200 py-3 shrink-0">
            {TAB_LABELS.map((t) => (
              <button
                key={t.tab}
                onClick={() => setTab(t.tab)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition",
                  tab === t.tab
                    ? "bg-[#0D7E8A]/10 text-[#0D7E8A] font-semibold border-l-[3px] border-[#0D7E8A] pl-[13px]"
                    : "text-slate-600 hover:bg-slate-100"
                )}
              >
                <t.icon className="w-4 h-4" />
                {t.label}
              </button>
            ))}
          </div>

          {/* Right content */}
          <div className="flex-1 overflow-y-auto p-6">

            {/* ─── TAB 1: Doctor Info ──────────────────────────────────────── */}
            {tab === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls}>Salutation</label>
                    <select value={form.salutation} onChange={(e) => updateField("salutation", e.target.value)} className={inputCls}>
                      <option>Dr.</option>
                      <option>Mr.</option>
                      <option>Mrs.</option>
                      <option>Ms.</option>
                      <option>Prof.</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>First Name *</label>
                    <input value={form.firstName} onChange={(e) => updateField("firstName", e.target.value)} className={inputCls} placeholder="First name" />
                  </div>
                  <div>
                    <label className={labelCls}>Last Name</label>
                    <input value={form.lastName} onChange={(e) => updateField("lastName", e.target.value)} className={inputCls} placeholder="Last name" />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Display Name</label>
                  <input value={form.displayName} onChange={(e) => updateField("displayName", e.target.value)} className={inputCls} placeholder="e.g. Dr. Smith (optional)" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Contact Number</label>
                    <input value={form.phone} onChange={(e) => updateField("phone", e.target.value)} className={inputCls} placeholder="+91..." />
                  </div>
                  <div>
                    <label className={labelCls}>Date of Birth</label>
                    <input type="date" value={form.dob} onChange={(e) => updateField("dob", e.target.value)} className={inputCls} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Email</label>
                    <input type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Alternate Emails</label>
                    <input value={form.alternateEmail} onChange={(e) => updateField("alternateEmail", e.target.value)} className={inputCls} placeholder="comma separated" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Registration Number</label>
                    <input value={form.registrationNumber} onChange={(e) => updateField("registrationNumber", e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Speciality</label>
                    <select value={form.specialty} onChange={(e) => updateField("specialty", e.target.value)} className={inputCls}>
                      <option value="">Select...</option>
                      {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Address</label>
                  <input value={form.address} onChange={(e) => updateField("address", e.target.value)} className={inputCls} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls}>City</label>
                    <input value={form.city} onChange={(e) => updateField("city", e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>State</label>
                    <input value={form.state} onChange={(e) => updateField("state", e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Pincode</label>
                    <input value={form.pincode} onChange={(e) => updateField("pincode", e.target.value)} className={inputCls} />
                  </div>
                </div>
              </div>
            )}

            {/* ─── TAB 2: Configuration ────────────────────────────────────── */}
            {tab === 2 && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Departments this doctor signs for</h3>
                  <div className="space-y-1 mb-3">
                    {form.departments.map((dept) => (
                      <div key={dept} className="flex items-center justify-between py-1.5 px-3 bg-slate-50 rounded-lg">
                        <span className="text-sm text-slate-700">{dept}</span>
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                            <input type="checkbox" checked={form.isDefault} onChange={(e) => updateField("isDefault", e.target.checked)} className="accent-[#0D7E8A]" />
                            Default
                          </label>
                          <button onClick={() => updateField("departments", form.departments.filter((d) => d !== dept))} className="text-red-400 hover:text-red-600">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {form.departments.length === 0 && <p className="text-xs text-slate-400 italic">No departments assigned</p>}
                  </div>
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value && !form.departments.includes(e.target.value)) {
                        updateField("departments", [...form.departments, e.target.value]);
                      }
                    }}
                    className={cn(inputCls, "max-w-xs")}
                  >
                    <option value="">+ Add Department</option>
                    {DEPARTMENTS.filter((d) => !form.departments.includes(d)).map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">Doctor Passkey</h3>
                  <div className="flex items-center gap-2 max-w-xs">
                    <div className="relative flex-1">
                      <input
                        type={showPasskey ? "text" : "password"}
                        value={form.passkey}
                        onChange={(e) => updateField("passkey", e.target.value)}
                        placeholder="4-6 digits"
                        maxLength={6}
                        className={inputCls}
                      />
                      <button onClick={() => setShowPasskey(!showPasskey)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
                        {showPasskey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <button onClick={generatePasskey} className="text-xs text-[#0D7E8A] font-medium hover:underline whitespace-nowrap">
                      Generate
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Used to digitally sign/approve reports</p>
                </div>

                <div className="border-t border-slate-200 pt-4 space-y-0">
                  <Toggle checked={form.showOnAppointment} onChange={(v) => updateField("showOnAppointment", v)} label="Show Doctor on Appointment View" />
                  <Toggle checked={form.showOnlyAssigned} onChange={(v) => updateField("showOnlyAssigned", v)} label="Show Only Assigned Reports" />
                  <Toggle checked={form.isDefault} onChange={(v) => updateField("isDefault", v)} label="Make this Doctor Default" />
                </div>

                <div className="border-t border-slate-200 pt-4">
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">Communication</h3>
                  <p className="text-xs text-slate-500 mb-2">Notify signing doctor when reports are ready</p>
                  <Toggle checked={form.notifySMS} onChange={(v) => updateField("notifySMS", v)} label="Send SMS" />
                  <Toggle checked={form.notifyEmail} onChange={(v) => updateField("notifyEmail", v)} label="Send Email" />
                </div>
              </div>
            )}

            {/* ─── TAB 3: Signature ────────────────────────────────────────── */}
            {tab === 3 && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Signature Image</h3>
                  {signaturePreview ? (
                    <div className="space-y-3">
                      <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 text-center">
                        <img src={signaturePreview} alt="Signature" className="h-16 mx-auto object-contain" />
                        <p className="text-sm font-semibold text-slate-800 mt-2">{form.salutation} {form.firstName} {form.lastName}</p>
                        <p className="text-xs text-slate-500">{form.specialty || "Speciality"}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => sigInputRef.current?.click()}
                          className="px-3 py-2 text-sm text-[#0D7E8A] border border-[#0D7E8A] rounded-lg hover:bg-[#0D7E8A]/10"
                        >
                          Upload New Image
                        </button>
                        <button
                          onClick={() => setSignaturePreview("")}
                          className="px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-[#0D7E8A] hover:bg-[#0D7E8A]/5 transition">
                      <Upload className="w-6 h-6 text-slate-400 mb-2" />
                      <span className="text-sm text-slate-500">Upload signature image</span>
                      <span className="text-[10px] text-slate-400 mt-1">PNG, JPEG, JPG supported</span>
                      <input
                        ref={sigInputRef}
                        type="file"
                        accept=".png,.jpg,.jpeg"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleSignatureUpload(f);
                        }}
                      />
                    </label>
                  )}
                  <input
                    ref={sigInputRef}
                    type="file"
                    accept=".png,.jpg,.jpeg"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleSignatureUpload(f);
                    }}
                  />
                  <p className="text-[10px] text-slate-400 mt-2">* This will allow the doctor to sign documents, e.g. signing the reports</p>
                </div>

                <div className="border-t border-slate-200 pt-4">
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">Signature HTML (optional fallback)</h3>
                  <textarea
                    value={form.signatureHtml}
                    onChange={(e) => updateField("signatureHtml", e.target.value)}
                    placeholder={`<div style="text-align:center"><p>${form.salutation} ${form.firstName} ${form.lastName}</p><p>${form.specialty || "Designation"}</p></div>`}
                    rows={4}
                    className="w-full text-xs font-mono border border-slate-200 rounded-lg p-3 resize-none focus:ring-1 focus:ring-[#0D7E8A] focus:border-[#0D7E8A] outline-none"
                  />
                </div>
              </div>
            )}

            {/* ─── TAB 4: Login and Access ─────────────────────────────────── */}
            {tab === 4 && (
              <div className="space-y-5">
                <div>
                  <label className={labelCls}>Username</label>
                  <input value={form.loginUsername} onChange={(e) => updateField("loginUsername", e.target.value)} className={inputCls} placeholder="Username" />
                </div>

                <div>
                  <label className={labelCls}>Password</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={form.loginPassword}
                        onChange={(e) => updateField("loginPassword", e.target.value)}
                        className={inputCls}
                        placeholder="••••••••"
                      />
                      <button onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <button onClick={generatePassword} className="px-3 py-2 text-xs font-medium text-[#0D7E8A] border border-[#0D7E8A] rounded-lg hover:bg-[#0D7E8A]/10 whitespace-nowrap">
                      Generate
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Min 8 chars with uppercase, lowercase, digit, and special character</p>
                </div>

                <div>
                  <label className={labelCls}>Default Language</label>
                  <select value={form.language} onChange={(e) => updateField("language", e.target.value)} className={cn(inputCls, "max-w-xs")}>
                    <option value="en">English</option>
                    <option value="hi">Hindi</option>
                    <option value="kn">Kannada</option>
                    <option value="ta">Tamil</option>
                    <option value="te">Telugu</option>
                  </select>
                </div>

                <div className="border-t border-slate-200 pt-4">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Visit Timing</h3>
                  <div className="flex items-end gap-2 mb-3">
                    <div>
                      <label className={labelCls}>Day</label>
                      <select value={newSlot.day} onChange={(e) => setNewSlot({ ...newSlot, day: e.target.value })} className={cn(inputCls, "w-36")}>
                        {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Start</label>
                      <input type="time" value={newSlot.startTime} onChange={(e) => setNewSlot({ ...newSlot, startTime: e.target.value })} className={cn(inputCls, "w-28")} />
                    </div>
                    <div>
                      <label className={labelCls}>End</label>
                      <input type="time" value={newSlot.endTime} onChange={(e) => setNewSlot({ ...newSlot, endTime: e.target.value })} className={cn(inputCls, "w-28")} />
                    </div>
                    <button onClick={addSlot} className="px-3 py-2 bg-[#0D7E8A] text-white text-xs font-medium rounded-lg hover:bg-[#0B6B75]">Add</button>
                    <button onClick={addAllDays} className="px-3 py-2 text-xs font-medium text-[#0D7E8A] border border-[#0D7E8A] rounded-lg hover:bg-[#0D7E8A]/10">Add All</button>
                    {form.availability.length > 0 && (
                      <button onClick={() => updateField("availability", [])} className="px-3 py-2 text-xs font-medium text-red-500 border border-red-200 rounded-lg hover:bg-red-50">Remove All</button>
                    )}
                  </div>
                  {form.availability.length > 0 && (
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead><tr className="bg-slate-50"><th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Day</th><th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Start</th><th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">End</th><th className="w-8" /></tr></thead>
                        <tbody>
                          {form.availability.map((s, i) => (
                            <tr key={i} className="border-t border-slate-100">
                              <td className="px-3 py-1.5 text-slate-700">{s.day}</td>
                              <td className="px-3 py-1.5 text-slate-600">{s.startTime}</td>
                              <td className="px-3 py-1.5 text-slate-600">{s.endTime}</td>
                              <td className="px-1"><button onClick={() => removeSlot(i)} className="text-red-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
              Close
            </button>
            {editingDoctor && editingDoctor.isActive && (
              <button className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
                Disable
              </button>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="px-6 py-2.5 bg-[#0D7E8A] text-white text-sm font-medium rounded-lg hover:bg-[#0B6B75] disabled:opacity-50 flex items-center gap-2"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {editingDoctor ? "Update" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
