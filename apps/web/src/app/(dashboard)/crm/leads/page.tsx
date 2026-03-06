"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  Building2,
  Phone,
  Mail,
  MessageSquare,
  TrendingUp,
  Trophy,
  XCircle,
  GripVertical,
} from "lucide-react";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import api from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────

interface Lead {
  id: string;
  name: string;
  source: string;
  status: string;
  phone: string | null;
  email: string | null;
  organizationName: string | null;
  city: string | null;
  notes: string | null;
  expectedValue: number | null;
  createdAt: string;
  assignedTo: { firstName: string; lastName: string } | null;
  _count: { leadNotes: number };
  aiScore?: number;
  aiGrade?: string;
  aiRecommendation?: string;
}

interface BoardData {
  board: Record<string, Lead[]>;
  pipelineValue: number;
}

interface LeadStats {
  total: number;
  wonThisMonth: number;
  lostThisMonth: number;
  totalWonRevenue: number;
  byStatus: Array<{ status: string; count: number; pipelineValue: number }>;
}

interface LeadNote {
  id: string;
  content: string;
  type: string;
  createdAt: string;
  createdBy: { firstName: string; lastName: string };
}

interface LeadDetail {
  id: string;
  name: string;
  source: string;
  status: string;
  phone: string | null;
  email: string | null;
  organizationName: string | null;
  city: string | null;
  notes: string | null;
  expectedValue: number | null;
  actualValue: number | null;
  lostReason: string | null;
  createdAt: string;
  assignedTo: { firstName: string; lastName: string } | null;
  leadNotes: (LeadNote & { lead?: undefined })[];
}

// ── Column Config ──────────────────────────────────────────────────────────

const COLUMNS = [
  { id: "NEW", label: "New", color: "border-slate-300", headerColor: "bg-slate-100 text-slate-700" },
  { id: "QUALIFIED", label: "Qualified", color: "border-blue-300", headerColor: "bg-blue-50 text-blue-700" },
  { id: "PROPOSAL", label: "Proposal", color: "border-yellow-300", headerColor: "bg-yellow-50 text-yellow-700" },
  { id: "NEGOTIATION", label: "Negotiation", color: "border-orange-300", headerColor: "bg-orange-50 text-orange-700" },
];

// ── AI Grade Badge ─────────────────────────────────────────────────────────

function AiGradeBadge({ grade, score }: { grade: string; score?: number }) {
  const map: Record<string, string> = {
    HOT: "bg-red-100 text-red-700 border-red-200",
    WARM: "bg-orange-100 text-orange-700 border-orange-200",
    COLD: "bg-blue-100 text-blue-700 border-blue-200",
  };
  const dot: Record<string, string> = { HOT: "bg-red-500", WARM: "bg-orange-400", COLD: "bg-blue-400" };
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-bold ${map[grade] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot[grade] ?? "bg-slate-400"}`} />
      {grade}{score !== undefined ? ` ${score}` : ""}
    </span>
  );
}

// ── Source Badge ───────────────────────────────────────────────────────────

function SourceBadge({ source }: { source: string }) {
  const map: Record<string, string> = {
    WEBSITE: "bg-blue-50 text-blue-700",
    WHATSAPP: "bg-green-50 text-green-700",
    CALL_CENTER: "bg-yellow-50 text-yellow-700",
    FIELD_REP: "bg-purple-50 text-purple-700",
    HOSPITAL: "bg-red-50 text-red-700",
    CAMPAIGN: "bg-pink-50 text-pink-700",
    REFERRAL: "bg-teal-50 text-teal-700",
  };
  return (
    <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${map[source] ?? "bg-slate-50 text-slate-600"}`}>
      {source.replace("_", " ")}
    </span>
  );
}

// ── Lead Card (Sortable) ───────────────────────────────────────────────────

function LeadCard({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
      onClick={onClick}
    >
      <div className="p-3">
        <div className="flex items-start gap-2">
          <div
            {...attributes}
            {...listeners}
            className="mt-0.5 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-800 text-sm leading-tight">{lead.name}</p>
            {lead.organizationName && (
              <div className="flex items-center gap-1 mt-0.5">
                <Building2 className="w-3 h-3 text-slate-400" />
                <p className="text-xs text-slate-500 truncate">{lead.organizationName}</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <SourceBadge source={lead.source} />
          {lead.aiGrade && <AiGradeBadge grade={lead.aiGrade} score={lead.aiScore} />}
          {lead.expectedValue && (
            <span className="text-xs font-semibold text-green-600">
              {formatCurrency(Number(lead.expectedValue))}
            </span>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
          <span>{formatRelativeTime(lead.createdAt)}</span>
          {lead._count.leadNotes > 0 && (
            <div className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              {lead._count.leadNotes}
            </div>
          )}
        </div>

        {lead.assignedTo && (
          <div className="mt-1.5 text-xs text-slate-400">
            Assigned: {lead.assignedTo.firstName} {lead.assignedTo.lastName}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Lead Detail Slide-over ─────────────────────────────────────────────────

function LeadDetailSlideover({
  leadId,
  onClose,
  onUpdate,
}: {
  leadId: string;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const qc = useQueryClient();
  const [noteContent, setNoteContent] = useState("");
  const [noteType, setNoteType] = useState("NOTE");
  const [markStatus, setMarkStatus] = useState("");

  const { data: lead } = useQuery({
    queryKey: ["lead-detail", leadId],
    queryFn: async () => {
      const res = await api.get<{ data: LeadDetail }>(`/crm/leads/${leadId}`);
      return res.data.data;
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: (data: { content: string; type: string }) =>
      api.post(`/crm/leads/${leadId}/notes`, data),
    onSuccess: () => {
      setNoteContent("");
      qc.invalidateQueries({ queryKey: ["lead-detail", leadId] });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => api.patch(`/crm/leads/${leadId}/status`, { status }),
    onSuccess: () => {
      onUpdate();
      qc.invalidateQueries({ queryKey: ["lead-detail", leadId] });
    },
  });

  if (!lead) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md h-full flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="font-bold text-slate-900 text-lg">{lead.name}</h2>
            {lead.organizationName && (
              <p className="text-sm text-slate-500">{lead.organizationName}</p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl mt-1">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Contact */}
          <div className="space-y-1.5">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Contact</p>
            {lead.phone && (
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <Phone className="w-3.5 h-3.5 text-slate-400" /> {lead.phone}
              </div>
            )}
            {lead.email && (
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <Mail className="w-3.5 h-3.5 text-slate-400" /> {lead.email}
              </div>
            )}
            {lead.city && <p className="text-sm text-slate-600">{lead.city}</p>}
          </div>

          {/* Pipeline Values */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-xs text-blue-600 font-semibold">Expected Value</p>
              <p className="font-bold text-blue-800 text-lg">
                {lead.expectedValue ? formatCurrency(Number(lead.expectedValue)) : "—"}
              </p>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <p className="text-xs text-green-600 font-semibold">Actual Value</p>
              <p className="font-bold text-green-800 text-lg">
                {lead.actualValue ? formatCurrency(Number(lead.actualValue)) : "—"}
              </p>
            </div>
          </div>

          {/* Status + Quick Actions */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Quick Status Update</p>
            <div className="flex gap-2 flex-wrap">
              {["WON", "LOST"].map((s) => (
                <button
                  key={s}
                  onClick={() => updateStatusMutation.mutate(s)}
                  disabled={updateStatusMutation.isPending || lead.status === s}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-50 ${
                    s === "WON"
                      ? "bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                      : "bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                  }`}
                >
                  {s === "WON" ? <Trophy className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  Mark as {s}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
              Notes ({lead.leadNotes.length})
            </p>

            <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
              {lead.leadNotes.length === 0 ? (
                <p className="text-slate-400 text-xs">No notes yet</p>
              ) : (
                lead.leadNotes.map((n) => (
                  <div key={n.id} className="bg-slate-50 rounded-lg p-3">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-semibold text-slate-500 uppercase">{n.type}</span>
                      <span className="text-xs text-slate-400">{formatRelativeTime(n.createdAt)}</span>
                    </div>
                    <p className="text-sm text-slate-700">{n.content}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      — {n.createdBy.firstName} {n.createdBy.lastName}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-2">
              <div className="flex gap-2">
                <select
                  value={noteType}
                  onChange={(e) => setNoteType(e.target.value)}
                  className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
                >
                  {["NOTE", "CALL", "EMAIL", "MEETING"].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Add a note..."
                rows={3}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
              />
              <button
                onClick={() => noteContent.trim() && addNoteMutation.mutate({ content: noteContent, type: noteType })}
                disabled={!noteContent.trim() || addNoteMutation.isPending}
                className="w-full px-4 py-2 bg-[#1B4F8A] rounded-lg text-sm font-semibold text-white hover:bg-[#163d6a] disabled:opacity-50"
              >
                {addNoteMutation.isPending ? "Adding..." : "Add Note"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Add Lead Modal ─────────────────────────────────────────────────────────

function AddLeadModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    name: "",
    source: "WEBSITE",
    phone: "",
    email: "",
    organizationName: "",
    city: "",
    notes: "",
    expectedValue: "",
  });
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post("/crm/leads", data),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (e: unknown) => {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to create lead");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Name is required"); return; }
    mutation.mutate({
      ...form,
      expectedValue: form.expectedValue ? parseFloat(form.expectedValue) : undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Add New Lead</h2>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Name *</label>
            <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Source</label>
            <select value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30">
              {["WEBSITE", "WHATSAPP", "CALL_CENTER", "FIELD_REP", "HOSPITAL", "CAMPAIGN", "REFERRAL"].map((s) => (
                <option key={s} value={s}>{s.replace("_", " ")}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Phone</label>
              <input type="text" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Organization</label>
            <input type="text" value={form.organizationName} onChange={(e) => setForm((f) => ({ ...f, organizationName: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">City</label>
              <input type="text" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Expected Value (₹)</label>
              <input type="number" value={form.expectedValue} onChange={(e) => setForm((f) => ({ ...f, expectedValue: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="flex-1 px-4 py-2 bg-[#1B4F8A] rounded-lg text-sm font-semibold text-white hover:bg-[#163d6a] disabled:opacity-50">
              {mutation.isPending ? "Creating..." : "Create Lead"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function LeadsPage() {
  const qc = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const { data: boardData, isLoading } = useQuery({
    queryKey: ["leads-board"],
    queryFn: async () => {
      const res = await api.get<{ data: BoardData }>("/crm/leads/board");
      return res.data.data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["lead-stats"],
    queryFn: async () => {
      const res = await api.get<{ data: LeadStats }>("/crm/leads/stats");
      return res.data.data;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/crm/leads/${id}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads-board"] });
      qc.invalidateQueries({ queryKey: ["lead-stats"] });
    },
  });

  // Find the lead being dragged (for overlay)
  const activeLead = activeDragId
    ? Object.values(boardData?.board ?? {})
        .flat()
        .find((l) => l.id === activeDragId)
    : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Determine target column: either the column itself or a card in a column
    const targetColId = COLUMNS.find((c) => c.id === String(over.id))?.id
      ?? Object.entries(boardData?.board ?? {}).find(([, leads]) =>
          leads.some((l) => l.id === String(over.id))
        )?.[0];

    if (targetColId && targetColId !== String(active.id)) {
      const sourceColId = Object.entries(boardData?.board ?? {}).find(([, leads]) =>
        leads.some((l) => l.id === String(active.id))
      )?.[0];

      if (sourceColId !== targetColId) {
        updateStatusMutation.mutate({ id: String(active.id), status: targetColId });
      }
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1B4F8A]" />
      </div>
    );
  }

  const board = boardData?.board ?? {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Lead Pipeline</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Pipeline value: <span className="font-semibold text-[#1B4F8A]">{formatCurrency(boardData?.pipelineValue ?? 0)}</span>
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1B4F8A] text-white rounded-lg text-sm font-semibold hover:bg-[#163d6a]"
        >
          <Plus className="w-4 h-4" />
          Add Lead
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Leads", value: stats?.total ?? 0, color: "text-slate-800" },
          { label: "Won This Month", value: stats?.wonThisMonth ?? 0, color: "text-green-600", Icon: Trophy },
          { label: "Lost This Month", value: stats?.lostThisMonth ?? 0, color: "text-red-500", Icon: XCircle },
          { label: "Total Won Revenue", value: formatCurrency(stats?.totalWonRevenue ?? 0), color: "text-blue-600", Icon: TrendingUp },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 font-medium">{k.label}</p>
            <p className={`text-2xl font-bold mt-1 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Kanban Board */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((col) => {
            const leads = board[col.id] ?? [];
            const colValue = leads.reduce((s, l) => s + Number(l.expectedValue ?? 0), 0);

            return (
              <div
                key={col.id}
                id={col.id}
                className={`flex-shrink-0 w-72 rounded-xl border-2 ${col.color} bg-slate-50/60`}
              >
                {/* Column Header */}
                <div className={`flex items-center justify-between px-4 py-3 rounded-t-xl ${col.headerColor}`}>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{col.label}</span>
                    <span className="bg-white/60 rounded-full px-2 py-0.5 text-xs font-bold">
                      {leads.length}
                    </span>
                  </div>
                  {colValue > 0 && (
                    <span className="text-xs font-semibold opacity-80">
                      {formatCurrency(colValue)}
                    </span>
                  )}
                </div>

                {/* Cards */}
                <div className="p-3 space-y-2 min-h-32">
                  <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                    {leads.map((lead) => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        onClick={() => setSelectedLeadId(lead.id)}
                      />
                    ))}
                  </SortableContext>

                  {leads.length === 0 && (
                    <div className="flex items-center justify-center h-20 text-slate-300 text-sm">
                      No leads
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* WON / LOST Summary columns */}
          {[
            {
              id: "WON",
              label: "Won",
              color: "border-green-300",
              headerColor: "bg-green-50 text-green-700",
              Icon: Trophy,
            },
            {
              id: "LOST",
              label: "Lost",
              color: "border-red-300",
              headerColor: "bg-red-50 text-red-700",
              Icon: XCircle,
            },
          ].map((col) => {
            const stat = stats?.byStatus.find((b) => b.status === col.id);
            return (
              <div
                key={col.id}
                className={`flex-shrink-0 w-48 rounded-xl border-2 ${col.color} bg-white/50 flex flex-col`}
              >
                <div className={`flex items-center gap-2 px-4 py-3 rounded-t-xl ${col.headerColor}`}>
                  <col.Icon className="w-4 h-4" />
                  <span className="font-bold text-sm">{col.label}</span>
                </div>
                <div className="p-4 text-center flex-1 flex flex-col items-center justify-center">
                  <p className="text-3xl font-bold text-slate-700">{stat?.count ?? 0}</p>
                  <p className="text-xs text-slate-400 mt-1">leads</p>
                  {(stat?.pipelineValue ?? 0) > 0 && (
                    <p className={`text-sm font-semibold mt-2 ${col.id === "WON" ? "text-green-600" : "text-red-500"}`}>
                      {formatCurrency(stat?.pipelineValue ?? 0)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <DragOverlay>
          {activeLead && (
            <div className="bg-white rounded-lg border-2 border-[#1B4F8A] shadow-xl p-3 w-72 opacity-90">
              <p className="font-semibold text-slate-800 text-sm">{activeLead.name}</p>
              {activeLead.organizationName && (
                <p className="text-xs text-slate-500 mt-0.5">{activeLead.organizationName}</p>
              )}
              {activeLead.expectedValue && (
                <p className="text-xs font-semibold text-green-600 mt-1">
                  {formatCurrency(Number(activeLead.expectedValue))}
                </p>
              )}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {showAddModal && (
        <AddLeadModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["leads-board"] });
            qc.invalidateQueries({ queryKey: ["lead-stats"] });
          }}
        />
      )}

      {selectedLeadId && (
        <LeadDetailSlideover
          leadId={selectedLeadId}
          onClose={() => setSelectedLeadId(null)}
          onUpdate={() => {
            qc.invalidateQueries({ queryKey: ["leads-board"] });
            qc.invalidateQueries({ queryKey: ["lead-stats"] });
          }}
        />
      )}
    </div>
  );
}
