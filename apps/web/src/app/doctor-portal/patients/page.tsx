"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Users, Eye, Calendar } from "lucide-react";
import api from "@/lib/api";

interface PatientRow {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  gender: string;
  dateOfBirth: string | null;
  phone: string | null;
  lastVisit: string | null;
  orderCount: number;
}

export default function DoctorPatientsPage() {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["doctor-patients", search],
    queryFn: async () => {
      try {
        const res = await api.get(`/portal/doctor/patients?search=${search}&limit=50`);
        return (res.data?.data ?? res.data) as { data: PatientRow[]; total: number };
      } catch {
        return { data: [] as PatientRow[], total: 0 };
      }
    },
    staleTime: 30_000,
  });

  const patients = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Patients</h1>
          <p className="text-slate-500 text-sm mt-1">Patients referred by you</p>
        </div>
        <div className="text-sm text-slate-500">{data?.total ?? 0} patients</div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search patients by name or MRN..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left py-3 px-4 font-medium text-slate-500 text-xs">MRN</th>
                <th className="text-left py-3 px-4 font-medium text-slate-500 text-xs">Patient Name</th>
                <th className="text-left py-3 px-4 font-medium text-slate-500 text-xs">Gender</th>
                <th className="text-left py-3 px-4 font-medium text-slate-500 text-xs">Phone</th>
                <th className="text-left py-3 px-4 font-medium text-slate-500 text-xs">Orders</th>
                <th className="text-left py-3 px-4 font-medium text-slate-500 text-xs">Last Visit</th>
                <th className="text-right py-3 px-4 font-medium text-slate-500 text-xs">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    {[...Array(7)].map((_, j) => (
                      <td key={j} className="py-3 px-4">
                        <div className="h-4 bg-slate-100 rounded animate-pulse w-20" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : patients.length > 0 ? (
                patients.map((p) => (
                  <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono text-xs text-slate-500">{p.mrn}</td>
                    <td className="py-3 px-4 font-medium text-slate-800">{p.firstName} {p.lastName}</td>
                    <td className="py-3 px-4 text-slate-600">{p.gender}</td>
                    <td className="py-3 px-4 text-slate-600">{p.phone ?? "—"}</td>
                    <td className="py-3 px-4 text-slate-600">{p.orderCount}</td>
                    <td className="py-3 px-4 text-slate-500 text-xs">
                      {p.lastVisit ? new Date(p.lastVisit).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button className="p-1.5 hover:bg-slate-100 rounded-md transition-colors" title="View">
                        <Eye className="w-4 h-4 text-slate-400" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">No patients found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
