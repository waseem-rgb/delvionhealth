"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  GitMerge,
  RefreshCw,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Users,
  Info,
  Phone,
  Mail,
  Calendar,
  Hash,
  ShoppingCart,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { formatDate } from "@/lib/utils";
import api from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────

interface DuplicatePatient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  gender: string;
  dob: string | null;
  orderCount: number;
}

interface DuplicateGroup {
  id: string;
  matchField: string;
  matchValue: string;
  patients: DuplicatePatient[];
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function DuplicatePatientsPage() {
  const queryClient = useQueryClient();
  const [selectedKeep, setSelectedKeep] = useState<Record<string, string>>({});
  const [mergeGroupId, setMergeGroupId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    data: groups,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["patient-duplicates"],
    queryFn: async () => {
      const res = await api.get<{ data: DuplicateGroup[] }>("/patients/duplicates");
      return res.data.data;
    },
  });

  const mergeMutation = useMutation({
    mutationFn: async ({ keepId, mergeId }: { keepId: string; mergeId: string }) => {
      await api.post("/patients/merge", { keepId, mergeId });
    },
    onSuccess: () => {
      setMergeGroupId(null);
      setSuccessMessage("Patients merged successfully. Orders have been transferred.");
      void queryClient.invalidateQueries({ queryKey: ["patient-duplicates"] });
      setTimeout(() => setSuccessMessage(null), 4000);
    },
  });

  const handleSelectKeep = useCallback((groupId: string, patientId: string) => {
    setSelectedKeep((prev) => ({ ...prev, [groupId]: patientId }));
  }, []);

  const handleMerge = useCallback(() => {
    if (!mergeGroupId) return;
    const group = (groups ?? []).find((g) => g.id === mergeGroupId);
    if (!group) return;

    const keepId = selectedKeep[mergeGroupId];
    if (!keepId) return;

    const mergePatient = group.patients.find((p) => p.id !== keepId);
    if (!mergePatient) return;

    mergeMutation.mutate({ keepId, mergeId: mergePatient.id });
  }, [mergeGroupId, groups, selectedKeep, mergeMutation]);

  const mergeGroup = mergeGroupId ? (groups ?? []).find((g) => g.id === mergeGroupId) : null;
  const mergeKeepPatient = mergeGroup
    ? mergeGroup.patients.find((p) => p.id === selectedKeep[mergeGroupId!])
    : null;
  const mergeDuplicatePatient = mergeGroup
    ? mergeGroup.patients.find((p) => p.id !== selectedKeep[mergeGroupId!])
    : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Duplicate Patients"
        subtitle="Detect and merge duplicate patient records"
        breadcrumbs={[{ label: "Patients", href: "/patients" }]}
        actions={
          <button
            onClick={() => void refetch()}
            disabled={isRefetching}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
          >
            {isRefetching ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            Re-scan
          </button>
        }
      />

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <Info size={16} className="text-blue-600 mt-0.5 shrink-0" />
        <div className="text-sm text-blue-800">
          <p className="font-semibold">How duplicate detection works</p>
          <p className="text-blue-700 mt-0.5">
            The system identifies patients with matching phone numbers. Review each group below and
            merge duplicates by selecting the primary record to keep. Orders from the duplicate
            record will be transferred to the primary record.
          </p>
        </div>
      </div>

      {/* Success toast */}
      {successMessage && (
        <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 text-green-800 rounded-lg">
          <CheckCircle2 size={16} className="text-green-600 shrink-0" />
          <span className="text-sm font-medium">{successMessage}</span>
        </div>
      )}

      {/* Loading state */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="h-5 w-48 bg-slate-100 rounded animate-pulse mb-4" />
              <div className="space-y-3">
                <div className="h-16 bg-slate-100 rounded animate-pulse" />
                <div className="h-16 bg-slate-100 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : (groups ?? []).length === 0 ? (
        <EmptyState
          icon={Users}
          title="No Duplicates Found"
          description="All patient records appear to be unique. Run a re-scan to check again."
          action={{ label: "Re-scan", onClick: () => void refetch() }}
        />
      ) : (
        /* ── Duplicate groups ── */
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Found <span className="font-semibold text-slate-700">{(groups ?? []).length}</span> potential duplicate group{(groups ?? []).length !== 1 ? "s" : ""}
          </p>

          {(groups ?? []).map((group) => {
            const keepId = selectedKeep[group.id];

            return (
              <div
                key={group.id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
              >
                {/* Group header */}
                <div className="px-5 py-3 bg-amber-50 border-b border-amber-200 flex items-center gap-3">
                  <AlertTriangle size={14} className="text-amber-600" />
                  <span className="text-sm font-semibold text-amber-800">
                    Potential Duplicates
                  </span>
                  <span className="text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                    Matching {group.matchField}: {group.matchValue}
                  </span>
                </div>

                {/* Patient rows */}
                <div className="divide-y divide-slate-100">
                  {group.patients.map((patient) => {
                    const isKeep = keepId === patient.id;
                    const genderCls =
                      patient.gender === "MALE"
                        ? "bg-blue-50 text-blue-700"
                        : patient.gender === "FEMALE"
                        ? "bg-pink-50 text-pink-700"
                        : "bg-slate-50 text-slate-600";

                    return (
                      <div
                        key={patient.id}
                        className={`px-5 py-4 flex items-center gap-4 transition ${
                          isKeep ? "bg-green-50/50" : ""
                        }`}
                      >
                        {/* Radio button */}
                        <label className="flex items-center gap-2 cursor-pointer shrink-0">
                          <input
                            type="radio"
                            name={`keep-${group.id}`}
                            checked={isKeep}
                            onChange={() => handleSelectKeep(group.id, patient.id)}
                            className="accent-[#1B4F8A]"
                          />
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              isKeep
                                ? "bg-green-100 text-green-700"
                                : "bg-slate-100 text-slate-400"
                            }`}
                          >
                            {isKeep ? "Keep" : "Select"}
                          </span>
                        </label>

                        {/* Patient info */}
                        <div className="flex-1 grid grid-cols-7 gap-3 items-center min-w-0">
                          {/* Name */}
                          <div className="col-span-2">
                            <p className="font-medium text-slate-900 text-sm">
                              {patient.firstName} {patient.lastName}
                            </p>
                            <p className="text-xs text-slate-400 font-mono mt-0.5">
                              {patient.mrn}
                            </p>
                          </div>

                          {/* Phone */}
                          <div className="flex items-center gap-1.5">
                            <Phone size={12} className="text-slate-400" />
                            <span className="text-xs text-slate-600">{patient.phone}</span>
                          </div>

                          {/* Email */}
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Mail size={12} className="text-slate-400 shrink-0" />
                            <span className="text-xs text-slate-600 truncate">
                              {patient.email ?? "—"}
                            </span>
                          </div>

                          {/* Gender */}
                          <div>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${genderCls}`}
                            >
                              {patient.gender
                                ? patient.gender.charAt(0) + patient.gender.slice(1).toLowerCase()
                                : "—"}
                            </span>
                          </div>

                          {/* DOB */}
                          <div className="flex items-center gap-1.5">
                            <Calendar size={12} className="text-slate-400" />
                            <span className="text-xs text-slate-600">
                              {patient.dob ? formatDate(patient.dob) : "—"}
                            </span>
                          </div>

                          {/* Order count */}
                          <div className="flex items-center gap-1.5">
                            <ShoppingCart size={12} className="text-slate-400" />
                            <span className="text-xs text-slate-600 font-medium">
                              {patient.orderCount} order{patient.orderCount !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Merge action */}
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
                  <button
                    onClick={() => {
                      if (!keepId) return;
                      setMergeGroupId(group.id);
                    }}
                    disabled={!keepId}
                    className="flex items-center gap-2 px-4 py-2 bg-[#1B4F8A] hover:bg-[#163d6e] text-white text-sm font-medium rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <GitMerge size={14} />
                    Merge
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Merge confirmation dialog */}
      <ConfirmDialog
        open={mergeGroupId !== null}
        onClose={() => setMergeGroupId(null)}
        onConfirm={handleMerge}
        title="Merge Duplicate Patients"
        message={
          mergeKeepPatient && mergeDuplicatePatient
            ? `This will merge "${mergeDuplicatePatient.firstName} ${mergeDuplicatePatient.lastName}" (${mergeDuplicatePatient.mrn}) into "${mergeKeepPatient.firstName} ${mergeKeepPatient.lastName}" (${mergeKeepPatient.mrn}). All ${mergeDuplicatePatient.orderCount} order(s) from the duplicate record will be transferred to the primary record. This action cannot be undone.`
            : "Please select a primary record to keep before merging."
        }
        confirmText="Merge Patients"
        variant="warning"
        isLoading={mergeMutation.isPending}
      />
    </div>
  );
}
