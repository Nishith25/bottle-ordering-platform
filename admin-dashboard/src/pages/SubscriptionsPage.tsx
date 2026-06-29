import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import DueSubscriptionDeliveriesPanel from "../components/DueSubscriptionDeliveriesPanel";

import { useAdminAuth } from "../context/AuthContext";

import {
  fetchAdminSubscriptions,
  updateAdminSubscriptionStatus,
  type AdminSubscription,
  type AdminSubscriptionStatus,
  type AdminSubscriptionStatusCounts,
  type AdminSubscriptionUser,
} from "../services/adminSubscriptionsApi";

import "./subscriptions.css";

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

const EMPTY_COUNTS: AdminSubscriptionStatusCounts = {
  active: 0,
  paused: 0,
  cancelled: 0,
  expired: 0,
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }
  ).format(value);
}

function formatDate(
  value?: string | null
) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

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

function getCustomer(
  subscription: AdminSubscription
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

function formatPaymentMethod(
  paymentMethod: string
) {
  if (
    paymentMethod ===
    "upi_autopay"
  ) {
    return "UPI AutoPay";
  }

  return "Card mandate";
}

function formatPaymentStatus(
  paymentStatus: string
) {
  return paymentStatus
    .replace(/_/g, " ")
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}

export default function SubscriptionsPage() {
  const {
    token,
  } = useAdminAuth();

  const [
    subscriptions,
    setSubscriptions,
  ] = useState<
    AdminSubscription[]
  >([]);

  const [
    statusCounts,
    setStatusCounts,
  ] =
    useState<AdminSubscriptionStatusCounts>(
      EMPTY_COUNTS
    );

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("all");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    submittedSearch,
    setSubmittedSearch,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    updatingSubscriptionId,
    setUpdatingSubscriptionId,
  ] = useState<
    string | null
  >(null);

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  const [
    success,
    setSuccess,
  ] = useState<
    string | null
  >(null);

  const loadSubscriptions =
    useCallback(async () => {
      if (!token) {
        setSubscriptions([]);
        setStatusCounts(
          EMPTY_COUNTS
        );
        setLoading(false);

        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result =
          await fetchAdminSubscriptions(
            token,
            {
              status:
                statusFilter,

              search:
                submittedSearch,
            }
          );

        setSubscriptions(
          result.subscriptions
        );

        setStatusCounts(
          result.statusCounts
        );
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load subscriptions."
        );
      } finally {
        setLoading(false);
      }
    }, [
      token,
      statusFilter,
      submittedSearch,
    ]);

  useEffect(() => {
    void loadSubscriptions();
  }, [loadSubscriptions]);

  const totalSubscriptions =
    useMemo(
      () =>
        Object.values(
          statusCounts
        ).reduce(
          (
            sum,
            count
          ) =>
            sum + count,
          0
        ),
      [statusCounts]
    );

  const activeCycleValue =
    useMemo(
      () =>
        subscriptions
          .filter(
            (subscription) =>
              subscription.status ===
              "active"
          )
          .reduce(
            (
              sum,
              subscription
            ) =>
              sum +
              subscription.totalPerCycle,
            0
          ),
      [subscriptions]
    );

  const handleSearch = (
    event:
      FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setSubmittedSearch(
      search.trim()
    );
  };

  const handleStatusChange =
    async (
      subscription:
        AdminSubscription,

      nextStatus:
        AdminSubscriptionStatus
    ) => {
      if (
        !token ||
        nextStatus ===
          subscription.status ||
        updatingSubscriptionId
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
            `Cancel subscription ${subscription.subscriptionNumber}?`
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

      setUpdatingSubscriptionId(
        subscription._id
      );

      setError(null);
      setSuccess(null);

      try {
        const updatedSubscription =
          await updateAdminSubscriptionStatus(
            token,
            subscription._id,
            nextStatus,
            reason
          );

        setSubscriptions(
          (
            currentSubscriptions
          ) =>
            currentSubscriptions.map(
              (
                currentSubscription
              ) =>
                currentSubscription._id ===
                updatedSubscription._id
                  ? updatedSubscription
                  : currentSubscription
            )
        );

        setSuccess(
          `${subscription.subscriptionNumber} changed to ${STATUS_LABELS[nextStatus]}.`
        );

        await loadSubscriptions();
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to update subscription."
        );
      } finally {
        setUpdatingSubscriptionId(
          null
        );
      }
    };

  return (
    <div className="subscriptions-page">
      <div className="page-heading-row">
        <div>
          <h2>
            Customer subscriptions
          </h2>

          <p>
            Review recurring plans,
            generate due delivery orders
            and manage subscription
            statuses.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          disabled={loading}
          onClick={() => {
            void loadSubscriptions();
          }}
        >
          {loading
            ? "Refreshing..."
            : "Refresh subscriptions"}
        </button>
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

      <DueSubscriptionDeliveriesPanel />

      <div className="subscription-summary-grid">
        <article className="subscription-summary-card">
          <span>
            Total subscriptions
          </span>

          <strong>
            {totalSubscriptions}
          </strong>
        </article>

        <article className="subscription-summary-card">
          <span>
            Active subscriptions
          </span>

          <strong>
            {statusCounts.active}
          </strong>
        </article>

        <article className="subscription-summary-card">
          <span>
            Visible active cycle value
          </span>

          <strong>
            {formatCurrency(
              activeCycleValue
            )}
          </strong>
        </article>
      </div>

      <div className="subscription-filter-grid">
        <SubscriptionMetric
          label="All"
          value={
            totalSubscriptions
          }
          active={
            statusFilter === "all"
          }
          onClick={() => {
            setStatusFilter("all");
          }}
        />

        {(
          Object.keys(
            STATUS_LABELS
          ) as AdminSubscriptionStatus[]
        ).map((status) => (
          <SubscriptionMetric
            key={status}
            label={
              STATUS_LABELS[
                status
              ]
            }
            value={
              statusCounts[
                status
              ]
            }
            active={
              statusFilter ===
              status
            }
            onClick={() => {
              setStatusFilter(
                status
              );
            }}
          />
        ))}
      </div>

      <section className="panel subscriptions-toolbar">
        <form
          className="subscription-search-form"
          onSubmit={
            handleSearch
          }
        >
          <input
            value={search}
            onChange={(
              event
            ) => {
              setSearch(
                event.target.value
              );
            }}
            placeholder="Search subscription, plan, customer, email or phone"
          />

          <button
            type="submit"
            className="primary-button"
          >
            Search
          </button>

          {submittedSearch ? (
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setSearch("");
                setSubmittedSearch(
                  ""
                );
              }}
            >
              Clear
            </button>
          ) : null}
        </form>
      </section>

      <section className="panel subscriptions-panel">
        {loading &&
        subscriptions.length ===
          0 ? (
          <div className="page-state compact">
            <div className="spinner" />

            <p>
              Loading customer
              subscriptions
            </p>
          </div>
        ) : subscriptions.length ===
          0 ? (
          <div className="page-state compact">
            <div className="state-icon">
              ↻
            </div>

            <h3>
              No subscriptions found
            </h3>

            <p>
              No subscriptions match
              the selected filters.
            </p>
          </div>
        ) : (
          <div className="admin-subscription-list">
            {subscriptions.map(
              (
                subscription
              ) => {
                const customer =
                  getCustomer(
                    subscription
                  );

                const nextStatuses =
                  NEXT_STATUSES[
                    subscription
                      .status
                  ];

                return (
                  <article
                    key={
                      subscription._id
                    }
                    className="admin-subscription-card"
                  >
                    <div className="admin-subscription-header">
                      <div>
                        <div className="subscription-number-row">
                          <strong>
                            {
                              subscription.subscriptionNumber
                            }
                          </strong>

                          <span
                            className={`subscription-status status-${subscription.status}`}
                          >
                            {
                              STATUS_LABELS[
                                subscription
                                  .status
                              ]
                            }
                          </span>
                        </div>

                        <span className="subscription-created">
                          Created{" "}
                          {formatDate(
                            subscription.createdAt
                          )}
                        </span>
                      </div>

                      <div className="subscription-cycle-total">
                        <span>
                          Per cycle
                        </span>

                        <strong>
                          {formatCurrency(
                            subscription.totalPerCycle
                          )}
                        </strong>

                        <small>
                          {
                            subscription.billingCycle
                          }
                        </small>
                      </div>
                    </div>

                    <div className="subscription-plan-banner">
                      <div>
                        <span>
                          Subscription
                          plan
                        </span>

                        <strong>
                          {
                            subscription.planName
                          }
                        </strong>

                        <small>
                          {
                            subscription.planId
                          }
                        </small>
                      </div>

                      <div className="subscription-plan-numbers">
                        <div>
                          <strong>
                            {
                              subscription.bottleCount
                            }
                          </strong>

                          <span>
                            Bottles
                          </span>
                        </div>

                        <div>
                          <strong>
                            {
                              subscription.deliveriesPerCycle
                            }
                          </strong>

                          <span>
                            Deliveries
                          </span>
                        </div>

                        <div>
                          <strong>
                            {
                              subscription.discountPercent
                            }
                            %
                          </strong>

                          <span>
                            Saving
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="subscription-information-grid">
                      <div className="subscription-information-section">
                        <h4>
                          Customer
                        </h4>

                        <strong>
                          {customer?.fullName ??
                            subscription
                              .deliveryAddress
                              .fullName}
                        </strong>

                        <span>
                          {customer?.email ??
                            "Email unavailable"}
                        </span>

                        <span>
                          +91{" "}
                          {customer?.phone ??
                            subscription
                              .deliveryAddress
                              .phone}
                        </span>

                        {customer?.role ===
                        "admin" ? (
                          <small className="customer-admin-label">
                            Administrator
                            account
                          </small>
                        ) : null}
                      </div>

                      <div className="subscription-information-section">
                        <h4>
                          Delivery
                          preference
                        </h4>

                        <strong>
                          {
                            subscription.preferredDay
                          }
                        </strong>

                        <span>
                          {
                            subscription.preferredSlot
                          }
                        </span>

                        <span>
                          {
                            subscription
                              .deliveryAddress
                              .area
                          }
                          ,{" "}
                          {
                            subscription
                              .deliveryAddress
                              .city
                          }{" "}
                          –{" "}
                          {
                            subscription
                              .deliveryAddress
                              .pincode
                          }
                        </span>
                      </div>

                      <div className="subscription-information-section">
                        <h4>
                          Billing
                        </h4>

                        <strong>
                          Next billing:{" "}
                          {formatDate(
                            subscription.nextBillingAt
                          )}
                        </strong>

                        <span>
                          Started:{" "}
                          {formatDate(
                            subscription.startDate
                          )}
                        </span>

                        <span>
                          Saved{" "}
                          {formatCurrency(
                            subscription.savings
                          )}{" "}
                          per cycle
                        </span>
                      </div>

                      <div className="subscription-information-section">
                        <h4>
                          Payment
                          mandate
                        </h4>

                        <strong>
                          {formatPaymentMethod(
                            subscription.paymentMethod
                          )}
                        </strong>

                        <span>
                          {formatPaymentStatus(
                            subscription.paymentStatus
                          )}
                        </span>

                        <span>
                          {subscription.paymentReference ||
                            "No payment reference"}
                        </span>
                      </div>
                    </div>

                    <div className="subscription-items-section">
                      <h4>
                        Selected bottles
                      </h4>

                      {subscription.items.map(
                        (
                          item,
                          index
                        ) => (
                          <div
                            key={`${item.productId}-${index}`}
                            className="subscription-item-row"
                          >
                            <span>
                              {
                                item.quantity
                              }{" "}
                              ×{" "}
                              {item.name}{" "}
                              <small>
                                (
                                {
                                  item.sizeMl
                                }{" "}
                                ml)
                              </small>
                            </span>

                            <strong>
                              {formatCurrency(
                                item.lineTotal
                              )}
                            </strong>
                          </div>
                        )
                      )}

                      <div className="subscription-price-summary">
                        <div>
                          <span>
                            Original total
                          </span>

                          <strong>
                            {formatCurrency(
                              subscription.originalTotal
                            )}
                          </strong>
                        </div>

                        <div>
                          <span>
                            Savings
                          </span>

                          <strong>
                            −
                            {formatCurrency(
                              subscription.savings
                            )}
                          </strong>
                        </div>

                        <div>
                          <span>
                            Cycle total
                          </span>

                          <strong>
                            {formatCurrency(
                              subscription.totalPerCycle
                            )}
                          </strong>
                        </div>
                      </div>
                    </div>

                    <div className="subscription-address-section">
                      <h4>
                        Complete delivery
                        address
                      </h4>

                      <p>
                        {
                          subscription
                            .deliveryAddress
                            .houseDetails
                        }
                        ,{" "}
                        {
                          subscription
                            .deliveryAddress
                            .areaDetails
                        }
                        {subscription
                          .deliveryAddress
                          .landmark
                          ? `, near ${subscription.deliveryAddress.landmark}`
                          : ""}
                        ,{" "}
                        {
                          subscription
                            .deliveryAddress
                            .area
                        }
                        ,{" "}
                        {
                          subscription
                            .deliveryAddress
                            .city
                        }{" "}
                        –{" "}
                        {
                          subscription
                            .deliveryAddress
                            .pincode
                        }
                      </p>
                    </div>

                    <div className="subscription-action-row">
                      {nextStatuses.length >
                      0 ? (
                        <>
                          <label>
                            Update status

                            <select
                              value=""
                              disabled={
                                updatingSubscriptionId ===
                                subscription._id
                              }
                              onChange={(
                                event
                              ) => {
                                const value =
                                  event
                                    .target
                                    .value as AdminSubscriptionStatus;

                                if (
                                  value
                                ) {
                                  void handleStatusChange(
                                    subscription,
                                    value
                                  );
                                }
                              }}
                            >
                              <option value="">
                                Select next
                                status
                              </option>

                              {nextStatuses.map(
                                (
                                  nextStatus
                                ) => (
                                  <option
                                    key={
                                      nextStatus
                                    }
                                    value={
                                      nextStatus
                                    }
                                  >
                                    {
                                      STATUS_LABELS[
                                        nextStatus
                                      ]
                                    }
                                  </option>
                                )
                              )}
                            </select>
                          </label>

                          {updatingSubscriptionId ===
                          subscription._id ? (
                            <span className="updating-subscription">
                              Updating
                              subscription...
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <span className="terminal-subscription-status">
                          {subscription.status ===
                          "cancelled"
                            ? "Subscription cancelled"
                            : "Subscription expired"}
                        </span>
                      )}
                    </div>

                    {subscription.cancellationReason ? (
                      <div className="subscription-reason">
                        Status reason:{" "}
                        {
                          subscription.cancellationReason
                        }
                      </div>
                    ) : null}
                  </article>
                );
              }
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function SubscriptionMetric({
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
      className={`subscription-filter-card ${
        active
          ? "subscription-filter-active"
          : ""
      }`}
    >
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </button>
  );
}