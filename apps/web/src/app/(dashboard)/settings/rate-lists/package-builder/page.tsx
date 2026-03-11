"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Search,
  Filter,
  Star,
  Edit,
  Power,
  Copy,
  X,
  Send,
  Bot,
  User,
  ChevronDown,
  ChevronUp,
  Loader2,
  Package,
  Sparkles,
  Wrench,
  AlertTriangle,
  Beaker,
  Calendar,
  Tag,
  Heart,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { formatCurrency, cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface LabPackage {
  id: string;
  name: string;
  code: string | null;
  category: string | null;
  description: string | null;
  testIds: string[];
  tests?: TestItem[];
  mrpPrice: number;
  offerPrice: number | null;
  corporatePrice: number | null;
  validFrom: string | null;
  validTo: string | null;
  isActive: boolean;
  isFeatured: boolean;
  targetGender: string | null;
  targetAgeMin: number | null;
  targetAgeMax: number | null;
  prepInstructions: string | null;
  fastingRequired: boolean;
  brochureText: string | null;
}

interface TestItem {
  id: string;
  name: string;
  code: string;
  price: number;
  sampleType: string | null;
  department: string | null;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  suggestion?: AISuggestion | null;
  isFinalized?: boolean;
}

interface AISuggestion {
  name: string;
  category: string;
  targetGender: string;
  targetAgeMin: number | null;
  targetAgeMax: number | null;
  tests: TestItem[];
  mrpPrice: number;
  offerPrice: number;
  corporatePrice?: number;
  brochureText?: string;
}

const CATEGORIES = ["PREVENTIVE", "CORPORATE", "WELLNESS", "DISEASE", "CUSTOM"] as const;
const GENDERS = ["ALL", "MALE", "FEMALE"] as const;

const CATEGORY_COLORS: Record<string, string> = {
  PREVENTIVE: "bg-green-500/20 text-green-400",
  CORPORATE: "bg-blue-500/20 text-blue-400",
  WELLNESS: "bg-purple-500/20 text-purple-400",
  DISEASE: "bg-red-500/20 text-red-400",
  CUSTOM: "bg-amber-500/20 text-amber-400",
};

const GENDER_COLORS: Record<string, string> = {
  ALL: "bg-slate-500/20 text-slate-700",
  MALE: "bg-cyan-500/20 text-cyan-400",
  FEMALE: "bg-pink-500/20 text-pink-400",
};

const QUICK_PROMPTS = [
  "Diabetes package",
  "Heart health",
  "Senior wellness",
  "Child health",
  "Pre-employment",
  "Women's fertility",
  "Liver/kidney screen",
];

// ── Main Page ────────────────────────────────────────────────────────────────

export default function PackageBuilderPage() {
  const qc = useQueryClient();

  // Left panel state
  const [filterCategory, setFilterCategory] = useState("");
  const [filterGender, setFilterGender] = useState("");
  const [filterActive, setFilterActive] = useState<"" | "true" | "false">("");
  const [searchQuery, setSearchQuery] = useState("");

  // Right panel state
  const [activeTab, setActiveTab] = useState<"ai" | "manual">("ai");
  const [editingPackage, setEditingPackage] = useState<LabPackage | null>(null);

  // ── Packages Query ──────────────────────────────────────────────────────────

  const { data: packages = [], isLoading, isError } = useQuery<LabPackage[]>({
    queryKey: ["lab-packages", filterCategory, filterGender, filterActive, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterCategory) params.set("category", filterCategory);
      if (filterGender) params.set("gender", filterGender);
      if (filterActive) params.set("active", filterActive);
      if (searchQuery) params.set("search", searchQuery);
      const res = await api.get(`/lab-packages?${params.toString()}`);
      const data = res.data?.data ?? res.data;
      return Array.isArray(data) ? data : [];
    },
  });

  // ── Toggle Active ───────────────────────────────────────────────────────────

  const toggleMut = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/lab-packages/${id}/toggle`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lab-packages"] });
      toast.success("Package status toggled");
    },
    onError: () => toast.error("Failed to toggle package"),
  });

  // ── Duplicate ───────────────────────────────────────────────────────────────

  const duplicateMut = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/lab-packages/${id}/duplicate`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lab-packages"] });
      toast.success("Package duplicated");
    },
    onError: () => toast.error("Failed to duplicate package"),
  });

  const handleEdit = (pkg: LabPackage) => {
    setEditingPackage(pkg);
    setActiveTab("manual");
  };

  return (
    <div className="min-h-[calc(100vh-120px)] flex gap-4">
      {/* ── LEFT PANEL (40%) ──────────────────────────────────────────────── */}
      <div className="w-[40%] flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Packages</h2>
            <button
              onClick={() => {
                setEditingPackage(null);
                setActiveTab("manual");
              }}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Package
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search packages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="flex-1 px-2 py-1.5 bg-slate-100 border border-slate-300 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select
              value={filterGender}
              onChange={(e) => setFilterGender(e.target.value)}
              className="flex-1 px-2 py-1.5 bg-slate-100 border border-slate-300 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="">All Genders</option>
              {GENDERS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            <select
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value as "" | "true" | "false")}
              className="flex-1 px-2 py-1.5 bg-slate-100 border border-slate-300 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        </div>

        {/* Package List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {isLoading ? (
            <LoadingSkeleton />
          ) : isError ? (
            <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Failed to load packages. Please try again.
            </div>
          ) : packages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Package className="h-10 w-10 mb-3 text-slate-600" />
              <p className="text-sm font-medium">No packages found</p>
              <p className="text-xs mt-1">Create your first package or adjust filters</p>
            </div>
          ) : (
            packages.map((pkg) => (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                onEdit={() => handleEdit(pkg)}
                onToggle={() => toggleMut.mutate(pkg.id)}
                onDuplicate={() => duplicateMut.mutate(pkg.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL (60%) ─────────────────────────────────────────────── */}
      <div className="w-[60%] flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab("ai")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors",
              activeTab === "ai"
                ? "text-blue-400 border-b-2 border-blue-400 bg-blue-500/5"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Sparkles className="h-4 w-4" />
            AI Builder
          </button>
          <button
            onClick={() => setActiveTab("manual")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors",
              activeTab === "manual"
                ? "text-blue-400 border-b-2 border-blue-400 bg-blue-500/5"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Wrench className="h-4 w-4" />
            Manual Builder
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === "ai" ? (
            <AIBuilderTab onPackageSaved={() => qc.invalidateQueries({ queryKey: ["lab-packages"] })} />
          ) : (
            <ManualBuilderTab
              editingPackage={editingPackage}
              onPackageSaved={() => {
                qc.invalidateQueries({ queryKey: ["lab-packages"] });
                setEditingPackage(null);
              }}
              onCancel={() => setEditingPackage(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Package Card ──────────────────────────────────────────────────────────────

function PackageCard({
  pkg,
  onEdit,
  onToggle,
  onDuplicate,
}: {
  pkg: LabPackage;
  onEdit: () => void;
  onToggle: () => void;
  onDuplicate: () => void;
}) {
  const testsCount = pkg.tests?.length ?? pkg.testIds?.length ?? 0;
  const savings = pkg.offerPrice ? pkg.mrpPrice - pkg.offerPrice : 0;

  return (
    <div
      className={cn(
        "p-3 rounded-lg border transition-colors",
        pkg.isActive
          ? "bg-slate-100/50 border-slate-300 hover:border-slate-600"
          : "bg-slate-50 border-slate-200 opacity-60"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {pkg.isFeatured && <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400 shrink-0" />}
            <h3 className="text-sm font-medium text-slate-900 truncate">{pkg.name}</h3>
          </div>
          {pkg.code && <p className="text-xs text-slate-500 mt-0.5">{pkg.code}</p>}
        </div>
        <div className="flex items-center gap-1">
          {pkg.category && (
            <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", CATEGORY_COLORS[pkg.category] ?? "bg-slate-600/30 text-slate-500")}>
              {pkg.category}
            </span>
          )}
          {pkg.targetGender && pkg.targetGender !== "ALL" && (
            <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", GENDER_COLORS[pkg.targetGender] ?? "bg-slate-600/30 text-slate-500")}>
              {pkg.targetGender}
            </span>
          )}
        </div>
      </div>

      {(pkg.targetAgeMin != null || pkg.targetAgeMax != null) && (
        <p className="text-[11px] text-slate-500 mt-1">
          Age: {pkg.targetAgeMin ?? 0} - {pkg.targetAgeMax ?? "99+"}
        </p>
      )}

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-300/50">
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">
            <Beaker className="h-3 w-3 inline mr-1" />
            {testsCount} tests
          </span>
          <div className="flex items-baseline gap-1.5">
            {pkg.offerPrice && pkg.offerPrice < pkg.mrpPrice ? (
              <>
                <span className="text-xs text-slate-500 line-through">{formatCurrency(pkg.mrpPrice)}</span>
                <span className="text-sm font-semibold text-green-400">{formatCurrency(pkg.offerPrice)}</span>
                {savings > 0 && (
                  <span className="text-[10px] text-green-500">Save {formatCurrency(savings)}</span>
                )}
              </>
            ) : (
              <span className="text-sm font-semibold text-slate-900">{formatCurrency(pkg.mrpPrice)}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="p-1.5 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition-colors" title="Edit">
            <Edit className="h-3.5 w-3.5" />
          </button>
          <button onClick={onToggle} className="p-1.5 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition-colors" title={pkg.isActive ? "Deactivate" : "Activate"}>
            <Power className="h-3.5 w-3.5" />
          </button>
          <button onClick={onDuplicate} className="p-1.5 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition-colors" title="Duplicate">
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Loading Skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="p-3 rounded-lg border border-slate-200 animate-pulse">
          <div className="flex items-center gap-2">
            <div className="h-4 w-32 bg-slate-200 rounded" />
            <div className="h-4 w-16 bg-slate-200 rounded" />
          </div>
          <div className="flex items-center gap-3 mt-3">
            <div className="h-3 w-16 bg-slate-200 rounded" />
            <div className="h-4 w-20 bg-slate-200 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── AI Builder Tab ────────────────────────────────────────────────────────────

function AIBuilderTab({ onPackageSaved }: { onPackageSaved: () => void }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello! I'm your AI Package Builder. Tell me what kind of health check package you'd like to create. You can describe symptoms, target demographics, budget, or just pick a quick prompt below.",
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [contextOpen, setContextOpen] = useState(true);
  const [targetGender, setTargetGender] = useState("ALL");
  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");
  const [budget, setBudget] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null);
  const [previewName, setPreviewName] = useState("");
  const [previewCategory, setPreviewCategory] = useState("WELLNESS");
  const [previewGender, setPreviewGender] = useState("ALL");
  const [previewAgeMin, setPreviewAgeMin] = useState("");
  const [previewAgeMax, setPreviewAgeMax] = useState("");
  const [previewTests, setPreviewTests] = useState<TestItem[]>([]);
  const [previewPrice, setPreviewPrice] = useState("");
  const [previewCorpPrice, setPreviewCorpPrice] = useState("");
  const [previewBrochure, setPreviewBrochure] = useState("");
  const [showTestSearch, setShowTestSearch] = useState(false);
  const [testSearchQuery, setTestSearchQuery] = useState("");

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Populate preview from suggestion
  useEffect(() => {
    if (suggestion) {
      setPreviewName(suggestion.name);
      setPreviewCategory(suggestion.category || "WELLNESS");
      setPreviewGender(suggestion.targetGender || "ALL");
      setPreviewAgeMin(suggestion.targetAgeMin != null ? String(suggestion.targetAgeMin) : "");
      setPreviewAgeMax(suggestion.targetAgeMax != null ? String(suggestion.targetAgeMax) : "");
      setPreviewTests(suggestion.tests ?? []);
      setPreviewPrice(String(suggestion.offerPrice ?? suggestion.mrpPrice ?? ""));
      setPreviewCorpPrice(suggestion.corporatePrice ? String(suggestion.corporatePrice) : "");
      setPreviewBrochure(suggestion.brochureText ?? "");
    }
  }, [suggestion]);

  const mrpTotal = useMemo(() => previewTests.reduce((s, t) => s + (t.price || 0), 0), [previewTests]);
  const discount = mrpTotal > 0 && previewPrice ? (((mrpTotal - Number(previewPrice)) / mrpTotal) * 100) : 0;

  // ── Chat mutation ─────────────────────────────────────────────────────────

  const chatMut = useMutation({
    mutationFn: async (message: string) => {
      const res = await api.post("/lab-packages/ai-chat", {
        sessionId,
        message,
        sessionType: "PACKAGE_BUILDER",
        context: {
          patientAge: ageMin ? `${ageMin}-${ageMax || "99"}` : undefined,
          patientGender: targetGender !== "ALL" ? targetGender : undefined,
          symptoms: symptoms || undefined,
          budget: budget ? Number(budget) : undefined,
        },
      });
      return res.data?.data ?? res.data;
    },
    onSuccess: (data) => {
      if (data.sessionId) setSessionId(data.sessionId);
      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: data.message,
        suggestion: data.suggestion ?? null,
        isFinalized: data.isFinalized ?? false,
      };
      setMessages((prev) => [...prev, aiMsg]);
      if (data.isFinalized && data.suggestion) {
        setSuggestion(data.suggestion);
      }
    },
    onError: () => {
      toast.error("AI request failed");
      setMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    },
  });

  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim() || chatMut.isPending) return;
      const userMsg: ChatMessage = { id: `user-${Date.now()}`, role: "user", content: text.trim() };
      setMessages((prev) => [...prev, userMsg]);
      setInputText("");
      chatMut.mutate(text.trim());
    },
    [chatMut]
  );

  // ── Test search for preview ──────────────────────────────────────────────

  const { data: searchedTests = [] } = useQuery<TestItem[]>({
    queryKey: ["test-search", testSearchQuery],
    queryFn: async () => {
      const res = await api.get(`/test-catalog/search?q=${encodeURIComponent(testSearchQuery)}`);
      const data = res.data?.data ?? res.data;
      return Array.isArray(data) ? data : [];
    },
    enabled: testSearchQuery.length >= 2,
  });

  // ── Save from AI ────────────────────────────────────────────────────────

  const saveMut = useMutation({
    mutationFn: async () => {
      await api.post("/lab-packages/save-from-ai", {
        sessionId,
        suggestion,
        overrides: {
          name: previewName || undefined,
          price: previewPrice ? Number(previewPrice) : undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success("Package saved successfully!");
      onPackageSaved();
      setSuggestion(null);
      setSessionId(null);
      setMessages([
        {
          id: "welcome-new",
          role: "assistant",
          content: "Package saved! Ready to build another one?",
        },
      ]);
    },
    onError: () => toast.error("Failed to save package"),
  });

  return (
    <div className="flex flex-col h-full">
      {/* Context Section */}
      <div className="border-b border-slate-200">
        <button
          onClick={() => setContextOpen(!contextOpen)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100/50 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            Context &amp; Filters
          </span>
          {contextOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {contextOpen && (
          <div className="px-4 pb-3 grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Target Gender</label>
              <div className="flex gap-1">
                {GENDERS.map((g) => (
                  <button
                    key={g}
                    onClick={() => setTargetGender(g)}
                    className={cn(
                      "flex-1 py-1 text-xs rounded font-medium transition-colors",
                      targetGender === g ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    )}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Age Range</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={ageMin}
                  onChange={(e) => setAgeMin(e.target.value)}
                  className="w-full px-2 py-1 bg-slate-100 border border-slate-300 rounded text-xs text-slate-900 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={ageMax}
                  onChange={(e) => setAgeMax(e.target.value)}
                  className="w-full px-2 py-1 bg-slate-100 border border-slate-300 rounded text-xs text-slate-900 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Budget (optional)</label>
              <input
                type="number"
                placeholder="e.g. 2000"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="w-full px-2 py-1 bg-slate-100 border border-slate-300 rounded text-xs text-slate-900 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Symptoms / Purpose</label>
              <input
                type="text"
                placeholder="e.g. fatigue, routine checkup"
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                className="w-full px-2 py-1 bg-slate-100 border border-slate-300 rounded text-xs text-slate-900 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
              />
            </div>
          </div>
        )}
      </div>

      {/* Chat + Preview split */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Area */}
        <div className={cn("flex flex-col", suggestion ? "w-1/2 border-r border-slate-200" : "w-full")}>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg) => (
              <div key={msg.id} className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}>
                {msg.role === "assistant" && (
                  <div className="shrink-0 w-7 h-7 rounded-full bg-blue-600/20 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-blue-400" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[80%] px-3 py-2 rounded-lg text-sm",
                    msg.role === "user"
                      ? "bg-blue-600 text-white rounded-br-sm"
                      : "bg-slate-100 text-slate-200 rounded-bl-sm"
                  )}
                >
                  {msg.content}
                </div>
                {msg.role === "user" && (
                  <div className="shrink-0 w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center">
                    <User className="h-4 w-4 text-slate-500" />
                  </div>
                )}
              </div>
            ))}
            {chatMut.isPending && (
              <div className="flex gap-2 items-center">
                <div className="w-7 h-7 rounded-full bg-blue-600/20 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-blue-400" />
                </div>
                <div className="bg-slate-100 rounded-lg px-4 py-2">
                  <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick Prompts */}
          <div className="px-4 pb-2 flex flex-wrap gap-1.5">
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => sendMessage(p)}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-xs text-slate-700 rounded-full border border-slate-300 transition-colors"
              >
                {p}
              </button>
            ))}
          </div>

          {/* Input Bar */}
          <div className="p-3 border-t border-slate-200">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(inputText);
                  }
                }}
                placeholder="Describe the package you want to build..."
                className="flex-1 px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
              <button
                onClick={() => sendMessage(inputText)}
                disabled={chatMut.isPending || !inputText.trim()}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-500 text-white rounded-lg transition-colors"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Package Preview */}
        {suggestion && (
          <div className="w-1/2 overflow-y-auto p-4 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-400" />
              Package Preview
            </h3>

            {/* Name */}
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Package Name</label>
              <input
                value={previewName}
                onChange={(e) => setPreviewName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
              />
            </div>

            {/* Category */}
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Category</label>
              <select
                value={previewCategory}
                onChange={(e) => setPreviewCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Gender + Age */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Gender</label>
                <select
                  value={previewGender}
                  onChange={(e) => setPreviewGender(e.target.value)}
                  className="w-full px-2 py-2 bg-slate-100 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                >
                  {GENDERS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Age Min</label>
                <input
                  type="number"
                  value={previewAgeMin}
                  onChange={(e) => setPreviewAgeMin(e.target.value)}
                  className="w-full px-2 py-2 bg-slate-100 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Age Max</label>
                <input
                  type="number"
                  value={previewAgeMax}
                  onChange={(e) => setPreviewAgeMax(e.target.value)}
                  className="w-full px-2 py-2 bg-slate-100 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                />
              </div>
            </div>

            {/* Tests */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-slate-500">Tests ({previewTests.length})</label>
                <button
                  onClick={() => setShowTestSearch(!showTestSearch)}
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                >
                  <Plus className="h-3 w-3" /> Add test
                </button>
              </div>

              {showTestSearch && (
                <div className="mb-2 relative">
                  <input
                    type="text"
                    placeholder="Search tests..."
                    value={testSearchQuery}
                    onChange={(e) => setTestSearchQuery(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-100 border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                  />
                  {searchedTests.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-slate-100 border border-slate-300 rounded-lg max-h-40 overflow-y-auto">
                      {searchedTests.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => {
                            if (!previewTests.find((pt) => pt.id === t.id)) {
                              setPreviewTests((prev) => [...prev, t]);
                            }
                            setTestSearchQuery("");
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-200 text-xs text-slate-900 border-b border-slate-300/50 last:border-0"
                        >
                          <span className="font-medium">{t.name}</span>
                          <span className="text-slate-500 ml-2">{t.code}</span>
                          <span className="text-slate-500 float-right">{formatCurrency(t.price)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-1.5">
                {previewTests.map((t) => (
                  <span key={t.id} className="flex items-center gap-1 px-2 py-1 bg-slate-100 border border-slate-300 rounded text-xs text-slate-700">
                    {t.name}
                    <button
                      onClick={() => setPreviewTests((prev) => prev.filter((pt) => pt.id !== t.id))}
                      className="text-slate-500 hover:text-red-400"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Pricing */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">MRP Total</span>
                <span className="text-slate-900 font-medium">{formatCurrency(mrpTotal)}</span>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Package Price</label>
                <input
                  type="number"
                  value={previewPrice}
                  onChange={(e) => setPreviewPrice(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                />
              </div>
              {mrpTotal > 0 && previewPrice && Number(previewPrice) < mrpTotal && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-green-400">
                    Savings: {formatCurrency(mrpTotal - Number(previewPrice))}
                  </span>
                  <span className="text-green-500">({discount.toFixed(1)}% off)</span>
                </div>
              )}
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Corporate Price (optional)</label>
                <input
                  type="number"
                  value={previewCorpPrice}
                  onChange={(e) => setPreviewCorpPrice(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                />
              </div>
            </div>

            {/* Brochure */}
            <div>
              <label className="text-xs text-slate-500 mb-1 block">AI Brochure Text</label>
              <textarea
                value={previewBrochure}
                onChange={(e) => setPreviewBrochure(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/40 resize-none"
              />
            </div>

            {/* Save */}
            <button
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
              Save Package
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Manual Builder Tab ────────────────────────────────────────────────────────

function ManualBuilderTab({
  editingPackage,
  onPackageSaved,
  onCancel,
}: {
  editingPackage: LabPackage | null;
  onPackageSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("WELLNESS");
  const [gender, setGender] = useState("ALL");
  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");
  const [selectedTests, setSelectedTests] = useState<TestItem[]>([]);
  const [packagePrice, setPackagePrice] = useState("");
  const [corpPrice, setCorpPrice] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  const [prepInstructions, setPrepInstructions] = useState("");
  const [fastingRequired, setFastingRequired] = useState(false);
  const [testSearchQuery, setTestSearchQuery] = useState("");
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Populate form if editing
  useEffect(() => {
    if (editingPackage) {
      setName(editingPackage.name);
      setCategory(editingPackage.category || "WELLNESS");
      setGender(editingPackage.targetGender || "ALL");
      setAgeMin(editingPackage.targetAgeMin != null ? String(editingPackage.targetAgeMin) : "");
      setAgeMax(editingPackage.targetAgeMax != null ? String(editingPackage.targetAgeMax) : "");
      setSelectedTests(editingPackage.tests ?? []);
      setPackagePrice(editingPackage.offerPrice != null ? String(editingPackage.offerPrice) : String(editingPackage.mrpPrice));
      setCorpPrice(editingPackage.corporatePrice != null ? String(editingPackage.corporatePrice) : "");
      setValidFrom(editingPackage.validFrom ? editingPackage.validFrom.slice(0, 10) : "");
      setValidTo(editingPackage.validTo ? editingPackage.validTo.slice(0, 10) : "");
      setPrepInstructions(editingPackage.prepInstructions ?? "");
      setFastingRequired(editingPackage.fastingRequired ?? false);
    } else {
      resetForm();
    }
  }, [editingPackage]);

  const resetForm = () => {
    setName("");
    setCategory("WELLNESS");
    setGender("ALL");
    setAgeMin("");
    setAgeMax("");
    setSelectedTests([]);
    setPackagePrice("");
    setCorpPrice("");
    setValidFrom("");
    setValidTo("");
    setPrepInstructions("");
    setFastingRequired(false);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const mrpTotal = useMemo(() => selectedTests.reduce((s, t) => s + (t.price || 0), 0), [selectedTests]);
  const discount = mrpTotal > 0 && packagePrice ? (((mrpTotal - Number(packagePrice)) / mrpTotal) * 100) : 0;

  // ── Test search ──────────────────────────────────────────────────────────

  const { data: searchResults = [] } = useQuery<TestItem[]>({
    queryKey: ["test-search-manual", testSearchQuery],
    queryFn: async () => {
      const res = await api.get(`/test-catalog/search?q=${encodeURIComponent(testSearchQuery)}`);
      const data = res.data?.data ?? res.data;
      return Array.isArray(data) ? data : [];
    },
    enabled: testSearchQuery.length >= 2,
  });

  // ── Save mutation ────────────────────────────────────────────────────────

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        category,
        targetGender: gender,
        targetAgeMin: ageMin ? Number(ageMin) : null,
        targetAgeMax: ageMax ? Number(ageMax) : null,
        testIds: selectedTests.map((t) => t.id),
        mrpPrice: mrpTotal,
        offerPrice: packagePrice ? Number(packagePrice) : null,
        corporatePrice: corpPrice ? Number(corpPrice) : null,
        validFrom: validFrom || null,
        validTo: validTo || null,
        prepInstructions: prepInstructions || null,
        fastingRequired,
      };
      if (editingPackage) {
        await api.put(`/lab-packages/${editingPackage.id}`, payload);
      } else {
        await api.post("/lab-packages", payload);
      }
    },
    onSuccess: () => {
      toast.success(editingPackage ? "Package updated!" : "Package created!");
      onPackageSaved();
      resetForm();
    },
    onError: () => toast.error("Failed to save package"),
  });

  return (
    <div className="h-full overflow-y-auto p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">
          {editingPackage ? "Edit Package" : "Create New Package"}
        </h3>
        {editingPackage && (
          <button onClick={onCancel} className="text-xs text-slate-500 hover:text-slate-900 transition-colors">
            Cancel
          </button>
        )}
      </div>

      {/* Name */}
      <div>
        <label className="text-xs text-slate-500 mb-1 block">Package Name *</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Complete Blood Profile"
          className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        />
      </div>

      {/* Category */}
      <div>
        <label className="text-xs text-slate-500 mb-1 block">Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Gender + Age */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Gender</label>
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          >
            {GENDERS.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Age Min</label>
          <input
            type="number"
            value={ageMin}
            onChange={(e) => setAgeMin(e.target.value)}
            placeholder="0"
            className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Age Max</label>
          <input
            type="number"
            value={ageMax}
            onChange={(e) => setAgeMax(e.target.value)}
            placeholder="99"
            className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        </div>
      </div>

      {/* Test Search */}
      <div ref={searchRef}>
        <label className="text-xs text-slate-500 mb-1 block">Search &amp; Add Tests</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={testSearchQuery}
            onChange={(e) => {
              setTestSearchQuery(e.target.value);
              setShowSearchDropdown(true);
            }}
            onFocus={() => setShowSearchDropdown(true)}
            placeholder="Search tests by name or code..."
            className="w-full pl-9 pr-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
          {showSearchDropdown && searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-slate-100 border border-slate-300 rounded-lg max-h-48 overflow-y-auto shadow-xl">
              {searchResults.map((t) => {
                const alreadyAdded = selectedTests.some((s) => s.id === t.id);
                return (
                  <button
                    key={t.id}
                    disabled={alreadyAdded}
                    onClick={() => {
                      setSelectedTests((prev) => [...prev, t]);
                      setTestSearchQuery("");
                      setShowSearchDropdown(false);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 text-xs border-b border-slate-300/50 last:border-0",
                      alreadyAdded
                        ? "text-slate-600 cursor-not-allowed"
                        : "text-slate-900 hover:bg-slate-200"
                    )}
                  >
                    <span className="font-medium">{t.name}</span>
                    <span className="text-slate-500 ml-2">{t.code}</span>
                    {t.department && <span className="text-slate-600 ml-2">({t.department})</span>}
                    <span className="text-slate-500 float-right">{formatCurrency(t.price)}</span>
                    {alreadyAdded && <span className="text-slate-600 float-right mr-2">(added)</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Selected Tests */}
      {selectedTests.length > 0 && (
        <div>
          <label className="text-xs text-slate-500 mb-2 block">Selected Tests ({selectedTests.length})</label>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {selectedTests.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-3 py-1.5 bg-slate-100 border border-slate-300 rounded-lg">
                <div className="flex items-center gap-2 min-w-0">
                  <Beaker className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                  <span className="text-xs text-slate-900 truncate">{t.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-slate-500">{formatCurrency(t.price)}</span>
                  <button
                    onClick={() => setSelectedTests((prev) => prev.filter((s) => s.id !== t.id))}
                    className="text-slate-500 hover:text-red-400 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pricing */}
      <div className="p-3 bg-slate-100/50 rounded-lg border border-slate-300 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">MRP Total</span>
          <span className="text-slate-900 font-semibold">{formatCurrency(mrpTotal)}</span>
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Package Price</label>
          <input
            type="number"
            value={packagePrice}
            onChange={(e) => setPackagePrice(e.target.value)}
            placeholder="Enter offer price"
            className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
          />
        </div>
        {mrpTotal > 0 && packagePrice && Number(packagePrice) < mrpTotal && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-green-400">
              Savings: {formatCurrency(mrpTotal - Number(packagePrice))}
            </span>
            <span className="text-green-500">({discount.toFixed(1)}% off)</span>
          </div>
        )}
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Corporate Price (optional)</label>
          <input
            type="number"
            value={corpPrice}
            onChange={(e) => setCorpPrice(e.target.value)}
            placeholder="Special corporate pricing"
            className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
          />
        </div>
      </div>

      {/* Validity Dates */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Valid From</label>
          <input
            type="date"
            value={validFrom}
            onChange={(e) => setValidFrom(e.target.value)}
            className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 [color-scheme:dark]"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Valid To</label>
          <input
            type="date"
            value={validTo}
            onChange={(e) => setValidTo(e.target.value)}
            className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 [color-scheme:dark]"
          />
        </div>
      </div>

      {/* Prep Instructions */}
      <div>
        <label className="text-xs text-slate-500 mb-1 block">Preparation Instructions</label>
        <textarea
          value={prepInstructions}
          onChange={(e) => setPrepInstructions(e.target.value)}
          rows={3}
          placeholder="e.g. 12 hours fasting required, avoid alcohol 24 hours before..."
          className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
        />
      </div>

      {/* Fasting Toggle */}
      <div className="flex items-center justify-between">
        <label className="text-sm text-slate-700">Fasting Required</label>
        <button
          onClick={() => setFastingRequired(!fastingRequired)}
          className={cn(
            "w-10 h-5 rounded-full transition-colors relative",
            fastingRequired ? "bg-blue-600" : "bg-slate-200"
          )}
        >
          <div
            className={cn(
              "w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform",
              fastingRequired ? "translate-x-5" : "translate-x-0.5"
            )}
          />
        </button>
      </div>

      {/* Save Button */}
      <button
        onClick={() => saveMut.mutate()}
        disabled={saveMut.isPending || !name.trim()}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors"
      >
        {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
        {editingPackage ? "Update Package" : "Save Package"}
      </button>
    </div>
  );
}
