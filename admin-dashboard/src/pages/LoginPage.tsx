import {
  type FormEvent,
  useEffect,
  useState,
} from "react";

import {
  Navigate,
  useSearchParams,
} from "react-router-dom";

import { useAdminAuth } from "../context/AuthContext";

type DashboardRole =
  | "admin"
  | "delivery";

export default function LoginPage() {
  const [searchParams] =
    useSearchParams();

  const {
    user,
    isAuthenticated,
    authenticating,
    error,
    login,
    logout,
    clearError,
  } = useAdminAuth();

  const [
    identifier,
    setIdentifier,
  ] = useState("");

  const [password, setPassword] =
    useState("");

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    roleMessage,
    setRoleMessage,
  ] = useState<string | null>(
    null
  );

  const requestedRoleValue =
    searchParams.get("role");

  const requestedRole:
    DashboardRole | null =
    requestedRoleValue ===
    "delivery"
      ? "delivery"
      : requestedRoleValue ===
          "admin"
        ? "admin"
        : null;

  useEffect(() => {
    clearError();
  }, [clearError]);

  useEffect(() => {
    if (
      !isAuthenticated ||
      !user ||
      !requestedRole ||
      user.role === requestedRole
    ) {
      return;
    }

    const previousRole =
      user.role === "admin"
        ? "administrator"
        : "delivery partner";

    logout();

    setRoleMessage(
      `The existing ${previousRole} dashboard session was signed out. Log in with a ${requestedRole === "delivery" ? "delivery partner" : "administrator"} account.`
    );
  }, [
    isAuthenticated,
    user,
    requestedRole,
    logout,
  ]);

  if (
    isAuthenticated &&
    user
  ) {
    if (
      requestedRole &&
      user.role !== requestedRole
    ) {
      return (
        <div className="full-screen-state">
          <div className="spinner" />

          <p>
            Switching dashboard account
          </p>
        </div>
      );
    }

    return (
      <Navigate
        to={
          user.role === "delivery"
            ? "/delivery"
            : "/dashboard"
        }
        replace
      />
    );
  }

  const canSubmit =
    identifier.trim().length > 0 &&
    password.length > 0 &&
    !authenticating;

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    setRoleMessage(null);

    await login(
      identifier.trim(),
      password
    );
  };

  const accessTitle =
    requestedRole === "delivery"
      ? "Delivery partner access"
      : requestedRole === "admin"
        ? "Administrator access"
        : "Operations access";

  const description =
    requestedRole === "delivery"
      ? "Log in using your delivery partner email address or mobile number."
      : requestedRole === "admin"
        ? "Log in using your administrator email address or mobile number."
        : "Administrators and delivery partners can log in to their operations dashboard.";

  return (
    <div className="login-page">
      <section className="login-visual">
        <div className="login-visual-content">
          <span className="login-badge">
            BOTTLE OPERATIONS
          </span>

          <h1>
            Manage fresh bottle operations
            from one dashboard.
          </h1>

          <p>
            Administrators can manage the
            business, while delivery partners
            can manage assigned orders.
          </p>

          <div className="login-feature-grid">
            <div>
              <strong>
                Products
              </strong>

              <span>
                Manage prices and stock
              </span>
            </div>

            <div>
              <strong>
                Orders
              </strong>

              <span>
                Track customer purchases
              </span>
            </div>

            <div>
              <strong>
                Delivery
              </strong>

              <span>
                Complete assigned deliveries
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="login-form-section">
        <form
          className="login-card"
          onSubmit={handleSubmit}
        >
          <div className="login-logo">
            B
          </div>

          <span className="form-eyebrow">
            {accessTitle.toUpperCase()}
          </span>

          <h2>Welcome back</h2>

          <p className="form-description">
            {description}
          </p>

          <label className="form-field">
            <span>
              Email or mobile number
            </span>

            <input
              value={identifier}
              onChange={(event) => {
                setIdentifier(
                  event.target.value
                );

                clearError();
                setRoleMessage(null);
              }}
              placeholder="Enter email or phone"
              autoComplete="username"
              autoFocus
            />
          </label>

          <label className="form-field">
            <span>Password</span>

            <div className="password-field">
              <input
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                value={password}
                onChange={(event) => {
                  setPassword(
                    event.target.value
                  );

                  clearError();
                  setRoleMessage(null);
                }}
                placeholder="Enter password"
                autoComplete="current-password"
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(
                    (current) =>
                      !current
                  )
                }
              >
                {showPassword
                  ? "Hide"
                  : "Show"}
              </button>
            </div>
          </label>

          {roleMessage ? (
            <div className="form-error">
              {roleMessage}
            </div>
          ) : null}

          {error ? (
            <div className="form-error">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={!canSubmit}
            className="primary-button login-submit"
          >
            {authenticating
              ? "Logging in..."
              : requestedRole ===
                    "delivery"
                ? "Log in to delivery dashboard"
                : requestedRole ===
                    "admin"
                  ? "Log in to admin dashboard"
                  : "Log in to dashboard"}
          </button>

          <p className="login-security-note">
            Access is restricted to
            administrator and delivery partner
            accounts.
          </p>
        </form>
      </section>
    </div>
  );
}