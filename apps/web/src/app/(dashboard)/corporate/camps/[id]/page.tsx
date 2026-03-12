"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Calendar, MapPin, Building2 } from "lucide-react";
import api from "@/lib/api";
import { formatDate } from "@/lib/utils";

type Tab = "overview" | "attendance" | "orders";

export default function CampDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");

  const { data: event, isLoading } = useQuery({
    queryKey: ["event", id],
    queryFn: async () => {
      const res = await api.get(`/corporate/events/${id}`);
      return res.data?.data ?? res.data;
    },
  });

  if (isLoading) {
    return <div className="p-8 text-center text-slate-400">Loading...</div>;
  }

  if (!event) {
    return <div className="p-8 text-center text-slate-400">Event not found</div>;
  }

  const statusColor = {
    SCHEDULED: "bg-blue-100 text-blue-700",
    IN_PROGRESS: "bg-amber-100 text-amber-700",
    COMPLETED: "bg-green-100 text-green-700",
    CANCELLED: "bg-red-100 text-red-700",
  }[event.status as string] ?? "bg-slate-100 text-slate-600";

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-3"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{event.name}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
              <span className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" />
                {event.corporate?.name}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {formatDate(event.scheduledDate)}
                {event.scheduledTime && ` at ${event.scheduledTime}`}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {event.venue}
              </span>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColor}`}>
            {event.status}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {(["overview", "attendance", "orders"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition capitalize ${
              tab === t ? "border-[#1B4F8A] text-[#1B4F8A]" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-3">
            <h3 className="font-semibold text-slate-800">Event Details</h3>
            {[
              ["Event Type", event.eventType?.replace(/_/g, " ")],
              ["Corporate", event.corporate?.name],
              ["Location", event.location?.locationName ?? "All Locations"],
              ["Date", formatDate(event.scheduledDate)],
              ["Time", event.scheduledTime ?? "—"],
              ["Venue", event.venue],
              ["Package", event.package?.name ?? "—"],
              ["Notes", event.notes ?? "—"],
            ].map(([label, value]) => (
              <div key={label} className="flex gap-2 text-sm">
                <span className="text-slate-500 w-28 shrink-0">{label}</span>
                <span className="text-slate-800">{value}</span>
              </div>
            ))}
          </div>

          {event.package && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <h3 className="font-semibold text-slate-800 mb-3">Package: {event.package.name}</h3>
              <div className="space-y-2">
                {(event.package.items ?? []).map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between text-sm py-1 border-b border-slate-100 last:border-0">
                    <span className="text-slate-700">{item.testName}</span>
                    <span className="text-slate-500">₹{item.netPrice}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "attendance" && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
          <h3 className="font-semibold text-slate-800 mb-4">Mark Attendance</h3>
          <p className="text-sm text-slate-500 mb-4">
            Use MRN search to find patient and register their attendance for this event.
          </p>
          <div className="p-4 bg-slate-50 rounded-lg text-sm text-slate-600">
            Attendance registration is handled through the Order creation flow. Go to Front Desk to create an order for this event.
          </div>
        </div>
      )}

      {tab === "orders" && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">Orders ({event.orders?.length ?? 0})</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs">
              <tr>
                {["MRN", "Patient Name", "Order Type", "Invoice To", "Date"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(event.orders ?? []).map((order: any) => (
                <tr key={order.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs">{order.member?.patient?.mrn}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {order.member?.patient?.firstName} {order.member?.patient?.lastName}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{order.orderType}</td>
                  <td className="px-4 py-3 text-slate-500">{order.invoiceTo}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(order.createdAt)}</td>
                </tr>
              ))}
              {(!event.orders || event.orders.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">No orders yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
