"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Plus,
  Download,
  Trash2,
  Edit2,
  Star,
  X,
  Loader2,
  Search,
  FileSpreadsheet,
  FileText,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  MoreVertical,
  Copy,
  Power,
  FileDown,
  History,
  Check,
  Users2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { formatCurrency, cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface RateListSummary {
  id: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  description: string | null;
  listType: string;
  startDate: string | null;
  endDate: string | null;
  testsCount: number;
  createdAt: string;
}

interface TestCatalogItem {
  id: string;
  code: string;
  name: string;
  category: string;
  department: string;
  price: number | string;
  sampleType: string | null;
  sampleVolume?: string | null;
  type?: string | null;
  schedule?: string | null;
  turnaroundHours: number;
  methodology?: string | null;
  cptCode?: string | null;
  cogs?: number | null;
  b2bPrice?: number | null;
  isActive?: boolean;
}

interface ParsedTestRow {
  code: string;
  name: string;
  type?: string;
  department: string;
  category: string;
  sampleType: string;
  sampleVolume?: string;
  schedule?: string;
  tatHours: number;
  price: number;
  b2bPrice?: number;
  cogs?: number;
  methodology?: string;
  status: "new" | "update" | "skip";
}

type TabValue = "rate-lists" | "test-catalog";

const LIST_TYPE_TABS = [
  { label: "Organisation Lists", value: "PRICE_LIST" },
  { label: "Referral Lists", value: "REFERRAL" },
  { label: "Outsource Lists", value: "OUTSOURCE" },
  { label: "Discount List", value: "DISCOUNT" },
  { label: "Doctor List", value: "DOCTOR" },
  { label: "Insurance List", value: "INSURANCE" },
] as const;

const LIST_TYPE_OPTIONS = [
  { value: "PRICE_LIST", label: "Price List", desc: "Assign test wise revenue for Referral, this would reflect in the revenue reports for the referral" },
  { value: "CO_PAYMENT", label: "Co-Payment List", desc: "Set copay amounts for tests for organisations with patient copays" },
  { value: "REVENUE_LIST", label: "Revenue List", desc: "Assign test wise revenue for Organization, this would reflect in the revenue reports for the organisation" },
  { value: "QUANTITY_RESTRICTION", label: "Test Quantity Restriction List", desc: "You can use this to restrict the number of tests which can be billed under an organisation as per contractual agreement" },
];

const DEPARTMENTS = [
  "Biochemistry", "Haematology", "Microbiology", "Serology", "Hormones",
  "Immunology", "Urinalysis", "Molecular", "Pathology", "General",
];

const SAMPLE_TYPES = [
  "Serum", "EDTA Blood", "Citrate Blood", "Fluoride Blood", "Urine", "Stool",
  "Swab", "CSF", "Sputum", "Nasopharyngeal Swab", "Body Fluid", "Culture Bottle", "Other",
];

// ── Main Page ────────────────────────────────────────────────────────────────

export default function RateListsPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabValue>("rate-lists");

  // ── Rate Lists state ────────────────────────────────────────────────────
  const [rateListTypeTab, setRateListTypeTab] = useState("PRICE_LIST");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);

  // ── Test Catalog state ──────────────────────────────────────────────────
  const [testSearch, setTestSearch] = useState("");
  const [testDeptFilter, setTestDeptFilter] = useState("All");
  const [showAddTestModal, setShowAddTestModal] = useState(false);
  const [editingTest, setEditingTest] = useState<TestCatalogItem | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [catalogPage, setCatalogPage] = useState(1);
  const catalogPageSize = 50;

  // ── Import state ────────────────────────────────────────────────────────
  const [showImportModal, setShowImportModal] = useState(false);
  const [parsedTests, setParsedTests] = useState<ParsedTestRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);

  // ── Inline rate edit state ───────────────────────────────────────────────
  const [editingCell, setEditingCell] = useState<{ testId: string; field: "price" | "b2bPrice" | "cogs"; value: string } | null>(null);
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [savedCell, setSavedCell] = useState<string | null>(null);

  // ── Add Profile state ────────────────────────────────────────────────────
  const [showAddProfileModal, setShowAddProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: "", code: "", outsource: "SELF", integrationCode: "", shortDescription: "", description: "" });
  const [profileTestSearch, setProfileTestSearch] = useState("");
  const [selectedProfileTests, setSelectedProfileTests] = useState<{ id: string; code: string; name: string; price: number }[]>([]);
  const [profileTestResults, setProfileTestResults] = useState<{ id: string; code: string; name: string; price: number }[]>([]);
  const [profileTestDropdownOpen, setProfileTestDropdownOpen] = useState(false);

  // ── Import results state ─────────────────────────────────────────────────
  const [importResult, setImportResult] = useState<{ totalRows: number; inserted: number; duplicates: number; duplicateList: { row: number; testCode: string; testName: string; reason: string }[]; errors: number; errorList: { row: number; reason: string }[] } | null>(null);
  const [showImportResult, setShowImportResult] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);

  // ── Rate Lists query ──────────────────────────────────────────────────
  const { data: rateLists, isLoading: listsLoading } = useQuery({
    queryKey: ["rate-lists", rateListTypeTab],
    queryFn: async () => {
      const res = await api.get<{ data: RateListSummary[] }>(`/rate-lists?listType=${rateListTypeTab}`);
      return Array.isArray(res.data) ? res.data : (res.data.data ?? []);
    },
  });

  // ── Test Catalog query ────────────────────────────────────────────────
  const { data: allTests, isLoading: testsLoading } = useQuery({
    queryKey: ["test-catalog-all"],
    queryFn: async () => {
      const res = await api.get<{ data: { data: TestCatalogItem[] } }>("/test-catalog?limit=5000");
      const raw = res.data.data;
      return Array.isArray(raw) ? raw : (raw as { data: TestCatalogItem[] }).data ?? [];
    },
  });

  const departments = useMemo(() => {
    if (!allTests) return ["All"];
    const depts = [...new Set(allTests.map((t) => t.department))].sort();
    return ["All", ...depts];
  }, [allTests]);

  const filteredTests = useMemo(() => {
    if (!allTests) return [];
    return allTests.filter((t) => {
      const matchDept = testDeptFilter === "All" || t.department === testDeptFilter;
      const matchSearch =
        !testSearch ||
        t.name.toLowerCase().includes(testSearch.toLowerCase()) ||
        t.code.toLowerCase().includes(testSearch.toLowerCase());
      return matchDept && matchSearch;
    });
  }, [allTests, testDeptFilter, testSearch]);

  const totalCatalogPages = Math.ceil((filteredTests?.length ?? 0) / catalogPageSize);
  const paginatedTests = useMemo(() => {
    const start = (catalogPage - 1) * catalogPageSize;
    return filteredTests.slice(start, start + catalogPageSize);
  }, [filteredTests, catalogPage, catalogPageSize]);

  // ── Rate List Mutations ─────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; listType: string; startDate?: string; endDate?: string; copiedFromId?: string; excelFile?: File }) => {
      const { excelFile, ...payload } = data;
      const res = await api.post("/rate-lists", payload);
      const created = (res.data?.data ?? res.data) as { id: string };
      if (excelFile && created.id) {
        const formData = new FormData();
        formData.append("file", excelFile);
        const upRes = await api.post(`/rate-lists/${created.id}/upload`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        const upData = (upRes.data?.data ?? upRes.data) as { updated: number; skipped: number };
        toast.success(`Rate list created — ${upData.updated} prices imported`);
        return;
      }
      toast.success("Rate list created");
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["rate-lists"] });
      setShowCreateModal(false);
    },
    onError: () => toast.error("Failed to create rate list"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/rate-lists/${id}`); },
    onSuccess: () => {
      toast.success("Rate list deleted");
      void qc.invalidateQueries({ queryKey: ["rate-lists"] });
    },
    onError: () => toast.error("Failed to delete rate list"),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await api.put(`/rate-lists/${id}`, { isActive });
    },
    onSuccess: () => {
      toast.success("Rate list updated");
      void qc.invalidateQueries({ queryKey: ["rate-lists"] });
    },
    onError: () => toast.error("Failed to update"),
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => { await api.post(`/rate-lists/${id}/set-default`); },
    onSuccess: () => {
      toast.success("Default rate list updated");
      void qc.invalidateQueries({ queryKey: ["rate-lists"] });
    },
    onError: () => toast.error("Failed to set default"),
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post(`/rate-lists/${id}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return (res.data?.data ?? res.data) as { updated: number; skipped: number; auditEntries: number };
    },
    onSuccess: (data) => {
      toast.success(`${data.updated} prices updated, ${data.skipped} skipped`);
      void qc.invalidateQueries({ queryKey: ["rate-lists"] });
      setUploadTargetId(null);
    },
    onError: () => toast.error("Failed to upload rate list"),
  });

  // ── Test Catalog Mutations ──────────────────────────────────────────
  const updateTestMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Record<string, unknown> }) => {
      await api.put(`/test-catalog/${data.id}`, data.updates);
    },
    onSuccess: () => {
      toast.success("Test updated");
      setEditingTest(null);
      void qc.invalidateQueries({ queryKey: ["test-catalog-all"] });
    },
    onError: () => toast.error("Failed to update test"),
  });

  const deleteTestMutation = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/test-catalog/${id}`); },
    onSuccess: () => {
      toast.success("Test deleted");
      setShowDeleteConfirm(null);
      void qc.invalidateQueries({ queryKey: ["test-catalog-all"] });
    },
    onError: () => toast.error("Failed to delete test"),
  });

  const importMutation = useMutation({
    mutationFn: async (tests: ParsedTestRow[]) => {
      const res = await api.post("/test-catalog/bulk-upload", {
        tests: tests.filter((t) => t.status !== "skip").map((t) => ({
          code: t.code, name: t.name, department: t.department, category: t.category,
          sampleType: t.sampleType, tatHours: t.tatHours, price: t.price,
          ...(t.type && { type: t.type }),
          ...(t.sampleVolume && { sampleVolume: t.sampleVolume }),
          ...(t.schedule && { schedule: t.schedule }),
          ...(t.b2bPrice && { b2bPrice: t.b2bPrice }),
          ...(t.cogs && { cogs: t.cogs }),
          ...(t.methodology && { methodology: t.methodology }),
        })),
      });
      return res.data;
    },
    onSuccess: (data: { data?: { totalRows?: number; inserted?: number; duplicates?: number; duplicateList?: { row: number; testCode: string; testName: string; reason: string }[]; errors?: number; errorList?: { row: number; reason: string }[] } }) => {
      const d = data.data ?? {};
      setImportResult({
        totalRows: d.totalRows ?? 0,
        inserted: d.inserted ?? 0,
        duplicates: d.duplicates ?? 0,
        duplicateList: d.duplicateList ?? [],
        errors: d.errors ?? 0,
        errorList: d.errorList ?? [],
      });
      setShowImportModal(false);
      setShowImportResult(true);
      setShowDuplicates(false);
      setParsedTests([]);
      void qc.invalidateQueries({ queryKey: ["test-catalog-all"] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Import failed";
      toast.error(msg);
    },
  });

  // ── Excel handler ─────────────────────────────────────────────────────
  const handleExcelFile = useCallback(async (file: File) => {
    try {
      setIsParsing(true);
      const xlsxModule = await import("xlsx");
      const XLSX = xlsxModule.default ?? xlsxModule;
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(new Uint8Array(buffer), { type: "array", raw: false });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];

      const allRows = XLSX.utils.sheet_to_json<string[]>(sheet, {
        header: 1, defval: "", blankrows: false, raw: false,
      }) as string[][];

      if (allRows.length < 2) { toast.error("File is empty or has only headers"); return; }

      let headerIdx = 0;
      for (let i = 0; i < Math.min(allRows.length, 5); i++) {
        const row = allRows[i].map((c) => String(c).toLowerCase().replace(/\n/g, " ").trim());
        if (row.some((c) => c.includes("investigation") || c === "test name" || c === "name")) {
          headerIdx = i;
          break;
        }
      }

      const headers = allRows[headerIdx].map((h) =>
        String(h).toLowerCase().replace(/\n/g, " ").replace(/\s+/g, " ").trim()
      );

      const col = (candidates: string[]): number => {
        // Exact normalized match first
        for (const c of candidates) {
          const i = headers.findIndex((h) =>
            h.replace(/\s+/g, "").toLowerCase() === c.replace(/\s+/g, "").toLowerCase()
          );
          if (i !== -1) return i;
        }
        // Fallback: partial match
        for (const c of candidates) {
          const i = headers.findIndex((h) => h.includes(c.toLowerCase()));
          if (i !== -1) return i;
        }
        return -1;
      };

      const codeCol = col(["test code", "testcode", "code"]);
      const typeCol = col(["type"]);
      const nameCol = col(["investigations", "investigation", "test name", "name"]);
      const methCol = col(["methodology", "method"]);
      const sampleCol = col(["sample type", "sampletype", "specimen"]);
      const volCol = col(["sample volume", "samplevolume", "volume"]);
      const schedCol = col(["schedule"]);
      const tatCol = col(["tat", "turnaround"]);
      const priceCol = col(["mrp", "price", "base price", "rate", "amount"]);
      const b2bCol = col(["b2b", "b2b price", "partner price"]);
      const cogsCol = col(["cost per test", "costpertest", "cogs", "cost"]);
      const deptCol = col(["department", "dept"]);
      const catCol = col(["category"]);

      const parseTAT = (val: string): number => {
        const v = String(val).toLowerCase().replace(/\s/g, "");
        const n = parseFloat(v);
        if (isNaN(n)) return 0;
        if (v.includes("week")) return n * 24 * 7;
        if (v.includes("day")) return n * 24;
        return n;
      };

      const normSample = (val: string): string => {
        const v = String(val).replace(/\n/g, " ").split(",")[0].trim();
        const l = v.toLowerCase();
        if (l.includes("edta") || l.includes("wb-edta") || l.includes("whole blood")) return "EDTA Blood";
        if (l.includes("serum")) return "Serum";
        if (l.includes("plasma")) return "Plasma";
        if (l.includes("urine")) return "Urine";
        if (l.includes("stool") || l.includes("faec")) return "Stool";
        if (l.includes("swab")) return "Swab";
        if (l.includes("csf")) return "CSF";
        if (l.includes("sputum")) return "Sputum";
        if (l.includes("citrate")) return "Citrate Blood";
        if (l.includes("culture")) return "Culture Bottle";
        if (l.includes("fluid")) return "Body Fluid";
        return v.slice(0, 30) || "";
      };

      const inferDept = (name: string, sample: string): string => {
        const n = name.toLowerCase();
        const s = sample.toLowerCase();
        if (s.includes("swab") || s.includes("sputum") || n.includes("culture") || n.includes("sensitivity") || s.includes("culture bottle")) return "Microbiology";
        if (n.includes("pcr") || n.includes("gene") || n.includes("dna") || n.includes("rna")) return "Molecular";
        if (n.includes("biopsy") || n.includes("histopath") || n.includes("cytol")) return "Pathology";
        if (s.includes("edta") || n.includes("cbc") || n.includes("blood count") || n.includes("haemoglobin") || n.includes("esr") || n.includes("platelet") || s.includes("citrate")) return "Haematology";
        if (n.includes("hiv") || n.includes("hepatitis") || n.includes("widal") || n.includes("vdrl") || n.includes("crp") || n.includes("antibody") || n.includes("elisa")) return "Serology";
        if (n.includes("tsh") || n.includes("thyroid") || n.includes("cortisol") || n.includes("hormone") || n.includes("prolactin") || n.includes("testosterone")) return "Hormones";
        if (n.includes("immuno") || n.includes("igg") || n.includes("iga") || n.includes("igm")) return "Immunology";
        if (s.includes("urine") && !n.includes("culture")) return "Urinalysis";
        return "Biochemistry";
      };

      const existingCodes = new Set((allTests ?? []).map((t) => t.code.toLowerCase()));

      const mapped: ParsedTestRow[] = [];
      for (let i = headerIdx + 1; i < allRows.length; i++) {
        const row = allRows[i];
        if (!row?.length) continue;

        const rawName = nameCol >= 0 ? String(row[nameCol] ?? "").replace(/\n/g, " ").replace(/\s+/g, " ").trim() : "";
        if (rawName.length < 2) continue;

        const rawCode = codeCol >= 0 ? String(row[codeCol] ?? "").replace(/\n/g, "").trim() : "";
        const rawType = typeCol >= 0 ? String(row[typeCol] ?? "").replace(/\n/g, " ").trim() : "";
        const rawSample = sampleCol >= 0 ? String(row[sampleCol] ?? "") : "";
        const rawVol = volCol >= 0 ? String(row[volCol] ?? "").trim() : "";
        const rawSched = schedCol >= 0 ? String(row[schedCol] ?? "").trim() : "";
        const rawTAT = tatCol >= 0 ? String(row[tatCol] ?? "") : "";
        const rawPrice = priceCol >= 0 ? String(row[priceCol] ?? "0").replace(/[₹,\s]/g, "") : "0";
        const rawB2B = b2bCol >= 0 ? String(row[b2bCol] ?? "0").replace(/[₹,\s]/g, "") : "0";
        const rawCogs = cogsCol >= 0 ? String(row[cogsCol] ?? "0").replace(/[₹,\s]/g, "") : "0";
        const rawMeth = methCol >= 0 ? String(row[methCol] ?? "").replace(/\n/g, " ").trim() : "";
        const rawDept = deptCol >= 0 ? String(row[deptCol] ?? "").replace(/\n/g, " ").trim() : "";
        const rawCat = catCol >= 0 ? String(row[catCol] ?? "").replace(/\n/g, " ").trim() : "";

        const sampleType = normSample(rawSample);
        const department = rawDept || inferDept(rawName, sampleType);
        const code = rawCode || rawName.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
        const price = parseFloat(rawPrice) || 0;
        const b2b = parseFloat(rawB2B) || 0;
        const cogs = parseFloat(rawCogs) || 0;

        mapped.push({
          code,
          name: rawName,
          type: rawType || undefined,
          department,
          category: rawCat || rawType || department,
          sampleType,
          sampleVolume: rawVol || undefined,
          schedule: rawSched || undefined,
          tatHours: parseTAT(rawTAT),
          price: price || b2b,
          b2bPrice: b2b || undefined,
          cogs: cogs || undefined,
          methodology: rawMeth || undefined,
          status: code && existingCodes.has(code.toLowerCase()) ? "update" : "new",
        });
      }

      if (mapped.length === 0) {
        toast.error(`No tests found. Detected headers: ${headers.join(", ")}`);
      } else {
        setParsedTests(mapped);
        setShowImportModal(true);
      }
    } catch (err) {
      console.error("[Excel Import] error:", err);
      toast.error("Failed to parse Excel file");
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [allTests]);

  // ── Download DOS ──────────────────────────────────────────────────────
  const handleDownloadDos = useCallback(async () => {
    try {
      const res = await api.get("/test-catalog/download-dos", { responseType: "blob" });
      const blob = new Blob([res.data as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `DOS_DELViON_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download DOS");
    }
  }, []);

  // ── Download template ─────────────────────────────────────────────────
  const handleDownloadTemplate = useCallback(async () => {
    try {
      const res = await api.get("/test-catalog/download-template", { responseType: "blob" });
      const blob = new Blob([res.data as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "test-catalog-template.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download template");
    }
  }, []);

  // ── Download rate list ────────────────────────────────────────────────
  const handleDownloadRateList = useCallback(async (id: string) => {
    try {
      const res = await api.get(`/rate-lists/${id}/download`, { responseType: "blob" });
      const blob = new Blob([res.data as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `RateList_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download rate list");
    }
  }, []);

  const handleUploadRateList = useCallback((id: string) => {
    setUploadTargetId(id);
    uploadInputRef.current?.click();
  }, []);

  const handleUploadFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadTargetId) return;
    uploadMutation.mutate({ id: uploadTargetId, file });
    if (uploadInputRef.current) uploadInputRef.current.value = "";
  }, [uploadTargetId, uploadMutation]);

  const toggleSkip = useCallback((index: number) => {
    setParsedTests((prev) =>
      prev.map((t, i) => (i !== index ? t : { ...t, status: t.status === "skip" ? "new" : "skip" }))
    );
  }, []);

  const saveInlineRate = useCallback(async () => {
    if (!editingCell) return;
    const { testId, field, value } = editingCell;
    const numVal = parseFloat(value);
    if (isNaN(numVal) || numVal < 0) { toast.error("Invalid value"); return; }
    setSavingCell(`${testId}-${field}`);
    try {
      await api.put(`/test-catalog/${testId}`, { [field]: numVal });
      setSavedCell(`${testId}-${field}`);
      void qc.invalidateQueries({ queryKey: ["test-catalog-all"] });
      setTimeout(() => setSavedCell(null), 1500);
    } catch {
      toast.error("Failed to save");
    } finally {
      setSavingCell(null);
      setEditingCell(null);
    }
  }, [editingCell, qc]);

  const searchProfileTests = useCallback(async (q: string) => {
    if (q.length < 2) { setProfileTestResults([]); return; }
    try {
      const res = await api.get(`/test-catalog/search?q=${encodeURIComponent(q)}`);
      const results = (res.data?.data ?? res.data) as { id: string; code: string; name: string; price: number }[];
      setProfileTestResults(Array.isArray(results) ? results.slice(0, 10) : []);
      setProfileTestDropdownOpen(true);
    } catch { setProfileTestResults([]); }
  }, []);

  const createProfileMutation = useMutation({
    mutationFn: async () => {
      if (!profileForm.name.trim()) throw new Error("Profile name is required");
      if (selectedProfileTests.length === 0) throw new Error("Select at least one test");
      const res = await api.post("/test-catalog/profiles", {
        name: profileForm.name,
        ...(profileForm.code && { category: profileForm.code }),
        componentTestIds: selectedProfileTests.map((t) => t.id),
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Profile created successfully");
      setShowAddProfileModal(false);
      setProfileForm({ name: "", code: "", outsource: "SELF", integrationCode: "", shortDescription: "", description: "" });
      setSelectedProfileTests([]);
      setProfileTestSearch("");
    },
    onError: (err: unknown) => {
      const msg = (err as Error).message ?? "Failed to create profile";
      toast.error(msg);
    },
  });

  // ── Rate Lists Tab ──────────────────────────────────────────────────────

  const rateListsContent = (
      <div className="space-y-4">
        {/* Sub-tabs for list types */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-slate-200">
          {LIST_TYPE_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setRateListTypeTab(tab.value)}
              className={cn(
                "px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2",
                rateListTypeTab === tab.value
                  ? "border-[#0D7E8A] text-[#0D7E8A]"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Header row */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Rows: <strong>{rateLists?.length ?? 0}</strong>
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 border border-[#0D7E8A] text-[#0D7E8A] rounded-lg text-sm font-medium hover:bg-[#0D7E8A]/5"
            >
              <Plus size={14} />
              Create New
            </button>
          </div>
        </div>

        {/* Table */}
        {listsLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-slate-500" />
          </div>
        ) : (
          <div className="bg-white rounded-xl card-shadow overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">List Name</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">List Type</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Tests</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Created</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Actions</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(rateLists ?? []).map((list) => (
                  <tr key={list.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900">{list.name}</span>
                        {list.isDefault && (
                          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-medium">DEFAULT</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {list.listType?.replace(/_/g, " ") || "Price List"}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{list.testsCount}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-medium",
                        list.isActive !== false ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                      )}>
                        {list.isActive !== false ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(list.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => void handleDownloadRateList(list.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                          title="Download Excel"
                        >
                          <Download size={12} /> Download
                        </button>
                        <button
                          onClick={() => handleUploadRateList(list.id)}
                          disabled={uploadMutation.isPending && uploadTargetId === list.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-md border border-blue-200 text-blue-600 hover:bg-blue-50 transition disabled:opacity-50"
                          title="Upload updated prices"
                        >
                          {uploadMutation.isPending && uploadTargetId === list.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <FileDown size={12} className="rotate-180" />
                          )}
                          Upload
                        </button>
                        <button
                          onClick={() => router.push(`/settings/rate-lists/${list.id}/edit`)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                          title="Edit Prices"
                        >
                          <Edit2 size={12} /> Edit Prices
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 relative">
                      <button
                        onClick={() => setActionMenuId(actionMenuId === list.id ? null : list.id)}
                        className="p-1.5 rounded-md text-slate-500 hover:text-slate-600 hover:bg-slate-100"
                      >
                        <MoreVertical size={14} />
                      </button>
                      {actionMenuId === list.id && (
                        <div className="absolute right-4 top-full mt-1 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-20 w-48">
                          <button
                            onClick={() => { setActionMenuId(null); router.push(`/settings/rate-lists/${list.id}/edit`); }}
                            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                          >
                            <Edit2 size={14} /> Edit List
                          </button>
                          <button
                            onClick={() => { setActionMenuId(null); toggleActiveMutation.mutate({ id: list.id, isActive: list.isActive === false }); }}
                            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                          >
                            <Power size={14} /> {list.isActive !== false ? "Disable List" : "Enable List"}
                          </button>
                          <button
                            onClick={() => { setActionMenuId(null); void handleDownloadRateList(list.id); }}
                            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                          >
                            <FileDown size={14} /> Download List
                          </button>
                          {!list.isDefault && (
                            <button
                              onClick={() => { setActionMenuId(null); setDefaultMutation.mutate(list.id); }}
                              className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                            >
                              <Star size={14} /> Set as Default
                            </button>
                          )}
                          <button
                            onClick={() => { setActionMenuId(null); router.push(`/settings/rate-lists/${list.id}/edit?tab=audit`); }}
                            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                          >
                            <History size={14} /> View Audit Log
                          </button>
                          {!list.isDefault && (
                            <>
                              <div className="border-t border-slate-100 my-1" />
                              <button
                                onClick={() => { setActionMenuId(null); deleteMutation.mutate(list.id); }}
                                className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                              >
                                <Trash2 size={14} /> Delete List
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {(rateLists ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-500 text-sm">
                      No rate lists found. Click &quot;Create New&quot; to add one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
  );

  // ── Test Catalog Tab ────────────────────────────────────────────────────

  const testCatalogContent = (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Test Catalog</h2>
            {allTests && (
              <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
                {allTests.length} tests
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
            >
              <FileSpreadsheet size={14} />
              Import Excel
            </button>
            <button
              onClick={handleDownloadDos}
              className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
            >
              <Download size={14} />
              Download DOS
            </button>
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
            >
              <Download size={14} />
              Template
            </button>
            <button
              onClick={() => setShowAddTestModal(true)}
              className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
            >
              <Plus size={14} />
              Add Test
            </button>
            <button
              onClick={() => setShowAddProfileModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700"
            >
              <Users2 size={14} />
              Add Profile
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            {departments.map((dept) => (
              <button
                key={dept}
                onClick={() => { setTestDeptFilter(dept); setCatalogPage(1); }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
                  testDeptFilter === dept
                    ? "bg-[#1B4F8A] text-slate-900"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                )}
              >
                {dept}
              </button>
            ))}
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={testSearch}
                onChange={(e) => { setTestSearch(e.target.value); setCatalogPage(1); }}
                placeholder="Search by name or code..."
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]/20 focus:border-[#0D7E8A]"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        {testsLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-slate-500" />
          </div>
        ) : (
          <div className="bg-white rounded-xl card-shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500">Test Code</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500">Type</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500">Investigations</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500">Methodology</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500">Sample Type</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500">TAT</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500">MRP</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500">B2B</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500">COGS</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedTests.map((test) => (
                    <tr key={test.id} className="hover:bg-slate-50/50 group">
                      <td className="px-4 py-2.5 text-xs font-mono text-slate-500">{test.code}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">{test.type || test.department || <span className="text-slate-700">&mdash;</span>}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-900 max-w-[280px] truncate">{test.name}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">{test.methodology || <span className="text-slate-700">&mdash;</span>}</td>
                      <td className="px-4 py-2.5">
                        {test.sampleType ? (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium">{test.sampleType}</span>
                        ) : (
                          <span className="text-xs text-slate-700">&mdash;</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">{test.turnaroundHours}h</td>
                      <td className="px-4 py-2.5 text-sm font-medium text-slate-700">
                        {editingCell?.testId === test.id && editingCell.field === "price" ? (
                          <input
                            autoFocus
                            type="number"
                            min="0"
                            value={editingCell.value}
                            onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                            onBlur={() => void saveInlineRate()}
                            onKeyDown={(e) => { if (e.key === "Enter") void saveInlineRate(); if (e.key === "Escape") setEditingCell(null); }}
                            className="w-24 px-2 py-1 border border-teal-400 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                          />
                        ) : savingCell === `${test.id}-price` ? (
                          <span className="text-slate-500">saving…</span>
                        ) : savedCell === `${test.id}-price` ? (
                          <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 size={12} /> saved</span>
                        ) : (
                          <span className="cursor-pointer hover:text-teal-600 hover:underline" onClick={() => setEditingCell({ testId: test.id, field: "price", value: String(Number(test.price) || 0) })} title="Click to edit">
                            {formatCurrency(Number(test.price))}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">
                        {editingCell?.testId === test.id && editingCell.field === "b2bPrice" ? (
                          <input
                            autoFocus
                            type="number"
                            min="0"
                            value={editingCell.value}
                            onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                            onBlur={() => void saveInlineRate()}
                            onKeyDown={(e) => { if (e.key === "Enter") void saveInlineRate(); if (e.key === "Escape") setEditingCell(null); }}
                            className="w-24 px-2 py-1 border border-teal-400 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                          />
                        ) : savingCell === `${test.id}-b2bPrice` ? (
                          <span className="text-slate-500">saving…</span>
                        ) : savedCell === `${test.id}-b2bPrice` ? (
                          <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 size={12} /> saved</span>
                        ) : (
                          <span className="cursor-pointer hover:text-teal-600 hover:underline" onClick={() => setEditingCell({ testId: test.id, field: "b2bPrice", value: String(Number(test.b2bPrice) || 0) })} title="Click to edit">
                            {test.b2bPrice ? formatCurrency(Number(test.b2bPrice)) : <span className="text-slate-700 cursor-pointer hover:text-teal-400">+ B2B</span>}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">
                        {editingCell?.testId === test.id && editingCell.field === "cogs" ? (
                          <input
                            autoFocus
                            type="number"
                            min="0"
                            value={editingCell.value}
                            onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                            onBlur={() => void saveInlineRate()}
                            onKeyDown={(e) => { if (e.key === "Enter") void saveInlineRate(); if (e.key === "Escape") setEditingCell(null); }}
                            className="w-24 px-2 py-1 border border-teal-400 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                          />
                        ) : savingCell === `${test.id}-cogs` ? (
                          <span className="text-slate-500">saving…</span>
                        ) : savedCell === `${test.id}-cogs` ? (
                          <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 size={12} /> saved</span>
                        ) : (
                          <span className="cursor-pointer hover:text-teal-600 hover:underline" onClick={() => setEditingCell({ testId: test.id, field: "cogs", value: String(Number(test.cogs) || 0) })} title="Click to edit">
                            {test.cogs ? formatCurrency(Number(test.cogs)) : <span className="text-slate-700 cursor-pointer hover:text-teal-400">+ COGS</span>}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => router.push(`/settings/test-catalog/${test.id}/report`)} className="p-1.5 rounded-md text-slate-500 hover:text-violet-600 hover:bg-violet-50" title="Report Builder">
                            <FileText size={14} />
                          </button>
                          <button onClick={() => setEditingTest(test)} className="p-1.5 rounded-md text-slate-500 hover:text-[#0D7E8A] hover:bg-[#0D7E8A]/10" title="Edit test">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => setShowDeleteConfirm(test.id)} className="p-1.5 rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50" title="Delete test">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredTests.length === 0 && (
                    <tr><td colSpan={10} className="text-center py-12 text-slate-500 text-sm">No tests found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalCatalogPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
                <p className="text-xs text-slate-500">
                  Showing {((catalogPage - 1) * catalogPageSize) + 1}&ndash;{Math.min(catalogPage * catalogPageSize, filteredTests.length)} of {filteredTests.length}
                </p>
                <div className="flex items-center gap-1">
                  <button disabled={catalogPage <= 1} onClick={() => setCatalogPage((p) => p - 1)} className="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-40">
                    <ChevronLeft size={14} />
                  </button>
                  {Array.from({ length: totalCatalogPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalCatalogPages || Math.abs(p - catalogPage) <= 2)
                    .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                      if (idx > 0 && p - (arr[idx - 1] ?? 0) > 1) acc.push("...");
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, i) =>
                      p === "..." ? (
                        <span key={`d${i}`} className="px-1 text-xs text-slate-500">...</span>
                      ) : (
                        <button key={p} onClick={() => setCatalogPage(p as number)} className={cn("w-8 h-8 rounded-md text-xs font-medium", catalogPage === p ? "bg-[#1B4F8A] text-slate-900" : "border border-slate-200 text-slate-600 hover:bg-white")}>
                          {p}
                        </button>
                      )
                    )}
                  <button disabled={catalogPage >= totalCatalogPages} onClick={() => setCatalogPage((p) => p + 1)} className="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-40">
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
  );

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 animate-fade-in" onClick={() => actionMenuId && setActionMenuId(null)}>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Rate Lists & Test Catalog</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage pricing rate lists and test catalog</p>
      </div>

      {/* Main Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        {([{ label: "Rate Lists", value: "rate-lists" }, { label: "Test Catalog", value: "test-catalog" }] as const).map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={cn("px-4 py-2 rounded-md text-sm font-medium transition-colors", activeTab === tab.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "rate-lists" ? rateListsContent : testCatalogContent}

      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void handleExcelFile(file); }} />
      <input ref={uploadInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUploadFile} />

      {/* ── Create Rate List Modal ─────────────────────────────────── */}
      {showCreateModal && <CreateRateListModal />}

      {/* ── Import Preview Modal ───────────────────────────────────── */}
      {showImportModal && <ImportPreviewModal />}

      {/* ── Add Test Modal ─────────────────────────────────────────── */}
      {showAddTestModal && <AddTestModal />}

      {/* ── Edit Test Modal ────────────────────────────────────────── */}
      {editingTest && <EditTestModal test={editingTest} />}

      {/* ── Delete Test Confirmation ───────────────────────────────── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
            <div className="p-5 text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3"><Trash2 size={20} className="text-red-600" /></div>
              <h3 className="font-semibold text-slate-900 mb-1">Delete Test</h3>
              <p className="text-sm text-slate-500">This will deactivate the test from the catalog. Are you sure?</p>
            </div>
            <div className="flex gap-2 p-4 border-t">
              <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
              <button disabled={deleteTestMutation.isPending} onClick={() => deleteTestMutation.mutate(showDeleteConfirm)} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {deleteTestMutation.isPending && <Loader2 size={14} className="animate-spin" />} Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Import Results Modal ──────────────────────────────────────── */}
      {showImportResult && importResult && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="p-6">
              <h3 className="font-semibold text-slate-900 text-lg mb-4">Import Complete</h3>
              <div className="space-y-3 mb-5">
                <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                  <span className="text-sm text-emerald-700 font-medium">{importResult.inserted} tests added successfully</span>
                </div>
                {importResult.duplicates > 0 && (
                  <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <AlertCircle size={18} className="text-amber-600 shrink-0" />
                    <span className="text-sm text-amber-700 font-medium">{importResult.duplicates} duplicates skipped</span>
                  </div>
                )}
                {importResult.errors > 0 && (
                  <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle size={18} className="text-red-600 shrink-0" />
                    <span className="text-sm text-red-700 font-medium">{importResult.errors} rows had errors</span>
                  </div>
                )}
              </div>

              {importResult.duplicates > 0 && (
                <div className="mb-4">
                  <button
                    onClick={() => setShowDuplicates((v) => !v)}
                    className="text-sm text-teal-600 hover:text-teal-700 font-medium underline"
                  >
                    {showDuplicates ? "Hide" : "View"} Duplicates ({importResult.duplicates})
                  </button>
                  {showDuplicates && (
                    <div className="mt-3 border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-slate-500">Row</th>
                            <th className="px-3 py-2 text-left font-medium text-slate-500">Code</th>
                            <th className="px-3 py-2 text-left font-medium text-slate-500">Name</th>
                            <th className="px-3 py-2 text-left font-medium text-slate-500">Reason</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {importResult.duplicateList.map((d, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="px-3 py-2 text-slate-500">{d.row}</td>
                              <td className="px-3 py-2 font-mono text-slate-600">{d.testCode}</td>
                              <td className="px-3 py-2 text-slate-700 max-w-[180px] truncate">{d.testName}</td>
                              <td className="px-3 py-2 text-amber-600">{d.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-end p-4 border-t border-slate-100">
              <button onClick={() => { setShowImportResult(false); setImportResult(null); }} className="px-4 py-2 bg-white text-slate-900 rounded-lg text-sm font-medium hover:bg-slate-100">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading overlay for parsing */}
      {isParsing && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-40">
          <div className="bg-white rounded-xl shadow-lg p-6 flex flex-col items-center gap-3">
            <Loader2 size={28} className="animate-spin text-[#0D7E8A]" />
            <p className="text-sm text-slate-600">Parsing Excel file...</p>
          </div>
        </div>
      )}

      {/* ── Add Profile Modal ─────────────────────────────────────────── */}
      {showAddProfileModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900 text-lg">Add Profile</h3>
              <button onClick={() => setShowAddProfileModal(false)} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Profile Name *</label>
                  <input
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    placeholder="e.g., Complete Blood Count Panel"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 focus:border-teal-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Profile Code</label>
                  <input
                    value={profileForm.code}
                    onChange={(e) => setProfileForm({ ...profileForm, code: e.target.value })}
                    placeholder="e.g., CBC-PANEL"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 focus:border-teal-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Outsource</label>
                <select
                  value={profileForm.outsource}
                  onChange={(e) => setProfileForm({ ...profileForm, outsource: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                >
                  <option value="SELF">Self</option>
                  <option value="EXTERNAL">External Lab</option>
                </select>
              </div>

              <div className="relative">
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Add Tests to Profile *</label>
                <input
                  value={profileTestSearch}
                  onChange={(e) => {
                    setProfileTestSearch(e.target.value);
                    void searchProfileTests(e.target.value);
                  }}
                  onFocus={() => profileTestSearch.length >= 2 && setProfileTestDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setProfileTestDropdownOpen(false), 200)}
                  placeholder="Type to search tests by name or code..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 focus:border-teal-400"
                />
                {profileTestDropdownOpen && profileTestResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                    {profileTestResults.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onMouseDown={() => {
                          if (!selectedProfileTests.find((s) => s.id === t.id)) {
                            setSelectedProfileTests([...selectedProfileTests, t]);
                          }
                          setProfileTestSearch("");
                          setProfileTestDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center justify-between text-sm"
                      >
                        <span className="text-slate-800">{t.name}</span>
                        <span className="text-xs text-slate-500 ml-2">{formatCurrency(t.price)}</span>
                      </button>
                    ))}
                  </div>
                )}
                {selectedProfileTests.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedProfileTests.map((t) => (
                      <span key={t.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-teal-50 border border-teal-200 text-teal-700 text-xs rounded-full">
                        {t.name}
                        <button type="button" onClick={() => setSelectedProfileTests(selectedProfileTests.filter((s) => s.id !== t.id))} className="text-teal-400 hover:text-teal-600">
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Integration Code</label>
                  <input
                    value={profileForm.integrationCode}
                    onChange={(e) => setProfileForm({ ...profileForm, integrationCode: e.target.value })}
                    placeholder="Optional"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Short Description</label>
                  <input
                    value={profileForm.shortDescription}
                    onChange={(e) => setProfileForm({ ...profileForm, shortDescription: e.target.value })}
                    placeholder="Optional"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Profile Description</label>
                <textarea
                  value={profileForm.description}
                  onChange={(e) => setProfileForm({ ...profileForm, description: e.target.value })}
                  rows={3}
                  placeholder="Optional description"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 resize-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-100">
              <button onClick={() => setShowAddProfileModal(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button
                disabled={createProfileMutation.isPending || !profileForm.name.trim() || selectedProfileTests.length === 0}
                onClick={() => createProfileMutation.mutate()}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
              >
                {createProfileMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ── Create Rate List Modal ──────────────────────────────────────────

  function CreateRateListModal() {
    const [step, setStep] = useState<1 | 2>(1);
    const [selectedType, setSelectedType] = useState("PRICE_LIST");
    const [name, setName] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [copiedFromId, setCopiedFromId] = useState("");
    const [excelFile, setExcelFile] = useState<File | null>(null);
    const excelInputRef = useRef<HTMLInputElement>(null);

    if (step === 1) {
      return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-slate-900">Choose Type Of List</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-500 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="p-4 space-y-3">
              {LIST_TYPE_OPTIONS.map((opt) => (
                <label key={opt.value} className={cn("block p-3 rounded-lg border cursor-pointer transition-colors", selectedType === opt.value ? "border-[#0D7E8A] bg-[#0D7E8A]/5" : "border-slate-200 hover:bg-slate-50")}>
                  <div className="flex items-start gap-3">
                    <div className={cn("w-4 h-4 rounded-full border-2 mt-0.5 flex items-center justify-center", selectedType === opt.value ? "border-[#0D7E8A]" : "border-slate-300")}>
                      {selectedType === opt.value && <div className="w-2 h-2 rounded-full bg-[#0D7E8A]" />}
                    </div>
                    <div>
                      <input type="radio" className="hidden" value={opt.value} checked={selectedType === opt.value} onChange={() => setSelectedType(opt.value)} />
                      <p className="text-sm font-medium text-slate-900">{opt.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                    </div>
                  </div>
                </label>
              ))}
            </div>
            <div className="p-4 border-t">
              <button onClick={() => setStep(2)} className="w-full px-4 py-2.5 bg-[#0D7E8A] text-slate-900 rounded-lg text-sm font-medium hover:bg-[#0a6b75]">
                Confirm and Continue
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-semibold text-slate-900">Add New List</h3>
            <button onClick={() => setShowCreateModal(false)} className="text-slate-500 hover:text-slate-600"><X size={18} /></button>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">List Name *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Medibuddy Walk-in" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]/20 focus:border-[#0D7E8A]" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Start Date</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]/20 focus:border-[#0D7E8A]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">End Date</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]/20 focus:border-[#0D7E8A]" />
              </div>
            </div>
            {(startDate || endDate) && (
              <button onClick={() => { setStartDate(""); setEndDate(""); }} className="text-xs text-[#0D7E8A] hover:underline">Clear Start Date & End Date</button>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Copy from existing list (optional)</label>
              <select value={copiedFromId} onChange={(e) => setCopiedFromId(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]/20 focus:border-[#0D7E8A]">
                <option value="">Select List Name</option>
                {(rateLists ?? []).map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Upload Excel with prices (optional)</label>
              <input ref={excelInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setExcelFile(f); }} />
              {excelFile ? (
                <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <FileSpreadsheet size={14} className="text-emerald-600" />
                  <span className="flex-1 truncate text-slate-700">{excelFile.name}</span>
                  <button type="button" onClick={() => { setExcelFile(null); if (excelInputRef.current) excelInputRef.current.value = ""; }} className="text-slate-500 hover:text-red-500"><X size={14} /></button>
                </div>
              ) : (
                <button type="button" onClick={() => excelInputRef.current?.click()} className="w-full border border-dashed border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-500 hover:border-[#0D7E8A] hover:text-[#0D7E8A] transition-colors flex items-center justify-center gap-2">
                  <FileSpreadsheet size={14} /> Choose .xlsx file
                </button>
              )}
              <p className="text-[10px] text-slate-500 mt-1">Excel should have columns: Test Code, Price. Prices will be matched by test code.</p>
            </div>
          </div>
          <div className="flex gap-2 p-4 border-t">
            <button onClick={() => setShowCreateModal(false)} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Close</button>
            <button
              disabled={!name.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate({ name: name.trim(), listType: selectedType, startDate: startDate || undefined, endDate: endDate || undefined, copiedFromId: copiedFromId || undefined, excelFile: excelFile || undefined })}
              className="flex-1 px-4 py-2 bg-[#0D7E8A] text-slate-900 rounded-lg text-sm font-medium hover:bg-[#0a6b75] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {createMutation.isPending && <Loader2 size={14} className="animate-spin" />} Add
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Add Test Modal ──────────────────────────────────────────────────

  function AddTestModal() {
    const [form, setForm] = useState({
      code: "", name: "", type: "", department: "Biochemistry", category: "",
      cptCode: "", sampleType: "Serum", sampleVolume: "", schedule: "Daily",
      turnaroundHours: 24, price: 0, b2bPrice: 0, cogs: 0, methodology: "", isActive: true,
    });

    const addTestMut = useMutation({
      mutationFn: async () => {
        await api.post("/test-catalog", {
          code: form.code.trim() || form.name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10),
          name: form.name.trim(),
          type: form.type.trim() || null,
          department: form.department, category: form.category.trim() || form.department,
          cptCode: form.cptCode.trim() || null, sampleType: form.sampleType,
          sampleVolume: form.sampleVolume.trim() || null, schedule: form.schedule.trim() || null,
          turnaroundHours: form.turnaroundHours, price: form.price,
          b2bPrice: form.b2bPrice || null, cogs: form.cogs || null,
          methodology: form.methodology.trim() || null, isActive: form.isActive,
        });
      },
      onSuccess: () => {
        toast.success("Test added to catalog");
        setShowAddTestModal(false);
        void qc.invalidateQueries({ queryKey: ["test-catalog-all"] });
      },
      onError: () => toast.error("Failed to add test"),
    });

    const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]/20 focus:border-[#0D7E8A]";

    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-semibold text-slate-900">Add Test to Catalog</h3>
            <button onClick={() => setShowAddTestModal(false)} className="text-slate-500 hover:text-slate-600"><X size={18} /></button>
          </div>
          <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Test Code</label>
                <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="Auto-generated if empty" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Type</label>
                <input value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} placeholder="e.g. Pathology Type" className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Investigations (Test Name) *</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Methodology</label>
                <input value={form.methodology} onChange={(e) => setForm((f) => ({ ...f, methodology: e.target.value }))} placeholder="e.g. ELISA, LCMS" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Sample Type</label>
                <select value={form.sampleType} onChange={(e) => setForm((f) => ({ ...f, sampleType: e.target.value }))} className={inputCls}>
                  {SAMPLE_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Sample Volume</label>
                <input value={form.sampleVolume} onChange={(e) => setForm((f) => ({ ...f, sampleVolume: e.target.value }))} placeholder="e.g. 3 ml" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Schedule</label>
                <input value={form.schedule} onChange={(e) => setForm((f) => ({ ...f, schedule: e.target.value }))} placeholder="e.g. Daily, 3,5" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">TAT (hours)</label>
                <input type="number" value={form.turnaroundHours} onChange={(e) => setForm((f) => ({ ...f, turnaroundHours: parseInt(e.target.value) || 0 }))} className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">MRP *</label>
                <input type="number" step="0.01" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: parseFloat(e.target.value) || 0 }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">B2B Price</label>
                <input type="number" step="0.01" value={form.b2bPrice} onChange={(e) => setForm((f) => ({ ...f, b2bPrice: parseFloat(e.target.value) || 0 }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Cost Per Test</label>
                <input type="number" step="0.01" value={form.cogs} onChange={(e) => setForm((f) => ({ ...f, cogs: parseFloat(e.target.value) || 0 }))} className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Department</label>
                <select value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} className={inputCls}>
                  {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">CPT Code</label>
                <input value={form.cptCode} onChange={(e) => setForm((f) => ({ ...f, cptCode: e.target.value }))} placeholder="e.g. 82947" className={inputCls} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))} className={cn("w-10 h-5 rounded-full transition-colors", form.isActive ? "bg-[#0D7E8A]" : "bg-slate-300")}>
                <div className={cn("w-4 h-4 rounded-full bg-white shadow transition-transform", form.isActive ? "translate-x-5" : "translate-x-0.5")} />
              </button>
              <span className="text-xs text-slate-600">Active</span>
            </div>
          </div>
          <div className="flex gap-2 p-4 border-t">
            <button onClick={() => setShowAddTestModal(false)} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button disabled={!form.name.trim() || addTestMut.isPending} onClick={() => addTestMut.mutate()} className="flex-1 px-4 py-2 bg-[#0D7E8A] text-slate-900 rounded-lg text-sm font-medium hover:bg-[#0a6b75] disabled:opacity-50 flex items-center justify-center gap-2">
              {addTestMut.isPending && <Loader2 size={14} className="animate-spin" />} Add Test
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Edit Test Modal ─────────────────────────────────────────────────

  function EditTestModal({ test }: { test: TestCatalogItem }) {
    const [form, setForm] = useState({
      code: test.code, name: test.name, type: test.type ?? "",
      department: test.department, category: test.category,
      sampleType: test.sampleType ?? "", sampleVolume: test.sampleVolume ?? "",
      schedule: test.schedule ?? "", methodology: test.methodology ?? "",
      cptCode: test.cptCode ?? "", turnaroundHours: test.turnaroundHours,
      price: Number(test.price), b2bPrice: test.b2bPrice ? Number(test.b2bPrice) : 0,
      cogs: test.cogs ? Number(test.cogs) : 0,
    });

    const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]/20 focus:border-[#0D7E8A]";

    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-semibold text-slate-900">Edit Test</h3>
            <button onClick={() => setEditingTest(null)} className="text-slate-500 hover:text-slate-600"><X size={18} /></button>
          </div>
          <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs font-medium text-slate-700 mb-1">Test Code</label><input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} className={inputCls} /></div>
              <div><label className="block text-xs font-medium text-slate-700 mb-1">Type</label><input value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} placeholder="e.g. Pathology Type" className={inputCls} /></div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Investigations (Test Name) *</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs font-medium text-slate-700 mb-1">Methodology</label><input value={form.methodology} onChange={(e) => setForm((f) => ({ ...f, methodology: e.target.value }))} className={inputCls} /></div>
              <div><label className="block text-xs font-medium text-slate-700 mb-1">Sample Type</label><input value={form.sampleType} onChange={(e) => setForm((f) => ({ ...f, sampleType: e.target.value }))} className={inputCls} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="block text-xs font-medium text-slate-700 mb-1">Sample Volume</label><input value={form.sampleVolume} onChange={(e) => setForm((f) => ({ ...f, sampleVolume: e.target.value }))} placeholder="e.g. 3 ml" className={inputCls} /></div>
              <div><label className="block text-xs font-medium text-slate-700 mb-1">Schedule</label><input value={form.schedule} onChange={(e) => setForm((f) => ({ ...f, schedule: e.target.value }))} placeholder="e.g. Daily" className={inputCls} /></div>
              <div><label className="block text-xs font-medium text-slate-700 mb-1">TAT (hours)</label><input type="number" value={form.turnaroundHours} onChange={(e) => setForm((f) => ({ ...f, turnaroundHours: parseInt(e.target.value) || 0 }))} className={inputCls} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="block text-xs font-medium text-slate-700 mb-1">MRP</label><input type="number" step="0.01" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: parseFloat(e.target.value) || 0 }))} className={inputCls} /></div>
              <div><label className="block text-xs font-medium text-slate-700 mb-1">B2B</label><input type="number" step="0.01" value={form.b2bPrice} onChange={(e) => setForm((f) => ({ ...f, b2bPrice: parseFloat(e.target.value) || 0 }))} className={inputCls} /></div>
              <div><label className="block text-xs font-medium text-slate-700 mb-1">Cost Per Test</label><input type="number" step="0.01" value={form.cogs} onChange={(e) => setForm((f) => ({ ...f, cogs: parseFloat(e.target.value) || 0 }))} className={inputCls} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs font-medium text-slate-700 mb-1">Department</label><input value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} className={inputCls} /></div>
              <div><label className="block text-xs font-medium text-slate-700 mb-1">CPT Code</label><input value={form.cptCode} onChange={(e) => setForm((f) => ({ ...f, cptCode: e.target.value }))} className={inputCls} /></div>
            </div>
          </div>
          <div className="flex gap-2 p-4 border-t">
            <button onClick={() => setEditingTest(null)} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button disabled={updateTestMutation.isPending} onClick={() => {
              if (!form.name.trim()) { toast.error("Test name is required"); return; }
              updateTestMutation.mutate({ id: test.id, updates: {
                code: form.code.trim(), name: form.name.trim(), type: form.type.trim() || null,
                department: form.department.trim(), category: form.category.trim(),
                methodology: form.methodology.trim() || null, cptCode: form.cptCode.trim() || null,
                sampleType: form.sampleType.trim() || null, sampleVolume: form.sampleVolume.trim() || null,
                schedule: form.schedule.trim() || null, turnaroundHours: form.turnaroundHours,
                price: form.price, b2bPrice: form.b2bPrice || null, cogs: form.cogs || null,
              } });
            }} className="flex-1 px-4 py-2 bg-[#0D7E8A] text-slate-900 rounded-lg text-sm font-medium hover:bg-[#0a6b75] disabled:opacity-50 flex items-center justify-center gap-2">
              {updateTestMutation.isPending && <Loader2 size={14} className="animate-spin" />} Save Changes
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Import Preview Modal ────────────────────────────────────────────

  function ImportPreviewModal() {
    const importable = parsedTests.filter((t) => t.status !== "skip");
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
          <div className="flex items-center justify-between p-4 border-b shrink-0">
            <div>
              <h3 className="font-semibold text-slate-900">Import Preview (EXCEL)</h3>
              <p className="text-xs text-slate-500 mt-0.5">{importable.length} tests to import, {parsedTests.length - importable.length} skipped</p>
            </div>
            <button onClick={() => { setShowImportModal(false); setParsedTests([]); }} className="text-slate-500 hover:text-slate-600"><X size={18} /></button>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 w-8">#</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Code</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Name</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Dept</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Sample</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Price</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Status</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parsedTests.map((t, i) => (
                  <tr key={i} className={cn(t.status === "skip" ? "opacity-40 bg-slate-50" : "")}>
                    <td className="px-3 py-1.5 text-xs text-slate-500">{i + 1}</td>
                    <td className="px-3 py-1.5 text-xs font-mono">{t.code}</td>
                    <td className="px-3 py-1.5 text-xs">{t.name}</td>
                    <td className="px-3 py-1.5 text-xs">{t.department}</td>
                    <td className="px-3 py-1.5 text-xs">{t.sampleType}</td>
                    <td className="px-3 py-1.5 text-xs">{formatCurrency(t.price)}</td>
                    <td className="px-3 py-1.5">
                      <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", t.status === "new" ? "bg-green-100 text-green-700" : t.status === "update" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500")}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-3 py-1.5">
                      <button onClick={() => toggleSkip(i)} className={cn("w-5 h-5 rounded border flex items-center justify-center", t.status === "skip" ? "border-slate-300" : "border-[#0D7E8A] bg-[#0D7E8A] text-slate-900")}>
                        {t.status !== "skip" && <Check size={12} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2 p-4 border-t shrink-0">
            <button onClick={() => { setShowImportModal(false); setParsedTests([]); }} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button disabled={importable.length === 0 || importMutation.isPending} onClick={() => importMutation.mutate(parsedTests)} className="flex-1 px-4 py-2 bg-[#0D7E8A] text-slate-900 rounded-lg text-sm font-medium hover:bg-[#0a6b75] disabled:opacity-50 flex items-center justify-center gap-2">
              {importMutation.isPending && <Loader2 size={14} className="animate-spin" />}
              Import {importable.length} Tests
            </button>
          </div>
        </div>
      </div>
    );
  }
}
