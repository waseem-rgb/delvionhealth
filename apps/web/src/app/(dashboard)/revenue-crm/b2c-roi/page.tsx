"use client";

import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Megaphone,
  Ticket,
  ShoppingCart,
} from "lucide-react";

// ── Component ───────────────────────────────────────────────────────────────

export default function B2CROIPage() {
  const columns = [
    "Campaign / Channel",
    "Type",
    "Spend",
    "Revenue",
    "ROI",
    "Bookings",
    "Cost / Booking",
    "Coupons Used",
  ];

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">B2C ROI</h1>
        <p className="text-slate-400">
          Track return on investment across B2C campaigns and marketing channels
        </p>
      </div>

      {/* Summary cards placeholder */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Total Spend",
            value: "--",
            icon: DollarSign,
            color: "text-blue-400",
          },
          {
            label: "Total Revenue",
            value: "--",
            icon: TrendingUp,
            color: "text-green-400",
          },
          {
            label: "Overall ROI",
            value: "--",
            icon: BarChart3,
            color: "text-purple-400",
          },
          {
            label: "Total Bookings",
            value: "--",
            icon: ShoppingCart,
            color: "text-orange-400",
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-xl border border-slate-800 bg-slate-900 p-4"
            >
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Icon className={`h-4 w-4 ${card.color}`} />
                {card.label}
              </div>
              <p className="mt-1 text-xl font-bold text-white">{card.value}</p>
            </div>
          );
        })}
      </div>

      {/* Table structure */}
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900">
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-4 py-3 text-left text-sm font-medium text-slate-400"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Empty state */}
            <tr>
              <td colSpan={columns.length}>
                <div className="flex flex-col items-center justify-center py-20">
                  <Megaphone className="mb-4 h-12 w-12 text-slate-600" />
                  <p className="text-lg font-medium text-slate-400">
                    No data found
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    B2C ROI data will be populated as campaigns run
                  </p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Placeholder campaign types info */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          {
            title: "Digital Campaigns",
            desc: "Google Ads, Meta Ads, and other digital channels",
            icon: Megaphone,
          },
          {
            title: "Coupon Tracking",
            desc: "Monitor coupon usage and redemption rates",
            icon: Ticket,
          },
          {
            title: "Channel Analytics",
            desc: "Compare performance across walk-in, online, and referral channels",
            icon: BarChart3,
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="rounded-xl border border-slate-800 bg-slate-900 p-5"
            >
              <Icon className="mb-3 h-8 w-8 text-slate-600" />
              <h3 className="text-sm font-semibold text-white">{item.title}</h3>
              <p className="mt-1 text-xs text-slate-500">{item.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
