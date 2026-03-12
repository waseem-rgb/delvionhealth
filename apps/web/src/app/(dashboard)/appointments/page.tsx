"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Calendar, Clock, Filter, UserCheck, Truck, XCircle, Bell,
  X, Search, Loader2, MapPin, User, TestTube2, ChevronRight,
} from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface Appointment {
  id: string;
  scheduledAt: string;
  scheduledSlot: string | null;
  type: string;
  status: string;
  notes: string | null;
  reminderSent: boolean;
  patientName?: string | null;
  phlebName?: string | null;
  requestedTestIds?: string | null;
  homeAddress?: string | null;
  homeCity?: string | null;
  patient: { firstName: string; lastName: string; mrn: string; phone: string | null } | null;
  branch: { name: string } | null;
}

interface PatientResult {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string;
  age: number;
  gender: string;
  address?: string | null;
  city?: string | null;
  pincode?: string | null;
}

interface TestItem {
  id: string;
  name: string;
  code: string;
  price: number;
  category: string;
}

interface Phlebotomist {
  id: string;
  firstName: string;
  lastName: string;
  appointmentCount?: number;
}

interface AppointmentStats {
  SCHEDULED: number;
  CONFIRMED: number;
  EN_ROUTE: number;
  COLLECTED: number;
}

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: "bg-blue-100 text-blue-700",
  CONFIRMED: "bg-green-100 text-green-700",
  EN_ROUTE: "bg-amber-100 text-amber-700",
  COLLECTED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-red-100 text-red-600",
  NO_SHOW: "bg-rose-100 text-rose-600",
};

const SLOT_LABELS: Record<string, string> = {
  MORNING: "Morning (6–10am)",
  AFTERNOON: "Afternoon (10am–2pm)",
  EVENING: "Evening (2–6pm)",
};

// ── New Appointment Drawer ────────────────────────────────────────────────────

function NewAppointmentDrawer({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  // Section 1 — Patient Search
  const [patientSearchMode, setPatientSearchMode] = useState<"phone" | "name">("phone");
  const [patientQuery, setPatientQuery] = useState("");
  const [patientResults, setPatientResults] = useState<PatientResult[]>([]);
  const [patientSearching, setPatientSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientResult | null>(null);
  const patientTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Section 2 — Tests
  const [testQuery, setTestQuery] = useState("");
  const [testResults, setTestResults] = useState<TestItem[]>([]);
  const [testSearching, setTestSearching] = useState(false);
  const [selectedTests, setSelectedTests] = useState<TestItem[]>([]);
  const testTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Section 3 — Collection Address
  const [addr1, setAddr1] = useState("");
  const [addr2, setAddr2] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");
  const [landmark, setLandmark] = useState("");
  const [useRegistered, setUseRegistered] = useState(false);

  // Section 4 — Schedule
  const today = new Date();
  const dateOptions = Array.from({ length: 8 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d.toISOString().split("T")[0];
  });
  const [scheduledDate, setScheduledDate] = useState(dateOptions[0]);
  const [slot, setSlot] = useState<"MORNING" | "AFTERNOON" | "EVENING">("MORNING");
  const [specificTime, setSpecificTime] = useState("");

  // Section 5 — Phlebotomist
  const [phlebotomists, setPhlebotomists] = useState<Phlebotomist[]>([]);
  const [selectedPhlebId, setSelectedPhlebId] = useState("");
  const [phlebLoading, setPhlebLoading] = useState(false);

  // Section 6 — Notes
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);

  // Load phlebotomists on mount
  useEffect(() => {
    setPhlebLoading(true);
    api.get("/users?role=PHLEBOTOMIST&limit=50")
      .then((res) => {
        const data = (res.data?.data?.data ?? res.data?.data ?? res.data ?? []) as Phlebotomist[];
        setPhlebotomists(Array.isArray(data) ? data : []);
      })
      .catch(() => setPhlebotomists([]))
      .finally(() => setPhlebLoading(false));
  }, []);

  // Patient search
  const searchPatient = useCallback((q: string) => {
    setPatientQuery(q);
    if (patientTimer.current) clearTimeout(patientTimer.current);
    const minLen = patientSearchMode === "phone" ? 4 : 2;
    if (q.length < minLen) { setPatientResults([]); return; }
    patientTimer.current = setTimeout(async () => {
      setPatientSearching(true);
      try {
        const endpoint = patientSearchMode === "phone"
          ? `/patients/search/phone?q=${encodeURIComponent(q)}`
          : `/patients/search?q=${encodeURIComponent(q)}`;
        const res = await api.get<{ data: PatientResult[] }>(endpoint);
        const results = Array.isArray(res.data.data) ? res.data.data : [];
        setPatientResults(results);
      } catch {
        setPatientResults([]);
      } finally {
        setPatientSearching(false);
      }
    }, 400);
  }, [patientSearchMode]);

  // Test search (debounced)
  const searchTests = useCallback((q: string) => {
    setTestQuery(q);
    if (testTimer.current) clearTimeout(testTimer.current);
    if (q.length < 2) { setTestResults([]); return; }
    testTimer.current = setTimeout(async () => {
      setTestSearching(true);
      try {
        const res = await api.get(`/test-catalog/search?q=${encodeURIComponent(q)}&limit=20`);
        const data = (res.data?.data ?? res.data ?? []) as TestItem[];
        setTestResults(Array.isArray(data) ? data : []);
      } catch {
        setTestResults([]);
      } finally {
        setTestSearching(false);
      }
    }, 300);
  }, []);

  // Auto-fill address from patient
  useEffect(() => {
    if (useRegistered && selectedPatient) {
      setAddr1(selectedPatient.address ?? "");
      setCity(selectedPatient.city ?? "");
      setPincode(selectedPatient.pincode ?? "");
    }
  }, [useRegistered, selectedPatient]);

  // Auto-assign phlebotomist (lowest count)
  const autoAssign = useCallback(() => {
    if (phlebotomists.length === 0) return;
    const sorted = [...phlebotomists].sort((a, b) => (a.appointmentCount ?? 0) - (b.appointmentCount ?? 0));
    setSelectedPhlebId(sorted[0].id);
    toast.success(`Auto-assigned: ${sorted[0].firstName} ${sorted[0].lastName}`);
  }, [phlebotomists]);

  const runningTotal = selectedTests.reduce((s, t) => s + t.price, 0);

  const handleSubmit = useCallback(async () => {
    if (!selectedPatient) { toast.error("Please select a patient"); return; }
    if (!addr1.trim() || !city.trim() || !pincode.trim()) { toast.error("Address line 1, city and pincode are required"); return; }

    setSubmitting(true);
    try {
      const scheduledAt = specificTime
        ? new Date(`${scheduledDate}T${specificTime}:00`).toISOString()
        : new Date(`${scheduledDate}T${slot === "MORNING" ? "07" : slot === "AFTERNOON" ? "11" : "15"}:00:00`).toISOString();

      await api.post("/appointments", {
        patientId: selectedPatient.id,
        tests: selectedTests.map((t) => t.id),
        collectionAddress: { line1: addr1, line2: addr2, city, pincode, landmark },
        scheduledDate,
        slot,
        scheduledAt,
        phlebotomistId: selectedPhlebId || undefined,
        notes: notes || undefined,
        type: "HOME_COLLECTION",
        isHomeCollection: true,
        homeAddress: addr1,
        homeCity: city,
        homePincode: pincode,
        homeSlot: slot,
        phlebName: selectedPhlebId
          ? phlebotomists.find((p) => p.id === selectedPhlebId)
              ? `${phlebotomists.find((p) => p.id === selectedPhlebId)!.firstName} ${phlebotomists.find((p) => p.id === selectedPhlebId)!.lastName}`
              : undefined
          : undefined,
      });

      toast.success(`Appointment scheduled for ${scheduledDate} ${SLOT_LABELS[slot]}`);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to schedule appointment";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }, [selectedPatient, addr1, addr2, city, pincode, landmark, scheduledDate, slot, specificTime, selectedTests, selectedPhlebId, notes, phlebotomists, onSuccess, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-xl h-full flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
          <h2 className="text-lg font-bold text-slate-900">New Home Collection Appointment</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-100 text-slate-400"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section 1: Patient Search */}
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-3">1. Patient Search</p>
            <div className="flex gap-2 mb-3">
              {(["phone", "name"] as const).map((m) => (
                <button key={m} onClick={() => { setPatientSearchMode(m); setPatientQuery(""); setPatientResults([]); }}
                  className={cn("px-3 py-1.5 text-xs font-medium rounded-full border transition",
                    patientSearchMode === m ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 text-slate-500 hover:border-slate-300"
                  )}>
                  By {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
            {selectedPatient ? (
              <div className="flex items-center justify-between border border-green-200 bg-green-50 rounded-lg px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-green-900">{selectedPatient.firstName} {selectedPatient.lastName}</p>
                  <p className="text-xs text-green-600">{selectedPatient.mrn} · {selectedPatient.phone} · {selectedPatient.age}Y/{selectedPatient.gender.charAt(0)}</p>
                </div>
                <button onClick={() => { setSelectedPatient(null); setUseRegistered(false); }} className="text-green-400 hover:text-green-600"><X size={16} /></button>
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  {patientSearching && <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />}
                  <input
                    type="text"
                    value={patientQuery}
                    onChange={(e) => searchPatient(e.target.value)}
                    placeholder={patientSearchMode === "phone" ? "Enter mobile number..." : "Search by name or MRN..."}
                    className="w-full pl-9 pr-9 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                    inputMode={patientSearchMode === "phone" ? "tel" : "text"}
                  />
                </div>
                {patientResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                    {patientResults.map((p) => (
                      <button key={p.id} onClick={() => { setSelectedPatient(p); setPatientResults([]); setPatientQuery(""); }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 border-b border-slate-50 last:border-0 text-left transition">
                        <User size={16} className="text-slate-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900">{p.fullName}</p>
                          <p className="text-xs text-slate-400">{p.mrn} · {p.phone} · {p.age}Y</p>
                        </div>
                        <ChevronRight size={14} className="text-slate-300" />
                      </button>
                    ))}
                    <button className="w-full px-4 py-3 text-sm text-blue-600 font-medium hover:bg-blue-50 border-t border-slate-100 text-left">
                      Register New Patient
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 2: Test Selection */}
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-3">2. Tests Selection</p>
            <div className="relative mb-2">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              {testSearching && <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />}
              <input
                type="text"
                value={testQuery}
                onChange={(e) => searchTests(e.target.value)}
                placeholder="Search tests by name or code..."
                className="w-full pl-9 pr-9 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
              />
            </div>
            {testResults.length > 0 && testQuery.length >= 2 && (
              <div className="border border-slate-200 rounded-lg max-h-40 overflow-y-auto mb-2">
                {testResults.map((t) => {
                  const added = selectedTests.some((s) => s.id === t.id);
                  return (
                    <button key={t.id} onClick={() => { if (!added) setSelectedTests((prev) => [...prev, t]); }}
                      disabled={added}
                      className={cn("w-full flex items-center justify-between px-3 py-2 text-sm border-b border-slate-50 last:border-0 transition",
                        added ? "bg-slate-50 text-slate-400 cursor-default" : "hover:bg-blue-50 text-slate-700")}>
                      <span className="flex items-center gap-2"><TestTube2 size={13} className="text-slate-400" />{t.name} <span className="text-xs text-slate-400">({t.code})</span></span>
                      <span className="font-medium">₹{t.price}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {selectedTests.length > 0 && (
              <div className="space-y-1.5">
                {selectedTests.map((t) => (
                  <div key={t.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                    <span className="text-sm text-slate-700">{t.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-slate-600">₹{t.price}</span>
                      <button onClick={() => setSelectedTests((prev) => prev.filter((s) => s.id !== t.id))} className="text-slate-400 hover:text-red-500"><X size={13} /></button>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-semibold pt-1 border-t border-slate-200">
                  <span className="text-slate-700">Total</span>
                  <span className="text-blue-700">₹{runningTotal}</span>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Collection Address */}
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-3">3. Collection Address</p>
            {selectedPatient && (
              <label className="flex items-center gap-2 mb-3 cursor-pointer">
                <input type="checkbox" checked={useRegistered} onChange={(e) => setUseRegistered(e.target.checked)}
                  className="w-3.5 h-3.5 accent-blue-600" />
                <span className="text-xs text-slate-500">Use registered address</span>
              </label>
            )}
            <div className="space-y-2">
              <input value={addr1} onChange={(e) => setAddr1(e.target.value)}
                placeholder="Address line 1 *"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400" />
              <input value={addr2} onChange={(e) => setAddr2(e.target.value)}
                placeholder="Address line 2"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400" />
              <div className="grid grid-cols-2 gap-2">
                <input value={city} onChange={(e) => setCity(e.target.value)}
                  placeholder="City *"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400" />
                <input value={pincode} onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
                  placeholder="Pincode *" maxLength={6}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400" />
              </div>
              <input value={landmark} onChange={(e) => setLandmark(e.target.value)}
                placeholder="Landmark (optional)"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400" />
            </div>
          </div>

          {/* Section 4: Schedule */}
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-3">4. Schedule</p>
            <div className="mb-2">
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Date</label>
              <select value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400">
                {dateOptions.map((d) => {
                  const label = d === dateOptions[0] ? "Today" : d === dateOptions[1] ? "Tomorrow" : new Date(d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
                  return <option key={d} value={d}>{label} — {d}</option>;
                })}
              </select>
            </div>
            <div className="mb-2">
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Time Slot</label>
              <div className="flex gap-2">
                {(["MORNING", "AFTERNOON", "EVENING"] as const).map((s) => (
                  <button key={s} onClick={() => setSlot(s)}
                    className={cn("flex-1 px-2 py-2 text-xs font-medium rounded-lg border transition",
                      slot === s ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500 hover:border-slate-300")}>
                    {s === "MORNING" ? "Morning" : s === "AFTERNOON" ? "Afternoon" : "Evening"}
                    <span className="block text-[10px] opacity-70">{s === "MORNING" ? "6–10am" : s === "AFTERNOON" ? "10am–2pm" : "2–6pm"}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Specific Time (optional)</label>
              <input type="time" value={specificTime} onChange={(e) => setSpecificTime(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400" />
            </div>
          </div>

          {/* Section 5: Phlebotomist */}
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-3">5. Phlebotomist Assignment</p>
            <div className="flex gap-2 mb-2">
              <select value={selectedPhlebId} onChange={(e) => setSelectedPhlebId(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400">
                <option value="">Select phlebotomist...</option>
                {phlebLoading && <option disabled>Loading...</option>}
                {phlebotomists.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} {p.lastName}{p.appointmentCount != null ? ` (${p.appointmentCount} scheduled)` : ""}
                  </option>
                ))}
              </select>
              <button onClick={autoAssign} className="px-3 py-2 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition whitespace-nowrap">
                Auto-assign
              </button>
            </div>
          </div>

          {/* Section 6: Notes */}
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-3">6. Notes</p>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special instructions or notes..."
              rows={3}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 resize-none" />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3 bg-white">
          <button onClick={onClose} className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={submitting}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition">
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Schedule Appointment
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AppointmentsPage() {
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [showNewDrawer, setShowNewDrawer] = useState(false);
  const queryClient = useQueryClient();

  const today = new Date().toISOString().split("T")[0];

  // ── Appointments list ────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ["appointments", statusFilter],
    queryFn: () =>
      api
        .get(`/appointments?limit=100${statusFilter !== "ALL" ? `&status=${statusFilter}` : ""}`)
        .then((r) => {
          const raw = r.data;
          if (Array.isArray(raw)) return raw as Appointment[];
          if (Array.isArray(raw?.data)) return raw.data as Appointment[];
          return [] as Appointment[];
        }),
    refetchInterval: 30000,
  });

  // ── Today's stats ────────────────────────────────────────────────────────────
  const { data: todayData } = useQuery({
    queryKey: ["appointments-today"],
    queryFn: () =>
      api
        .get(`/appointments?limit=500&date=${today}`)
        .then((r) => {
          const raw = r.data;
          if (Array.isArray(raw)) return raw as Appointment[];
          if (Array.isArray(raw?.data)) return raw.data as Appointment[];
          return [] as Appointment[];
        }),
    refetchInterval: 30000,
  });

  const stats: AppointmentStats = {
    SCHEDULED: (todayData ?? []).filter((a) => a.status === "SCHEDULED").length,
    CONFIRMED: (todayData ?? []).filter((a) => a.status === "CONFIRMED").length,
    EN_ROUTE: (todayData ?? []).filter((a) => a.status === "EN_ROUTE").length,
    COLLECTED: (todayData ?? []).filter((a) => a.status === "COLLECTED").length,
  };

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/appointments/${id}/status`, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
      void queryClient.invalidateQueries({ queryKey: ["appointments-today"] });
    },
  });

  const reminderMutation = useMutation({
    mutationFn: (id: string) => api.post(`/appointments/${id}/remind`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["appointments"] }),
  });

  const appointments = data ?? [];

  const todayLabel = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Appointments</h1>
          <p className="text-slate-500 text-sm mt-0.5">{todayLabel}</p>
        </div>
        <button
          onClick={() => setShowNewDrawer(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
        >
          <Plus className="w-4 h-4" /> New Appointment
        </button>
      </div>

      {/* Stats cards — today's counts, auto-refresh every 30s */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Scheduled", status: "SCHEDULED" as const, color: "bg-blue-50 text-blue-700 border-blue-100" },
          { label: "Confirmed", status: "CONFIRMED" as const, color: "bg-green-50 text-green-700 border-green-100" },
          { label: "En Route", status: "EN_ROUTE" as const, color: "bg-amber-50 text-amber-700 border-amber-100" },
          { label: "Collected", status: "COLLECTED" as const, color: "bg-emerald-50 text-emerald-700 border-emerald-100" },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border px-4 py-3 ${s.color}`}>
            <div className="text-2xl font-bold">{stats[s.status]}</div>
            <div className="text-xs font-medium">{s.label}</div>
            <div className="text-[10px] opacity-60 mt-0.5">Today</div>
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Patient</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">MRN / Phone</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Tests</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Date / Slot</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Phlebotomist</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((appt) => {
                  const patientName = appt.patient
                    ? `${appt.patient.firstName} ${appt.patient.lastName}`
                    : appt.patientName ?? "—";
                  const mrn = appt.patient?.mrn ?? "—";
                  const phone = appt.patient?.phone ?? "—";
                  const phlebName = appt.phlebName ?? "—";
                  const slot = appt.scheduledSlot ?? "";
                  const dateStr = new Date(appt.scheduledAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
                  const timeStr = new Date(appt.scheduledAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

                  let testNames = "";
                  try {
                    const ids = appt.requestedTestIds ? JSON.parse(appt.requestedTestIds) : [];
                    testNames = Array.isArray(ids) && ids.length > 0 ? `${ids.length} test${ids.length !== 1 ? "s" : ""}` : "—";
                  } catch {
                    testNames = appt.requestedTestIds ? "Tests" : "—";
                  }

                  return (
                    <tr key={appt.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{patientName}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        <div>{mrn}</div>
                        <div>{phone}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{testNames}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-slate-700 text-xs">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {dateStr} · {slot ? SLOT_LABELS[slot] ?? slot : timeStr}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{phlebName}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[appt.status] ?? "bg-slate-100 text-slate-600"}`}>
                          {appt.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {/* SCHEDULED: Confirm, Cancel, No Show */}
                          {appt.status === "SCHEDULED" && (
                            <>
                              <button
                                onClick={() => statusMutation.mutate({ id: appt.id, status: "CONFIRMED" })}
                                disabled={statusMutation.isPending}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-md hover:bg-green-100 transition disabled:opacity-50"
                              >
                                <UserCheck className="w-3 h-3" /> Confirm
                              </button>
                              <button
                                onClick={() => setCancelId(appt.id)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition"
                              >
                                <XCircle className="w-3 h-3" /> Cancel
                              </button>
                              <button
                                onClick={() => statusMutation.mutate({ id: appt.id, status: "NO_SHOW" })}
                                disabled={statusMutation.isPending}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-md hover:bg-rose-100 transition disabled:opacity-50"
                              >
                                No Show
                              </button>
                            </>
                          )}

                          {/* CONFIRMED: Mark En Route, Cancel, No Show */}
                          {appt.status === "CONFIRMED" && (
                            <>
                              <button
                                onClick={() => statusMutation.mutate({ id: appt.id, status: "EN_ROUTE" })}
                                disabled={statusMutation.isPending}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100 transition disabled:opacity-50"
                              >
                                <Truck className="w-3 h-3" /> En Route
                              </button>
                              <button
                                onClick={() => setCancelId(appt.id)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition"
                              >
                                <XCircle className="w-3 h-3" /> Cancel
                              </button>
                              <button
                                onClick={() => statusMutation.mutate({ id: appt.id, status: "NO_SHOW" })}
                                disabled={statusMutation.isPending}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-md hover:bg-rose-100 transition disabled:opacity-50"
                              >
                                No Show
                              </button>
                            </>
                          )}

                          {/* EN_ROUTE: Mark Collected, No Show */}
                          {appt.status === "EN_ROUTE" && (
                            <>
                              <button
                                onClick={() => statusMutation.mutate({ id: appt.id, status: "COLLECTED" })}
                                disabled={statusMutation.isPending}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 transition disabled:opacity-50"
                              >
                                Collected
                              </button>
                              <button
                                onClick={() => statusMutation.mutate({ id: appt.id, status: "NO_SHOW" })}
                                disabled={statusMutation.isPending}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-md hover:bg-rose-100 transition disabled:opacity-50"
                              >
                                No Show
                              </button>
                            </>
                          )}

                          {/* Send reminder for active appointments */}
                          {["SCHEDULED", "CONFIRMED"].includes(appt.status) && (
                            <button
                              onClick={() => reminderMutation.mutate(appt.id)}
                              disabled={reminderMutation.isPending}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition disabled:opacity-50"
                              title="Send Reminder"
                            >
                              <Bell className="w-3 h-3" />
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

      {/* New Appointment Drawer */}
      {showNewDrawer && (
        <NewAppointmentDrawer
          onClose={() => setShowNewDrawer(false)}
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ["appointments"] });
            void queryClient.invalidateQueries({ queryKey: ["appointments-today"] });
          }}
        />
      )}
    </div>
  );
}
