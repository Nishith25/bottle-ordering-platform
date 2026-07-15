// admin-dashboard/src/pages/NotificationsPage.tsx

import {
  type FormEvent,
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
  fetchAdminNotifications,
  generateAdminNotificationsNow,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
  type AdminNotification,
  type AdminNotificationSummary,
  type AdminNotificationType,
} from "../services/adminNotificationsApi";

import "./notifications.css";

const EMPTY_SUMMARY: AdminNotificationSummary =
  {
    total: 0,
    unread: 0,
    danger: 0,
    warning: 0,
    stock: 0,
    followUp: 0,
    refund: 0,
    codPayment: 0,
    order: 0,
    payment: 0,
  };

const TYPE_OPTIONS: Array<{
  value:
    | AdminNotificationType
    | "all";
  label: string;
}> = [
  {
    value: "all",
    label: "All",
  },
  {
    value: "stock",
    label: "Stock",
  },
  {
    value: "follow_up",
    label: "Follow-ups",
  },
  {
    value: "refund",
    label: "Refunds",
  },
  {
    value: "cod_payment",
    label: "COD",
  },
  {
    value: "order",
    label: "Orders",
  },
  {
    value: "payment",
    label: "Payments",
  },
];

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

function formatLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}

export default function NotificationsPage() {
  const { token } =
    useAdminAuth();

  const navigate =
    useNavigate();

  const [
    notifications,
    setNotifications,
  ] = useState<
    AdminNotification[]
  >([]);

  const [summary, setSummary] =
    useState<AdminNotificationSummary>(
      EMPTY_SUMMARY
    );

  const [
    typeFilter,
    setTypeFilter,
  ] = useState<
    | AdminNotificationType
    | "all"
  >("all");

  const [
    unreadOnly,
    setUnreadOnly,
  ] = useState(false);

  const [search, setSearch] =
    useState("");

  const [
    submittedSearch,
    setSubmittedSearch,
  ] = useState("");

  const [loading, setLoading] =
    useState(true);

  const [
    actionLoading,
    setActionLoading,
  ] = useState<
    string | null
  >(null);

  const [
    generating,
    setGenerating,
  ] = useState(false);

  const [error, setError] =
    useState<
      string | null
    >(null);

  const [success, setSuccess] =
    useState<
      string | null
    >(null);

  const loadNotifications =
    useCallback(async () => {
      if (!token) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result =
          await fetchAdminNotifications(
            token,
            {
              type:
                typeFilter,

              unreadOnly,

              search:
                submittedSearch,

              limit: 300,
            }
          );

        setNotifications(
          result.notifications
        );

        setSummary(
          result.summary
        );
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load notifications."
        );
      } finally {
        setLoading(false);
      }
    }, [
      token,
      typeFilter,
      unreadOnly,
      submittedSearch,
    ]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const handleSearch = (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setSubmittedSearch(
      search.trim()
    );
  };

  const handleGenerate =
    async () => {
      if (!token) {
        return;
      }

      setGenerating(true);
      setError(null);
      setSuccess(null);

      try {
        const result =
          await generateAdminNotificationsNow(
            token
          );

        setSuccess(
          `${result.totalCreated} new notification${result.totalCreated === 1 ? "" : "s"} generated.`
        );

        await loadNotifications();
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to generate notifications."
        );
      } finally {
        setGenerating(false);
      }
    };

  const handleMarkRead =
    async (
      notification: AdminNotification
    ) => {
      if (
        !token ||
        notification.readAt
      ) {
        return;
      }

      setActionLoading(
        notification._id
      );

      setError(null);
      setSuccess(null);

      try {
        await markAdminNotificationRead(
          token,
          notification._id
        );

        await loadNotifications();
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to mark notification as read."
        );
      } finally {
        setActionLoading(null);
      }
    };

  const handleMarkAllRead =
    async () => {
      if (!token) {
        return;
      }

      const confirmed =
        window.confirm(
          "Mark all notifications as read?"
        );

      if (!confirmed) {
        return;
      }

      setActionLoading(
        "all"
      );

      setError(null);
      setSuccess(null);

      try {
        const count =
          await markAllAdminNotificationsRead(
            token
          );

        setSuccess(
          `${count} notification${count === 1 ? "" : "s"} marked as read.`
        );

        await loadNotifications();
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to mark all notifications as read."
        );
      } finally {
        setActionLoading(null);
      }
    };

  const handleOpen =
    async (
      notification: AdminNotification
    ) => {
    if (
      !notification.readAt
    ) {
      await handleMarkRead(
        notification
      );
    }

    if (
      notification.actionUrl
    ) {
      navigate(
        notification.actionUrl
      );
    }
  };

  return (
    <div className="notifications-page">
      <div className="page-heading-row">
        <div>
          <h2>
            Notification Center
          </h2>

          <p>
            Track urgent admin alerts for stock, orders, payments, refunds, and follow-ups.
          </p>
        </div>

        <div className="notification-heading-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={generating}
            onClick={() => {
              void handleGenerate();
            }}
          >
            {generating
              ? "Generating..."
              : "Generate alerts"}
          </button>

          <button
            type="button"
            className="secondary-button"
            disabled={
              actionLoading === "all" ||
              summary.unread === 0
            }
            onClick={() => {
              void handleMarkAllRead();
            }}
          >
            {actionLoading === "all"
              ? "Saving..."
              : "Mark all read"}
          </button>

          <button
            type="button"
            className="secondary-button"
            disabled={loading}
            onClick={() => {
              void loadNotifications();
            }}
          >
            {loading
              ? "Refreshing..."
              : "Refresh"}
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

      <div className="notification-summary-grid">
        <NotificationSummaryCard
          label="Unread"
          value={summary.unread}
          danger={summary.danger > 0}
        />

        <NotificationSummaryCard
          label="Danger"
          value={summary.danger}
          danger={summary.danger > 0}
        />

        <NotificationSummaryCard
          label="Warnings"
          value={summary.warning}
        />

        <NotificationSummaryCard
          label="Stock"
          value={summary.stock}
        />

        <NotificationSummaryCard
          label="Follow-ups"
          value={summary.followUp}
        />

        <NotificationSummaryCard
          label="Total"
          value={summary.total}
        />
      </div>

      <section className="panel notification-toolbar">
        <div className="notification-filter-tabs">
          {TYPE_OPTIONS.map(
            (option) => (
              <button
                key={option.value}
                type="button"
                className={
                  option.value ===
                  typeFilter
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setTypeFilter(
                    option.value
                  )
                }
              >
                {option.label}
              </button>
            )
          )}
        </div>

        <label className="notification-unread-toggle">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(event) =>
              setUnreadOnly(
                event.target.checked
              )
            }
          />

          Show unread only
        </label>

        <form
          className="notification-search-form"
          onSubmit={handleSearch}
        >
          <input
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Search title, message, source or type"
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
                setSubmittedSearch("");
              }}
            >
              Clear
            </button>
          ) : null}
        </form>
      </section>

      <section className="panel notifications-list-panel">
        {loading &&
        notifications.length === 0 ? (
          <div className="page-state compact">
            <div className="spinner" />

            <p>
              Loading notifications
            </p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="page-state compact">
            <div className="state-icon">
              ◎
            </div>

            <h3>
              No notifications found
            </h3>

            <p>
              No alerts match the selected filters.
            </p>
          </div>
        ) : (
          <div className="notification-card-list">
            {notifications.map(
              (notification) => (
                <NotificationCard
                  key={notification._id}
                  notification={notification}
                  actionLoading={
                    actionLoading ===
                    notification._id
                  }
                  onOpen={() => {
                    void handleOpen(
                      notification
                    );
                  }}
                  onMarkRead={() => {
                    void handleMarkRead(
                      notification
                    );
                  }}
                />
              )
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function NotificationSummaryCard({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <article
      className={`notification-summary-card ${
        danger
          ? "danger"
          : ""
      }`}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function NotificationCard({
  notification,
  actionLoading,
  onOpen,
  onMarkRead,
}: {
  notification: AdminNotification;
  actionLoading: boolean;
  onOpen: () => void;
  onMarkRead: () => void;
}) {
  const unread =
    !notification.readAt;

  return (
    <article
      className={`notification-card notification-${notification.severity} ${
        unread
          ? "notification-unread"
          : "notification-read"
      }`}
    >
      <div className="notification-card-top">
        <div>
          <div className="notification-badge-row">
            <span className="notification-type-badge">
              {formatLabel(
                notification.type
              )}
            </span>

            <span
              className={`notification-severity-badge notification-severity-${notification.severity}`}
            >
              {formatLabel(
                notification.severity
              )}
            </span>

            {unread ? (
              <span className="notification-new-badge">
                New
              </span>
            ) : null}
          </div>

          <h3>
            {notification.title}
          </h3>

          <p>
            {notification.message}
          </p>
        </div>
      </div>

      <div className="notification-source-row">
        {notification.sourceLabel ? (
          <span>
            Source: {notification.sourceLabel}
          </span>
        ) : null}

        <span>
          Created {formatDate(notification.createdAt)}
        </span>

        {notification.readAt ? (
          <span>
            Read {formatDate(notification.readAt)}
          </span>
        ) : null}
      </div>

      <div className="notification-actions">
        {notification.actionUrl ? (
          <button
            type="button"
            className="notification-action-button"
            onClick={onOpen}
          >
            Open
          </button>
        ) : null}

        {!notification.readAt ? (
          <button
            type="button"
            className="notification-action-button success"
            disabled={actionLoading}
            onClick={onMarkRead}
          >
            {actionLoading
              ? "Saving..."
              : "Mark read"}
          </button>
        ) : null}
      </div>
    </article>
  );
}