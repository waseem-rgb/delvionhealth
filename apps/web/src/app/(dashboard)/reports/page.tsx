"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  Eye,
  FileText,
  Loader2,
  PenLine,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatDateTime } from "@/lib/utils";
import api from "@/lib/api";
import { StatusBadge } from "@/components/shared/StatusBadge";

// ── Types ──────────────────────────────────────────────────────────────────

interface ReportPatient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
}

interface ReportOrder {
  id: string;
  orderNumber: string;
  patient: ReportPatient;
}

interface ReportSignedBy {
  id: string;
  firstName: string;
  lastName: string;
}

interface LabReport {
  id: string;
  reportNumber: string;
  status: string;
  pdfUrl: string | null;
  reportedAt: string | null;
  signedAt: string | null;
  createdAt: string;
  order: ReportOrder;
  signedBy: ReportSignedBy | null;
}

interface ReportsResponse {
  data: LabReport[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

// ── AI Interpretation types ───────────────────────────────────────────────

interface TestResultForAI {
  name: string;
  value: string;
  unit: string;
  refRange: string;
  flag: string;
}

interface AIFinding {
  parameter: string;
  value: string;
  flag: string;
  plainExplanation: string;
  possibleCauses: string[];
}

interface AIInterpretation {
  hasAbnormal: boolean;
  summary: string;
  findings: AIFinding[];
  lifestyleAdvice: string[];
  furtherInvestigations: Array<{ testName: string; reason: string }>;
  specialistReferral: { specialty: string; urgency: string; reason: string } | null;
  disclaimer: string;
}

// ── Status tabs ────────────────────────────────────────────────────────────

const TABS = [
  { key: "", label: "All" },
  { key: "GENERATED", label: "Generated" },
  { key: "SIGNED", label: "Signed" },
  { key: "DELIVERED", label: "Delivered" },
] as const;

const STATUS_BADGE_MAP: Record<string, string> = {
  GENERATED: "bg-blue-100 text-blue-700",
  SIGNED: "bg-purple-100 text-purple-700",
  DELIVERED: "bg-green-100 text-green-700",
};

// ── Deliver channel options ────────────────────────────────────────────────

const DELIVERY_CHANNELS = ["EMAIL", "SMS", "PORTAL", "PRINT", "WHATSAPP"] as const;
type DeliveryChannel = (typeof DELIVERY_CHANNELS)[number];

// ── Component ──────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<string>("");
  const [page, setPage] = useState(1);

  // Modals
  const [signTarget, setSignTarget] = useState<LabReport | null>(null);
  const [deliverTarget, setDeliverTarget] = useState<LabReport | null>(null);
  const [previewReport, setPreviewReport] = useState<LabReport | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [deliveryChannel, setDeliveryChannel] = useState<DeliveryChannel>("EMAIL");

  // AI Interpretation
  const [interpretTarget, setInterpretTarget] = useState<LabReport | null>(null);
  const [interpretation, setInterpretation] = useState<AIInterpretation | null>(null);
  const [interpretLoading, setInterpretLoading] = useState(false);
  const [interpretError, setInterpretError] = useState<string | null>(null);

  const handleInterpret = async (report: LabReport) => {
    setInterpretTarget(report);
    setInterpretation(null);
    setInterpretError(null);
    setInterpretLoading(true);
    try {
      // Fetch test results for this order
      const resultsRes = await api.get(`/results/order/${report.order.id}`);
      const rawResults = (resultsRes.data?.data ?? resultsRes.data) as Array<{
        testCatalog?: { name?: string };
        testName?: string;
        value?: string;
        numericValue?: number;
        unit?: string;
        referenceRange?: string;
        interpretation?: string;
      }>;
      const testResults: TestResultForAI[] = (Array.isArray(rawResults) ? rawResults : []).map((r) => ({
        name: r.testCatalog?.name ?? r.testName ?? "Unknown",
        value: String(r.value ?? r.numericValue ?? ""),
        unit: r.unit ?? "",
        refRange: r.referenceRange ?? "",
        flag: r.interpretation ?? "NORMAL",
      }));

      // Call AI interpretation endpoint
      const aiRes = await api.post("/ai/insights/report-interpretation", {
        testResults,
        patientAge: "",
        patientGender: "",
        doctorName: "",
      });
      const data = (aiRes.data?.data ?? aiRes.data) as AIInterpretation;
      setInterpretation(data);
    } catch {
      setInterpretError("Smart interpretation is not available. Please check AI configuration in Settings.");
    } finally {
      setInterpretLoading(false);
    }
  };

  // Fetch reports
  const { data, isLoading } = useQuery<ReportsResponse>({
    queryKey: ["reports", activeTab, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (activeTab) params.set("status", activeTab);
      const res = await api.get<{ success: boolean; data: ReportsResponse }>(`/reports?${params.toString()}`);
      return res.data.data; // unwrap TransformInterceptor: { success, data: <payload> }
    },
  });

  const reports = data?.data ?? [];
  const meta = data?.meta;

  // Sign mutation
  const signMutation = useMutation({
    mutationFn: async (reportId: string) => {
      await api.post(`/reports/${reportId}/sign`);
    },
    onSuccess: () => {
      toast.success("Report signed successfully");
      setSignTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to sign report";
      toast.error(msg);
    },
  });

  // Deliver mutation
  const deliverMutation = useMutation({
    mutationFn: async ({ id, channel }: { id: string; channel: DeliveryChannel }) => {
      await api.post(`/reports/${id}/deliver`, { channel });
    },
    onSuccess: () => {
      toast.success("Report delivered successfully");
      setDeliverTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to deliver report";
      toast.error(msg);
    },
  });

  const handlePreview = async (report: LabReport) => {
    setPreviewReport(report);
    setPreviewUrl(null);
    setPreviewLoading(true);
    try {
      const res = await api.get<{ data: { url: string } }>(`/reports/${report.id}/download`);
      setPreviewUrl(res.data.data.url);
    } catch {
      toast.error("Failed to get download URL");
      setPreviewReport(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownload = async (report: LabReport) => {
    try {
      const res = await api.get<{ data: { url: string } }>(`/reports/${report.id}/download`);
      window.open(res.data.data.url, "_blank");
    } catch {
      toast.error("Failed to get download URL");
    }
  };

  const statusBadge = (status: string) => (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE_MAP[status] ?? "bg-slate-100 text-slate-600"}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Lab Reports</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Generated reports, PDF downloads, and delivery management
          </p>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setPage(1); }}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? "bg-white text-[#1B4F8A] shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl card-shadow overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 size={24} className="animate-spin text-[#1B4F8A]" />
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <FileText size={32} className="mb-2" />
            <p className="text-sm">No reports found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  {["Report #", "Patient", "Order #", "Status", "Generated", "Signed By", "Actions"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {reports.map((report) => (
                  <tr key={report.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-semibold text-[#1B4F8A]">
                        {report.reportNumber}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800 text-sm">
                        {report.order.patient.firstName} {report.order.patient.lastName}
                      </p>
                      <p className="text-xs text-slate-400 font-mono">{report.order.patient.mrn}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-slate-600">
                        {report.order.orderNumber}
                      </span>
                    </td>
                    <td className="px-4 py-3">{statusBadge(report.status)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {formatDate(report.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {report.signedBy
                        ? `${report.signedBy.firstName} ${report.signedBy.lastName}`
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => void handlePreview(report)}
                          title="Preview PDF"
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-[#1B4F8A] transition-colors"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => void handleDownload(report)}
                          title="Download PDF"
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-[#1B4F8A] transition-colors"
                        >
                          <Download size={14} />
                        </button>
                        {report.status === "GENERATED" && (
                          <button
                            onClick={() => setSignTarget(report)}
                            title="Sign Report"
                            className="p-1.5 hover:bg-purple-50 rounded-lg text-slate-500 hover:text-purple-700 transition-colors"
                          >
                            <PenLine size={14} />
                          </button>
                        )}
                        {report.status === "SIGNED" && (
                          <button
                            onClick={() => setDeliverTarget(report)}
                            title="Deliver Report"
                            className="p-1.5 hover:bg-green-50 rounded-lg text-slate-500 hover:text-green-700 transition-colors"
                          >
                            <Send size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => void handleInterpret(report)}
                          title="Smart Interpretation"
                          className="p-1.5 hover:bg-violet-50 rounded-lg text-slate-500 hover:text-violet-700 transition-colors"
                        >
                          <Sparkles size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
            <span>
              {(page - 1) * meta.limit + 1}–{Math.min(page * meta.limit, meta.total)} of{" "}
              {meta.total} reports
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                disabled={page === meta.totalPages}
                className="px-3 py-1 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── PDF Preview Modal ── */}
      {previewReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col animate-fade-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h3 className="font-semibold text-slate-900">Report Preview</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{previewReport.reportNumber}</p>
              </div>
              <div className="flex items-center gap-2">
                {previewUrl && (
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <Download size={12} />
                    Download
                  </a>
                )}
                <button
                  onClick={() => { setPreviewReport(null); setPreviewUrl(null); }}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="flex-1 relative">
              {previewLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 size={28} className="animate-spin text-[#1B4F8A]" />
                </div>
              ) : previewUrl ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-full rounded-b-2xl"
                  title="Report PDF Preview"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <FileText size={36} className="mb-2" />
                  <p className="text-sm">Failed to load PDF preview</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Sign Report Modal ── */}
      {signTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Sign Report</h3>
              <button
                onClick={() => setSignTarget(null)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"
              >
                <X size={16} />
              </button>
            </div>

            <div className="bg-slate-50 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Report #</span>
                <span className="font-mono font-medium text-xs">{signTarget.reportNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Patient</span>
                <span className="font-medium">
                  {signTarget.order.patient.firstName} {signTarget.order.patient.lastName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Order #</span>
                <span className="font-mono text-xs">{signTarget.order.orderNumber}</span>
              </div>
            </div>

            <p className="text-sm text-slate-600">
              Signing this report confirms that you have reviewed all results and take
              professional responsibility for the findings. The PDF will be regenerated
              with your digital signature.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setSignTarget(null)}
                className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => signMutation.mutate(signTarget.id)}
                disabled={signMutation.isPending}
                className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {signMutation.isPending && <Loader2 size={13} className="animate-spin" />}
                <PenLine size={13} />
                Sign Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Deliver Report Modal ── */}
      {deliverTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Deliver Report</h3>
              <button
                onClick={() => setDeliverTarget(null)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"
              >
                <X size={16} />
              </button>
            </div>

            <div className="bg-slate-50 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Report #</span>
                <span className="font-mono font-medium text-xs">{deliverTarget.reportNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Patient</span>
                <span className="font-medium">
                  {deliverTarget.order.patient.firstName} {deliverTarget.order.patient.lastName}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Delivery Channel
              </label>
              <div className="grid grid-cols-3 gap-2">
                {DELIVERY_CHANNELS.map((ch) => (
                  <button
                    key={ch}
                    onClick={() => setDeliveryChannel(ch)}
                    className={`py-2 px-3 rounded-lg text-xs font-medium border transition-all ${
                      deliveryChannel === ch
                        ? "border-[#1B4F8A] bg-[#1B4F8A]/5 text-[#1B4F8A]"
                        : "border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setDeliverTarget(null)}
                className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deliverMutation.mutate({ id: deliverTarget.id, channel: deliveryChannel })}
                disabled={deliverMutation.isPending}
                className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {deliverMutation.isPending && <Loader2 size={13} className="animate-spin" />}
                <Send size={13} />
                Deliver
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Smart Interpretation Modal ── */}
      {interpretTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-fade-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-violet-600" />
                <div>
                  <h3 className="font-semibold text-slate-900">Smart Interpretation</h3>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">{interpretTarget.reportNumber}</p>
                </div>
              </div>
              <button
                onClick={() => { setInterpretTarget(null); setInterpretation(null); setInterpretError(null); }}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {interpretLoading && (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 size={28} className="animate-spin text-violet-600 mb-3" />
                  <p className="text-sm text-slate-500">Analyzing test results...</p>
                </div>
              )}

              {interpretError && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-amber-800">{interpretError}</p>
                </div>
              )}

              {interpretation && (
                <>
                  {/* Summary */}
                  <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
                    <p className="text-sm text-slate-800 leading-relaxed">{interpretation.summary}</p>
                  </div>

                  {/* Findings */}
                  {interpretation.findings.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800 mb-2">Findings</h4>
                      <div className="space-y-2">
                        {interpretation.findings.map((f, i) => (
                          <div key={i} className="bg-white border border-slate-200 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm text-slate-800">{f.parameter}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                f.flag === "HIGH" ? "bg-red-100 text-red-700"
                                  : f.flag === "LOW" ? "bg-blue-100 text-blue-700"
                                    : f.flag === "CRITICAL" ? "bg-red-200 text-red-800"
                                      : "bg-slate-100 text-slate-600"
                              }`}>{f.flag}</span>
                              <span className="text-xs text-slate-500 ml-auto">{f.value}</span>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">{f.plainExplanation}</p>
                            {f.possibleCauses.length > 0 && (
                              <div className="mt-1.5">
                                <span className="text-[10px] text-slate-400 uppercase tracking-wide">Possible causes:</span>
                                <ul className="mt-0.5 space-y-0.5">
                                  {f.possibleCauses.map((c, j) => (
                                    <li key={j} className="text-xs text-slate-500 flex items-start gap-1">
                                      <span className="text-slate-300 mt-0.5">-</span> {c}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Lifestyle Advice */}
                  {interpretation.lifestyleAdvice.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800 mb-2">Lifestyle Advice</h4>
                      <ul className="space-y-1.5">
                        {interpretation.lifestyleAdvice.map((a, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                            <span className="text-green-500 mt-0.5 flex-shrink-0">+</span> {a}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Further Investigations */}
                  {interpretation.furtherInvestigations.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800 mb-2">Suggested Follow-up Tests</h4>
                      <div className="space-y-1.5">
                        {interpretation.furtherInvestigations.map((inv, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm">
                            <span className="text-blue-500 mt-0.5 flex-shrink-0">{i + 1}.</span>
                            <div>
                              <span className="font-medium text-slate-700">{inv.testName}</span>
                              <span className="text-slate-400"> — {inv.reason}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Specialist Referral */}
                  {interpretation.specialistReferral && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <h4 className="text-sm font-semibold text-amber-800 mb-1">Specialist Referral Suggested</h4>
                      <p className="text-sm text-amber-700">
                        <span className="font-medium">{interpretation.specialistReferral.specialty}</span>
                        {" "}({interpretation.specialistReferral.urgency}) — {interpretation.specialistReferral.reason}
                      </p>
                    </div>
                  )}

                  {/* Disclaimer */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <p className="text-[11px] text-slate-400 leading-relaxed italic">
                      {interpretation.disclaimer}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
