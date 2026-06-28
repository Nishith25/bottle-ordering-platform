// admin-dashboard/src/components/ProtectedRoute.tsx

import {
  Navigate,
  Outlet,
} from "react-router-dom";

import { useAdminAuth } from "../context/AuthContext";

export default function ProtectedRoute() {
  const {
    loading,
    isAuthenticated,
  } = useAdminAuth();

  if (loading) {
    return (
      <div className="full-screen-state">
        <div className="spinner" />

        <p>Checking administrator access</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  return <Outlet />;
}