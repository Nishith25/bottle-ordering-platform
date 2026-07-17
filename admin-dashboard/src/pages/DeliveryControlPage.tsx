import {
  type Dispatch,
  type SetStateAction,
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

import {
  fetchAdminDeliveryCashHandoverSummary,
  verifyAdminDeliveryCashHandover,
  type AdminDeliveryCashHandoverBatch,
  type AdminDeliveryCashHandoverResult,
} from "../services/adminDeliveryCashHandoverApi";

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

const EMPTY_HANDOVER_RESULT:
  AdminDeliveryCashHandoverResult = {
    summary: {
      dateId: "",
      notSubmittedCount: 0,
      notSubmittedAmount: 0,
      submittedCount: 0,
      submittedAmount: 0,
      verifiedCount: 0,
      verifiedAmount: 0,
      shortAmount: 0,
      totalRows: 0,
    },

    handoverBatches: [],
    submittedBatches: [],
    notSubmittedBatches: [],
    verifiedBatches: [],
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

const HANDOVER_STATUS_LABELS:
  Record<string, string> = {
    not_submitted:
      "Not submitted",
    submitted:
      "Submitted",
    handed_over:
      "Verified",
    short_collected:
      "Short collected",
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

function getHandoverStatusLabel(status: string) {
  return (
    HANDOVER_STATUS_LABELS[
      status
    ] || status
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
    handoverData,
    setHandoverData,
  ] =
    useState<AdminDeliveryCashHandoverResult>(
      EMPTY_HANDOVER_RESULT
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
    actionBatchId,
    setActionBatchId,
  ] = useState<string | null>(null);

  const [
    noteByOrder,
    setNoteByOrder,
  ] = useState<Record<string, string>>({});

  const [
    receivedAmountByBatch,
    setReceivedAmountByBatch,
  ] = useState<Record<string, string>>({});

  const [
    adminNoteByBatch,
    setAdminNoteByBatch,
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

        setHandoverData(
          EMPTY_HANDOVER_RESULT
        );

        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const [
          result,
          handoverResult,
        ] =
          await Promise.all([
            fetchDeliveryControlSummary(
              token,
              selectedDate
            ),

            fetchAdminDeliveryCashHandoverSummary(
              token,
              selectedDate
            ),
          ]);

        setData(result);
        setHandoverData(
          handoverResult
        );

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

        setReceivedAmountByBatch(
          (currentValues) => {
            const next = {
              ...currentValues,
            };

            for (const batch of handoverResult.submittedBatches) {
              if (
                next[batch.batchId] ===
                undefined
              ) {
                next[batch.batchId] =
                  String(
                    batch.submittedAmount ||
                      batch.expectedAmount ||
                      ""
                  );
              }
            }

            return next;
          }
        );

        setAdminNoteByBatch(
          (currentValues) => {
            const next = {
              ...currentValues,
            };

            for (const batch of handoverResult.handoverBatches) {
              if (
                next[batch.batchId] ===
                undefined
              ) {
                next[batch.batchId] =
                  batch.adminNote ||
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

  async function handleVerifyHandover(
    batch: AdminDeliveryCashHandoverBatch
  ) {
    if (
      !token ||
      actionBatchId
    ) {
      return;
    }

    const receivedAmount =
      Number(
        receivedAmountByBatch[batch.batchId] ||
          batch.submittedAmount ||
          batch.expectedAmount ||
          0
      );

    if (
      !Number.isFinite(receivedAmount) ||
      receivedAmount < 0
    ) {
      setError(
        "Enter a valid received cash amount."
      );

      return;
    }

    const shortAmount =
      Math.max(
        Number(batch.expectedAmount || 0) -
          receivedAmount,
        0
      );

    const confirmed =
      window.confirm(
        shortAmount > 0
          ? `Verify ${batch.batchId} with short amount ${formatCurrency(shortAmount)}?`
          : `Verify ${batch.batchId} as fully received?`
      );

    if (!confirmed) {
      return;
    }

    setActionBatchId(
      batch.batchId
    );

    setError(null);
    setSuccess(null);

    try {
      await verifyAdminDeliveryCashHandover(
        token,
        batch.batchId,
        {
          receivedAmount,

          adminNote:
            adminNoteByBatch[batch.batchId] ||
            "",
        }
      );

      setSuccess(
        shortAmount > 0
          ? `${batch.batchId} verified with short amount ${formatCurrency(shortAmount)}.`
          : `${batch.batchId} verified successfully.`
      );

      await loadControl();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to verify cash handover."
      );
    } finally {
      setActionBatchId(null);
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
            Monitor open pool, accepted orders, partner workload, failed attempts, COD collection, cash handover and stuck deliveries without manually assigning partners.
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
          label="Cash submitted"
          value={formatCurrency(
            handoverData.summary.submittedAmount
          )}
          warning={
            handoverData.summary.submittedAmount >
            0
          }
        />

        <Metric
          label="Cash verified"
          value={formatCurrency(
            handoverData.summary.verifiedAmount
          )}
        />
      </section>

      <CashSettlementPanel
        handoverData={handoverData}
        receivedAmountByBatch={receivedAmountByBatch}
        setReceivedAmountByBatch={setReceivedAmountByBatch}
        adminNoteByBatch={adminNoteByBatch}
        setAdminNoteByBatch={setAdminNoteByBatch}
        actionBatchId={actionBatchId}
        onVerify={handleVerifyHandover}
      />

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

function CashSettlementPanel({
  handoverData,
  receivedAmountByBatch,
  setReceivedAmountByBatch,
  adminNoteByBatch,
  setAdminNoteByBatch,
  actionBatchId,
  onVerify,
}: {
  handoverData: AdminDeliveryCashHandoverResult;
  receivedAmountByBatch: Record<string, string>;
  setReceivedAmountByBatch: Dispatch<
    SetStateAction<Record<string, string>>
  >;
  adminNoteByBatch: Record<string, string>;
  setAdminNoteByBatch: Dispatch<
    SetStateAction<Record<string, string>>
  >;
  actionBatchId: string | null;
  onVerify: (
    batch: AdminDeliveryCashHandoverBatch
  ) => Promise<void>;
}) {
  return (
    <section className="delivery-settlement-card">
      <div className="delivery-settlement-top">
        <div>
          <span>
            CASH SETTLEMENT CENTER
          </span>

          <h3>
            Delivery cash handover
          </h3>

          <p>
            Delivery partners submit COD cash at end shift. Verify received cash here and close the handover as verified or short collected.
          </p>
        </div>

        <strong>
          {handoverData.summary.dateId ||
            "Today"}
        </strong>
      </div>

      <div className="delivery-settlement-metrics">
        <SettlementMetric
          label="Not submitted"
          value={formatCurrency(
            handoverData.summary.notSubmittedAmount
          )}
          count={handoverData.summary.notSubmittedCount}
          warning={
            handoverData.summary.notSubmittedAmount >
            0
          }
        />

        <SettlementMetric
          label="Submitted"
          value={formatCurrency(
            handoverData.summary.submittedAmount
          )}
          count={handoverData.summary.submittedCount}
          warning={
            handoverData.summary.submittedAmount >
            0
          }
        />

        <SettlementMetric
          label="Verified"
          value={formatCurrency(
            handoverData.summary.verifiedAmount
          )}
          count={handoverData.summary.verifiedCount}
        />

        <SettlementMetric
          label="Short amount"
          value={formatCurrency(
            handoverData.summary.shortAmount
          )}
          count={0}
          danger={
            handoverData.summary.shortAmount >
            0
          }
        />
      </div>

      <div className="delivery-control-section-heading compact">
        <div>
          <span>
            PENDING ADMIN VERIFICATION
          </span>

          <h3>
            Submitted handovers
          </h3>

          <p>
            Verify only after physically receiving the delivery partner’s cash.
          </p>
        </div>

        <strong>
          {handoverData.submittedBatches.length} batches
        </strong>
      </div>

      {handoverData.submittedBatches.length === 0 ? (
        <EmptyState
          title="No submitted cash handovers"
          description="When a delivery partner submits end-shift cash, it will appear here for admin verification."
        />
      ) : (
        <section className="delivery-settlement-batch-grid">
          {handoverData.submittedBatches.map(
            (batch) => (
              <HandoverBatchCard
                key={batch.batchId}
                batch={batch}
                receivedAmount={
                  receivedAmountByBatch[batch.batchId] ||
                  ""
                }
                setReceivedAmount={(value) =>
                  setReceivedAmountByBatch(
                    (currentValues) => ({
                      ...currentValues,
                      [batch.batchId]:
                        value,
                    })
                  )
                }
                adminNote={
                  adminNoteByBatch[batch.batchId] ||
                  ""
                }
                setAdminNote={(value) =>
                  setAdminNoteByBatch(
                    (currentValues) => ({
                      ...currentValues,
                      [batch.batchId]:
                        value,
                    })
                  )
                }
                actionBatchId={actionBatchId}
                onVerify={onVerify}
                canVerify
              />
            )
          )}
        </section>
      )}

      <div className="delivery-control-section-heading compact">
        <div>
          <span>
            PARTNER NOT SUBMITTED
          </span>

          <h3>
            Collected but not handed over
          </h3>
        </div>

        <strong>
          {handoverData.notSubmittedBatches.length} rows
        </strong>
      </div>

      {handoverData.notSubmittedBatches.length === 0 ? (
        <EmptyState
          title="No unsubmitted cash"
          description="All collected COD cash has either been submitted or verified."
        />
      ) : (
        <section className="delivery-settlement-batch-grid">
          {handoverData.notSubmittedBatches.map(
            (batch) => (
              <HandoverBatchCard
                key={batch.batchId}
                batch={batch}
                receivedAmount=""
                setReceivedAmount={() => {}}
                adminNote=""
                setAdminNote={() => {}}
                actionBatchId={actionBatchId}
                onVerify={onVerify}
              />
            )
          )}
        </section>
      )}

      <div className="delivery-control-section-heading compact">
        <div>
          <span>
            VERIFIED CASH
          </span>

          <h3>
            Completed handovers
          </h3>
        </div>

        <strong>
          {handoverData.verifiedBatches.length} batches
        </strong>
      </div>

      {handoverData.verifiedBatches.length === 0 ? (
        <EmptyState
          title="No verified handovers yet"
          description="Verified or short-collected handovers will appear here."
        />
      ) : (
        <section className="delivery-settlement-batch-grid">
          {handoverData.verifiedBatches.map(
            (batch) => (
              <HandoverBatchCard
                key={batch.batchId}
                batch={batch}
                receivedAmount=""
                setReceivedAmount={() => {}}
                adminNote=""
                setAdminNote={() => {}}
                actionBatchId={actionBatchId}
                onVerify={onVerify}
              />
            )
          )}
        </section>
      )}
    </section>
  );
}

function SettlementMetric({
  label,
  value,
  count,
  warning = false,
  danger = false,
}: {
  label: string;
  value: string;
  count: number;
  warning?: boolean;
  danger?: boolean;
}) {
  return (
    <article
      className={`delivery-settlement-metric ${
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

      {count > 0 ? (
        <p>
          {count} records
        </p>
      ) : null}
    </article>
  );
}

function HandoverBatchCard({
  batch,
  receivedAmount,
  setReceivedAmount,
  adminNote,
  setAdminNote,
  actionBatchId,
  onVerify,
  canVerify = false,
}: {
  batch: AdminDeliveryCashHandoverBatch;
  receivedAmount: string;
  setReceivedAmount: (value: string) => void;
  adminNote: string;
  setAdminNote: (value: string) => void;
  actionBatchId: string | null;
  onVerify: (
    batch: AdminDeliveryCashHandoverBatch
  ) => Promise<void>;
  canVerify?: boolean;
}) {
  const expectedAmount =
    Number(batch.expectedAmount || 0);

  const received =
    Number(
      receivedAmount ||
      batch.receivedAmount ||
      batch.submittedAmount ||
      expectedAmount ||
      0
    );

  const shortAmount =
    canVerify
      ? Math.max(
          expectedAmount - received,
          0
        )
      : Number(batch.shortAmount || 0);

  return (
    <article
      className={`delivery-settlement-batch-card status-${batch.status}`}
    >
      <div className="settlement-batch-top">
        <div>
          <strong>
            {batch.partner.fullName}
          </strong>

          <span>
            {batch.partner.phone ||
              batch.partner.email ||
              "No contact"}
          </span>
        </div>

        <b>
          {getHandoverStatusLabel(batch.status)}
        </b>
      </div>

      <div className="settlement-batch-id">
        {batch.batchId}
      </div>

      <div className="settlement-batch-metrics">
        <div>
          <span>
            Expected
          </span>

          <strong>
            {formatCurrency(batch.expectedAmount)}
          </strong>
        </div>

        <div>
          <span>
            Submitted
          </span>

          <strong>
            {formatCurrency(batch.submittedAmount)}
          </strong>
        </div>

        <div>
          <span>
            Orders
          </span>

          <strong>
            {batch.orderCount}
          </strong>
        </div>

        <div>
          <span>
            Short
          </span>

          <strong>
            {formatCurrency(shortAmount)}
          </strong>
        </div>
      </div>

      {batch.partnerNote ? (
        <p className="settlement-note">
          Partner note: {batch.partnerNote}
        </p>
      ) : null}

      {batch.adminNote ? (
        <p className="settlement-note">
          Admin note: {batch.adminNote}
        </p>
      ) : null}

      {batch.orders.length > 0 ? (
        <div className="settlement-order-list">
          {batch.orders.slice(0, 6).map((order) => (
            <div key={order.id}>
              <span>
                {order.orderNumber}
              </span>

              <strong>
                {formatCurrency(order.amountCollected)}
              </strong>
            </div>
          ))}

          {batch.orders.length > 6 ? (
            <small>
              +{batch.orders.length - 6} more orders
            </small>
          ) : null}
        </div>
      ) : null}

      {canVerify ? (
        <div className="settlement-verify-panel">
          <label>
            Amount received
          </label>

          <input
            inputMode="numeric"
            value={receivedAmount}
            onChange={(event) =>
              setReceivedAmount(
                event.target.value.replace(
                  /[^\d.]/g,
                  ""
                )
              )
            }
            placeholder="Amount received from partner"
          />

          <label>
            Admin note
          </label>

          <input
            value={adminNote}
            onChange={(event) =>
              setAdminNote(
                event.target.value
              )
            }
            placeholder="Optional verification note"
          />

          {shortAmount > 0 ? (
            <div className="settlement-short-warning">
              Short amount: {formatCurrency(shortAmount)}
            </div>
          ) : null}

          <button
            type="button"
            disabled={
              actionBatchId === batch.batchId
            }
            onClick={() => {
              void onVerify(batch);
            }}
          >
            {actionBatchId === batch.batchId
              ? "Verifying..."
              : shortAmount > 0
                ? "Verify as short"
                : "Verify cash received"}
          </button>
        </div>
      ) : null}
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
  setNoteByOrder: Dispatch<
    SetStateAction<Record<string, string>>
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