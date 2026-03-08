"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Tent,
  Plus,
  MapPin,
  Calendar,
  Users,
  CheckCircle2,
  X,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import api from "@/lib/api";

interface Camp {
  id: string;
  name: string;
  organiserName: string;
  organiserType: string | null;
  address: string | null;
  city: string | null;
  campDate: string;
  startTime: string | null;
  endTime: string | null;
  expectedPax: number;
  actualPax: number;
  pricePackage: string | null;
  totalRevenue: number;
  status: string;
  testsOffered: string | null;
  notes: string | null;
}

interface CampStats {
  campsThisMonth: number;
  expectedPax: number;
  actualPax: number;
  revenue: number;
}

const STATUS_COLORS: Record<string, string> = {
  PLANNED: "bg-blue-100 text-blue-700",
  CONFIRMED: "bg-green-100 text-green-700",
  COMPLETED: "bg-purple-100 text-purple-700",
  CANCELLED: "bg-red-100 text-red-700",
};

export default function HealthCampsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [actualPax, setActualPax] = useState("");
  const [form, setForm] = useState({
    name: "", organiserName: "", organiserType: "", address: "", city: "",
    campDate: "", startTime: "", endTime: "", expectedPax: "",
    pricePackage: "", testsOffered: "", notes: "",
  });

  const { data: stats } = useQuery<CampStats>({
    queryKey: ["marketing", "camps", "stats"],
    queryFn: async () => {
      const res = await api.get("/marketing/camps/stats");
      return res.data?.data ?? res.data;
    },
  });

  const { data: camps = [], isLoading } = useQuery<Camp[]>({
    queryKey: ["marketing", "camps"],
    queryFn: async () => {
      const res = await api.get("/marketing/camps");
      return res.data?.data ?? res.data ?? [];
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      await api.post("/marketing/camps", {
        ...form,
        expectedPax: form.expectedPax ? parseInt(form.expectedPax) : 0,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing", "camps"] });
      setShowCreate(false);
      setForm({ name: "", organiserName: "", organiserType: "", address: "", city: "", campDate: "", startTime: "", endTime: "", expectedPax: "", pricePackage: "", testsOffered: "", notes: "" });
    },
  });

  const completeMut = useMutation({
    mutationFn: async () => {
      if (!completingId) return;
      await api.post(`/marketing/camps/${completingId}/complete`, { actualPax: parseInt(actualPax) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing", "camps"] });
      setCompletingId(null);
      setActualPax("");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Health Camps</h1>
          <p className="text-sm text-slate-500 mt-0.5">Schedule and manage collection camps</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 flex items-center gap-2">
          <Plus className="h-4 w-4" />Schedule Camp
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{stats.campsThisMonth}</p>
            <p className="text-xs text-slate-500">This Month</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{stats.expectedPax}</p>
            <p className="text-xs text-slate-500">Expected Pax</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.actualPax}</p>
            <p className="text-xs text-slate-500">Actual Pax</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{formatCurrency(stats.revenue)}</p>
            <p className="text-xs text-slate-500">Revenue</p>
          </div>
        </div>
      )}

      {/* Camp Cards */}
      {isLoading ? (
        <div className="p-8 text-center text-slate-500">Loading...</div>
      ) : camps.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
          No camps scheduled yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {camps.map((camp) => (
            <div key={camp.id} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-900">{camp.name}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[camp.status] ?? STATUS_COLORS.PLANNED}`}>
                  {camp.status}
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-slate-600 mb-3">
                <p className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-slate-400" />{formatDate(camp.campDate)} {camp.startTime ? `${camp.startTime}–${camp.endTime ?? ""}` : ""}</p>
                {camp.address && <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-slate-400" />{camp.address}{camp.city ? `, ${camp.city}` : ""}</p>}
                <p className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-slate-400" />{camp.organiserName} {camp.organiserType ? `(${camp.organiserType})` : ""}</p>
              </div>

              <div className="flex items-center justify-between text-xs mb-3">
                <span>Pax: <strong>{camp.status === "COMPLETED" ? camp.actualPax : camp.expectedPax}</strong> {camp.status === "COMPLETED" ? "actual" : "expected"}</span>
                {camp.pricePackage && <span>Package: <strong>{camp.pricePackage}/person</strong></span>}
                {camp.status === "COMPLETED" && (
                  <span className="text-emerald-600 font-semibold">Revenue: {formatCurrency(Number(camp.totalRevenue))}</span>
                )}
              </div>

              {camp.testsOffered && (
                <p className="text-xs text-slate-500 mb-3">Tests: {camp.testsOffered}</p>
              )}

              <div className="flex gap-2">
                {camp.status !== "COMPLETED" && camp.status !== "CANCELLED" && (
                  <button onClick={() => { setCompletingId(camp.id); setActualPax(String(camp.expectedPax)); }}
                    className="text-xs px-3 py-1.5 rounded bg-green-600 text-white hover:bg-green-700 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />Mark Completed
                  </button>
                )}
              </div>

              {/* Complete Form */}
              {completingId === camp.id && (
                <div className="mt-3 pt-3 border-t border-slate-200 flex items-center gap-3">
                  <input type="number" value={actualPax} onChange={(e) => setActualPax(e.target.value)}
                    placeholder="Actual pax" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm w-28" />
                  <button onClick={() => completeMut.mutate()} disabled={!actualPax || completeMut.isPending}
                    className="text-xs px-3 py-1.5 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
                    Confirm
                  </button>
                  <button onClick={() => setCompletingId(null)} className="text-xs text-slate-500 hover:text-slate-700">Cancel</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Camp Sheet */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end">
          <div className="w-full max-w-lg bg-white h-full overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-slate-900">Schedule Health Camp</h2>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Camp Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="e.g. Wipro Annual Health Camp" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Organiser Name *</label>
                  <input type="text" value={form.organiserName} onChange={(e) => setForm({ ...form, organiserName: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Organiser Type</label>
                  <select value={form.organiserType} onChange={(e) => setForm({ ...form, organiserType: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    <option value="">Select...</option>
                    <option value="CORPORATE">Corporate</option>
                    <option value="SCHOOL">School</option>
                    <option value="APARTMENT">Apartment</option>
                    <option value="NGO">NGO</option>
                    <option value="GOVERNMENT">Government</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
                <input type="date" value={form.campDate} onChange={(e) => setForm({ ...form, campDate: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Start Time</label>
                  <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">End Time</label>
                  <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                  <input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Expected Pax</label>
                  <input type="number" value={form.expectedPax} onChange={(e) => setForm({ ...form, expectedPax: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Price Package (per person)</label>
                <input type="text" value={form.pricePackage} onChange={(e) => setForm({ ...form, pricePackage: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="e.g. 850" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tests Offered</label>
                <input type="text" value={form.testsOffered} onChange={(e) => setForm({ ...form, testsOffered: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="CBC, LFT, KFT, Lipid..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <button onClick={() => createMut.mutate()} disabled={!form.name || !form.organiserName || !form.campDate || createMut.isPending}
                className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {createMut.isPending ? "Saving..." : "Schedule Camp"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
