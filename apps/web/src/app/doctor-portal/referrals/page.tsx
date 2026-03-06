"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, TrendingUp, ClipboardList, IndianRupee, Calendar } from "lucide-react";
import api from "@/lib/api";

interface Referral {
  id: string;
  orderNumber: string;
  patientName: string;
  tests: string[];
  totalAmount: number;
  date: string;
  status: string;
}

interface ReferralStats {
  totalReferrals: number;
  totalRevenue: number;
  thisMonth: number;
  avgOrderValue: number;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};

function fmt(v: number): string {
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(0)}K`;
  return `₹${v.toFixed(0)}`;
}

export default function DoctorReferralsPage() {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["doctor-referrals", search],
    queryFn: async () => {
      try {
        const res = await api.get(`/portal/doctor/referrals?search=${search}&limit=50`);
        return (res.data?.data ?? res.data) as { data: Referral[]; stats: ReferralStats };
      } catch {
        return { data: [] as Referral[], stats: { totalReferrals: 0, totalRevenue: 0, thisMonth: 0, avgOrderValue: 0 } };
      }
    },
    staleTime: 30_000,
  });

  const referrals = data?.data ?? [];
  const stats = data?.stats ?? { totalReferrals: 0, totalRevenue: 0, thisMonth: 0, avgOrderValue: 0 };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Referral History</h1>
        <p className="text-slate-500 text-sm mt-1">Track your referrals and revenue contribution</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Referrals", value: stats.totalReferrals, icon: ClipboardList, color: "bg-blue-50 text-blue-600" },
          { label: "Total Revenue", value: fmt(stats.totalRevenue), icon: IndianRupee, color: "bg-green-50 text-green-600" },
          { label: "This Month", value: stats.thisMonth, icon: Calendar, color: "bg-violet-50 text-violet-600" },
          { label: "Avg Order Value", value: fmt(stats.avgOrderValue), icon: TrendingUp, color: "bg-teal-50 text-teal-600" },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-start justify-between">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{card.label}</p>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.color}`}>
                <card.icon className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl font-bold text-slate-900 mt-1">{isLoading ? "—" : card.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search referrals..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left py-3 px-4 font-medium text-slate-500 text-xs">Order #</th>
                <th className="text-left py-3 px-4 font-medium text-slate-500 text-xs">Patient</th>
                <th className="text-left py-3 px-4 font-medium text-slate-500 text-xs">Tests</th>
                <th className="text-right py-3 px-4 font-medium text-slate-500 text-xs">Amount</th>
                <th className="text-left py-3 px-4 font-medium text-slate-500 text-xs">Date</th>
                <th className="text-left py-3 px-4 font-medium text-slate-500 text-xs">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    {[...Array(6)].map((_, j) => (
                      <td key={j} className="py-3 px-4"><div className="h-4 bg-slate-100 rounded animate-pulse w-20" /></td>
                    ))}
                  </tr>
                ))
              ) : referrals.length > 0 ? (
                referrals.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono text-xs text-slate-500">{r.orderNumber}</td>
                    <td className="py-3 px-4 font-medium text-slate-800">{r.patientName}</td>
                    <td className="py-3 px-4 text-slate-600">
                      <div className="flex flex-wrap gap-1">
                        {r.tests.slice(0, 3).map((t) => (
                          <span key={t} className="bg-slate-100 text-slate-600 text-[10px] px-1.5 py-0.5 rounded">{t}</span>
                        ))}
                        {r.tests.length > 3 && <span className="text-[10px] text-slate-400">+{r.tests.length - 3}</span>}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-slate-800">₹{r.totalAmount.toLocaleString()}</td>
                    <td className="py-3 px-4 text-slate-500 text-xs">{new Date(r.date).toLocaleDateString()}</td>
                    <td className="py-3 px-4">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status] ?? "bg-slate-100 text-slate-600"}`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <ClipboardList className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">No referrals found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
