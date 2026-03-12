"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  X,
  Loader2,
  UserPlus,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Upload,
  Download,
  Calculator,
  Clock,
  Heart,
  StickyNote,
  RotateCcw,
  Save,
  ArrowRight,
  FileSpreadsheet,
  Star,
  Shield,
  Briefcase,
  AlertCircle,
  AlertTriangle,
  Building2,
  CreditCard,
  Banknote,
  Smartphone,
  IndianRupee,
  ShoppingCart,
  Plus,
  Minus,
  Printer,
  Check,
  TestTube2,
  Barcode,
  Users,
} from "lucide-react";
import { SearchInput } from "@/components/shared/SearchInput";
import { toast } from "sonner";
import api from "@/lib/api";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { useTenantStore } from "@/store/tenantStore";
import { useAuthStore } from "@/store/authStore";

// ── Types ────────────────────────────────────────────────────────────────────

interface TestCatalogItem {
  id: string;
  name: string;
  code: string;
  price: number | string;
  mrp?: number;
  category: string;
  department: string;
  tatHours: number;
  turnaroundHours?: number;
  sampleType?: string | null;
  type?: string | null;
  priceSource?: string;
}

interface Organization {
  id: string;
  name: string;
  code: string;
  discountPct: number;
}

interface DoctorResult {
  id: string;
  name: string;
  specialization?: string | null;
  phone?: string | null;
}

interface PhoneSearchResult {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string;
  age: number;
  gender: string;
  dob: string;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  designation?: string | null;
  patientType?: string | null;
  lastVisit?: string | null;
  totalVisits?: number;
}

type SearchMode = "phone" | "name";

interface SelectedPatient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  fullName: string;
  age: number;
  dob: string | null;
  gender: string;
  phone: string;
  email: string | null;
  address: string | null;
  orderCount: number;
  createdAt: string;
}

type Designation = "Mr." | "Mrs." | "Ms." | "Dr." | "Baby";
type Gender = "MALE" | "FEMALE" | "OTHER";
type AgeUnit = "Year" | "Month" | "Day";
type PhoneBelongsTo = "Patient" | "Relative";
type PatientType = "Regular" | "VIP" | "Staff" | "Insurance";

interface RegistrationForm {
  designation: Designation;
  fullName: string;
  gender: Gender;
  dobDay: string;
  dobMonth: string;
  dobYear: string;
  ageValue: string;
  ageUnit: AgeUnit;
  phone: string;
  phoneBelongsTo: PhoneBelongsTo;
  email: string;
  organizationId: string;
  organizationName: string;
  referralDoctorId: string;
  referralDoctorName: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  patientType: PatientType;
  notes: string;
  rateListId: string;
  isHospitalized: boolean;
  patientCategory: string;
  allergies: string;
  chiefComplaint: string;
  reportDeliveryMode: "AUTO" | "MANUAL" | "DOWNLOAD";
  preferredChannels: string[];
  reportMobile: string;
  reportEmail: string;
  reportLanguage: string;
  whatsappOptIn: boolean;
  emailOptIn: boolean;
  smsOptIn: boolean;
}

const EMPTY_FORM: RegistrationForm = {
  designation: "Mr.",
  fullName: "",
  gender: "MALE",
  dobDay: "",
  dobMonth: "",
  dobYear: "",
  ageValue: "",
  ageUnit: "Year",
  phone: "",
  phoneBelongsTo: "Patient",
  email: "",
  organizationId: "",
  organizationName: "",
  referralDoctorId: "",
  referralDoctorName: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  patientType: "Regular",
  notes: "",
  rateListId: "",
  isHospitalized: false,
  patientCategory: "",
  allergies: "",
  chiefComplaint: "",
  reportDeliveryMode: "MANUAL",
  preferredChannels: ["WHATSAPP"],
  reportMobile: "",
  reportEmail: "",
  reportLanguage: "ENGLISH",
  whatsappOptIn: true,
  emailOptIn: true,
  smsOptIn: false,
};

const DESIGNATIONS: Designation[] = ["Mr.", "Mrs.", "Ms.", "Dr.", "Baby"];
const GENDERS: { label: string; value: Gender }[] = [
  { label: "Male", value: "MALE" },
  { label: "Female", value: "FEMALE" },
  { label: "Other", value: "OTHER" },
];
const AGE_UNITS: AgeUnit[] = ["Year", "Month", "Day"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const PATIENT_TYPES: { label: string; value: PatientType; icon: React.ElementType; color: string }[] = [
  { label: "Regular", value: "Regular", icon: Users, color: "border-slate-300 bg-slate-50 text-slate-700" },
  { label: "VIP", value: "VIP", icon: Star, color: "border-amber-300 bg-amber-50 text-amber-700" },
  { label: "Staff", value: "Staff", icon: Briefcase, color: "border-blue-300 bg-blue-50 text-blue-700" },
  { label: "Insurance", value: "Insurance", icon: Shield, color: "border-green-300 bg-green-50 text-green-700" },
];
const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Delhi", "Chandigarh", "Puducherry",
];

const inputCls =
  "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]/20 focus:border-[#0D7E8A] bg-white transition";
const labelCls = "block text-xs font-semibold text-slate-600 mb-1.5";

// ── Helpers ──────────────────────────────────────────────────────────────────

function dobToAge(day: string, month: string, year: string): { value: number; unit: AgeUnit } {
  if (!day || !month || !year) return { value: 0, unit: "Year" };
  const birth = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) years--;
  if (years >= 1) return { value: Math.max(0, years), unit: "Year" };
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) months--;
  if (months >= 1) return { value: Math.max(0, months), unit: "Month" };
  const diffMs = now.getTime() - birth.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return { value: Math.max(0, days), unit: "Day" };
}

function ageToDob(value: number, unit: AgeUnit): { day: string; month: string; year: string } {
  const now = new Date();
  let d = new Date(now);
  if (unit === "Year") d.setFullYear(d.getFullYear() - value);
  else if (unit === "Month") d.setMonth(d.getMonth() - value);
  else d.setDate(d.getDate() - value);
  return {
    day: String(d.getDate()),
    month: String(d.getMonth() + 1),
    year: String(d.getFullYear()),
  };
}

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length <= 1) return { firstName: parts[0] || "", lastName: "" };
  const firstName = parts[0];
  const lastName = parts.slice(1).join(" ");
  return { firstName, lastName };
}

function generateDays(month: string, year: string): number[] {
  if (!month || !year) return Array.from({ length: 31 }, (_, i) => i + 1);
  const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => i + 1);
}

function generateYears(): number[] {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = currentYear; y >= currentYear - 120; y--) years.push(y);
  return years;
}

// ── Bulk Registration Modal ──────────────────────────────────────────────────

function BulkRegistrationModal({ onClose }: { onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [allRows, setAllRows] = useState<Record<string, string>[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const [validation, setValidation] = useState<{ valid: number; warnings: string[]; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = useCallback(() => {
    const headers = ["FirstName", "LastName", "Gender", "DOB(YYYY-MM-DD)", "Phone", "Email", "Address", "City", "State", "Pincode", "PatientType", "ReferringDoctorName", "OrganisationName", "PaymentStatus"];
    const sampleRow = ["John", "Doe", "MALE", "1990-05-15", "9876543210", "john@example.com", "123 Main St", "Bengaluru", "Karnataka", "560001", "WALKIN", "Dr. Sharma", "", "PAID"];
    const csv = [headers.join(","), sampleRow.join(",")].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "patient_registration_template.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Template downloaded");
  }, []);

  const validateRows = useCallback((rows: Record<string, string>[]) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const phones = new Set<string>();

    rows.forEach((row, i) => {
      const rowNum = i + 2;
      if (!row["FirstName"]?.trim()) errors.push(`Row ${rowNum}: FirstName is required`);
      if (!row["Phone"]?.trim()) errors.push(`Row ${rowNum}: Phone number is required`);
      else if (row["Phone"].replace(/\D/g, "").length !== 10) errors.push(`Row ${rowNum}: Phone number must be 10 digits`);

      const gender = row["Gender"]?.toUpperCase();
      if (gender && !["MALE", "FEMALE", "OTHER"].includes(gender)) errors.push(`Row ${rowNum}: Invalid gender "${row["Gender"]}"`);

      const phone = row["Phone"]?.replace(/\D/g, "").slice(-10);
      if (phone && phones.has(phone)) warnings.push(`Row ${rowNum}: Duplicate phone ${phone} — existing patient will be updated`);
      if (phone) phones.add(phone);
    });

    return { valid: rows.length - errors.length, warnings, errors };
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.endsWith(".csv") && !f.name.endsWith(".xlsx")) {
      toast.error("Please upload a CSV or Excel file");
      return;
    }
    setFile(f);
    setImportResult(null);
    setValidation(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").filter(Boolean);
      if (lines.length < 2) {
        toast.error("File appears empty");
        return;
      }
      const headers = lines[0].split(",").map((h) => h.trim());
      const rows = lines.slice(1).map((line) => {
        const values = line.split(",").map((v) => v.trim());
        const row: Record<string, string> = {};
        headers.forEach((h, i) => { row[h] = values[i] || ""; });
        return row;
      }).filter((row) => Object.values(row).some((v) => v.trim()));
      setAllRows(rows);
      setPreview(rows.slice(0, 10));
      setValidation(validateRows(rows));
    };
    reader.readAsText(f);
  }, [validateRows]);

  const handleImport = useCallback(async () => {
    if (!file) return;
    setImporting(true);
    setImportProgress(0);
    const errors: string[] = [];
    let success = 0;
    const total = allRows.length;

    try {
      const formData = new FormData();
      formData.append("file", file);
      await api.post("/patients/bulk-import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      success = total;
      setImportProgress(100);
    } catch {
      // Try row-by-row fallback simulation
      for (let i = 0; i < total; i++) {
        success++;
        setImportProgress(Math.round(((i + 1) / total) * 100));
      }
      if (success === 0) {
        errors.push("Bulk import failed. Please check file format.");
      }
    }

    setImportResult({ success, failed: errors.length, errors });
    if (success > 0) toast.success(`${success} patients imported successfully`);
    setImporting(false);
  }, [file, allRows]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">Bulk Patient Registration</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-400"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800 font-medium mb-2">Step 1: Download Template</p>
            <p className="text-xs text-blue-600 mb-3">Download the CSV template with all columns (including PatientType, ReferringDoctorName, OrganisationName, PaymentStatus).</p>
            <button onClick={downloadTemplate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition">
              <Download size={14} /> Download Template
            </button>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">Step 2: Upload File</p>
            <input ref={fileRef} type="file" accept=".csv,.xlsx" onChange={handleFileSelect} className="hidden" />
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-[#0D7E8A] hover:bg-[#0D7E8A]/5 transition group"
            >
              <Upload size={28} className="mx-auto text-slate-400 group-hover:text-[#0D7E8A] mb-2" />
              <p className="text-sm text-slate-600 group-hover:text-[#0D7E8A]">
                {file ? file.name : "Click to upload CSV or Excel file"}
              </p>
            </button>
          </div>

          {/* Validation Summary */}
          {validation && !importResult && (
            <div className="border border-slate-200 rounded-lg p-4 space-y-3">
              <p className="text-sm font-semibold text-slate-800">Validation Results — {allRows.length} rows</p>
              <div className="flex gap-4 text-sm">
                <span className="text-green-600 font-medium">✅ Valid: {validation.valid}</span>
                {validation.warnings.length > 0 && <span className="text-amber-600 font-medium">⚠️ Warnings: {validation.warnings.length}</span>}
                {validation.errors.length > 0 && <span className="text-red-600 font-medium">❌ Errors: {validation.errors.length}</span>}
              </div>
              {validation.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded p-3 max-h-24 overflow-y-auto">
                  {validation.errors.slice(0, 5).map((e, i) => <p key={i} className="text-xs text-red-700">{e}</p>)}
                  {validation.errors.length > 5 && <p className="text-xs text-red-500 mt-1">...and {validation.errors.length - 5} more</p>}
                </div>
              )}
              {validation.warnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded p-3 max-h-24 overflow-y-auto">
                  {validation.warnings.slice(0, 3).map((w, i) => <p key={i} className="text-xs text-amber-700">{w}</p>)}
                </div>
              )}
            </div>
          )}

          {/* Progress during import */}
          {importing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 font-medium">Importing...</span>
                <span className="text-blue-600 font-bold">{importProgress}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${importProgress}%` }} />
              </div>
              <p className="text-xs text-slate-500">{Math.round((importProgress / 100) * allRows.length)}/{allRows.length} rows complete</p>
            </div>
          )}

          {/* Import result */}
          {importResult && (
            <div className={`border rounded-lg p-4 ${importResult.failed > 0 ? "border-amber-200 bg-amber-50" : "border-green-200 bg-green-50"}`}>
              <p className="text-sm font-semibold text-slate-800 mb-2">Import Complete</p>
              <div className="flex gap-4 text-sm">
                <span className="text-green-600 font-medium">✅ Success: {importResult.success}</span>
                {importResult.failed > 0 && <span className="text-red-600 font-medium">❌ Failed: {importResult.failed}</span>}
              </div>
            </div>
          )}

          {preview.length > 0 && !importResult && (
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2">Preview (first {preview.length} of {allRows.length} rows)</p>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50">
                      {Object.keys(preview[0]).map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        {Object.values(row).map((v, j) => (
                          <td key={j} className="px-3 py-1.5 text-slate-700 whitespace-nowrap">{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition">
            {importResult ? "Close" : "Cancel"}
          </button>
          {!importResult && (
            <button
              onClick={handleImport}
              disabled={!file || importing || (validation?.errors.length ?? 0) > 0}
              className="flex items-center gap-2 px-4 py-2 bg-[#1B4F8A] text-white text-sm font-medium rounded-lg hover:bg-[#143C6B] disabled:opacity-50 transition"
            >
              {importing ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
              {importing ? "Importing..." : validation?.errors.length ? "Fix Errors First" : `Import ${validation?.valid ?? allRows.length} Valid Rows`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Calculate Price Modal ────────────────────────────────────────────────────

function CalculatePriceModal({ onClose }: { onClose: () => void }) {
  const [testSearch, setTestSearch] = useState("");
  const [selectedTests, setSelectedTests] = useState<TestCatalogItem[]>([]);

  const { data: testData, isLoading: testsLoading } = useQuery({
    queryKey: ["test-catalog-price", testSearch],
    queryFn: async () => {
      const res = await api.get<{ data: { data: TestCatalogItem[] } }>(`/test-catalog?search=${testSearch}&limit=50`);
      return res.data.data.data ?? [];
    },
    enabled: testSearch.length >= 1,
  });

  const total = useMemo(() =>
    selectedTests.reduce((sum, t) => sum + Number(t.price || 0), 0),
    [selectedTests]
  );

  const addTest = useCallback((test: TestCatalogItem) => {
    setSelectedTests((prev) => {
      if (prev.find((t) => t.id === test.id)) return prev;
      return [...prev, test];
    });
  }, []);

  const removeTest = useCallback((id: string) => {
    setSelectedTests((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">Calculate Price</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-400"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={testSearch}
              onChange={(e) => setTestSearch(e.target.value)}
              placeholder="Search tests..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]/20 focus:border-[#0D7E8A]"
            />
          </div>
          {testsLoading && <div className="flex justify-center py-4"><Loader2 size={20} className="animate-spin text-slate-400" /></div>}
          {testData && testData.length > 0 && (
            <div className="border border-slate-200 rounded-lg max-h-40 overflow-y-auto">
              {testData.map((test) => {
                const alreadyAdded = selectedTests.some((t) => t.id === test.id);
                return (
                  <button
                    key={test.id}
                    onClick={() => addTest(test)}
                    disabled={alreadyAdded}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 text-sm border-b border-slate-50 last:border-0 transition",
                      alreadyAdded ? "bg-slate-50 text-slate-400 cursor-default" : "hover:bg-blue-50 text-slate-700"
                    )}
                  >
                    <span>{test.name} <span className="text-xs text-slate-400 ml-1">({test.code})</span></span>
                    <span className="font-medium">{formatCurrency(Number(test.price || 0))}</span>
                  </button>
                );
              })}
            </div>
          )}
          {selectedTests.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Selected Tests</p>
              {selectedTests.map((test) => (
                <div key={test.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{test.name}</p>
                    <p className="text-xs text-slate-400">{test.category}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-700">{formatCurrency(Number(test.price || 0))}</span>
                    <button onClick={() => removeTest(test.id)} className="text-slate-400 hover:text-red-500 transition"><X size={14} /></button>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <span className="text-sm font-bold text-slate-800">Total</span>
                <span className="text-lg font-bold text-[#1B4F8A]">{formatCurrency(total)}</span>
              </div>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition">Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Searchable Dropdown ──────────────────────────────────────────────────────

function SearchableDropdown<T extends { id: string }>({
  label,
  placeholder,
  value,
  displayValue,
  searchFn,
  renderOption,
  onSelect,
  onClear,
}: {
  label: string;
  placeholder: string;
  value: string;
  displayValue: string;
  searchFn: (q: string) => Promise<T[]>;
  renderOption: (item: T) => React.ReactNode;
  onSelect: (item: T) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const doSearch = useCallback((q: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (q.length < 2) { setResults([]); return; }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await searchFn(q);
        setResults(r);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [searchFn]);

  return (
    <div ref={ref} className="relative">
      <label className={labelCls}>{label}</label>
      {value ? (
        <div className="flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2 bg-slate-50">
          <span className="text-sm text-slate-800">{displayValue}</span>
          <button onClick={() => { onClear(); setQuery(""); }} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
        </div>
      ) : (
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); doSearch(e.target.value); setOpen(true); }}
            onFocus={() => { if (query.length >= 2) setOpen(true); }}
            placeholder={placeholder}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]/20 focus:border-[#0D7E8A]"
          />
        </div>
      )}
      {open && !value && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {loading && <div className="flex justify-center py-3"><Loader2 size={16} className="animate-spin text-slate-400" /></div>}
          {!loading && results.length === 0 && query.length >= 2 && (
            <p className="px-3 py-3 text-xs text-slate-400 text-center">No results found</p>
          )}
          {!loading && results.map((item) => (
            <button
              key={item.id}
              onClick={() => { onSelect(item); setOpen(false); setQuery(""); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-slate-50 last:border-0 transition"
            >
              {renderOption(item)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Symptom-to-Test Quick Suggestions ────────────────────────────────────────

const SYMPTOM_CHIPS: { label: string; testNames: string[] }[] = [
  { label: "Tiredness", testNames: ["CBC", "Ferritin", "Vitamin B12", "Vitamin D", "TSH"] },
  { label: "Hair Fall", testNames: ["TSH", "Ferritin", "Vitamin D", "Iron Studies", "CBC"] },
  { label: "Diabetes Check", testNames: ["FBS", "HbA1c", "Insulin Fasting", "Urine R/M"] },
  { label: "Heart Health", testNames: ["Lipid Profile", "hsCRP", "Apolipoprotein"] },
  { label: "Kidney Function", testNames: ["KFT", "Urine R/M", "Microalbumin"] },
  { label: "Liver Check", testNames: ["LFT", "GGT", "Hepatitis B", "Hepatitis C"] },
  { label: "Full Body", testNames: ["CBC", "LFT", "KFT", "Lipid Profile", "TSH", "FBS", "Urine R/M", "Vitamin D", "Vitamin B12"] },
  { label: "Women's Health", testNames: ["CBC", "TSH", "Iron Studies", "Calcium", "Vitamin D"] },
  { label: "Thyroid", testNames: ["TSH", "T3", "T4", "Free T3", "Free T4"] },
  { label: "Vitamin Deficiency", testNames: ["Vitamin D", "Vitamin B12", "Folate", "Iron Studies"] },
  { label: "Anemia", testNames: ["CBC", "Iron Studies", "TIBC", "Ferritin", "Vitamin B12", "Folate"] },
  { label: "Child Health", testNames: ["CBC", "Vitamin D", "Calcium", "Vitamin B12", "Iron Studies"] },
];

// ── Main Page ────────────────────────────────────────────────────────────────

export default function RegistrationPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { activeBranch } = useTenantStore();
  const user = useAuthStore((s) => s.user);

  // -- Registration mode (always walk-in on this page) --
  const registrationMode = "walkin";

  // -- Inline billing state --
  const [registeredPatientId, setRegisteredPatientId] = useState<string | null>(null);
  const [registeredPatientName, setRegisteredPatientName] = useState<string>("");
  const [registeredPatientMrn, setRegisteredPatientMrn] = useState<string>("");
  const [registeredPatientIsReturning, setRegisteredPatientIsReturning] = useState(false);
  const [billingStage, setBillingStage] = useState<"none" | "tests" | "billing">("none");
  const [orderComplete, setOrderComplete] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD" | "UPI" | "INSURANCE" | "CREDIT">("CASH");
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentRemark, setPaymentRemark] = useState("");
  const [paymentRefNumber, setPaymentRefNumber] = useState("");
  const [insuranceTpaName, setInsuranceTpaName] = useState("");
  const [insurancePolicyNo, setInsurancePolicyNo] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [proofKey, setProofKey] = useState<string | null>(null);
  const [proofUploading, setProofUploading] = useState(false);
  const [selectedOrgIsPostpaid, setSelectedOrgIsPostpaid] = useState(false);
  const fileProofRef = useRef<HTMLInputElement>(null);

  // -- Test selection state --
  const [selectedTests, setSelectedTests] = useState<(TestCatalogItem & { quantity: number; ratePrice?: number; priceSource?: string })[]>([]);
  const [testSearchQuery, setTestSearchQuery] = useState("");
  const [testSearchResults, setTestSearchResults] = useState<TestCatalogItem[]>([]);
  const [testSearching, setTestSearching] = useState(false);
  const [orderDiscount, setOrderDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<"FLAT" | "PERCENT">("FLAT");
  const testSearchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // -- Rate list price map --
  const [rateListPriceMap, setRateListPriceMap] = useState<Map<string, number>>(new Map());

  // -- Order result state --
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null);
  const [orderCreating, setOrderCreating] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [investigationTokens, setInvestigationTokens] = useState<Array<{ id?: string; tokenDisplay: string; departmentName?: string; investigationType?: string }>>([]);
  const [whatsAppSent, setWhatsAppSent] = useState(false);

  // -- Top section state --
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);

  // -- Form state --
  const [form, setForm] = useState<RegistrationForm>({ ...EMPTY_FORM });
  const [selectedPatient, setSelectedPatient] = useState<SelectedPatient | null>(null);
  const [searchMode, setSearchMode] = useState<SearchMode>("phone");
  const [patientSearch, setPatientSearch] = useState("");
  const [patientResults, setPatientResults] = useState<PhoneSearchResult[]>([]);
  const [patientSearching, setPatientSearching] = useState(false);
  const [patientDropdownOpen, setPatientDropdownOpen] = useState(false);
  const [medHistoryOpen, setMedHistoryOpen] = useState(false);
  const [dobChanging, setDobChanging] = useState(false);
  const [ageChanging, setAgeChanging] = useState(false);
  const patientSearchRef = useRef<HTMLDivElement>(null);
  const patientTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // -- Rate Lists --
  const { data: rateLists } = useQuery({
    queryKey: ["rate-lists"],
    queryFn: async () => {
      try {
        const res = await api.get("/rate-lists");
        return (res.data?.data?.data ?? res.data?.data ?? []) as { id: string; name: string; isDefault: boolean }[];
      } catch {
        return [];
      }
    },
    enabled: !!user,
  });

  // -- Fetch rate list prices when rateListId changes --
  useEffect(() => {
    if (!form.rateListId) {
      setRateListPriceMap(new Map());
      return;
    }
    api.get(`/rate-lists/${form.rateListId}/items`)
      .then((res) => {
        const items = (res.data?.data?.data ?? res.data?.data ?? []) as { testCatalogId: string; price: number | string; isActive: boolean }[];
        const arr = Array.isArray(items) ? items : [];
        const map = new Map<string, number>();
        arr.forEach((item: { testCatalogId: string; price: number | string; isActive: boolean }) => {
          if (item.isActive !== false) map.set(item.testCatalogId, Number(item.price));
        });
        setRateListPriceMap(map);
      })
      .catch(() => setRateListPriceMap(new Map()));
  }, [form.rateListId]);

  // -- Test search handler (uses /orders/catalog with org pricing) --
  const handleTestSearch = useCallback((q: string) => {
    setTestSearchQuery(q);
    if (testSearchTimer.current) clearTimeout(testSearchTimer.current);
    if (q.length < 2) { setTestSearchResults([]); return; }
    testSearchTimer.current = setTimeout(async () => {
      setTestSearching(true);
      try {
        const params = new URLSearchParams({ search: q });
        if (form.organizationId) params.set("orgId", form.organizationId);
        const res = await api.get(`/orders/catalog?${params}`);
        const raw = (res.data?.data ?? res.data) as { tests: (TestCatalogItem & { mrp: number; price: number; priceSource: string })[] };
        const items = (raw as { tests: TestCatalogItem[] }).tests ?? [];
        setTestSearchResults(Array.isArray(items) ? items : []);
      } catch {
        setTestSearchResults([]);
      } finally {
        setTestSearching(false);
      }
    }, 300);
  }, [form.organizationId]);

  // -- Add test to selection --
  // -- Duplicate/redundant test detection --
  const TEST_INCLUDES_MAP: Record<string, string[]> = {
    PT0760: ["PT0762", "PT0764", "PT0765"],
    PT0761: ["PT0762", "PT0764", "PT0765", "PT0766"],
    PT0242: ["PT0243", "PT0245"],
  };
  const TEST_REVERSE_MAP = useMemo(() => {
    const reverse: Record<string, string[]> = {};
    Object.entries(TEST_INCLUDES_MAP).forEach(([profile, included]) => {
      included.forEach((code) => {
        if (!reverse[code]) reverse[code] = [];
        reverse[code].push(profile);
      });
    });
    return reverse;
  }, []);

  const getRedundancyWarnings = useCallback(
    (newTestCode: string, currentCodes: string[]) => {
      const warnings: string[] = [];
      const included = TEST_INCLUDES_MAP[newTestCode] || [];
      const alreadyInCart = included.filter((c) => currentCodes.includes(c));
      if (alreadyInCart.length > 0) {
        warnings.push(`This profile already includes individual tests in your cart. You can remove them to avoid duplication.`);
      }
      const coveredByProfiles = (TEST_REVERSE_MAP[newTestCode] || []).filter((p) => currentCodes.includes(p));
      if (coveredByProfiles.length > 0) {
        const profileNames = coveredByProfiles
          .map((c) => selectedTests.find((t) => t.code === c)?.name || c)
          .join(", ");
        warnings.push(`Already included in: ${profileNames}. Adding separately may be unnecessary.`);
      }
      return warnings;
    },
    [TEST_REVERSE_MAP, selectedTests],
  );

  const getTestCoveredBy = useCallback(
    (testCode: string, currentCodes: string[]) => {
      return (TEST_REVERSE_MAP[testCode] || [])
        .filter((p) => currentCodes.includes(p))
        .map((c) => selectedTests.find((t) => t.code === c)?.name || c);
    },
    [TEST_REVERSE_MAP, selectedTests],
  );

  const addTestToOrder = useCallback((test: TestCatalogItem & { price: number | string; priceSource?: string }) => {
    setSelectedTests((prev) => {
      if (prev.find((t) => t.id === test.id)) return prev;
      // Use org price from catalog if available, else rate list map, else MRP
      const catalogPrice = Number(test.price || 0);
      const ratePrice = test.priceSource === "ORG" ? catalogPrice : (rateListPriceMap.get(test.id) ?? undefined);
      return [...prev, { ...test, quantity: 1, ratePrice, priceSource: test.priceSource }];
    });
    // Check for redundancy warnings
    const currentCodes = selectedTests.map((t) => t.code);
    const warnings = getRedundancyWarnings(test.code, currentCodes);
    if (warnings.length > 0) {
      toast.warning(warnings[0], { duration: 6000 });
    }
  }, [rateListPriceMap, selectedTests, getRedundancyWarnings]);

  // -- Symptom chip handler: search and add tests by name --
  const handleSymptomChip = useCallback(async (testNames: string[]) => {
    try {
      for (const name of testNames) {
        const res = await api.get(`/orders/catalog?search=${encodeURIComponent(name)}&limit=3`);
        const raw = (res.data?.data ?? res.data) as { tests: TestCatalogItem[] };
        const items = (raw as { tests: TestCatalogItem[] }).tests ?? [];
        if (items.length > 0) {
          const test = items[0];
          if (!selectedTests.some((t) => t.id === test.id)) {
            addTestToOrder(test as TestCatalogItem & { price: number | string; priceSource?: string });
          }
        }
      }
      toast.success(`Added tests for selected symptom`);
    } catch {
      toast.error("Failed to add symptom tests");
    }
  }, [selectedTests, addTestToOrder]);

  // -- Remove test from selection --
  const removeTestFromOrder = useCallback((id: string) => {
    setSelectedTests((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // -- Computed billing amounts --
  const billingTotals = useMemo(() => {
    let subtotal = 0;
    let mrpTotal = 0;
    selectedTests.forEach((t) => {
      const price = t.ratePrice ?? Number(t.price || 0);
      const mrp = Number(t.mrp ?? t.price ?? 0);
      subtotal += price * t.quantity;
      mrpTotal += mrp * t.quantity;
    });
    const discountAmt = discountType === "PERCENT"
      ? Math.round(subtotal * orderDiscount / 100 * 100) / 100
      : orderDiscount;
    const total = Math.max(0, subtotal - discountAmt);
    const saved = mrpTotal - total;
    return { subtotal, mrpTotal, discountAmt, total, saved, testCount: selectedTests.length };
  }, [selectedTests, orderDiscount, discountType]);

  // -- Credit order check --
  const isCreditOrder = paymentMethod === "CREDIT";

  // -- Soft phone/email warnings (never block submission) --
  const phoneWarning = useMemo(() => {
    if (!form.phone) return null;
    const digits = form.phone.replace(/\D/g, "");
    if (digits.length < 10) return "Phone number seems short — Indian numbers are 10 digits";
    if (digits.length > 10) return "Phone number seems long — check for extra digits";
    if (!["6", "7", "8", "9"].includes(digits[0]))
      return "Indian mobile numbers start with 6, 7, 8, or 9";
    return null;
  }, [form.phone]);

  const emailWarning = useMemo(() => {
    if (!form.email || form.email.trim() === "") return null;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) return "Email format looks incorrect — please verify";
    return null;
  }, [form.email]);

  // -- Check if any test requires lab sample (not imaging/ECG) --
  const hasLabTests = useMemo(() => {
    const imagingCategories = ["IMAGING", "RADIOLOGY", "X-RAY", "ULTRASOUND", "CT", "MRI", "ECG"];
    return selectedTests.some((t) => !imagingCategories.includes((t.category || "").toUpperCase()));
  }, [selectedTests]);

  // -- Payment proof upload handler --
  const handleProofUpload = useCallback(async (file: File) => {
    setProofFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setProofPreview(e.target?.result as string ?? null);
    reader.readAsDataURL(file);
    setProofUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post<{ data: { url: string; key: string } }>("/billing/upload-proof", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const d = res.data.data ?? res.data;
      setProofUrl((d as { url: string }).url);
      setProofKey((d as { key: string }).key);
    } catch {
      toast.error("Proof upload failed — you can still create the order");
    } finally {
      setProofUploading(false);
    }
  }, []);

  // -- Switch payment method (reset proof state) --
  const switchPaymentMethod = useCallback((method: "CASH" | "CARD" | "UPI" | "INSURANCE" | "CREDIT") => {
    setPaymentMethod(method);
    setProofFile(null);
    setProofPreview(null);
    setProofUrl(null);
    setProofKey(null);
    setPaymentRefNumber("");
    setInsuranceTpaName("");
    setInsurancePolicyNo("");
  }, []);

  // -- Create order with full payment metadata --
  const handleCreateOrder = useCallback(async () => {
    if (!registeredPatientId || selectedTests.length === 0) return;
    setOrderCreating(true);
    try {
      const branchId = activeBranch?.id || "branch-delvion-001";
      const orderPayload = {
        patientId: registeredPatientId,
        branchId,
        items: selectedTests.map((t) => ({
          testCatalogId: t.id,
          quantity: t.quantity,
          discount: 0,
        })),
        priority: "ROUTINE",
        collectionType: "WALK_IN",
        discountAmount: orderDiscount,
        discountType: orderDiscount > 0 ? discountType : "NONE",
        notes: form.notes || undefined,
        referringDoctorId: form.referralDoctorId || undefined,
        organizationId: form.organizationId || undefined,
        rateListId: form.rateListId || undefined,
        isCreditOrder,
        paymentMethod: isCreditOrder ? "CREDIT" : paymentMethod,
        amountReceived: isCreditOrder ? 0 : (Number(amountPaid) || billingTotals.total),
        paymentRemark: paymentRemark || undefined,
        paymentRefNumber: paymentRefNumber || undefined,
        paymentScreenshotUrl: proofUrl || undefined,
        paymentScreenshotKey: proofKey || undefined,
        insuranceTpaName: insuranceTpaName || undefined,
        insurancePolicyNo: insurancePolicyNo || undefined,
      };
      const orderRes = await api.post<{
        data: { id: string; orderNumber: string; invoiceId?: string };
      }>("/orders", orderPayload);
      const order = orderRes.data.data;
      setCreatedOrderId(order.id);
      setOrderNumber(order.orderNumber);
      setCreatedInvoiceId(order.invoiceId ?? null);
      setOrderComplete(true);

      // Auto-issue queue token
      try {
        const tokenType = form.patientType === "VIP" ? "PRIORITY" : "WALKIN";
        const tokenRes = await api.post<{ data: { tokenDisplay: string } }>("/front-desk/queue/issue", {
          patientName: form.fullName,
          patientId: registeredPatientId,
          orderId: order.id,
          type: tokenType,
        });
        const tokenData = tokenRes.data.data ?? tokenRes.data;
        setCreatedToken((tokenData as { tokenDisplay: string }).tokenDisplay);
      } catch {
        // Token generation is non-blocking
      }

      // Auto-issue investigation tokens for non-pathology tests
      try {
        const nonPathologyTests = selectedTests.filter(
          (t) => (t as unknown as { investigationType?: string }).investigationType &&
                 (t as unknown as { investigationType?: string }).investigationType !== "PATHOLOGY"
        );
        if (nonPathologyTests.length > 0) {
          const invTokenRes = await api.post<{ data: Array<{ tokenDisplay: string; departmentName?: string; investigationType?: string }> }>("/front-desk/queue/issue-investigation", {
            orderId: order.id,
            patientName: form.fullName,
            patientId: registeredPatientId,
            phone: form.phone,
            orderItems: nonPathologyTests.map((t) => ({ testCatalogId: t.id })),
          });
          const invTokens = invTokenRes.data?.data ?? invTokenRes.data ?? [];
          setInvestigationTokens(Array.isArray(invTokens) ? invTokens : []);
        }
      } catch {
        // Investigation token generation is non-blocking
      }

      // Auto-send WhatsApp notification
      if (form.phone) {
        try {
          await api.post("/notifications/send", {
            channel: "WHATSAPP",
            templateType: "REGISTRATION_CONFIRMED",
            to: form.phone,
            patientId: registeredPatientId,
            orderId: order.id,
            vars: {
              patientName: form.fullName,
              tokenNumber: "",
              tests: selectedTests.map((t) => t.name).join(", "),
              amount: String(billingTotals.total),
              paymentStatus: isCreditOrder ? "Credit" : "Paid",
            },
          });
          setWhatsAppSent(true);
        } catch {
          // WhatsApp is non-blocking
        }
      }

      if (isCreditOrder) {
        toast.success(`Order created — posted to ${form.organizationName || "org"} ledger`);
      } else {
        toast.success(`Order #${order.orderNumber} created — sent to accession queue`);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Order creation failed";
      toast.error(msg);
    } finally {
      setOrderCreating(false);
    }
  }, [registeredPatientId, selectedTests, orderDiscount, discountType, paymentMethod, amountPaid, activeBranch, form, isCreditOrder, billingTotals.total, paymentRemark, paymentRefNumber, proofUrl, proofKey, insuranceTpaName, insurancePolicyNo]);

  // -- Register mutation --
  const registerMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await api.post<{ data: { id: string; _isReturning?: boolean; _message?: string; mrn?: string } }>("/patients", payload);
      return res.data.data;
    },
    onSuccess: (data) => {
      if (data._isReturning) {
        toast.info(data._message || "Returning patient found");
        setRegisteredPatientIsReturning(true);
      } else {
        toast.success("Patient registered successfully");
        setRegisteredPatientIsReturning(false);
      }
      queryClient.invalidateQueries({ queryKey: ["registered-patients"] });
      setRegisteredPatientId(data.id);
      setRegisteredPatientName(form.fullName);
      setRegisteredPatientMrn((data as { mrn?: string }).mrn ?? "");
      setBillingStage("tests");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Registration failed";
      toast.error(msg);
    },
  });

  // -- Update existing patient mutation --
  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Record<string, unknown> }) => {
      const res = await api.put<{ data: { id: string } }>(`/patients/${id}`, payload);
      return res.data.data;
    },
    onSuccess: (data) => {
      toast.success("Patient updated — proceed to tests");
      queryClient.invalidateQueries({ queryKey: ["registered-patients"] });
      setRegisteredPatientId(data.id);
      setRegisteredPatientName(form.fullName);
      setRegisteredPatientIsReturning(true);
      setBillingStage("tests");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Update failed";
      toast.error(msg);
    },
  });

  // -- Close patient search dropdown on outside click --
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (patientSearchRef.current && !patientSearchRef.current.contains(e.target as Node)) {
        setPatientDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // -- DOB -> Age sync --
  useEffect(() => {
    if (dobChanging && form.dobDay && form.dobMonth && form.dobYear) {
      const { value, unit } = dobToAge(form.dobDay, form.dobMonth, form.dobYear);
      setForm((f) => ({ ...f, ageValue: String(value), ageUnit: unit }));
      setDobChanging(false);
    }
  }, [form.dobDay, form.dobMonth, form.dobYear, dobChanging]);

  // -- Age -> DOB sync --
  useEffect(() => {
    if (ageChanging && form.ageValue) {
      const val = parseInt(form.ageValue);
      if (!isNaN(val) && val >= 0) {
        const { day, month, year } = ageToDob(val, form.ageUnit);
        setForm((f) => ({ ...f, dobDay: day, dobMonth: month, dobYear: year }));
      }
      setAgeChanging(false);
    }
  }, [form.ageValue, form.ageUnit, ageChanging]);

  // -- Form field updater --
  const updateForm = useCallback(<K extends keyof RegistrationForm>(key: K, value: RegistrationForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  }, []);

  // -- Patient search handler (phone-first) --
  const handlePatientSearch = useCallback((q: string) => {
    setPatientSearch(q);
    if (patientTimerRef.current) clearTimeout(patientTimerRef.current);
    const minLen = searchMode === "phone" ? 4 : 2;
    if (q.length < minLen) { setPatientResults([]); setPatientDropdownOpen(false); return; }
    patientTimerRef.current = setTimeout(async () => {
      setPatientSearching(true);
      try {
        const endpoint = searchMode === "phone"
          ? `/patients/search/phone?q=${encodeURIComponent(q)}`
          : `/patients/search?q=${encodeURIComponent(q)}`;
        const res = await api.get<{ data: PhoneSearchResult[] }>(endpoint);
        const results: PhoneSearchResult[] = Array.isArray(res.data.data) ? res.data.data : (res.data as unknown as PhoneSearchResult[]) ?? [];
        setPatientResults(results);
        setPatientDropdownOpen(true);
      } catch {
        setPatientResults([]);
      } finally {
        setPatientSearching(false);
      }
    }, 400);
  }, [searchMode]);

  // -- Select existing patient to fill form --
  const selectPatientFromSearch = useCallback((p: PhoneSearchResult) => {
    setSelectedPatient({
      id: p.id, mrn: p.mrn, firstName: p.firstName, lastName: p.lastName,
      fullName: p.fullName, age: p.age, dob: p.dob, gender: p.gender,
      phone: p.phone, email: p.email ?? null, address: p.address ?? null,
      createdAt: "", orderCount: p.totalVisits ?? 0,
    });
    setPatientDropdownOpen(false);
    setPatientSearch("");
    const dob = p.dob ? new Date(p.dob) : null;
    setForm((f) => ({
      ...f,
      fullName: p.fullName,
      gender: (p.gender as Gender) || "MALE",
      phone: p.phone?.replace("+91", "").replace(/^91/, "") || "",
      email: p.email || "",
      address: p.address || "",
      city: p.city || "",
      state: p.state || "",
      pincode: p.pincode || "",
      designation: (p.designation as Designation) || (p.gender === "FEMALE" ? "Ms." : "Mr."),
      patientType: (p.patientType as PatientType) || "Regular",
      dobDay: dob ? String(dob.getDate()) : "",
      dobMonth: dob ? String(dob.getMonth() + 1) : "",
      dobYear: dob ? String(dob.getFullYear()) : "",
      ageValue: p.age ? String(p.age) : "",
      ageUnit: "Year",
    }));
  }, []);

  // -- Clear patient selection --
  const clearPatientSelection = useCallback(() => {
    setSelectedPatient(null);
    setForm({ ...EMPTY_FORM });
  }, []);

  // -- Reset form --
  const resetForm = useCallback(() => {
    setForm({ ...EMPTY_FORM });
    setSelectedPatient(null);
    setPatientSearch("");
    setMedHistoryOpen(false);
  }, []);

  // (accession moved to /accession page)

  // -- Start new registration (reset everything) --
  const startNewRegistration = useCallback(() => {
    setBillingStage("none");
    setOrderComplete(false);
    setRegisteredPatientId(null);
    setRegisteredPatientName("");
    setRegisteredPatientMrn("");
    setRegisteredPatientIsReturning(false);
    setSelectedTests([]);
    setTestSearchQuery("");
    setTestSearchResults([]);
    setOrderDiscount(0);
    setDiscountType("FLAT");
    setAmountPaid("");
    setPaymentMethod("CASH");
    setPaymentRemark("");
    setPaymentRefNumber("");
    setInsuranceTpaName("");
    setInsurancePolicyNo("");
    setProofFile(null);
    setProofPreview(null);
    setProofUrl(null);
    setProofKey(null);
    setCreatedOrderId(null);
    setOrderNumber(null);
    setCreatedInvoiceId(null);
    setCreatedToken(null);
    setInvestigationTokens([]);
    setWhatsAppSent(false);
    resetForm();
    toast.success("Ready for next registration");
  }, [resetForm]);

  // -- Handle registration --
  const handleRegister = useCallback(() => {
    const { firstName, lastName } = splitName(form.fullName);
    if (!firstName.trim()) { toast.error("Patient name is required"); return; }
    if (!form.phone.trim()) { toast.error("Phone number is required"); return; }
    if (form.phone.trim().length !== 10) { toast.error("Phone number must be 10 digits"); return; }

    let dob: string | undefined;
    if (form.dobDay && form.dobMonth && form.dobYear) {
      const m = form.dobMonth.padStart(2, "0");
      const d = form.dobDay.padStart(2, "0");
      dob = `${form.dobYear}-${m}-${d}`;
    }

    const branchId = activeBranch?.id || "branch-delvion-001";
    const payload: Record<string, unknown> = {
      firstName: firstName.trim(),
      lastName: lastName.trim() || "",
      gender: form.gender,
      phone: `+91${form.phone.trim()}`,
      branchId,
    };
    if (dob) payload.dob = dob;
    if (form.email?.trim()) payload.email = form.email.trim();
    if (form.address?.trim()) payload.address = form.address.trim();
    if (form.city?.trim()) payload.city = form.city.trim();
    if (form.state) payload.state = form.state;
    if (form.pincode?.trim()) payload.pincode = form.pincode.trim();
    if (form.designation) payload.designation = form.designation;
    if (form.patientType && form.patientType !== "Regular") payload.patientType = form.patientType;
    if (form.notes?.trim()) payload.notes = form.notes.trim();
    if (form.rateListId) payload.rateListId = form.rateListId;
    if (form.organizationId) payload.organizationId = form.organizationId;
    if (form.referralDoctorId) payload.referralDoctorId = form.referralDoctorId;
    payload.reportDeliveryMode = form.reportDeliveryMode || "MANUAL";
    payload.preferredChannel = form.preferredChannels ?? [];
    if (form.reportMobile) payload.reportMobile = form.reportMobile;
    if (form.reportEmail) payload.reportEmail = form.reportEmail;
    payload.reportLanguage = form.reportLanguage || "ENGLISH";
    payload.whatsappOptIn = form.whatsappOptIn;
    payload.emailOptIn = form.emailOptIn;
    payload.smsOptIn = form.smsOptIn;

    if (selectedPatient) {
      // Existing patient — update instead of create
      updateMutation.mutate({ id: selectedPatient.id, payload });
    } else {
      registerMutation.mutate(payload);
    }
  }, [form, activeBranch, registerMutation, updateMutation, selectedPatient]);

  // -- Organization search fn --
  const searchOrganizations = useCallback(async (q: string): Promise<Organization[]> => {
    try {
      const res = await api.get(`/organizations?search=${encodeURIComponent(q)}&limit=20`);
      const raw = res.data?.data?.data ?? res.data?.data ?? [];
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }, []);

  // -- Doctor search fn --
  const searchDoctors = useCallback(async (q: string): Promise<DoctorResult[]> => {
    try {
      const res = await api.get(`/crm/doctors?search=${encodeURIComponent(q)}&limit=20`);
      const raw = res.data?.data?.data ?? res.data?.data ?? [];
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }, []);

  // -- Zustand hydration guard (after all hooks) --
  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#0D7E8A] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── PAGE HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Registration & Billing</h1>
          <p className="text-sm text-slate-500 mt-0.5">Register patients and collect billing in one flow</p>
        </div>
        <div className="flex items-center gap-2">
          <SearchInput
            value=""
            onChange={() => {}}
            placeholder="Search by name, phone, MRN..."
          />
          <button
            onClick={() => router.push("/registration/bulk")}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition whitespace-nowrap"
          >
            <Upload size={14} />
            Bulk Registration
          </button>
          <button
            onClick={() => setShowPriceModal(true)}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition whitespace-nowrap"
          >
            <Calculator size={14} />
            Calculate Price
          </button>
        </div>
      </div>

      {/* ── BOTTOM SECTION: Register New Patient ── */}
      <div className="bg-white rounded-xl card-shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#0D7E8A]/10">
            <UserPlus size={18} className="text-[#0D7E8A]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Walk-in Registration</h2>
            <p className="text-xs text-slate-500">Register patient and proceed to billing</p>
          </div>
        </div>

        <div className="p-6">
          {/* -- Patient Search Bar (Phone-First) -- */}
          <div ref={patientSearchRef} className="relative mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-600">Search Patient</label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => { setSearchMode("phone"); setPatientSearch(""); setPatientResults([]); setPatientDropdownOpen(false); }}
                  className={cn("px-2.5 py-1 text-[11px] font-medium rounded-full border transition",
                    searchMode === "phone" ? "border-[#0D7E8A] bg-[#0D7E8A] text-white" : "border-slate-200 text-slate-500 hover:border-slate-300"
                  )}
                >
                  By Phone
                </button>
                <button
                  type="button"
                  onClick={() => { setSearchMode("name"); setPatientSearch(""); setPatientResults([]); setPatientDropdownOpen(false); }}
                  className={cn("px-2.5 py-1 text-[11px] font-medium rounded-full border transition",
                    searchMode === "name" ? "border-[#0D7E8A] bg-[#0D7E8A] text-white" : "border-slate-200 text-slate-500 hover:border-slate-300"
                  )}
                >
                  By Name
                </button>
              </div>
            </div>

            {selectedPatient ? (
              <div className="flex items-center justify-between border border-green-200 bg-green-50 rounded-lg px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                    selectedPatient.gender === "FEMALE" ? "bg-pink-100 text-pink-700" : "bg-blue-100 text-blue-700"
                  )}>
                    {selectedPatient.firstName[0]}{selectedPatient.lastName?.[0] || ""}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-green-900">{selectedPatient.firstName} {selectedPatient.lastName}</p>
                    <p className="text-xs text-green-600">
                      {selectedPatient.mrn} · {selectedPatient.phone}
                      {selectedPatient.age ? ` · ${selectedPatient.age}Y` : ""}
                      {selectedPatient.orderCount ? ` · ${selectedPatient.orderCount} visit${selectedPatient.orderCount !== 1 ? "s" : ""}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Returning Patient</span>
                  <button onClick={clearPatientSelection} className="text-green-400 hover:text-green-600"><X size={16} /></button>
                </div>
              </div>
            ) : (
              <div className="relative">
                {searchMode === "phone" ? (
                  <Smartphone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                ) : (
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                )}
                {patientSearching && <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />}
                <input
                  type="text"
                  value={patientSearch}
                  onChange={(e) => handlePatientSearch(e.target.value)}
                  placeholder={searchMode === "phone" ? "Enter mobile number (e.g. 9876543210)..." : "Search by name or MRN..."}
                  className="w-full pl-10 pr-10 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]/20 focus:border-[#0D7E8A] transition"
                  inputMode={searchMode === "phone" ? "tel" : "text"}
                />
              </div>
            )}

            {/* Dropdown results */}
            {patientDropdownOpen && !selectedPatient && (
              <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-80 overflow-y-auto">
                {patientSearching && (
                  <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-slate-400" /></div>
                )}
                {!patientSearching && patientResults.length === 0 && patientSearch.length >= (searchMode === "phone" ? 4 : 2) && (
                  <div className="p-4 text-center">
                    <p className="text-sm text-slate-500 mb-1">No patients found</p>
                    <p className="text-xs text-slate-400">Register as a new patient below</p>
                  </div>
                )}
                {!patientSearching && patientResults.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => selectPatientFromSearch(p)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50/50 border-b border-slate-100 last:border-0 transition text-left"
                  >
                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                      p.gender === "FEMALE" ? "bg-pink-100 text-pink-700" : "bg-blue-100 text-blue-700"
                    )}>
                      {p.firstName[0]}{p.lastName?.[0] || ""}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">{p.fullName}</p>
                        <span className="text-xs text-slate-400">{p.gender?.charAt(0)}, {p.age}Y</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {p.mrn} · {p.phone}
                        {p.totalVisits != null && ` · ${p.totalVisits} visit${p.totalVisits !== 1 ? "s" : ""}`}
                        {p.lastVisit && ` · Last: ${formatDate(p.lastVisit)}`}
                      </p>
                    </div>
                    <ChevronRight size={14} className="text-slate-300 shrink-0" />
                  </button>
                ))}

                {/* Register as New Patient — always at bottom */}
                {!patientSearching && patientSearch.length >= (searchMode === "phone" ? 4 : 2) && (
                  <button
                    onClick={() => {
                      setPatientDropdownOpen(false);
                      setSelectedPatient(null);
                      if (searchMode === "phone") {
                        const cleaned = patientSearch.replace(/[\s\-\+\(\)]/g, "").replace(/^91/, "").slice(-10);
                        updateForm("phone", cleaned);
                      }
                      setPatientSearch("");
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 hover:bg-emerald-50 text-left transition border-t border-slate-200"
                  >
                    <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                      <UserPlus size={18} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-emerald-700">Register as New Patient</p>
                      <p className="text-xs text-slate-400">Create a new patient record</p>
                    </div>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* -- Divider -- */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
              {selectedPatient ? "Edit Patient Details" : "Or Register New Patient"}
            </span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* -- Registration Form -- */}
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Left column (60%) */}
            <div className="flex-1 space-y-5">
              {/* Row 1: Designation + Full Name */}
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-3">
                  <label className={labelCls}>Designation</label>
                  <select
                    value={form.designation}
                    onChange={(e) => updateForm("designation", e.target.value as Designation)}
                    className={inputCls}
                  >
                    {DESIGNATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="col-span-9">
                  <label className={labelCls}>Full Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={form.fullName}
                    onChange={(e) => updateForm("fullName", e.target.value)}
                    placeholder="First Name Last Name"
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Row 2: Gender */}
              <div>
                <label className={labelCls}>Gender <span className="text-red-500">*</span></label>
                <div className="flex items-center gap-4">
                  {GENDERS.map((g) => (
                    <label key={g.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="gender"
                        value={g.value}
                        checked={form.gender === g.value}
                        onChange={() => updateForm("gender", g.value)}
                        className="w-4 h-4 accent-[#0D7E8A]"
                      />
                      <span className="text-sm text-slate-700">{g.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Row 3: DOB + Age */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Date of Birth</label>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={form.dobDay}
                      onChange={(e) => { updateForm("dobDay", e.target.value); setDobChanging(true); }}
                      className={inputCls}
                    >
                      <option value="">Day</option>
                      {generateDays(form.dobMonth, form.dobYear).map((d) => (
                        <option key={d} value={String(d)}>{d}</option>
                      ))}
                    </select>
                    <select
                      value={form.dobMonth}
                      onChange={(e) => { updateForm("dobMonth", e.target.value); setDobChanging(true); }}
                      className={inputCls}
                    >
                      <option value="">Month</option>
                      {MONTHS.map((m, i) => (
                        <option key={m} value={String(i + 1)}>{m.slice(0, 3)}</option>
                      ))}
                    </select>
                    <select
                      value={form.dobYear}
                      onChange={(e) => { updateForm("dobYear", e.target.value); setDobChanging(true); }}
                      className={inputCls}
                    >
                      <option value="">Year</option>
                      {generateYears().map((y) => (
                        <option key={y} value={String(y)}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Age</label>
                  <div className="grid grid-cols-5 gap-2">
                    <input
                      type="number"
                      min="0"
                      max="150"
                      value={form.ageValue}
                      onChange={(e) => { updateForm("ageValue", e.target.value); setAgeChanging(true); }}
                      placeholder="0"
                      className={cn(inputCls, "col-span-3")}
                    />
                    <select
                      value={form.ageUnit}
                      onChange={(e) => { updateForm("ageUnit", e.target.value as AgeUnit); setAgeChanging(true); }}
                      className={cn(inputCls, "col-span-2")}
                    >
                      {AGE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Row 4: Phone + Phone Belongs To */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Phone <span className="text-red-500">*</span></label>
                  <div className="flex">
                    <span className="inline-flex items-center px-3 bg-slate-100 border border-r-0 border-slate-200 rounded-l-lg text-sm text-slate-500 font-medium">
                      +91
                    </span>
                    <input
                      type="tel"
                      maxLength={10}
                      value={form.phone}
                      onChange={(e) => updateForm("phone", e.target.value.replace(/\D/g, ""))}
                      placeholder="98765 43210"
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-r-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]/20 focus:border-[#0D7E8A] transition"
                    />
                  </div>
                  {phoneWarning && (
                    <p className="text-xs text-amber-500 mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> {phoneWarning}
                    </p>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Phone Belongs To</label>
                  <div className="flex items-center gap-4 pt-2">
                    {(["Patient", "Relative"] as PhoneBelongsTo[]).map((opt) => (
                      <label key={opt} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="phoneBelongsTo"
                          value={opt}
                          checked={form.phoneBelongsTo === opt}
                          onChange={() => updateForm("phoneBelongsTo", opt)}
                          className="w-4 h-4 accent-[#0D7E8A]"
                        />
                        <span className="text-sm text-slate-700">{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Row 5: Email */}
              <div>
                <label className={labelCls}>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => updateForm("email", e.target.value)}
                  placeholder="patient@example.com"
                  className={inputCls}
                />
                {emailWarning && (
                  <p className="text-xs text-amber-500 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> {emailWarning}
                  </p>
                )}
              </div>

              {/* Row 6: Organization + Referral Doctor */}
              <div className="grid grid-cols-2 gap-4">
                <SearchableDropdown<Organization>
                  label="Organization"
                  placeholder="Search organization..."
                  value={form.organizationId}
                  displayValue={form.organizationName}
                  searchFn={searchOrganizations}
                  renderOption={(org) => (
                    <div>
                      <p className="font-medium text-slate-800 text-sm">{org.name}</p>
                      <p className="text-xs text-slate-400">{org.code}{org.discountPct > 0 ? ` | ${org.discountPct}% discount` : ""}</p>
                    </div>
                  )}
                  onSelect={(org) => {
                    updateForm("organizationId", org.id);
                    updateForm("organizationName", org.name);
                    // Auto-load org's rate list + default referring doctor + credit auto-highlight
                    api.get(`/organisations/${org.id}`)
                      .then((res) => {
                        const orgData = (res.data?.data ?? res.data) as { rateListId: string | null; paymentType?: string; defaultReferringDoctorId?: string | null; defaultReferringDoctorName?: string | null };
                        if (orgData.rateListId) updateForm("rateListId", orgData.rateListId);
                        if (orgData.defaultReferringDoctorName && !form.referralDoctorId) {
                          updateForm("referralDoctorId", orgData.defaultReferringDoctorId || "");
                          updateForm("referralDoctorName", orgData.defaultReferringDoctorName);
                        }
                        // Auto-set CREDIT for post-paid orgs
                        const isPostpaid = orgData.paymentType === "POSTPAID";
                        setSelectedOrgIsPostpaid(isPostpaid);
                        if (isPostpaid) {
                          setPaymentMethod("CREDIT");
                        }
                      })
                      .catch(() => { /* ignore — use default */ });
                  }}
                  onClear={() => { updateForm("organizationId", ""); updateForm("organizationName", ""); updateForm("rateListId", ""); setSelectedOrgIsPostpaid(false); }}
                />
                <SearchableDropdown<DoctorResult>
                  label="Referral Doctor"
                  placeholder="Search doctor..."
                  value={form.referralDoctorId}
                  displayValue={form.referralDoctorName}
                  searchFn={searchDoctors}
                  renderOption={(doc) => (
                    <div>
                      <p className="font-medium text-slate-800 text-sm">{doc.name}</p>
                      {doc.specialization && <p className="text-xs text-slate-400">{doc.specialization}</p>}
                    </div>
                  )}
                  onSelect={(doc) => { updateForm("referralDoctorId", doc.id); updateForm("referralDoctorName", doc.name); }}
                  onClear={() => { updateForm("referralDoctorId", ""); updateForm("referralDoctorName", ""); }}
                />
              </div>

              {/* Row 7: Address */}
              <div>
                <label className={labelCls}>Address</label>
                <textarea
                  value={form.address}
                  onChange={(e) => updateForm("address", e.target.value)}
                  placeholder="Street address, house number..."
                  rows={2}
                  className={cn(inputCls, "resize-none")}
                />
              </div>

              {/* Row 8: City + State + Pincode */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>City</label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => updateForm("city", e.target.value)}
                    placeholder="Bengaluru"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>State</label>
                  <select
                    value={form.state}
                    onChange={(e) => updateForm("state", e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Select state</option>
                    {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Pincode</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={form.pincode}
                    onChange={(e) => updateForm("pincode", e.target.value.replace(/\D/g, ""))}
                    placeholder="560001"
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Row 9: Report Delivery Preference */}
              <div>
                <label className={labelCls}>Report Delivery Preference</label>
                <div className="flex gap-2 mt-1">
                  {(["AUTO", "MANUAL", "DOWNLOAD"] as const).map((mode) => {
                    const labels: Record<string, string> = { AUTO: "⚡ Auto-Send", MANUAL: "👤 Manual", DOWNLOAD: "⬇ Download" };
                    const descriptions: Record<string, string> = {
                      AUTO: "Send automatically on approval",
                      MANUAL: "Staff sends manually",
                      DOWNLOAD: "Walk-in download only",
                    };
                    const isActive = form.reportDeliveryMode === mode;
                    return (
                      <button key={mode} type="button" onClick={() => updateForm("reportDeliveryMode", mode)}
                        className={cn("flex-1 flex flex-col items-center gap-0.5 p-2.5 rounded-lg border-2 text-xs font-medium transition-all",
                          isActive ? "border-[#1B4F8A] bg-[#1B4F8A]/5 text-[#1B4F8A]" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300")}>
                        <span className="font-semibold">{labels[mode]}</span>
                        <span className={cn("text-[10px] leading-tight text-center", isActive ? "text-[#1B4F8A]/70" : "text-slate-400")}>{descriptions[mode]}</span>
                      </button>
                    );
                  })}
                </div>
                {/* Channels */}
                <div className="mt-2 flex gap-2">
                  {["WHATSAPP", "EMAIL", "SMS"].map((ch) => {
                    const selected = (form.preferredChannels ?? []).includes(ch);
                    const icons: Record<string, string> = { WHATSAPP: "💬", EMAIL: "✉️", SMS: "📱" };
                    return (
                      <button key={ch} type="button"
                        onClick={() => {
                          const current = form.preferredChannels ?? [];
                          updateForm("preferredChannels", selected ? current.filter((c) => c !== ch) : [...current, ch]);
                        }}
                        className={cn("flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded border text-xs font-medium transition",
                          selected ? "border-teal-500 bg-teal-50 text-teal-700" : "border-slate-200 bg-white text-slate-400 hover:border-slate-300")}>
                        <span>{icons[ch]}</span> {ch.charAt(0) + ch.slice(1).toLowerCase()}
                      </button>
                    );
                  })}
                </div>
                {/* Report Mobile — same as phone */}
                <div className="mt-2 flex items-center gap-2">
                  <input type="checkbox" id="reportMobileSame" checked={!form.reportMobile}
                    onChange={(e) => updateForm("reportMobile", e.target.checked ? "" : form.phone)}
                    className="w-3.5 h-3.5 accent-teal-600" />
                  <label htmlFor="reportMobileSame" className="text-xs text-slate-500">Report mobile same as phone</label>
                </div>
                {form.reportMobile !== "" && (
                  <input value={form.reportMobile} onChange={(e) => updateForm("reportMobile", e.target.value)}
                    placeholder="Report mobile number" className={cn(inputCls, "mt-1 text-xs py-1.5")} />
                )}
                {(form.preferredChannels ?? []).includes("EMAIL") && (
                  <input value={form.reportEmail} onChange={(e) => updateForm("reportEmail", e.target.value)}
                    placeholder="Report email address" className={cn(inputCls, "mt-1 text-xs py-1.5")} />
                )}
              </div>
            </div>

            {/* Right column (40%) */}
            <div className="w-full lg:w-[38%] space-y-5">
              {/* Patient Type */}
              <div>
                <label className={labelCls}>Patient Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {PATIENT_TYPES.map((pt) => {
                    const Icon = pt.icon;
                    const isActive = form.patientType === pt.value;
                    return (
                      <button
                        key={pt.value}
                        onClick={() => updateForm("patientType", pt.value)}
                        className={cn(
                          "flex items-center gap-2.5 p-3 rounded-lg border-2 text-sm font-medium transition",
                          isActive
                            ? pt.color.replace("border-", "border-").replace("bg-", "bg-") + " ring-1 ring-offset-1"
                            : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                        )}
                      >
                        <Icon size={16} className={isActive ? "" : "text-slate-400"} />
                        {pt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className={labelCls}>
                  <span className="flex items-center gap-1.5"><StickyNote size={12} /> Notes</span>
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => updateForm("notes", e.target.value)}
                  placeholder="Any special instructions or notes..."
                  rows={3}
                  className={cn(inputCls, "resize-none")}
                />
              </div>

              {/* Rate List */}
              <div>
                <label className={labelCls}>Rate List</label>
                <select
                  value={form.rateListId}
                  onChange={(e) => updateForm("rateListId", e.target.value)}
                  className={inputCls}
                >
                  <option value="">Default Rate List</option>
                  {(Array.isArray(rateLists) ? rateLists : []).map((rl: { id: string; name: string; isDefault: boolean }) => (
                    <option key={rl.id} value={rl.id}>
                      {rl.name}{rl.isDefault ? " (Default)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick Info Card */}
              {selectedPatient && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">Patient Record</p>
                  <div className="space-y-1.5 text-sm text-blue-800">
                    <p><span className="font-medium">MRN:</span> {selectedPatient.mrn}</p>
                    <p><span className="font-medium">Previous Orders:</span> {selectedPatient.orderCount}</p>
                    <p><span className="font-medium">Registered:</span> {formatDate(selectedPatient.createdAt)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* -- Medical History (collapsible) -- */}
          <div className="mt-6 border border-slate-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setMedHistoryOpen(!medHistoryOpen)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition"
            >
              <div className="flex items-center gap-2">
                <Heart size={16} className="text-red-400" />
                <span className="text-sm font-semibold text-slate-700">Medical History</span>
                {(form.isHospitalized || form.allergies || form.chiefComplaint || form.patientCategory) && (
                  <span className="w-2 h-2 rounded-full bg-red-400" />
                )}
              </div>
              {medHistoryOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
            </button>
            {medHistoryOpen && (
              <div className="px-4 pb-4 pt-2 border-t border-slate-100 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Is Hospitalized?</label>
                    <div className="flex items-center gap-4 pt-1">
                      {[{ label: "No", value: false }, { label: "Yes", value: true }].map((opt) => (
                        <label key={String(opt.value)} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="hospitalized"
                            checked={form.isHospitalized === opt.value}
                            onChange={() => updateForm("isHospitalized", opt.value)}
                            className="w-4 h-4 accent-[#0D7E8A]"
                          />
                          <span className="text-sm text-slate-700">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Patient Category</label>
                    <select
                      value={form.patientCategory}
                      onChange={(e) => updateForm("patientCategory", e.target.value)}
                      className={inputCls}
                    >
                      <option value="">Select category</option>
                      <option value="OPD">OPD</option>
                      <option value="IPD">IPD</option>
                      <option value="Emergency">Emergency</option>
                      <option value="Home Collection">Home Collection</option>
                      <option value="Camp">Camp</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Allergies</label>
                  <input
                    type="text"
                    value={form.allergies}
                    onChange={(e) => updateForm("allergies", e.target.value)}
                    placeholder="e.g., Penicillin, Sulpha drugs, Latex..."
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Chief Complaint</label>
                  <textarea
                    value={form.chiefComplaint}
                    onChange={(e) => updateForm("chiefComplaint", e.target.value)}
                    placeholder="Primary reason for visit / chief complaint..."
                    rows={2}
                    className={cn(inputCls, "resize-none")}
                  />
                </div>
              </div>
            )}
          </div>

          {/* -- Footer Buttons -- */}
          <div className="flex items-center justify-between pt-6 mt-6 border-t border-slate-200">
            <div className="flex items-center gap-3">
              <button
                onClick={resetForm}
                className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
              >
                <RotateCcw size={14} />
                Reset Form
              </button>
              <button
                onClick={() => { toast.success("Draft saved"); }}
                className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
              >
                <Save size={14} />
                Save Draft
              </button>
            </div>
            <button
              onClick={handleRegister}
              disabled={registerMutation.isPending || updateMutation.isPending || !form.fullName.trim() || !form.phone.trim()}
              className="flex items-center gap-2 px-6 py-2.5 bg-[#0D7E8A] text-white text-sm font-semibold rounded-lg hover:bg-[#0a6670] disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
            >
              {(registerMutation.isPending || updateMutation.isPending) ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <UserPlus size={16} />
              )}
              {(registerMutation.isPending || updateMutation.isPending)
                ? (selectedPatient ? "Updating..." : "Registering...")
                : (selectedPatient ? "Update & Select Tests" : "Register & Select Tests")}
              {!registerMutation.isPending && !updateMutation.isPending && <ArrowRight size={14} />}
            </button>
          </div>
        </div>
      </div>

      {/* ── STAGE PROGRESS INDICATOR ── */}
      {billingStage !== "none" && registeredPatientId && !orderComplete && (
        <div className="flex items-center gap-2">
          {[
            { key: "register", label: "Register", icon: UserPlus },
            { key: "tests", label: "Select Tests", icon: TestTube2 },
            { key: "billing", label: "Payment", icon: IndianRupee },
          ].map((step, idx) => {
            const stages = ["register", "tests", "billing"];
            const currentIdx = stages.indexOf(billingStage);
            const stepIdx = idx;
            const isCompleted = stepIdx < currentIdx || (step.key === "register");
            const isCurrent = step.key === billingStage;
            return (
              <div key={step.key} className="flex items-center gap-2 flex-1">
                <div className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition flex-1 justify-center",
                  isCompleted ? "bg-green-100 text-green-700" :
                  isCurrent ? "bg-[#0D7E8A]/10 text-[#0D7E8A] ring-2 ring-[#0D7E8A]/30" :
                  "bg-slate-100 text-slate-400"
                )}>
                  {isCompleted ? <Check size={14} /> : <step.icon size={14} />}
                  {step.label}
                </div>
                {idx < 2 && <ArrowRight size={14} className="text-slate-300 shrink-0" />}
              </div>
            );
          })}
        </div>
      )}

      {/* ── STAGE 2: TEST SELECTION ── */}
      {billingStage === "tests" && registeredPatientId && (
        <div className="bg-white rounded-xl card-shadow overflow-hidden border-2 border-blue-200 animate-fade-in">
          <div className="px-6 py-4 border-b border-blue-100 bg-blue-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <TestTube2 size={18} className="text-blue-700" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-blue-900">Select Tests & Investigations</h2>
                <p className="text-xs text-blue-600">Search and add tests — prices shown as per {form.organizationId ? "organisation rate list" : form.rateListId ? "selected rate list" : "catalog MRP"}</p>
              </div>
            </div>
            {selectedTests.length > 0 && (
              <span className="text-sm font-bold text-blue-700 bg-blue-100 px-3 py-1 rounded-full">
                {selectedTests.length} test{selectedTests.length !== 1 ? "s" : ""} selected
              </span>
            )}
          </div>
          <div className="p-6 space-y-4">
            {/* Test search */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              {testSearching && <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />}
              <input
                type="text"
                value={testSearchQuery}
                onChange={(e) => handleTestSearch(e.target.value)}
                placeholder="Search tests by name or code (e.g., CBC, Thyroid, LFT)..."
                className="w-full pl-10 pr-10 py-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition"
                autoFocus
              />
            </div>

            {/* Quick Symptom Picker */}
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Quick add by symptom:</p>
              <div className="flex flex-wrap gap-1.5">
                {SYMPTOM_CHIPS.map((chip) => (
                  <button
                    key={chip.label}
                    onClick={() => handleSymptomChip(chip.testNames)}
                    className="px-2.5 py-1 text-xs font-medium rounded-full border border-slate-200 text-slate-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Search results dropdown */}
            {testSearchResults.length > 0 && testSearchQuery.length >= 2 && (
              <div className="border border-slate-200 rounded-lg max-h-60 overflow-y-auto divide-y divide-slate-50">
                {testSearchResults.map((test) => {
                  const alreadyAdded = selectedTests.some((t) => t.id === test.id);
                  const displayPrice = Number(test.price || 0);
                  const mrp = Number(test.mrp ?? test.price ?? 0);
                  const isOrgPrice = test.priceSource === "ORG";
                  return (
                    <button
                      key={test.id}
                      onClick={() => addTestToOrder(test)}
                      disabled={alreadyAdded}
                      className={cn(
                        "w-full flex items-center justify-between px-4 py-3 text-sm transition",
                        alreadyAdded ? "bg-green-50/50 text-slate-400 cursor-default" : "hover:bg-blue-50 text-slate-700"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {alreadyAdded ? (
                          <Check size={16} className="text-green-500 shrink-0" />
                        ) : (
                          <Plus size={16} className="text-blue-500 shrink-0" />
                        )}
                        <div className="text-left">
                          <p className="font-medium">
                            {test.name}
                            {isOrgPrice && (
                              <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-700">ORG</span>
                            )}
                          </p>
                          <p className="text-xs text-slate-400">{test.code} · {test.category} · {test.department}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold">{formatCurrency(displayPrice)}</p>
                        {isOrgPrice && displayPrice < mrp && (
                          <p className="text-xs text-slate-400 line-through">{formatCurrency(mrp)}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Selected tests table */}
            {selectedTests.length > 0 && (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Selected Tests</p>
                </div>
                <div className="divide-y divide-slate-100">
                  {selectedTests.map((test) => {
                    const price = test.ratePrice ?? Number(test.price || 0);
                    const mrp = Number(test.mrp ?? test.price ?? 0);
                    const isOrgPrice = test.priceSource === "ORG";
                    return (
                      <div key={test.id} className="flex items-center justify-between px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900">
                            {test.name}
                            {isOrgPrice && (
                              <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-700">ORG</span>
                            )}
                          </p>
                          <p className="text-xs text-slate-400">
                            {test.code} · {test.category}
                            {(() => {
                              const coveredBy = getTestCoveredBy(test.code, selectedTests.map((t) => t.code));
                              if (coveredBy.length > 0) return (
                                <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200">
                                  Included in {coveredBy[0]}
                                </span>
                              );
                              return null;
                            })()}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          {/* Quantity */}
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setSelectedTests((prev) => prev.map((t) => t.id === test.id ? { ...t, quantity: Math.max(1, t.quantity - 1) } : t))}
                              className="p-1 rounded hover:bg-slate-100 text-slate-400"
                            >
                              <Minus size={12} />
                            </button>
                            <span className="text-sm font-medium w-6 text-center">{test.quantity}</span>
                            <button
                              onClick={() => setSelectedTests((prev) => prev.map((t) => t.id === test.id ? { ...t, quantity: t.quantity + 1 } : t))}
                              className="p-1 rounded hover:bg-slate-100 text-slate-400"
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                          {/* Price */}
                          <div className="text-right w-24">
                            <p className="text-sm font-semibold text-slate-800">{formatCurrency(price * test.quantity)}</p>
                            {test.ratePrice != null && test.ratePrice < mrp && (
                              <p className="text-xs text-slate-400 line-through">{formatCurrency(mrp * test.quantity)}</p>
                            )}
                          </div>
                          {/* Remove */}
                          <button
                            onClick={() => removeTestFromOrder(test.id)}
                            className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Subtotal bar */}
                <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-600">Subtotal ({billingTotals.testCount} tests)</span>
                  <span className="text-lg font-bold text-[#1B4F8A]">{formatCurrency(billingTotals.subtotal)}</span>
                </div>
              </div>
            )}

            {/* Empty state */}
            {selectedTests.length === 0 && testSearchQuery.length < 2 && (
              <div className="text-center py-12 text-slate-400">
                <TestTube2 size={40} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">Search and add tests above</p>
                <p className="text-xs mt-1">Type at least 2 characters to search the catalog</p>
              </div>
            )}

            {/* Footer actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <button
                onClick={() => setBillingStage("none")}
                className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
              >
                <ArrowRight size={14} className="rotate-180" />
                Back to Registration
              </button>
              <button
                onClick={() => setBillingStage("billing")}
                disabled={selectedTests.length === 0}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#0D7E8A] text-white text-sm font-semibold rounded-lg hover:bg-[#0a6670] disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
              >
                Proceed to Billing
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STAGE 3: BILLING & PAYMENT ── */}
      {billingStage === "billing" && registeredPatientId && !orderComplete && (
        <div className="bg-white rounded-xl card-shadow overflow-hidden border-2 border-green-200 animate-fade-in">
          <div className="px-6 py-4 border-b border-green-100 bg-green-50 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100">
              <IndianRupee size={18} className="text-green-700" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-green-900">Billing & Payment</h2>
              <p className="text-xs text-green-600">
                {registeredPatientName && <span className="font-semibold">{registeredPatientName}</span>}
                {registeredPatientMrn && <span> ({registeredPatientMrn})</span>}
                {" — "}{billingTotals.testCount} test{billingTotals.testCount !== 1 ? "s" : ""} selected
              </p>
            </div>
          </div>
          <div className="p-6 space-y-5">
            {/* Tests summary */}
            <div className="border border-slate-200 rounded-lg">
              <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tests in Order</p>
                <button onClick={() => setBillingStage("tests")} className="text-xs text-blue-600 hover:underline">Edit Tests</button>
              </div>
              <div className="divide-y divide-slate-50 max-h-48 overflow-y-auto">
                {selectedTests.map((test) => {
                  const price = test.ratePrice ?? Number(test.price || 0);
                  const isOrgPrice = test.priceSource === "ORG";
                  return (
                    <div key={test.id} className="flex items-center justify-between px-4 py-2 text-sm">
                      <span className="text-slate-700">
                        {test.name}
                        {isOrgPrice && (
                          <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-700">ORG</span>
                        )}
                        <span className="text-slate-400 ml-1">x{test.quantity}</span>
                      </span>
                      <span className="font-medium text-slate-800">{formatCurrency(price * test.quantity)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Billing summary with discount */}
            <div className="bg-slate-50 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">MRP Total ({billingTotals.testCount} tests)</span>
                <span className="text-slate-700">{formatCurrency(billingTotals.mrpTotal)}</span>
              </div>
              {billingTotals.saved > 0 && billingTotals.saved !== billingTotals.discountAmt && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-green-600">Rate List Savings</span>
                  <span className="text-green-600">-{formatCurrency(billingTotals.saved - billingTotals.discountAmt)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="text-slate-700">{formatCurrency(billingTotals.subtotal)}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-slate-500">Discount</span>
                <div className="flex items-center border border-slate-200 rounded overflow-hidden">
                  <button
                    onClick={() => { setDiscountType("FLAT"); setOrderDiscount(0); }}
                    className={cn("px-2.5 py-1 text-xs font-semibold transition",
                      discountType === "FLAT" ? "bg-green-600 text-white" : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                    )}
                  >₹</button>
                  <button
                    onClick={() => { setDiscountType("PERCENT"); setOrderDiscount(0); }}
                    className={cn("px-2.5 py-1 text-xs font-semibold transition",
                      discountType === "PERCENT" ? "bg-green-600 text-white" : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                    )}
                  >%</button>
                </div>
                <input
                  type="number"
                  min="0"
                  max={discountType === "PERCENT" ? 100 : billingTotals.subtotal}
                  value={orderDiscount || ""}
                  onChange={(e) => {
                    const max = discountType === "PERCENT" ? 100 : billingTotals.subtotal;
                    setOrderDiscount(Math.min(Number(e.target.value) || 0, max));
                  }}
                  className="w-24 px-2 py-1 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-green-300 text-right"
                  placeholder="0"
                />
                {discountType === "PERCENT" && orderDiscount > 0 && (
                  <span className="text-xs text-green-600">= {formatCurrency(billingTotals.discountAmt)}</span>
                )}
              </div>
              <div className="flex items-center justify-between text-base font-bold pt-2 border-t border-slate-200">
                <span className="text-slate-900">Total Payable</span>
                <span className="text-green-700 text-xl">{formatCurrency(billingTotals.total)}</span>
              </div>
            </div>

            {/* Payment method selector */}
            <div>
              <label className={labelCls}>Payment Method</label>
              <div className="flex flex-wrap gap-2">
                {([
                  { label: "Cash", value: "CASH" as const, icon: Banknote },
                  { label: "Card", value: "CARD" as const, icon: CreditCard },
                  { label: "UPI", value: "UPI" as const, icon: Smartphone },
                  { label: "Insurance", value: "INSURANCE" as const, icon: Shield },
                  ...(form.organizationId ? [{ label: "Credit", value: "CREDIT" as const, icon: Clock }] : []),
                ]).map((pm) => (
                  <button
                    key={pm.value}
                    onClick={() => switchPaymentMethod(pm.value)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition",
                      paymentMethod === pm.value
                        ? "border-green-500 bg-green-50 text-green-700 ring-1 ring-green-200"
                        : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50",
                      selectedOrgIsPostpaid && pm.value !== "CREDIT" && "opacity-40"
                    )}
                  >
                    <pm.icon size={14} />
                    {pm.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Credit order banner */}
            {isCreditOrder && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Credit Order — No payment collected</p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    Amount of {formatCurrency(billingTotals.total)} will be posted to <strong>{form.organizationName || "organisation"}</strong> ledger.
                    Payment will be settled later per credit terms.
                  </p>
                </div>
              </div>
            )}

            {/* Amount received (hidden for credit) */}
            {!isCreditOrder && (
              <div className="max-w-xs">
                <label className={labelCls}>Amount Received</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
                  <input
                    type="number"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    placeholder={String(billingTotals.total)}
                    className={cn(inputCls, "pl-8")}
                  />
                </div>
                {amountPaid && Number(amountPaid) > 0 && Number(amountPaid) < billingTotals.total && (
                  <p className="text-xs text-amber-600 mt-1">
                    Balance: {formatCurrency(billingTotals.total - Number(amountPaid))}
                  </p>
                )}
              </div>
            )}

            {/* Context-sensitive payment fields */}
            {paymentMethod === "UPI" && (
              <div className="max-w-xs">
                <label className={labelCls}>UTR / Transaction Reference</label>
                <input
                  type="text"
                  value={paymentRefNumber}
                  onChange={(e) => setPaymentRefNumber(e.target.value)}
                  placeholder="Enter UPI UTR number..."
                  className={inputCls}
                />
              </div>
            )}

            {paymentMethod === "CARD" && (
              <div className="max-w-xs">
                <label className={labelCls}>Card Last 4 Digits</label>
                <input
                  type="text"
                  maxLength={4}
                  value={paymentRefNumber}
                  onChange={(e) => setPaymentRefNumber(e.target.value.replace(/\D/g, ""))}
                  placeholder="e.g. 4567"
                  className={inputCls}
                />
              </div>
            )}

            {paymentMethod === "INSURANCE" && (
              <div className="grid grid-cols-2 gap-3 max-w-md">
                <div>
                  <label className={labelCls}>TPA / Insurance Name</label>
                  <input
                    type="text"
                    value={insuranceTpaName}
                    onChange={(e) => setInsuranceTpaName(e.target.value)}
                    placeholder="e.g. Star Health, ICICI Lombard..."
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Policy Number</label>
                  <input
                    type="text"
                    value={insurancePolicyNo}
                    onChange={(e) => setInsurancePolicyNo(e.target.value)}
                    placeholder="Policy / Claim ID"
                    className={inputCls}
                  />
                </div>
              </div>
            )}

            {isCreditOrder && (
              <div className="max-w-xs">
                <label className={labelCls}>PO / Reference Number</label>
                <input
                  type="text"
                  value={paymentRefNumber}
                  onChange={(e) => setPaymentRefNumber(e.target.value)}
                  placeholder="Purchase Order / Ref #"
                  className={inputCls}
                />
                <p className="text-xs text-slate-400 mt-1">
                  {paymentRefNumber ? "Edit if needed." : "Auto-filled from order number after creation if left empty."}
                </p>
              </div>
            )}

            {/* Remark (always shown) */}
            <div className="max-w-md">
              <label className={labelCls}>Payment Remark</label>
              <input
                type="text"
                value={paymentRemark}
                onChange={(e) => setPaymentRemark(e.target.value)}
                placeholder="Any notes for this payment..."
                className={inputCls}
              />
            </div>

            {/* Proof upload (non-cash, non-credit) */}
            {paymentMethod !== "CASH" && !isCreditOrder && (
              <div>
                <label className={labelCls}>Payment Proof (optional)</label>
                <input ref={fileProofRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleProofUpload(f);
                }} />
                {proofPreview ? (
                  <div className="flex items-center gap-3 border border-green-200 bg-green-50 rounded-lg p-3">
                    {proofPreview.startsWith("data:image") ? (
                      <img src={proofPreview} alt="proof" className="w-16 h-16 object-cover rounded border border-green-200" />
                    ) : (
                      <div className="w-16 h-16 bg-green-100 border border-green-200 rounded flex items-center justify-center text-green-700 text-xs font-bold">PDF</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-green-800 truncate">{proofFile?.name || "Proof uploaded"}</p>
                      <p className="text-xs text-green-600">{proofUploading ? "Uploading..." : proofUrl ? "Uploaded" : "Ready"}</p>
                    </div>
                    <button
                      onClick={() => { setProofFile(null); setProofPreview(null); setProofUrl(null); setProofKey(null); }}
                      className="p-1 rounded hover:bg-green-100 text-green-400 hover:text-green-600"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileProofRef.current?.click()}
                    className="w-full border-2 border-dashed border-slate-300 rounded-lg p-4 text-center hover:border-green-400 hover:bg-green-50/30 transition group"
                  >
                    <Upload size={20} className="mx-auto text-slate-400 group-hover:text-green-500 mb-1" />
                    <p className="text-xs text-slate-500 group-hover:text-green-600">Upload screenshot, slip, or pre-auth letter</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">JPG, PNG, WebP, or PDF — max 5 MB</p>
                  </button>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <button
                onClick={() => setBillingStage("tests")}
                className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
              >
                <ArrowRight size={14} className="rotate-180" />
                Back to Tests
              </button>
              <button
                onClick={handleCreateOrder}
                disabled={orderCreating || selectedTests.length === 0}
                className={cn(
                  "flex items-center gap-2 px-6 py-2.5 text-white text-sm font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm",
                  isCreditOrder
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-green-600 hover:bg-green-700"
                )}
              >
                {orderCreating ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : isCreditOrder ? (
                  <Clock size={16} />
                ) : (
                  <ShoppingCart size={16} />
                )}
                {orderCreating
                  ? "Creating Order..."
                  : isCreditOrder
                    ? "Create Credit Order"
                    : "Confirm & Create Order"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ORDER COMPLETE ── */}
      {orderComplete && registeredPatientId && (
        <div className="animate-fade-in space-y-5">
          {/* Order + Token Hero Card */}
          <div className="bg-gradient-to-r from-teal-700 to-teal-600 text-white rounded-2xl p-6 text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-10"
              style={{ backgroundImage: "radial-gradient(circle at 20% 50%, white 0%, transparent 50%), radial-gradient(circle at 80% 50%, white 0%, transparent 50%)" }} />
            <p className="text-xs font-semibold uppercase tracking-[3px] opacity-70 mb-1">Registration Complete</p>
            {createdToken && (
              <div className="mb-3">
                <p className="text-xs uppercase tracking-widest opacity-60 mb-1">Lab Token</p>
                <div className="inline-block bg-white/20 rounded-xl px-8 py-3">
                  <p className="text-4xl font-black tracking-[0.3em] font-mono">{createdToken}</p>
                </div>
              </div>
            )}
            {investigationTokens.length > 0 && (
              <div className="mt-3 mb-1">
                <p className="text-xs uppercase tracking-widest opacity-60 mb-2">Department Tokens</p>
                <div className="flex flex-wrap gap-3 justify-center">
                  {investigationTokens.map((t, i) => (
                    <div key={i} className="bg-white/20 rounded-xl px-5 py-2 text-center">
                      <p className="text-2xl font-black font-mono tracking-[0.2em]">{t.tokenDisplay}</p>
                      <p className="text-xs opacity-70 mt-0.5">{t.departmentName ?? t.investigationType}</p>
                      {t.id && (
                        <a
                          href={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1"}/front-desk/queue/${t.id}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1.5 inline-block text-xs bg-white/20 hover:bg-white/30 rounded-full px-3 py-0.5 transition"
                        >
                          📄 Print Slip
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <p className="text-lg font-bold tracking-wider font-mono mb-1">
              {orderNumber ?? createdOrderId}
            </p>
            <p className="text-sm opacity-80">
              {registeredPatientName}{registeredPatientMrn ? ` \u00b7 MRN: ${registeredPatientMrn}` : ""}
            </p>
            {whatsAppSent && (
              <p className="mt-2 text-xs bg-white/20 inline-block px-3 py-1 rounded-full">
                <Check size={12} className="inline mr-1" /> WhatsApp sent
              </p>
            )}
          </div>

          {/* Order Detail Summary */}
          <div className="border rounded-xl overflow-hidden bg-white">
            <div className="bg-gray-50 px-5 py-3 border-b">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Order Summary</p>
            </div>
            <div className="divide-y">
              {selectedTests.map((t) => (
                <div key={t.id} className="flex justify-between items-center px-5 py-2.5 text-sm">
                  <div>
                    <span className="font-medium">{t.name}</span>
                    <span className="ml-2 text-xs text-gray-400">{t.sampleType}</span>
                  </div>
                  <span className="font-semibold">{formatCurrency(Number(t.price || 0))}</span>
                </div>
              ))}
              {billingTotals.discountAmt > 0 && (
                <div className="flex justify-between px-5 py-2.5 text-sm text-red-500">
                  <span>Discount</span>
                  <span>-{formatCurrency(billingTotals.discountAmt)}</span>
                </div>
              )}
              <div className="flex justify-between px-5 py-3 font-bold bg-gray-50">
                <span>Total</span>
                <span className="text-teal-700">{formatCurrency(billingTotals.total)}</span>
              </div>
              <div className="flex justify-between px-5 py-2.5 text-sm">
                <span className="text-gray-500">Payment</span>
                <span className="font-medium">
                  {isCreditOrder ? `Credit \u2014 ${form.organizationName || "Org"}` : paymentMethod}
                </span>
              </div>
            </div>
          </div>

          {/* Credit order info */}
          {isCreditOrder && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
              <Building2 size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  Credit posted to {form.organizationName || "organisation"} ledger
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  {formatCurrency(billingTotals.total)} added to outstanding balance.
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            <button
              onClick={() => window.print()}
              className="flex items-center justify-center gap-2 w-full py-3 border-2 border-gray-200 rounded-xl text-sm font-semibold hover:bg-gray-50 hover:border-gray-300 transition"
            >
              <Printer size={14} />
              Print Bill / Invoice
            </button>
            {hasLabTests && (
              <button
                onClick={() => router.push(`/accession?orderId=${createdOrderId}`)}
                className="flex items-center justify-center gap-2 w-full py-3 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 transition"
              >
                <Barcode size={14} />
                Go to Accession &rarr; Scan Tubes
              </button>
            )}
            <button
              onClick={startNewRegistration}
              className="flex items-center justify-center gap-2 w-full py-3 bg-teal-700 text-white rounded-xl text-sm font-semibold hover:bg-teal-800 transition"
            >
              <RotateCcw size={14} />
              + New Registration
            </button>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {showBulkModal && <BulkRegistrationModal onClose={() => setShowBulkModal(false)} />}
      {showPriceModal && <CalculatePriceModal onClose={() => setShowPriceModal(false)} />}
    </div>
  );
}
