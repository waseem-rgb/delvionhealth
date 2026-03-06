"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Shield,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  X,
  Calendar,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import api from "@/lib/api";

interface Cert {
  id: string;
  name: string;
  category: string | null;
  priority: string | null;
  certNumber: string | null;
  issuingAuthority: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  renewalCycle: string | null;
  status: string;
  fileUrl: string | null;
  notes: string | null;
  createdAt: string;
}

interface VaultSummary {
  totalCerts: number;
  validCerts: number;
  expiringSoon: number;
  expired: number;
  criticalCount: number;
  upcomingRenewals: Cert[];
}

const STATUS_STYLES: Record<string, { cls: string; icon: React.ReactNode }> = {
  VALID: { cls: "bg-green-50 text-green-700 border-green-200", icon: <CheckCircle2 className="w-3 h-3" /> },
  EXPIRING_SOON: { cls: "bg-amber-50 text-amber-700 border-amber-200", icon: <Clock className="w-3 h-3" /> },
  EXPIRED: { cls: "bg-red-50 text-red-700 border-red-200", icon: <XCircle className="w-3 h-3" /> },
  PENDING_RENEWAL: { cls: "bg-blue-50 text-blue-700 border-blue-200", icon: <AlertTriangle className="w-3 h-3" /> },
};

const PRIORITY_STYLES: Record<string, string> = {
  CRITICAL: "bg-red-50 text-red-700 border-red-200",
  HIGH: "bg-orange-50 text-orange-700 border-orange-200",
  MEDIUM: "bg-yellow-50 text-yellow-700 border-yellow-200",
  LOW: "bg-slate-50 text-slate-600 border-slate-200",
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? { cls: "bg-slate-50 text-slate-600 border-slate-200", icon: null };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${s.cls}`}>
      {s.icon} {status.replace(/_/g, " ")}
    </span>
  );
}

function AddCertModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("REGULATORY");
  const [priority, setPriority] = useState("HIGH");
  const [certNumber, setCertNumber] = useState("");
  const [issuingAuthority, setIssuingAuthority] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [renewalCycle, setRenewalCycle] = useState("Annual");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      api.post("/quality/certs", {
        name: name.trim(), category, priority, certNumber: certNumber.trim() || undefined,
        issuingAuthority: issuingAuthority.trim() || undefined,
        issueDate: issueDate || undefined, expiryDate: expiryDate || undefined,
        renewalCycle, notes: notes.trim() || undefined,
      }),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (e: unknown) => {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed");
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Add Certificate</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-400"><X className="w-5 h-5" /></button>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>}
        <form onSubmit={(e) => { e.preventDefault(); if (!name.trim()) { setError("Name required"); return; } mutation.mutate(); }} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Certificate Name *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. NABL Accreditation Certificate" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                <option value="REGULATORY">Regulatory</option>
                <option value="LICENSE">License</option>
                <option value="AGREEMENT">Agreement</option>
                <option value="INSURANCE">Insurance</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Certificate Number</label>
              <input type="text" value={certNumber} onChange={(e) => setCertNumber(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Issuing Authority</label>
              <input type="text" value={issuingAuthority} onChange={(e) => setIssuingAuthority(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Issue Date</label>
              <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Expiry Date</label>
              <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Renewal Cycle</label>
              <select value={renewalCycle} onChange={(e) => setRenewalCycle(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                <option value="Lifetime">Lifetime</option>
                <option value="Annual">Annual</option>
                <option value="2 Years">2 Years</option>
                <option value="3 Years">3 Years</option>
                <option value="5 Years">5 Years</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Notes</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="flex-1 px-4 py-2 bg-blue-600 rounded-lg text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              {mutation.isPending ? "Adding..." : "Add Certificate"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DocumentVaultPage() {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const { data: summary } = useQuery({
    queryKey: ["vault-summary"],
    queryFn: async () => {
      try {
        const res = await api.get("/quality/vault/summary");
        return (res.data?.data ?? res.data) as VaultSummary;
      } catch { return null; }
    },
  });

  const { data: certsData, isLoading } = useQuery({
    queryKey: ["quality-certs", statusFilter],
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        if (statusFilter !== "ALL") params.set("status", statusFilter);
        params.set("limit", "100");
        const res = await api.get(`/quality/certs?${params.toString()}`);
        const payload = res.data?.data ?? res.data;
        return payload as { data: Cert[]; total: number };
      } catch { return { data: [] as Cert[], total: 0 }; }
    },
  });

  const certs = (certsData?.data ?? []).filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.certNumber ?? "").toLowerCase().includes(q) || (c.issuingAuthority ?? "").toLowerCase().includes(q);
  });

  function getDaysUntilExpiry(cert: Cert): number | null {
    if (!cert.expiryDate) return null;
    return Math.ceil((new Date(cert.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Document Vault</h1>
          <p className="text-slate-500 text-sm mt-0.5">Regulatory certificates, licenses & compliance documents</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Add Certificate
        </button>
      </div>

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-5 gap-4">
          {[
            { label: "Total Certificates", value: summary.totalCerts, icon: FileText, color: "bg-slate-50 text-slate-600" },
            { label: "Valid", value: summary.validCerts, icon: CheckCircle2, color: "bg-green-50 text-green-600" },
            { label: "Expiring Soon", value: summary.expiringSoon, icon: Clock, color: "bg-amber-50 text-amber-600" },
            { label: "Expired", value: summary.expired, icon: XCircle, color: "bg-red-50 text-red-600" },
            { label: "Critical Priority", value: summary.criticalCount, icon: AlertTriangle, color: "bg-purple-50 text-purple-600" },
          ].map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div key={kpi.label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${kpi.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{kpi.value}</p>
                    <p className="text-xs text-slate-500">{kpi.label}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upcoming Renewals Alert */}
      {summary && summary.upcomingRenewals.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-800">Upcoming Renewals (next 60 days)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {summary.upcomingRenewals.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-amber-200 rounded-lg text-xs text-amber-800">
                <Calendar className="w-3 h-3" />
                {c.name} — {c.expiryDate ? formatDate(c.expiryDate) : "N/A"}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex bg-slate-100 rounded-lg p-0.5">
          {["ALL", "VALID", "EXPIRING_SOON", "EXPIRED", "PENDING_RENEWAL"].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${statusFilter === s ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              {s === "ALL" ? "All" : s.replace(/_/g, " ")}
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="search" placeholder="Search certificates..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 w-64" />
        </div>
      </div>

      {/* Certificate Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-48 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : certs.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-16 text-center">
          <Shield className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No certificates found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {certs.map((cert) => {
            const daysLeft = getDaysUntilExpiry(cert);
            return (
              <div key={cert.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-slate-900 text-sm leading-tight">{cert.name}</h3>
                  <StatusBadge status={cert.status} />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {cert.priority && <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${PRIORITY_STYLES[cert.priority] ?? ""}`}>{cert.priority}</span>}
                  {cert.category && <span className="text-xs text-slate-400">{cert.category}</span>}
                </div>
                {cert.certNumber && <p className="text-xs text-slate-500 font-mono">#{cert.certNumber}</p>}
                {cert.issuingAuthority && <p className="text-xs text-slate-500">{cert.issuingAuthority}</p>}
                <div className="mt-auto space-y-1 pt-2 border-t border-slate-50">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Issued</span>
                    <span className="text-slate-600">{cert.issueDate ? formatDate(cert.issueDate) : "--"}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Expires</span>
                    <span className={daysLeft !== null && daysLeft < 30 ? "text-red-600 font-medium" : "text-slate-600"}>
                      {cert.expiryDate ? formatDate(cert.expiryDate) : "--"}
                      {daysLeft !== null && daysLeft > 0 && <span className="ml-1 text-slate-400">({daysLeft}d)</span>}
                      {daysLeft !== null && daysLeft <= 0 && <span className="ml-1 text-red-500">(overdue)</span>}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Renewal</span>
                    <span className="text-slate-600">{cert.renewalCycle ?? "--"}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAddModal && (
        <AddCertModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { queryClient.invalidateQueries({ queryKey: ["quality-certs"] }); queryClient.invalidateQueries({ queryKey: ["vault-summary"] }); }}
        />
      )}
    </div>
  );
}
