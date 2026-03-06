"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Plus,
  Search,
  FileText,
  Shield,
  CheckCircle2,
  Clock,
  XCircle,
  X,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import api from "@/lib/api";

interface QualityDocument {
  id: string;
  title: string;
  type: string;
  category: string | null;
  version: string;
  status: string;
  docNumber: string | null;
  certType: string | null;
  issuerName: string | null;
  issuedDate: string | null;
  expiryDate: string | null;
  nextReviewDate: string | null;
  fileUrl: string | null;
  approvedById: string | null;
  approvedAt: string | null;
  createdAt: string;
}

interface VaultStatus {
  total: number;
  byType: Record<string, { total: number; valid: number; expiring: number; expired: number }>;
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-50 text-slate-600 border-slate-200",
  APPROVED: "bg-green-50 text-green-700 border-green-200",
  OBSOLETE: "bg-red-50 text-red-700 border-red-200",
  UNDER_REVIEW: "bg-amber-50 text-amber-700 border-amber-200",
};

const DOC_TABS = [
  { label: "All", value: "" },
  { label: "SOPs", value: "SOP" },
  { label: "Certificates", value: "CERTIFICATE" },
  { label: "Forms", value: "FORM" },
  { label: "Policies", value: "POLICY" },
];

const CERT_TYPES = [
  "COI", "PAN", "GST", "TAN", "NABL", "ISO", "Trade License", "PCB",
  "BMW Authorization", "Clinical Establishment", "AERB", "Fire NOC",
];

function UploadDocModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    title: "", docNumber: "", type: "SOP", category: "", version: "1.0",
    content: "", certType: "", issuerName: "", issuedDate: "", expiryDate: "", nextReviewDate: "",
  });
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () => api.post("/quality/documents", {
      ...form,
      category: form.category || undefined,
      certType: form.certType || undefined,
      issuerName: form.issuerName || undefined,
      issuedDate: form.issuedDate || undefined,
      expiryDate: form.expiryDate || undefined,
      nextReviewDate: form.nextReviewDate || undefined,
      content: form.content || undefined,
    }),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (e: unknown) => {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed");
    },
  });

  const set = (key: string, val: string) => setForm((p) => ({ ...p, [key]: val }));
  const isCert = form.type === "CERTIFICATE";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Upload Document</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-400"><X className="w-5 h-5" /></button>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>}
        <form onSubmit={(e) => { e.preventDefault(); if (!form.title) { setError("Title is required"); return; } mutation.mutate(); }} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Title *</label>
            <input type="text" value={form.title} onChange={(e) => set("title", e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Doc Number</label>
              <input type="text" value={form.docNumber} onChange={(e) => set("docNumber", e.target.value)} placeholder="SOP-001" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Type</label>
              <select value={form.type} onChange={(e) => set("type", e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                <option value="SOP">SOP</option>
                <option value="CERTIFICATE">Certificate</option>
                <option value="FORM">Form</option>
                <option value="POLICY">Policy</option>
                <option value="MANUAL">Manual</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Version</label>
              <input type="text" value={form.version} onChange={(e) => set("version", e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Category</label>
            <input type="text" value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="e.g. Pre-analytics, Equipment, Quality" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>

          {isCert && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Cert Type</label>
                  <select value={form.certType} onChange={(e) => set("certType", e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                    <option value="">Select...</option>
                    {CERT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Issuer Name</label>
                  <input type="text" value={form.issuerName} onChange={(e) => set("issuerName", e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Issue Date</label>
                  <input type="date" value={form.issuedDate} onChange={(e) => set("issuedDate", e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Expiry Date</label>
                  <input type="date" value={form.expiryDate} onChange={(e) => set("expiryDate", e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Next Review Date</label>
            <input type="date" value={form.nextReviewDate} onChange={(e) => set("nextReviewDate", e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Content</label>
            <textarea rows={4} value={form.content} onChange={(e) => set("content", e.target.value)} placeholder="Document content or paste text..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="flex-1 px-4 py-2 bg-blue-600 rounded-lg text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              {mutation.isPending ? "Saving..." : "Save Document"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SopsDocumentsPage() {
  const queryClient = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  const [activeTab, setActiveTab] = useState("");
  const [search, setSearch] = useState("");

  const { data: docsData, isLoading } = useQuery({
    queryKey: ["quality-documents", activeTab],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeTab) params.set("type", activeTab);
      params.set("limit", "100");
      const res = await api.get(`/quality/documents?${params.toString()}`);
      return (res.data?.data ?? res.data) as { data: QualityDocument[]; total: number };
    },
  });

  const { data: vaultStatus } = useQuery({
    queryKey: ["quality-vault-status-sops"],
    queryFn: async () => {
      const res = await api.get("/quality/documents/vault-status");
      return (res.data?.data ?? res.data) as VaultStatus;
    },
  });

  const docs = (docsData?.data ?? []).filter((d) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return d.title.toLowerCase().includes(q) || (d.docNumber ?? "").toLowerCase().includes(q);
  });

  const vault = vaultStatus?.byType ?? {};
  const showVault = !activeTab || activeTab === "CERTIFICATE";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">SOPs & Documents</h1>
          <p className="text-slate-500 text-sm mt-0.5">Quality document control — ISO 15189</p>
        </div>
        <button onClick={() => setShowUpload(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Upload Doc
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 rounded-lg p-0.5 w-fit">
        {DOC_TABS.map((tab) => (
          <button key={tab.value} onClick={() => setActiveTab(tab.value)}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${activeTab === tab.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Certificate Vault */}
      {showVault && Object.keys(vault).length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Certificate Vault</h3>
          <div className="grid grid-cols-4 gap-3">
            {Object.entries(vault).map(([type, counts]) => {
              let icon = <Shield className="w-5 h-5" />;
              let statusLabel = "VALID";
              let statusColor = "text-green-600";
              let bgColor = "bg-green-50 border-green-200";
              let detail = "No Expiry";

              if (counts.expired > 0) {
                statusLabel = "EXPIRED";
                statusColor = "text-red-600";
                bgColor = "bg-red-50 border-red-200";
                icon = <XCircle className="w-5 h-5" />;
                detail = `${counts.expired} expired`;
              } else if (counts.expiring > 0) {
                statusLabel = "EXPIRING";
                statusColor = "text-amber-600";
                bgColor = "bg-amber-50 border-amber-200";
                icon = <Clock className="w-5 h-5" />;
                detail = `${counts.expiring} expiring soon`;
              }

              return (
                <div key={type} className={`rounded-xl border p-4 ${bgColor}`}>
                  <div className={`mb-2 ${statusColor}`}>{icon}</div>
                  <p className="text-sm font-bold text-slate-900">{type}</p>
                  <p className={`text-xs font-semibold ${statusColor}`}>{statusLabel}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{detail}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="flex justify-end">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="search" placeholder="Search documents..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 w-64" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />)}</div>
        ) : docs.length === 0 ? (
          <div className="p-16 text-center">
            <BookOpen className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No documents found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-4 py-2 font-medium text-slate-500 w-24">Doc#</th>
                <th className="text-left px-4 py-2 font-medium text-slate-500">Title</th>
                <th className="text-left px-4 py-2 font-medium text-slate-500 w-28">Category</th>
                <th className="text-left px-4 py-2 font-medium text-slate-500 w-20">Version</th>
                <th className="text-left px-4 py-2 font-medium text-slate-500 w-28">Status</th>
                <th className="text-left px-4 py-2 font-medium text-slate-500 w-28">Review Date</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((doc) => (
                <tr key={doc.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <span className="font-mono text-xs text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded">{doc.docNumber ?? "—"}</span>
                  </td>
                  <td className="px-4 py-2 font-medium text-slate-800">{doc.title}</td>
                  <td className="px-4 py-2 text-xs text-slate-600">{doc.category ?? doc.type}</td>
                  <td className="px-4 py-2 text-slate-600">{doc.version}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_STYLES[doc.status] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}>
                      {doc.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-600">{formatDate(doc.nextReviewDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showUpload && <UploadDocModal onClose={() => setShowUpload(false)} onSuccess={() => queryClient.invalidateQueries({ queryKey: ["quality-documents"] })} />}
    </div>
  );
}
