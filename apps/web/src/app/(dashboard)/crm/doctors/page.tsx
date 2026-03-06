"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import * as Tabs from "@radix-ui/react-tabs";
import {
  Plus,
  Phone,
  Mail,
  MapPin,
  Star,
  TrendingUp,
  Users,
  Calendar,
  Eye,
} from "lucide-react";
import { DataTable } from "@/components/tables/DataTable";
import { SearchInput } from "@/components/shared/SearchInput";
import { formatDate, formatCurrency } from "@/lib/utils";
import api from "@/lib/api";
import type { TerritoryCity } from "@/components/crm/TerritoryMap";

// Dynamic import for Leaflet map (SSR disabled)
const TerritoryMap = dynamic(() => import("@/components/crm/TerritoryMap"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[500px] bg-slate-50 rounded-lg border border-slate-200">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1B4F8A]" />
    </div>
  ),
});

// ── Types ──────────────────────────────────────────────────────────────────

interface Doctor {
  id: string;
  name: string;
  specialty: string | null;
  phone: string | null;
  email: string | null;
  clinicName: string | null;
  city: string | null;
  engagementScore: number;
  referralCount: number;
  revenueGenerated: number;
  lastVisitDate: string | null;
  isActive: boolean;
  createdAt: string;
  _count: { visits: number };
  aiTier?: string;
  aiScore?: number;
  aiVisitPriority?: string;
}

interface DoctorStats {
  total: number;
  active: number;
  visitsThisMonth: number;
  topDoctors: Array<{
    id: string;
    name: string;
    specialty: string | null;
    city: string | null;
    engagementScore: number;
    referralCount: number;
    revenueGenerated: number;
    lastVisitDate: string | null;
  }>;
}

// ── AI Tier Badge ──────────────────────────────────────────────────────────

function AiTierBadge({ tier }: { tier: string }) {
  const map: Record<string, { cls: string; icon: string }> = {
    PLATINUM: { cls: "bg-slate-100 text-slate-700 border-slate-300", icon: "💎" },
    GOLD:     { cls: "bg-yellow-50 text-yellow-700 border-yellow-300", icon: "🥇" },
    SILVER:   { cls: "bg-slate-50 text-slate-500 border-slate-200", icon: "🥈" },
    BRONZE:   { cls: "bg-orange-50 text-orange-600 border-orange-200", icon: "🥉" },
  };
  const style = map[tier] ?? map.BRONZE;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-bold ${style.cls}`}>
      {style.icon} {tier}
    </span>
  );
}

// ── Engagement Score Bar ───────────────────────────────────────────────────

function EngagementBar({ score }: { score: number }) {
  const color = score >= 70 ? "bg-green-500" : score >= 40 ? "bg-yellow-500" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-bold text-slate-600 w-6 text-right">{score}</span>
    </div>
  );
}

// ── Add Doctor Drawer ──────────────────────────────────────────────────────

function AddDoctorDrawer({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    name: "",
    specialty: "",
    phone: "",
    email: "",
    clinicName: "",
    address: "",
    city: "",
    registrationNumber: "",
  });
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: (data: typeof form) => api.post("/crm/doctors", data),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (e: unknown) => {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to add doctor");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Name is required"); return; }
    mutation.mutate(form);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md h-full flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">Add Doctor</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
        </div>
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {(
            [
              { key: "name", label: "Full Name *", placeholder: "Dr. Rajesh Kumar" },
              { key: "specialty", label: "Specialty", placeholder: "Cardiology" },
              { key: "phone", label: "Phone", placeholder: "+91 98765 43210" },
              { key: "email", label: "Email", placeholder: "doctor@clinic.com" },
              { key: "clinicName", label: "Clinic / Hospital Name" },
              { key: "address", label: "Address" },
              { key: "city", label: "City" },
              { key: "registrationNumber", label: "Registration Number" },
            ] as Array<{ key: keyof typeof form; label: string; placeholder?: string }>
          ).map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
              <input
                type="text"
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
              />
            </div>
          ))}
        </form>
        <div className="px-6 py-4 border-t border-slate-200 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700">Cancel</button>
          <button
            type="button"
            onClick={(e) => handleSubmit(e as unknown as React.FormEvent)}
            disabled={mutation.isPending}
            className="flex-1 px-4 py-2 bg-[#1B4F8A] rounded-lg text-sm font-semibold text-white hover:bg-[#163d6a] disabled:opacity-50"
          >
            {mutation.isPending ? "Adding..." : "Add Doctor"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Log Visit Modal ────────────────────────────────────────────────────────

function LogVisitModal({ doctor, onClose, onSuccess }: { doctor: Doctor; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ purpose: "", outcome: "", notes: "", nextVisitDate: "" });
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: (data: typeof form) => api.post(`/crm/doctors/${doctor.id}/visits`, data),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (e: unknown) => {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to log visit");
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Log Visit — {doctor.name}</h2>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>}
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(form); }} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Purpose</label>
            <input type="text" value={form.purpose} onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))} placeholder="Referral update, new tests promotion..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Outcome</label>
            <input type="text" value={form.outcome} onChange={(e) => setForm((f) => ({ ...f, outcome: e.target.value }))} placeholder="Positive, will refer patients..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Notes</label>
            <textarea rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Next Visit Date</label>
            <input type="date" value={form.nextVisitDate} onChange={(e) => setForm((f) => ({ ...f, nextVisitDate: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30" />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="flex-1 px-4 py-2 bg-[#1B4F8A] rounded-lg text-sm font-semibold text-white hover:bg-[#163d6a] disabled:opacity-50">
              {mutation.isPending ? "Logging..." : "Log Visit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function DoctorsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [specialty, setSpecialty] = useState("");
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [visitDoctor, setVisitDoctor] = useState<Doctor | null>(null);
  const [activeTab, setActiveTab] = useState("doctors");

  const statsQuery = useQuery({
    queryKey: ["doctor-stats"],
    queryFn: async () => {
      const res = await api.get<{ data: DoctorStats }>("/crm/doctors/stats");
      return res.data.data;
    },
  });

  const params = new URLSearchParams({
    page: String(page),
    limit: "20",
    ...(search && { search }),
    ...(specialty && { specialty }),
  }).toString();

  const { data, isLoading } = useQuery({
    queryKey: ["doctors", params],
    queryFn: async () => {
      const res = await api.get<{ data: { data: Doctor[]; meta: { total: number; totalPages: number } } }>(`/crm/doctors?${params}`);
      return res.data.data;
    },
  });

  const { data: territoryData, isLoading: territoryLoading } = useQuery({
    queryKey: ["crm-territory"],
    queryFn: async () => {
      const res = await api.get<{ data: TerritoryCity[] }>("/crm/territory");
      return res.data.data;
    },
    enabled: activeTab === "territory",
  });

  const columns: ColumnDef<Doctor>[] = [
    {
      header: "Doctor",
      cell: ({ row }) => (
        <div>
          <p className="font-semibold text-slate-800">{row.original.name}</p>
          {row.original.specialty && <p className="text-xs text-slate-400">{row.original.specialty}</p>}
        </div>
      ),
    },
    {
      header: "Contact",
      cell: ({ row }) => {
        const d = row.original;
        return (
          <div className="space-y-0.5">
            {d.phone && <div className="flex items-center gap-1 text-xs text-slate-600"><Phone className="w-3 h-3" /> {d.phone}</div>}
            {d.email && <div className="flex items-center gap-1 text-xs text-slate-500"><Mail className="w-3 h-3" /> {d.email}</div>}
          </div>
        );
      },
    },
    {
      header: "Location",
      cell: ({ row }) => (
        <div className="flex items-center gap-1 text-sm text-slate-600">
          <MapPin className="w-3 h-3 text-slate-400" />
          {row.original.clinicName ?? row.original.city ?? "—"}
        </div>
      ),
    },
    {
      header: "Engagement",
      cell: ({ row }) => <EngagementBar score={row.original.engagementScore} />,
    },
    {
      header: "AI Tier",
      cell: ({ row }) =>
        row.original.aiTier ? (
          <AiTierBadge tier={row.original.aiTier} />
        ) : (
          <span className="text-slate-300 text-xs">—</span>
        ),
    },
    {
      header: "Referrals",
      cell: ({ row }) => <div className="text-center font-bold text-[#1B4F8A]">{row.original.referralCount}</div>,
    },
    {
      header: "Revenue",
      cell: ({ row }) => <span className="text-sm font-semibold text-green-600">{formatCurrency(Number(row.original.revenueGenerated))}</span>,
    },
    {
      header: "Last Visit",
      cell: ({ row }) => row.original.lastVisitDate ? formatDate(row.original.lastVisitDate) : <span className="text-slate-400 text-xs">Never</span>,
    },
    {
      header: "Status",
      cell: ({ row }) => (
        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${row.original.isActive ? "bg-green-50 border-green-200 text-green-700" : "bg-slate-50 border-slate-200 text-slate-400"}`}>
          {row.original.isActive ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); setVisitDoctor(row.original); }}
            className="p-1.5 text-slate-400 hover:text-[#1B4F8A] hover:bg-blue-50 rounded"
            title="Log Visit"
          >
            <Calendar className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); router.push(`/crm/doctors/${row.original.id}`); }}
            className="p-1.5 text-slate-400 hover:text-[#1B4F8A] hover:bg-blue-50 rounded"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  const stats = statsQuery.data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Doctor Referral Network</h1>
          <p className="text-sm text-slate-500 mt-0.5">Engagement tracking, visit history, and referral analytics</p>
        </div>
        <button
          onClick={() => setShowAddDrawer(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1B4F8A] text-white rounded-lg text-sm font-semibold hover:bg-[#163d6a]"
        >
          <Plus className="w-4 h-4" />
          Add Doctor
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Doctors", value: stats?.total ?? 0, Icon: Users, color: "text-slate-800" },
          { label: "Active", value: stats?.active ?? 0, Icon: Star, color: "text-green-600" },
          { label: "Visits This Month", value: stats?.visitsThisMonth ?? 0, Icon: Calendar, color: "text-blue-600" },
          { label: "Top Score", value: stats?.topDoctors[0]?.engagementScore ?? 0, Icon: TrendingUp, color: "text-purple-600" },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0">
              <k.Icon className={`w-4 h-4 ${k.color}`} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">{k.label}</p>
              <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
        <Tabs.List className="flex gap-1 border-b border-slate-200 mb-4">
          {[
            { id: "doctors", label: "Doctors List" },
            { id: "territory", label: "Territory Map" },
          ].map((tab) => (
            <Tabs.Trigger
              key={tab.id}
              value={tab.id}
              className="px-4 py-2.5 text-sm font-medium text-slate-500 border-b-2 border-transparent data-[state=active]:border-[#1B4F8A] data-[state=active]:text-[#1B4F8A] hover:text-slate-800 transition-colors"
            >
              {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="doctors">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex gap-3 items-center">
              <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search doctors, clinic, city..." />
              <input
                type="text"
                value={specialty}
                onChange={(e) => { setSpecialty(e.target.value); setPage(1); }}
                placeholder="Filter by specialty..."
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30 w-48"
              />
            </div>
            <div className="p-5">
              <DataTable
                columns={columns}
                data={data?.data ?? []}
                isLoading={isLoading}
                page={page}
                total={data?.meta.total}
                pageSize={20}
                onPageChange={setPage}
              />
            </div>
          </div>
        </Tabs.Content>

        <Tabs.Content value="territory">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="text-base font-bold text-slate-800 mb-4">Geographic Distribution</h2>
            {territoryLoading ? (
              <div className="flex items-center justify-center h-[500px] bg-slate-50 rounded-lg">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1B4F8A]" />
              </div>
            ) : (territoryData && territoryData.length > 0) ? (
              <TerritoryMap cities={territoryData} />
            ) : (
              <div className="flex items-center justify-center h-[500px] bg-slate-50 rounded-lg text-slate-400">
                No territory data available
              </div>
            )}
          </div>
        </Tabs.Content>
      </Tabs.Root>

      {showAddDrawer && (
        <AddDoctorDrawer
          onClose={() => setShowAddDrawer(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["doctors"] });
            qc.invalidateQueries({ queryKey: ["doctor-stats"] });
          }}
        />
      )}

      {visitDoctor && (
        <LogVisitModal
          doctor={visitDoctor}
          onClose={() => setVisitDoctor(null)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["doctors"] });
            qc.invalidateQueries({ queryKey: ["doctor-stats"] });
          }}
        />
      )}
    </div>
  );
}
