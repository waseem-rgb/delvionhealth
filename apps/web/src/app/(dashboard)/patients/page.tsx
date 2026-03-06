"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Filter, X, Eye, Pencil, ClipboardList, History } from "lucide-react";
import { DataTable } from "@/components/tables/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SearchInput } from "@/components/shared/SearchInput";
import { formatDate } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

interface Patient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  fullName: string;
  age: number;
  dob: string;
  gender: string;
  phone: string;
  email: string | null;
  createdAt: string;
  orderCount: number;
  branch: { id: string; name: string } | null;
}

interface QueryResponse {
  data: Patient[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

const PATIENT_STATUS_TABS = [
  { label: "All Patients", value: "" },
  { label: "Duplicates", value: "duplicates" },
  { label: "Inactive", value: "inactive" },
];

const GENDER_TABS = [
  { label: "All", value: "" },
  { label: "Male", value: "MALE" },
  { label: "Female", value: "FEMALE" },
];

export default function PatientsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [gender, setGender] = useState("");
  const [patientStatus, setPatientStatus] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);

  // 'n' keyboard shortcut → new patient
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "n") router.push("/patients/new");
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [router]);

  const user = useAuthStore((s) => s.user);

  const queryParams = new URLSearchParams({
    page: String(page),
    limit: "20",
    ...(search && { search }),
    ...(gender && { gender }),
    ...(patientStatus && { status: patientStatus }),
  }).toString();

  const { data, isLoading } = useQuery({
    queryKey: ["patients", queryParams],
    queryFn: async () => {
      const res = await api.get<{ data: QueryResponse }>(`/patients?${queryParams}`);
      return res.data.data;
    },
    enabled: !!user,
  });

  // Prevent blank page while Zustand store rehydrates
  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#0D7E8A] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const columns: ColumnDef<Patient>[] = [
    {
      accessorKey: "mrn",
      header: "MRN",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-[#1B4F8A] font-semibold tracking-wide">
          {row.original.mrn}
        </span>
      ),
    },
    {
      id: "patient",
      header: "Patient",
      cell: ({ row }) => {
        const p = row.original;
        const initials = `${p.firstName[0]}${p.lastName[0]}`.toUpperCase();
        return (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#1B4F8A]/10 text-[#1B4F8A] flex items-center justify-center text-xs font-bold shrink-0">
              {initials}
            </div>
            <div>
              <p className="font-medium text-slate-900">{p.fullName}</p>
              <p className="text-xs text-slate-400">{p.phone}</p>
            </div>
          </div>
        );
      },
    },
    {
      id: "age",
      header: "Age",
      cell: ({ row }) => (
        <span className="text-slate-700">{row.original.age} yrs</span>
      ),
    },
    {
      id: "gender",
      header: "Gender",
      cell: ({ row }) => {
        const g = row.original.gender;
        const cls =
          g === "MALE"
            ? "bg-blue-50 text-blue-700 ring-blue-200"
            : g === "FEMALE"
            ? "bg-pink-50 text-pink-700 ring-pink-200"
            : "bg-slate-50 text-slate-600 ring-slate-200";
        return (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ${cls}`}
          >
            {g.charAt(0) + g.slice(1).toLowerCase()}
          </span>
        );
      },
    },
    {
      id: "branch",
      header: "Branch",
      cell: ({ row }) => (
        <span className="text-slate-600 text-sm">
          {row.original.branch?.name ?? "—"}
        </span>
      ),
    },
    {
      id: "orders",
      header: "Orders",
      cell: ({ row }) => (
        <span className="text-slate-600 text-sm font-medium">{row.original.orderCount}</span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Registered",
      cell: ({ row }) => (
        <span className="text-slate-500 text-xs">{formatDate(row.original.createdAt)}</span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/patients/${row.original.id}`);
            }}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-[#1B4F8A] transition"
            title="View"
          >
            <Eye size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/orders/new?patientId=${row.original.id}`);
            }}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-emerald-600 transition"
            title="New Order"
          >
            <ClipboardList size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/patients/${row.original.id}?tab=orders`);
            }}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-amber-600 transition"
            title="History"
          >
            <History size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/patients/${row.original.id}/edit`);
            }}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-[#1B4F8A] transition"
            title="Edit"
          >
            <Pencil size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Patients</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {data?.meta.total ?? 0} total registered patients
          </p>
        </div>
        <button
          onClick={() => router.push("/patients/new")}
          className="flex items-center gap-2 px-4 py-2 bg-[#1B4F8A] hover:bg-[#143C6B] text-white text-sm font-medium rounded-lg transition-colors"
          title="New patient (N)"
        >
          <Plus size={16} />
          New Patient
        </button>
      </div>

      {/* Patient status tabs */}
      <div className="flex items-center gap-0.5 border-b border-slate-200 overflow-x-auto">
        {PATIENT_STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setPatientStatus(tab.value);
              setPage(1);
            }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition ${
              patientStatus === tab.value
                ? "border-[#1B4F8A] text-[#1B4F8A]"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Gender filter chips */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-slate-400 font-medium mr-1">Gender:</span>
        {GENDER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setGender(tab.value);
              setPage(1);
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition ${
              gender === tab.value
                ? "border-[#1B4F8A] bg-[#1B4F8A] text-white"
                : "border-slate-200 text-slate-600 hover:border-slate-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search + filter row */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Search by name, phone, MRN..."
          />
        </div>
        <button
          onClick={() => setFilterOpen(true)}
          className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition"
        >
          <Filter size={14} />
          Filters
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl card-shadow overflow-hidden">
        <DataTable
          columns={columns}
          data={data?.data ?? []}
          total={data?.meta.total}
          page={page}
          pageSize={20}
          onPageChange={setPage}
          isLoading={isLoading}
        />
      </div>

      {/* Filter drawer */}
      {filterOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-black/40"
            onClick={() => setFilterOpen(false)}
          />
          <div className="w-80 bg-white h-full shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h2 className="font-semibold text-slate-900">Filters</h2>
              <button
                onClick={() => setFilterOpen(false)}
                className="p-1 rounded hover:bg-slate-100 text-slate-500"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  Gender
                </label>
                <div className="space-y-2">
                  {["", "MALE", "FEMALE", "OTHER"].map((g) => (
                    <label key={g} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="gender"
                        value={g}
                        checked={gender === g}
                        onChange={() => { setGender(g); setPage(1); }}
                        className="accent-[#1B4F8A]"
                      />
                      <span className="text-sm text-slate-700">
                        {g === "" ? "All genders" : g.charAt(0) + g.slice(1).toLowerCase()}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-200">
              <button
                onClick={() => {
                  setGender("");
                  setSearch("");
                  setPage(1);
                  setFilterOpen(false);
                }}
                className="w-full py-2 text-sm text-slate-600 hover:text-slate-800 border border-slate-200 rounded-lg transition hover:bg-slate-50"
              >
                Reset all filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
