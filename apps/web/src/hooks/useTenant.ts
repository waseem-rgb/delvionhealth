"use client";

import { useTenantStore } from "@/store/tenantStore";

export function useTenant() {
  const { activeTenant, activeBranch, setActiveTenant, setActiveBranch } =
    useTenantStore();

  return { activeTenant, activeBranch, setActiveTenant, setActiveBranch };
}
