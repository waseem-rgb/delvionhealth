import axios from "axios";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export const api = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});

// Request interceptor — attach token
api.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("delvion_access_token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — refresh token on 401
api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) return Promise.reject(error);

    const original = error.config as (typeof error.config) & { _retry?: boolean };

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = localStorage.getItem("delvion_refresh_token");

      if (refreshToken) {
        try {
          const { data } = await axios.post(`${BASE_URL}/api/v1/auth/refresh`, {
            refreshToken,
          });
          localStorage.setItem("delvion_access_token", data.data.accessToken);
          localStorage.setItem("delvion_refresh_token", data.data.refreshToken);
          if (original.headers) {
            original.headers.Authorization = `Bearer ${data.data.accessToken}`;
          }
          return api(original);
        } catch {
          localStorage.removeItem("delvion_access_token");
          localStorage.removeItem("delvion_refresh_token");
          document.cookie = "delvion_auth=; path=/; max-age=0; SameSite=Lax";
          window.location.href = "/login";
          return new Promise(() => {}); // Prevent error propagation during redirect
        }
      }

      // No refresh token — clear auth and redirect to login
      localStorage.removeItem("delvion_access_token");
      localStorage.removeItem("delvion_refresh_token");
      document.cookie = "delvion_auth=; path=/; max-age=0; SameSite=Lax";
      window.location.href = "/login";
      return new Promise(() => {}); // Prevent error propagation during redirect
    }

    return Promise.reject(error);
  }
);

export default api;
