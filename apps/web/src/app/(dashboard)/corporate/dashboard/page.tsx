"use client";

import { useQuery } from "@tanstack/react-query";
import { Building2, Users, ClipboardList, Calendar, FileText } from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";
import { formatDate } from "@/lib/utils";

export default function CorporateDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["corporate-dashboard"],
    queryFn: async () => {
      const res = await api.get("/corporate/dashboard");
      return res.data?.data ?? res.data;
    },
    refetchInterval: 60_000,
  });

  const stats = data?.stats;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Corporate &amp; Wellness</h1>
        <p className="text-sm text-slate-500 mt-0.5">B2B health services management</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        {[
          { title: "Total Corporates", value: stats?.totalCorporates ?? 0, icon: Building2, color: "bg-blue-50 text-blue-600" },
          { title: "Active Members", value: stats?.activeMembers ?? 0, icon: Users, color: "bg-teal-50 text-teal-600" },
          { title: "This Month Orders", value: stats?.thisMonthOrders ?? 0, icon: ClipboardList, color: "bg-violet-50 text-violet-600" },
          { title: "Upcoming Events", value: stats?.upcomingEvents ?? 0, icon: Calendar, color: "bg-amber-50 text-amber-600" },
          { title: "Pending Invoices", value: stats?.pendingInvoices ?? 0, icon: FileText, color: "bg-rose-50 text-rose-600" },
        ].map(({ title, value, icon: Icon, color }) => (
          <div key={title} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
            <div className={`inline-flex p-2.5 rounded-lg ${color.split(" ")[0]} mb-3`}>
              <Icon className={`w-5 h-5 ${color.split(" ")[1]}`} />
            </div>
            {isLoading ? (
              <div className="h-7 w-20 bg-slate-100 rounded animate-pulse mb-1" />
            ) : (
              <p className="text-2xl font-bold text-slate-900">{value}</p>
            )}
            <p className="text-sm text-slate-500">{title}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Recent Corporates */}
        <div className="xl:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Recent Corporates</h2>
            <Link href="/corporate/corporates" className="text-xs text-[#1B4F8A] hover:underline">
              View all
            </Link>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs">
              <tr>
                {["Name", "Code", "Members", "Status"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data?.recentCorporates ?? []).map((c: any) => (
                <tr
                  key={c.id}
                  className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => (window.location.href = `/corporate/corporates/${c.id}`)}
                >
                  <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.corporateCode}</td>
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
                </tr>
              ))}
              {(!data?.recentCorporates || data.recentCorporates.length === 0) && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                    No corporates yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Upcoming Events */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Upcoming Events</h2>
            <Link href="/corporate/camps" className="text-xs text-[#1B4F8A] hover:underline">
              View all
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {(data?.upcomingEvents ?? []).map((ev: any) => (
              <div key={ev.id} className="px-4 py-3">
                <p className="font-medium text-sm text-slate-900">{ev.name}</p>
                <p className="text-xs text-slate-500">
                  {ev.corporate?.name} · {formatDate(ev.scheduledDate)}
                </p>
                <span
                  className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full ${
                    ev.status === "SCHEDULED"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  {ev.status}
                </span>
              </div>
            ))}
            {(!data?.upcomingEvents || data.upcomingEvents.length === 0) && (
              <p className="px-4 py-8 text-center text-sm text-slate-400">No upcoming events</p>
            )}
          </div>
        </div>
      </div>

      {/* Pending Invoices */}
      {data?.pendingInvoices && data.pendingInvoices.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Pending Invoices</h2>
            <Link href="/corporate/invoices" className="text-xs text-[#1B4F8A] hover:underline">
              View all
            </Link>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs">
              <tr>
                {["Invoice #", "Corporate", "Net Amount", "Status"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.pendingInvoices.map((inv: any) => (
                <tr key={inv.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{inv.invoiceNumber}</td>
                  <td className="px-4 py-3 text-slate-800">{inv.corporate?.name}</td>
                  <td className="px-4 py-3 text-slate-700">₹{inv.netAmount}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-700">
                      {inv.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
