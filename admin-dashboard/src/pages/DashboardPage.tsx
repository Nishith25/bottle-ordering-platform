// admin-dashboard/src/pages/DashboardPage.tsx

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Link,
} from "react-router-dom";

import {
  useAdminAuth,
} from "../context/AuthContext";

import {
  fetchAdminDashboard,
  fetchAdminProducts,
  type AdminProduct,
  type DashboardData,
} from "../services/api";

import {
  fetchAdminFollowUps,
  updateAdminFollowUpStatus,
  type AdminFollowUp,
  type AdminFollowUpsSummary,
} from "../services/adminFollowUpsApi";

import "./dashboard.css";

const DASHBOARD_REFRESH_INTERVAL_MS =
  30_000;

const EMPTY_FOLLOW_UP_SUMMARY: AdminFollowUpsSummary =
  {
    total: 0,
    pending: 0,
    overdue: 0,
    today: 0,
    done: 0,
    cancelled: 0,
  };

function formatCurrency(
  value: number
) {
  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }
  ).format(value);
}

function formatStatus(
  status: string
) {
  return status
    .replace(/_/g, " ")
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}

function formatDateTime(
  value?: string | null
) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Unknown";
  }

  return date.toLocaleString(
    "en-IN",
    {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    }
  );
}

function getStockStatus(
  product: AdminProduct
) {
  if (
    product.stockQuantity <= 0
  ) {
    return {
      label: "Out of stock",
      className: "danger",
    };
  }

  return {
    label: "Low stock",
    className: "warning",
  };
}

function getFollowUpCustomerName(
  followUp: AdminFollowUp
) {
  if (
    followUp.customer &&
    typeof followUp.customer ===
      "object"
  ) {
    return (
      followUp.customer.fullName ||
      "Customer"
    );
  }

  return "Customer";
}

function getFollowUpCustomerPhone(
  followUp: AdminFollowUp
) {
  if (
    followUp.customer &&
    typeof followUp.customer ===
      "object"
  ) {
    return followUp.customer.phone || "";
  }

  return "";
}

function isFollowUpOverdue(
  followUp: AdminFollowUp
) {
  return (
    followUp.status === "pending" &&
    new Date(followUp.dueAt).getTime() <
      Date.now()
  );
}

export default function DashboardPage() {
  const {
    token,
  } = useAdminAuth();

  const [
    dashboard,
    setDashboard,
  ] =
    useState<DashboardData | null>(
      null
    );

  const [
    products,
    setProducts,
  ] =
    useState<AdminProduct[]>(
      []
    );

  const [
    urgentFollowUps,
    setUrgentFollowUps,
  ] =
    useState<AdminFollowUp[]>(
      []
    );

  const [
    followUpSummary,
    setFollowUpSummary,
  ] =
    useState<AdminFollowUpsSummary>(
      EMPTY_FOLLOW_UP_SUMMARY
    );

  const [
    followUpActionId,
    setFollowUpActionId,
  ] =
    useState<string | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );

  const mountedRef =
    useRef(true);

  const requestRef =
    useRef<Promise<void> | null>(
      null
    );

  useEffect(() => {
    mountedRef.current =
      true;

    return () => {
      mountedRef.current =
        false;
    };
  }, []);

  const loadDashboard =
    useCallback(
      async ({
        showIndicator = false,
      }: {
        showIndicator?: boolean;
      } = {}) => {
        if (!token) {
          if (
            mountedRef.current
          ) {
            setLoading(false);
          }

          return;
        }

        if (
          requestRef.current
        ) {
          if (
            showIndicator &&
            mountedRef.current
          ) {
            setRefreshing(true);
          }

          await requestRef.current;

          if (
            mountedRef.current
          ) {
            setRefreshing(false);
          }

          return;
        }

        if (
          showIndicator &&
          mountedRef.current
        ) {
          setRefreshing(true);
        }

        if (
          mountedRef.current
        ) {
          setError(null);
        }

        const request =
          (async () => {
            try {
              const [
                dashboardData,
                productData,
                followUpData,
              ] =
                await Promise.all([
                  fetchAdminDashboard(
                    token
                  ),

                  fetchAdminProducts(
                    token
                  ),

                  fetchAdminFollowUps(
                    token,
                    {
                      status:
                        "pending",
                      limit: 6,
                    }
                  ),
                ]);

              if (
                !mountedRef.current
              ) {
                return;
              }

              setDashboard(
                dashboardData
              );

              setProducts(
                productData
              );

              setUrgentFollowUps(
                followUpData.followUps
              );

              setFollowUpSummary(
                followUpData.summary
              );
            } catch (
              requestError
            ) {
              if (
                !mountedRef.current
              ) {
                return;
              }

              setError(
                requestError instanceof
                  Error
                  ? requestError.message
                  : "Unable to load dashboard."
              );
            } finally {
              if (
                mountedRef.current
              ) {
                setLoading(false);
                setRefreshing(false);
              }
            }
          })();

        requestRef.current =
          request;

        try {
          await request;
        } finally {
          if (
            requestRef.current ===
            request
          ) {
            requestRef.current =
              null;
          }
        }
      },
      [
        token,
      ]
    );

  useEffect(() => {
    void loadDashboard();

    const intervalId =
      window.setInterval(
        () => {
          if (
            document.visibilityState ===
            "visible"
          ) {
            void loadDashboard();
          }
        },
        DASHBOARD_REFRESH_INTERVAL_MS
      );

    const handleVisibilityChange =
      () => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          void loadDashboard();
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
    loadDashboard,
  ]);

  const handleMarkFollowUpDone =
    async (
      followUp: AdminFollowUp
    ) => {
      if (!token) {
        return;
      }

      setFollowUpActionId(
        followUp._id
      );

      setError(null);

      try {
        await updateAdminFollowUpStatus(
          token,
          followUp._id,
          "done"
        );

        await loadDashboard({
          showIndicator: true,
        });
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to update follow-up."
        );
      } finally {
        setFollowUpActionId(null);
      }
    };

  const inventoryAlerts =
    useMemo(
      () =>
        products
          .filter(
            (product) =>
              product.available &&
              product.stockQuantity <=
                product.lowStockThreshold
          )
          .sort(
            (
              firstProduct,
              secondProduct
            ) => {
              const firstOutOfStock =
                firstProduct.stockQuantity <=
                0;

              const secondOutOfStock =
                secondProduct.stockQuantity <=
                0;

              if (
                firstOutOfStock !==
                secondOutOfStock
              ) {
                return firstOutOfStock
                  ? -1
                  : 1;
              }

              return (
                firstProduct.stockQuantity -
                secondProduct.stockQuantity
              );
            }
          ),
      [
        products,
      ]
    );

  const outOfStockCount =
    inventoryAlerts.filter(
      (product) =>
        product.stockQuantity <= 0
    ).length;

  const lowStockCount =
    inventoryAlerts.length -
    outOfStockCount;

  const urgentFollowUpCount =
    followUpSummary.overdue +
    followUpSummary.today;

  if (
    loading &&
    !dashboard
  ) {
    return (
      <div
        className="page-state"
      >
        <div
          className="spinner"
        />

        <p>
          Loading dashboard
        </p>
      </div>
    );
  }

  if (
    error &&
    !dashboard
  ) {
    return (
      <div
        className="page-state"
      >
        <div
          className="state-icon"
        >
          !
        </div>

        <h2>
          Unable to load dashboard
        </h2>

        <p>{error}</p>

        <button
          type="button"
          className="primary-button"
          onClick={() => {
            void loadDashboard({
              showIndicator:
                true,
            });
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
      label:
        "Total products",

      value:
        totals.products,

      detail:
        `${totals.activeProducts} currently available`,

      symbol:
        "◫",
    },

    {
      label:
        "Customers",

      value:
        totals.customers,

      detail:
        "Registered accounts",

      symbol:
        "◎",
    },

    {
      label:
        "Orders",

      value:
        totals.orders,

      detail:
        formatCurrency(
          totals.orderValue
        ),

      symbol:
        "▤",
    },

    {
      label:
        "Follow-ups today",

      value:
        followUpSummary.today,

      detail:
        `${followUpSummary.overdue} overdue · ${followUpSummary.pending} pending`,

      symbol:
        "⏰",
    },

    {
      label:
        "Active subscriptions",

      value:
        totals.activeSubscriptions,

      detail:
        `${formatCurrency(
          totals.activeSubscriptionCycleValue
        )} per cycle`,

      symbol:
        "↻",
    },

    {
      label:
        "Delivery locations",

      value:
        totals.activeLocations,

      detail:
        "Active service areas",

      symbol:
        "⌖",
    },
  ];

  return (
    <div
      className="dashboard-page"
    >
      <div
        className="page-heading-row"
      >
        <div>
          <h2>
            Business overview
          </h2>

          <p>
            Live information from your MongoDB database.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          disabled={
            refreshing
          }
          onClick={() => {
            void loadDashboard({
              showIndicator:
                true,
            });
          }}
        >
          {refreshing
            ? "Refreshing..."
            : "Refresh"}
        </button>
      </div>

      {error ? (
        <div
          className="inline-error"
        >
          {error}
        </div>
      ) : null}

      {urgentFollowUpCount >
      0 ? (
        <section
          className={[
            "dashboard-followup-alert",

            followUpSummary.overdue >
            0
              ? "danger"
              : "warning",
          ].join(" ")}
        >
          <div className="dashboard-followup-alert-header">
            <div className="dashboard-followup-alert-title-group">
              <div className="dashboard-followup-alert-icon">
                ⏰
              </div>

              <div>
                <span className="dashboard-followup-eyebrow">
                  CUSTOMER FOLLOW-UPS
                </span>

                <h3>
                  Follow-ups need attention
                </h3>

                <p>
                  Call or update customers before pending reminders are missed.
                </p>
              </div>
            </div>

            <Link
              to="/follow-ups"
              className="dashboard-followup-manage-button"
            >
              Open Follow-up Center
            </Link>
          </div>

          <div className="dashboard-followup-summary">
            {followUpSummary.overdue >
            0 ? (
              <span className="dashboard-followup-summary-pill danger">
                {followUpSummary.overdue} overdue
              </span>
            ) : null}

            {followUpSummary.today >
            0 ? (
              <span className="dashboard-followup-summary-pill warning">
                {followUpSummary.today} due today
              </span>
            ) : null}

            {followUpSummary.pending >
            0 ? (
              <span className="dashboard-followup-summary-pill neutral">
                {followUpSummary.pending} pending total
              </span>
            ) : null}
          </div>

          {urgentFollowUps.length >
          0 ? (
            <div className="dashboard-followup-list">
              {urgentFollowUps.map(
                (followUp) => {
                  const overdue =
                    isFollowUpOverdue(
                      followUp
                    );

                  const phone =
                    getFollowUpCustomerPhone(
                      followUp
                    );

                  return (
                    <article
                      key={
                        followUp._id
                      }
                      className={[
                        "dashboard-followup-item",

                        overdue
                          ? "danger"
                          : "warning",
                      ].join(" ")}
                    >
                      <div className="dashboard-followup-main">
                        <div className="dashboard-followup-status-dot" />

                        <div>
                          <strong>
                            {
                              followUp.title
                            }
                          </strong>

                          <span>
                            {getFollowUpCustomerName(
                              followUp
                            )}
                            {phone
                              ? ` · +91 ${phone}`
                              : ""}
                          </span>

                          {followUp.description ? (
                            <small>
                              {
                                followUp.description
                              }
                            </small>
                          ) : null}
                        </div>
                      </div>

                      <div className="dashboard-followup-item-actions">
                        <div className="dashboard-followup-due">
                          <span>
                            Due
                          </span>

                          <strong>
                            {formatDateTime(
                              followUp.dueAt
                            )}
                          </strong>
                        </div>

                        <span
                          className={[
                            "dashboard-followup-status",

                            overdue
                              ? "danger"
                              : "warning",
                          ].join(" ")}
                        >
                          {overdue
                            ? "Overdue"
                            : "Today"}
                        </span>

                        <button
                          type="button"
                          className="dashboard-followup-done-button"
                          disabled={
                            followUpActionId ===
                            followUp._id
                          }
                          onClick={() => {
                            void handleMarkFollowUpDone(
                              followUp
                            );
                          }}
                        >
                          {followUpActionId ===
                          followUp._id
                            ? "Saving..."
                            : "Mark done"}
                        </button>
                      </div>
                    </article>
                  );
                }
              )}
            </div>
          ) : null}
        </section>
      ) : (
        <section className="dashboard-followup-healthy">
          <div className="dashboard-followup-healthy-icon">
            ✓
          </div>

          <div>
            <strong>
              No urgent follow-ups
            </strong>

            <span>
              There are no overdue or today follow-ups.
            </span>
          </div>

          <Link
            to="/follow-ups"
            className="dashboard-followup-healthy-link"
          >
            View follow-ups
          </Link>
        </section>
      )}

      {inventoryAlerts.length >
      0 ? (
        <section
          className={[
            "dashboard-stock-alert",

            outOfStockCount >
            0
              ? "danger"
              : "warning",
          ].join(" ")}
        >
          <div
            className="dashboard-stock-alert-header"
          >
            <div
              className="dashboard-stock-alert-title-group"
            >
              <div
                className="dashboard-stock-alert-icon"
              >
                !
              </div>

              <div>
                <span
                  className="dashboard-stock-eyebrow"
                >
                  INVENTORY ATTENTION
                </span>

                <h3>
                  Stock requires attention
                </h3>

                <p>
                  Restore bottle stock before customers encounter unavailable products.
                </p>
              </div>
            </div>

            <Link
              to="/products"
              className="dashboard-stock-manage-button"
            >
              Manage all stock
            </Link>
          </div>

          <div
            className="dashboard-stock-summary"
          >
            {outOfStockCount >
            0 ? (
              <span
                className="dashboard-stock-summary-pill danger"
              >
                {outOfStockCount} out of stock
              </span>
            ) : null}

            {lowStockCount >
            0 ? (
              <span
                className="dashboard-stock-summary-pill warning"
              >
                {lowStockCount} low stock
              </span>
            ) : null}
          </div>

          <div
            className="dashboard-stock-list"
          >
            {inventoryAlerts.map(
              (product) => {
                const status =
                  getStockStatus(
                    product
                  );

                return (
                  <article
                    key={
                      product._id
                    }
                    className="dashboard-stock-item"
                  >
                    <div
                      className="dashboard-stock-product"
                    >
                      <div
                        className={[
                          "dashboard-stock-status-dot",

                          status.className,
                        ].join(" ")}
                      />

                      <div>
                        <strong>
                          {product.name}
                        </strong>

                        <span>
                          Threshold:{" "}
                          {
                            product.lowStockThreshold
                          }
                        </span>
                      </div>
                    </div>

                    <div
                      className="dashboard-stock-item-actions"
                    >
                      <div
                        className="dashboard-stock-quantity"
                      >
                        <span>
                          Current stock
                        </span>

                        <strong>
                          {
                            product.stockQuantity
                          }
                        </strong>
                      </div>

                      <span
                        className={[
                          "dashboard-stock-status",

                          status.className,
                        ].join(" ")}
                      >
                        {
                          status.label
                        }
                      </span>

                      <Link
                        to="/products"
                        className="dashboard-stock-item-link"
                      >
                        Update stock
                      </Link>
                    </div>
                  </article>
                );
              }
            )}
          </div>
        </section>
      ) : (
        <section
          className="dashboard-stock-healthy"
        >
          <div
            className="dashboard-stock-healthy-icon"
          >
            ✓
          </div>

          <div>
            <strong>
              Inventory is healthy
            </strong>

            <span>
              All available bottles are above their low-stock thresholds.
            </span>
          </div>

          <Link
            to="/products"
            className="dashboard-stock-healthy-link"
          >
            View inventory
          </Link>
        </section>
      )}

      <div
        className="metric-grid"
      >
        {cards.map(
          (card) => (
            <article
              key={
                card.label
              }
              className="metric-card"
            >
              <div
                className="metric-icon"
              >
                {
                  card.symbol
                }
              </div>

              <span
                className="metric-label"
              >
                {
                  card.label
                }
              </span>

              <strong
                className="metric-value"
              >
                {
                  card.value
                }
              </strong>

              <span
                className="metric-detail"
              >
                {
                  card.detail
                }
              </span>
            </article>
          )
        )}
      </div>

      <div
        className="breakdown-grid"
      >
        <section
          className="panel"
        >
          <div
            className="panel-heading"
          >
            <div>
              <h3>
                Order status
              </h3>

              <p>
                Current order distribution
              </p>
            </div>
          </div>

          <div
            className="status-list"
          >
            {Object.keys(
              orderStatusBreakdown
            ).length ===
            0 ? (
              <div
                className="empty-panel"
              >
                No orders have been placed.
              </div>
            ) : (
              Object.entries(
                orderStatusBreakdown
              ).map(
                ([
                  status,
                  count,
                ]) => (
                  <div
                    key={
                      status
                    }
                    className="status-row"
                  >
                    <span>
                      {
                        formatStatus(
                          status
                        )
                      }
                    </span>

                    <strong>
                      {count}
                    </strong>
                  </div>
                )
              )
            )}
          </div>
        </section>

        <section
          className="panel"
        >
          <div
            className="panel-heading"
          >
            <div>
              <h3>
                Subscription status
              </h3>

              <p>
                Recurring plan distribution
              </p>
            </div>
          </div>

          <div
            className="status-list"
          >
            {Object.keys(
              subscriptionStatusBreakdown
            ).length ===
            0 ? (
              <div
                className="empty-panel"
              >
                No subscriptions created.
              </div>
            ) : (
              Object.entries(
                subscriptionStatusBreakdown
              ).map(
                ([
                  status,
                  count,
                ]) => (
                  <div
                    key={
                      status
                    }
                    className="status-row"
                  >
                    <span>
                      {
                        formatStatus(
                          status
                        )
                      }
                    </span>

                    <strong>
                      {count}
                    </strong>
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