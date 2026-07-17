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
  acceptAvailableDeliveryOrder,
  fetchAssignedDeliveryOrders,
  fetchAvailableDeliveryOrders,
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

import {
  fetchDeliveryCashHandoverSummary,
  submitDeliveryCashHandover,
  type DeliveryCashHandoverResult,
} from "../services/deliveryCashHandoverApi";

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

const EMPTY_HANDOVER_RESULT:
  DeliveryCashHandoverResult = {
    summary: {
      dateId: "",
      pendingSubmitCount: 0,
      pendingSubmitAmount: 0,
      submittedCount: 0,
      submittedAmount: 0,
      verifiedCount: 0,
      verifiedAmount: 0,
      shortAmount: 0,
      totalRows: 0,
    },
    pendingCollections: [],
    submittedBatches: [],
    verifiedBatches: [],
  };

const DELIVERY_LABELS: Record<string, string> = {
  unassigned: "Unassigned",
  assigned: "Assigned",
  picked_up: "Picked up",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const FAILURE_REASONS: Array<{
  value: DeliveryFailureReason;
  label: string;
}> = [
  {
    value: "customer_not_available",
    label: "Customer not available",
  },
  {
    value: "customer_no_response",
    label: "No response",
  },
  {
    value: "wrong_address",
    label: "Wrong address",
  },
  {
    value: "payment_issue",
    label: "Payment issue",
  },
  {
    value: "otp_issue",
    label: "OTP issue",
  },
  {
    value: "customer_requested_later",
    label: "Requested later",
  },
  {
    value: "vehicle_issue",
    label: "Vehicle issue",
  },
  {
    value: "other",
    label: "Other",
  },
];

function getTodayDateId() {
  return new Date().toLocaleDateString(
    "en-CA",
    {
      timeZone: "Asia/Kolkata",
    }
  );
}

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

  const parsedDate = new Date(value);

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
  const digits = String(value || "").replace(
    /\D/g,
    ""
  );

  if (digits.length >= 10) {
    return digits.slice(-10);
  }

  return digits;
}

function getDeliveryStatusLabel(value?: string) {
  return DELIVERY_LABELS[value || ""] || value || "Unknown";
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
  review: DeliveryPerformanceReview
) {
  if (
    review.user &&
    typeof review.user === "object" &&
    review.user.fullName
  ) {
    return review.user.fullName;
  }

  return (
    review.customerSnapshot?.fullName ||
    "Customer"
  );
}

function getFullAddress(order: DeliveryOrder) {
  const address = order.deliveryAddress;

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
      (reason) => reason.value === value
    )?.label ||
    "Failed delivery"
  );
}

function buildDeliverySummary(order: DeliveryOrder) {
  return [
    `Order: ${order.orderNumber}`,
    `Customer: ${getCustomerName(order)}`,
    `Phone: +91 ${getCustomerPhone(order)}`,
    `Status: ${getDeliveryStatusLabel(order.deliveryStatus)}`,
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
        (item) => `${item.quantity} x ${item.name}`
      )
      .join(", ")}`,
  ].join("\n");
}

function openCall(phone: string) {
  const cleanPhone = cleanIndianPhone(phone);

  if (!cleanPhone) {
    return;
  }

  window.location.href = `tel:+91${cleanPhone}`;
}

function openWhatsApp(
  phone: string,
  message: string
) {
  const cleanPhone = cleanIndianPhone(phone);

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
    await navigator.clipboard.writeText(text);
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
    selectedHandoverDate,
    setSelectedHandoverDate,
  ] = useState(getTodayDateId());

  const [
    availableOrders,
    setAvailableOrders,
  ] = useState<DeliveryOrder[]>([]);

  const [
    orders,
    setOrders,
  ] = useState<DeliveryOrder[]>([]);

  const [
    statusCounts,
    setStatusCounts,
  ] = useState<DeliveryOrderStatusCounts>(
    EMPTY_COUNTS
  );

  const [
    performance,
    setPerformance,
  ] = useState<DeliveryPerformance>(
    EMPTY_PERFORMANCE
  );

  const [
    cashSummary,
    setCashSummary,
  ] = useState<DeliveryCashSummary>(
    EMPTY_CASH_SUMMARY
  );

  const [
    handoverData,
    setHandoverData,
  ] = useState<DeliveryCashHandoverResult>(
    EMPTY_HANDOVER_RESULT
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
    submittingHandover,
    setSubmittingHandover,
  ] = useState(false);

  const [
    handoverAmount,
    setHandoverAmount,
  ] = useState("");

  const [
    handoverNote,
    setHandoverNote,
  ] = useState("");

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
  ] = useState<Record<string, DeliveryFailureReason>>({});

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
        setAvailableOrders([]);
        setOrders([]);
        setStatusCounts(EMPTY_COUNTS);
        setPerformance(EMPTY_PERFORMANCE);
        setCashSummary(EMPTY_CASH_SUMMARY);
        setHandoverData(EMPTY_HANDOVER_RESULT);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const [
          availableOrderResult,
          orderResult,
          performanceResult,
          cashSummaryResult,
          handoverResult,
        ] = await Promise.all([
          fetchAvailableDeliveryOrders(token),
          fetchAssignedDeliveryOrders(token),
          fetchDeliveryPerformance(token),
          fetchDeliveryCashSummary(token),
          fetchDeliveryCashHandoverSummary(
            token,
            selectedHandoverDate
          ),
        ]);

        setAvailableOrders(
          availableOrderResult
        );

        setOrders(orderResult.orders);

        setStatusCounts({
          ...EMPTY_COUNTS,
          ...orderResult.statusCounts,
        });

        setPerformance(performanceResult);
        setCashSummary(cashSummaryResult);
        setHandoverData(handoverResult);

        if (
          !handoverAmount ||
          Number(handoverAmount) === 0
        ) {
          setHandoverAmount(
            handoverResult.summary.pendingSubmitAmount > 0
              ? String(
                  handoverResult.summary.pendingSubmitAmount
                )
              : ""
          );
        }

        setNoteByOrder(
          (currentValues) => {
            const next = {
              ...currentValues,
            };

            for (const order of orderResult.orders) {
              if (
                next[order._id] === undefined
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
                next[order._id] === undefined
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
                next[order._id] === undefined
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
    }, [
      token,
      selectedHandoverDate,
      handoverAmount,
    ]);

  useEffect(() => {
    void loadDashboard();
  }, [
    loadDashboard,
  ]);

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
            ].includes(order.deliveryStatus)
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
          order.deliveryStatus === filter
      );
    }, [
      orders,
      filter,
    ]);

  const updateLocalOrder =
    (updatedOrder: DeliveryOrder) => {
      setOrders(
        (currentOrders) =>
          currentOrders.map(
            (order) =>
              order._id === updatedOrder._id
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

  const handleSubmitCashHandover =
    async () => {
      if (
        !token ||
        submittingHandover
      ) {
        return;
      }

      const amount =
        Number(handoverAmount);

      if (
        !Number.isFinite(amount) ||
        amount <= 0
      ) {
        setError(
          "Enter a valid cash handover amount."
        );
        return;
      }

      if (
        handoverData.summary.pendingSubmitAmount <= 0
      ) {
        setError(
          "There is no collected COD cash pending for handover."
        );
        return;
      }

      const confirmed =
        window.confirm(
          `Submit ${formatCurrency(amount)} as cash handover to admin?`
        );

      if (!confirmed) {
        return;
      }

      setSubmittingHandover(true);
      setError(null);
      setSuccess(null);

      try {
        const batch =
          await submitDeliveryCashHandover(
            token,
            {
              dateId:
                selectedHandoverDate,
              amountSubmitted:
                amount,
              note:
                handoverNote,
            }
          );

        setSuccess(
          `Cash handover ${batch.batchId} submitted to admin.`
        );

        setHandoverAmount("");
        setHandoverNote("");

        await loadDashboard();
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to submit cash handover."
        );
      } finally {
        setSubmittingHandover(false);
      }
    };

  const handleAcceptAvailableOrder =
    async (order: DeliveryOrder) => {
      if (
        !token ||
        updatingOrderId
      ) {
        return;
      }

      const confirmed =
        window.confirm(
          `Accept ${order.orderNumber}? After accepting, only you can deliver this order.`
        );

      if (!confirmed) {
        return;
      }

      setUpdatingOrderId(order._id);
      setError(null);
      setSuccess(null);

      try {
        const acceptedOrder =
          await acceptAvailableDeliveryOrder(
            token,
            order._id
          );

        setAvailableOrders(
          (currentOrders) =>
            currentOrders.filter(
              (currentOrder) =>
                currentOrder._id !==
                acceptedOrder._id
            )
        );

        setOrders(
          (currentOrders) => [
            acceptedOrder,
            ...currentOrders,
          ]
        );

        setSuccess(
          `${acceptedOrder.orderNumber} accepted successfully.`
        );

        setFilter("active");

        await loadDashboard();
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to accept this order."
        );

        await loadDashboard();
      } finally {
        setUpdatingOrderId(null);
      }
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

      setUpdatingOrderId(order._id);
      setError(null);
      setSuccess(null);

      try {
        const updatedOrder =
          await updateDeliveryOrderStatus(
            token,
            order._id,
            nextStatus
          );

        updateLocalOrder(updatedOrder);

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
        setUpdatingOrderId(null);
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

      setSavingNoteOrderId(order._id);
      setError(null);
      setSuccess(null);

      try {
        const updatedOrder =
          await saveDeliveryOrderNote(
            token,
            order._id,
            noteByOrder[order._id] || ""
          );

        updateLocalOrder(updatedOrder);

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

      setUpdatingOrderId(order._id);
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

        updateLocalOrder(updatedOrder);

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
        otpByOrder[order._id] || ""
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

      if (
        isCod &&
        !codConfirmed
      ) {
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

      setUpdatingOrderId(order._id);
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

        updateLocalOrder(updatedOrder);

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

        setCopiedOrderId(order._id);

        window.setTimeout(
          () => {
            setCopiedOrderId(
              (currentValue) =>
                currentValue === order._id
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
            Your accepted deliveries appear first. Complete COD orders, then submit cash handover at the end of your shift.
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
          label="My active deliveries"
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
          label="Available pool"
          value={availableOrders.length}
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
          label="Cash to handover"
          value={formatCurrency(
            handoverData.summary.pendingSubmitAmount
          )}
        />

        <Metric
          label="Average rating"
          value={ratingValue}
        />
      </section>

      <section className="delivery-cash-handover-card">
        <div className="delivery-cash-handover-top">
          <div>
            <span>
              END SHIFT CASH HANDOVER
            </span>

            <h2>
              Submit COD cash to admin
            </h2>

            <p>
              After completing COD deliveries, submit your collected cash here. Admin will verify and close your cash balance.
            </p>
          </div>

          <input
            type="date"
            value={selectedHandoverDate}
            onChange={(event) => {
              setSelectedHandoverDate(
                event.target.value
              );
              setHandoverAmount("");
            }}
          />
        </div>

        <div className="delivery-cash-handover-metrics">
          <CashItem
            label="Pending submit"
            value={formatCurrency(
              handoverData.summary.pendingSubmitAmount
            )}
          />

          <CashItem
            label="Pending orders"
            value={handoverData.summary.pendingSubmitCount}
          />

          <CashItem
            label="Submitted"
            value={formatCurrency(
              handoverData.summary.submittedAmount
            )}
          />

          <CashItem
            label="Verified"
            value={formatCurrency(
              handoverData.summary.verifiedAmount
            )}
          />

          <CashItem
            label="Short amount"
            value={formatCurrency(
              handoverData.summary.shortAmount
            )}
          />
        </div>

        {handoverData.pendingCollections.length > 0 ? (
          <div className="delivery-handover-order-list">
            {handoverData.pendingCollections.map((row) => (
              <div key={row._id}>
                <span>
                  {row.orderNumber}
                </span>

                <strong>
                  {formatCurrency(
                    Number(
                      row.amountCollected ||
                        row.amountDue ||
                        0
                    )
                  )}
                </strong>
              </div>
            ))}
          </div>
        ) : (
          <div className="delivery-handover-empty">
            No collected COD cash pending for handover.
          </div>
        )}

        <div className="delivery-handover-action">
          <div>
            <label>
              Amount submitting
            </label>

            <input
              inputMode="numeric"
              value={handoverAmount}
              onChange={(event) =>
                setHandoverAmount(
                  event.target.value.replace(
                    /[^\d.]/g,
                    ""
                  )
                )
              }
              placeholder="Enter cash amount"
            />
          </div>

          <div>
            <label>
              Note
            </label>

            <input
              value={handoverNote}
              onChange={(event) =>
                setHandoverNote(
                  event.target.value
                )
              }
              placeholder="Optional note for admin"
            />
          </div>

          <button
            type="button"
            disabled={
              submittingHandover ||
              handoverData.summary.pendingSubmitAmount <= 0
            }
            onClick={() => {
              void handleSubmitCashHandover();
            }}
          >
            {submittingHandover
              ? "Submitting..."
              : "Submit handover"}
          </button>
        </div>

        {handoverData.submittedBatches.length > 0 ? (
          <div className="delivery-handover-batches">
            <strong>
              Waiting for admin verification
            </strong>

            {handoverData.submittedBatches.map((batch) => (
              <div key={batch.batchId}>
                <span>
                  {batch.batchId}
                </span>

                <p>
                  {batch.orderCount} orders · submitted {formatCurrency(batch.submittedAmount || batch.expectedAmount)}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="delivery-orders-heading">
        <div>
          <span>
            MY ACCEPTED ORDERS
          </span>

          <h2>
            My delivery operations
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
            Loading your accepted deliveries
          </p>
        </div>
      ) : visibleOrders.length === 0 ? (
        <div className="delivery-empty-state">
          <div className="delivery-empty-icon">
            ✓
          </div>

          <h2>
            No accepted deliveries here
          </h2>

          <p>
            Accept an order from the open delivery pool below to start delivery work.
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
                        {getDeliveryStatusLabel(order.deliveryStatus)}
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

      <section className="delivery-available-heading">
        <div>
          <span>
            AVAILABLE ORDERS
          </span>

          <h2>
            Open delivery pool
          </h2>

          <p>
            These orders are visible to all delivery partners. Once accepted, the order is locked to one delivery partner only.
          </p>
        </div>

        <strong>
          {availableOrders.length} open
        </strong>
      </section>

      {availableOrders.length === 0 ? (
        <div className="delivery-open-empty">
          <span>✓</span>

          <div>
            <strong>
              No open delivery orders
            </strong>

            <p>
              New active orders will appear here automatically when they are ready for delivery acceptance.
            </p>
          </div>
        </div>
      ) : (
        <section className="delivery-open-order-list">
          {availableOrders.map((order) => {
            const customer =
              order.user &&
              typeof order.user === "object"
                ? order.user
                : null;

            const customerPhone =
              getCustomerPhone(order);

            const address =
              getFullAddress(order);

            return (
              <article
                key={order._id}
                className="delivery-open-order-card"
              >
                <div className="delivery-order-heading">
                  <div>
                    <div className="delivery-number-row">
                      <strong>
                        {order.orderNumber}
                      </strong>

                      <span className="delivery-open-badge">
                        Open
                      </span>
                    </div>

                    <span>
                      {formatDate(order.createdAt)}
                    </span>
                  </div>

                  <strong className="delivery-order-total">
                    {formatCurrency(order.total)}
                  </strong>
                </div>

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
                      {order.paymentMethod === "cod"
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

                <div className="delivery-accept-panel">
                  <div>
                    <span>
                      Accept delivery
                    </span>

                    <p>
                      After accepting, this order will disappear from other delivery partners and move to your accepted list above.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={
                      updatingOrderId === order._id
                    }
                    onClick={() => {
                      void handleAcceptAvailableOrder(order);
                    }}
                  >
                    {updatingOrderId === order._id
                      ? "Accepting..."
                      : "Accept this order"}
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}

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