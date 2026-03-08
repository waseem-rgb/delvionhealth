"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Plus,
  Minus,
  Loader2,
  AlertTriangle,
  MessageCircle,
  Printer,
  ArrowRight,
  Trash2,
  X,
  TestTube2,
  Clock,
  FileText,
  Save,
  Phone,
  ShoppingCart,
  RefreshCw,
  IndianRupee,
  Send,
  Bot,
  User,
  Package,
  Sparkles,
  Percent,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { formatCurrency, cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface TestItem {
  id: string;
  name: string;
  code: string;
  price: number;
  sampleType: string;
  tat: string;
  department: string;
}

interface EnquiryItem extends TestItem {
  quantity: number;
}

interface Enquiry {
  id: string;
  phone: string;
  tests: { name: string; price: number }[];
  total: number;
  converted: boolean;
  createdAt: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "ai";
  text: string;
  timestamp: Date;
}

interface AISuggestionTest {
  id: string;
  code: string;
  name: string;
  price: number;
}

interface AISuggestion {
  type?: string;
  packageName?: string;
  description?: string;
  tests: AISuggestionTest[];
  totalMRP?: number;
  suggestedPrice?: number;
  fastingRequired?: boolean;
  targetGender?: string;
  brochureText?: string;
}

interface QuoteTest {
  id: string | null;
  code: string;
  name: string;
  mrp: number;
  editedPrice: number;
  reason: string;
  fastingRequired: boolean;
  inCatalog: boolean;
  sampleType: string | null;
}

interface QuoteState {
  packageName: string;
  tests: QuoteTest[];
  subtotal: number;
  discount: number;
  discountPct: number;
  finalPrice: number;
  fastingRequired: boolean;
  targetGender: string;
  notes: string;
}

interface Quote {
  id: string;
  quoteNumber?: string;
  patientName: string;
  patientPhone: string;
  patientAge?: number;
  patientGender?: string;
  symptoms?: string;
  testIds: string[];
  testNames: string[];
  subtotal: number;
  discountAmt: number;
  discountPct: number;
  finalAmount?: number;
  status?: string;
}

type TabKey = "enquiry" | "package";

// ── Helpers ──────────────────────────────────────────────────────────────────

function recalcQuote(tests: QuoteTest[], discountPct: number): Pick<QuoteState, "subtotal" | "discount" | "discountPct" | "finalPrice"> {
  const subtotal = tests.reduce((sum, t) => sum + t.editedPrice, 0);
  const discount = Math.round(subtotal * discountPct / 100);
  return { subtotal, discount, discountPct, finalPrice: subtotal - discount };
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PriceEnquiryPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // ── Tab state ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabKey>("enquiry");

  // ── Price Enquiry tab state (existing) ─────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [enquiryList, setEnquiryList] = useState<EnquiryItem[]>([]);
  const [savePhone, setSavePhone] = useState("");
  const [showSaveForm, setShowSaveForm] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);

  // ── Custom Package Builder tab state ───────────────────────────────────────
  const [cpPatientName, setCpPatientName] = useState("");
  const [cpPhone, setCpPhone] = useState("");
  const [cpAge, setCpAge] = useState("");
  const [cpGender, setCpGender] = useState("");
  const [cpSymptoms, setCpSymptoms] = useState("");
  const [cpBudget, setCpBudget] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "ai",
      text: "Hi! Tell me what kind of tests or package the patient needs. You can describe symptoms, mention a budget, or pick a quick prompt below.",
      timestamp: new Date(),
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [quoteState, setQuoteState] = useState<QuoteState>({
    packageName: "",
    tests: [],
    subtotal: 0,
    discount: 0,
    discountPct: 0,
    finalPrice: 0,
    fastingRequired: false,
    targetGender: "ALL",
    notes: "",
  });
  const [createdQuote, setCreatedQuote] = useState<Quote | null>(null);

  // Add test search state
  const [addTestSearch, setAddTestSearch] = useState("");
  const [debouncedAddTestSearch, setDebouncedAddTestSearch] = useState("");
  const [showAddTestDropdown, setShowAddTestDropdown] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const addTestRef = useRef<HTMLDivElement>(null);

  // Current month for recent enquiries
  const currentMonth = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  // ── Debounced search ─────────────────────────────────────────────────────

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Debounced add-test search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedAddTestSearch(addTestSearch), 300);
    return () => clearTimeout(timer);
  }, [addTestSearch]);

  // Scroll chat to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Close add-test dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (addTestRef.current && !addTestRef.current.contains(e.target as Node)) {
        setShowAddTestDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Queries ──────────────────────────────────────────────────────────────

  const searchQuery = useQuery<TestItem[]>({
    queryKey: ["test-catalog-search", debouncedSearch],
    queryFn: async () => {
      const res = await api.get("/test-catalog/search", {
        params: { q: debouncedSearch },
      });
      return res.data?.data ?? res.data;
    },
    enabled: debouncedSearch.length >= 2,
  });

  const searchResults = searchQuery.data ?? [];

  // Add-test catalog search query
  const addTestQuery = useQuery<TestItem[]>({
    queryKey: ["test-catalog-search-addtest", debouncedAddTestSearch],
    queryFn: async () => {
      const res = await api.get("/test-catalog/search", {
        params: { q: debouncedAddTestSearch },
      });
      return res.data?.data ?? res.data;
    },
    enabled: debouncedAddTestSearch.length >= 2 && showAddTestDropdown,
  });

  const addTestResults = addTestQuery.data ?? [];

  const recentEnquiriesQuery = useQuery<{ enquiries: Enquiry[]; totalCount: number; unconverted: number }>({
    queryKey: ["price-enquiries", currentMonth],
    queryFn: async () => {
      const res = await api.get("/front-desk/price-enquiry", {
        params: { month: currentMonth },
      });
      const raw = res.data?.data ?? res.data;
      // API returns { enquiries, totalCount, unconverted }
      if (Array.isArray(raw)) return { enquiries: raw, totalCount: raw.length, unconverted: 0 };
      return { enquiries: raw.enquiries ?? [], totalCount: raw.totalCount ?? 0, unconverted: raw.unconverted ?? 0 };
    },
  });

  const recentEnquiries = recentEnquiriesQuery.data?.enquiries ?? [];
  const unconvertedCount = recentEnquiriesQuery.data?.unconverted ?? 0;

  // ── Mutations (existing) ───────────────────────────────────────────────────

  const saveEnquiry = useMutation({
    mutationFn: async () => {
      const res = await api.post("/front-desk/price-enquiry", {
        phone: savePhone,
        tests: enquiryList.map((t) => ({ testId: t.id, quantity: t.quantity })),
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Enquiry saved");
      queryClient.invalidateQueries({ queryKey: ["price-enquiries"] });
      setShowSaveForm(false);
      setSavePhone("");
    },
    onError: () => toast.error("Failed to save enquiry"),
  });

  const sendWhatsAppPrice = useMutation({
    mutationFn: async () => {
      const items = enquiryList.map((t) => ({
        name: t.name,
        code: t.code,
        price: t.price,
        quantity: t.quantity,
      }));
      const res = await api.post("/notifications/send-whatsapp", {
        type: "PRICE_LIST",
        data: { tests: items, total: totalAmount },
      });
      return res.data;
    },
    onSuccess: () => toast.success("Price list sent via WhatsApp"),
    onError: () => toast.error("Failed to send WhatsApp"),
  });

  // ── Custom Package Mutations ───────────────────────────────────────────────

  const aiChatMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await api.post("/quotes/ai-chat", {
        sessionId: chatSessionId,
        message,
        context: {
          patientAge: cpAge ? Number(cpAge) : undefined,
          patientGender: cpGender || undefined,
          symptoms: cpSymptoms || undefined,
          budget: cpBudget ? Number(cpBudget) : undefined,
        },
      });
      const data = res.data?.data ?? res.data;
      return data;
    },
    onSuccess: (data) => {
      if (data.sessionId) setChatSessionId(data.sessionId);
      setChatMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: "ai",
          text: data.message ?? "Here is my suggestion.",
          timestamp: new Date(),
        },
      ]);
      if (data.suggestion) {
        const suggestion = data.suggestion as AISuggestion;
        const tests: QuoteTest[] = (suggestion.tests ?? []).map((t: AISuggestionTest) => ({
          id: t.id || null,
          code: t.code || "",
          name: t.name || "",
          mrp: t.price ?? 0,
          editedPrice: t.price ?? 0,
          reason: "",
          fastingRequired: suggestion.fastingRequired ?? false,
          inCatalog: !!t.id,
          sampleType: null,
        }));

        const subtotal = tests.reduce((sum, t) => sum + t.editedPrice, 0);
        const suggestedDiscount = suggestion.suggestedPrice
          ? Math.max(0, subtotal - suggestion.suggestedPrice)
          : 0;
        const suggestedDiscountPct = subtotal > 0 ? Math.round((suggestedDiscount / subtotal) * 100) : 0;

        setQuoteState({
          packageName: suggestion.packageName || "",
          tests,
          subtotal,
          discount: suggestedDiscount,
          discountPct: suggestedDiscountPct,
          finalPrice: subtotal - suggestedDiscount,
          fastingRequired: suggestion.fastingRequired ?? false,
          targetGender: suggestion.targetGender || "ALL",
          notes: suggestion.description || suggestion.brochureText || "",
        });
      }
    },
    onError: () => {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          role: "ai",
          text: "Sorry, something went wrong. Please try again.",
          timestamp: new Date(),
        },
      ]);
    },
  });

  const createQuoteMutation = useMutation({
    mutationFn: async () => {
      if (quoteState.tests.length === 0) throw new Error("No tests in quote");
      const testIds = quoteState.tests.map((t) => t.id).filter(Boolean);
      const testNames = quoteState.tests.map((t) => t.name);
      const res = await api.post("/quotes", {
        patientName: cpPatientName,
        patientPhone: cpPhone,
        patientAge: cpAge ? Number(cpAge) : undefined,
        patientGender: cpGender || undefined,
        symptoms: cpSymptoms || undefined,
        testIds: JSON.stringify(testIds),
        testNames: JSON.stringify(testNames),
        subtotal: quoteState.subtotal,
        discountAmt: quoteState.discount,
        discountPct: quoteState.discountPct,
      });
      const data = res.data?.data ?? res.data;
      return data as Quote;
    },
    onSuccess: (data) => {
      setCreatedQuote(data);
      toast.success("Quote created successfully");
    },
    onError: () => toast.error("Failed to create quote"),
  });

  const saveAsPackageMutation = useMutation({
    mutationFn: async () => {
      if (!createdQuote) throw new Error("No quote");
      const res = await api.post(`/quotes/${createdQuote.id}/save-as-package`, {
        name: quoteState.packageName || "Custom Package",
      });
      return res.data?.data ?? res.data;
    },
    onSuccess: () => toast.success("Saved as permanent package"),
    onError: () => toast.error("Failed to save as package"),
  });

  // ── Enquiry list logic (existing) ──────────────────────────────────────────

  const addToEnquiry = useCallback((test: TestItem) => {
    setEnquiryList((prev) => {
      const existing = prev.find((t) => t.id === test.id);
      if (existing) {
        return prev.map((t) => (t.id === test.id ? { ...t, quantity: t.quantity + 1 } : t));
      }
      return [...prev, { ...test, quantity: 1 }];
    });
  }, []);

  const removeFromEnquiry = useCallback((testId: string) => {
    setEnquiryList((prev) => prev.filter((t) => t.id !== testId));
  }, []);

  const updateQuantity = useCallback((testId: string, delta: number) => {
    setEnquiryList((prev) =>
      prev
        .map((t) => (t.id === testId ? { ...t, quantity: Math.max(0, t.quantity + delta) } : t))
        .filter((t) => t.quantity > 0)
    );
  }, []);

  const totalAmount = useMemo(() => enquiryList.reduce((sum, t) => sum + t.price * t.quantity, 0), [enquiryList]);

  const handleConvertToRegistration = () => {
    const testIds = enquiryList.map((t) => t.id).join(",");
    router.push(`/registration?testIds=${testIds}`);
  };

  const handlePrint = () => {
    window.print();
  };

  const isInEnquiry = useCallback(
    (testId: string) => enquiryList.some((t) => t.id === testId),
    [enquiryList]
  );

  // ── Custom Package helpers ─────────────────────────────────────────────────

  const handleSendChat = useCallback(() => {
    const msg = chatInput.trim();
    if (!msg) return;
    setChatMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: "user", text: msg, timestamp: new Date() },
    ]);
    setChatInput("");
    aiChatMutation.mutate(msg);
  }, [chatInput, aiChatMutation]);

  const handleQuickPrompt = useCallback(
    (prompt: string) => {
      setChatInput("");
      setChatMessages((prev) => [
        ...prev,
        { id: `user-${Date.now()}`, role: "user", text: prompt, timestamp: new Date() },
      ]);
      aiChatMutation.mutate(prompt);
    },
    [aiChatMutation]
  );

  const handleAddTestFromCatalog = useCallback((test: TestItem) => {
    setQuoteState((prev) => {
      const exists = prev.tests.some((t) => t.id === test.id);
      if (exists) {
        toast.warning(`${test.name} is already in the quote`);
        return prev;
      }
      const newTest: QuoteTest = {
        id: test.id,
        code: test.code,
        name: test.name,
        mrp: test.price,
        editedPrice: test.price,
        reason: "",
        fastingRequired: false,
        inCatalog: true,
        sampleType: test.sampleType || null,
      };
      const newTests = [...prev.tests, newTest];
      const calc = recalcQuote(newTests, prev.discountPct);
      return { ...prev, tests: newTests, ...calc };
    });
    setAddTestSearch("");
    setShowAddTestDropdown(false);
    toast.success(`Added ${test.name}`);
  }, []);

  const handleRemoveTest = useCallback((index: number) => {
    setQuoteState((prev) => {
      const newTests = prev.tests.filter((_, i) => i !== index);
      const calc = recalcQuote(newTests, prev.discountPct);
      return { ...prev, tests: newTests, ...calc };
    });
  }, []);

  const handleEditTestPrice = useCallback((index: number, newPrice: number) => {
    setQuoteState((prev) => {
      const newTests = prev.tests.map((t, i) =>
        i === index ? { ...t, editedPrice: Math.max(0, newPrice) } : t
      );
      const calc = recalcQuote(newTests, prev.discountPct);
      return { ...prev, tests: newTests, ...calc };
    });
  }, []);

  const handleDiscountPctChange = useCallback((pct: number) => {
    const clampedPct = Math.max(0, Math.min(100, pct));
    setQuoteState((prev) => {
      const calc = recalcQuote(prev.tests, clampedPct);
      return { ...prev, ...calc };
    });
  }, []);

  const handleDiscountAmtChange = useCallback((amt: number) => {
    setQuoteState((prev) => {
      const clampedAmt = Math.max(0, Math.min(prev.subtotal, amt));
      const pct = prev.subtotal > 0 ? Math.round((clampedAmt / prev.subtotal) * 100) : 0;
      return {
        ...prev,
        discount: clampedAmt,
        discountPct: pct,
        finalPrice: prev.subtotal - clampedAmt,
      };
    });
  }, []);

  const handleWhatsAppQuote = useCallback(() => {
    const lines = quoteState.tests.map(
      (t) => `- ${t.name}: ${formatCurrency(t.editedPrice)}`
    );
    const message = [
      quoteState.packageName ? `Package: ${quoteState.packageName}` : "Quote",
      cpPatientName ? `Patient: ${cpPatientName}` : null,
      "",
      "Tests:",
      ...lines,
      "",
      `Subtotal: ${formatCurrency(quoteState.subtotal)}`,
      quoteState.discount > 0 ? `Discount (${quoteState.discountPct}%): -${formatCurrency(quoteState.discount)}` : null,
      `Total: ${formatCurrency(quoteState.finalPrice)}`,
      "",
      quoteState.fastingRequired ? "Note: Fasting (8-12 hours) required for some tests." : null,
    ]
      .filter(Boolean)
      .join("\n");

    const phone = cpPhone.replace(/[^0-9]/g, "");
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  }, [quoteState, cpPatientName, cpPhone]);

  const handleRegisterPatient = useCallback(() => {
    const testIds = quoteState.tests.map((t) => t.id).filter(Boolean).join(",");
    const params = new URLSearchParams();
    if (cpPatientName) params.set("name", cpPatientName);
    if (cpPhone) params.set("phone", cpPhone);
    if (cpAge) params.set("age", cpAge);
    if (cpGender) params.set("gender", cpGender);
    if (testIds) params.set("testIds", testIds);
    if (quoteState.packageName) params.set("packageName", quoteState.packageName);
    if (quoteState.discount > 0) params.set("discountAmt", String(quoteState.discount));
    router.push(`/registration?${params.toString()}`);
  }, [quoteState, cpPatientName, cpPhone, cpAge, cpGender, router]);

  const QUICK_PROMPTS = [
    "General health check",
    "Diabetes follow-up",
    "Tiredness/Weakness",
    "Hair fall",
    "Pre-marriage screen",
    "Senior citizen",
    "Child health",
    "Heart check",
  ];

  const hasTests = quoteState.tests.length > 0;
  const anyFasting = quoteState.fastingRequired || quoteState.tests.some((t) => t.fastingRequired);
  const patientSaves = quoteState.subtotal - quoteState.finalPrice;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Price Enquiry &amp; Custom Package</h1>
        <p className="mt-1 text-sm text-slate-500">
          Search tests, build a price list, and share with patients
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("enquiry")}
          className={cn(
            "px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
            activeTab === "enquiry"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
          )}
        >
          <Search className="h-4 w-4 inline mr-1.5 -mt-0.5" />
          Price Enquiry
        </button>
        <button
          onClick={() => setActiveTab("package")}
          className={cn(
            "px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
            activeTab === "package"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
          )}
        >
          <Package className="h-4 w-4 inline mr-1.5 -mt-0.5" />
          Custom Package Builder
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: Price Enquiry (existing) */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "enquiry" && (
        <>
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search tests by name, code, or department..."
              className="w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-12 pr-4 text-sm shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            {searchTerm && (
              <button
                onClick={() => { setSearchTerm(""); searchRef.current?.focus(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 hover:bg-slate-100"
              >
                <X className="h-4 w-4 text-slate-400" />
              </button>
            )}
          </div>

          {/* Main layout: results + right panel */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Search Results */}
            <div className="lg:col-span-2 space-y-4">
              {searchQuery.isLoading && debouncedSearch.length >= 2 ? (
                <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-16 shadow-sm">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  <span className="ml-2 text-sm text-slate-500">Searching...</span>
                </div>
              ) : searchQuery.isError ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-16 shadow-sm">
                  <AlertTriangle className="h-8 w-8 text-red-400" />
                  <p className="mt-2 text-sm text-slate-600">Search failed. Please try again.</p>
                </div>
              ) : debouncedSearch.length < 2 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-16 shadow-sm">
                  <Search className="h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-sm text-slate-500">Type at least 2 characters to search</p>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-16 shadow-sm">
                  <TestTube2 className="h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-sm text-slate-500">No tests found for &quot;{debouncedSearch}&quot;</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500">{searchResults.length} results</p>
                  {searchResults.map((test) => (
                    <div
                      key={test.id}
                      className="flex items-start justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-slate-900">{test.name}</h3>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500 font-mono">
                            {test.code}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <IndianRupee className="h-3 w-3" />
                            <span className="font-semibold text-slate-900">{formatCurrency(test.price)}</span>
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <TestTube2 className="h-3 w-3" />
                            {test.sampleType}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            TAT: {test.tat}
                          </span>
                          {test.department && (
                            <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700 font-medium">
                              {test.department}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => addToEnquiry(test)}
                        className={cn(
                          "ml-3 flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                          isInEnquiry(test.id)
                            ? "bg-green-50 text-green-700 hover:bg-green-100"
                            : "bg-blue-600 text-white hover:bg-blue-700"
                        )}
                      >
                        <Plus className="h-3.5 w-3.5 inline mr-1" />
                        {isInEnquiry(test.id) ? "Added" : "Add"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right panel: Enquiry List */}
            <div className="lg:col-span-1">
              <div className="sticky top-4 rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4 text-blue-600" />
                      Enquiry List
                    </h2>
                    {enquiryList.length > 0 && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                        {enquiryList.length}
                      </span>
                    )}
                  </div>
                </div>

                {enquiryList.length === 0 ? (
                  <div className="px-4 py-10 text-center">
                    <FileText className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-2 text-xs text-slate-400">Add tests from search results</p>
                  </div>
                ) : (
                  <>
                    <div className="max-h-[400px] overflow-y-auto divide-y divide-slate-100">
                      {enquiryList.map((item) => (
                        <div key={item.id} className="px-4 py-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">{item.name}</p>
                              <p className="text-xs text-slate-500">{formatCurrency(item.price)} each</p>
                            </div>
                            <button
                              onClick={() => removeFromEnquiry(item.id)}
                              className="ml-2 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => updateQuantity(item.id, -1)}
                                className="rounded-md border border-slate-200 p-1 hover:bg-slate-50"
                              >
                                <Minus className="h-3 w-3 text-slate-600" />
                              </button>
                              <span className="min-w-[20px] text-center text-sm font-medium text-slate-900">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => updateQuantity(item.id, 1)}
                                className="rounded-md border border-slate-200 p-1 hover:bg-slate-50"
                              >
                                <Plus className="h-3 w-3 text-slate-600" />
                              </button>
                            </div>
                            <span className="text-sm font-semibold text-slate-900">
                              {formatCurrency(item.price * item.quantity)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Total */}
                    <div className="border-t border-slate-200 px-4 py-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-600">Total</span>
                        <span className="text-lg font-bold text-slate-900">{formatCurrency(totalAmount)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="border-t border-slate-100 px-4 py-3 space-y-2">
                      <button
                        onClick={() => sendWhatsAppPrice.mutate()}
                        disabled={sendWhatsAppPrice.isPending}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        {sendWhatsAppPrice.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <MessageCircle className="h-4 w-4" />
                        )}
                        WhatsApp Price List
                      </button>

                      <button
                        onClick={handlePrint}
                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <Printer className="h-4 w-4" />
                        Print Price List
                      </button>

                      <button
                        onClick={handleConvertToRegistration}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                      >
                        <ArrowRight className="h-4 w-4" />
                        Convert to Registration
                      </button>

                      {/* Save enquiry */}
                      {!showSaveForm ? (
                        <button
                          onClick={() => setShowSaveForm(true)}
                          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 hover:border-slate-400 transition-colors"
                        >
                          <Save className="h-4 w-4" />
                          Log Enquiry
                        </button>
                      ) : (
                        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <div className="relative">
                            <Phone className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                              type="tel"
                              value={savePhone}
                              onChange={(e) => setSavePhone(e.target.value)}
                              placeholder="Patient phone number"
                              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => { setShowSaveForm(false); setSavePhone(""); }}
                              className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-white transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => saveEnquiry.mutate()}
                              disabled={!savePhone || saveEnquiry.isPending}
                              className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                              {saveEnquiry.isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Save className="h-3 w-3" />
                              )}
                              Save
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Recent Enquiries */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                Recent Enquiries
                {unconvertedCount > 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                    {unconvertedCount} unconverted
                  </span>
                )}
              </h2>
              <button
                onClick={() => queryClient.invalidateQueries({ queryKey: ["price-enquiries"] })}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>

            {recentEnquiriesQuery.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : recentEnquiriesQuery.isError ? (
              <div className="flex flex-col items-center justify-center py-12">
                <AlertTriangle className="h-8 w-8 text-red-400" />
                <p className="mt-2 text-sm text-slate-500">Failed to load enquiries</p>
              </div>
            ) : recentEnquiries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <FileText className="h-8 w-8 text-slate-300" />
                <p className="mt-2 text-sm text-slate-400">No enquiries this month</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="px-5 py-2.5 font-medium text-slate-600">Phone</th>
                      <th className="px-5 py-2.5 font-medium text-slate-600">Tests</th>
                      <th className="px-5 py-2.5 font-medium text-slate-600">Total</th>
                      <th className="px-5 py-2.5 font-medium text-slate-600">Status</th>
                      <th className="px-5 py-2.5 font-medium text-slate-600">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentEnquiries.map((enq) => (
                      <tr key={enq.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3 font-medium text-slate-900">{enq.phone}</td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap gap-1">
                            {enq.tests.slice(0, 2).map((t, i) => (
                              <span key={i} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                                {t.name}
                              </span>
                            ))}
                            {enq.tests.length > 2 && (
                              <span className="text-xs text-slate-400">+{enq.tests.length - 2}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3 font-medium text-slate-900">{formatCurrency(enq.total)}</td>
                        <td className="px-5 py-3">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-xs font-medium",
                              enq.converted
                                ? "bg-green-50 text-green-700"
                                : "bg-amber-50 text-amber-700"
                            )}
                          >
                            {enq.converted ? "Converted" : "Pending"}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-slate-500">
                          {new Date(enq.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: Custom Package Builder */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "package" && (
        <>
          {/* Patient Context Bar */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              Patient Context
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Patient Name</label>
                <input
                  type="text"
                  value={cpPatientName}
                  onChange={(e) => setCpPatientName(e.target.value)}
                  placeholder="Full name"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
                <div className="relative">
                  <Phone className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    value={cpPhone}
                    onChange={(e) => setCpPhone(e.target.value)}
                    placeholder="+91..."
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Age</label>
                  <input
                    type="number"
                    value={cpAge}
                    onChange={(e) => setCpAge(e.target.value)}
                    placeholder="Age"
                    min={0}
                    max={150}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Gender</label>
                  <select
                    value={cpGender}
                    onChange={(e) => setCpGender(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select</option>
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Symptoms</label>
                <textarea
                  value={cpSymptoms}
                  onChange={(e) => setCpSymptoms(e.target.value)}
                  placeholder="Describe symptoms..."
                  rows={1}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Budget (optional)</label>
                <div className="relative">
                  <IndianRupee className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="number"
                    value={cpBudget}
                    onChange={(e) => setCpBudget(e.target.value)}
                    placeholder="Max budget"
                    min={0}
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* AI Chat + Quote Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-20 gap-6">
            {/* AI Chat — left 11 cols */}
            <div className="lg:col-span-11">
              <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm" style={{ height: "520px" }}>
                {/* Chat header */}
                <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100">
                    <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                  </div>
                  <h2 className="text-sm font-semibold text-slate-900">AI Package Assistant</h2>
                  {aiChatMutation.isPending && (
                    <Loader2 className="ml-auto h-4 w-4 animate-spin text-blue-500" />
                  )}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                  {chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex",
                        msg.role === "user" ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "flex items-start gap-2 max-w-[85%]",
                          msg.role === "user" ? "flex-row-reverse" : "flex-row"
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full",
                            msg.role === "user"
                              ? "bg-slate-200"
                              : "bg-blue-100"
                          )}
                        >
                          {msg.role === "user" ? (
                            <User className="h-3 w-3 text-slate-600" />
                          ) : (
                            <Bot className="h-3 w-3 text-blue-600" />
                          )}
                        </div>
                        <div
                          className={cn(
                            "rounded-xl px-3.5 py-2 text-sm leading-relaxed",
                            msg.role === "user"
                              ? "bg-blue-600 text-white"
                              : "bg-slate-100 text-slate-800"
                          )}
                        >
                          {msg.text}
                        </div>
                      </div>
                    </div>
                  ))}
                  {/* Typing indicator */}
                  {aiChatMutation.isPending && (
                    <div className="flex justify-start">
                      <div className="flex items-start gap-2">
                        <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100">
                          <Bot className="h-3 w-3 text-blue-600" />
                        </div>
                        <div className="rounded-xl bg-slate-100 px-4 py-2.5">
                          <div className="flex gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Quick prompt chips */}
                {chatMessages.length <= 2 && (
                  <div className="border-t border-slate-100 px-4 py-2">
                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_PROMPTS.map((prompt) => (
                        <button
                          key={prompt}
                          onClick={() => handleQuickPrompt(prompt)}
                          disabled={aiChatMutation.isPending}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 transition-colors"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Input bar */}
                <div className="border-t border-slate-200 px-4 py-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendChat();
                        }
                      }}
                      placeholder="Describe what the patient needs..."
                      disabled={aiChatMutation.isPending}
                      className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                    />
                    <button
                      onClick={handleSendChat}
                      disabled={!chatInput.trim() || aiChatMutation.isPending}
                      className="flex items-center justify-center rounded-lg bg-blue-600 px-3.5 py-2 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {aiChatMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Quote Panel — right 9 cols */}
            <div className="lg:col-span-9">
              <div className="sticky top-4 rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-4 py-3">
                  <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-600" />
                    Quote Panel
                    {hasTests && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                        {quoteState.tests.length} tests
                      </span>
                    )}
                  </h2>
                </div>

                {/* Empty state */}
                {!hasTests ? (
                  <div className="px-4 py-12 text-center">
                    <Package className="mx-auto h-10 w-10 text-slate-300" />
                    <p className="mt-3 text-sm text-slate-400">
                      Chat with AI or add tests manually
                    </p>
                    <div className="mt-4" ref={addTestRef}>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={addTestSearch}
                          onChange={(e) => {
                            setAddTestSearch(e.target.value);
                            setShowAddTestDropdown(true);
                          }}
                          onFocus={() => setShowAddTestDropdown(true)}
                          placeholder="Search tests to add..."
                          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        {showAddTestDropdown && debouncedAddTestSearch.length >= 2 && (
                          <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg max-h-[200px] overflow-y-auto">
                            {addTestQuery.isLoading ? (
                              <div className="flex items-center justify-center py-4">
                                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                              </div>
                            ) : addTestResults.length === 0 ? (
                              <p className="px-3 py-3 text-xs text-slate-400">No tests found</p>
                            ) : (
                              (addTestResults ?? []).map((test) => (
                                <button
                                  key={test.id}
                                  onClick={() => handleAddTestFromCatalog(test)}
                                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 transition-colors"
                                >
                                  <div className="min-w-0 flex-1">
                                    <span className="font-medium text-slate-800 truncate block">{test.name}</span>
                                    <span className="text-xs text-slate-400">{test.code}</span>
                                  </div>
                                  <span className="ml-2 text-xs font-medium text-slate-600">{formatCurrency(test.price)}</span>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {/* Package name */}
                    <div className="px-4 py-3">
                      <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Package Name</label>
                      <input
                        type="text"
                        value={quoteState.packageName}
                        onChange={(e) => setQuoteState((prev) => ({ ...prev, packageName: e.target.value }))}
                        placeholder="Custom Package"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    {/* Add test button with search */}
                    <div className="px-4 py-2" ref={addTestRef}>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={addTestSearch}
                          onChange={(e) => {
                            setAddTestSearch(e.target.value);
                            setShowAddTestDropdown(true);
                          }}
                          onFocus={() => setShowAddTestDropdown(true)}
                          placeholder="+ Add test..."
                          className="w-full rounded-lg border border-dashed border-slate-300 bg-slate-50 py-1.5 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        {showAddTestDropdown && debouncedAddTestSearch.length >= 2 && (
                          <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg max-h-[200px] overflow-y-auto">
                            {addTestQuery.isLoading ? (
                              <div className="flex items-center justify-center py-4">
                                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                              </div>
                            ) : addTestResults.length === 0 ? (
                              <p className="px-3 py-3 text-xs text-slate-400">No tests found</p>
                            ) : (
                              (addTestResults ?? []).map((test) => (
                                <button
                                  key={test.id}
                                  onClick={() => handleAddTestFromCatalog(test)}
                                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 transition-colors"
                                >
                                  <div className="min-w-0 flex-1">
                                    <span className="font-medium text-slate-800 truncate block">{test.name}</span>
                                    <span className="text-xs text-slate-400">{test.code}</span>
                                  </div>
                                  <span className="ml-2 text-xs font-medium text-slate-600">{formatCurrency(test.price)}</span>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Tests table */}
                    <div className="px-4 py-3">
                      <div className="space-y-0 max-h-[220px] overflow-y-auto">
                        <div className="grid grid-cols-12 gap-2 text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1.5 px-1">
                          <span className="col-span-5">Test</span>
                          <span className="col-span-2 text-right">MRP</span>
                          <span className="col-span-3 text-right">Price</span>
                          <span className="col-span-2" />
                        </div>
                        {(quoteState.tests ?? []).map((test, idx) => (
                          <div
                            key={`${test.id ?? test.name}-${idx}`}
                            className="grid grid-cols-12 gap-2 items-center py-1.5 px-1 rounded hover:bg-slate-50 group transition-colors"
                          >
                            <div className="col-span-5 min-w-0">
                              <p className="text-sm font-medium text-slate-800 truncate">{test.name}</p>
                              <div className="flex items-center gap-1">
                                {test.code && (
                                  <span className="text-[10px] text-slate-400 font-mono">{test.code}</span>
                                )}
                                {test.fastingRequired && (
                                  <span className="rounded bg-amber-50 px-1 py-0.5 text-[9px] font-medium text-amber-700">
                                    Fasting
                                  </span>
                                )}
                              </div>
                              {test.reason && (
                                <p className="text-[10px] text-slate-400 mt-0.5 flex items-start gap-0.5">
                                  <Info className="h-2.5 w-2.5 flex-shrink-0 mt-0.5" />
                                  {test.reason}
                                </p>
                              )}
                            </div>
                            <div className="col-span-2 text-right">
                              <span className="text-xs text-slate-400">{formatCurrency(test.mrp)}</span>
                            </div>
                            <div className="col-span-3">
                              <input
                                type="number"
                                value={test.editedPrice}
                                onChange={(e) => handleEditTestPrice(idx, Number(e.target.value))}
                                min={0}
                                className="w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-right text-sm font-medium text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                            <div className="col-span-2 flex justify-end">
                              <button
                                onClick={() => handleRemoveTest(idx)}
                                className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Pricing section */}
                    <div className="px-4 py-3 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Subtotal</span>
                        <span className="font-medium text-slate-900">{formatCurrency(quoteState.subtotal)}</span>
                      </div>

                      {/* Discount % and amount — synced both ways */}
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1.5">
                          <Percent className="h-3.5 w-3.5 text-slate-400" />
                          <span className="text-slate-500">Discount</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={quoteState.discountPct || ""}
                            onChange={(e) => handleDiscountPctChange(Number(e.target.value))}
                            placeholder="0"
                            min={0}
                            max={100}
                            className="w-14 rounded border border-slate-200 bg-white px-1.5 py-1 text-right text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <span className="text-xs text-slate-400">%</span>
                          <span className="text-slate-300">|</span>
                          <IndianRupee className="h-3 w-3 text-slate-400" />
                          <input
                            type="number"
                            value={quoteState.discount || ""}
                            onChange={(e) => handleDiscountAmtChange(Number(e.target.value))}
                            placeholder="0"
                            min={0}
                            className="w-16 rounded border border-slate-200 bg-white px-1.5 py-1 text-right text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                        <span className="text-sm font-semibold text-slate-700">Final Price</span>
                        <span className="text-lg font-bold text-slate-900">{formatCurrency(quoteState.finalPrice)}</span>
                      </div>

                      {patientSaves > 0 && (
                        <p className="text-xs text-green-600 text-right font-medium">
                          Patient saves {formatCurrency(patientSaves)}
                        </p>
                      )}
                    </div>

                    {/* Fasting warning banner */}
                    {anyFasting && (
                      <div className="px-4 py-2.5 bg-amber-50/80">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-800">
                            Some tests require fasting (8-12 hours). Advise the patient accordingly.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="px-4 py-3 space-y-2">
                      {/* Build Quote (before quote is created) */}
                      {!createdQuote && (
                        <button
                          onClick={() => createQuoteMutation.mutate()}
                          disabled={createQuoteMutation.isPending || !cpPatientName || !cpPhone}
                          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                          {createQuoteMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <FileText className="h-4 w-4" />
                          )}
                          Build Quote
                        </button>
                      )}
                      {!createdQuote && (!cpPatientName || !cpPhone) && (
                        <p className="text-xs text-center text-amber-600">
                          Fill in patient name and phone to build quote
                        </p>
                      )}

                      {/* Quote number badge */}
                      {createdQuote && (
                        <div className="rounded-lg bg-blue-50 px-3 py-2 text-center">
                          <p className="text-xs text-blue-700 font-medium">
                            Quote #{createdQuote.quoteNumber ?? createdQuote.id.slice(0, 8)}
                          </p>
                        </div>
                      )}

                      {/* WhatsApp Quote */}
                      {createdQuote && (
                        <button
                          onClick={handleWhatsAppQuote}
                          disabled={!cpPhone}
                          className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                          <MessageCircle className="h-4 w-4" />
                          WhatsApp Quote
                        </button>
                      )}

                      {/* Print Quote */}
                      {createdQuote && (
                        <button
                          onClick={handlePrint}
                          className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <Printer className="h-4 w-4" />
                          Print Quote
                        </button>
                      )}

                      {/* Register Patient -> Billing */}
                      {createdQuote && (
                        <button
                          onClick={handleRegisterPatient}
                          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                        >
                          <ArrowRight className="h-4 w-4" />
                          Register Patient &rarr; Billing
                        </button>
                      )}

                      {/* Save as Package */}
                      {createdQuote && (
                        <button
                          onClick={() => saveAsPackageMutation.mutate()}
                          disabled={saveAsPackageMutation.isPending}
                          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 hover:border-slate-400 disabled:opacity-50 transition-colors"
                        >
                          {saveAsPackageMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                          Save as Package
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
