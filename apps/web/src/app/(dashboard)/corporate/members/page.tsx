"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Search } from "lucide-react";
import api from "@/lib/api";
import { formatDate } from "@/lib/utils";

export default function MembersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [corporateId, setCorporateId] = useState("");
  const [status, setStatus] = useState("");

  const { data: corporates } = useQuery({
    queryKey: ["corporates-list"],
    queryFn: async () => {
      const res = await api.get("/corporate/corporates", { params: { limit: 100 } });
      return res.data?.data?.data ?? res.data?.data ?? res.data ?? [];
    },
  });

  const { data: members, isLoading } = useQuery({
    queryKey: ["global-members", corporateId, status],
    queryFn: async () => {
      const params: any = {};
      if (corporateId) params.corporateId = corporateId;
      if (status) params.status = status;
      const res = await api.get("/corporate/members", { params });
      return res.data?.data ?? res.data ?? [];
    },
  });

  const exitMember = useMutation({
    mutationFn: (id: string) => api.patch(`/corporate/members/${id}/exit`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["global-members"] }),
  });

  const filtered = (members ?? []).filter((m: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      m.patient?.mrn?.toLowerCase().includes(q) ||
      m.patient?.firstName?.toLowerCase().includes(q) ||
      m.patient?.lastName?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Corporate Members</h1>
        <p className="text-sm text-slate-500 mt-0.5">Global view of all enrolled members</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by MRN or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
          />
        </div>
        <select
          value={corporateId}
          onChange={(e) => setCorporateId(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
        >
          <option value="">All Corporates</option>
          {(corporates ?? []).map((c: any) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
        >
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="EXITED">Exited</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-slate-500 text-sm">No members found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs">
              <tr>
                {["MRN", "Name", "Corporate", "Group", "Employee ID", "Join Date", "Status", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((m: any) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{m.patient?.mrn}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {m.patient?.firstName} {m.patient?.lastName}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{m.corporate?.name}</td>
                  <td className="px-4 py-3 text-slate-500">{m.group?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">{m.employeeId ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{m.joinDate ? formatDate(m.joinDate) : "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.status === "ACTIVE" ? "bg-green-100 text-green-700" : m.status === "EXITED" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>
                      {m.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {m.status === "ACTIVE" && (
                      <button
                        onClick={() => exitMember.mutate(m.id)}
                        disabled={exitMember.isPending}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Exit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
