"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Pencil,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Activity,
  ClipboardList,
  FileText,
  Clock,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { KPICard } from "@/components/shared/KPICard";
import { formatDate, formatCurrency, formatRelativeTime, getAvatarColor } from "@/lib/utils";
import api from "@/lib/api";

interface Patient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  fullName: string;
  initials: string;
  age: number;
  dob: string;
  gender: string;
  phone: string;
  email: string | null;
  address: string | null;
  insuranceId: string | null;
  referringDoctorId: string | null;
  createdAt: string;
  branch: { id: string; name: string } | null;
  orders: {
    id: string;
    orderNumber: string;
    status: string;
    netAmount: string;
    createdAt: string;
    _count: { items: number };
  }[];
}

interface PatientStats {
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  totalSpend: number;
  lastVisitDate: string | null;
  mostRequestedTest: string | null;
}

interface TimelineEvent {
  date: string;
  type: string;
  description: string;
  entityId: string;
}

const TABS = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "orders", label: "Orders", icon: ClipboardList },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "timeline", label: "Timeline", icon: Clock },
  { id: "documents", label: "Documents", icon: FileText },
];

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");

  const { data: patient, isLoading } = useQuery({
    queryKey: ["patient", id],
    queryFn: async () => {
      const res = await api.get<{ data: Patient }>(`/patients/${id}`);
      return res.data.data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["patient-stats", id],
    queryFn: async () => {
      const res = await api.get<{ data: PatientStats }>(`/patients/${id}/stats`);
      return res.data.data;
    },
    enabled: !!patient,
  });

  const { data: timeline } = useQuery({
    queryKey: ["patient-timeline", id],
    enabled: activeTab === "timeline",
    queryFn: async () => {
      const res = await api.get<{ data: TimelineEvent[] }>(`/patients/${id}/timeline`);
      return res.data.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={28} className="animate-spin text-[#1B4F8A]" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
        <AlertCircle size={40} />
        <p>Patient not found</p>
        <button onClick={() => router.push("/patients")} className="text-sm text-[#1B4F8A] underline">
          Back to patients
        </button>
      </div>
    );
  }

  const avatarColor = getAvatarColor(patient.fullName);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors mt-1"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="flex items-center gap-4 flex-1">
          {/* Avatar */}
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-bold shrink-0"
            style={{ backgroundColor: avatarColor }}
          >
            {patient.initials}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">{patient.fullName}</h1>
              <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-[#1B4F8A]/10 text-[#1B4F8A] font-semibold">
                {patient.mrn}
              </span>
              <StatusBadge status={patient.gender} />
            </div>
            <div className="flex items-center gap-4 mt-1.5 text-sm text-slate-500">
              <span className="flex items-center gap-1.5">
                <Calendar size={13} />
                {patient.age} years · {formatDate(patient.dob)}
              </span>
              {patient.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone size={13} />
                  {patient.phone}
                </span>
              )}
              {patient.email && (
                <span className="flex items-center gap-1.5">
                  <Mail size={13} />
                  {patient.email}
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={() => router.push(`/patients/${patient.id}/edit`)}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <Pencil size={14} />
          Edit
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Orders"
          value={stats?.totalOrders ?? 0}
          icon={ClipboardList}
          iconColor="bg-blue-100 text-blue-600"
        />
        <KPICard
          title="Completed"
          value={stats?.completedOrders ?? 0}
          icon={FileText}
          iconColor="bg-green-100 text-green-600"
        />
        <KPICard
          title="Pending"
          value={stats?.pendingOrders ?? 0}
          icon={Activity}
          iconColor="bg-orange-100 text-orange-600"
        />
        <KPICard
          title="Total Spend"
          value={formatCurrency(stats?.totalSpend ?? 0)}
          icon={ClipboardList}
          iconColor="bg-teal-100 text-teal-600"
        />
      </div>

      {/* Tabs */}
      <div>
        <div className="flex items-center gap-1 border-b border-slate-200">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
                activeTab === tab.id
                  ? "border-[#1B4F8A] text-[#1B4F8A]"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-5">
          {/* Overview tab */}
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Demographics */}
              <div className="bg-white rounded-xl card-shadow p-5">
                <h3 className="font-semibold text-slate-900 mb-4">Demographics</h3>
                <dl className="space-y-3">
                  <InfoRow label="Full Name" value={patient.fullName} />
                  <InfoRow label="MRN" value={<code className="font-mono text-[#1B4F8A]">{patient.mrn}</code>} />
                  <InfoRow label="Date of Birth" value={`${formatDate(patient.dob)} (${patient.age} yrs)`} />
                  <InfoRow label="Gender" value={<StatusBadge status={patient.gender} />} />
                  <InfoRow label="Phone" value={patient.phone} />
                  <InfoRow label="Email" value={patient.email ?? "—"} />
                  {patient.address && <InfoRow label="Address" value={patient.address} icon={MapPin} />}
                  <InfoRow label="Branch" value={patient.branch?.name ?? "—"} />
                  <InfoRow label="Registered" value={formatDate(patient.createdAt)} />
                </dl>
              </div>

              {/* Additional */}
              <div className="bg-white rounded-xl card-shadow p-5">
                <h3 className="font-semibold text-slate-900 mb-4">Additional Information</h3>
                <dl className="space-y-3">
                  <InfoRow
                    label="Insurance ID"
                    value={patient.insuranceId ?? "Not provided"}
                  />
                  <InfoRow
                    label="Referring Doctor"
                    value={patient.referringDoctorId ?? "Not assigned"}
                  />
                  {stats?.mostRequestedTest && (
                    <InfoRow
                      label="Most Requested Test"
                      value={stats.mostRequestedTest}
                    />
                  )}
                  {stats?.lastVisitDate && (
                    <InfoRow
                      label="Last Visit"
                      value={formatRelativeTime(stats.lastVisitDate)}
                    />
                  )}
                </dl>
              </div>
            </div>
          )}

          {/* Orders tab */}
          {activeTab === "orders" && (
            <div className="bg-white rounded-xl card-shadow overflow-hidden">
              {patient.orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                  <ClipboardList size={32} />
                  <p className="text-sm">No orders yet</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {["Order #", "Tests", "Status", "Amount", "Date"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {patient.orders.map((o) => (
                      <tr
                        key={o.id}
                        className="hover:bg-slate-50 cursor-pointer transition"
                        onClick={() => router.push(`/orders/${o.id}`)}
                      >
                        <td className="px-4 py-3 font-mono text-xs text-[#1B4F8A] font-semibold">
                          {o.orderNumber}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{o._count.items} test(s)</td>
                        <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                        <td className="px-4 py-3 text-slate-700">
                          {formatCurrency(Number(o.netAmount))}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">
                          {formatDate(o.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Reports tab */}
          {activeTab === "reports" && (
            <div className="bg-white rounded-xl card-shadow p-8 text-center text-slate-400">
              <FileText size={36} className="mx-auto mb-3" />
              <p className="text-sm">Reports will appear here once orders are resulted and signed.</p>
            </div>
          )}

          {/* Timeline tab */}
          {activeTab === "timeline" && (
            <div className="bg-white rounded-xl card-shadow p-5">
              {!timeline ? (
                <div className="flex justify-center py-8">
                  <Loader2 size={20} className="animate-spin text-slate-400" />
                </div>
              ) : timeline.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">No activity yet</div>
              ) : (
                <ol className="relative border-l border-slate-200 space-y-6 pl-6">
                  {timeline.map((event, i) => (
                    <li key={i} className="relative">
                      <div className="absolute -left-7 w-3.5 h-3.5 rounded-full bg-[#1B4F8A] border-2 border-white mt-0.5" />
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{event.description}</p>
                          <p className="text-xs text-slate-400 mt-0.5 capitalize">
                            {event.type.replace(/_/g, " ")}
                          </p>
                        </div>
                        <span className="text-xs text-slate-400 shrink-0 ml-4">
                          {formatRelativeTime(event.date)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          {/* Documents tab */}
          {activeTab === "documents" && (
            <div className="bg-white rounded-xl card-shadow p-8 text-center text-slate-400">
              <FileText size={36} className="mx-auto mb-3" />
              <p className="text-sm">Document management coming in a future phase.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ElementType;
}) {
  return (
    <div className="flex items-start gap-4">
      <dt className="text-sm text-slate-400 w-36 shrink-0">{label}</dt>
      <dd className="text-sm text-slate-900 flex items-center gap-1.5">
        {Icon && <Icon size={12} className="text-slate-400 shrink-0" />}
        {value}
      </dd>
    </div>
  );
}
