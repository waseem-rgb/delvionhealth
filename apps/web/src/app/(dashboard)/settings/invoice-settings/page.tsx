"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Save, Upload, X, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────

interface InvoiceSettings {
  headerHeight: number;
  invoiceHeaderFlag: boolean;
  headerImageUrl: string | null;
  footerHeight: number;
  invoiceFooterFlag: boolean;
  footerImageUrl: string | null;
  helperComment: string;
  useBillLevelVatInQrCode: boolean;
}

const DEFAULT_SETTINGS: InvoiceSettings = {
  headerHeight: 120,
  invoiceHeaderFlag: true,
  headerImageUrl: null,
  footerHeight: 50,
  invoiceFooterFlag: false,
  footerImageUrl: null,
  helperComment: "",
  useBillLevelVatInQrCode: false,
};

// ── Toggle component ───────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? "bg-[#0D7E8A]" : "bg-slate-300"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

// ── Image Drop Zone ────────────────────────────────────────────────────────

function ImageDropZone({
  imageUrl,
  onUpload,
  onClear,
  uploading,
}: {
  imageUrl: string | null;
  onUpload: (file: File) => void;
  onClear: () => void;
  uploading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) onUpload(file);
    },
    [onUpload],
  );

  if (imageUrl) {
    return (
      <div className="relative border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
        <img
          src={imageUrl}
          alt="Uploaded"
          className="w-full h-32 object-contain p-2"
        />
        <button
          onClick={onClear}
          className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-lg h-32 flex flex-col items-center justify-center cursor-pointer transition-colors ${
        dragging
          ? "border-[#0D7E8A] bg-[#0D7E8A]/5"
          : "border-slate-300 hover:border-[#0D7E8A] hover:bg-[#0D7E8A]/5"
      }`}
    >
      {uploading ? (
        <Loader2 className="w-6 h-6 animate-spin text-[#0D7E8A]" />
      ) : (
        <>
          <ImageIcon className="w-8 h-8 text-slate-300 mb-2" />
          <p className="text-xs text-slate-500">
            {dragging ? "Drop to upload" : "Image not found"}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">
            Drag & drop or click · PNG/JPEG · max 2MB
          </p>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".png,.jpg,.jpeg"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
        }}
      />
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function InvoiceSettingsPage() {
  const [settings, setSettings] = useState<InvoiceSettings>(DEFAULT_SETTINGS);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [headerUploading, setHeaderUploading] = useState(false);
  const [footerUploading, setFooterUploading] = useState(false);
  const [commentLength, setCommentLength] = useState(0);

  // Load settings on mount
  useEffect(() => {
    api
      .get("/settings/invoice-settings")
      .then((res) => {
        const data = res.data?.data ?? res.data;
        if (data && typeof data === "object") {
          setSettings((prev) => ({ ...prev, ...data }));
          setCommentLength((data.helperComment ?? "").length);
        }
      })
      .catch((err: unknown) => {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status !== 404) {
          toast.error("Failed to load invoice settings");
        }
      })
      .finally(() => setLoadingInitial(false));
  }, []);

  const saveMutation = useMutation({
    mutationFn: () => api.patch("/settings/invoice-settings", settings),
    onSuccess: () => toast.success("Invoice settings saved"),
    onError: () => toast.error("Failed to save invoice settings"),
  });

  function update<K extends keyof InvoiceSettings>(key: K, value: InvoiceSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  const uploadImage = useCallback(async (file: File, type: "header" | "footer") => {
    if (file.size > 2 * 1024 * 1024) {
      toast.error("File size must be under 2MB");
      return;
    }
    const setter = type === "header" ? setHeaderUploading : setFooterUploading;
    setter(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post(`/settings/invoice-settings/${type}-image`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const data = (res.data?.data ?? res.data) as { url: string };
      if (type === "header") update("headerImageUrl", data.url);
      else update("footerImageUrl", data.url);
      toast.success(`${type === "header" ? "Header" : "Footer"} image uploaded`);
    } catch {
      toast.error("Image upload failed");
    } finally {
      setter(false);
    }
  }, []);

  if (loadingInitial) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-[#0D7E8A]" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Invoice Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Configure invoice header, footer and VAT settings
        </p>
      </div>

      {/* ── Section 1: Header Settings ──────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h2 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
          <Upload className="w-4 h-4 text-[#0D7E8A]" />
          Header Settings
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Height (px)</label>
            <input
              type="number"
              value={settings.headerHeight}
              onChange={(e) => update("headerHeight", Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]"
            />
          </div>
          <div className="flex items-end pb-1">
            <div className="flex items-center justify-between w-full p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div>
                <p className="text-sm font-medium text-slate-700">Invoice Header Flag</p>
                <p className="text-xs text-slate-400">Show header on invoices</p>
              </div>
              <Toggle
                checked={settings.invoiceHeaderFlag}
                onChange={(v) => update("invoiceHeaderFlag", v)}
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2">Upload Header Image</label>
          <ImageDropZone
            imageUrl={settings.headerImageUrl}
            onUpload={(file) => uploadImage(file, "header")}
            onClear={() => update("headerImageUrl", null)}
            uploading={headerUploading}
          />
        </div>
      </div>

      {/* ── Section 2: Footer Settings ──────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h2 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
          <Upload className="w-4 h-4 text-[#0D7E8A]" />
          Footer Settings
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Height (px)</label>
            <input
              type="number"
              value={settings.footerHeight}
              onChange={(e) => update("footerHeight", Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]"
            />
          </div>
          <div className="flex items-end pb-1">
            <div className="flex items-center justify-between w-full p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div>
                <p className="text-sm font-medium text-slate-700">Invoice Footer Flag</p>
                <p className="text-xs text-slate-400">Show footer on invoices</p>
              </div>
              <Toggle
                checked={settings.invoiceFooterFlag}
                onChange={(v) => update("invoiceFooterFlag", v)}
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2">Upload Footer Image</label>
          <ImageDropZone
            imageUrl={settings.footerImageUrl}
            onUpload={(file) => uploadImage(file, "footer")}
            onClear={() => update("footerImageUrl", null)}
            uploading={footerUploading}
          />
        </div>
      </div>

      {/* ── Section 3: Helper Comment ────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
        <h2 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3">
          Helper Comment
        </h2>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Describe why this change is needed
          </label>
          <textarea
            rows={4}
            maxLength={250}
            value={settings.helperComment}
            onChange={(e) => {
              update("helperComment", e.target.value);
              setCommentLength(e.target.value.length);
            }}
            placeholder="Describe why this change is needed..."
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]"
          />
          <p className="text-[10px] text-slate-400 text-right mt-1">{commentLength}/250</p>
        </div>
      </div>

      {/* ── Section 4: VAT Settings ──────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
        <h2 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3">
          VAT Settings
        </h2>
        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
          <div>
            <p className="text-sm font-semibold text-slate-800">Use Bill-Level VAT in QR Code</p>
            <p className="text-xs text-slate-500 mt-0.5">
              When enabled, the QR code on invoices will embed the VAT amount calculated at the bill level rather than per line item.
            </p>
          </div>
          <Toggle
            checked={settings.useBillLevelVatInQrCode}
            onChange={(v) => update("useBillLevelVatInQrCode", v)}
          />
        </div>
      </div>

      {/* ── Save Button ──────────────────────────────────────────────── */}
      <div className="flex justify-end">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#0D7E8A] text-white text-sm font-medium rounded-lg hover:bg-[#0B6B75] disabled:opacity-50 transition-colors"
        >
          {saveMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save Settings
        </button>
      </div>
    </div>
  );
}
