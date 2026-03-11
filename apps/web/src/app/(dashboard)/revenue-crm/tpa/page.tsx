"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Shield,
  Building2,
  Clock,
  IndianRupee,
  Plus,
  X,
  Eye,
  ArrowLeft,
  AlertCircle,
  FileText,
  Phone,
  Mail,
  User,
  Calendar,
  Hash,
} from "lucide-react";
import api from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────────

interface TPA {
  id: string;
  name: string;
  type: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  empanelmentDate: string | null;
  empanelmentNo: string | null;
  avgPaymentDays: number;
  thisMonthClaims: number;
  thisMonthValue: number;
  pendingAmount: number;
  rejectionRate: number;
}

interface Claim {
  id: string;
  patientName: string;
  claimNumber: string;
  preAuthCode: string | null;
  claimAmount: number;
  approvedAmount: number | null;
  status: string;
  submittedDate: string;
  agingDays: number;
}

interface AgingBuckets {
  "0-30": number;
  "31-60": number;
  "61-90": number;
  "90+": number;
}

interface ClaimsResponse {
  claims: Claim[];
  agingBuckets: AgingBuckets;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmt = (v: number) => new Intl.NumberFormat("en-IN").format(v);

const statusBadge: Record<string, string> = {
  SUBMITTED: "bg-blue-500/20 text-blue-400",
  UNDER_REVIEW: "bg-amber-500/20 text-amber-400",
  APPROVED: "bg-emerald-500/20 text-emerald-400",
  REJECTED: "bg-red-500/20 text-red-400",
  PAID: "bg-green-500/20 text-green-400",
  PARTIALLY_PAID: "bg-cyan-500/20 text-cyan-400",
  PENDING: "bg-yellow-500/20 text-yellow-400",
};

const typeBadge: Record<string, string> = {
  TPA: "bg-violet-500/20 text-violet-400",
  INSURANCE: "bg-blue-500/20 text-blue-400",
  GOVERNMENT: "bg-emerald-500/20 text-emerald-400",
  CORPORATE: "bg-cyan-500/20 text-cyan-400",
};

// ── Skeleton ───────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="h-3 w-20 bg-slate-100 rounded mb-3" />
            <div className="h-7 w-28 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 h-56" />
        ))}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function TPAPage() {
  const qc = useQueryClient();
  const [showAddTPA, setShowAddTPA] = useState(false);
  const [selectedTPA, setSelectedTPA] = useState<TPA | null>(null);
  const [showAddClaim, setShowAddClaim] = useState<string | null>(null);

  const [tpaForm, setTpaForm] = useState({
    name: "",
    type: "TPA",
    contactPerson: "",
    phone: "",
    email: "",
    empanelmentDate: "",
    empanelmentNo: "",
  });

  const [claimForm, setClaimForm] = useState({
    patientName: "",
    claimNumber: "",
    preAuthCode: "",
    claimAmount: "",
    submittedDate: "",
  });

  // ── Queries ──

  const {
    data: tpas,
    isLoading,
    isError,
    error,
  } = useQuery<TPA[]>({
    queryKey: ["revenue-crm", "tpa"],
    queryFn: async () => {
      const res = await api.get("/revenue-crm/tpa");
      return res.data?.data ?? res.data;
    },
  });

  const {
    data: claimsData,
    isLoading: claimsLoading,
  } = useQuery<ClaimsResponse>({
    queryKey: ["revenue-crm", "tpa", selectedTPA?.id, "claims"],
    queryFn: async () => {
      const res = await api.get(`/revenue-crm/tpa/${selectedTPA!.id}/claims`);
      return res.data?.data ?? res.data;
    },
    enabled: !!selectedTPA,
  });

  // ── Mutations ──

  const createTPA = useMutation({
    mutationFn: async () => {
      const payload = {
        name: tpaForm.name,
        type: tpaForm.type,
        contactPerson: tpaForm.contactPerson || undefined,
        phone: tpaForm.phone || undefined,
        email: tpaForm.email || undefined,
        empanelmentDate: tpaForm.empanelmentDate || undefined,
        empanelmentNo: tpaForm.empanelmentNo || undefined,
      };
      const res = await api.post("/revenue-crm/tpa", payload);
      return res.data?.data ?? res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["revenue-crm", "tpa"] });
      setShowAddTPA(false);
      setTpaForm({ name: "", type: "TPA", contactPerson: "", phone: "", email: "", empanelmentDate: "", empanelmentNo: "" });
    },
  });

  const createClaim = useMutation({
    mutationFn: async (tpaId: string) => {
      const payload = {
        patientName: claimForm.patientName,
        claimNumber: claimForm.claimNumber,
        preAuthCode: claimForm.preAuthCode || undefined,
        claimAmount: Number(claimForm.claimAmount),
        submittedDate: claimForm.submittedDate || undefined,
      };
      const res = await api.post(`/revenue-crm/tpa/${tpaId}/claims`, payload);
      return res.data?.data ?? res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["revenue-crm", "tpa"] });
      if (selectedTPA) {
        qc.invalidateQueries({ queryKey: ["revenue-crm", "tpa", selectedTPA.id, "claims"] });
      }
      setShowAddClaim(null);
      setClaimForm({ patientName: "", claimNumber: "", preAuthCode: "", claimAmount: "", submittedDate: "" });
    },
  });

  // ── Derived stats ──

  const totalTPAs = tpas?.length ?? 0;
  const outstandingAmount = tpas?.reduce((s, t) => s + (t.pendingAmount ?? 0), 0) ?? 0;
  const avgPayDays = totalTPAs > 0
    ? Math.round((tpas?.reduce((s, t) => s + (t.avgPaymentDays ?? 0), 0) ?? 0) / totalTPAs)
    : 0;

  // ── Claims detail view ──

  if (selectedTPA) {
    const buckets = claimsData?.agingBuckets ?? { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
    const totalBuckets = Object.values(buckets).reduce((s, v) => s + v, 0) || 1;
    const claims = claimsData?.claims ?? [];

    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 p-6 space-y-6">
        <button
          onClick={() => setSelectedTPA(null)}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to TPA List
        </button>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{selectedTPA.name}</h1>
            <span className={`text-xs px-2.5 py-1 rounded-full ${typeBadge[selectedTPA.type] ?? "bg-slate-200 text-slate-700"}`}>
              {selectedTPA.type}
            </span>
          </div>
          <button
            onClick={() => setShowAddClaim(selectedTPA.id)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-medium transition-colors"
          >
            <Plus className="h-4 w-4" /> Add Claim
          </button>
        </div>

        {/* Aging Buckets Bar */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Aging Buckets</h3>
          <div className="flex h-6 rounded-full overflow-hidden mb-3">
            {[
              { key: "0-30", color: "bg-emerald-500", label: "0-30 days" },
              { key: "31-60", color: "bg-amber-500", label: "31-60 days" },
              { key: "61-90", color: "bg-orange-500", label: "61-90 days" },
              { key: "90+", color: "bg-red-500", label: "90+ days" },
            ].map((bucket) => {
              const val = buckets[bucket.key as keyof AgingBuckets] ?? 0;
              const pct = (val / totalBuckets) * 100;
              return pct > 0 ? (
                <div
                  key={bucket.key}
                  className={`${bucket.color} transition-all`}
                  style={{ width: `${pct}%` }}
                  title={`${bucket.label}: ${val} claims`}
                />
              ) : null;
            })}
          </div>
          <div className="flex gap-6 text-xs">
            {[
              { key: "0-30", color: "bg-emerald-500", label: "0-30 days" },
              { key: "31-60", color: "bg-amber-500", label: "31-60 days" },
              { key: "61-90", color: "bg-orange-500", label: "61-90 days" },
              { key: "90+", color: "bg-red-500", label: "90+ days" },
            ].map((bucket) => (
              <div key={bucket.key} className="flex items-center gap-1.5">
                <div className={`h-2.5 w-2.5 rounded-full ${bucket.color}`} />
                <span className="text-slate-500">{bucket.label}</span>
                <span className="text-slate-900 font-semibold">{buckets[bucket.key as keyof AgingBuckets] ?? 0}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Claims Table */}
        {claimsLoading ? (
          <div className="animate-pulse">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-4 py-3">
                  <div className="h-4 w-20 bg-slate-100 rounded" />
                  <div className="h-4 w-32 bg-slate-100 rounded" />
                  <div className="h-4 flex-1 bg-slate-100 rounded" />
                </div>
              ))}
            </div>
          </div>
        ) : claims.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl py-16 text-center">
            <FileText className="h-10 w-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No claims found for this TPA</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <th className="text-left px-5 py-3">Date</th>
                    <th className="text-left px-5 py-3">Patient</th>
                    <th className="text-left px-5 py-3">Claim #</th>
                    <th className="text-left px-5 py-3">Pre-Auth</th>
                    <th className="text-right px-5 py-3">Amount</th>
                    <th className="text-right px-5 py-3">Approved</th>
                    <th className="text-center px-5 py-3">Status</th>
                    <th className="text-right px-5 py-3">Aging</th>
                  </tr>
                </thead>
                <tbody>
                  {claims.map((claim) => (
                    <tr key={claim.id} className="border-b border-slate-200/50 hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 text-slate-700">
                        {new Date(claim.submittedDate).toLocaleDateString("en-IN")}
                      </td>
                      <td className="px-5 py-3 text-slate-900 font-medium">{claim.patientName}</td>
                      <td className="px-5 py-3 text-slate-500 font-mono">{claim.claimNumber}</td>
                      <td className="px-5 py-3 text-slate-500">{claim.preAuthCode ?? "-"}</td>
                      <td className="px-5 py-3 text-right text-slate-900 font-medium">₹{fmt(claim.claimAmount)}</td>
                      <td className="px-5 py-3 text-right text-emerald-400">
                        {claim.approvedAmount != null ? `₹${fmt(claim.approvedAmount)}` : "-"}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge[claim.status] ?? "bg-slate-200 text-slate-700"}`}>
                          {claim.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className={`text-sm font-medium ${
                          claim.agingDays > 90 ? "text-red-400" :
                          claim.agingDays > 60 ? "text-orange-400" :
                          claim.agingDays > 30 ? "text-amber-400" :
                          "text-slate-700"
                        }`}>
                          {claim.agingDays}d
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Main TPA list view ──

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">TPA & Insurance</h1>
          <p className="text-slate-500 text-sm mt-1">Manage third-party administrators and insurance claims</p>
        </div>
        <button
          onClick={() => setShowAddTPA(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-medium transition-colors"
        >
          <Plus className="h-4 w-4" /> Add TPA
        </button>
      </div>

      {/* Error */}
      {isError && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          <p className="text-red-300 text-sm">{(error as Error)?.message ?? "Failed to load TPAs"}</p>
        </div>
      )}

      {isLoading ? (
        <Skeleton />
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: "Total TPAs", value: String(totalTPAs), icon: Building2, gradient: "from-violet-500 to-violet-700" },
              { label: "Outstanding Amount", value: `₹${fmt(outstandingAmount)}`, icon: IndianRupee, gradient: "from-amber-500 to-amber-700" },
              { label: "Avg Payment Days", value: `${avgPayDays} days`, icon: Clock, gradient: "from-blue-500 to-blue-700" },
            ].map((stat) => (
              <div key={stat.label} className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${stat.gradient} flex items-center justify-center`}>
                    <stat.icon className="h-5 w-5 text-slate-900" />
                  </div>
                  <span className="text-xs text-slate-500">{stat.label}</span>
                </div>
                <p className="text-xl font-bold">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* TPA Cards */}
          {!tpas || tpas.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl py-16 text-center">
              <Shield className="h-10 w-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">No TPAs added yet</p>
              <p className="text-slate-600 text-xs mt-1">Click &quot;Add TPA&quot; to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tpas.map((tpa) => (
                <div key={tpa.id} className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-semibold truncate">{tpa.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ml-2 ${typeBadge[tpa.type] ?? "bg-slate-200 text-slate-700"}`}>
                      {tpa.type}
                    </span>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Avg Payment Days</span>
                      <span className={`font-medium ${tpa.avgPaymentDays > 60 ? "text-red-400" : tpa.avgPaymentDays > 30 ? "text-amber-400" : "text-emerald-400"}`}>
                        {tpa.avgPaymentDays} days
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">This Month Claims</span>
                      <span className="text-slate-900 font-medium">{tpa.thisMonthClaims} ({`₹${fmt(tpa.thisMonthValue)}`})</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Pending Amount</span>
                      <span className="text-amber-400 font-medium">₹{fmt(tpa.pendingAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Rejection Rate</span>
                      <span className={`font-medium ${tpa.rejectionRate > 20 ? "text-red-400" : tpa.rejectionRate > 10 ? "text-amber-400" : "text-emerald-400"}`}>
                        {tpa.rejectionRate}%
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-3 border-t border-slate-200">
                    <button
                      onClick={() => setSelectedTPA(tpa)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs text-slate-700 transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5" /> View Claims
                    </button>
                    <button
                      onClick={() => setShowAddClaim(tpa.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-xs text-blue-400 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Claim
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Add TPA Modal ──────────────────────────────────────────────────── */}
      {showAddTPA && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white border border-slate-300 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">Add TPA / Insurance</h2>
              <button onClick={() => setShowAddTPA(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">Name</label>
                <input
                  value={tpaForm.name}
                  onChange={(e) => setTpaForm({ ...tpaForm, name: e.target.value })}
                  placeholder="TPA / Insurance name"
                  className="w-full rounded-lg bg-slate-100 border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">Type</label>
                <select
                  value={tpaForm.type}
                  onChange={(e) => setTpaForm({ ...tpaForm, type: e.target.value })}
                  className="w-full rounded-lg bg-slate-100 border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                >
                  {["TPA", "INSURANCE", "GOVERNMENT", "CORPORATE"].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">Contact Person</label>
                  <input
                    value={tpaForm.contactPerson}
                    onChange={(e) => setTpaForm({ ...tpaForm, contactPerson: e.target.value })}
                    placeholder="Optional"
                    className="w-full rounded-lg bg-slate-100 border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">Phone</label>
                  <input
                    value={tpaForm.phone}
                    onChange={(e) => setTpaForm({ ...tpaForm, phone: e.target.value })}
                    placeholder="Optional"
                    className="w-full rounded-lg bg-slate-100 border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">Email</label>
                <input
                  type="email"
                  value={tpaForm.email}
                  onChange={(e) => setTpaForm({ ...tpaForm, email: e.target.value })}
                  placeholder="Optional"
                  className="w-full rounded-lg bg-slate-100 border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">Empanelment Date</label>
                  <input
                    type="date"
                    value={tpaForm.empanelmentDate}
                    onChange={(e) => setTpaForm({ ...tpaForm, empanelmentDate: e.target.value })}
                    className="w-full rounded-lg bg-slate-100 border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">Empanelment No</label>
                  <input
                    value={tpaForm.empanelmentNo}
                    onChange={(e) => setTpaForm({ ...tpaForm, empanelmentNo: e.target.value })}
                    placeholder="Optional"
                    className="w-full rounded-lg bg-slate-100 border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
              <button
                onClick={() => setShowAddTPA(false)}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm text-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => createTPA.mutate()}
                disabled={createTPA.isPending || !tpaForm.name}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
              >
                {createTPA.isPending ? "Adding..." : "Add TPA"}
              </button>
            </div>

            {createTPA.isError && (
              <p className="mt-3 text-sm text-red-400">
                {(createTPA.error as Error)?.message ?? "Failed to add TPA"}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Add Claim Modal ────────────────────────────────────────────────── */}
      {showAddClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white border border-slate-300 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">Add Claim</h2>
              <button onClick={() => setShowAddClaim(null)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">Patient Name</label>
                <input
                  value={claimForm.patientName}
                  onChange={(e) => setClaimForm({ ...claimForm, patientName: e.target.value })}
                  placeholder="Patient full name"
                  className="w-full rounded-lg bg-slate-100 border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">Claim Number</label>
                  <input
                    value={claimForm.claimNumber}
                    onChange={(e) => setClaimForm({ ...claimForm, claimNumber: e.target.value })}
                    placeholder="CLM-XXXX"
                    className="w-full rounded-lg bg-slate-100 border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">Pre-Auth Code</label>
                  <input
                    value={claimForm.preAuthCode}
                    onChange={(e) => setClaimForm({ ...claimForm, preAuthCode: e.target.value })}
                    placeholder="Optional"
                    className="w-full rounded-lg bg-slate-100 border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">Claim Amount (₹)</label>
                  <input
                    type="number"
                    value={claimForm.claimAmount}
                    onChange={(e) => setClaimForm({ ...claimForm, claimAmount: e.target.value })}
                    placeholder="0"
                    className="w-full rounded-lg bg-slate-100 border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">Submitted Date</label>
                  <input
                    type="date"
                    value={claimForm.submittedDate}
                    onChange={(e) => setClaimForm({ ...claimForm, submittedDate: e.target.value })}
                    className="w-full rounded-lg bg-slate-100 border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
              <button
                onClick={() => setShowAddClaim(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm text-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => createClaim.mutate(showAddClaim)}
                disabled={createClaim.isPending || !claimForm.patientName || !claimForm.claimNumber || !claimForm.claimAmount}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
              >
                {createClaim.isPending ? "Adding..." : "Add Claim"}
              </button>
            </div>

            {createClaim.isError && (
              <p className="mt-3 text-sm text-red-400">
                {(createClaim.error as Error)?.message ?? "Failed to add claim"}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
