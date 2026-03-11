"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen, Search, CheckCircle2, Clock, XCircle,
  Sparkles, Loader2, FileText, Shield, Filter,
  ChevronLeft, ChevronRight, Pencil, RotateCcw,
  CheckCheck, History, ChevronDown, ChevronUp, X, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { cn } from "@/lib/utils";

// ── TYPES ──────────────────────────────────────────────────────────────────

interface SOP {
  id: string;
  sopNumber: string;
  title: string;
  department: string;
  category: string;
  standard: string[];
  version: string;
  status: string;
  content: string;
  objective: string | null;
  scope: string | null;
  responsibility: string | null;
  references: string | null;
  isAiGenerated: boolean;
  isCustomized: boolean;
  nextReviewDate: string | null;
  approvedAt: string | null;
  createdAt: string;
}

interface SOPVersion {
  id: string;
  version: string;
  changedBy: string | null;
  changeNote: string | null;
  createdAt: string;
  content: string;
}

interface GenerationStatus {
  status: 'NOT_STARTED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  totalPlanned: number;
  totalGenerated: number;
  totalFailed: number;
  progressPercent: number;
  currentDept: string | null;
  failedItems: Array<{ sopNumber: string; error: string }>;
  completedAt: string | null;
}

interface SopStats {
  total: number;
  active: number;
  draft: number;
  underReview: number;
  dueForReview: number;
}

// ── CONSTANTS ──────────────────────────────────────────────────────────────

const DEPARTMENTS = [
  { value: '', label: 'All Departments' },
  { value: 'PRE_ANALYTICAL', label: 'Pre-Analytical' },
  { value: 'PHLEBOTOMY', label: 'Phlebotomy' },
  { value: 'BIOCHEMISTRY', label: 'Biochemistry' },
  { value: 'HAEMATOLOGY', label: 'Haematology' },
  { value: 'MICROBIOLOGY', label: 'Microbiology' },
  { value: 'MOLECULAR', label: 'Molecular' },
  { value: 'IMMUNOLOGY', label: 'Immunology' },
  { value: 'HISTOPATHOLOGY', label: 'Histopathology' },
  { value: 'QUALITY', label: 'Quality Management' },
  { value: 'EQUIPMENT', label: 'Equipment' },
  { value: 'SAFETY', label: 'Safety' },
  { value: 'ADMINISTRATION', label: 'Administration' },
  { value: 'POST_ANALYTICAL', label: 'Post-Analytical' },
  { value: 'IT', label: 'IT & Data' },
];

const STANDARDS = ['NABL', 'CAP', 'ISO_15189', 'WHO', 'CLSI', 'CLIA'];

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-green-50 text-green-700 border-green-200',
  DRAFT: 'bg-slate-50 text-slate-600 border-slate-200',
  UNDER_REVIEW: 'bg-amber-50 text-amber-700 border-amber-200',
  OBSOLETE: 'bg-red-50 text-red-600 border-red-200',
  SUPERSEDED: 'bg-slate-100 text-slate-500 border-slate-200',
};

// ── MAIN PAGE ──────────────────────────────────────────────────────────────

export default function SopsPage() {
  const queryClient = useQueryClient();

  // Filters
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [standardFilter, setStandardFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  // Detail view
  const [selectedSop, setSelectedSop] = useState<SOP | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [changeNote, setChangeNote] = useState('');
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  // Generation status
  const [generationCompleteToast, setGenerationCompleteToast] = useState(false);

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: genStatus } = useQuery<GenerationStatus>({
    queryKey: ['sop-generation-status'],
    queryFn: async () => {
      const res = await api.get('/sops/generation-status');
      return res.data?.data ?? res.data;
    },
    retry: 1,
    staleTime: 5000,
    refetchInterval: (query) => {
      const data = query.state.data as GenerationStatus | undefined;
      return data?.status === 'RUNNING' ? 5000 : false;
    },
  });

  const { data: stats } = useQuery<SopStats>({
    queryKey: ['sop-stats'],
    queryFn: async () => {
      const res = await api.get('/sops/stats');
      return res.data?.data ?? res.data;
    },
    retry: 1,
    staleTime: 30000,
  });

  const { data: sopsData, isLoading } = useQuery<{ items: SOP[]; total: number; pages: number }>({
    queryKey: ['sops', deptFilter, standardFilter, statusFilter, search, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (deptFilter) params.set('dept', deptFilter);
      if (standardFilter) params.set('standard', standardFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (search) params.set('search', search);
      params.set('page', String(page));
      params.set('limit', '50');
      const res = await api.get(`/sops?${params}`);
      return res.data?.data ?? res.data;
    },
    retry: 1,
    staleTime: 30000,
    enabled: !genStatus || genStatus.status !== 'NOT_STARTED' || (stats?.total ?? 0) > 0,
  });

  const { data: versions } = useQuery<SOPVersion[]>({
    queryKey: ['sop-versions', selectedSop?.id],
    queryFn: async () => {
      const res = await api.get(`/sops/${selectedSop!.id}/versions`);
      return res.data?.data ?? res.data;
    },
    enabled: !!selectedSop && showVersionHistory,
    retry: 1,
    staleTime: 30000,
  });

  // Watch for generation completion
  useEffect(() => {
    if (genStatus?.status === 'COMPLETED' && !generationCompleteToast) {
      setGenerationCompleteToast(true);
      toast.success(`${genStatus.totalGenerated} SOPs generated successfully!`);
      queryClient.invalidateQueries({ queryKey: ['sops'] });
      queryClient.invalidateQueries({ queryKey: ['sop-stats'] });
    }
  }, [genStatus?.status]);

  // ── Mutations ────────────────────────────────────────────────────────────

  const startGenMut = useMutation({
    mutationFn: () => api.post('/sops/generate-all'),
    onSuccess: () => {
      toast.success('SOP generation started! This will run in the background.');
      queryClient.invalidateQueries({ queryKey: ['sop-generation-status'] });
    },
    onError: () => toast.error('Failed to start generation'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/sops/${id}`, data),
    onSuccess: (res) => {
      toast.success('SOP saved');
      const updated = res.data?.data ?? res.data;
      setSelectedSop(updated);
      setEditMode(false);
      setChangeNote('');
      queryClient.invalidateQueries({ queryKey: ['sops'] });
      queryClient.invalidateQueries({ queryKey: ['sop-stats'] });
    },
    onError: () => toast.error('Failed to save SOP'),
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => api.post(`/sops/${id}/approve`),
    onSuccess: (res) => {
      toast.success('SOP approved and set to Active');
      const updated = res.data?.data ?? res.data;
      setSelectedSop(updated);
      queryClient.invalidateQueries({ queryKey: ['sops'] });
      queryClient.invalidateQueries({ queryKey: ['sop-stats'] });
    },
    onError: () => toast.error('Failed to approve SOP'),
  });

  const regenerateMut = useMutation({
    mutationFn: (id: string) => api.post(`/sops/${id}/regenerate`),
    onSuccess: (res) => {
      toast.success('SOP regenerated with AI');
      const updated = res.data?.data ?? res.data;
      setSelectedSop(updated);
      queryClient.invalidateQueries({ queryKey: ['sops'] });
    },
    onError: () => toast.error('Failed to regenerate SOP'),
  });

  const restoreVersionMut = useMutation({
    mutationFn: ({ sopId, versionId }: { sopId: string; versionId: string }) =>
      api.post(`/sops/${sopId}/restore/${versionId}`),
    onSuccess: (res) => {
      toast.success('Version restored');
      const updated = res.data?.data ?? res.data;
      setSelectedSop(updated);
      queryClient.invalidateQueries({ queryKey: ['sops'] });
      queryClient.invalidateQueries({ queryKey: ['sop-versions', selectedSop?.id] });
    },
    onError: () => toast.error('Failed to restore version'),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleEditSave = () => {
    if (!selectedSop) return;
    updateMut.mutate({ id: selectedSop.id, data: { content: editContent, changeNote } });
  };

  const totalPages = sopsData?.pages ?? 1;
  const sops = sopsData?.items ?? [];
  const showNotStarted = (!genStatus || genStatus.status === 'NOT_STARTED') && (stats?.total ?? 0) === 0;
  const isRunning = genStatus?.status === 'RUNNING';

  // ── DETAIL VIEW ─────────────────────────────────────────────────────────

  if (selectedSop) {
    return (
      <div className="space-y-4">
        {/* Detail Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => { setSelectedSop(null); setEditMode(false); }} className="text-slate-500 hover:text-slate-700 text-sm flex items-center gap-1">
              <ChevronLeft className="w-4 h-4" /> Back to SOPs
            </button>
            <span className="text-slate-300">|</span>
            <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600">{selectedSop.sopNumber}</span>
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_STYLES[selectedSop.status] ?? STATUS_STYLES.DRAFT}`}>
              {selectedSop.status}
            </span>
            {selectedSop.isAiGenerated && !selectedSop.isCustomized && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-violet-50 text-violet-600 border border-violet-200">
                <Sparkles className="w-3 h-3" /> AI Generated
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!editMode ? (
              <>
                <button onClick={() => { setEditMode(true); setEditContent(selectedSop.content); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-700">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                {selectedSop.status !== 'ACTIVE' && (
                  <button onClick={() => approveMut.mutate(selectedSop.id)} disabled={approveMut.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                    <CheckCheck className="w-3.5 h-3.5" /> Approve
                  </button>
                )}
                <button onClick={() => regenerateMut.mutate(selectedSop.id)} disabled={regenerateMut.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50">
                  {regenerateMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Regenerate
                </button>
                <button onClick={() => setShowVersionHistory(v => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50">
                  <History className="w-3.5 h-3.5" /> Versions
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setEditMode(false)} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Cancel</button>
                <button onClick={handleEditSave} disabled={updateMut.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">
                  {updateMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Save
                </button>
              </>
            )}
          </div>
        </div>

        {/* SOP Title */}
        <h1 className="text-xl font-bold text-slate-900">{selectedSop.title}</h1>

        {/* Metadata Row */}
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="text-slate-500">Dept: <span className="text-slate-700 font-medium">{selectedSop.department}</span></span>
          <span className="text-slate-500">v{selectedSop.version}</span>
          {selectedSop.nextReviewDate && (
            <span className="text-slate-500">Next Review: <span className="text-slate-700">{new Date(selectedSop.nextReviewDate).toLocaleDateString('en-IN')}</span></span>
          )}
          <div className="flex gap-1">
            {selectedSop.standard.map(s => (
              <span key={s} className="px-1.5 py-0.5 rounded text-xs bg-blue-50 text-blue-700 border border-blue-200">{s}</span>
            ))}
          </div>
        </div>

        {/* Edit change note */}
        {editMode && (
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Change Note (optional)</label>
            <input value={changeNote} onChange={e => setChangeNote(e.target.value)} placeholder="What changed?"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30" />
          </div>
        )}

        {/* Content */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
          {editMode ? (
            <div className="grid grid-cols-2 divide-x divide-slate-100">
              <div className="p-4">
                <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Edit (Markdown)</p>
                <textarea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  className="w-full font-mono text-xs text-slate-700 border-0 focus:ring-0 outline-none resize-none"
                  style={{ minHeight: '70vh' }}
                />
              </div>
              <div className="p-4 overflow-auto" style={{ maxHeight: '75vh' }}>
                <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Preview</p>
                <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap text-sm leading-relaxed">
                  {editContent}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 overflow-auto">
              <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap text-sm leading-relaxed">
                {selectedSop.content || <span className="text-slate-400 italic">No content yet. Click Edit or Regenerate.</span>}
              </div>
            </div>
          )}
        </div>

        {/* Version History Panel */}
        {showVersionHistory && (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Version History</h3>
            {!versions || versions.length === 0 ? (
              <p className="text-sm text-slate-400">No previous versions</p>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-100">
                  <th className="text-left py-2 text-xs font-medium text-slate-500">Version</th>
                  <th className="text-left py-2 text-xs font-medium text-slate-500">Date</th>
                  <th className="text-left py-2 text-xs font-medium text-slate-500">Note</th>
                  <th className="text-right py-2 text-xs font-medium text-slate-500">Action</th>
                </tr></thead>
                <tbody>
                  {versions.map(v => (
                    <tr key={v.id} className="border-b border-slate-50 last:border-0">
                      <td className="py-2 font-mono text-xs text-slate-600">v{v.version}</td>
                      <td className="py-2 text-xs text-slate-500">{new Date(v.createdAt).toLocaleDateString('en-IN')}</td>
                      <td className="py-2 text-xs text-slate-500">{v.changeNote || '—'}</td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => restoreVersionMut.mutate({ sopId: selectedSop.id, versionId: v.id })}
                          disabled={restoreVersionMut.isPending}
                          className="text-xs text-teal-600 hover:underline disabled:opacity-50">
                          Restore
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── LIST VIEW ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ─── NOT STARTED BANNER ─────────────────────────────────────────── */}
      {showNotStarted && (
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl p-8 text-white">
          <div className="flex items-start gap-6">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-1">Auto-generate All SOPs</h2>
              <p className="text-violet-100 mb-3">
                161 SOPs across Pre-Analytical, Biochemistry, Haematology, Microbiology, Molecular, Quality, Safety,
                Administration and more — ready for NABL accreditation, CAP inspection, and ISO 15189:2022 certification.
                Generated in background. Takes ~35 minutes.
              </p>
              <div className="flex flex-wrap gap-2 mb-5">
                {['NABL', 'CAP', 'ISO 15189', 'WHO', 'CLSI', 'CLIA'].map(s => (
                  <span key={s} className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/20 border border-white/30">{s}</span>
                ))}
              </div>
              <button
                onClick={() => startGenMut.mutate()}
                disabled={startGenMut.isPending}
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-violet-700 font-bold rounded-xl hover:bg-violet-50 disabled:opacity-70 transition-colors"
              >
                {startGenMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Generate All 161 SOPs
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── RUNNING PROGRESS ───────────────────────────────────────────── */}
      {isRunning && genStatus && (
        <div className="bg-white border border-teal-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-teal-600 animate-spin" />
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  Generating SOPs... {genStatus.totalGenerated} of {genStatus.totalPlanned} complete
                </p>
                {genStatus.currentDept && (
                  <p className="text-xs text-slate-500">Currently: {genStatus.currentDept}</p>
                )}
              </div>
            </div>
            <span className="text-2xl font-bold text-teal-600">{genStatus.progressPercent}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5">
            <div
              className="bg-teal-500 h-2.5 rounded-full transition-all duration-1000"
              style={{ width: `${genStatus.progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* ─── HEADER ─────────────────────────────────────────────────────── */}
      {!showNotStarted && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">SOPs &amp; Documents</h1>
            <p className="text-slate-500 text-sm mt-0.5">NABL · CAP · ISO 15189 · WHO Standards</p>
          </div>
          <div className="flex items-center gap-2">
            {genStatus?.status === 'COMPLETED' && genStatus.totalFailed > 0 && (
              <button onClick={() => startGenMut.mutate()} disabled={startGenMut.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-amber-300 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100">
                <RotateCcw className="w-3.5 h-3.5" /> Generate Missing ({genStatus.totalFailed})
              </button>
            )}
            {(!genStatus || genStatus.status === 'NOT_STARTED') && (stats?.total ?? 0) > 0 && (
              <button onClick={() => startGenMut.mutate()} disabled={startGenMut.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50">
                <Sparkles className="w-3.5 h-3.5" /> Generate Missing SOPs
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── STATS ROW ──────────────────────────────────────────────────── */}
      {stats && stats.total > 0 && (
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: 'Total SOPs', value: stats.total, color: 'text-slate-700', bg: 'bg-slate-50' },
            { label: 'Active', value: stats.active, color: 'text-green-700', bg: 'bg-green-50' },
            { label: 'Draft', value: stats.draft, color: 'text-slate-600', bg: 'bg-slate-50' },
            { label: 'Under Review', value: stats.underReview, color: 'text-amber-700', bg: 'bg-amber-50' },
            { label: 'Due for Review', value: stats.dueForReview, color: 'text-red-600', bg: 'bg-red-50' },
          ].map(stat => (
            <div key={stat.label} className={`${stat.bg} rounded-xl p-4 border border-slate-100`}>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ─── FILTER BAR ─────────────────────────────────────────────────── */}
      {(stats?.total ?? 0) > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="search"
              placeholder="Search by SOP number or title..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30"
            />
          </div>
          <select value={deptFilter} onChange={e => { setDeptFilter(e.target.value); setPage(1); }}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30">
            {DEPARTMENTS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
          <select value={standardFilter} onChange={e => { setStandardFilter(e.target.value); setPage(1); }}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30">
            <option value="">All Standards</option>
            {STANDARDS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30">
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="DRAFT">Draft</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="OBSOLETE">Obsolete</option>
          </select>
        </div>
      )}

      {/* ─── SOP TABLE ──────────────────────────────────────────────────── */}
      {(stats?.total ?? 0) > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-8 space-y-3">{[...Array(8)].map((_, i) => <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />)}</div>
          ) : sops.length === 0 ? (
            <div className="p-16 text-center">
              <BookOpen className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">No SOPs match your filters</p>
              <button onClick={() => { setSearch(''); setDeptFilter(''); setStandardFilter(''); setStatusFilter(''); }}
                className="mt-2 text-teal-600 text-xs hover:underline">Clear filters</button>
            </div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-4 py-2.5 font-medium text-slate-500 w-28">SOP Number</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-500">Title</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-500 w-32">Department</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-500 w-40">Standards</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-500 w-16">Version</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-500 w-28">Status</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-500 w-28">Next Review</th>
                  </tr>
                </thead>
                <tbody>
                  {sops.map((sop) => (
                    <tr key={sop.id} onClick={() => setSelectedSop(sop)}
                      className="border-b border-slate-50 last:border-0 hover:bg-slate-50 cursor-pointer transition-colors">
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-xs text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">{sop.sopNumber}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-800">{sop.title}</span>
                          {sop.isAiGenerated && !sop.isCustomized && (
                            <Sparkles className="w-3 h-3 text-violet-400 flex-shrink-0" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-600">{sop.department.replace('_', ' ')}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {(sop.standard || []).slice(0, 3).map(s => (
                            <span key={s} className="px-1 py-0.5 rounded text-xs bg-blue-50 text-blue-600 border border-blue-100">{s}</span>
                          ))}
                          {(sop.standard || []).length > 3 && (
                            <span className="text-xs text-slate-400">+{sop.standard.length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">v{sop.version}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_STYLES[sop.status] ?? STATUS_STYLES.DRAFT}`}>
                          {sop.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">
                        {sop.nextReviewDate ? new Date(sop.nextReviewDate).toLocaleDateString('en-IN') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                  <p className="text-xs text-slate-500">Showing {sops.length} of {sopsData?.total} SOPs</p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs text-slate-600">Page {page} of {totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
