"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Plus, Trash2, Search } from "lucide-react";
import { getInitials, getAvatarColor } from "@/lib/utils";
import api from "@/lib/api";

// ── Types ───────────────────────────────────────────────────────────────────

interface FamilyMemberPatient {
  id: string;
  firstName: string;
  lastName: string;
  mrn: string;
}

interface FamilyMember {
  id: string;
  relationship: string;
  memberPatient: FamilyMemberPatient;
}

interface PatientSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  mrn: string;
}

// ── Relationship Badge ──────────────────────────────────────────────────────

function RelationshipBadge({ relationship }: { relationship: string }) {
  const map: Record<string, string> = {
    self: "bg-blue-50 text-blue-700 border-blue-200",
    spouse: "bg-pink-50 text-pink-700 border-pink-200",
    parent: "bg-purple-50 text-purple-700 border-purple-200",
    child: "bg-teal-50 text-teal-700 border-teal-200",
    sibling: "bg-amber-50 text-amber-700 border-amber-200",
    other: "bg-slate-50 text-slate-600 border-slate-200",
  };
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border capitalize ${
        map[relationship.toLowerCase()] ??
        "bg-slate-50 text-slate-600 border-slate-200"
      }`}
    >
      {relationship}
    </span>
  );
}

// ── Add Member Modal ────────────────────────────────────────────────────────

function AddMemberModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [mrnQuery, setMrnQuery] = useState("");
  const [relationship, setRelationship] = useState("spouse");
  const [searchResult, setSearchResult] = useState<PatientSearchResult | null>(
    null
  );
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [submitError, setSubmitError] = useState("");

  async function handleSearch() {
    if (!mrnQuery.trim()) {
      setSearchError("Enter an MRN or name to search");
      return;
    }
    setSearching(true);
    setSearchError("");
    setSearchResult(null);
    try {
      const res = await api.get<{
        data: PatientSearchResult[] | { data: PatientSearchResult[] };
      }>(`/patients/search?q=${encodeURIComponent(mrnQuery)}`);
      // Handle both array and paginated responses
      const results = Array.isArray(res.data.data)
        ? (res.data.data as PatientSearchResult[])
        : (res.data.data as { data: PatientSearchResult[] }).data ?? [];
      if (results.length === 0) {
        setSearchError("No patient found with that MRN or name");
      } else {
        setSearchResult(results[0]);
      }
    } catch {
      setSearchError("Failed to search patients");
    } finally {
      setSearching(false);
    }
  }

  const mutation = useMutation({
    mutationFn: (data: { memberPatientId: string; relationship: string }) =>
      api.post("/portal/family", data),
    onSuccess: () => {
      onSuccess();
      onClose();
    },
    onError: (e: unknown) => {
      setSubmitError(
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to add family member"
      );
    },
  });

  function handleConfirm() {
    if (!searchResult) return;
    mutation.mutate({
      memberPatientId: searchResult.id,
      relationship,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-5">
        <h2 className="text-lg font-bold text-slate-900">Add Family Member</h2>

        {/* MRN Lookup */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Search by MRN or Name
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={mrnQuery}
              onChange={(e) => setMrnQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="e.g. DH-2025-000001 or John Doe"
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={searching}
              className="px-3 py-2 bg-[#1B4F8A] text-white rounded-lg text-sm font-semibold hover:bg-[#163d6a] disabled:opacity-50"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
          {searchError && (
            <p className="text-xs text-red-600 mt-1">{searchError}</p>
          )}
        </div>

        {/* Search Result */}
        {searchResult && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-xs text-green-600 font-semibold mb-1">
              Patient Found
            </p>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                style={{
                  backgroundColor: getAvatarColor(
                    `${searchResult.firstName} ${searchResult.lastName}`
                  ),
                }}
              >
                {getInitials(searchResult.firstName, searchResult.lastName)}
              </div>
              <div>
                <p className="font-semibold text-slate-800">
                  {searchResult.firstName} {searchResult.lastName}
                </p>
                <p className="text-xs text-slate-500 font-mono">
                  {searchResult.mrn}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Relationship */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Relationship
          </label>
          <select
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
          >
            {["self", "spouse", "parent", "child", "sibling", "other"].map(
              (r) => (
                <option key={r} value={r} className="capitalize">
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </option>
              )
            )}
          </select>
        </div>

        {submitError && (
          <p className="text-sm text-red-600 bg-red-50 rounded p-2">
            {submitError}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!searchResult || mutation.isPending}
            className="flex-1 px-4 py-2 bg-[#1B4F8A] rounded-lg text-sm font-semibold text-white hover:bg-[#163d6a] disabled:opacity-50"
          >
            {mutation.isPending ? "Adding..." : "Add Member"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Confirm Remove Dialog ───────────────────────────────────────────────────

function ConfirmRemoveDialog({
  member,
  onClose,
  onConfirm,
  isPending,
}: {
  member: FamilyMember;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Remove Member</h2>
        <p className="text-sm text-slate-600">
          Are you sure you want to remove{" "}
          <span className="font-semibold">
            {member.memberPatient.firstName} {member.memberPatient.lastName}
          </span>{" "}
          from your family account?
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 px-4 py-2 bg-red-600 rounded-lg text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isPending ? "Removing..." : "Remove"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function FamilyPage() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<FamilyMember | null>(null);

  const { data: members, isLoading } = useQuery({
    queryKey: ["portal-family"],
    queryFn: async () => {
      const res = await api.get<{ data: FamilyMember[] }>("/portal/family");
      return res.data.data;
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/portal/family/${id}`),
    onSuccess: () => {
      setRemoveTarget(null);
      qc.invalidateQueries({ queryKey: ["portal-family"] });
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Family Account</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage linked family members for shared health records
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1B4F8A] text-white rounded-lg text-sm font-semibold hover:bg-[#163d6a]"
        >
          <Plus className="w-4 h-4" /> Add Member
        </button>
      </div>

      {/* Members Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 animate-pulse"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-slate-100" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-slate-100 rounded w-3/4" />
                  <div className="h-3 bg-slate-100 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : !members || members.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-blue-400" />
          </div>
          <p className="text-slate-700 font-semibold text-lg">
            No family members linked
          </p>
          <p className="text-sm text-slate-400 mt-1 mb-5">
            Link family members to view and manage their health records from
            your account.
          </p>
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#1B4F8A] text-white rounded-lg text-sm font-semibold hover:bg-[#163d6a]"
          >
            <Plus className="w-4 h-4" /> Add First Member
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {members.map((member) => {
            const fullName = `${member.memberPatient.firstName} ${member.memberPatient.lastName}`;
            const avatarColor = getAvatarColor(fullName);
            const initials = getInitials(
              member.memberPatient.firstName,
              member.memberPatient.lastName
            );

            return (
              <div
                key={member.id}
                className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Avatar */}
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
                      style={{ backgroundColor: avatarColor }}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate">
                        {fullName}
                      </p>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">
                        {member.memberPatient.mrn}
                      </p>
                      <div className="mt-2">
                        <RelationshipBadge
                          relationship={member.relationship}
                        />
                      </div>
                    </div>
                  </div>
                  {/* Remove Button */}
                  <button
                    onClick={() => setRemoveTarget(member)}
                    className="p-1.5 text-slate-300 hover:text-red-500 transition-colors rounded flex-shrink-0"
                    title="Remove member"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {showAdd && (
        <AddMemberModal
          onClose={() => setShowAdd(false)}
          onSuccess={() =>
            qc.invalidateQueries({ queryKey: ["portal-family"] })
          }
        />
      )}

      {removeTarget && (
        <ConfirmRemoveDialog
          member={removeTarget}
          onClose={() => setRemoveTarget(null)}
          onConfirm={() => removeMutation.mutate(removeTarget.id)}
          isPending={removeMutation.isPending}
        />
      )}
    </div>
  );
}
