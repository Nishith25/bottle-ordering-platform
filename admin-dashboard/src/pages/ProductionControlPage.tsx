// admin-dashboard/src/pages/ProductionControlPage.tsx

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  useAdminAuth,
} from "../context/AuthContext";

import {
  fetchProductionControlSummary,
  type ProductionChecklistItem,
  type ProductionControlOrderBrief,
  type ProductionControlProduct,
  type ProductionControlResult,
} from "../services/adminProductionControlApi";

import "./productionControl.css";

function formatCurrency(value: number) {
  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }
  ).format(value || 0);
}

function formatDate(value?: string | null) {
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

function getTodayDateId() {
  return new Date()
    .toLocaleDateString(
      "en-CA",
      {
        timeZone: "Asia/Kolkata",
      }
    );
}

function statusLabel(
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

export default function ProductionControlPage() {
  const { token } =
    useAdminAuth();

  const navigate =
    useNavigate();

  const [
    dateId,
    setDateId,
  ] =
    useState(
      getTodayDateId()
    );

  const [
    data,
    setData,
  ] =
    useState<ProductionControlResult | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );

  const loadSummary =
    useCallback(async () => {
      if (!token) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result =
          await fetchProductionControlSummary(
            token,
            dateId
          );

        setData(result);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load production control summary."
        );
      } finally {
        setLoading(false);
      }
    }, [
      token,
      dateId,
    ]);

  useEffect(() => {
    void loadSummary();
  }, [
    loadSummary,
  ]);

  const dangerCount =
    useMemo(
      () =>
        data?.checklist.filter(
          (item) =>
            item.status === "danger"
        ).length || 0,
      [
        data,
      ]
    );

  const warningCount =
    useMemo(
      () =>
        data?.checklist.filter(
          (item) =>
            item.status === "warning"
        ).length || 0,
      [
        data,
      ]
    );

  return (
    <div className="production-control-page">
      <div className="page-heading-row">
        <div>
          <h2>
            Production Control
          </h2>

          <p>
            Daily launch readiness,
            fulfilment risks, COD closing,
            stock alerts and customer
            follow-up checks.
          </p>
        </div>

        <div className="production-heading-actions">
          <input
            type="date"
            value={dateId}
            onChange={(event) =>
              setDateId(
                event.target.value
              )
            }
          />

          <button
            type="button"
            className="secondary-button"
            disabled={loading}
            onClick={() => {
              void loadSummary();
            }}
          >
            {loading
              ? "Refreshing..."
              : "Refresh"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="inline-error">
          {error}
        </div>
      ) : null}

      {loading && !data ? (
        <div className="page-state compact">
          <div className="spinner" />

          <p>
            Loading production control
          </p>
        </div>
      ) : data ? (
        <>
          <section className="production-status-banner">
            <div>
              <span>
                LIVE READINESS
              </span>

              <h3>
                {dangerCount > 0
                  ? "Critical actions needed"
                  : warningCount > 0
                    ? "Almost ready"
                    : "Ready for daily operations"}
              </h3>

              <p>
                {dangerCount > 0
                  ? "Resolve danger items before accepting more orders."
                  : warningCount > 0
                    ? "A few operational items need review."
                    : "No critical launch blockers found for this date."}
              </p>
            </div>

            <div className="readiness-score">
              <strong>
                {Math.max(
                  0,
                  100 -
                    dangerCount * 20 -
                    warningCount * 8
                )}
                %
              </strong>

              <span>
                Readiness
              </span>
            </div>
          </section>

          <section className="production-metric-grid">
            <MetricCard
              label="Today orders"
              value={
                data.summary.todaysOrders
              }
            />

            <MetricCard
              label="Today bottles"
              value={
                data.summary.todaysBottles
              }
            />

            <MetricCard
              label="Need confirm"
              value={
                data.summary.ordersNeedingConfirmation
              }
              warning={
                data.summary.ordersNeedingConfirmation >
                0
              }
            />

            <MetricCard
              label="Failed refunds"
              value={
                data.summary.failedRefunds
              }
              danger={
                data.summary.failedRefunds >
                0
              }
            />

            <MetricCard
              label="Pending COD"
              value={formatCurrency(
                data.summary.pendingCodAmount
              )}
              warning={
                data.summary.pendingCodAmount >
                0
              }
            />

            <MetricCard
              label="Low stock"
              value={
                data.summary.lowStockProducts
              }
              danger={
                data.summary.outOfStockProducts >
                0
              }
              warning={
                data.summary.lowStockProducts >
                0
              }
            />
          </section>

          <section className="production-grid-two">
            <div className="panel production-panel">
              <div className="production-panel-heading">
                <div>
                  <h3>
                    Launch checklist
                  </h3>

                  <p>
                    Resolve warnings before
                    daily production closes.
                  </p>
                </div>
              </div>

              <div className="checklist-list">
                {data.checklist.map(
                  (item) => (
                    <ChecklistCard
                      key={item.key}
                      item={item}
                      onOpen={() =>
                        navigate(
                          item.route
                        )
                      }
                    />
                  )
                )}
              </div>
            </div>

            <div className="panel production-panel">
              <div className="production-panel-heading">
                <div>
                  <h3>
                    Daily closing report
                  </h3>

                  <p>
                    Use this before ending
                    today’s operations.
                  </p>
                </div>
              </div>

              <div className="closing-grid">
                <ClosingItem
                  label="Orders created"
                  value={
                    data.dailyClosing
                      .createdOrderCount
                  }
                />

                <ClosingItem
                  label="Orders delivered"
                  value={
                    data.dailyClosing
                      .deliveredOrderCount
                  }
                />

                <ClosingItem
                  label="Sales today"
                  value={formatCurrency(
                    data.dailyClosing
                      .salesTodayAmount
                  )}
                />

                <ClosingItem
                  label="Bottles sold"
                  value={
                    data.dailyClosing
                      .bottlesSoldToday
                  }
                />

                <ClosingItem
                  label="COD collected"
                  value={formatCurrency(
                    data.dailyClosing
                      .codCollectedToday
                  )}
                />

                <ClosingItem
                  label="Cash handed over"
                  value={formatCurrency(
                    data.dailyClosing
                      .cashHandedOverToday
                  )}
                />

                <ClosingItem
                  label="Pending COD"
                  value={formatCurrency(
                    data.dailyClosing
                      .pendingCodAmount
                  )}
                  warning={
                    data.dailyClosing
                      .pendingCodAmount > 0
                  }
                />

                <ClosingItem
                  label="Pending handover"
                  value={formatCurrency(
                    data.dailyClosing
                      .pendingHandoverAmount
                  )}
                  warning={
                    data.dailyClosing
                      .pendingHandoverAmount > 0
                  }
                />
              </div>
            </div>
          </section>

          <section className="production-grid-two">
            <OrderListPanel
              title="Orders needing confirmation"
              description="Confirm these first before starting prep."
              orders={
                data.ordersNeedingConfirmation
              }
              emptyText="No orders need confirmation."
              onOpenOrder={(order) =>
                navigate(
                  `/orders?search=${encodeURIComponent(
                    order.orderNumber
                  )}`
                )
              }
            />

            <OrderListPanel
              title="Failed refunds"
              description="Retry these refunds from Orders."
              orders={
                data.failedRefundOrders
              }
              emptyText="No failed refunds."
              danger
              onOpenOrder={(order) =>
                navigate(
                  `/orders?search=${encodeURIComponent(
                    order.orderNumber
                  )}`
                )
              }
            />
          </section>

          <section className="production-grid-two">
            <OrderListPanel
              title="Pending COD"
              description="Collect or reconcile pending COD payments."
              orders={
                data.pendingCodOrders
              }
              emptyText="No pending COD orders."
              onOpenOrder={(order) =>
                navigate(
                  `/orders?search=${encodeURIComponent(
                    order.orderNumber
                  )}`
                )
              }
            />

            <ProductsPanel
              products={
                data.lowStockProducts
              }
              onOpen={() =>
                navigate(
                  "/products"
                )
              }
            />
          </section>

          <section className="panel production-panel">
            <div className="production-panel-heading">
              <div>
                <h3>
                  Today’s delivery load
                </h3>

                <p>
                  Active orders scheduled for
                  selected date.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  navigate(
                    "/operations"
                  )
                }
              >
                Open operations
              </button>
            </div>

            {data.todaysOrders.length ===
            0 ? (
              <div className="production-empty">
                No active delivery orders for this date.
              </div>
            ) : (
              <div className="production-table">
                {data.todaysOrders.map(
                  (order) => (
                    <button
                      type="button"
                      key={order._id}
                      className="production-row"
                      onClick={() =>
                        navigate(
                          `/orders?search=${encodeURIComponent(
                            order.orderNumber
                          )}`
                        )
                      }
                    >
                      <div>
                        <strong>
                          {order.orderNumber}
                        </strong>

                        <span>
                          {order.customerName} ·{" "}
                          {order.deliverySlot ||
                            "Slot not selected"}
                        </span>
                      </div>

                      <div>
                        <strong>
                          {order.bottleCount} bottles
                        </strong>

                        <span>
                          {statusLabel(
                            order.orderStatus
                          )}
                        </span>
                      </div>

                      <b>
                        {formatCurrency(
                          order.total
                        )}
                      </b>
                    </button>
                  )
                )}
              </div>
            )}
          </section>

          <div className="production-generated">
            Last generated:{" "}
            {formatDate(
              data.generatedAt
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

function MetricCard({
  label,
  value,
  warning = false,
  danger = false,
}: {
  label: string;
  value: string | number;
  warning?: boolean;
  danger?: boolean;
}) {
  return (
    <article
      className={`production-metric-card ${
        danger
          ? "danger"
          : warning
            ? "warning"
            : ""
      }`}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function ChecklistCard({
  item,
  onOpen,
}: {
  item: ProductionChecklistItem;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className={`checklist-card checklist-${item.status}`}
      onClick={onOpen}
    >
      <div>
        <span>
          {statusLabel(item.status)}
        </span>

        <strong>
          {item.label}
        </strong>

        <p>
          {item.message}
        </p>
      </div>

      <b>
        {item.count}
      </b>
    </button>
  );
}

function ClosingItem({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: string | number;
  warning?: boolean;
}) {
  return (
    <div
      className={`closing-item ${
        warning ? "warning" : ""
      }`}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function OrderListPanel({
  title,
  description,
  orders,
  emptyText,
  danger = false,
  onOpenOrder,
}: {
  title: string;
  description: string;
  orders: ProductionControlOrderBrief[];
  emptyText: string;
  danger?: boolean;
  onOpenOrder: (
    order: ProductionControlOrderBrief
  ) => void;
}) {
  return (
    <section
      className={`panel production-panel ${
        danger ? "danger" : ""
      }`}
    >
      <div className="production-panel-heading">
        <div>
          <h3>{title}</h3>

          <p>{description}</p>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="production-empty">
          {emptyText}
        </div>
      ) : (
        <div className="production-table compact">
          {orders.map((order) => (
            <button
              type="button"
              key={order._id}
              className="production-row"
              onClick={() =>
                onOpenOrder(order)
              }
            >
              <div>
                <strong>
                  {order.orderNumber}
                </strong>

                <span>
                  {order.customerName} ·{" "}
                  {order.customerPhone ||
                    "No phone"}
                </span>
              </div>

              <div>
                <strong>
                  {formatCurrency(
                    order.total
                  )}
                </strong>

                <span>
                  {statusLabel(
                    order.orderStatus
                  )}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function ProductsPanel({
  products,
  onOpen,
}: {
  products: ProductionControlProduct[];
  onOpen: () => void;
}) {
  return (
    <section className="panel production-panel">
      <div className="production-panel-heading">
        <div>
          <h3>
            Low-stock products
          </h3>

          <p>
            Restock or disable unavailable
            products before launch.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpen}
        >
          Open products
        </button>
      </div>

      {products.length === 0 ? (
        <div className="production-empty">
          Stock levels are healthy.
        </div>
      ) : (
        <div className="product-risk-list">
          {products.map((product) => (
            <div
              key={product._id}
              className={`product-risk-card ${
                product.stockQuantity <= 0
                  ? "danger"
                  : ""
              }`}
            >
              <div>
                <strong>
                  {product.name}
                </strong>

                <span>
                  Threshold{" "}
                  {
                    product.lowStockThreshold
                  }
                </span>
              </div>

              <b>
                {product.stockQuantity}
              </b>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}