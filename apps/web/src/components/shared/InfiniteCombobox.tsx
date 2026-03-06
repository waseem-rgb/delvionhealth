"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, ChevronsUpDown, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  id: string;
  label: string;
  sublabel?: string;
}

interface InfiniteComboboxProps {
  value: string | null;
  onChange: (id: string | null, option: ComboboxOption | null) => void;
  searchFn: (query: string) => Promise<ComboboxOption[]>;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function InfiniteCombobox({
  value,
  onChange,
  searchFn,
  placeholder = "Search...",
  disabled = false,
  className,
}: InfiniteComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<ComboboxOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string>("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const runSearch = useCallback(
    async (q: string) => {
      setLoading(true);
      try {
        const results = await searchFn(q);
        setOptions(results);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    },
    [searchFn]
  );

  // Debounced search
  useEffect(() => {
    if (!open) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => runSearch(query), 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, open, runSearch]);

  // Open → trigger initial search
  useEffect(() => {
    if (open) runSearch(query);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleSelect(opt: ComboboxOption) {
    setSelectedLabel(opt.label);
    onChange(opt.id, opt);
    setOpen(false);
    setQuery("");
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    setSelectedLabel("");
    onChange(null, null);
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={cn(
          "flex items-center justify-between w-full px-3 py-2 text-sm rounded-lg",
          "border border-slate-200 bg-white text-slate-900",
          "focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]/30 focus:border-[#0D7E8A]",
          "disabled:opacity-50 disabled:cursor-not-allowed transition"
        )}
      >
        <span className={cn("truncate", !value && "text-slate-400")}>
          {value && selectedLabel ? selectedLabel : placeholder}
        </span>
        <span className="flex items-center gap-1 shrink-0 ml-2">
          {value && (
            <X
              size={14}
              className="text-slate-400 hover:text-slate-600"
              onClick={handleClear}
            />
          )}
          <ChevronsUpDown size={14} className="text-slate-400" />
        </span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-slate-100">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type to search..."
              className="w-full px-3 py-1.5 text-sm rounded border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]/30"
            />
          </div>

          {/* Options list */}
          <ul className="max-h-52 overflow-y-auto">
            {loading ? (
              <li className="flex items-center justify-center gap-2 py-4 text-sm text-slate-500">
                <Loader2 size={14} className="animate-spin" />
                Searching...
              </li>
            ) : options.length === 0 ? (
              <li className="py-4 text-center text-sm text-slate-400">No results</li>
            ) : (
              options.map((opt) => (
                <li
                  key={opt.id}
                  onClick={() => handleSelect(opt)}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 text-sm cursor-pointer hover:bg-slate-50",
                    value === opt.id && "bg-[#0D7E8A]/5 text-[#0D7E8A] font-medium"
                  )}
                >
                  <span className="flex flex-col">
                    <span>{opt.label}</span>
                    {opt.sublabel && (
                      <span className="text-xs text-slate-400">{opt.sublabel}</span>
                    )}
                  </span>
                  {value === opt.id && <Check size={14} />}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
