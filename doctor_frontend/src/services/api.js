import axios from "axios";

const TOKEN_KEY = "zenve_doctor_token";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);

  if (token && token !== "zenve_demo_token") {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("API request failed:", error?.response?.data || error.message);

    if (error?.response?.status === 401) {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem("zenve_doctor_user");
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem("zenve_doctor_user");

      if (
        !window.location.pathname.startsWith("/login") &&
        !window.location.pathname.startsWith("/register") &&
        !window.location.pathname.startsWith("/forgot-password") &&
        !window.location.pathname.startsWith("/reset-password")
      ) {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

/**
 * Lightweight health check helper
 * Tests both client internet connectivity and backend server reachability.
 */
export const checkHealth = async () => {
  // 1. Device internet test
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { ok: false, type: "offline", message: "Internet connection is offline" };
  }

  // 2. Server ping test with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    // Ping backend API endpoint (falls back to lightweight static check if route not configured)
    const res = await fetch(`/api?_t=${Date.now()}`, {
      method: "HEAD",
      cache: "no-store",
      signal: controller.signal,
    }).catch(async () => {
      return await fetch(`/favicon.png?_t=${Date.now()}`, {
        method: "HEAD",
        cache: "no-store",
        signal: controller.signal,
      });
    });

    clearTimeout(timeoutId);

    // If server responds with any status below 500 (200, 401, 404, etc.), server is alive!
    if (res && res.status < 500) {
      return { ok: true, status: res.status };
    }
    return { ok: false, type: "server_error", status: res ? res.status : 500 };
  } catch (err) {
    clearTimeout(timeoutId);
    return { ok: false, type: "network_error", message: err.message };
  }
};

export default api;
