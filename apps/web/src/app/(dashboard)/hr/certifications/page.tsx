"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Award,
  Search,
  X,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  CalendarClock,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import api from "@/lib/api";

// -- Types --------------------------------------------------------------------

interface Certification {
  id: string;
  employeeName: string;
  certificationName: string;
  issuingBody: string;
  issueDate: string;
  expiryDate: string;
}

// -- Mock data (easy to swap out for real API later) --------------------------

const MOCK_CERTIFICATIONS: Certification[] = [
  {
    id: "cert-001",
    employeeName: "Dr. Priya Sharma",
    certificationName: "NABL Assessor Training",
    issuingBody: "NABL India",
    issueDate: "2024-06-15",
    expiryDate: "2026-06-15",
  },
  {
    id: "cert-002",
    employeeName: "Rahul Verma",
    certificationName: "DMLT Certification",
    issuingBody: "Paramedical Board",
    issueDate: "2023-03-20",
    expiryDate: "2026-03-20",
  },
  {
    id: "cert-003",
    employeeName: "Anita Desai",
    certificationName: "ISO 15189 Internal Auditor",
    issuingBody: "BSI Group",
    issueDate: "2025-01-10",
    expiryDate: "2027-01-10",
  },
  {
    id: "cert-004",
    employeeName: "Vikram Patel",
    certificationName: "Phlebotomy Technician",
    issuingBody: "NHA India",
    issueDate: "2022-09-01",
    expiryDate: "2025-09-01",
  },
  {
    id: "cert-005",
    employeeName: "Meena Kumari",
    certificationName: "Clinical Chemistry Specialist",
    issuingBody: "ASCP Board",
    issueDate: "2024-11-05",
    expiryDate: "2027-11-05",
  },
  {
    id: "cert-006",
    employeeName: "Suresh Nair",
    certificationName: "Hematology Technician",
    issuingBody: "NABL India",
    issueDate: "2023-07-12",
    expiryDate: "2025-07-12",
  },
  {
    id: "cert-007",
    employeeName: "Kavita Joshi",
    certificationName: "Microbiology Lab Safety",
    issuingBody: "CDC/WHO",
    issueDate: "2024-04-20",
    expiryDate: "2026-04-20",
  },
  {
    id: "cert-008",
    employeeName: "Amit Chauhan",
    certificationName: "Blood Bank Technician",
    issuingBody: "NACO India",
    issueDate: "2021-12-01",
    expiryDate: "2024-12-01",
  },
];

// -- Status helpers -----------------------------------------------------------

function getCertStatus(expiryDate: string): "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" {
  const now = new Date();
  const expiry = new Date(expiryDate);
  if (expiry < now) return "EXPIRED";
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  if (expiry.getTime() - now.getTime() <= thirtyDaysMs) return "EXPIRING_SOON";
  return "ACTIVE";
}

const STATUS_BADGE: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  ACTIVE: {
    label: "Active",
    cls: "bg-green-50 text-green-700 border-green-200",
    icon: <ShieldCheck className="w-3 h-3" />,
  },
  EXPIRING_SOON: {
    label: "Expiring Soon",
    cls: "bg-amber-50 text-amber-700 border-amber-200",
    icon: <AlertTriangle className="w-3 h-3" />,
  },
  EXPIRED: {
    label: "Expired",
    cls: "bg-red-50 text-red-700 border-red-200",
    icon: <XCircle className="w-3 h-3" />,
  },
};

function CertStatusBadge({ status }: { status: string }) {
  const s = STATUS_BADGE[status] ?? STATUS_BADGE["ACTIVE"];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${s.cls}`}
    >
      {s.icon}
      {s.label}
    </span>
  );
}

// -- Add Certification Modal --------------------------------------------------

function AddCertificationModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [employeeName, setEmployeeName] = useState("");
  const [certificationName, setCertificationName] = useState("");
  const [issuingBody, setIssuingBody] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      api.post("/hr/certifications", {
        employeeName: employeeName.trim(),
        certificationName: certificationName.trim(),
        issuingBody: issuingBody.trim(),
        issueDate,
        expiryDate,
      }),
    onSuccess: () => {
      onSuccess();
      onClose();
    },
    onError: (e: unknown) => {
      setError(
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to add certification"
      );
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!employeeName.trim()) {
      setError("Employee name is required");
      return;
    }
    if (!certificationName.trim()) {
      setError("Certification name is required");
      return;
    }
    if (!issuingBody.trim()) {
      setError("Issuing body is required");
      return;
    }
    if (!issueDate) {
      setError("Issue date is required");
      return;
    }
    if (!expiryDate) {
      setError("Expiry date is required");
      return;
    }
    if (new Date(expiryDate) <= new Date(issueDate)) {
      setError("Expiry date must be after issue date");
      return;
    }
    setError("");
    mutation.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">
            Add Certification
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-100 text-slate-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Employee Name *
            </label>
            <input
              type="text"
              value={employeeName}
              onChange={(e) => setEmployeeName(e.target.value)}
              placeholder="e.g. Dr. Priya Sharma"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Certification Name *
            </label>
            <input
              type="text"
              value={certificationName}
              onChange={(e) => setCertificationName(e.target.value)}
              placeholder="e.g. NABL Assessor Training"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Issuing Body *
            </label>
            <input
              type="text"
              value={issuingBody}
              onChange={(e) => setIssuingBody(e.target.value)}
              placeholder="e.g. NABL India"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Issue Date *
              </label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Expiry Date *
              </label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 px-4 py-2 bg-blue-600 rounded-lg text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {mutation.isPending ? "Adding..." : "Add Certification"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -- Main Page ----------------------------------------------------------------

export default function CertificationsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  // Try to fetch from API; fall back to mock data if endpoint doesn't exist
  const { data: certifications, isLoading } = useQuery({
    queryKey: ["hr-certifications"],
    queryFn: async () => {
      try {
        const res = await api.get("/hr/certifications");
        const payload = res.data?.data ?? res.data;
        const list = Array.isArray(payload) ? payload : payload?.data ?? [];
        return list as Certification[];
      } catch {
        // Endpoint may not exist yet - use mock data
        return MOCK_CERTIFICATIONS;
      }
    },
  });

  const items = (certifications ?? []).filter((cert) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      cert.employeeName.toLowerCase().includes(q) ||
      cert.certificationName.toLowerCase().includes(q) ||
      cert.issuingBody.toLowerCase().includes(q)
    );
  });

  // KPI calculations
  const kpis = useMemo(() => {
    const all = certifications ?? [];
    let active = 0;
    let expiringSoon = 0;
    let expired = 0;
    for (const cert of all) {
      const status = getCertStatus(cert.expiryDate);
      if (status === "ACTIVE") active++;
      else if (status === "EXPIRING_SOON") expiringSoon++;
      else expired++;
    }
    return { active, expiringSoon, expired };
  }, [certifications]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Employee Certifications
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Track and manage employee certifications, licenses, and credentials
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> Add Certification
        </button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: "Total Active",
            value: kpis.active,
            icon: ShieldCheck,
            color: "bg-green-50 text-green-600",
          },
          {
            label: "Expiring in 30 Days",
            value: kpis.expiringSoon,
            icon: CalendarClock,
            color: "bg-amber-50 text-amber-600",
          },
          {
            label: "Expired",
            value: kpis.expired,
            icon: XCircle,
            color: "bg-red-50 text-red-600",
          },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="bg-white rounded-xl border border-slate-100 shadow-sm p-5"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${kpi.color}`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">
                    {kpi.value}
                  </p>
                  <p className="text-xs text-slate-500">{kpi.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="search"
          placeholder="Search by employee, certification, or issuing body..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-14 bg-slate-100 rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-16 text-center">
            <Award className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No certifications found</p>
            <p className="text-slate-300 text-xs mt-1">
              Add a certification to start tracking
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-500">
                  Employee
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">
                  Certification
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">
                  Issuing Body
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">
                  Issue Date
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">
                  Expiry Date
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((cert) => {
                const status = getCertStatus(cert.expiryDate);
                const initials = cert.employeeName
                  .split(" ")
                  .filter((w) => w.length > 0)
                  .map((w) => w[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2);
                return (
                  <tr
                    key={cert.id}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-xs flex-shrink-0">
                          {initials}
                        </div>
                        <span className="font-medium text-slate-900">
                          {cert.employeeName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span className="text-slate-800 font-medium">
                          {cert.certificationName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {cert.issuingBody}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {formatDate(cert.issueDate)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span
                        className={
                          status === "EXPIRED"
                            ? "text-red-600 font-medium"
                            : status === "EXPIRING_SOON"
                            ? "text-amber-600 font-medium"
                            : "text-slate-500"
                        }
                      >
                        {formatDate(cert.expiryDate)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <CertStatusBadge status={status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showAddModal && (
        <AddCertificationModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() =>
            queryClient.invalidateQueries({ queryKey: ["hr-certifications"] })
          }
        />
      )}
    </div>
  );
}
