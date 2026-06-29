import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import DueSubscriptionDeliveriesPanel from "../components/DueSubscriptionDeliveriesPanel";

import {
  useAdminAuth,
} from "../context/AuthContext";

import {
  updateAdminSubscriptionStatus,
  type AdminSubscription,
  type AdminSubscriptionStatus,
} from "../services/adminSubscriptionsApi";

import "./subscriptions.css";

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ??
  "http://localhost:5001"
).replace(/\/$/, "");

type SubscriptionUser = {
  _id?: string;
  fullName?: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  active?: boolean;
};

type SubscriptionItem = {
  _id?: string;
  product?: string;
  productId?: string;
  name?: string;
  shortName?: string;
  sizeMl?: number;
  price?: number;
  quantity?: number;
  lineTotal?: number;
};

type SubscriptionAddress = {
  fullName?: string;
  phone?: string;
  pincode?: string;
  houseDetails?: string;
  areaDetails?: string;
  landmark?: string;
  area?: string;
  city?: string;
};

type SubscriptionRecord =
  AdminSubscription & {
    _id: string;

    subscriptionNumber: string;

    user?:
      | string
      | SubscriptionUser
      | null;

    planId?: string;
    planName: string;

    billingCycle:
      | "weekly"
      | "monthly";

    bottleCount: number;
    deliveriesPerCycle?: number;

    items?: SubscriptionItem[];

    preferredDay?: string;
    preferredSlot?: string;

    deliveryAddress:
      SubscriptionAddress;

    originalTotal?: number;
    discountPercent?: number;
    savings?: number;
    amountBeforeCoupon?: number;
    couponDiscount?: number;
    totalPerCycle: number;
    recurringTotalPerCycle?: number;

    coupon?: {
      code?: string;
      discountAmount?: number;
    } | null;

    paymentMethod?: string;
    paymentStatus?: string;
    paymentReference?: string;

    status:
      AdminSubscriptionStatus;

    startDate?: string;
    nextBillingAt?: string;

    cancellationReason?: string;
    cancelledAt?: string | null;

    generatedDeliveryCount?: number;
    lastDeliveryOrderAt?: string | null;
    lastDeliveryGenerationError?: string;

    createdAt?: string;
    updatedAt?: string;
  };

type SubscriptionApiResponse = {
  success?: boolean;
  message?: string;

  data?: {
    subscriptions?:
      SubscriptionRecord[];
  };

  subscriptions?:
    SubscriptionRecord[];
};

type StatusFilter =
  | "all"
  | AdminSubscriptionStatus;

type BillingFilter =
  | "all"
  | "weekly"
  | "monthly";

type PaymentFilter =
  | "all"
  | "demo_confirmed"
  | "active"
  | "mandate_pending"
  | "failed"
  | "cancelled";

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

function getErrorMessage(
  error: unknown,
  fallback: string
) {
  return error instanceof Error
    ? error.message
    : fallback;
}

function formatCurrency(
  value?: number
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

function getCustomer(
  subscription:
    SubscriptionRecord
): SubscriptionUser | null {
  const user =
    subscription.user;

  if (
    !user ||
    typeof user === "string"
  ) {
    return null;
  }

  return user;
}

function getCustomerName(
  subscription:
    SubscriptionRecord
) {
  const customer =
    getCustomer(subscription);

  return (
    customer?.fullName ||
    customer?.name ||
    subscription.deliveryAddress
      ?.fullName ||
    "Customer"
  );
}

function getCustomerEmail(
  subscription:
    SubscriptionRecord
) {
  const customer =
    getCustomer(subscription);

  return (
    customer?.email ||
    "Email unavailable"
  );
}

function getCustomerPhone(
  subscription:
    SubscriptionRecord
) {
  const customer =
    getCustomer(subscription);

  return (
    customer?.phone ||
    subscription.deliveryAddress
      ?.phone ||
    "Unavailable"
  );
}

function getAddressText(
  subscription:
    SubscriptionRecord
) {
  const address =
    subscription.deliveryAddress;

  if (!address) {
    return "Delivery address unavailable";
  }

  return [
    address.houseDetails,
    address.areaDetails,

    address.landmark
      ? `Near ${address.landmark}`
      : "",

    address.area,
    address.city,
    address.pincode,
  ]
    .filter(Boolean)
    .join(", ");
}

function getSubscriptionsFromPayload(
  payload:
    SubscriptionApiResponse
) {
  if (
    Array.isArray(
      payload.data
        ?.subscriptions
    )
  ) {
    return payload.data
      .subscriptions;
  }

  if (
    Array.isArray(
      payload.subscriptions
    )
  ) {
    return payload.subscriptions;
  }

  return [];
}

export default function SubscriptionsPage() {
  const navigate =
    useNavigate();

  const {
    token,
  } = useAdminAuth();

  const [
    subscriptions,
    setSubscriptions,
  ] =
    useState<
      SubscriptionRecord[]
    >([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    updatingSubscriptionId,
    setUpdatingSubscriptionId,
  ] =
    useState<
      string | null
    >(null);

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

  const [
    success,
    setSuccess,
  ] =
    useState<
      string | null
    >(null);

  const [
    searchTerm,
    setSearchTerm,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState<StatusFilter>(
      "all"
    );

  const [
    billingFilter,
    setBillingFilter,
  ] =
    useState<BillingFilter>(
      "all"
    );

  const [
    paymentFilter,
    setPaymentFilter,
  ] =
    useState<PaymentFilter>(
      "all"
    );

  const loadSubscriptions =
    useCallback(
      async (
        showMainLoader =
          false
      ) => {
        if (!token) {
          setSubscriptions(
            []
          );

          setLoading(false);

          return;
        }

        if (
          showMainLoader
        ) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }

        setError(null);

        try {
          const controller =
            new AbortController();

          const timeoutId =
            window.setTimeout(
              () => {
                controller.abort();
              },
              20000
            );

          let response:
            Response;

          try {
            response =
              await fetch(
                `${API_BASE_URL}/api/admin/subscriptions?limit=100`,
                {
                  headers: {
                    Accept:
                      "application/json",

                    Authorization:
                      `Bearer ${token}`,
                  },

                  signal:
                    controller.signal,
                }
              );
          } finally {
            window.clearTimeout(
              timeoutId
            );
          }

          const responseText =
            await response.text();

          let payload:
            SubscriptionApiResponse;

          try {
            payload =
              responseText
                ? JSON.parse(
                    responseText
                  )
                : {};
          } catch {
            throw new Error(
              "The backend returned an invalid response."
            );
          }

          if (
            !response.ok ||
            payload.success ===
              false
          ) {
            throw new Error(
              payload.message ||
                "Unable to load subscriptions."
            );
          }

          setSubscriptions(
            getSubscriptionsFromPayload(
              payload
            )
          );
        } catch (
          requestError
        ) {
          if (
            requestError instanceof
              Error &&
            requestError.name ===
              "AbortError"
          ) {
            setError(
              "The backend took too long to respond."
            );

            return;
          }

          if (
            requestError instanceof
            TypeError
          ) {
            setError(
              "Unable to connect to the backend."
            );

            return;
          }

          setError(
            getErrorMessage(
              requestError,
              "Unable to load subscriptions."
            )
          );
        } finally {
          setLoading(false);
          setRefreshing(
            false
          );
        }
      },
      [token]
    );

  useEffect(() => {
    void loadSubscriptions(
      true
    );
  }, [
    loadSubscriptions,
  ]);

  const filteredSubscriptions =
    useMemo(() => {
      const normalizedSearch =
        searchTerm
          .trim()
          .toLowerCase();

      return subscriptions.filter(
        (subscription) => {
          if (
            statusFilter !==
              "all" &&
            subscription.status !==
              statusFilter
          ) {
            return false;
          }

          if (
            billingFilter !==
              "all" &&
            subscription.billingCycle !==
              billingFilter
          ) {
            return false;
          }

          if (
            paymentFilter !==
              "all" &&
            subscription.paymentStatus !==
              paymentFilter
          ) {
            return false;
          }

          if (
            !normalizedSearch
          ) {
            return true;
          }

          const customer =
            getCustomer(
              subscription
            );

          const searchableText =
            [
              subscription.subscriptionNumber,
              subscription.planName,
              customer?.fullName,
              customer?.name,
              customer?.email,
              customer?.phone,
              subscription.deliveryAddress
                ?.fullName,
              subscription.deliveryAddress
                ?.phone,
              subscription.deliveryAddress
                ?.pincode,
              subscription.deliveryAddress
                ?.area,
              subscription.deliveryAddress
                ?.city,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

          return searchableText.includes(
            normalizedSearch
          );
        }
      );
    }, [
      subscriptions,
      searchTerm,
      statusFilter,
      billingFilter,
      paymentFilter,
    ]);

  const summary =
    useMemo(() => {
      return subscriptions.reduce(
        (
          totals,
          subscription
        ) => {
          totals.total += 1;

          if (
            subscription.status ===
            "active"
          ) {
            totals.active += 1;
          }

          if (
            subscription.status ===
            "paused"
          ) {
            totals.paused += 1;
          }

          if (
            subscription.status ===
            "cancelled"
          ) {
            totals.cancelled += 1;
          }

          if (
            subscription.status ===
            "expired"
          ) {
            totals.expired += 1;
          }

          return totals;
        },
        {
          total: 0,
          active: 0,
          paused: 0,
          cancelled: 0,
          expired: 0,
        }
      );
    }, [subscriptions]);

  const clearFilters =
    () => {
      setSearchTerm("");
      setStatusFilter(
        "all"
      );
      setBillingFilter(
        "all"
      );
      setPaymentFilter(
        "all"
      );
    };

  const handleStatusChange =
    async (
      subscription:
        SubscriptionRecord,

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
            `Cancel ${subscription.subscriptionNumber}? Future recurring deliveries will stop permanently.`
          );

        if (!confirmed) {
          return;
        }

        const enteredReason =
          window.prompt(
            "Enter the cancellation reason:",
            "Cancelled by administrator"
          );

        if (
          enteredReason ===
          null
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

      if (
        nextStatus ===
        "paused"
      ) {
        const confirmed =
          window.confirm(
            `Pause ${subscription.subscriptionNumber}? Automatic recurring deliveries will stop until it is resumed.`
          );

        if (!confirmed) {
          return;
        }
      }

      if (
        nextStatus ===
        "active" &&
        subscription.status ===
          "paused"
      ) {
        const confirmed =
          window.confirm(
            `Resume ${subscription.subscriptionNumber}? Automatic recurring deliveries will become active again.`
          );

        if (!confirmed) {
          return;
        }
      }

      setUpdatingSubscriptionId(
        subscription._id
      );

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

        await loadSubscriptions(
          false
        );
      } catch (
        requestError
      ) {
        setError(
          getErrorMessage(
            requestError,
            "Unable to update the subscription."
          )
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
          <span className="page-eyebrow">
            SUBSCRIPTION OPERATIONS
          </span>

          <h2>
            Customer subscriptions
          </h2>

          <p>
            Review recurring plans,
            generate due delivery
            orders and control
            subscription statuses.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          disabled={
            refreshing
          }
          onClick={() => {
            void loadSubscriptions(
              false
            );
          }}
        >
          {refreshing
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
        <SummaryCard
          label="Total subscriptions"
          value={summary.total}
          description="All customer plans"
        />

        <SummaryCard
          label="Active"
          value={summary.active}
          description="Generating future deliveries"
        />

        <SummaryCard
          label="Paused"
          value={summary.paused}
          description="Recurring deliveries stopped"
        />

        <SummaryCard
          label="Cancelled"
          value={
            summary.cancelled
          }
          description="Permanently stopped plans"
        />

        <SummaryCard
          label="Expired"
          value={summary.expired}
          description="Completed or expired plans"
        />
      </div>

      <section className="subscription-filter-card">
        <div className="subscription-filter-heading">
          <div>
            <h3>
              Find subscriptions
            </h3>

            <p>
              Search by subscription,
              customer, email, phone,
              pincode or location.
            </p>
          </div>

          <button
            type="button"
            className="text-button"
            onClick={
              clearFilters
            }
          >
            Clear filters
          </button>
        </div>

        <div className="subscription-filter-grid">
          <label>
            Search

            <input
              type="search"
              value={searchTerm}
              placeholder="Search subscription or customer"
              onChange={(
                event
              ) =>
                setSearchTerm(
                  event.target
                    .value
                )
              }
            />
          </label>

          <label>
            Status

            <select
              value={
                statusFilter
              }
              onChange={(
                event
              ) =>
                setStatusFilter(
                  event.target
                    .value as StatusFilter
                )
              }
            >
              <option value="all">
                All statuses
              </option>

              <option value="active">
                Active
              </option>

              <option value="paused">
                Paused
              </option>

              <option value="cancelled">
                Cancelled
              </option>

              <option value="expired">
                Expired
              </option>
            </select>
          </label>

          <label>
            Billing cycle

            <select
              value={
                billingFilter
              }
              onChange={(
                event
              ) =>
                setBillingFilter(
                  event.target
                    .value as BillingFilter
                )
              }
            >
              <option value="all">
                All billing cycles
              </option>

              <option value="weekly">
                Weekly
              </option>

              <option value="monthly">
                Monthly
              </option>
            </select>
          </label>

          <label>
            Payment status

            <select
              value={
                paymentFilter
              }
              onChange={(
                event
              ) =>
                setPaymentFilter(
                  event.target
                    .value as PaymentFilter
                )
              }
            >
              <option value="all">
                All payment statuses
              </option>

              <option value="demo_confirmed">
                Demo confirmed
              </option>

              <option value="active">
                Active
              </option>

              <option value="mandate_pending">
                Mandate pending
              </option>

              <option value="failed">
                Failed
              </option>

              <option value="cancelled">
                Cancelled
              </option>
            </select>
          </label>
        </div>
      </section>

      <div className="subscriptions-toolbar">
        <div>
          <h3>
            Subscription records
          </h3>

          <p>
            Showing{" "}
            {
              filteredSubscriptions.length
            }{" "}
            of{" "}
            {
              subscriptions.length
            }{" "}
            subscriptions
          </p>
        </div>
      </div>

      {loading ? (
        <div className="subscriptions-state-card">
          <div className="spinner" />

          <h3>
            Loading subscriptions
          </h3>

          <p>
            Fetching the latest
            customer subscription
            records.
          </p>
        </div>
      ) : filteredSubscriptions.length ===
        0 ? (
        <div className="subscriptions-state-card">
          <h3>
            No subscriptions found
          </h3>

          <p>
            No customer
            subscriptions match the
            current filters.
          </p>

          <button
            type="button"
            className="secondary-button"
            onClick={
              clearFilters
            }
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="subscriptions-list">
          {filteredSubscriptions.map(
            (subscription) => (
              <SubscriptionCard
                key={
                  subscription._id
                }
                subscription={
                  subscription
                }
                updating={
                  updatingSubscriptionId ===
                  subscription._id
                }
                onViewDetails={() =>
                  navigate(
                    `/subscriptions/${subscription._id}`
                  )
                }
                onStatusChange={(
                  nextStatus
                ) => {
                  void handleStatusChange(
                    subscription,
                    nextStatus
                  );
                }}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  return (
    <article className="subscription-summary-card">
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

function SubscriptionCard({
  subscription,
  updating,
  onViewDetails,
  onStatusChange,
}: {
  subscription:
    SubscriptionRecord;

  updating: boolean;

  onViewDetails:
    () => void;

  onStatusChange: (
    status:
      AdminSubscriptionStatus
  ) => void;
}) {
  const customer =
    getCustomer(
      subscription
    );

  const nextStatuses =
    NEXT_STATUSES[
      subscription.status
    ] || [];

  return (
    <article className="subscription-card">
      <div className="subscription-card-top">
        <div>
          <span className="subscription-number">
            {
              subscription.subscriptionNumber
            }
          </span>

          <h3>
            {
              subscription.planName
            }
          </h3>

          <p>
            {getCustomerName(
              subscription
            )}{" "}
            ·{" "}
            {getCustomerEmail(
              subscription
            )}
          </p>
        </div>

        <span
          className={`subscription-status subscription-status-${subscription.status}`}
        >
          {
            STATUS_LABELS[
              subscription.status
            ]
          }
        </span>
      </div>

      <div className="subscription-card-grid">
        <SubscriptionInformation
          label="Customer phone"
          value={getCustomerPhone(
            subscription
          )}
        />

        <SubscriptionInformation
          label="Billing cycle"
          value={formatStatus(
            subscription.billingCycle
          )}
        />

        <SubscriptionInformation
          label="Bottle count"
          value={`${subscription.bottleCount} bottles`}
        />

        <SubscriptionInformation
          label="Preferred delivery"
          value={[
            subscription.preferredDay,
            subscription.preferredSlot,
          ]
            .filter(Boolean)
            .join(" · ")}
        />

        <SubscriptionInformation
          label="Service area"
          value={[
            subscription.deliveryAddress
              ?.area,
            subscription.deliveryAddress
              ?.city,
            subscription.deliveryAddress
              ?.pincode,
          ]
            .filter(Boolean)
            .join(", ")}
        />

        <SubscriptionInformation
          label="Next billing"
          value={formatDate(
            subscription.nextBillingAt
          )}
        />
      </div>

      <div className="subscription-address-box">
        <span>
          Delivery address
        </span>

        <p>
          {getAddressText(
            subscription
          )}
        </p>
      </div>

      {subscription.items &&
      subscription.items.length >
        0 ? (
        <div className="subscription-items-box">
          <span className="subscription-box-label">
            Selected bottles
          </span>

          <div className="subscription-item-chips">
            {subscription.items.map(
              (item, index) => (
                <span
                  key={`${item.productId || item.name}-${index}`}
                  className="subscription-item-chip"
                >
                  {item.quantity ||
                    0}{" "}
                  ×{" "}
                  {item.shortName ||
                    item.name ||
                    "Bottle"}
                </span>
              )
            )}
          </div>
        </div>
      ) : null}

      <div className="subscription-financial-grid">
        <SubscriptionInformation
          label="Original value"
          value={formatCurrency(
            subscription.originalTotal
          )}
        />

        <SubscriptionInformation
          label={`Plan saving (${Number(
            subscription.discountPercent ||
              0
          )}%)`}
          value={`−${formatCurrency(
            subscription.savings
          )}`}
        />

        <SubscriptionInformation
          label="Coupon saving"
          value={`−${formatCurrency(
            subscription.couponDiscount
          )}`}
        />

        <SubscriptionInformation
          label="Per-cycle total"
          value={formatCurrency(
            subscription.totalPerCycle
          )}
          strong
        />
      </div>

      <div className="subscription-payment-box">
        <div>
          <span>
            Payment mandate
          </span>

          <strong>
            {formatStatus(
              subscription.paymentStatus
            )}
          </strong>
        </div>

        <div>
          <span>
            Payment method
          </span>

          <strong>
            {formatStatus(
              subscription.paymentMethod
            )}
          </strong>
        </div>

        <div>
          <span>
            Reference
          </span>

          <strong>
            {subscription.paymentReference ||
              "Unavailable"}
          </strong>
        </div>
      </div>

      {subscription.lastDeliveryGenerationError ? (
        <div className="subscription-generation-error">
          <strong>
            Previous recurring order generation failed
          </strong>

          <p>
            {
              subscription.lastDeliveryGenerationError
            }
          </p>
        </div>
      ) : null}

      {subscription.cancellationReason ? (
        <div className="subscription-reason-box">
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

      <div className="subscription-action-row">
        <button
          type="button"
          className="secondary-button"
          onClick={
            onViewDetails
          }
        >
          View details
        </button>

        {nextStatuses.length >
        0 ? (
          <label className="subscription-status-control">
            Update status

            <select
              value=""
              disabled={updating}
              onChange={(
                event
              ) => {
                const value =
                  event.target
                    .value as AdminSubscriptionStatus;

                if (value) {
                  onStatusChange(
                    value
                  );
                }
              }}
            >
              <option value="">
                {updating
                  ? "Updating..."
                  : "Select next status"}
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
        ) : (
          <span className="subscription-final-status">
            No further status
            changes available
          </span>
        )}

        <span className="subscription-created-date">
          Created{" "}
          {formatDate(
            subscription.createdAt
          )}
        </span>
      </div>

      {customer &&
      customer.active ===
        false ? (
        <div className="subscription-customer-warning">
          This customer account is
          currently disabled.
        </div>
      ) : null}
    </article>
  );
}

function SubscriptionInformation({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="subscription-information">
      <span>
        {label}
      </span>

      <strong
        className={
          strong
            ? "subscription-information-highlight"
            : ""
        }
      >
        {value ||
          "Unavailable"}
      </strong>
    </div>
  );
}