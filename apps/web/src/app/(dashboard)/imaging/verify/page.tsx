"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  ShieldCheck, Clock, CheckCircle2, ChevronDown, ChevronUp,
  Eye, Loader2, AlertCircle, FileText,
} from "lucide-react";
import api from "@/lib/api";

type VerifyReport = {
  id: string;
  testName: string;
  investigationType: string;
  status: string;
  findings?: string;
  impression?: string;
  reportedByName?: string;
  reportedAt?: string;
  patient: {
    mrn: string;
    firstName: string;
    lastName: string;
    dateOfBirth?: string;
    gender?: string;
  };
  order: {
    orderNumber: string;
    createdAt: string;
  };
  template?: {
    templateName: string;
  };
};

const MODALITY_COLORS: Record<string, string> = {
  "X-RAY": "bg-blue-100 text-blue-700 border-blue-200",
  "CT": "bg-purple-100 text-purple-700 border-purple-200",
  "MRI": "bg-pink-100 text-pink-700 border-pink-200",
  "USG": "bg-cyan-100 text-cyan-700 border-cyan-200",
  "DOPPLER": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "MOLECULAR": "bg-orange-100 text-orange-700 border-orange-200",
  "GENETIC": "bg-rose-100 text-rose-700 border-rose-200",
};

function age(dob?: string) {
  if (!dob) return "—";
  const diff = Date.now() - new Date(dob).getTime();
  return `${Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25))}y`;
}

function ReportRow({ report, onVerified }: { report: VerifyReport; onVerified: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [comment, setComment] = useState("");
  const [showVerifyForm, setShowVerifyForm] = useState(false);
  const router = useRouter();

  const verifyMutation = useMutation({
    mutationFn: () =>
      api.post(`/non-path/report/${report.id}/verify`, { comment }),
    onSuccess: () => {
      setShowVerifyForm(false);
      onVerified();
    },
  });

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                MODALITY_COLORS[report.investigationType] ?? "bg-slate-100 text-slate-600 border-slate-200"
              }`}
            >
              {report.investigationType}
            </span>
            <span className="text-slate-900 font-medium text-sm">{report.testName}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="font-medium text-slate-700">
              {report.patient.firstName} {report.patient.lastName}
            </span>
            <span>MRN: {report.patient.mrn}</span>
            <span>{age(report.patient.dateOfBirth)}</span>
            <span>{report.patient.gender}</span>
            <span>•</span>
            <span>Order: {report.order.orderNumber}</span>
            {report.reportedByName && (
              <>
                <span>•</span>
                <span>By: {report.reportedByName}</span>
              </>
            )}
            {report.reportedAt && (
              <>
                <span>•</span>
                <span>{new Date(report.reportedAt).toLocaleString()}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/imaging/report/${report.id}`);
            }}
            className="flex items-center gap-1 px-2 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            Open Editor
          </button>
          <a
            href={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/api/v1/non-path/report/${report.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 px-2 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            PDF
          </a>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowVerifyForm(true);
              setExpanded(true);
            }}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Verify
          </button>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-200 p-4 space-y-3">
          {report.findings && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide">Findings</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-lg p-3">
                {report.findings}
              </p>
            </div>
          )}
          {report.impression && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide">Impression</p>
              <p className="text-sm text-slate-900 whitespace-pre-wrap bg-slate-50 border-l-4 border-purple-500 rounded-lg p-3">
                {report.impression}
              </p>
            </div>
          )}

          {showVerifyForm && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <p className="text-sm font-medium text-emerald-700 mb-3 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                Verify Report
              </p>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                placeholder="Verification comment (optional)..."
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 outline-none resize-none mb-3"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => verifyMutation.mutate()}
                  disabled={verifyMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {verifyMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  {verifyMutation.isPending ? "Verifying..." : "Confirm Verify"}
                </button>
                <button
                  onClick={() => setShowVerifyForm(false)}
                  className="px-3 py-2 text-sm text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
              {verifyMutation.isError && (
                <p className="mt-2 text-xs text-red-500">Verification failed. Please try again.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function VerifyQueuePage() {
  const qc = useQueryClient();
  const [modalityFilter, setModalityFilter] = useState("ALL");

  const { data: reports = [], isLoading, error } = useQuery<VerifyReport[]>({
    queryKey: ["non-path-verify-queue"],
    queryFn: () =>
      api.get("/non-path/verify/queue").then((r) => r.data as VerifyReport[]),
    refetchInterval: 30_000,
  });

  const filtered = modalityFilter === "ALL"
    ? reports
    : reports.filter((r) => r.investigationType === modalityFilter);

  const modalities = ["ALL", ...Array.from(new Set(reports.map((r) => r.investigationType))).sort()];

  const counts = modalities.slice(1).reduce<Record<string, number>>((acc, m) => {
    acc[m] = reports.filter((r) => r.investigationType === m).length;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Verification Queue</h1>
              <p className="text-sm text-slate-500">
                {reports.length} report{reports.length !== 1 ? "s" : ""} pending verification
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <Clock className="w-3.5 h-3.5" />
            Auto-refreshes every 30s
          </div>
        </div>

        {/* Summary cards */}
        {reports.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-2 mb-5">
            {Object.entries(counts).map(([mod, count]) => (
              <button
                key={mod}
                onClick={() => setModalityFilter(mod)}
                className={`p-3 rounded-xl border text-left transition-colors ${
                  modalityFilter === mod
                    ? "border-purple-400 bg-purple-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="text-lg font-bold text-slate-800">{count}</div>
                <div className="text-xs text-slate-500">{mod}</div>
              </button>
            ))}
          </div>
        )}

        {/* Modality filter pills */}
        <div className="flex items-center gap-1 flex-wrap mb-5">
          {modalities.map((m) => (
            <button
              key={m}
              onClick={() => setModalityFilter(m)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                modalityFilter === m
                  ? "bg-emerald-600 text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:text-slate-900"
              }`}
            >
              {m}
              {m !== "ALL" && counts[m] !== undefined && (
                <span className="ml-1 opacity-70">({counts[m]})</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <AlertCircle className="w-10 h-10 mb-3 text-red-400" />
            <p className="text-red-500">Failed to load verification queue</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <CheckCircle2 className="w-12 h-12 mb-3 text-emerald-400" />
            <p className="text-lg font-medium text-slate-600">All clear!</p>
            <p className="text-sm mt-1">
              {modalityFilter !== "ALL"
                ? `No ${modalityFilter} reports pending verification`
                : "No reports pending verification"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((report) => (
              <ReportRow
                key={report.id}
                report={report}
                onVerified={() => qc.invalidateQueries({ queryKey: ["non-path-verify-queue"] })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
