import {
  type FormEvent,
  useEffect,
  useState,
} from "react";

import {
  Navigate,
  useNavigate,
} from "react-router-dom";

import {
  getDashboardHome,
  useAdminAuth,
} from "../context/AuthContext";

export default function LoginPage() {
  const navigate = useNavigate();

  const {
    user,
    isAuthenticated,
    authenticating,
    error,
    login,
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

  useEffect(() => {
    clearError();
  }, [clearError]);

  if (isAuthenticated && user) {
    return (
      <Navigate
        to={getDashboardHome(user)}
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

    const successful = await login(
      identifier.trim(),
      password
    );

    if (successful) {
      navigate("/", {
        replace: true,
      });
    }
  };

  return (
    <div className="login-page">
      <section className="login-visual">
        <div className="login-visual-content">
          <span className="login-badge">
            BOTTLE OPERATIONS
          </span>

          <h1>
            Manage and deliver fresh bottles
            from one secure dashboard.
          </h1>

          <p>
            Administrators control products,
            orders and delivery assignments.
            Delivery partners handle only the
            orders assigned to them.
          </p>

          <div className="login-feature-grid">
            <div>
              <strong>Products</strong>
              <span>
                Manage prices and availability
              </span>
            </div>

            <div>
              <strong>Orders</strong>
              <span>
                Assign and track deliveries
              </span>
            </div>

            <div>
              <strong>Secure OTP</strong>
              <span>
                Confirm delivery at the doorstep
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
            DASHBOARD ACCESS
          </span>

          <h2>Welcome back</h2>

          <p className="form-description">
            Log in using your administrator or
            delivery-partner account.
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
                }}
                placeholder="Enter password"
                autoComplete="current-password"
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(
                    (current) => !current
                  )
                }
              >
                {showPassword
                  ? "Hide"
                  : "Show"}
              </button>
            </div>
          </label>

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
              : "Log in to dashboard"}
          </button>

          <p className="login-security-note">
            Access is restricted to administrator
            and delivery-partner accounts.
          </p>
        </form>
      </section>
    </div>
  );
}
