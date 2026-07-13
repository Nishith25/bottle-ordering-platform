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

import "./dashboard.css";

const DASHBOARD_REFRESH_INTERVAL_MS =
  30_000;

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
              ] =
                await Promise.all([
                  fetchAdminDashboard(
                    token
                  ),

                  fetchAdminProducts(
                    token
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