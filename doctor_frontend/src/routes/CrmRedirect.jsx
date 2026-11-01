import { useEffect } from "react";

/**
 * CrmRedirect - Routes /crm and /admin requests to the Admin CRM Login
 * - In local dev (port 5173): redirects to http://localhost:5174/#/login
 * - In production: redirects to /crm/#/login on the same domain
 */
export default function CrmRedirect() {
  useEffect(() => {
    const isDev = window.location.port === "5173";
    if (isDev) {
      window.location.replace("http://localhost:5174/#/login");
    } else {
      window.location.replace("/crm");
    }
  }, []);

  return null;
}
