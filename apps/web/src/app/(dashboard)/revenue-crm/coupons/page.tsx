"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Tag,
  Ticket,
  IndianRupee,
  TrendingUp,
  Plus,
  X,
  ToggleLeft,
  ToggleRight,
  Eye,
  AlertCircle,
  ArrowLeft,
  Calendar,
  Users,
  Percent,
  Hash,
} from "lucide-react";
import api from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Coupon {
  id: string;
  code: string;
  name: string;
  type: string;
  discountType: string;
  discountValue: number;
  minOrderValue: number | null;
  maxDiscountAmt: number | null;
  targetGender: string;
  isFirstVisitOnly: boolean;
  maxUsageTotal: number | null;
  maxUsagePerPhone: number | null;
  validFrom: string | null;
  validTo: string | null;
  isActive: boolean;
  usageCount: number;
  revenueGenerated: number;
  discountGiven: number;
}

interface CouponUsage {
  coupon: Coupon;
  usageHistory: Array<{
    id: string;
    patientName: string;
    orderNumber: string;
    orderAmount: number;
    discountAmount: number;
    usedAt: string;
  }>;
  stats: {
    totalUsed: number;
    totalRevenue: number;
    totalDiscount: number;
    avgOrderValue: number;
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmt = (v: number) => new Intl.NumberFormat("en-IN").format(v);

const couponTypes = [
  "CAMPAIGN",
  "FLAT",
  "PERCENTAGE",
  "FIRST_VISIT",
  "CORPORATE",
  "REFERRAL",
] as const;

const typeBadge: Record<string, string> = {
  CAMPAIGN: "bg-blue-500/20 text-blue-400",
  FLAT: "bg-emerald-500/20 text-emerald-400",
  PERCENTAGE: "bg-violet-500/20 text-violet-400",
  FIRST_VISIT: "bg-amber-500/20 text-amber-400",
  CORPORATE: "bg-cyan-500/20 text-cyan-400",
  REFERRAL: "bg-pink-500/20 text-pink-400",
};

// ── Skeleton ───────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="h-3 w-20 bg-slate-800 rounded mb-3" />
            <div className="h-7 w-28 bg-slate-800 rounded mb-2" />
            <div className="h-3 w-16 bg-slate-800 rounded" />
          </div>
        ))}
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4 py-3">
            <div className="h-4 w-24 bg-slate-800 rounded" />
            <div className="h-4 w-32 bg-slate-800 rounded" />
            <div className="h-4 w-20 bg-slate-800 rounded" />
            <div className="h-4 flex-1 bg-slate-800 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function CouponsPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<string | null>(null);

  // ── Form state ──
  const [form, setForm] = useState({
    code: "",
    name: "",
    type: "CAMPAIGN" as string,
    discountType: "PERCENTAGE" as "PERCENTAGE" | "FLAT",
    discountValue: "",
    minOrderValue: "",
    maxDiscountAmt: "",
    targetGender: "ALL",
    isFirstVisitOnly: false,
    maxUsageTotal: "",
    maxUsagePerPhone: "",
    validFrom: "",
    validTo: "",
  });

  // ── Queries ──

  const {
    data: coupons,
    isLoading,
    isError,
    error,
  } = useQuery<Coupon[]>({
    queryKey: ["coupons"],
    queryFn: async () => {
      const res = await api.get("/coupons");
      const raw = res.data?.data ?? res.data;
      return Array.isArray(raw) ? raw : (raw?.items ?? raw?.coupons ?? []);
    },
  });

  const {
    data: usageData,
    isLoading: usageLoading,
  } = useQuery<CouponUsage>({
    queryKey: ["coupons", selectedCoupon, "usage"],
    queryFn: async () => {
      const res = await api.get(`/coupons/${selectedCoupon}/usage`);
      return res.data?.data ?? res.data;
    },
    enabled: !!selectedCoupon,
  });

  // ── Mutations ──

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        code: form.code.toUpperCase(),
        name: form.name,
        type: form.type,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        minOrderValue: form.minOrderValue ? Number(form.minOrderValue) : null,
        maxDiscountAmt: form.maxDiscountAmt ? Number(form.maxDiscountAmt) : null,
        targetGender: form.targetGender,
        isFirstVisitOnly: form.isFirstVisitOnly,
        maxUsageTotal: form.maxUsageTotal ? Number(form.maxUsageTotal) : null,
        maxUsagePerPhone: form.maxUsagePerPhone ? Number(form.maxUsagePerPhone) : null,
        validFrom: form.validFrom || null,
        validTo: form.validTo || null,
      };
      const res = await api.post("/coupons", payload);
      return res.data?.data ?? res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coupons"] });
      setShowModal(false);
      setForm({
        code: "", name: "", type: "CAMPAIGN", discountType: "PERCENTAGE",
        discountValue: "", minOrderValue: "", maxDiscountAmt: "",
        targetGender: "ALL", isFirstVisitOnly: false,
        maxUsageTotal: "", maxUsagePerPhone: "", validFrom: "", validTo: "",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.patch(`/coupons/${id}/toggle`);
      return res.data?.data ?? res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coupons"] }),
  });

  // ── Aggregated stats ──

  const activeCoupons = coupons?.filter((c) => c.isActive).length ?? 0;
  const usedToday = coupons?.reduce((s, c) => s + (c.usageCount ?? 0), 0) ?? 0;
  const discountGivenToday = coupons?.reduce((s, c) => s + (c.discountGiven ?? 0), 0) ?? 0;
  const revenueGenerated = coupons?.reduce((s, c) => s + (c.revenueGenerated ?? 0), 0) ?? 0;

  // ── Detail view ──

  if (selectedCoupon) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6 space-y-6">
        <button
          onClick={() => setSelectedCoupon(null)}
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Coupons
        </button>

        {usageLoading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 bg-slate-800 rounded" />
            <div className="grid grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 bg-slate-900 rounded-xl" />
              ))}
            </div>
            <div className="h-64 bg-slate-900 rounded-xl" />
          </div>
        ) : usageData ? (
          <>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{usageData.coupon.code}</h1>
              <span className={`text-xs px-2.5 py-1 rounded-full ${typeBadge[usageData.coupon.type] ?? "bg-slate-700 text-slate-300"}`}>
                {usageData.coupon.type}
              </span>
              <span className={`text-xs px-2.5 py-1 rounded-full ${usageData.coupon.isActive ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                {usageData.coupon.isActive ? "Active" : "Inactive"}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Used", value: fmt(usageData.stats.totalUsed), icon: Hash },
                { label: "Revenue Generated", value: `₹${fmt(usageData.stats.totalRevenue)}`, icon: TrendingUp },
                { label: "Discount Given", value: `₹${fmt(usageData.stats.totalDiscount)}`, icon: Percent },
                { label: "Avg Order Value", value: `₹${fmt(usageData.stats.avgOrderValue)}`, icon: IndianRupee },
              ].map((s) => (
                <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <s.icon className="h-4 w-4 text-slate-400" />
                    <span className="text-xs text-slate-400">{s.label}</span>
                  </div>
                  <p className="text-xl font-bold">{s.value}</p>
                </div>
              ))}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl">
              <div className="px-5 py-4 border-b border-slate-800">
                <h3 className="text-base font-semibold">Usage History</h3>
              </div>
              {usageData.usageHistory.length === 0 ? (
                <div className="py-12 text-center text-slate-500">No usage recorded yet</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800">
                        <th className="text-left px-5 py-3">Date</th>
                        <th className="text-left px-5 py-3">Patient</th>
                        <th className="text-left px-5 py-3">Order #</th>
                        <th className="text-right px-5 py-3">Order Amount</th>
                        <th className="text-right px-5 py-3">Discount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usageData.usageHistory.map((u) => (
                        <tr key={u.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                          <td className="px-5 py-3 text-slate-300">{new Date(u.usedAt).toLocaleDateString("en-IN")}</td>
                          <td className="px-5 py-3 text-white font-medium">{u.patientName}</td>
                          <td className="px-5 py-3 text-slate-400">{u.orderNumber}</td>
                          <td className="px-5 py-3 text-right text-white">₹{fmt(u.orderAmount)}</td>
                          <td className="px-5 py-3 text-right text-red-400">-₹{fmt(u.discountAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="py-12 text-center text-slate-500">Failed to load coupon details</div>
        )}
      </div>
    );
  }

  // ── Main list view ──

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Coupons & Offers</h1>
          <p className="text-slate-400 text-sm mt-1">Manage discount coupons and promotional offers</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-medium transition-colors"
        >
          <Plus className="h-4 w-4" /> Create Coupon
        </button>
      </div>

      {/* Error */}
      {isError && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-4">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          <p className="text-red-300 text-sm">{(error as Error)?.message ?? "Failed to load coupons"}</p>
        </div>
      )}

      {isLoading ? (
        <Skeleton />
      ) : (
        <>
          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Active Coupons", value: String(activeCoupons), icon: Tag, gradient: "from-emerald-500 to-emerald-700" },
              { label: "Used Today", value: fmt(usedToday), icon: Ticket, gradient: "from-blue-500 to-blue-700" },
              { label: "Discount Given Today", value: `₹${fmt(discountGivenToday)}`, icon: Percent, gradient: "from-amber-500 to-amber-700" },
              { label: "Revenue Generated", value: `₹${fmt(revenueGenerated)}`, icon: TrendingUp, gradient: "from-violet-500 to-violet-700" },
            ].map((stat) => (
              <div key={stat.label} className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${stat.gradient} flex items-center justify-center`}>
                    <stat.icon className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-xs text-slate-400">{stat.label}</span>
                </div>
                <p className="text-xl font-bold">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Table */}
          {!coupons || coupons.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl py-16 text-center">
              <Tag className="h-10 w-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">No coupons created yet</p>
              <p className="text-slate-600 text-xs mt-1">Click &quot;Create Coupon&quot; to get started</p>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800">
                      <th className="text-left px-5 py-3">Code</th>
                      <th className="text-left px-5 py-3">Name</th>
                      <th className="text-left px-5 py-3">Type</th>
                      <th className="text-right px-5 py-3">Discount</th>
                      <th className="text-right px-5 py-3">Used</th>
                      <th className="text-right px-5 py-3">Revenue</th>
                      <th className="text-right px-5 py-3">Discount Given</th>
                      <th className="text-left px-5 py-3">Valid Until</th>
                      <th className="text-center px-5 py-3">Status</th>
                      <th className="text-center px-5 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coupons.map((coupon) => (
                      <tr key={coupon.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                        <td className="px-5 py-3">
                          <span className="font-mono font-semibold text-white">{coupon.code}</span>
                        </td>
                        <td className="px-5 py-3 text-slate-300">{coupon.name}</td>
                        <td className="px-5 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${typeBadge[coupon.type] ?? "bg-slate-700 text-slate-300"}`}>
                            {coupon.type}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right text-white font-medium">
                          {coupon.discountType === "PERCENTAGE"
                            ? `${coupon.discountValue}%`
                            : `₹${fmt(coupon.discountValue)}`}
                        </td>
                        <td className="px-5 py-3 text-right text-slate-300">{fmt(coupon.usageCount)}</td>
                        <td className="px-5 py-3 text-right text-emerald-400">₹{fmt(coupon.revenueGenerated)}</td>
                        <td className="px-5 py-3 text-right text-red-400">₹{fmt(coupon.discountGiven)}</td>
                        <td className="px-5 py-3 text-slate-400">
                          {coupon.validTo
                            ? new Date(coupon.validTo).toLocaleDateString("en-IN")
                            : "No expiry"}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <button
                            onClick={() => toggleMutation.mutate(coupon.id)}
                            className="inline-flex items-center gap-1 text-xs transition-colors"
                            title={coupon.isActive ? "Deactivate" : "Activate"}
                          >
                            {coupon.isActive ? (
                              <ToggleRight className="h-6 w-6 text-emerald-400" />
                            ) : (
                              <ToggleLeft className="h-6 w-6 text-slate-600" />
                            )}
                          </button>
                        </td>
                        <td className="px-5 py-3 text-center">
                          <button
                            onClick={() => setSelectedCoupon(coupon.id)}
                            className="p-1.5 rounded-lg hover:bg-slate-700 transition-colors text-slate-400 hover:text-white"
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Create Coupon Modal ────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">Create Coupon</h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Code */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Coupon Code</label>
                <input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. SAVE20"
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              {/* Name */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Coupon display name"
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              {/* Type */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  {couponTypes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              {/* Discount Type */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Discount Type</label>
                <div className="flex gap-4 mt-1">
                  {(["PERCENTAGE", "FLAT"] as const).map((dt) => (
                    <label key={dt} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="discountType"
                        checked={form.discountType === dt}
                        onChange={() => setForm({ ...form, discountType: dt })}
                        className="accent-blue-500"
                      />
                      <span className="text-sm text-slate-300">{dt}</span>
                    </label>
                  ))}
                </div>
              </div>
              {/* Discount Value */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">
                  Discount Value {form.discountType === "PERCENTAGE" ? "(%)" : "(₹)"}
                </label>
                <input
                  type="number"
                  value={form.discountValue}
                  onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                  placeholder="0"
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              {/* Min Order Value */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Min Order Value (₹)</label>
                <input
                  type="number"
                  value={form.minOrderValue}
                  onChange={(e) => setForm({ ...form, minOrderValue: e.target.value })}
                  placeholder="Optional"
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              {/* Max Discount */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Max Discount Amt (₹)</label>
                <input
                  type="number"
                  value={form.maxDiscountAmt}
                  onChange={(e) => setForm({ ...form, maxDiscountAmt: e.target.value })}
                  placeholder="Optional"
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              {/* Target Gender */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Target Gender</label>
                <select
                  value={form.targetGender}
                  onChange={(e) => setForm({ ...form, targetGender: e.target.value })}
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="ALL">All</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                </select>
              </div>
              {/* First Visit Only */}
              <div className="flex items-center gap-3 mt-5">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, isFirstVisitOnly: !form.isFirstVisitOnly })}
                  className="text-slate-400 hover:text-white"
                >
                  {form.isFirstVisitOnly ? (
                    <ToggleRight className="h-6 w-6 text-blue-400" />
                  ) : (
                    <ToggleLeft className="h-6 w-6" />
                  )}
                </button>
                <span className="text-sm text-slate-300">First Visit Only</span>
              </div>
              {/* Max Usage Total */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Max Usage Total</label>
                <input
                  type="number"
                  value={form.maxUsageTotal}
                  onChange={(e) => setForm({ ...form, maxUsageTotal: e.target.value })}
                  placeholder="Unlimited"
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              {/* Max Usage Per Phone */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Max Usage Per Phone</label>
                <input
                  type="number"
                  value={form.maxUsagePerPhone}
                  onChange={(e) => setForm({ ...form, maxUsagePerPhone: e.target.value })}
                  placeholder="Unlimited"
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              {/* Valid From */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Valid From</label>
                <input
                  type="date"
                  value={form.validFrom}
                  onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              {/* Valid To */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Valid To</label>
                <input
                  type="date"
                  value={form.validTo}
                  onChange={(e) => setForm({ ...form, validTo: e.target.value })}
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-800">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !form.code || !form.name || !form.discountValue}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
              >
                {createMutation.isPending ? "Creating..." : "Create Coupon"}
              </button>
            </div>

            {createMutation.isError && (
              <p className="mt-3 text-sm text-red-400">
                {(createMutation.error as Error)?.message ?? "Failed to create coupon"}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
