"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  UserPlus,
  Search,
  Phone,
  MessageCircle,
  Mail,
  MapPin,
  Calendar,
  X,
  AlertTriangle,
  ChevronRight,
  Plus,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import api from "@/lib/api";

interface Doctor {
  id: string;
  name: string;
  specialization: string | null;
  qualification: string | null;
  clinicName: string | null;
  clinicAddress: string | null;
  area: string | null;
  city: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  tier: string;
  totalReferrals: number;
  totalRevenue: number;
  lastReferralDate: string | null;
  lastContactDate: string | null;
  nextFollowUpDate: string | null;
  notes: string | null;
  isActive: boolean;
  contacts?: DoctorContact[];
}

interface DoctorContact {
  id: string;
  type: string;
  notes: string | null;
  outcome: string | null;
  nextActionDate: string | null;
  nextAction: string | null;
  contactedAt: string;
}

interface DoctorStats {
  total: number;
  vip: number;
  active: number;
  inactive: number;
  newThisMonth: number;
  topDoctors: Array<{ id: string; name: string; totalReferrals: number; totalRevenue: number; tier: string }>;
}

const TIERS: Record<string, string> = {
  VIP: "bg-amber-100 text-amber-700 border-amber-300",
  ACTIVE: "bg-green-100 text-green-700 border-green-300",
  NEW: "bg-blue-100 text-blue-700 border-blue-300",
  INACTIVE: "bg-slate-100 text-slate-500 border-slate-300",
};

const SPECIALIZATIONS = [
  "General Physician", "Cardiologist", "Diabetologist", "Gynaecologist",
  "Paediatrician", "Orthopaedic", "Dermatologist", "ENT", "Urologist",
  "Neurologist", "Oncologist", "Pulmonologist", "Gastroenterologist", "Other",
];

const CONTACT_TYPES = [
  { value: "VISIT", label: "Visit", color: "bg-blue-500" },
  { value: "CALL", label: "Call", color: "bg-green-500" },
  { value: "WHATSAPP", label: "WhatsApp", color: "bg-emerald-500" },
  { value: "EMAIL", label: "Email", color: "bg-purple-500" },
  { value: "GIFT", label: "Gift", color: "bg-amber-500" },
];

const OUTCOMES = ["POSITIVE", "NEUTRAL", "NOT_AVAILABLE", "PROMISED_REFERRAL"];

export default function ReferringDoctorsPage() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState({ search: "", specialization: "", area: "", tier: "", page: 1 });
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [showContactForm, setShowContactForm] = useState(false);

  const [addForm, setAddForm] = useState({
    name: "", specialization: "", qualification: "", clinicName: "", clinicAddress: "",
    area: "", city: "", phone: "", whatsapp: "", email: "", notes: "", nextFollowUpDate: "",
  });

  const [contactForm, setContactForm] = useState({
    type: "VISIT", notes: "", outcome: "", nextActionDate: "", nextAction: "",
  });

  const { data: stats } = useQuery<DoctorStats>({
    queryKey: ["marketing", "doctors", "stats"],
    queryFn: async () => {
      const res = await api.get("/marketing/doctors/stats");
      return res.data?.data ?? res.data;
    },
  });

  const { data: dueFollowUp = [] } = useQuery<Doctor[]>({
    queryKey: ["marketing", "doctors", "due-followup"],
    queryFn: async () => {
      const res = await api.get("/marketing/doctors/due-followup");
      return res.data?.data ?? res.data ?? [];
    },
  });

  const { data: doctorsRes, isLoading } = useQuery<{ data: Doctor[]; meta: { total: number; page: number; totalPages: number } }>({
    queryKey: ["marketing", "doctors", filters],
    queryFn: async () => {
      const params: Record<string, string | number> = { page: filters.page, limit: 50 };
      if (filters.search) params.search = filters.search;
      if (filters.specialization) params.specialization = filters.specialization;
      if (filters.area) params.area = filters.area;
      if (filters.tier) params.tier = filters.tier;
      const res = await api.get("/marketing/doctors", { params });
      return res.data?.data ?? res.data;
    },
  });

  const doctors = doctorsRes?.data ?? [];
  const meta = doctorsRes?.meta ?? { total: 0, page: 1, totalPages: 1 };

  const addMut = useMutation({
    mutationFn: async () => {
      await api.post("/marketing/doctors", addForm);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing", "doctors"] });
      setShowAddForm(false);
      setAddForm({ name: "", specialization: "", qualification: "", clinicName: "", clinicAddress: "", area: "", city: "", phone: "", whatsapp: "", email: "", notes: "", nextFollowUpDate: "" });
    },
  });

  const contactMut = useMutation({
    mutationFn: async () => {
      if (!selectedDoctor) return;
      await api.post(`/marketing/doctors/${selectedDoctor.id}/contacts`, contactForm);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing", "doctors"] });
      setShowContactForm(false);
      setContactForm({ type: "VISIT", notes: "", outcome: "", nextActionDate: "", nextAction: "" });
      if (selectedDoctor) {
        api.get(`/marketing/doctors/${selectedDoctor.id}`).then((res) => {
          setSelectedDoctor(res.data?.data ?? res.data);
        });
      }
    },
  });

  const selectDoctor = async (id: string) => {
    const res = await api.get(`/marketing/doctors/${id}`);
    setSelectedDoctor(res.data?.data ?? res.data);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Referring Doctors</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage doctor relationships and track referrals</p>
        </div>
        <button onClick={() => setShowAddForm(true)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 flex items-center gap-2">
          <UserPlus className="h-4 w-4" />Add Doctor
        </button>
      </div>

      {/* Follow-up Banner */}
      {dueFollowUp.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">
              {dueFollowUp.length} doctor{dueFollowUp.length > 1 ? "s" : ""} due for follow-up today
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              {dueFollowUp.slice(0, 3).map((d) => d.name).join(", ")}
              {dueFollowUp.length > 3 ? ` and ${dueFollowUp.length - 3} more` : ""}
            </p>
          </div>
        </div>
      )}

      {/* Stats Bar */}
      {stats && (
        <div className="flex gap-6 text-sm">
          <span className="text-slate-600">Total: <strong>{stats.total}</strong></span>
          <span className="text-amber-600">VIP: <strong>{stats.vip}</strong></span>
          <span className="text-green-600">Active: <strong>{stats.active}</strong></span>
          <span className="text-slate-400">Inactive: <strong>{stats.inactive}</strong></span>
          <span className="text-blue-600">New this month: <strong>{stats.newThisMonth}</strong></span>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
          <input type="text" placeholder="Search name or clinic..." value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
            className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm" />
        </div>
        <select value={filters.specialization} onChange={(e) => setFilters({ ...filters, specialization: e.target.value, page: 1 })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">All Specializations</option>
          {SPECIALIZATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filters.tier} onChange={(e) => setFilters({ ...filters, tier: e.target.value, page: 1 })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">All Tiers</option>
          <option value="VIP">VIP</option>
          <option value="ACTIVE">Active</option>
          <option value="NEW">New</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Loading...</div>
        ) : doctors.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No doctors found. Add your first referring doctor!</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Doctor</th>
                  <th className="px-4 py-3 text-left font-medium">Clinic</th>
                  <th className="px-4 py-3 text-left font-medium">Area</th>
                  <th className="px-4 py-3 text-center font-medium">Referrals</th>
                  <th className="px-4 py-3 text-right font-medium">Revenue</th>
                  <th className="px-4 py-3 text-left font-medium">Last Contact</th>
                  <th className="px-4 py-3 text-center font-medium">Tier</th>
                  <th className="px-4 py-3 text-center font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {doctors.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => selectDoctor(doc.id)}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{doc.name}</p>
                      <p className="text-xs text-slate-500">{doc.specialization ?? "General"} {doc.qualification ? `(${doc.qualification})` : ""}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{doc.clinicName ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{doc.area ?? "—"}</td>
                    <td className="px-4 py-3 text-center font-medium">{doc.totalReferrals}</td>
                    <td className="px-4 py-3 text-right font-medium text-emerald-600">{formatCurrency(Number(doc.totalRevenue))}</td>
                    <td className="px-4 py-3 text-slate-500">{doc.lastContactDate ? formatDate(doc.lastContactDate) : "Never"}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${TIERS[doc.tier] ?? TIERS.NEW}`}>
                        {doc.tier}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => { selectDoctor(doc.id); setShowContactForm(true); }}
                        className="text-xs px-2 py-1 rounded border border-blue-300 text-blue-600 hover:bg-blue-50 mr-1">
                        Log Contact
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {meta.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between">
            <span className="text-sm text-slate-500">Page {meta.page} of {meta.totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setFilters({ ...filters, page: filters.page - 1 })} disabled={filters.page <= 1}
                className="px-3 py-1 text-sm rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-50">Previous</button>
              <button onClick={() => setFilters({ ...filters, page: filters.page + 1 })} disabled={filters.page >= meta.totalPages}
                className="px-3 py-1 text-sm rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Add Doctor Sheet */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end">
          <div className="w-full max-w-lg bg-white h-full overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-slate-900">Add Referring Doctor</h2>
              <button onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
                <input type="text" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Specialization</label>
                  <select value={addForm.specialization} onChange={(e) => setAddForm({ ...addForm, specialization: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    <option value="">Select...</option>
                    {SPECIALIZATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Qualification</label>
                  <input type="text" placeholder="MBBS, MD..." value={addForm.qualification}
                    onChange={(e) => setAddForm({ ...addForm, qualification: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Clinic Name</label>
                <input type="text" value={addForm.clinicName} onChange={(e) => setAddForm({ ...addForm, clinicName: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Clinic Address</label>
                <input type="text" value={addForm.clinicAddress} onChange={(e) => setAddForm({ ...addForm, clinicAddress: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Area</label>
                  <input type="text" value={addForm.area} onChange={(e) => setAddForm({ ...addForm, area: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                  <input type="text" value={addForm.city} onChange={(e) => setAddForm({ ...addForm, city: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone *</label>
                  <input type="tel" value={addForm.phone} onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">WhatsApp</label>
                  <input type="tel" value={addForm.whatsapp} onChange={(e) => setAddForm({ ...addForm, whatsapp: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input type="email" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Next Follow-up Date</label>
                <input type="date" value={addForm.nextFollowUpDate} onChange={(e) => setAddForm({ ...addForm, nextFollowUpDate: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea rows={3} value={addForm.notes} onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <button onClick={() => addMut.mutate()} disabled={!addForm.name || addMut.isPending}
                className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {addMut.isPending ? "Saving..." : "Add Doctor"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Doctor Profile Sheet */}
      {selectedDoctor && !showAddForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end">
          <div className="w-full max-w-2xl bg-white h-full overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-slate-900">{selectedDoctor.name}</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${TIERS[selectedDoctor.tier] ?? TIERS.NEW}`}>
                  {selectedDoctor.tier}
                </span>
              </div>
              <button onClick={() => setSelectedDoctor(null)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>

            <div className="p-6 space-y-6">
              {/* Doctor Info */}
              <div>
                <p className="text-sm text-slate-600">
                  {selectedDoctor.specialization ?? "General"} {selectedDoctor.qualification ? `(${selectedDoctor.qualification})` : ""}
                  {selectedDoctor.clinicName ? ` at ${selectedDoctor.clinicName}` : ""}
                </p>
                <div className="flex gap-4 mt-2 text-sm text-slate-500">
                  {selectedDoctor.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{selectedDoctor.phone}</span>}
                  {selectedDoctor.whatsapp && <span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{selectedDoctor.whatsapp}</span>}
                  {selectedDoctor.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{selectedDoctor.email}</span>}
                  {selectedDoctor.area && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{selectedDoctor.area}</span>}
                </div>
              </div>

              {/* KPIs */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-slate-900">{selectedDoctor.totalReferrals}</p>
                  <p className="text-xs text-slate-500">Referrals</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-emerald-600">{formatCurrency(Number(selectedDoctor.totalRevenue))}</p>
                  <p className="text-xs text-slate-500">Revenue</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-slate-900">{selectedDoctor.lastContactDate ? formatDate(selectedDoctor.lastContactDate) : "Never"}</p>
                  <p className="text-xs text-slate-500">Last Contact</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-slate-900">{selectedDoctor.nextFollowUpDate ? formatDate(selectedDoctor.nextFollowUpDate) : "—"}</p>
                  <p className="text-xs text-slate-500">Next Follow-up</p>
                </div>
              </div>

              {/* Contact Log */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-900">Contact Log</h3>
                  <button onClick={() => setShowContactForm(!showContactForm)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1">
                    <Plus className="h-3 w-3" />Log Contact
                  </button>
                </div>

                {showContactForm && (
                  <div className="bg-slate-50 rounded-lg p-4 mb-4 space-y-3">
                    <div className="flex gap-2">
                      {CONTACT_TYPES.map((ct) => (
                        <button key={ct.value} onClick={() => setContactForm({ ...contactForm, type: ct.value })}
                          className={`text-xs px-3 py-1.5 rounded-full border ${contactForm.type === ct.value ? "bg-blue-600 text-white border-blue-600" : "border-slate-300 text-slate-600 hover:bg-slate-100"}`}>
                          {ct.label}
                        </button>
                      ))}
                    </div>
                    <textarea rows={2} placeholder="Notes — what was discussed?" value={contactForm.notes}
                      onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                    <div className="grid grid-cols-3 gap-3">
                      <select value={contactForm.outcome} onChange={(e) => setContactForm({ ...contactForm, outcome: e.target.value })}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                        <option value="">Outcome...</option>
                        {OUTCOMES.map((o) => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}
                      </select>
                      <input type="date" placeholder="Next follow-up" value={contactForm.nextActionDate}
                        onChange={(e) => setContactForm({ ...contactForm, nextActionDate: e.target.value })}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                      <button onClick={() => contactMut.mutate()} disabled={contactMut.isPending}
                        className="rounded-lg bg-green-600 text-white text-sm hover:bg-green-700 disabled:opacity-50">
                        {contactMut.isPending ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {(selectedDoctor.contacts ?? []).length === 0 ? (
                    <p className="text-sm text-slate-400 py-4 text-center">No contact history yet</p>
                  ) : (
                    (selectedDoctor.contacts ?? []).map((c) => (
                      <div key={c.id} className="flex gap-3 py-2 border-b border-slate-100">
                        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${CONTACT_TYPES.find((ct) => ct.value === c.type)?.color ?? "bg-slate-400"}`} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-slate-700">{c.type}</span>
                            <span className="text-xs text-slate-400">{formatDate(c.contactedAt)}</span>
                            {c.outcome && (
                              <span className={`text-xs px-1.5 py-0.5 rounded ${c.outcome === "POSITIVE" ? "bg-green-100 text-green-700" : c.outcome === "PROMISED_REFERRAL" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                                {c.outcome.replace(/_/g, " ")}
                              </span>
                            )}
                          </div>
                          {c.notes && <p className="text-sm text-slate-600 mt-0.5">{c.notes}</p>}
                          {c.nextAction && (
                            <p className="text-xs text-blue-600 mt-0.5 flex items-center gap-1">
                              <Calendar className="h-3 w-3" />Next: {c.nextAction} {c.nextActionDate ? `(${formatDate(c.nextActionDate)})` : ""}
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
