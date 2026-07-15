// admin-dashboard/src/pages/FollowUpsPage.tsx

import {
  type FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";

import { useAdminAuth } from "../context/AuthContext";

import {
  fetchAdminFollowUps,
  updateAdminFollowUpStatus,
  type AdminFollowUp,
  type AdminFollowUpFilter,
  type AdminFollowUpsSummary,
  type AdminFollowUpStatus,
} from "../services/adminFollowUpsApi";

import "./followUps.css";

const EMPTY_SUMMARY: AdminFollowUpsSummary =
  {
    total: 0,
    pending: 0,
    overdue: 0,
    today: 0,
    done: 0,
    cancelled: 0,
  };

const FILTER_OPTIONS: Array<{
  value: AdminFollowUpFilter;
  label: string;
}> = [
  {
    value: "pending",
    label: "Pending",
  },
  {
    value: "overdue",
    label: "Overdue",
  },
  {
    value: "today",
    label: "Today",
  },
  {
    value: "done",
    label: "Done",
  },
  {
    value: "cancelled",
    label: "Cancelled",
  },
  {
    value: "all",
    label: "All",
  },
];

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

function getCustomer(
  followUp: AdminFollowUp
) {
  if (
    followUp.customer &&
    typeof followUp.customer ===
      "object"
  ) {
    return followUp.customer;
  }

  return null;
}

function isOverdue(
  followUp: AdminFollowUp
) {
  return (
    followUp.status === "pending" &&
    new Date(followUp.dueAt).getTime() <
      Date.now()
  );
}

function statusLabel(
  value: string
) {
  return value
    .split("_")
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1)
    )
    .join(" ");
}

export default function FollowUpsPage() {
  const { token } =
    useAdminAuth();

  const [
    followUps,
    setFollowUps,
  ] = useState<
    AdminFollowUp[]
  >([]);

  const [summary, setSummary] =
    useState<AdminFollowUpsSummary>(
      EMPTY_SUMMARY
    );

  const [statusFilter, setStatusFilter] =
    useState<AdminFollowUpFilter>(
      "pending"
    );

  const [search, setSearch] =
    useState("");

  const [
    submittedSearch,
    setSubmittedSearch,
  ] = useState("");

  const [loading, setLoading] =
    useState(true);

  const [
    actionLoadingId,
    setActionLoadingId,
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

  const loadFollowUps =
    useCallback(async () => {
      if (!token) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result =
          await fetchAdminFollowUps(
            token,
            {
              status:
                statusFilter,

              search:
                submittedSearch,

              limit: 300,
            }
          );

        setFollowUps(
          result.followUps
        );

        setSummary(
          result.summary
        );
      } catch (requestError) {
        setError(
          requestError instanceof
            Error
            ? requestError.message
            : "Unable to load follow-ups."
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
    void loadFollowUps();
  }, [loadFollowUps]);

  const handleSearch = (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setSubmittedSearch(
      search.trim()
    );
  };

  const handleStatusUpdate =
    async (
      followUp: AdminFollowUp,
      status: AdminFollowUpStatus
    ) => {
      if (!token) {
        return;
      }

      const confirmed =
        status === "cancelled"
          ? window.confirm(
              `Cancel follow-up "${followUp.title}"?`
            )
          : true;

      if (!confirmed) {
        return;
      }

      setActionLoadingId(
        followUp._id
      );

      setError(null);
      setSuccess(null);

      try {
        await updateAdminFollowUpStatus(
          token,
          followUp._id,
          status
        );

        setSuccess(
          "Follow-up updated successfully."
        );

        await loadFollowUps();
      } catch (requestError) {
        setError(
          requestError instanceof
            Error
            ? requestError.message
            : "Unable to update follow-up."
        );
      } finally {
        setActionLoadingId(
          null
        );
      }
    };

  const openCustomer = (
    followUp: AdminFollowUp
  ) => {
    const customer =
      getCustomer(followUp);

    const searchValue =
      customer?.phone ||
      customer?.email ||
      customer?.fullName ||
      "";

    const target =
      searchValue
        ? `/users?search=${encodeURIComponent(
            searchValue
          )}`
        : "/users";

    window.open(
      target,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <div className="followups-page">
      <div className="page-heading-row">
        <div>
          <h2>
            Follow-up Center
          </h2>

          <p>
            Track customer callbacks,
            COD follow-ups, complaints,
            and subscription reminders.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          disabled={loading}
          onClick={() => {
            void loadFollowUps();
          }}
        >
          {loading
            ? "Refreshing..."
            : "Refresh"}
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

      <div className="followup-summary-grid">
        <FollowUpSummaryCard
          label="Pending"
          value={summary.pending}
        />

        <FollowUpSummaryCard
          label="Overdue"
          value={summary.overdue}
          danger={summary.overdue > 0}
        />

        <FollowUpSummaryCard
          label="Today"
          value={summary.today}
        />

        <FollowUpSummaryCard
          label="Done"
          value={summary.done}
        />

        <FollowUpSummaryCard
          label="Cancelled"
          value={summary.cancelled}
        />

        <FollowUpSummaryCard
          label="Total"
          value={summary.total}
        />
      </div>

      <section className="panel followups-toolbar">
        <div className="followup-filter-tabs">
          {FILTER_OPTIONS.map(
            (option) => (
              <button
                key={option.value}
                type="button"
                className={
                  option.value ===
                  statusFilter
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setStatusFilter(
                    option.value
                  )
                }
              >
                {option.label}
              </button>
            )
          )}
        </div>

        <form
          className="followup-search-form"
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
            placeholder="Search customer name, phone, title or note"
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

      <section className="panel followups-list-panel">
        {loading &&
        followUps.length === 0 ? (
          <div className="page-state compact">
            <div className="spinner" />

            <p>
              Loading follow-ups
            </p>
          </div>
        ) : followUps.length === 0 ? (
          <div className="page-state compact">
            <div className="state-icon">
              ◎
            </div>

            <h3>
              No follow-ups found
            </h3>

            <p>
              No reminders match the
              selected filter.
            </p>
          </div>
        ) : (
          <div className="followup-card-list">
            {followUps.map(
              (followUp) => (
                <FollowUpCard
                  key={followUp._id}
                  followUp={followUp}
                  actionLoading={
                    actionLoadingId ===
                    followUp._id
                  }
                  onOpenCustomer={() =>
                    openCustomer(
                      followUp
                    )
                  }
                  onUpdateStatus={(
                    status
                  ) => {
                    void handleStatusUpdate(
                      followUp,
                      status
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

function FollowUpSummaryCard({
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
      className={`followup-summary-card ${
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

function FollowUpCard({
  followUp,
  actionLoading,
  onOpenCustomer,
  onUpdateStatus,
}: {
  followUp: AdminFollowUp;
  actionLoading: boolean;
  onOpenCustomer: () => void;
  onUpdateStatus: (
    status: AdminFollowUpStatus
  ) => void;
}) {
  const customer =
    getCustomer(followUp);

  const overdue =
    isOverdue(followUp);

  return (
    <article
      className={`followup-card followup-card-${followUp.status} ${
        overdue
          ? "followup-card-overdue"
          : ""
      }`}
    >
      <div className="followup-card-top">
        <div>
          <span className="followup-eyebrow">
            {overdue
              ? "Overdue"
              : statusLabel(
                  followUp.status
                )}
          </span>

          <h3>
            {followUp.title}
          </h3>

          <p>
            Due {formatDate(followUp.dueAt)}
          </p>
        </div>

        <span
          className={`followup-status-pill followup-status-${followUp.status}`}
        >
          {overdue
            ? "Overdue"
            : statusLabel(
                followUp.status
              )}
        </span>
      </div>

      {followUp.description ? (
        <p className="followup-description">
          {followUp.description}
        </p>
      ) : null}

      <div className="followup-customer-box">
        <strong>
          {customer?.fullName ||
            "Customer"}
        </strong>

        <span>
          {customer?.phone
            ? `+91 ${customer.phone}`
            : "No phone"}
          {customer?.email
            ? ` · ${customer.email}`
            : ""}
        </span>
      </div>

      <div className="followup-meta-row">
        <span>
          Added by{" "}
          {followUp.createdBySnapshot
            ?.fullName || "Admin"}
        </span>

        <span>
          {formatDate(
            followUp.createdAt
          )}
        </span>
      </div>

      {followUp.completedAt ? (
        <div className="followup-meta-row">
          <span>
            Completed by{" "}
            {followUp.completedBySnapshot
              ?.fullName || "Admin"}
          </span>

          <span>
            {formatDate(
              followUp.completedAt
            )}
          </span>
        </div>
      ) : null}

      <div className="followup-actions">
        <button
          type="button"
          className="followup-action-button"
          onClick={onOpenCustomer}
        >
          Open customer
        </button>

        {followUp.status !==
        "done" ? (
          <button
            type="button"
            className="followup-action-button success"
            disabled={actionLoading}
            onClick={() =>
              onUpdateStatus("done")
            }
          >
            {actionLoading
              ? "Saving..."
              : "Mark done"}
          </button>
        ) : (
          <button
            type="button"
            className="followup-action-button"
            disabled={actionLoading}
            onClick={() =>
              onUpdateStatus("pending")
            }
          >
            {actionLoading
              ? "Saving..."
              : "Reopen"}
          </button>
        )}

        {followUp.status !==
        "cancelled" ? (
          <button
            type="button"
            className="followup-action-button danger"
            disabled={actionLoading}
            onClick={() =>
              onUpdateStatus(
                "cancelled"
              )
            }
          >
            {actionLoading
              ? "Saving..."
              : "Cancel"}
          </button>
        ) : (
          <button
            type="button"
            className="followup-action-button"
            disabled={actionLoading}
            onClick={() =>
              onUpdateStatus("pending")
            }
          >
            {actionLoading
              ? "Saving..."
              : "Restore"}
          </button>
        )}
      </div>
    </article>
  );
}