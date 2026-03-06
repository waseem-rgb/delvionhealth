"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { useTenantStore } from "@/store/tenantStore";
import api from "@/lib/api";

/**
 * Triggers Zustand persist rehydration from localStorage on mount.
 * Also fetches tenant + branch data and populates the tenant store.
 */
export function DashboardHydration() {
  useEffect(() => {
    void useAuthStore.persist.rehydrate();
    void useTenantStore.persist.rehydrate();
  }, []);

  // Fetch tenant + branch data once stores are rehydrated
  useEffect(() => {
    async function hydrateTenant() {
      const store = useTenantStore.getState();
      // If already populated (from localStorage persist), skip
      if (store.activeTenant && store.activeBranch) return;

      try {
        const settingsRes = await api.get("/tenants/my-settings");
        const tenant = settingsRes.data?.data ?? settingsRes.data;
        if (tenant?.id) {
          useTenantStore.getState().setActiveTenant({
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            plan: tenant.plan,
          });

          // Fetch branches
          try {
            const branchRes = await api.get(`/tenants/${tenant.id}/branches`);
            const branches = branchRes.data?.data ?? branchRes.data ?? [];
            const firstBranch = Array.isArray(branches) ? branches[0] : null;
            if (firstBranch?.id) {
              useTenantStore.getState().setActiveBranch({
                id: firstBranch.id,
                name: firstBranch.name,
                city: firstBranch.city,
              });
            }
          } catch {
            // Fallback to seed data branch
            useTenantStore.getState().setActiveBranch({
              id: "branch-delvion-001",
              name: "Main Branch - Bengaluru",
            });
          }
        }
      } catch {
        // Not logged in or API not available
      }
    }

    // Small delay to let auth store rehydrate + set token first
    const timer = setTimeout(hydrateTenant, 500);
    return () => clearTimeout(timer);
  }, []);

  return null;
}
