"use client";

import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────

interface BillSettings {
  billingFontSize: number;
  billingFontFamily: string;
  billingPaperSize: string;
  headerHeight: number;
  footerHeight: number;
  billingPaperMode: string;
  billPaperWidth: number;
  billPaperHeight: number;
  billingPaperMargin: number;
  barcodeAbbreviation: string;
  tdsConcessionPercent: number;
  presetAdditionalAmount: number;
  billHeaderFlag: boolean;
  billFooterFlag: boolean;
  billSignatureFlag: boolean;
  barcodeFlag: boolean;
  sampleTypeOnBarcode: boolean;
  collectionDate: boolean;
  billReceiptQrCode: boolean;
  testName: boolean;
  shortTestNames: boolean;
  duplicateAccessionNumber: "accept" | "reject";
  manualAccessionNumberMandatory: boolean;
  printCardNumberType: "none" | "mrn" | "accession" | "barcode";
  labLogoOnCard: "yes" | "no";
}

const DEFAULT_SETTINGS: BillSettings = {
  billingFontSize: 9,
  billingFontFamily: "Times New Roman",
  billingPaperSize: "A4",
  headerHeight: 110,
  footerHeight: 32,
  billingPaperMode: "Portrait",
  billPaperWidth: 595,
  billPaperHeight: 842,
  billingPaperMargin: 20,
  barcodeAbbreviation: "",
  tdsConcessionPercent: 10.0,
  presetAdditionalAmount: 0.0,
  billHeaderFlag: true,
  billFooterFlag: true,
  billSignatureFlag: true,
  barcodeFlag: false,
  sampleTypeOnBarcode: false,
  collectionDate: false,
  billReceiptQrCode: false,
  testName: false,
  shortTestNames: false,
  duplicateAccessionNumber: "accept",
  manualAccessionNumberMandatory: false,
  printCardNumberType: "none",
  labLogoOnCard: "yes",
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

// ── Main Component ─────────────────────────────────────────────────────────

export default function BillSettingsPage() {
  const [settings, setSettings] = useState<BillSettings>(DEFAULT_SETTINGS);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Load settings on mount
  useEffect(() => {
    api
      .get("/settings/bill-settings")
      .then((res) => {
        const data = res.data?.data ?? res.data;
        if (data && typeof data === "object") {
          setSettings((prev) => ({ ...prev, ...data }));
        }
      })
      .catch((err: unknown) => {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status !== 404) {
          toast.error("Failed to load bill settings");
        }
        // 404 → use defaults, no crash
      })
      .finally(() => setLoadingInitial(false));
  }, []);

  const saveMutation = useMutation({
    mutationFn: () => api.patch("/settings/bill-settings", settings),
    onSuccess: () => toast.success("Bill settings saved"),
    onError: () => toast.error("Failed to save bill settings"),
  });

  function update<K extends keyof BillSettings>(key: K, value: BillSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  const toggleFlags: { key: keyof BillSettings; label: string }[] = [
    { key: "billHeaderFlag", label: "Bill Header Flag" },
    { key: "billFooterFlag", label: "Bill Footer Flag" },
    { key: "billSignatureFlag", label: "Bill Signature Flag" },
    { key: "barcodeFlag", label: "Barcode Flag" },
    { key: "sampleTypeOnBarcode", label: "Sample Type on Barcode" },
    { key: "collectionDate", label: "Collection Date" },
    { key: "billReceiptQrCode", label: "Bill Receipt - QR Code" },
    { key: "testName", label: "Test Name" },
    { key: "shortTestNames", label: "Short Test Names" },
  ];

  if (loadingInitial) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-[#0D7E8A]" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Bill Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Configure billing receipt format and print settings
        </p>
      </div>

      {/* ── Section 1: Bill Receipt Settings ────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <h2 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3">
          Bill Receipt Settings
        </h2>

        {/* Row 1 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Billing Font Size
            </label>
            <input
              type="number"
              value={settings.billingFontSize}
              onChange={(e) => update("billingFontSize", Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Billing Font Family
            </label>
            <select
              value={settings.billingFontFamily}
              onChange={(e) => update("billingFontFamily", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]"
            >
              {["Times New Roman", "Arial", "Helvetica", "Calibri"].map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Billing Paper Size
            </label>
            <select
              value={settings.billingPaperSize}
              onChange={(e) => update("billingPaperSize", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]"
            >
              {["A4", "A5", "Letter", "80mm Thermal"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Header Height
            </label>
            <input
              type="number"
              value={settings.headerHeight}
              onChange={(e) => update("headerHeight", Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Footer Height
            </label>
            <input
              type="number"
              value={settings.footerHeight}
              onChange={(e) => update("footerHeight", Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Billing Paper Mode
            </label>
            <select
              value={settings.billingPaperMode}
              onChange={(e) => update("billingPaperMode", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]"
            >
              {["Portrait", "Landscape"].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 3 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Bill Paper Width
            </label>
            <input
              type="number"
              value={settings.billPaperWidth}
              onChange={(e) => update("billPaperWidth", Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Bill Paper Height
            </label>
            <input
              type="number"
              value={settings.billPaperHeight}
              onChange={(e) => update("billPaperHeight", Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Billing Paper Margin
            </label>
            <input
              type="number"
              value={settings.billingPaperMargin}
              onChange={(e) => update("billingPaperMargin", Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]"
            />
          </div>
        </div>

        {/* Row 4 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Barcode Abbreviation
            </label>
            <input
              type="text"
              value={settings.barcodeAbbreviation}
              onChange={(e) => update("barcodeAbbreviation", e.target.value)}
              placeholder="e.g. DH"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              TDS Concession %
            </label>
            <input
              type="number"
              step={0.01}
              value={settings.tdsConcessionPercent}
              onChange={(e) => update("tdsConcessionPercent", Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Applied when TDS concession is enabled on a bill
            </p>
          </div>
          <div className="flex items-end pb-5">
            <p className="text-xs text-slate-500">
              TDS concession reduces the bill amount by the specified percentage for eligible patients.
            </p>
          </div>
        </div>

        {/* Row 5 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Pre-set Additional Amount
            </label>
            <input
              type="number"
              step={0.01}
              value={settings.presetAdditionalAmount}
              onChange={(e) => update("presetAdditionalAmount", Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              This amount is pre-filled in the &quot;Additional Amount&quot; field on new bills
            </p>
          </div>
        </div>
      </div>

      {/* ── Section 2: Toggle Flags ──────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h2 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3">
          Display Flags
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {toggleFlags.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-sm text-slate-700">{label}</span>
              <Toggle
                checked={settings[key] as boolean}
                onChange={(v) => update(key, v as BillSettings[typeof key])}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Section 3: Duplicate Accession Number ───────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h2 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3">
          Duplicate Accession Number
        </h2>
        <div className="flex flex-col sm:flex-row gap-4">
          {(["accept", "reject"] as const).map((option) => (
            <label
              key={option}
              className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-slate-200 hover:bg-slate-50 flex-1"
            >
              <input
                type="radio"
                name="duplicateAccession"
                value={option}
                checked={settings.duplicateAccessionNumber === option}
                onChange={() => update("duplicateAccessionNumber", option)}
                className="text-[#0D7E8A] focus:ring-[#0D7E8A]"
              />
              <div>
                <p className="text-sm font-medium text-slate-800 capitalize">{option}</p>
                <p className="text-xs text-slate-500">
                  {option === "accept"
                    ? "Allow duplicate accession numbers"
                    : "Reject bills with duplicate accession numbers"}
                </p>
              </div>
            </label>
          ))}
        </div>

        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
          <div>
            <p className="text-sm font-semibold text-slate-800">Manual Accession Number Mandatory</p>
            <p className="text-xs text-slate-500">
              When enabled, users must enter an accession number manually for each bill
            </p>
          </div>
          <Toggle
            checked={settings.manualAccessionNumberMandatory}
            onChange={(v) => update("manualAccessionNumberMandatory", v)}
          />
        </div>
      </div>

      {/* ── Section 4: Patient Print Card ───────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <h2 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3">
          Patient Print Card
        </h2>

        <div>
          <p className="text-sm font-medium text-slate-700 mb-3">Print Card Number Type</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(["none", "mrn", "accession", "barcode"] as const).map((type) => (
              <label
                key={type}
                className="flex items-center gap-2 cursor-pointer p-3 rounded-lg border border-slate-200 hover:bg-slate-50"
              >
                <input
                  type="radio"
                  name="printCardNumberType"
                  value={type}
                  checked={settings.printCardNumberType === type}
                  onChange={() => update("printCardNumberType", type)}
                  className="text-[#0D7E8A] focus:ring-[#0D7E8A]"
                />
                <span className="text-sm text-slate-700 capitalize">{type === "mrn" ? "MRN" : type}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-slate-700 mb-3">Show Lab Logo on Card</p>
          <div className="flex gap-3">
            {(["yes", "no"] as const).map((option) => (
              <label
                key={option}
                className="flex items-center gap-2 cursor-pointer p-3 rounded-lg border border-slate-200 hover:bg-slate-50"
              >
                <input
                  type="radio"
                  name="labLogoOnCard"
                  value={option}
                  checked={settings.labLogoOnCard === option}
                  onChange={() => update("labLogoOnCard", option)}
                  className="text-[#0D7E8A] focus:ring-[#0D7E8A]"
                />
                <span className="text-sm text-slate-700 capitalize">{option}</span>
              </label>
            ))}
          </div>
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
