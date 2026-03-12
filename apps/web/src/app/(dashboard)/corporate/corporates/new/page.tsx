"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import api from "@/lib/api";

export default function NewCorporatePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    industry: "",
    address: "",
    city: "",
    pincode: "",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    notes: "",
    // Optional admin
    adminName: "",
    adminDesignation: "",
    adminEmail: "",
    adminPhone: "",
  });
  const [error, setError] = useState("");

  const { data: industries } = useQuery({
    queryKey: ["industries"],
    queryFn: async () => {
      const res = await api.get("/corporate/masters/industries");
      return res.data?.data ?? res.data ?? [];
    },
  });

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post("/corporate/corporates", payload);
      return res.data?.data ?? res.data;
    },
    onSuccess: (data: any) => {
      router.push(`/corporate/corporates/${data.id}`);
    },
    onError: (e: any) => {
      setError(e?.response?.data?.message ?? "Failed to create corporate");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Name is required"); return; }
    if (!form.address.trim()) { setError("Address is required"); return; }
    if (!form.city.trim()) { setError("City is required"); return; }
    if (!form.pincode.trim()) { setError("Pincode is required"); return; }
    if (!form.contactName.trim()) { setError("Contact name is required"); return; }
    if (!form.contactPhone.trim()) { setError("Contact phone is required"); return; }
    if (!form.contactEmail.trim()) { setError("Contact email is required"); return; }
    setError("");
    const payload: any = { ...form };
    // Remove admin fields if not filled
    if (!form.adminEmail.trim()) {
      delete payload.adminEmail;
      delete payload.adminName;
      delete payload.adminDesignation;
      delete payload.adminPhone;
    }
    mutation.mutate(payload);
  }

  const field = (label: string, key: keyof typeof form, type = "text", required = false) => (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
      />
    </div>
  );

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
        <h1 className="text-2xl font-bold text-slate-900">Add New Corporate</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Register a new B2B corporate account
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Corporate Details */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-4">
          <h2 className="font-semibold text-slate-800 text-sm">Corporate Details</h2>
          {field("Company Name", "name", "text", true)}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Industry</label>
            <select
              value={form.industry}
              onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            >
              <option value="">Select industry</option>
              {(industries ?? []).map((ind: any) => (
                <option key={ind.id} value={ind.name}>{ind.name}</option>
              ))}
            </select>
          </div>
          {field("Address", "address", "text", true)}
          <div className="grid grid-cols-2 gap-3">
            {field("City", "city", "text", true)}
            {field("Pincode", "pincode", "text", true)}
          </div>
        </div>

        {/* Contact Details */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-4">
          <h2 className="font-semibold text-slate-800 text-sm">Primary Contact</h2>
          {field("Contact Name", "contactName", "text", true)}
          <div className="grid grid-cols-2 gap-3">
            {field("Phone", "contactPhone", "tel", true)}
            {field("Email", "contactEmail", "email", true)}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30 resize-none"
            />
          </div>
        </div>

        {/* Admin Portal (Optional) */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-4">
          <h2 className="font-semibold text-slate-800 text-sm">
            Admin Portal Access <span className="font-normal text-slate-400">(optional)</span>
          </h2>
          <p className="text-xs text-slate-500">
            Create a portal login for the corporate admin to view reports and events.
          </p>
          {field("Admin Name", "adminName")}
          {field("Designation", "adminDesignation")}
          <div className="grid grid-cols-2 gap-3">
            {field("Admin Email", "adminEmail", "email")}
            {field("Admin Phone", "adminPhone", "tel")}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex-1 px-4 py-2 bg-[#1B4F8A] text-white rounded-lg text-sm font-semibold hover:bg-[#163d6a] disabled:opacity-50 transition"
          >
            {mutation.isPending ? "Creating..." : "Create Corporate"}
          </button>
        </div>
      </form>
    </div>
  );
}
