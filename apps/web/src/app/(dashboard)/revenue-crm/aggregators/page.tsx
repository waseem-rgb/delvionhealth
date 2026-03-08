"use client";

import { useQuery } from "@tanstack/react-query";
import { Smartphone, Plus, IndianRupee } from "lucide-react";
import api from "@/lib/api";

interface B2BAccount {
  id: string;
  type: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  city?: string;
  platformName?: string;
  platformCommissionPct?: number;
  totalRevenue: number;
  revenueMTD: number;
  outstandingAmt: number;
  status: string;
}

const fmt = (n: number) => new Intl.NumberFormat("en-IN").format(n);

export default function AggregatorsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["aggregator-accounts"],
    queryFn: async () => {
      const res = await api.get("/revenue-crm/b2b-accounts", { params: { type: "AGGREGATOR" } });
      const d = res.data?.data ?? res.data;
      return (d?.data ?? d) as B2BAccount[];
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Smartphone className="h-6 w-6 text-cyan-400" />
            Aggregators
          </h1>
          <p className="text-slate-400 text-sm mt-1">Manage platform aggregators and their rev share</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium transition-colors">
          <Plus className="h-4 w-4" />
          Add Aggregator
        </button>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 text-red-400 text-sm">Failed to load aggregators</div>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-5 animate-pulse h-40" />
          ))}
        </div>
      )}

      {!isLoading && !error && (!data || data.length === 0) && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
          <Smartphone className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No aggregator accounts yet.</p>
        </div>
      )}

      {data && data.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map((a) => (
            <div key={a.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-white font-semibold">{a.name}</h3>
                  {a.platformName && <p className="text-slate-400 text-xs mt-0.5">Platform: {a.platformName}</p>}
                  {a.contactPerson && <p className="text-slate-500 text-xs">{a.contactPerson} &middot; {a.city || ""}</p>}
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.status === "ACTIVE" ? "bg-emerald-900/50 text-emerald-400" : "bg-slate-700 text-slate-400"}`}>
                  {a.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-slate-500 text-xs">Total Revenue</p>
                  <p className="text-white font-semibold text-sm flex items-center gap-1"><IndianRupee className="h-3 w-3" />{fmt(Number(a.totalRevenue))}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">MTD Revenue</p>
                  <p className="text-white font-semibold text-sm flex items-center gap-1"><IndianRupee className="h-3 w-3" />{fmt(Number(a.revenueMTD))}</p>
                </div>
              </div>
              {a.platformCommissionPct != null && (
                <p className="text-slate-400 text-xs border-t border-slate-800 pt-2">
                  Platform fee: <span className="text-amber-400 font-medium">{Number(a.platformCommissionPct)}%</span>
                  {Number(a.outstandingAmt) > 0 && <> &middot; Outstanding: <span className="text-red-400">{`\u20B9${fmt(Number(a.outstandingAmt))}`}</span></>}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
