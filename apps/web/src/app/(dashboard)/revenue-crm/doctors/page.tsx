"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, X, Search, Loader2, AlertCircle, Stethoscope, MapPin,
  Phone, Mail, Star, Users, TrendingUp, Clock, Eye, ChevronRight,
  Building2, ClipboardList, Activity, UserPlus, UserMinus, Crown,
  MessageCircle, ToggleLeft, ToggleRight,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface Doctor {
  id: string;
  name: string;
  qualification: string | null;
  specialization: string | null;
  clinicName: string | null;
  clinicAddress: string | null;
  area: string | null;
  city: string | null;
  pincode: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  tier: string;
  referralsMTD: number;
  revenueMTD: number;
  lastContact: string | null;
  revShareEnabled: boolean;
  revSharePct: number;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
}

interface DoctorDetail extends Doctor {
  totalReferrals: number;
  totalRevenue: number;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    patientName: string;
    amount: number;
    status: string;
    createdAt: string;
  }>;
}

interface DoctorsResponse {
  doctors: Doctor[];
  stats: {
    total: number;
    vip: number;
    gold: number;
    active: number;
    new: number;
    inactive: number;
  };
}

const TIERS = ["VIP", "GOLD", "ACTIVE", "NEW", "INACTIVE"];

const TIER_BADGE: Record<string, { bg: string; text: string }> = {
  VIP:      { bg: "bg-amber-900/60", text: "text-amber-300" },
  GOLD:     { bg: "bg-yellow-900/60", text: "text-yellow-300" },
  ACTIVE:   { bg: "bg-emerald-900/60", text: "text-emerald-300" },
  NEW:      { bg: "bg-blue-900/60", text: "text-blue-300" },
  INACTIVE: { bg: "bg-slate-200", text: "text-slate-500" },
};

const fmt = (v: number) => new Intl.NumberFormat("en-IN").format(v);

// ── Shared components ────────────────────────────────────────────────────────

function Skeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />
      ))}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-red-950/60 border border-red-800 p-4 text-red-300">
      <AlertCircle className="h-5 w-5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-slate-500">
      <Stethoscope className="h-12 w-12 mb-3 opacity-40" />
      <p>{text}</p>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
      <div className={cn("p-2 rounded-lg", color)}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DoctorsPage() {
  const queryClient = useQueryClient();

  // ── Filters ──
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [areaFilter, setAreaFilter] = useState("");

  // ── Modal state ──
  const [showAddDoctor, setShowAddDoctor] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);

  // ── Form ──
  const [form, setForm] = useState({
    name: "", qualification: "", specialization: "", clinicName: "",
    clinicAddress: "", area: "", city: "", pincode: "", phone: "",
    whatsapp: "", email: "", revShareEnabled: false, revSharePct: 0, notes: "",
  });

  // ── Queries ──
  const doctorsQuery = useQuery({
    queryKey: ["revenue-crm", "doctors"],
    queryFn: async () => {
      const res = await api.get("/revenue-crm/doctors");
      const data = res.data?.data ?? res.data;
      // Support both flat array and { doctors, stats } shape
      if (Array.isArray(data)) {
        return {
          doctors: data as Doctor[],
          stats: {
            total: data.length,
            vip: data.filter((d: Doctor) => d.tier === "VIP").length,
            gold: data.filter((d: Doctor) => d.tier === "GOLD").length,
            active: data.filter((d: Doctor) => d.tier === "ACTIVE").length,
            new: data.filter((d: Doctor) => d.tier === "NEW").length,
            inactive: data.filter((d: Doctor) => d.tier === "INACTIVE").length,
          },
        } as DoctorsResponse;
      }
      return data as DoctorsResponse;
    },
  });

  const doctorDetailQuery = useQuery({
    queryKey: ["revenue-crm", "doctors", selectedDoctorId],
    queryFn: async () => {
      const res = await api.get(`/revenue-crm/doctors/${selectedDoctorId}`);
      return (res.data?.data ?? res.data) as DoctorDetail;
    },
    enabled: !!selectedDoctorId,
  });

  // ── Mutations ──
  const addDoctorMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        revSharePct: Number(form.revSharePct),
        qualification: form.qualification || undefined,
        specialization: form.specialization || undefined,
        clinicAddress: form.clinicAddress || undefined,
        whatsapp: form.whatsapp || undefined,
        email: form.email || undefined,
        notes: form.notes || undefined,
      };
      await api.post("/revenue-crm/doctors", payload);
    },
    onSuccess: () => {
      toast.success("Doctor added successfully");
      queryClient.invalidateQueries({ queryKey: ["revenue-crm", "doctors"] });
      setShowAddDoctor(false);
      setForm({
        name: "", qualification: "", specialization: "", clinicName: "",
        clinicAddress: "", area: "", city: "", pincode: "", phone: "",
        whatsapp: "", email: "", revShareEnabled: false, revSharePct: 0, notes: "",
      });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to add doctor"),
  });

  // ── Filtered data ──
  const stats = doctorsQuery.data?.stats;
  const doctors = doctorsQuery.data?.doctors ?? [];

  const filteredDoctors = useMemo(() => {
    let list = doctors;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.clinicName?.toLowerCase().includes(q) ||
          d.specialization?.toLowerCase().includes(q) ||
          d.phone?.includes(q)
      );
    }
    if (tierFilter) list = list.filter((d) => d.tier === tierFilter);
    if (areaFilter) {
      const a = areaFilter.toLowerCase();
      list = list.filter((d) => d.area?.toLowerCase().includes(a));
    }
    return list;
  }, [doctors, search, tierFilter, areaFilter]);

  const detail = doctorDetailQuery.data;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Stethoscope className="h-7 w-7 text-emerald-400" />
            Doctors &amp; Clinics
          </h1>
          <p className="text-slate-500 text-sm mt-1">Manage doctor referrals, tiers and rev share</p>
        </div>
        <button
          onClick={() => setShowAddDoctor(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition"
        >
          <Plus className="h-4 w-4" />
          Add Doctor
        </button>
      </div>

      {/* Stats cards */}
      {doctorsQuery.isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <StatCard icon={Users} label="Total" value={stats.total} color="bg-slate-100 text-slate-700" />
          <StatCard icon={Crown} label="VIP" value={stats.vip} color="bg-amber-100 text-amber-700" />
          <StatCard icon={Star} label="Gold" value={stats.gold} color="bg-yellow-100 text-yellow-700" />
          <StatCard icon={Activity} label="Active" value={stats.active} color="bg-emerald-100 text-emerald-700" />
          <StatCard icon={UserPlus} label="New" value={stats.new} color="bg-blue-100 text-blue-700" />
          <StatCard icon={UserMinus} label="Inactive" value={stats.inactive} color="bg-slate-200 text-slate-500" />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search doctors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Tiers</option>
          {TIERS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Filter by area..."
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
            className="pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Table */}
      {doctorsQuery.isLoading && <Skeleton rows={8} />}
      {doctorsQuery.isError && <ErrorBanner message="Failed to load doctors" />}
      {doctorsQuery.isSuccess && filteredDoctors.length === 0 && (
        <EmptyState text="No doctors found" />
      )}

      {doctorsQuery.isSuccess && filteredDoctors.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 text-left">
                <th className="px-4 py-3 font-medium">Doctor</th>
                <th className="px-4 py-3 font-medium">Clinic</th>
                <th className="px-4 py-3 font-medium">Specialization</th>
                <th className="px-4 py-3 font-medium">Area</th>
                <th className="px-4 py-3 font-medium text-right">Referrals MTD</th>
                <th className="px-4 py-3 font-medium text-right">Revenue MTD</th>
                <th className="px-4 py-3 font-medium">Tier</th>
                <th className="px-4 py-3 font-medium">Last Contact</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDoctors.map((doc) => {
                const badge = TIER_BADGE[doc.tier] ?? TIER_BADGE.INACTIVE;
                return (
                  <tr
                    key={doc.id}
                    onClick={() => setSelectedDoctorId(doc.id)}
                    className="border-b border-slate-200/50 hover:bg-slate-100/40 transition cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{doc.name}</div>
                      {doc.qualification && <div className="text-xs text-slate-500">{doc.qualification}</div>}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{doc.clinicName ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-700">{doc.specialization ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-500">{doc.area ?? "-"}</td>
                    <td className="px-4 py-3 text-right font-medium">{doc.referralsMTD ?? 0}</td>
                    <td className="px-4 py-3 text-right font-medium">{fmt(doc.revenueMTD ?? 0)}</td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", badge.bg, badge.text)}>
                        {doc.tier}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-sm">
                      {doc.lastContact ? new Date(doc.lastContact).toLocaleDateString("en-IN") : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedDoctorId(doc.id); }}
                        className="text-blue-400 hover:text-blue-300 transition"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Add Doctor Modal ── */}
      {showAddDoctor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white border border-slate-300 rounded-2xl w-full max-w-2xl p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add Doctor</h2>
              <button onClick={() => setShowAddDoctor(false)} className="text-slate-500 hover:text-slate-900">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-slate-500 mb-1 block">Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full bg-slate-100 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Qualification</label>
                <input
                  value={form.qualification}
                  onChange={(e) => setForm((f) => ({ ...f, qualification: e.target.value }))}
                  className="w-full bg-slate-100 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Specialization</label>
                <input
                  value={form.specialization}
                  onChange={(e) => setForm((f) => ({ ...f, specialization: e.target.value }))}
                  className="w-full bg-slate-100 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Clinic Name</label>
                <input
                  value={form.clinicName}
                  onChange={(e) => setForm((f) => ({ ...f, clinicName: e.target.value }))}
                  className="w-full bg-slate-100 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Clinic Address</label>
                <input
                  value={form.clinicAddress}
                  onChange={(e) => setForm((f) => ({ ...f, clinicAddress: e.target.value }))}
                  className="w-full bg-slate-100 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Area</label>
                <input
                  value={form.area}
                  onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))}
                  className="w-full bg-slate-100 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">City</label>
                <input
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  className="w-full bg-slate-100 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Pincode</label>
                <input
                  value={form.pincode}
                  onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value }))}
                  className="w-full bg-slate-100 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Phone *</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full bg-slate-100 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">WhatsApp</label>
                <input
                  value={form.whatsapp}
                  onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
                  className="w-full bg-slate-100 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Email</label>
                <input
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full bg-slate-100 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Rev Share toggle */}
              <div className="col-span-2 flex items-center gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, revShareEnabled: !f.revShareEnabled }))}
                  className="flex items-center gap-2 text-sm"
                >
                  {form.revShareEnabled ? (
                    <ToggleRight className="h-6 w-6 text-blue-400" />
                  ) : (
                    <ToggleLeft className="h-6 w-6 text-slate-500" />
                  )}
                  <span className={form.revShareEnabled ? "text-slate-900" : "text-slate-500"}>
                    Enable Rev Share
                  </span>
                </button>

                {form.revShareEnabled && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500">Affiliate Marketing Cost %</label>
                    <input
                      type="number"
                      value={form.revSharePct}
                      onChange={(e) => setForm((f) => ({ ...f, revSharePct: Number(e.target.value) }))}
                      className="w-24 bg-slate-100 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>

              <div className="col-span-2">
                <label className="text-xs text-slate-500 mb-1 block">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className="w-full bg-slate-100 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowAddDoctor(false)}
                className="px-4 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => addDoctorMutation.mutate()}
                disabled={addDoctorMutation.isPending || !form.name || !form.phone}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm font-medium transition"
              >
                {addDoctorMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Add Doctor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Doctor Detail Slide-over ── */}
      {selectedDoctorId && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedDoctorId(null)} />
          <div className="relative w-full max-w-xl bg-white border-l border-slate-300 shadow-2xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-semibold">Doctor Details</h2>
              <button onClick={() => setSelectedDoctorId(null)} className="text-slate-500 hover:text-slate-900">
                <X className="h-5 w-5" />
              </button>
            </div>

            {doctorDetailQuery.isLoading && (
              <div className="p-6 space-y-4">
                <div className="h-8 w-48 rounded bg-slate-100 animate-pulse" />
                <div className="h-4 w-32 rounded bg-slate-100 animate-pulse" />
                <div className="grid grid-cols-2 gap-3 mt-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />
                  ))}
                </div>
                <div className="space-y-3 mt-6">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-12 rounded bg-slate-100 animate-pulse" />
                  ))}
                </div>
              </div>
            )}

            {doctorDetailQuery.isError && (
              <div className="p-6">
                <ErrorBanner message="Failed to load doctor details" />
              </div>
            )}

            {doctorDetailQuery.isSuccess && detail && (
              <div className="p-6 space-y-6">
                {/* Doctor Info */}
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-bold">{detail.name}</h3>
                    {detail.tier && (
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-medium",
                        TIER_BADGE[detail.tier]?.bg ?? "bg-slate-200",
                        TIER_BADGE[detail.tier]?.text ?? "text-slate-500",
                      )}>
                        {detail.tier}
                      </span>
                    )}
                  </div>
                  {detail.qualification && <p className="text-sm text-slate-500 mt-1">{detail.qualification}</p>}
                  {detail.specialization && <p className="text-sm text-slate-500">{detail.specialization}</p>}
                </div>

                {/* Contact */}
                <div className="space-y-2 text-sm">
                  {detail.clinicName && (
                    <p className="flex items-center gap-2 text-slate-700">
                      <Building2 className="h-4 w-4 text-slate-500" />
                      {detail.clinicName}
                    </p>
                  )}
                  {detail.area && (
                    <p className="flex items-center gap-2 text-slate-700">
                      <MapPin className="h-4 w-4 text-slate-500" />
                      {[detail.area, detail.city, detail.pincode].filter(Boolean).join(", ")}
                    </p>
                  )}
                  {detail.phone && (
                    <p className="flex items-center gap-2 text-slate-700">
                      <Phone className="h-4 w-4 text-slate-500" />
                      {detail.phone}
                    </p>
                  )}
                  {detail.whatsapp && (
                    <p className="flex items-center gap-2 text-slate-700">
                      <MessageCircle className="h-4 w-4 text-slate-500" />
                      {detail.whatsapp}
                    </p>
                  )}
                  {detail.email && (
                    <p className="flex items-center gap-2 text-slate-700">
                      <Mail className="h-4 w-4 text-slate-500" />
                      {detail.email}
                    </p>
                  )}
                </div>

                {/* Overview stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-100 rounded-xl p-4">
                    <p className="text-xs text-slate-500">Total Referrals</p>
                    <p className="text-xl font-bold mt-1">{detail.totalReferrals ?? 0}</p>
                  </div>
                  <div className="bg-slate-100 rounded-xl p-4">
                    <p className="text-xs text-slate-500">Total Revenue</p>
                    <p className="text-xl font-bold mt-1">{fmt(detail.totalRevenue ?? 0)}</p>
                  </div>
                  <div className="bg-slate-100 rounded-xl p-4">
                    <p className="text-xs text-slate-500">Referrals MTD</p>
                    <p className="text-xl font-bold mt-1">{detail.referralsMTD ?? 0}</p>
                  </div>
                  <div className="bg-slate-100 rounded-xl p-4">
                    <p className="text-xs text-slate-500">Revenue MTD</p>
                    <p className="text-xl font-bold mt-1">{fmt(detail.revenueMTD ?? 0)}</p>
                  </div>
                </div>

                {/* Rev Share */}
                {detail.revShareEnabled && (
                  <div className="bg-blue-900/20 border border-blue-800/40 rounded-xl p-4">
                    <p className="text-xs text-blue-300 font-medium">Affiliate Marketing Cost</p>
                    <p className="text-lg font-bold mt-1">{detail.revSharePct}%</p>
                  </div>
                )}

                {/* Recent Orders */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">Recent Orders</h4>
                  {(!detail.recentOrders || detail.recentOrders.length === 0) ? (
                    <p className="text-sm text-slate-500">No recent orders</p>
                  ) : (
                    <div className="space-y-2">
                      {detail.recentOrders.map((order) => (
                        <div key={order.id} className="bg-slate-100 rounded-lg p-3 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">{order.orderNumber}</p>
                            <p className="text-xs text-slate-500">{order.patientName}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">{fmt(order.amount)}</p>
                            <p className="text-xs text-slate-500">
                              {new Date(order.createdAt).toLocaleDateString("en-IN")}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Notes */}
                {detail.notes && (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700 mb-1">Notes</h4>
                    <p className="text-sm text-slate-500">{detail.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
