import {
  type ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import { useAdminAuth } from "../context/AuthContext";

import {
  updateAdminSubscriptionStatus,
  type AdminSubscriptionStatus,
  type AdminSubscriptionUser,
} from "../services/adminSubscriptionsApi";

import {
  fetchAdminSubscriptionDeliveries,
  fetchAdminSubscriptionDetails,
  generateAdminSubscriptionDelivery,
  type AdminDetailedSubscription,
  type AdminSubscriptionDeliveryOrder,
  type AdminSubscriptionDeliveryPagination,
  type SubscriptionGenerationState,
} from "../services/adminSubscriptionDetailsApi";

import "./subscriptionDetails.css";

const STATUS_LABELS: Record<
  AdminSubscriptionStatus,
  string
> = {
  active: "Active",
  paused: "Paused",
  cancelled: "Cancelled",
  expired: "Expired",
};

const NEXT_STATUSES: Record<
  AdminSubscriptionStatus,
  AdminSubscriptionStatus[]
> = {
  active: [
    "paused",
    "cancelled",
    "expired",
  ],

  paused: [
    "active",
    "cancelled",
    "expired",
  ],

  cancelled: [],
  expired: [],
};

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
  ).format(
    Number(value || 0)
  );
}

function formatDate(
  value?: string | null
) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
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
  value: string
) {
  return value
    .replace(/_/g, " ")
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}

function getCustomer(
  subscription:
    AdminDetailedSubscription
): AdminSubscriptionUser | null {
  if (
    subscription.user &&
    typeof subscription.user ===
      "object"
  ) {
    return subscription.user;
  }

  return null;
}

function getErrorMessage(
  error: unknown,
  fallback: string
) {
  return error instanceof Error
    ? error.message
    : fallback;
}

export default function SubscriptionDetailsPage() {
  const navigate =
    useNavigate();

  const {
    subscriptionId = "",
  } = useParams<{
    subscriptionId: string;
  }>();

  const {
    token,
  } = useAdminAuth();

  const [
    subscription,
    setSubscription,
  ] =
    useState<AdminDetailedSubscription | null>(
      null
    );

  const [
    latestDeliveryOrder,
    setLatestDeliveryOrder,
  ] =
    useState<AdminSubscriptionDeliveryOrder | null>(
      null
    );

  const [
    generatedDeliveryCount,
    setGeneratedDeliveryCount,
  ] = useState(0);

  const [
    generationState,
    setGenerationState,
  ] =
    useState<SubscriptionGenerationState | null>(
      null
    );

  const [
    deliveries,
    setDeliveries,
  ] =
    useState<
      AdminSubscriptionDeliveryOrder[]
    >([]);

  const [
    pagination,
    setPagination,
  ] =
    useState<AdminSubscriptionDeliveryPagination | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    loadingMore,
    setLoadingMore,
  ] = useState(false);

  const [
    generating,
    setGenerating,
  ] = useState(false);

  const [
    updatingStatus,
    setUpdatingStatus,
  ] = useState(false);

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

  const loadDetails =
    useCallback(
      async (
        showMainLoader = false
      ) => {
        if (
          !token ||
          !subscriptionId
        ) {
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
          const [
            detailsResult,
            deliveriesResult,
          ] = await Promise.all([
            fetchAdminSubscriptionDetails(
              token,
              subscriptionId
            ),

            fetchAdminSubscriptionDeliveries(
              token,
              subscriptionId,
              1,
              10
            ),
          ]);

          setSubscription(
            detailsResult.subscription
          );

          setLatestDeliveryOrder(
            detailsResult.latestDeliveryOrder
          );

          setGeneratedDeliveryCount(
            detailsResult.generatedDeliveryCount
          );

          setGenerationState(
            detailsResult.generationState
          );

          setDeliveries(
            deliveriesResult.deliveries
          );

          setPagination(
            deliveriesResult.pagination
          );
        } catch (requestError) {
          setError(
            getErrorMessage(
              requestError,
              "Unable to load subscription details."
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
      ]
    );

  useEffect(() => {
    void loadDetails(true);
  }, [loadDetails]);

  const loadMoreDeliveries =
    async () => {
      if (
        !token ||
        !subscriptionId ||
        !pagination?.hasNextPage ||
        loadingMore
      ) {
        return;
      }

      setLoadingMore(true);
      setError(null);

      try {
        const result =
          await fetchAdminSubscriptionDeliveries(
            token,
            subscriptionId,
            pagination.page + 1,
            pagination.limit
          );

        setDeliveries(
          (
            currentDeliveries
          ) => {
            const existingIds =
              new Set(
                currentDeliveries.map(
                  (delivery) =>
                    delivery._id
                )
              );

            return [
              ...currentDeliveries,

              ...result.deliveries.filter(
                (delivery) =>
                  !existingIds.has(
                    delivery._id
                  )
              ),
            ];
          }
        );

        setPagination(
          result.pagination
        );
      } catch (requestError) {
        setError(
          getErrorMessage(
            requestError,
            "Unable to load more recurring deliveries."
          )
        );
      } finally {
        setLoadingMore(false);
      }
    };

  const handleGenerateDelivery =
    async () => {
      if (
        !token ||
        !subscription ||
        !generationState?.canGenerate ||
        generating
      ) {
        return;
      }

      const force =
        !generationState.isDue;

      const confirmed =
        window.confirm(
          force
            ? `The next billing cycle for ${subscription.subscriptionNumber} is not due yet. Generate it now and advance the billing date?`
            : `Generate the due recurring delivery order for ${subscription.subscriptionNumber}?`
        );

      if (!confirmed) {
        return;
      }

      setGenerating(true);
      setError(null);
      setSuccess(null);

      try {
        const result =
          await generateAdminSubscriptionDelivery(
            token,
            subscription._id,
            force
          );

        if (
          result.status ===
          "created"
        ) {
          setSuccess(
            `${result.orderNumber} was generated successfully.`
          );
        } else {
          setSuccess(
            result.reason ||
              "The recurring cycle did not require a new order."
          );
        }

        await loadDetails(false);
      } catch (requestError) {
        setError(
          getErrorMessage(
            requestError,
            "Unable to generate the recurring delivery."
          )
        );
      } finally {
        setGenerating(false);
      }
    };

  const handleStatusChange =
    async (
      nextStatus:
        AdminSubscriptionStatus
    ) => {
      if (
        !token ||
        !subscription ||
        nextStatus ===
          subscription.status ||
        updatingStatus
      ) {
        return;
      }

      let reason:
        | string
        | undefined;

      if (
        nextStatus ===
        "cancelled"
      ) {
        const confirmed =
          window.confirm(
            `Cancel ${subscription.subscriptionNumber}? Future recurring deliveries will stop permanently.`
          );

        if (!confirmed) {
          return;
        }

        const enteredReason =
          window.prompt(
            "Enter cancellation reason:",
            "Cancelled by administrator"
          );

        if (
          enteredReason === null
        ) {
          return;
        }

        reason =
          enteredReason.trim() ||
          "Cancelled by administrator";
      }

      if (
        nextStatus ===
        "expired"
      ) {
        const confirmed =
          window.confirm(
            `Mark ${subscription.subscriptionNumber} as expired?`
          );

        if (!confirmed) {
          return;
        }

        reason =
          "Subscription expired";
      }

      setUpdatingStatus(true);
      setError(null);
      setSuccess(null);

      try {
        await updateAdminSubscriptionStatus(
          token,
          subscription._id,
          nextStatus,
          reason
        );

        setSuccess(
          `${subscription.subscriptionNumber} changed to ${STATUS_LABELS[nextStatus]}.`
        );

        await loadDetails(false);
      } catch (requestError) {
        setError(
          getErrorMessage(
            requestError,
            "Unable to update the subscription."
          )
        );
      } finally {
        setUpdatingStatus(false);
      }
    };

  if (loading) {
    return (
      <div className="subscription-details-page">
        <div className="subscription-details-state">
          <div className="spinner" />

          <p>
            Loading subscription details
          </p>
        </div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="subscription-details-page">
        <button
          type="button"
          className="secondary-button"
          onClick={() =>
            navigate("/subscriptions")
          }
        >
          Back to subscriptions
        </button>

        <div className="subscription-details-state">
          <h2>
            Subscription unavailable
          </h2>

          <p>
            {error ||
              "The subscription could not be found."}
          </p>
        </div>
      </div>
    );
  }

  const customer =
    getCustomer(subscription);

  const nextStatuses =
    NEXT_STATUSES[
      subscription.status
    ];

  return (
    <div className="subscription-details-page">
      <div className="subscription-details-heading">
        <div className="subscription-details-heading-left">
          <button
            type="button"
            className="subscription-back-button"
            onClick={() =>
              navigate("/subscriptions")
            }
          >
            ←
          </button>

          <div>
            <span className="subscription-details-eyebrow">
              CUSTOMER SUBSCRIPTION
            </span>

            <h2>
              {subscription.planName}
            </h2>

            <p>
              {
                subscription.subscriptionNumber
              }
            </p>
          </div>
        </div>

        <div className="subscription-details-heading-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={refreshing}
            onClick={() => {
              void loadDetails(false);
            }}
          >
            {refreshing
              ? "Refreshing..."
              : "Refresh"}
          </button>

          <button
            type="button"
            className="primary-button"
            disabled={
              !generationState?.canGenerate ||
              generating
            }
            onClick={() => {
              void handleGenerateDelivery();
            }}
          >
            {generating
              ? "Generating..."
              : generationState?.isDue
                ? "Generate due delivery"
                : "Generate next delivery"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="inline-error">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="inline-success">
          {success}
        </div>
      ) : null}

      <section className="subscription-details-hero">
        <div className="subscription-details-hero-top">
          <div>
            <span className="subscription-details-number">
              {
                subscription.subscriptionNumber
              }
            </span>

            <h3>
              {subscription.planName}
            </h3>

            <p>
              {formatStatus(
                subscription.billingCycle
              )}{" "}
              recurring plan
            </p>
          </div>

          <StatusBadge
            value={
              subscription.status
            }
          />
        </div>

        <div className="subscription-details-hero-grid">
          <SummaryValue
            label="Bottles"
            value={String(
              subscription.bottleCount
            )}
          />

          <SummaryValue
            label="Generated orders"
            value={String(
              generatedDeliveryCount
            )}
          />

          <SummaryValue
            label="Cycle amount"
            value={formatCurrency(
              subscription.totalPerCycle
            )}
          />

          <SummaryValue
            label="Next billing"
            value={formatDate(
              subscription.nextBillingAt
            )}
          />
        </div>
      </section>

      {generationState ? (
        <div
          className={`subscription-generation-state ${
            generationState.isDue
              ? "subscription-generation-due"
              : ""
          }`}
        >
          <div>
            <strong>
              {generationState.isDue
                ? "Recurring delivery is due"
                : "Upcoming recurring cycle"}
            </strong>

            <p>
              {
                generationState.message
              }
            </p>
          </div>

          <span>
            {generationState.canGenerate
              ? "Ready"
              : "Unavailable"}
          </span>
        </div>
      ) : null}

      {subscription.lastDeliveryGenerationError ? (
        <div className="subscription-generation-failure">
          <strong>
            Previous order generation failed
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

      <div className="subscription-details-grid">
        <DetailsSection title="Customer">
          <InformationRow
            label="Name"
            value={
              customer?.fullName ||
              subscription.deliveryAddress
                .fullName
            }
          />

          <InformationRow
            label="Email"
            value={
              customer?.email ||
              "Unavailable"
            }
          />

          <InformationRow
            label="Phone"
            value={`+91 ${
              customer?.phone ||
              subscription.deliveryAddress
                .phone
            }`}
          />

          <InformationRow
            label="Account status"
            value={
              customer
                ? customer.active
                  ? "Active"
                  : "Disabled"
                : "Unavailable"
            }
            last
          />
        </DetailsSection>

        <DetailsSection title="Billing and mandate">
          <InformationRow
            label="Billing cycle"
            value={formatStatus(
              subscription.billingCycle
            )}
          />

          <InformationRow
            label="Payment method"
            value={formatStatus(
              subscription.paymentMethod
            )}
          />

          <InformationRow
            label="Payment status"
            value={formatStatus(
              subscription.paymentStatus
            )}
          />

          <InformationRow
            label="Reference"
            value={
              subscription.paymentReference ||
              "Unavailable"
            }
            last
          />
        </DetailsSection>

        <DetailsSection title="Delivery preference">
          <InformationRow
            label="Preferred day"
            value={
              subscription.preferredDay
            }
          />

          <InformationRow
            label="Preferred slot"
            value={
              subscription.preferredSlot
            }
          />

          <InformationRow
            label="Next billing"
            value={formatDate(
              subscription.nextBillingAt
            )}
          />

          <InformationRow
            label="Started"
            value={formatDate(
              subscription.startDate
            )}
            last
          />
        </DetailsSection>

        <DetailsSection title="Pricing">
          <InformationRow
            label="Original value"
            value={formatCurrency(
              subscription.originalTotal
            )}
          />

          <InformationRow
            label={`Plan saving (${subscription.discountPercent}%)`}
            value={`−${formatCurrency(
              subscription.savings
            )}`}
          />

          <InformationRow
            label="Coupon saving"
            value={`−${formatCurrency(
              subscription.couponDiscount ||
                0
            )}`}
          />

          <InformationRow
            label="Per-cycle total"
            value={formatCurrency(
              subscription.totalPerCycle
            )}
            last
          />
        </DetailsSection>
      </div>

      <DetailsSection title="Selected bottles">
        <div className="subscription-details-items">
          {subscription.items.map(
            (item, index) => (
              <div
                key={`${item.productId}-${index}`}
                className="subscription-details-item"
              >
                <div>
                  <strong>
                    {item.quantity} ×{" "}
                    {item.name}
                  </strong>

                  <span>
                    {item.sizeMl} ml ·{" "}
                    {formatCurrency(
                      item.price
                    )}{" "}
                    each
                  </span>
                </div>

                <strong>
                  {formatCurrency(
                    item.lineTotal
                  )}
                </strong>
              </div>
            )
          )}
        </div>
      </DetailsSection>

      <DetailsSection title="Delivery address">
        <div className="subscription-details-address">
          <strong>
            {
              subscription.deliveryAddress
                .fullName
            }
          </strong>

          <span>
            +91{" "}
            {
              subscription.deliveryAddress
                .phone
            }
          </span>

          <p>
            {
              subscription.deliveryAddress
                .houseDetails
            }
            ,{" "}
            {
              subscription.deliveryAddress
                .areaDetails
            }
            {subscription.deliveryAddress
              .landmark
              ? `, near ${subscription.deliveryAddress.landmark}`
              : ""}
            ,{" "}
            {
              subscription.deliveryAddress
                .area
            }
            ,{" "}
            {
              subscription.deliveryAddress
                .city
            }{" "}
            –{" "}
            {
              subscription.deliveryAddress
                .pincode
            }
          </p>
        </div>
      </DetailsSection>

      {nextStatuses.length > 0 ? (
        <DetailsSection title="Manage subscription">
          <div className="subscription-status-controls">
            <label>
              Change subscription status

              <select
                value=""
                disabled={updatingStatus}
                onChange={(event) => {
                  const value =
                    event.target
                      .value as AdminSubscriptionStatus;

                  if (value) {
                    void handleStatusChange(
                      value
                    );
                  }
                }}
              >
                <option value="">
                  Select next status
                </option>

                {nextStatuses.map(
                  (status) => (
                    <option
                      key={status}
                      value={status}
                    >
                      {
                        STATUS_LABELS[
                          status
                        ]
                      }
                    </option>
                  )
                )}
              </select>
            </label>

            {updatingStatus ? (
              <span>
                Updating subscription...
              </span>
            ) : null}
          </div>
        </DetailsSection>
      ) : null}

      {subscription.cancellationReason ? (
        <div className="subscription-status-reason">
          <strong>
            Status reason
          </strong>

          <p>
            {
              subscription.cancellationReason
            }
          </p>
        </div>
      ) : null}

      <div className="subscription-history-heading">
        <div>
          <span className="subscription-details-eyebrow">
            RECURRING ORDER HISTORY
          </span>

          <h3>
            Delivery orders
          </h3>

          <p>
            {pagination?.total ||
              generatedDeliveryCount}{" "}
            recurring order
            {(pagination?.total ||
              generatedDeliveryCount) === 1
              ? ""
              : "s"}
          </p>
        </div>
      </div>

      {latestDeliveryOrder ? (
        <div className="subscription-latest-order">
          <div>
            <span>
              Latest generated order
            </span>

            <strong>
              {
                latestDeliveryOrder.orderNumber
              }
            </strong>
          </div>

          <StatusBadge
            value={
              latestDeliveryOrder.orderStatus
            }
          />
        </div>
      ) : null}

      {deliveries.length === 0 ? (
        <div className="subscription-details-state compact">
          <h3>
            No recurring delivery orders
          </h3>

          <p>
            A delivery order will appear here
            when the subscription cycle is
            generated.
          </p>
        </div>
      ) : (
        <div className="subscription-history-list">
          {deliveries.map(
            (delivery) => (
              <DeliveryHistoryCard
                key={delivery._id}
                delivery={delivery}
                onOpenOrders={() =>
                  navigate(
                    `/orders?search=${encodeURIComponent(
                      delivery.orderNumber
                    )}`
                  )
                }
              />
            )
          )}
        </div>
      )}

      {pagination?.hasNextPage ? (
        <button
          type="button"
          className="subscription-load-more"
          disabled={loadingMore}
          onClick={() => {
            void loadMoreDeliveries();
          }}
        >
          {loadingMore
            ? "Loading..."
            : "Load more delivery orders"}
        </button>
      ) : null}
    </div>
  );
}

function StatusBadge({
  value,
}: {
  value: string;
}) {
  const normalized =
    value.toLowerCase();

  const positive = [
    "active",
    "paid",
    "delivered",
  ].includes(normalized);

  const warning = [
    "paused",
    "pending",
    "placed",
    "confirmed",
    "preparing",
    "assigned",
    "picked_up",
    "out_for_delivery",
    "unassigned",
  ].includes(normalized);

  return (
    <span
      className={`subscription-detail-status ${
        positive
          ? "subscription-detail-status-positive"
          : warning
            ? "subscription-detail-status-warning"
            : "subscription-detail-status-negative"
      }`}
    >
      {formatStatus(value)}
    </span>
  );
}

function SummaryValue({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="subscription-summary-value">
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}

function DetailsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="subscription-details-section">
      <h3>
        {title}
      </h3>

      {children}
    </section>
  );
}

function InformationRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div
      className={`subscription-information-row ${
        last
          ? "subscription-information-row-last"
          : ""
      }`}
    >
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}

function DeliveryHistoryCard({
  delivery,
  onOpenOrders,
}: {
  delivery:
    AdminSubscriptionDeliveryOrder;

  onOpenOrders: () => void;
}) {
  return (
    <article className="subscription-history-card">
      <div className="subscription-history-card-top">
        <div>
          <strong>
            {delivery.orderNumber}
          </strong>

          <span>
            Billing cycle:{" "}
            {formatDate(
              delivery.subscriptionBillingAt ||
                delivery.createdAt
            )}
          </span>
        </div>

        <StatusBadge
          value={
            delivery.orderStatus
          }
        />
      </div>

      <div className="subscription-history-card-grid">
        <div>
          <span>
            Delivery date
          </span>

          <strong>
            {delivery.deliverySchedule
              ?.deliveryDateLabel ||
              "Unavailable"}
          </strong>

          <small>
            {delivery.deliverySchedule
              ?.deliverySlot ||
              "Slot unavailable"}
          </small>
        </div>

        <div>
          <span>
            Payment
          </span>

          <strong>
            {formatStatus(
              delivery.paymentStatus
            )}
          </strong>

          <small>
            {delivery.paymentReference ||
              "No reference"}
          </small>
        </div>

        <div>
          <span>
            Delivery
          </span>

          <strong>
            {formatStatus(
              delivery.deliveryStatus
            )}
          </strong>

          <small>
            {delivery.deliveryPartnerSnapshot
              ?.fullName ||
              "Partner not assigned"}
          </small>
        </div>

        <div>
          <span>
            Total
          </span>

          <strong>
            {formatCurrency(
              delivery.total
            )}
          </strong>

          <small>
            {delivery.items.length} selected item
            {delivery.items.length ===
            1
              ? ""
              : "s"}
          </small>
        </div>
      </div>

      {delivery.cancellationReason ? (
        <div className="subscription-order-warning">
          {
            delivery.cancellationReason
          }
        </div>
      ) : null}

      <div className="subscription-history-card-footer">
        <span>
          Created{" "}
          {formatDate(
            delivery.createdAt
          )}
        </span>

        <button
          type="button"
          onClick={
            onOpenOrders
          }
        >
          Open in Orders
        </button>
      </div>
    </article>
  );
}