"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

interface DisplayData {
  currentToken: { tokenDisplay: string; patientName: string } | null;
  nextTokens: { tokenDisplay: string; patientName: string }[];
  estimatedWait: number;
}

const HEALTH_TIPS = [
  "Drink at least 8 glasses of water daily for better health",
  "Regular health checkups can detect problems early",
  "A balanced diet is the foundation of good health",
  "30 minutes of daily exercise keeps your heart healthy",
  "Getting enough sleep is crucial for your immune system",
  "Wash your hands frequently to prevent infections",
];

export default function QueueDisplayPage() {
  const { data } = useQuery<DisplayData>({
    queryKey: ["queue-display"],
    queryFn: async () => {
      const res = await api.get("/front-desk/queue/display");
      return res.data?.data ?? res.data;
    },
    refetchInterval: 15000,
  });

  const tipIndex = Math.floor(Date.now() / 30000) % HEALTH_TIPS.length;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center text-white z-[9999]">
      {/* Header */}
      <div className="absolute top-6 left-8 right-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-teal-500 rounded-lg flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
              <path d="M16 2L4 8v8c0 7.73 5.16 14.97 12 16.93C22.84 30.97 28 23.73 28 16V8L16 2z" fill="white" fillOpacity="0.9" />
            </svg>
          </div>
          <span className="text-xl font-bold text-white/80">DELViON Health</span>
        </div>
        <div className="text-sm text-white/40">
          {new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </div>
      </div>

      {/* Main Content */}
      <div className="text-center space-y-12">
        {/* Now Serving */}
        <div>
          <p className="text-sm uppercase tracking-[0.4em] text-teal-400 font-semibold mb-4">Now Serving</p>
          {data?.currentToken ? (
            <div className="inline-block bg-white/10 backdrop-blur rounded-2xl px-16 py-8 border border-white/20">
              <p className="text-7xl font-black tracking-[0.3em] font-mono text-white">
                {data.currentToken.tokenDisplay}
              </p>
              <p className="text-lg text-white/60 mt-2">{data.currentToken.patientName}</p>
            </div>
          ) : (
            <div className="inline-block bg-white/5 rounded-2xl px-16 py-8 border border-white/10">
              <p className="text-4xl font-bold text-white/30">---</p>
              <p className="text-sm text-white/20 mt-2">No token called</p>
            </div>
          )}
        </div>

        {/* Next Up */}
        {data?.nextTokens && data.nextTokens.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/40 font-semibold mb-4">Next Up</p>
            <div className="flex gap-6 justify-center">
              {data.nextTokens.slice(0, 5).map((token, i) => (
                <div key={i} className="bg-white/5 rounded-xl px-8 py-4 border border-white/10">
                  <p className="text-2xl font-bold font-mono text-white/70">{token.tokenDisplay}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Estimated Wait */}
        <p className="text-sm text-white/30">
          Estimated Wait: ~{data?.estimatedWait ?? 10} minutes
        </p>
      </div>

      {/* Health Tip Ticker */}
      <div className="absolute bottom-0 left-0 right-0 bg-teal-600/20 border-t border-teal-500/30 px-8 py-3">
        <p className="text-sm text-teal-300/80 text-center">
          💡 {HEALTH_TIPS[tipIndex]}
        </p>
      </div>
    </div>
  );
}
