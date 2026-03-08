"use client";

import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Plus, Search, Download, X, Loader2, Building2, MoreVertical,
  Edit2, Trash2, FileSpreadsheet, Eye, CreditCard, Key, Users,
  ChevronRight, ChevronLeft, Shield, Mail, Phone, MapPin,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface Organisation {
  id: string;
  name: string;
  code: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  gstNumber: string | null;
  panNumber: string | null;
  paymentType: string;
  creditDays: number;
  creditLimit: number | null;
  startingAdvance: number | null;
  currentBalance: number;
  loginType: string;
  loginEmail: string | null;
  showHeaderFooter: boolean;
  headerImageUrl: string | null;
  footerImageUrl: string | null;
  reportHeaderHtml: string | null;
  reportFooterHtml: string | null;
  defaultReferringDoctorId: string | null;
  defaultReferringDoctorName: string | null;
  autoReportEmail: boolean;
  autoReportWhatsapp: boolean;
  patientCommMode: string;
  alwaysShowMRP: boolean;
  showOnlyPaidReports: boolean;
  showSecondaryUnits: boolean;
  reportAccess: string;
  rateListId: string | null;
  parentOrgId: string | null;
  isActive: boolean;
  createdAt: string;
  rateList: { id: string; name: string } | null;
  parentOrg: { id: string; name: string } | null;
  _count: { orders: number; subOrgs: number };
}

interface RateListOption {
  id: string;
  name: string;
  isDefault: boolean;
  testsCount: number;
}

type PaymentTab = "WALKIN" | "PREPAID" | "POSTPAID" | "FLEXIBLE_PREPAID";
type ModalStep = 1 | 2 | 3 | 4 | 5;

const PAYMENT_TABS: { label: string; value: PaymentTab }[] = [
  { label: "WalkIn", value: "WALKIN" },
  { label: "PrePaid", value: "PREPAID" },
  { label: "PostPaid", value: "POSTPAID" },
];

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  WALKIN: "Walk-In",
  PREPAID: "Pre-Paid",
  POSTPAID: "Post-Paid",
  FLEXIBLE_PREPAID: "Flexible Pre-Paid",
};

const LOGIN_TYPE_LABELS: Record<string, string> = {
  NO_LOGIN: "No Login",
  VIEW_ONLY: "View Only",
  EDIT_ACCESS: "Edit Access",
};

const STEP_LABELS: { step: ModalStep; label: string }[] = [
  { step: 1, label: "Basic Information" },
  { step: 2, label: "Payment Configurations" },
  { step: 3, label: "Account Settings" },
  { step: 4, label: "Login and Access" },
  { step: 5, label: "Org Hierarchy" },
];

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]/20 focus:border-[#0D7E8A] bg-white transition";
const labelCls = "block text-xs font-semibold text-slate-600 mb-1.5";

const INITIAL_FORM = {
  name: "", code: "", contactPerson: "", email: "", phone: "",
  defaultReferringDoctorId: "", defaultReferringDoctorName: "",
  address: "", city: "", state: "", pincode: "", gstNumber: "", panNumber: "",
  paymentType: "WALKIN" as string,
  creditDays: 30, creditLimit: "", startingAdvance: "",
  loginType: "NO_LOGIN" as string,
  loginEmail: "", loginPassword: "",
  showHeaderFooter: false,
  headerImageUrl: "", footerImageUrl: "",
  reportHeaderHtml: "", reportFooterHtml: "",
  autoReportEmail: false, autoReportWhatsapp: false,
  patientCommMode: "REPORTS_ONLY",
  alwaysShowMRP: false, showOnlyPaidReports: true,
  showSecondaryUnits: false, reportAccess: "SIGNED",
  rateListId: "", parentOrgId: "",
};

// ── Toggle Component ────────────────────────────────────────────────────────

function Toggle({ checked, onChange, label, info }: { checked: boolean; onChange: (v: boolean) => void; label: string; info?: string }) {
  return (
    <label className="flex items-center justify-between py-2 cursor-pointer group">
      <div>
        <span className="text-sm text-slate-700">{label}</span>
        {info && <p className="text-xs text-slate-400 mt-0.5">{info}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn("relative w-10 h-5 rounded-full transition-colors",
          checked ? "bg-[#0D7E8A]" : "bg-slate-200"
        )}
      >
        <span className={cn("absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform",
          checked && "translate-x-5"
        )} />
      </button>
    </label>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function OrganisationsPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organisation | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [assignRateListOrg, setAssignRateListOrg] = useState<Organisation | null>(null);
  const [assignRateListId, setAssignRateListId] = useState("");

  // ── Queries ──────────────────────────────────────────────────────────

  const { data: orgs, isLoading } = useQuery({
    queryKey: ["organisations", search, paymentFilter, showInactive],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (paymentFilter) params.set("paymentType", paymentFilter);
      if (showInactive) params.set("isActive", "false");
      const res = await api.get<{ data: Organisation[] }>(`/organisations?${params}`);
      return Array.isArray(res.data.data) ? res.data.data : (res.data as unknown as Organisation[]) ?? [];
    },
  });

  const { data: rateLists } = useQuery({
    queryKey: ["rate-lists-options"],
    queryFn: async () => {
      const res = await api.get<{ data: RateListOption[] }>("/rate-lists");
      return Array.isArray(res.data.data) ? res.data.data : (res.data as unknown as RateListOption[]) ?? [];
    },
  });

  // ── Mutations ────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await api.post("/organisations", data);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Organisation created");
      void qc.invalidateQueries({ queryKey: ["organisations"] });
      setShowCreateModal(false);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to create";
      toast.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await api.put(`/organisations/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Organisation updated");
      void qc.invalidateQueries({ queryKey: ["organisations"] });
      setEditingOrg(null);
      setShowCreateModal(false);
    },
    onError: () => toast.error("Failed to update"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/organisations/${id}`); },
    onSuccess: () => {
      toast.success("Organisation disabled");
      void qc.invalidateQueries({ queryKey: ["organisations"] });
    },
    onError: () => toast.error("Failed to disable"),
  });

  const assignRateListMutation = useMutation({
    mutationFn: async ({ id, rateListId }: { id: string; rateListId: string }) => {
      await api.put(`/organisations/${id}`, { rateListId: rateListId || null });
    },
    onSuccess: () => {
      toast.success("Rate list assigned");
      void qc.invalidateQueries({ queryKey: ["organisations"] });
      setAssignRateListOrg(null);
    },
    onError: () => toast.error("Failed to assign"),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Organisations</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage B2B clients, hospitals, and partner organisations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInactive(!showInactive)}
            className={cn("px-3 py-2 text-sm border rounded-lg transition",
              showInactive ? "border-amber-300 bg-amber-50 text-amber-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
            )}
          >
            {showInactive ? "Show Active" : "Disabled Orgs"}
          </button>
          <button
            onClick={() => { setEditingOrg(null); setShowCreateModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-[#0D7E8A] hover:bg-[#0a6670] text-white text-sm font-medium rounded-lg transition"
          >
            <Plus size={16} /> Add Organisation
          </button>
        </div>
      </div>

      {/* Payment type tabs */}
      <div className="flex items-center gap-0.5 border-b border-slate-200">
        <button
          onClick={() => setPaymentFilter("")}
          className={cn("px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition",
            !paymentFilter ? "border-[#0D7E8A] text-[#0D7E8A]" : "border-transparent text-slate-500 hover:text-slate-700"
          )}
        >
          All
        </button>
        {PAYMENT_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setPaymentFilter(tab.value)}
            className={cn("px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition",
              paymentFilter === tab.value ? "border-[#0D7E8A] text-[#0D7E8A]" : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search organisation name or contact..."
          className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]/20 focus:border-[#0D7E8A]"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500">Name</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500">Contact</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500">Payment Type</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500">Login Type</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500">Rate List</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500">Orders</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && (
                <tr><td colSpan={7} className="px-4 py-12 text-center">
                  <Loader2 size={20} className="animate-spin text-slate-400 mx-auto" />
                </td></tr>
              )}
              {!isLoading && (!orgs || orgs.length === 0) && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">
                  No organisations found
                </td></tr>
              )}
              {(orgs ?? []).map((org) => (
                <tr key={org.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#0D7E8A]/10 text-[#0D7E8A] flex items-center justify-center text-xs font-bold shrink-0">
                        {org.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900 hover:text-[#0D7E8A] cursor-pointer" onClick={() => router.push(`/organisations/${org.id}`)}>{org.name}</p>
                        <p className="text-xs text-slate-400">{org.code}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-slate-700">{org.phone || "—"}</div>
                    <div className="text-xs text-slate-400">{org.email || ""}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium",
                      org.paymentType === "POSTPAID" ? "bg-red-50 text-red-600" :
                      org.paymentType === "PREPAID" ? "bg-green-50 text-green-600" :
                      org.paymentType === "FLEXIBLE_PREPAID" ? "bg-blue-50 text-blue-600" :
                      "bg-slate-50 text-slate-600"
                    )}>
                      {PAYMENT_TYPE_LABELS[org.paymentType] || org.paymentType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {LOGIN_TYPE_LABELS[org.loginType] || org.loginType}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {org.rateList?.name || <span className="text-slate-400">Default</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700 font-medium">{org._count.orders}</td>
                  <td className="px-4 py-3 relative">
                    <button
                      onClick={() => setActionMenuId(actionMenuId === org.id ? null : org.id)}
                      className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                    >
                      <MoreVertical size={14} />
                    </button>
                    {actionMenuId === org.id && (
                      <div className="absolute right-4 top-full mt-1 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-20 w-52">
                        <button
                          onClick={() => { setActionMenuId(null); setEditingOrg(org); setShowCreateModal(true); }}
                          className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                        >
                          <Edit2 size={14} /> Edit Organisation
                        </button>
                        <button
                          onClick={() => { setActionMenuId(null); setAssignRateListOrg(org); setAssignRateListId(org.rateListId || ""); }}
                          className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                        >
                          <FileSpreadsheet size={14} /> Assign Rate List
                        </button>
                        <button
                          onClick={() => { setActionMenuId(null); router.push(`/organisations/${org.id}`); }}
                          className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                        >
                          <Eye size={14} /> View Details
                        </button>
                        <button
                          onClick={() => { setActionMenuId(null); router.push(`/organisations/${org.id}?tab=ledger`); }}
                          className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                        >
                          <CreditCard size={14} /> View Ledger
                        </button>
                        {org.isActive && (
                          <>
                            <div className="border-t border-slate-100 my-1" />
                            <button
                              onClick={() => { setActionMenuId(null); deleteMutation.mutate(org.id); }}
                              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                            >
                              <Trash2 size={14} /> Disable Organisation
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Create/Edit Organisation Modal ─────────────────────────────── */}
      {showCreateModal && (
        <CreateOrgModal
          editingOrg={editingOrg}
          rateLists={rateLists ?? []}
          orgs={orgs ?? []}
          onClose={() => { setShowCreateModal(false); setEditingOrg(null); }}
          onCreate={(data) => createMutation.mutate(data)}
          onUpdate={(id, data) => updateMutation.mutate({ id, data })}
          isPending={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {/* ── Assign Rate List Modal ─────────────────────────────────────── */}
      {assignRateListOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Assign Price List</h3>
            <p className="text-sm text-slate-500 mb-4">to {assignRateListOrg.name}</p>
            <label className={labelCls}>Select Rate List</label>
            <select
              value={assignRateListId}
              onChange={(e) => setAssignRateListId(e.target.value)}
              className={inputCls}
            >
              <option value="">Default (Base Prices)</option>
              {(rateLists ?? []).map((rl) => (
                <option key={rl.id} value={rl.id}>{rl.name} ({rl.testsCount} tests)</option>
              ))}
            </select>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setAssignRateListOrg(null)} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
              <button
                onClick={() => assignRateListMutation.mutate({ id: assignRateListOrg.id, rateListId: assignRateListId })}
                disabled={assignRateListMutation.isPending}
                className="px-4 py-2 text-sm text-white bg-[#0D7E8A] rounded-lg hover:bg-[#0a6670] disabled:opacity-50"
              >
                {assignRateListMutation.isPending ? "Assigning..." : "Assign"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Create/Edit Modal ────────────────────────────────────────────────────────

function CreateOrgModal({
  editingOrg, rateLists, orgs, onClose, onCreate, onUpdate, isPending,
}: {
  editingOrg: Organisation | null;
  rateLists: RateListOption[];
  orgs: Organisation[];
  onClose: () => void;
  onCreate: (data: Record<string, unknown>) => void;
  onUpdate: (id: string, data: Record<string, unknown>) => void;
  isPending: boolean;
}) {
  const [step, setStep] = useState<ModalStep>(1);
  const [form, setForm] = useState(() => {
    if (editingOrg) {
      return {
        name: editingOrg.name, code: editingOrg.code,
        contactPerson: editingOrg.contactPerson || "",
        defaultReferringDoctorId: editingOrg.defaultReferringDoctorId || "",
        defaultReferringDoctorName: editingOrg.defaultReferringDoctorName || "",
        email: editingOrg.email || "", phone: editingOrg.phone || "",
        address: editingOrg.address || "", city: editingOrg.city || "",
        state: editingOrg.state || "", pincode: editingOrg.pincode || "",
        gstNumber: editingOrg.gstNumber || "",
        panNumber: editingOrg.panNumber || "",
        paymentType: editingOrg.paymentType,
        creditDays: editingOrg.creditDays,
        creditLimit: editingOrg.creditLimit ? String(editingOrg.creditLimit) : "",
        startingAdvance: editingOrg.startingAdvance ? String(editingOrg.startingAdvance) : "",
        loginType: editingOrg.loginType,
        loginEmail: editingOrg.loginEmail || "", loginPassword: "",
        showHeaderFooter: editingOrg.showHeaderFooter,
        headerImageUrl: editingOrg.headerImageUrl || "",
        footerImageUrl: editingOrg.footerImageUrl || "",
        reportHeaderHtml: editingOrg.reportHeaderHtml || "",
        reportFooterHtml: editingOrg.reportFooterHtml || "",
        autoReportEmail: editingOrg.autoReportEmail,
        autoReportWhatsapp: editingOrg.autoReportWhatsapp,
        patientCommMode: editingOrg.patientCommMode,
        alwaysShowMRP: editingOrg.alwaysShowMRP,
        showOnlyPaidReports: editingOrg.showOnlyPaidReports,
        showSecondaryUnits: editingOrg.showSecondaryUnits,
        reportAccess: editingOrg.reportAccess,
        rateListId: editingOrg.rateListId || "",
        parentOrgId: editingOrg.parentOrgId || "",
      };
    }
    return { ...INITIAL_FORM };
  });

  const [rateListMode, setRateListMode] = useState<"existing" | "create">(editingOrg?.rateListId ? "existing" : "existing");
  const [newRateListName, setNewRateListName] = useState("");
  const [newRateListFile, setNewRateListFile] = useState<File | null>(null);
  const rlExcelRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = useCallback(<K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  }, []);

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast.error("Organisation name is required"); return; }
    if (rateListMode === "create" && !newRateListName.trim()) { toast.error("Rate list name is required"); return; }

    setIsSubmitting(true);
    try {
      let resolvedRateListId = form.rateListId || undefined;

      // If creating a new rate list, do it first
      if (rateListMode === "create" && newRateListName.trim()) {
        const rlRes = await api.post<{ data: { id: string } }>("/rate-lists", { name: newRateListName.trim(), listType: "PRICE_LIST" });
        const created = rlRes.data.data ?? rlRes.data;
        resolvedRateListId = created.id;

        if (newRateListFile && created.id) {
          const fd = new FormData();
          fd.append("file", newRateListFile);
          await api.post(`/rate-lists/${created.id}/upload`, fd, { headers: { "Content-Type": "multipart/form-data" } });
          toast.success("Rate list created with uploaded prices");
        } else {
          toast.success("Rate list created");
        }
      }

      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        contactPerson: form.contactPerson || undefined,
        defaultReferringDoctorId: form.defaultReferringDoctorId || undefined,
        defaultReferringDoctorName: form.defaultReferringDoctorName || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        address: form.address || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        pincode: form.pincode || undefined,
        gstNumber: form.gstNumber || undefined,
        panNumber: form.panNumber || undefined,
        paymentType: form.paymentType,
        creditDays: form.creditDays,
        creditLimit: form.creditLimit ? parseFloat(form.creditLimit) : undefined,
        startingAdvance: form.startingAdvance ? parseFloat(form.startingAdvance) : undefined,
        loginType: form.loginType,
        loginEmail: form.loginEmail || undefined,
        loginPassword: form.loginPassword || undefined,
        showHeaderFooter: form.showHeaderFooter,
        reportHeaderHtml: form.reportHeaderHtml || null,
        reportFooterHtml: form.reportFooterHtml || null,
        autoReportEmail: form.autoReportEmail,
        autoReportWhatsapp: form.autoReportWhatsapp,
        patientCommMode: form.patientCommMode,
        alwaysShowMRP: form.alwaysShowMRP,
        showOnlyPaidReports: form.showOnlyPaidReports,
        showSecondaryUnits: form.showSecondaryUnits,
        reportAccess: form.reportAccess,
        rateListId: resolvedRateListId,
        parentOrgId: form.parentOrgId || undefined,
      };

      if (editingOrg) {
        onUpdate(editingOrg.id, payload);
      } else {
        onCreate(payload);
      }
    } catch {
      toast.error("Failed to create rate list");
    } finally {
      setIsSubmitting(false);
    }
  };

  const generatePassword = () => {
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
    let pwd = "";
    for (let i = 0; i < 12; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    updateField("loginPassword", pwd);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">
            {editingOrg ? "Edit Organisation" : "Add Organisation"}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-400"><X size={18} /></button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar steps */}
          <div className="w-52 border-r border-slate-200 bg-slate-50 p-3 shrink-0">
            {STEP_LABELS.map((s) => (
              <button
                key={s.step}
                onClick={() => setStep(s.step)}
                className={cn("w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium mb-1 transition",
                  step === s.step ? "bg-[#0D7E8A] text-white" : "text-slate-600 hover:bg-slate-100"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Right content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {step === 1 && (
              <>
                <div>
                  <label className={labelCls}>Organisation Name <span className="text-red-500">*</span></label>
                  <input value={form.name} onChange={(e) => updateField("name", e.target.value)} className={inputCls} placeholder="Enter organisation name" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Code</label>
                    <input value={form.code} onChange={(e) => updateField("code", e.target.value)} className={inputCls} placeholder="Auto-generated" />
                  </div>
                  <div>
                    <label className={labelCls}>Contact Person</label>
                    <input value={form.contactPerson} onChange={(e) => updateField("contactPerson", e.target.value)} className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Default Referring Doctor</label>
                  <input value={form.defaultReferringDoctorName} onChange={(e) => { updateField("defaultReferringDoctorName", e.target.value); updateField("defaultReferringDoctorId", ""); }} className={inputCls} placeholder="Search doctor name..." />
                  <p className="text-xs text-slate-400 mt-1">Will be pre-selected when registering patients from this organisation</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Phone</label>
                    <input value={form.phone} onChange={(e) => updateField("phone", e.target.value)} className={inputCls} inputMode="tel" />
                  </div>
                  <div>
                    <label className={labelCls}>Email</label>
                    <input value={form.email} onChange={(e) => updateField("email", e.target.value)} className={inputCls} type="email" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Address</label>
                  <input value={form.address} onChange={(e) => updateField("address", e.target.value)} className={inputCls} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>City</label>
                    <input value={form.city} onChange={(e) => updateField("city", e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>State</label>
                    <input value={form.state} onChange={(e) => updateField("state", e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Pincode</label>
                    <input value={form.pincode} onChange={(e) => updateField("pincode", e.target.value)} className={inputCls} inputMode="numeric" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>GST Number</label>
                    <input value={form.gstNumber} onChange={(e) => updateField("gstNumber", e.target.value)} className={inputCls} placeholder="e.g. 29ABCDE1234F1Z5" />
                  </div>
                  <div>
                    <label className={labelCls}>PAN Number</label>
                    <input value={form.panNumber} onChange={(e) => updateField("panNumber", e.target.value)} className={inputCls} placeholder="e.g. ABCDE1234F" />
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <p className="text-sm font-medium text-slate-700 mb-3">How would this organisation pay you?</p>
                <div className="flex gap-2 mb-6">
                  {(["PREPAID", "FLEXIBLE_PREPAID", "POSTPAID", "WALKIN"] as const).map((pt) => (
                    <button
                      key={pt}
                      onClick={() => updateField("paymentType", pt)}
                      className={cn("px-4 py-2 text-sm font-medium rounded-lg border transition",
                        form.paymentType === pt ? "border-[#0D7E8A] bg-[#0D7E8A]/10 text-[#0D7E8A]" : "border-slate-200 text-slate-600 hover:border-slate-300"
                      )}
                    >
                      {PAYMENT_TYPE_LABELS[pt]}
                    </button>
                  ))}
                </div>

                {(form.paymentType === "FLEXIBLE_PREPAID" || form.paymentType === "PREPAID") && (
                  <div className="space-y-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div>
                      <label className={labelCls}>Starting Advance (₹)</label>
                      <input value={form.startingAdvance} onChange={(e) => updateField("startingAdvance", e.target.value)} className={inputCls} inputMode="decimal" placeholder="0.00" />
                    </div>
                    {form.paymentType === "FLEXIBLE_PREPAID" && (
                      <>
                        <div>
                          <label className={labelCls}>Credit Limit (₹)</label>
                          <input value={form.creditLimit} onChange={(e) => updateField("creditLimit", e.target.value)} className={inputCls} inputMode="decimal" placeholder="0.00" />
                        </div>
                        <div>
                          <label className={labelCls}>Allowed days to clear dues</label>
                          <input value={form.creditDays} onChange={(e) => updateField("creditDays", parseInt(e.target.value) || 0)} className={inputCls} inputMode="numeric" />
                        </div>
                      </>
                    )}
                  </div>
                )}

                {form.paymentType === "POSTPAID" && (
                  <div className="space-y-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div>
                      <label className={labelCls}>Credit Limit (₹)</label>
                      <input value={form.creditLimit} onChange={(e) => updateField("creditLimit", e.target.value)} className={inputCls} inputMode="decimal" placeholder="0.00" />
                    </div>
                    <div>
                      <label className={labelCls}>Credit Days</label>
                      <input value={form.creditDays} onChange={(e) => updateField("creditDays", parseInt(e.target.value) || 0)} className={inputCls} inputMode="numeric" />
                    </div>
                  </div>
                )}

                <div className="mt-6">
                  <label className={labelCls}>Assign Rate List</label>
                  <div className="flex gap-2 mb-3">
                    <button type="button" onClick={() => setRateListMode("existing")} className={cn("px-3 py-1.5 text-xs font-medium rounded-lg border transition", rateListMode === "existing" ? "border-[#0D7E8A] bg-[#0D7E8A]/10 text-[#0D7E8A]" : "border-slate-200 text-slate-500 hover:border-slate-300")}>Select Existing</button>
                    <button type="button" onClick={() => setRateListMode("create")} className={cn("px-3 py-1.5 text-xs font-medium rounded-lg border transition", rateListMode === "create" ? "border-[#0D7E8A] bg-[#0D7E8A]/10 text-[#0D7E8A]" : "border-slate-200 text-slate-500 hover:border-slate-300")}>Create New</button>
                  </div>
                  {rateListMode === "existing" ? (
                    <select value={form.rateListId} onChange={(e) => updateField("rateListId", e.target.value)} className={inputCls}>
                      <option value="">Default (Base Prices)</option>
                      {rateLists.map((rl) => <option key={rl.id} value={rl.id}>{rl.name} ({rl.testsCount} tests)</option>)}
                    </select>
                  ) : (
                    <div className="space-y-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                      <div>
                        <label className={labelCls}>New List Name *</label>
                        <input value={newRateListName} onChange={(e) => setNewRateListName(e.target.value)} placeholder="e.g. Medibuddy Rates" className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Upload Excel with prices (optional)</label>
                        <input ref={rlExcelRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setNewRateListFile(f); }} />
                        {newRateListFile ? (
                          <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
                            <FileSpreadsheet size={14} className="text-emerald-600" />
                            <span className="flex-1 truncate text-slate-700">{newRateListFile.name}</span>
                            <button type="button" onClick={() => { setNewRateListFile(null); if (rlExcelRef.current) rlExcelRef.current.value = ""; }} className="text-slate-400 hover:text-red-500"><X size={14} /></button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => rlExcelRef.current?.click()} className="w-full border border-dashed border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-500 hover:border-[#0D7E8A] hover:text-[#0D7E8A] transition-colors flex items-center justify-center gap-2 bg-white">
                            <FileSpreadsheet size={14} /> Choose .xlsx file
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {step === 3 && (
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Report Communication</h3>
                <Toggle checked={form.autoReportEmail} onChange={(v) => updateField("autoReportEmail", v)} label="Auto report ready email" info="Send reports automatically via email when ready" />
                <Toggle checked={form.autoReportWhatsapp} onChange={(v) => updateField("autoReportWhatsapp", v)} label="Auto report ready WhatsApp" info="Send reports via WhatsApp when ready" />

                <h3 className="text-sm font-semibold text-slate-700 mt-6 mb-3">Patient Communication</h3>
                {(["REPORTS_AND_BILLS", "REPORTS_ONLY", "DISABLED"] as const).map((mode) => (
                  <label key={mode} className="flex items-center gap-2 py-1.5 cursor-pointer">
                    <input type="radio" name="commMode" checked={form.patientCommMode === mode} onChange={() => updateField("patientCommMode", mode)} className="accent-[#0D7E8A]" />
                    <span className="text-sm text-slate-700">
                      {mode === "REPORTS_AND_BILLS" ? "Send Reports and Bills" : mode === "REPORTS_ONLY" ? "Send Reports Only" : "Disable Patient Communication"}
                    </span>
                  </label>
                ))}

                <h3 className="text-sm font-semibold text-slate-700 mt-6 mb-3">Other Settings</h3>
                <Toggle checked={form.alwaysShowMRP} onChange={(v) => updateField("alwaysShowMRP", v)} label="Always show MRP on bills" />
                <Toggle checked={form.showOnlyPaidReports} onChange={(v) => updateField("showOnlyPaidReports", v)} label="Show only paid reports" />
                <Toggle checked={form.showSecondaryUnits} onChange={(v) => updateField("showSecondaryUnits", v)} label="Show secondary units" />

                <h3 className="text-sm font-semibold text-slate-700 mt-6 mb-3">Report Access</h3>
                <div className="flex gap-4">
                  {(["SIGNED", "SUBMITTED"] as const).map((r) => (
                    <label key={r} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="reportAccess" checked={form.reportAccess === r} onChange={() => updateField("reportAccess", r)} className="accent-[#0D7E8A]" />
                      <span className="text-sm text-slate-700">{r === "SIGNED" ? "Signed Reports" : "Submitted Reports"}</span>
                    </label>
                  ))}
                </div>

                <Toggle checked={form.showHeaderFooter} onChange={(v) => updateField("showHeaderFooter", v)} label="Show Header and Footer" info="Show custom header/footer on reports for this org" />

                {form.showHeaderFooter && (
                  <div className="mt-4 space-y-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <h4 className="text-xs font-semibold text-slate-600">Custom Report Branding</h4>

                    {/* Header */}
                    <div>
                      <p className="text-xs font-medium text-slate-700 mb-2">Upload Report Header <span className="text-slate-400 font-normal">(optional)</span></p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[10px] text-slate-500 mb-1">Upload Image</p>
                          {form.headerImageUrl ? (
                            <div className="relative">
                              <img src={form.headerImageUrl} alt="Header" className="w-full h-16 object-contain border rounded-lg bg-white" />
                              <button onClick={() => updateField("headerImageUrl", "")} className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <label className="flex flex-col items-center justify-center h-16 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-[#0D7E8A] hover:bg-[#0D7E8A]/5">
                              <Download className="w-4 h-4 text-slate-400" />
                              <span className="text-[10px] text-slate-400 mt-1">Upload Image</span>
                              <input type="file" accept=".png,.jpg,.jpeg" className="hidden" onChange={async (e) => {
                                const f = e.target.files?.[0];
                                if (!f || !editingOrg) return;
                                const fd = new FormData(); fd.append("file", f);
                                try {
                                  const res = await api.post(`/organisations/${editingOrg.id}/upload-header`, fd, { headers: { "Content-Type": "multipart/form-data" } });
                                  const d = res.data.data ?? res.data;
                                  updateField("headerImageUrl", d.url);
                                  toast.success("Header uploaded");
                                } catch { toast.error("Upload failed"); }
                              }} />
                            </label>
                          )}
                          <p className="text-[10px] text-slate-400 mt-1">PNG, JPEG only</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 mb-1">Or custom HTML</p>
                          <textarea
                            value={form.reportHeaderHtml}
                            onChange={(e) => updateField("reportHeaderHtml", e.target.value)}
                            placeholder="<div>Your header...</div>"
                            rows={3}
                            className="w-full text-xs font-mono border border-slate-200 rounded-lg p-2 resize-none focus:ring-1 focus:ring-[#0D7E8A]"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div>
                      <p className="text-xs font-medium text-slate-700 mb-2">Upload Report Footer <span className="text-slate-400 font-normal">(optional)</span></p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[10px] text-slate-500 mb-1">Upload Image</p>
                          {form.footerImageUrl ? (
                            <div className="relative">
                              <img src={form.footerImageUrl} alt="Footer" className="w-full h-16 object-contain border rounded-lg bg-white" />
                              <button onClick={() => updateField("footerImageUrl", "")} className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <label className="flex flex-col items-center justify-center h-16 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-[#0D7E8A] hover:bg-[#0D7E8A]/5">
                              <Download className="w-4 h-4 text-slate-400" />
                              <span className="text-[10px] text-slate-400 mt-1">Upload Image</span>
                              <input type="file" accept=".png,.jpg,.jpeg" className="hidden" onChange={async (e) => {
                                const f = e.target.files?.[0];
                                if (!f || !editingOrg) return;
                                const fd = new FormData(); fd.append("file", f);
                                try {
                                  const res = await api.post(`/organisations/${editingOrg.id}/upload-footer`, fd, { headers: { "Content-Type": "multipart/form-data" } });
                                  const d = res.data.data ?? res.data;
                                  updateField("footerImageUrl", d.url);
                                  toast.success("Footer uploaded");
                                } catch { toast.error("Upload failed"); }
                              }} />
                            </label>
                          )}
                          <p className="text-[10px] text-slate-400 mt-1">PNG, JPEG only</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 mb-1">Or custom HTML</p>
                          <textarea
                            value={form.reportFooterHtml}
                            onChange={(e) => updateField("reportFooterHtml", e.target.value)}
                            placeholder="<div>Your footer...</div>"
                            rows={3}
                            className="w-full text-xs font-mono border border-slate-200 rounded-lg p-2 resize-none focus:ring-1 focus:ring-[#0D7E8A]"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 4 && (
              <>
                <p className="text-sm font-medium text-slate-700 mb-4">What kind of access do you wish to give?</p>
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {([
                    { value: "VIEW_ONLY", title: "View Only Access", desc: "Can only view and download reports and bills." },
                    { value: "EDIT_ACCESS", title: "Edit Access", desc: "Can perform different operations. Ideal for orgs that require editing and reporting." },
                    { value: "NO_LOGIN", title: "No Login", desc: "Will not have access to login to the portal." },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => updateField("loginType", opt.value)}
                      className={cn("p-4 rounded-lg border-2 text-left transition",
                        form.loginType === opt.value ? "border-[#0D7E8A] bg-[#0D7E8A]/5" : "border-slate-200 hover:border-slate-300"
                      )}
                    >
                      <p className="text-sm font-semibold text-slate-900 mb-1">{opt.title}</p>
                      <p className="text-xs text-slate-500">{opt.desc}</p>
                    </button>
                  ))}
                </div>

                {form.loginType !== "NO_LOGIN" && (
                  <div className="space-y-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div>
                      <label className={labelCls}>Login Email</label>
                      <input value={form.loginEmail} onChange={(e) => updateField("loginEmail", e.target.value)} className={inputCls} type="email" />
                    </div>
                    <div>
                      <label className={labelCls}>Login Password</label>
                      <div className="flex gap-2">
                        <input value={form.loginPassword} onChange={(e) => updateField("loginPassword", e.target.value)} className={cn(inputCls, "flex-1")} />
                        <button onClick={generatePassword} className="px-3 py-2 text-xs font-medium text-[#0D7E8A] border border-[#0D7E8A] rounded-lg hover:bg-[#0D7E8A]/10">
                          Generate
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {step === 5 && (
              <>
                <p className="text-sm font-medium text-slate-700 mb-4">Set Hierarchy for this org</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg border border-slate-200">
                    <h4 className="text-sm font-semibold text-slate-900 mb-2">Sub Organisations</h4>
                    <p className="text-xs text-slate-500 mb-3">Add sub orgs so that this org can manage all sub orgs set under it.</p>
                    <p className="text-xs text-slate-400">Configure after creation via the edit menu.</p>
                  </div>
                  <div className="p-4 rounded-lg border border-slate-200">
                    <h4 className="text-sm font-semibold text-slate-900 mb-2">Choose Main Organisation</h4>
                    <p className="text-xs text-slate-500 mb-3">Set under a Main org so that it can have their dues settled by the main org.</p>
                    <select value={form.parentOrgId} onChange={(e) => updateField("parentOrgId", e.target.value)} className={inputCls}>
                      <option value="">None</option>
                      {orgs.filter((o) => o.id !== editingOrg?.id && o.isActive).map((o) => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200">
          <div className="flex gap-2">
            {step > 1 && (
              <button onClick={() => setStep((s) => (s - 1) as ModalStep)} className="flex items-center gap-1 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
                <ChevronLeft size={14} /> Back
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Close</button>
            {step < 5 ? (
              <button onClick={() => setStep((s) => (s + 1) as ModalStep)} className="flex items-center gap-1 px-4 py-2 text-sm text-white bg-[#0D7E8A] rounded-lg hover:bg-[#0a6670]">
                Next <ChevronRight size={14} />
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={isPending || isSubmitting} className="px-4 py-2 text-sm text-white bg-[#0D7E8A] rounded-lg hover:bg-[#0a6670] disabled:opacity-50">
                {isPending || isSubmitting ? "Saving..." : (editingOrg ? "Update Organisation" : "Add Organisation")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
