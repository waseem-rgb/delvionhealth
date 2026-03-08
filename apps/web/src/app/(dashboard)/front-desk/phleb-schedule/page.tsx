"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Loader2,
  AlertTriangle,
  Calendar,
  Clock,
  Users,
  Trash2,
  Edit3,
  RefreshCw,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface PhlebSchedule {
  id: string;
  phlebId: string;
  phlebName: string;
  date: string;
  shiftStart: string;
  shiftEnd: string;
  maxSlotsPerDay: number;
  assignedSlots: string | null;
  status: string | null;
  notes: string | null;
}

interface ScheduleFormData {
  phlebId: string;
  phlebName: string;
  date: string;
  shiftStart: string;
  shiftEnd: string;
  maxSlotsPerDay: number;
  notes: string;
}

function getAssignedCount(s: PhlebSchedule): number {
  if (!s.assignedSlots) return 0;
  try { return JSON.parse(s.assignedSlots).length; } catch { return 0; }
}

function normalizeDate(dateStr: string): string {
  // Handle both "2026-03-08" and "2026-03-08T00:00:00.000Z" formats
  return dateStr.split("T")[0]!;
}

type ViewMode = "week" | "day";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const FULL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// ── Helpers ──────────────────────────────────────────────────────────────────

function getWeekDates(refDate: Date): Date[] {
  const d = new Date(refDate);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(monday);
    dt.setDate(monday.getDate() + i);
    return dt;
  });
}

function fmt(d: Date): string {
  return d.toISOString().split("T")[0]!;
}

function fmtShort(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

const emptyForm: ScheduleFormData = {
  phlebId: "",
  phlebName: "",
  date: "",
  shiftStart: "08:00",
  shiftEnd: "14:00",
  maxSlotsPerDay: 8,
  notes: "",
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PhlebSchedulePage() {
  const queryClient = useQueryClient();
  const [refDate, setRefDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [slideOpen, setSlideOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ScheduleFormData>({ ...emptyForm });
  const [selectedCell, setSelectedCell] = useState<{ phlebId: string; date: string } | null>(null);

  const weekDates = useMemo(() => getWeekDates(refDate), [refDate]);
  const weekFrom = fmt(weekDates[0]!);
  const weekTo = fmt(weekDates[6]!);

  const weekLabel = `${fmtShort(weekDates[0]!)} – ${fmtShort(weekDates[6]!)}`;

  // ── Navigation ───────────────────────────────────────────────────────────

  const prevWeek = () => {
    const d = new Date(refDate);
    d.setDate(d.getDate() - 7);
    setRefDate(d);
    setSelectedCell(null);
  };

  const nextWeek = () => {
    const d = new Date(refDate);
    d.setDate(d.getDate() + 7);
    setRefDate(d);
    setSelectedCell(null);
  };

  // ── Query ────────────────────────────────────────────────────────────────

  const scheduleQuery = useQuery<PhlebSchedule[]>({
    queryKey: ["phleb-schedule", weekFrom, weekTo],
    queryFn: async () => {
      const res = await api.get("/front-desk/phleb-schedule", {
        params: { from: weekFrom, to: weekTo },
      });
      const d = res.data?.data ?? res.data;
      return Array.isArray(d) ? d : [];
    },
  });

  const schedules = scheduleQuery.data ?? [];

  // Group by phlebotomist
  const phlebMap = useMemo(() => {
    const map = new Map<string, { phlebId: string; phlebName: string; byDate: Map<string, PhlebSchedule> }>();
    for (const s of schedules) {
      if (!map.has(s.phlebId)) {
        map.set(s.phlebId, { phlebId: s.phlebId, phlebName: s.phlebName, byDate: new Map() });
      }
      map.get(s.phlebId)!.byDate.set(normalizeDate(s.date), s);
    }
    return Array.from(map.values());
  }, [schedules]);

  // ── Mutations ────────────────────────────────────────────────────────────

  const createSchedule = useMutation({
    mutationFn: async (data: ScheduleFormData) => {
      const res = await api.post("/front-desk/phleb-schedule", data);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Schedule created");
      queryClient.invalidateQueries({ queryKey: ["phleb-schedule"] });
      closeSlide();
    },
    onError: () => toast.error("Failed to create schedule"),
  });

  const updateSchedule = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ScheduleFormData }) => {
      const res = await api.put(`/front-desk/phleb-schedule/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Schedule updated");
      queryClient.invalidateQueries({ queryKey: ["phleb-schedule"] });
      closeSlide();
    },
    onError: () => toast.error("Failed to update schedule"),
  });

  const deleteSchedule = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/front-desk/phleb-schedule/${id}`);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Schedule deleted");
      queryClient.invalidateQueries({ queryKey: ["phleb-schedule"] });
      setSelectedCell(null);
    },
    onError: () => toast.error("Failed to delete schedule"),
  });

  // ── Slide-over ───────────────────────────────────────────────────────────

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...emptyForm, date: fmt(new Date()) });
    setSlideOpen(true);
  };

  const openEdit = (schedule: PhlebSchedule) => {
    setEditingId(schedule.id);
    setForm({
      phlebId: schedule.phlebId,
      phlebName: schedule.phlebName,
      date: normalizeDate(schedule.date),
      shiftStart: schedule.shiftStart,
      shiftEnd: schedule.shiftEnd,
      maxSlotsPerDay: schedule.maxSlotsPerDay,
      notes: schedule.notes ?? "",
    });
    setSlideOpen(true);
  };

  const closeSlide = () => {
    setSlideOpen(false);
    setEditingId(null);
    setForm({ ...emptyForm });
  };

  const handleSave = () => {
    if (!form.phlebId || !form.phlebName || !form.date) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (editingId) {
      updateSchedule.mutate({ id: editingId, data: form });
    } else {
      createSchedule.mutate(form);
    }
  };

  // ── Cell details ─────────────────────────────────────────────────────────

  const selectedSchedule = useMemo(() => {
    if (!selectedCell) return null;
    return schedules.find((s) => s.phlebId === selectedCell.phlebId && normalizeDate(s.date) === selectedCell.date) ?? null;
  }, [selectedCell, schedules]);

  // ── Alerts ───────────────────────────────────────────────────────────────

  const alerts = useMemo(() => {
    const list: { type: "warning" | "info"; message: string }[] = [];
    for (const s of schedules) {
      const ac = getAssignedCount(s);
      if (ac >= s.maxSlotsPerDay) {
        list.push({ type: "warning", message: `${s.phlebName} is at full capacity on ${normalizeDate(s.date)} (${ac}/${s.maxSlotsPerDay})` });
      }
    }
    // Check for days with no phleb scheduled
    for (const d of weekDates) {
      const dateStr = fmt(d);
      const hasSchedule = schedules.some((s) => normalizeDate(s.date) === dateStr);
      if (!hasSchedule && d >= new Date()) {
        list.push({ type: "info", message: `No phlebotomist scheduled for ${fmtShort(d)}` });
      }
    }
    return list;
  }, [schedules, weekDates]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Phlebotomist Schedule</h1>
          <p className="mt-1 text-sm text-slate-500">Manage home-collection phlebotomist shifts and assignments</p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Schedule
        </button>
      </div>

      {/* Week nav + View toggle */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={prevWeek} className="rounded-lg p-1.5 hover:bg-slate-100 transition-colors">
            <ChevronLeft className="h-5 w-5 text-slate-600" />
          </button>
          <span className="text-sm font-semibold text-slate-800 min-w-[160px] text-center">{weekLabel}</span>
          <button onClick={nextWeek} className="rounded-lg p-1.5 hover:bg-slate-100 transition-colors">
            <ChevronRight className="h-5 w-5 text-slate-600" />
          </button>
        </div>
        <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          {(["week", "day"] as ViewMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                viewMode === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              {m === "week" ? "Week" : "Day"}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {scheduleQuery.isLoading ? (
        <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-20 shadow-sm">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-3 text-sm text-slate-500">Loading schedule...</span>
        </div>
      ) : scheduleQuery.isError ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-20 shadow-sm">
          <AlertTriangle className="h-10 w-10 text-red-400" />
          <p className="mt-3 text-sm text-slate-600">Failed to load schedules.</p>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ["phleb-schedule"] })}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      ) : phlebMap.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-20 shadow-sm">
          <Calendar className="h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">No schedules for this week.</p>
          <button
            onClick={openAdd}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Schedule
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-4 py-3 text-left font-medium text-slate-600 min-w-[160px]">Phlebotomist</th>
                {weekDates.map((d, i) => (
                  <th key={i} className="px-3 py-3 text-center font-medium text-slate-600 min-w-[120px]">
                    <div>{DAYS[i]}</div>
                    <div className="text-xs font-normal text-slate-400">{fmtShort(d)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {phlebMap.map((phleb) => (
                <tr key={phleb.phlebId} className="hover:bg-slate-50/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                        {phleb.phlebName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-medium text-slate-900">{phleb.phlebName}</span>
                    </div>
                  </td>
                  {weekDates.map((d, i) => {
                    const dateStr = fmt(d);
                    const sched = phleb.byDate.get(dateStr);
                    const isSelected = selectedCell?.phlebId === phleb.phlebId && selectedCell?.date === dateStr;
                    const assignedCt = sched ? getAssignedCount(sched) : 0;
                    const isOverCapacity = sched && assignedCt >= sched.maxSlotsPerDay;

                    return (
                      <td
                        key={i}
                        onClick={() => sched && setSelectedCell({ phlebId: phleb.phlebId, date: dateStr })}
                        className={cn(
                          "px-3 py-3 text-center cursor-pointer transition-colors",
                          isSelected && "bg-blue-50 ring-2 ring-inset ring-blue-300",
                          !isSelected && sched && "hover:bg-slate-50"
                        )}
                      >
                        {sched ? (
                          <div className="space-y-1">
                            <span
                              className={cn(
                                "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                                isOverCapacity
                                  ? "bg-red-50 text-red-700"
                                  : "bg-green-50 text-green-700"
                              )}
                            >
                              {sched.shiftStart}–{sched.shiftEnd}
                            </span>
                            <div className="text-xs text-slate-500">
                              {assignedCt}/{sched.maxSlotsPerDay} assigned
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Day detail panel */}
      {selectedSchedule && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                {selectedSchedule.phlebName} — {normalizeDate(selectedSchedule.date)}
              </h3>
              <p className="text-sm text-slate-500">
                Shift: {selectedSchedule.shiftStart} – {selectedSchedule.shiftEnd} | Slots: {getAssignedCount(selectedSchedule)}/{selectedSchedule.maxSlotsPerDay}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => openEdit(selectedSchedule)}
                className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 transition-colors"
                title="Edit schedule"
              >
                <Edit3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => deleteSchedule.mutate(selectedSchedule.id)}
                disabled={deleteSchedule.isPending}
                className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 transition-colors"
                title="Delete schedule"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setSelectedCell(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {selectedSchedule.notes && (
            <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <strong>Notes:</strong> {selectedSchedule.notes}
            </p>
          )}

          <div className="py-4 text-center">
            <p className="text-sm text-slate-500">
              {getAssignedCount(selectedSchedule)} slot{getAssignedCount(selectedSchedule) !== 1 ? "s" : ""} assigned out of {selectedSchedule.maxSlotsPerDay}
            </p>
            {selectedSchedule.status && (
              <p className="text-xs text-slate-400 mt-1">Status: {selectedSchedule.status}</p>
            )}
          </div>
        </div>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-700">Alerts</h3>
          {alerts.map((alert, i) => (
            <div
              key={i}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm",
                alert.type === "warning" ? "bg-amber-50 text-amber-800" : "bg-blue-50 text-blue-800"
              )}
            >
              <AlertTriangle className={cn("h-4 w-4 flex-shrink-0", alert.type === "warning" ? "text-amber-500" : "text-blue-500")} />
              {alert.message}
            </div>
          ))}
        </div>
      )}

      {/* Slide-over */}
      {slideOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={closeSlide} />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-xl flex flex-col">
            {/* Slide header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingId ? "Edit Schedule" : "Add Schedule"}
              </h2>
              <button onClick={closeSlide} className="rounded-lg p-1 hover:bg-slate-100">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            {/* Form */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phlebotomist ID *</label>
                <input
                  type="text"
                  value={form.phlebId}
                  onChange={(e) => setForm({ ...form, phlebId: e.target.value })}
                  placeholder="e.g. PHLEB-001"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phlebotomist Name *</label>
                <input
                  type="text"
                  value={form.phlebName}
                  onChange={(e) => setForm({ ...form, phlebName: e.target.value })}
                  placeholder="Full name"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Shift Start</label>
                  <input
                    type="time"
                    value={form.shiftStart}
                    onChange={(e) => setForm({ ...form, shiftStart: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Shift End</label>
                  <input
                    type="time"
                    value={form.shiftEnd}
                    onChange={(e) => setForm({ ...form, shiftEnd: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Max Slots</label>
                <input
                  type="number"
                  min={1}
                  value={form.maxSlotsPerDay}
                  onChange={(e) => setForm({ ...form, maxSlotsPerDay: parseInt(e.target.value) || 1 })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Optional notes..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 px-6 py-4 flex items-center justify-end gap-3">
              <button
                onClick={closeSlide}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={createSchedule.isPending || updateSchedule.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {(createSchedule.isPending || updateSchedule.isPending) ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {editingId ? "Update" : "Save"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
