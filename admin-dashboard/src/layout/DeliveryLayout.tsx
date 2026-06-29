import {
  Outlet,
  useNavigate,
} from "react-router-dom";

import { useAdminAuth } from "../context/AuthContext";

import "../pages/deliveryDashboard.css";

export default function DeliveryLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAdminAuth();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="delivery-shell">
      <header className="delivery-topbar">
        <div className="delivery-brand-row">
          <div className="delivery-brand-mark">B</div>

          <div>
            <span>DELIVERY OPERATIONS</span>
            <strong>Assigned deliveries</strong>
          </div>
        </div>

        <div className="delivery-account-row">
          <div>
            <strong>{user?.fullName}</strong>
            <span>{user?.phone}</span>
          </div>

          <button
            type="button"
            onClick={handleLogout}
          >
            Log out
          </button>
        </div>
      </header>

      <main className="delivery-page-container">
        <Outlet />
      </main>
    </div>
  );
}
