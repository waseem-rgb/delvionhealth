"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Building2, Users, Package, Calendar, FileText, HeartHandshake, MessageSquare, MapPin } from "lucide-react";
import api from "@/lib/api";
import { formatDate } from "@/lib/utils";

type Tab = "overview" | "members" | "groups" | "packages" | "events" | "invoices" | "wellness" | "feedback";

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "overview", label: "Overview", icon: Building2 },
  { key: "members", label: "Members", icon: Users },
  { key: "groups", label: "Groups", icon: Users },
  { key: "packages", label: "Packages", icon: Package },
  { key: "events", label: "Events", icon: Calendar },
  { key: "invoices", label: "Invoices", icon: FileText },
  { key: "wellness", label: "Wellness", icon: HeartHandshake },
  { key: "feedback", label: "Feedback", icon: MessageSquare },
];

export default function CorporateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");
  const [replyModal, setReplyModal] = useState<{ id: string; subject: string } | null>(null);
  const [replyText, setReplyText] = useState("");
  const [addGroupForm, setAddGroupForm] = useState({ name: "", discountPercent: "", emailDomain: "" });
  const [showAddGroup, setShowAddGroup] = useState(false);

  const { data: corp, isLoading } = useQuery({
    queryKey: ["corporate", id],
    queryFn: async () => {
      const res = await api.get(`/corporate/corporates/${id}`);
      return res.data?.data ?? res.data;
    },
  });

  const { data: members } = useQuery({
    queryKey: ["corporate-members", id],
    queryFn: async () => {
      const res = await api.get(`/corporate/corporates/${id}/members`);
      return res.data?.data ?? res.data;
    },
    enabled: tab === "members",
  });

  const { data: packages } = useQuery({
    queryKey: ["corporate-packages", id],
    queryFn: async () => {
      const res = await api.get("/corporate/packages", { params: { corporateId: id } });
      return res.data?.data ?? res.data ?? [];
    },
    enabled: tab === "packages",
  });

  const { data: events } = useQuery({
    queryKey: ["corporate-events", id],
    queryFn: async () => {
      const res = await api.get("/corporate/events", { params: { corporateId: id } });
      return res.data?.data ?? res.data ?? [];
    },
    enabled: tab === "events",
  });

  const { data: invoices } = useQuery({
    queryKey: ["corporate-invoices", id],
    queryFn: async () => {
      const res = await api.get("/corporate/invoices", { params: { corporateId: id } });
      return res.data?.data ?? res.data ?? [];
    },
    enabled: tab === "invoices",
  });

  const { data: wellness } = useQuery({
    queryKey: ["corporate-wellness", id],
    queryFn: async () => {
      const res = await api.get(`/corporate/wellness/${id}`);
      return res.data?.data ?? res.data;
    },
    enabled: tab === "wellness",
  });

  const { data: feedback } = useQuery({
    queryKey: ["corporate-feedback", id],
    queryFn: async () => {
      const res = await api.get("/corporate/feedback", { params: { corporateId: id } });
      return res.data?.data ?? res.data ?? [];
    },
    enabled: tab === "feedback",
  });

  const exitMember = useMutation({
    mutationFn: (memberId: string) => api.patch(`/corporate/members/${memberId}/exit`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["corporate-members", id] }),
  });

  const replyFeedback = useMutation({
    mutationFn: ({ fid, reply }: { fid: string; reply: string }) =>
      api.post(`/corporate/feedback/${fid}/reply`, { reply }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["corporate-feedback", id] });
      setReplyModal(null);
      setReplyText("");
    },
  });

  const addGroup = useMutation({
    mutationFn: (dto: any) => api.post("/corporate/groups", { ...dto, corporateId: id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["corporate", id] });
      setShowAddGroup(false);
      setAddGroupForm({ name: "", discountPercent: "", emailDomain: "" });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 bg-slate-100 rounded animate-pulse" />
        <div className="h-48 bg-white rounded-xl border border-slate-100 animate-pulse" />
      </div>
    );
  }

  if (!corp) {
    return <div className="text-center py-12 text-slate-400">Corporate not found</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-3"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Corporates
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{corp.name}</h1>
            <p className="text-sm text-slate-500 mt-0.5 font-mono">{corp.corporateCode}</p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              corp.status === "ACTIVE"
                ? "bg-green-100 text-green-700"
                : corp.status === "PENDING"
                ? "bg-amber-100 text-amber-700"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {corp.status}
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm text-center">
          <p className="text-2xl font-bold text-slate-900">{corp._count?.members ?? 0}</p>
          <p className="text-xs text-slate-500 mt-0.5">Members</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm text-center">
          <p className="text-2xl font-bold text-slate-900">{corp._count?.events ?? 0}</p>
          <p className="text-xs text-slate-500 mt-0.5">Events</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm text-center">
          <p className="text-2xl font-bold text-slate-900">{corp._count?.invoices ?? 0}</p>
          <p className="text-xs text-slate-500 mt-0.5">Invoices</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${
              tab === key
                ? "border-[#1B4F8A] text-[#1B4F8A]"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-3">
            <h3 className="font-semibold text-slate-800">Details</h3>
            {[
              ["Industry", corp.industry ?? "—"],
              ["Address", corp.address],
              ["City", corp.city],
              ["Pincode", corp.pincode],
              ["Contact", corp.contactName],
              ["Phone", corp.contactPhone],
              ["Email", corp.contactEmail],
              ["Notes", corp.notes ?? "—"],
            ].map(([label, value]) => (
              <div key={label} className="flex gap-2 text-sm">
                <span className="text-slate-500 w-24 shrink-0">{label}</span>
                <span className="text-slate-800 break-all">{value}</span>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            {/* Locations */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  Locations
                </h3>
              </div>
              <div className="space-y-2">
                {(corp.locations ?? []).map((loc: any) => (
                  <div key={loc.id} className="p-2.5 rounded-lg bg-slate-50 text-sm">
                    <p className="font-medium text-slate-800">{loc.locationName}</p>
                    <p className="text-xs text-slate-500 font-mono">{loc.locationCode}</p>
                    <p className="text-xs text-slate-500">{loc.city}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Groups */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <h3 className="font-semibold text-slate-800 mb-3">Groups</h3>
              <div className="space-y-2">
                {(corp.groups ?? []).map((g: any) => (
                  <div key={g.id} className="p-2.5 rounded-lg bg-slate-50 text-sm flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-800">{g.name}</p>
                      <p className="text-xs text-slate-500 font-mono">{g.groupCode}</p>
                    </div>
                    <span className="text-xs text-slate-500">{g.discountPercent}% off</span>
                  </div>
                ))}
                {(corp.groups ?? []).length === 0 && (
                  <p className="text-xs text-slate-400">No groups yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "members" && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs">
              <tr>
                {["MRN", "Name", "Phone", "Group", "Status", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(members?.data ?? []).map((m: any) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs">{m.patient?.mrn}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {m.patient?.firstName} {m.patient?.lastName}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{m.patient?.phone}</td>
                  <td className="px-4 py-3 text-slate-500">{m.group?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.status === "ACTIVE" ? "bg-green-100 text-green-700" : m.status === "EXITED" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>
                      {m.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {m.status === "ACTIVE" && (
                      <button
                        onClick={() => exitMember.mutate(m.id)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Exit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {(!members?.data || members.data.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">No members found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "groups" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowAddGroup(true)}
              className="px-4 py-2 bg-[#1B4F8A] text-white rounded-lg text-sm font-semibold hover:bg-[#163d6a]"
            >
              Add Group
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(corp.groups ?? []).map((g: any) => (
              <div key={g.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-slate-900">{g.name}</h4>
                  <span className="font-mono text-xs text-slate-500">{g.groupCode}</span>
                </div>
                <div className="text-sm text-slate-500 space-y-1">
                  <p>Discount: {g.discountPercent}% ({g.discountType})</p>
                  {g.emailDomain && <p>Email domain: @{g.emailDomain}</p>}
                  <p>Max dependents: {g.maxDependents}</p>
                </div>
              </div>
            ))}
          </div>

          {showAddGroup && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
                <h3 className="font-semibold text-slate-900">Add Group</h3>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Group Name *</label>
                  <input
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
                    value={addGroupForm.name}
                    onChange={(e) => setAddGroupForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Discount %</label>
                  <input
                    type="number"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
                    value={addGroupForm.discountPercent}
                    onChange={(e) => setAddGroupForm((f) => ({ ...f, discountPercent: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Email Domain (optional)</label>
                  <input
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
                    placeholder="company.com"
                    value={addGroupForm.emailDomain}
                    onChange={(e) => setAddGroupForm((f) => ({ ...f, emailDomain: e.target.value }))}
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setShowAddGroup(false)}
                    className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() =>
                      addGroup.mutate({
                        name: addGroupForm.name,
                        discountPercent: parseFloat(addGroupForm.discountPercent || "0"),
                        emailDomain: addGroupForm.emailDomain || undefined,
                      })
                    }
                    disabled={addGroup.isPending || !addGroupForm.name.trim()}
                    className="flex-1 px-4 py-2 bg-[#1B4F8A] text-white rounded-lg text-sm font-semibold hover:bg-[#163d6a] disabled:opacity-50"
                  >
                    {addGroup.isPending ? "Adding..." : "Add Group"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "packages" && (
        <div className="space-y-3">
          {(packages ?? []).length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-8 text-center text-slate-400">
              No packages configured
            </div>
          ) : (
            (packages ?? []).map((pkg: any) => (
              <div key={pkg.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-semibold text-slate-900">{pkg.name}</h4>
                    <span className="font-mono text-xs text-slate-500">{pkg.packageCode}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900">₹{pkg.netPrice}</p>
                    <p className="text-xs text-slate-500">{pkg.packageType}</p>
                  </div>
                </div>
                <div className="text-xs text-slate-500">
                  Valid: {formatDate(pkg.validFrom)} — {formatDate(pkg.validTo)} |
                  Used: {pkg.usedCount}/{pkg.maxUses ?? "∞"}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "events" && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs">
              <tr>
                {["Name", "Type", "Date", "Venue", "Status"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(events ?? []).map((ev: any) => (
                <tr key={ev.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => router.push(`/corporate/camps/${ev.id}`)}>
                  <td className="px-4 py-3 font-medium text-slate-900">{ev.name}</td>
                  <td className="px-4 py-3 text-slate-500">{ev.eventType}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(ev.scheduledDate)}</td>
                  <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{ev.venue}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ev.status === "SCHEDULED" ? "bg-blue-100 text-blue-700" : ev.status === "COMPLETED" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>
                      {ev.status}
                    </span>
                  </td>
                </tr>
              ))}
              {(!events || events.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">No events found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "invoices" && (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            <button
              onClick={() => router.push("/corporate/invoices")}
              className="px-4 py-2 bg-[#1B4F8A] text-white rounded-lg text-sm font-semibold hover:bg-[#163d6a]"
            >
              Generate B2B Invoice
            </button>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs">
                <tr>
                  {["Invoice #", "Type", "Period", "Net Amount", "Status"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(invoices ?? []).map((inv: any) => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3 text-slate-600">{inv.invoiceType}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(inv.fromDate)} — {formatDate(inv.toDate)}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">₹{inv.netAmount}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${inv.status === "PAID" ? "bg-green-100 text-green-700" : inv.status === "OVERDUE" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {(!invoices || invoices.length === 0) && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">No invoices found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "wellness" && (
        <div className="space-y-4">
          {wellness ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm text-center">
                  <p className="text-2xl font-bold text-slate-900">{wellness.memberStats?.totalMembers ?? 0}</p>
                  <p className="text-xs text-slate-500">Total Members</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm text-center">
                  <p className="text-2xl font-bold text-green-600">{wellness.memberStats?.activeMembers ?? 0}</p>
                  <p className="text-xs text-slate-500">Active</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm text-center">
                  <p className="text-2xl font-bold text-slate-400">{wellness.memberStats?.exitedMembers ?? 0}</p>
                  <p className="text-xs text-slate-500">Exited</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
                  <p className="text-sm font-semibold text-slate-700 mb-2">Orders</p>
                  <p className="text-lg font-bold text-slate-900">{wellness.orders?.thisMonth ?? 0} <span className="text-sm font-normal text-slate-400">this month</span></p>
                  <p className="text-sm text-slate-500">{wellness.orders?.lastMonth ?? 0} last month</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
                  <p className="text-sm font-semibold text-slate-700 mb-2">Upcoming Events</p>
                  <p className="text-lg font-bold text-slate-900">{wellness.upcomingEvents?.length ?? 0}</p>
                </div>
              </div>

              {wellness.packageUtilization?.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                  <h3 className="font-semibold text-slate-800 mb-3">Package Utilization</h3>
                  <div className="space-y-3">
                    {wellness.packageUtilization.map((p: any) => (
                      <div key={p.id}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-slate-700">{p.name}</span>
                          <span className="text-slate-500">{p.usedCount}/{p.maxUses ?? "∞"}</span>
                        </div>
                        {p.maxUses && (
                          <div className="w-full bg-slate-100 rounded-full h-1.5">
                            <div
                              className="bg-[#1B4F8A] h-1.5 rounded-full"
                              style={{ width: `${Math.min(p.percent ?? 0, 100)}%` }}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white rounded-xl border border-slate-100 p-8 text-center text-slate-400">
              Loading wellness data...
            </div>
          )}
        </div>
      )}

      {tab === "feedback" && (
        <div className="space-y-3">
          {(feedback ?? []).map((fb: any) => (
            <div key={fb.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-semibold text-slate-900">{fb.subject}</h4>
                  <p className="text-sm text-slate-500 mt-1">{fb.message}</p>
                  {fb.reply && (
                    <div className="mt-2 p-2.5 bg-slate-50 rounded-lg text-sm text-slate-600 border-l-2 border-[#1B4F8A]">
                      <p className="text-xs text-slate-400 mb-1">Reply:</p>
                      {fb.reply}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${fb.status === "OPEN" ? "bg-amber-100 text-amber-700" : fb.status === "REPLIED" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                    {fb.status}
                  </span>
                  <p className="text-xs text-slate-400">{formatDate(fb.createdAt)}</p>
                  {fb.status === "OPEN" && (
                    <button
                      onClick={() => setReplyModal({ id: fb.id, subject: fb.subject })}
                      className="text-xs text-[#1B4F8A] hover:underline"
                    >
                      Reply
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {(!feedback || feedback.length === 0) && (
            <div className="bg-white rounded-xl border border-slate-100 p-8 text-center text-slate-400">
              No feedback yet
            </div>
          )}
        </div>
      )}

      {/* Reply Modal */}
      {replyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-semibold text-slate-900">Reply to: {replyModal.subject}</h3>
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={4}
              placeholder="Type your reply..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30 resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setReplyModal(null); setReplyText(""); }}
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => replyFeedback.mutate({ fid: replyModal.id, reply: replyText })}
                disabled={replyFeedback.isPending || !replyText.trim()}
                className="flex-1 px-4 py-2 bg-[#1B4F8A] text-white rounded-lg text-sm font-semibold hover:bg-[#163d6a] disabled:opacity-50"
              >
                {replyFeedback.isPending ? "Sending..." : "Send Reply"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
