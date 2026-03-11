"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { Loader2, Search, RefreshCw, FileText, Plus, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface WorklistItem {
  orderItemId: string;
  orderId: string;
  orderNumber: string;
  reportId: string | null;
  patientId: string;
  patientName: string;
  patientMRN: string;
  patientAge: number | null;
  patientGender: string;
  testName: string;
  testCode: string;
  investigationCategory: string;
  methodology: string;
  clinicalHistory: string | null;
  registeredAt: string;
  reportStatus: string;
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  NOT_STARTED: { label: "Not Started", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  DRAFT: { label: "Draft", cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  PENDING_VERIFICATION: { label: "Pending Verify", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  VERIFIED: { label: "Verified ✓", cls: "bg-teal-50 text-teal-700 border-teal-200" },
  DISPATCHED: { label: "Dispatched ✓", cls: "bg-green-50 text-green-700 border-green-200" },
};

const STATUS_FILTERS = ["All", "NOT_STARTED", "DRAFT", "PENDING_VERIFICATION", "VERIFIED", "DISPATCHED"];

interface Props {
  investigationType: string;
  title: string;
  methodology: string;
  accentColor: string;
}

export default function ModalityWorklist({ investigationType, title, methodology, accentColor }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [dateFilter] = useState(new Date().toISOString().slice(0, 10));

  const queryKey = ["imaging-worklist", investigationType, dateFilter];

  const { data: items = [], isLoading, isError, refetch } = useQuery<WorklistItem[]>({
    queryKey,
    queryFn: async () => {
      const res = await api.get("/non-path/worklist", {
        params: { type: investigationType, date: dateFilter },
      });
      return res.data?.data ?? res.data ?? [];
    },
    refetchInterval: 30000,
  });

  const createReportMutation = useMutation({
    mutationFn: async (orderItemId: string) => {
      const res = await api.post("/non-path/report", { orderItemId });
      return res.data?.data ?? res.data;
    },
    onSuccess: (report) => {
      toast.success("Report created");
      qc.invalidateQueries({ queryKey });
      router.push(`/imaging/report/${report.id}`);
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to create report";
      toast.error(msg);
    },
  });

  const handleOpen = useCallback(
    (item: WorklistItem) => {
      if (item.reportId) {
        router.push(`/imaging/report/${item.reportId}`);
      } else {
        createReportMutation.mutate(item.orderItemId);
      }
    },
    [router, createReportMutation]
  );

  // Auto-open if openItem param is set
  const openItem = searchParams.get("openItem");
  if (openItem && items.length > 0) {
    const found = items.find((i) => i.orderItemId === openItem);
    if (found && !found.reportId && !createReportMutation.isPending) {
      createReportMutation.mutate(openItem);
    }
  }

  const filtered = items.filter((item) => {
    const matchSearch =
      !search ||
      item.patientName.toLowerCase().includes(search.toLowerCase()) ||
      item.patientMRN.toLowerCase().includes(search.toLowerCase()) ||
      item.testName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "All" || item.reportStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  const pending = items.filter((i) => !["VERIFIED", "DISPATCHED"].includes(i.reportStatus)).length;

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className={cn("text-2xl font-bold", accentColor)}>{title}</h1>
          <p className="text-slate-500 text-sm mt-1">{methodology} · {pending} pending today</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patient, MRN, test..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/30"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-full transition border",
                statusFilter === f
                  ? "bg-purple-600 text-white border-transparent"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              )}
            >
              {f === "All" ? "All" : STATUS_CONFIG[f]?.label ?? f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <AlertCircle className="h-8 w-8 text-red-400" />
            <p className="text-red-500 text-sm">Failed to load worklist</p>
            <button onClick={() => refetch()} className="text-xs px-3 py-1.5 bg-red-50 text-red-600 rounded-lg">Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <CheckCircle2 className="h-10 w-10 text-slate-200" />
            <p className="text-slate-400 text-sm">
              {items.length === 0 ? `No ${title} studies registered today` : "No studies match your filters"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Token / Order</th>
                  <th className="px-4 py-3 text-left">Patient</th>
                  <th className="px-4 py-3 text-left">Study</th>
                  <th className="px-4 py-3 text-left hidden md:table-cell">Clinical Hx</th>
                  <th className="px-4 py-3 text-left">Registered</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((item) => {
                  const config = STATUS_CONFIG[item.reportStatus] ?? STATUS_CONFIG.NOT_STARTED;
                  const waitMin = Math.floor((Date.now() - new Date(item.registeredAt).getTime()) / 60000);
                  return (
                    <tr
                      key={item.orderItemId}
                      className="hover:bg-slate-50 transition cursor-pointer"
                      onClick={() => handleOpen(item)}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{item.orderNumber}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{item.patientName}</p>
                        <p className="text-xs text-slate-400">
                          {item.patientMRN}{item.patientAge ? ` · ${item.patientAge}Y` : ""}{item.patientGender ? ` ${item.patientGender[0]}` : ""}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{item.testName}</p>
                        <p className="text-xs text-slate-400">{item.methodology}</p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs text-slate-500 max-w-[160px] truncate">
                        {item.clinicalHistory ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {waitMin < 60 ? `${waitMin}m ago` : `${Math.floor(waitMin / 60)}h ago`}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border", config.cls)}>
                          {config.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleOpen(item); }}
                          disabled={createReportMutation.isPending}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition ml-auto",
                            item.reportId
                              ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                              : "bg-purple-600 text-white hover:bg-purple-700"
                          )}
                        >
                          {createReportMutation.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : item.reportId ? (
                            <>
                              <FileText className="h-3 w-3" />
                              Open
                            </>
                          ) : (
                            <>
                              <Plus className="h-3 w-3" />
                              Start Report
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
