"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import type { Role } from "@delvion/types";

export function useAuth(requiredRoles?: Role[]) {
  const router = useRouter();
  const { user, isLoading } = useAuthStore();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
      return;
    }

    if (user && requiredRoles && !requiredRoles.includes(user.role as Role)) {
      router.replace("/dashboard");
    }
  }, [user, isLoading, router, requiredRoles]);

  return { user, isLoading, isAuthenticated: !!user };
}
