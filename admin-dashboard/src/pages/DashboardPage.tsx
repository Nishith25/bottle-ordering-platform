// admin-dashboard/src/pages/DashboardPage.tsx

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { useAdminAuth } from "../context/AuthContext";

import {
  fetchAdminDashboard,
  type DashboardData,
} from "../services/api";

function formatCurrency(value: number) {
  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }
  ).format(value);
}

function formatStatus(status: string) {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

export default function DashboardPage() {
  const { token } = useAdminAuth();

  const [dashboard, setDashboard] =
    useState<DashboardData | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const loadDashboard =
    useCallback(async () => {
      if (!token) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data =
          await fetchAdminDashboard(
            token
          );

        setDashboard(data);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load dashboard."
        );
      } finally {
        setLoading(false);
      }
    }, [token]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  if (loading && !dashboard) {
    return (
      <div className="page-state">
        <div className="spinner" />
        <p>Loading dashboard</p>
      </div>
    );
  }

  if (error && !dashboard) {
    return (
      <div className="page-state">
        <div className="state-icon">
          !
        </div>

        <h2>Unable to load dashboard</h2>

        <p>{error}</p>

        <button
          type="button"
          className="primary-button"
          onClick={() => {
            void loadDashboard();
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  if (!dashboard) {
    return null;
  }

  const {
    totals,
    orderStatusBreakdown,
    subscriptionStatusBreakdown,
  } = dashboard;

  const cards = [
    {
      label: "Total products",
      value: totals.products,
      detail: `${totals.activeProducts} currently available`,
      symbol: "◫",
    },
    {
      label: "Customers",
      value: totals.customers,
      detail: "Registered accounts",
      symbol: "◎",
    },
    {
      label: "Orders",
      value: totals.orders,
      detail: formatCurrency(
        totals.orderValue
      ),
      symbol: "▤",
    },
    {
      label: "Active subscriptions",
      value:
        totals.activeSubscriptions,
      detail: `${formatCurrency(
        totals.activeSubscriptionCycleValue
      )} per cycle`,
      symbol: "↻",
    },
    {
      label: "Delivery locations",
      value: totals.activeLocations,
      detail: "Active service areas",
      symbol: "⌖",
    },
  ];

  return (
    <div className="dashboard-page">
      <div className="page-heading-row">
        <div>
          <h2>Business overview</h2>

          <p>
            Live information from your
            MongoDB database.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          disabled={loading}
          onClick={() => {
            void loadDashboard();
          }}
        >
          {loading
            ? "Refreshing..."
            : "Refresh"}
        </button>
      </div>

      {error ? (
        <div className="inline-error">
          {error}
        </div>
      ) : null}

      <div className="metric-grid">
        {cards.map((card) => (
          <article
            key={card.label}
            className="metric-card"
          >
            <div className="metric-icon">
              {card.symbol}
            </div>

            <span className="metric-label">
              {card.label}
            </span>

            <strong className="metric-value">
              {card.value}
            </strong>

            <span className="metric-detail">
              {card.detail}
            </span>
          </article>
        ))}
      </div>

      <div className="breakdown-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Order status</h3>

              <p>
                Current order distribution
              </p>
            </div>
          </div>

          <div className="status-list">
            {Object.keys(
              orderStatusBreakdown
            ).length === 0 ? (
              <div className="empty-panel">
                No orders have been placed.
              </div>
            ) : (
              Object.entries(
                orderStatusBreakdown
              ).map(
                ([status, count]) => (
                  <div
                    key={status}
                    className="status-row"
                  >
                    <span>
                      {formatStatus(status)}
                    </span>

                    <strong>{count}</strong>
                  </div>
                )
              )
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Subscription status</h3>

              <p>
                Recurring plan distribution
              </p>
            </div>
          </div>

          <div className="status-list">
            {Object.keys(
              subscriptionStatusBreakdown
            ).length === 0 ? (
              <div className="empty-panel">
                No subscriptions created.
              </div>
            ) : (
              Object.entries(
                subscriptionStatusBreakdown
              ).map(
                ([status, count]) => (
                  <div
                    key={status}
                    className="status-row"
                  >
                    <span>
                      {formatStatus(status)}
                    </span>

                    <strong>{count}</strong>
                  </div>
                )
              )
            )}
          </div>
        </section>
      </div>
    </div>
  );
}