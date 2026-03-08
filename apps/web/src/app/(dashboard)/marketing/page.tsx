"use client";

import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  Users,
  Send,
  Tent,
  Plus,
  ArrowUpRight,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import api from "@/lib/api";
import Link from "next/link";

interface OverviewData {
  kpis: {
    activeDoctors: number;
    newDoctorsThisMonth: number;
    liveCampaigns: number;
    scheduledCampaigns: number;
    campsThisMonth: number;
    campsPax: number;
    totalRevenue: number;
    roi: string;
  };
  topDoctors: Array<{
    id: string;
    name: string;
    specialization: string | null;
    totalReferrals: number;
    totalRevenue: number;
  }>;
  recentActivity: {
    contacts: Array<{
      type: string;
      doctorName: string;
      notes: string | null;
      date: string;
      outcome: string | null;
    }>;
    camps: Array<{
      id: string;
      name: string;
      organiserName: string;
      campDate: string;
      status: string;
      expectedPax: number;
    }>;
  };
}

export default function MarketingOverviewPage() {
  const { data, isLoading } = useQuery<OverviewData>({
    queryKey: ["marketing", "overview"],
    queryFn: async () => {
      const res = await api.get("/marketing/overview");
      return res.data?.data ?? res.data;
    },
  });

  const kpis = data?.kpis ?? {
    activeDoctors: 0, newDoctorsThisMonth: 0, liveCampaigns: 0,
    scheduledCampaigns: 0, campsThisMonth: 0, campsPax: 0,
    totalRevenue: 0, roi: "N/A",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Marketing</h1>
          <p className="text-sm text-slate-500 mt-0.5">Lab growth dashboard — doctors, campaigns, camps & recall</p>
        </div>
        <div className="flex gap-2">
          <Link href="/marketing/doctors" className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 flex items-center gap-1.5">
            <Plus className="h-4 w-4" />Add Doctor
          </Link>
          <Link href="/marketing/campaigns" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1.5">
            <Send className="h-4 w-4" />New Campaign
          </Link>
          <Link href="/marketing/camps" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1.5">
            <Tent className="h-4 w-4" />Schedule Camp
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Active Doctors", value: kpis.activeDoctors, sub: `+${kpis.newDoctorsThisMonth} this month`, icon: Users, color: "text-blue-600 bg-blue-50" },
          { label: "Campaigns Live", value: kpis.liveCampaigns, sub: `${kpis.scheduledCampaigns} scheduled`, icon: Send, color: "text-purple-600 bg-purple-50" },
          { label: "Camps This Month", value: kpis.campsThisMonth, sub: `${kpis.campsPax} expected pax`, icon: Tent, color: "text-orange-600 bg-orange-50" },
          { label: "Marketing Revenue", value: formatCurrency(kpis.totalRevenue), sub: `ROI: ${kpis.roi}x`, icon: TrendingUp, color: "text-emerald-600 bg-emerald-50", isString: true },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-600">{kpi.label}</span>
              <div className={`p-2 rounded-lg ${kpi.color}`}>
                <kpi.icon className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {kpi.isString ? kpi.value : kpi.value}
            </p>
            <p className="text-xs text-slate-500 mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Referring Doctors */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Top Referring Doctors</h3>
            <Link href="/marketing/doctors" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
              View all <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-slate-500">Loading...</div>
          ) : (data?.topDoctors ?? []).length === 0 ? (
            <div className="p-8 text-center text-slate-400">No referring doctors yet. Add your first one!</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {(data?.topDoctors ?? []).map((doc, i) => (
                <div key={doc.id} className="px-6 py-3 flex items-center justify-between hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-slate-400 w-6">{i + 1}</span>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{doc.name}</p>
                      <p className="text-xs text-slate-500">{doc.specialization ?? "General"}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-emerald-600">{formatCurrency(Number(doc.totalRevenue))}</p>
                    <p className="text-xs text-slate-500">{doc.totalReferrals} referrals</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900">Recent Activity</h3>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-slate-500">Loading...</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {(data?.recentActivity?.contacts ?? []).map((c, i) => (
                <div key={i} className="px-6 py-3">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      c.type === "VISIT" ? "bg-blue-100 text-blue-700"
                      : c.type === "CALL" ? "bg-green-100 text-green-700"
                      : c.type === "GIFT" ? "bg-amber-100 text-amber-700"
                      : "bg-slate-100 text-slate-600"
                    }`}>{c.type}</span>
                    <span className="text-xs text-slate-500">{formatDate(c.date)}</span>
                  </div>
                  <p className="text-sm text-slate-800">
                    <span className="font-medium">{c.doctorName}</span>
                    {c.notes ? ` — ${c.notes}` : ""}
                  </p>
                  {c.outcome && (
                    <span className={`text-xs ${c.outcome === "POSITIVE" ? "text-green-600" : "text-slate-500"}`}>
                      Outcome: {c.outcome}
                    </span>
                  )}
                </div>
              ))}
              {(data?.recentActivity?.camps ?? []).map((camp) => (
                <div key={camp.id} className="px-6 py-3">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">CAMP</span>
                    <span className="text-xs text-slate-500">{formatDate(camp.campDate)}</span>
                  </div>
                  <p className="text-sm text-slate-800">
                    <span className="font-medium">{camp.name}</span> — {camp.organiserName}
                  </p>
                  <span className={`text-xs ${camp.status === "CONFIRMED" ? "text-green-600" : "text-slate-500"}`}>
                    {camp.status} — {camp.expectedPax} pax
                  </span>
                </div>
              ))}
              {(data?.recentActivity?.contacts ?? []).length === 0 && (data?.recentActivity?.camps ?? []).length === 0 && (
                <div className="p-8 text-center text-slate-400">No recent activity</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
