"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isLoading?: boolean;
  onClear?: () => void;
  className?: string;
  debounceMs?: number;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  isLoading = false,
  onClear,
  className,
  debounceMs = 300,
}: SearchInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Only sync from parent when value changes externally (not from our own typing)
  const isTypingRef = useRef(false);
  useEffect(() => {
    if (!isTypingRef.current) {
      setLocalValue(value);
    }
  }, [value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    isTypingRef.current = true;
    setLocalValue(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onChangeRef.current(v);
      isTypingRef.current = false;
    }, debounceMs);
  }, [debounceMs]);

  const handleClear = useCallback(() => {
    isTypingRef.current = false;
    setLocalValue("");
    if (timerRef.current) clearTimeout(timerRef.current);
    onChangeRef.current("");
    onClear?.();
  }, [onClear]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className={cn("relative flex items-center", className)}>
      <div className="absolute left-3 text-slate-400 pointer-events-none">
        {isLoading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Search size={16} />
        )}
      </div>
      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]/30 focus:border-[#0D7E8A] transition"
      />
      {localValue && (
        <button
          onClick={handleClear}
          className="absolute right-3 text-slate-400 hover:text-slate-600 transition"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
