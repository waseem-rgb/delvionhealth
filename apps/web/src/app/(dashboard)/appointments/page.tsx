"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Calendar, Clock, Filter, UserCheck, Truck, XCircle, Bell } from "lucide-react";
import api from "@/lib/api";

interface Appointment {
  id: string;
  scheduledAt: string;
  type: string;
  status: string;
  notes: string | null;
  reminderSent: boolean;
  patient: { firstName: string; lastName: string; mrn: string; phone: string | null };
  branch: { name: string };
}

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: "bg-blue-100 text-blue-700",
  CONFIRMED: "bg-green-100 text-green-700",
  EN_ROUTE: "bg-amber-100 text-amber-700",
  COLLECTED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-red-100 text-red-600",
  NO_SHOW: "bg-rose-100 text-rose-600",
};

const TYPE_LABELS: Record<string, string> = {
  HOME_COLLECTION: "🏠 Home Collection",
  WALK_IN: "🚶 Walk-in",
  CORPORATE: "🏢 Corporate",
  APPOINTMENT: "📅 Appointment",
};

export default function AppointmentsPage() {
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [cancelId, setCancelId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["appointments", statusFilter],
    queryFn: () =>
      api
        .get(`/appointments?limit=50${statusFilter !== "ALL" ? `&status=${statusFilter}` : ""}`)
        .then((r) => r.data as { data: Appointment[] }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/appointments/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["appointments"] }),
  });

  const reminderMutation = useMutation({
    mutationFn: (id: string) => api.post(`/appointments/${id}/remind`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["appointments"] }),
  });

  const appointments = data?.data ?? [];

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Appointments</h1>
          <p className="text-slate-500 text-sm mt-0.5">{today}</p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus className="w-4 h-4" /> New Appointment
        </button>
      </div>

      {/* Summary chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Scheduled", status: "SCHEDULED", color: "bg-blue-50 text-blue-700 border-blue-100" },
          { label: "Confirmed", status: "CONFIRMED", color: "bg-green-50 text-green-700 border-green-100" },
          { label: "En Route", status: "EN_ROUTE", color: "bg-amber-50 text-amber-700 border-amber-100" },
          { label: "Collected", status: "COLLECTED", color: "bg-emerald-50 text-emerald-700 border-emerald-100" },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border px-4 py-3 ${s.color}`}>
            <div className="text-2xl font-bold">
              {appointments.filter((a) => a.status === s.status).length}
            </div>
            <div className="text-xs font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500 flex items-center gap-1">
          <Filter className="w-3.5 h-3.5" /> Status:
        </span>
        {["ALL", "SCHEDULED", "CONFIRMED", "EN_ROUTE", "COLLECTED", "CANCELLED", "NO_SHOW"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              statusFilter === s
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {s === "ALL" ? "All" : s.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : appointments.length === 0 ? (
          <div className="p-16 text-center">
            <Calendar className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No appointments found</p>
            <p className="text-slate-300 text-xs mt-1">
              Schedule home collections, walk-ins, and corporate visits
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-500">Time</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Patient</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Type</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Branch</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Status</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((appt) => (
                <tr key={appt.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-slate-700">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-xs">
                        {new Date(appt.scheduledAt).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {new Date(appt.scheduledAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900 text-sm">
                      {appt.patient.firstName} {appt.patient.lastName}
                    </div>
                    <div className="text-xs text-slate-400">
                      {appt.patient.mrn}
                      {appt.patient.phone ? ` · ${appt.patient.phone}` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {TYPE_LABELS[appt.type] ?? appt.type}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {appt.branch.name}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        STATUS_COLORS[appt.status] ?? "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {appt.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {/* Patient Arrived — show for SCHEDULED/CONFIRMED */}
                      {(appt.status === "SCHEDULED" || appt.status === "CONFIRMED") && (
                        <button
                          onClick={() => statusMutation.mutate({ id: appt.id, status: "CONFIRMED" })}
                          disabled={statusMutation.isPending}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-md hover:bg-green-100 transition disabled:opacity-50"
                          title="Patient Arrived"
                        >
                          <UserCheck className="w-3 h-3" />
                          Arrived
                        </button>
                      )}

                      {/* Dispatch Phlebotomist — show for HOME_COLLECTION type with SCHEDULED/CONFIRMED status */}
                      {appt.type === "HOME_COLLECTION" &&
                        (appt.status === "SCHEDULED" || appt.status === "CONFIRMED") && (
                          <button
                            onClick={() => statusMutation.mutate({ id: appt.id, status: "EN_ROUTE" })}
                            disabled={statusMutation.isPending}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100 transition disabled:opacity-50"
                            title="Dispatch Phlebotomist"
                          >
                            <Truck className="w-3 h-3" />
                            Dispatch
                          </button>
                        )}

                      {/* Remind — show for SCHEDULED/CONFIRMED */}
                      {(appt.status === "SCHEDULED" || appt.status === "CONFIRMED") && (
                        <button
                          onClick={() => reminderMutation.mutate(appt.id)}
                          disabled={reminderMutation.isPending}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition disabled:opacity-50"
                          title="Send Reminder"
                        >
                          <Bell className="w-3 h-3" />
                          Remind
                        </button>
                      )}

                      {/* Cancel — show for non-terminal statuses */}
                      {!["CANCELLED", "NO_SHOW", "COLLECTED"].includes(appt.status) && (
                        <button
                          onClick={() => setCancelId(appt.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition"
                          title="Cancel"
                        >
                          <XCircle className="w-3 h-3" />
                          Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Cancel confirmation dialog */}
      {cancelId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Cancel Appointment?</h3>
            <p className="text-sm text-slate-500 mb-5">
              Are you sure you want to cancel this appointment? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setCancelId(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
              >
                Keep
              </button>
              <button
                onClick={() => {
                  statusMutation.mutate({ id: cancelId, status: "CANCELLED" });
                  setCancelId(null);
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition"
              >
                Cancel Appointment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
