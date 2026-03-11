"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2, Search, CheckCircle, XCircle, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

interface LabTest {
  id: string;
  name: string;
  code: string;
  category?: string;
  sampleType?: string;
  price?: number;
  masterTestId?: string | null;
  masterTestName?: string | null;
  isMapped: boolean;
}

interface MasterTest {
  id: string;
  name: string;
  code?: string;
}

type FilterType = "all" | "mapped" | "unmapped";
type TabType = "tests" | "parameters";

// ── Mapping dropdown per row ────────────────────────────────────────────────

function MappingDropdown({
  labTest,
  masterTests,
  onMap,
}: {
  labTest: LabTest;
  masterTests: MasterTest[];
  onMap: (labTestId: string, masterTest: MasterTest | null) => void;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!search) return masterTests.slice(0, 20);
    return masterTests
      .filter((m) => m.name.toLowerCase().includes(search.toLowerCase()))
      .slice(0, 20);
  }, [masterTests, search]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center justify-between gap-2 w-full px-3 py-1.5 text-xs rounded-lg border transition-colors text-left",
          labTest.isMapped
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-slate-200 bg-white text-slate-600 hover:border-[#0D7E8A]"
        )}
      >
        <span className="truncate">{labTest.masterTestName ?? "Select master test..."}</span>
        <ChevronDown className="w-3 h-3 flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 rounded-lg">
              <Search className="w-3 h-3 text-slate-400" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search master tests..."
                className="flex-1 text-xs bg-transparent outline-none"
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {labTest.isMapped && (
              <button
                onClick={() => {
                  onMap(labTest.id, null);
                  setOpen(false);
                  setSearch("");
                }}
                className="w-full px-3 py-2 text-xs text-red-600 hover:bg-red-50 text-left flex items-center gap-2"
              >
                <XCircle className="w-3 h-3" />
                Clear mapping
              </button>
            )}
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-xs text-slate-400 text-center">No results</p>
            ) : (
              filtered.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    onMap(labTest.id, m);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="w-full px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 text-left truncate"
                >
                  {m.name}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function TestMappingPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabType>("tests");
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // ── Fetch lab tests with mapping status ──────────────────────────────────
  const { data: mappingData, isLoading } = useQuery<LabTest[]>({
    queryKey: ["test-mapping", filter, tab],
    queryFn: async () => {
      try {
        const endpoint = tab === "tests" ? "/test-mapping" : "/test-mapping/parameters";
        const res = await api.get(`${endpoint}?filter=${filter}`);
        const raw = res.data?.data ?? res.data;
        return Array.isArray(raw) ? raw : [];
      } catch {
        return [];
      }
    },
    retry: 1,
    staleTime: 30000,
  });

  const labTests = mappingData ?? [];

  // ── Fetch master tests for dropdown ─────────────────────────────────────
  const { data: masterTestsData } = useQuery<MasterTest[]>({
    queryKey: ["master-tests"],
    queryFn: async () => {
      try {
        const res = await api.get("/master-tests?limit=500");
        const raw = res.data?.data ?? res.data;
        return Array.isArray(raw) ? raw : [];
      } catch {
        return [];
      }
    },
    retry: 1,
    staleTime: 30000,
  });

  const masterTests = masterTestsData ?? [];

  // ── Map mutation ─────────────────────────────────────────────────────────
  const mapMutation = useMutation({
    mutationFn: async ({ labTestId, masterTest }: { labTestId: string; masterTest: MasterTest | null }) => {
      if (masterTest) {
        await api.patch(`/test-mapping/${labTestId}`, {
          masterTestId: masterTest.id,
          masterTestName: masterTest.name,
        });
      } else {
        await api.delete(`/test-mapping/${labTestId}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["test-mapping"] });
      toast.success("Mapping updated");
    },
    onError: () => toast.error("Failed to update mapping"),
  });

  // ── Bulk unmap mutation ──────────────────────────────────────────────────
  const bulkUnmapMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await api.post("/test-mapping/bulk-unmap", { ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["test-mapping"] });
      setSelected(new Set());
      toast.success("Tests unmapped successfully");
    },
    onError: () => toast.error("Failed to unmap tests"),
  });

  // ── Filtered results ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!search) return labTests;
    return labTests.filter(
      (t) =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.code.toLowerCase().includes(search.toLowerCase())
    );
  }, [labTests, search]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((t) => t.id)));
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Test Mapping</h1>
          <p className="text-sm text-slate-500 mt-1">
            Align your lab tests with master test list for streamlined operations
          </p>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-2 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors">
            Request Addition
          </button>
          <button
            onClick={() => api.get("/test-mapping/download-excel").catch(() => toast.error("Download failed"))}
            className="flex items-center gap-1.5 px-3 py-2 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Download Excel
          </button>
          {selected.size > 0 && (
            <button
              onClick={() => bulkUnmapMutation.mutate([...selected])}
              disabled={bulkUnmapMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-2 text-xs bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 text-red-600 transition-colors"
            >
              {bulkUnmapMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              Bulk Un-map ({selected.size})
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {([
          { key: "tests" as TabType, label: "Master Test Mapping" },
          { key: "parameters" as TabType, label: "Master Parameter Mapping" },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setFilter("all"); setSelected(new Set()); }}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-md transition",
              tab === t.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filter sub-tabs + search */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex gap-1 border border-slate-200 rounded-lg overflow-hidden">
          {(["all", "mapped", "unmapped"] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setSelected(new Set()); }}
              className={cn(
                "px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                filter === f ? "bg-[#0D7E8A] text-white" : "text-slate-600 hover:bg-slate-50"
              )}
            >
              {f === "all" ? "All Tests" : f === "mapped" ? "Mapped Tests" : "Un-Mapped Tests"}
            </button>
          ))}
        </div>
        <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg max-w-xs">
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tests..."
            className="flex-1 text-xs outline-none"
          />
        </div>
        <span className="text-xs text-slate-500">Rows: {filtered.length}</span>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="w-10 p-3">
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && selected.size === filtered.length}
                  onChange={toggleAll}
                  className="rounded border-slate-300"
                />
              </th>
              <th className="p-3 text-left text-xs font-semibold text-slate-600">
                {tab === "tests" ? "Lab Test List" : "Parameter Name"}
              </th>
              <th className="p-3 text-left text-xs font-semibold text-slate-600">
                {tab === "tests" ? "Master Test List" : "Master Parameter"}
              </th>
              <th className="p-3 text-left text-xs font-semibold text-slate-600">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(8)].map((_, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="p-3"><div className="w-4 h-4 bg-slate-100 rounded animate-pulse" /></td>
                  <td className="p-3"><div className="h-4 w-48 bg-slate-100 rounded animate-pulse" /></td>
                  <td className="p-3"><div className="h-4 w-36 bg-slate-100 rounded animate-pulse" /></td>
                  <td className="p-3"><div className="h-5 w-16 bg-slate-100 rounded-full animate-pulse" /></td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-12 text-center text-slate-400 text-sm">
                  No tests found
                </td>
              </tr>
            ) : (
              filtered.map((test) => (
                <tr key={test.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selected.has(test.id)}
                      onChange={() => toggleSelect(test.id)}
                      className="rounded border-slate-300"
                    />
                  </td>
                  <td className="p-3">
                    <p className="text-sm font-medium text-slate-800">{test.name}</p>
                    <p className="text-xs text-slate-400">{test.code}{test.category ? ` · ${test.category}` : ""}</p>
                  </td>
                  <td className="p-3 min-w-[220px]">
                    <MappingDropdown
                      labTest={test}
                      masterTests={masterTests}
                      onMap={(labTestId, masterTest) =>
                        mapMutation.mutate({ labTestId, masterTest })
                      }
                    />
                  </td>
                  <td className="p-3">
                    {test.isMapped ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                        <CheckCircle className="w-3 h-3" /> Mapped
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">
                        <XCircle className="w-3 h-3" /> Unmapped
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
