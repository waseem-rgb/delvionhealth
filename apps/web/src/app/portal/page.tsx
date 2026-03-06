"use client";

import Link from "next/link";
import { FlaskConical, FileText, MapPin, User, ChevronRight } from "lucide-react";

const quickActions = [
  {
    icon: FlaskConical,
    title: "Book a Test",
    desc: "Schedule lab tests at home or at our centre",
    href: "/portal/book",
    bg: "bg-blue-50",
    color: "text-blue-600",
    badge: null,
  },
  {
    icon: FileText,
    title: "My Reports",
    desc: "View and download your test results",
    href: "/portal/reports",
    bg: "bg-green-50",
    color: "text-green-600",
    badge: null,
  },
  {
    icon: MapPin,
    title: "Track Sample",
    desc: "Track your sample in real-time",
    href: "/portal/track",
    bg: "bg-teal-50",
    color: "text-teal-600",
    badge: null,
  },
  {
    icon: User,
    title: "My Profile",
    desc: "Update your personal & insurance info",
    href: "/portal/profile",
    bg: "bg-purple-50",
    color: "text-purple-600",
    badge: null,
  },
];

export default function PortalHomePage() {
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateStr = now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      {/* Greeting banner */}
      <div className="rounded-2xl bg-gradient-to-r from-[#1B4F8A] to-[#0D9488] text-white p-8">
        <div className="text-3xl font-bold mb-1">{greeting} 👋</div>
        <div className="text-white/90 text-lg mb-1">Welcome to your DELViON Health portal</div>
        <div className="text-white/70 text-sm">{dateStr}</div>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200 transition-all group"
            >
              <div className={`w-10 h-10 ${action.bg} rounded-lg flex items-center justify-center mb-3`}>
                <action.icon className={`w-5 h-5 ${action.color}`} />
              </div>
              <div className="font-semibold text-slate-900 text-sm mb-1 group-hover:text-blue-700 transition-colors">
                {action.title}
              </div>
              <div className="text-xs text-slate-500">{action.desc}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* Info cards */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
          <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-green-600" /> Recent Results
          </h3>
          <p className="text-sm text-slate-400 text-center py-4">
            No reports yet.{" "}
            <Link href="/portal/book" className="text-blue-600 hover:underline">
              Book your first test →
            </Link>
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
          <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-teal-600" /> Active Orders
          </h3>
          <p className="text-sm text-slate-400 text-center py-4">
            No active orders.{" "}
            <Link href="/portal/track" className="text-blue-600 hover:underline">
              Track an order →
            </Link>
          </p>
        </div>
      </div>

      {/* Help */}
      <div className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-xl border border-blue-100 p-6 flex items-center justify-between">
        <div>
          <div className="font-semibold text-slate-800">Need help?</div>
          <div className="text-sm text-slate-500 mt-0.5">Our support team is available 24/7</div>
        </div>
        <button className="flex items-center gap-1 text-sm text-blue-700 font-medium hover:underline">
          Contact Support <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
