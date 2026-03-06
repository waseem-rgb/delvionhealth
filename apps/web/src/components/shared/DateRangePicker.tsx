"use client";

import { useState, useRef, useEffect } from "react";
import { Calendar, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DateRange {
  from?: string; // ISO date string "YYYY-MM-DD"
  to?: string;
}

const PRESETS: { label: string; getRange: () => DateRange }[] = [
  {
    label: "Today",
    getRange() {
      const today = new Date().toISOString().slice(0, 10);
      return { from: today, to: today };
    },
  },
  {
    label: "Yesterday",
    getRange() {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const v = d.toISOString().slice(0, 10);
      return { from: v, to: v };
    },
  },
  {
    label: "Last 7 days",
    getRange() {
      const to = new Date().toISOString().slice(0, 10);
      const from = new Date(Date.now() - 6 * 86400_000).toISOString().slice(0, 10);
      return { from, to };
    },
  },
  {
    label: "Last 30 days",
    getRange() {
      const to = new Date().toISOString().slice(0, 10);
      const from = new Date(Date.now() - 29 * 86400_000).toISOString().slice(0, 10);
      return { from, to };
    },
  },
  {
    label: "This month",
    getRange() {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const to = now.toISOString().slice(0, 10);
      return { from, to };
    },
  },
];

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  placeholder?: string;
  className?: string;
}

function formatDisplay(range: DateRange): string {
  if (!range.from && !range.to) return "";
  if (range.from === range.to) return range.from ?? "";
  return `${range.from ?? ""} → ${range.to ?? ""}`;
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = "Select date range",
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<DateRange>(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setLocal(value); }, [value]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function apply() {
    onChange(local);
    setOpen(false);
  }

  function clear() {
    const empty: DateRange = {};
    setLocal(empty);
    onChange(empty);
  }

  const displayLabel = formatDisplay(value);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white",
          "hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]/30 transition",
          "min-w-[200px]"
        )}
      >
        <Calendar size={14} className="text-slate-400 shrink-0" />
        <span className={cn("flex-1 text-left truncate", !displayLabel && "text-slate-400")}>
          {displayLabel || placeholder}
        </span>
        {displayLabel && (
          <X
            size={14}
            className="text-slate-400 hover:text-slate-600 shrink-0"
            onClick={(e) => { e.stopPropagation(); clear(); }}
          />
        )}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 right-0 bg-white border border-slate-200 rounded-xl shadow-lg p-4 w-80">
          {/* Presets */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setLocal(p.getRange())}
                className="px-2.5 py-1 text-xs rounded-full border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition text-slate-600"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Date inputs */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">From</label>
              <input
                type="date"
                value={local.from ?? ""}
                onChange={(e) => setLocal((r) => ({ ...r, from: e.target.value || undefined }))}
                max={local.to}
                className="w-full text-sm px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
              <input
                type="date"
                value={local.to ?? ""}
                onChange={(e) => setLocal((r) => ({ ...r, to: e.target.value || undefined }))}
                min={local.from}
                className="w-full text-sm px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]/30"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={clear}
              className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 transition"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={apply}
              className="px-4 py-1.5 text-sm rounded-lg bg-[#0D7E8A] text-white hover:bg-[#0D7E8A]/90 transition"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
