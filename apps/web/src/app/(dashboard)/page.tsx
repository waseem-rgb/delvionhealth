"use client";

import React from "react";
import { KPICard } from "@/components/charts/KPICard";
import { RevenueChart } from "@/components/charts/RevenueChart";
import {
  Users,
  ClipboardList,
  FlaskConical,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
} from "lucide-react";

const kpis: Array<{ title: string; value: string; change: string; trend: "up" | "down"; icon: React.ElementType; color: "blue" | "teal" | "orange" | "green" }> = [
  {
    title: "Total Patients",
    value: "24,891",
    change: "+12.5%",
    trend: "up" as const,
    icon: Users,
    color: "blue",
  },
  {
    title: "Orders Today",
    value: "347",
    change: "+8.2%",
    trend: "up" as const,
    icon: ClipboardList,
    color: "teal",
  },
  {
    title: "Samples in Queue",
    value: "89",
    change: "-3.1%",
    trend: "down" as const,
    icon: FlaskConical,
    color: "orange",
  },
  {
    title: "Revenue MTD",
    value: "₹18.4L",
    change: "+21.3%",
    trend: "up" as const,
    icon: DollarSign,
    color: "green",
  },
];

const statusCards = [
  { label: "Critical Results", value: 3, icon: AlertTriangle, color: "text-red-500", bg: "bg-red-50" },
  { label: "Pending Reports", value: 28, icon: Clock, color: "text-orange-500", bg: "bg-orange-50" },
  { label: "Completed Today", value: 312, icon: CheckCircle, color: "text-green-500", bg: "bg-green-50" },
  { label: "TAT Compliance", value: "94.2%", icon: TrendingUp, color: "text-blue-500", bg: "bg-blue-50" },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Executive Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">
          Real-time overview — {new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <KPICard key={kpi.title} {...kpi} />
        ))}
      </div>

      {/* Status Row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {statusCards.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-xl p-4 card-shadow flex items-center gap-4"
          >
            <div className={`p-2.5 rounded-lg ${card.bg}`}>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <div>
              <p className="text-xs text-slate-500">{card.label}</p>
              <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Revenue Chart */}
      <div className="bg-white rounded-xl p-6 card-shadow">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900">Revenue Trend</h2>
          <span className="text-xs text-slate-400">Last 12 months</span>
        </div>
        <RevenueChart />
      </div>
    </div>
  );
}
