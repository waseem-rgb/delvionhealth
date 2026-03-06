import type { AuthUser } from "@delvion/types";

const AUTH_COOKIE = "delvion_auth";

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("delvion_user");
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function setStoredTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem("delvion_access_token", accessToken);
  localStorage.setItem("delvion_refresh_token", refreshToken);
}

export function setStoredUser(user: AuthUser): void {
  localStorage.setItem("delvion_user", JSON.stringify(user));
}

export function clearAuth(): void {
  localStorage.removeItem("delvion_access_token");
  localStorage.removeItem("delvion_refresh_token");
  localStorage.removeItem("delvion_user");
  clearAuthCookie();
}

export function setAuthCookie(): void {
  if (typeof document === "undefined") return;
  const maxAge = 7 * 24 * 60 * 60;
  document.cookie = `${AUTH_COOKIE}=1; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function clearAuthCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}
