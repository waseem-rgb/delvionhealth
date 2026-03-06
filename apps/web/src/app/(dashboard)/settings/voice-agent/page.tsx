"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Bot,
  Copy,
  Check,
  Save,
  Globe,
  Phone,
  MessageSquare,
  BarChart3,
  Sparkles,
  Eye,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";

interface WidgetConfig {
  id: string;
  tenantId: string;
  labName: string;
  labTagline: string | null;
  primaryColor: string;
  greetingMessage: string;
  enableVoice: boolean;
  enableBooking: boolean;
  enableReportStatus: boolean;
  languages: string;
  whatsappNumber: string | null;
  phoneNumber: string | null;
  workingHours: string;
  offlineMessage: string;
  isPublished: boolean;
  embedKey: string;
}

interface Analytics {
  totalSessions: number;
  totalMessages: number;
  totalAppointments: number;
  recentSessions: number;
}

export default function VoiceAgentPage() {
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const { data: config, isLoading } = useQuery<WidgetConfig>({
    queryKey: ["voice-agent-config"],
    queryFn: async () => {
      const { data } = await api.get("/voice-agent/widget-config");
      return data;
    },
  });

  const { data: analytics } = useQuery<Analytics>({
    queryKey: ["voice-agent-analytics"],
    queryFn: async () => {
      const { data } = await api.get("/voice-agent/analytics");
      return data;
    },
  });

  const [form, setForm] = useState<Partial<WidgetConfig>>({});

  const merged = { ...config, ...form } as WidgetConfig;

  const saveMutation = useMutation({
    mutationFn: async (body: Partial<WidgetConfig>) => {
      const { data } = await api.post("/voice-agent/widget-config", body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["voice-agent-config"] });
      setForm({});
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post("/voice-agent/widget-config/publish");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["voice-agent-config"] });
    },
  });

  const handleSave = () => {
    if (Object.keys(form).length === 0) return;
    saveMutation.mutate(form);
  };

  const apiBase =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const embedSnippet = config?.embedKey
    ? `<script src="${apiBase}/api/v1/voice-agent/embed.js?key=${config.embedKey}" async></script>`
    : "";

  const copyEmbed = () => {
    navigator.clipboard.writeText(embedSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-gray-200 rounded" />
        <div className="h-64 bg-gray-100 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/settings"
            className="p-2 rounded-lg hover:bg-gray-100 transition"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="p-2.5 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl">
            <Bot size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Voice AI Agent
            </h1>
            <p className="text-sm text-gray-500">
              Configure your embeddable lab assistant widget
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {config?.isPublished ? (
            <span className="px-3 py-1 text-xs font-semibold bg-green-100 text-green-700 rounded-full">
              Published
            </span>
          ) : (
            <span className="px-3 py-1 text-xs font-semibold bg-amber-100 text-amber-700 rounded-full">
              Draft
            </span>
          )}
          <button
            onClick={() => publishMutation.mutate()}
            disabled={publishMutation.isPending}
            className="px-4 py-2 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 transition"
          >
            {config?.isPublished ? "Unpublish" : "Publish"}
          </button>
        </div>
      </div>

      {/* Analytics Strip */}
      {analytics && (
        <div className="grid grid-cols-4 gap-4">
          {[
            {
              label: "Total Sessions",
              value: analytics.totalSessions,
              icon: MessageSquare,
              color: "bg-blue-50 text-blue-600",
            },
            {
              label: "Total Messages",
              value: analytics.totalMessages,
              icon: BarChart3,
              color: "bg-purple-50 text-purple-600",
            },
            {
              label: "Appointments Booked",
              value: analytics.totalAppointments,
              icon: Sparkles,
              color: "bg-green-50 text-green-600",
            },
            {
              label: "Sessions (7d)",
              value: analytics.recentSessions,
              icon: Globe,
              color: "bg-amber-50 text-amber-600",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3"
            >
              <div
                className={`p-2.5 rounded-lg ${stat.color}`}
              >
                <stat.icon size={18} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {stat.value}
                </p>
                <p className="text-xs text-gray-500">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Left Column — Config Form */}
        <div className="col-span-2 space-y-6">
          {/* Agent Identity */}
          <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Bot size={16} /> Agent Identity
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Lab Name
                </label>
                <input
                  type="text"
                  value={merged.labName ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, labName: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                  placeholder="Your Lab Name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Tagline
                </label>
                <input
                  type="text"
                  value={merged.labTagline ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, labTagline: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                  placeholder="Your trusted diagnostic partner"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Primary Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={merged.primaryColor ?? "#0d7377"}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, primaryColor: e.target.value }))
                    }
                    className="w-10 h-10 rounded cursor-pointer border border-gray-300"
                  />
                  <input
                    type="text"
                    value={merged.primaryColor ?? "#0d7377"}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, primaryColor: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Languages (comma-separated)
                </label>
                <input
                  type="text"
                  value={merged.languages ?? "en,hi"}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, languages: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="en,hi"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Greeting Message
              </label>
              <textarea
                value={merged.greetingMessage ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, greetingMessage: e.target.value }))
                }
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none resize-none"
                placeholder="Hi! I'm your lab assistant..."
              />
            </div>
          </section>

          {/* Contact & Hours */}
          <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Phone size={16} /> Contact & Hours
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={merged.phoneNumber ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phoneNumber: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="+91 98765 43210"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  WhatsApp Number
                </label>
                <input
                  type="text"
                  value={merged.whatsappNumber ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, whatsappNumber: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Working Hours
                </label>
                <input
                  type="text"
                  value={merged.workingHours ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, workingHours: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="Mon-Sat 7am-9pm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Offline Message
                </label>
                <input
                  type="text"
                  value={merged.offlineMessage ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, offlineMessage: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="We're currently offline..."
                />
              </div>
            </div>
          </section>

          {/* Feature Toggles */}
          <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Sparkles size={16} /> Features
            </h2>
            <div className="space-y-3">
              {[
                {
                  key: "enableVoice" as const,
                  label: "Voice Input",
                  desc: "Allow visitors to use microphone for voice queries",
                },
                {
                  key: "enableBooking" as const,
                  label: "Appointment Booking",
                  desc: "Allow visitors to book appointments through the widget",
                },
                {
                  key: "enableReportStatus" as const,
                  label: "Report Status Check",
                  desc: "Allow visitors to check their report status",
                },
              ].map((toggle) => (
                <label
                  key={toggle.key}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {toggle.label}
                    </p>
                    <p className="text-xs text-gray-500">{toggle.desc}</p>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={merged[toggle.key] ?? true}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          [toggle.key]: e.target.checked,
                        }))
                      }
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-gray-200 rounded-full peer-checked:bg-teal-600 transition-colors" />
                    <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform" />
                  </div>
                </label>
              ))}
            </div>
          </section>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={
                Object.keys(form).length === 0 || saveMutation.isPending
              }
              className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition"
            >
              <Save size={16} />
              {saveMutation.isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        {/* Right Column — Embed Code + Preview */}
        <div className="space-y-6">
          {/* Embed Code */}
          <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Globe size={16} /> Embed Code
            </h2>
            <p className="text-xs text-gray-500">
              Add this script tag to your website to embed the voice agent
              widget.
            </p>
            <div className="relative">
              <pre className="bg-gray-900 text-green-400 text-xs p-3 rounded-lg overflow-x-auto whitespace-pre-wrap break-all font-mono">
                {embedSnippet || "Save configuration to generate embed code"}
              </pre>
              {embedSnippet && (
                <button
                  onClick={copyEmbed}
                  className="absolute top-2 right-2 p-1.5 bg-gray-700 rounded hover:bg-gray-600 transition"
                  title="Copy embed code"
                >
                  {copied ? (
                    <Check size={14} className="text-green-400" />
                  ) : (
                    <Copy size={14} className="text-gray-300" />
                  )}
                </button>
              )}
            </div>
            {config?.embedKey && (
              <p className="text-xs text-gray-400">
                Embed Key:{" "}
                <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                  {config.embedKey}
                </code>
              </p>
            )}
          </section>

          {/* Preview */}
          <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Eye size={16} /> Widget Preview
              </h2>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="text-xs text-teal-600 hover:text-teal-700 font-medium"
              >
                {showPreview ? "Hide" : "Show"}
              </button>
            </div>
            {showPreview && (
              <div className="relative bg-gray-100 rounded-lg p-4 h-[420px] overflow-hidden">
                {/* Mini widget preview */}
                <div className="absolute bottom-4 right-4 w-[300px]">
                  {/* Chat panel preview */}
                  <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
                    <div
                      className="px-4 py-3 text-white flex items-center gap-2"
                      style={{
                        background: `linear-gradient(135deg, ${merged.primaryColor ?? "#0d7377"}, ${merged.primaryColor ?? "#0d7377"}cc)`,
                      }}
                    >
                      <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm">
                        🧬
                      </div>
                      <div>
                        <p className="text-xs font-bold">
                          {merged.labName || "Lab Assistant"}
                        </p>
                        <p className="text-[10px] opacity-80">
                          Online · Replies instantly
                        </p>
                      </div>
                    </div>
                    <div className="p-3 space-y-2 h-[200px] overflow-y-auto">
                      <div className="bg-gray-100 rounded-2xl rounded-bl px-3 py-2 text-xs text-gray-700 max-w-[80%]">
                        {merged.greetingMessage ||
                          "Hi! I'm your lab assistant. How can I help?"}
                      </div>
                    </div>
                    <div className="flex gap-1 px-3 pb-2 flex-wrap">
                      {["Book appointment", "Test prices", "Report status"].map(
                        (c) => (
                          <span
                            key={c}
                            className="text-[10px] px-2 py-1 rounded-full border"
                            style={{
                              borderColor: merged.primaryColor ?? "#0d7377",
                              color: merged.primaryColor ?? "#0d7377",
                            }}
                          >
                            {c}
                          </span>
                        ),
                      )}
                    </div>
                    <div className="px-3 pb-3 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs">
                        🎤
                      </div>
                      <div className="flex-1 border border-gray-200 rounded-full px-3 py-1.5 text-xs text-gray-400">
                        Type your question...
                      </div>
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs"
                        style={{
                          backgroundColor: merged.primaryColor ?? "#0d7377",
                        }}
                      >
                        ➤
                      </div>
                    </div>
                  </div>
                </div>
                {/* FAB preview */}
                <div
                  className="absolute bottom-4 left-4 w-12 h-12 rounded-full flex items-center justify-center text-white text-xl shadow-lg cursor-pointer"
                  style={{
                    background: `linear-gradient(135deg, ${merged.primaryColor ?? "#0d7377"}, ${merged.primaryColor ?? "#0d7377"}99)`,
                  }}
                >
                  🧬
                </div>
              </div>
            )}
          </section>

          {/* Quick Links */}
          <section className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">
              Quick Info
            </h2>
            <ul className="text-xs text-gray-600 space-y-2">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-teal-500">●</span>
                The widget uses AI (Claude) to answer visitor questions about
                your lab, tests, and services.
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-teal-500">●</span>
                Voice input uses browser Web Speech API — no additional cost.
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-teal-500">●</span>
                Visitors can book appointments, check test prices, and get
                report status.
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-teal-500">●</span>
                All conversations are logged and available in analytics.
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
