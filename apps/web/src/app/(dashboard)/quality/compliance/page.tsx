"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Shield,
  ShieldCheck,
  AlertTriangle,
  FileText,
  ClipboardList,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
} from "lucide-react";
import api from "@/lib/api";

interface ComplianceStats {
  complianceScore: number;
  totalForms: number;
  activeForms: number;
  totalEntries: number;
  recentEntries: number;
  totalCerts: number;
  expiredCerts: number;
  expiringSoonCerts: number;
  openCAPAs: number;
  openNCs: number;
  totalAuditEntries: number;
}

function ScoreRing({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#eab308" : "#ef4444";

  return (
    <div className="relative w-36 h-36">
      <svg className="w-36 h-36 -rotate-90">
        <circle cx="72" cy="72" r={radius} stroke="#e2e8f0" strokeWidth="8" fill="none" />
        <circle cx="72" cy="72" r={radius} stroke={color} strokeWidth="8" fill="none" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold" style={{ color }}>{score}</span>
        <span className="text-xs text-slate-400">/ 100</span>
      </div>
    </div>
  );
}

export default function ComplianceDashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["compliance-stats"],
    queryFn: async () => {
      try {
        const res = await api.get("/quality/compliance-stats");
        return (res.data?.data ?? res.data) as ComplianceStats;
      } catch { return null; }
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold text-slate-900">Compliance Dashboard</h1></div>
        <div className="grid grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <div key={i} className="h-28 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  const s = stats ?? {
    complianceScore: 0, totalForms: 0, activeForms: 0, totalEntries: 0, recentEntries: 0,
    totalCerts: 0, expiredCerts: 0, expiringSoonCerts: 0, openCAPAs: 0, openNCs: 0, totalAuditEntries: 0,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Compliance Dashboard</h1>
        <p className="text-slate-500 text-sm mt-0.5">ISO 15189 / NABL audit readiness overview — last 30 days</p>
      </div>

      {/* Main score + summary */}
      <div className="grid grid-cols-12 gap-6">
        {/* Score card */}
        <div className="col-span-3 bg-white rounded-xl border border-slate-100 shadow-sm p-6 flex flex-col items-center justify-center">
          <ScoreRing score={s.complianceScore} />
          <p className="text-sm font-semibold text-slate-700 mt-3">Compliance Score</p>
          <p className="text-xs text-slate-400 mt-1">
            {s.complianceScore >= 80 ? "Audit Ready" : s.complianceScore >= 60 ? "Needs Attention" : "At Risk"}
          </p>
        </div>

        {/* KPI cards grid */}
        <div className="col-span-9 grid grid-cols-3 gap-4">
          {[
            { label: "Quality Forms", value: s.activeForms, sub: `${s.totalForms} total`, icon: ClipboardList, color: "bg-blue-50 text-blue-600" },
            { label: "Form Entries (30d)", value: s.recentEntries, sub: `${s.totalEntries} total`, icon: FileText, color: "bg-teal-50 text-teal-600" },
            { label: "Certificates", value: s.totalCerts, sub: `${s.expiredCerts} expired`, icon: Shield, color: "bg-purple-50 text-purple-600" },
            { label: "Expiring Soon", value: s.expiringSoonCerts, sub: "Within 60 days", icon: Clock, color: "bg-amber-50 text-amber-600" },
            { label: "Open CAPAs", value: s.openCAPAs, sub: "Open + In Progress", icon: AlertTriangle, color: s.openCAPAs > 0 ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600" },
            { label: "Open NCs", value: s.openNCs, sub: "Non-conformances", icon: XCircle, color: s.openNCs > 0 ? "bg-orange-50 text-orange-600" : "bg-green-50 text-green-600" },
          ].map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div key={kpi.label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${kpi.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{kpi.value}</p>
                    <p className="text-xs text-slate-500">{kpi.label}</p>
                    <p className="text-[10px] text-slate-400">{kpi.sub}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Audit activity + quick links */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-blue-500" />
            <h3 className="font-semibold text-slate-900">Audit Trail Activity</h3>
          </div>
          <div className="text-center py-8">
            <p className="text-4xl font-bold text-blue-600">{s.totalAuditEntries}</p>
            <p className="text-sm text-slate-500 mt-1">audit entries in last 30 days</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
            <h3 className="font-semibold text-slate-900">Quality Checklist</h3>
          </div>
          <div className="space-y-3">
            {[
              { check: "All certificates valid", ok: s.expiredCerts === 0, icon: Shield },
              { check: "No open CAPAs", ok: s.openCAPAs === 0, icon: AlertTriangle },
              { check: "No open NCs", ok: s.openNCs === 0, icon: XCircle },
              { check: "Forms seeded", ok: s.totalForms > 0, icon: ClipboardList },
              { check: "Recent form entries exist", ok: s.recentEntries > 0, icon: FileText },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.check} className="flex items-center gap-3">
                  {item.ok ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                  )}
                  <span className={`text-sm ${item.ok ? "text-slate-600" : "text-red-600 font-medium"}`}>{item.check}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
