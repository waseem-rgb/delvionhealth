"use client";

import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";
import api from "@/lib/api";
import FormRenderer from "./FormRenderer";
import type { FormTemplate } from "./FormRenderer";

interface FormSheetProps {
  form: FormTemplate | null;
  onClose: () => void;
}

export default function FormSheet({ form, onClose }: FormSheetProps) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [periodDate, setPeriodDate] = useState(new Date().toISOString().slice(0, 10));
  const [filledBy, setFilledBy] = useState("");
  const [remarks, setRemarks] = useState("");

  useEffect(() => {
    if (form) {
      setFormData({});
      setRemarks("");
      setPeriodDate(new Date().toISOString().slice(0, 10));
      setFilledBy(user ? `${user.firstName} ${user.lastName}` : "");
    }
  }, [form, user]);

  // Close on escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (form) document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [form, onClose]);

  // Prevent body scroll
  useEffect(() => {
    if (form) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [form]);

  const submitMutation = useMutation({
    mutationFn: (status: string) =>
      api.post("/quality/form-entries", {
        formId: form!.id,
        data: { ...formData, periodDate, filledBy },
        notes: remarks,
        status,
      }),
    onSuccess: (_, status) => {
      queryClient.invalidateQueries({ queryKey: ["quality-forms"] });
      queryClient.invalidateQueries({ queryKey: ["quality-form-entries"] });
      if (status === "DRAFT") {
        toast.success("Draft saved — you can continue later");
      } else {
        toast.success("Form submitted successfully");
      }
      onClose();
    },
    onError: () => toast.error("Failed to submit form"),
  });

  if (!form) return null;

  return (
    <>
      {/* Overlay */}
      <div
        ref={overlayRef}
        className="fixed inset-0 bg-black/40 z-50 transition-opacity"
        onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      >
        {/* Sheet */}
        <div className="absolute right-0 top-0 bottom-0 w-full max-w-4xl bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="border-b border-slate-200 px-6 py-4 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <span className="inline-flex px-2 py-0.5 rounded text-xs font-mono font-medium bg-slate-100 text-slate-600 border border-slate-200">
                  {form.formCode}
                </span>
                <h2 className="text-lg font-bold text-slate-900 mt-1">{form.name}</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  {form.category} · {form.type} · Frequency: {form.frequency ?? "—"}
                </p>
              </div>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Period & filled by */}
            <div className="flex gap-4 mt-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Period / Date</label>
                <input
                  type="date"
                  value={periodDate}
                  onChange={(e) => setPeriodDate(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Filled By</label>
                <input
                  type="text"
                  value={filledBy}
                  onChange={(e) => setFilledBy(e.target.value)}
                  placeholder="Staff name"
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <FormRenderer template={form} formData={formData} onChange={setFormData} />

            {/* Remarks */}
            <div className="mt-6">
              <label className="block text-sm font-medium text-slate-700 mb-1">Remarks / Notes</label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
                placeholder="Any observations or comments..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-slate-200 px-6 py-4 flex items-center gap-3 shrink-0">
            <button
              onClick={() => submitMutation.mutate("DRAFT")}
              disabled={submitMutation.isPending}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Save as Draft
            </button>
            <button
              onClick={() => submitMutation.mutate("SUBMITTED")}
              disabled={submitMutation.isPending}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4" />
              {submitMutation.isPending ? "Submitting..." : "Submit Form"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
