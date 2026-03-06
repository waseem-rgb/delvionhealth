"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const data = [
  { month: "Apr", revenue: 1240000 },
  { month: "May", revenue: 1380000 },
  { month: "Jun", revenue: 1520000 },
  { month: "Jul", revenue: 1190000 },
  { month: "Aug", revenue: 1640000 },
  { month: "Sep", revenue: 1720000 },
  { month: "Oct", revenue: 1580000 },
  { month: "Nov", revenue: 1890000 },
  { month: "Dec", revenue: 2100000 },
  { month: "Jan", revenue: 1760000 },
  { month: "Feb", revenue: 1920000 },
  { month: "Mar", revenue: 1840000 },
];

const formatRevenue = (value: number) => `₹${(value / 100000).toFixed(1)}L`;

export function RevenueChart() {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#1B4F8A" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#1B4F8A" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 12, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatRevenue}
          tick={{ fontSize: 12, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value: number) => [formatRevenue(value), "Revenue"]}
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
          }}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="#1B4F8A"
          strokeWidth={2}
          fill="url(#revenueGradient)"
          dot={{ fill: "#1B4F8A", strokeWidth: 2, r: 3 }}
          activeDot={{ r: 5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
