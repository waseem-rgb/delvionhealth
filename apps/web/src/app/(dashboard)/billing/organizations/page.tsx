"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Building2,
  Plus,
  Users,
  DollarSign,
  AlertTriangle,
  Edit2,
  Trash2,
  X,
  Phone,
  Mail,
  MapPin,
  Eye,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { DataTable } from "@/components/tables/DataTable";
import { SearchInput } from "@/components/shared/SearchInput";
import { PageHeader } from "@/components/shared/PageHeader";
import { KPICard } from "@/components/shared/KPICard";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { formatCurrency, cn } from "@/lib/utils";
import api from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────

interface Organization {
  id: string;
  name: string;
  code: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  gstNumber: string | null;
  creditDays: number;
  discountPct: number;
  outstanding: number;
  isActive: boolean;
  createdAt: string;
}

interface OrgStats {
  total: number;
  active: number;
  totalOutstanding: number;
}

interface OrgFormData {
  name: string;
  code: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  gstNumber: string;
  creditDays: string;
  discountPct: string;
}

const EMPTY_FORM: OrgFormData = {
  name: "",
  code: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  gstNumber: "",
  creditDays: "30",
  discountPct: "0",
};

// ── Organization Form Drawer ───────────────────────────────────────────────

function OrgDrawer({
  org,
  onClose,
  onSuccess,
}: {
  org?: Organization;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState<OrgFormData>(
    org
      ? {
          name: org.name,
          code: org.code,
          contactPerson: org.contactPerson ?? "",
          phone: org.phone ?? "",
          email: org.email ?? "",
          address: org.address ?? "",
          city: org.city ?? "",
          gstNumber: org.gstNumber ?? "",
          creditDays: String(org.creditDays),
          discountPct: String(org.discountPct),
        }
      : EMPTY_FORM
  );
  const [error, setError] = useState("");
  const isEdit = !!org;

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => {
      if (isEdit) {
        return api.put(`/organizations/${org.id}`, data);
      }
      return api.post("/organizations", data);
    },
    onSuccess: () => {
      onSuccess();
      onClose();
    },
    onError: (e: unknown) => {
      setError(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          `Failed to ${isEdit ? "update" : "create"} organization`
      );
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }
    if (!form.code.trim()) {
      setError("Code is required");
      return;
    }
    const creditDays = parseInt(form.creditDays, 10);
    const discountPct = parseFloat(form.discountPct);
    mutation.mutate({
      name: form.name.trim(),
      code: form.code.trim(),
      contactPerson: form.contactPerson.trim() || undefined,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      address: form.address.trim() || undefined,
      city: form.city.trim() || undefined,
      gstNumber: form.gstNumber.trim() || undefined,
      creditDays: isNaN(creditDays) ? 30 : creditDays,
      discountPct: isNaN(discountPct) ? 0 : discountPct,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md h-full flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">
            {isEdit ? "Edit Organization" : "Add Organization"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">
            <X size={20} />
          </button>
        </div>
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {(
            [
              { key: "name", label: "Organization Name *", placeholder: "Apollo Diagnostics" },
              { key: "code", label: "Code *", placeholder: "APOLLO" },
              { key: "contactPerson", label: "Contact Person", placeholder: "John Doe" },
              { key: "phone", label: "Phone", placeholder: "+91 98765 43210" },
              { key: "email", label: "Email", placeholder: "billing@apollo.com" },
              { key: "address", label: "Address", placeholder: "123 Hospital Road" },
              { key: "city", label: "City", placeholder: "Bengaluru" },
              { key: "gstNumber", label: "GST Number", placeholder: "29ABCDE1234F1ZK" },
            ] as Array<{ key: keyof OrgFormData; label: string; placeholder?: string }>
          ).map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
              <input
                type="text"
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
              />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Credit Days</label>
              <input
                type="number"
                min="0"
                value={form.creditDays}
                onChange={(e) => setForm((f) => ({ ...f, creditDays: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Discount %</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={form.discountPct}
                onChange={(e) => setForm((f) => ({ ...f, discountPct: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
              />
            </div>
          </div>
        </form>
        <div className="px-6 py-4 border-t border-slate-200 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={(e) => handleSubmit(e as unknown as React.FormEvent)}
            disabled={mutation.isPending}
            className="flex-1 px-4 py-2 bg-[#1B4F8A] rounded-lg text-sm font-semibold text-white hover:bg-[#163d6a] disabled:opacity-50"
          >
            {mutation.isPending ? "Saving..." : isEdit ? "Update" : "Add Organization"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Organization Detail Panel ──────────────────────────────────────────────

function OrgDetailPanel({
  org,
  onClose,
  onEdit,
}: {
  org: Organization;
  onClose: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg h-full flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">{org.name}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
              title="Edit"
            >
              <Edit2 size={16} />
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Status */}
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border",
                org.isActive
                  ? "bg-green-50 border-green-200 text-green-700"
                  : "bg-slate-50 border-slate-200 text-slate-500"
              )}
            >
              {org.isActive ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
              {org.isActive ? "Active" : "Inactive"}
            </span>
            <span className="font-mono text-sm text-slate-500">{org.code}</span>
          </div>

          {/* Contact Info */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Contact</h3>
            {org.contactPerson && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Users size={14} className="text-slate-400" />
                {org.contactPerson}
              </div>
            )}
            {org.phone && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Phone size={14} className="text-slate-400" />
                {org.phone}
              </div>
            )}
            {org.email && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Mail size={14} className="text-slate-400" />
                {org.email}
              </div>
            )}
            {(org.address || org.city) && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <MapPin size={14} className="text-slate-400" />
                {[org.address, org.city].filter(Boolean).join(", ")}
              </div>
            )}
          </div>

          {/* Financial Details */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Financial</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500">Credit Days</p>
                <p className="text-lg font-bold text-slate-800">{org.creditDays}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500">Discount</p>
                <p className="text-lg font-bold text-slate-800">{org.discountPct}%</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 col-span-2">
                <p className="text-xs text-slate-500">Outstanding</p>
                <p
                  className={cn(
                    "text-lg font-bold",
                    Number(org.outstanding) > 0 ? "text-red-600" : "text-slate-800"
                  )}
                >
                  {formatCurrency(Number(org.outstanding))}
                </p>
              </div>
            </div>
          </div>

          {/* GST */}
          {org.gstNumber && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Tax</h3>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500">GST Number</p>
                <p className="text-sm font-mono text-slate-700">{org.gstNumber}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function OrganizationsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editOrg, setEditOrg] = useState<Organization | undefined>(undefined);
  const [viewOrg, setViewOrg] = useState<Organization | null>(null);
  const [deleteOrg, setDeleteOrg] = useState<Organization | null>(null);

  // Fetch organizations
  const params = new URLSearchParams({
    page: String(page),
    limit: "20",
    ...(search && { search }),
  }).toString();

  const { data, isLoading } = useQuery({
    queryKey: ["organizations", params],
    queryFn: async () => {
      const res = await api.get<{ data: { data: Organization[]; meta: { total: number } } }>(
        `/organizations?${params}`
      );
      return res.data.data;
    },
  });

  // Stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["organizations-stats"],
    queryFn: async () => {
      // Derive stats from the full list
      const res = await api.get<{ data: { data: Organization[]; meta: { total: number } } }>(
        "/organizations?limit=1000"
      );
      const list = res.data?.data?.data ?? [];
      return {
        total: res.data?.data?.meta?.total ?? 0,
        active: list.filter((o) => o.isActive).length,
        totalOutstanding: list.reduce((sum, o) => sum + Number(o.outstanding ?? 0), 0),
      } as OrgStats;
    },
  });

  // Delete / deactivate
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/organizations/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["organizations"] });
      qc.invalidateQueries({ queryKey: ["organizations-stats"] });
      setDeleteOrg(null);
    },
  });

  const columns: ColumnDef<Organization>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <button
          className="text-left"
          onClick={() => setViewOrg(row.original)}
        >
          <p className="font-semibold text-slate-800 text-sm hover:text-[#1B4F8A]">{row.original.name}</p>
          <p className="text-xs text-slate-400 font-mono">{row.original.code}</p>
        </button>
      ),
    },
    {
      header: "Contact Person",
      cell: ({ row }) => (
        <span className="text-sm text-slate-600">{row.original.contactPerson ?? "--"}</span>
      ),
    },
    {
      header: "Phone",
      cell: ({ row }) => (
        <span className="text-sm text-slate-600">{row.original.phone ?? "--"}</span>
      ),
    },
    {
      header: "Email",
      cell: ({ row }) => (
        <span className="text-sm text-slate-500 truncate max-w-[180px] inline-block">
          {row.original.email ?? "--"}
        </span>
      ),
    },
    {
      header: "Credit Days",
      cell: ({ row }) => (
        <span className="text-sm text-slate-600 font-medium">{row.original.creditDays}</span>
      ),
    },
    {
      header: "Discount %",
      cell: ({ row }) => (
        <span className="text-sm text-slate-600">{row.original.discountPct}%</span>
      ),
    },
    {
      header: "Outstanding",
      cell: ({ row }) => {
        const val = Number(row.original.outstanding ?? 0);
        return (
          <span className={cn("font-semibold text-sm", val > 0 ? "text-red-600" : "text-slate-400")}>
            {formatCurrency(val)}
          </span>
        );
      },
    },
    {
      header: "Status",
      cell: ({ row }) => (
        <span
          className={cn(
            "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border",
            row.original.isActive
              ? "bg-green-50 border-green-200 text-green-700"
              : "bg-slate-50 border-slate-200 text-slate-500"
          )}
        >
          {row.original.isActive ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const org = row.original;
        return (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewOrg(org)}
              className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-[#1B4F8A]"
              title="View"
            >
              <Eye size={15} />
            </button>
            <button
              onClick={() => {
                setEditOrg(org);
                setShowForm(true);
              }}
              className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-700"
              title="Edit"
            >
              <Edit2 size={15} />
            </button>
            {org.isActive && (
              <button
                onClick={() => setDeleteOrg(org)}
                className="p-1.5 rounded hover:bg-red-50 text-slate-500 hover:text-red-600"
                title="Deactivate"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Organizations"
        subtitle="Manage B2B client organizations"
        breadcrumbs={[{ label: "Billing", href: "/billing" }]}
        actions={
          <button
            onClick={() => {
              setEditOrg(undefined);
              setShowForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-[#1B4F8A] text-white rounded-lg text-sm font-semibold hover:bg-[#163d6a] transition"
          >
            <Plus size={16} />
            Add Organization
          </button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KPICard
          title="Total Organizations"
          value={stats?.total ?? 0}
          icon={Building2}
          iconColor="bg-blue-100 text-blue-600"
          isLoading={statsLoading}
        />
        <KPICard
          title="Active"
          value={stats?.active ?? 0}
          icon={Users}
          iconColor="bg-green-100 text-green-600"
          isLoading={statsLoading}
        />
        <KPICard
          title="Outstanding Total"
          value={formatCurrency(stats?.totalOutstanding ?? 0)}
          icon={AlertTriangle}
          iconColor="bg-red-100 text-red-600"
          isLoading={statsLoading}
        />
      </div>

      {/* Search */}
      <div className="mb-4">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search by name, code, or city..."
          className="max-w-sm"
        />
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        total={data?.meta?.total ?? 0}
        page={page}
        pageSize={20}
        onPageChange={setPage}
        isLoading={isLoading}
      />

      {/* Drawers / Modals */}
      {showForm && (
        <OrgDrawer
          org={editOrg}
          onClose={() => {
            setShowForm(false);
            setEditOrg(undefined);
          }}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["organizations"] });
            qc.invalidateQueries({ queryKey: ["organizations-stats"] });
          }}
        />
      )}

      {viewOrg && !showForm && (
        <OrgDetailPanel
          org={viewOrg}
          onClose={() => setViewOrg(null)}
          onEdit={() => {
            setEditOrg(viewOrg);
            setViewOrg(null);
            setShowForm(true);
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleteOrg}
        onClose={() => setDeleteOrg(null)}
        onConfirm={() => {
          if (deleteOrg) deleteMutation.mutate(deleteOrg.id);
        }}
        title="Deactivate Organization"
        message={`Are you sure you want to deactivate "${deleteOrg?.name}"? This will prevent new invoices from being generated for this organization.`}
        confirmText="Deactivate"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
