import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import Login from "../pages/Auth/Login";

/**
 * PrivateRoute
 * - When unauthenticated and accessing root domain ("/"): directly displays Doctor Login.
 * - When unauthenticated and accessing any other URL: strictly redirects to "/" (Doctor Login).
 * - When authenticated: allows access to protected dashboard routes.
 */
function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return null;
  }

  if (!isAuthenticated) {
    // If at root domain or /login, render Doctor Login directly without redirecting
    if (location.pathname === "/" || location.pathname === "/login") {
      return <Login />;
    }
    // If trying to access any other URL unauthenticated, strictly bounce to "/"
    return <Navigate to="/" replace />;
  }

  return children;
}

export default PrivateRoute;
