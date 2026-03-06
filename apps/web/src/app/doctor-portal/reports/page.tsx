"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, FileText, Download, Eye, X } from "lucide-react";
import api from "@/lib/api";

interface ReportRow {
  id: string;
  reportNumber: string;
  patientName: string;
  orderNumber: string;
  status: string;
  reportedAt: string | null;
  pdfUrl: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  GENERATED: "bg-blue-100 text-blue-700",
  SIGNED: "bg-green-100 text-green-700",
  DELIVERED: "bg-slate-100 text-slate-700",
  DRAFT: "bg-amber-100 text-amber-700",
};

export default function DoctorReportsPage() {
  const [search, setSearch] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["doctor-reports", search],
    queryFn: async () => {
      try {
        const res = await api.get(`/portal/doctor/reports?search=${search}&limit=50`);
        return (res.data?.data ?? res.data) as { data: ReportRow[]; total: number };
      } catch {
        return { data: [] as ReportRow[], total: 0 };
      }
    },
    staleTime: 30_000,
  });

  const reports = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
          <p className="text-slate-500 text-sm mt-1">View and download patient reports</p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by patient name or report number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left py-3 px-4 font-medium text-slate-500 text-xs">Report #</th>
                <th className="text-left py-3 px-4 font-medium text-slate-500 text-xs">Patient</th>
                <th className="text-left py-3 px-4 font-medium text-slate-500 text-xs">Order #</th>
                <th className="text-left py-3 px-4 font-medium text-slate-500 text-xs">Status</th>
                <th className="text-left py-3 px-4 font-medium text-slate-500 text-xs">Date</th>
                <th className="text-right py-3 px-4 font-medium text-slate-500 text-xs">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    {[...Array(6)].map((_, j) => (
                      <td key={j} className="py-3 px-4"><div className="h-4 bg-slate-100 rounded animate-pulse w-20" /></td>
                    ))}
                  </tr>
                ))
              ) : reports.length > 0 ? (
                reports.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono text-xs text-slate-500">{r.reportNumber}</td>
                    <td className="py-3 px-4 font-medium text-slate-800">{r.patientName}</td>
                    <td className="py-3 px-4 text-slate-500 text-xs">{r.orderNumber}</td>
                    <td className="py-3 px-4">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status] ?? "bg-slate-100 text-slate-600"}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-xs">
                      {r.reportedAt ? new Date(r.reportedAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-3 px-4 text-right flex items-center justify-end gap-1">
                      {r.pdfUrl && (
                        <>
                          <button
                            onClick={() => setPreviewUrl(r.pdfUrl)}
                            className="p-1.5 hover:bg-slate-100 rounded-md transition-colors"
                            title="Preview"
                          >
                            <Eye className="w-4 h-4 text-slate-400" />
                          </button>
                          <a
                            href={r.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 hover:bg-slate-100 rounded-md transition-colors"
                            title="Download"
                          >
                            <Download className="w-4 h-4 text-slate-400" />
                          </a>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">No reports found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PDF Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-800">Report Preview</h3>
              <button onClick={() => setPreviewUrl(null)} className="p-1.5 hover:bg-slate-100 rounded-md">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="flex-1 p-2">
              <iframe src={previewUrl} className="w-full h-full rounded border border-slate-200" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
