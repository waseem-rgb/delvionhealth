"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { User, Mail, Phone, MapPin, Building2, Award } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

interface DoctorProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  specialty: string | null;
  registrationNumber: string | null;
  clinicName: string | null;
  clinicAddress: string | null;
  city: string | null;
}

export default function DoctorProfilePage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["doctor-profile"],
    queryFn: async () => {
      try {
        const res = await api.get("/portal/doctor/profile");
        return (res.data?.data ?? res.data) as DoctorProfile;
      } catch {
        return null;
      }
    },
  });

  const [form, setForm] = useState({
    phone: "",
    specialty: "",
    clinicName: "",
    clinicAddress: "",
    city: "",
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (data && !loaded) {
      setForm({
        phone: data.phone ?? "",
        specialty: data.specialty ?? "",
        clinicName: data.clinicName ?? "",
        clinicAddress: data.clinicAddress ?? "",
        city: data.city ?? "",
      });
      setLoaded(true);
    }
  }, [data, loaded]);

  const update = useMutation({
    mutationFn: (dto: typeof form) => api.put("/portal/doctor/profile", dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doctor-profile"] });
      toast.success("Profile updated");
    },
    onError: () => toast.error("Failed to update profile"),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
        <div className="bg-white rounded-xl border border-slate-100 p-6 space-y-4">
          {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
        <p className="text-slate-500 text-sm mt-1">Manage your doctor portal profile</p>
      </div>

      {/* Read-only info */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
        <h3 className="font-semibold text-slate-800 text-sm mb-4">Account Information</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <User className="w-4 h-4 text-slate-400" />
            <div>
              <p className="text-xs text-slate-500">Name</p>
              <p className="text-sm font-medium text-slate-800">{data?.name ?? "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Mail className="w-4 h-4 text-slate-400" />
            <div>
              <p className="text-xs text-slate-500">Email</p>
              <p className="text-sm text-slate-800">{data?.email ?? "—"}</p>
            </div>
          </div>
          {data?.registrationNumber && (
            <div className="flex items-center gap-3">
              <Award className="w-4 h-4 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Registration Number</p>
                <p className="text-sm text-slate-800">{data.registrationNumber}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Editable fields */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
        <h3 className="font-semibold text-slate-800 text-sm mb-4">Practice Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              <Phone className="w-3 h-3 inline mr-1" />Phone
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Specialty</label>
            <input
              type="text"
              value={form.specialty}
              onChange={(e) => setForm((p) => ({ ...p, specialty: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              <Building2 className="w-3 h-3 inline mr-1" />Clinic Name
            </label>
            <input
              type="text"
              value={form.clinicName}
              onChange={(e) => setForm((p) => ({ ...p, clinicName: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              <MapPin className="w-3 h-3 inline mr-1" />City
            </label>
            <input
              type="text"
              value={form.city}
              onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-500 mb-1">Clinic Address</label>
            <textarea
              value={form.clinicAddress}
              onChange={(e) => setForm((p) => ({ ...p, clinicAddress: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <button
            onClick={() => update.mutate(form)}
            disabled={update.isPending}
            className="px-5 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:bg-teal-400 transition-colors"
          >
            {update.isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
