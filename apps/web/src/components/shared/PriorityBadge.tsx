import { cn } from "@/lib/utils";

interface PriorityBadgeProps {
  priority: "ROUTINE" | "URGENT" | "STAT";
  className?: string;
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  if (priority === "STAT") {
    return (
      <span className={cn("relative inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white", className)}>
        <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-40" />
        <span className="relative">STAT</span>
      </span>
    );
  }

  if (priority === "URGENT") {
    return (
      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500 text-white", className)}>
        Urgent
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border border-slate-300 text-slate-600", className)}>
      Routine
    </span>
  );
}
