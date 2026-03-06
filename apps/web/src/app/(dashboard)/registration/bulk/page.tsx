"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Upload, Download, Loader2, CheckCircle2, AlertTriangle, XCircle, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useTenantStore } from "@/store/tenantStore";
import * as XLSX from "xlsx";
import AddOrgModal from "@/components/organisations/AddOrgModal";

// ── Types ──
interface BulkRow {
  id: string;
  rowNumber: number;
  rawData: Record<string, unknown>;
  normalisedData: Record<string, unknown> | null;
  status: string;
  orderId: string | null;
  errorMsg: string | null;
}

interface JobData {
  job: {
    id: string;
    status: string;
    totalRows: number;
    processed: number;
    failed: number;
    rows: BulkRow[];
  };
  matched: number;
  partial: number;
  unmatched: number;
}

interface OrgResult {
  id: string;
  name: string;
  code?: string;
  phone?: string;
  creditLimit?: number;
  paymentType?: string;
}

type Step = "upload" | "processing" | "preview" | "registering" | "done";

// ── Status badge colours ──
const STATUS_COLORS: Record<string, string> = {
  MATCHED: "bg-emerald-100 text-emerald-700",
  PARTIAL_MATCH: "bg-amber-100 text-amber-700",
  UNMATCHED: "bg-red-100 text-red-700",
  REGISTERED: "bg-blue-100 text-blue-700",
  FAILED: "bg-red-100 text-red-700",
};

const TUBE_COLORS: Record<string, string> = {
  EDTA: "bg-purple-100 text-purple-700",
  SERUM: "bg-red-100 text-red-700",
  NPS: "bg-orange-100 text-orange-700",
  URINE: "bg-yellow-100 text-yellow-700",
  STOOL: "bg-amber-100 text-amber-700",
  CSF: "bg-cyan-100 text-cyan-700",
  SPUTUM: "bg-teal-100 text-teal-700",
};

export default function BulkRegistrationPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const orgSearchRef = useRef<HTMLDivElement>(null);
  const { activeBranch } = useTenantStore();

  const [step, setStep] = useState<Step>("upload");
  const [jobId, setJobId] = useState("");
  const [jobData, setJobData] = useState<JobData | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<{ processed: number; failed: number; total: number } | null>(null);

  // Organisation selector state
  const [selectedOrg, setSelectedOrg] = useState<OrgResult | null>(null);
  const [orgSearch, setOrgSearch] = useState("");
  const [orgSearchResults, setOrgSearchResults] = useState<OrgResult[]>([]);
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const [showAddOrgModal, setShowAddOrgModal] = useState(false);
  const [loadingOrgs, setLoadingOrgs] = useState(false);

  // Search organisations as user types
  useEffect(() => {
    if (!orgSearch.trim()) {
      setOrgSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoadingOrgs(true);
      try {
        const res = await api.get(
          `/organisations?search=${encodeURIComponent(orgSearch)}&limit=10`,
        );
        setOrgSearchResults(
          (res.data.data?.organisations ?? res.data.data ?? res.data) as OrgResult[],
        );
      } catch {
        setOrgSearchResults([]);
      } finally {
        setLoadingOrgs(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [orgSearch]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        orgSearchRef.current &&
        !orgSearchRef.current.contains(e.target as Node)
      ) {
        setOrgDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Download template ──
  const downloadTemplate = useCallback(() => {
    const headers = [
      "Name",
      "Age",
      "Gender",
      "Tests",
      "Phone",
      "Email",
      "Address",
      "ReferringDoctor",
      "Notes",
      "Barcode_EDTA",
      "Barcode_SERUM",
      "Barcode_NPS",
      "Barcode_URINE",
      "Barcode_STOOL",
      "Barcode_CSF",
      "Barcode_SPUTUM",
    ];

    const exampleRow = [
      "John Doe",
      "34",
      "Male",
      "CBC, TSH, LFT",
      "9876543210",
      "john@example.com",
      "123 Main Street",
      "Dr. Sharma",
      "Fasting sample",
      "ED123456",
      "SR123456",
      "",
      "",
      "",
      "",
      "",
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow]);

    ws["!cols"] = [
      { width: 20 },
      { width: 8 },
      { width: 10 },
      { width: 35 },
      { width: 14 },
      { width: 24 },
      { width: 24 },
      { width: 18 },
      { width: 20 },
      { width: 16 },
      { width: 16 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 12 },
      { width: 14 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Bulk Registration");
    XLSX.writeFile(wb, "DELViON_Bulk_Registration_Template.xlsx");
  }, []);

  // ── Upload file ──
  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
        toast.error("Please upload an Excel (.xlsx/.xls) or CSV file");
        return;
      }
      setStep("processing");
      const fd = new FormData();
      fd.append("file", file);
      if (selectedOrg?.id) fd.append("organisationId", selectedOrg.id);
      try {
        const res = await api.post("/bulk-registration/upload", fd, {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 120000,
        });
        const jId = (res.data.data?.jobId ?? res.data.jobId) as string;
        setJobId(jId);
        await pollJob(jId);
      } catch (e: unknown) {
        const msg =
          (e as { response?: { data?: { message?: string } } })?.response?.data
            ?.message ?? "Upload failed";
        toast.error(msg);
        setStep("upload");
      }
    },
    [selectedOrg],
  );

  const pollJob = async (jId: string) => {
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const res = await api.get(`/bulk-registration/job/${jId}`);
        const d = (res.data.data ?? res.data) as JobData;
        if (d?.job?.status === "PREVIEW" || d?.job?.status === "DONE") {
          setJobData(d);
          setStep("preview");
          return;
        }
        if (d?.job?.status === "FAILED") {
          toast.error("Processing failed");
          setStep("upload");
          return;
        }
      } catch {
        /* keep polling */
      }
    }
    toast.error("Timed out — please try again");
    setStep("upload");
  };

  // ── Register all ──
  const handleRegisterAll = useCallback(async () => {
    setStep("registering");
    try {
      const res = await api.post(
        `/bulk-registration/job/${jobId}/register`,
        {
          skipUnmatched: true,
          branchId: activeBranch?.id ?? "",
          organisationId: selectedOrg?.id ?? undefined,
        },
        { timeout: 120000 },
      );
      setResult(
        (res.data.data ?? res.data) as {
          processed: number;
          failed: number;
          total: number;
        },
      );
      setStep("done");
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Registration failed";
      toast.error(msg);
      setStep("preview");
    }
  }, [jobId, activeBranch, selectedOrg]);

  // ── Progress steps UI ──
  const STEPS = [
    { key: "upload", label: "Upload" },
    { key: "processing", label: "Processing" },
    { key: "preview", label: "Preview" },
    { key: "done", label: "Done" },
  ];
  const currentIdx = STEPS.findIndex(
    (s) => s.key === step || (step === "registering" && s.key === "preview"),
  );

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/registration")}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">
            Bulk Registration
          </h1>
          <p className="text-sm text-slate-500">
            Upload an Excel sheet to register multiple patients at once
          </p>
        </div>
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm hover:bg-white transition"
        >
          <Download size={14} />
          Download Template
        </button>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition",
                currentIdx === i
                  ? "bg-[#0D7E8A] text-white"
                  : currentIdx > i
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-400",
              )}
            >
              {currentIdx > i ? (
                <CheckCircle2 size={12} />
              ) : (
                <span>{i + 1}.</span>
              )}
              {s.label}
            </div>
            {i < STEPS.length - 1 && <div className="w-8 h-px bg-slate-300" />}
          </div>
        ))}
      </div>

      {/* ── UPLOAD STEP ── */}
      {step === "upload" && (
        <div className="bg-white rounded-2xl shadow-sm border p-8">
          {/* ── ORGANISATION SELECTOR ── */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className="block text-sm font-semibold text-gray-800">
                  Organisation
                  <span className="ml-2 text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    Optional
                  </span>
                </label>
                <p className="text-xs text-gray-500 mt-0.5">
                  Select the B2B organisation for all patients in this upload,
                  or leave blank for walk-ins
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Search dropdown */}
              <div ref={orgSearchRef} className="relative flex-1 max-w-md">
                {selectedOrg ? (
                  <div className="flex items-center gap-3 px-4 py-2.5 border-2 border-teal-500 bg-teal-50 rounded-xl">
                    <div className="w-8 h-8 rounded-lg bg-teal-700 flex items-center justify-center text-white text-sm font-bold shrink-0">
                      {selectedOrg.name?.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-teal-900 truncate">
                        {selectedOrg.name}
                      </p>
                      <p className="text-xs text-teal-600">
                        {(selectedOrg.creditLimit ?? 0) > 0
                          ? "Credit"
                          : "Cash"}{" "}
                        · {selectedOrg.code ?? ""}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedOrg(null);
                        setOrgSearch("");
                      }}
                      className="text-teal-400 hover:text-teal-700 text-lg leading-none"
                    >
                      &times;
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search organisation by name..."
                        value={orgSearch}
                        onChange={(e) => {
                          setOrgSearch(e.target.value);
                          setOrgDropdownOpen(true);
                        }}
                        onFocus={() => setOrgDropdownOpen(true)}
                        className="w-full border rounded-xl px-4 py-2.5 text-sm pr-10 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-200"
                      />
                      {loadingOrgs ? (
                        <span className="absolute right-3 top-3 w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <span className="absolute right-3 top-3 text-gray-400">
                          &#x25BE;
                        </span>
                      )}
                    </div>

                    {orgDropdownOpen && orgSearch.length > 0 && (
                      <div className="absolute z-50 mt-1 w-full bg-white border rounded-xl shadow-lg overflow-hidden max-h-52 overflow-y-auto">
                        {orgSearchResults.length === 0 && !loadingOrgs && (
                          <div className="px-4 py-3 text-sm text-gray-400">
                            No organisations found for &quot;{orgSearch}&quot;
                          </div>
                        )}
                        {orgSearchResults.map((org) => (
                          <button
                            key={org.id}
                            onClick={() => {
                              setSelectedOrg(org);
                              setOrgSearch("");
                              setOrgDropdownOpen(false);
                            }}
                            className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b last:border-0 flex items-center gap-3 transition"
                          >
                            <div className="w-7 h-7 rounded-md bg-teal-100 flex items-center justify-center text-teal-700 text-xs font-bold shrink-0">
                              {org.name?.slice(0, 1).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {org.name}
                              </p>
                              <p className="text-xs text-gray-400">
                                {org.code} · {org.phone ?? ""}
                              </p>
                            </div>
                            {(org.creditLimit ?? 0) > 0 && (
                              <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                                Credit
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Add new org button */}
              <button
                onClick={() => setShowAddOrgModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-600 hover:border-teal-500 hover:text-teal-700 hover:bg-teal-50 transition font-medium whitespace-nowrap"
              >
                <span className="text-lg leading-none">+</span>
                Add New Organisation
              </button>
            </div>

            {!selectedOrg && (
              <p className="text-xs text-gray-400 mt-2">
                Leave blank to register all patients as walk-in (no organisation
                billing)
              </p>
            )}
          </div>

          {/* Divider */}
          <div className="border-t mb-6" />

          {/* Template format info card */}
          <div className="mb-6 p-4 bg-teal-50 rounded-xl border border-teal-200">
            <h3 className="font-semibold text-teal-800 mb-3">
              Excel Template Format
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium text-teal-700 mb-1">
                  Required columns:
                </p>
                <ul className="text-teal-600 space-y-0.5 text-xs">
                  <li>
                    &bull; <strong>Name</strong> — Patient full name
                  </li>
                  <li>
                    &bull; <strong>Age</strong> — Age in years
                  </li>
                  <li>
                    &bull; <strong>Gender</strong> — Male / Female / Other
                  </li>
                  <li>
                    &bull; <strong>Tests</strong> — Comma-separated (e.g. CBC,
                    TSH, LFT)
                  </li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-teal-700 mb-1">
                  Optional columns:
                </p>
                <ul className="text-teal-600 space-y-0.5 text-xs">
                  <li>
                    &bull; Phone, Email, Address, ReferringDoctor, Notes
                  </li>
                  <li className="mt-1 font-medium text-teal-700">
                    Pre-labelled tube barcodes (leave blank if not ready):
                  </li>
                  <li>
                    &bull;{" "}
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />{" "}
                      Barcode_EDTA
                    </span>{" "}
                    &middot;{" "}
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />{" "}
                      Barcode_SERUM
                    </span>
                  </li>
                  <li>
                    &bull;{" "}
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />{" "}
                      Barcode_NPS
                    </span>{" "}
                    &middot;{" "}
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />{" "}
                      Barcode_URINE
                    </span>
                  </li>
                  <li>
                    &bull; Barcode_STOOL &middot; Barcode_CSF &middot;
                    Barcode_SPUTUM
                  </li>
                </ul>
              </div>
            </div>
            <p className="text-xs text-teal-500 mt-2">
              &#8505; Test names are matched automatically — approximate names
              like &quot;blood count&quot;, &quot;thyroid&quot;, &quot;liver
              test&quot; are understood. Tube types are assigned automatically
              per test.
            </p>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files[0];
              if (f) handleFile(f);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition",
              dragOver
                ? "border-teal-500 bg-teal-50"
                : "border-slate-300 hover:border-teal-400 hover:bg-slate-50",
            )}
          >
            <FileSpreadsheet size={48} className="mx-auto mb-4 text-slate-300" />
            <p className="font-semibold text-slate-700 mb-1">
              Drop your Excel file here
            </p>
            <p className="text-sm text-slate-400 mb-4">or click to browse</p>
            <p className="text-xs text-slate-300">
              .xlsx / .xls / .csv — max 10MB
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>
        </div>
      )}

      {/* ── PROCESSING / REGISTERING ── */}
      {(step === "processing" || step === "registering") && (
        <div className="bg-white rounded-2xl shadow-sm border p-16 text-center">
          <Loader2
            size={48}
            className="animate-spin mx-auto mb-6 text-[#0D7E8A]"
          />
          <h3 className="text-lg font-semibold mb-2">
            {step === "processing"
              ? "Processing your file..."
              : "Registering patients..."}
          </h3>
          <p className="text-sm text-slate-500">
            {step === "processing"
              ? "Matching test names to catalog and assigning tube types. This takes 15-30 seconds."
              : "Creating patient records and orders. Please wait."}
          </p>
        </div>
      )}

      {/* ── PREVIEW STEP ── */}
      {step === "preview" && jobData && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="bg-white rounded-xl border p-4 flex items-center gap-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-800">
                {jobData.job.totalRows}
              </p>
              <p className="text-xs text-slate-500">Total rows</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-600">
                {jobData.matched}
              </p>
              <p className="text-xs text-slate-500">Matched</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-500">
                {jobData.partial}
              </p>
              <p className="text-xs text-slate-500">Partial</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-500">
                {jobData.unmatched}
              </p>
              <p className="text-xs text-slate-500">Unmatched</p>
            </div>

            {/* Org badge in summary */}
            {selectedOrg && (
              <div className="flex items-center gap-2 text-sm border-l pl-6">
                <span className="text-gray-500">Organisation:</span>
                <span className="font-semibold text-teal-700">
                  {selectedOrg.name}
                </span>
                <button
                  onClick={() => setSelectedOrg(null)}
                  className="text-gray-300 hover:text-gray-500 text-xs"
                >
                  change
                </button>
              </div>
            )}

            <div className="ml-auto flex gap-2">
              <button
                onClick={() => {
                  setStep("upload");
                  setJobData(null);
                }}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm hover:bg-slate-50"
              >
                <ArrowLeft size={14} className="inline mr-1" /> Upload Again
              </button>
              <button
                onClick={handleRegisterAll}
                className="px-6 py-2 bg-[#0D7E8A] text-white rounded-xl text-sm font-semibold hover:bg-[#0a6670]"
              >
                Register All Matched
              </button>
            </div>
          </div>

          {/* Rows table */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b text-xs text-slate-500 uppercase">
                    <th className="px-4 py-3 text-left">#</th>
                    <th className="px-4 py-3 text-left">Patient</th>
                    <th className="px-4 py-3 text-left">Age/Gender</th>
                    <th className="px-4 py-3 text-left">Tests Matched</th>
                    <th className="px-4 py-3 text-left">Tubes</th>
                    <th className="px-4 py-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {jobData.job.rows.map((row) => {
                    const d = row.normalisedData;
                    const tests =
                      (d?.tests as Array<Record<string, unknown>>) ?? [];
                    const tubes = (d?.tubes as string[]) ?? [];
                    return (
                      <tr key={row.id} className="border-b hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-400">
                          {row.rowNumber}
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {String(
                            d?.name ??
                              (row.rawData as Record<string, unknown>)?.Name ??
                              "—",
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {String(d?.age ?? "")}y /{" "}
                          {String(d?.gender ?? "").slice(0, 1)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {tests.map((t, i) => (
                              <span
                                key={i}
                                className={cn(
                                  "text-xs px-1.5 py-0.5 rounded",
                                  t.status === "MATCHED"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : t.status === "PARTIAL"
                                      ? "bg-amber-50 text-amber-600"
                                      : "bg-red-50 text-red-600",
                                )}
                              >
                                {String(t.matched ?? t.original)}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {tubes.map((tube) => (
                              <span
                                key={tube}
                                className={cn(
                                  "text-xs px-1.5 py-0.5 rounded font-medium",
                                  TUBE_COLORS[tube] ??
                                    "bg-slate-100 text-slate-600",
                                )}
                              >
                                {tube}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "text-xs px-2 py-0.5 rounded-full font-medium",
                              STATUS_COLORS[row.status] ?? "",
                            )}
                          >
                            {row.status.replace("_", " ")}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── DONE STEP ── */}
      {step === "done" && result && (
        <div className="bg-white rounded-2xl border p-12 text-center">
          <CheckCircle2 size={56} className="mx-auto mb-4 text-emerald-500" />
          <h2 className="text-2xl font-bold mb-2">Registration Complete</h2>
          <p className="text-slate-500 mb-6">
            <strong className="text-emerald-600">{result.processed}</strong>{" "}
            patients registered
            {result.failed > 0 && (
              <>
                {" "}
                &middot;{" "}
                <strong className="text-red-500">{result.failed}</strong> failed
              </>
            )}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.push("/accession")}
              className="px-6 py-2.5 bg-[#1B4F8A] text-white rounded-xl font-semibold hover:bg-[#163e6e]"
            >
              Go to Accession Queue
            </button>
            <button
              onClick={() => {
                setStep("upload");
                setJobData(null);
                setResult(null);
              }}
              className="px-6 py-2.5 border border-slate-200 rounded-xl hover:bg-slate-50"
            >
              Upload Another File
            </button>
          </div>
        </div>
      )}

      {/* ── Add Organisation Modal ── */}
      {showAddOrgModal && (
        <AddOrgModal
          onClose={() => setShowAddOrgModal(false)}
          onCreated={(newOrg) => {
            const org = newOrg as unknown as OrgResult;
            setSelectedOrg(org);
            setShowAddOrgModal(false);
            toast.success(
              `Organisation "${org.name}" created and selected`,
            );
          }}
        />
      )}
    </div>
  );
}
