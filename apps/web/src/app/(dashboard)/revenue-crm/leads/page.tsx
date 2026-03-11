"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  Upload,
  Plus,
  X,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Phone,
  Mail,
  MapPin,
  Tag,
  Eye,
  TrendingUp,
  UserCheck,
  UserPlus,
  Edit,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

interface MarketingLead {
  id: string;
  firstName: string | null;
  lastName: string | null;
  mobile: string;
  email: string | null;
  age: number | null;
  gender: string | null;
  city: string | null;
  tags: string[];
  status: string;
  source: string | null;
  lastContactedAt: string | null;
  convertedAt: string | null;
  createdAt: string;
}

interface LeadList {
  id: string;
  name: string;
  source: string;
  totalCount: number;
  validCount: number;
  convertedCount: number;
  uploadedAt: string;
  _count?: { leads: number };
}

interface LeadStats {
  total: number;
  new: number;
  contacted: number;
  converted: number;
  conversionRate: number;
}

interface PaginatedLeads {
  items: MarketingLead[];
  total: number;
  page: number;
  pages: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) => new Intl.NumberFormat("en-IN").format(Math.round(n));

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const STATUS_STYLES: Record<string, string> = {
  NEW: "bg-blue-900/50 text-blue-400",
  CONTACTED: "bg-amber-900/50 text-amber-400",
  INTERESTED: "bg-violet-900/50 text-violet-400",
  CONVERTED: "bg-green-900/50 text-green-400",
  UNSUBSCRIBED: "bg-slate-200/60 text-slate-500",
  INVALID: "bg-red-900/50 text-red-400",
};

const STATUS_OPTIONS = [
  "NEW",
  "CONTACTED",
  "INTERESTED",
  "CONVERTED",
  "UNSUBSCRIBED",
  "INVALID",
];

function fullName(lead: MarketingLead): string {
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ");
  return name || "—";
}

// ─── Upload Modal ─────────────────────────────────────────────────────────────

interface UploadResult {
  imported: number;
  duplicates: number;
  invalid: number;
}

function UploadModal({
  onClose,
  onUploaded,
}: {
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [listName, setListName] = useState("");
  const [jsonInput, setJsonInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [parseError, setParseError] = useState("");

  async function handleUpload() {
    if (!listName.trim()) {
      toast.error("List name is required");
      return;
    }
    setParseError("");
    let leads: Record<string, unknown>[] = [];
    try {
      leads = JSON.parse(jsonInput.trim() || "[]");
      if (!Array.isArray(leads)) throw new Error("Must be an array");
    } catch {
      setParseError("Invalid JSON. Please paste a valid JSON array.");
      return;
    }
    if (leads.length === 0) {
      toast.error("No leads to upload");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post("/revenue-crm/lead-lists/upload", {
        listName,
        leads,
      });
      const d = res.data?.data ?? res.data;
      setResult({
        imported: d.imported ?? d.created ?? leads.length,
        duplicates: d.duplicates ?? 0,
        invalid: d.invalid ?? 0,
      });
      toast.success("Leads uploaded successfully!");
      onUploaded();
    } catch {
      toast.error("Failed to upload leads");
    } finally {
      setSubmitting(false);
    }
  }

  const COLUMN_MAP = [
    { field: "mobile", required: true },
    { field: "firstName", required: false },
    { field: "lastName", required: false },
    { field: "email", required: false },
    { field: "age", required: false },
    { field: "gender", required: false },
    { field: "city", required: false },
    { field: "pincode", required: false },
    { field: "tags", required: false },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-50 border border-slate-200 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 sticky top-0 bg-slate-50">
          <div>
            <h2 className="text-slate-900 font-semibold text-lg">Upload Leads</h2>
            <p className="text-slate-500 text-sm mt-0.5">Import leads from JSON</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* List Name */}
          <div>
            <label className="text-slate-700 text-sm font-medium mb-1.5 block">
              List Name *
            </label>
            <input
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              placeholder="e.g. Diwali Campaign Leads 2024"
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm"
            />
          </div>

          {/* Drag & Drop Zone (visual only) */}
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center gap-3 text-center">
            <Upload className="h-10 w-10 text-slate-600" />
            <p className="text-slate-500 text-sm font-medium">Upload .xlsx or .csv</p>
            <p className="text-slate-600 text-xs">
              Drag & drop or browse — or paste JSON below
            </p>
            <p className="text-slate-700 text-xs">(Visual placeholder — use JSON input below)</p>
          </div>

          {/* Column Mapping */}
          <div>
            <p className="text-slate-700 text-sm font-medium mb-2">Column Mapping Preview</p>
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="grid grid-cols-3 bg-slate-100/60 px-3 py-2 text-xs text-slate-500 font-medium">
                <span>Field</span>
                <span>Required</span>
                <span>Type</span>
              </div>
              {COLUMN_MAP.map((col) => (
                <div
                  key={col.field}
                  className="grid grid-cols-3 px-3 py-2 border-t border-slate-200 text-xs"
                >
                  <span className="text-slate-200 font-mono">{col.field}</span>
                  <span
                    className={col.required ? "text-amber-400 font-medium" : "text-slate-500"}
                  >
                    {col.required ? "Required *" : "Optional"}
                  </span>
                  <span className="text-slate-500">
                    {col.field === "age"
                      ? "number"
                      : col.field === "tags"
                      ? "string[]"
                      : "string"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* JSON Input */}
          <div>
            <label className="text-slate-700 text-sm font-medium mb-1.5 block">
              Paste JSON Array
            </label>
            <textarea
              value={jsonInput}
              onChange={(e) => {
                setJsonInput(e.target.value);
                setParseError("");
              }}
              rows={6}
              placeholder={`[
  {"mobile":"9876543210","firstName":"Raj","lastName":"Sharma","email":"raj@example.com","city":"Mumbai"},
  {"mobile":"9123456789","firstName":"Priya","age":34,"gender":"FEMALE"}
]`}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 placeholder-slate-600 focus:outline-none focus:border-teal-500 text-xs font-mono resize-none"
            />
            {parseError && (
              <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {parseError}
              </p>
            )}
          </div>

          {/* Result */}
          {result && (
            <div className="bg-white border border-slate-300 rounded-xl p-4 space-y-2">
              <p className="text-slate-700 text-sm font-medium">Upload Result</p>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                <span className="text-green-400 font-medium">{result.imported} imported</span>
              </div>
              {result.duplicates > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <AlertCircle className="h-4 w-4 text-amber-400" />
                  <span className="text-amber-400">{result.duplicates} duplicates skipped</span>
                </div>
              )}
              {result.invalid > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <AlertCircle className="h-4 w-4 text-red-400" />
                  <span className="text-red-400">{result.invalid} invalid skipped</span>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm transition-colors"
            >
              {result ? "Close" : "Cancel"}
            </button>
            {!result && (
              <button
                onClick={handleUpload}
                disabled={submitting || !listName.trim() || !jsonInput.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {submitting ? "Uploading..." : "Upload Leads"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Status Modal ────────────────────────────────────────────────────────

function EditStatusModal({
  lead,
  onClose,
  onUpdated,
}: {
  lead: MarketingLead;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [status, setStatus] = useState(lead.status);
  const [submitting, setSubmitting] = useState(false);

  async function handleSave() {
    setSubmitting(true);
    try {
      await api.patch(`/revenue-crm/leads/${lead.id}`, { status });
      toast.success("Lead status updated");
      onUpdated();
      onClose();
    } catch {
      toast.error("Failed to update status");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-50 border border-slate-200 rounded-xl w-full max-w-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-slate-900 font-semibold">Update Status</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>
        <div>
          <p className="text-slate-500 text-xs mb-2">
            Lead: <span className="text-slate-200">{fullName(lead)} · {lead.mobile}</span>
          </p>
          <div className="space-y-1.5">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-sm transition-all ${
                  status === s
                    ? "border-teal-500 bg-teal-900/20 text-teal-300"
                    : "border-slate-300 bg-white text-slate-500 hover:border-slate-600"
                }`}
              >
                <div
                  className={`w-3 h-3 rounded-full border-2 ${
                    status === s ? "border-teal-500 bg-teal-500" : "border-slate-600"
                  }`}
                />
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    STATUS_STYLES[s] ?? "bg-slate-200 text-slate-700"
                  }`}
                >
                  {s}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={submitting || status === lead.status}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Lead Modal ───────────────────────────────────────────────────────────

function AddLeadModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: () => void;
}) {
  const [form, setForm] = useState({
    mobile: "",
    firstName: "",
    lastName: "",
    email: "",
    age: "",
    gender: "",
    city: "",
    tags: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const setField = (k: keyof typeof form, v: string) =>
    setForm((p) => ({ ...p, [k]: v }));

  async function handleSave() {
    if (!form.mobile.trim()) {
      toast.error("Mobile number is required");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/revenue-crm/lead-lists/upload", {
        listName: "Manual Entry",
        leads: [
          {
            mobile: form.mobile,
            firstName: form.firstName || undefined,
            lastName: form.lastName || undefined,
            email: form.email || undefined,
            age: form.age ? Number(form.age) : undefined,
            gender: form.gender || undefined,
            city: form.city || undefined,
            tags: form.tags
              ? form.tags.split(",").map((t) => t.trim()).filter(Boolean)
              : [],
          },
        ],
      });
      toast.success("Lead added!");
      onAdded();
      onClose();
    } catch {
      toast.error("Failed to add lead");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-50 border border-slate-200 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 sticky top-0 bg-slate-50">
          <h3 className="text-slate-900 font-semibold">Add Lead</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-slate-700 text-sm font-medium mb-1.5 block">
              Mobile *
            </label>
            <input
              value={form.mobile}
              onChange={(e) => setField("mobile", e.target.value)}
              placeholder="9876543210"
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-700 text-sm font-medium mb-1.5 block">First Name</label>
              <input
                value={form.firstName}
                onChange={(e) => setField("firstName", e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm"
              />
            </div>
            <div>
              <label className="text-slate-700 text-sm font-medium mb-1.5 block">Last Name</label>
              <input
                value={form.lastName}
                onChange={(e) => setField("lastName", e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-slate-700 text-sm font-medium mb-1.5 block">Email</label>
            <input
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              type="email"
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-700 text-sm font-medium mb-1.5 block">Age</label>
              <input
                value={form.age}
                onChange={(e) => setField("age", e.target.value)}
                type="number"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm"
              />
            </div>
            <div>
              <label className="text-slate-700 text-sm font-medium mb-1.5 block">Gender</label>
              <select
                value={form.gender}
                onChange={(e) => setField("gender", e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-teal-500 text-sm"
              >
                <option value="">Select</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-slate-700 text-sm font-medium mb-1.5 block">City</label>
            <input
              value={form.city}
              onChange={(e) => setField("city", e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm"
            />
          </div>
          <div>
            <label className="text-slate-700 text-sm font-medium mb-1.5 block">
              Tags (comma-separated)
            </label>
            <input
              value={form.tags}
              onChange={(e) => setField("tags", e.target.value)}
              placeholder="diabetes, premium, corporate"
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={submitting || !form.mobile.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Add Lead
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type TabType = "lists" | "all" | "converted";

export default function LeadsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>("lists");
  const [showUpload, setShowUpload] = useState(false);
  const [showAddLead, setShowAddLead] = useState(false);
  const [editLead, setEditLead] = useState<MarketingLead | null>(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["crm-lead-stats"] });
    queryClient.invalidateQueries({ queryKey: ["crm-lead-lists"] });
    queryClient.invalidateQueries({ queryKey: ["crm-leads"] });
  };

  // Stats
  const { data: stats, isLoading: statsLoading } = useQuery<LeadStats>({
    queryKey: ["crm-lead-stats"],
    queryFn: async () => {
      const res = await api.get("/revenue-crm/leads/stats");
      return res.data?.data ?? res.data;
    },
    retry: 1,
    staleTime: 30000,
  });

  // Lead Lists
  const { data: leadLists, isLoading: listsLoading } = useQuery<LeadList[]>({
    queryKey: ["crm-lead-lists"],
    queryFn: async () => {
      const res = await api.get("/revenue-crm/lead-lists");
      const d = res.data?.data ?? res.data;
      return (Array.isArray(d) ? d : d?.data ?? d?.items ?? []) as LeadList[];
    },
    retry: 1,
    staleTime: 30000,
  });

  // Leads query
  const effectiveStatus =
    activeTab === "converted"
      ? "CONVERTED"
      : statusFilter === "ALL"
      ? undefined
      : statusFilter;

  const { data: leadsData, isLoading: leadsLoading } = useQuery<PaginatedLeads>({
    queryKey: ["crm-leads", effectiveStatus, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (effectiveStatus) params.set("status", effectiveStatus);
      params.set("page", String(page));
      const res = await api.get(`/revenue-crm/leads?${params.toString()}`);
      const d = res.data?.data ?? res.data;
      if (Array.isArray(d)) {
        return { items: d, total: d.length, page: 1, pages: 1 };
      }
      return d as PaginatedLeads;
    },
    enabled: activeTab !== "lists",
    retry: 1,
    staleTime: 30000,
  });

  const deleteListMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/revenue-crm/lead-lists/${id}`),
    onSuccess: () => {
      toast.success("List deleted");
      queryClient.invalidateQueries({ queryKey: ["crm-lead-lists"] });
    },
    onError: () => toast.error("Failed to delete list"),
  });

  const leads = leadsData?.items ?? [];
  const totalPages = leadsData?.pages ?? 1;

  const filteredLeads = searchQuery
    ? leads.filter(
        (l) =>
          fullName(l).toLowerCase().includes(searchQuery.toLowerCase()) ||
          l.mobile.includes(searchQuery) ||
          (l.email ?? "").toLowerCase().includes(searchQuery.toLowerCase())
      )
    : leads;

  const statCards = [
    {
      label: "Total Leads",
      value: stats?.total ?? 0,
      icon: Users,
      color: "text-teal-400",
    },
    {
      label: "New",
      value: stats?.new ?? 0,
      icon: UserPlus,
      color: "text-blue-400",
    },
    {
      label: "Contacted",
      value: stats?.contacted ?? 0,
      icon: Phone,
      color: "text-amber-400",
    },
    {
      label: "Converted",
      value: stats?.converted ?? 0,
      icon: UserCheck,
      color: "text-green-400",
    },
    {
      label: "Conv. Rate",
      value: `${(stats?.conversionRate ?? 0).toFixed(1)}%`,
      icon: TrendingUp,
      color: "text-emerald-400",
      raw: true,
    },
  ];

  const TABS: { key: TabType; label: string }[] = [
    { key: "lists", label: "Lead Lists" },
    { key: "all", label: "All Leads" },
    { key: "converted", label: "Converted" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onUploaded={invalidateAll}
        />
      )}
      {showAddLead && (
        <AddLeadModal
          onClose={() => setShowAddLead(false)}
          onAdded={invalidateAll}
        />
      )}
      {editLead && (
        <EditStatusModal
          lead={editLead}
          onClose={() => setEditLead(null)}
          onUpdated={invalidateAll}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="h-6 w-6 text-teal-400" />
            Lead Management
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Manage marketing leads, track conversions and campaigns
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium transition-colors"
          >
            <Upload className="h-4 w-4" />
            Upload Excel
          </button>
          <button
            onClick={() => setShowAddLead(true)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Lead
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {statCards.map((s) => (
          <div
            key={s.label}
            className="bg-white border border-slate-200 rounded-xl p-4 space-y-2"
          >
            {statsLoading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-3 w-16 bg-slate-100 rounded" />
                <div className="h-7 w-12 bg-slate-100 rounded" />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                  <p className="text-slate-500 text-xs">{s.label}</p>
                </div>
                <p className={`text-xl font-bold ${s.color}`}>
                  {s.raw ? s.value : fmt(Number(s.value))}
                </p>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 pb-0">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              setPage(1);
            }}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? "border-teal-500 text-teal-400"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Lead Lists Tab ── */}
      {activeTab === "lists" && (
        <div className="space-y-4">
          {listsLoading && (
            <div className="bg-white border border-slate-200 rounded-xl p-8 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
            </div>
          )}

          {!listsLoading && (!leadLists || leadLists.length === 0) && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 bg-white border border-slate-200 rounded-full flex items-center justify-center mb-4">
                <Upload className="h-8 w-8 text-slate-600" />
              </div>
              <h3 className="text-slate-900 font-semibold mb-1">No lead lists yet</h3>
              <p className="text-slate-500 text-sm mb-5">
                Upload your first lead list to start marketing campaigns
              </p>
              <button
                onClick={() => setShowUpload(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Upload className="h-4 w-4" />
                Upload Excel
              </button>
            </div>
          )}

          {!listsLoading && leadLists && leadLists.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100/40">
                    <th className="px-4 py-3 text-left text-slate-500 text-xs font-medium">
                      List Name
                    </th>
                    <th className="px-4 py-3 text-left text-slate-500 text-xs font-medium">
                      Source
                    </th>
                    <th className="px-4 py-3 text-right text-slate-500 text-xs font-medium">
                      Total
                    </th>
                    <th className="px-4 py-3 text-right text-slate-500 text-xs font-medium">
                      Valid
                    </th>
                    <th className="px-4 py-3 text-right text-slate-500 text-xs font-medium">
                      Converted
                    </th>
                    <th className="px-4 py-3 text-left text-slate-500 text-xs font-medium">
                      Upload Date
                    </th>
                    <th className="px-4 py-3 text-left text-slate-500 text-xs font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {leadLists.map((list) => (
                    <tr
                      key={list.id}
                      className="border-b border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <p className="text-slate-900 text-sm font-medium">{list.name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-slate-500 text-xs bg-slate-100 px-2 py-0.5 rounded-full">
                          {list.source ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700 text-sm">
                        {fmt(list.totalCount ?? list._count?.leads ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700 text-sm">
                        {fmt(list.validCount ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-green-400 text-sm font-medium">
                          {fmt(list.convertedCount ?? 0)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                        {formatDate(list.uploadedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setActiveTab("all");
                            }}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs transition-colors"
                          >
                            <Eye className="h-3 w-3" />
                            View
                          </button>
                          <button
                            onClick={() => deleteListMutation.mutate(list.id)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-red-400 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── All Leads / Converted Tab ── */}
      {(activeTab === "all" || activeTab === "converted") && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, mobile or email..."
                className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-slate-900 placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm"
              />
            </div>
            {activeTab === "all" && (
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-500" />
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 text-sm focus:outline-none focus:border-teal-500"
                >
                  <option value="ALL">All Status</option>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Loading */}
          {leadsLoading && (
            <div className="bg-white border border-slate-200 rounded-xl p-8 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
            </div>
          )}

          {/* Empty State */}
          {!leadsLoading && filteredLeads.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 bg-white border border-slate-200 rounded-full flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-slate-600" />
              </div>
              <h3 className="text-slate-900 font-semibold mb-1">No leads yet</h3>
              <p className="text-slate-500 text-sm mb-5">
                {activeTab === "converted"
                  ? "No converted leads found"
                  : "Upload leads or add them manually to get started"}
              </p>
              <button
                onClick={() => setShowUpload(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Upload className="h-4 w-4" />
                Upload Leads
              </button>
            </div>
          )}

          {/* Table */}
          {!leadsLoading && filteredLeads.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100/40">
                    <th className="px-4 py-3 text-left text-slate-500 text-xs font-medium">Name</th>
                    <th className="px-4 py-3 text-left text-slate-500 text-xs font-medium">
                      Mobile
                    </th>
                    <th className="px-4 py-3 text-left text-slate-500 text-xs font-medium">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-slate-500 text-xs font-medium">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-slate-500 text-xs font-medium">Tags</th>
                    <th className="px-4 py-3 text-left text-slate-500 text-xs font-medium">City</th>
                    <th className="px-4 py-3 text-left text-slate-500 text-xs font-medium">
                      {activeTab === "converted" ? "Converted" : "Last Contacted"}
                    </th>
                    <th className="px-4 py-3 text-left text-slate-500 text-xs font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="border-b border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-slate-900 text-sm font-medium">{fullName(lead)}</p>
                          {lead.age && (
                            <p className="text-slate-500 text-xs">
                              {lead.age}y{lead.gender ? ` · ${lead.gender[0]}` : ""}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-slate-700 text-sm">
                          <Phone className="h-3 w-3 text-slate-500" />
                          {lead.mobile}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {lead.email ? (
                          <div className="flex items-center gap-1 text-slate-500 text-xs">
                            <Mail className="h-3 w-3" />
                            <span className="truncate max-w-28">{lead.email}</span>
                          </div>
                        ) : (
                          <span className="text-slate-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            STATUS_STYLES[lead.status] ?? "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {lead.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {lead.tags.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-full text-xs"
                            >
                              <Tag className="h-2.5 w-2.5" />
                              {tag}
                            </span>
                          ))}
                          {lead.tags.length > 2 && (
                            <span className="text-slate-500 text-xs">
                              +{lead.tags.length - 2}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {lead.city ? (
                          <div className="flex items-center gap-1 text-slate-500 text-xs">
                            <MapPin className="h-3 w-3" />
                            {lead.city}
                          </div>
                        ) : (
                          <span className="text-slate-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                        {activeTab === "converted"
                          ? formatDate(lead.convertedAt)
                          : formatDate(lead.lastContactedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setEditLead(lead)}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs transition-colors"
                          >
                            <Edit className="h-3 w-3" />
                            Status
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
                  <p className="text-slate-500 text-xs">
                    Page {page} of {totalPages} · {leadsData?.total ?? 0} total
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-1.5 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-slate-500 transition-colors"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="p-1.5 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-slate-500 transition-colors"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
