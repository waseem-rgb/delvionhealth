"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Search,
  X,
  Loader2,
  FlaskConical,
  Sparkles,
  Building2,
  ListChecks,
  UserPlus,
  UserSearch,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { useTenantStore } from "@/store/tenantStore";
import { InfiniteCombobox } from "@/components/shared/InfiniteCombobox";
import type { ComboboxOption } from "@/components/shared/InfiniteCombobox";

type Step = 1 | 2 | 3 | 4;
type CollectionType = "WALK_IN" | "HOME_COLLECTION" | "EXTERNAL_LAB";
type DiscountType = "NONE" | "FLAT" | "PERCENT";
type PatientMode = "existing" | "new";
type Gender = "MALE" | "FEMALE" | "OTHER";

interface NewPatientForm {
  firstName: string;
  lastName: string;
  phone: string;
  gender: Gender;
  dob: string;
  email: string;
  age: string;
}

interface PatientResult {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  phone: string;
}

interface TestCatalogItem {
  id: string;
  name: string;
  code: string;
  price: number | string;
  category: string;
  department: string;
  tatHours: number;
}

interface TestsByCategory {
  category: string;
  tests: TestCatalogItem[];
}

interface OrgResult {
  id: string;
  name: string;
  code: string;
  rateList?: { id: string; name: string } | null;
}

interface RateListSummary {
  id: string;
  name: string;
  listType: string;
  testsCount: number;
}

interface SelectedTest {
  id: string;
  code: string;
  name: string;
  catalogPrice: number;
  quantity: number;
  discount: number;
}

const STEP_LABELS = ["Patient", "Tests", "Pricing", "Payment"];

const COLLECTION_TYPES: { label: string; value: CollectionType }[] = [
  { label: "Walk-in", value: "WALK_IN" },
  { label: "Home Collection", value: "HOME_COLLECTION" },
  { label: "External Lab", value: "EXTERNAL_LAB" },
];

const PAYMENT_METHODS = [
  "CASH",
  "CARD",
  "UPI",
  "INSURANCE",
  "CORPORATE",
  "BANK_TRANSFER",
];

export default function NewOrderPage() {
  const router = useRouter();
  const { activeBranch } = useTenantStore();

  const [step, setStep] = useState<Step>(1);

  // Step 1
  const [patientMode, setPatientMode] = useState<PatientMode>("existing");
  const [selectedPatient, setSelectedPatient] = useState<PatientResult | null>(null);
  const [collectionType, setCollectionType] = useState<CollectionType>("WALK_IN");
  const [priority, setPriority] = useState("ROUTINE");
  const patientMapRef = useRef<Map<string, PatientResult>>(new Map());

  // New patient form
  const [newPatient, setNewPatient] = useState<NewPatientForm>({
    firstName: "", lastName: "", phone: "", gender: "MALE", dob: "", email: "", age: "",
  });
  const [creatingPatient, setCreatingPatient] = useState(false);

  // Step 1: Organisation & Rate List
  const [selectedOrg, setSelectedOrg] = useState<OrgResult | null>(null);
  const orgMapRef = useRef<Map<string, OrgResult>>(new Map());
  const [rateLists, setRateLists] = useState<RateListSummary[]>([]);
  const [selectedRateListId, setSelectedRateListId] = useState<string>("");
  const [rateListPriceMap, setRateListPriceMap] = useState<Map<string, number>>(new Map());
  const [rateListLoading, setRateListLoading] = useState(false);

  // Step 2
  const [categories, setCategories] = useState<TestsByCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [testSearch, setTestSearch] = useState("");
  const [searchResults, setSearchResults] = useState<TestCatalogItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedTests, setSelectedTests] = useState<SelectedTest[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<Array<{ test_name: string; relevance_score: number }>>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 3
  const [notes, setNotes] = useState("");
  const [discountType, setDiscountType] = useState<DiscountType>("NONE");
  const [discountValue, setDiscountValue] = useState(0);

  // Step 4
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load catalog when entering step 2
  useEffect(() => {
    if (step !== 2 || categories.length > 0) return;
    setCatalogLoading(true);
    api
      .get<{ data: TestsByCategory[] }>("/test-catalog/by-category")
      .then((res) => {
        const cats = res.data.data ?? [];
        setCategories(cats);
        if (cats.length > 0) setActiveCategory(cats[0].category);
      })
      .catch(() => toast.error("Failed to load test catalog"))
      .finally(() => setCatalogLoading(false));
  }, [step, categories.length]);

  // Test search debounce
  useEffect(() => {
    if (!testSearch.trim()) {
      setSearchResults([]);
      return;
    }
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    setSearchLoading(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await api.get<{ data: TestCatalogItem[] }>(
          `/test-catalog/search?q=${encodeURIComponent(testSearch)}`
        );
        setSearchResults(res.data.data ?? []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [testSearch]);

  // AI symptom suggestions debounce
  useEffect(() => {
    if (!testSearch.trim() || testSearch.length < 3) {
      setAiSuggestions([]);
      return;
    }
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    setAiLoading(true);
    aiTimerRef.current = setTimeout(async () => {
      try {
        const res = await api.get<{
          data: { suggestions: Array<{ test_name: string; relevance_score: number }> };
        }>(`/test-catalog/ai-suggest?q=${encodeURIComponent(testSearch)}`);
        setAiSuggestions(res.data.data?.suggestions ?? []);
      } catch {
        setAiSuggestions([]);
      } finally {
        setAiLoading(false);
      }
    }, 500);
    return () => {
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    };
  }, [testSearch]);

  // Load rate lists on mount
  useEffect(() => {
    api
      .get<{ data: RateListSummary[] }>("/rate-lists")
      .then((res) => setRateLists(res.data.data ?? []))
      .catch(() => {});
  }, []);

  // Fetch rate list prices when rate list selection changes
  useEffect(() => {
    if (!selectedRateListId) {
      setRateListPriceMap(new Map());
      return;
    }
    setRateListLoading(true);
    api
      .get<{
        data: Array<{
          testCatalogId: string;
          price: number | string;
          isActive: boolean;
        }>;
      }>(`/rate-lists/${selectedRateListId}/items`)
      .then((res) => {
        const items = res.data.data ?? [];
        const map = new Map<string, number>();
        items.forEach((item) => {
          if (item.isActive) map.set(item.testCatalogId, Number(item.price));
        });
        setRateListPriceMap(map);
      })
      .catch(() => setRateListPriceMap(new Map()))
      .finally(() => setRateListLoading(false));
  }, [selectedRateListId]);

  // Organisation search for InfiniteCombobox
  const searchOrgs = useCallback(async (query: string): Promise<ComboboxOption[]> => {
    const res = await api.get<{ data: OrgResult[] }>(
      `/organisations?search=${encodeURIComponent(query)}`
    );
    const orgs = res.data.data ?? [];
    orgs.forEach((o) => orgMapRef.current.set(o.id, o));
    return orgs.map((o) => ({
      id: o.id,
      label: o.name,
      sublabel: `Code: ${o.code}${o.rateList ? ` · Rate List: ${o.rateList.name}` : ""}`,
    }));
  }, []);

  const handleOrgChange = (id: string | null, _opt: ComboboxOption | null) => {
    if (!id) {
      setSelectedOrg(null);
      return;
    }
    const org = orgMapRef.current.get(id);
    if (org) {
      setSelectedOrg(org);
      if (org.rateList?.id) {
        setSelectedRateListId(org.rateList.id);
      }
    }
  };

  // Patient search for InfiniteCombobox
  const searchPatients = useCallback(async (query: string): Promise<ComboboxOption[]> => {
    const res = await api.get<{ data: PatientResult[] }>(
      `/patients/search?q=${encodeURIComponent(query)}`
    );
    const patients = res.data.data ?? [];
    patients.forEach((p) => patientMapRef.current.set(p.id, p));
    return patients.map((p) => ({
      id: p.id,
      label: `${p.firstName} ${p.lastName}`,
      sublabel: `MRN: ${p.mrn} · ${p.phone}`,
    }));
  }, []);

  const handlePatientChange = (id: string | null, opt: ComboboxOption | null) => {
    if (!id || !opt) {
      setSelectedPatient(null);
      return;
    }
    const full = patientMapRef.current.get(id);
    if (full) {
      setSelectedPatient(full);
    } else {
      const parts = opt.label.split(" ");
      setSelectedPatient({ id, firstName: parts[0] ?? "", lastName: parts.slice(1).join(" "), mrn: "", phone: "" });
    }
  };

  // Get effective price: rate list price or catalog MRP
  const getPrice = useCallback(
    (testId: string, catalogPrice: number): number => {
      const ratePrice = rateListPriceMap.get(testId);
      return ratePrice !== undefined ? ratePrice : catalogPrice;
    },
    [rateListPriceMap]
  );

  // Pricing
  const subtotal = selectedTests.reduce(
    (sum, t) => sum + getPrice(t.id, t.catalogPrice) * t.quantity * (1 - t.discount / 100),
    0
  );
  const orderDiscountAmount =
    discountType === "FLAT"
      ? Math.min(discountValue, subtotal)
      : discountType === "PERCENT"
      ? (subtotal * Math.min(discountValue, 100)) / 100
      : 0;
  const netAmount = Math.max(0, subtotal - orderDiscountAmount);

  // Test helpers
  const addTest = (test: TestCatalogItem) =>
    setSelectedTests((prev) => {
      if (prev.find((t) => t.id === test.id)) return prev;
      return [...prev, { id: test.id, code: test.code, name: test.name, catalogPrice: Number(test.price), quantity: 1, discount: 0 }];
    });

  const removeTest = (id: string) =>
    setSelectedTests((prev) => prev.filter((t) => t.id !== id));

  const updateDiscount = (id: string, discount: number) =>
    setSelectedTests((prev) =>
      prev.map((t) => (t.id === id ? { ...t, discount: Math.max(0, Math.min(100, discount)) } : t))
    );

  const displayedTests = testSearch.trim()
    ? searchResults
    : categories.find((c) => c.category === activeCategory)?.tests ?? [];

  // Handle age → DOB conversion
  const handleAgeChange = (ageStr: string) => {
    setNewPatient((p) => {
      const age = parseInt(ageStr);
      let dob = "";
      if (!isNaN(age) && age >= 0 && age <= 150) {
        const d = new Date();
        d.setFullYear(d.getFullYear() - age);
        dob = d.toISOString().slice(0, 10);
      }
      return { ...p, age: ageStr, dob };
    });
  };

  // Create new patient then proceed to step 2
  const createPatientAndContinue = async () => {
    if (!newPatient.firstName.trim() || !newPatient.phone.trim()) {
      toast.error("First name and phone are required");
      return;
    }
    setCreatingPatient(true);
    try {
      const res = await api.post<{ data: { id: string; mrn: string; firstName: string; lastName: string; phone: string } }>("/patients", {
        firstName: newPatient.firstName.trim(),
        lastName: newPatient.lastName.trim() || undefined,
        phone: newPatient.phone.trim(),
        gender: newPatient.gender,
        dob: newPatient.dob || undefined,
        email: newPatient.email.trim() || undefined,
        branchId: activeBranch?.id,
      });
      const p = res.data.data;
      setSelectedPatient({ id: p.id, mrn: p.mrn, firstName: p.firstName, lastName: p.lastName ?? "", phone: p.phone });
      toast.success(`Patient ${p.firstName} registered (MRN: ${p.mrn})`);
      setStep(2);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to register patient";
      toast.error(msg);
    } finally {
      setCreatingPatient(false);
    }
  };

  // Submit
  const handleSubmit = async () => {
    if (!selectedPatient || !activeBranch || selectedTests.length === 0) return;
    setIsSubmitting(true);
    try {
      const res = await api.post<{ data: { id: string; orderNumber: string } }>("/orders", {
        patientId: selectedPatient.id,
        branchId: activeBranch.id,
        priority,
        collectionType,
        items: selectedTests.map((t) => ({
          testCatalogId: t.id,
          quantity: t.quantity,
          discount: t.discount,
        })),
        ...(discountType !== "NONE" && {
          discountType,
          discountAmount: discountValue,
        }),
        ...(notes && { notes }),
        ...(selectedOrg && { organizationId: selectedOrg.id }),
        ...(selectedRateListId && { rateListId: selectedRateListId }),
      });
      toast.success(`Order ${res.data.data.orderNumber} created successfully`);
      router.push(`/orders/${res.data.data.id}`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to create order";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">New Order</h1>
          <p className="text-sm text-slate-500">Step {step} of 4</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center">
        {STEP_LABELS.map((label, i) => {
          const s = (i + 1) as Step;
          const done = step > s;
          const active = step === s;
          return (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              <div
                className={`flex items-center gap-2 ${
                  active ? "text-[#1B4F8A]" : done ? "text-green-600" : "text-slate-400"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                    done
                      ? "border-green-500 bg-green-500 text-white"
                      : active
                      ? "border-[#1B4F8A] bg-[#1B4F8A] text-white"
                      : "border-slate-300 bg-white text-slate-400"
                  }`}
                >
                  {done ? <Check size={13} /> : s}
                </div>
                <span className="text-xs font-medium hidden sm:block">{label}</span>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-3 transition-colors ${
                    step > s ? "bg-green-400" : "bg-slate-200"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Step 1: Patient + Collection ── */}
      {step === 1 && (
        <div className="bg-white rounded-xl card-shadow p-6 space-y-5">
          {/* Patient mode toggle */}
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Patient</h2>
            <div className="flex bg-slate-100 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => { setPatientMode("existing"); setSelectedPatient(null); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  patientMode === "existing"
                    ? "bg-white text-[#1B4F8A] shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <UserSearch size={13} />
                Existing
              </button>
              <button
                type="button"
                onClick={() => { setPatientMode("new"); setSelectedPatient(null); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  patientMode === "new"
                    ? "bg-white text-[#1B4F8A] shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <UserPlus size={13} />
                New Patient
              </button>
            </div>
          </div>

          {/* Existing patient search */}
          {patientMode === "existing" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Search Patient <span className="text-red-500">*</span>
              </label>
              <InfiniteCombobox
                value={selectedPatient?.id ?? null}
                onChange={handlePatientChange}
                searchFn={searchPatients}
                placeholder="Search by name, MRN, or phone..."
              />
              {selectedPatient && (
                <p className="mt-1.5 text-xs text-slate-500">
                  MRN: <span className="font-mono">{selectedPatient.mrn}</span>
                  {selectedPatient.phone && ` · ${selectedPatient.phone}`}
                </p>
              )}
            </div>
          )}

          {/* New patient inline form */}
          {patientMode === "new" && (
            <div className="space-y-4 p-4 bg-blue-50/40 rounded-lg border border-blue-100">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={newPatient.firstName}
                    onChange={(e) => setNewPatient((p) => ({ ...p, firstName: e.target.value }))}
                    placeholder="First name"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20 focus:border-[#1B4F8A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Last Name</label>
                  <input
                    value={newPatient.lastName}
                    onChange={(e) => setNewPatient((p) => ({ ...p, lastName: e.target.value }))}
                    placeholder="Last name"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20 focus:border-[#1B4F8A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={newPatient.phone}
                    onChange={(e) => setNewPatient((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="+91 98765 43210"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20 focus:border-[#1B4F8A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                  <input
                    value={newPatient.email}
                    onChange={(e) => setNewPatient((p) => ({ ...p, email: e.target.value }))}
                    placeholder="email@example.com"
                    type="email"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20 focus:border-[#1B4F8A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Gender <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newPatient.gender}
                    onChange={(e) => setNewPatient((p) => ({ ...p, gender: e.target.value as Gender }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20 focus:border-[#1B4F8A]"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Age (years)</label>
                  <input
                    value={newPatient.age}
                    onChange={(e) => handleAgeChange(e.target.value)}
                    placeholder="e.g. 35"
                    type="number"
                    min={0}
                    max={150}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20 focus:border-[#1B4F8A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">DOB</label>
                  <input
                    value={newPatient.dob}
                    onChange={(e) => setNewPatient((p) => ({ ...p, dob: e.target.value, age: "" }))}
                    type="date"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20 focus:border-[#1B4F8A]"
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Collection Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {COLLECTION_TYPES.map((ct) => (
                <button
                  key={ct.value}
                  type="button"
                  onClick={() => setCollectionType(ct.value)}
                  className={`py-2.5 px-3 rounded-lg border text-sm font-medium transition-colors ${
                    collectionType === ct.value
                      ? "border-[#1B4F8A] bg-[#1B4F8A] text-white"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {ct.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Priority</label>
            <div className="flex gap-2">
              {(["ROUTINE", "URGENT", "STAT"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    priority === p
                      ? p === "STAT"
                        ? "bg-red-600 text-white border-red-600"
                        : p === "URGENT"
                        ? "bg-orange-500 text-white border-orange-500"
                        : "bg-[#1B4F8A] text-white border-[#1B4F8A]"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Organisation & Rate List */}
          <div className="border-t border-slate-100 pt-5 mt-1 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <Building2 size={15} className="text-slate-400" />
              Organisation &amp; Pricing
            </h3>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Organisation <span className="text-xs text-slate-400">(optional — for B2B orders)</span>
              </label>
              <InfiniteCombobox
                value={selectedOrg?.id ?? null}
                onChange={handleOrgChange}
                searchFn={searchOrgs}
                placeholder="Search organisation by name or code..."
              />
              {selectedOrg && (
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-xs text-slate-500">
                    {selectedOrg.name} ({selectedOrg.code})
                  </span>
                  {selectedOrg.rateList && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-[10px] font-medium text-blue-700">
                      <ListChecks size={10} />
                      {selectedOrg.rateList.name}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOrg(null);
                      setSelectedRateListId("");
                    }}
                    className="text-xs text-red-400 hover:text-red-600"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Rate List <span className="text-xs text-slate-400">(auto-selected with org, or pick manually)</span>
              </label>
              <div className="relative">
                <select
                  value={selectedRateListId}
                  onChange={(e) => setSelectedRateListId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20 focus:border-[#1B4F8A] appearance-none pr-8"
                >
                  <option value="">Default (Catalog MRP)</option>
                  {rateLists.map((rl) => (
                    <option key={rl.id} value={rl.id}>
                      {rl.name} ({rl.testsCount} tests) — {rl.listType.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
                {rateListLoading && (
                  <Loader2 size={14} className="absolute right-8 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />
                )}
              </div>
              {selectedRateListId && rateListPriceMap.size > 0 && (
                <p className="mt-1 text-xs text-green-600">
                  {rateListPriceMap.size} test prices loaded from rate list
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Step 2: Test Browser ── */}
      {step === 2 && (
        <div className="bg-white rounded-xl card-shadow overflow-hidden">
          {/* Search bar */}
          <div className="p-4 border-b border-slate-100">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={testSearch}
                onChange={(e) => setTestSearch(e.target.value)}
                placeholder="Search tests by name or code..."
                className="w-full pl-9 pr-9 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20 focus:border-[#1B4F8A]"
              />
              {testSearch && (
                <button
                  type="button"
                  onClick={() => { setTestSearch(""); setSearchResults([]); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* AI Suggestions panel */}
          {testSearch.trim().length >= 3 && (aiLoading || aiSuggestions.length > 0) && (
            <div className="px-4 py-3 border-b border-slate-100 bg-violet-50/60">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles size={13} className="text-violet-500" />
                <span className="text-xs font-semibold text-violet-700">AI Suggestions</span>
                {aiLoading && <Loader2 size={11} className="animate-spin text-violet-400 ml-1" />}
              </div>
              {!aiLoading && aiSuggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {aiSuggestions.slice(0, 6).map((s) => (
                    <button
                      key={s.test_name}
                      type="button"
                      onClick={() => setTestSearch(s.test_name)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-violet-200 text-xs text-violet-700 hover:bg-violet-100 transition-colors"
                    >
                      {s.test_name}
                      <span className="text-violet-400 font-mono text-[10px]">
                        {Math.round(s.relevance_score * 100)}%
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex" style={{ minHeight: 380 }}>
            {/* Category sidebar */}
            {!testSearch && (
              <div className="w-44 border-r border-slate-100 flex-shrink-0 overflow-y-auto bg-slate-50/50">
                {catalogLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 size={16} className="animate-spin text-slate-400" />
                  </div>
                ) : (
                  categories.map((cat) => (
                    <button
                      key={cat.category}
                      type="button"
                      onClick={() => setActiveCategory(cat.category)}
                      className={`w-full text-left px-3 py-2.5 text-xs font-medium border-b border-slate-100 transition-colors ${
                        activeCategory === cat.category
                          ? "bg-white text-[#1B4F8A] border-l-2 border-l-[#1B4F8A] font-semibold"
                          : "text-slate-600 hover:bg-white"
                      }`}
                    >
                      {cat.category}
                      <span className="ml-1 text-slate-400">({cat.tests.length})</span>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Test grid */}
            <div className="flex-1 p-4 overflow-y-auto">
              {searchLoading ? (
                <div className="flex items-center justify-center h-32 gap-2 text-slate-400">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-sm">Searching...</span>
                </div>
              ) : displayedTests.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                  <FlaskConical size={28} className="mb-2 opacity-40" />
                  <p className="text-sm">
                    {testSearch ? "No tests match your search" : "Select a category to browse tests"}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {displayedTests.map((test) => {
                    const selected = selectedTests.some((t) => t.id === test.id);
                    return (
                      <button
                        key={test.id}
                        type="button"
                        onClick={() => (selected ? removeTest(test.id) : addTest(test))}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          selected
                            ? "border-[#1B4F8A] bg-[#1B4F8A]/5"
                            : "border-slate-200 hover:border-[#1B4F8A]/40 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <span
                            className={`font-mono text-xs font-bold ${
                              selected ? "text-[#1B4F8A]" : "text-slate-500"
                            }`}
                          >
                            {test.code}
                          </span>
                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border transition-colors ${
                              selected
                                ? "bg-[#1B4F8A] border-[#1B4F8A] text-white"
                                : "border-slate-300 text-slate-400"
                            }`}
                          >
                            {selected ? <Check size={11} /> : <span className="text-xs leading-none">+</span>}
                          </div>
                        </div>
                        <p
                          className={`text-sm font-medium truncate ${
                            selected ? "text-[#1B4F8A]" : "text-slate-800"
                          }`}
                        >
                          {test.name}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {rateListPriceMap.has(test.id) ? (
                            <>
                              <span className="line-through text-slate-400 mr-1">
                                {formatCurrency(Number(test.price))}
                              </span>
                              <span className="text-green-600 font-semibold">
                                {formatCurrency(rateListPriceMap.get(test.id)!)}
                              </span>
                            </>
                          ) : (
                            formatCurrency(Number(test.price))
                          )}
                          {test.tatHours ? ` · ${test.tatHours}h TAT` : ""}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Cart */}
          {selectedTests.length > 0 && (
            <div className="border-t border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Selected Tests ({selectedTests.length})
              </p>
              <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                {selectedTests.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 text-slate-700 truncate">{t.name}</span>
                    <span className="text-slate-500 font-mono text-xs">
                      {rateListPriceMap.has(t.id) ? (
                        <span className="text-green-600">{formatCurrency(getPrice(t.id, t.catalogPrice))}</span>
                      ) : (
                        formatCurrency(t.catalogPrice)
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeTest(t.id)}
                      className="text-slate-300 hover:text-red-500 flex-shrink-0 transition-colors"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Step 3: Review & Pricing ── */}
      {step === 3 && (
        <div className="space-y-4">
          {/* Line items table */}
          <div className="bg-white rounded-xl card-shadow overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Order Items</h2>
              <span className="text-sm text-slate-500">{selectedTests.length} test(s)</span>
            </div>
            <div className="divide-y divide-slate-100">
              <div className="px-5 py-2 grid grid-cols-[1fr_80px_100px_90px_20px] gap-3 text-xs font-medium text-slate-400 uppercase tracking-wide">
                <span>Test</span>
                <span className="text-right">Price</span>
                <span className="text-center">Disc %</span>
                <span className="text-right">Total</span>
                <span />
              </div>
              {selectedTests.map((t) => {
                const effectivePrice = getPrice(t.id, t.catalogPrice);
                const lineTotal = effectivePrice * t.quantity * (1 - t.discount / 100);
                const hasRatePrice = rateListPriceMap.has(t.id);
                return (
                  <div
                    key={t.id}
                    className="px-5 py-3 grid grid-cols-[1fr_80px_100px_90px_20px] gap-3 items-center"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{t.name}</p>
                      <p className="text-xs text-slate-400 font-mono">{t.code}</p>
                    </div>
                    <div className="text-right">
                      {hasRatePrice && effectivePrice !== t.catalogPrice ? (
                        <>
                          <span className="text-xs text-slate-400 line-through block">
                            {formatCurrency(t.catalogPrice)}
                          </span>
                          <span className="text-sm text-green-600 font-medium">
                            {formatCurrency(effectivePrice)}
                          </span>
                        </>
                      ) : (
                        <span className="text-sm text-slate-600">
                          {formatCurrency(effectivePrice)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-center">
                      <input
                        type="number"
                        value={t.discount}
                        min={0}
                        max={100}
                        onChange={(e) => updateDiscount(t.id, Number(e.target.value))}
                        className="w-16 px-2 py-1 text-xs text-center border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-[#1B4F8A]/30 focus:border-[#1B4F8A]"
                      />
                    </div>
                    <span className="text-sm font-semibold text-slate-800 text-right">
                      {formatCurrency(lineTotal)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeTest(t.id)}
                      className="text-slate-300 hover:text-red-500 transition-colors justify-self-end"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Discount & Notes */}
          <div className="bg-white rounded-xl card-shadow p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Order-level Discount
              </label>
              <div className="flex gap-2 mb-3">
                {(["NONE", "FLAT", "PERCENT"] as DiscountType[]).map((dt) => (
                  <button
                    key={dt}
                    type="button"
                    onClick={() => { setDiscountType(dt); setDiscountValue(0); }}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                      discountType === dt
                        ? "border-[#1B4F8A] bg-[#1B4F8A] text-white"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {dt === "NONE" ? "None" : dt === "FLAT" ? "Flat (₹)" : "Percent (%)"}
                  </button>
                ))}
              </div>
              {discountType !== "NONE" && (
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={discountValue}
                    min={0}
                    max={discountType === "PERCENT" ? 100 : subtotal}
                    onChange={(e) => setDiscountValue(Number(e.target.value))}
                    className="w-32 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20 focus:border-[#1B4F8A]"
                    placeholder={discountType === "FLAT" ? "₹ amount" : "Percentage"}
                  />
                  {orderDiscountAmount > 0 && (
                    <span className="text-sm text-slate-500">
                      Saves{" "}
                      <span className="font-semibold text-red-500">
                        {formatCurrency(orderDiscountAmount)}
                      </span>
                    </span>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Clinical notes or special instructions..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20 focus:border-[#1B4F8A] resize-none"
              />
            </div>
          </div>

          {/* Totals summary */}
          <div className="bg-white rounded-xl card-shadow p-5">
            <div className="space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              {orderDiscountAmount > 0 && (
                <div className="flex justify-between text-sm text-red-500">
                  <span>
                    Discount (
                    {discountType === "PERCENT" ? `${discountValue}%` : "Flat"})
                  </span>
                  <span>−{formatCurrency(orderDiscountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg border-t border-slate-200 pt-3">
                <span>Net Amount</span>
                <span className="text-[#1B4F8A]">{formatCurrency(netAmount)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 4: Payment ── */}
      {step === 4 && (
        <div className="bg-white rounded-xl card-shadow p-6 space-y-5">
          {/* Amount display */}
          <div className="bg-[#1B4F8A]/5 rounded-xl p-5 text-center">
            <p className="text-sm text-slate-500 mb-1">Total Amount Due</p>
            <p className="text-4xl font-bold text-[#1B4F8A]">{formatCurrency(netAmount)}</p>
          </div>

          {/* Payment method */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Payment Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMethod(m)}
                  className={`py-2.5 px-3 rounded-lg border text-sm font-medium transition-colors ${
                    paymentMethod === m
                      ? "border-[#1B4F8A] bg-[#1B4F8A] text-white"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {m.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>

          {/* Order summary */}
          <div className="p-4 bg-slate-50 rounded-lg space-y-2 text-sm divide-y divide-slate-100">
            <div className="flex justify-between pb-2">
              <span className="text-slate-500">Patient</span>
              <span className="font-medium">
                {selectedPatient?.firstName} {selectedPatient?.lastName}
                {selectedPatient?.mrn && (
                  <span className="ml-2 font-mono text-xs text-slate-400">
                    {selectedPatient.mrn}
                  </span>
                )}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-500">Tests</span>
              <span className="font-medium">{selectedTests.length}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-500">Priority</span>
              <span className="font-medium">{priority}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-500">Collection</span>
              <span className="font-medium">{collectionType.replace(/_/g, " ")}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-500">Branch</span>
              <span className="font-medium">{activeBranch?.name ?? "—"}</span>
            </div>
            {selectedOrg && (
              <div className="flex justify-between py-2">
                <span className="text-slate-500">Organisation</span>
                <span className="font-medium">{selectedOrg.name}</span>
              </div>
            )}
            {selectedRateListId && (
              <div className="flex justify-between pt-2">
                <span className="text-slate-500">Rate List</span>
                <span className="font-medium text-green-700">
                  {rateLists.find((rl) => rl.id === selectedRateListId)?.name ?? "Custom"}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3 pb-8">
        <button
          type="button"
          onClick={() => setStep((s) => (Math.max(1, s - 1)) as Step)}
          disabled={step === 1}
          className="flex-1 py-2.5 px-4 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-30"
        >
          Back
        </button>
        {step < 4 ? (
          <button
            type="button"
            onClick={() => {
              if (step === 1 && patientMode === "new" && !selectedPatient) {
                createPatientAndContinue();
                return;
              }
              setStep((s) => (s + 1) as Step);
            }}
            disabled={
              (step === 1 && patientMode === "existing" && !selectedPatient) ||
              (step === 1 && patientMode === "new" && !selectedPatient && (!newPatient.firstName.trim() || !newPatient.phone.trim())) ||
              (step === 2 && selectedTests.length === 0) ||
              creatingPatient
            }
            className="flex-1 py-2.5 px-4 bg-[#1B4F8A] hover:bg-[#143C6B] text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {creatingPatient ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Registering Patient...
              </>
            ) : (
              <>
                Continue <ArrowRight size={14} />
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedPatient || selectedTests.length === 0 || !activeBranch}
            className="flex-1 py-2.5 px-4 bg-[#1B4F8A] hover:bg-[#143C6B] text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Check size={14} />
            )}
            {isSubmitting ? "Creating..." : "Confirm & Create Order"}
          </button>
        )}
      </div>
    </div>
  );
}
