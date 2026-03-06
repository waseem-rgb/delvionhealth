"use client";

import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  X,
  Plus,
  Trash2,
  Search,
  Loader2,
  Printer,
  Save,
  FileText,
  User,
  Phone,
  Calendar,
  Clock,
  CreditCard,
  Banknote,
  Smartphone,
  Building2,
  ChevronRight,
  History,
  Tag,
  Receipt,
  List,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { formatCurrency, cn, formatDate } from "@/lib/utils";

// ── Types ───────────────────────────────────────────────────────────────────

interface Patient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  gender: string;
  phone: string | null;
  email: string | null;
  referralSource: string | null;
  organizationId: string | null;
  organization?: { id: string; name: string } | null;
}

interface TestCatalogItem {
  id: string;
  name: string;
  code: string;
  price: number | string;
  category: string;
  department: string;
  tatHours: number;
  sampleType?: string;
}

interface TestsByCategory {
  category: string;
  tests: TestCatalogItem[];
}

interface SelectedTest {
  testCatalogId: string;
  code: string;
  name: string;
  price: number;
  concession: number;
}

interface RateList {
  id: string;
  name: string;
  isDefault: boolean;
  description: string | null;
  testsCount?: number;
}

interface RateListItem {
  id: string;
  testCatalogId: string;
  price: number;
  testCatalog: {
    id: string;
    code: string;
    name: string;
    category: string;
    department: string;
    price: number | string;
    sampleType: string;
    turnaroundHours: number;
  };
}

interface RecentTest {
  id: string;
  name: string;
  code: string;
  price: number;
  lastOrdered: string;
}

interface BillResponse {
  success: boolean;
  invoiceId: string;
  invoiceNumber: string;
  orderId: string;
  orderNumber: string;
  total: number;
  amountPaid: number;
  balance: number;
  paymentStatus: string;
}

// ── Constants ───────────────────────────────────────────────────────────────

const PAYMENT_MODES = [
  { value: "CASH", label: "Cash", icon: Banknote },
  { value: "UPI", label: "UPI", icon: Smartphone },
  { value: "CARD", label: "Card", icon: CreditCard },
  { value: "CHEQUE", label: "Cheque", icon: FileText },
  { value: "ONLINE", label: "Online", icon: Building2 },
  { value: "CREDIT", label: "Credit/B2B", icon: Receipt },
] as const;

const DEPARTMENT_TABS = [
  "All",
  "Biochemistry",
  "Haematology",
  "Microbiology",
  "Pathology",
  "Serology",
  "Immunology",
  "Endocrinology",
  "Radiology",
] as const;

// ── Helpers ─────────────────────────────────────────────────────────────────

function calculateAge(dob: string | null): string {
  if (!dob) return "N/A";
  const birthDate = new Date(dob);
  const today = new Date();
  let years = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    years--;
  }
  return `${years}Y`;
}

function formatGender(g: string): string {
  switch (g?.toUpperCase()) {
    case "MALE": return "M";
    case "FEMALE": return "F";
    case "OTHER": return "O";
    default: return g || "N/A";
  }
}

function nowLocalISO(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

// ── Inner Component ─────────────────────────────────────────────────────────

function BillingPatientInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientId = searchParams.get("patientId") ?? "";

  // ── State ───────────────────────────────────────────────────────────────

  const [selectedTests, setSelectedTests] = useState<SelectedTest[]>([]);
  const [paymentMode, setPaymentMode] = useState("CASH");
  const [amountReceived, setAmountReceived] = useState<string>("");
  const [sampleCollectTime, setSampleCollectTime] = useState(nowLocalISO());
  const [billBookingTime, setBillBookingTime] = useState(nowLocalISO());
  const [selectedRateListId, setSelectedRateListId] = useState<string>("");
  const [activeDepartmentTab, setActiveDepartmentTab] = useState("All");
  const [priority, setPriority] = useState("ROUTINE");

  // Test search
  const [testSearchQuery, setTestSearchQuery] = useState("");
  const [testSearchResults, setTestSearchResults] = useState<TestCatalogItem[]>([]);
  const [testSearchLoading, setTestSearchLoading] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [activeRowSearchIndex, setActiveRowSearchIndex] = useState<number | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Rate list price map
  const [rateListPriceMap, setRateListPriceMap] = useState<Map<string, number>>(new Map());

  // ── Patient Query ───────────────────────────────────────────────────────

  const { data: patient, isLoading: patientLoading } = useQuery<Patient>({
    queryKey: ["patient", patientId],
    queryFn: async () => {
      const res = await api.get(`/patients/${patientId}`);
      return res.data.data ?? res.data;
    },
    enabled: !!patientId,
  });

  // ── Rate Lists Query ────────────────────────────────────────────────────

  const { data: rateLists } = useQuery<RateList[]>({
    queryKey: ["rate-lists"],
    queryFn: async () => {
      const res = await api.get("/rate-lists");
      return res.data.data ?? res.data;
    },
  });

  // Set default rate list on load
  useEffect(() => {
    if (rateLists && !selectedRateListId) {
      const defaultList = rateLists.find((r) => r.isDefault);
      if (defaultList) setSelectedRateListId(defaultList.id);
    }
  }, [rateLists, selectedRateListId]);

  // ── Rate List Items Query ───────────────────────────────────────────────

  const { data: rateListItems } = useQuery<RateListItem[]>({
    queryKey: ["rate-list-items", selectedRateListId],
    queryFn: async () => {
      const res = await api.get(`/rate-lists/${selectedRateListId}/items`);
      return res.data.data ?? res.data;
    },
    enabled: !!selectedRateListId,
  });

  // Build price map from rate list items
  useEffect(() => {
    if (rateListItems) {
      const map = new Map<string, number>();
      for (const item of rateListItems) {
        map.set(item.testCatalogId, Number(item.price));
      }
      setRateListPriceMap(map);
    }
  }, [rateListItems]);

  // ── Categories Query (for quick-add grid) ──────────────────────────────

  const { data: testCategories } = useQuery<TestsByCategory[]>({
    queryKey: ["test-catalog-categories"],
    queryFn: async () => {
      const res = await api.get("/test-catalog/by-category");
      return res.data.data?.data ?? res.data.data ?? res.data;
    },
  });

  // ── Recent Tests Query ──────────────────────────────────────────────────

  const { data: recentTests } = useQuery<RecentTest[]>({
    queryKey: ["recent-tests", patientId],
    queryFn: async () => {
      const res = await api.get(`/billing/patient/recent-tests?patientId=${patientId}`);
      return res.data.data ?? res.data;
    },
    enabled: !!patientId,
  });

  // ── Test Search ─────────────────────────────────────────────────────────

  const searchTests = useCallback(
    async (query: string) => {
      if (query.length < 2) {
        setTestSearchResults([]);
        setShowSearchDropdown(false);
        return;
      }
      setTestSearchLoading(true);
      try {
        const res = await api.get(`/test-catalog?search=${encodeURIComponent(query)}&limit=50`);
        const results: TestCatalogItem[] = res.data.data?.data ?? res.data.data ?? res.data;
        setTestSearchResults(results);
        setShowSearchDropdown(true);
      } catch {
        setTestSearchResults([]);
      } finally {
        setTestSearchLoading(false);
      }
    },
    [],
  );

  const handleTestSearchChange = useCallback(
    (value: string, rowIndex: number) => {
      setTestSearchQuery(value);
      setActiveRowSearchIndex(rowIndex);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      searchTimerRef.current = setTimeout(() => {
        searchTests(value);
      }, 300);
    },
    [searchTests],
  );

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
        setActiveRowSearchIndex(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Test Management ─────────────────────────────────────────────────────

  const getTestPrice = useCallback(
    (testId: string, catalogPrice: number | string): number => {
      const ratePrice = rateListPriceMap.get(testId);
      if (ratePrice !== undefined) return ratePrice;
      return Number(catalogPrice) || 0;
    },
    [rateListPriceMap],
  );

  const addTest = useCallback(
    (test: TestCatalogItem) => {
      if (selectedTests.some((t) => t.testCatalogId === test.id)) {
        toast.error(`${test.name} is already added`);
        return;
      }
      const price = getTestPrice(test.id, test.price);
      setSelectedTests((prev) => [
        ...prev,
        {
          testCatalogId: test.id,
          code: test.code,
          name: test.name,
          price,
          concession: 0,
        },
      ]);
      setTestSearchQuery("");
      setShowSearchDropdown(false);
      setActiveRowSearchIndex(null);
    },
    [selectedTests, getTestPrice],
  );

  const removeTest = useCallback((index: number) => {
    setSelectedTests((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateConcession = useCallback((index: number, value: number) => {
    setSelectedTests((prev) =>
      prev.map((t, i) =>
        i === index ? { ...t, concession: Math.max(0, Math.min(value, t.price)) } : t,
      ),
    );
  }, []);

  const updatePrice = useCallback((index: number, value: number) => {
    setSelectedTests((prev) =>
      prev.map((t, i) =>
        i === index ? { ...t, price: Math.max(0, value) } : t,
      ),
    );
  }, []);

  const addEmptyRow = useCallback(() => {
    setActiveRowSearchIndex(selectedTests.length);
    setTestSearchQuery("");
    setShowSearchDropdown(false);
  }, [selectedTests.length]);

  const addFromRecent = useCallback(
    (test: RecentTest) => {
      if (selectedTests.some((t) => t.testCatalogId === test.id)) {
        toast.error(`${test.name} is already added`);
        return;
      }
      const price = rateListPriceMap.get(test.id) ?? test.price;
      setSelectedTests((prev) => [
        ...prev,
        {
          testCatalogId: test.id,
          code: test.code,
          name: test.name,
          price,
          concession: 0,
        },
      ]);
    },
    [selectedTests, rateListPriceMap],
  );

  // ── Calculations ────────────────────────────────────────────────────────

  const subtotal = useMemo(
    () => selectedTests.reduce((s, t) => s + t.price, 0),
    [selectedTests],
  );

  const totalConcession = useMemo(
    () => selectedTests.reduce((s, t) => s + t.concession, 0),
    [selectedTests],
  );

  const netAmount = useMemo(() => subtotal - totalConcession, [subtotal, totalConcession]);

  const amountReceivedNum = useMemo(
    () => parseFloat(amountReceived) || 0,
    [amountReceived],
  );

  const balanceDue = useMemo(
    () => Math.max(0, netAmount - amountReceivedNum),
    [netAmount, amountReceivedNum],
  );

  // Auto-fill amount received when mode changes (full amount for non-credit)
  useEffect(() => {
    if (paymentMode === "CREDIT") {
      setAmountReceived("0");
    }
  }, [paymentMode]);

  // ── Filtered categories for quick-add grid ─────────────────────────────

  const filteredCategoryTests = useMemo(() => {
    if (!testCategories) return [];
    if (activeDepartmentTab === "All") return testCategories;
    return testCategories.filter(
      (c) => c.category.toLowerCase() === activeDepartmentTab.toLowerCase(),
    );
  }, [testCategories, activeDepartmentTab]);

  // ── Submit Bill ─────────────────────────────────────────────────────────

  const submitMutation = useMutation<BillResponse, Error, { shouldPrint: boolean; isDraft?: boolean }>({
    mutationFn: async () => {
      const res = await api.post("/billing/patient", {
        patientId,
        tests: selectedTests.map((t) => ({
          testCatalogId: t.testCatalogId,
          price: t.price,
          concession: t.concession,
        })),
        paymentMode,
        amountPaid: amountReceivedNum,
        rateListId: selectedRateListId || undefined,
        organizationId: patient?.organizationId || undefined,
        priority,
        collectionType: "WALK_IN",
      });
      return res.data;
    },
    onSuccess: (data, variables) => {
      toast.success(
        `Invoice ${data.invoiceNumber} generated. Proceeding to Accession...`,
        { duration: 4000 },
      );
      if (variables.shouldPrint) {
        // Open invoice in new tab for printing
        const printUrl = `/billing?invoiceId=${data.invoiceId}`;
        window.open(printUrl, "_blank");
      }
      router.push(`/accession?orderId=${data.orderId}`);
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to create bill";
      toast.error(message);
    },
  });

  const handleSubmit = useCallback(
    (shouldPrint: boolean, isDraft = false) => {
      if (selectedTests.length === 0) {
        toast.error("Please add at least one test");
        return;
      }
      if (!patientId) {
        toast.error("Patient not found");
        return;
      }
      if (paymentMode !== "CREDIT" && amountReceivedNum < 0) {
        toast.error("Amount received cannot be negative");
        return;
      }
      submitMutation.mutate({ shouldPrint, isDraft });
    },
    [selectedTests, patientId, paymentMode, amountReceivedNum, submitMutation],
  );

  // ── Loading / Error States ──────────────────────────────────────────────

  if (!patientId) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <div className="text-center">
          <User className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No Patient Selected</h3>
          <p className="mt-2 text-sm text-gray-500">
            Please register or select a patient first.
          </p>
          <button
            onClick={() => router.push("/patients")}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Go to Patients
          </button>
        </div>
      </div>
    );
  }

  if (patientLoading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600">Loading patient details...</span>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-gray-50">
      {/* ── LEFT PANEL ──────────────────────────────────────────────────── */}
      <div className="w-[220px] flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Back Link */}
          <button
            onClick={() => router.push("/patients")}
            className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Registration
          </button>

          {/* Patient Info Card */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                <User className="h-4 w-4 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {patient?.firstName} {patient?.lastName}
                </p>
                <p className="text-xs text-gray-500">{patient?.mrn}</p>
              </div>
            </div>

            <div className="space-y-1.5 text-xs text-gray-600">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3 w-3 text-gray-400" />
                <span>
                  {calculateAge(patient?.dateOfBirth ?? null)} / {formatGender(patient?.gender ?? "")}
                </span>
              </div>
              {patient?.phone && (
                <div className="flex items-center gap-1.5">
                  <Phone className="h-3 w-3 text-gray-400" />
                  <span className="truncate">{patient.phone}</span>
                </div>
              )}
              {patient?.referralSource && (
                <div className="flex items-center gap-1.5">
                  <Tag className="h-3 w-3 text-gray-400" />
                  <span className="truncate">Ref: {patient.referralSource}</span>
                </div>
              )}
              {patient?.organization && (
                <div className="flex items-center gap-1.5">
                  <Building2 className="h-3 w-3 text-gray-400" />
                  <span className="truncate">{patient.organization.name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Sample Collect Time */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-700 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Sample Collect Time
            </label>
            <input
              type="datetime-local"
              value={sampleCollectTime}
              onChange={(e) => setSampleCollectTime(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Bill Booking Time */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-700 flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Bill Booking Time
            </label>
            <input
              type="datetime-local"
              value={billBookingTime}
              onChange={(e) => setBillBookingTime(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-700">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            >
              <option value="ROUTINE">Routine</option>
              <option value="URGENT">Urgent</option>
              <option value="STAT">STAT</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── CENTER PANEL ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">Bill Patient</h1>
            <button
              onClick={() => router.back()}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Test Selection Table */}
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="p-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <List className="h-4 w-4 text-blue-500" />
                Selected Tests
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase w-[40%]">
                      Test Name
                    </th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 uppercase w-[20%]">
                      Price
                    </th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 uppercase w-[20%]">
                      Concession
                    </th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 uppercase w-[12%]">
                      Net
                    </th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-gray-500 uppercase w-[8%]">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {selectedTests.map((test, index) => (
                    <tr key={`${test.testCatalogId}-${index}`} className="hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{test.name}</p>
                          <p className="text-xs text-gray-500">{test.code}</p>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          value={test.price}
                          onChange={(e) => updatePrice(index, parseFloat(e.target.value) || 0)}
                          className="w-24 text-right rounded border border-gray-200 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                          min={0}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          value={test.concession || ""}
                          onChange={(e) => updateConcession(index, parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="w-24 text-right rounded border border-gray-200 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                          min={0}
                          max={test.price}
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-gray-900">
                        {formatCurrency(Math.max(0, test.price - test.concession))}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => removeTest(index)}
                          className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600"
                          title="Remove test"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {/* Search Row */}
                  <tr className="bg-blue-50/30">
                    <td colSpan={5} className="px-3 py-2">
                      <div className="relative" ref={dropdownRef}>
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <input
                            type="text"
                            value={testSearchQuery}
                            onChange={(e) =>
                              handleTestSearchChange(e.target.value, selectedTests.length)
                            }
                            onFocus={() => {
                              setActiveRowSearchIndex(selectedTests.length);
                              if (testSearchQuery.length >= 2) setShowSearchDropdown(true);
                            }}
                            placeholder="Search tests by name or code..."
                            className="w-full rounded-md border border-gray-300 pl-9 pr-8 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                          {testSearchLoading && (
                            <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                          )}
                        </div>

                        {/* Search Dropdown */}
                        {showSearchDropdown &&
                          activeRowSearchIndex === selectedTests.length &&
                          testSearchResults.length > 0 && (
                            <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                              {testSearchResults.map((test) => {
                                const alreadyAdded = selectedTests.some(
                                  (t) => t.testCatalogId === test.id,
                                );
                                return (
                                  <button
                                    key={test.id}
                                    onClick={() => !alreadyAdded && addTest(test)}
                                    disabled={alreadyAdded}
                                    className={cn(
                                      "w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center justify-between border-b border-gray-50 last:border-0",
                                      alreadyAdded && "opacity-50 cursor-not-allowed bg-gray-50",
                                    )}
                                  >
                                    <div>
                                      <span className="font-medium text-gray-900">
                                        {test.name}
                                      </span>
                                      <span className="ml-2 text-xs text-gray-500">
                                        {test.code}
                                      </span>
                                      <span className="ml-2 text-xs text-gray-400">
                                        {test.category}
                                      </span>
                                    </div>
                                    <span className="text-sm font-medium text-gray-700">
                                      {formatCurrency(getTestPrice(test.id, test.price))}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Add Another Test */}
            <div className="px-3 py-2 border-t border-gray-100">
              <button
                onClick={addEmptyRow}
                className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                <Plus className="h-4 w-4" />
                Add Another Test
              </button>
            </div>
          </div>

          {/* Department Tabs + Quick-Add Grid */}
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="p-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">Quick Add by Department</h3>
            </div>

            {/* Tabs */}
            <div className="flex overflow-x-auto border-b border-gray-200 px-3">
              {DEPARTMENT_TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveDepartmentTab(tab)}
                  className={cn(
                    "px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors",
                    activeDepartmentTab === tab
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Test Cards Grid */}
            <div className="p-3 max-h-[280px] overflow-y-auto">
              {filteredCategoryTests.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">
                  No tests found in this department
                </p>
              ) : (
                <div className="space-y-4">
                  {filteredCategoryTests.map((cat) => (
                    <div key={cat.category}>
                      {activeDepartmentTab === "All" && (
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                          {cat.category}
                        </h4>
                      )}
                      <div className="grid grid-cols-3 gap-2">
                        {cat.tests.map((test) => {
                          const alreadyAdded = selectedTests.some(
                            (t) => t.testCatalogId === test.id,
                          );
                          return (
                            <button
                              key={test.id}
                              onClick={() => !alreadyAdded && addTest(test)}
                              disabled={alreadyAdded}
                              className={cn(
                                "text-left rounded-md border p-2 transition-all text-xs",
                                alreadyAdded
                                  ? "border-green-200 bg-green-50 opacity-60 cursor-not-allowed"
                                  : "border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50 hover:shadow-sm cursor-pointer",
                              )}
                            >
                              <p className="font-medium text-gray-800 truncate">{test.name}</p>
                              <div className="flex items-center justify-between mt-1">
                                <span className="text-gray-400">{test.code}</span>
                                <span className="font-medium text-blue-600">
                                  {formatCurrency(getTestPrice(test.id, test.price))}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Summary + Payment Section */}
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="p-4 space-y-4">
              {/* Totals */}
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-md bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Subtotal</p>
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(subtotal)}</p>
                </div>
                <div className="rounded-md bg-orange-50 p-3">
                  <p className="text-xs text-orange-600">Concession</p>
                  <p className="text-lg font-bold text-orange-600">
                    {totalConcession > 0 ? `- ${formatCurrency(totalConcession)}` : formatCurrency(0)}
                  </p>
                </div>
                <div className="rounded-md bg-blue-50 p-3">
                  <p className="text-xs text-blue-600">Net Amount</p>
                  <p className="text-lg font-bold text-blue-700">{formatCurrency(netAmount)}</p>
                </div>
              </div>

              {/* Payment Mode Toggle */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Payment Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_MODES.map((mode) => {
                    const Icon = mode.icon;
                    return (
                      <button
                        key={mode.value}
                        onClick={() => setPaymentMode(mode.value)}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all",
                          paymentMode === mode.value
                            ? "border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600"
                            : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {mode.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Amount Received + Balance */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Amount Received</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                      INR
                    </span>
                    <input
                      type="number"
                      value={amountReceived}
                      onChange={(e) => setAmountReceived(e.target.value)}
                      placeholder="0"
                      min={0}
                      disabled={paymentMode === "CREDIT"}
                      className={cn(
                        "w-full rounded-lg border border-gray-300 pl-12 pr-3 py-2.5 text-sm font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none",
                        paymentMode === "CREDIT" && "bg-gray-100 cursor-not-allowed",
                      )}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Balance Due</label>
                  <div
                    className={cn(
                      "flex items-center rounded-lg border px-3 py-2.5",
                      balanceDue > 0
                        ? "border-red-200 bg-red-50"
                        : "border-green-200 bg-green-50",
                    )}
                  >
                    <span
                      className={cn(
                        "text-sm font-bold",
                        balanceDue > 0 ? "text-red-600" : "text-green-600",
                      )}
                    >
                      {formatCurrency(paymentMode === "CREDIT" ? netAmount : balanceDue)}
                    </span>
                    {paymentMode === "CREDIT" && (
                      <span className="ml-2 text-xs text-gray-500">(Credit)</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pb-4">
            <button
              onClick={() => handleSubmit(true)}
              disabled={submitMutation.isPending || selectedTests.length === 0}
              className={cn(
                "flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white transition-colors",
                submitMutation.isPending || selectedTests.length === 0
                  ? "bg-blue-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700",
              )}
            >
              {submitMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Printer className="h-4 w-4" />
              )}
              Print Bill & Proceed to Accession
              <ChevronRight className="h-4 w-4" />
            </button>

            <button
              onClick={() => handleSubmit(false)}
              disabled={submitMutation.isPending || selectedTests.length === 0}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-semibold transition-colors",
                submitMutation.isPending || selectedTests.length === 0
                  ? "border-gray-200 text-gray-400 cursor-not-allowed"
                  : "border-gray-300 text-gray-700 hover:bg-gray-50",
              )}
            >
              <Save className="h-4 w-4" />
              Save & Proceed Without Print
              <ChevronRight className="h-4 w-4" />
            </button>

            <button
              onClick={() => handleSubmit(false, true)}
              disabled={submitMutation.isPending || selectedTests.length === 0}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-semibold transition-colors",
                submitMutation.isPending || selectedTests.length === 0
                  ? "border-gray-200 text-gray-400 cursor-not-allowed"
                  : "border-gray-300 text-gray-600 hover:bg-gray-50",
              )}
            >
              <FileText className="h-4 w-4" />
              Save as Draft
            </button>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ─────────────────────────────────────────────────── */}
      <div className="w-[280px] flex-shrink-0 border-l border-gray-200 bg-white overflow-y-auto">
        <div className="p-4 space-y-5">
          {/* Rate List Selector */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <Tag className="h-4 w-4 text-violet-500" />
              Rate List
            </h3>
            <select
              value={selectedRateListId}
              onChange={(e) => {
                setSelectedRateListId(e.target.value);
                // Update prices for existing selected tests when rate list changes
                if (e.target.value) {
                  // Prices will update once rateListItems query refetches
                }
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            >
              <option value="">No Rate List (Catalog Prices)</option>
              {rateLists?.map((rl) => (
                <option key={rl.id} value={rl.id}>
                  {rl.name} {rl.isDefault ? "(Default)" : ""}
                </option>
              ))}
            </select>
            {selectedRateListId && rateListItems && (
              <p className="text-xs text-gray-400">
                {rateListItems.length} tests with custom pricing
              </p>
            )}
          </div>

          {/* Separator */}
          <div className="border-t border-gray-200" />

          {/* Recent Tests */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <History className="h-4 w-4 text-amber-500" />
              Recent Tests
            </h3>

            {!recentTests || recentTests.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 py-6 text-center">
                <History className="mx-auto h-6 w-6 text-gray-300" />
                <p className="mt-1.5 text-xs text-gray-400">No recent tests found</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {recentTests.map((test) => {
                  const alreadyAdded = selectedTests.some(
                    (t) => t.testCatalogId === test.id,
                  );
                  return (
                    <button
                      key={test.id}
                      onClick={() => !alreadyAdded && addFromRecent(test)}
                      disabled={alreadyAdded}
                      className={cn(
                        "w-full text-left rounded-lg border p-2.5 transition-all text-xs",
                        alreadyAdded
                          ? "border-green-200 bg-green-50 opacity-60 cursor-not-allowed"
                          : "border-gray-200 hover:border-blue-300 hover:bg-blue-50 cursor-pointer",
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-800 truncate">{test.name}</p>
                          <p className="text-gray-400 mt-0.5">{test.code}</p>
                        </div>
                        <div className="text-right ml-2 flex-shrink-0">
                          <p className="font-medium text-blue-600">
                            {formatCurrency(rateListPriceMap.get(test.id) ?? test.price)}
                          </p>
                          {alreadyAdded && (
                            <span className="text-green-600 text-[10px] font-medium">Added</span>
                          )}
                        </div>
                      </div>
                      {test.lastOrdered && (
                        <p className="text-gray-400 mt-1">
                          Last: {formatDate(test.lastOrdered)}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Separator */}
          <div className="border-t border-gray-200" />

          {/* Bill Summary (compact) */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <Receipt className="h-4 w-4 text-green-500" />
              Bill Summary
            </h3>
            <div className="rounded-lg bg-gray-50 p-3 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Tests</span>
                <span className="font-medium text-gray-800">{selectedTests.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-medium text-gray-800">{formatCurrency(subtotal)}</span>
              </div>
              {totalConcession > 0 && (
                <div className="flex justify-between">
                  <span className="text-orange-500">Concession</span>
                  <span className="font-medium text-orange-600">
                    - {formatCurrency(totalConcession)}
                  </span>
                </div>
              )}
              <div className="border-t border-gray-200 pt-2 flex justify-between">
                <span className="font-semibold text-gray-700">Net Amount</span>
                <span className="font-bold text-blue-700">{formatCurrency(netAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Payment</span>
                <span className="font-medium text-gray-800">
                  {PAYMENT_MODES.find((m) => m.value === paymentMode)?.label ?? paymentMode}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Received</span>
                <span className="font-medium text-gray-800">
                  {formatCurrency(amountReceivedNum)}
                </span>
              </div>
              <div
                className={cn(
                  "flex justify-between font-semibold",
                  balanceDue > 0 ? "text-red-600" : "text-green-600",
                )}
              >
                <span>Balance</span>
                <span>
                  {formatCurrency(paymentMode === "CREDIT" ? netAmount : balanceDue)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page Export (Suspense wrapper for useSearchParams) ───────────────────────

export default function BillingPatientPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-[80vh]">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-3 text-gray-600">Loading...</span>
        </div>
      }
    >
      <BillingPatientInner />
    </Suspense>
  );
}
