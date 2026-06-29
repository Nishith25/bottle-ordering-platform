import {
  type FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import {
  useAdminAuth,
} from "../context/AuthContext";

import {
  fetchAdminSubscriptionCharges,
  retryAdminSubscriptionCharge,
  type AdminSubscriptionCharge,
  type SubscriptionChargeProcessingStatus,
  type SubscriptionChargeSummary,
} from "../services/adminSubscriptionChargesApi";

import "./subscriptionCharges.css";

const EMPTY_SUMMARY:
  SubscriptionChargeSummary = {
    totalCharges: 0,
    fulfilled: 0,
    fulfillmentFailed: 0,
    ignored: 0,
    processing: 0,
    collectedAmountPaise: 0,
  };

function formatCurrencyFromPaise(
  amountPaise: number
) {
  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }
  ).format(
    Number(amountPaise || 0) /
      100
  );
}

function formatDate(
  value?: string | null
) {
  if (!value) {
    return "Unavailable";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Unavailable";
  }

  return date.toLocaleString(
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

function formatStatus(
  value?: string
) {
  if (!value) {
    return "Unavailable";
  }

  return value
    .replace(/_/g, " ")
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}

function getErrorMessage(
  error: unknown,
  fallback: string
) {
  return error instanceof Error
    ? error.message
    : fallback;
}

function getUserName(
  charge:
    AdminSubscriptionCharge
) {
  if (
    charge.user &&
    typeof charge.user ===
      "object"
  ) {
    return (
      charge.user.fullName ||
      charge.user.email ||
      "Customer"
    );
  }

  return "Customer";
}

function getLocalSubscriptionId(
  charge:
    AdminSubscriptionCharge
) {
  if (
    typeof charge.localSubscription ===
    "string"
  ) {
    return charge.localSubscription;
  }

  return charge.localSubscription._id;
}

function getOrderNumber(
  charge:
    AdminSubscriptionCharge
) {
  if (
    charge.order &&
    typeof charge.order ===
      "object"
  ) {
    return charge.order.orderNumber;
  }

  return (
    charge.orderNumber ||
    ""
  );
}

export default function SubscriptionChargesPage() {
  const navigate =
    useNavigate();

  const [
    searchParams,
    setSearchParams,
  ] = useSearchParams();

  const {
    token,
  } = useAdminAuth();

  const subscriptionId =
    searchParams.get(
      "subscriptionId"
    ) || "";

  const [
    charges,
    setCharges,
  ] =
    useState<
      AdminSubscriptionCharge[]
    >([]);

  const [
    summary,
    setSummary,
  ] =
    useState<SubscriptionChargeSummary>(
      EMPTY_SUMMARY
    );

  const [
    page,
    setPage,
  ] = useState(1);

  const [
    totalPages,
    setTotalPages,
  ] = useState(1);

  const [
    total,
    setTotal,
  ] = useState(0);

  const [
    searchInput,
    setSearchInput,
  ] = useState("");

  const [
    appliedSearch,
    setAppliedSearch,
  ] = useState("");

  const [
    processingStatus,
    setProcessingStatus,
  ] =
    useState<
      | SubscriptionChargeProcessingStatus
      | "all"
    >("all");

  const [
    paymentStatus,
    setPaymentStatus,
  ] = useState("all");

  const [
    dateFrom,
    setDateFrom,
  ] = useState("");

  const [
    dateTo,
    setDateTo,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    retryingChargeId,
    setRetryingChargeId,
  ] =
    useState<string | null>(
      null
    );

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );

  const [
    success,
    setSuccess,
  ] =
    useState<string | null>(
      null
    );

  const loadCharges =
    useCallback(
      async (
        showMainLoader =
          false
      ) => {
        if (!token) {
          setLoading(false);
          return;
        }

        if (showMainLoader) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }

        setError(null);

        try {
          const result =
            await fetchAdminSubscriptionCharges(
              token,
              {
                subscriptionId:
                  subscriptionId ||
                  undefined,

                processingStatus,

                paymentStatus,

                search:
                  appliedSearch,

                dateFrom,

                dateTo,

                page,

                limit: 20,
              }
            );

          setCharges(
            result.charges
          );

          setSummary(
            result.summary
          );

          setTotal(
            result.pagination.total
          );

          setTotalPages(
            result.pagination
              .totalPages
          );
        } catch (requestError) {
          setError(
            getErrorMessage(
              requestError,
              "Unable to load recurring payments."
            )
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [
        token,
        subscriptionId,
        processingStatus,
        paymentStatus,
        appliedSearch,
        dateFrom,
        dateTo,
        page,
      ]
    );

  useEffect(() => {
    void loadCharges(true);
  }, [loadCharges]);

  const submitSearch = (
    event:
      FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setPage(1);

    setAppliedSearch(
      searchInput.trim()
    );
  };

  const clearFilters =
    () => {
      setSearchInput("");
      setAppliedSearch("");
      setProcessingStatus(
        "all"
      );
      setPaymentStatus("all");
      setDateFrom("");
      setDateTo("");
      setPage(1);

      if (subscriptionId) {
        const nextParams =
          new URLSearchParams(
            searchParams
          );

        nextParams.delete(
          "subscriptionId"
        );

        setSearchParams(
          nextParams
        );
      }
    };

  const retryCharge =
    async (
      charge:
        AdminSubscriptionCharge
    ) => {
      if (
        !token ||
        retryingChargeId
      ) {
        return;
      }

      const confirmed =
        window.confirm(
          `Retry fulfilment for ${charge.razorpayPaymentId}? Inventory will be reserved and an order will be created if all products are available.`
        );

      if (!confirmed) {
        return;
      }

      setRetryingChargeId(
        charge._id
      );

      setError(null);
      setSuccess(null);

      try {
        const result =
          await retryAdminSubscriptionCharge(
            token,
            charge._id
          );

        setSuccess(
          result.orderNumber
            ? `${result.orderNumber} was created successfully.`
            : result.reason ||
                "Recurring-payment fulfilment was processed."
        );

        await loadCharges(
          false
        );
      } catch (requestError) {
        setError(
          getErrorMessage(
            requestError,
            "Unable to retry fulfilment."
          )
        );
      } finally {
        setRetryingChargeId(
          null
        );
      }
    };

  return (
    <div className="subscription-charges-page">
      <div className="subscription-charges-heading">
        <div>
          <span className="subscription-charges-eyebrow">
            RAZORPAY OPERATIONS
          </span>

          <h2>
            Recurring payments
          </h2>

          <p>
            Monitor Razorpay
            subscription charges,
            generated orders and
            fulfilment failures.
          </p>
        </div>

        <button
          type="button"
          className="charge-secondary-button"
          disabled={refreshing}
          onClick={() => {
            void loadCharges(false);
          }}
        >
          {refreshing
            ? "Refreshing..."
            : "Refresh payments"}
        </button>
      </div>

      {subscriptionId ? (
        <div className="charge-filter-notice">
          <span>
            Showing charges for one
            subscription
          </span>

          <button
            type="button"
            onClick={() => {
              const nextParams =
                new URLSearchParams(
                  searchParams
                );

              nextParams.delete(
                "subscriptionId"
              );

              setSearchParams(
                nextParams
              );
            }}
          >
            View all recurring payments
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="charge-inline-error">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="charge-inline-success">
          {success}
        </div>
      ) : null}

      <div className="charge-summary-grid">
        <ChargeSummaryCard
          label="Total charges"
          value={String(
            summary.totalCharges
          )}
          description="Matching payment records"
        />

        <ChargeSummaryCard
          label="Fulfilled"
          value={String(
            summary.fulfilled
          )}
          description="Orders created successfully"
          tone="positive"
        />

        <ChargeSummaryCard
          label="Fulfilment failed"
          value={String(
            summary.fulfillmentFailed
          )}
          description="Requires admin attention"
          tone="negative"
        />

        <ChargeSummaryCard
          label="Processing"
          value={String(
            summary.processing
          )}
          description="Received or processing"
          tone="warning"
        />

        <ChargeSummaryCard
          label="Collected amount"
          value={formatCurrencyFromPaise(
            summary.collectedAmountPaise
          )}
          description="Captured recurring charges"
        />
      </div>

      <form
        className="charge-filter-card"
        onSubmit={submitSearch}
      >
        <div className="charge-filter-heading">
          <div>
            <h3>
              Find recurring payments
            </h3>

            <p>
              Search by Razorpay payment,
              subscription, plan, order or
              failure reason.
            </p>
          </div>

          <button
            type="button"
            className="charge-text-button"
            onClick={clearFilters}
          >
            Clear filters
          </button>
        </div>

        <div className="charge-filter-grid">
          <label className="charge-search-field">
            Search

            <input
              type="search"
              value={searchInput}
              placeholder="Payment ID, subscription or order"
              onChange={(event) =>
                setSearchInput(
                  event.target.value
                )
              }
            />
          </label>

          <label>
            Fulfilment status

            <select
              value={
                processingStatus
              }
              onChange={(event) => {
                setPage(1);

                setProcessingStatus(
                  event.target
                    .value as
                    | SubscriptionChargeProcessingStatus
                    | "all"
                );
              }}
            >
              <option value="all">
                All statuses
              </option>

              <option value="received">
                Received
              </option>

              <option value="processing">
                Processing
              </option>

              <option value="fulfilled">
                Fulfilled
              </option>

              <option value="fulfillment_failed">
                Fulfilment failed
              </option>

              <option value="ignored">
                Ignored
              </option>
            </select>
          </label>

          <label>
            Payment status

            <select
              value={paymentStatus}
              onChange={(event) => {
                setPage(1);

                setPaymentStatus(
                  event.target.value
                );
              }}
            >
              <option value="all">
                All payment statuses
              </option>

              <option value="captured">
                Captured
              </option>

              <option value="authorized">
                Authorised
              </option>

              <option value="failed">
                Failed
              </option>

              <option value="created">
                Created
              </option>
            </select>
          </label>

          <label>
            From date

            <input
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setPage(1);
                setDateFrom(
                  event.target.value
                );
              }}
            />
          </label>

          <label>
            To date

            <input
              type="date"
              value={dateTo}
              onChange={(event) => {
                setPage(1);
                setDateTo(
                  event.target.value
                );
              }}
            />
          </label>

          <button
            type="submit"
            className="charge-search-button"
          >
            Search
          </button>
        </div>
      </form>

      <div className="charge-records-heading">
        <div>
          <h3>
            Payment records
          </h3>

          <p>
            Showing {charges.length} of{" "}
            {total} recurring charges
          </p>
        </div>
      </div>

      {loading ? (
        <div className="charge-state-card">
          <div className="charge-spinner" />

          <h3>
            Loading recurring payments
          </h3>

          <p>
            Fetching the latest Razorpay
            charge and fulfilment records.
          </p>
        </div>
      ) : charges.length === 0 ? (
        <div className="charge-state-card">
          <h3>
            No recurring charges found
          </h3>

          <p>
            Charge records will appear
            after Razorpay sends a
            subscription payment event.
          </p>
        </div>
      ) : (
        <div className="charge-list">
          {charges.map(
            (charge) => (
              <ChargeCard
                key={charge._id}
                charge={charge}
                retrying={
                  retryingChargeId ===
                  charge._id
                }
                onRetry={() => {
                  void retryCharge(
                    charge
                  );
                }}
                onOpenSubscription={() =>
                  navigate(
                    `/subscriptions/${getLocalSubscriptionId(
                      charge
                    )}`
                  )
                }
                onOpenOrder={() => {
                  const orderNumber =
                    getOrderNumber(
                      charge
                    );

                  if (orderNumber) {
                    navigate(
                      `/orders?search=${encodeURIComponent(
                        orderNumber
                      )}`
                    );
                  }
                }}
              />
            )
          )}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="charge-pagination">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() =>
              setPage(
                (currentPage) =>
                  Math.max(
                    1,
                    currentPage - 1
                  )
              )
            }
          >
            Previous
          </button>

          <span>
            Page {page} of{" "}
            {totalPages}
          </span>

          <button
            type="button"
            disabled={
              page >= totalPages
            }
            onClick={() =>
              setPage(
                (currentPage) =>
                  Math.min(
                    totalPages,
                    currentPage + 1
                  )
              )
            }
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ChargeSummaryCard({
  label,
  value,
  description,
  tone = "default",
}: {
  label: string;
  value: string;
  description: string;

  tone?:
    | "default"
    | "positive"
    | "warning"
    | "negative";
}) {
  return (
    <article
      className={`charge-summary-card charge-summary-${tone}`}
    >
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>

      <p>
        {description}
      </p>
    </article>
  );
}

function ChargeCard({
  charge,
  retrying,
  onRetry,
  onOpenSubscription,
  onOpenOrder,
}: {
  charge:
    AdminSubscriptionCharge;

  retrying: boolean;

  onRetry: () => void;
  onOpenSubscription: () => void;
  onOpenOrder: () => void;
}) {
  const orderNumber =
    getOrderNumber(charge);

  const amountDifferent =
    charge.amountPaise !==
    charge.expectedAmountPaise;

  return (
    <article className="charge-card">
      <div className="charge-card-top">
        <div>
          <span className="charge-payment-id">
            {
              charge.razorpayPaymentId
            }
          </span>

          <h3>
            {charge.planName}
          </h3>

          <p>
            {
              charge.subscriptionNumber
            }{" "}
            · {getUserName(charge)}
          </p>
        </div>

        <ChargeStatusBadge
          status={
            charge.processingStatus
          }
        />
      </div>

      <div className="charge-information-grid">
        <ChargeInformation
          label="Charged amount"
          value={formatCurrencyFromPaise(
            charge.amountPaise
          )}
          strong
        />

        <ChargeInformation
          label="Expected amount"
          value={formatCurrencyFromPaise(
            charge.expectedAmountPaise
          )}
        />

        <ChargeInformation
          label="Payment status"
          value={formatStatus(
            charge.paymentStatus
          )}
        />

        <ChargeInformation
          label="Payment method"
          value={formatStatus(
            charge.paymentMethod
          )}
        />

        <ChargeInformation
          label="Payment date"
          value={formatDate(
            charge.paymentCreatedAt ||
              charge.createdAt
          )}
        />

        <ChargeInformation
          label="Processed at"
          value={formatDate(
            charge.processedAt
          )}
        />
      </div>

      {amountDifferent ? (
        <div className="charge-warning-box">
          Charged amount does not match
          the expected subscription cycle
          amount.
        </div>
      ) : null}

      <div className="charge-reference-grid">
        <div>
          <span>
            Razorpay subscription
          </span>

          <strong>
            {
              charge.razorpaySubscriptionId
            }
          </strong>
        </div>

        <div>
          <span>
            Razorpay invoice
          </span>

          <strong>
            {charge.razorpayInvoiceId ||
              "Unavailable"}
          </strong>
        </div>

        <div>
          <span>
            Webhook event
          </span>

          <strong>
            {formatStatus(
              charge.eventType
            )}
          </strong>
        </div>

        <div>
          <span>
            Retry count
          </span>

          <strong>
            {charge.retryCount}
          </strong>
        </div>
      </div>

      {orderNumber ? (
        <div className="charge-order-box">
          <div>
            <span>
              Generated delivery order
            </span>

            <strong>
              {orderNumber}
            </strong>
          </div>

          <button
            type="button"
            onClick={onOpenOrder}
          >
            Open order
          </button>
        </div>
      ) : null}

      {charge.failureReason ? (
        <div className="charge-failure-box">
          <strong>
            {charge.failureCode
              ? formatStatus(
                  charge.failureCode
                )
              : "Processing issue"}
          </strong>

          <p>
            {charge.failureReason}
          </p>
        </div>
      ) : null}

      <div className="charge-card-actions">
        <button
          type="button"
          className="charge-secondary-button"
          onClick={
            onOpenSubscription
          }
        >
          View subscription
        </button>

        {charge.processingStatus ===
        "fulfillment_failed" ? (
          <button
            type="button"
            className="charge-retry-button"
            disabled={retrying}
            onClick={onRetry}
          >
            {retrying
              ? "Retrying..."
              : "Retry fulfilment"}
          </button>
        ) : null}

        <span>
          Updated{" "}
          {formatDate(
            charge.updatedAt
          )}
        </span>
      </div>
    </article>
  );
}

function ChargeStatusBadge({
  status,
}: {
  status:
    SubscriptionChargeProcessingStatus;
}) {
  return (
    <span
      className={`charge-status charge-status-${status}`}
    >
      {formatStatus(status)}
    </span>
  );
}

function ChargeInformation({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="charge-information">
      <span>
        {label}
      </span>

      <strong
        className={
          strong
            ? "charge-information-highlight"
            : ""
        }
      >
        {value}
      </strong>
    </div>
  );
}