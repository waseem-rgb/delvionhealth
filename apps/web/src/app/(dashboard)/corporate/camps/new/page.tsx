"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import api from "@/lib/api";

const EVENT_TYPES = ["HEALTH_CAMP", "ANNUAL_CHECK", "WELLNESS_SESSION", "FITNESS_CHALLENGE", "LOUNGE"];

export default function NewCampPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    corporateId: "",
    locationId: "",
    name: "",
    eventType: "HEALTH_CAMP",
    scheduledDate: "",
    scheduledTime: "",
    venue: "",
    packageId: "",
    notes: "",
  });
  const [error, setError] = useState("");

  const { data: corporates } = useQuery({
    queryKey: ["corporates-list"],
    queryFn: async () => {
      const res = await api.get("/corporate/corporates", { params: { limit: 100 } });
      return res.data?.data?.data ?? res.data?.data ?? res.data ?? [];
    },
  });

  const { data: corpDetail } = useQuery({
    queryKey: ["corporate", form.corporateId],
    queryFn: async () => {
      const res = await api.get(`/corporate/corporates/${form.corporateId}`);
      return res.data?.data ?? res.data;
    },
    enabled: !!form.corporateId,
  });

  const { data: packages } = useQuery({
    queryKey: ["packages-for-corp", form.corporateId],
    queryFn: async () => {
      const res = await api.get("/corporate/packages", { params: { corporateId: form.corporateId } });
      return res.data?.data ?? res.data ?? [];
    },
    enabled: !!form.corporateId,
  });

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post("/corporate/events", payload);
      return res.data?.data ?? res.data;
    },
    onSuccess: (data: any) => {
      router.push(`/corporate/camps/${data.id}`);
    },
    onError: (e: any) => {
      setError(e?.response?.data?.message ?? "Failed to create event");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.corporateId) { setError("Corporate is required"); return; }
    if (!form.name.trim()) { setError("Event name is required"); return; }
    if (!form.scheduledDate) { setError("Scheduled date is required"); return; }
    if (!form.venue.trim()) { setError("Venue is required"); return; }
    setError("");
    const payload: any = { ...form };
    if (!payload.locationId) delete payload.locationId;
    if (!payload.packageId) delete payload.packageId;
    if (!payload.scheduledTime) delete payload.scheduledTime;
    if (!payload.notes) delete payload.notes;
    mutation.mutate(payload);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-3"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <h1 className="text-2xl font-bold text-slate-900">Schedule New Event</h1>
        <p className="text-sm text-slate-500 mt-0.5">Plan a health camp or wellness event</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Corporate <span className="text-red-500">*</span></label>
          <select
            value={form.corporateId}
            onChange={(e) => setForm((f) => ({ ...f, corporateId: e.target.value, locationId: "", packageId: "" }))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
          >
            <option value="">Select corporate</option>
            {(corporates ?? []).map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {form.corporateId && (
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Location (optional)</label>
            <select
              value={form.locationId}
              onChange={(e) => setForm((f) => ({ ...f, locationId: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            >
              <option value="">All locations / HQ</option>
              {(corpDetail?.locations ?? []).map((loc: any) => (
                <option key={loc.id} value={loc.id}>{loc.locationName} — {loc.city}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Event Name <span className="text-red-500">*</span></label>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Annual Health Screening 2026"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Event Type</label>
          <select
            value={form.eventType}
            onChange={(e) => setForm((f) => ({ ...f, eventType: e.target.value }))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
          >
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Date <span className="text-red-500">*</span></label>
            <input
              type="date"
              value={form.scheduledDate}
              onChange={(e) => setForm((f) => ({ ...f, scheduledDate: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Time (optional)</label>
            <input
              type="time"
              value={form.scheduledTime}
              onChange={(e) => setForm((f) => ({ ...f, scheduledTime: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Venue <span className="text-red-500">*</span></label>
          <input
            value={form.venue}
            onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))}
            placeholder="Corporate Office, Tower A"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
          />
        </div>

        {form.corporateId && (
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Package (optional)</label>
            <select
              value={form.packageId}
              onChange={(e) => setForm((f) => ({ ...f, packageId: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            >
              <option value="">No package</option>
              {(packages ?? []).map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={3}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30 resize-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex-1 px-4 py-2 bg-[#1B4F8A] text-white rounded-lg text-sm font-semibold hover:bg-[#163d6a] disabled:opacity-50"
          >
            {mutation.isPending ? "Scheduling..." : "Schedule Event"}
          </button>
        </div>
      </form>
    </div>
  );
}
