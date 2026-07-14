import {
  useState,
} from "react";

import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  useAdminAuth,
} from "../context/AuthContext";

const PAGE_TITLES:
  Record<
    string,
    string
  > = {
    "/dashboard":
      "Dashboard",

    "/products":
      "Bottle management",

    "/orders":
      "Order management",
      "/operations":
  "Daily operations",

      "/sales-report":
  "Sales & profit report",

    "/production-plan":
      "Production & packing plan",

    "/batch-register":
      "Batch register",

    "/batch-labels":
      "Batch label print",

    "/delivery-partners":
      "Delivery partner management",

    "/delivery-slots":
      "Delivery slot management",

    "/reviews":
      "Customer review management",

    "/coupons":
      "Coupon management",

    "/locations":
      "Delivery location management",

    "/plans":
      "Subscription plan management",

    "/subscriptions":
      "Customer subscription management",

    "/subscription-charges":
      "Recurring payment management",

    "/users":
      "Customer account management",
  };

function getPageTitle(
  pathname: string
) {
  if (
    pathname.startsWith(
      "/subscriptions/"
    ) &&
    pathname !==
      "/subscriptions"
  ) {
    return "Subscription details";
  }

  return (
    PAGE_TITLES[
      pathname
    ] ??
    "Administration"
  );
}

export default function AdminLayout() {
  const navigate =
    useNavigate();

  const location =
    useLocation();

  const {
    user,
    logout,
  } =
    useAdminAuth();

  const [
    mobileMenuOpen,
    setMobileMenuOpen,
  ] =
    useState(false);

  const pageTitle =
    getPageTitle(
      location.pathname
    );

  const administratorInitial =
    user
      ?.fullName
      ?.trim()
      .charAt(0)
      .toUpperCase() ||
    "A";

  const closeMobileMenu =
    () => {
      setMobileMenuOpen(
        false
      );
    };

  const handleLogout =
    () => {
      logout();

      navigate(
        "/login",

        {
          replace:
            true,
        }
      );
    };

  return (
    <div className="admin-shell">
      <aside
        className={`sidebar ${
          mobileMenuOpen
            ? "sidebar-open"
            : ""
        }`}
      >
        <div className="sidebar-brand">
          <div className="brand-mark">
            B
          </div>

          <div>
            <strong>
              Bottle Admin
            </strong>

            <span>
              Operations panel
            </span>
          </div>
        </div>

        <nav className="sidebar-navigation">
          <NavigationLink
            to="/dashboard"
            icon="▦"
            label="Dashboard"
            onClick={
              closeMobileMenu
            }
          />

          <NavigationLink
            to="/products"
            icon="◫"
            label="Bottles"
            onClick={
              closeMobileMenu
            }
          />

          <NavigationLink
            to="/orders"
            icon="▤"
            label="Orders"
            onClick={
              closeMobileMenu
            }
          />

          <NavigationLink
  to="/operations"
  icon="▣"
  label="Operations"
  onClick={
    closeMobileMenu
  }
/>

          <NavigationLink
  to="/sales-report"
  icon="₹"
  label="Sales report"
  onClick={
    closeMobileMenu
  }
/>

          <NavigationLink
            to="/production-plan"
            icon="▧"
            label="Production plan"
            onClick={
              closeMobileMenu
            }
          />

          <NavigationLink
            to="/batch-register"
            icon="▨"
            label="Batch register"
            onClick={
              closeMobileMenu
            }
          />

          <NavigationLink
            to="/batch-labels"
            icon="▥"
            label="Label print"
            onClick={
              closeMobileMenu
            }
          />

          <NavigationLink
            to="/delivery-partners"
            icon="⇢"
            label="Delivery partners"
            onClick={
              closeMobileMenu
            }
          />

          <NavigationLink
            to="/delivery-slots"
            icon="◷"
            label="Delivery slots"
            onClick={
              closeMobileMenu
            }
          />

          <NavigationLink
            to="/reviews"
            icon="★"
            label="Reviews"
            onClick={
              closeMobileMenu
            }
          />

          <NavigationLink
            to="/coupons"
            icon="%"
            label="Coupons"
            onClick={
              closeMobileMenu
            }
          />

          <NavigationLink
            to="/locations"
            icon="⌖"
            label="Locations"
            onClick={
              closeMobileMenu
            }
          />

          <NavigationLink
            to="/plans"
            icon="◉"
            label="Plans"
            onClick={
              closeMobileMenu
            }
          />

          <NavigationLink
            to="/subscriptions"
            icon="↻"
            label="Subscriptions"
            onClick={
              closeMobileMenu
            }
          />

          <NavigationLink
            to="/subscription-charges"
            icon="₹"
            label="Recurring payments"
            onClick={
              closeMobileMenu
            }
          />

          <NavigationLink
            to="/users"
            icon="◎"
            label="Customers"
            onClick={
              closeMobileMenu
            }
          />
        </nav>

        <div className="sidebar-footer">
          <div className="administrator-card">
            <div className="administrator-avatar">
              {
                administratorInitial
              }
            </div>

            <div className="administrator-details">
              <strong>
                {user
                  ?.fullName ||
                  "Administrator"}
              </strong>

              <span>
                {user
                  ?.email ||
                  "Admin account"}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="logout-button"
            onClick={
              handleLogout
            }
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
          onClick={
            closeMobileMenu
          }
        />
      ) : null}

      <div className="admin-main">
        <header className="topbar">
          <button
            type="button"
            aria-label="Toggle navigation"
            className="mobile-menu-button"
            onClick={() =>
              setMobileMenuOpen(
                (
                  currentValue
                ) =>
                  !currentValue
              )
            }
          >
            ☰
          </button>

          <div>
            <span className="topbar-eyebrow">
              ADMINISTRATION
            </span>

            <h1>
              {pageTitle}
            </h1>
          </div>

          <div className="topbar-role">
            Administrator
          </div>
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
      onClick={
        onClick
      }
      className={({
        isActive,
      }) =>
        `navigation-link ${
          isActive
            ? "navigation-link-active"
            : ""
        }`
      }
    >
      <span className="navigation-icon">
        {icon}
      </span>

      <span>
        {label}
      </span>
    </NavLink>
  );
}