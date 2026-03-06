import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthUser } from "@delvion/types";
import api from "@/lib/api";
import {
  setStoredTokens,
  setStoredUser,
  clearAuth,
  setAuthCookie,
} from "@/lib/auth";

interface AuthStore {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: AuthUser) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isLoading: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          const response = await api.post<{
            data: {
              accessToken: string;
              refreshToken: string;
              user: AuthUser;
            };
          }>("/auth/login", { email, password });

          const { accessToken, refreshToken, user } = response.data.data;
          setStoredTokens(accessToken, refreshToken);
          setStoredUser(user);
          setAuthCookie();
          set({ user, isLoading: false });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        try {
          await api.post("/auth/logout");
        } finally {
          clearAuth();
          set({ user: null });
          window.location.href = "/login";
        }
      },

      setUser: (user: AuthUser) => set({ user }),
    }),
    {
      name: "delvion-auth",
      partialize: (state) => ({ user: state.user }),
      skipHydration: true,
    }
  )
);
