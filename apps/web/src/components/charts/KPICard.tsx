import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string;
  change: string;
  trend: "up" | "down";
  icon: React.ElementType;
  color: "blue" | "teal" | "orange" | "green";
}

const colorMap = {
  blue: {
    bg: "bg-blue-50",
    icon: "text-blue-500",
    value: "text-blue-600",
  },
  teal: {
    bg: "bg-teal-50",
    icon: "text-teal-500",
    value: "text-teal-600",
  },
  orange: {
    bg: "bg-orange-50",
    icon: "text-orange-500",
    value: "text-orange-600",
  },
  green: {
    bg: "bg-green-50",
    icon: "text-green-500",
    value: "text-green-600",
  },
};

export function KPICard({ title, value, change, trend, icon: Icon, color }: KPICardProps) {
  const colors = colorMap[color];

  return (
    <div className="bg-white rounded-xl p-5 card-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className={cn("p-2.5 rounded-lg", colors.bg)}>
          <Icon className={cn("w-5 h-5", colors.icon)} />
        </div>
        <div
          className={cn(
            "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
            trend === "up"
              ? "bg-green-50 text-green-600"
              : "bg-red-50 text-red-500"
          )}
        >
          {trend === "up" ? (
            <TrendingUp size={12} />
          ) : (
            <TrendingDown size={12} />
          )}
          {change}
        </div>
      </div>
      <p className={cn("text-2xl font-bold", colors.value)}>{value}</p>
      <p className="text-sm text-slate-500 mt-1">{title}</p>
    </div>
  );
}
