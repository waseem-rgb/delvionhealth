"use client";

import { useState, useMemo, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Download, Save, Search, Loader2, Check,
  ChevronLeft, ChevronRight, Percent,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { formatCurrency, cn } from "@/lib/utils";

interface RateListDetail {
  id: string;
  name: string;
  listType: string;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  items: RateListItemDetail[];
}

interface RateListItemDetail {
  id: string;
  rateListId: string;
  testCatalogId: string;
  price: number | string;
  isActive: boolean;
  testCatalog: {
    id: string;
    code: string;
    name: string;
    category: string;
    department: string;
    price: number | string;
    sampleType: string | null;
    turnaroundHours: number;
  };
}

interface AuditEntry {
  id: string;
  testCatalogId: string;
  oldPrice: number | string;
  newPrice: number | string;
  changedBy: string;
  changedByName: string | null;
  reason: string | null;
  changedAt: string;
}

export default function RateListEditorPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const rateListId = params.id as string;
  const initialTab = searchParams.get("tab") === "audit" ? "audit" : "editor";

  const [tab, setTab] = useState<"editor" | "audit">(initialTab as "editor" | "audit");
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("All");
  const [showFilter, setShowFilter] = useState<"all" | "modified" | "inactive">("all");
  const [editedPrices, setEditedPrices] = useState<Record<string, { price: string; isActive?: boolean }>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // ── Queries ────────────────────────────────────────────────────────
  const { data: rateList, isLoading } = useQuery({
    queryKey: ["rate-list-detail", rateListId],
    queryFn: async () => {
      const res = await api.get(`/rate-lists/${rateListId}`);
      return (res.data?.data ?? res.data) as RateListDetail;
    },
  });

  const { data: auditLog } = useQuery({
    queryKey: ["rate-list-audit", rateListId],
    queryFn: async () => {
      const res = await api.get(`/rate-lists/${rateListId}/audit`);
      const raw = res.data?.data ?? res.data;
      return (Array.isArray(raw) ? raw : []) as AuditEntry[];
    },
    enabled: tab === "audit",
  });

  // ── Filtered items ────────────────────────────────────────────────
  const departments = useMemo(() => {
    if (!rateList?.items) return ["All"];
    const depts = [...new Set(rateList.items.map((i) => i.testCatalog.department))].sort();
    return ["All", ...depts];
  }, [rateList]);

  const filteredItems = useMemo(() => {
    if (!rateList?.items) return [];
    return rateList.items.filter((item) => {
      const matchDept = deptFilter === "All" || item.testCatalog.department === deptFilter;
      const matchSearch = !search ||
        item.testCatalog.name.toLowerCase().includes(search.toLowerCase()) ||
        item.testCatalog.code.toLowerCase().includes(search.toLowerCase());
      const matchFilter = showFilter === "all" ||
        (showFilter === "modified" && editedPrices[item.testCatalogId]) ||
        (showFilter === "inactive" && !item.isActive);
      return matchDept && matchSearch && matchFilter;
    });
  }, [rateList, deptFilter, search, showFilter, editedPrices]);

  const totalPages = Math.ceil(filteredItems.length / pageSize);
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, page]);

  // ── Mutations ─────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      const items = Object.entries(editedPrices).map(([testCatalogId, val]) => ({
        testCatalogId,
        price: parseFloat(val.price) || 0,
        ...(val.isActive !== undefined ? { isActive: val.isActive } : {}),
      }));
      if (items.length === 0) return;
      await api.put(`/rate-lists/${rateListId}/items`, { items });
    },
    onSuccess: () => {
      toast.success(`Saved ${Object.keys(editedPrices).length} price changes`);
      setEditedPrices({});
      void qc.invalidateQueries({ queryKey: ["rate-list-detail", rateListId] });
      void qc.invalidateQueries({ queryKey: ["rate-list-audit", rateListId] });
    },
    onError: () => toast.error("Failed to save prices"),
  });

  const handlePriceChange = useCallback((testCatalogId: string, value: string) => {
    setEditedPrices((prev) => ({
      ...prev,
      [testCatalogId]: { ...prev[testCatalogId], price: value },
    }));
  }, []);

  const handleDownload = useCallback(async () => {
    try {
      const res = await api.get(`/rate-lists/${rateListId}/download`, { responseType: "blob" });
      const blob = new Blob([res.data as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${rateList?.name ?? "RateList"}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download");
    }
  }, [rateListId, rateList]);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === paginatedItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedItems.map((i) => i.testCatalogId)));
    }
  }, [selectedIds.size, paginatedItems]);

  const applyDiscount = useCallback((percent: number) => {
    if (!rateList) return;
    const updates: Record<string, { price: string }> = {};
    for (const item of rateList.items) {
      if (selectedIds.has(item.testCatalogId)) {
        const mrp = Number(item.testCatalog.price);
        const discounted = mrp * (1 - percent / 100);
        updates[item.testCatalogId] = { price: discounted.toFixed(2) };
      }
    }
    setEditedPrices((prev) => ({ ...prev, ...updates }));
    setShowDiscountModal(false);
    toast.success(`Applied ${percent}% discount on ${selectedIds.size} tests`);
  }, [rateList, selectedIds]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={28} className="animate-spin text-slate-400" />
      </div>
    );
  }

  const modifiedCount = Object.keys(editedPrices).length;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/settings/rate-lists")} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Editing: {rateList?.name}</h1>
            <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
              <span>Type: {rateList?.listType?.replace(/_/g, " ")}</span>
              <span>|</span>
              <span>Status: {rateList?.isActive !== false ? "Active" : "Disabled"}</span>
              <span>|</span>
              <span>Tests: {rateList?.items?.length ?? 0}</span>
              <span>|</span>
              <span>Modified: {rateList?.updatedAt ? new Date(rateList.updatedAt).toLocaleDateString() : "—"}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleDownload} className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
            <Download size={14} /> Download
          </button>
          {modifiedCount > 0 && (
            <button
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
              className="flex items-center gap-2 px-4 py-2 bg-[#0D7E8A] text-white rounded-lg text-sm font-medium hover:bg-[#0a6b75] disabled:opacity-50"
            >
              {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save {modifiedCount} Changes
            </button>
          )}
        </div>
      </div>

      {/* Tab toggle */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        <button onClick={() => setTab("editor")} className={cn("px-4 py-2 rounded-md text-sm font-medium", tab === "editor" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>Price Editor</button>
        <button onClick={() => setTab("audit")} className={cn("px-4 py-2 rounded-md text-sm font-medium", tab === "audit" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>Audit Log</button>
      </div>

      {tab === "editor" ? (
        <>
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by name or code..." className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]/20 focus:border-[#0D7E8A]" />
            </div>
            <select value={deptFilter} onChange={(e) => { setDeptFilter(e.target.value); setPage(1); }} className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg">
              {(["all", "modified", "inactive"] as const).map((f) => (
                <button key={f} onClick={() => { setShowFilter(f); setPage(1); }} className={cn("px-3 py-1.5 rounded-md text-xs font-medium capitalize", showFilter === f ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Bulk actions */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 bg-[#0D7E8A]/5 border border-[#0D7E8A]/20 rounded-lg px-4 py-2.5">
              <span className="text-sm text-[#0D7E8A] font-medium">{selectedIds.size} selected</span>
              <button onClick={() => setShowDiscountModal(true)} className="px-3 py-1.5 bg-[#0D7E8A] text-white rounded-md text-xs font-medium hover:bg-[#0a6b75] flex items-center gap-1.5">
                <Percent size={12} /> Apply % Discount
              </button>
              <button onClick={() => {
                const updates: Record<string, { price: string }> = {};
                for (const item of rateList?.items ?? []) {
                  if (selectedIds.has(item.testCatalogId)) {
                    updates[item.testCatalogId] = { price: String(Number(item.testCatalog.price)) };
                  }
                }
                setEditedPrices((prev) => ({ ...prev, ...updates }));
                toast.success(`Reset ${selectedIds.size} prices to MRP`);
              }} className="px-3 py-1.5 border border-slate-200 rounded-md text-xs font-medium text-slate-600 hover:bg-white">
                Reset to MRP
              </button>
              <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-xs text-slate-500 hover:text-slate-700">Clear selection</button>
            </div>
          )}

          {/* Price table */}
          <div className="bg-white rounded-xl card-shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-3 py-3 w-10">
                      <input type="checkbox" checked={selectedIds.size === paginatedItems.length && paginatedItems.length > 0} onChange={toggleSelectAll} className="rounded border-slate-300" />
                    </th>
                    <th className="px-3 py-3 text-xs font-semibold text-slate-500">#</th>
                    <th className="px-3 py-3 text-xs font-semibold text-slate-500">Code</th>
                    <th className="px-3 py-3 text-xs font-semibold text-slate-500">Test Name</th>
                    <th className="px-3 py-3 text-xs font-semibold text-slate-500">Department</th>
                    <th className="px-3 py-3 text-xs font-semibold text-slate-500">MRP (Base)</th>
                    <th className="px-3 py-3 text-xs font-semibold text-slate-500">This List Price</th>
                    <th className="px-3 py-3 text-xs font-semibold text-slate-500">Concession %</th>
                    <th className="px-3 py-3 text-xs font-semibold text-slate-500">Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedItems.map((item, idx) => {
                    const mrp = Number(item.testCatalog.price);
                    const edited = editedPrices[item.testCatalogId];
                    const currentPrice = edited ? parseFloat(edited.price) || 0 : Number(item.price);
                    const concession = mrp > 0 ? (((mrp - currentPrice) / mrp) * 100).toFixed(1) : "0.0";
                    const isModified = !!edited;
                    const rowNum = (page - 1) * pageSize + idx + 1;

                    return (
                      <tr key={item.id} className={cn("hover:bg-slate-50/50", isModified && "bg-amber-50/30")}>
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={selectedIds.has(item.testCatalogId)} onChange={() => {
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              next.has(item.testCatalogId) ? next.delete(item.testCatalogId) : next.add(item.testCatalogId);
                              return next;
                            });
                          }} className="rounded border-slate-300" />
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-400">{rowNum}</td>
                        <td className="px-3 py-2 text-xs font-mono text-slate-500">{item.testCatalog.code}</td>
                        <td className="px-3 py-2 text-sm text-slate-900">{item.testCatalog.name}</td>
                        <td className="px-3 py-2 text-xs text-slate-500">{item.testCatalog.department}</td>
                        <td className="px-3 py-2 text-sm text-slate-500">{formatCurrency(mrp)}</td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="0.01"
                            value={edited?.price ?? String(Number(item.price))}
                            onChange={(e) => handlePriceChange(item.testCatalogId, e.target.value)}
                            className={cn("w-24 border rounded-md px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]/20 focus:border-[#0D7E8A]", isModified ? "border-amber-300 bg-amber-50" : "border-slate-200")}
                          />
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-500">
                          <span className={cn(parseFloat(concession) > 0 ? "text-green-600 font-medium" : "text-slate-400")}>
                            {concession}%
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => {
                              const currentActive = edited?.isActive !== undefined ? edited.isActive : item.isActive;
                              setEditedPrices((prev) => ({
                                ...prev,
                                [item.testCatalogId]: {
                                  price: edited?.price ?? String(Number(item.price)),
                                  isActive: !currentActive,
                                },
                              }));
                            }}
                            className={cn(
                              "w-8 h-4 rounded-full transition-colors",
                              (edited?.isActive !== undefined ? edited.isActive : item.isActive) ? "bg-green-500" : "bg-slate-300"
                            )}
                          >
                            <div className={cn("w-3.5 h-3.5 rounded-full bg-white shadow transition-transform", (edited?.isActive !== undefined ? edited.isActive : item.isActive) ? "translate-x-4" : "translate-x-0.5")} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
                <p className="text-xs text-slate-500">
                  Showing {(page - 1) * pageSize + 1}&ndash;{Math.min(page * pageSize, filteredItems.length)} of {filteredItems.length}
                </p>
                <div className="flex items-center gap-1">
                  <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-40"><ChevronLeft size={14} /></button>
                  <span className="px-3 text-xs text-slate-600">Page {page} of {totalPages}</span>
                  <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-40"><ChevronRight size={14} /></button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Audit Log Tab */
        <div className="bg-white rounded-xl card-shadow overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-slate-500">Date</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500">Test ID</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500">Old Price</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500">New Price</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500">Changed By</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(auditLog ?? []).map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-2.5 text-xs text-slate-500">{new Date(entry.changedAt).toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-xs font-mono text-slate-500">{entry.testCatalogId.slice(0, 8)}...</td>
                  <td className="px-4 py-2.5 text-sm text-red-500">{formatCurrency(Number(entry.oldPrice))}</td>
                  <td className="px-4 py-2.5 text-sm text-green-600">{formatCurrency(Number(entry.newPrice))}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{entry.changedByName || entry.changedBy.slice(0, 8)}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">{entry.reason || "—"}</td>
                </tr>
              ))}
              {(auditLog ?? []).length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-slate-400 text-sm">No audit entries yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Discount modal */}
      {showDiscountModal && (
        <DiscountModal onApply={applyDiscount} onClose={() => setShowDiscountModal(false)} count={selectedIds.size} />
      )}
    </div>
  );
}

function DiscountModal({ onApply, onClose, count }: { onApply: (pct: number) => void; onClose: () => void; count: number }) {
  const [pct, setPct] = useState(10);
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        <div className="p-5">
          <h3 className="font-semibold text-slate-900 mb-3">Apply Discount</h3>
          <p className="text-sm text-slate-500 mb-4">
            Apply <strong>{pct}%</strong> discount on MRP for <strong>{count}</strong> selected tests.
          </p>
          <input type="number" min={0} max={100} step={0.5} value={pct} onChange={(e) => setPct(parseFloat(e.target.value) || 0)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]/20 focus:border-[#0D7E8A]" />
        </div>
        <div className="flex gap-2 p-4 border-t">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={() => onApply(pct)} className="flex-1 px-4 py-2 bg-[#0D7E8A] text-white rounded-lg text-sm font-medium hover:bg-[#0a6b75]">Apply</button>
        </div>
      </div>
    </div>
  );
}
