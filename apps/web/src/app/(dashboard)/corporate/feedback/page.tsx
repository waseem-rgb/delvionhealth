"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, X } from "lucide-react";
import api from "@/lib/api";
import { formatDate } from "@/lib/utils";

export default function FeedbackPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const [replyModal, setReplyModal] = useState<any>(null);
  const [replyText, setReplyText] = useState("");

  const { data: feedback, isLoading } = useQuery({
    queryKey: ["all-feedback", status],
    queryFn: async () => {
      const params: any = {};
      if (status) params.status = status;
      const res = await api.get("/corporate/feedback", { params });
      return res.data?.data ?? res.data ?? [];
    },
  });

  const replyMut = useMutation({
    mutationFn: ({ id, reply }: { id: string; reply: string }) =>
      api.post(`/corporate/feedback/${id}/reply`, { reply }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-feedback"] });
      setReplyModal(null);
      setReplyText("");
    },
  });

  const statusColor = (s: string) =>
    s === "OPEN" ? "bg-amber-100 text-amber-700" : s === "REPLIED" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Corporate Feedback</h1>
        <p className="text-sm text-slate-500 mt-0.5">Messages from corporate portals</p>
      </div>

      <div className="flex gap-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
        >
          <option value="">All Status</option>
          <option value="OPEN">Open</option>
          <option value="REPLIED">Replied</option>
          <option value="CLOSED">Closed</option>
        </select>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="bg-white rounded-xl border border-slate-100 p-8 text-center text-slate-400">Loading...</div>
        ) : (!feedback || feedback.length === 0) ? (
          <div className="bg-white rounded-xl border border-slate-100 p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <MessageSquare className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-slate-500 text-sm">No feedback found</p>
          </div>
        ) : (
          (feedback ?? []).map((fb: any) => (
            <div key={fb.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-slate-900">{fb.subject}</h4>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(fb.status)}`}>
                      {fb.status}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mb-2">{fb.message}</p>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span>{fb.corporate?.name}</span>
                    <span>{formatDate(fb.createdAt)}</span>
                    <span>{fb.submittedBy}</span>
                  </div>
                  {fb.reply && (
                    <div className="mt-3 p-3 bg-slate-50 rounded-lg border-l-2 border-[#1B4F8A]">
                      <p className="text-xs text-slate-400 mb-1">Reply · {fb.repliedAt ? formatDate(fb.repliedAt) : ""}</p>
                      <p className="text-sm text-slate-700">{fb.reply}</p>
                    </div>
                  )}
                </div>
                {fb.status === "OPEN" && (
                  <button
                    onClick={() => { setReplyModal(fb); setReplyText(""); }}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 shrink-0"
                  >
                    Reply
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {replyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Reply to Feedback</h3>
              <button onClick={() => setReplyModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-500 mb-1">{replyModal.subject}</p>
              <p className="text-sm text-slate-700">{replyModal.message}</p>
            </div>
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={4}
              placeholder="Type your reply..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30 resize-none"
            />
            <div className="flex gap-2">
              <button onClick={() => setReplyModal(null)} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
              <button
                onClick={() => replyMut.mutate({ id: replyModal.id, reply: replyText })}
                disabled={replyMut.isPending || !replyText.trim()}
                className="flex-1 px-4 py-2 bg-[#1B4F8A] text-white rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {replyMut.isPending ? "Sending..." : "Send Reply"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
