import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAdminAuth } from "../context/AuthContext";

import {
  fetchAdminProductionPlan,
  type AdminProductionPlan,
} from "../services/adminOrdersApi";

import "./productionPlan.css";

function getDateIdInIndia(
  offsetDays = 0
) {
  const now = new Date();

  now.setDate(
    now.getDate() + offsetDays
  );

  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(now);
}

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

function formatDateLabel(
  value: string
) {
  if (!value) {
    return "Selected date";
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    }
  ).format(
    new Date(`${value}T00:00:00+05:30`)
  );
}

function formatStatus(
  value: string
) {
  return value
    .split("_")
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1)
    )
    .join(" ");
}

export default function ProductionPlanPage() {
  const { token } =
    useAdminAuth();

  const [selectedDate, setSelectedDate] =
    useState(getDateIdInIndia(0));

  const [plan, setPlan] =
    useState<AdminProductionPlan | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(
      null
    );

  const loadPlan =
    useCallback(async () => {
      if (!token) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data =
          await fetchAdminProductionPlan(
            token,
            selectedDate
          );

        setPlan(data);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load production plan."
        );
      } finally {
        setLoading(false);
      }
    }, [token, selectedDate]);

  useEffect(() => {
    void loadPlan();
  }, [loadPlan]);

  const dateHeading =
    useMemo(
      () =>
        formatDateLabel(
          selectedDate
        ),
      [selectedDate]
    );

  const hasOrders =
    Boolean(
      plan &&
        plan.summary.orderCount > 0
    );

  return (
    <div className="production-plan-page">
      <div className="page-heading-row production-plan-heading">
        <div>
          <h2>
            Production & packing plan
          </h2>

          <p>
            Prepare bottle quantities, slot-wise batches and order-wise packing list for the selected delivery date.
          </p>
        </div>

        <div className="production-plan-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              setSelectedDate(
                getDateIdInIndia(0)
              )
            }
          >
            Today
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              setSelectedDate(
                getDateIdInIndia(1)
              )
            }
          >
            Tomorrow
          </button>

          <button
            type="button"
            className="primary-button"
            disabled={!hasOrders}
            onClick={() =>
              window.print()
            }
          >
            Print list
          </button>
        </div>
      </div>

      {error ? (
        <div className="inline-error">
          {error}
        </div>
      ) : null}

      <section className="panel production-date-panel">
        <div>
          <span className="production-eyebrow">
            DELIVERY DATE
          </span>

          <strong>
            {dateHeading}
          </strong>
        </div>

        <label>
          Select date
          <input
            type="date"
            value={selectedDate}
            onChange={(event) =>
              setSelectedDate(
                event.target.value
              )
            }
          />
        </label>

        <button
          type="button"
          className="secondary-button"
          disabled={loading}
          onClick={() => {
            void loadPlan();
          }}
        >
          {loading
            ? "Refreshing..."
            : "Refresh"}
        </button>
      </section>

      {loading && !plan ? (
        <section className="panel">
          <div className="page-state compact">
            <div className="spinner" />

            <p>
              Loading production plan
            </p>
          </div>
        </section>
      ) : !hasOrders ? (
        <section className="panel">
          <div className="page-state compact">
            <div className="state-icon">
              ▦
            </div>

            <h3>
              No bottles to prepare
            </h3>

            <p>
              No active orders were found for this delivery date.
            </p>
          </div>
        </section>
      ) : plan ? (
        <>
          <div className="production-summary-grid">
            <article className="production-summary-card">
              <span>
                Orders
              </span>

              <strong>
                {
                  plan.summary.orderCount
                }
              </strong>
            </article>

            <article className="production-summary-card">
              <span>
                Bottles to prepare
              </span>

              <strong>
                {
                  plan.summary.totalBottles
                }
              </strong>
            </article>

            <article className="production-summary-card">
              <span>
                Bottle types
              </span>

              <strong>
                {
                  plan.summary.productCount
                }
              </strong>
            </article>

            <article className="production-summary-card">
              <span>
                Order value
              </span>

              <strong>
                {formatCurrency(
                  plan.summary.totalValue
                )}
              </strong>
            </article>
          </div>

          <section className="panel production-section">
            <div className="production-section-header">
              <div>
                <h3>
                  Bottle-wise production
                </h3>

                <p>
                  Total quantity to prepare for each bottle.
                </p>
              </div>
            </div>

            <div className="production-table-wrapper">
              <table className="production-table">
                <thead>
                  <tr>
                    <th>Bottle</th>
                    <th>Size</th>
                    <th>Quantity</th>
                    <th>Value</th>
                  </tr>
                </thead>

                <tbody>
                  {plan.productTotals.map(
                    (item) => (
                      <tr
                        key={
                          item.productId
                        }
                      >
                        <td>
                          <strong>
                            {item.name}
                          </strong>

                          <span>
                            {item.productId}
                          </span>
                        </td>

                        <td>
                          {item.sizeMl} ml
                        </td>

                        <td>
                          <strong>
                            {
                              item.totalQuantity
                            }
                          </strong>
                        </td>

                        <td>
                          {formatCurrency(
                            item.totalValue
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel production-section">
            <div className="production-section-header">
              <div>
                <h3>
                  Slot-wise preparation
                </h3>

                <p>
                  Group production and packing by delivery slot.
                </p>
              </div>
            </div>

            <div className="slot-plan-grid">
              {plan.slotTotals.map(
                (slot) => (
                  <article
                    key={
                      slot.slotCode
                    }
                    className="slot-plan-card"
                  >
                    <span>
                      {
                        slot.slotLabel
                      }
                    </span>

                    <strong>
                      {
                        slot.totalBottles
                      }{" "}
                      bottles
                    </strong>

                    <small>
                      {
                        slot.orderCount
                      }{" "}
                      order
                      {slot.orderCount === 1
                        ? ""
                        : "s"}
                    </small>
                  </article>
                )
              )}
            </div>
          </section>

          <section className="panel production-section packing-print-section">
            <div className="production-section-header">
              <div>
                <h3>
                  Order-wise packing list
                </h3>

                <p>
                  Use this list while packing and dispatching bottles.
                </p>
              </div>

              <span className="print-date-label">
                {dateHeading}
              </span>
            </div>

            <div className="packing-order-list">
              {plan.orders.map(
                (order) => (
                  <article
                    key={order._id}
                    className="packing-order-card"
                  >
                    <div className="packing-order-header">
                      <div>
                        <strong>
                          {
                            order.orderNumber
                          }
                        </strong>

                        <span>
                          {
                            order.customerName
                          }{" "}
                          · +91{" "}
                          {
                            order.customerPhone
                          }
                        </span>
                      </div>

                      <div className="packing-slot-pill">
                        {
                          order.deliverySlot
                        }
                      </div>
                    </div>

                    <div className="packing-order-body">
                      <div className="packing-items">
                        {order.items.map(
                          (item) => (
                            <div
                              key={`${order._id}-${item.productId}`}
                              className="packing-item"
                            >
                              <span>
                                {
                                  item.quantity
                                }{" "}
                                ×{" "}
                                {
                                  item.name
                                }
                              </span>

                              <strong>
                                {
                                  item.sizeMl
                                }{" "}
                                ml
                              </strong>
                            </div>
                          )
                        )}
                      </div>

                      <div className="packing-address">
                        <span>
                          Address
                        </span>

                        <p>
                          {
                            order.addressLine
                          }
                        </p>
                      </div>
                    </div>

                    <div className="packing-order-footer">
                      <span>
                        {
                          order.totalBottles
                        }{" "}
                        bottle
                        {order.totalBottles === 1
                          ? ""
                          : "s"}
                      </span>

                      <span>
                        {
                          order.paymentMethod ===
                          "cod"
                            ? "COD"
                            : "Online"
                        }{" "}
                        ·{" "}
                        {
                          order.paymentStatus
                        }
                      </span>

                      <span>
                        {
                          formatStatus(
                            order.orderStatus
                          )
                        }
                      </span>

                      <strong>
                        {formatCurrency(
                          order.total
                        )}
                      </strong>
                    </div>
                  </article>
                )
              )}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}