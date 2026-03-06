import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  // Order statuses
  PENDING: { label: "Pending", className: "bg-yellow-50 text-yellow-700 ring-yellow-200" },
  CONFIRMED: { label: "Confirmed", className: "bg-blue-50 text-blue-700 ring-blue-200" },
  SAMPLE_COLLECTED: { label: "Collected", className: "bg-purple-50 text-purple-700 ring-purple-200" },
  IN_PROCESSING: { label: "Processing", className: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
  RESULTED: { label: "Resulted", className: "bg-teal-50 text-teal-700 ring-teal-200" },
  REPORTED: { label: "Reported", className: "bg-green-50 text-green-700 ring-green-200" },
  CANCELLED: { label: "Cancelled", className: "bg-red-50 text-red-700 ring-red-200" },
  // Sample statuses
  PENDING_COLLECTION: { label: "Pending", className: "bg-yellow-50 text-yellow-700 ring-yellow-200" },
  COLLECTED: { label: "Collected", className: "bg-blue-50 text-blue-700 ring-blue-200" },
  IN_TRANSIT: { label: "In Transit", className: "bg-purple-50 text-purple-700 ring-purple-200" },
  RECEIVED: { label: "Received", className: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
  PROCESSING: { label: "Processing", className: "bg-orange-50 text-orange-700 ring-orange-200" },
  STORED: { label: "Stored", className: "bg-slate-50 text-slate-700 ring-slate-200" },
  REJECTED: { label: "Rejected", className: "bg-red-50 text-red-700 ring-red-200" },
  DISPOSED: { label: "Disposed", className: "bg-gray-50 text-gray-500 ring-gray-200" },
  // Result interpretations
  NORMAL: { label: "Normal", className: "bg-green-50 text-green-700 ring-green-200" },
  ABNORMAL: { label: "Abnormal", className: "bg-orange-50 text-orange-700 ring-orange-200" },
  CRITICAL: { label: "Critical", className: "bg-red-50 text-red-700 ring-red-200" },
  INCONCLUSIVE: { label: "Inconclusive", className: "bg-gray-50 text-gray-600 ring-gray-200" },
  // Invoice statuses
  PAID: { label: "Paid", className: "bg-green-50 text-green-700 ring-green-200" },
  PARTIALLY_PAID: { label: "Partial", className: "bg-yellow-50 text-yellow-700 ring-yellow-200" },
  OVERDUE: { label: "Overdue", className: "bg-red-50 text-red-700 ring-red-200" },
  DRAFT: { label: "Draft", className: "bg-slate-50 text-slate-600 ring-slate-200" },
  SENT: { label: "Sent", className: "bg-blue-50 text-blue-700 ring-blue-200" },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? {
    label: status,
    className: "bg-slate-50 text-slate-600 ring-slate-200",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
