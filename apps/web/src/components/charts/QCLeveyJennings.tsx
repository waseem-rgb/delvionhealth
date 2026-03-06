"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

interface QCLeveyJenningsProps {
  data: Array<{ run: number; value: number; flag?: string }>;
  mean: number;
  sd: number;
  title: string;
}

export function QCLeveyJennings({ data, mean, sd, title }: QCLeveyJenningsProps) {
  return (
    <div>
      <h3 className="text-sm font-medium text-slate-700 mb-3">{title}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="run" tick={{ fontSize: 11 }} />
          <YAxis
            domain={[mean - 3 * sd, mean + 3 * sd]}
            tick={{ fontSize: 11 }}
          />
          <Tooltip />
          <ReferenceLine y={mean} stroke="#22c55e" strokeDasharray="4 2" label={{ value: "Mean", fontSize: 10 }} />
          <ReferenceLine y={mean + sd} stroke="#eab308" strokeDasharray="4 2" label={{ value: "+1SD", fontSize: 9 }} />
          <ReferenceLine y={mean - sd} stroke="#eab308" strokeDasharray="4 2" label={{ value: "-1SD", fontSize: 9 }} />
          <ReferenceLine y={mean + 2 * sd} stroke="#f97316" strokeDasharray="4 2" label={{ value: "+2SD", fontSize: 9 }} />
          <ReferenceLine y={mean - 2 * sd} stroke="#f97316" strokeDasharray="4 2" label={{ value: "-2SD", fontSize: 9 }} />
          <ReferenceLine y={mean + 3 * sd} stroke="#ef4444" label={{ value: "+3SD", fontSize: 9 }} />
          <ReferenceLine y={mean - 3 * sd} stroke="#ef4444" label={{ value: "-3SD", fontSize: 9 }} />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#1B4F8A"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
