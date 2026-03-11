"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { Loader2, Activity, Microscope, Radio, HeartPulse, BarChart2, FlaskConical, Dna, CheckCircle2, Clock, AlertCircle } from "lucide-react";

interface CategoryStats {
  total: number;
  notStarted: number;
  draft: number;
  pendingVerification: number;
  verified: number;
  dispatched: number;
}

interface WorklistItem {
  orderItemId: string;
  reportId: string | null;
  orderNumber: string;
  patientName: string;
  patientMRN: string;
  testName: string;
  investigationCategory: string;
  reportStatus: string;
  registeredAt: string;
}

const MODALITIES = [
  { key: "X-RAY", label: "X-Ray", icon: Activity, color: "from-sky-600/20 to-sky-700/10 border-sky-500/30 text-sky-400", href: "/imaging/xray" },
  { key: "CT", label: "CT Scan", icon: Microscope, color: "from-violet-600/20 to-violet-700/10 border-violet-500/30 text-violet-400", href: "/imaging/ct" },
  { key: "MRI", label: "MRI", icon: Radio, color: "from-blue-600/20 to-blue-700/10 border-blue-500/30 text-blue-400", href: "/imaging/mri" },
  { key: "USG", label: "Ultrasound", icon: HeartPulse, color: "from-teal-600/20 to-teal-700/10 border-teal-500/30 text-teal-400", href: "/imaging/usg" },
  { key: "DOPPLER", label: "Doppler", icon: BarChart2, color: "from-emerald-600/20 to-emerald-700/10 border-emerald-500/30 text-emerald-400", href: "/imaging/doppler" },
  { key: "MOLECULAR", label: "Molecular", icon: FlaskConical, color: "from-amber-600/20 to-amber-700/10 border-amber-500/30 text-amber-400", href: "/imaging/molecular" },
  { key: "GENETIC", label: "Genetics", icon: Dna, color: "from-rose-600/20 to-rose-700/10 border-rose-500/30 text-rose-400", href: "/imaging/genetics" },
];

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  NOT_STARTED: { label: "Not Started", cls: "bg-slate-100 text-slate-600" },
  DRAFT: { label: "Draft", cls: "bg-yellow-100 text-yellow-700" },
  PENDING_VERIFICATION: { label: "Pending Verify", cls: "bg-blue-100 text-blue-700" },
  VERIFIED: { label: "Verified", cls: "bg-teal-100 text-teal-700" },
  DISPATCHED: { label: "Dispatched", cls: "bg-green-100 text-green-700" },
};

export default function ImagingOverviewPage() {
  const router = useRouter();

  const { data: stats, isLoading: statsLoading } = useQuery<Record<string, CategoryStats>>({
    queryKey: ["imaging-stats"],
    queryFn: async () => {
      const res = await api.get("/non-path/worklist/stats");
      return res.data?.data ?? res.data;
    },
    refetchInterval: 30000,
  });

  const { data: worklist = [], isLoading: wlLoading } = useQuery<WorklistItem[]>({
    queryKey: ["imaging-worklist-all"],
    queryFn: async () => {
      const res = await api.get("/non-path/worklist");
      return res.data?.data ?? res.data ?? [];
    },
    refetchInterval: 30000,
  });

  const isLoading = statsLoading || wlLoading;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Imaging & Investigations</h1>
        <p className="text-slate-500 text-sm mt-1">Non-pathology investigation worklist and reporting dashboard</p>
      </div>

      {/* Stats Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          {MODALITIES.map((m) => {
            const s = stats?.[m.key] ?? { total: 0, notStarted: 0, draft: 0, pendingVerification: 0, verified: 0, dispatched: 0 };
            const pending = s.notStarted + s.draft + s.pendingVerification;
            return (
              <button
                key={m.key}
                onClick={() => router.push(m.href)}
                className={cn(
                  "bg-gradient-to-br border rounded-xl p-4 text-left hover:scale-[1.02] transition cursor-pointer",
                  m.color
                )}
              >
                <m.icon className="h-6 w-6 mb-3" />
                <p className="text-xs font-semibold text-slate-700 mb-1">{m.label}</p>
                <p className="text-2xl font-black text-slate-900">{s.total}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {pending > 0 ? (
                    <span className="text-amber-600 font-medium">{pending} pending</span>
                  ) : (
                    <span className="text-green-600">All done</span>
                  )}
                </p>
                {s.verified > 0 && (
                  <p className="text-xs text-teal-600 mt-0.5">{s.verified} verified today</p>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* All Studies Today */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-400" />
            All Studies Today ({worklist.length})
          </h2>
        </div>

        {wlLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : worklist.length === 0 ? (
          <div className="py-12 text-center">
            <CheckCircle2 className="h-10 w-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No imaging studies registered today</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {worklist.slice(0, 30).map((item) => {
              const badge = STATUS_BADGE[item.reportStatus] ?? STATUS_BADGE.NOT_STARTED;
              const timeAgo = Math.floor((Date.now() - new Date(item.registeredAt).getTime()) / 60000);
              const modality = MODALITIES.find((m) => m.key === item.investigationCategory);
              return (
                <div
                  key={item.orderItemId}
                  className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition cursor-pointer"
                  onClick={() => {
                    if (item.reportId) {
                      router.push(`/imaging/report/${item.reportId}`);
                    } else {
                      router.push(`/imaging/${(item.investigationCategory ?? "xray").toLowerCase()}?openItem=${item.orderItemId}`);
                    }
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {modality && <modality.icon className={cn("h-4 w-4 shrink-0", modality.color.split(" ").find((c) => c.startsWith("text-")) ?? "text-slate-400")} />}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{item.patientName}</p>
                      <p className="text-xs text-slate-400">MRN: {item.patientMRN} · {item.orderNumber}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <p className="text-xs text-slate-500 hidden sm:block truncate max-w-[160px]">{item.testName}</p>
                    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", badge.cls)}>{badge.label}</span>
                    <span className="text-xs text-slate-400">{timeAgo < 60 ? `${timeAgo}m ago` : `${Math.floor(timeAgo / 60)}h ago`}</span>
                    <button className="text-xs px-3 py-1 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition font-medium">
                      {item.reportId ? "Open" : "Start"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
