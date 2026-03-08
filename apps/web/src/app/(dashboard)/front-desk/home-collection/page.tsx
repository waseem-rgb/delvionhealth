"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Loader2,
  X,
  Search,
  Phone,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  User,
  Navigation,
  Package,
  Truck,
  Calendar,
  ChevronDown,
  RefreshCw,
  Home,
  TestTube2,
  IndianRupee,
} from "lucide-react";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ── Types ────────────────────────────────────────────────────────────────────

type CollectionStatus =
  | "SCHEDULED"
  | "EN_ROUTE"
  | "ARRIVED"
  | "COLLECTED"
  | "DISPATCHED"
  | "CANCELLED";

interface Phlebotomist {
  id: string;
  phlebId: string;
  phlebName: string;
  status: string;
  shiftStart: string;
  shiftEnd: string;
  assignedSlots: string | null;
  maxSlotsPerDay: number;
  date: string;
  notes: string | null;
}

interface HomeCollectionItem {
  id: string;
  patientName: string;
  phone: string;
  address: string;
  city: string;
  pincode: string;
  status: CollectionStatus;
  preferredSlot: string;
  collectionDate: string;
  testsRequested: string;
  phlebotomistId: string | null;
  phlebotomistName: string | null;
  fee: number;
  createdAt: string;
}

interface PatientLookup {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string;
  address: string | null;
}

interface AvailablePhleb {
  id: string;
  phlebId: string;
  phlebName: string;
  slotsAvailable: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function statusConfig(status: CollectionStatus) {
  const map: Record<CollectionStatus, { bg: string; text: string; label: string; dot: string }> = {
    SCHEDULED: { bg: "bg-slate-100", text: "text-slate-700", label: "Scheduled", dot: "bg-slate-400" },
    EN_ROUTE: { bg: "bg-blue-100", text: "text-blue-700", label: "En Route", dot: "bg-blue-500" },
    ARRIVED: { bg: "bg-indigo-100", text: "text-indigo-700", label: "Arrived", dot: "bg-indigo-500" },
    COLLECTED: { bg: "bg-green-100", text: "text-green-700", label: "Collected", dot: "bg-green-500" },
    DISPATCHED: { bg: "bg-purple-100", text: "text-purple-700", label: "Dispatched", dot: "bg-purple-500" },
    CANCELLED: { bg: "bg-red-100", text: "text-red-700", label: "Cancelled", dot: "bg-red-500" },
  };
  return map[status] ?? map.SCHEDULED;
}

function phlebStatusColor(status: string) {
  const map: Record<string, string> = {
    AVAILABLE: "bg-green-500",
    ON_ROUTE: "bg-blue-500",
    EN_ROUTE: "bg-blue-500",
    BUSY: "bg-amber-500",
    OFF_DUTY: "bg-slate-400",
  };
  return map[status] ?? "bg-slate-400";
}

function getAssignedCount(phleb: Phlebotomist): number {
  if (!phleb.assignedSlots) return 0;
  try {
    return JSON.parse(phleb.assignedSlots).length;
  } catch {
    return 0;
  }
}

function isLate(item: HomeCollectionItem): boolean {
  if (item.status !== "SCHEDULED") return false;
  const slotHours: Record<string, number> = {
    Morning: 10,
    "Mid-morning": 12,
    Afternoon: 14,
    Evening: 18,
  };
  const endHour = slotHours[item.preferredSlot] ?? 18;
  const collDate = new Date(item.collectionDate);
  collDate.setHours(endHour, 0, 0, 0);
  return new Date() > collDate;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function HomeCollectionPage() {
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split("T")[0];

  const [showBookingForm, setShowBookingForm] = useState(false);
  const [phoneSearch, setPhoneSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<PatientLookup | null>(null);
  const [bookingForm, setBookingForm] = useState({
    collectionDate: today,
    preferredSlot: "Morning",
    address: "",
    city: "",
    pincode: "",
    testsRequested: "",
    phlebotomistId: "",
    fee: "",
  });

  // ── Queries ──────────────────────────────────────────────────────────────

  const {
    data: collections,
    isLoading,
    isError,
    error,
  } = useQuery<HomeCollectionItem[]>({
    queryKey: ["home-collections", today],
    queryFn: async () => {
      const res = await api.get(`/appointments?isHomeCollection=true&date=${today}`);
      const d = res.data?.data ?? res.data;
      return Array.isArray(d) ? d : d?.data ?? [];
    },
    refetchInterval: 15000,
  });

  const { data: phlebData } = useQuery<Phlebotomist[]>({
    queryKey: ["phleb-schedule", today],
    queryFn: async () => {
      const res = await api.get(`/front-desk/phleb-schedule?from=${today}&to=${today}`);
      const d = res.data?.data ?? res.data;
      return Array.isArray(d) ? d : [];
    },
    refetchInterval: 15000,
  });

  const { data: patientResults, isFetching: isSearching } = useQuery<PatientLookup[]>({
    queryKey: ["patient-lookup", phoneSearch],
    queryFn: async () => {
      const res = await api.get(`/patients/lookup?phone=${phoneSearch}`);
      const d = res.data?.data ?? res.data;
      return Array.isArray(d) ? d : [];
    },
    enabled: phoneSearch.length >= 6,
  });

  const { data: availablePhlebs } = useQuery<AvailablePhleb[]>({
    queryKey: ["available-phlebs", bookingForm.collectionDate],
    queryFn: async () => {
      const res = await api.get(
        `/front-desk/phleb-schedule/available?date=${bookingForm.collectionDate}`
      );
      const d = res.data?.data ?? res.data;
      return Array.isArray(d) ? d : [];
    },
    enabled: showBookingForm,
  });

  // ── Mutations ────────────────────────────────────────────────────────────

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["home-collections"] });
    queryClient.invalidateQueries({ queryKey: ["phleb-schedule"] });
  }, [queryClient]);

  const bookMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await api.post("/appointments", payload);
      return res.data?.data ?? res.data;
    },
    onSuccess: () => {
      toast.success("Home collection booked & patient notified");
      resetForm();
      invalidate();
    },
    onError: () => toast.error("Failed to book home collection"),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await api.patch(`/appointments/${id}/status`, { status });
      return res.data?.data ?? res.data;
    },
    onSuccess: () => {
      toast.success("Status updated");
      invalidate();
    },
    onError: () => toast.error("Failed to update status"),
  });

  // ── Form helpers ─────────────────────────────────────────────────────────

  function resetForm() {
    setShowBookingForm(false);
    setPhoneSearch("");
    setSelectedPatient(null);
    setBookingForm({
      collectionDate: today,
      preferredSlot: "Morning",
      address: "",
      city: "",
      pincode: "",
      testsRequested: "",
      phlebotomistId: "",
      fee: "",
    });
  }

  function handleBookSubmit() {
    if (!selectedPatient) {
      toast.error("Please select a patient");
      return;
    }
    if (!bookingForm.address.trim()) {
      toast.error("Address is required");
      return;
    }

    bookMutation.mutate({
      patientId: selectedPatient.id,
      patientName: selectedPatient.fullName,
      phone: selectedPatient.phone,
      isHomeCollection: true,
      collectionDate: bookingForm.collectionDate,
      preferredSlot: bookingForm.preferredSlot,
      address: bookingForm.address,
      city: bookingForm.city,
      pincode: bookingForm.pincode,
      testsRequested: bookingForm.testsRequested,
      phlebotomistId: bookingForm.phlebotomistId || undefined,
      fee: bookingForm.fee ? parseFloat(bookingForm.fee) : 0,
    });
  }

  function selectPatient(p: PatientLookup) {
    setSelectedPatient(p);
    setPhoneSearch(p.phone);
    if (p.address) {
      setBookingForm((f) => ({ ...f, address: p.address ?? "" }));
    }
  }

  // ── Derived data ─────────────────────────────────────────────────────────

  const todayCount = (collections ?? []).length;
  const pendingCount = (collections ?? []).filter(
    (c) => c.status === "SCHEDULED" || c.status === "EN_ROUTE"
  ).length;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Home Collection</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage home sample collection bookings and phlebotomist assignments
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => invalidate()}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={() => setShowBookingForm(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition shadow-sm"
          >
            <Plus className="h-4 w-4" />
            New Booking
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Today's Collections", value: todayCount, icon: Calendar, color: "text-blue-600 bg-blue-50" },
          { label: "Pending", value: pendingCount, icon: Clock, color: "text-amber-600 bg-amber-50" },
          {
            label: "Collected",
            value: (collections ?? []).filter((c) => c.status === "COLLECTED" || c.status === "DISPATCHED").length,
            icon: CheckCircle2,
            color: "text-green-600 bg-green-50",
          },
          {
            label: "Phlebotomists Active",
            value: (phlebData ?? []).filter((p) => p.status && p.status !== "OFF_DUTY").length,
            icon: User,
            color: "text-indigo-600 bg-indigo-50",
          },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
            <div className={cn("p-2.5 rounded-lg", s.color)}>
              <s.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Loading / Error */}
      {isLoading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-3 text-slate-500">Loading collections...</span>
        </div>
      )}

      {isError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-700 font-medium">Failed to load data</p>
          <p className="text-sm text-red-500 mt-1">
            {(error as Error)?.message ?? "Unknown error"}
          </p>
        </div>
      )}

      {!isLoading && !isError && (
        <>
          {/* ── Phlebotomist Assignment Board ───────────────────────────────── */}
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            Phlebotomist Assignment Board
          </h2>

          {(phlebData ?? []).length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center mb-6">
              <User className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No phlebotomist data available</p>
              <p className="text-xs text-slate-400 mt-1">Schedule will appear once configured</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
              {(phlebData ?? []).map((phleb) => {
                const assigned = getAssignedCount(phleb);
                return (
                  <div
                    key={phleb.id}
                    className="bg-white rounded-xl border border-slate-200 overflow-hidden"
                  >
                    {/* Phleb Header */}
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600">
                            {phleb.phlebName
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)}
                          </div>
                          <div
                            className={cn(
                              "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white",
                              phlebStatusColor(phleb.status ?? "AVAILABLE")
                            )}
                          />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{phleb.phlebName}</p>
                          <p className="text-xs text-slate-500">{phleb.shiftStart} – {phleb.shiftEnd}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Slots</p>
                        <p className="text-sm font-bold text-slate-700">
                          {assigned}/{phleb.maxSlotsPerDay}
                        </p>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="px-4 py-4 text-center">
                      <p className="text-xs text-slate-400">
                        {assigned === 0 ? "No collections assigned" : `${assigned} collection${assigned !== 1 ? "s" : ""} assigned`}
                      </p>
                      {phleb.notes && (
                        <p className="text-xs text-slate-500 mt-1">{phleb.notes}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── All Collections Table ──────────────────────────────────────── */}
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            All Home Collections Today
          </h2>

          {(collections ?? []).length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <Home className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No home collections for today</p>
              <p className="text-xs text-slate-400 mt-1">
                Click &ldquo;New Booking&rdquo; to schedule a home collection
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-left">
                      <th className="px-4 py-3 font-semibold text-slate-600">Patient</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">Slot</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">Address</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">Phlebotomist</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(collections ?? []).map((c) => {
                      const sc = statusConfig(c.status);
                      const late = isLate(c);
                      return (
                        <tr
                          key={c.id}
                          className={cn("hover:bg-slate-50 transition", late && "bg-red-50/30")}
                        >
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-800">{c.patientName}</p>
                            <p className="text-xs text-slate-500">{c.phone}</p>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{c.preferredSlot}</td>
                          <td className="px-4 py-3">
                            <p className="text-slate-600 truncate max-w-[200px]">{c.address}</p>
                            <p className="text-xs text-slate-400">
                              {c.city} {c.pincode}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {c.phlebotomistName ?? (
                              <span className="text-slate-400 italic">Unassigned</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                "text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1 w-fit",
                                late ? "bg-red-100 text-red-700" : sc.bg,
                                late ? "" : sc.text
                              )}
                            >
                              <span
                                className={cn(
                                  "h-1.5 w-1.5 rounded-full",
                                  late ? "bg-red-500" : sc.dot
                                )}
                              />
                              {late ? "Late" : sc.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              {c.status === "SCHEDULED" && (
                                <button
                                  onClick={() =>
                                    updateStatusMutation.mutate({
                                      id: c.id,
                                      status: "EN_ROUTE",
                                    })
                                  }
                                  className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 transition"
                                >
                                  En Route
                                </button>
                              )}
                              {c.status === "EN_ROUTE" && (
                                <button
                                  onClick={() =>
                                    updateStatusMutation.mutate({
                                      id: c.id,
                                      status: "ARRIVED",
                                    })
                                  }
                                  className="px-2 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 rounded-md hover:bg-indigo-100 transition"
                                >
                                  Arrived
                                </button>
                              )}
                              {(c.status === "EN_ROUTE" || c.status === "ARRIVED") && (
                                <button
                                  onClick={() =>
                                    updateStatusMutation.mutate({
                                      id: c.id,
                                      status: "COLLECTED",
                                    })
                                  }
                                  className="px-2 py-1 text-xs font-medium text-green-700 bg-green-50 rounded-md hover:bg-green-100 transition"
                                >
                                  Collected
                                </button>
                              )}
                              {c.status === "COLLECTED" && (
                                <button
                                  onClick={() =>
                                    updateStatusMutation.mutate({
                                      id: c.id,
                                      status: "DISPATCHED",
                                    })
                                  }
                                  className="px-2 py-1 text-xs font-medium text-purple-700 bg-purple-50 rounded-md hover:bg-purple-100 transition"
                                >
                                  Dispatched
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── New Booking Slide-over ─────────────────────────────────────────── */}
      {showBookingForm && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
          <div className="bg-white w-full max-w-lg shadow-2xl flex flex-col h-full animate-in slide-in-from-right">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Home className="h-5 w-5 text-blue-600" />
                New Home Collection Booking
              </h2>
              <button
                onClick={resetForm}
                className="p-1 text-slate-400 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Patient Phone Lookup */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Patient Phone
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={phoneSearch}
                    onChange={(e) => {
                      setPhoneSearch(e.target.value);
                      setSelectedPatient(null);
                    }}
                    placeholder="Enter phone to lookup patient"
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {isSearching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />
                  )}
                </div>

                {/* Patient search results */}
                {patientResults && patientResults.length > 0 && !selectedPatient && (
                  <div className="mt-1.5 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {patientResults.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => selectPatient(p)}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 transition border-b border-slate-50 last:border-0"
                      >
                        <p className="text-sm font-medium text-slate-800">{p.fullName}</p>
                        <p className="text-xs text-slate-500">{p.phone}</p>
                      </button>
                    ))}
                  </div>
                )}

                {selectedPatient && (
                  <div className="mt-2 flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-green-800">
                        {selectedPatient.fullName}
                      </p>
                      <p className="text-xs text-green-600">{selectedPatient.phone}</p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedPatient(null);
                        setPhoneSearch("");
                      }}
                      className="ml-auto text-green-500 hover:text-green-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Collection Date + Preferred Slot */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Collection Date
                  </label>
                  <input
                    type="date"
                    value={bookingForm.collectionDate}
                    onChange={(e) =>
                      setBookingForm((f) => ({ ...f, collectionDate: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Preferred Slot
                  </label>
                  <select
                    value={bookingForm.preferredSlot}
                    onChange={(e) =>
                      setBookingForm((f) => ({ ...f, preferredSlot: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="Morning">Morning (7 AM - 10 AM)</option>
                    <option value="Mid-morning">Mid-morning (10 AM - 12 PM)</option>
                    <option value="Afternoon">Afternoon (12 PM - 3 PM)</option>
                    <option value="Evening">Evening (3 PM - 6 PM)</option>
                  </select>
                </div>
              </div>

              {/* Full Address */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Full Address
                </label>
                <textarea
                  value={bookingForm.address}
                  onChange={(e) =>
                    setBookingForm((f) => ({ ...f, address: e.target.value }))
                  }
                  rows={2}
                  placeholder="House/flat no., street, landmark"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              {/* City + Pincode */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={bookingForm.city}
                    onChange={(e) =>
                      setBookingForm((f) => ({ ...f, city: e.target.value }))
                    }
                    placeholder="City"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Pincode
                  </label>
                  <input
                    type="text"
                    value={bookingForm.pincode}
                    onChange={(e) =>
                      setBookingForm((f) => ({ ...f, pincode: e.target.value }))
                    }
                    placeholder="Pincode"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Tests Requested */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Tests Requested
                </label>
                <input
                  type="text"
                  value={bookingForm.testsRequested}
                  onChange={(e) =>
                    setBookingForm((f) => ({ ...f, testsRequested: e.target.value }))
                  }
                  placeholder="e.g., CBC, Lipid Profile, TSH"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Assign Phlebotomist */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Assign Phlebotomist
                </label>
                <select
                  value={bookingForm.phlebotomistId}
                  onChange={(e) =>
                    setBookingForm((f) => ({ ...f, phlebotomistId: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="">Select phlebotomist</option>
                  {(availablePhlebs ?? []).map((p) => (
                    <option key={p.id} value={p.phlebId}>
                      {p.phlebName} ({p.slotsAvailable} slots available)
                    </option>
                  ))}
                </select>
              </div>

              {/* Home Collection Fee */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Home Collection Fee
                </label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="number"
                    value={bookingForm.fee}
                    onChange={(e) =>
                      setBookingForm((f) => ({ ...f, fee: e.target.value }))
                    }
                    placeholder="0"
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                onClick={resetForm}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleBookSubmit}
                disabled={!selectedPatient || bookMutation.isPending}
                className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {bookMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Book &amp; Notify Patient
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
