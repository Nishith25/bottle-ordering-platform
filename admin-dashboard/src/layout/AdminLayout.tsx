import {
  useCallback,
  useEffect,
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

import {
  fetchAdminFollowUps,
} from "../services/adminFollowUpsApi";

import {
  fetchAdminNotifications,
} from "../services/adminNotificationsApi";

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

    "/invoices":
      "Invoices",

    "/operations":
      "Daily operations",

    "/follow-ups":
      "Follow-up Center",

    "/notifications":
      "Notification Center",

    "/sales-report":
      "Sales & profit report",

    "/costing":
      "Costing & expenses",

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

      "/activity-log":
  "Activity Log",
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
    token,
    logout,
  } =
    useAdminAuth();

  const [
    mobileMenuOpen,
    setMobileMenuOpen,
  ] =
    useState(false);

  const [
    urgentFollowUpCount,
    setUrgentFollowUpCount,
  ] =
    useState(0);

  const [
    unreadNotificationCount,
    setUnreadNotificationCount,
  ] =
    useState(0);

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

  const loadBadges =
    useCallback(async () => {
      if (!token) {
        setUrgentFollowUpCount(0);
        setUnreadNotificationCount(0);
        return;
      }

      try {
        const [
          followUpResult,
          notificationResult,
        ] =
          await Promise.all([
            fetchAdminFollowUps(
              token,
              {
                status:
                  "pending",
                limit: 1,
              }
            ),

            fetchAdminNotifications(
              token,
              {
                unreadOnly:
                  true,
                limit: 1,
              }
            ),
          ]);

        setUrgentFollowUpCount(
          followUpResult.summary.overdue +
            followUpResult.summary.today
        );

        setUnreadNotificationCount(
          notificationResult.summary.unread
        );
      } catch {
        setUrgentFollowUpCount(0);
        setUnreadNotificationCount(0);
      }
    }, [
      token,
    ]);

  useEffect(() => {
    void loadBadges();

    const intervalId =
      window.setInterval(
        () => {
          if (
            document.visibilityState ===
            "visible"
          ) {
            void loadBadges();
          }
        },
        60_000
      );

    const handleVisibilityChange =
      () => {
        if (
          document.visibilityState ===
            "visible"
        ) {
          void loadBadges();
        }
      };

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      window.clearInterval(
        intervalId
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, [
    loadBadges,
  ]);

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
          replace: true,
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
            to="/invoices"
            icon="▥"
            label="Invoices"
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
            to="/follow-ups"
            icon="⏰"
            label="Follow-ups"
            badge={
              urgentFollowUpCount
            }
            onClick={
              closeMobileMenu
            }
          />

          <NavigationLink
            to="/notifications"
            icon="🔔"
            label="Notifications"
            badge={
              unreadNotificationCount
            }
            onClick={
              closeMobileMenu
            }
          />

          <NavigationLink
  to="/activity-log"
  icon="☷"
  label="Activity Log"
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
            to="/costing"
            icon="▥"
            label="Costing"
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

          <div
            style={{
              display:
                "flex",
              alignItems:
                "center",
              gap:
                10,
              marginLeft:
                "auto",
            }}
          >
            <button
              type="button"
              aria-label="Open notifications"
              onClick={() =>
                navigate(
                  "/notifications"
                )
              }
              style={{
                position:
                  "relative",
                width:
                  42,
                height:
                  42,
                border:
                  "1px solid #dbe5dd",
                borderRadius:
                  14,
                background:
                  "#ffffff",
                color:
                  "#245c42",
                cursor:
                  "pointer",
                fontSize:
                  17,
                fontWeight:
                  900,
              }}
            >
              🔔

              {unreadNotificationCount >
              0 ? (
                <span
                  style={{
                    position:
                      "absolute",
                    top:
                      -5,
                    right:
                      -5,
                    minWidth:
                      19,
                    height:
                      19,
                    padding:
                      "0 5px",
                    borderRadius:
                      999,
                    background:
                      "#c95c5c",
                    color:
                      "#ffffff",
                    display:
                      "inline-flex",
                    alignItems:
                      "center",
                    justifyContent:
                      "center",
                    fontSize:
                      9,
                    fontWeight:
                      900,
                    lineHeight:
                      1,
                  }}
                >
                  {unreadNotificationCount >
                  99
                    ? "99+"
                    : unreadNotificationCount}
                </span>
              ) : null}
            </button>

            <div className="topbar-role">
              Administrator
            </div>
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
  badge = 0,
  onClick,
}: {
  to: string;
  icon: string;
  label: string;
  badge?: number;
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

      {badge > 0 ? (
        <span
          style={{
            marginLeft:
              "auto",
            minWidth:
              18,
            height:
              18,
            padding:
              "0 6px",
            borderRadius:
              999,
            background:
              "#c95c5c",
            color:
              "#ffffff",
            display:
              "inline-flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            fontSize:
              9,
            fontWeight:
              900,
            lineHeight:
              1,
          }}
        >
          {badge > 99
            ? "99+"
            : badge}
        </span>
      ) : null}
    </NavLink>
  );
}