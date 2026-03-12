"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Building2, Plus, Search } from "lucide-react";
import api from "@/lib/api";

export default function CorporatesPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["corporates", search, status, page],
    queryFn: async () => {
      const params: any = { page, limit: 20 };
      if (search) params.search = search;
      if (status) params.status = status;
      const res = await api.get("/corporate/corporates", { params });
      return res.data?.data ?? res.data;
    },
  });

  const corporates = data?.data ?? [];
  const meta = data?.meta ?? { total: 0, page: 1, limit: 20 };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Corporates</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage B2B corporate accounts</p>
        </div>
        <button
          onClick={() => router.push("/corporate/corporates/new")}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1B4F8A] text-white rounded-lg text-sm font-semibold hover:bg-[#163d6a] transition"
        >
          <Plus className="w-4 h-4" />
          Add Corporate
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or code..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
          />
        </div>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
        >
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="PENDING">Pending</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">
            {meta.total} corporates
          </span>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Loading...</div>
        ) : corporates.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <Building2 className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-slate-500 text-sm">No corporates found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs">
              <tr>
                {["Name", "Code", "City", "Members", "Status", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {corporates.map((c: any) => (
                <tr
                  key={c.id}
                  className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => router.push(`/corporate/corporates/${c.id}`)}
                >
                  <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.corporateCode}</td>
                  <td className="px-4 py-3 text-slate-600">{c.city}</td>
                  <td className="px-4 py-3 text-slate-600">{c._count?.members ?? 0}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        c.status === "ACTIVE"
                          ? "bg-green-100 text-green-700"
                          : c.status === "PENDING"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/corporate/corporates/${c.id}`);
                      }}
                      className="text-xs text-[#1B4F8A] hover:underline font-medium"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {meta.total > meta.limit && (
          <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
            <span>Page {page} of {Math.ceil(meta.total / meta.limit)}</span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 border rounded disabled:opacity-40"
              >
                Prev
              </button>
              <button
                disabled={page >= Math.ceil(meta.total / meta.limit)}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 border rounded disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
