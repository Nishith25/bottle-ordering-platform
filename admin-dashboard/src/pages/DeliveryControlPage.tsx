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
  fetchDeliveryControlSummary,
  releaseDeliveryOrderToPool,
  saveDeliveryAdminNote,
  type DeliveryControlOrder,
  type DeliveryControlResult,
  type DeliveryControlSummary,
  type DeliveryPartnerSummary,
} from "../services/adminDeliveryControlApi";

import "./deliveryControl.css";

const EMPTY_SUMMARY:
  DeliveryControlSummary = {
    openPoolCount: 0,
    activeDeliveryCount: 0,
    assignedCount: 0,
    pickedUpCount: 0,
    outForDeliveryCount: 0,
    failedAttemptCount: 0,
    deliveredTodayCount: 0,
    deliveredBottleCountToday: 0,
    pendingCodOrderCount: 0,
    pendingCodAmount: 0,
    codCollectedToday: 0,
    pendingCashHandoverAmount: 0,
    pendingCashHandoverCount: 0,
  };

const EMPTY_RESULT:
  DeliveryControlResult = {
    dateId: "",
    summary:
      EMPTY_SUMMARY,
    openPoolOrders: [],
    activeOrders: [],
    failedOrders: [],
    deliveredToday: [],
    partnerSummaries: [],
  };

const DELIVERY_LABELS:
  Record<string, string> = {
    unassigned: "Open pool",
    assigned: "Assigned",
    picked_up: "Picked up",
    out_for_delivery:
      "Out for delivery",
    delivered: "Delivered",
    cancelled: "Cancelled",
  };

const FAILURE_REASONS:
  Record<string, string> = {
    customer_not_available:
      "Customer not available",
    customer_no_response:
      "No response",
    wrong_address:
      "Wrong address",
    payment_issue:
      "Payment issue",
    otp_issue:
      "OTP issue",
    customer_requested_later:
      "Requested later",
    vehicle_issue:
      "Vehicle issue",
    other:
      "Other",
  };

function getTodayDateId() {
  return new Date()
    .toLocaleDateString(
      "en-CA",
      {
        timeZone:
          "Asia/Kolkata",
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

  const parsed =
    new Date(value);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return "Unavailable";
  }

  return parsed.toLocaleString(
    "en-IN",
    {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    }
  );
}

function getUserName(
  value:
    | DeliveryControlOrder["user"]
    | DeliveryControlOrder["deliveryPartner"]
) {
  if (
    value &&
    typeof value === "object"
  ) {
    return (
      value.fullName ||
      "Unknown"
    );
  }

  return "Unknown";
}

function getUserPhone(
  value:
    | DeliveryControlOrder["user"]
    | DeliveryControlOrder["deliveryPartner"]
) {
  if (
    value &&
    typeof value === "object"
  ) {
    return value.phone || "";
  }

  return "";
}

function getAddress(order: DeliveryControlOrder) {
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

function getDeliveryTime(order: DeliveryControlOrder) {
  return [
    order.deliverySchedule
      ?.deliveryDateLabel,
    order.deliverySchedule
      ?.deliverySlot,
  ]
    .filter(Boolean)
    .join(" · ") || "No slot";
}

function getFailureLabel(value?: string) {
  return (
    FAILURE_REASONS[
      value || ""
    ] || "Failed delivery"
  );
}

function getOrderBottleCount(order: DeliveryControlOrder) {
  return order.items.reduce(
    (total, item) =>
      total +
      Number(item.quantity || 0),
    0
  );
}

export default function DeliveryControlPage() {
  const navigate =
    useNavigate();

  const {
    token,
  } =
    useAdminAuth();

  const [
    selectedDate,
    setSelectedDate,
  ] = useState(
    getTodayDateId()
  );

  const [
    data,
    setData,
  ] =
    useState<DeliveryControlResult>(
      EMPTY_RESULT
    );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    actionOrderId,
    setActionOrderId,
  ] = useState<string | null>(null);

  const [
    noteByOrder,
    setNoteByOrder,
  ] = useState<Record<string, string>>({});

  const [
    error,
    setError,
  ] = useState<string | null>(null);

  const [
    success,
    setSuccess,
  ] = useState<string | null>(null);

  const loadControl =
    useCallback(async () => {
      if (!token) {
        setData(
          EMPTY_RESULT
        );
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result =
          await fetchDeliveryControlSummary(
            token,
            selectedDate
          );

        setData(result);

        setNoteByOrder(
          (currentValues) => {
            const next = {
              ...currentValues,
            };

            const allOrders = [
              ...result.activeOrders,
              ...result.failedOrders,
              ...result.openPoolOrders,
              ...result.deliveredToday,
            ];

            for (const order of allOrders) {
              if (
                next[order._id] ===
                undefined
              ) {
                next[order._id] =
                  order.deliveryAdminNote ||
                  "";
              }
            }

            return next;
          }
        );
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load delivery control center."
        );
      } finally {
        setLoading(false);
      }
    }, [
      token,
      selectedDate,
    ]);

  useEffect(() => {
    void loadControl();
  }, [
    loadControl,
  ]);

  const pendingCodPartnerRows =
    useMemo(
      () =>
        data.partnerSummaries.filter(
          (row) =>
            row.pendingCodAmount >
              0 ||
            row.codCollectedToday >
              0
        ),
      [
        data.partnerSummaries,
      ]
    );

  async function handleRelease(order: DeliveryControlOrder) {
    if (
      !token ||
      actionOrderId
    ) {
      return;
    }

    const reason =
      window.prompt(
        `Why are you releasing ${order.orderNumber} back to the open pool?`,
        order.lastDeliveryAttemptStatus ===
          "failed"
          ? "Failed delivery retry needs another partner"
          : "Delivery partner unavailable / stuck order"
      );

    if (
      reason === null
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Release ${order.orderNumber} back to open delivery pool? Another delivery partner will be able to accept it.`
      );

    if (!confirmed) {
      return;
    }

    setActionOrderId(
      order._id
    );
    setError(null);
    setSuccess(null);

    try {
      await releaseDeliveryOrderToPool(
        token,
        order._id,
        reason
      );

      setSuccess(
        `${order.orderNumber} released back to open delivery pool.`
      );

      await loadControl();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to release delivery order."
      );
    } finally {
      setActionOrderId(null);
    }
  }

  async function handleSaveNote(order: DeliveryControlOrder) {
    if (
      !token ||
      actionOrderId
    ) {
      return;
    }

    setActionOrderId(
      order._id
    );
    setError(null);
    setSuccess(null);

    try {
      await saveDeliveryAdminNote(
        token,
        order._id,
        noteByOrder[order._id] || ""
      );

      setSuccess(
        `${order.orderNumber} admin note saved.`
      );

      await loadControl();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to save admin note."
      );
    } finally {
      setActionOrderId(null);
    }
  }

  function openOrder(order: DeliveryControlOrder) {
    navigate(
      `/orders?search=${encodeURIComponent(
        order.orderNumber
      )}`
    );
  }

  return (
    <div className="delivery-control-page">
      <section className="delivery-control-hero">
        <div>
          <span>
            DELIVERY CONTROL
          </span>

          <h2>
            Delivery Control Center
          </h2>

          <p>
            Monitor open delivery pool, accepted orders, partner workload, failed attempts, COD collection and stuck deliveries without manually assigning partners.
          </p>
        </div>

        <div className="delivery-control-actions">
          <input
            type="date"
            value={selectedDate}
            onChange={(event) =>
              setSelectedDate(
                event.target.value
              )
            }
          />

          <button
            type="button"
            disabled={loading}
            onClick={() => {
              void loadControl();
            }}
          >
            {loading
              ? "Refreshing..."
              : "Refresh"}
          </button>
        </div>
      </section>

      {error ? (
        <div className="delivery-control-error">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="delivery-control-success">
          {success}
        </div>
      ) : null}

      <section className="delivery-control-metrics">
        <Metric
          label="Open pool"
          value={data.summary.openPoolCount}
        />

        <Metric
          label="Active accepted"
          value={data.summary.activeDeliveryCount}
        />

        <Metric
          label="Assigned"
          value={data.summary.assignedCount}
        />

        <Metric
          label="Picked up"
          value={data.summary.pickedUpCount}
        />

        <Metric
          label="Out for delivery"
          value={data.summary.outForDeliveryCount}
        />

        <Metric
          label="Failed attempts"
          value={data.summary.failedAttemptCount}
          danger={
            data.summary.failedAttemptCount >
            0
          }
        />

        <Metric
          label="Delivered today"
          value={data.summary.deliveredTodayCount}
        />

        <Metric
          label="COD pending"
          value={formatCurrency(
            data.summary.pendingCodAmount
          )}
          warning={
            data.summary.pendingCodAmount >
            0
          }
        />

        <Metric
          label="COD collected"
          value={formatCurrency(
            data.summary.codCollectedToday
          )}
        />

        <Metric
          label="Cash handover"
          value={formatCurrency(
            data.summary.pendingCashHandoverAmount
          )}
          warning={
            data.summary.pendingCashHandoverAmount >
            0
          }
        />
      </section>

      <section className="delivery-control-section-heading">
        <div>
          <span>
            PARTNER WORKLOAD
          </span>

          <h3>
            Active deliveries by partner
          </h3>
        </div>

        <strong>
          {data.partnerSummaries.length} partners
        </strong>
      </section>

      {data.partnerSummaries.length === 0 ? (
        <EmptyState
          title="No active partner workload"
          description="When delivery partners accept orders, their active workload will appear here."
        />
      ) : (
        <section className="delivery-partner-grid">
          {data.partnerSummaries.map(
            (partnerRow) => (
              <PartnerCard
                key={
                  partnerRow.partner.id ||
                  partnerRow.partner.fullName
                }
                row={partnerRow}
              />
            )
          )}
        </section>
      )}

      <OrderSection
        title="Accepted delivery orders"
        eyebrow="ACTIVE CONTROL"
        description="These orders are already accepted by delivery partners. Release stuck orders back to the pool if needed."
        orders={data.activeOrders}
        emptyTitle="No accepted delivery orders"
        emptyDescription="Accepted delivery orders will appear here after a delivery partner accepts from the open pool."
        noteByOrder={noteByOrder}
        setNoteByOrder={setNoteByOrder}
        actionOrderId={actionOrderId}
        onOpen={openOrder}
        onRelease={handleRelease}
        onSaveNote={handleSaveNote}
        showRelease
      />

      <OrderSection
        title="Open delivery pool"
        eyebrow="UNASSIGNED POOL"
        description="These orders are visible to all delivery partners. The first partner who accepts gets locked to the order."
        orders={data.openPoolOrders}
        emptyTitle="No open delivery orders"
        emptyDescription="New paid/COD active orders will appear here automatically."
        noteByOrder={noteByOrder}
        setNoteByOrder={setNoteByOrder}
        actionOrderId={actionOrderId}
        onOpen={openOrder}
        onRelease={handleRelease}
        onSaveNote={handleSaveNote}
      />

      <OrderSection
        title="Failed delivery attempts"
        eyebrow="ATTENTION REQUIRED"
        description="Failed attempts stay visible here so admin can decide whether to release to the pool or monitor retry."
        orders={data.failedOrders}
        emptyTitle="No failed delivery attempts"
        emptyDescription="Failed deliveries reported by delivery partners will appear here."
        noteByOrder={noteByOrder}
        setNoteByOrder={setNoteByOrder}
        actionOrderId={actionOrderId}
        onOpen={openOrder}
        onRelease={handleRelease}
        onSaveNote={handleSaveNote}
        showRelease
        danger
      />

      <section className="delivery-control-section-heading">
        <div>
          <span>
            COD CONTROL
          </span>

          <h3>
            Partner cash status
          </h3>
        </div>

        <strong>
          {pendingCodPartnerRows.length} rows
        </strong>
      </section>

      {pendingCodPartnerRows.length === 0 ? (
        <EmptyState
          title="No COD pending right now"
          description="COD collection by partner will appear here after accepted COD deliveries."
        />
      ) : (
        <section className="delivery-cod-table">
          {pendingCodPartnerRows.map(
            (row) => (
              <article
                key={
                  row.partner.id ||
                  row.partner.fullName
                }
              >
                <div>
                  <strong>
                    {row.partner.fullName}
                  </strong>

                  <span>
                    {row.partner.phone ||
                      row.partner.email ||
                      "No contact"}
                  </span>
                </div>

                <div>
                  <span>
                    Pending COD
                  </span>

                  <strong>
                    {formatCurrency(
                      row.pendingCodAmount
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Pending orders
                  </span>

                  <strong>
                    {row.pendingCodCount}
                  </strong>
                </div>

                <div>
                  <span>
                    Collected today
                  </span>

                  <strong>
                    {formatCurrency(
                      row.codCollectedToday
                    )}
                  </strong>
                </div>
              </article>
            )
          )}
        </section>
      )}

      <OrderSection
        title="Delivered today"
        eyebrow="COMPLETED"
        description="Completed delivery records for the selected date."
        orders={data.deliveredToday}
        emptyTitle="No deliveries completed today"
        emptyDescription="Delivered orders will appear here after OTP completion."
        noteByOrder={noteByOrder}
        setNoteByOrder={setNoteByOrder}
        actionOrderId={actionOrderId}
        onOpen={openOrder}
        onRelease={handleRelease}
        onSaveNote={handleSaveNote}
      />
    </div>
  );
}

function Metric({
  label,
  value,
  warning = false,
  danger = false,
}: {
  label: string;
  value: number | string;
  warning?: boolean;
  danger?: boolean;
}) {
  return (
    <article
      className={`delivery-control-metric ${
        danger
          ? "danger"
          : warning
            ? "warning"
            : ""
      }`}
    >
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </article>
  );
}

function PartnerCard({
  row,
}: {
  row: DeliveryPartnerSummary;
}) {
  return (
    <article className="delivery-partner-card">
      <div className="delivery-partner-card-top">
        <div>
          <strong>
            {row.partner.fullName}
          </strong>

          <span>
            {row.partner.phone ||
              row.partner.email ||
              "No contact"}
          </span>
        </div>

        <b>
          {row.activeCount}
        </b>
      </div>

      <div className="delivery-partner-stats">
        <span>
          Assigned <b>{row.assignedCount}</b>
        </span>

        <span>
          Picked <b>{row.pickedUpCount}</b>
        </span>

        <span>
          OFD <b>{row.outForDeliveryCount}</b>
        </span>

        <span>
          Failed <b>{row.failedAttemptCount}</b>
        </span>
      </div>

      <div className="delivery-partner-money">
        <div>
          <span>
            Pending COD
          </span>

          <strong>
            {formatCurrency(row.pendingCodAmount)}
          </strong>
        </div>

        <div>
          <span>
            Collected today
          </span>

          <strong>
            {formatCurrency(row.codCollectedToday)}
          </strong>
        </div>
      </div>
    </article>
  );
}

function OrderSection({
  eyebrow,
  title,
  description,
  orders,
  emptyTitle,
  emptyDescription,
  noteByOrder,
  setNoteByOrder,
  actionOrderId,
  onOpen,
  onRelease,
  onSaveNote,
  showRelease = false,
  danger = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  orders: DeliveryControlOrder[];
  emptyTitle: string;
  emptyDescription: string;
  noteByOrder: Record<string, string>;
  setNoteByOrder: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  actionOrderId: string | null;
  onOpen: (order: DeliveryControlOrder) => void;
  onRelease: (order: DeliveryControlOrder) => Promise<void>;
  onSaveNote: (order: DeliveryControlOrder) => Promise<void>;
  showRelease?: boolean;
  danger?: boolean;
}) {
  return (
    <>
      <section className="delivery-control-section-heading">
        <div>
          <span>
            {eyebrow}
          </span>

          <h3>
            {title}
          </h3>

          <p>
            {description}
          </p>
        </div>

        <strong>
          {orders.length} orders
        </strong>
      </section>

      {orders.length === 0 ? (
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
        />
      ) : (
        <section className="delivery-control-order-grid">
          {orders.map((order) => (
            <OrderCard
              key={order._id}
              order={order}
              note={
                noteByOrder[order._id] || ""
              }
              setNote={(value) =>
                setNoteByOrder(
                  (currentValues) => ({
                    ...currentValues,
                    [order._id]:
                      value,
                  })
                )
              }
              actionOrderId={actionOrderId}
              onOpen={onOpen}
              onRelease={onRelease}
              onSaveNote={onSaveNote}
              showRelease={showRelease}
              danger={danger}
            />
          ))}
        </section>
      )}
    </>
  );
}

function OrderCard({
  order,
  note,
  setNote,
  actionOrderId,
  onOpen,
  onRelease,
  onSaveNote,
  showRelease,
  danger,
}: {
  order: DeliveryControlOrder;
  note: string;
  setNote: (value: string) => void;
  actionOrderId: string | null;
  onOpen: (order: DeliveryControlOrder) => void;
  onRelease: (order: DeliveryControlOrder) => Promise<void>;
  onSaveNote: (order: DeliveryControlOrder) => Promise<void>;
  showRelease: boolean;
  danger: boolean;
}) {
  const isBusy =
    actionOrderId === order._id;

  const partnerName =
    getUserName(order.deliveryPartner);

  const customerName =
    getUserName(order.user) === "Unknown"
      ? order.deliveryAddress.fullName
      : getUserName(order.user);

  const customerPhone =
    getUserPhone(order.user) ||
    order.deliveryAddress.phone;

  return (
    <article
      className={`delivery-control-order-card ${
        danger ? "danger" : ""
      }`}
    >
      <div className="delivery-control-order-top">
        <div>
          <div className="delivery-control-order-number">
            <strong>
              {order.orderNumber}
            </strong>

            <span>
              {DELIVERY_LABELS[
                order.deliveryStatus
              ] || order.deliveryStatus}
            </span>
          </div>

          <small>
            Created {formatDate(order.createdAt)}
          </small>
        </div>

        <b>
          {formatCurrency(order.total)}
        </b>
      </div>

      {order.lastDeliveryAttemptStatus === "failed" ? (
        <div className="delivery-control-failed-box">
          <strong>
            Failed: {getFailureLabel(order.failedDeliveryReason)}
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

      <div className="delivery-control-info-grid">
        <div>
          <span>
            Customer
          </span>

          <strong>
            {customerName}
          </strong>

          <p>
            +91 {customerPhone}
          </p>
        </div>

        <div>
          <span>
            Delivery partner
          </span>

          <strong>
            {partnerName}
          </strong>

          <p>
            {getUserPhone(order.deliveryPartner) || "Not accepted"}
          </p>
        </div>

        <div>
          <span>
            Delivery slot
          </span>

          <strong>
            {getDeliveryTime(order)}
          </strong>

          <p>
            {getOrderBottleCount(order)} bottles
          </p>
        </div>

        <div>
          <span>
            Payment
          </span>

          <strong>
            {order.paymentMethod === "cod"
              ? "COD"
              : "Online"}
          </strong>

          <p>
            {order.paymentStatus}
          </p>
        </div>
      </div>

      <div className="delivery-control-address">
        <span>
          Address
        </span>

        <p>
          {getAddress(order)}
        </p>
      </div>

      <div className="delivery-control-timeline">
        <TimelineItem
          label="Accepted"
          value={order.deliveryAcceptedAt || order.deliveryAssignedAt}
        />

        <TimelineItem
          label="Picked up"
          value={order.pickedUpAt}
        />

        <TimelineItem
          label="Out for delivery"
          value={order.outForDeliveryAt}
        />

        <TimelineItem
          label="Delivered"
          value={order.deliveryCompletedAt || order.deliveredAt}
        />
      </div>

      <div className="delivery-control-note-box">
        <label>
          Admin note
        </label>

        <textarea
          value={note}
          onChange={(event) =>
            setNote(event.target.value)
          }
          placeholder="Add an admin note for this delivery order..."
        />

        {order.deliveryPartnerNote ? (
          <p>
            Partner note: {order.deliveryPartnerNote}
          </p>
        ) : null}
      </div>

      <div className="delivery-control-order-actions">
        <button
          type="button"
          onClick={() =>
            onOpen(order)
          }
        >
          Open order
        </button>

        <button
          type="button"
          disabled={isBusy}
          onClick={() => {
            void onSaveNote(order);
          }}
        >
          {isBusy
            ? "Saving..."
            : "Save note"}
        </button>

        {showRelease ? (
          <button
            type="button"
            className="release"
            disabled={isBusy}
            onClick={() => {
              void onRelease(order);
            }}
          >
            {isBusy
              ? "Releasing..."
              : "Release to pool"}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function TimelineItem({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div>
      <span>
        {label}
      </span>

      <strong>
        {value
          ? formatDate(value)
          : "—"}
      </strong>
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="delivery-control-empty">
      <span>
        ✓
      </span>

      <div>
        <strong>
          {title}
        </strong>

        <p>
          {description}
        </p>
      </div>
    </div>
  );
}