import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  useAdminAuth,
} from "../context/AuthContext";

import {
  fetchAdminSubscriptionCharges,
  retryAdminSubscriptionCharge,
  type AdminSubscriptionCharge,
} from "../services/adminSubscriptionChargesApi";

import "./subscriptionChargesPanel.css";

function formatCurrencyFromPaise(
  value: number
) {
  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }
  ).format(
    Number(value || 0) /
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

  return charge.orderNumber || "";
}

export default function SubscriptionChargesPanel({
  subscriptionId,
}: {
  subscriptionId: string;
}) {
  const navigate =
    useNavigate();

  const {
    token,
  } = useAdminAuth();

  const [
    charges,
    setCharges,
  ] =
    useState<
      AdminSubscriptionCharge[]
    >([]);

  const [
    total,
    setTotal,
  ] = useState(0);

  const [
    loading,
    setLoading,
  ] = useState(true);

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
      async () => {
        if (
          !token ||
          !subscriptionId
        ) {
          setLoading(false);
          return;
        }

        setError(null);

        try {
          const result =
            await fetchAdminSubscriptionCharges(
              token,
              {
                subscriptionId,
                page: 1,
                limit: 5,
              }
            );

          setCharges(
            result.charges
          );

          setTotal(
            result.pagination.total
          );
        } catch (requestError) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load recurring payments."
          );
        } finally {
          setLoading(false);
        }
      },
      [
        token,
        subscriptionId,
      ]
    );

  useEffect(() => {
    void loadCharges();
  }, [loadCharges]);

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
          `Retry fulfilment for ${charge.razorpayPaymentId}?`
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
                "Fulfilment was processed."
        );

        await loadCharges();
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to retry fulfilment."
        );
      } finally {
        setRetryingChargeId(
          null
        );
      }
    };

  return (
    <section className="subscription-charge-panel">
      <div className="subscription-charge-panel-heading">
        <div>
          <span>
            RAZORPAY PAYMENT HISTORY
          </span>

          <h3>
            Recurring payments
          </h3>

          <p>
            {total} recurring payment
            record
            {total === 1
              ? ""
              : "s"}
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            navigate(
              `/subscription-charges?subscriptionId=${encodeURIComponent(
                subscriptionId
              )}`
            )
          }
        >
          View all
        </button>
      </div>

      {error ? (
        <div className="subscription-charge-panel-error">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="subscription-charge-panel-success">
          {success}
        </div>
      ) : null}

      {loading ? (
        <div className="subscription-charge-panel-state">
          Loading recurring payments...
        </div>
      ) : charges.length === 0 ? (
        <div className="subscription-charge-panel-state">
          No recurring payment records
          have been received yet.
        </div>
      ) : (
        <div className="subscription-charge-panel-list">
          {charges.map(
            (charge) => {
              const orderNumber =
                getOrderNumber(
                  charge
                );

              return (
                <article
                  key={charge._id}
                  className="subscription-charge-panel-card"
                >
                  <div>
                    <strong>
                      {
                        charge.razorpayPaymentId
                      }
                    </strong>

                    <span>
                      {formatCurrencyFromPaise(
                        charge.amountPaise
                      )}{" "}
                      ·{" "}
                      {formatStatus(
                        charge.paymentStatus
                      )}
                    </span>

                    <small>
                      {formatDate(
                        charge.paymentCreatedAt ||
                          charge.createdAt
                      )}
                    </small>
                  </div>

                  <div className="subscription-charge-panel-right">
                    <span
                      className={`subscription-charge-panel-status subscription-charge-panel-status-${charge.processingStatus}`}
                    >
                      {formatStatus(
                        charge.processingStatus
                      )}
                    </span>

                    {orderNumber ? (
                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            `/orders?search=${encodeURIComponent(
                              orderNumber
                            )}`
                          )
                        }
                      >
                        {orderNumber}
                      </button>
                    ) : null}

                    {charge.processingStatus ===
                    "fulfillment_failed" ? (
                      <button
                        type="button"
                        className="subscription-charge-panel-retry"
                        disabled={
                          retryingChargeId ===
                          charge._id
                        }
                        onClick={() => {
                          void retryCharge(
                            charge
                          );
                        }}
                      >
                        {retryingChargeId ===
                        charge._id
                          ? "Retrying..."
                          : "Retry fulfilment"}
                      </button>
                    ) : null}
                  </div>

                  {charge.failureReason ? (
                    <p className="subscription-charge-panel-failure">
                      {
                        charge.failureReason
                      }
                    </p>
                  ) : null}
                </article>
              );
            }
          )}
        </div>
      )}
    </section>
  );
}