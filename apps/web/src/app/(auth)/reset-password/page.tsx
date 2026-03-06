"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, KeyRound, CheckCircle2, AlertCircle } from "lucide-react";
import api from "@/lib/api";

const schema = z
  .object({
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setServerError("Invalid or missing reset token. Please request a new link.");
    }
  }, [token]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormValues) => {
    if (!token) return;
    setServerError(null);
    try {
      await api.post("/auth/reset-password", {
        token,
        newPassword: data.newPassword,
      });
      setSuccess(true);
      setTimeout(() => router.push("/login"), 3000);
    } catch {
      setServerError("This link is invalid or has expired. Please request a new one.");
    }
  };

  if (success) {
    return (
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 mb-6">
          <CheckCircle2 size={32} className="text-emerald-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Password reset!</h2>
        <p className="text-gray-500 text-sm mb-6">
          Your password has been updated. Redirecting you to sign in…
        </p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center w-full py-2.5 px-4 rounded-lg bg-[#0D7E8A] hover:bg-[#0A6570] text-white font-medium transition-colors"
        >
          Sign in now
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#0D7E8A]/10 mb-6">
        <KeyRound size={24} className="text-[#0D7E8A]" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Set new password</h2>
      <p className="text-gray-500 text-sm mb-8">
        Must be at least 8 characters
      </p>

      {serverError && !token && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2 mb-6">
          <AlertCircle size={16} className="shrink-0" />
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            New password
          </label>
          <div className="relative">
            <input
              {...register("newPassword")}
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              disabled={!token}
              className="w-full px-4 py-2.5 pr-12 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]/40 focus:border-[#0D7E8A] transition disabled:opacity-50"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.newPassword && (
            <p className="mt-1 text-xs text-red-500">{errors.newPassword.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Confirm password
          </label>
          <div className="relative">
            <input
              {...register("confirmPassword")}
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              disabled={!token}
              className="w-full px-4 py-2.5 pr-12 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]/40 focus:border-[#0D7E8A] transition disabled:opacity-50"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
            >
              {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="mt-1 text-xs text-red-500">{errors.confirmPassword.message}</p>
          )}
        </div>

        {serverError && token && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {serverError}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !token}
          className="w-full py-2.5 px-4 rounded-lg bg-[#0D7E8A] hover:bg-[#0A6570] text-white font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSubmitting && <Loader2 size={16} className="animate-spin" />}
          {isSubmitting ? "Resetting..." : "Reset password"}
        </button>
      </form>

      <div className="mt-6 text-center">
        <Link
          href="/forgot-password"
          className="text-sm text-[#0D7E8A] hover:text-[#0A6570] font-medium transition-colors"
        >
          Request a new link
        </Link>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="h-64 flex items-center justify-center text-gray-400">Loading…</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
