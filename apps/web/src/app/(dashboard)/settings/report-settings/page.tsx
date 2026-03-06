"use client";

import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, X, Loader2, Save, Eye, FileText, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

interface ReportSettings {
  reportHeaderHtml: string | null;
  reportFooterHtml: string | null;
  reportHeaderImageUrl: string | null;
  reportFooterImageUrl: string | null;
  showHeaderFooter: boolean;
  name: string;
}

// ── Tab type ────────────────────────────────────────────────────────────────

type Tab = "header-footer" | "template";

export default function ReportSettingsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("header-footer");

  const [headerHtml, setHeaderHtml] = useState("");
  const [footerHtml, setFooterHtml] = useState("");
  const [headerImageUrl, setHeaderImageUrl] = useState("");
  const [footerImageUrl, setFooterImageUrl] = useState("");
  const [showHeaderFooter, setShowHeaderFooter] = useState(true);
  const [loaded, setLoaded] = useState(false);

  const headerInputRef = useRef<HTMLInputElement>(null);
  const footerInputRef = useRef<HTMLInputElement>(null);

  // ── Fetch settings ────────────────────────────────────────────────────

  const { data: settings, isLoading } = useQuery<ReportSettings>({
    queryKey: ["report-settings"],
    queryFn: async () => {
      const res = await api.get("/tenants/report-settings");
      return res.data.data ?? res.data;
    },
  });

  // Sync state from fetched settings (once)
  if (settings && !loaded) {
    setHeaderHtml(settings.reportHeaderHtml || "");
    setFooterHtml(settings.reportFooterHtml || "");
    setHeaderImageUrl(settings.reportHeaderImageUrl || "");
    setFooterImageUrl(settings.reportFooterImageUrl || "");
    setShowHeaderFooter(settings.showHeaderFooter);
    setLoaded(true);
  }

  // ── Save mutation ─────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await api.put("/tenants/report-settings", {
        reportHeaderHtml: headerHtml || null,
        reportFooterHtml: footerHtml || null,
        reportHeaderImageUrl: headerImageUrl || null,
        reportFooterImageUrl: footerImageUrl || null,
        showHeaderFooter,
      });
      return res.data.data ?? res.data;
    },
    onSuccess: () => {
      toast.success("Report settings saved");
      queryClient.invalidateQueries({ queryKey: ["report-settings"] });
    },
    onError: () => toast.error("Failed to save settings"),
  });

  // ── Image upload ──────────────────────────────────────────────────────

  const uploadImage = useCallback(
    async (file: File, type: "header" | "footer") => {
      const form = new FormData();
      form.append("file", file);
      try {
        const res = await api.post(`/tenants/upload-report-image?type=${type}`, form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        const data = res.data.data ?? res.data;
        if (type === "header") setHeaderImageUrl(data.url);
        else setFooterImageUrl(data.url);
        toast.success(`${type === "header" ? "Header" : "Footer"} image uploaded`);
      } catch {
        toast.error("Upload failed");
      }
    },
    [],
  );

  // ── Render ────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-[#0D7E8A]" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Report Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Configure how your lab reports look — header, footer, and branding
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {([
          { key: "header-footer" as Tab, label: "Header & Footer" },
          { key: "template" as Tab, label: "Report Template" },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-md transition",
              tab === t.key
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── TAB 1: Header & Footer ─────────────────────────────────────── */}
      {tab === "header-footer" && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left Side — Upload options */}
          <div className="lg:col-span-3 space-y-6">
            {/* Show toggle */}
            <div className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl">
              <div>
                <p className="text-sm font-semibold text-slate-800">Show Header & Footer on Reports</p>
                <p className="text-xs text-slate-500">When enabled, your custom header/footer will appear on all generated report PDFs</p>
              </div>
              <button
                onClick={() => setShowHeaderFooter(!showHeaderFooter)}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  showHeaderFooter ? "bg-[#0D7E8A]" : "bg-slate-300"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    showHeaderFooter ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
            </div>

            {/* Report Header Section */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#0D7E8A]" />
                Report Header
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {/* Image upload */}
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-2">Upload Image</p>
                  {headerImageUrl ? (
                    <div className="relative">
                      <img
                        src={headerImageUrl}
                        alt="Header"
                        className="w-full h-20 object-contain border rounded-lg bg-slate-50 p-1"
                      />
                      <button
                        onClick={() => setHeaderImageUrl("")}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center hover:bg-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-20 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-[#0D7E8A] hover:bg-[#0D7E8A]/5 transition">
                      <Upload className="w-4 h-4 text-slate-400" />
                      <span className="text-xs text-slate-400 mt-1">Upload Image</span>
                      <input
                        ref={headerInputRef}
                        type="file"
                        accept=".png,.jpg,.jpeg"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadImage(f, "header");
                        }}
                      />
                    </label>
                  )}
                  <p className="text-[10px] text-slate-400 mt-1">Recommended: 1200×200px · PNG, JPEG</p>
                </div>

                {/* HTML option */}
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-2">Or custom HTML</p>
                  <textarea
                    value={headerHtml}
                    onChange={(e) => setHeaderHtml(e.target.value)}
                    placeholder="<div>Your header content...</div>"
                    rows={4}
                    className="w-full text-xs font-mono border border-slate-200 rounded-lg p-2 resize-none focus:ring-1 focus:ring-[#0D7E8A] focus:border-[#0D7E8A] outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">HTML will be rendered inside the report PDF</p>
                </div>
              </div>
            </div>

            {/* Report Footer Section */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#0D7E8A]" />
                Report Footer
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {/* Image upload */}
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-2">Upload Image</p>
                  {footerImageUrl ? (
                    <div className="relative">
                      <img
                        src={footerImageUrl}
                        alt="Footer"
                        className="w-full h-20 object-contain border rounded-lg bg-slate-50 p-1"
                      />
                      <button
                        onClick={() => setFooterImageUrl("")}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center hover:bg-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-20 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-[#0D7E8A] hover:bg-[#0D7E8A]/5 transition">
                      <Upload className="w-4 h-4 text-slate-400" />
                      <span className="text-xs text-slate-400 mt-1">Upload Image</span>
                      <input
                        ref={footerInputRef}
                        type="file"
                        accept=".png,.jpg,.jpeg"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadImage(f, "footer");
                        }}
                      />
                    </label>
                  )}
                  <p className="text-[10px] text-slate-400 mt-1">Recommended: 1200×100px · PNG, JPEG</p>
                </div>

                {/* HTML option */}
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-2">Or custom HTML</p>
                  <textarea
                    value={footerHtml}
                    onChange={(e) => setFooterHtml(e.target.value)}
                    placeholder="<div>Your footer content...</div>"
                    rows={4}
                    className="w-full text-xs font-mono border border-slate-200 rounded-lg p-2 resize-none focus:ring-1 focus:ring-[#0D7E8A] focus:border-[#0D7E8A] outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Save Button */}
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="px-6 py-2.5 bg-[#0D7E8A] text-white text-sm font-medium rounded-lg hover:bg-[#0B6B75] disabled:opacity-50 flex items-center gap-2"
            >
              {saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Settings
            </button>
          </div>

          {/* Right Side — Live Preview */}
          <div className="lg:col-span-2">
            <div className="sticky top-6">
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Live Preview
              </h3>
              <div className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
                <div className="p-3 bg-slate-50 border-b border-slate-200">
                  <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Report Preview (A4 scaled)</p>
                </div>
                <div className="p-4 space-y-3" style={{ fontSize: "8px" }}>
                  {/* Header preview */}
                  {showHeaderFooter && (
                    <div className="border-b border-slate-200 pb-3">
                      {headerImageUrl ? (
                        <img src={headerImageUrl} alt="Header" className="w-full h-12 object-contain" />
                      ) : headerHtml ? (
                        <div
                          className="text-[8px]"
                          dangerouslySetInnerHTML={{ __html: headerHtml }}
                        />
                      ) : (
                        <div className="text-center">
                          <p className="text-[11px] font-bold text-[#0D7E8A]">{settings?.name || "Lab Name"}</p>
                          <p className="text-[7px] text-slate-400">Address Line · Phone · Email</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Sample body */}
                  <div className="space-y-2">
                    <div className="bg-sky-50 border border-sky-200 rounded p-2 grid grid-cols-4 gap-1">
                      {["Patient: John Doe", "MRN: DH-2026-000001", "Age: 32Y / Male", "Phone: +91 9876543210"].map((t) => (
                        <div key={t}>
                          <p className="text-[6px] text-slate-400">{t.split(":")[0]}</p>
                          <p className="text-[7px] font-semibold text-slate-700">{t.split(":")[1]}</p>
                        </div>
                      ))}
                    </div>

                    <p className="text-center text-[9px] font-bold text-slate-700 py-1">LABORATORY TEST REPORT</p>

                    <table className="w-full text-[7px]">
                      <thead>
                        <tr className="bg-[#0D7E8A] text-white">
                          <th className="p-1 text-left">Test</th>
                          <th className="p-1 text-left">Result</th>
                          <th className="p-1 text-left">Range</th>
                          <th className="p-1 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-100">
                          <td className="p-1">Hemoglobin</td>
                          <td className="p-1 font-semibold">13.5 g/dL</td>
                          <td className="p-1">12-16</td>
                          <td className="p-1 text-green-600 font-bold">NORMAL</td>
                        </tr>
                        <tr className="border-b border-slate-100 bg-slate-50">
                          <td className="p-1">Blood Sugar</td>
                          <td className="p-1 font-semibold">210 mg/dL</td>
                          <td className="p-1">70-110</td>
                          <td className="p-1 text-amber-600 font-bold">ABNORMAL</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Footer preview */}
                  {showHeaderFooter && (
                    <div className="border-t border-slate-200 pt-3">
                      {footerImageUrl ? (
                        <img src={footerImageUrl} alt="Footer" className="w-full h-8 object-contain" />
                      ) : footerHtml ? (
                        <div
                          className="text-[8px]"
                          dangerouslySetInnerHTML={{ __html: footerHtml }}
                        />
                      ) : (
                        <div className="text-center">
                          <p className="text-[7px] text-slate-400">This report is for medical use only</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: Report Template ──────────────────────────────────────── */}
      {tab === "template" && (
        <div className="bg-white border border-slate-200 rounded-xl p-8">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="w-12 h-12 text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">Report Template Editor</h3>
            <p className="text-sm text-slate-500 max-w-md">
              Customize the report body layout, fonts, colors, and sections.
              This feature is available in the Report Templates section.
            </p>
            <a
              href="/settings/report-templates"
              className="mt-4 px-4 py-2 bg-[#0D7E8A] text-white text-sm rounded-lg hover:bg-[#0B6B75]"
            >
              Go to Report Templates
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
