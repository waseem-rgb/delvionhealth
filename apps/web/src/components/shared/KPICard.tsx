import Link from "next/link";
import { TrendingUp, TrendingDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  change?: number;
  changeLabel?: string;
  icon: LucideIcon;
  iconColor?: string;
  isLoading?: boolean;
  href?: string;
  showPulse?: boolean;
}

export function KPICard({
  title,
  value,
  subtitle,
  change,
  changeLabel = "vs yesterday",
  icon: Icon,
  iconColor = "bg-slate-100 text-slate-500",
  isLoading = false,
  href,
  showPulse = false,
}: KPICardProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 animate-pulse" />
          <div className="w-16 h-6 rounded-full bg-slate-100 animate-pulse" />
        </div>
        <div className="w-24 h-7 bg-slate-100 rounded animate-pulse mb-2" />
        <div className="w-32 h-4 bg-slate-100 rounded animate-pulse" />
      </div>
    );
  }

  const isPositive = change !== undefined && change >= 0;
  const isNegative = change !== undefined && change < 0;

  const cardContent = (
    <div
      className={cn(
        "relative bg-white rounded-xl p-5 shadow-sm border border-slate-100 transition-all duration-150",
        href
          ? "cursor-pointer hover:shadow-md hover:scale-[1.02]"
          : "hover:shadow-md transition-shadow"
      )}
    >
      {showPulse && (
        <span className="absolute top-3 right-3 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
        </span>
      )}
      <div className="flex items-start justify-between mb-3">
        <div className={cn("p-2.5 rounded-lg", iconColor.split(" ")[0])}>
          <Icon className={cn("w-5 h-5", iconColor.split(" ")[1] ?? iconColor)} size={20} />
        </div>
        {change !== undefined && (
          <div
            className={cn(
              "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
              isPositive ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"
            )}
          >
            {isPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {Math.abs(change).toFixed(1)}%
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-sm text-slate-500 mt-0.5">{title}</p>
      {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      {change !== undefined && changeLabel && (
        <p className={cn("text-xs mt-1", isPositive ? "text-green-600" : isNegative ? "text-red-500" : "text-slate-400")}>
          {changeLabel}
        </p>
      )}
    </div>
  );

  if (href) {
    return <Link href={href} className="block">{cardContent}</Link>;
  }
  return cardContent;
}
