"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  Copy,
  Save,
  Trash2,
  Send,
  MessageCircle,
  Mail,
  FileText,
} from "lucide-react";
import api from "@/lib/api";

interface ContentTemplate {
  id: string;
  name: string;
  type: string;
  purpose: string | null;
  channel: string | null;
  content: string;
  language: string;
  usageCount: number;
  createdAt: string;
}

const CONTENT_TYPES = [
  { value: "WHATSAPP", label: "WhatsApp Message", icon: MessageCircle },
  { value: "SMS", label: "SMS", icon: Send },
  { value: "EMAIL", label: "Email Template", icon: Mail },
  { value: "BROCHURE", label: "Package Brochure Text", icon: FileText },
];

const PURPOSES = [
  "New test launch", "Package promotion", "Doctor outreach",
  "Patient recall", "Festival greeting", "Health tip",
  "Corporate proposal", "Monthly report card",
];

const TONES = ["Professional", "Friendly", "Urgent"];
const LANGUAGES = ["English", "Hindi", "Kannada", "Telugu", "Tamil", "Marathi"];

export default function ContentStudioPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"generate" | "library">("generate");
  const [form, setForm] = useState({
    contentType: "WHATSAPP",
    purpose: "",
    tone: "Professional",
    details: "",
    language: "English",
  });
  const [generated, setGenerated] = useState<string | null>(null);
  const [saveName, setSaveName] = useState("");
  const [copied, setCopied] = useState(false);
  const [libFilter, setLibFilter] = useState("");

  const generateMut = useMutation({
    mutationFn: async () => {
      const res = await api.post("/marketing/content/generate", form);
      return res.data?.data ?? res.data;
    },
    onSuccess: (data: { content: string }) => {
      setGenerated(data.content);
    },
  });

  const { data: library = [] } = useQuery<ContentTemplate[]>({
    queryKey: ["marketing", "content", "library", libFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (libFilter) params.type = libFilter;
      const res = await api.get("/marketing/content/library", { params });
      return res.data?.data ?? res.data ?? [];
    },
    enabled: tab === "library",
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      await api.post("/marketing/content/library", {
        name: saveName,
        type: form.contentType,
        purpose: form.purpose,
        channel: form.contentType,
        content: generated,
        language: form.language,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing", "content", "library"] });
      setSaveName("");
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/marketing/content/library/${id}`); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marketing", "content", "library"] }),
  });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Content Studio</h1>
        <p className="text-sm text-slate-500 mt-0.5">AI-powered marketing content generator</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex gap-4">
          <button onClick={() => setTab("generate")}
            className={`pb-2.5 text-sm font-medium border-b-2 ${tab === "generate" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            Generate Content
          </button>
          <button onClick={() => setTab("library")}
            className={`pb-2.5 text-sm font-medium border-b-2 ${tab === "library" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            Content Library ({library.length})
          </button>
        </nav>
      </div>

      {tab === "generate" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Form */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">Content Settings</h3>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Content Type</label>
              <div className="grid grid-cols-2 gap-2">
                {CONTENT_TYPES.map((ct) => (
                  <button key={ct.value} onClick={() => setForm({ ...form, contentType: ct.value })}
                    className={`p-3 rounded-lg border text-left ${form.contentType === ct.value ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-slate-300"}`}>
                    <ct.icon className={`h-4 w-4 mb-1 ${form.contentType === ct.value ? "text-blue-600" : "text-slate-400"}`} />
                    <p className="text-xs font-medium text-slate-900">{ct.label}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Purpose</label>
              <select value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">Select purpose...</option>
                {PURPOSES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tone</label>
                <select value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Language</label>
                <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Key Details</label>
              <textarea rows={3} value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })}
                placeholder="e.g. HbA1c test, Rs.350, TAT 4 hours, Diabetes awareness month"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>

            <button onClick={() => generateMut.mutate()} disabled={!form.purpose || generateMut.isPending}
              className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 flex items-center justify-center gap-2">
              <Sparkles className="h-4 w-4" />
              {generateMut.isPending ? "Generating..." : "Generate with AI"}
            </button>
          </div>

          {/* Output Preview */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Preview</h3>

            {!generated ? (
              <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
                Generated content will appear here
              </div>
            ) : (
              <div className="space-y-4">
                {/* Phone Preview for WhatsApp/SMS */}
                {(form.contentType === "WHATSAPP" || form.contentType === "SMS") && (
                  <div className="bg-slate-100 rounded-2xl p-6 max-w-sm mx-auto">
                    <div className="bg-green-100 rounded-xl p-4">
                      <pre className="text-sm text-slate-800 whitespace-pre-wrap font-sans">{generated}</pre>
                    </div>
                    <p className="text-right text-xs text-slate-400 mt-1">
                      {generated.length} chars
                      {form.contentType === "SMS" && ` (${Math.ceil(generated.length / 160)} SMS)`}
                    </p>
                  </div>
                )}

                {/* Email Preview */}
                {form.contentType === "EMAIL" && (
                  <div className="border border-slate-200 rounded-lg">
                    <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                      <p className="text-xs text-slate-500">Email Preview</p>
                    </div>
                    <div className="p-4">
                      <pre className="text-sm text-slate-800 whitespace-pre-wrap font-sans">{generated}</pre>
                    </div>
                  </div>
                )}

                {/* Brochure Preview */}
                {form.contentType === "BROCHURE" && (
                  <div className="border border-slate-200 rounded-lg p-4">
                    <pre className="text-sm text-slate-800 whitespace-pre-wrap font-sans">{generated}</pre>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <button onClick={() => handleCopy(generated)}
                    className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2">
                    <Copy className="h-4 w-4" />{copied ? "Copied!" : "Copy"}
                  </button>
                </div>

                {/* Save to Library */}
                <div className="flex gap-2">
                  <input type="text" placeholder="Template name..." value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <button onClick={() => saveMut.mutate()} disabled={!saveName || saveMut.isPending}
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 flex items-center gap-1">
                    <Save className="h-4 w-4" />Save
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "library" && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <button onClick={() => setLibFilter("")}
              className={`text-xs px-3 py-1.5 rounded-full border ${!libFilter ? "bg-blue-600 text-white border-blue-600" : "border-slate-300 text-slate-600"}`}>
              All
            </button>
            {CONTENT_TYPES.map((ct) => (
              <button key={ct.value} onClick={() => setLibFilter(ct.value)}
                className={`text-xs px-3 py-1.5 rounded-full border ${libFilter === ct.value ? "bg-blue-600 text-white border-blue-600" : "border-slate-300 text-slate-600"}`}>
                {ct.label}
              </button>
            ))}
          </div>

          {library.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
              No saved templates yet. Generate content and save it here.
            </div>
          ) : (
            <div className="space-y-3">
              {library.map((tmpl) => (
                <div key={tmpl.id} className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">{tmpl.name}</h4>
                      <div className="flex gap-2 mt-0.5">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{tmpl.type}</span>
                        {tmpl.purpose && <span className="text-xs text-slate-500">{tmpl.purpose}</span>}
                        <span className="text-xs text-slate-400">Used {tmpl.usageCount}x</span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => handleCopy(tmpl.content)}
                        className="text-slate-400 hover:text-blue-500 p-1"><Copy className="h-4 w-4" /></button>
                      <button onClick={() => deleteMut.mutate(tmpl.id)}
                        className="text-slate-400 hover:text-red-500 p-1"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 line-clamp-3">{tmpl.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
