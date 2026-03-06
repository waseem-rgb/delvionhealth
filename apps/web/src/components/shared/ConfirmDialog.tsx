"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, Info, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
  isLoading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  isLoading = false,
}: ConfirmDialogProps) {
  const confirmBtnClass =
    variant === "danger"
      ? "bg-red-600 hover:bg-red-700 text-white"
      : variant === "warning"
      ? "bg-amber-500 hover:bg-amber-600 text-white"
      : "bg-[#0D7E8A] hover:bg-[#0A6570] text-white";

  const iconClass =
    variant === "danger"
      ? "bg-red-100 text-red-600"
      : variant === "warning"
      ? "bg-amber-100 text-amber-600"
      : "bg-blue-100 text-blue-600";

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-white rounded-xl shadow-2xl p-6 focus:outline-none">
          <div className="flex items-start gap-4">
            <div className={cn("flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center", iconClass)}>
              {variant === "info" ? <Info size={20} /> : <AlertTriangle size={20} />}
            </div>
            <div className="flex-1 min-w-0">
              <Dialog.Title className="text-base font-semibold text-slate-900 mb-1">
                {title}
              </Dialog.Title>
              <Dialog.Description className="text-sm text-slate-500">
                {message}
              </Dialog.Description>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
              <X size={18} />
            </button>
          </div>

          <div className="flex items-center justify-end gap-3 mt-6">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-lg transition flex items-center gap-2 disabled:opacity-60",
                confirmBtnClass
              )}
            >
              {isLoading && <Loader2 size={14} className="animate-spin" />}
              {confirmText}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
