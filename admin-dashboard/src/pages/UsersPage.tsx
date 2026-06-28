// admin-dashboard/src/pages/UsersPage.tsx

import {
  type FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";

import { useAdminAuth } from "../context/AuthContext";

import {
  fetchAdminUsers,
  updateAdminUserRole,
  updateAdminUserStatus,
  type AdminManagedUser,
  type AdminUserSummary,
  type ManagedUserRole,
} from "../services/adminUsersApi";

import "./users.css";

const EMPTY_SUMMARY: AdminUserSummary =
  {
    totalUsers: 0,
    totalCustomers: 0,
    totalAdmins: 0,
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
        nextRole === user.role
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

                    return (
                      <tr
                        key={
                          user._id
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
                                }
                              </small>
                            </div>
                          </div>
                        </td>

                        <td>
                          <span
                            className={`user-role-pill user-role-${user.role}`}
                          >
                            {user.role ===
                            "admin"
                              ? "Administrator"
                              : "Customer"}
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
                          {user.isCurrentAdmin ? (
                            <span className="self-managed-notice">
                              Protected current
                              account
                            </span>
                          ) : (
                            <div className="user-action-group">
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
                                  : "Promote to admin"}
                              </button>
                            </div>
                          )}
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