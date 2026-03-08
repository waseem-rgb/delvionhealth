"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Send,
  Plus,
  Play,
  Pause,
  Eye,
  Copy,
  Users,
  TrendingUp,
  X,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import api from "@/lib/api";

interface Campaign {
  id: string;
  name: string;
  type: string;
  channel: string;
  targetAudience: string;
  status: string;
  subject: string | null;
  messageTemplate: string | null;
  scheduledAt: string | null;
  startedAt: string | null;
  totalTargeted: number;
  totalSent: number;
  totalDelivered: number;
  totalResponded: number;
  totalConverted: number;
  revenueGenerated: number;
  costIncurred: number;
  createdAt: string;
  _count: { members: number; doctorMembers: number };
}

const TYPE_LABELS: Record<string, string> = {
  DOCTOR_OUTREACH: "Doctor Outreach",
  CORPORATE_PROPOSAL: "Corporate Proposal",
  PATIENT_RECALL: "Patient Recall",
  HEALTH_CAMP: "Health Camp",
  PACKAGE_PROMO: "Package Promo",
  SEASONAL: "Seasonal",
  BIRTHDAY: "Birthday Offers",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  SCHEDULED: "bg-blue-100 text-blue-700",
  RUNNING: "bg-green-100 text-green-700",
  PAUSED: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-purple-100 text-purple-700",
};

const CAMPAIGN_TYPES = [
  { value: "DOCTOR_OUTREACH", label: "Doctor Outreach", desc: "Build referral relationships" },
  { value: "CORPORATE_PROPOSAL", label: "Corporate Proposal", desc: "Send package proposals to companies" },
  { value: "PATIENT_RECALL", label: "Patient Recall", desc: "Re-engage past patients" },
  { value: "SEASONAL", label: "Seasonal / Disease Awareness", desc: "Diabetes day, Heart month..." },
  { value: "BIRTHDAY", label: "Birthday Offers", desc: "Auto birthday health offers" },
  { value: "PACKAGE_PROMO", label: "Package Promotion", desc: "Promote health check packages" },
];

export default function CampaignsPage() {
  const qc = useQueryClient();
  const [typeFilter, setTypeFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: "", type: "", channel: "WHATSAPP", targetAudience: "PATIENTS",
    subject: "", messageTemplate: "",
  });

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ["marketing", "campaigns", typeFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (typeFilter) params.type = typeFilter;
      const res = await api.get("/marketing/campaigns", { params });
      return res.data?.data ?? res.data ?? [];
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      await api.post("/marketing/campaigns", form);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing", "campaigns"] });
      setShowCreate(false);
      setStep(1);
      setForm({ name: "", type: "", channel: "WHATSAPP", targetAudience: "PATIENTS", subject: "", messageTemplate: "" });
    },
  });

  const launchMut = useMutation({
    mutationFn: async (id: string) => { await api.post(`/marketing/campaigns/${id}/launch`); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marketing", "campaigns"] }),
  });

  const pauseMut = useMutation({
    mutationFn: async (id: string) => { await api.post(`/marketing/campaigns/${id}/pause`); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marketing", "campaigns"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Campaigns</h1>
          <p className="text-sm text-slate-500 mt-0.5">Create and manage marketing campaigns</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 flex items-center gap-2">
          <Plus className="h-4 w-4" />New Campaign
        </button>
      </div>

      {/* Type Tabs */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setTypeFilter("")}
          className={`text-xs px-3 py-1.5 rounded-full border ${!typeFilter ? "bg-blue-600 text-white border-blue-600" : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}>
          All
        </button>
        {Object.entries(TYPE_LABELS).map(([key, label]) => (
          <button key={key} onClick={() => setTypeFilter(key)}
            className={`text-xs px-3 py-1.5 rounded-full border ${typeFilter === key ? "bg-blue-600 text-white border-blue-600" : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Campaign Cards */}
      {isLoading ? (
        <div className="p-8 text-center text-slate-500">Loading...</div>
      ) : campaigns.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
          No campaigns yet. Create your first one!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {campaigns.map((c) => {
            const roi = Number(c.costIncurred) > 0 ? (Number(c.revenueGenerated) / Number(c.costIncurred)).toFixed(1) : "N/A";
            return (
              <div key={c.id} className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{c.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {TYPE_LABELS[c.type] ?? c.type} &middot; {c.channel} &middot; {c.targetAudience}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[c.status] ?? STATUS_COLORS.DRAFT}`}>
                    {c.status}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 mb-3 text-xs">
                  <div className="text-center">
                    <p className="font-bold text-slate-900">{c.totalSent}</p>
                    <p className="text-slate-500">Sent</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-slate-900">{c.totalDelivered}</p>
                    <p className="text-slate-500">Delivered</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-blue-600">{c.totalResponded}</p>
                    <p className="text-slate-500">Responded</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-emerald-600">{c.totalConverted}</p>
                    <p className="text-slate-500">Converted</p>
                  </div>
                </div>

                {Number(c.revenueGenerated) > 0 && (
                  <div className="text-xs text-slate-600 mb-3">
                    Revenue: <span className="font-semibold text-emerald-600">{formatCurrency(Number(c.revenueGenerated))}</span>
                    {roi !== "N/A" && <span> &middot; ROI: {roi}x</span>}
                  </div>
                )}

                <div className="flex gap-2">
                  {c.status === "DRAFT" && (
                    <button onClick={() => launchMut.mutate(c.id)}
                      className="flex-1 text-xs px-3 py-1.5 rounded bg-green-600 text-white hover:bg-green-700 flex items-center justify-center gap-1">
                      <Play className="h-3 w-3" />Launch
                    </button>
                  )}
                  {c.status === "RUNNING" && (
                    <button onClick={() => pauseMut.mutate(c.id)}
                      className="flex-1 text-xs px-3 py-1.5 rounded bg-amber-500 text-white hover:bg-amber-600 flex items-center justify-center gap-1">
                      <Pause className="h-3 w-3" />Pause
                    </button>
                  )}
                  {c.status === "PAUSED" && (
                    <button onClick={() => pauseMut.mutate(c.id)}
                      className="flex-1 text-xs px-3 py-1.5 rounded bg-green-600 text-white hover:bg-green-700 flex items-center justify-center gap-1">
                      <Play className="h-3 w-3" />Resume
                    </button>
                  )}
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Users className="h-3 w-3" />{c._count.members + c._count.doctorMembers} members
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Campaign Sheet */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end">
          <div className="w-full max-w-xl bg-white h-full overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-slate-900">New Campaign</h2>
              <button onClick={() => { setShowCreate(false); setStep(1); }} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>

            {/* Step 1: Type */}
            {step === 1 && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-slate-700 mb-2">What kind of campaign?</p>
                {CAMPAIGN_TYPES.map((ct) => (
                  <button key={ct.value} onClick={() => { setForm({ ...form, type: ct.value }); setStep(2); }}
                    className="w-full p-4 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-left">
                    <p className="text-sm font-semibold text-slate-900">{ct.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{ct.desc}</p>
                  </button>
                ))}
              </div>
            )}

            {/* Step 2: Details */}
            {step === 2 && (
              <div className="space-y-4">
                <p className="text-xs text-slate-500">Campaign type: {TYPE_LABELS[form.type]}</p>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Campaign Name *</label>
                  <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="e.g. Diabetes Awareness Nov 2026" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Channel</label>
                    <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                      <option value="WHATSAPP">WhatsApp</option>
                      <option value="SMS">SMS</option>
                      <option value="EMAIL">Email</option>
                      <option value="CALL">Call</option>
                      <option value="MIXED">Multi-channel</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Target Audience</label>
                    <select value={form.targetAudience} onChange={(e) => setForm({ ...form, targetAudience: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                      <option value="PATIENTS">Patients</option>
                      <option value="DOCTORS">Doctors</option>
                      <option value="CORPORATES">Corporates</option>
                      <option value="ALL">All</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
                  <input type="text" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Message Template</label>
                  <textarea rows={5} value={form.messageTemplate} onChange={(e) => setForm({ ...form, messageTemplate: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Use {name} for personalization..." />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setStep(1)} className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Back</button>
                  <button onClick={() => createMut.mutate()} disabled={!form.name || createMut.isPending}
                    className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                    {createMut.isPending ? "Creating..." : "Create Campaign"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
