import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

/**
 * InvalidRouteRedirect - Strictly blocks unknown or unauthorized URLs
 * If any URL or path other than the authorized domain routes is entered:
 * - Unauthenticated users are strictly bounced to "/" (Doctor Login)
 * - Authenticated users are strictly bounced to "/" (Dashboard)
 * No arbitrary or unauthorized page content will ever be displayed.
 */
export default function InvalidRouteRedirect() {
  const { isAuthenticated } = useAuth();
  return <Navigate to="/" replace />;
}
