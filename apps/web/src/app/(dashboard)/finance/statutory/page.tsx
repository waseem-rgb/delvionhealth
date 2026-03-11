"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import api from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Banknote,
  Shield,
  Users,
  FileText,
  Loader2,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  Plus,
  Play,
  Check,
  Send,
  TrendingUp,
  IndianRupee,
} from "lucide-react";

// ── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const TABS = ["Compliance Calendar","Payroll","TDS","PF & ESIC","Employees"] as const;
type Tab = (typeof TABS)[number];

const unwrap = (res: any) => res.data?.data ?? res.data;

function numberToWords(n: number): string {
  if (n === 0) return "Zero";
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  const scales = ["","Thousand","Lakh","Crore"];
  const divisors = [100, 100, 100];
  if (n < 0) return "Minus " + numberToWords(-n);
  let num = Math.round(n);
  if (num < 20) return ones[num];
  if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? " " + ones[num % 10] : "");
  // Indian system: last 3 digits then groups of 2
  const parts: number[] = [];
  parts.push(num % 1000); num = Math.floor(num / 1000);
  while (num > 0) { parts.push(num % 100); num = Math.floor(num / 100); }
  return parts.map((p, i) => {
    if (p === 0) return "";
    let w = "";
    if (p >= 100) { w += ones[Math.floor(p / 100)] + " Hundred"; p = p % 100; if (p > 0) w += " and "; }
    if (p >= 20) { w += tens[Math.floor(p / 10)]; if (p % 10) w += " " + ones[p % 10]; }
    else if (p > 0) { w += ones[p]; }
    return w + (scales[i] ? " " + scales[i] : "");
  }).reverse().filter(Boolean).join(" ");
}

function statusColor(s: string) {
  switch (s?.toUpperCase()) {
    case "PAID": return "bg-green-100 text-green-700 border-green-200";
    case "PENDING": return "bg-yellow-100 text-yellow-700 border-yellow-200";
    case "OVERDUE": return "bg-red-100 text-red-700 border-red-200";
    case "WAIVED": return "bg-slate-100 text-slate-600 border-slate-200";
    case "APPROVED": return "bg-blue-100 text-blue-700 border-blue-200";
    case "POSTED": return "bg-teal-100 text-teal-700 border-teal-200";
    case "DRAFT": return "bg-orange-100 text-orange-700 border-orange-200";
    default: return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

function calendarDotColor(dueDate: string, status: string) {
  const now = new Date(); const due = new Date(dueDate);
  if (status === "PAID") return "bg-green-500";
  if (due < now) return "bg-red-500";
  const diff = (due.getTime() - now.getTime()) / 86400000;
  if (diff <= 7) return "bg-orange-500";
  return "bg-blue-500";
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function StatutoryCompliancePage() {
  const [tab, setTab] = useState<Tab>("Compliance Calendar");
  const tabIcons = [CalendarDays, Banknote, FileText, Shield, Users];

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Statutory Compliance & Payroll</h1>
        <p className="text-slate-500 text-sm mt-1">Manage payroll runs, TDS, PF, ESIC, and compliance obligations</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl p-1 border border-slate-200 w-fit">
        {TABS.map((t, i) => {
          const Icon = tabIcons[i];
          return (
            <button key={t} onClick={() => setTab(t)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t ? "bg-teal-500/20 text-teal-600 border border-teal-500/30" : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"}`}>
              <Icon size={16} />{t}
            </button>
          );
        })}
      </div>

      {tab === "Compliance Calendar" && <ComplianceCalendarTab />}
      {tab === "Payroll" && <PayrollTab />}
      {tab === "TDS" && <TDSTab />}
      {tab === "PF & ESIC" && <PFESICTab />}
      {tab === "Employees" && <EmployeesTab />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 1: COMPLIANCE CALENDAR
// ══════════════════════════════════════════════════════════════════════════════

function ComplianceCalendarTab() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [payModal, setPayModal] = useState<any>(null);
  const [payForm, setPayForm] = useState({ challanNumber: "", paymentDate: "", paymentMode: "NEFT", amount: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/finance/compliance-calendar?month=${month}&year=${year}`);
      setItems(unwrap(res) ?? []);
    } catch { setItems([]); }
    setLoading(false);
  }, [month, year]);

  useEffect(() => { load(); }, [load]);

  const prev = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const next = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  // Calendar grid
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const dueDatesByDay = useMemo(() => {
    const map: Record<number, any[]> = {};
    (items || []).forEach((it: any) => {
      const d = new Date(it.dueDate);
      if (d.getMonth() + 1 === month && d.getFullYear() === year) {
        const day = d.getDate();
        if (!map[day]) map[day] = [];
        map[day].push(it);
      }
    });
    return map;
  }, [items, month, year]);

  const recordPayment = async () => {
    if (!payModal) return;
    setSaving(true);
    try {
      await api.post("/finance/statutory-payments", {
        id: payModal.id,
        challanNumber: payForm.challanNumber,
        paymentDate: payForm.paymentDate,
        paymentMode: payForm.paymentMode,
        amount: parseFloat(payForm.amount) || payModal.amount,
      });
      setPayModal(null);
      setPayForm({ challanNumber: "", paymentDate: "", paymentMode: "NEFT", amount: "" });
      load();
    } catch { /* toast */ }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      {/* Month Navigation */}
      <div className="flex items-center justify-between bg-white rounded-xl p-4 border border-slate-200">
        <button onClick={prev} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"><ChevronLeft size={20} /></button>
        <h2 className="text-lg font-semibold text-slate-900">{MONTHS[month - 1]} {year}</h2>
        <button onClick={next} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"><ChevronRight size={20} /></button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-teal-500" size={32} /></div>
      ) : (
        <>
          {/* Calendar Grid */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="grid grid-cols-7 gap-1 mb-2">
              {DAYS.map(d => <div key={d} className="text-center text-xs font-medium text-slate-500 py-1">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, i) => (
                <div key={i} className={`min-h-[72px] rounded-lg p-2 ${day ? "bg-white border border-slate-200 hover:bg-slate-50 transition-colors" : ""}`}>
                  {day && (
                    <>
                      <span className="text-xs text-slate-500">{day}</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(dueDatesByDay[day] || []).map((it: any, j: number) => (
                          <span key={j} className={`w-2 h-2 rounded-full ${calendarDotColor(it.dueDate, it.status)}`} title={`${it.obligationType} — ${it.status}`} />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-3 text-xs text-slate-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Overdue</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" /> Due Soon</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Paid</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Upcoming</span>
            </div>
          </div>

          {/* List View */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200"><h3 className="text-slate-900 font-semibold">Obligations</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    {["Obligation Type","Period","Amount","Due Date","Status","Actions"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-10 text-slate-500">No obligations for this period</td></tr>
                  ) : items.map((it: any) => (
                    <tr key={it.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-900">{it.obligationType}</td>
                      <td className="px-4 py-3 text-slate-700">{it.period}</td>
                      <td className="px-4 py-3 text-slate-900 font-medium">{formatCurrency(it.amount || 0)}</td>
                      <td className="px-4 py-3 text-slate-700">{formatDate(it.dueDate)}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium border ${statusColor(it.status)}`}>{it.status}</span></td>
                      <td className="px-4 py-3">
                        {it.status !== "PAID" && it.status !== "WAIVED" && (
                          <button onClick={() => { setPayModal(it); setPayForm(f => ({ ...f, amount: String(it.amount || "") })); }} className="px-3 py-1.5 bg-teal-500/20 text-teal-600 rounded-lg text-xs font-medium hover:bg-teal-500/30 transition-colors">Record Payment</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Payment Modal */}
      {payModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setPayModal(null)}>
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-slate-900 font-semibold text-lg">Record Payment</h3>
              <button onClick={() => setPayModal(null)} className="text-slate-500 hover:text-slate-900"><X size={20} /></button>
            </div>
            <p className="text-slate-500 text-sm">{payModal.obligationType} — {payModal.period}</p>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-slate-500 block mb-1">Challan Number</label>
                <input value={payForm.challanNumber} onChange={e => setPayForm(f => ({ ...f, challanNumber: e.target.value }))} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-teal-500" />
              </div>
              <div>
                <label className="text-sm text-slate-500 block mb-1">Payment Date</label>
                <input type="date" value={payForm.paymentDate} onChange={e => setPayForm(f => ({ ...f, paymentDate: e.target.value }))} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-teal-500" />
              </div>
              <div>
                <label className="text-sm text-slate-500 block mb-1">Payment Mode</label>
                <select value={payForm.paymentMode} onChange={e => setPayForm(f => ({ ...f, paymentMode: e.target.value }))} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-teal-500">
                  <option value="NEFT">NEFT</option><option value="RTGS">RTGS</option><option value="CHEQUE">Cheque</option><option value="CASH">Cash</option><option value="UPI">UPI</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-500 block mb-1">Amount</label>
                <input type="number" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-teal-500" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setPayModal(null)} className="flex-1 px-4 py-2 bg-white hover:bg-slate-50 text-slate-600 rounded-lg text-sm border border-slate-200 transition-colors">Cancel</button>
              <button onClick={recordPayment} disabled={saving} className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 2: PAYROLL
// ══════════════════════════════════════════════════════════════════════════════

function PayrollTab() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [run, setRun] = useState<any>(null);
  const [lines, setLines] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [posting, setPosting] = useState(false);
  const [payslip, setPayslip] = useState<any>(null);
  const [lopEdits, setLopEdits] = useState<Record<string, number>>({});

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await api.post("/finance/payroll/run", { month, year });
      const data = unwrap(res);
      setRun(data);
      if (data?.id) await loadRun(data.id);
    } catch { /* error */ }
    setGenerating(false);
  };

  const loadRun = async (id: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/finance/payroll/${id}`);
      const data = unwrap(res);
      setRun(data);
      setLines(data?.lines ?? data?.payrollLines ?? []);
    } catch { /* error */ }
    setLoading(false);
  };

  const approve = async () => {
    if (!run?.id) return;
    setApproving(true);
    try { await api.post(`/finance/payroll/${run.id}/approve`); await loadRun(run.id); } catch {}
    setApproving(false);
  };

  const post = async () => {
    if (!run?.id) return;
    setPosting(true);
    try { await api.post(`/finance/payroll/${run.id}/post`); await loadRun(run.id); } catch {}
    setPosting(false);
  };

  const viewPayslip = async (employeeId: string) => {
    if (!run?.id) return;
    try {
      const res = await api.get(`/finance/payroll/${run.id}/payslip/${employeeId}`);
      setPayslip(unwrap(res));
    } catch {}
  };

  const totals = useMemo(() => {
    const t = { gross: 0, deductions: 0, net: 0, tds: 0, pf: 0, esic: 0 };
    lines.forEach((l: any) => {
      t.gross += l.grossSalary || 0;
      t.deductions += l.totalDeductions || 0;
      t.net += l.netSalary || 0;
      t.tds += l.tds || 0;
      t.pf += (l.pfEmployee || 0);
      t.esic += (l.esicEmployee || 0);
    });
    return t;
  }, [lines]);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center gap-4 bg-white rounded-xl p-4 border border-slate-200 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-500">Month:</label>
          <select value={month} onChange={e => setMonth(+e.target.value)} className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-teal-500">
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-500">Year:</label>
          <select value={year} onChange={e => setYear(+e.target.value)} className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-teal-500">
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button onClick={generate} disabled={generating} className="ml-auto px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-500 transition-colors disabled:opacity-50 flex items-center gap-2">
          {generating ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />} Generate Payroll
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-teal-500" size={32} /></div>
      ) : run ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: "Total Gross", value: totals.gross, icon: IndianRupee, color: "text-emerald-500" },
              { label: "Total Deductions", value: totals.deductions, icon: TrendingUp, color: "text-red-500" },
              { label: "Total Net", value: totals.net, icon: Banknote, color: "text-teal-600" },
              { label: "Total TDS", value: totals.tds, icon: FileText, color: "text-orange-500" },
              { label: "Total PF", value: totals.pf, icon: Shield, color: "text-blue-500" },
              { label: "Total ESIC", value: totals.esic, icon: Users, color: "text-violet-500" },
            ].map(c => (
              <div key={c.label} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <c.icon size={16} className={c.color} />
                  <span className="text-xs text-slate-500">{c.label}</span>
                </div>
                <p className="text-slate-900 font-semibold text-lg">{formatCurrency(c.value)}</p>
              </div>
            ))}
          </div>

          {/* Status & Actions */}
          <div className="flex items-center gap-3 bg-white rounded-xl p-4 border border-slate-200">
            <span className="text-sm text-slate-500">Status:</span>
            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusColor(run.status)}`}>{run.status}</span>
            <div className="ml-auto flex gap-3">
              {run.status === "DRAFT" && (
                <button onClick={approve} disabled={approving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-500 transition-colors disabled:opacity-50 flex items-center gap-2">
                  {approving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Approve
                </button>
              )}
              {run.status === "APPROVED" && (
                <button onClick={post} disabled={posting} className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-500 transition-colors disabled:opacity-50 flex items-center gap-2">
                  {posting ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />} Post to Ledgers
                </button>
              )}
            </div>
          </div>

          {/* Payroll Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    {["Employee","Code","Basic","HRA","Other","Gross","PF(Emp)","ESIC(Emp)","PT","TDS","LOP Days","LOP Ded.","Total Ded.","Net Salary",""].map(h => (
                      <th key={h} className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l: any) => (
                    <tr key={l.id || l.employeeId} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2.5 text-slate-900 text-xs whitespace-nowrap">{l.employeeName || l.employee?.name || "—"}</td>
                      <td className="px-3 py-2.5 text-slate-700 text-xs">{l.employeeCode || l.employee?.code || "—"}</td>
                      <td className="px-3 py-2.5 text-slate-900 text-xs">{formatCurrency(l.basicSalary || 0)}</td>
                      <td className="px-3 py-2.5 text-slate-900 text-xs">{formatCurrency(l.hra || 0)}</td>
                      <td className="px-3 py-2.5 text-slate-900 text-xs">{formatCurrency(l.otherAllowances || 0)}</td>
                      <td className="px-3 py-2.5 text-emerald-600 font-medium text-xs">{formatCurrency(l.grossSalary || 0)}</td>
                      <td className="px-3 py-2.5 text-red-600 text-xs">{formatCurrency(l.pfEmployee || 0)}</td>
                      <td className="px-3 py-2.5 text-red-600 text-xs">{formatCurrency(l.esicEmployee || 0)}</td>
                      <td className="px-3 py-2.5 text-red-600 text-xs">{formatCurrency(l.pt || 0)}</td>
                      <td className="px-3 py-2.5 text-red-600 text-xs">{formatCurrency(l.tds || 0)}</td>
                      <td className="px-3 py-2.5 text-xs">
                        <input
                          type="number"
                          min={0}
                          value={lopEdits[l.employeeId] ?? l.lopDays ?? 0}
                          onChange={e => setLopEdits(prev => ({ ...prev, [l.employeeId]: +e.target.value }))}
                          className="w-14 bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 text-xs focus:outline-none focus:border-teal-500"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-red-600 text-xs">{formatCurrency(l.lopDeduction || 0)}</td>
                      <td className="px-3 py-2.5 text-red-600 font-medium text-xs">{formatCurrency(l.totalDeductions || 0)}</td>
                      <td className="px-3 py-2.5 text-teal-600 font-semibold text-xs">{formatCurrency(l.netSalary || 0)}</td>
                      <td className="px-3 py-2.5">
                        <button onClick={() => viewPayslip(l.employeeId)} className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-600 rounded text-xs border border-slate-200 hover:text-slate-900 transition-colors">Payslip</button>
                      </td>
                    </tr>
                  ))}
                  {lines.length > 0 && (
                    <tr className="bg-slate-100 font-semibold">
                      <td className="px-3 py-3 text-slate-900 text-xs" colSpan={5}>TOTALS</td>
                      <td className="px-3 py-3 text-emerald-600 text-xs">{formatCurrency(totals.gross)}</td>
                      <td className="px-3 py-3 text-red-600 text-xs">{formatCurrency(totals.pf)}</td>
                      <td className="px-3 py-3 text-red-600 text-xs">{formatCurrency(totals.esic)}</td>
                      <td colSpan={4} />
                      <td className="px-3 py-3 text-red-600 text-xs">{formatCurrency(totals.deductions)}</td>
                      <td className="px-3 py-3 text-teal-600 text-xs">{formatCurrency(totals.net)}</td>
                      <td />
                    </tr>
                  )}
                </tbody>
              </table>
              {lines.length === 0 && <div className="text-center py-10 text-slate-500 text-sm">No payroll lines found</div>}
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Banknote size={40} className="mx-auto text-slate-500 mb-3" />
          <p className="text-slate-500">Select month and year, then click &quot;Generate Payroll&quot; to start</p>
        </div>
      )}

      {/* Payslip Modal */}
      {payslip && <PayslipModal payslip={payslip} onClose={() => setPayslip(null)} />}
    </div>
  );
}

// ── Payslip Modal ────────────────────────────────────────────────────────────

function PayslipModal({ payslip, onClose }: { payslip: any; onClose: () => void }) {
  const earnings = [
    { label: "Basic Salary", value: payslip.basicSalary || 0 },
    { label: "HRA", value: payslip.hra || 0 },
    { label: "Conveyance Allowance", value: payslip.conveyanceAllowance || 0 },
    { label: "Medical Allowance", value: payslip.medicalAllowance || 0 },
    { label: "Special Allowance", value: payslip.specialAllowance || 0 },
    { label: "Other Allowances", value: payslip.otherAllowances || 0 },
  ];
  const totalEarnings = earnings.reduce((s, e) => s + e.value, 0);

  const deductions = [
    { label: "Provident Fund", value: payslip.pfEmployee || 0 },
    { label: "ESIC", value: payslip.esicEmployee || 0 },
    { label: "Professional Tax", value: payslip.pt || 0 },
    { label: "TDS", value: payslip.tds || 0 },
    { label: "LOP Deduction", value: payslip.lopDeduction || 0 },
  ];
  const totalDeductions = deductions.reduce((s, d) => s + d.value, 0);
  const netSalary = payslip.netSalary || (totalEarnings - totalDeductions);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-8 print:p-4" id="payslip-print">
          {/* Header */}
          <div className="text-center border-b-2 border-gray-300 pb-4 mb-6">
            <h2 className="text-xl font-bold text-gray-900">{payslip.companyName || "DELViON Health Pvt. Ltd."}</h2>
            <p className="text-sm text-slate-400 mt-1">SALARY SLIP</p>
            <p className="text-xs text-slate-500 mt-1">{MONTHS[(payslip.month || 1) - 1]} {payslip.year || new Date().getFullYear()}</p>
          </div>

          {/* Employee Details */}
          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            <div><span className="text-slate-400">Employee Name: </span><span className="font-medium text-gray-900">{payslip.employeeName || "—"}</span></div>
            <div><span className="text-slate-400">Employee Code: </span><span className="font-medium text-gray-900">{payslip.employeeCode || "—"}</span></div>
            <div><span className="text-slate-400">Designation: </span><span className="font-medium text-gray-900">{payslip.designation || "—"}</span></div>
            <div><span className="text-slate-400">PAN: </span><span className="font-medium text-gray-900">{payslip.pan || "—"}</span></div>
            <div><span className="text-slate-400">PF No: </span><span className="font-medium text-gray-900">{payslip.pfNumber || "—"}</span></div>
            <div><span className="text-slate-400">Days Worked: </span><span className="font-medium text-gray-900">{payslip.daysWorked ?? "—"}</span></div>
          </div>

          {/* Earnings & Deductions */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* Earnings */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2 mb-2">EARNINGS</h3>
              <div className="space-y-1.5">
                {earnings.map(e => (
                  <div key={e.label} className="flex justify-between text-sm">
                    <span className="text-gray-600">{e.label}</span>
                    <span className="text-gray-900 font-medium">{formatCurrency(e.value)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-2 mt-2">
                  <span className="text-gray-800">TOTAL</span>
                  <span className="text-gray-900">{formatCurrency(totalEarnings)}</span>
                </div>
              </div>
            </div>
            {/* Deductions */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2 mb-2">DEDUCTIONS</h3>
              <div className="space-y-1.5">
                {deductions.map(d => (
                  <div key={d.label} className="flex justify-between text-sm">
                    <span className="text-gray-600">{d.label}</span>
                    <span className="text-gray-900 font-medium">{formatCurrency(d.value)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-2 mt-2">
                  <span className="text-gray-800">TOTAL</span>
                  <span className="text-gray-900">{formatCurrency(totalDeductions)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Net Salary */}
          <div className="bg-gray-100 rounded-lg p-4 mb-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-700 font-semibold">NET SALARY</span>
              <span className="text-xl font-bold text-gray-900">{formatCurrency(netSalary)}</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">Rupees {numberToWords(netSalary)} Only</p>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-slate-500 italic">Computer generated salary slip — no signature required</p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 p-4 border-t border-gray-200">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm">Close</button>
          <button onClick={() => window.print()} className="px-4 py-2 bg-white text-slate-900 rounded-lg text-sm font-medium hover:bg-slate-100 flex items-center gap-2">
            <Printer size={16} /> Print
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 3: TDS
// ══════════════════════════════════════════════════════════════════════════════

function TDSTab() {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/finance/statutory-payments");
        setPayments(unwrap(res) ?? []);
      } catch { setPayments([]); }
      setLoading(false);
    })();
  }, []);

  const tdsItems = useMemo(() => (payments || []).filter((p: any) => p.obligationType?.includes("TDS") || p.type?.includes("TDS")), [payments]);

  // Group by TDS section
  const bySection = useMemo(() => {
    const map: Record<string, { total: number; count: number; items: any[] }> = {
      "Section 192 (Salary)": { total: 0, count: 0, items: [] },
      "Section 194C (Contractor)": { total: 0, count: 0, items: [] },
      "Section 194J (Professional)": { total: 0, count: 0, items: [] },
    };
    tdsItems.forEach((t: any) => {
      const name = t.obligationType || t.type || "";
      let key = "Section 192 (Salary)";
      if (name.includes("194C")) key = "Section 194C (Contractor)";
      else if (name.includes("194J")) key = "Section 194J (Professional)";
      map[key].total += t.amount || 0;
      map[key].count += 1;
      map[key].items.push(t);
    });
    return map;
  }, [tdsItems]);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-teal-500" size={32} /></div>;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(bySection).map(([section, data]) => (
          <div key={section} className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-sm text-slate-500 mb-1">{section}</p>
            <p className="text-xl font-bold text-slate-900">{formatCurrency(data.total)}</p>
            <p className="text-xs text-slate-500 mt-1">{data.count} entries</p>
          </div>
        ))}
      </div>

      {/* Monthly Breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200"><h3 className="text-slate-900 font-semibold">TDS Deductions — Monthly Breakdown</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                {["Type","Period","Amount","Due Date","Status","Challan No"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tdsItems.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-slate-500">No TDS data available</td></tr>
              ) : tdsItems.map((t: any, i: number) => (
                <tr key={t.id || i} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-900">{t.obligationType || t.type}</td>
                  <td className="px-4 py-3 text-slate-700">{t.period}</td>
                  <td className="px-4 py-3 text-slate-900 font-medium">{formatCurrency(t.amount || 0)}</td>
                  <td className="px-4 py-3 text-slate-700">{formatDate(t.dueDate)}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium border ${statusColor(t.status)}`}>{t.status}</span></td>
                  <td className="px-4 py-3 text-slate-700">{t.challanNumber || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-right">
        <p className="text-xs text-slate-500">See Compliance Calendar tab for due-date tracking and payment recording</p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 4: PF & ESIC
// ══════════════════════════════════════════════════════════════════════════════

function PFESICTab() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [empRes, payRes] = await Promise.all([
          api.get("/finance/employees"),
          api.get("/finance/statutory-payments"),
        ]);
        setEmployees(unwrap(empRes) ?? []);
        setPayments(unwrap(payRes) ?? []);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const pfEmployees = useMemo(() => (employees || []).filter((e: any) => e.pfApplicable || e.salaryStructure?.pfApplicable), [employees]);
  const esicEmployees = useMemo(() => (employees || []).filter((e: any) => e.esicApplicable || e.salaryStructure?.esicApplicable), [employees]);

  const pfPayments = useMemo(() => (payments || []).filter((p: any) => (p.obligationType || p.type || "").includes("PF")), [payments]);
  const esicPayments = useMemo(() => (payments || []).filter((p: any) => (p.obligationType || p.type || "").includes("ESIC")), [payments]);

  const pfTotalEmp = pfPayments.reduce((s: number, p: any) => s + (p.employeeContribution || p.amount / 2 || 0), 0);
  const pfTotalEr = pfPayments.reduce((s: number, p: any) => s + (p.employerContribution || p.amount / 2 || 0), 0);
  const esicTotalEmp = esicPayments.reduce((s: number, p: any) => s + (p.employeeContribution || p.amount * 0.43 || 0), 0);
  const esicTotalEr = esicPayments.reduce((s: number, p: any) => s + (p.employerContribution || p.amount * 0.57 || 0), 0);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-teal-500" size={32} /></div>;

  return (
    <div className="space-y-6">
      {/* PF Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-slate-900 font-semibold mb-4 flex items-center gap-2"><Shield size={18} className="text-blue-500" /> Provident Fund Summary</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-xs text-slate-500 mb-1">Employee Contribution</p>
              <p className="text-lg font-bold text-slate-900">{formatCurrency(pfTotalEmp)}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-xs text-slate-500 mb-1">Employer Contribution</p>
              <p className="text-lg font-bold text-slate-900">{formatCurrency(pfTotalEr)}</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-3">{pfEmployees.length} employees enrolled</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-slate-900 font-semibold mb-4 flex items-center gap-2"><Shield size={18} className="text-violet-500" /> ESIC Summary</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-xs text-slate-500 mb-1">Employee Contribution</p>
              <p className="text-lg font-bold text-slate-900">{formatCurrency(esicTotalEmp)}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-xs text-slate-500 mb-1">Employer Contribution</p>
              <p className="text-lg font-bold text-slate-900">{formatCurrency(esicTotalEr)}</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-3">{esicEmployees.length} employees enrolled</p>
        </div>
      </div>

      {/* Monthly Trend */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200"><h3 className="text-slate-900 font-semibold">Monthly Payments</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                {["Type","Period","Amount","Due Date","Status","Challan No"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...pfPayments, ...esicPayments].length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-slate-500">No PF/ESIC data available</td></tr>
              ) : [...pfPayments, ...esicPayments].map((p: any, i: number) => (
                <tr key={p.id || i} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-900">{p.obligationType || p.type}</td>
                  <td className="px-4 py-3 text-slate-700">{p.period}</td>
                  <td className="px-4 py-3 text-slate-900 font-medium">{formatCurrency(p.amount || 0)}</td>
                  <td className="px-4 py-3 text-slate-700">{formatDate(p.dueDate)}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium border ${statusColor(p.status)}`}>{p.status}</span></td>
                  <td className="px-4 py-3 text-slate-700">{p.challanNumber || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Enrolled Employees */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200"><h3 className="text-slate-900 font-semibold text-sm">PF Enrolled Employees ({pfEmployees.length})</h3></div>
          <div className="max-h-60 overflow-y-auto">
            {pfEmployees.length === 0 ? <p className="p-4 text-slate-500 text-sm">No employees enrolled</p> : pfEmployees.map((e: any, i: number) => (
              <div key={e.id || i} className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
                <span className="text-slate-900 text-sm">{e.name || `${e.firstName} ${e.lastName}`}</span>
                <span className="text-slate-500 text-xs">{e.code || e.employeeCode}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200"><h3 className="text-slate-900 font-semibold text-sm">ESIC Enrolled Employees ({esicEmployees.length})</h3></div>
          <div className="max-h-60 overflow-y-auto">
            {esicEmployees.length === 0 ? <p className="p-4 text-slate-500 text-sm">No employees enrolled</p> : esicEmployees.map((e: any, i: number) => (
              <div key={e.id || i} className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
                <span className="text-slate-900 text-sm">{e.name || `${e.firstName} ${e.lastName}`}</span>
                <span className="text-slate-500 text-xs">{e.code || e.employeeCode}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 5: EMPLOYEES (SALARY VIEW)
// ══════════════════════════════════════════════════════════════════════════════

function EmployeesTab() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<any>(null);
  const [form, setForm] = useState({
    effectiveFrom: "", basicSalary: "", hra: "", conveyanceAllowance: "", medicalAllowance: "", specialAllowance: "", otherAllowances: "",
    pfApplicable: false, esicApplicable: false, ptApplicable: false,
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/finance/employees");
      setEmployees(unwrap(res) ?? []);
    } catch { setEmployees([]); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openModal = (emp: any) => {
    const ss = emp.salaryStructure || {};
    setForm({
      effectiveFrom: ss.effectiveFrom ? ss.effectiveFrom.substring(0, 10) : new Date().toISOString().substring(0, 10),
      basicSalary: String(ss.basicSalary || ""),
      hra: String(ss.hra || ""),
      conveyanceAllowance: String(ss.conveyanceAllowance || ""),
      medicalAllowance: String(ss.medicalAllowance || ""),
      specialAllowance: String(ss.specialAllowance || ""),
      otherAllowances: String(ss.otherAllowances || ""),
      pfApplicable: ss.pfApplicable || false,
      esicApplicable: ss.esicApplicable || false,
      ptApplicable: ss.ptApplicable || false,
    });
    setModal(emp);
  };

  const grossCalc = useMemo(() => {
    return (parseFloat(form.basicSalary) || 0) + (parseFloat(form.hra) || 0) + (parseFloat(form.conveyanceAllowance) || 0) + (parseFloat(form.medicalAllowance) || 0) + (parseFloat(form.specialAllowance) || 0) + (parseFloat(form.otherAllowances) || 0);
  }, [form]);

  const saveSalary = async () => {
    if (!modal) return;
    setSaving(true);
    try {
      await api.post("/finance/salary-structures", {
        employeeId: modal.id,
        effectiveFrom: form.effectiveFrom,
        basicSalary: parseFloat(form.basicSalary) || 0,
        hra: parseFloat(form.hra) || 0,
        conveyanceAllowance: parseFloat(form.conveyanceAllowance) || 0,
        medicalAllowance: parseFloat(form.medicalAllowance) || 0,
        specialAllowance: parseFloat(form.specialAllowance) || 0,
        otherAllowances: parseFloat(form.otherAllowances) || 0,
        pfApplicable: form.pfApplicable,
        esicApplicable: form.esicApplicable,
        ptApplicable: form.ptApplicable,
      });
      setModal(null);
      load();
    } catch {}
    setSaving(false);
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-teal-500" size={32} /></div>;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-slate-900 font-semibold">Employee Salary Structures</h3>
          <span className="text-xs text-slate-500">{employees.length} employees</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                {["Employee Name","Code","Designation","Basic","HRA","Gross","PF","ESIC","PT","Actions"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-10 text-slate-500">No employees found</td></tr>
              ) : employees.map((e: any) => {
                const ss = e.salaryStructure || {};
                const gross = (ss.basicSalary || 0) + (ss.hra || 0) + (ss.conveyanceAllowance || 0) + (ss.medicalAllowance || 0) + (ss.specialAllowance || 0) + (ss.otherAllowances || 0);
                return (
                  <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-900">{e.name || `${e.firstName || ""} ${e.lastName || ""}`.trim()}</td>
                    <td className="px-4 py-3 text-slate-700">{e.code || e.employeeCode || "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{e.designation || "—"}</td>
                    <td className="px-4 py-3 text-slate-900">{ss.basicSalary ? formatCurrency(ss.basicSalary) : "—"}</td>
                    <td className="px-4 py-3 text-slate-900">{ss.hra ? formatCurrency(ss.hra) : "—"}</td>
                    <td className="px-4 py-3 text-emerald-600 font-medium">{gross ? formatCurrency(gross) : "—"}</td>
                    <td className="px-4 py-3">{(ss.pfApplicable || e.pfApplicable) ? <CheckCircle2 size={16} className="text-green-500" /> : <span className="text-slate-500">—</span>}</td>
                    <td className="px-4 py-3">{(ss.esicApplicable || e.esicApplicable) ? <CheckCircle2 size={16} className="text-green-500" /> : <span className="text-slate-500">—</span>}</td>
                    <td className="px-4 py-3">{(ss.ptApplicable || e.ptApplicable) ? <CheckCircle2 size={16} className="text-green-500" /> : <span className="text-slate-500">—</span>}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => openModal(e)} className="px-3 py-1.5 bg-teal-500/20 text-teal-600 rounded-lg text-xs font-medium hover:bg-teal-500/30 transition-colors flex items-center gap-1">
                        <Plus size={14} /> {ss.basicSalary ? "Update" : "Add"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Salary Structure Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-slate-900 font-semibold text-lg">Salary Structure</h3>
              <button onClick={() => setModal(null)} className="text-slate-500 hover:text-slate-900"><X size={20} /></button>
            </div>
            <p className="text-slate-500 text-sm">{modal.name || `${modal.firstName || ""} ${modal.lastName || ""}`} — {modal.code || modal.employeeCode}</p>

            <div className="space-y-3">
              <div>
                <label className="text-sm text-slate-500 block mb-1">Effective From</label>
                <input type="date" value={form.effectiveFrom} onChange={e => setForm(f => ({ ...f, effectiveFrom: e.target.value }))} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-teal-500" />
              </div>
              {[
                { key: "basicSalary", label: "Basic Salary" },
                { key: "hra", label: "HRA" },
                { key: "conveyanceAllowance", label: "Conveyance Allowance" },
                { key: "medicalAllowance", label: "Medical Allowance" },
                { key: "specialAllowance", label: "Special Allowance" },
                { key: "otherAllowances", label: "Other Allowances" },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="text-sm text-slate-500 block mb-1">{label}</label>
                  <input type="number" value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-teal-500" placeholder="0" />
                </div>
              ))}

              {/* Auto-calc gross */}
              <div className="bg-slate-50 rounded-lg p-3 flex justify-between">
                <span className="text-slate-500 text-sm">Gross Salary (auto)</span>
                <span className="text-teal-600 font-semibold">{formatCurrency(grossCalc)}</span>
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-3 gap-3 pt-1">
                {[
                  { key: "pfApplicable", label: "PF" },
                  { key: "esicApplicable", label: "ESIC" },
                  { key: "ptApplicable", label: "PT" },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <div
                      onClick={() => setForm(f => ({ ...f, [key]: !(f as any)[key] }))}
                      className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${(form as any)[key] ? "bg-teal-500" : "bg-slate-300"}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${(form as any)[key] ? "translate-x-[18px]" : "translate-x-0.5"}`} />
                    </div>
                    <span className="text-sm text-slate-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(null)} className="flex-1 px-4 py-2 bg-white hover:bg-slate-50 text-slate-600 rounded-lg text-sm border border-slate-200 transition-colors">Cancel</button>
              <button onClick={saveSalary} disabled={saving} className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
