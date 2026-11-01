import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuth();

  // If not authenticated, strictly redirect to "/" (Doctor Login)
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default PrivateRoute;
