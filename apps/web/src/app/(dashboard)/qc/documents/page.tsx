"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  FileText,
  Search,
  X,
  BookOpen,
  Shield,
  ClipboardCheck,
  BookMarked,
  Calendar,
  Tag,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import api from "@/lib/api";

// -- Types --------------------------------------------------------------------

interface QCDocument {
  id: string;
  title: string;
  type: string;
  category: string | null;
  version: string;
  status: string;
  content: string | null;
  effectiveAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  createdBy?: { firstName: string; lastName: string } | null;
}

// -- Badge helpers ------------------------------------------------------------

const TYPE_STYLES: Record<string, { cls: string; icon: React.ReactNode }> = {
  SOP: {
    cls: "bg-blue-50 text-blue-700 border-blue-200",
    icon: <BookOpen className="w-3 h-3" />,
  },
  POLICY: {
    cls: "bg-purple-50 text-purple-700 border-purple-200",
    icon: <Shield className="w-3 h-3" />,
  },
  FORM: {
    cls: "bg-teal-50 text-teal-700 border-teal-200",
    icon: <ClipboardCheck className="w-3 h-3" />,
  },
  GUIDE: {
    cls: "bg-orange-50 text-orange-700 border-orange-200",
    icon: <BookMarked className="w-3 h-3" />,
  },
};

function TypeBadge({ type }: { type: string }) {
  const style = TYPE_STYLES[type] ?? {
    cls: "bg-slate-50 text-slate-600 border-slate-200",
    icon: <FileText className="w-3 h-3" />,
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${style.cls}`}
    >
      {style.icon}
      {type}
    </span>
  );
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-50 text-slate-600 border-slate-200",
  ACTIVE: "bg-green-50 text-green-700 border-green-200",
  EXPIRED: "bg-red-50 text-red-700 border-red-200",
  ARCHIVED: "bg-amber-50 text-amber-700 border-amber-200",
};

function DocStatusBadge({ status }: { status: string }) {
  const cls =
    STATUS_STYLES[status] ?? "bg-slate-50 text-slate-600 border-slate-200";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${cls}`}
    >
      {status}
    </span>
  );
}

// -- Filter configs -----------------------------------------------------------

const TYPE_FILTERS = [
  { label: "All", value: "ALL" },
  { label: "SOP", value: "SOP" },
  { label: "Policy", value: "POLICY" },
  { label: "Form", value: "FORM" },
  { label: "Guide", value: "GUIDE" },
];

const STATUS_FILTERS = [
  { label: "All", value: "ALL" },
  { label: "Draft", value: "DRAFT" },
  { label: "Active", value: "ACTIVE" },
  { label: "Expired", value: "EXPIRED" },
  { label: "Archived", value: "ARCHIVED" },
];

// -- Add Document Modal -------------------------------------------------------

function AddDocumentModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("SOP");
  const [category, setCategory] = useState("");
  const [version, setVersion] = useState("1.0");
  const [content, setContent] = useState("");
  const [effectiveAt, setEffectiveAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      api.post("/qc/documents", {
        title: title.trim(),
        type,
        category: category.trim() || undefined,
        version: version.trim(),
        content: content.trim() || undefined,
        effectiveAt: effectiveAt || undefined,
        expiresAt: expiresAt || undefined,
      }),
    onSuccess: () => {
      onSuccess();
      onClose();
    },
    onError: (e: unknown) => {
      setError(
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to add document"
      );
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!version.trim()) {
      setError("Version is required");
      return;
    }
    setError("");
    mutation.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Add Document</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-100 text-slate-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. SOP for CBC Analysis"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Type *
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="SOP">SOP</option>
                <option value="POLICY">Policy</option>
                <option value="FORM">Form</option>
                <option value="GUIDE">Guide</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Version *
              </label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="e.g. 1.0"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Category
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Hematology, Biochemistry"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Content
            </label>
            <textarea
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Document content or summary..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Effective Date
              </label>
              <input
                type="date"
                value={effectiveAt}
                onChange={(e) => setEffectiveAt(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Expiry Date
              </label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 px-4 py-2 bg-blue-600 rounded-lg text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {mutation.isPending ? "Adding..." : "Add Document"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -- Main Page ----------------------------------------------------------------

export default function QCDocumentsPage() {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  const { data: documents, isLoading } = useQuery({
    queryKey: ["qc-documents", typeFilter, statusFilter],
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        if (typeFilter !== "ALL") params.set("type", typeFilter);
        if (statusFilter !== "ALL") params.set("status", statusFilter);
        const res = await api.get(`/qc/documents?${params.toString()}`);
        const payload = res.data?.data ?? res.data;
        return (
          Array.isArray(payload) ? payload : payload?.data ?? []
        ) as QCDocument[];
      } catch {
        return [] as QCDocument[];
      }
    },
  });

  const items = (documents ?? []).filter((doc) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      doc.title.toLowerCase().includes(q) ||
      (doc.category ?? "").toLowerCase().includes(q) ||
      doc.type.toLowerCase().includes(q)
    );
  });

  // Compute display status: override to EXPIRED if expiresAt is in the past and status is ACTIVE
  function getDisplayStatus(doc: QCDocument): string {
    if (
      doc.status === "ACTIVE" &&
      doc.expiresAt &&
      new Date(doc.expiresAt) < new Date()
    ) {
      return "EXPIRED";
    }
    return doc.status;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Quality Documents
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            SOPs, policies, forms, and guides for quality management
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> Add Document
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Type filter */}
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-slate-400" />
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setTypeFilter(f.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  typeFilter === f.value
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  statusFilter === f.value
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="relative ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 w-60"
          />
        </div>
      </div>

      {/* Document Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-48 bg-slate-100 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-16 text-center">
          <FileText className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No documents found</p>
          <p className="text-slate-300 text-xs mt-1">
            Add a new document to get started
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((doc) => {
            const displayStatus = getDisplayStatus(doc);
            return (
              <div
                key={doc.id}
                className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow"
              >
                {/* Title + badges row */}
                <div>
                  <h3
                    className="font-semibold text-slate-900 text-sm truncate"
                    title={doc.title}
                  >
                    {doc.title}
                  </h3>
                  {doc.category && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      {doc.category}
                    </p>
                  )}
                </div>

                {/* Badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  <TypeBadge type={doc.type} />
                  <DocStatusBadge status={displayStatus} />
                  <span className="text-xs text-slate-400 font-mono">
                    v{doc.version}
                  </span>
                </div>

                {/* Dates */}
                <div className="mt-auto space-y-1 pt-2 border-t border-slate-50">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Effective</span>
                    <span className="text-slate-600">
                      {doc.effectiveAt ? formatDate(doc.effectiveAt) : "--"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Expires</span>
                    <span
                      className={
                        displayStatus === "EXPIRED"
                          ? "text-red-600 font-medium"
                          : "text-slate-600"
                      }
                    >
                      {doc.expiresAt ? formatDate(doc.expiresAt) : "--"}
                    </span>
                  </div>
                </div>

                {/* Author + created */}
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>
                    {doc.createdBy
                      ? `${doc.createdBy.firstName} ${doc.createdBy.lastName}`
                      : ""}
                  </span>
                  <span>{formatDate(doc.createdAt)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showAddModal && (
        <AddDocumentModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() =>
            queryClient.invalidateQueries({ queryKey: ["qc-documents"] })
          }
        />
      )}
    </div>
  );
}
