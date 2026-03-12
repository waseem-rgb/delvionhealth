"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import api from "@/lib/api";

interface QueueToken {
  tokenDisplay: string;
  patientName: string;
  departmentCode?: string;
  departmentName?: string;
  roomNumber?: string;
}

interface DepartmentQueueSummary {
  id: string;
  code: string;
  name: string;
  shortCode: string;
  waitingCount: number;
  currentToken: QueueToken | null;
  estimatedWaitMinutes: number;
}

interface DisplayData {
  currentToken: QueueToken | null;
  nextTokens: QueueToken[];
  estimatedWait: number;
  departmentTokens: QueueToken[];
}

const HEALTH_TIPS = [
  "Drink at least 8 glasses of water daily for better health",
  "Regular health checkups can detect problems early",
  "A balanced diet is the foundation of good health",
  "30 minutes of daily exercise keeps your heart healthy",
  "Getting enough sleep is crucial for your immune system",
  "Wash your hands frequently to prevent infections",
  "Manage stress through meditation and deep breathing",
  "Avoid smoking and limit alcohol consumption",
];

const DEPT_COLORS = [
  "from-teal-600/30 to-teal-700/20 border-teal-500/30",
  "from-blue-600/30 to-blue-700/20 border-blue-500/30",
  "from-violet-600/30 to-violet-700/20 border-violet-500/30",
  "from-emerald-600/30 to-emerald-700/20 border-emerald-500/30",
  "from-amber-600/30 to-amber-700/20 border-amber-500/30",
  "from-rose-600/30 to-rose-700/20 border-rose-500/30",
];

function Clock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span>
      {time.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
    </span>
  );
}

export default function QueueDisplayPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isKiosk = searchParams.get("kiosk") === "true";
  const [tipIndex, setTipIndex] = useState(0);

  const { data } = useQuery<DisplayData>({
    queryKey: ["queue-display-enhanced"],
    queryFn: async () => {
      const res = await api.get("/front-desk/queue/display");
      return res.data?.data ?? res.data;
    },
    refetchInterval: 10000,
  });

  const { data: deptSummary = [] } = useQuery<DepartmentQueueSummary[]>({
    queryKey: ["dept-queue-summary"],
    queryFn: async () => {
      const res = await api.get("/front-desk/departments/queue-summary");
      return res.data?.data ?? res.data ?? [];
    },
    refetchInterval: 10000,
  });

  useEffect(() => {
    const id = setInterval(() => setTipIndex((i) => (i + 1) % HEALTH_TIPS.length), 30000);
    return () => clearInterval(id);
  }, []);

  // Separate general tokens from department tokens
  const generalTokens = (data?.nextTokens ?? []).filter((t) => !t.departmentCode);
  const activeDepts = deptSummary.filter((d) => d.waitingCount > 0 || d.currentToken);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col text-white z-[9999] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-teal-500 rounded-lg flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
              <path d="M16 2L4 8v8c0 7.73 5.16 14.97 12 16.93C22.84 30.97 28 23.73 28 16V8L16 2z" fill="white" fillOpacity="0.9" />
            </svg>
          </div>
          <span className="text-lg font-bold text-white/80">DELViON Health</span>
        </div>
        <div className="flex items-center gap-5 text-white/40 text-sm">
          <span>{new Date().toLocaleDateString("en-IN", { weekday: "long", month: "long", day: "numeric" })}</span>
          <span className="font-mono text-white/60 text-base"><Clock /></span>
          {!isKiosk && (
            <button
              onClick={() => router.push("/front-desk")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white/60 bg-white/10 border border-white/15 rounded-lg hover:bg-white/20 hover:text-white/80 transition"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              Back to Dashboard
            </button>
          )}
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 flex gap-6 p-8 overflow-hidden">
        {/* Left: General Queue */}
        <div className="flex flex-col items-center justify-center flex-1 space-y-10">
          {/* Now Serving */}
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.5em] text-teal-400 font-semibold mb-5">Now Serving</p>
            {data?.currentToken ? (
              <div className="inline-block bg-gradient-to-b from-teal-600/20 to-teal-800/10 backdrop-blur rounded-2xl px-16 py-10 border border-teal-500/30 shadow-2xl">
                <p className="text-8xl font-black tracking-[0.3em] font-mono text-white drop-shadow-lg">
                  {data.currentToken.tokenDisplay}
                </p>
                <p className="text-base text-white/50 mt-3">{data.currentToken.patientName}</p>
                {data.currentToken.departmentName && (
                  <p className="text-sm text-teal-400/70 mt-1">→ {data.currentToken.departmentName}</p>
                )}
              </div>
            ) : (
              <div className="inline-block bg-white/5 rounded-2xl px-16 py-10 border border-white/10">
                <p className="text-4xl font-bold text-white/20">---</p>
                <p className="text-sm text-white/20 mt-2">No token called yet</p>
              </div>
            )}
          </div>

          {/* Next Up */}
          {generalTokens.length > 0 && (
            <div className="text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-white/30 font-semibold mb-4">Next</p>
              <div className="flex gap-4 justify-center">
                {generalTokens.slice(0, 6).map((token, i) => (
                  <div key={i} className="bg-white/5 rounded-xl px-7 py-4 border border-white/10">
                    <p className="text-xl font-bold font-mono text-white/60">{token.tokenDisplay}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-white/20">
            Estimated wait: ~{data?.estimatedWait ?? 10} minutes
          </p>
        </div>

        {/* Right: Department Queues */}
        {activeDepts.length > 0 && (
          <div className="w-80 flex flex-col gap-3 overflow-y-auto">
            <p className="text-xs uppercase tracking-[0.3em] text-white/30 font-semibold mb-1">Departments</p>
            {deptSummary.map((dept, i) => (
              <div key={dept.id} className={`rounded-xl bg-gradient-to-br ${DEPT_COLORS[i % DEPT_COLORS.length]} border p-4`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-white/90 text-sm">{dept.name}</span>
                  <span className="text-xs bg-white/10 text-white/50 px-2 py-0.5 rounded">
                    {dept.waitingCount} waiting
                  </span>
                </div>
                {dept.currentToken ? (
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-black font-mono text-white">{dept.currentToken.tokenDisplay}</span>
                    <div>
                      <p className="text-xs text-white/50 truncate max-w-[140px]">{dept.currentToken.patientName}</p>
                      {dept.estimatedWaitMinutes > 0 && (
                        <p className="text-xs text-white/30">~{dept.estimatedWaitMinutes}m wait</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-white/20">No active token</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ticker */}
      <div className="border-t border-white/5 bg-teal-900/20 px-8 py-3">
        <p className="text-xs text-teal-300/60 text-center">
          💡 {HEALTH_TIPS[tipIndex]}
        </p>
      </div>
    </div>
  );
}
