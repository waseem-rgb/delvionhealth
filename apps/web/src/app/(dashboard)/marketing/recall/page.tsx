"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Repeat,
  Send,
  Eye,
  CheckCircle2,
  Users,
  TrendingUp,
} from "lucide-react";
import api from "@/lib/api";

interface RecallRule {
  id: string;
  name: string;
  description: string;
  triggerType: string;
  channel: string;
  messageTemplate: string;
  audienceCount: number;
  enabled: boolean;
}

interface RecallStats {
  total: number;
  sent: number;
  responded: number;
  converted: number;
}

export default function PatientRecallPage() {
  const qc = useQueryClient();

  const { data: rules = [], isLoading } = useQuery<RecallRule[]>({
    queryKey: ["marketing", "recall", "rules"],
    queryFn: async () => {
      const res = await api.get("/marketing/recall/rules");
      return res.data?.data ?? res.data ?? [];
    },
  });

  const { data: stats } = useQuery<RecallStats>({
    queryKey: ["marketing", "recall", "stats"],
    queryFn: async () => {
      const res = await api.get("/marketing/recall/stats");
      return res.data?.data ?? res.data;
    },
  });

  const triggerMut = useMutation({
    mutationFn: async (ruleType: string) => {
      const res = await api.post(`/marketing/recall/rules/${ruleType}/send`);
      return res.data?.data ?? res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing", "recall"] });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Patient Recall</h1>
        <p className="text-sm text-slate-500 mt-0.5">Automated patient re-engagement engine</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
            <p className="text-xs text-slate-500">Total Engagements</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.sent}</p>
            <p className="text-xs text-slate-500">Sent</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <p className="text-2xl font-bold text-purple-600">{stats.responded}</p>
            <p className="text-xs text-slate-500">Responded</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{stats.converted}</p>
            <p className="text-xs text-slate-500">Converted</p>
          </div>
        </div>
      )}

      {/* Recall Rules */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Recall Rules</h2>
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Loading...</div>
        ) : (
          rules.map((rule) => (
            <div key={rule.id} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-sm font-semibold text-slate-900">{rule.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${rule.enabled ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                      {rule.enabled ? "ON" : "OFF"}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mb-2">{rule.description}</p>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><Send className="h-3 w-3" />Channel: {rule.channel}</span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      <span className="font-semibold text-blue-600">{rule.audienceCount}</span> patients eligible
                    </span>
                  </div>
                  <div className="mt-2 bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-600 italic">&ldquo;{rule.messageTemplate}&rdquo;</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => triggerMut.mutate(rule.id)}
                  disabled={!rule.enabled || rule.audienceCount === 0 || triggerMut.isPending}
                  className="text-xs px-4 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                >
                  <Send className="h-3 w-3" />
                  {triggerMut.isPending ? "Sending..." : "Send Now"}
                </button>
              </div>

              {triggerMut.isSuccess && triggerMut.variables === rule.id && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                  <CheckCircle2 className="h-4 w-4 inline mr-1" />
                  Sent to {(triggerMut.data as { sent: number })?.sent ?? 0} patients
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
