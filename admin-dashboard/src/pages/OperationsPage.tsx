import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useAdminAuth,
} from "../context/AuthContext";

import {
  fetchAdminOperationsReport,
  markCashCollectionHandedOver,
  markOrderCodCollected,
  type AdminOperationsOrder,
  type AdminOperationsReport,
} from "../services/adminOperationsApi";

import "./operations.css";

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
  ).format(
    Number(value || 0)
  );
}

function formatDateLabel(value: string) {
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

function formatDateTime(value?: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  ).format(new Date(value));
}

function getBottleCount(
  order: AdminOperationsOrder
) {
  return order.items.reduce(
    (total, item) =>
      total +
      Number(item.quantity || 0),
    0
  );
}

export default function OperationsPage() {
  const { token } =
    useAdminAuth();

  const [selectedDate, setSelectedDate] =
    useState(getDateIdInIndia(0));

  const [report, setReport] =
    useState<AdminOperationsReport | null>(
      null
    );

  const [selectedOrderIds, setSelectedOrderIds] =
    useState<string[]>([]);

  const [amountInputs, setAmountInputs] =
    useState<Record<string, string>>({});

  const [noteInputs, setNoteInputs] =
    useState<Record<string, string>>({});

  const [loading, setLoading] =
    useState(true);

  const [savingOrderId, setSavingOrderId] =
    useState<string | null>(
      null
    );

  const [error, setError] =
    useState<string | null>(
      null
    );

  const [success, setSuccess] =
    useState<string | null>(
      null
    );

  const loadReport =
    useCallback(async () => {
      if (!token) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data =
          await fetchAdminOperationsReport(
            token,
            {
              date:
                selectedDate,
            }
          );

        setReport(data);

        setSelectedOrderIds(
          data.orders.map(
            (order) => order._id
          )
        );

        setAmountInputs(
          Object.fromEntries(
            data.orders.map(
              (order) => [
                order._id,
                String(
                  order.cashCollection
                    ?.amountCollected ||
                    order.total ||
                    0
                ),
              ]
            )
          )
        );
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load operations report."
        );
      } finally {
        setLoading(false);
      }
    }, [
      token,
      selectedDate,
    ]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const orders =
    report?.orders || [];

  const selectedOrders =
    useMemo(() => {
      const selectedSet =
        new Set(selectedOrderIds);

      return orders.filter(
        (order) =>
          selectedSet.has(order._id)
      );
    }, [
      orders,
      selectedOrderIds,
    ]);

  const toggleOrderSelection =
    (orderId: string) => {
      setSelectedOrderIds(
        (current) =>
          current.includes(orderId)
            ? current.filter(
                (id) => id !== orderId
              )
            : [
                ...current,
                orderId,
              ]
      );
    };

  const selectAll =
    () => {
      setSelectedOrderIds(
        orders.map(
          (order) => order._id
        )
      );
    };

  const clearSelection =
    () => {
      setSelectedOrderIds([]);
    };

  const handleMarkCollected =
    async (
      order: AdminOperationsOrder
    ) => {
      if (!token) {
        return;
      }

      const amount =
        Number(
          amountInputs[order._id]
        );

      if (
        !Number.isFinite(amount) ||
        amount < 0
      ) {
        setError(
          "Please enter a valid collected amount."
        );
        return;
      }

      setSavingOrderId(order._id);
      setError(null);
      setSuccess(null);

      try {
        await markOrderCodCollected(
          token,
          order._id,
          {
            amountCollected:
              amount,

            notes:
              noteInputs[
                order._id
              ]?.trim() ||
              "",
          }
        );

        setSuccess(
          `${order.orderNumber} COD collection updated.`
        );

        await loadReport();
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to update COD collection."
        );
      } finally {
        setSavingOrderId(null);
      }
    };

  const handleHandover =
    async (
      order: AdminOperationsOrder
    ) => {
      if (
        !token ||
        !order.cashCollection
      ) {
        return;
      }

      setSavingOrderId(order._id);
      setError(null);
      setSuccess(null);

      try {
        await markCashCollectionHandedOver(
          token,
          order.cashCollection._id,
          {
            notes:
              noteInputs[
                order._id
              ]?.trim() ||
              "",
          }
        );

        setSuccess(
          `${order.orderNumber} cash marked as handed over.`
        );

        await loadReport();
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to mark cash as handed over."
        );
      } finally {
        setSavingOrderId(null);
      }
    };

  return (
    <div className="operations-page">
      <div className="page-heading-row operations-heading">
        <div>
          <h2>
            Operations
          </h2>

          <p>
            Print packing slips, track COD collection and manage daily cash handover.
          </p>
        </div>

        <div className="operations-heading-actions">
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
            disabled={
              selectedOrders.length ===
              0
            }
            onClick={() =>
              window.print()
            }
          >
            Print packing slips
          </button>
        </div>
      </div>

      {error ? (
        <div className="inline-error">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="inline-success">
          {success}
        </div>
      ) : null}

      <section className="panel operations-filter-panel">
        <div>
          <span className="operations-eyebrow">
            OPERATIONS DATE
          </span>

          <strong>
            {formatDateLabel(
              selectedDate
            )}
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
            void loadReport();
          }}
        >
          {loading
            ? "Refreshing..."
            : "Refresh"}
        </button>
      </section>

      {loading && !report ? (
        <section className="panel">
          <div className="page-state compact">
            <div className="spinner" />

            <p>
              Loading operations
            </p>
          </div>
        </section>
      ) : !report ? null : (
        <>
          <div className="operations-summary-grid">
            <article className="operations-summary-card">
              <span>
                Orders
              </span>

              <strong>
                {
                  report.summary
                    .orderCount
                }
              </strong>
            </article>

            <article className="operations-summary-card">
              <span>
                Bottles
              </span>

              <strong>
                {
                  report.summary
                    .bottleCount
                }
              </strong>
            </article>

            <article className="operations-summary-card">
              <span>
                COD pending
              </span>

              <strong>
                {formatCurrency(
                  report.summary
                    .codPendingAmount
                )}
              </strong>
            </article>

            <article className="operations-summary-card">
              <span>
                COD collected
              </span>

              <strong>
                {formatCurrency(
                  report.summary
                    .codCollectedAmount
                )}
              </strong>
            </article>
          </div>

          <section className="panel operations-list-panel">
            <div className="operations-section-header">
              <div>
                <h3>
                  Daily orders
                </h3>

                <p>
                  Select orders for packing slip print and update COD collection.
                </p>
              </div>

              <div className="operations-selection-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={selectAll}
                >
                  Select all
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={
                    clearSelection
                  }
                >
                  Clear
                </button>
              </div>
            </div>

            {orders.length === 0 ? (
              <div className="page-state compact">
                <div className="state-icon">
                  ▤
                </div>

                <h3>
                  No orders found
                </h3>

                <p>
                  Orders for this delivery date will appear here.
                </p>
              </div>
            ) : (
              <div className="operations-order-list">
                {orders.map(
                  (order) => {
                    const isCod =
                      order.paymentMethod !==
                      "online";

                    const collectionStatus =
                      order.cashCollection
                        ?.status ||
                      "pending";

                    return (
                      <article
                        key={order._id}
                        className="operations-order-card"
                      >
                        <div className="operations-order-header">
                          <label className="operations-check">
                            <input
                              type="checkbox"
                              checked={selectedOrderIds.includes(
                                order._id
                              )}
                              onChange={() =>
                                toggleOrderSelection(
                                  order._id
                                )
                              }
                            />

                            <span>
                              {
                                order.orderNumber
                              }
                            </span>
                          </label>

                          <div className="operations-status-row">
                            <span>
                              {
                                order.orderStatus
                              }
                            </span>

                            <span>
                              {
                                order.paymentMethod
                              }{" "}
                              · {
                                order.paymentStatus
                              }
                            </span>

                            {isCod ? (
                              <span>
                                COD:{" "}
                                {
                                  collectionStatus
                                }
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="operations-order-grid">
                          <div>
                            <span>
                              Customer
                            </span>

                            <strong>
                              {
                                order.customerName
                              }
                            </strong>

                            <small>
                              {
                                order.customerPhone ||
                                "No phone"
                              }
                            </small>
                          </div>

                          <div>
                            <span>
                              Slot
                            </span>

                            <strong>
                              {
                                order.deliverySlotLabel
                              }
                            </strong>

                            <small>
                              {
                                order.deliveryPartnerName
                              }
                            </small>
                          </div>

                          <div>
                            <span>
                              Bottles
                            </span>

                            <strong>
                              {getBottleCount(
                                order
                              )}
                            </strong>

                            <small>
                              {
                                order.items.length
                              }{" "}
                              item types
                            </small>
                          </div>

                          <div>
                            <span>
                              Total
                            </span>

                            <strong>
                              {formatCurrency(
                                order.total
                              )}
                            </strong>

                            <small>
                              {
                                order.paymentMethod
                              }
                            </small>
                          </div>
                        </div>

                        <div className="operations-items-list">
                          {order.items.map(
                            (
                              item,
                              index
                            ) => (
                              <div
                                key={`${item.productId}-${index}`}
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
                                  {formatCurrency(
                                    item.lineTotal
                                  )}
                                </strong>
                              </div>
                            )
                          )}
                        </div>

                        {order.address ? (
                          <p className="operations-address">
                            {
                              order.address
                            }
                          </p>
                        ) : null}

                        {isCod ? (
                          <div className="cod-action-panel">
                            <label>
                              Amount collected
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={
                                  amountInputs[
                                    order._id
                                  ] ??
                                  String(
                                    order.total
                                  )
                                }
                                onChange={(
                                  event
                                ) =>
                                  setAmountInputs(
                                    (
                                      current
                                    ) => ({
                                      ...current,

                                      [order._id]:
                                        event
                                          .target
                                          .value,
                                    })
                                  )
                                }
                              />
                            </label>

                            <label>
                              Note
                              <input
                                type="text"
                                value={
                                  noteInputs[
                                    order._id
                                  ] || ""
                                }
                                onChange={(
                                  event
                                ) =>
                                  setNoteInputs(
                                    (
                                      current
                                    ) => ({
                                      ...current,

                                      [order._id]:
                                        event
                                          .target
                                          .value,
                                    })
                                  )
                                }
                                placeholder="Optional"
                              />
                            </label>

                            <button
                              type="button"
                              className="primary-button"
                              disabled={
                                savingOrderId ===
                                order._id
                              }
                              onClick={() =>
                                handleMarkCollected(
                                  order
                                )
                              }
                            >
                              {savingOrderId ===
                              order._id
                                ? "Saving..."
                                : "Mark collected"}
                            </button>

                            <button
                              type="button"
                              className="secondary-button"
                              disabled={
                                !order.cashCollection ||
                                ![
                                  "collected",
                                  "short_collected",
                                ].includes(
                                  order
                                    .cashCollection
                                    .status
                                ) ||
                                savingOrderId ===
                                  order._id
                              }
                              onClick={() =>
                                handleHandover(
                                  order
                                )
                              }
                            >
                              Mark handed over
                            </button>
                          </div>
                        ) : null}

                        {order.cashCollection ? (
                          <div className="cash-record-note">
                            <strong>
                              Cash record:
                            </strong>{" "}
                            {
                              order.cashCollection
                                .status
                            }{" "}
                            · collected{" "}
                            {formatCurrency(
                              order.cashCollection
                                .amountCollected
                            )}
                            {" · "}
                            {formatDateTime(
                              order.cashCollection
                                .collectedAt
                            )}
                          </div>
                        ) : null}
                      </article>
                    );
                  }
                )}
              </div>
            )}
          </section>

          <section className="packing-slip-print-area">
            {selectedOrders.map(
              (order) => (
                <article
                  key={order._id}
                  className="packing-slip-card"
                >
                  <div className="packing-slip-header">
                    <div>
                      <h2>
                        Packing Slip
                      </h2>

                      <strong>
                        {
                          order.orderNumber
                        }
                      </strong>
                    </div>

                    <div>
                      <span>
                        {
                          order.paymentMethod
                        }
                      </span>

                      <strong>
                        {formatCurrency(
                          order.total
                        )}
                      </strong>
                    </div>
                  </div>

                  <div className="packing-slip-info">
                    <div>
                      <span>
                        Customer
                      </span>

                      <strong>
                        {
                          order.customerName
                        }
                      </strong>

                      <p>
                        {
                          order.customerPhone
                        }
                      </p>
                    </div>

                    <div>
                      <span>
                        Delivery
                      </span>

                      <strong>
                        {
                          order.deliverySlotLabel
                        }
                      </strong>

                      <p>
                        {
                          order.deliveryPartnerName
                        }
                      </p>
                    </div>
                  </div>

                  <p className="packing-slip-address">
                    {order.address ||
                      "No address added"}
                  </p>

                  <table className="packing-slip-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Qty</th>
                      </tr>
                    </thead>

                    <tbody>
                      {order.items.map(
                        (
                          item,
                          index
                        ) => (
                          <tr
                            key={`${item.productId}-${index}`}
                          >
                            <td>
                              {
                                item.name
                              }{" "}
                              {
                                item.sizeMl
                                  ? `(${item.sizeMl} ml)`
                                  : ""
                              }
                            </td>

                            <td>
                              {
                                item.quantity
                              }
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>

                  <div className="packing-slip-footer">
                    <span>
                      Total bottles:{" "}
                      {getBottleCount(
                        order
                      )}
                    </span>

                    <span>
                      Keep refrigerated 0–4°C
                    </span>
                  </div>
                </article>
              )
            )}
          </section>
        </>
      )}
    </div>
  );
}