"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Users,
  FileText,
  TrendingUp,
  ClipboardList,
  Calendar,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";

interface DoctorDashboardData {
  totalReferrals: number;
  pendingReports: number;
  totalPatients: number;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    patientName: string;
    date: string;
    status: string;
    testCount: number;
  }>;
  recentReports: Array<{
    id: string;
    patientName: string;
    reportDate: string;
    status: string;
  }>;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  IN_PROCESSING: "bg-violet-100 text-violet-700",
  RESULTED: "bg-teal-100 text-teal-700",
  COMPLETED: "bg-green-100 text-green-700",
  GENERATED: "bg-blue-100 text-blue-700",
  SIGNED: "bg-green-100 text-green-700",
  DELIVERED: "bg-slate-100 text-slate-700",
};

export default function DoctorPortalDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["doctor-portal-dashboard"],
    queryFn: async () => {
      try {
        const res = await api.get("/portal/doctor/dashboard");
        return (res.data?.data ?? res.data) as DoctorDashboardData;
      } catch {
        return null;
      }
    },
    staleTime: 60_000,
  });

  const stats = data ?? { totalReferrals: 0, pendingReports: 0, totalPatients: 0, recentOrders: [], recentReports: [] };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Doctor Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">Welcome to your DELViON Doctor Portal</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Referrals", value: stats.totalReferrals, icon: TrendingUp, color: "bg-blue-50 text-blue-600" },
          { label: "Pending Reports", value: stats.pendingReports, icon: FileText, color: "bg-amber-50 text-amber-600" },
          { label: "My Patients", value: stats.totalPatients, icon: Users, color: "bg-teal-50 text-teal-600" },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{card.label}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{isLoading ? "—" : card.value}</p>
              </div>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${card.color}`}>
                <card.icon className="w-5 h-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "View My Patients", href: "/doctor-portal/patients", icon: Users },
          { label: "View Reports", href: "/doctor-portal/reports", icon: FileText },
          { label: "Referral History", href: "/doctor-portal/referrals", icon: ClipboardList },
        ].map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex items-center gap-3 hover:bg-slate-50 transition-colors group"
          >
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center group-hover:bg-slate-200 transition-colors">
              <action.icon className="w-5 h-5 text-slate-600" />
            </div>
            <span className="font-medium text-slate-800 flex-1">{action.label}</span>
            <ArrowRight className="w-4 h-4 text-slate-400" />
          </Link>
        ))}
      </div>

      {/* Recent Orders + Reports */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h3 className="font-semibold text-slate-800 mb-4">Recent Orders</h3>
          {stats.recentOrders.length > 0 ? (
            <div className="space-y-3">
              {stats.recentOrders.slice(0, 5).map((order) => (
                <div key={order.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{order.patientName}</p>
                    <p className="text-xs text-slate-400">{order.orderNumber} · {order.testCount} tests</p>
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status] ?? "bg-slate-100 text-slate-600"}`}>
                    {order.status.replace(/_/g, " ")}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No recent orders</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h3 className="font-semibold text-slate-800 mb-4">Recent Reports</h3>
          {stats.recentReports.length > 0 ? (
            <div className="space-y-3">
              {stats.recentReports.slice(0, 5).map((report) => (
                <div key={report.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{report.patientName}</p>
                    <p className="text-xs text-slate-400">{new Date(report.reportDate).toLocaleDateString()}</p>
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[report.status] ?? "bg-slate-100 text-slate-600"}`}>
                    {report.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No recent reports</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
