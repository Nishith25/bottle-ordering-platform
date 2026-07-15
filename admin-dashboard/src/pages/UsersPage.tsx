// admin-dashboard/src/pages/UsersPage.tsx

import {
  type FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";

import { useAdminAuth } from "../context/AuthContext";

import {
  fetchAdminUserDetails,
  fetchAdminUsers,
  updateAdminUserRole,
  updateAdminUserStatus,
  type AdminCustomerDetails,
  type AdminCustomerOrderSummary,
  type AdminManagedUser,
  type AdminSavedAddress,
  type AdminUserSummary,
  type ManagedUserRole,
} from "../services/api";

import "./users.css";

const EMPTY_SUMMARY: AdminUserSummary =
  {
    totalUsers: 0,
    totalCustomers: 0,
    totalAdmins: 0,
    totalDeliveryPartners: 0,
    activeUsers: 0,
    inactiveUsers: 0,
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
  ).format(value);
}

function formatDate(
  value?: string | null
) {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Unknown";
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

function getRoleLabel(
  role: string
) {
  if (role === "admin") {
    return "Administrator";
  }

  if (role === "delivery") {
    return "Delivery";
  }

  return "Customer";
}

function getOrderStatusLabel(
  status: string
) {
  return status
    .split("_")
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1)
    )
    .join(" ");
}

export default function UsersPage() {
  const { token } =
    useAdminAuth();

  const [users, setUsers] =
    useState<
      AdminManagedUser[]
    >([]);

  const [summary, setSummary] =
    useState<AdminUserSummary>(
      EMPTY_SUMMARY
    );

  const [roleFilter, setRoleFilter] =
    useState("all");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("all");

  const [search, setSearch] =
    useState("");

  const [
    submittedSearch,
    setSubmittedSearch,
  ] = useState("");

  const [loading, setLoading] =
    useState(true);

  const [
    updatingUserId,
    setUpdatingUserId,
  ] = useState<
    string | null
  >(null);

  const [
    selectedUserId,
    setSelectedUserId,
  ] = useState<
    string | null
  >(null);

  const [
    customerDetails,
    setCustomerDetails,
  ] =
    useState<AdminCustomerDetails | null>(
      null
    );

  const [
    detailsLoading,
    setDetailsLoading,
  ] = useState(false);

  const [
    detailsError,
    setDetailsError,
  ] = useState<
    string | null
  >(null);

  const [error, setError] =
    useState<
      string | null
    >(null);

  const [success, setSuccess] =
    useState<
      string | null
    >(null);

  const loadUsers =
    useCallback(async () => {
      if (!token) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result =
          await fetchAdminUsers(
            token,
            {
              role:
                roleFilter,

              status:
                statusFilter,

              search:
                submittedSearch,
            }
          );

        setUsers(
          result.users
        );

        setSummary(
          result.summary
        );
      } catch (requestError) {
        setError(
          requestError instanceof
            Error
            ? requestError.message
            : "Unable to load users."
        );
      } finally {
        setLoading(false);
      }
    }, [
      token,
      roleFilter,
      statusFilter,
      submittedSearch,
    ]);

  const loadCustomerDetails =
    useCallback(
      async (
        userId: string
      ) => {
        if (!token) {
          return;
        }

        setSelectedUserId(
          userId
        );

        setDetailsLoading(
          true
        );

        setDetailsError(
          null
        );

        try {
          const result =
            await fetchAdminUserDetails(
              token,
              userId
            );

          setCustomerDetails(
            result
          );
        } catch (requestError) {
          setCustomerDetails(
            null
          );

          setDetailsError(
            requestError instanceof
              Error
              ? requestError.message
              : "Unable to load customer details."
          );
        } finally {
          setDetailsLoading(
            false
          );
        }
      },
      [token]
    );

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const handleSearch = (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setSubmittedSearch(
      search.trim()
    );
  };

  const handleStatusToggle =
    async (
      user: AdminManagedUser
    ) => {
      if (
        !token ||
        user.isCurrentAdmin
      ) {
        return;
      }

      const nextStatus =
        !user.active;

      const confirmed =
        window.confirm(
          nextStatus
            ? `Reactivate ${user.fullName}'s account?`
            : `Disable ${user.fullName}'s account? They will no longer be able to log in or place orders.`
        );

      if (!confirmed) {
        return;
      }

      setUpdatingUserId(
        user._id
      );

      setError(null);
      setSuccess(null);

      try {
        await updateAdminUserStatus(
          token,
          user._id,
          nextStatus
        );

        setSuccess(
          nextStatus
            ? `${user.fullName}'s account is active.`
            : `${user.fullName}'s account has been disabled.`
        );

        await loadUsers();

        if (
          selectedUserId ===
          user._id
        ) {
          await loadCustomerDetails(
            user._id
          );
        }
      } catch (requestError) {
        setError(
          requestError instanceof
            Error
            ? requestError.message
            : "Unable to update the account."
        );
      } finally {
        setUpdatingUserId(
          null
        );
      }
    };

  const handleRoleChange =
    async (
      user: AdminManagedUser,
      nextRole:
        ManagedUserRole
    ) => {
      if (
        !token ||
        user.isCurrentAdmin ||
        nextRole === user.role ||
        user.role === "delivery"
      ) {
        return;
      }

      const confirmed =
        window.confirm(
          nextRole === "admin"
            ? `Promote ${user.fullName} to administrator? This gives them access to the complete admin dashboard while preserving customer shopping access.`
            : `Change ${user.fullName} to a customer account? They will lose access to the admin dashboard.`
        );

      if (!confirmed) {
        return;
      }

      setUpdatingUserId(
        user._id
      );

      setError(null);
      setSuccess(null);

      try {
        await updateAdminUserRole(
          token,
          user._id,
          nextRole
        );

        setSuccess(
          nextRole === "admin"
            ? `${user.fullName} is now an administrator.`
            : `${user.fullName} is now a customer.`
        );

        await loadUsers();

        if (
          selectedUserId ===
          user._id
        ) {
          await loadCustomerDetails(
            user._id
          );
        }
      } catch (requestError) {
        setError(
          requestError instanceof
            Error
            ? requestError.message
            : "Unable to update the user role."
        );
      } finally {
        setUpdatingUserId(
          null
        );
      }
    };

  return (
    <div className="users-page">
      <div className="page-heading-row">
        <div>
          <h2>
            Customer accounts
          </h2>

          <p>
            Manage customers,
            administrators and account
            access.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          disabled={loading}
          onClick={() => {
            void loadUsers();
          }}
        >
          {loading
            ? "Refreshing..."
            : "Refresh users"}
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

      <div className="user-summary-grid">
        <UserSummaryCard
          label="Total accounts"
          value={
            summary.totalUsers
          }
        />

        <UserSummaryCard
          label="Customers"
          value={
            summary.totalCustomers
          }
        />

        <UserSummaryCard
          label="Administrators"
          value={
            summary.totalAdmins
          }
        />

        <UserSummaryCard
          label="Delivery partners"
          value={
            summary.totalDeliveryPartners ??
            0
          }
        />

        <UserSummaryCard
          label="Active accounts"
          value={
            summary.activeUsers
          }
        />

        <UserSummaryCard
          label="Disabled accounts"
          value={
            summary.inactiveUsers
          }
        />
      </div>

      <section className="panel users-toolbar">
        <form
          className="user-search-form"
          onSubmit={
            handleSearch
          }
        >
          <input
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Search name, email or mobile number"
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

        <div className="user-filter-row">
          <label>
            Role

            <select
              value={roleFilter}
              onChange={(event) =>
                setRoleFilter(
                  event.target.value
                )
              }
            >
              <option value="all">
                All roles
              </option>

              <option value="customer">
                Customers
              </option>

              <option value="admin">
                Administrators
              </option>

              <option value="delivery">
                Delivery partners
              </option>
            </select>
          </label>

          <label>
            Status

            <select
              value={
                statusFilter
              }
              onChange={(event) =>
                setStatusFilter(
                  event.target.value
                )
              }
            >
              <option value="all">
                All statuses
              </option>

              <option value="active">
                Active
              </option>

              <option value="inactive">
                Disabled
              </option>
            </select>
          </label>
        </div>
      </section>

      <section className="panel users-table-panel">
        {loading &&
        users.length === 0 ? (
          <div className="page-state compact">
            <div className="spinner" />

            <p>
              Loading customer accounts
            </p>
          </div>
        ) : users.length === 0 ? (
          <div className="page-state compact">
            <div className="state-icon">
              ◎
            </div>

            <h3>
              No users found
            </h3>

            <p>
              No accounts match the
              selected filters.
            </p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="users-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Orders</th>
                  <th>
                    Bottles
                  </th>
                  <th>
                    COD
                  </th>
                  <th>
                    Subscriptions
                  </th>
                  <th>
                    Last login
                  </th>
                  <th>
                    Registered
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {users.map(
                  (user) => {
                    const isUpdating =
                      updatingUserId ===
                      user._id;

                    const selected =
                      selectedUserId ===
                      user._id;

                    return (
                      <tr
                        key={
                          user._id
                        }
                        className={
                          selected
                            ? "selected-user-row"
                            : ""
                        }
                      >
                        <td>
                          <div className="managed-user-cell">
                            <div className="managed-user-avatar">
                              {user.fullName
                                .charAt(0)
                                .toUpperCase()}
                            </div>

                            <div>
                              <div className="managed-user-name-row">
                                <strong>
                                  {
                                    user.fullName
                                  }
                                </strong>

                                {user.isCurrentAdmin ? (
                                  <span className="current-user-badge">
                                    You
                                  </span>
                                ) : null}
                              </div>

                              <span>
                                {
                                  user.email
                                }
                              </span>

                              <small>
                                +91{" "}
                                {
                                  user.phone
                                }{" "}
                                ·{" "}
                                {
                                  user.savedAddressCount ??
                                  0
                                }{" "}
                                saved address
                                {(user.savedAddressCount ??
                                  0) ===
                                1
                                  ? ""
                                  : "es"}
                              </small>
                            </div>
                          </div>
                        </td>

                        <td>
                          <span
                            className={`user-role-pill user-role-${user.role}`}
                          >
                            {getRoleLabel(
                              user.role
                            )}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`status-pill ${
                              user.active
                                ? "status-active"
                                : "status-inactive"
                            }`}
                          >
                            {user.active
                              ? "Active"
                              : "Disabled"}
                          </span>
                        </td>

                        <td>
                          <div className="user-stat-cell">
                            <strong>
                              {
                                user
                                  .statistics
                                  .orderCount
                              }
                            </strong>

                            <span>
                              {formatCurrency(
                                user
                                  .statistics
                                  .orderValue
                              )}
                            </span>
                          </div>
                        </td>

                        <td>
                          <div className="user-stat-cell">
                            <strong>
                              {
                                user
                                  .statistics
                                  .bottleCount
                              }
                            </strong>

                            <span>
                              bottles bought
                            </span>
                          </div>
                        </td>

                        <td>
                          <div className="user-stat-cell">
                            <strong>
                              {formatCurrency(
                                user
                                  .statistics
                                  .codPendingAmount
                              )}
                            </strong>

                            <span>
                              pending ·{" "}
                              {formatCurrency(
                                user
                                  .statistics
                                  .codPaidAmount
                              )}{" "}
                              paid
                            </span>
                          </div>
                        </td>

                        <td>
                          <div className="user-stat-cell">
                            <strong>
                              {
                                user
                                  .statistics
                                  .subscriptionCount
                              }
                            </strong>

                            <span>
                              {
                                user
                                  .statistics
                                  .activeSubscriptionCount
                              }{" "}
                              active
                            </span>
                          </div>
                        </td>

                        <td>
                          <span className="user-date-cell">
                            {formatDate(
                              user.lastLoginAt
                            )}
                          </span>
                        </td>

                        <td>
                          <span className="user-date-cell">
                            {formatDate(
                              user.createdAt
                            )}
                          </span>
                        </td>

                        <td>
                          <div className="user-action-group">
                            <button
                              type="button"
                              className="table-action"
                              disabled={
                                detailsLoading &&
                                selected
                              }
                              onClick={() => {
                                void loadCustomerDetails(
                                  user._id
                                );
                              }}
                            >
                              {detailsLoading &&
                              selected
                                ? "Loading..."
                                : selected
                                  ? "Viewing"
                                  : "View"}
                            </button>

                            {user.isCurrentAdmin ? (
                              <span className="self-managed-notice">
                                Protected
                              </span>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="table-action"
                                  disabled={
                                    isUpdating
                                  }
                                  onClick={() => {
                                    void handleStatusToggle(
                                      user
                                    );
                                  }}
                                >
                                  {isUpdating
                                    ? "Updating..."
                                    : user.active
                                      ? "Disable"
                                      : "Activate"}
                                </button>

                                {user.role !==
                                "delivery" ? (
                                  <button
                                    type="button"
                                    className={
                                      user.role ===
                                      "admin"
                                        ? "table-action danger"
                                        : "table-action promote"
                                    }
                                    disabled={
                                      isUpdating
                                    }
                                    onClick={() => {
                                      void handleRoleChange(
                                        user,
                                        user.role ===
                                          "admin"
                                          ? "customer"
                                          : "admin"
                                      );
                                    }}
                                  >
                                    {user.role ===
                                    "admin"
                                      ? "Make customer"
                                      : "Promote"}
                                  </button>
                                ) : null}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {detailsError ? (
        <div className="inline-error">
          {detailsError}
        </div>
      ) : null}

      {customerDetails ? (
        <CustomerDetailsPanel
          details={customerDetails}
          onClose={() => {
            setSelectedUserId(null);
            setCustomerDetails(null);
            setDetailsError(null);
          }}
        />
      ) : null}

      <div className="user-security-note">
        <strong>
          Account permissions
        </strong>

        <p>
          Administrator accounts retain
          access to bottle shopping,
          checkout, orders and
          subscriptions. Disabling an
          account blocks authenticated
          access on its next backend
          request.
        </p>
      </div>
    </div>
  );
}

function UserSummaryCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <article className="user-summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function CustomerDetailsPanel({
  details,
  onClose,
}: {
  details: AdminCustomerDetails;
  onClose: () => void;
}) {
  const user =
    details.user;

  return (
    <section className="customer-detail-panel">
      <div className="customer-detail-header">
        <div>
          <span className="detail-eyebrow">
            Customer profile
          </span>

          <h3>
            {user.fullName}
          </h3>

          <p>
            {user.email} · +91{" "}
            {user.phone}
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      <div className="customer-detail-grid">
        <DetailMetric
          label="Total orders"
          value={
            details.statistics.totalOrders
          }
          hint={`${details.statistics.deliveredOrders} delivered · ${details.statistics.cancelledOrders} cancelled`}
        />

        <DetailMetric
          label="Bottles bought"
          value={
            details.statistics.totalBottles
          }
          hint="Non-cancelled bottles"
        />

        <DetailMetric
          label="Total revenue"
          value={formatCurrency(
            details.statistics.totalRevenue
          )}
          hint="Excluding cancelled orders"
        />

        <DetailMetric
          label="COD pending"
          value={formatCurrency(
            details.statistics.codPendingAmount
          )}
          hint={`${formatCurrency(
            details.statistics.codPaidAmount
          )} COD paid`}
        />

        <DetailMetric
          label="Online paid"
          value={formatCurrency(
            details.statistics.onlinePaidAmount
          )}
          hint="Paid online orders"
        />

        <DetailMetric
          label="Subscriptions"
          value={
            details.statistics
              .subscriptionCount
          }
          hint={`${details.statistics.activeSubscriptionCount} active · ${formatCurrency(
            details.statistics
              .activeRecurringValue
          )}/cycle`}
        />
      </div>

      <div className="customer-detail-columns">
        <div className="detail-card">
          <div className="detail-card-heading">
            <h4>
              Saved addresses
            </h4>

            <span>
              {
                user.savedAddresses.length
              }{" "}
              saved
            </span>
          </div>

          {user.savedAddresses.length === 0 ? (
            <p className="empty-detail-text">
              No saved delivery addresses.
            </p>
          ) : (
            <div className="saved-address-detail-list">
              {user.savedAddresses.map(
                (address) => (
                  <SavedAddressCard
                    key={address.id}
                    address={address}
                  />
                )
              )}
            </div>
          )}
        </div>

        <div className="detail-card">
          <div className="detail-card-heading">
            <h4>
              Account
            </h4>

            <span>
              {user.active
                ? "Active"
                : "Disabled"}
            </span>
          </div>

          <div className="account-detail-list">
            <DetailRow
              label="Role"
              value={getRoleLabel(
                user.role
              )}
            />

            <DetailRow
              label="Email verified"
              value={
                user.emailVerified
                  ? "Yes"
                  : "No"
              }
            />

            <DetailRow
              label="Phone verified"
              value={
                user.phoneVerified
                  ? "Yes"
                  : "No"
              }
            />

            <DetailRow
              label="Last login"
              value={formatDate(
                user.lastLoginAt
              )}
            />

            <DetailRow
              label="Registered"
              value={formatDate(
                user.createdAt
              )}
            />
          </div>
        </div>
      </div>

      <div className="detail-card latest-orders-card">
        <div className="detail-card-heading">
          <h4>
            Latest orders
          </h4>

          <span>
            Last 10
          </span>
        </div>

        {details.latestOrders.length === 0 ? (
          <p className="empty-detail-text">
            No orders placed yet.
          </p>
        ) : (
          <div className="latest-order-list">
            {details.latestOrders.map(
              (order) => (
                <LatestOrderRow
                  key={order._id}
                  order={order}
                />
              )
            )}
          </div>
        )}
      </div>

      <div className="detail-card latest-orders-card">
        <div className="detail-card-heading">
          <h4>
            Latest subscriptions
          </h4>

          <span>
            Last 5
          </span>
        </div>

        {details.latestSubscriptions.length ===
        0 ? (
          <p className="empty-detail-text">
            No subscriptions created yet.
          </p>
        ) : (
          <div className="latest-order-list">
            {details.latestSubscriptions.map(
              (subscription) => (
                <div
                  key={subscription._id}
                  className="latest-order-row"
                >
                  <div>
                    <strong>
                      {
                        subscription.subscriptionNumber
                      }
                    </strong>

                    <span>
                      {subscription.planName} ·{" "}
                      {
                        subscription.billingCycle
                      }
                    </span>
                  </div>

                  <div>
                    <strong>
                      {formatCurrency(
                        subscription.totalPerCycle
                      )}
                    </strong>

                    <span>
                      {getOrderStatusLabel(
                        subscription.status
                      )}
                    </span>
                  </div>

                  <div>
                    <strong>
                      Next billing
                    </strong>

                    <span>
                      {formatDate(
                        subscription.nextBillingAt
                      )}
                    </span>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function DetailMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint: string;
}) {
  return (
    <article className="detail-metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </article>
  );
}

function SavedAddressCard({
  address,
}: {
  address: AdminSavedAddress;
}) {
  return (
    <article className="saved-address-detail-card">
      <div className="saved-address-detail-top">
        <strong>
          {address.label}
        </strong>

        {address.isDefault ? (
          <span>
            Default
          </span>
        ) : null}
      </div>

      <p>
        {address.fullName} · +91{" "}
        {address.phone}
      </p>

      <p>
        {address.houseDetails},{" "}
        {address.areaDetails}
        {address.landmark
          ? `, ${address.landmark}`
          : ""}
      </p>

      <small>
        {address.area}, {address.city} -{" "}
        {address.pincode}
      </small>
    </article>
  );
}

function LatestOrderRow({
  order,
}: {
  order: AdminCustomerOrderSummary;
}) {
  return (
    <div className="latest-order-row">
      <div>
        <strong>
          {order.orderNumber}
        </strong>

        <span>
          {formatDate(
            order.createdAt
          )}
        </span>
      </div>

      <div>
        <strong>
          {formatCurrency(
            order.total
          )}
        </strong>

        <span>
          {order.bottleCount} bottle
          {order.bottleCount === 1
            ? ""
            : "s"}
        </span>
      </div>

      <div>
        <strong>
          {getOrderStatusLabel(
            order.orderStatus
          )}
        </strong>

        <span>
          {order.paymentMethod.toUpperCase()} ·{" "}
          {getOrderStatusLabel(
            order.paymentStatus
          )}
        </span>
      </div>

      <div>
        <strong>
          Delivery
        </strong>

        <span>
          {order.deliverySchedule
            ?.deliveryDateLabel ||
            order.deliverySchedule
              ?.deliveryDateId ||
            "Not selected"}
          {order.deliverySchedule
            ?.deliverySlot
            ? ` · ${order.deliverySchedule.deliverySlot}`
            : ""}
        </span>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="account-detail-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}