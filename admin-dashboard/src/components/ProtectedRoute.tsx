import {
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";

import { useAdminAuth } from "../context/AuthContext";

type ProtectedRouteProps = {
  allowedRoles?: readonly string[];
};

export default function ProtectedRoute({
  allowedRoles,
}: ProtectedRouteProps) {
  const location = useLocation();

  const {
    user,
    loading,
    isAuthenticated,
  } = useAdminAuth();

  if (loading) {
    return (
      <div className="full-screen-state">
        <div className="spinner" />

        <p>Checking account access</p>
      </div>
    );
  }

  if (
    !isAuthenticated ||
    !user
  ) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location.pathname,
        }}
      />
    );
  }

  const roleIsAllowed =
    !allowedRoles ||
    allowedRoles.length === 0 ||
    allowedRoles.includes(
      user.role
    );

  if (!roleIsAllowed) {
    return (
      <div className="full-screen-state">
        <div className="state-icon">
          !
        </div>

        <h2>Access denied</h2>

        <p>
          Your account does not have permission
          to open this section.
        </p>
      </div>
    );
  }

  return <Outlet />;
}