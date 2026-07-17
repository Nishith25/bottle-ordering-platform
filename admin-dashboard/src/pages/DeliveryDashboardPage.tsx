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
  fetchDeliveryCashSummary,
  fetchDeliveryPerformance,
  reportFailedDelivery,
  saveDeliveryOrderNote,
  updateDeliveryOrderStatus,
  verifyDeliveryOrderOtp,
  type DeliveryCashSummary,
  type DeliveryFailureReason,
  type DeliveryOrder,
  type DeliveryOrderStatusCounts,
  type DeliveryPerformance,
  type DeliveryPerformanceReview,
} from "../services/adminDeliveryApi";

import "./deliveryDashboard.css";

const CUSTOMER_APP_URL = (
  import.meta.env.VITE_CUSTOMER_APP_URL ??
  "https://sipbite-customer-tan.vercel.app"
).replace(/\/$/, "");

const EMPTY_COUNTS:
  DeliveryOrderStatusCounts = {
    assigned: 0,
    picked_up: 0,
    out_for_delivery: 0,
    delivered: 0,
    failed_attempts: 0,
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

const EMPTY_CASH_SUMMARY:
  DeliveryCashSummary = {
    dateId: "",
    activeOrderCount: 0,
    activeBottleCount: 0,
    pendingCodOrderCount: 0,
    pendingCodAmount: 0,
    collectedTodayOrderCount: 0,
    collectedTodayAmount: 0,
    deliveredTodayOrderCount: 0,
    deliveredBottleCountToday: 0,
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

const FAILURE_REASONS: Array<{
  value: DeliveryFailureReason;
  label: string;
}> = [
  {
    value:
      "customer_not_available",
    label:
      "Customer not available",
  },
  {
    value:
      "customer_no_response",
    label:
      "No response",
  },
  {
    value:
      "wrong_address",
    label:
      "Wrong address",
  },
  {
    value:
      "payment_issue",
    label:
      "Payment issue",
  },
  {
    value:
      "otp_issue",
    label:
      "OTP issue",
  },
  {
    value:
      "customer_requested_later",
    label:
      "Requested later",
  },
  {
    value:
      "vehicle_issue",
    label:
      "Vehicle issue",
  },
  {
    value:
      "other",
    label:
      "Other",
  },
];

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

function cleanIndianPhone(value?: string | null) {
  const digits =
    String(value || "").replace(
      /\D/g,
      ""
    );

  if (digits.length >= 10) {
    return digits.slice(-10);
  }

  return digits;
}

function getCustomerName(order: DeliveryOrder) {
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

function getCustomerPhone(order: DeliveryOrder) {
  if (
    order.user &&
    typeof order.user === "object" &&
    order.user.phone
  ) {
    return order.user.phone;
  }

  return order.deliveryAddress.phone;
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

function getFullAddress(order: DeliveryOrder) {
  const address =
    order.deliveryAddress;

  return [
    address.houseDetails,
    address.areaDetails,
    address.landmark
      ? `near ${address.landmark}`
      : "",
    address.area,
    address.city,
    address.pincode,
  ]
    .filter(Boolean)
    .join(", ");
}

function getFailureReasonLabel(value?: string) {
  return (
    FAILURE_REASONS.find(
      (reason) =>
        reason.value === value
    )?.label ||
    "Failed delivery"
  );
}

function buildDeliverySummary(order: DeliveryOrder) {
  return [
    `Order: ${order.orderNumber}`,
    `Customer: ${getCustomerName(order)}`,
    `Phone: +91 ${getCustomerPhone(order)}`,
    `Status: ${DELIVERY_LABELS[order.deliveryStatus]}`,
    `Payment: ${
      order.paymentMethod === "cod"
        ? "Collect cash"
        : "Paid online"
    }`,
    `Amount: ${formatCurrency(order.total)}`,
    `Delivery: ${order.deliverySchedule.deliveryDateLabel} · ${order.deliverySchedule.deliverySlot}`,
    `Address: ${getFullAddress(order)}`,
    `Items: ${order.items
      .map(
        (item) =>
          `${item.quantity} x ${item.name}`
      )
      .join(", ")}`,
  ].join("\n");
}

function openCall(phone: string) {
  const cleanPhone =
    cleanIndianPhone(phone);

  if (!cleanPhone) {
    return;
  }

  window.location.href =
    `tel:+91${cleanPhone}`;
}

function openWhatsApp(
  phone: string,
  message: string
) {
  const cleanPhone =
    cleanIndianPhone(phone);

  if (!cleanPhone) {
    return;
  }

  window.open(
    `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(
      message
    )}`,
    "_blank",
    "noopener,noreferrer"
  );
}

function openMaps(address: string) {
  if (!address.trim()) {
    return;
  }

  window.open(
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      address
    )}`,
    "_blank",
    "noopener,noreferrer"
  );
}

function openCustomerMode() {
  window.open(
    CUSTOMER_APP_URL,
    "_blank",
    "noopener,noreferrer"
  );
}

async function copyText(text: string) {
  if (
    navigator.clipboard &&
    navigator.clipboard.writeText
  ) {
    await navigator.clipboard.writeText(
      text
    );
    return;
  }

  const textarea =
    document.createElement("textarea");

  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export default function DeliveryDashboardPage() {
  const {
    token,
    user,
  } = useAdminAuth();

  const [
    orders,
    setOrders,
  ] = useState<DeliveryOrder[]>([]);

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
    cashSummary,
    setCashSummary,
  ] =
    useState<DeliveryCashSummary>(
      EMPTY_CASH_SUMMARY
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
  ] = useState<string | null>(null);

  const [
    savingNoteOrderId,
    setSavingNoteOrderId,
  ] = useState<string | null>(null);

  const [
    otpByOrder,
    setOtpByOrder,
  ] = useState<Record<string, string>>({});

  const [
    noteByOrder,
    setNoteByOrder,
  ] = useState<Record<string, string>>({});

  const [
    codCollectedByOrder,
    setCodCollectedByOrder,
  ] = useState<Record<string, boolean>>({});

  const [
    codAmountByOrder,
    setCodAmountByOrder,
  ] = useState<Record<string, string>>({});

  const [
    failureReasonByOrder,
    setFailureReasonByOrder,
  ] =
    useState<Record<string, DeliveryFailureReason>>({});

  const [
    failureNoteByOrder,
    setFailureNoteByOrder,
  ] = useState<Record<string, string>>({});

  const [
    copiedOrderId,
    setCopiedOrderId,
  ] = useState<string | null>(null);

  const [
    error,
    setError,
  ] = useState<string | null>(null);

  const [
    success,
    setSuccess,
  ] = useState<string | null>(null);

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
        setCashSummary(
          EMPTY_CASH_SUMMARY
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
          cashSummaryResult,
        ] = await Promise.all([
          fetchAssignedDeliveryOrders(
            token
          ),

          fetchDeliveryPerformance(
            token
          ),

          fetchDeliveryCashSummary(
            token
          ),
        ]);

        setOrders(
          orderResult.orders
        );

        setStatusCounts({
          ...EMPTY_COUNTS,
          ...orderResult.statusCounts,
        });

        setPerformance(
          performanceResult
        );

        setCashSummary(
          cashSummaryResult
        );

        setNoteByOrder(
          (currentValues) => {
            const next = {
              ...currentValues,
            };

            for (const order of orderResult.orders) {
              if (
                next[order._id] ===
                undefined
              ) {
                next[order._id] =
                  order.deliveryPartnerNote || "";
              }
            }

            return next;
          }
        );

        setCodAmountByOrder(
          (currentValues) => {
            const next = {
              ...currentValues,
            };

            for (const order of orderResult.orders) {
              if (
                next[order._id] ===
                undefined
              ) {
                next[order._id] =
                  String(order.total || "");
              }
            }

            return next;
          }
        );

        setFailureReasonByOrder(
          (currentValues) => {
            const next = {
              ...currentValues,
            };

            for (const order of orderResult.orders) {
              if (
                next[order._id] ===
                undefined
              ) {
                next[order._id] =
                  "customer_not_available";
              }
            }

            return next;
          }
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

      if (filter === "active") {
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

      if (filter === "failed") {
        return orders.filter(
          (order) =>
            order.lastDeliveryAttemptStatus ===
            "failed"
        );
      }

      return orders.filter(
        (order) =>
          order.deliveryStatus ===
          filter
      );
    }, [orders, filter]);

  const updateLocalOrder =
    (updatedOrder: DeliveryOrder) => {
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

      setNoteByOrder(
        (currentValues) => ({
          ...currentValues,
          [updatedOrder._id]:
            updatedOrder.deliveryPartnerNote || "",
        })
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
          nextStatus === "picked_up"
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

  const handleSaveNote =
    async (order: DeliveryOrder) => {
      if (
        !token ||
        savingNoteOrderId
      ) {
        return;
      }

      setSavingNoteOrderId(
        order._id
      );

      setError(null);
      setSuccess(null);

      try {
        const updatedOrder =
          await saveDeliveryOrderNote(
            token,
            order._id,
            noteByOrder[order._id] || ""
          );

        updateLocalOrder(
          updatedOrder
        );

        setSuccess(
          `${order.orderNumber} delivery note saved.`
        );
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to save delivery note."
        );
      } finally {
        setSavingNoteOrderId(null);
      }
    };

  const handleReportFailure =
    async (order: DeliveryOrder) => {
      if (
        !token ||
        updatingOrderId
      ) {
        return;
      }

      const reason =
        failureReasonByOrder[order._id] ||
        "customer_not_available";

      const notes =
        failureNoteByOrder[order._id] || "";

      const confirmed =
        window.confirm(
          `Mark ${order.orderNumber} as failed delivery? The order will go back to assigned status for retry.`
        );

      if (!confirmed) {
        return;
      }

      setUpdatingOrderId(
        order._id
      );

      setError(null);
      setSuccess(null);

      try {
        const updatedOrder =
          await reportFailedDelivery(
            token,
            order._id,
            {
              reason,
              notes,
            }
          );

        updateLocalOrder(
          updatedOrder
        );

        setFailureNoteByOrder(
          (currentValues) => ({
            ...currentValues,
            [order._id]: "",
          })
        );

        setSuccess(
          `${order.orderNumber} failed delivery recorded.`
        );

        await loadDashboard();
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to report failed delivery."
        );
      } finally {
        setUpdatingOrderId(null);
      }
    };

  const handleOtpVerification =
    async (order: DeliveryOrder) => {
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

      const isCod =
        order.paymentMethod === "cod";

      const codConfirmed =
        codCollectedByOrder[order._id] === true;

      const codAmount =
        Number(
          codAmountByOrder[order._id] ||
            order.total ||
            0
        );

      if (isCod && !codConfirmed) {
        setError(
          "Confirm COD cash collection before verifying OTP."
        );

        return;
      }

      if (
        isCod &&
        codAmount < Number(order.total || 0)
      ) {
        setError(
          "Collected cash amount must be equal to the order total."
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
            otp,
            isCod
              ? {
                  codCollected: true,
                  codAmountCollected:
                    codAmount,
                }
              : undefined
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

        setCodCollectedByOrder(
          (currentValues) => ({
            ...currentValues,
            [order._id]: false,
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
        setUpdatingOrderId(null);
      }
    };

  const handleCopyOrder =
    async (order: DeliveryOrder) => {
      try {
        await copyText(
          buildDeliverySummary(order)
        );

        setCopiedOrderId(
          order._id
        );

        window.setTimeout(
          () => {
            setCopiedOrderId(
              (currentValue) =>
                currentValue ===
                order._id
                  ? null
                  : currentValue
            );
          },
          1600
        );
      } catch {
        setError(
          "Unable to copy delivery summary."
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
            DELIVERY MODE ACTIVE
          </span>

          <h1>
            {user?.fullName}
          </h1>

          <p>
            Complete assigned deliveries from this screen. Use Customer Mode only for personal bottle orders.
          </p>

          <div className="delivery-hero-progress">
            <strong>
              {performance.completionRate.toFixed(1)}%
            </strong>

            <span>
              delivery completion rate
            </span>
          </div>
        </div>

        <div className="delivery-hero-actions">
          <button
            type="button"
            className="delivery-mode-switch-button"
            onClick={openCustomerMode}
          >
            Switch to Customer Mode
          </button>

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
        </div>
      </section>

      <section className="delivery-mode-card">
        <div>
          <span>
            ROLE SWITCH
          </span>

          <h2>
            Delivery Mode is active
          </h2>

          <p>
            This dashboard is only for assigned deliveries. Switch to Customer Mode when the delivery partner wants to place a personal bottle order.
          </p>
        </div>

        <button
          type="button"
          onClick={openCustomerMode}
        >
          Open Customer App
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
          value={performance.activeDeliveries}
        />

        <Metric
          label="Assigned"
          value={statusCounts.assigned}
        />

        <Metric
          label="Picked up"
          value={statusCounts.picked_up}
        />

        <Metric
          label="Out for delivery"
          value={statusCounts.out_for_delivery}
        />

        <Metric
          label="Failed attempts"
          value={statusCounts.failed_attempts || 0}
        />

        <Metric
          label="COD to collect"
          value={formatCurrency(
            cashSummary.pendingCodAmount
          )}
        />

        <Metric
          label="Collected today"
          value={formatCurrency(
            cashSummary.collectedTodayAmount
          )}
        />

        <Metric
          label="Average rating"
          value={ratingValue}
        />
      </section>

      <section className="delivery-cash-summary-card">
        <div>
          <span>
            CASH AND CLOSING
          </span>

          <h2>
            Today’s delivery closing
          </h2>

          <p>
            Track COD collection and completed deliveries before ending the shift.
          </p>
        </div>

        <div className="delivery-cash-grid">
          <CashItem
            label="Active orders"
            value={cashSummary.activeOrderCount}
          />

          <CashItem
            label="Active bottles"
            value={cashSummary.activeBottleCount}
          />

          <CashItem
            label="Pending COD orders"
            value={cashSummary.pendingCodOrderCount}
          />

          <CashItem
            label="Pending COD amount"
            value={formatCurrency(
              cashSummary.pendingCodAmount
            )}
          />

          <CashItem
            label="COD collected today"
            value={formatCurrency(
              cashSummary.collectedTodayAmount
            )}
          />

          <CashItem
            label="Delivered today"
            value={cashSummary.deliveredTodayOrderCount}
          />
        </div>
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
              {performance.reviewCount} total
            </strong>
          </div>

          {performance.recentReviews.length === 0 ? (
            <div className="delivery-mini-empty">
              <span>★</span>

              <p>
                Customer feedback will appear after completed orders are reviewed.
              </p>
            </div>
          ) : (
            <div className="delivery-feedback-list">
              {performance.recentReviews.map(
                (review) => (
                  <article
                    key={review._id}
                    className="delivery-feedback-card"
                  >
                    <div className="delivery-feedback-top">
                      <div>
                        <strong>
                          {getReviewCustomerName(review)}
                        </strong>

                        <span>
                          {review.orderNumber}
                        </span>
                      </div>

                      <StarDisplay
                        value={review.deliveryRating}
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
              {performance.completedDeliveries} completed
            </strong>
          </div>

          {performance.recentDeliveries.length === 0 ? (
            <div className="delivery-mini-empty">
              <span>✓</span>

              <p>
                Completed deliveries will appear here.
              </p>
            </div>
          ) : (
            <div className="delivery-history-list">
              {performance.recentDeliveries.map(
                (order) => (
                  <article
                    key={order._id}
                    className="delivery-history-row"
                  >
                    <div>
                      <strong>
                        {order.orderNumber}
                      </strong>

                      <span>
                        {getCustomerName(order)}
                      </span>
                    </div>

                    <div>
                      <strong>
                        {formatCurrency(order.total)}
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
          {visibleOrders.length} shown
        </strong>
      </section>

      <section className="delivery-filter-row">
        {[
          ["active", "Active"],
          ["assigned", "Assigned"],
          ["picked_up", "Picked up"],
          ["out_for_delivery", "Out for delivery"],
          ["failed", "Failed attempts"],
          ["delivered", "Delivered"],
          ["all", "All"],
        ].map(([value, label]) => (
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
        ))}
      </section>

      {loading && orders.length === 0 ? (
        <div className="delivery-empty-state">
          <div className="spinner" />

          <p>
            Loading assigned deliveries
          </p>
        </div>
      ) : visibleOrders.length === 0 ? (
        <div className="delivery-empty-state">
          <div className="delivery-empty-icon">
            ✓
          </div>

          <h2>
            No deliveries here
          </h2>

          <p>
            There are no orders matching this delivery filter.
          </p>
        </div>
      ) : (
        <section className="delivery-order-list">
          {visibleOrders.map((order) => {
            const customer =
              order.user &&
              typeof order.user === "object"
                ? order.user
                : null;

            const customerPhone =
              getCustomerPhone(order);

            const address =
              getFullAddress(order);

            const isCod =
              order.paymentMethod === "cod";

            const orderFailureReason =
              getFailureReasonLabel(
                order.failedDeliveryReason
              );

            return (
              <article
                key={order._id}
                className="delivery-order-card"
              >
                <div className="delivery-order-heading">
                  <div>
                    <div className="delivery-number-row">
                      <strong>
                        {order.orderNumber}
                      </strong>

                      <span
                        className={`delivery-status status-${order.deliveryStatus}`}
                      >
                        {
                          DELIVERY_LABELS[
                            order.deliveryStatus
                          ]
                        }
                      </span>

                      {order.lastDeliveryAttemptStatus === "failed" ? (
                        <span className="delivery-failed-badge">
                          Failed attempt
                        </span>
                      ) : null}
                    </div>

                    <span>
                      {formatDate(order.createdAt)}
                    </span>
                  </div>

                  <strong className="delivery-order-total">
                    {formatCurrency(order.total)}
                  </strong>
                </div>

                {order.lastDeliveryAttemptStatus === "failed" ? (
                  <div className="delivery-failed-summary">
                    <strong>
                      Last failed reason: {orderFailureReason}
                    </strong>

                    <span>
                      {formatDate(order.failedDeliveryAt)}
                    </span>

                    {order.failedDeliveryNotes ? (
                      <p>
                        {order.failedDeliveryNotes}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="delivery-quick-actions">
                  <button
                    type="button"
                    onClick={() =>
                      openCall(customerPhone)
                    }
                  >
                    Call
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      openWhatsApp(
                        customerPhone,
                        buildDeliverySummary(order)
                      )
                    }
                  >
                    WhatsApp
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      openMaps(address)
                    }
                  >
                    Maps
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      void handleCopyOrder(order);
                    }}
                  >
                    {copiedOrderId === order._id
                      ? "Copied"
                      : "Copy"}
                  </button>
                </div>

                <div className="delivery-info-grid">
                  <div>
                    <span>
                      Customer
                    </span>

                    <strong>
                      {customer?.fullName ??
                        order.deliveryAddress.fullName}
                    </strong>

                    <p>
                      +91 {customerPhone}
                    </p>
                  </div>

                  <div>
                    <span>
                      Delivery time
                    </span>

                    <strong>
                      {order.deliverySchedule.deliveryDateLabel}
                    </strong>

                    <p>
                      {order.deliverySchedule.deliverySlot}
                    </p>
                  </div>

                  <div>
                    <span>
                      Payment
                    </span>

                    <strong>
                      {isCod
                        ? "Collect cash"
                        : "Paid online"}
                    </strong>

                    <p>
                      {formatCurrency(order.total)}
                    </p>
                  </div>
                </div>

                <div className="delivery-address-block">
                  <span>
                    Complete address
                  </span>

                  <p>
                    {address}
                  </p>
                </div>

                <div className="delivery-items-block">
                  <span>
                    Order items
                  </span>

                  {order.items.map((item) => (
                    <div key={item.productId}>
                      <p>
                        {item.quantity} × {item.name}
                      </p>

                      <strong>
                        {formatCurrency(item.lineTotal)}
                      </strong>
                    </div>
                  ))}
                </div>

                <div className="delivery-note-panel">
                  <div>
                    <span>
                      Delivery partner note
                    </span>

                    <p>
                      Add address, customer or cash notes for this order.
                    </p>
                  </div>

                  <textarea
                    value={noteByOrder[order._id] || ""}
                    onChange={(event) =>
                      setNoteByOrder(
                        (currentValues) => ({
                          ...currentValues,
                          [order._id]:
                            event.target.value,
                        })
                      )
                    }
                    placeholder="Example: call before reaching, gate code, customer prefers evening retry..."
                  />

                  <button
                    type="button"
                    disabled={
                      savingNoteOrderId === order._id
                    }
                    onClick={() => {
                      void handleSaveNote(order);
                    }}
                  >
                    {savingNoteOrderId === order._id
                      ? "Saving note..."
                      : "Save note"}
                  </button>
                </div>

                <div className="delivery-action-block">
                  {order.deliveryStatus === "assigned" ? (
                    <button
                      type="button"
                      disabled={
                        updatingOrderId === order._id
                      }
                      onClick={() => {
                        void handleStatusChange(
                          order,
                          "picked_up"
                        );
                      }}
                    >
                      {updatingOrderId === order._id
                        ? "Updating..."
                        : order.lastDeliveryAttemptStatus === "failed"
                          ? "Retry pickup"
                          : "Mark as picked up"}
                    </button>
                  ) : null}

                  {order.deliveryStatus === "picked_up" ? (
                    <button
                      type="button"
                      disabled={
                        updatingOrderId === order._id
                      }
                      onClick={() => {
                        void handleStatusChange(
                          order,
                          "out_for_delivery"
                        );
                      }}
                    >
                      {updatingOrderId === order._id
                        ? "Updating..."
                        : "Start delivery"}
                    </button>
                  ) : null}

                  {order.deliveryStatus === "out_for_delivery" ? (
                    <>
                      {isCod ? (
                        <div className="delivery-cod-confirm-panel">
                          <div>
                            <span>
                              COD cash collection
                            </span>

                            <p>
                              Confirm cash before verifying customer OTP.
                            </p>
                          </div>

                          <input
                            inputMode="numeric"
                            value={
                              codAmountByOrder[order._id] ??
                              String(order.total || "")
                            }
                            onChange={(event) =>
                              setCodAmountByOrder(
                                (currentValues) => ({
                                  ...currentValues,
                                  [order._id]:
                                    event.target.value.replace(
                                      /[^\d.]/g,
                                      ""
                                    ),
                                })
                              )
                            }
                          />

                          <label>
                            <input
                              type="checkbox"
                              checked={
                                codCollectedByOrder[order._id] === true
                              }
                              onChange={(event) =>
                                setCodCollectedByOrder(
                                  (currentValues) => ({
                                    ...currentValues,
                                    [order._id]:
                                      event.target.checked,
                                  })
                                )
                              }
                            />

                            Cash collected from customer
                          </label>
                        </div>
                      ) : null}

                      <div className="delivery-otp-form">
                        <div>
                          <span>
                            Customer delivery OTP
                          </span>

                          <p>
                            Ask the customer for the four-digit code shown in their app.
                          </p>
                        </div>

                        <input
                          inputMode="numeric"
                          maxLength={4}
                          value={
                            otpByOrder[order._id] || ""
                          }
                          onChange={(event) =>
                            setOtpByOrder(
                              (currentValues) => ({
                                ...currentValues,
                                [order._id]:
                                  event.target.value
                                    .replace(/\D/g, "")
                                    .slice(0, 4),
                              })
                            )
                          }
                          placeholder="0000"
                        />

                        <button
                          type="button"
                          disabled={
                            updatingOrderId === order._id
                          }
                          onClick={() => {
                            void handleOtpVerification(order);
                          }}
                        >
                          {updatingOrderId === order._id
                            ? "Verifying..."
                            : "Verify OTP and deliver"}
                        </button>
                      </div>

                      <div className="delivery-failure-panel">
                        <div>
                          <span>
                            Failed delivery
                          </span>

                          <p>
                            Use only when customer is unavailable, address is wrong, payment failed, or OTP cannot be verified.
                          </p>
                        </div>

                        <div className="failure-reason-grid">
                          {FAILURE_REASONS.map((reason) => (
                            <button
                              type="button"
                              key={reason.value}
                              className={
                                failureReasonByOrder[order._id] === reason.value
                                  ? "failure-reason-active"
                                  : ""
                              }
                              onClick={() =>
                                setFailureReasonByOrder(
                                  (currentValues) => ({
                                    ...currentValues,
                                    [order._id]:
                                      reason.value,
                                  })
                                )
                              }
                            >
                              {reason.label}
                            </button>
                          ))}
                        </div>

                        <textarea
                          value={failureNoteByOrder[order._id] || ""}
                          onChange={(event) =>
                            setFailureNoteByOrder(
                              (currentValues) => ({
                                ...currentValues,
                                [order._id]:
                                  event.target.value,
                              })
                            )
                          }
                          placeholder="Add failed delivery note..."
                        />

                        <button
                          type="button"
                          className="failed-delivery-button"
                          disabled={
                            updatingOrderId === order._id
                          }
                          onClick={() => {
                            void handleReportFailure(order);
                          }}
                        >
                          {updatingOrderId === order._id
                            ? "Recording..."
                            : "Report failed delivery"}
                        </button>
                      </div>
                    </>
                  ) : null}

                  {order.deliveryStatus === "delivered" ? (
                    <div className="delivery-complete-message">
                      Delivery completed successfully.
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
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

function CashItem({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="delivery-cash-item">
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
      {[1, 2, 3, 4, 5].map((star) => (
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
      ))}
    </div>
  );
}