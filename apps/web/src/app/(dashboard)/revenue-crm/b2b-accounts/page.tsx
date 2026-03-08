"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building,
  Plus,
  X,
  Search,
  MapPin,
  Phone,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

// ── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (v: number) => new Intl.NumberFormat("en-IN").format(v);

const ACCOUNT_TYPES = ["HOSPITAL", "LAB", "NURSING_HOME", "CLINIC_CHAIN"];
const ACCOUNT_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED", "PROSPECT"];

const TYPE_COLORS: Record<string, string> = {
  HOSPITAL: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  LAB: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  NURSING_HOME: "bg-teal-500/20 text-teal-400 border-teal-500/30",
  CLINIC_CHAIN: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-500/20 text-green-400 border-green-500/30",
  INACTIVE: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  SUSPENDED: "bg-red-500/20 text-red-400 border-red-500/30",
  PROSPECT: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

// ── Types ───────────────────────────────────────────────────────────────────

interface B2BAccount {
  id: string;
  type: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  pincode?: string;
  creditDays?: number;
  creditLimit?: number;
  totalRevenue?: number;
  mtdRevenue?: number;
  outstanding?: number;
  status: string;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function B2BAccountsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [form, setForm] = useState({
    type: "HOSPITAL",
    name: "",
    contactPerson: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    pincode: "",
    creditDays: "",
    creditLimit: "",
  });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["revenue-crm", "b2b-accounts"],
    queryFn: async () => {
      const res = await api.get("/revenue-crm/b2b-accounts");
      const raw = res.data?.data ?? res.data;
      return (Array.isArray(raw) ? raw : (raw?.items ?? raw?.accounts ?? [])) as B2BAccount[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      const body = {
        ...payload,
        creditDays: payload.creditDays ? Number(payload.creditDays) : undefined,
        creditLimit: payload.creditLimit
          ? Number(payload.creditLimit)
          : undefined,
      };
      const res = await api.post("/revenue-crm/b2b-accounts", body);
      return res.data?.data ?? res.data;
    },
    onSuccess: () => {
      toast.success("Account created");
      queryClient.invalidateQueries({
        queryKey: ["revenue-crm", "b2b-accounts"],
      });
      setShowForm(false);
      setForm({
        type: "HOSPITAL",
        name: "",
        contactPerson: "",
        phone: "",
        email: "",
        address: "",
        city: "",
        pincode: "",
        creditDays: "",
        creditLimit: "",
      });
    },
    onError: () => toast.error("Failed to create account"),
  });

  const allAccounts = data ?? [];

  // Client-side filtering
  const accounts = allAccounts.filter((a) => {
    if (filterType && a.type !== filterType) return false;
    if (filterStatus && a.status !== filterStatus) return false;
    if (
      searchQuery &&
      !a.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !(a.contactPerson ?? "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) &&
      !(a.city ?? "").toLowerCase().includes(searchQuery.toLowerCase())
    )
      return false;
    return true;
  });

  // ── Loading ─────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 p-6">
        <div className="mb-8">
          <div className="h-8 w-48 animate-pulse rounded bg-slate-800" />
        </div>
        <div className="mb-6 flex gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-10 w-40 animate-pulse rounded-lg bg-slate-800"
            />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-xl bg-slate-900" />
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────

  if (isError) {
    return (
      <div className="min-h-screen bg-slate-950 p-6">
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-400">
          Failed to load B2B accounts:{" "}
          {error instanceof Error ? error.message : "Unknown error"}
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Hospitals &amp; Labs
          </h1>
          <p className="text-slate-400">
            Manage B2B accounts and partnerships
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Add Account
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search accounts..."
            className="rounded-lg border border-slate-700 bg-slate-800 py-2 pl-9 pr-3 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
        >
          <option value="">All Types</option>
          {ACCOUNT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace("_", " ")}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
        >
          <option value="">All Statuses</option>
          {ACCOUNT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      {accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900 py-20">
          <Building className="mb-4 h-12 w-12 text-slate-600" />
          <p className="text-lg font-medium text-slate-400">No data found</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900">
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">
                  Contact Person
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">
                  City
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-slate-400">
                  Total Revenue
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-slate-400">
                  MTD Revenue
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-slate-400">
                  Outstanding
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium text-slate-400">
                  Status
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium text-slate-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr
                  key={a.id}
                  className="border-b border-slate-800/50 bg-slate-900/50 hover:bg-slate-800/50"
                >
                  <td className="px-4 py-3 text-sm font-medium text-white">
                    {a.name}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${TYPE_COLORS[a.type] ?? "bg-slate-700 text-slate-300"}`}
                    >
                      {a.type.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-300">
                    {a.contactPerson ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-300">
                    {a.city ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-slate-300">
                    {a.totalRevenue !== undefined ? fmt(a.totalRevenue) : "-"}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-slate-300">
                    {a.mtdRevenue !== undefined ? fmt(a.mtdRevenue) : "-"}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-slate-300">
                    {a.outstanding !== undefined ? fmt(a.outstanding) : "-"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[a.status] ?? "bg-slate-700 text-slate-300"}`}
                    >
                      {a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button className="rounded-lg bg-slate-800 px-3 py-1 text-xs text-slate-300 hover:bg-slate-700">
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Add Account Modal ─────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-800 bg-slate-900 p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Add Account</h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate(form);
              }}
              className="space-y-4"
            >
              <div>
                <label className="mb-1 block text-sm text-slate-400">
                  Type *
                </label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                >
                  {ACCOUNT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-400">
                  Name *
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-400">
                  Contact Person
                </label>
                <input
                  value={form.contactPerson}
                  onChange={(e) =>
                    setForm({ ...form, contactPerson: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm text-slate-400">
                    Phone
                  </label>
                  <input
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-400">
                    Email
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-400">
                  Address
                </label>
                <input
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm text-slate-400">
                    City
                  </label>
                  <input
                    value={form.city}
                    onChange={(e) =>
                      setForm({ ...form, city: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-400">
                    Pincode
                  </label>
                  <input
                    value={form.pincode}
                    onChange={(e) =>
                      setForm({ ...form, pincode: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm text-slate-400">
                    Credit Days
                  </label>
                  <input
                    type="number"
                    value={form.creditDays}
                    onChange={(e) =>
                      setForm({ ...form, creditDays: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-400">
                    Credit Limit
                  </label>
                  <input
                    type="number"
                    value={form.creditLimit}
                    onChange={(e) =>
                      setForm({ ...form, creditLimit: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={createMutation.isPending}
                className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {createMutation.isPending ? "Creating..." : "Add Account"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
