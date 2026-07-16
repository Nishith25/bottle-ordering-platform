import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useSearchParams,
} from "react-router-dom";

import {
  useAdminAuth,
} from "../context/AuthContext";

import {
  fetchAdminActivityLogs,
  type AdminActivityLog,
} from "../services/adminActivityLogsApi";

import {
  fetchAdminOrders,
  retryAdminOrderRefund,
  updateAdminOrderStatus,
  type AdminDeliveryStatus,
  type AdminOrder,
  type AdminOrderRefundStatus,
  type AdminOrderStatus,
  type AdminOrderStatusCounts,
  type AdminOrderUser,
} from "../services/adminOrdersApi";

import {
  assignDeliveryPartner,
  fetchDeliveryPartners,
  type DeliveryPartner,
} from "../services/adminDeliveryApi";

import "./orders.css";

const STATUS_LABELS: Record<AdminOrderStatus, string> = {
  placed: "Placed",
  confirmed: "Confirmed",
  preparing: "Preparing",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const DELIVERY_LABELS: Record<AdminDeliveryStatus, string> = {
  unassigned: "Unassigned",
  assigned: "Assigned",
  picked_up: "Picked up",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const REFUND_LABELS: Record<AdminOrderRefundStatus, string> = {
  not_required: "No refund required",
  pending: "Refund processing",
  processed: "Refund completed",
  failed: "Refund failed",
};

const NEXT_STATUSES: Record<AdminOrderStatus, AdminOrderStatus[]> = {
  placed: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["cancelled"],
  out_for_delivery: [],
  delivered: [],
  cancelled: [],
};

const EMPTY_COUNTS: AdminOrderStatusCounts = {
  placed: 0,
  confirmed: 0,
  preparing: 0,
  out_for_delivery: 0,
  delivered: 0,
  cancelled: 0,
};

const VALID_STATUS_FILTERS = new Set<string>([
  "all",
  ...Object.keys(STATUS_LABELS),
]);

function normalizeStatusFilter(value: string | null) {
  const cleanValue = String(value ?? "").trim();

  return VALID_STATUS_FILTERS.has(cleanValue)
    ? cleanValue
    : "all";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatOptionalDate(value?: string | null) {
  return value ? formatDate(value) : "Not available";
}

function formatLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}

function getCustomer(order: AdminOrder): AdminOrderUser | null {
  return order.user && typeof order.user === "object"
    ? order.user
    : null;
}

function getAssignedPartner(order: AdminOrder): AdminOrderUser | null {
  return order.deliveryPartner && typeof order.deliveryPartner === "object"
    ? order.deliveryPartner
    : null;
}

function getRefundStatus(order: AdminOrder): AdminOrderRefundStatus {
  return order.refundStatus ?? "not_required";
}

function getDeliveryStatus(order: AdminOrder): AdminDeliveryStatus {
  if (order.orderStatus === "cancelled") {
    return "cancelled";
  }

  if (order.orderStatus === "delivered") {
    return "delivered";
  }

  return order.deliveryStatus ?? "unassigned";
}

function getRefundSuccessMessage(order: AdminOrder) {
  const status = getRefundStatus(order);

  if (status === "processed") {
    return `${order.orderNumber} was cancelled and refunded.`;
  }

  if (status === "pending") {
    return `${order.orderNumber} was cancelled and the refund was initiated.`;
  }

  if (status === "failed") {
    return `${order.orderNumber} was cancelled, but the refund needs a retry.`;
  }

  return `${order.orderNumber} was cancelled.`;
}

function getCustomerPhone(order: AdminOrder) {
  const customer = getCustomer(order);

  return (
    customer?.phone ||
    order.deliveryAddress.phone ||
    ""
  );
}

function cleanIndianPhone(value: string) {
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

function buildOrderSummary(order: AdminOrder) {
  const customer = getCustomer(order);

  return [
    `Order: ${order.orderNumber}`,
    `Customer: ${customer?.fullName ?? order.deliveryAddress.fullName}`,
    `Phone: +91 ${getCustomerPhone(order)}`,
    `Status: ${STATUS_LABELS[order.orderStatus]}`,
    `Payment: ${order.paymentMethod.toUpperCase()} · ${order.paymentStatus}`,
    `Total: ${formatCurrency(order.total)}`,
    `Delivery: ${order.deliverySchedule.deliveryDateLabel} · ${order.deliverySchedule.deliverySlot}`,
    `Address: ${order.deliveryAddress.houseDetails}, ${order.deliveryAddress.areaDetails}, ${order.deliveryAddress.area}, ${order.deliveryAddress.city} - ${order.deliveryAddress.pincode}`,
    `Items: ${order.items
      .map((item) => `${item.quantity} x ${item.name}`)
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
    `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`,
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

export default function OrdersPage() {
  const { token } = useAdminAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [partners, setPartners] = useState<DeliveryPartner[]>([]);
  const [statusCounts, setStatusCounts] =
    useState<AdminOrderStatusCounts>(EMPTY_COUNTS);

  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");

  const [selectedPartnerByOrder, setSelectedPartnerByOrder] =
    useState<Record<string, string>>({});

  const [selectedOrders, setSelectedOrders] =
    useState<Record<string, boolean>>({});

  const [timelineByOrder, setTimelineByOrder] =
    useState<Record<string, AdminActivityLog[]>>({});

  const [openTimelineOrderId, setOpenTimelineOrderId] =
    useState<string | null>(null);

  const [timelineLoadingOrderId, setTimelineLoadingOrderId] =
    useState<string | null>(null);

  const [copiedOrderId, setCopiedOrderId] =
    useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const updateUrlFilters = useCallback(
    ({
      nextStatus = statusFilter,
      nextSearch = submittedSearch,
      replace = false,
    }: {
      nextStatus?: string;
      nextSearch?: string;
      replace?: boolean;
    }) => {
      const params = new URLSearchParams();

      const cleanStatus = normalizeStatusFilter(nextStatus);
      const cleanSearch = nextSearch.trim();

      if (cleanStatus !== "all") {
        params.set("status", cleanStatus);
      }

      if (cleanSearch) {
        params.set("search", cleanSearch);
      }

      setSearchParams(params, { replace });
    },
    [setSearchParams, statusFilter, submittedSearch]
  );

  useEffect(() => {
    const urlStatus = normalizeStatusFilter(searchParams.get("status"));
    const urlSearch = String(searchParams.get("search") ?? "").trim();

    setStatusFilter(urlStatus);
    setSearch(urlSearch);
    setSubmittedSearch(urlSearch);
  }, [searchParams]);

  const loadOrders = useCallback(async () => {
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [orderResult, partnerResult] = await Promise.all([
        fetchAdminOrders(token, {
          status: statusFilter,
          search: submittedSearch,
        }),
        fetchDeliveryPartners(token),
      ]);

      setOrders(orderResult.orders);
      setStatusCounts(orderResult.statusCounts);
      setPartners(partnerResult.filter((partner) => partner.active));

      setSelectedPartnerByOrder((current) => {
        const next = { ...current };

        for (const order of orderResult.orders) {
          const assigned = getAssignedPartner(order);

          if (!next[order._id] && assigned?._id) {
            next[order._id] = assigned._id;
          }
        }

        return next;
      });

      setSelectedOrders((current) => {
        const visibleIds =
          new Set(
            orderResult.orders.map(
              (order) => order._id
            )
          );

        const next: Record<string, boolean> = {};

        for (const [orderId, selected] of Object.entries(current)) {
          if (visibleIds.has(orderId) && selected) {
            next[orderId] = true;
          }
        }

        return next;
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load orders."
      );
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter, submittedSearch]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const totalOrders = useMemo(
    () =>
      Object.values(statusCounts).reduce<number>(
        (sum, count) => sum + count,
        0
      ),
    [statusCounts]
  );

  const selectedVisibleOrders =
    useMemo(
      () =>
        orders.filter(
          (order) =>
            selectedOrders[order._id]
        ),
      [
        orders,
        selectedOrders,
      ]
    );

  const selectedPlacedOrders =
    useMemo(
      () =>
        selectedVisibleOrders.filter(
          (order) =>
            order.orderStatus === "placed"
        ),
      [
        selectedVisibleOrders,
      ]
    );

  const selectedConfirmedOrders =
    useMemo(
      () =>
        selectedVisibleOrders.filter(
          (order) =>
            order.orderStatus === "confirmed"
        ),
      [
        selectedVisibleOrders,
      ]
    );

  const allVisibleSelected =
    orders.length > 0 &&
    orders.every(
      (order) =>
        selectedOrders[order._id]
    );

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();

    const cleanSearch = search.trim();

    setSubmittedSearch(cleanSearch);

    updateUrlFilters({
      nextSearch: cleanSearch,
    });
  };

  const handleClearSearch = () => {
    setSearch("");
    setSubmittedSearch("");

    updateUrlFilters({
      nextSearch: "",
    });
  };

  const handleStatusFilterChange = (nextStatus: string) => {
    const cleanStatus = normalizeStatusFilter(nextStatus);

    setStatusFilter(cleanStatus);
    setSelectedOrders({});

    updateUrlFilters({
      nextStatus: cleanStatus,
    });
  };

  const replaceOrder = (updatedOrder: AdminOrder) => {
    setOrders((currentOrders) =>
      currentOrders.map((currentOrder) =>
        currentOrder._id === updatedOrder._id
          ? updatedOrder
          : currentOrder
      )
    );
  };

  const handleStatusChange = async (
    order: AdminOrder,
    nextStatus: AdminOrderStatus
  ) => {
    if (!token || order.orderStatus === nextStatus) {
      return;
    }

    let cancellationReason: string | undefined;

    if (nextStatus === "cancelled") {
      const refundNote =
        order.paymentMethod === "online" && order.paymentStatus === "paid"
          ? " A full Razorpay refund will also be requested."
          : "";

      const confirmed = window.confirm(
        `Cancel order ${order.orderNumber}?${refundNote}`
      );

      if (!confirmed) {
        return;
      }

      cancellationReason =
        window.prompt(
          "Enter cancellation reason:",
          "Cancelled by administrator"
        ) ?? "Cancelled by administrator";
    }

    setUpdatingOrderId(order._id);
    setError(null);
    setSuccess(null);

    try {
      const updatedOrder = await updateAdminOrderStatus(
        token,
        order._id,
        nextStatus,
        cancellationReason
      );

      replaceOrder(updatedOrder);
      setSuccess(
        nextStatus === "cancelled"
          ? getRefundSuccessMessage(updatedOrder)
          : `${order.orderNumber} changed to ${STATUS_LABELS[nextStatus]}.`
      );

      await loadOrders();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update order."
      );
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleBulkStatusChange = async (
    ordersToUpdate: AdminOrder[],
    nextStatus: AdminOrderStatus
  ) => {
    if (!token || ordersToUpdate.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      `Update ${ordersToUpdate.length} selected order${
        ordersToUpdate.length === 1 ? "" : "s"
      } to ${STATUS_LABELS[nextStatus]}?`
    );

    if (!confirmed) {
      return;
    }

    setBulkUpdating(true);
    setError(null);
    setSuccess(null);

    try {
      for (const order of ordersToUpdate) {
        await updateAdminOrderStatus(
          token,
          order._id,
          nextStatus
        );
      }

      setSelectedOrders({});
      setSuccess(
        `${ordersToUpdate.length} order${
          ordersToUpdate.length === 1 ? "" : "s"
        } updated to ${STATUS_LABELS[nextStatus]}.`
      );

      await loadOrders();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to bulk update orders."
      );
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleAssignPartner = async (order: AdminOrder) => {
    if (!token || updatingOrderId) {
      return;
    }

    const deliveryPartnerId = selectedPartnerByOrder[order._id] || "";

    if (!deliveryPartnerId) {
      setError("Please select a delivery partner.");
      return;
    }

    const currentPartner = getAssignedPartner(order);

    if (
      currentPartner &&
      currentPartner._id !== deliveryPartnerId
    ) {
      const confirmed = window.confirm(
        `Reassign ${order.orderNumber}? The old customer OTP will stop working and a new OTP will be generated.`
      );

      if (!confirmed) {
        return;
      }
    }

    setUpdatingOrderId(order._id);
    setError(null);
    setSuccess(null);

    try {
      const updatedOrder = await assignDeliveryPartner(
        token,
        order._id,
        deliveryPartnerId
      );

      replaceOrder(updatedOrder);
      const partner = getAssignedPartner(updatedOrder);
      setSuccess(
        `${order.orderNumber} assigned to ${
          partner?.fullName ?? "the selected delivery partner"
        }. A new delivery OTP is available to the customer.`
      );

      await loadOrders();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to assign delivery partner."
      );
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleRefundRetry = async (order: AdminOrder) => {
    if (!token) {
      return;
    }

    const confirmed = window.confirm(
      `Retry the Razorpay refund for ${order.orderNumber}?`
    );

    if (!confirmed) {
      return;
    }

    setUpdatingOrderId(order._id);
    setError(null);
    setSuccess(null);

    try {
      const updatedOrder = await retryAdminOrderRefund(token, order._id);
      replaceOrder(updatedOrder);

      const refundStatus = getRefundStatus(updatedOrder);

      setSuccess(
        refundStatus === "processed"
          ? "Refund processed successfully."
          : refundStatus === "pending"
            ? "Refund request submitted to Razorpay."
            : "Refund retry completed."
      );

      await loadOrders();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to retry refund."
      );
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleToggleTimeline = async (order: AdminOrder) => {
    if (!token) {
      return;
    }

    if (openTimelineOrderId === order._id) {
      setOpenTimelineOrderId(null);
      return;
    }

    setOpenTimelineOrderId(order._id);

    if (timelineByOrder[order._id]) {
      return;
    }

    setTimelineLoadingOrderId(order._id);
    setError(null);

    try {
      const result = await fetchAdminActivityLogs(token, {
        search: order.orderNumber,
        limit: 50,
      });

      setTimelineByOrder((current) => ({
        ...current,
        [order._id]: result.logs,
      }));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load order timeline."
      );
    } finally {
      setTimelineLoadingOrderId(null);
    }
  };

  const handleCopyOrder = async (order: AdminOrder) => {
    try {
      await copyText(buildOrderSummary(order));

      setCopiedOrderId(order._id);

      window.setTimeout(() => {
        setCopiedOrderId((current) =>
          current === order._id
            ? null
            : current
        );
      }, 1600);
    } catch {
      setError("Unable to copy order summary.");
    }
  };

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedOrders({});
      return;
    }

    const next: Record<string, boolean> = {};

    for (const order of orders) {
      next[order._id] = true;
    }

    setSelectedOrders(next);
  };

  return (
    <div className="orders-page">
      <div className="page-heading-row">
        <div>
          <h2>Customer orders</h2>
          <p>
            Confirm orders, assign delivery partners and manage secure OTP
            delivery completion.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          disabled={loading}
          onClick={() => void loadOrders()}
        >
          {loading ? "Refreshing..." : "Refresh orders"}
        </button>
      </div>

      {error ? <div className="inline-error">{error}</div> : null}
      {success ? <div className="inline-success">{success}</div> : null}

      {submittedSearch ? (
        <div className="inline-success">
          Showing results for “{submittedSearch}”.
        </div>
      ) : null}

      <div className="order-metric-grid">
        <OrderMetric
          label="All orders"
          value={totalOrders}
          active={statusFilter === "all"}
          onClick={() => handleStatusFilterChange("all")}
        />

        {(Object.keys(STATUS_LABELS) as AdminOrderStatus[]).map((status) => (
          <OrderMetric
            key={status}
            label={STATUS_LABELS[status]}
            value={statusCounts[status] ?? 0}
            active={statusFilter === status}
            onClick={() => handleStatusFilterChange(status)}
          />
        ))}
      </div>

      <section className="panel orders-toolbar">
        <form className="order-search-form" onSubmit={handleSearch}>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search order, customer, delivery partner, email or phone"
          />

          <button type="submit" className="primary-button">
            Search
          </button>

          {submittedSearch ? (
            <button
              type="button"
              className="secondary-button"
              onClick={handleClearSearch}
            >
              Clear
            </button>
          ) : null}
        </form>

        {orders.length > 0 ? (
          <div className="bulk-order-toolbar">
            <div>
              <strong>
                {selectedVisibleOrders.length} selected
              </strong>

              <span>
                {selectedPlacedOrders.length} placed ·{" "}
                {selectedConfirmedOrders.length} confirmed
              </span>
            </div>

            <div className="bulk-order-actions">
              <button
                type="button"
                onClick={toggleAllVisible}
              >
                {allVisibleSelected
                  ? "Clear selection"
                  : "Select visible"}
              </button>

              <button
                type="button"
                disabled={
                  bulkUpdating ||
                  selectedPlacedOrders.length === 0
                }
                onClick={() =>
                  void handleBulkStatusChange(
                    selectedPlacedOrders,
                    "confirmed"
                  )
                }
              >
                Confirm selected
              </button>

              <button
                type="button"
                disabled={
                  bulkUpdating ||
                  selectedConfirmedOrders.length === 0
                }
                onClick={() =>
                  void handleBulkStatusChange(
                    selectedConfirmedOrders,
                    "preparing"
                  )
                }
              >
                Mark preparing
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="panel orders-panel">
        {loading && orders.length === 0 ? (
          <div className="page-state compact">
            <div className="spinner" />
            <p>Loading customer orders</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="page-state compact">
            <div className="state-icon">▤</div>
            <h3>No orders found</h3>
            <p>No orders match the selected filters.</p>
          </div>
        ) : (
          <div className="admin-order-list">
            {orders.map((order) => {
              const customer = getCustomer(order);
              const assignedPartner = getAssignedPartner(order);
              const nextStatuses = NEXT_STATUSES[order.orderStatus];
              const refundStatus = getRefundStatus(order);
              const deliveryStatus = getDeliveryStatus(order);
              const showRefundPanel =
                order.paymentMethod === "online" &&
                (order.orderStatus === "cancelled" ||
                  refundStatus !== "not_required");
              const canAssign =
                !["placed", "delivered", "cancelled"].includes(
                  order.orderStatus
                );

              const selectedPartnerId =
                selectedPartnerByOrder[order._id] || "";

              const partnerSelectionChanged =
                !assignedPartner ||
                assignedPartner._id !== selectedPartnerId;

              const customerPhone =
                getCustomerPhone(order);

              const orderTimeline =
                timelineByOrder[order._id] || [];

              const timelineOpen =
                openTimelineOrderId === order._id;

              return (
                <article key={order._id} className="admin-order-card">
                  <div className="admin-order-header">
                    <div className="order-header-left">
                      <label className="order-select-checkbox">
                        <input
                          type="checkbox"
                          checked={Boolean(selectedOrders[order._id])}
                          onChange={(event) =>
                            setSelectedOrders((current) => ({
                              ...current,
                              [order._id]: event.target.checked,
                            }))
                          }
                        />

                        <span>Select</span>
                      </label>

                      <div>
                        <div className="order-number-row">
                          <strong>{order.orderNumber}</strong>
                          <span
                            className={`admin-order-status status-${order.orderStatus}`}
                          >
                            {STATUS_LABELS[order.orderStatus]}
                          </span>
                        </div>
                        <span className="order-created-at">
                          {formatDate(order.createdAt)}
                        </span>
                      </div>
                    </div>

                    <div className="order-total-block">
                      <span>Order total</span>
                      <strong>{formatCurrency(order.total)}</strong>
                    </div>
                  </div>

                  <div className="order-quick-action-row">
                    <button
                      type="button"
                      onClick={() =>
                        openCall(customerPhone)
                      }
                    >
                      Call customer
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        openWhatsApp(
                          customerPhone,
                          buildOrderSummary(order)
                        )
                      }
                    >
                      WhatsApp
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        void handleCopyOrder(order);
                      }}
                    >
                      {copiedOrderId === order._id
                        ? "Copied"
                        : "Copy summary"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        void handleToggleTimeline(order);
                      }}
                    >
                      {timelineOpen
                        ? "Hide timeline"
                        : "Timeline"}
                    </button>
                  </div>

                  <div className="admin-order-grid">
                    <div className="order-information-section">
                      <h4>Customer</h4>
                      <strong>
                        {customer?.fullName ?? order.deliveryAddress.fullName}
                      </strong>
                      <span>{customer?.email ?? "Email unavailable"}</span>
                      <span>
                        +91 {customerPhone}
                      </span>
                    </div>

                    <div className="order-information-section">
                      <h4>Delivery</h4>
                      <strong>
                        {order.deliverySchedule.deliveryDateLabel}
                      </strong>
                      <span>{order.deliverySchedule.deliverySlot}</span>
                      <span>
                        {order.deliveryAddress.area}, {order.deliveryAddress.city}
                        {" – "}
                        {order.deliveryAddress.pincode}
                      </span>
                    </div>

                    <div className="order-information-section">
                      <h4>Payment</h4>
                      <strong>
                        {order.paymentMethod === "cod"
                          ? "Cash on delivery"
                          : "Razorpay online payment"}
                      </strong>
                      <span>Status: {order.paymentStatus}</span>
                      <span>
                        Delivery fee:{" "}
                        {order.deliveryFee === 0
                          ? "Free"
                          : formatCurrency(order.deliveryFee)}
                      </span>
                      {order.paymentReference ? (
                        <span className="payment-reference">
                          Payment ID: {order.paymentReference}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {timelineOpen ? (
                    <div className="order-timeline-panel">
                      <div className="order-timeline-heading">
                        <h4>Order timeline</h4>
                        <span>
                          From Activity Log
                        </span>
                      </div>

                      {timelineLoadingOrderId === order._id ? (
                        <p className="timeline-empty">
                          Loading timeline...
                        </p>
                      ) : orderTimeline.length === 0 ? (
                        <p className="timeline-empty">
                          No activity log entries found for this order yet.
                        </p>
                      ) : (
                        <div className="timeline-list">
                          {orderTimeline.map((log) => (
                            <div key={log._id} className="timeline-item">
                              <span className={`timeline-dot timeline-${log.severity}`} />

                              <div>
                                <strong>{log.actionLabel}</strong>
                                <p>{log.message || formatLabel(log.actionType)}</p>
                                <small>
                                  {formatDate(log.createdAt)} ·{" "}
                                  {log.actorSnapshot?.fullName || "Admin/System"}
                                </small>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}

                  <div className="delivery-assignment-panel">
                    <div className="delivery-assignment-heading">
                      <div>
                        <span className="delivery-assignment-eyebrow">
                          DELIVERY ASSIGNMENT
                        </span>
                        <h4>
                          {assignedPartner
                            ? assignedPartner.fullName
                            : "No partner assigned"}
                        </h4>
                      </div>

                      <span
                        className={`delivery-assignment-status delivery-${deliveryStatus}`}
                      >
                        {DELIVERY_LABELS[deliveryStatus]}
                      </span>
                    </div>

                    {assignedPartner ? (
                      <div className="assigned-partner-details">
                        <span>{assignedPartner.email}</span>
                        <span>+91 {assignedPartner.phone}</span>
                        <span>
                          Assigned: {formatOptionalDate(order.deliveryAssignedAt)}
                        </span>
                      </div>
                    ) : (
                      <p className="assignment-help">
                        Confirm the order, then select an active delivery partner.
                      </p>
                    )}

                    {canAssign ? (
                      <div className="delivery-assignment-controls">
                        <select
                          value={selectedPartnerId}
                          disabled={updatingOrderId === order._id}
                          onChange={(event) =>
                            setSelectedPartnerByOrder((current) => ({
                              ...current,
                              [order._id]: event.target.value,
                            }))
                          }
                        >
                          <option value="">Select delivery partner</option>
                          {partners.map((partner) => (
                            <option key={partner.id} value={partner.id}>
                              {partner.fullName} · {partner.activeAssignmentCount} active
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          disabled={
                            updatingOrderId === order._id ||
                            partners.length === 0 ||
                            !selectedPartnerId ||
                            !partnerSelectionChanged
                          }
                          onClick={() => void handleAssignPartner(order)}
                        >
                          {updatingOrderId === order._id
                            ? "Assigning..."
                            : assignedPartner
                              ? "Reassign partner"
                              : "Assign partner"}
                        </button>
                      </div>
                    ) : order.orderStatus === "placed" ? (
                      <p className="assignment-help">
                        Confirm this order before assigning delivery.
                      </p>
                    ) : null}
                  </div>

                  {showRefundPanel ? (
                    <div className={`refund-panel refund-${refundStatus}`}>
                      <div className="refund-panel-heading">
                        <div>
                          <span className="refund-eyebrow">RAZORPAY REFUND</span>
                          <h4>{REFUND_LABELS[refundStatus]}</h4>
                        </div>

                        <span
                          className={`refund-status-pill refund-status-${refundStatus}`}
                        >
                          {REFUND_LABELS[refundStatus]}
                        </span>
                      </div>

                      <div className="refund-detail-grid">
                        <div>
                          <span>Amount</span>
                          <strong>
                            {formatCurrency(order.refundAmount ?? order.total)}
                          </strong>
                        </div>
                        <div>
                          <span>Requested</span>
                          <strong>
                            {formatOptionalDate(order.refundRequestedAt)}
                          </strong>
                        </div>
                        <div>
                          <span>Refund ID</span>
                          <strong>{order.refundId || "Awaiting Razorpay"}</strong>
                        </div>
                        <div>
                          <span>Attempts</span>
                          <strong>{order.refundAttemptCount ?? 0}</strong>
                        </div>
                      </div>

                      {refundStatus === "failed" && order.refundFailureReason ? (
                        <div className="refund-failure-reason">
                          {order.refundFailureReason}
                        </div>
                      ) : null}

                      {refundStatus === "processed" ? (
                        <div className="refund-completed-note">
                          Completed: {formatOptionalDate(order.refundProcessedAt)}
                        </div>
                      ) : null}

                      {refundStatus === "failed" ? (
                        <button
                          type="button"
                          className="refund-retry-button"
                          disabled={updatingOrderId === order._id}
                          onClick={() => void handleRefundRetry(order)}
                        >
                          {updatingOrderId === order._id
                            ? "Retrying refund..."
                            : "Retry refund"}
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="admin-order-items">
                    <h4>Ordered bottles</h4>
                    {order.items.map((item) => (
                      <div key={item.productId} className="admin-order-item">
                        <span>
                          {item.quantity} × {item.name}
                        </span>
                        <strong>{formatCurrency(item.lineTotal)}</strong>
                      </div>
                    ))}
                  </div>

                  <div className="order-address">
                    <h4>Complete address</h4>
                    <p>
                      {order.deliveryAddress.houseDetails},{" "}
                      {order.deliveryAddress.areaDetails}
                      {order.deliveryAddress.landmark
                        ? `, near ${order.deliveryAddress.landmark}`
                        : ""}
                    </p>
                  </div>

                  <div className="order-action-row">
                    {nextStatuses.length > 0 ? (
                      <>
                        <label>
                          Update status
                          <select
                            value=""
                            disabled={updatingOrderId === order._id}
                            onChange={(event) => {
                              const value = event.target.value as AdminOrderStatus;

                              if (value) {
                                void handleStatusChange(order, value);
                              }
                            }}
                          >
                            <option value="">Select next status</option>
                            {nextStatuses.map((nextStatus) => (
                              <option key={nextStatus} value={nextStatus}>
                                {STATUS_LABELS[nextStatus]}
                              </option>
                            ))}
                          </select>
                        </label>

                        {updatingOrderId === order._id ? (
                          <span className="updating-order">Updating order...</span>
                        ) : null}
                      </>
                    ) : (
                      <span className="terminal-order-status">
                        {order.orderStatus === "delivered"
                          ? "Order completed with delivery OTP"
                          : order.orderStatus === "out_for_delivery"
                            ? "Delivery partner must verify the customer OTP"
                            : refundStatus === "pending"
                              ? "Order cancelled · refund processing"
                              : refundStatus === "processed"
                                ? "Order cancelled · refunded"
                                : "Order cancelled"}
                      </span>
                    )}
                  </div>

                  {order.orderStatus === "cancelled" &&
                  order.cancellationReason ? (
                    <div className="cancellation-reason">
                      Cancellation reason: {order.cancellationReason}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function OrderMetric({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`order-metric-card ${
        active ? "order-metric-active" : ""
      }`}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </button>
  );
}