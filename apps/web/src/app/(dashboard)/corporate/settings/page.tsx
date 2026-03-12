"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, X, Check } from "lucide-react";
import api from "@/lib/api";

export default function CorporateSettingsPage() {
  const qc = useQueryClient();
  const [newIndustry, setNewIndustry] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const { data: industries, isLoading } = useQuery({
    queryKey: ["industries"],
    queryFn: async () => {
      const res = await api.get("/corporate/masters/industries");
      return res.data?.data ?? res.data ?? [];
    },
  });

  const createMut = useMutation({
    mutationFn: (name: string) => api.post("/corporate/masters/industries", { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["industries"] });
      setNewIndustry("");
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.patch(`/corporate/masters/industries/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["industries"] });
      setEditId(null);
    },
  });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Corporate Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage masters and configuration</p>
      </div>

      {/* Industry Masters */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Industry Masters</h2>
          <p className="text-xs text-slate-500 mt-0.5">Industries used when creating corporate accounts</p>
        </div>

        {/* Add new */}
        <div className="px-5 py-4 border-b border-slate-100 flex gap-2">
          <input
            type="text"
            placeholder="Add industry name..."
            value={newIndustry}
            onChange={(e) => setNewIndustry(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newIndustry.trim()) createMut.mutate(newIndustry.trim());
            }}
            className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
          />
          <button
            onClick={() => newIndustry.trim() && createMut.mutate(newIndustry.trim())}
            disabled={createMut.isPending || !newIndustry.trim()}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#1B4F8A] text-white rounded-lg text-sm font-semibold disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>

        {isLoading ? (
          <div className="p-6 text-center text-slate-400">Loading...</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {(industries ?? []).map((ind: any) => (
              <div key={ind.id} className="px-5 py-3 flex items-center justify-between">
                {editId === ind.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
                    />
                    <button
                      onClick={() => updateMut.mutate({ id: ind.id, data: { name: editName } })}
                      className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditId(null)}
                      className="p-1.5 text-slate-400 hover:bg-slate-100 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-800">{ind.name}</span>
                      {!ind.isActive && (
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-xs rounded">Inactive</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditId(ind.id);
                          setEditName(ind.name);
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => updateMut.mutate({ id: ind.id, data: { isActive: !ind.isActive } })}
                        className={`text-xs px-2 py-1 rounded ${ind.isActive ? "text-red-500 hover:bg-red-50" : "text-green-600 hover:bg-green-50"}`}
                      >
                        {ind.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
            {(!industries || industries.length === 0) && (
              <div className="px-5 py-8 text-center text-sm text-slate-400">
                No industries yet. Add one above.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
