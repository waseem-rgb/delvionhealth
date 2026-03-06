"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Star,
  TrendingUp,
  ClipboardList,
  Plus,
} from "lucide-react";
import { formatDate, formatCurrency, formatRelativeTime } from "@/lib/utils";
import api from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────

interface Visit {
  id: string;
  visitedAt: string;
  purpose: string | null;
  outcome: string | null;
  notes: string | null;
  nextVisitDate: string | null;
  visitedBy: { firstName: string; lastName: string };
}

interface DoctorDetail {
  id: string;
  name: string;
  specialty: string | null;
  phone: string | null;
  email: string | null;
  clinicName: string | null;
  address: string | null;
  clinicAddress: string | null;
  city: string | null;
  registrationNumber: string | null;
  engagementScore: number;
  referralCount: number;
  revenueGenerated: number;
  lastVisitDate: string | null;
  isActive: boolean;
  createdAt: string;
  visits: Visit[];
  _count: { visits: number };
}

// ── Engagement Score Bar ───────────────────────────────────────────────────

function EngagementBar({ score }: { score: number }) {
  const color = score >= 70 ? "bg-green-500" : score >= 40 ? "bg-yellow-500" : "bg-red-400";
  const label = score >= 70 ? "High" : score >= 40 ? "Medium" : "Low";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-slate-600 font-medium">Engagement Score</span>
        <span className={`font-bold ${score >= 70 ? "text-green-600" : score >= 40 ? "text-yellow-600" : "text-red-500"}`}>
          {score}/100 — {label}
        </span>
      </div>
      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

// ── Log Visit Modal ────────────────────────────────────────────────────────

function LogVisitModal({ doctorId, onClose, onSuccess }: { doctorId: string; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ purpose: "", outcome: "", notes: "", nextVisitDate: "" });
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: (data: typeof form) => api.post(`/crm/doctors/${doctorId}/visits`, data),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (e: unknown) => {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to log visit");
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Log New Visit</h2>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>}
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(form); }} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Purpose</label>
            <input type="text" value={form.purpose} onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Outcome</label>
            <input type="text" value={form.outcome} onChange={(e) => setForm((f) => ({ ...f, outcome: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30" />
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

export default function DoctorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"overview" | "visits" | "analytics">("overview");
  const [showVisitModal, setShowVisitModal] = useState(false);

  const { data: doctor, isLoading } = useQuery({
    queryKey: ["doctor", id],
    queryFn: async () => {
      const res = await api.get<{ data: DoctorDetail }>(`/crm/doctors/${id}`);
      return res.data.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1B4F8A]" />
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <p className="text-lg font-medium">Doctor not found</p>
        <button onClick={() => router.push("/crm/doctors")} className="mt-3 text-sm text-[#1B4F8A] underline">
          Back to Doctors
        </button>
      </div>
    );
  }

  const scoreColor = doctor.engagementScore >= 70 ? "text-green-600" : doctor.engagementScore >= 40 ? "text-yellow-600" : "text-red-500";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => router.push("/crm/doctors")}
          className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{doctor.name}</h1>
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${doctor.isActive ? "bg-green-50 border-green-200 text-green-700" : "bg-slate-50 border-slate-200 text-slate-400"}`}>
              {doctor.isActive ? "Active" : "Inactive"}
            </span>
          </div>
          {doctor.specialty && <p className="text-slate-500 mt-0.5">{doctor.specialty}</p>}
        </div>
        <button
          onClick={() => setShowVisitModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1B4F8A] text-white rounded-lg text-sm font-semibold hover:bg-[#163d6a]"
        >
          <Plus className="w-4 h-4" />
          Log Visit
        </button>
      </div>

      {/* Info + Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Contact Info */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Contact Information</h3>
          {doctor.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="w-4 h-4 text-slate-400" />
              <span className="text-slate-700">{doctor.phone}</span>
            </div>
          )}
          {doctor.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="w-4 h-4 text-slate-400" />
              <span className="text-slate-700">{doctor.email}</span>
            </div>
          )}
          {(doctor.clinicName || doctor.city) && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-slate-400" />
              <span className="text-slate-700">{doctor.clinicName ?? doctor.city}</span>
            </div>
          )}
          {doctor.clinicAddress && (
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
              <span className="text-slate-600">{doctor.clinicAddress}</span>
            </div>
          )}
          {doctor.registrationNumber && (
            <div className="text-xs text-slate-400">Reg: {doctor.registrationNumber}</div>
          )}
          {doctor.lastVisitDate && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-slate-600">Last visit: {formatDate(doctor.lastVisitDate)}</span>
            </div>
          )}
        </div>

        {/* KPI Cards */}
        <div className="md:col-span-2 grid grid-cols-3 gap-4">
          {[
            { label: "Engagement Score", value: doctor.engagementScore, suffix: "/100", color: scoreColor, Icon: Star },
            { label: "Total Referrals", value: doctor.referralCount, suffix: "", color: "text-[#1B4F8A]", Icon: TrendingUp },
            { label: "Revenue Generated", value: formatCurrency(Number(doctor.revenueGenerated)), suffix: "", color: "text-green-600", Icon: ClipboardList },
          ].map((k) => (
            <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-2">
              <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
                <k.Icon className={`w-4 h-4 ${k.color}`} />
              </div>
              <p className="text-xs text-slate-500 font-medium">{k.label}</p>
              <p className={`text-2xl font-bold ${k.color}`}>{k.value}{k.suffix}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Engagement Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <EngagementBar score={doctor.engagementScore} />
        <p className="text-xs text-slate-400 mt-2">
          Score calculated from referral volume (40%), revenue (40%), and visit recency (20%)
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-200">
          {(["overview", "visits", "analytics"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-3 text-sm font-medium capitalize border-b-2 -mb-px ${
                activeTab === tab
                  ? "border-[#1B4F8A] text-[#1B4F8A]"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab === "overview" ? "Overview" : tab === "visits" ? "Visit History" : "Analytics"}
            </button>
          ))}
        </div>

        <div className="p-5">
          {activeTab === "overview" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase mb-1">Total Visits</p>
                  <p className="font-bold text-slate-800 text-lg">{doctor._count.visits}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase mb-1">Member Since</p>
                  <p className="font-medium text-slate-700">{formatDate(doctor.createdAt)}</p>
                </div>
              </div>
              {doctor.visits.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase mb-2">Recent Visits</p>
                  <div className="space-y-2">
                    {doctor.visits.slice(0, 3).map((v) => (
                      <div key={v.id} className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{v.purpose ?? "Visit"}</p>
                            {v.outcome && <p className="text-xs text-slate-600 mt-0.5">{v.outcome}</p>}
                          </div>
                          <div className="text-right text-xs text-slate-400">
                            <p>{formatRelativeTime(v.visitedAt)}</p>
                            <p>by {v.visitedBy.firstName} {v.visitedBy.lastName}</p>
                          </div>
                        </div>
                        {v.nextVisitDate && (
                          <p className="text-xs text-blue-600 mt-1.5">
                            Next visit: {formatDate(v.nextVisitDate)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "visits" && (
            <div className="space-y-3">
              {doctor.visits.length === 0 ? (
                <p className="text-slate-400 text-center py-8">No visits recorded yet</p>
              ) : (
                doctor.visits.map((v) => (
                  <div key={v.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold text-slate-800">{v.purpose ?? "Visit"}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          by {v.visitedBy.firstName} {v.visitedBy.lastName}
                        </p>
                      </div>
                      <p className="text-xs text-slate-400">{formatDate(v.visitedAt)}</p>
                    </div>
                    {v.outcome && (
                      <p className="text-sm text-slate-600">
                        <span className="font-medium">Outcome:</span> {v.outcome}
                      </p>
                    )}
                    {v.notes && (
                      <p className="text-sm text-slate-500 mt-1">{v.notes}</p>
                    )}
                    {v.nextVisitDate && (
                      <div className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 rounded px-2 py-1">
                        <Calendar className="w-3 h-3" />
                        Next: {formatDate(v.nextVisitDate)}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "analytics" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 font-semibold uppercase mb-1">Visits Per Month (Avg)</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {doctor._count.visits > 0
                      ? (doctor._count.visits / Math.max(1, Math.ceil((Date.now() - new Date(doctor.createdAt).getTime()) / (30 * 86_400_000)))).toFixed(1)
                      : "0"}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 font-semibold uppercase mb-1">Revenue per Referral</p>
                  <p className="text-2xl font-bold text-green-600">
                    {doctor.referralCount > 0
                      ? formatCurrency(Number(doctor.revenueGenerated) / doctor.referralCount)
                      : "—"}
                  </p>
                </div>
              </div>
              <div className="text-sm text-slate-500 bg-slate-50 rounded-lg p-4">
                <p className="font-semibold text-slate-700 mb-1">Engagement Score Breakdown</p>
                <ul className="space-y-1 text-xs">
                  <li>• Referral score (40%): {Math.round(Math.min(100, (doctor.referralCount / 50) * 100))} pts</li>
                  <li>• Revenue score (40%): {Math.round(Math.min(100, (Number(doctor.revenueGenerated) / 500_000) * 100))} pts</li>
                  <li>• Visit recency (20%): based on days since last visit</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {showVisitModal && (
        <LogVisitModal
          doctorId={doctor.id}
          onClose={() => setShowVisitModal(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["doctor", id] });
            qc.invalidateQueries({ queryKey: ["doctor-stats"] });
          }}
        />
      )}
    </div>
  );
}
