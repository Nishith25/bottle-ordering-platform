import { useState } from "react";

import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { useAdminAuth } from "../context/AuthContext";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/products": "Bottle management",
  "/orders": "Order management",
  "/coupons": "Coupon management",
  "/locations": "Delivery location management",
  "/plans": "Subscription plan management",
  "/subscriptions": "Customer subscription management",
  "/users": "Customer account management",
};

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAdminAuth();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const pageTitle =
    PAGE_TITLES[location.pathname] ?? "Administration";

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="admin-shell">
      <aside
        className={`sidebar ${
          mobileMenuOpen ? "sidebar-open" : ""
        }`}
      >
        <div className="sidebar-brand">
          <div className="brand-mark">B</div>

          <div>
            <strong>Bottle Admin</strong>
            <span>Operations panel</span>
          </div>
        </div>

        <nav className="sidebar-navigation">
          <NavigationLink
            to="/dashboard"
            icon="▦"
            label="Dashboard"
            onClick={closeMobileMenu}
          />

          <NavigationLink
            to="/products"
            icon="◫"
            label="Bottles"
            onClick={closeMobileMenu}
          />

          <NavigationLink
            to="/orders"
            icon="▤"
            label="Orders"
            onClick={closeMobileMenu}
          />

          <NavigationLink
            to="/coupons"
            icon="%"
            label="Coupons"
            onClick={closeMobileMenu}
          />

          <NavigationLink
            to="/locations"
            icon="⌖"
            label="Locations"
            onClick={closeMobileMenu}
          />

          <NavigationLink
            to="/plans"
            icon="◉"
            label="Plans"
            onClick={closeMobileMenu}
          />

          <NavigationLink
            to="/subscriptions"
            icon="↻"
            label="Subscriptions"
            onClick={closeMobileMenu}
          />

          <NavigationLink
            to="/users"
            icon="◎"
            label="Customers"
            onClick={closeMobileMenu}
          />
        </nav>

        <div className="sidebar-footer">
          <div className="administrator-card">
            <div className="administrator-avatar">
              {user?.fullName.charAt(0).toUpperCase() ?? "A"}
            </div>

            <div className="administrator-details">
              <strong>{user?.fullName}</strong>
              <span>{user?.email}</span>
            </div>
          </div>

          <button
            type="button"
            className="logout-button"
            onClick={handleLogout}
          >
            Log out
          </button>
        </div>
      </aside>

      {mobileMenuOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="mobile-overlay"
          onClick={closeMobileMenu}
        />
      ) : null}

      <div className="admin-main">
        <header className="topbar">
          <button
            type="button"
            className="mobile-menu-button"
            onClick={() =>
              setMobileMenuOpen((current) => !current)
            }
          >
            ☰
          </button>

          <div>
            <span className="topbar-eyebrow">ADMINISTRATION</span>
            <h1>{pageTitle}</h1>
          </div>

          <div className="topbar-role">Administrator</div>
        </header>

        <main className="page-container">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function NavigationLink({
  to,
  icon,
  label,
  onClick,
}: {
  to: string;
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `navigation-link ${
          isActive ? "navigation-link-active" : ""
        }`
      }
    >
      <span className="navigation-icon">{icon}</span>
      {label}
    </NavLink>
  );
}
