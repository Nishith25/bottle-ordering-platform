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
  fetchDueSubscriptionDeliveries,
  generateDueSubscriptionDeliveries,
  generateSingleSubscriptionDelivery,
  type DueSubscriptionDelivery,
  type DueSubscriptionPreview,
  type SubscriptionDeliveryBatchResult,
} from "../services/adminSubscriptionDeliveryApi";

import "./dueSubscriptionDeliveries.css";

const EMPTY_PREVIEW:
  DueSubscriptionPreview = {
    totalDue: 0,
    count: 0,
    dueAt:
      new Date().toISOString(),

    subscriptions: [],
  };

function getErrorMessage(
  error: unknown,
  fallback: string
) {
  return error instanceof Error
    ? error.message
    : fallback;
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

function getCustomer(
  subscription:
    DueSubscriptionDelivery
) {
  if (
    subscription.user &&
    typeof subscription.user ===
      "object"
  ) {
    return {
      fullName:
        subscription.user.fullName ||
        "Customer",

      email:
        subscription.user.email ||
        "",

      phone:
        subscription.user.phone ||
        "",
    };
  }

  return {
    fullName: "Customer",
    email: "",
    phone: "",
  };
}

function getLastOrder(
  subscription:
    DueSubscriptionDelivery
) {
  if (
    subscription.lastDeliveryOrder &&
    typeof subscription.lastDeliveryOrder ===
      "object"
  ) {
    return subscription.lastDeliveryOrder;
  }

  return null;
}

export default function DueSubscriptionDeliveriesPanel() {
  const {
    token,
  } = useAdminAuth();

  const [
    preview,
    setPreview,
  ] =
    useState<DueSubscriptionPreview>(
      EMPTY_PREVIEW
    );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    generatingAll,
    setGeneratingAll,
  ] = useState(false);

  const [
    generatingSubscriptionId,
    setGeneratingSubscriptionId,
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

  const [
    lastBatch,
    setLastBatch,
  ] =
    useState<SubscriptionDeliveryBatchResult | null>(
      null
    );

  const loadDueDeliveries =
    useCallback(async () => {
      if (!token) {
        setPreview(
          EMPTY_PREVIEW
        );

        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result =
          await fetchDueSubscriptionDeliveries(
            token,
            50
          );

        setPreview(result);
      } catch (requestError) {
        setError(
          getErrorMessage(
            requestError,
            "Unable to load due subscription deliveries."
          )
        );
      } finally {
        setLoading(false);
      }
    }, [token]);

  useEffect(() => {
    void loadDueDeliveries();
  }, [loadDueDeliveries]);

  const overdueCount =
    useMemo(
      () =>
        preview.subscriptions.filter(
          (subscription) =>
            Number(
              subscription.overdueByDays ||
                0
            ) > 0
        ).length,
      [preview.subscriptions]
    );

  const failedGenerationCount =
    useMemo(
      () =>
        preview.subscriptions.filter(
          (subscription) =>
            Boolean(
              subscription.lastDeliveryGenerationError
            )
        ).length,
      [preview.subscriptions]
    );

  const handleGenerateAll =
    async () => {
      if (
        !token ||
        generatingAll ||
        preview.totalDue === 0
      ) {
        return;
      }

      const confirmed =
        window.confirm(
          `Generate delivery orders for up to ${Math.min(
            preview.totalDue,
            25
          )} due subscriptions?`
        );

      if (!confirmed) {
        return;
      }

      setGeneratingAll(true);
      setError(null);
      setSuccess(null);
      setLastBatch(null);

      try {
        const result =
          await generateDueSubscriptionDeliveries(
            token,
            25
          );

        setLastBatch(result);

        setSuccess(
          result.createdCount > 0
            ? `${result.createdCount} recurring delivery order${
                result.createdCount ===
                1
                  ? ""
                  : "s"
              } created successfully.`
            : "No new recurring delivery orders were required."
        );

        await loadDueDeliveries();
      } catch (requestError) {
        setError(
          getErrorMessage(
            requestError,
            "Unable to generate due deliveries."
          )
        );
      } finally {
        setGeneratingAll(false);
      }
    };

  const handleGenerateSingle =
    async (
      subscription:
        DueSubscriptionDelivery
    ) => {
      if (
        !token ||
        generatingSubscriptionId
      ) {
        return;
      }

      const confirmed =
        window.confirm(
          `Generate the due delivery order for ${subscription.subscriptionNumber}?`
        );

      if (!confirmed) {
        return;
      }

      setGeneratingSubscriptionId(
        subscription._id
      );

      setError(null);
      setSuccess(null);

      try {
        const result =
          await generateSingleSubscriptionDelivery(
            token,
            subscription._id,
            false
          );

        if (
          result.status ===
          "created"
        ) {
          setSuccess(
            `${result.orderNumber} was created for ${result.subscriptionNumber}.`
          );
        } else {
          setSuccess(
            result.reason ||
              "The subscription cycle was already processed."
          );
        }

        await loadDueDeliveries();
      } catch (requestError) {
        setError(
          getErrorMessage(
            requestError,
            "Unable to generate this subscription delivery."
          )
        );
      } finally {
        setGeneratingSubscriptionId(
          null
        );
      }
    };

  return (
    <section className="due-deliveries-panel">
      <div className="due-deliveries-heading">
        <div>
          <span className="due-deliveries-eyebrow">
            RECURRING DELIVERY ENGINE
          </span>

          <h3>
            Due subscription deliveries
          </h3>

          <p>
            Preview subscriptions that have
            reached their billing date and
            generate normal delivery orders
            with inventory reservation.
          </p>
        </div>

        <div className="due-deliveries-heading-actions">
          <button
            type="button"
            className="due-deliveries-refresh"
            disabled={
              loading ||
              generatingAll
            }
            onClick={() => {
              void loadDueDeliveries();
            }}
          >
            {loading
              ? "Refreshing..."
              : "Refresh due list"}
          </button>

          <button
            type="button"
            className="due-deliveries-generate"
            disabled={
              preview.totalDue === 0 ||
              generatingAll ||
              loading
            }
            onClick={() => {
              void handleGenerateAll();
            }}
          >
            {generatingAll
              ? "Generating orders..."
              : "Generate due deliveries"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="due-deliveries-error">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="due-deliveries-success">
          {success}
        </div>
      ) : null}

      <div className="due-deliveries-metrics">
        <DueMetric
          label="Total due"
          value={preview.totalDue}
        />

        <DueMetric
          label="Shown now"
          value={preview.count}
        />

        <DueMetric
          label="Overdue"
          value={overdueCount}
        />

        <DueMetric
          label="Previous failures"
          value={
            failedGenerationCount
          }
        />
      </div>

      {lastBatch ? (
        <div className="due-deliveries-batch-result">
          <div>
            <span>
              Processed
            </span>

            <strong>
              {lastBatch.processedCount}
            </strong>
          </div>

          <div>
            <span>
              Created
            </span>

            <strong>
              {lastBatch.createdCount}
            </strong>
          </div>

          <div>
            <span>
              Skipped
            </span>

            <strong>
              {lastBatch.skippedCount}
            </strong>
          </div>

          <div>
            <span>
              Failed
            </span>

            <strong>
              {lastBatch.failedCount}
            </strong>
          </div>
        </div>
      ) : null}

      {loading &&
      preview.subscriptions.length ===
        0 ? (
        <div className="due-deliveries-state">
          <div className="spinner" />

          <p>
            Checking due subscription
            deliveries
          </p>
        </div>
      ) : preview.subscriptions.length ===
        0 ? (
        <div className="due-deliveries-state">
          <div className="due-deliveries-state-icon">
            ✓
          </div>

          <h4>
            No deliveries are due
          </h4>

          <p>
            The worker will create delivery
            orders when active subscriptions
            reach their next billing date.
          </p>
        </div>
      ) : (
        <div className="due-deliveries-list">
          {preview.subscriptions.map(
            (subscription) => {
              const customer =
                getCustomer(
                  subscription
                );

              const lastOrder =
                getLastOrder(
                  subscription
                );

              const isGenerating =
                generatingSubscriptionId ===
                subscription._id;

              const hasFailure =
                Boolean(
                  subscription.lastDeliveryGenerationError
                );

              return (
                <article
                  key={
                    subscription._id
                  }
                  className={`due-delivery-card${
                    hasFailure
                      ? " due-delivery-card-failed"
                      : ""
                  }`}
                >
                  <div className="due-delivery-card-top">
                    <div>
                      <div className="due-delivery-number-row">
                        <strong>
                          {
                            subscription.subscriptionNumber
                          }
                        </strong>

                        <span>
                          {subscription.overdueByDays >
                          0
                            ? `${subscription.overdueByDays} day${
                                subscription.overdueByDays ===
                                1
                                  ? ""
                                  : "s"
                              } overdue`
                            : "Due today"}
                        </span>
                      </div>

                      <h4>
                        {
                          subscription.planName
                        }
                      </h4>
                    </div>

                    <button
                      type="button"
                      disabled={
                        isGenerating ||
                        generatingAll
                      }
                      onClick={() => {
                        void handleGenerateSingle(
                          subscription
                        );
                      }}
                    >
                      {isGenerating
                        ? "Generating..."
                        : "Generate order"}
                    </button>
                  </div>

                  <div className="due-delivery-information">
                    <div>
                      <span>
                        Customer
                      </span>

                      <strong>
                        {
                          customer.fullName
                        }
                      </strong>

                      <p>
                        {customer.phone
                          ? `+91 ${customer.phone}`
                          : customer.email ||
                            "Contact unavailable"}
                      </p>
                    </div>

                    <div>
                      <span>
                        Billing date
                      </span>

                      <strong>
                        {formatDate(
                          subscription.nextBillingAt
                        )}
                      </strong>

                      <p>
                        {
                          subscription.billingCycle
                        }{" "}
                        cycle
                      </p>
                    </div>

                    <div>
                      <span>
                        Delivery preference
                      </span>

                      <strong>
                        {
                          subscription.preferredDay
                        }
                      </strong>

                      <p>
                        {
                          subscription.preferredSlot
                        }
                      </p>
                    </div>

                    <div>
                      <span>
                        Bottle quantity
                      </span>

                      <strong>
                        {
                          subscription.bottleCount
                        }{" "}
                        bottles
                      </strong>

                      <p>
                        {
                          subscription.deliveriesPerCycle
                        }{" "}
                        delivery cycle
                      </p>
                    </div>
                  </div>

                  <div className="due-delivery-footer">
                    <div>
                      <span>
                        Generated deliveries
                      </span>

                      <strong>
                        {subscription.generatedDeliveryCount ??
                          0}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Last generated order
                      </span>

                      <strong>
                        {lastOrder?.orderNumber ||
                          "None"}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Last attempt
                      </span>

                      <strong>
                        {formatDate(
                          subscription.lastDeliveryGenerationAttemptAt
                        )}
                      </strong>
                    </div>
                  </div>

                  {hasFailure ? (
                    <div className="due-delivery-failure">
                      <strong>
                        Previous generation failed
                      </strong>

                      <p>
                        {
                          subscription.lastDeliveryGenerationError
                        }
                      </p>

                      <span>
                        {formatDate(
                          subscription.lastDeliveryGenerationFailedAt
                        )}
                      </span>
                    </div>
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

function DueMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="due-deliveries-metric">
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}