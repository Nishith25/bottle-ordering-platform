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
  fetchAssignedDeliveryOrders,
  fetchDeliveryPerformance,
  updateDeliveryOrderStatus,
  verifyDeliveryOrderOtp,
  type DeliveryOrder,
  type DeliveryOrderStatusCounts,
  type DeliveryPerformance,
  type DeliveryPerformanceReview,
} from "../services/adminDeliveryApi";

import "./deliveryDashboard.css";

const EMPTY_COUNTS:
  DeliveryOrderStatusCounts = {
    assigned: 0,
    picked_up: 0,
    out_for_delivery: 0,
    delivered: 0,
  };

const EMPTY_PERFORMANCE:
  DeliveryPerformance = {
    totalAssigned: 0,
    activeDeliveries: 0,
    completedDeliveries: 0,
    reviewCount: 0,
    averageDeliveryRating: 0,
    fiveStarReviews: 0,
    completionRate: 0,
    recentReviews: [],
    recentDeliveries: [],
  };

const DELIVERY_LABELS = {
  unassigned: "Unassigned",
  assigned: "Assigned",
  picked_up: "Picked up",
  out_for_delivery:
    "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
} as const;

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

function formatDate(
  value?: string | null
) {
  if (!value) {
    return "Unavailable";
  }

  const parsedDate =
    new Date(value);

  if (
    Number.isNaN(
      parsedDate.getTime()
    )
  ) {
    return "Unavailable";
  }

  return parsedDate.toLocaleString(
    "en-IN",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }
  );
}

function getCustomerName(
  order: DeliveryOrder
) {
  if (
    order.user &&
    typeof order.user === "object"
  ) {
    return (
      order.user.fullName ||
      order.deliveryAddress.fullName
    );
  }

  return order.deliveryAddress.fullName;
}

function getReviewCustomerName(
  review:
    DeliveryPerformanceReview
) {
  if (
    review.user &&
    typeof review.user ===
      "object" &&
    review.user.fullName
  ) {
    return review.user.fullName;
  }

  return (
    review.customerSnapshot
      ?.fullName ||
    "Customer"
  );
}

export default function DeliveryDashboardPage() {
  const {
    token,
    user,
  } = useAdminAuth();

  const [
    orders,
    setOrders,
  ] = useState<
    DeliveryOrder[]
  >([]);

  const [
    statusCounts,
    setStatusCounts,
  ] =
    useState<DeliveryOrderStatusCounts>(
      EMPTY_COUNTS
    );

  const [
    performance,
    setPerformance,
  ] =
    useState<DeliveryPerformance>(
      EMPTY_PERFORMANCE
    );

  const [
    filter,
    setFilter,
  ] = useState("active");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    updatingOrderId,
    setUpdatingOrderId,
  ] = useState<
    string | null
  >(null);

  const [
    otpByOrder,
    setOtpByOrder,
  ] = useState<
    Record<string, string>
  >({});

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  const [
    success,
    setSuccess,
  ] = useState<
    string | null
  >(null);

  const loadDashboard =
    useCallback(async () => {
      if (!token) {
        setOrders([]);
        setStatusCounts(
          EMPTY_COUNTS
        );
        setPerformance(
          EMPTY_PERFORMANCE
        );
        setLoading(false);

        return;
      }

      setLoading(true);
      setError(null);

      try {
        const [
          orderResult,
          performanceResult,
        ] = await Promise.all([
          fetchAssignedDeliveryOrders(
            token
          ),

          fetchDeliveryPerformance(
            token
          ),
        ]);

        setOrders(
          orderResult.orders
        );

        setStatusCounts(
          orderResult.statusCounts
        );

        setPerformance(
          performanceResult
        );
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load the delivery dashboard."
        );
      } finally {
        setLoading(false);
      }
    }, [token]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const visibleOrders =
    useMemo(() => {
      if (filter === "all") {
        return orders;
      }

      if (
        filter === "active"
      ) {
        return orders.filter(
          (order) =>
            [
              "assigned",
              "picked_up",
              "out_for_delivery",
            ].includes(
              order.deliveryStatus
            )
        );
      }

      return orders.filter(
        (order) =>
          order.deliveryStatus ===
          filter
      );
    }, [orders, filter]);

  const updateLocalOrder = (
    updatedOrder:
      DeliveryOrder
  ) => {
    setOrders(
      (currentOrders) =>
        currentOrders.map(
          (order) =>
            order._id ===
            updatedOrder._id
              ? updatedOrder
              : order
        )
    );
  };

  const handleStatusChange =
    async (
      order: DeliveryOrder,

      nextStatus:
        | "picked_up"
        | "out_for_delivery"
    ) => {
      if (
        !token ||
        updatingOrderId
      ) {
        return;
      }

      setUpdatingOrderId(
        order._id
      );

      setError(null);
      setSuccess(null);

      try {
        const updatedOrder =
          await updateDeliveryOrderStatus(
            token,
            order._id,
            nextStatus
          );

        updateLocalOrder(
          updatedOrder
        );

        setSuccess(
          nextStatus ===
          "picked_up"
            ? `${order.orderNumber} marked as picked up.`
            : `${order.orderNumber} is now out for delivery.`
        );

        await loadDashboard();
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to update delivery status."
        );
      } finally {
        setUpdatingOrderId(
          null
        );
      }
    };

  const handleOtpVerification =
    async (
      order: DeliveryOrder
    ) => {
      if (
        !token ||
        updatingOrderId
      ) {
        return;
      }

      const otp = (
        otpByOrder[order._id] ||
        ""
      ).replace(/\D/g, "");

      if (otp.length !== 4) {
        setError(
          "Enter the customer's 4-digit delivery OTP."
        );

        return;
      }

      setUpdatingOrderId(
        order._id
      );

      setError(null);
      setSuccess(null);

      try {
        const updatedOrder =
          await verifyDeliveryOrderOtp(
            token,
            order._id,
            otp
          );

        updateLocalOrder(
          updatedOrder
        );

        setOtpByOrder(
          (currentValues) => ({
            ...currentValues,
            [order._id]: "",
          })
        );

        setSuccess(
          `${order.orderNumber} delivered successfully.`
        );

        await loadDashboard();
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to verify the delivery OTP."
        );
      } finally {
        setUpdatingOrderId(
          null
        );
      }
    };

  const ratingValue =
    performance.reviewCount > 0
      ? `${performance.averageDeliveryRating.toFixed(
          1
        )} ★`
      : "No ratings";

  return (
    <div className="delivery-dashboard-page">
      <section className="delivery-hero">
        <div>
          <span>
            GOOD DAY
          </span>

          <h1>
            {user?.fullName}
          </h1>

          <p>
            Complete only the deliveries
            assigned to your account. Ask
            the customer for the OTP only
            after reaching the delivery
            address.
          </p>

          <div className="delivery-hero-progress">
            <strong>
              {performance.completionRate.toFixed(
                1
              )}
              %
            </strong>

            <span>
              delivery completion rate
            </span>
          </div>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={() => {
            void loadDashboard();
          }}
        >
          {loading
            ? "Refreshing..."
            : "Refresh dashboard"}
        </button>
      </section>

      {error ? (
        <div className="delivery-alert delivery-error">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="delivery-alert delivery-success">
          {success}
        </div>
      ) : null}

      <section className="delivery-metric-grid">
        <Metric
          label="Active deliveries"
          value={
            performance.activeDeliveries
          }
        />

        <Metric
          label="Assigned"
          value={
            statusCounts.assigned
          }
        />

        <Metric
          label="Picked up"
          value={
            statusCounts.picked_up
          }
        />

        <Metric
          label="Out for delivery"
          value={
            statusCounts.out_for_delivery
          }
        />

        <Metric
          label="Completed"
          value={
            performance.completedDeliveries
          }
        />

        <Metric
          label="Average rating"
          value={ratingValue}
        />

        <Metric
          label="Customer reviews"
          value={
            performance.reviewCount
          }
        />

        <Metric
          label="Five-star reviews"
          value={
            performance.fiveStarReviews
          }
        />
      </section>

      <section className="delivery-performance-grid">
        <div className="delivery-feedback-panel">
          <div className="delivery-section-heading">
            <div>
              <span>
                CUSTOMER FEEDBACK
              </span>

              <h2>
                Recent reviews
              </h2>
            </div>

            <strong>
              {
                performance.reviewCount
              }{" "}
              total
            </strong>
          </div>

          {performance
            .recentReviews.length ===
          0 ? (
            <div className="delivery-mini-empty">
              <span>★</span>

              <p>
                Customer feedback will
                appear after completed
                orders are reviewed.
              </p>
            </div>
          ) : (
            <div className="delivery-feedback-list">
              {performance.recentReviews.map(
                (review) => (
                  <article
                    key={
                      review._id
                    }
                    className="delivery-feedback-card"
                  >
                    <div className="delivery-feedback-top">
                      <div>
                        <strong>
                          {getReviewCustomerName(
                            review
                          )}
                        </strong>

                        <span>
                          {
                            review.orderNumber
                          }
                        </span>
                      </div>

                      <StarDisplay
                        value={
                          review.deliveryRating
                        }
                      />
                    </div>

                    <p>
                      {review.comment ||
                        "The customer submitted a rating without a written comment."}
                    </p>

                    <small>
                      {formatDate(
                        review.submittedAt ||
                          review.createdAt
                      )}
                    </small>
                  </article>
                )
              )}
            </div>
          )}
        </div>

        <div className="delivery-history-panel">
          <div className="delivery-section-heading">
            <div>
              <span>
                DELIVERY HISTORY
              </span>

              <h2>
                Recently completed
              </h2>
            </div>

            <strong>
              {
                performance.completedDeliveries
              }{" "}
              completed
            </strong>
          </div>

          {performance
            .recentDeliveries.length ===
          0 ? (
            <div className="delivery-mini-empty">
              <span>✓</span>

              <p>
                Completed deliveries
                will appear here.
              </p>
            </div>
          ) : (
            <div className="delivery-history-list">
              {performance.recentDeliveries.map(
                (order) => (
                  <article
                    key={
                      order._id
                    }
                    className="delivery-history-row"
                  >
                    <div>
                      <strong>
                        {
                          order.orderNumber
                        }
                      </strong>

                      <span>
                        {getCustomerName(
                          order
                        )}
                      </span>
                    </div>

                    <div>
                      <strong>
                        {formatCurrency(
                          order.total
                        )}
                      </strong>

                      <span>
                        {formatDate(
                          order.deliveryCompletedAt ||
                            order.deliveredAt
                        )}
                      </span>
                    </div>
                  </article>
                )
              )}
            </div>
          )}
        </div>
      </section>

      <section className="delivery-orders-heading">
        <div>
          <span>
            ASSIGNED ORDERS
          </span>

          <h2>
            Delivery operations
          </h2>
        </div>

        <strong>
          {
            visibleOrders.length
          }{" "}
          shown
        </strong>
      </section>

      <section className="delivery-filter-row">
        {[
          [
            "active",
            "Active",
          ],

          [
            "assigned",
            "Assigned",
          ],

          [
            "picked_up",
            "Picked up",
          ],

          [
            "out_for_delivery",
            "Out for delivery",
          ],

          [
            "delivered",
            "Delivered",
          ],

          [
            "all",
            "All",
          ],
        ].map(
          ([value, label]) => (
            <button
              key={value}
              type="button"
              className={
                filter === value
                  ? "delivery-filter-active"
                  : ""
              }
              onClick={() =>
                setFilter(value)
              }
            >
              {label}
            </button>
          )
        )}
      </section>

      {loading &&
      orders.length === 0 ? (
        <div className="delivery-empty-state">
          <div className="spinner" />

          <p>
            Loading assigned deliveries
          </p>
        </div>
      ) : visibleOrders.length ===
        0 ? (
        <div className="delivery-empty-state">
          <div className="delivery-empty-icon">
            ✓
          </div>

          <h2>
            No deliveries here
          </h2>

          <p>
            There are no orders matching
            this delivery filter.
          </p>
        </div>
      ) : (
        <section className="delivery-order-list">
          {visibleOrders.map(
            (order) => {
              const customer =
                order.user &&
                typeof order.user ===
                  "object"
                  ? order.user
                  : null;

              return (
                <article
                  key={order._id}
                  className="delivery-order-card"
                >
                  <div className="delivery-order-heading">
                    <div>
                      <div className="delivery-number-row">
                        <strong>
                          {
                            order.orderNumber
                          }
                        </strong>

                        <span
                          className={`delivery-status status-${order.deliveryStatus}`}
                        >
                          {
                            DELIVERY_LABELS[
                              order
                                .deliveryStatus
                            ]
                          }
                        </span>
                      </div>

                      <span>
                        {formatDate(
                          order.createdAt
                        )}
                      </span>
                    </div>

                    <strong className="delivery-order-total">
                      {formatCurrency(
                        order.total
                      )}
                    </strong>
                  </div>

                  <div className="delivery-info-grid">
                    <div>
                      <span>
                        Customer
                      </span>

                      <strong>
                        {customer?.fullName ??
                          order
                            .deliveryAddress
                            .fullName}
                      </strong>

                      <p>
                        +91{" "}
                        {customer?.phone ??
                          order
                            .deliveryAddress
                            .phone}
                      </p>
                    </div>

                    <div>
                      <span>
                        Delivery time
                      </span>

                      <strong>
                        {
                          order
                            .deliverySchedule
                            .deliveryDateLabel
                        }
                      </strong>

                      <p>
                        {
                          order
                            .deliverySchedule
                            .deliverySlot
                        }
                      </p>
                    </div>

                    <div>
                      <span>
                        Payment
                      </span>

                      <strong>
                        {order.paymentMethod ===
                        "cod"
                          ? "Collect cash"
                          : "Paid online"}
                      </strong>

                      <p>
                        {formatCurrency(
                          order.total
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="delivery-address-block">
                    <span>
                      Complete address
                    </span>

                    <p>
                      {
                        order
                          .deliveryAddress
                          .houseDetails
                      }
                      ,{" "}
                      {
                        order
                          .deliveryAddress
                          .areaDetails
                      }
                      {order
                        .deliveryAddress
                        .landmark
                        ? `, near ${order.deliveryAddress.landmark}`
                        : ""}
                      ,{" "}
                      {
                        order
                          .deliveryAddress
                          .area
                      }
                      ,{" "}
                      {
                        order
                          .deliveryAddress
                          .city
                      }{" "}
                      –{" "}
                      {
                        order
                          .deliveryAddress
                          .pincode
                      }
                    </p>
                  </div>

                  <div className="delivery-items-block">
                    <span>
                      Order items
                    </span>

                    {order.items.map(
                      (item) => (
                        <div
                          key={
                            item.productId
                          }
                        >
                          <p>
                            {
                              item.quantity
                            }{" "}
                            ×{" "}
                            {item.name}
                          </p>

                          <strong>
                            {formatCurrency(
                              item.lineTotal
                            )}
                          </strong>
                        </div>
                      )
                    )}
                  </div>

                  <div className="delivery-action-block">
                    {order.deliveryStatus ===
                    "assigned" ? (
                      <button
                        type="button"
                        disabled={
                          updatingOrderId ===
                          order._id
                        }
                        onClick={() => {
                          void handleStatusChange(
                            order,
                            "picked_up"
                          );
                        }}
                      >
                        {updatingOrderId ===
                        order._id
                          ? "Updating..."
                          : "Mark as picked up"}
                      </button>
                    ) : null}

                    {order.deliveryStatus ===
                    "picked_up" ? (
                      <button
                        type="button"
                        disabled={
                          updatingOrderId ===
                          order._id
                        }
                        onClick={() => {
                          void handleStatusChange(
                            order,
                            "out_for_delivery"
                          );
                        }}
                      >
                        {updatingOrderId ===
                        order._id
                          ? "Updating..."
                          : "Start delivery"}
                      </button>
                    ) : null}

                    {order.deliveryStatus ===
                    "out_for_delivery" ? (
                      <div className="delivery-otp-form">
                        <div>
                          <span>
                            Customer delivery
                            OTP
                          </span>

                          <p>
                            Ask the customer
                            for the four-digit
                            code shown in their
                            app.
                          </p>
                        </div>

                        <input
                          inputMode="numeric"
                          maxLength={4}
                          value={
                            otpByOrder[
                              order._id
                            ] || ""
                          }
                          onChange={(
                            event
                          ) =>
                            setOtpByOrder(
                              (
                                currentValues
                              ) => ({
                                ...currentValues,

                                [order._id]:
                                  event.target.value
                                    .replace(
                                      /\D/g,
                                      ""
                                    )
                                    .slice(
                                      0,
                                      4
                                    ),
                              })
                            )
                          }
                          placeholder="0000"
                        />

                        <button
                          type="button"
                          disabled={
                            updatingOrderId ===
                            order._id
                          }
                          onClick={() => {
                            void handleOtpVerification(
                              order
                            );
                          }}
                        >
                          {updatingOrderId ===
                          order._id
                            ? "Verifying..."
                            : "Verify OTP and deliver"}
                        </button>
                      </div>
                    ) : null}

                    {order.deliveryStatus ===
                    "delivered" ? (
                      <div className="delivery-complete-message">
                        Delivery completed
                        successfully.
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            }
          )}
        </section>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="delivery-metric-card">
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}

function StarDisplay({
  value,
}: {
  value: number;
}) {
  return (
    <div
      className="delivery-star-display"
      aria-label={`${value} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map(
        (star) => (
          <span
            key={star}
            className={
              star <= value
                ? "delivery-star-filled"
                : "delivery-star-empty"
            }
          >
            ★
          </span>
        )
      )}
    </div>
  );
}