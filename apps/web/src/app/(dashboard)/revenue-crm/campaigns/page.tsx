"use client";

import { useQuery } from "@tanstack/react-query";
import { Megaphone, Plus, Send, Eye, TrendingUp } from "lucide-react";
import api from "@/lib/api";

interface Campaign {
  id: string;
  name: string;
  type: string;
  channel: string;
  status: string;
  totalTargeted: number;
  totalSent: number;
  totalDelivered: number;
  totalResponded: number;
  totalConverted: number;
  revenueGenerated: number;
  costIncurred: number;
  createdAt: string;
}

const fmt = (n: number) => new Intl.NumberFormat("en-IN").format(n);
const statusColor: Record<string, string> = {
  DRAFT: "bg-slate-700 text-slate-300",
  SCHEDULED: "bg-blue-900/50 text-blue-400",
  ACTIVE: "bg-emerald-900/50 text-emerald-400",
  COMPLETED: "bg-purple-900/50 text-purple-400",
  PAUSED: "bg-amber-900/50 text-amber-400",
};

export default function CampaignsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["crm-campaigns"],
    queryFn: async () => {
      const res = await api.get("/crm/campaigns");
      const d = res.data?.data ?? res.data;
      return (d?.data ?? d) as Campaign[];
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-cyan-400" />
            Digital Campaigns
          </h1>
          <p className="text-slate-400 text-sm mt-1">SMS, WhatsApp, Email campaigns with ROI tracking</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium transition-colors">
          <Plus className="h-4 w-4" />
          New Campaign
        </button>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 text-red-400 text-sm">
          Failed to load campaigns
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-5 animate-pulse h-48" />
          ))}
        </div>
      )}

      {!isLoading && !error && (!data || data.length === 0) && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
          <Megaphone className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No campaigns yet. Create your first campaign to get started.</p>
        </div>
      )}

      {data && data.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map((c) => {
            const roi = c.costIncurred > 0 ? ((Number(c.revenueGenerated) - Number(c.costIncurred)) / Number(c.costIncurred) * 100) : 0;
            return (
              <div key={c.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-white font-semibold">{c.name}</h3>
                    <p className="text-slate-400 text-xs mt-0.5">{c.channel} &middot; {c.type}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[c.status] || "bg-slate-700 text-slate-300"}`}>
                    {c.status}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="flex items-center justify-center gap-1 text-slate-400 text-xs"><Send className="h-3 w-3" /> Sent</div>
                    <p className="text-white font-semibold text-sm">{fmt(c.totalSent)}</p>
                  </div>
                  <div>
                    <div className="flex items-center justify-center gap-1 text-slate-400 text-xs"><Eye className="h-3 w-3" /> Responded</div>
                    <p className="text-white font-semibold text-sm">{fmt(c.totalResponded)}</p>
                  </div>
                  <div>
                    <div className="flex items-center justify-center gap-1 text-slate-400 text-xs"><TrendingUp className="h-3 w-3" /> Converted</div>
                    <p className="text-white font-semibold text-sm">{fmt(c.totalConverted)}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  <span className="text-slate-400 text-xs">Revenue: <span className="text-emerald-400 font-medium">{`\u20B9${fmt(Number(c.revenueGenerated))}`}</span></span>
                  <span className="text-slate-400 text-xs">ROI: <span className={roi > 0 ? "text-emerald-400" : "text-red-400"}>{roi.toFixed(0)}%</span></span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
