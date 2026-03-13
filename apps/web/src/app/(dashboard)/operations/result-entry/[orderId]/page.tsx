"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertTriangle,
  AlertCircle,
  Save,
  SendHorizonal,
  PanelRightOpen,
  PanelRightClose,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  FlaskConical,
  User,
  Building2,
  ImageIcon,
} from "lucide-react";
import { PriorityBadge } from "@/components/shared/PriorityBadge";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import api from "@/lib/api";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────

interface OrderResultData {
  orderId: string;
  orderNumber: string;
  orderDate: string;
  priority: "ROUTINE" | "URGENT" | "STAT";
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    age?: number | null;
    gender?: string | null;
    mrn: string;
  };
  referringDoctor?: string | null;
  organization?: string | null;
  tatTotalMinutes: number;
  tatElapsedMinutes: number;
  tests: TestSection[];
}

interface TestSection {
  testId: string;
  testName: string;
  testCode: string;
  department: string;
  parameters: ParameterRow[];
}

interface ParameterRow {
  id: string;
  parameterName: string;
  unit: string;
  referenceRange: string;
  refLow?: number | null;
  refHigh?: number | null;
  draftValue?: string | null;
  previousResults?: PreviousResult[];
}

interface PreviousResult {
  value: string;
  date: string;
  interpretation: string;
}

interface ValidationResponse {
  interpretation: "NORMAL" | "LOW" | "HIGH" | "CRITICAL_LOW" | "CRITICAL_HIGH";
  flag: string;
  message?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function computeTATRemaining(totalMin: number, elapsedMin: number) {
  const remainingMin = totalMin - elapsedMin;
  const pctRemaining = totalMin > 0 ? remainingMin / totalMin : 0;

  let color: "green" | "amber" | "red";
  if (pctRemaining > 0.5) color = "green";
  else if (pctRemaining >= 0.3) color = "amber";
  else color = "red";

  const breached = remainingMin <= 0;
  let display: string;
  if (breached) {
    display = "BREACHED";
  } else {
    const h = Math.floor(remainingMin / 60);
    const m = remainingMin % 60;
    display = h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  return { display, color, breached };
}

const tatBadgeColors = {
  green: "bg-green-50 text-green-700 ring-green-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
};

type FlagType = "NORMAL" | "LOW" | "HIGH" | "CRITICAL_LOW" | "CRITICAL_HIGH" | null;

function flagBgColor(flag: FlagType): string {
  if (!flag) return "";
  if (flag === "NORMAL") return "";
  if (flag === "LOW") return "bg-blue-50";
  if (flag === "HIGH") return "bg-orange-50";
  return "bg-red-50";
}

function flagBadge(flag: FlagType) {
  if (!flag || flag === "NORMAL") return null;
  if (flag === "LOW")
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold text-blue-700 bg-blue-100">
        L
      </span>
    );
  if (flag === "HIGH")
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold text-orange-700 bg-orange-100">
        H
      </span>
    );
  // CRITICAL_LOW or CRITICAL_HIGH
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-bold text-red-700 bg-red-100">
      <AlertCircle size={10} />
      CRITICAL
    </span>
  );
}

function trendArrow(current: string, previous: string) {
  const cur = parseFloat(current);
  const prev = parseFloat(previous);
  if (isNaN(cur) || isNaN(prev)) return <Minus size={12} className="text-slate-400" />;
  if (cur > prev) return <TrendingUp size={12} className="text-red-500" />;
  if (cur < prev) return <TrendingDown size={12} className="text-blue-500" />;
  return <Minus size={12} className="text-slate-400" />;
}

function localInterpret(
  value: string,
  refLow?: number | null,
  refHigh?: number | null
): FlagType {
  const num = parseFloat(value);
  if (isNaN(num) || refLow == null || refHigh == null) return null;
  if (num < refLow * 0.7) return "CRITICAL_LOW";
  if (num > refHigh * 1.5) return "CRITICAL_HIGH";
  if (num < refLow) return "LOW";
  if (num > refHigh) return "HIGH";
  return "NORMAL";
}

// ── Parameter Input Row ────────────────────────────────────────────────────────

function ParameterInputRow({
  param,
  value,
  flag,
  onValueChange,
  onFlagChange,
  showPreviousPanel,
}: {
  param: ParameterRow;
  value: string;
  flag: FlagType;
  onValueChange: (paramId: string, val: string) => void;
  onFlagChange: (paramId: string, flag: FlagType) => void;
  showPreviousPanel: boolean;
}) {
  const handleBlur = useCallback(() => {
    if (!value.trim()) {
      onFlagChange(param.id, null);
      return;
    }
    // Local interpretation as fallback
    const interp = localInterpret(value, param.refLow, param.refHigh);
    onFlagChange(param.id, interp);

    if (interp === "CRITICAL_LOW" || interp === "CRITICAL_HIGH") {
      toast.error(
        `CRITICAL: ${param.parameterName} value ${value} is critically ${interp === "CRITICAL_LOW" ? "low" : "high"}!`,
        { duration: 5000 }
      );
    }
  }, [value, param, onFlagChange]);

  const previousResults = param.previousResults ?? [];

  return (
    <tr className={cn("border-b border-slate-100 hover:bg-slate-50/50 transition-colors", flagBgColor(flag))}>
      <td className="px-4 py-3">
        <span className="text-sm font-medium text-slate-800">{param.parameterName}</span>
      </td>
      <td className="px-4 py-3">
        <input
          type="text"
          value={value}
          onChange={(e) => onValueChange(param.id, e.target.value)}
          onBlur={handleBlur}
          placeholder="--"
          className={cn(
            "w-28 border rounded px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20 focus:border-[#1B4F8A] transition-colors",
            flag === "LOW" && "border-blue-300 bg-blue-50/50",
            flag === "HIGH" && "border-orange-300 bg-orange-50/50",
            (flag === "CRITICAL_LOW" || flag === "CRITICAL_HIGH") &&
              "border-red-400 bg-red-50/70 ring-2 ring-red-200",
            !flag && "border-slate-200"
          )}
        />
      </td>
      <td className="px-4 py-3">
        <span className="text-xs text-slate-500">{param.unit || "--"}</span>
      </td>
      <td className="px-4 py-3">
        <span className="text-xs text-slate-500 font-mono">{param.referenceRange || "--"}</span>
      </td>
      <td className="px-4 py-3 w-24">{flagBadge(flag)}</td>
      {showPreviousPanel && (
        <td className="px-4 py-3">
          {previousResults.length > 0 ? (
            <div className="flex flex-col gap-1">
              {previousResults.slice(0, 3).map((prev, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  {value && trendArrow(value, prev.value)}
                  <span className="text-xs text-slate-500 font-mono">{prev.value}</span>
                  <span className="text-[10px] text-slate-400">
                    {formatDate(prev.date)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-xs text-slate-300">No history</span>
          )}
        </td>
      )}
    </tr>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function ResultEntryPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.orderId as string;
  const queryClient = useQueryClient();

  const [values, setValues] = useState<Record<string, string>>({});
  const [flags, setFlags] = useState<Record<string, FlagType>>({});
  const [interpretation, setInterpretation] = useState("");
  const [showPrevious, setShowPrevious] = useState(true);
  const [isImagingOrder, setIsImagingOrder] = useState(false);

  // Fetch order result data and transform to expected shape
  const { data: orderData, isLoading } = useQuery({
    queryKey: ["operation-result-entry", orderId],
    queryFn: async () => {
      let res;
      try {
        res = await api.get(`/lab/results/${orderId}`);
      } catch (err: unknown) {
        const e = err as { response?: { status?: number; data?: { message?: string } } };
        if (e.response?.status === 400) {
          const msg = e.response.data?.message ?? "";
          if (msg.toLowerCase().includes("imaging") || msg.toLowerCase().includes("no pathology")) {
            setIsImagingOrder(true);
            return null;
          }
        }
        throw err;
      }
      const raw = res.data.data ?? res.data;

      // Transform raw Prisma response → OrderResultData
      const items = raw.items ?? [];
      const maxTatHours = Math.max(
        ...items.map((i: any) => i.testCatalog?.turnaroundHours ?? 24),
        24,
      );
      const startedAt = raw.accessionedAt ?? raw.createdAt;
      const elapsedMin = startedAt
        ? Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000)
        : 0;

      const tests: TestSection[] = items.map((item: any) => {
        const tc = item.testCatalog ?? {};
        const matchedRef = item.matchedReferenceRange ?? null;
        const refRanges = tc.referenceRanges ?? [];
        const bestRef = matchedRef ?? refRanges[0] ?? null;
        const existingResults = item.testResults ?? [];
        const draftResult = existingResults.find((r: any) => r.isDraft);

        return {
          testId: tc.id ?? item.testCatalogId ?? item.id,
          testName: tc.name ?? "Unknown Test",
          testCode: tc.code ?? "",
          department: tc.department ?? "",
          parameters: [
            {
              id: item.id,
              parameterName: tc.name ?? "Result",
              unit: bestRef?.unit ?? existingResults[0]?.unit ?? "",
              referenceRange: bestRef
                ? `${bestRef.lowNormal ?? ""} - ${bestRef.highNormal ?? ""}`.trim()
                : existingResults[0]?.referenceRange ?? "",
              refLow: bestRef?.lowNormal ?? null,
              refHigh: bestRef?.highNormal ?? null,
              draftValue: draftResult?.value ?? null,
              previousResults: (item.previousResults ?? []).map((pr: any) => ({
                value: pr.value ?? String(pr.numericValue ?? ""),
                date: pr.createdAt,
                interpretation: pr.interpretation ?? "NORMAL",
              })),
            },
          ],
        };
      });

      return {
        orderId: raw.id,
        orderNumber: raw.orderNumber,
        orderDate: raw.createdAt,
        priority: raw.priority,
        patient: {
          id: raw.patient?.id,
          firstName: raw.patient?.firstName ?? "",
          lastName: raw.patient?.lastName ?? "",
          age: raw.patientAge ?? null,
          gender: raw.patient?.gender ?? null,
          mrn: raw.patient?.mrn ?? "",
        },
        referringDoctor: null,
        organization: null,
        tatTotalMinutes: maxTatHours * 60,
        tatElapsedMinutes: elapsedMin,
        tests,
      } as OrderResultData;
    },
    enabled: !!orderId,
  });

  // Initialize draft values when data loads
  useEffect(() => {
    if (orderData?.tests) {
      const draftValues: Record<string, string> = {};
      for (const test of orderData.tests) {
        for (const param of test.parameters) {
          if (param.draftValue) {
            draftValues[param.id] = param.draftValue;
          }
        }
      }
      setValues((prev) => {
        // Only set if we haven't already started editing
        const hasEdits = Object.keys(prev).length > 0;
        return hasEdits ? prev : draftValues;
      });
    }
  }, [orderData]);

  // Handle value change
  const handleValueChange = useCallback((paramId: string, val: string) => {
    setValues((prev) => ({ ...prev, [paramId]: val }));
  }, []);

  // Handle flag change
  const handleFlagChange = useCallback((paramId: string, flag: FlagType) => {
    setFlags((prev) => ({ ...prev, [paramId]: flag }));
  }, []);

  // Abnormal findings
  const abnormalFindings = useMemo(() => {
    if (!orderData?.tests) return [];
    const findings: { paramName: string; value: string; flag: FlagType; refRange: string }[] = [];
    for (const test of orderData.tests) {
      for (const param of test.parameters) {
        const f = flags[param.id];
        const v = values[param.id];
        if (f && f !== "NORMAL" && v) {
          findings.push({
            paramName: param.parameterName,
            value: v,
            flag: f,
            refRange: param.referenceRange,
          });
        }
      }
    }
    return findings;
  }, [flags, values, orderData]);

  // Save draft mutation
  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      const results: { orderItemId: string; value: string }[] = [];
      for (const [paramId, value] of Object.entries(values)) {
        if (value.trim()) {
          results.push({ orderItemId: paramId, value });
        }
      }
      await api.post(`/lab/results/${orderId}/draft`, {
        results,
        interpretation,
      });
    },
    onSuccess: () => {
      toast.success("Draft saved successfully");
      void queryClient.invalidateQueries({
        queryKey: ["operation-result-entry", orderId],
      });
    },
    onError: () => {
      toast.error("Failed to save draft");
    },
  });

  // Submit for approval mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      const results: { orderItemId: string; value: string }[] = [];
      for (const [paramId, value] of Object.entries(values)) {
        if (value.trim()) {
          results.push({ orderItemId: paramId, value });
        }
      }
      await api.post(`/lab/results/${orderId}/submit`, {
        results,
        interpretation,
      });
    },
    onSuccess: () => {
      toast.success("Results submitted for approval");
      void queryClient.invalidateQueries({
        queryKey: ["operations-queue"],
      });
      router.push("/operations");
    },
    onError: () => {
      toast.error("Failed to submit results");
    },
  });

  // TAT computation
  const tat = orderData
    ? computeTATRemaining(orderData.tatTotalMinutes, orderData.tatElapsedMinutes)
    : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin text-[#1B4F8A]" />
          <p className="text-sm text-slate-500">Loading order data...</p>
        </div>
      </div>
    );
  }

  if (isImagingOrder) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] text-slate-400">
        <ImageIcon size={40} className="mb-4 text-blue-300" />
        <p className="text-base font-semibold text-slate-700 mb-1">This is an Imaging / Non-Pathology Order</p>
        <p className="text-sm text-slate-500 mb-6 text-center max-w-sm">
          Imaging and non-pathology tests (X-Ray, CT, MRI, USG, Molecular, Genetic) are reported
          via the Imaging Worklist, not the Lab Operations queue.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => router.push("/imaging")}
            className="px-5 py-2 bg-[#1B4F8A] text-white rounded-lg text-sm font-medium hover:bg-[#163d6e] transition-colors"
          >
            Go to Imaging Worklist
          </button>
          <button
            onClick={() => router.push("/operations")}
            className="px-5 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Back to Operations
          </button>
        </div>
      </div>
    );
  }

  if (!orderData) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] text-slate-400">
        <FlaskConical size={32} className="mb-3" />
        <p className="text-sm font-medium">Order not found</p>
        <button
          onClick={() => router.push("/operations")}
          className="mt-4 text-sm text-[#1B4F8A] hover:underline"
        >
          Back to Operations
        </button>
      </div>
    );
  }

  const hasCritical = abnormalFindings.some(
    (f) => f.flag === "CRITICAL_LOW" || f.flag === "CRITICAL_HIGH"
  );

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] animate-fade-in">
      {/* ── Header Bar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 px-6 py-3 bg-white border-b border-slate-200">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/operations")}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            title="Back to Operations"
          >
            <ArrowLeft size={18} className="text-slate-600" />
          </button>
          <div className="h-8 w-px bg-slate-200" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-slate-900">
                {orderData.orderNumber}
              </span>
              <span className="text-slate-300">|</span>
              <span className="text-sm font-medium text-slate-800">
                {orderData.patient.firstName} {orderData.patient.lastName}
              </span>
              <span className="text-xs text-slate-400">
                {[
                  orderData.patient.age ? `${orderData.patient.age}y` : null,
                  orderData.patient.gender,
                ]
                  .filter(Boolean)
                  .join("/")}
              </span>
              <span className="text-slate-300">|</span>
              <span className="text-xs text-slate-500">
                {formatDate(orderData.orderDate)}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {tat && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ring-1",
                tatBadgeColors[tat.color]
              )}
            >
              <Clock size={12} />
              TAT: {tat.display}
            </span>
          )}
          <PriorityBadge priority={orderData.priority} />
          {/* Prev/Next navigation (disabled for now) */}
          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
            <button
              disabled
              className="p-1.5 text-slate-300 cursor-not-allowed"
              title="Previous order"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="w-px h-5 bg-slate-200" />
            <button
              disabled
              className="p-1.5 text-slate-300 cursor-not-allowed"
              title="Next order"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Patient Context Strip ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-6 px-6 py-2.5 bg-slate-50 border-b border-slate-200 text-sm">
        {orderData.referringDoctor && (
          <div className="flex items-center gap-1.5 text-slate-600">
            <User size={13} className="text-slate-400" />
            <span className="text-xs">
              <span className="text-slate-400">Dr.</span> {orderData.referringDoctor}
            </span>
          </div>
        )}
        {orderData.organization && (
          <div className="flex items-center gap-1.5 text-slate-600">
            <Building2 size={13} className="text-slate-400" />
            <span className="text-xs">{orderData.organization}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-slate-600">
          <span className="text-xs text-slate-400">MRN:</span>
          <span className="text-xs font-mono font-medium">{orderData.patient.mrn}</span>
        </div>
        <div className="ml-auto">
          <button
            onClick={() => setShowPrevious(!showPrevious)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors",
              showPrevious
                ? "bg-[#1B4F8A]/10 text-[#1B4F8A]"
                : "text-slate-500 hover:bg-slate-100"
            )}
          >
            {showPrevious ? (
              <PanelRightClose size={13} />
            ) : (
              <PanelRightOpen size={13} />
            )}
            Previous Results
          </button>
        </div>
      </div>

      {/* ── Main Content (scrollable) ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        {/* Test sections */}
        {orderData.tests.map((test) => (
          <div
            key={test.testId}
            className="bg-white rounded-xl border border-slate-200 overflow-hidden"
          >
            {/* Test header */}
            <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <FlaskConical size={15} className="text-[#1B4F8A]" />
                <h3 className="text-sm font-semibold text-slate-800">
                  {test.testCode} -- {test.testName}
                </h3>
              </div>
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
                {test.department}
              </span>
            </div>

            {/* Parameter table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Parameter
                    </th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Value
                    </th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Unit
                    </th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Reference Range
                    </th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Flag
                    </th>
                    {showPrevious && (
                      <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Previous
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {test.parameters.map((param) => (
                    <ParameterInputRow
                      key={param.id}
                      param={param}
                      value={values[param.id] ?? ""}
                      flag={flags[param.id] ?? null}
                      onValueChange={handleValueChange}
                      onFlagChange={handleFlagChange}
                      showPreviousPanel={showPrevious}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {/* Interpretation / Notes */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Interpretation / Comments
          </label>
          <textarea
            value={interpretation}
            onChange={(e) => setInterpretation(e.target.value)}
            rows={3}
            placeholder="Add any clinical observations, comments, or interpretation notes..."
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20 focus:border-[#1B4F8A]"
          />
        </div>

        {/* Abnormal summary */}
        {abnormalFindings.length > 0 && (
          <div
            className={cn(
              "rounded-xl border p-4",
              hasCritical
                ? "bg-red-50 border-red-200"
                : "bg-amber-50 border-amber-200"
            )}
          >
            <div className="flex items-center gap-2 mb-3">
              {hasCritical ? (
                <AlertCircle
                  size={16}
                  className="text-red-600"
                />
              ) : (
                <AlertTriangle
                  size={16}
                  className="text-amber-600"
                />
              )}
              <h4
                className={cn(
                  "text-sm font-semibold",
                  hasCritical ? "text-red-800" : "text-amber-800"
                )}
              >
                {hasCritical
                  ? "Critical Values Detected"
                  : "Abnormal Findings"}
              </h4>
            </div>
            <ul className="space-y-1.5">
              {abnormalFindings.map((f, i) => {
                const isCrit =
                  f.flag === "CRITICAL_LOW" || f.flag === "CRITICAL_HIGH";
                const flagLabel =
                  f.flag === "LOW" || f.flag === "CRITICAL_LOW"
                    ? "LOW"
                    : "HIGH";
                return (
                  <li
                    key={i}
                    className={cn(
                      "text-sm",
                      isCrit ? "text-red-700 font-semibold" : "text-amber-700"
                    )}
                  >
                    {f.paramName}{" "}
                    <span className="font-bold">{flagLabel}</span>: {f.value}{" "}
                    <span className="text-xs opacity-70">
                      (ref {f.refRange})
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Spacer for sticky bottom bar */}
        <div className="h-20" />
      </div>

      {/* ── Sticky Bottom Action Bar ───────────────────────────────────────────── */}
      <div className="sticky bottom-0 flex items-center justify-between gap-3 px-6 py-3 bg-white border-t border-slate-200 shadow-[0_-2px_10px_rgba(0,0,0,0.04)]">
        <div className="text-xs text-slate-400">
          {Object.values(values).filter((v) => v.trim()).length} of{" "}
          {orderData.tests.reduce((sum, t) => sum + t.parameters.length, 0)}{" "}
          parameters filled
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => saveDraftMutation.mutate()}
            disabled={saveDraftMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            {saveDraftMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            Save Draft
          </button>
          <button
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending}
            className="flex items-center gap-2 px-5 py-2 bg-[#1B4F8A] text-white rounded-lg text-sm font-medium hover:bg-[#163d6e] disabled:opacity-50 transition-colors"
          >
            {submitMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <SendHorizonal size={14} />
            )}
            Submit for Approval
          </button>
        </div>
      </div>
    </div>
  );
}
