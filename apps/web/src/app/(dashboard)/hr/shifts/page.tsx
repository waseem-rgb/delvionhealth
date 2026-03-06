"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  LogIn,
  LogOut,
  Calendar,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import api from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────

interface ShiftAssignment {
  id: string;
  shift: {
    name: string;
    startTime: string;
    endTime: string;
  };
}

interface DaySchedule {
  date: string;
  assignment: ShiftAssignment | null;
}

interface UserSchedule {
  user: {
    firstName: string;
    lastName: string;
    role: string;
  };
  days: DaySchedule[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getMondayOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay(); // 0 = Sun, 1 = Mon ...
  const diff = day === 0 ? -6 : 1 - day; // adjust so Monday is start
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d: Date, n: number): Date {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date;
}

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const SHIFT_COLORS: Record<string, string> = {
  MORNING: "bg-amber-100 text-amber-800 border-amber-200",
  AFTERNOON: "bg-blue-100 text-blue-800 border-blue-200",
  NIGHT: "bg-indigo-100 text-indigo-800 border-indigo-200",
};

function getShiftColor(shiftName: string): string {
  const key = shiftName.toUpperCase();
  if (key.includes("MORNING")) return SHIFT_COLORS.MORNING;
  if (key.includes("AFTERNOON") || key.includes("EVE")) return SHIFT_COLORS.AFTERNOON;
  if (key.includes("NIGHT")) return SHIFT_COLORS.NIGHT;
  return "bg-teal-100 text-teal-800 border-teal-200";
}

// ── Assign Shift Modal ─────────────────────────────────────────────────────

interface AssignModalProps {
  userId: string;
  userName: string;
  date: string;
  onClose: () => void;
  onSuccess: () => void;
}

function AssignShiftModal({ userId, userName, date, onClose, onSuccess }: AssignModalProps) {
  const [shiftId, setShiftId] = useState("");
  const [error, setError] = useState("");

  const PREDEFINED_SHIFTS = [
    { label: "Morning (6am–2pm)", value: "MORNING" },
    { label: "Afternoon (2pm–10pm)", value: "AFTERNOON" },
    { label: "Night (10pm–6am)", value: "NIGHT" },
  ];

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/hr/shifts/${shiftId}/assign`, { userId, date }),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (e: unknown) => {
      setError(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Assignment failed"
      );
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!shiftId.trim()) { setError("Please select a shift"); return; }
    setError("");
    mutation.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Assign Shift</h2>
        <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
          <p className="text-slate-600">Employee: <span className="font-semibold">{userName}</span></p>
          <p className="text-slate-600">Date: <span className="font-semibold">{formatDate(date)}</span></p>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Shift</label>
            <select
              value={shiftId}
              onChange={(e) => setShiftId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            >
              <option value="">Select a shift...</option>
              {PREDEFINED_SHIFTS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 pt-1">
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
              className="flex-1 px-4 py-2 bg-[#1B4F8A] rounded-lg text-sm font-semibold text-white hover:bg-[#163d6a] disabled:opacity-50"
            >
              {mutation.isPending ? "Assigning..." : "Assign"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function ShiftsPage() {
  const qc = useQueryClient();
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOfWeek(new Date()));
  const [assignTarget, setAssignTarget] = useState<{ userId: string; userName: string; date: string } | null>(null);

  const weekStartStr = toYMD(weekStart);

  const { data: schedules, isLoading } = useQuery({
    queryKey: ["hr-shifts", weekStartStr],
    queryFn: async () => {
      const res = await api.get<{ data: UserSchedule[] }>(`/hr/shifts?weekStart=${weekStartStr}`);
      return res.data.data;
    },
  });

  const checkinMutation = useMutation({
    mutationFn: (assignmentId: string) =>
      api.post(`/hr/shifts/assignments/${assignmentId}/checkin`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr-shifts", weekStartStr] }),
  });

  const checkoutMutation = useMutation({
    mutationFn: (assignmentId: string) =>
      api.post(`/hr/shifts/assignments/${assignmentId}/checkout`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr-shifts", weekStartStr] }),
  });

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEndStr = toYMD(weekDays[6]);

  function prevWeek() {
    setWeekStart((d) => addDays(d, -7));
  }
  function nextWeek() {
    setWeekStart((d) => addDays(d, 7));
  }

  const rows = schedules ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Shift Scheduling</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Weekly shift assignments, check-in and check-out tracking
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-700">
            {formatDate(weekStartStr)} — {formatDate(weekEndStr)}
          </span>
          <div className="flex gap-1 ml-2">
            <button
              onClick={prevWeek}
              className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={nextWeek}
              className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-44">
                Employee
              </th>
              {weekDays.map((d, i) => (
                <th key={i} className="px-2 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <div>{DAY_LABELS[i]}</div>
                  <div className="font-normal text-slate-400 normal-case">{d.getDate()}/{d.getMonth() + 1}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((__, j) => (
                    <td key={j} className="px-4 py-4">
                      <div className="h-8 bg-slate-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center text-slate-400">
                  No schedule data found for this week.
                </td>
              </tr>
            ) : (
              rows.map((row, ri) => {
                const fullName = `${row.user.firstName} ${row.user.lastName}`;
                const initials = `${row.user.firstName[0]}${row.user.lastName[0]}`.toUpperCase();
                return (
                  <tr key={ri} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#1B4F8A]/10 text-[#1B4F8A] flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {initials}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 text-sm">{fullName}</p>
                          <p className="text-xs text-slate-400">{row.user.role.replace(/_/g, " ")}</p>
                        </div>
                      </div>
                    </td>
                    {row.days.map((day, di) => {
                      const assignment = day.assignment;
                      return (
                        <td key={di} className="px-2 py-3 text-center">
                          {assignment ? (
                            <div className="space-y-1">
                              <div
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${getShiftColor(assignment.shift.name)}`}
                              >
                                {assignment.shift.name}
                              </div>
                              <div className="text-xs text-slate-400">
                                {assignment.shift.startTime}–{assignment.shift.endTime}
                              </div>
                              <div className="flex justify-center gap-1">
                                <button
                                  onClick={() => checkinMutation.mutate(assignment.id)}
                                  disabled={checkinMutation.isPending}
                                  title="Check In"
                                  className="p-1 rounded bg-green-50 text-green-600 hover:bg-green-100 border border-green-200"
                                >
                                  <LogIn className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => checkoutMutation.mutate(assignment.id)}
                                  disabled={checkoutMutation.isPending}
                                  title="Check Out"
                                  className="p-1 rounded bg-orange-50 text-orange-600 hover:bg-orange-100 border border-orange-200"
                                >
                                  <LogOut className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() =>
                                setAssignTarget({ userId: "", userName: fullName, date: day.date })
                              }
                              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center mx-auto transition-colors"
                              title={`Assign shift to ${fullName} on ${formatDate(day.date)}`}
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span className="font-semibold text-slate-600">Shift legend:</span>
        {Object.entries(SHIFT_COLORS).map(([key, color]) => (
          <span key={key} className={`inline-flex items-center px-2 py-0.5 rounded-full border font-semibold ${color}`}>
            {key}
          </span>
        ))}
      </div>

      {/* Assign Modal */}
      {assignTarget && (
        <AssignShiftModal
          userId={assignTarget.userId}
          userName={assignTarget.userName}
          date={assignTarget.date}
          onClose={() => setAssignTarget(null)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ["hr-shifts", weekStartStr] })}
        />
      )}
    </div>
  );
}
