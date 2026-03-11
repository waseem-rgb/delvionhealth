"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LayoutGrid,
  List,
  Plus,
  X,
  Sparkles,
  Loader2,
  Trash2,
  Clock,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Calendar,
  Hash,
  Heart,
  MessageCircle,
  Eye,
  Instagram,
  Facebook,
  Mail,
  Edit,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ContentItem {
  id: string;
  title: string;
  type: string;
  channel: string[];
  content: string;
  imageUrl: string | null;
  hashtags: string[];
  isAiGenerated: boolean;
  scheduledAt: string | null;
  publishedAt: string | null;
  status: string;
  engagements: {
    likes?: number;
    shares?: number;
    comments?: number;
    reach?: number;
  };
  createdAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(d: string | null): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-200/60 text-slate-700",
  SCHEDULED: "bg-blue-900/50 text-blue-400",
  PUBLISHED: "bg-green-900/50 text-green-400",
  FAILED: "bg-red-900/50 text-red-400",
};

const CHANNEL_COLORS: Record<string, string> = {
  INSTAGRAM: "bg-pink-900/50 text-pink-400",
  FACEBOOK: "bg-blue-900/50 text-blue-400",
  WHATSAPP: "bg-green-900/50 text-green-400",
  EMAIL: "bg-orange-900/50 text-orange-400",
  SMS: "bg-slate-200/60 text-slate-700",
};

const FILTER_CHANNELS = ["All", "Instagram", "Facebook", "WhatsApp", "Email", "SMS"];

const CONTENT_TYPES = [
  { value: "INSTAGRAM_POST", label: "Instagram Post", icon: "📱" },
  { value: "INSTAGRAM_STORY", label: "Instagram Story", icon: "📱" },
  { value: "INSTAGRAM_REEL", label: "Instagram Reel", icon: "🎬" },
  { value: "FACEBOOK_POST", label: "Facebook Post", icon: "👥" },
  { value: "WHATSAPP_STATUS", label: "WhatsApp Status", icon: "📲" },
  { value: "WHATSAPP_MESSAGE", label: "WhatsApp Message", icon: "💬" },
  { value: "EMAIL_TEMPLATE", label: "Email Template", icon: "📧" },
  { value: "SMS_TEMPLATE", label: "SMS Template", icon: "📩" },
  { value: "HEALTH_TIP", label: "Health Tip", icon: "🏥" },
  { value: "FESTIVAL_POST", label: "Festival Post", icon: "🎉" },
  { value: "OFFER_CARD", label: "Offer Card", icon: "💊" },
  { value: "HEALTH_REPORT_CARD", label: "Health Report Card", icon: "📊" },
];

function typeLabel(type: string): string {
  return CONTENT_TYPES.find((t) => t.value === type)?.label ?? type.replace(/_/g, " ");
}

function ChannelIcon({ channel }: { channel: string }) {
  const cls = "h-3 w-3";
  if (channel === "INSTAGRAM") return <Instagram className={cls} />;
  if (channel === "FACEBOOK") return <Facebook className={cls} />;
  if (channel === "EMAIL") return <Mail className={cls} />;
  return <span className="text-xs">{channel[0]}</span>;
}

// ─── Content Card ─────────────────────────────────────────────────────────────

function ContentCard({
  item,
  onDelete,
  onSchedule,
}: {
  item: ContentItem;
  onDelete: (id: string) => void;
  onSchedule: (id: string) => void;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 transition-colors">
      {/* Thumbnail */}
      <div className="h-32 bg-slate-100 flex items-center justify-center relative overflow-hidden">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-600">
            <ImageIcon className="h-8 w-8" />
            <span className="text-xs">{typeLabel(item.type)}</span>
          </div>
        )}
        {item.isAiGenerated && (
          <div className="absolute top-2 right-2 bg-purple-900/80 border border-purple-700 rounded-full px-2 py-0.5 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-purple-400" />
            <span className="text-purple-300 text-xs">AI</span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* Type badge + title */}
        <div>
          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
            {typeLabel(item.type)}
          </span>
          <h3 className="text-slate-900 text-sm font-medium mt-1.5 leading-snug">{item.title}</h3>
          <p className="text-slate-500 text-xs mt-1 line-clamp-2">
            {item.content.slice(0, 80)}
            {item.content.length > 80 ? "…" : ""}
          </p>
        </div>

        {/* Channels */}
        <div className="flex flex-wrap gap-1">
          {item.channel.map((ch) => (
            <span
              key={ch}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs ${
                CHANNEL_COLORS[ch] ?? "bg-slate-200 text-slate-700"
              }`}
            >
              <ChannelIcon channel={ch} />
              {ch}
            </span>
          ))}
        </div>

        {/* Status + Date */}
        <div className="flex items-center justify-between">
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              STATUS_STYLES[item.status] ?? "bg-slate-200 text-slate-700"
            }`}
          >
            {item.status}
          </span>
          <span className="text-slate-500 text-xs">
            {item.publishedAt
              ? `Published ${formatDate(item.publishedAt)}`
              : item.scheduledAt
              ? `Scheduled ${formatDate(item.scheduledAt)}`
              : `Created ${formatDate(item.createdAt)}`}
          </span>
        </div>

        {/* Hashtags */}
        {item.hashtags.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            <Hash className="h-3 w-3 text-slate-600" />
            {item.hashtags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-teal-500 text-xs">
                #{tag}
              </span>
            ))}
            {item.hashtags.length > 3 && (
              <span className="text-slate-500 text-xs">+{item.hashtags.length - 3}</span>
            )}
          </div>
        )}

        {/* Engagements if published */}
        {item.status === "PUBLISHED" && (
          <div className="flex items-center gap-3 text-xs text-slate-500">
            {item.engagements.likes !== undefined && (
              <span className="flex items-center gap-1">
                <Heart className="h-3 w-3 text-red-400" />
                {item.engagements.likes}
              </span>
            )}
            {item.engagements.comments !== undefined && (
              <span className="flex items-center gap-1">
                <MessageCircle className="h-3 w-3 text-blue-400" />
                {item.engagements.comments}
              </span>
            )}
            {item.engagements.reach !== undefined && (
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3 text-teal-400" />
                {item.engagements.reach}
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1.5 pt-2 border-t border-slate-200">
          <button className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs transition-colors">
            <Edit className="h-3 w-3" />
            Edit
          </button>
          {item.status === "DRAFT" && (
            <button
              onClick={() => onSchedule(item.id)}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-900/40 hover:bg-blue-900/60 text-blue-400 rounded-lg text-xs transition-colors"
            >
              <Calendar className="h-3 w-3" />
              Schedule
            </button>
          )}
          <button
            onClick={() => onDelete(item.id)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg text-xs transition-colors ml-auto"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── List Row ─────────────────────────────────────────────────────────────────

function ContentRow({
  item,
  onDelete,
  onSchedule,
}: {
  item: ContentItem;
  onDelete: (id: string) => void;
  onSchedule: (id: string) => void;
}) {
  return (
    <tr className="border-b border-slate-200 hover:bg-white transition-colors">
      <td className="px-4 py-3">
        <div>
          <p className="text-slate-900 text-sm font-medium">{item.title}</p>
          <p className="text-slate-500 text-xs truncate max-w-xs">
            {item.content.slice(0, 60)}…
          </p>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="text-slate-500 text-xs bg-slate-100 px-2 py-0.5 rounded-full">
          {typeLabel(item.type)}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {item.channel.map((ch) => (
            <span
              key={ch}
              className={`px-1.5 py-0.5 rounded-full text-xs ${
                CHANNEL_COLORS[ch] ?? "bg-slate-200 text-slate-700"
              }`}
            >
              {ch}
            </span>
          ))}
        </div>
      </td>
      <td className="px-4 py-3">
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
            STATUS_STYLES[item.status] ?? "bg-slate-200 text-slate-700"
          }`}
        >
          {item.status}
        </span>
      </td>
      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
        {item.publishedAt
          ? formatDate(item.publishedAt)
          : item.scheduledAt
          ? formatDate(item.scheduledAt)
          : formatDate(item.createdAt)}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <button className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
            <Edit className="h-3.5 w-3.5" />
          </button>
          {item.status === "DRAFT" && (
            <button
              onClick={() => onSchedule(item.id)}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-blue-400 transition-colors"
            >
              <Calendar className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={() => onDelete(item.id)}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-red-400 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Create Modal ─────────────────────────────────────────────────────────────

interface CreateData {
  type: string;
  title: string;
  instagramCaption: string;
  instagramHashtags: string;
  facebookText: string;
  whatsappMessage: string;
  emailSubject: string;
  emailBody: string;
  smsMessage: string;
  imageUrl: string;
  scheduledAt: string;
  channels: string[];
}

const EMPTY_CREATE: CreateData = {
  type: "",
  title: "",
  instagramCaption: "",
  instagramHashtags: "",
  facebookText: "",
  whatsappMessage: "",
  emailSubject: "",
  emailBody: "",
  smsMessage: "",
  imageUrl: "",
  scheduledAt: "",
  channels: [],
};

const AUDIENCE_OPTS = ["Patients", "Doctors", "Corporate", "General"];
const TONE_OPTS = ["Professional", "Friendly", "Urgent", "Informative"];

function CreateContentModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [modalStep, setModalStep] = useState<1 | 2>(1);
  const [formData, setFormData] = useState<CreateData>(EMPTY_CREATE);
  const [brief, setBrief] = useState("");
  const [audience, setAudience] = useState("Patients");
  const [tone, setTone] = useState("Friendly");
  const [aiLoading, setAiLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const setField = (field: keyof CreateData, value: string | string[]) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const toggleChannel = (ch: string) => {
    setFormData((prev) => ({
      ...prev,
      channels: prev.channels.includes(ch)
        ? prev.channels.filter((c) => c !== ch)
        : [...prev.channels, ch],
    }));
  };

  async function generateAll() {
    if (!brief.trim()) {
      toast.error("Please describe what this content is about");
      return;
    }
    setAiLoading(true);
    try {
      const res = await api.post("/revenue-crm/ai/generate-content-multi", {
        brief,
        audience,
        tone,
        formats: [
          "instagramPost",
          "facebookPost",
          "whatsappMessage",
          "emailSubject",
          "emailBody",
          "smsMessage",
        ],
      });
      const d = res.data?.data ?? res.data;
      if (d.instagramPost) setField("instagramCaption", d.instagramPost);
      if (d.facebookPost) setField("facebookText", d.facebookPost);
      if (d.whatsappMessage) setField("whatsappMessage", d.whatsappMessage);
      if (d.emailSubject) setField("emailSubject", d.emailSubject);
      if (d.emailBody) setField("emailBody", d.emailBody);
      if (d.smsMessage) setField("smsMessage", d.smsMessage);
      if (d.hashtags) setField("instagramHashtags", Array.isArray(d.hashtags) ? d.hashtags.join(" ") : d.hashtags);
      toast.success("All formats generated!");
    } catch {
      toast.error("Failed to generate content");
    } finally {
      setAiLoading(false);
    }
  }

  function getContent(): string {
    const t = formData.type;
    if (t.includes("INSTAGRAM")) return formData.instagramCaption;
    if (t.includes("FACEBOOK")) return formData.facebookText;
    if (t.includes("WHATSAPP")) return formData.whatsappMessage;
    if (t === "EMAIL_TEMPLATE") return formData.emailBody;
    if (t === "SMS_TEMPLATE") return formData.smsMessage;
    return formData.instagramCaption || formData.facebookText || formData.whatsappMessage;
  }

  async function handleSave(schedule: boolean) {
    if (!formData.type) {
      toast.error("Please select a content type");
      return;
    }
    if (!formData.title.trim()) {
      toast.error("Please enter a title");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/revenue-crm/content", {
        title: formData.title,
        type: formData.type,
        channel: formData.channels,
        content: getContent(),
        imageUrl: formData.imageUrl || null,
        hashtags: formData.instagramHashtags
          .split(/[\s,]+/)
          .filter(Boolean)
          .map((h) => h.replace(/^#/, "")),
        scheduledAt: schedule && formData.scheduledAt ? formData.scheduledAt : undefined,
        status: schedule && formData.scheduledAt ? "SCHEDULED" : "DRAFT",
      });
      toast.success(schedule ? "Content scheduled!" : "Draft saved!");
      onCreated();
      onClose();
    } catch {
      toast.error("Failed to save content");
    } finally {
      setSubmitting(false);
    }
  }

  const previewContent = getContent();
  const previewChannel = formData.channels[0] ?? (formData.type.includes("INSTAGRAM") ? "INSTAGRAM" : "");

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-50 border border-slate-200 rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <div>
            <h2 className="text-slate-900 font-semibold text-lg">Create Content</h2>
            <p className="text-slate-500 text-sm mt-0.5">
              {modalStep === 1 ? "Select content type" : "Edit & publish your content"}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* ── Step 1: Type Selector ── */}
          {modalStep === 1 && (
            <div className="p-6 space-y-4">
              <p className="text-slate-500 text-sm">
                What type of content do you want to create?
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {CONTENT_TYPES.map((ct) => (
                  <button
                    key={ct.value}
                    onClick={() => {
                      setField("type", ct.value);
                      setModalStep(2);
                    }}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-300 bg-white hover:border-teal-500 hover:bg-teal-900/20 transition-all group"
                  >
                    <span className="text-2xl">{ct.icon}</span>
                    <span className="text-slate-700 group-hover:text-teal-300 text-xs font-medium text-center leading-tight">
                      {ct.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 2: Editor ── */}
          {modalStep === 2 && (
            <div className="flex flex-col lg:flex-row h-full">
              {/* Left Panel */}
              <div className="flex-1 p-6 space-y-5 overflow-y-auto border-r border-slate-200">
                {/* Back + Title */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setModalStep(1)}
                    className="text-slate-500 hover:text-slate-900 text-xs underline"
                  >
                    ← Change type
                  </button>
                  <span className="text-slate-600">|</span>
                  <span className="text-teal-400 text-sm font-medium">
                    {CONTENT_TYPES.find((ct) => ct.value === formData.type)?.icon}{" "}
                    {typeLabel(formData.type)}
                  </span>
                </div>

                <div>
                  <label className="text-slate-700 text-sm font-medium mb-1.5 block">
                    Title *
                  </label>
                  <input
                    value={formData.title}
                    onChange={(e) => setField("title", e.target.value)}
                    placeholder="Content title..."
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm"
                  />
                </div>

                {/* AI Generator */}
                <div className="bg-indigo-950/40 border border-indigo-800/50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-indigo-400" />
                    <p className="text-indigo-300 font-medium text-sm">AI Content Generator</p>
                  </div>
                  <textarea
                    value={brief}
                    onChange={(e) => setBrief(e.target.value)}
                    rows={2}
                    placeholder="What is this content about? e.g. 'Monsoon health tips for diabetic patients'"
                    className="w-full bg-indigo-950/60 border border-indigo-800/40 rounded-lg px-3 py-2 text-slate-900 placeholder-indigo-400/60 focus:outline-none focus:border-indigo-500 text-sm resize-none"
                  />
                  <div className="space-y-2">
                    <p className="text-slate-500 text-xs">Audience:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {AUDIENCE_OPTS.map((a) => (
                        <button
                          key={a}
                          onClick={() => setAudience(a)}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                            audience === a
                              ? "bg-indigo-700 text-white"
                              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                          }`}
                        >
                          {a}
                        </button>
                      ))}
                    </div>
                    <p className="text-slate-500 text-xs">Tone:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {TONE_OPTS.map((t) => (
                        <button
                          key={t}
                          onClick={() => setTone(t)}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                            tone === t
                              ? "bg-indigo-700 text-white"
                              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={generateAll}
                    disabled={aiLoading || !brief.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    {aiLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {aiLoading ? "Generating..." : "Generate All Formats"}
                  </button>
                </div>

                {/* Channel-specific fields */}
                {(formData.type.includes("INSTAGRAM") || formData.type === "HEALTH_TIP" || formData.type === "FESTIVAL_POST" || formData.type === "OFFER_CARD") && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-slate-700 text-sm font-medium mb-1.5 block">
                        Caption
                      </label>
                      <textarea
                        value={formData.instagramCaption}
                        onChange={(e) => setField("instagramCaption", e.target.value)}
                        rows={4}
                        placeholder="Write your caption..."
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm resize-none"
                      />
                    </div>
                    <div>
                      <label className="text-slate-700 text-sm font-medium mb-1.5 block">
                        Hashtags
                      </label>
                      <input
                        value={formData.instagramHashtags}
                        onChange={(e) => setField("instagramHashtags", e.target.value)}
                        placeholder="#health #wellness #hospital"
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm"
                      />
                    </div>
                  </div>
                )}

                {formData.type === "FACEBOOK_POST" && (
                  <div>
                    <label className="text-slate-700 text-sm font-medium mb-1.5 block">
                      Post Text
                    </label>
                    <textarea
                      value={formData.facebookText}
                      onChange={(e) => setField("facebookText", e.target.value)}
                      rows={4}
                      placeholder="Write your Facebook post..."
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm resize-none"
                    />
                  </div>
                )}

                {(formData.type === "WHATSAPP_STATUS" || formData.type === "WHATSAPP_MESSAGE") && (
                  <div>
                    <label className="text-slate-700 text-sm font-medium mb-1.5 block">
                      Message
                    </label>
                    <textarea
                      value={formData.whatsappMessage}
                      onChange={(e) => setField("whatsappMessage", e.target.value)}
                      rows={4}
                      placeholder="Write your WhatsApp message..."
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm resize-none"
                    />
                  </div>
                )}

                {formData.type === "EMAIL_TEMPLATE" && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-slate-700 text-sm font-medium mb-1.5 block">
                        Subject
                      </label>
                      <input
                        value={formData.emailSubject}
                        onChange={(e) => setField("emailSubject", e.target.value)}
                        placeholder="Email subject..."
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-slate-700 text-sm font-medium mb-1.5 block">
                        Body
                      </label>
                      <textarea
                        value={formData.emailBody}
                        onChange={(e) => setField("emailBody", e.target.value)}
                        rows={5}
                        placeholder="Email body..."
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm resize-none"
                      />
                    </div>
                  </div>
                )}

                {formData.type === "SMS_TEMPLATE" && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-slate-700 text-sm font-medium">SMS Message</label>
                      <span
                        className={`text-xs ${
                          formData.smsMessage.length > 160 ? "text-red-400" : "text-slate-500"
                        }`}
                      >
                        {formData.smsMessage.length}/160
                      </span>
                    </div>
                    <textarea
                      value={formData.smsMessage}
                      onChange={(e) => setField("smsMessage", e.target.value)}
                      rows={3}
                      placeholder="SMS message..."
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm resize-none"
                    />
                  </div>
                )}

                {/* Image URL */}
                <div>
                  <label className="text-slate-700 text-sm font-medium mb-1.5 block">
                    Image URL (optional)
                  </label>
                  <input
                    value={formData.imageUrl}
                    onChange={(e) => setField("imageUrl", e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm"
                  />
                </div>

                {/* Publishing */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                  <p className="text-slate-700 text-sm font-medium">Publishing</p>
                  <div>
                    <label className="text-slate-500 text-xs mb-1.5 block">
                      Channels to publish
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {["INSTAGRAM", "FACEBOOK", "WHATSAPP", "EMAIL", "SMS"].map((ch) => (
                        <button
                          key={ch}
                          onClick={() => toggleChannel(ch)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            formData.channels.includes(ch)
                              ? "border-teal-500 bg-teal-900/30 text-teal-300"
                              : "border-slate-300 text-slate-500 hover:border-slate-600"
                          }`}
                        >
                          {ch}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-slate-500 text-xs mb-1.5 block">
                      Schedule date &amp; time (optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.scheduledAt}
                      onChange={(e) => setField("scheduledAt", e.target.value)}
                      className="w-full bg-slate-100 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-teal-500 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Right Panel — Preview */}
              <div className="w-full lg:w-72 p-6 bg-white space-y-4">
                <p className="text-slate-700 text-sm font-medium">Preview</p>
                <div className="bg-white border border-slate-300 rounded-xl overflow-hidden">
                  {/* Mock social post */}
                  <div className="p-3 flex items-center gap-2 border-b border-slate-200">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-slate-900 text-xs font-bold">
                      H
                    </div>
                    <div>
                      <p className="text-slate-900 text-xs font-medium">Your Hospital</p>
                      {previewChannel && (
                        <p className="text-slate-500 text-xs">{previewChannel}</p>
                      )}
                    </div>
                  </div>
                  {formData.imageUrl && (
                    <div className="h-36 bg-slate-100 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={formData.imageUrl}
                        alt="preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="p-3 space-y-2">
                    {previewContent ? (
                      <p className="text-slate-200 text-xs leading-relaxed">{previewContent}</p>
                    ) : (
                      <p className="text-slate-600 text-xs italic">
                        Content will appear here...
                      </p>
                    )}
                    {formData.instagramHashtags && (
                      <p className="text-teal-500 text-xs">
                        {formData.instagramHashtags
                          .split(/[\s,]+/)
                          .filter(Boolean)
                          .map((h) => `#${h.replace(/^#/, "")}`)
                          .join(" ")}
                      </p>
                    )}
                  </div>
                </div>
                <p className="text-slate-500 text-xs">
                  This is a simplified preview. Actual appearance may vary by platform.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {modalStep === 2 && (
          <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-200">
            <button
              onClick={() => handleSave(false)}
              disabled={submitting}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-lg text-sm transition-colors"
            >
              Save Draft
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={submitting || !formData.scheduledAt}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
              Schedule
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ContentStudioPage() {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [channelFilter, setChannelFilter] = useState("All");
  const [showCreate, setShowCreate] = useState(false);

  const filterParam =
    channelFilter === "All" ? undefined : channelFilter.toUpperCase();

  const { data: content, isLoading, error } = useQuery<ContentItem[]>({
    queryKey: ["crm-content", filterParam],
    queryFn: async () => {
      const params = filterParam ? `?channel=${filterParam}` : "";
      const res = await api.get(`/revenue-crm/content${params}`);
      const d = res.data?.data ?? res.data;
      return (Array.isArray(d) ? d : d?.data ?? d?.items ?? []) as ContentItem[];
    },
    retry: 1,
    staleTime: 30000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/revenue-crm/content/${id}`),
    onSuccess: () => {
      toast.success("Content deleted");
      queryClient.invalidateQueries({ queryKey: ["crm-content"] });
    },
    onError: () => toast.error("Failed to delete content"),
  });

  const scheduleMutation = useMutation({
    mutationFn: ({ id, scheduledAt }: { id: string; scheduledAt?: string }) =>
      api.post(`/revenue-crm/content/${id}/schedule`, { scheduledAt }),
    onSuccess: () => {
      toast.success("Content scheduled!");
      queryClient.invalidateQueries({ queryKey: ["crm-content"] });
    },
    onError: () => toast.error("Failed to schedule content"),
  });

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">
      {showCreate && (
        <CreateContentModal
          onClose={() => setShowCreate(false)}
          onCreated={() => queryClient.invalidateQueries({ queryKey: ["crm-content"] })}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="h-6 w-6 text-teal-400" />
            Content Studio
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Create, schedule and publish content across all channels
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="h-4 w-4" />
          Create Content
        </button>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Filter Pills */}
        <div className="flex gap-1 flex-wrap">
          {FILTER_CHANNELS.map((ch) => (
            <button
              key={ch}
              onClick={() => setChannelFilter(ch)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                channelFilter === ch
                  ? "bg-teal-600 text-white"
                  : "bg-white text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              {ch}
            </button>
          ))}
        </div>
        {/* View Toggle */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === "grid"
                ? "bg-teal-600 text-white"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === "list"
                ? "bg-teal-600 text-white"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 text-red-400 text-sm">
          Failed to load content. Please try again.
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-white border border-slate-200 rounded-xl h-64 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && (!content || content.length === 0) && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 bg-white border border-slate-200 rounded-full flex items-center justify-center mb-4">
            <FileText className="h-10 w-10 text-slate-600" />
          </div>
          <h3 className="text-slate-900 font-semibold text-lg mb-1">No content yet</h3>
          <p className="text-slate-500 text-sm mb-6">
            Create your first piece of content to start building your online presence
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Content
          </button>
        </div>
      )}

      {/* Grid View */}
      {!isLoading && content && content.length > 0 && viewMode === "grid" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {content.map((item) => (
            <ContentCard
              key={item.id}
              item={item}
              onDelete={(id) => deleteMutation.mutate(id)}
              onSchedule={(id) => scheduleMutation.mutate({ id })}
            />
          ))}
        </div>
      )}

      {/* List View */}
      {!isLoading && content && content.length > 0 && viewMode === "list" && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="px-4 py-3 text-left text-slate-500 text-xs font-medium">
                  Title
                </th>
                <th className="px-4 py-3 text-left text-slate-500 text-xs font-medium">Type</th>
                <th className="px-4 py-3 text-left text-slate-500 text-xs font-medium">
                  Channels
                </th>
                <th className="px-4 py-3 text-left text-slate-500 text-xs font-medium">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-slate-500 text-xs font-medium">Date</th>
                <th className="px-4 py-3 text-left text-slate-500 text-xs font-medium">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {content.map((item) => (
                <ContentRow
                  key={item.id}
                  item={item}
                  onDelete={(id) => deleteMutation.mutate(id)}
                  onSchedule={(id) => scheduleMutation.mutate({ id })}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      {!isLoading && content && content.length > 0 && (
        <div className="flex items-center gap-4 flex-wrap text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-blue-400" />
            Scheduled
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-green-400" />
            Published
          </span>
          <span className="flex items-center gap-1">
            <FileText className="h-3 w-3 text-slate-500" />
            Draft
          </span>
        </div>
      )}
    </div>
  );
}
