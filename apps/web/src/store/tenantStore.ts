import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
}

export interface Branch {
  id: string;
  name: string;
  city?: string;
}

interface TenantStore {
  activeTenant: Tenant | null;
  activeBranch: Branch | null;
  tenants: Tenant[];
  setActiveTenant: (tenant: Tenant) => void;
  setActiveBranch: (branch: Branch) => void;
  setTenants: (tenants: Tenant[]) => void;
}

export const useTenantStore = create<TenantStore>()(
  persist(
    (set) => ({
      activeTenant: null,
      activeBranch: null,
      tenants: [],
      setActiveTenant: (tenant) => set({ activeTenant: tenant }),
      setActiveBranch: (branch) => set({ activeBranch: branch }),
      setTenants: (tenants) => set({ tenants }),
    }),
    {
      name: "delvion-tenant",
      skipHydration: true,
    }
  )
);
