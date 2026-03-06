"use client";

import { useQuery } from "@tanstack/react-query";
import { Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import api from "@/lib/api";

interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
  notes: string | null;
  employee: {
    user: { firstName: string; lastName: string; role: string };
  };
}

const STATUS_CONFIG: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  PRESENT: { color: "bg-green-100 text-green-700", icon: CheckCircle, label: "Present" },
  ABSENT: { color: "bg-red-100 text-red-600", icon: XCircle, label: "Absent" },
  HALF_DAY: { color: "bg-blue-100 text-blue-700", icon: Clock, label: "Half Day" },
  LEAVE: { color: "bg-amber-100 text-amber-700", icon: AlertCircle, label: "On Leave" },
  HOLIDAY: { color: "bg-purple-100 text-purple-700", icon: AlertCircle, label: "Holiday" },
};

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function calcHours(checkIn: string | null, checkOut: string | null): string {
  if (!checkIn || !checkOut) return "—";
  const diff = (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 60000;
  const h = Math.floor(diff / 60);
  const m = Math.round(diff % 60);
  return `${h}h ${m}m`;
}

export default function AttendancePage() {
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["hr-attendance"],
    queryFn: () =>
      api.get("/hr/attendance").then((r) => (r.data as { data: AttendanceRecord[] }).data),
  });

  const records = data ?? [];

  const counts = {
    PRESENT: records.filter((r) => r.status === "PRESENT").length,
    HALF_DAY: records.filter((r) => r.status === "HALF_DAY").length,
    LEAVE: records.filter((r) => r.status === "LEAVE").length,
    ABSENT: records.filter((r) => r.status === "ABSENT").length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Attendance</h1>
        <p className="text-slate-500 text-sm mt-0.5">{today}</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Present", count: counts.PRESENT, color: "bg-green-50 text-green-700 border-green-100" },
          { label: "Half Day", count: counts.HALF_DAY, color: "bg-blue-50 text-blue-700 border-blue-100" },
          { label: "On Leave", count: counts.LEAVE, color: "bg-amber-50 text-amber-700 border-amber-100" },
          { label: "Absent", count: counts.ABSENT, color: "bg-red-50 text-red-600 border-red-100" },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border px-4 py-3 ${s.color}`}>
            <div className="text-2xl font-bold">{s.count}</div>
            <div className="text-xs font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Attendance table */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : records.length === 0 ? (
          <div className="p-16 text-center">
            <Clock className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No attendance records for today</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-500">Employee</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Check In</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Check Out</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Total Hours</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((row) => {
                const cfg = STATUS_CONFIG[row.status] ?? STATUS_CONFIG.PRESENT;
                const Icon = cfg.icon;
                const fullName = `${row.employee.user.firstName} ${row.employee.user.lastName}`;
                return (
                  <tr key={row.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{fullName}</div>
                      <div className="text-xs text-slate-400">{row.employee.user.role.replace(/_/g, " ")}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-mono text-xs">{formatTime(row.checkIn)}</td>
                    <td className="px-4 py-3 text-slate-600 font-mono text-xs">{formatTime(row.checkOut)}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{calcHours(row.checkIn, row.checkOut)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                        <Icon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-center">
        <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-500 font-medium">Biometric integration coming soon</p>
        <p className="text-xs text-slate-400 mt-1">
          Connect biometric devices for automatic check-in/out tracking
        </p>
      </div>
    </div>
  );
}
