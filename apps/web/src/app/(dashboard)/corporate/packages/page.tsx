"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Package } from "lucide-react";
import api from "@/lib/api";
import { formatDate } from "@/lib/utils";

export default function PackagesPage() {
  const [corporateId, setCorporateId] = useState("");
  const [status, setStatus] = useState("");

  const { data: corporates } = useQuery({
    queryKey: ["corporates-list"],
    queryFn: async () => {
      const res = await api.get("/corporate/corporates", { params: { limit: 100 } });
      return res.data?.data?.data ?? res.data?.data ?? res.data ?? [];
    },
  });

  const { data: packages, isLoading } = useQuery({
    queryKey: ["packages", corporateId, status],
    queryFn: async () => {
      const params: any = {};
      if (corporateId) params.corporateId = corporateId;
      if (status) params.status = status;
      const res = await api.get("/corporate/packages", { params });
      return res.data?.data ?? res.data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Corporate Packages</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage health packages for corporates</p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <select
          value={corporateId}
          onChange={(e) => setCorporateId(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
        >
          <option value="">All Corporates</option>
          {(corporates ?? []).map((c: any) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
        >
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Loading...</div>
        ) : (!packages || packages.length === 0) ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <Package className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-slate-500 text-sm">No packages found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs">
              <tr>
                {["Name", "Code", "Type", "Valid From", "Valid To", "Used/Max", "Net Price", "Status"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(packages ?? []).map((pkg: any) => (
                <tr key={pkg.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{pkg.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{pkg.packageCode}</td>
                  <td className="px-4 py-3 text-slate-500">{pkg.packageType}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(pkg.validFrom)}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(pkg.validTo)}</td>
                  <td className="px-4 py-3 text-slate-600">{pkg.usedCount}/{pkg.maxUses ?? "∞"}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">₹{pkg.netPrice}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${pkg.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>
                      {pkg.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
