import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAdminAuth } from "../context/AuthContext";

import {
  fetchAssignedDeliveryOrders,
  updateDeliveryOrderStatus,
  verifyDeliveryOrderOtp,
  type DeliveryOrder,
  type DeliveryOrderStatusCounts,
} from "../services/adminDeliveryApi";

import "./deliveryDashboard.css";

const EMPTY_COUNTS: DeliveryOrderStatusCounts = {
  assigned: 0,
  picked_up: 0,
  out_for_delivery: 0,
  delivered: 0,
};

const DELIVERY_LABELS = {
  unassigned: "Unassigned",
  assigned: "Assigned",
  picked_up: "Picked up",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
} as const;

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

export default function DeliveryDashboardPage() {
  const { token, user } = useAdminAuth();

  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [statusCounts, setStatusCounts] =
    useState<DeliveryOrderStatusCounts>(EMPTY_COUNTS);
  const [filter, setFilter] = useState("active");
  const [loading, setLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] =
    useState<string | null>(null);
  const [otpByOrder, setOtpByOrder] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetchAssignedDeliveryOrders(token);
      setOrders(result.orders);
      setStatusCounts(result.statusCounts);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load assigned deliveries."
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const visibleOrders = useMemo(() => {
    if (filter === "all") {
      return orders;
    }

    if (filter === "active") {
      return orders.filter((order) =>
        ["assigned", "picked_up", "out_for_delivery"].includes(
          order.deliveryStatus
        )
      );
    }

    return orders.filter(
      (order) => order.deliveryStatus === filter
    );
  }, [orders, filter]);

  const updateLocalOrder = (updatedOrder: DeliveryOrder) => {
    setOrders((current) =>
      current.map((order) =>
        order._id === updatedOrder._id ? updatedOrder : order
      )
    );
  };

  const handleStatusChange = async (
    order: DeliveryOrder,
    nextStatus: "picked_up" | "out_for_delivery"
  ) => {
    if (!token || updatingOrderId) {
      return;
    }

    setUpdatingOrderId(order._id);
    setError(null);
    setSuccess(null);

    try {
      const updatedOrder = await updateDeliveryOrderStatus(
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

      await loadOrders();
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

  const handleOtpVerification = async (order: DeliveryOrder) => {
    if (!token || updatingOrderId) {
      return;
    }

    const otp = (otpByOrder[order._id] || "").replace(/\D/g, "");

    if (otp.length !== 4) {
      setError("Enter the customer's 4-digit delivery OTP.");
      return;
    }

    setUpdatingOrderId(order._id);
    setError(null);
    setSuccess(null);

    try {
      const updatedOrder = await verifyDeliveryOrderOtp(
        token,
        order._id,
        otp
      );

      updateLocalOrder(updatedOrder);
      setOtpByOrder((current) => ({
        ...current,
        [order._id]: "",
      }));
      setSuccess(`${order.orderNumber} delivered successfully.`);

      await loadOrders();
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

  return (
    <div className="delivery-dashboard-page">
      <section className="delivery-hero">
        <div>
          <span>GOOD DAY</span>
          <h1>{user?.fullName}</h1>
          <p>
            Complete only the deliveries assigned to your account. Ask the
            customer for the OTP only after reaching the address.
          </p>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={() => void loadOrders()}
        >
          {loading ? "Refreshing..." : "Refresh deliveries"}
        </button>
      </section>

      {error ? <div className="delivery-alert delivery-error">{error}</div> : null}
      {success ? (
        <div className="delivery-alert delivery-success">{success}</div>
      ) : null}

      <section className="delivery-metric-grid">
        <Metric label="Assigned" value={statusCounts.assigned} />
        <Metric label="Picked up" value={statusCounts.picked_up} />
        <Metric
          label="Out for delivery"
          value={statusCounts.out_for_delivery}
        />
        <Metric label="Delivered" value={statusCounts.delivered} />
      </section>

      <section className="delivery-filter-row">
        {[
          ["active", "Active"],
          ["assigned", "Assigned"],
          ["picked_up", "Picked up"],
          ["out_for_delivery", "Out for delivery"],
          ["delivered", "Delivered"],
          ["all", "All"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={filter === value ? "delivery-filter-active" : ""}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </section>

      {loading && orders.length === 0 ? (
        <div className="delivery-empty-state">
          <div className="spinner" />
          <p>Loading assigned deliveries</p>
        </div>
      ) : visibleOrders.length === 0 ? (
        <div className="delivery-empty-state">
          <div className="delivery-empty-icon">✓</div>
          <h2>No deliveries here</h2>
          <p>There are no orders matching this delivery filter.</p>
        </div>
      ) : (
        <section className="delivery-order-list">
          {visibleOrders.map((order) => {
            const customer =
              order.user && typeof order.user === "object"
                ? order.user
                : null;

            return (
              <article key={order._id} className="delivery-order-card">
                <div className="delivery-order-heading">
                  <div>
                    <div className="delivery-number-row">
                      <strong>{order.orderNumber}</strong>
                      <span className={`delivery-status status-${order.deliveryStatus}`}>
                        {DELIVERY_LABELS[order.deliveryStatus]}
                      </span>
                    </div>
                    <span>{formatDate(order.createdAt)}</span>
                  </div>

                  <strong className="delivery-order-total">
                    {formatCurrency(order.total)}
                  </strong>
                </div>

                <div className="delivery-info-grid">
                  <div>
                    <span>Customer</span>
                    <strong>{customer?.fullName ?? order.deliveryAddress.fullName}</strong>
                    <p>+91 {customer?.phone ?? order.deliveryAddress.phone}</p>
                  </div>

                  <div>
                    <span>Delivery time</span>
                    <strong>{order.deliverySchedule.deliveryDateLabel}</strong>
                    <p>{order.deliverySchedule.deliverySlot}</p>
                  </div>

                  <div>
                    <span>Payment</span>
                    <strong>
                      {order.paymentMethod === "cod"
                        ? "Collect cash"
                        : "Paid online"}
                    </strong>
                    <p>{formatCurrency(order.total)}</p>
                  </div>
                </div>

                <div className="delivery-address-block">
                  <span>Complete address</span>
                  <p>
                    {order.deliveryAddress.houseDetails},{" "}
                    {order.deliveryAddress.areaDetails}
                    {order.deliveryAddress.landmark
                      ? `, near ${order.deliveryAddress.landmark}`
                      : ""}
                    , {order.deliveryAddress.area}, {order.deliveryAddress.city} –{" "}
                    {order.deliveryAddress.pincode}
                  </p>
                </div>

                <div className="delivery-items-block">
                  <span>Order items</span>
                  {order.items.map((item) => (
                    <div key={item.productId}>
                      <p>
                        {item.quantity} × {item.name}
                      </p>
                      <strong>{formatCurrency(item.lineTotal)}</strong>
                    </div>
                  ))}
                </div>

                <div className="delivery-action-block">
                  {order.deliveryStatus === "assigned" ? (
                    <button
                      type="button"
                      disabled={updatingOrderId === order._id}
                      onClick={() =>
                        void handleStatusChange(order, "picked_up")
                      }
                    >
                      {updatingOrderId === order._id
                        ? "Updating..."
                        : "Mark as picked up"}
                    </button>
                  ) : null}

                  {order.deliveryStatus === "picked_up" ? (
                    <button
                      type="button"
                      disabled={updatingOrderId === order._id}
                      onClick={() =>
                        void handleStatusChange(order, "out_for_delivery")
                      }
                    >
                      {updatingOrderId === order._id
                        ? "Updating..."
                        : "Start delivery"}
                    </button>
                  ) : null}

                  {order.deliveryStatus === "out_for_delivery" ? (
                    <div className="delivery-otp-form">
                      <div>
                        <span>Customer delivery OTP</span>
                        <p>
                          Ask the customer for the 4-digit code shown in their app.
                        </p>
                      </div>

                      <input
                        inputMode="numeric"
                        maxLength={4}
                        value={otpByOrder[order._id] || ""}
                        onChange={(event) =>
                          setOtpByOrder((current) => ({
                            ...current,
                            [order._id]: event.target.value.replace(/\D/g, ""),
                          }))
                        }
                        placeholder="0000"
                      />

                      <button
                        type="button"
                        disabled={updatingOrderId === order._id}
                        onClick={() => void handleOtpVerification(order)}
                      >
                        {updatingOrderId === order._id
                          ? "Verifying..."
                          : "Verify OTP and deliver"}
                      </button>
                    </div>
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
  value: number;
}) {
  return (
    <div className="delivery-metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
