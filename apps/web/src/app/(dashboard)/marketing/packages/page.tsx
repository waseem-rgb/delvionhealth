"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Package,
  Plus,
  Share2,
  Edit,
  XCircle,
  Copy,
  X,
  CheckCircle2,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import api from "@/lib/api";

interface LabPackage {
  id: string;
  name: string;
  code: string | null;
  category: string | null;
  description: string | null;
  testIds: string | null;
  mrpPrice: number;
  offerPrice: number | null;
  corporatePrice: number | null;
  validFrom: string | null;
  validTo: string | null;
  isActive: boolean;
  targetGender: string | null;
  targetAgeMin: number | null;
  targetAgeMax: number | null;
}

const CATEGORIES = ["PREVENTIVE", "CORPORATE", "WELLNESS", "DISEASE_SPECIFIC"];

export default function PackagesPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", code: "", category: "", description: "", testIds: "",
    mrpPrice: "", offerPrice: "", corporatePrice: "",
    validFrom: "", validTo: "", targetGender: "ALL",
  });

  const { data: packages = [], isLoading } = useQuery<LabPackage[]>({
    queryKey: ["marketing", "packages"],
    queryFn: async () => {
      const res = await api.get("/marketing/packages");
      return res.data?.data ?? res.data ?? [];
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      await api.post("/marketing/packages", {
        ...form,
        mrpPrice: parseFloat(form.mrpPrice),
        offerPrice: form.offerPrice ? parseFloat(form.offerPrice) : undefined,
        corporatePrice: form.corporatePrice ? parseFloat(form.corporatePrice) : undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing", "packages"] });
      setShowCreate(false);
      setForm({ name: "", code: "", category: "", description: "", testIds: "", mrpPrice: "", offerPrice: "", corporatePrice: "", validFrom: "", validTo: "", targetGender: "ALL" });
    },
  });

  const deactivateMut = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/marketing/packages/${id}`); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marketing", "packages"] }),
  });

  const handleShare = async (id: string) => {
    const res = await api.get(`/marketing/packages/${id}/share`);
    const data = res.data?.data ?? res.data;
    setShareMsg(data.message);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Packages & Offers</h1>
          <p className="text-sm text-slate-500 mt-0.5">Create and manage health check packages</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 flex items-center gap-2">
          <Plus className="h-4 w-4" />Create Package
        </button>
      </div>

      {/* Package Grid */}
      {isLoading ? (
        <div className="p-8 text-center text-slate-500">Loading...</div>
      ) : packages.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
          No packages created yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {packages.map((pkg) => (
            <div key={pkg.id} className={`bg-white rounded-xl border border-slate-200 p-5 ${!pkg.isActive ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{pkg.name}</h3>
                  {pkg.code && <p className="text-xs text-slate-400 font-mono">{pkg.code}</p>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${pkg.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                  {pkg.isActive ? "ACTIVE" : "INACTIVE"}
                </span>
              </div>

              {pkg.category && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 mb-3 inline-block">
                  {pkg.category}
                </span>
              )}

              <div className="space-y-1 my-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">MRP:</span>
                  <span className={`font-medium ${pkg.offerPrice ? "line-through text-slate-400" : "text-slate-900"}`}>
                    {formatCurrency(Number(pkg.mrpPrice))}
                  </span>
                </div>
                {pkg.offerPrice && (
                  <div className="flex justify-between text-sm">
                    <span className="text-emerald-600">Offer:</span>
                    <span className="font-bold text-emerald-600">{formatCurrency(Number(pkg.offerPrice))}</span>
                  </div>
                )}
                {pkg.corporatePrice && (
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-600">Corporate:</span>
                    <span className="font-medium text-blue-600">{formatCurrency(Number(pkg.corporatePrice))}/person</span>
                  </div>
                )}
              </div>

              {pkg.description && (
                <p className="text-xs text-slate-500 mb-3 line-clamp-2">{pkg.description}</p>
              )}

              {pkg.validTo && (
                <p className="text-xs text-slate-400 mb-3">
                  Valid till: {new Date(pkg.validTo).toLocaleDateString("en-IN")}
                </p>
              )}

              <div className="flex gap-2">
                <button onClick={() => handleShare(pkg.id)}
                  className="flex-1 text-xs px-3 py-1.5 rounded border border-green-300 text-green-600 hover:bg-green-50 flex items-center justify-center gap-1">
                  <Share2 className="h-3 w-3" />Share
                </button>
                {pkg.isActive && (
                  <button onClick={() => deactivateMut.mutate(pkg.id)}
                    className="text-xs px-3 py-1.5 rounded border border-red-300 text-red-500 hover:bg-red-50 flex items-center gap-1">
                    <XCircle className="h-3 w-3" />Deactivate
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Share Message Modal */}
      {shareMsg && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Share Message</h3>
              <button onClick={() => setShareMsg(null)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <pre className="text-sm text-slate-800 whitespace-pre-wrap font-sans">{shareMsg}</pre>
            </div>
            <button onClick={() => { navigator.clipboard.writeText(shareMsg); setShareMsg(null); }}
              className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 flex items-center justify-center gap-2">
              <Copy className="h-4 w-4" />Copy to Clipboard
            </button>
          </div>
        </div>
      )}

      {/* Create Package Sheet */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end">
          <div className="w-full max-w-lg bg-white h-full overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-slate-900">Create Package</h2>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Package Name *</label>
                  <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Code</label>
                  <input type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="e.g. BHC-01" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="">Select...</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tests Included</label>
                <input type="text" value={form.testIds} onChange={(e) => setForm({ ...form, testIds: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="CBC, LFT, KFT, Lipid Profile..." />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">MRP *</label>
                  <input type="number" value={form.mrpPrice} onChange={(e) => setForm({ ...form, mrpPrice: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Offer Price</label>
                  <input type="number" value={form.offerPrice} onChange={(e) => setForm({ ...form, offerPrice: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Corporate Price</label>
                  <input type="number" value={form.corporatePrice} onChange={(e) => setForm({ ...form, corporatePrice: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Valid From</label>
                  <input type="date" value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Valid To</label>
                  <input type="date" value={form.validTo} onChange={(e) => setForm({ ...form, validTo: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Target Gender</label>
                <select value={form.targetGender} onChange={(e) => setForm({ ...form, targetGender: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="ALL">All</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                </select>
              </div>
              <button onClick={() => createMut.mutate()} disabled={!form.name || !form.mrpPrice || createMut.isPending}
                className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {createMut.isPending ? "Creating..." : "Create Package"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
