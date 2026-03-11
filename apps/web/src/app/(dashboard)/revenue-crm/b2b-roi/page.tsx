"use client";

import { BarChart, Building2, Stethoscope, Hospital, Briefcase, Landmark, Smartphone } from "lucide-react";

const CHANNELS = [
  { label: "Doctor Referrals", icon: Stethoscope, color: "bg-emerald-500" },
  { label: "Hospitals & Labs", icon: Hospital, color: "bg-blue-500" },
  { label: "Corporates / AHC", icon: Briefcase, color: "bg-purple-500" },
  { label: "TPA & Insurance", icon: Landmark, color: "bg-amber-500" },
  { label: "Aggregators", icon: Smartphone, color: "bg-pink-500" },
  { label: "B2B Organisations", icon: Building2, color: "bg-cyan-500" },
];

export default function B2BRoiPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <BarChart className="h-6 w-6 text-cyan-400" />
          B2B Revenue
        </h1>
        <p className="text-slate-500 text-sm mt-1">Revenue breakdown by B2B channels and accounts</p>
      </div>

      {/* Channel breakdown */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-slate-900 font-semibold mb-4">Revenue by Channel</h2>
        <div className="space-y-3">
          {CHANNELS.map((ch) => (
            <div key={ch.label} className="flex items-center gap-3">
              <ch.icon className="h-4 w-4 text-slate-500 flex-shrink-0" />
              <span className="text-slate-700 text-sm w-40 flex-shrink-0">{ch.label}</span>
              <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                <div className={`${ch.color} h-full rounded-full opacity-60`} style={{ width: "0%" }} />
              </div>
              <span className="text-slate-500 text-sm w-24 text-right">No data</span>
            </div>
          ))}
        </div>
      </div>

      {/* Placeholder sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-slate-900 font-semibold mb-4">Outstanding Ageing</h2>
          <div className="grid grid-cols-4 gap-3 text-center">
            {["0-30 days", "31-60 days", "61-90 days", "90+ days"].map((bucket) => (
              <div key={bucket} className="bg-slate-100 rounded-lg p-3">
                <p className="text-slate-500 text-xs">{bucket}</p>
                <p className="text-slate-900 font-semibold mt-1">--</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-slate-900 font-semibold mb-4">Top 10 Accounts by Revenue</h2>
          <div className="text-center py-8">
            <Building2 className="h-10 w-10 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">Revenue data will populate as orders are processed</p>
          </div>
        </div>
      </div>
    </div>
  );
}
