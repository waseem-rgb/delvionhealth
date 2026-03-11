"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Megaphone,
  Plus,
  Trash2,
  Rocket,
  Copy,
  BarChart2,
  ChevronRight,
  ChevronLeft,
  X,
  Sparkles,
  Loader2,
  Calendar,
  Users,
  Send,
  Eye,
  TrendingUp,
  IndianRupee,
  Edit,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Campaign {
  id: string;
  name: string;
  type: string;
  status: string;
  totalRecipients: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  converted: number;
  revenue: number;
  scheduledAt: string | null;
  createdAt: string;
  messageBody: string;
  subject: string | null;
}

interface CampaignStats {
  total: number;
  active: number;
  totalReached: number;
  totalRevenue: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN").format(Math.round(n));

const TYPE_COLORS: Record<string, string> = {
  SMS: "bg-blue-900/50 text-blue-400 border border-blue-800",
  WHATSAPP: "bg-green-900/50 text-green-400 border border-green-800",
  EMAIL: "bg-orange-900/50 text-orange-400 border border-orange-800",
  SOCIAL: "bg-purple-900/50 text-purple-400 border border-purple-800",
  MULTI_CHANNEL: "bg-violet-900/50 text-violet-400 border border-violet-800",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-200/60 text-slate-700",
  SCHEDULED: "bg-blue-900/50 text-blue-400",
  RUNNING: "bg-emerald-900/50 text-emerald-400",
  PAUSED: "bg-amber-900/50 text-amber-400",
  COMPLETED: "bg-teal-900/50 text-teal-400",
  FAILED: "bg-red-900/50 text-red-400",
};

const FILTER_TABS = ["All", "SMS", "WhatsApp", "Email", "Social", "Multi-Channel"];
const TYPE_MAP: Record<string, string> = {
  WhatsApp: "WHATSAPP",
  "Multi-Channel": "MULTI_CHANNEL",
};

function formatDate(d: string | null): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─── Campaign Card ────────────────────────────────────────────────────────────

function CampaignCard({
  campaign,
  onDelete,
  onLaunch,
}: {
  campaign: Campaign;
  onDelete: (id: string) => void;
  onLaunch: (id: string) => void;
}) {
  const sentPct =
    campaign.totalRecipients > 0
      ? Math.min(100, (campaign.sent / campaign.totalRecipients) * 100)
      : 0;
  const openedPct =
    campaign.sent > 0 ? ((campaign.opened / campaign.sent) * 100).toFixed(1) : "0";

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 hover:border-slate-300 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-slate-900 font-semibold truncate">{campaign.name}</h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                TYPE_COLORS[campaign.type] ?? "bg-slate-200 text-slate-700"
              }`}
            >
              {campaign.type.replace("_", " ")}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                STATUS_COLORS[campaign.status] ?? "bg-slate-200 text-slate-700"
              }`}
            >
              {campaign.status}
            </span>
          </div>
        </div>
      </div>

      {/* Recipients */}
      <div className="flex items-center gap-1 text-slate-500 text-xs">
        <Users className="h-3 w-3" />
        <span>{fmt(campaign.totalRecipients)} recipients</span>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-slate-500">
          <span>Sent progress</span>
          <span>{sentPct.toFixed(0)}%</span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-teal-600 to-emerald-500 rounded-full transition-all"
            style={{ width: `${sentPct}%` }}
          />
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <div>
          <div className="flex items-center justify-center gap-1 text-slate-500 text-xs mb-0.5">
            <Send className="h-3 w-3" />
          </div>
          <p className="text-slate-900 text-xs font-medium">{fmt(campaign.sent)}</p>
          <p className="text-slate-500 text-xs">Sent</p>
        </div>
        <div>
          <div className="flex items-center justify-center gap-1 text-slate-500 text-xs mb-0.5">
            <Eye className="h-3 w-3" />
          </div>
          <p className="text-slate-900 text-xs font-medium">{openedPct}%</p>
          <p className="text-slate-500 text-xs">Opened</p>
        </div>
        <div>
          <div className="flex items-center justify-center gap-1 text-slate-500 text-xs mb-0.5">
            <TrendingUp className="h-3 w-3" />
          </div>
          <p className="text-slate-900 text-xs font-medium">{fmt(campaign.converted)}</p>
          <p className="text-slate-500 text-xs">Conv.</p>
        </div>
        <div>
          <div className="flex items-center justify-center gap-1 text-slate-500 text-xs mb-0.5">
            <IndianRupee className="h-3 w-3" />
          </div>
          <p className="text-emerald-400 text-xs font-medium">{fmt(campaign.revenue)}</p>
          <p className="text-slate-500 text-xs">Rev.</p>
        </div>
      </div>

      {/* Date */}
      <p className="text-slate-500 text-xs">
        {campaign.scheduledAt
          ? campaign.status === "COMPLETED"
            ? `Sent on ${formatDate(campaign.scheduledAt)}`
            : `Scheduled for ${formatDate(campaign.scheduledAt)}`
          : `Created ${formatDate(campaign.createdAt)}`}
      </p>

      {/* Actions */}
      <div className="flex items-center gap-1.5 pt-2 border-t border-slate-200 flex-wrap">
        <button className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs transition-colors">
          <BarChart2 className="h-3 w-3" />
          Report
        </button>
        <button className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs transition-colors">
          <Copy className="h-3 w-3" />
          Duplicate
        </button>
        <button className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs transition-colors">
          <Edit className="h-3 w-3" />
          Edit
        </button>
        {campaign.status === "DRAFT" && (
          <button
            onClick={() => onLaunch(campaign.id)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-900/50 hover:bg-emerald-800/60 text-emerald-400 rounded-lg text-xs transition-colors"
          >
            <Rocket className="h-3 w-3" />
            Launch
          </button>
        )}
        <button
          onClick={() => onDelete(campaign.id)}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg text-xs transition-colors ml-auto"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Wizard ───────────────────────────────────────────────────────────────────

interface WizardData {
  name: string;
  type: string;
  goal: string;
  audience: string;
  ageMin: string;
  ageMax: string;
  gender: string;
  lastVisitDays: string;
  smsBody: string;
  waBody: string;
  waImageUrl: string;
  waCtaText: string;
  waCtaUrl: string;
  emailSubject: string;
  emailBody: string;
  socialCaption: string;
  socialImageUrl: string;
  scheduleMode: string;
  scheduledAt: string;
  aiSchedule: string;
}

const EMPTY_WIZARD: WizardData = {
  name: "",
  type: "SMS",
  goal: "AWARENESS",
  audience: "ALL",
  ageMin: "",
  ageMax: "",
  gender: "",
  lastVisitDays: "",
  smsBody: "",
  waBody: "",
  waImageUrl: "",
  waCtaText: "",
  waCtaUrl: "",
  emailSubject: "",
  emailBody: "",
  socialCaption: "",
  socialImageUrl: "",
  scheduleMode: "NOW",
  scheduledAt: "",
  aiSchedule: "",
};

const CAMPAIGN_TYPES = [
  { value: "SMS", label: "SMS", icon: "📱" },
  { value: "WHATSAPP", label: "WhatsApp", icon: "💬" },
  { value: "EMAIL", label: "Email", icon: "📧" },
  { value: "SOCIAL", label: "Social", icon: "📲" },
  { value: "MULTI_CHANNEL", label: "Multi-Channel", icon: "🔀" },
];

const GOALS = [
  { value: "AWARENESS", label: "Brand Awareness" },
  { value: "APPOINTMENT", label: "Book Appointment" },
  { value: "RECALL", label: "Patient Recall" },
  { value: "OFFER", label: "Promote Offer" },
  { value: "FOLLOWUP", label: "Follow-up" },
];

function NewCampaignWizard({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>(EMPTY_WIZARD);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [scheduleAiLoading, setScheduleAiLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const set = (field: keyof WizardData, value: string) =>
    setData((prev) => ({ ...prev, [field]: value }));

  const audienceCount =
    data.audience === "ALL"
      ? "~all patients"
      : data.audience === "SEGMENT"
      ? "~targeted segment"
      : "~custom list";

  async function generateAI() {
    setAiLoading(true);
    try {
      const res = await api.post("/revenue-crm/ai/generate-content", {
        channels: [data.type],
        goal: data.goal,
        userDescription: aiPrompt,
      });
      const d = res.data?.data ?? res.data;
      if (data.type === "SMS" && d.sms) set("smsBody", d.sms);
      if (data.type === "WHATSAPP" && d.whatsapp) set("waBody", d.whatsapp);
      if (data.type === "EMAIL") {
        if (d.emailSubject) set("emailSubject", d.emailSubject);
        if (d.emailBody) set("emailBody", d.emailBody);
      }
      if (data.type === "SOCIAL" && d.social) set("socialCaption", d.social);
      toast.success("AI content generated!");
    } catch {
      toast.error("Failed to generate AI content");
    } finally {
      setAiLoading(false);
    }
  }

  async function getSmartSchedule() {
    setScheduleAiLoading(true);
    try {
      const res = await api.post("/revenue-crm/ai/best-schedule-time", {
        campaignType: data.type,
        goal: data.goal,
        audience: data.audience,
      });
      const d = res.data?.data ?? res.data;
      set("aiSchedule", d.recommendation ?? d.time ?? JSON.stringify(d));
      toast.success("AI schedule recommendation ready!");
    } catch {
      toast.error("Failed to get AI schedule");
    } finally {
      setScheduleAiLoading(false);
    }
  }

  async function submitDraft(launch = false, schedule = false) {
    if (!data.name.trim()) {
      toast.error("Campaign name is required");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: data.name,
        type: data.type,
        goal: data.goal,
        audience: data.audience,
        messageBody:
          data.type === "SMS"
            ? data.smsBody
            : data.type === "WHATSAPP"
            ? data.waBody
            : data.type === "EMAIL"
            ? data.emailBody
            : data.socialCaption,
        subject: data.type === "EMAIL" ? data.emailSubject : undefined,
        scheduledAt:
          schedule && data.scheduledAt ? data.scheduledAt : undefined,
        launch,
      };
      await api.post("/revenue-crm/campaigns", payload);
      toast.success(
        launch
          ? "Campaign launched!"
          : schedule
          ? "Campaign scheduled!"
          : "Campaign saved as draft!"
      );
      onCreated();
      onClose();
    } catch {
      toast.error("Failed to create campaign");
    } finally {
      setSubmitting(false);
    }
  }

  const STEP_LABELS = ["Basics", "Audience", "Content", "Schedule", "Review"];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-50 border border-slate-200 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div>
            <h2 className="text-slate-900 font-semibold text-lg">New Campaign</h2>
            <p className="text-slate-500 text-sm mt-0.5">
              Step {step} of 5 — {STEP_LABELS[step - 1]}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-0 px-6 pt-4">
          {STEP_LABELS.map((label, i) => (
            <div key={label} className="flex items-center flex-1">
              <div
                className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors ${
                  i + 1 < step
                    ? "bg-teal-600 text-white"
                    : i + 1 === step
                    ? "bg-teal-500 text-white ring-2 ring-teal-400/40"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {i + 1 < step ? "✓" : i + 1}
              </div>
              {i < 4 && (
                <div
                  className={`flex-1 h-0.5 ${
                    i + 1 < step ? "bg-teal-600" : "bg-slate-100"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* ── Step 1: Basics ── */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className="block text-slate-700 text-sm font-medium mb-1.5">
                  Campaign Name *
                </label>
                <input
                  value={data.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="e.g. Diwali Health Checkup Offer"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-slate-700 text-sm font-medium mb-2">
                  Campaign Type
                </label>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {CAMPAIGN_TYPES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => set("type", t.value)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all ${
                        data.type === t.value
                          ? "border-teal-500 bg-teal-900/30 text-teal-300"
                          : "border-slate-300 bg-white text-slate-500 hover:border-slate-600"
                      }`}
                    >
                      <span className="text-xl">{t.icon}</span>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-slate-700 text-sm font-medium mb-2">
                  Campaign Goal
                </label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {GOALS.map((g) => (
                    <button
                      key={g.value}
                      onClick={() => set("goal", g.value)}
                      className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all text-left ${
                        data.goal === g.value
                          ? "border-teal-500 bg-teal-900/30 text-teal-300"
                          : "border-slate-300 bg-white text-slate-500 hover:border-slate-600"
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Audience ── */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-slate-500 text-sm">Select your target audience</p>
              {[
                { value: "ALL", label: "All Patients", desc: "Send to your entire patient database" },
                { value: "SEGMENT", label: "Segment", desc: "Target a specific patient segment" },
                { value: "LEAD_LIST", label: "Lead List", desc: "Target imported marketing leads" },
                { value: "REPEAT", label: "Repeat Candidates", desc: "Patients eligible for repeat visits" },
                { value: "CUSTOM", label: "Custom Filter", desc: "Define filters manually" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => set("audience", opt.value)}
                  className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                    data.audience === opt.value
                      ? "border-teal-500 bg-teal-900/20"
                      : "border-slate-300 bg-white hover:border-slate-600"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full border-2 mt-0.5 flex-shrink-0 ${
                      data.audience === opt.value
                        ? "border-teal-500 bg-teal-500"
                        : "border-slate-600"
                    }`}
                  />
                  <div>
                    <p
                      className={`text-sm font-medium ${
                        data.audience === opt.value ? "text-teal-300" : "text-slate-700"
                      }`}
                    >
                      {opt.label}
                    </p>
                    <p className="text-slate-500 text-xs">{opt.desc}</p>
                  </div>
                </button>
              ))}
              {data.audience === "CUSTOM" && (
                <div className="bg-white border border-slate-300 rounded-xl p-4 space-y-3">
                  <p className="text-slate-700 text-sm font-medium">Custom Filters</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-500 text-xs mb-1 block">Min Age</label>
                      <input
                        value={data.ageMin}
                        onChange={(e) => set("ageMin", e.target.value)}
                        type="number"
                        placeholder="18"
                        className="w-full bg-slate-100 border border-slate-300 rounded-lg px-3 py-1.5 text-slate-900 text-sm focus:outline-none focus:border-teal-500"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 text-xs mb-1 block">Max Age</label>
                      <input
                        value={data.ageMax}
                        onChange={(e) => set("ageMax", e.target.value)}
                        type="number"
                        placeholder="65"
                        className="w-full bg-slate-100 border border-slate-300 rounded-lg px-3 py-1.5 text-slate-900 text-sm focus:outline-none focus:border-teal-500"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 text-xs mb-1 block">Gender</label>
                      <select
                        value={data.gender}
                        onChange={(e) => set("gender", e.target.value)}
                        className="w-full bg-slate-100 border border-slate-300 rounded-lg px-3 py-1.5 text-slate-900 text-sm focus:outline-none focus:border-teal-500"
                      >
                        <option value="">Any</option>
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-500 text-xs mb-1 block">
                        Last Visit (within days)
                      </label>
                      <input
                        value={data.lastVisitDays}
                        onChange={(e) => set("lastVisitDays", e.target.value)}
                        type="number"
                        placeholder="90"
                        className="w-full bg-slate-100 border border-slate-300 rounded-lg px-3 py-1.5 text-slate-900 text-sm focus:outline-none focus:border-teal-500"
                      />
                    </div>
                  </div>
                </div>
              )}
              <div className="bg-teal-900/20 border border-teal-800/40 rounded-xl p-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-teal-400 flex-shrink-0" />
                <p className="text-teal-300 text-sm">
                  <span className="font-semibold">{audienceCount}</span> match your selection
                </p>
              </div>
            </div>
          )}

          {/* ── Step 3: Content ── */}
          {step === 3 && (
            <div className="space-y-4">
              {/* AI Generator */}
              <div className="bg-purple-950/40 border border-purple-800/50 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-400" />
                  <p className="text-purple-300 font-medium text-sm">AI Content Generator</p>
                </div>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  rows={2}
                  placeholder="Describe your campaign message... e.g. 'Monsoon health checkup offer, 20% discount'"
                  className="w-full bg-purple-950/60 border border-purple-800/40 rounded-lg px-3 py-2 text-slate-900 placeholder-purple-400/60 focus:outline-none focus:border-purple-500 text-sm resize-none"
                />
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {CAMPAIGN_TYPES.map((t) => (
                    <span
                      key={t.value}
                      className={`px-2 py-0.5 rounded-full text-xs border ${
                        data.type === t.value
                          ? "bg-purple-800/50 border-purple-600 text-purple-300"
                          : "border-slate-300 text-slate-500"
                      }`}
                    >
                      {t.label}
                    </span>
                  ))}
                </div>
                <button
                  onClick={generateAI}
                  disabled={aiLoading || !aiPrompt.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {aiLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {aiLoading ? "Generating..." : "Generate with AI"}
                </button>
              </div>

              {/* Channel-specific fields */}
              {data.type === "SMS" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-slate-700 text-sm font-medium">SMS Message</label>
                    <span
                      className={`text-xs ${
                        data.smsBody.length > 160 ? "text-red-400" : "text-slate-500"
                      }`}
                    >
                      {data.smsBody.length}/160
                    </span>
                  </div>
                  <textarea
                    value={data.smsBody}
                    onChange={(e) => set("smsBody", e.target.value)}
                    rows={4}
                    placeholder="Enter your SMS message..."
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm resize-none"
                  />
                </div>
              )}

              {data.type === "WHATSAPP" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-slate-700 text-sm font-medium mb-1.5 block">
                      WhatsApp Message
                    </label>
                    <textarea
                      value={data.waBody}
                      onChange={(e) => set("waBody", e.target.value)}
                      rows={4}
                      placeholder="Enter your WhatsApp message..."
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-700 text-sm font-medium mb-1.5 block">
                      Image URL (optional)
                    </label>
                    <input
                      value={data.waImageUrl}
                      onChange={(e) => set("waImageUrl", e.target.value)}
                      placeholder="https://..."
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-700 text-sm font-medium mb-1.5 block">
                        CTA Button Text
                      </label>
                      <input
                        value={data.waCtaText}
                        onChange={(e) => set("waCtaText", e.target.value)}
                        placeholder="Book Now"
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-slate-700 text-sm font-medium mb-1.5 block">
                        CTA URL
                      </label>
                      <input
                        value={data.waCtaUrl}
                        onChange={(e) => set("waCtaUrl", e.target.value)}
                        placeholder="https://..."
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}

              {data.type === "EMAIL" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-slate-700 text-sm font-medium mb-1.5 block">
                      Subject Line
                    </label>
                    <input
                      value={data.emailSubject}
                      onChange={(e) => set("emailSubject", e.target.value)}
                      placeholder="Enter email subject..."
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-slate-700 text-sm font-medium mb-1.5 block">
                      Email Body
                    </label>
                    <textarea
                      value={data.emailBody}
                      onChange={(e) => set("emailBody", e.target.value)}
                      rows={6}
                      placeholder="Enter your email content..."
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm resize-none"
                    />
                  </div>
                </div>
              )}

              {(data.type === "SOCIAL" || data.type === "MULTI_CHANNEL") && (
                <div className="space-y-3">
                  <div>
                    <label className="text-slate-700 text-sm font-medium mb-1.5 block">
                      Caption / Message
                    </label>
                    <textarea
                      value={data.socialCaption}
                      onChange={(e) => set("socialCaption", e.target.value)}
                      rows={4}
                      placeholder="Enter your social media caption..."
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-700 text-sm font-medium mb-1.5 block">
                      Image URL (optional)
                    </label>
                    <input
                      value={data.socialImageUrl}
                      onChange={(e) => set("socialImageUrl", e.target.value)}
                      placeholder="https://..."
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 4: Schedule ── */}
          {step === 4 && (
            <div className="space-y-4">
              {[
                { value: "NOW", label: "Send Now", desc: "Launch immediately after creation" },
                { value: "LATER", label: "Schedule for Later", desc: "Pick a specific date and time" },
                {
                  value: "SMART",
                  label: "Smart Schedule",
                  desc: "Let AI recommend the best time to send",
                },
              ].map((opt) => (
                <div key={opt.value}>
                  <button
                    onClick={() => set("scheduleMode", opt.value)}
                    className={`w-full flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${
                      data.scheduleMode === opt.value
                        ? "border-teal-500 bg-teal-900/20"
                        : "border-slate-300 bg-white hover:border-slate-600"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full border-2 mt-0.5 flex-shrink-0 ${
                        data.scheduleMode === opt.value
                          ? "border-teal-500 bg-teal-500"
                          : "border-slate-600"
                      }`}
                    />
                    <div>
                      <p
                        className={`text-sm font-medium ${
                          data.scheduleMode === opt.value ? "text-teal-300" : "text-slate-700"
                        }`}
                      >
                        {opt.label}
                      </p>
                      <p className="text-slate-500 text-xs mt-0.5">{opt.desc}</p>
                    </div>
                  </button>
                  {opt.value === "LATER" && data.scheduleMode === "LATER" && (
                    <div className="mt-2 px-2">
                      <input
                        type="datetime-local"
                        value={data.scheduledAt}
                        onChange={(e) => set("scheduledAt", e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-teal-500 text-sm"
                      />
                    </div>
                  )}
                  {opt.value === "SMART" && data.scheduleMode === "SMART" && (
                    <div className="mt-2 px-2 space-y-2">
                      <button
                        onClick={getSmartSchedule}
                        disabled={scheduleAiLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        {scheduleAiLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        {scheduleAiLoading ? "Analyzing..." : "Get AI Recommendation"}
                      </button>
                      {data.aiSchedule && (
                        <div className="bg-indigo-950/40 border border-indigo-800/50 rounded-xl p-3">
                          <p className="text-indigo-300 text-xs font-medium mb-1">
                            AI Recommendation
                          </p>
                          <p className="text-slate-700 text-sm">{data.aiSchedule}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Step 5: Review ── */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-300 rounded-xl p-4 space-y-3">
                <p className="text-slate-900 font-medium text-sm">Campaign Summary</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-slate-500 text-xs">Name</p>
                    <p className="text-slate-200 mt-0.5">{data.name || "—"}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Type</p>
                    <p className="text-slate-200 mt-0.5">{data.type}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Goal</p>
                    <p className="text-slate-200 mt-0.5">
                      {GOALS.find((g) => g.value === data.goal)?.label ?? data.goal}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Audience</p>
                    <p className="text-slate-200 mt-0.5">{data.audience}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Schedule</p>
                    <p className="text-slate-200 mt-0.5">
                      {data.scheduleMode === "NOW"
                        ? "Send Now"
                        : data.scheduleMode === "LATER" && data.scheduledAt
                        ? formatDate(data.scheduledAt)
                        : "Smart Schedule"}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Estimated Reach</p>
                    <p className="text-teal-400 font-medium mt-0.5">{audienceCount}</p>
                  </div>
                </div>
                {(data.smsBody || data.waBody || data.emailBody || data.socialCaption) && (
                  <div className="pt-2 border-t border-slate-200">
                    <p className="text-slate-500 text-xs mb-1">Message Preview</p>
                    <p className="text-slate-700 text-sm line-clamp-3">
                      {data.smsBody || data.waBody || data.emailBody || data.socialCaption}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-slate-200 gap-3">
          <button
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 rounded-lg text-sm transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>

          {step < 5 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => submitDraft(false, false)}
                disabled={submitting}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-lg text-sm transition-colors"
              >
                Save Draft
              </button>
              <button
                onClick={() => submitDraft(false, true)}
                disabled={submitting || !data.scheduledAt}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Calendar className="h-4 w-4" />
                Schedule
              </button>
              <button
                onClick={() => submitDraft(true, false)}
                disabled={submitting}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Rocket className="h-4 w-4" />
                )}
                Launch Now
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CampaignsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("All");
  const [showWizard, setShowWizard] = useState(false);

  const typeFilter =
    activeTab === "All"
      ? undefined
      : TYPE_MAP[activeTab] ?? activeTab.toUpperCase();

  const { data: stats, isLoading: statsLoading } = useQuery<CampaignStats>({
    queryKey: ["crm-campaign-stats"],
    queryFn: async () => {
      const res = await api.get("/revenue-crm/campaigns/stats");
      return res.data?.data ?? res.data;
    },
    retry: 1,
    staleTime: 30000,
  });

  const { data: campaigns, isLoading, error } = useQuery<Campaign[]>({
    queryKey: ["crm-campaigns", typeFilter],
    queryFn: async () => {
      const params = typeFilter ? `?type=${typeFilter}` : "";
      const res = await api.get(`/revenue-crm/campaigns${params}`);
      const d = res.data?.data ?? res.data;
      return (Array.isArray(d) ? d : d?.data ?? d?.items ?? []) as Campaign[];
    },
    retry: 1,
    staleTime: 30000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/revenue-crm/campaigns/${id}`),
    onSuccess: () => {
      toast.success("Campaign deleted");
      queryClient.invalidateQueries({ queryKey: ["crm-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["crm-campaign-stats"] });
    },
    onError: () => toast.error("Failed to delete campaign"),
  });

  const launchMutation = useMutation({
    mutationFn: (id: string) => api.post(`/revenue-crm/campaigns/${id}/launch`),
    onSuccess: () => {
      toast.success("Campaign launched!");
      queryClient.invalidateQueries({ queryKey: ["crm-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["crm-campaign-stats"] });
    },
    onError: () => toast.error("Failed to launch campaign"),
  });

  const statCards = [
    {
      label: "Total Campaigns",
      value: stats?.total ?? 0,
      icon: Megaphone,
      color: "text-teal-400",
    },
    {
      label: "Active Now",
      value: stats?.active ?? 0,
      icon: Rocket,
      color: "text-emerald-400",
    },
    {
      label: "Total Reached",
      value: stats?.totalReached ?? 0,
      icon: Users,
      color: "text-blue-400",
    },
    {
      label: "Revenue Attributed",
      value: `₹${fmt(stats?.totalRevenue ?? 0)}`,
      icon: IndianRupee,
      color: "text-amber-400",
      raw: true,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">
      {showWizard && (
        <NewCampaignWizard
          onClose={() => setShowWizard(false)}
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ["crm-campaigns"] });
            queryClient.invalidateQueries({ queryKey: ["crm-campaign-stats"] });
          }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-teal-400" />
            Digital Campaigns
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            SMS, WhatsApp, Email &amp; Social campaigns with ROI tracking
          </p>
        </div>
        <button
          onClick={() => setShowWizard(true)}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Campaign
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div
            key={s.label}
            className="bg-white border border-slate-200 rounded-xl p-4 space-y-2"
          >
            {statsLoading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-4 w-20 bg-slate-100 rounded" />
                <div className="h-7 w-16 bg-slate-100 rounded" />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                  <p className="text-slate-500 text-xs">{s.label}</p>
                </div>
                <p className={`text-2xl font-bold ${s.color}`}>
                  {s.raw ? s.value : fmt(Number(s.value))}
                </p>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 flex-wrap">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab
                ? "bg-teal-600 text-white"
                : "bg-white text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 text-red-400 text-sm">
          Failed to load campaigns. Please try again.
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-white border border-slate-200 rounded-xl p-5 animate-pulse h-64"
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && (!campaigns || campaigns.length === 0) && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 bg-white border border-slate-200 rounded-full flex items-center justify-center mb-4">
            <Rocket className="h-10 w-10 text-slate-600" />
          </div>
          <h3 className="text-slate-900 font-semibold text-lg mb-1">No campaigns yet</h3>
          <p className="text-slate-500 text-sm mb-6">
            Create your first campaign to reach patients and drive appointments
          </p>
          <button
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Campaign
          </button>
        </div>
      )}

      {/* Grid */}
      {!isLoading && campaigns && campaigns.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((c) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              onDelete={(id) => deleteMutation.mutate(id)}
              onLaunch={(id) => launchMutation.mutate(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
