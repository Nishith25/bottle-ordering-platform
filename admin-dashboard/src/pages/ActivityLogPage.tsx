// admin-dashboard/src/pages/ActivityLogPage.tsx

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useAdminAuth,
} from "../context/AuthContext";

import {
  downloadAdminActivityLogsCsv,
  fetchAdminActivityLogs,
  type AdminActivityActionType,
  type AdminActivityAdmin,
  type AdminActivityInsights,
  type AdminActivityLog,
  type AdminActivityLogFilters,
  type AdminActivityPagination,
  type AdminActivitySummary,
} from "../services/adminActivityLogsApi";

import "./activityLog.css";

const EMPTY_SUMMARY: AdminActivitySummary =
  {
    total: 0,
    info: 0,
    success: 0,
    warning: 0,
    danger: 0,
    today: 0,
  };

const EMPTY_PAGINATION: AdminActivityPagination =
  {
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 1,
    hasPreviousPage: false,
    hasNextPage: false,
  };

const EMPTY_INSIGHTS: AdminActivityInsights =
  {
    topActions: [],
    topAdmins: [],
    topEntities: [],
  };

const DEFAULT_ACTION_TYPES = [
  {
    value: "all",
    label: "All actions",
  },
  {
    value: "order_status_changed",
    label: "Order status",
  },
  {
    value: "order_cancelled",
    label: "Order cancelled",
  },
  {
    value: "order_refund_retried",
    label: "Refund retry",
  },
  {
    value: "delivery_partner_assigned",
    label: "Delivery assigned",
  },
  {
    value: "delivery_partner_reassigned",
    label: "Delivery reassigned",
  },
  {
    value: "cod_collected",
    label: "COD collected",
  },
  {
    value: "cash_handed_over",
    label: "Cash handover",
  },
  {
    value: "inventory_updated",
    label: "Inventory",
  },
  {
    value: "customer_note_added",
    label: "Customer note",
  },
  {
    value: "customer_follow_up_added",
    label: "Customer follow-up",
  },
  {
    value: "follow_up_status_changed",
    label: "Follow-up status",
  },
  {
    value: "customer_follow_up_status_changed",
    label: "Customer follow-up status",
  },
  {
    value: "notification_read",
    label: "Notification read",
  },
  {
    value: "notifications_marked_all_read",
    label: "Notifications all read",
  },
  {
    value: "admin_notifications_generated",
    label: "Notifications generated",
  },
  {
    value: "user_status_changed",
    label: "User status",
  },
  {
    value: "user_role_changed",
    label: "User role",
  },
];

const ENTITY_TYPES = [
  {
    value: "all",
    label: "All entities",
  },
  {
    value: "order",
    label: "Orders",
  },
  {
    value: "customer",
    label: "Customers",
  },
  {
    value: "user",
    label: "Users",
  },
  {
    value: "product",
    label: "Products",
  },
  {
    value: "inventory",
    label: "Inventory",
  },
  {
    value: "follow_up",
    label: "Follow-ups",
  },
  {
    value: "notification",
    label: "Notifications",
  },
  {
    value: "cash_collection",
    label: "COD cash",
  },
  {
    value: "system",
    label: "System",
  },
];

const SEVERITY_OPTIONS = [
  {
    value: "all",
    label: "All severities",
  },
  {
    value: "info",
    label: "Info",
  },
  {
    value: "success",
    label: "Success",
  },
  {
    value: "warning",
    label: "Warning",
  },
  {
    value: "danger",
    label: "Danger",
  },
];

function formatDate(value?: string | null) {
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

function getDateInputValue(date: Date) {
  return date
    .toISOString()
    .slice(0, 10);
}

function getMetadataString(
  metadata: Record<string, unknown>,
  key: string
) {
  const value =
    metadata?.[key];

  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value).trim();
}

function getCustomerSearchText(
  log: AdminActivityLog
) {
  return (
    log.targetUserSnapshot?.phone ||
    log.targetUserSnapshot?.email ||
    log.targetUserSnapshot?.fullName ||
    getMetadataString(
      log.metadata,
      "customerPhone"
    ) ||
    getMetadataString(
      log.metadata,
      "customerEmail"
    ) ||
    getMetadataString(
      log.metadata,
      "customerName"
    ) ||
    log.entityLabel ||
    ""
  ).trim();
}

function getOrderSearchText(
  log: AdminActivityLog
) {
  return (
    getMetadataString(
      log.metadata,
      "orderNumber"
    ) ||
    log.entityLabel ||
    ""
  ).trim();
}

function buildInternalUrl(
  path: string,
  searchValue?: string
) {
  if (!searchValue?.trim()) {
    return path;
  }

  return `${path}?search=${encodeURIComponent(
    searchValue.trim()
  )}`;
}

function openInternalPage(url: string) {
  window.open(
    `${window.location.origin}${url}`,
    "_blank",
    "noopener,noreferrer"
  );
}

function getActivityActions(
  log: AdminActivityLog
) {
  const actions: {
    label: string;
    url: string;
  }[] = [];

  const orderSearch =
    getOrderSearchText(log);

  const customerSearch =
    getCustomerSearchText(log);

  if (
    log.entityType === "order" ||
    log.actionType.includes("order") ||
    orderSearch.startsWith("SS-")
  ) {
    actions.push({
      label: "Open order",
      url: buildInternalUrl(
        "/orders",
        orderSearch
      ),
    });
  }

  if (
    log.entityType === "cash_collection" ||
    log.actionType.includes("cod") ||
    log.actionType.includes("cash")
  ) {
    actions.push({
      label: "Open operations",
      url: "/operations",
    });

    if (orderSearch) {
      actions.push({
        label: "Open order",
        url: buildInternalUrl(
          "/orders",
          orderSearch
        ),
      });
    }
  }

  if (
    log.entityType === "customer" ||
    log.entityType === "user" ||
    log.actionType.includes("user_") ||
    log.actionType.includes("customer_")
  ) {
    if (customerSearch) {
      actions.push({
        label: "Open customer",
        url: buildInternalUrl(
          "/users",
          customerSearch
        ),
      });
    }
  }

  if (
    log.entityType === "follow_up" ||
    log.actionType.includes("follow_up")
  ) {
    actions.push({
      label: "Open follow-ups",
      url: buildInternalUrl(
        "/follow-ups",
        log.entityLabel ||
          log.actionLabel
      ),
    });

    if (customerSearch) {
      actions.push({
        label: "Open customer",
        url: buildInternalUrl(
          "/users",
          customerSearch
        ),
      });
    }
  }

  if (
    log.entityType === "notification" ||
    log.actionType.includes("notification")
  ) {
    actions.push({
      label: "Open notifications",
      url: buildInternalUrl(
        "/notifications",
        log.entityLabel ||
          log.actionLabel
      ),
    });
  }

  if (
    log.entityType === "inventory" ||
    log.entityType === "product" ||
    log.actionType.includes("inventory")
  ) {
    actions.push({
      label: "Open products",
      url: "/products",
    });
  }

  const uniqueActions =
    new Map<
      string,
      {
        label: string;
        url: string;
      }
    >();

  for (const action of actions) {
    uniqueActions.set(
      `${action.label}-${action.url}`,
      action
    );
  }

  return [
    ...uniqueActions.values(),
  ];
}

function escapeCsv(value: unknown) {
  const text = String(value ?? "");

  if (
    text.includes(",") ||
    text.includes('"') ||
    text.includes("\n")
  ) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function downloadTextFile(
  filename: string,
  content: string
) {
  const blob = new Blob([content], {
    type: "text/csv;charset=utf-8;",
  });

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

function exportActivityLogsCsv(
  logs: AdminActivityLog[]
) {
  const headers = [
    "Date",
    "Action Type",
    "Action Label",
    "Severity",
    "Message",
    "Admin Name",
    "Admin Email",
    "Entity Type",
    "Entity Label",
    "Target User",
    "Target User Phone",
    "Request Method",
    "Request Path",
    "Metadata JSON",
  ];

  const rows = logs.map((log) => [
    formatDate(log.createdAt),
    log.actionType,
    log.actionLabel,
    log.severity,
    log.message,
    log.actorSnapshot?.fullName || "",
    log.actorSnapshot?.email || "",
    log.entityType,
    log.entityLabel,
    log.targetUserSnapshot?.fullName || "",
    log.targetUserSnapshot?.phone || "",
    log.requestSnapshot?.method || "",
    log.requestSnapshot?.path || "",
    JSON.stringify(log.metadata || {}),
  ]);

  const csv = [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) =>
      row.map(escapeCsv).join(",")
    ),
  ].join("\n");

  const dateId =
    new Date()
      .toISOString()
      .slice(0, 10);

  downloadTextFile(
    `solidsip-activity-log-page-${dateId}.csv`,
    csv
  );
}

async function copyText(text: string) {
  if (
    navigator.clipboard &&
    navigator.clipboard.writeText
  ) {
    await navigator.clipboard.writeText(
      text
    );
    return;
  }

  const textarea =
    document.createElement("textarea");

  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function buildCopySummary(
  log: AdminActivityLog
) {
  return [
    `Action: ${log.actionLabel}`,
    `Type: ${log.actionType}`,
    `Severity: ${log.severity}`,
    `Message: ${log.message}`,
    `Admin: ${
      log.actorSnapshot?.fullName || "System/Admin"
    }`,
    `Entity: ${
      log.entityLabel || log.entityType || "—"
    }`,
    `Target: ${
      log.targetUserSnapshot?.fullName || "—"
    }`,
    `Date: ${formatDate(log.createdAt)}`,
  ].join("\n");
}

function buildActionOptions(
  actionTypes: AdminActivityActionType[]
) {
  const options =
    new Map<
      string,
      {
        value: string;
        label: string;
      }
    >();

  for (const option of DEFAULT_ACTION_TYPES) {
    options.set(
      option.value,
      option
    );
  }

  for (const item of actionTypes) {
    if (!item.actionType) {
      continue;
    }

    if (
      !options.has(item.actionType)
    ) {
      options.set(
        item.actionType,
        {
          value:
            item.actionType,
          label:
            `${formatLabel(item.actionType)} (${item.count})`,
        }
      );
    }
  }

  return [
    ...options.values(),
  ];
}

export default function ActivityLogPage() {
  const { token } =
    useAdminAuth();

  const [
    logs,
    setLogs,
  ] =
    useState<AdminActivityLog[]>(
      []
    );

  const [
    summary,
    setSummary,
  ] =
    useState<AdminActivitySummary>(
      EMPTY_SUMMARY
    );

  const [
    admins,
    setAdmins,
  ] =
    useState<AdminActivityAdmin[]>(
      []
    );

  const [
    actionTypes,
    setActionTypes,
  ] =
    useState<AdminActivityActionType[]>(
      []
    );

  const [
    insights,
    setInsights,
  ] =
    useState<AdminActivityInsights>(
      EMPTY_INSIGHTS
    );

  const [
    pagination,
    setPagination,
  ] =
    useState<AdminActivityPagination>(
      EMPTY_PAGINATION
    );

  const [
    actionType,
    setActionType,
  ] = useState("all");

  const [
    entityType,
    setEntityType,
  ] = useState("all");

  const [
    severity,
    setSeverity,
  ] = useState("all");

  const [
    adminId,
    setAdminId,
  ] = useState("");

  const [
    dateFrom,
    setDateFrom,
  ] = useState("");

  const [
    dateTo,
    setDateTo,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    submittedSearch,
    setSubmittedSearch,
  ] = useState("");

  const [
    page,
    setPage,
  ] = useState(1);

  const [
    limit,
    setLimit,
  ] = useState(50);

  const [
    expandedLogId,
    setExpandedLogId,
  ] =
    useState<string | null>(
      null
    );

  const [
    copiedLogId,
    setCopiedLogId,
  ] =
    useState<string | null>(
      null
    );

  const [
    exportingAll,
    setExportingAll,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );

  const actionOptions =
    useMemo(
      () =>
        buildActionOptions(
          actionTypes
        ),
      [actionTypes]
    );

  const currentFilters =
    useCallback(
      (
        overrides: Partial<AdminActivityLogFilters> = {}
      ): AdminActivityLogFilters => ({
        actionType,
        entityType,
        severity,
        adminId,
        search:
          submittedSearch,
        dateFrom,
        dateTo,
        page,
        limit,
        ...overrides,
      }),
      [
        actionType,
        entityType,
        severity,
        adminId,
        submittedSearch,
        dateFrom,
        dateTo,
        page,
        limit,
      ]
    );

  const loadLogs =
    useCallback(async () => {
      if (!token) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result =
          await fetchAdminActivityLogs(
            token,
            currentFilters()
          );

        setLogs(result.logs);
        setSummary(result.summary);
        setAdmins(result.admins);
        setActionTypes(
          result.actionTypes || []
        );
        setInsights(
          result.insights ||
            EMPTY_INSIGHTS
        );
        setPagination(
          result.pagination ||
            EMPTY_PAGINATION
        );
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load activity logs."
        );
      } finally {
        setLoading(false);
      }
    }, [
      token,
      currentFilters,
    ]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  function resetToFirstPage() {
    setPage(1);
    setExpandedLogId(null);
  }

  function resetFilters() {
    setActionType("all");
    setEntityType("all");
    setSeverity("all");
    setAdminId("");
    setDateFrom("");
    setDateTo("");
    setSearch("");
    setSubmittedSearch("");
    setPage(1);
    setExpandedLogId(null);
  }

  const handleSearch = (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    resetToFirstPage();

    setSubmittedSearch(
      search.trim()
    );
  };

  function applyDatePreset(
    preset:
      | "today"
      | "7"
      | "30"
      | "clear"
  ) {
    resetToFirstPage();

    if (preset === "clear") {
      setDateFrom("");
      setDateTo("");
      return;
    }

    const today =
      new Date();

    const start =
      new Date();

    if (preset === "7") {
      start.setDate(
        today.getDate() - 6
      );
    }

    if (preset === "30") {
      start.setDate(
        today.getDate() - 29
      );
    }

    setDateFrom(
      getDateInputValue(start)
    );
    setDateTo(
      getDateInputValue(today)
    );
  }

  async function handleCopyLog(
    log: AdminActivityLog
  ) {
    try {
      await copyText(
        buildCopySummary(log)
      );

      setCopiedLogId(log._id);

      window.setTimeout(() => {
        setCopiedLogId((current) =>
          current === log._id
            ? null
            : current
        );
      }, 1600);
    } catch {
      setError(
        "Unable to copy activity log."
      );
    }
  }

  async function handleExportAllFiltered() {
    if (!token) {
      return;
    }

    setExportingAll(true);
    setError(null);

    try {
      await downloadAdminActivityLogsCsv(
        token,
        currentFilters({
          page: undefined,
          limit: 10000,
        })
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to export all filtered logs."
      );
    } finally {
      setExportingAll(false);
    }
  }

  return (
    <div className="activity-log-page">
      <div className="page-heading-row">
        <div>
          <h2>
            Activity Log
          </h2>

          <p>
            Track admin actions,
            operational changes, and
            accountability history.
          </p>
        </div>

        <div className="activity-heading-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={
              logs.length === 0
            }
            onClick={() =>
              exportActivityLogsCsv(
                logs
              )
            }
          >
            Export page CSV
          </button>

          <button
            type="button"
            className="secondary-button"
            disabled={
              exportingAll ||
              pagination.total === 0
            }
            onClick={() => {
              void handleExportAllFiltered();
            }}
          >
            {exportingAll
              ? "Exporting..."
              : "Export all filtered"}
          </button>

          <button
            type="button"
            className="secondary-button"
            disabled={loading}
            onClick={() => {
              void loadLogs();
            }}
          >
            {loading
              ? "Refreshing..."
              : "Refresh logs"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="inline-error">
          {error}
        </div>
      ) : null}

      <div className="activity-summary-grid">
        <ActivitySummaryCard
          label="Total filtered"
          value={summary.total}
        />

        <ActivitySummaryCard
          label="Today"
          value={summary.today}
        />

        <ActivitySummaryCard
          label="Success"
          value={summary.success}
        />

        <ActivitySummaryCard
          label="Warnings"
          value={summary.warning}
        />

        <ActivitySummaryCard
          label="Danger"
          value={summary.danger}
          danger={
            summary.danger > 0
          }
        />

        <ActivitySummaryCard
          label="Info"
          value={summary.info}
        />
      </div>

      <ActivityInsightsPanel
        insights={insights}
      />

      <section className="panel activity-toolbar">
        <div className="activity-filter-grid">
          <label>
            Action

            <select
              value={actionType}
              onChange={(event) => {
                resetToFirstPage();
                setActionType(
                  event.target.value
                );
              }}
            >
              {actionOptions.map(
                (option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                )
              )}
            </select>
          </label>

          <label>
            Entity

            <select
              value={entityType}
              onChange={(event) => {
                resetToFirstPage();
                setEntityType(
                  event.target.value
                );
              }}
            >
              {ENTITY_TYPES.map(
                (option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                )
              )}
            </select>
          </label>

          <label>
            Severity

            <select
              value={severity}
              onChange={(event) => {
                resetToFirstPage();
                setSeverity(
                  event.target.value
                );
              }}
            >
              {SEVERITY_OPTIONS.map(
                (option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                )
              )}
            </select>
          </label>

          <label>
            Admin

            <select
              value={adminId}
              onChange={(event) => {
                resetToFirstPage();
                setAdminId(
                  event.target.value
                );
              }}
            >
              <option value="">
                All admins
              </option>

              {admins.map((admin) => (
                <option
                  key={admin._id}
                  value={admin._id}
                >
                  {admin.fullName} · {admin.email}
                </option>
              ))}
            </select>
          </label>

          <label>
            From

            <input
              type="date"
              value={dateFrom}
              onChange={(event) => {
                resetToFirstPage();
                setDateFrom(
                  event.target.value
                );
              }}
            />
          </label>

          <label>
            To

            <input
              type="date"
              value={dateTo}
              onChange={(event) => {
                resetToFirstPage();
                setDateTo(
                  event.target.value
                );
              }}
            />
          </label>
        </div>

        <div className="activity-preset-row">
          <button
            type="button"
            onClick={() =>
              applyDatePreset("today")
            }
          >
            Today
          </button>

          <button
            type="button"
            onClick={() =>
              applyDatePreset("7")
            }
          >
            Last 7 days
          </button>

          <button
            type="button"
            onClick={() =>
              applyDatePreset("30")
            }
          >
            Last 30 days
          </button>

          <button
            type="button"
            onClick={() =>
              applyDatePreset("clear")
            }
          >
            Clear dates
          </button>
        </div>

        <form
          className="activity-search-form"
          onSubmit={handleSearch}
        >
          <input
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Search action, admin, customer, order number or message"
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
                resetToFirstPage();
                setSearch("");
                setSubmittedSearch("");
              }}
            >
              Clear
            </button>
          ) : null}

          <button
            type="button"
            className="secondary-button"
            onClick={resetFilters}
          >
            Reset filters
          </button>
        </form>

        <div className="activity-pagination-bar">
          <div>
            Showing page{" "}
            <strong>
              {pagination.page}
            </strong>{" "}
            of{" "}
            <strong>
              {pagination.totalPages}
            </strong>{" "}
            ·{" "}
            <strong>
              {pagination.total}
            </strong>{" "}
            filtered logs
          </div>

          <div className="activity-pagination-actions">
            <label>
              Rows

              <select
                value={limit}
                onChange={(event) => {
                  resetToFirstPage();
                  setLimit(
                    Number(
                      event.target.value
                    )
                  );
                }}
              >
                <option value={25}>
                  25
                </option>

                <option value={50}>
                  50
                </option>

                <option value={100}>
                  100
                </option>

                <option value={250}>
                  250
                </option>
              </select>
            </label>

            <button
              type="button"
              disabled={
                !pagination.hasPreviousPage ||
                loading
              }
              onClick={() =>
                setPage((current) =>
                  Math.max(
                    current - 1,
                    1
                  )
                )
              }
            >
              Previous
            </button>

            <button
              type="button"
              disabled={
                !pagination.hasNextPage ||
                loading
              }
              onClick={() =>
                setPage((current) =>
                  current + 1
                )
              }
            >
              Next
            </button>
          </div>
        </div>
      </section>

      <section className="panel activity-list-panel">
        {loading &&
        logs.length === 0 ? (
          <div className="page-state compact">
            <div className="spinner" />

            <p>
              Loading activity logs
            </p>
          </div>
        ) : logs.length === 0 ? (
          <div className="page-state compact">
            <div className="state-icon">
              ◎
            </div>

            <h3>
              No activity found
            </h3>

            <p>
              No logs match the selected filters.
            </p>
          </div>
        ) : (
          <div className="activity-log-list">
            {logs.map((log) => (
              <ActivityLogCard
                key={log._id}
                log={log}
                expanded={
                  expandedLogId ===
                  log._id
                }
                copied={
                  copiedLogId ===
                  log._id
                }
                onToggleDetails={() =>
                  setExpandedLogId(
                    expandedLogId ===
                      log._id
                      ? null
                      : log._id
                  )
                }
                onCopy={() => {
                  void handleCopyLog(log);
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ActivitySummaryCard({
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
      className={`activity-summary-card ${
        danger ? "danger" : ""
      }`}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function ActivityInsightsPanel({
  insights,
}: {
  insights: AdminActivityInsights;
}) {
  return (
    <section className="activity-insights-grid">
      <ActivityInsightCard
        title="Top actions"
        items={insights.topActions}
      />

      <ActivityInsightCard
        title="Most active admins"
        items={insights.topAdmins}
      />

      <ActivityInsightCard
        title="Top entities"
        items={insights.topEntities}
      />
    </section>
  );
}

function ActivityInsightCard({
  title,
  items,
}: {
  title: string;
  items: {
    label: string;
    email?: string;
    entityType?: string;
    count: number;
  }[];
}) {
  return (
    <article className="activity-insight-card">
      <h3>{title}</h3>

      {items.length === 0 ? (
        <p>No data yet.</p>
      ) : (
        <div className="activity-insight-list">
          {items.map((item) => (
            <div
              key={`${title}-${item.label}-${item.count}`}
              className="activity-insight-row"
            >
              <div>
                <strong>
                  {formatLabel(
                    item.label
                  )}
                </strong>

                {item.email ? (
                  <span>{item.email}</span>
                ) : item.entityType ? (
                  <span>
                    {formatLabel(
                      item.entityType
                    )}
                  </span>
                ) : null}
              </div>

              <b>{item.count}</b>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function ActivityLogCard({
  log,
  expanded,
  copied,
  onToggleDetails,
  onCopy,
}: {
  log: AdminActivityLog;
  expanded: boolean;
  copied: boolean;
  onToggleDetails: () => void;
  onCopy: () => void;
}) {
  const actions =
    getActivityActions(log);

  return (
    <article
      className={`activity-log-card activity-${log.severity}`}
    >
      <div className="activity-log-top">
        <div>
          <div className="activity-badge-row">
            <span className="activity-action-badge">
              {formatLabel(
                log.actionType
              )}
            </span>

            <span
              className={`activity-severity-badge activity-severity-${log.severity}`}
            >
              {formatLabel(
                log.severity
              )}
            </span>

            {log.entityType ? (
              <span className="activity-entity-badge">
                {formatLabel(
                  log.entityType
                )}
              </span>
            ) : null}
          </div>

          <h3>
            {log.actionLabel}
          </h3>

          {log.message ? (
            <p>{log.message}</p>
          ) : null}
        </div>

        <span className="activity-time">
          {formatDate(log.createdAt)}
        </span>
      </div>

      <div className="activity-detail-grid">
        <div>
          <span>Admin</span>

          <strong>
            {log.actorSnapshot?.fullName ||
              "System/Admin"}
          </strong>

          <small>
            {log.actorSnapshot?.email ||
              "No email"}
          </small>
        </div>

        <div>
          <span>Entity</span>

          <strong>
            {log.entityLabel ||
              log.entityType ||
              "—"}
          </strong>

          <small>
            {log.entityType
              ? formatLabel(
                  log.entityType
                )
              : "No entity"}
          </small>
        </div>

        <div>
          <span>Target user</span>

          <strong>
            {log.targetUserSnapshot?.fullName ||
              "—"}
          </strong>

          <small>
            {log.targetUserSnapshot?.phone
              ? `+91 ${log.targetUserSnapshot.phone}`
              : log.targetUserSnapshot?.email ||
                ""}
          </small>
        </div>

        <div>
          <span>Request</span>

          <strong>
            {log.requestSnapshot?.method ||
              "—"}
          </strong>

          <small>
            {log.requestSnapshot?.path ||
              ""}
          </small>
        </div>
      </div>

      <div className="activity-action-row">
        {actions.map((action) => (
          <button
            key={`${action.label}-${action.url}`}
            type="button"
            className="activity-open-button"
            onClick={() =>
              openInternalPage(
                action.url
              )
            }
          >
            {action.label}
          </button>
        ))}

        <button
          type="button"
          className="activity-open-button"
          onClick={onToggleDetails}
        >
          {expanded
            ? "Hide details"
            : "View details"}
        </button>

        <button
          type="button"
          className="activity-open-button"
          onClick={onCopy}
        >
          {copied
            ? "Copied"
            : "Copy summary"}
        </button>
      </div>

      {expanded ? (
        <div className="activity-expanded-panel">
          <div>
            <h4>
              Metadata
            </h4>

            <pre>
              {JSON.stringify(
                log.metadata || {},
                null,
                2
              )}
            </pre>
          </div>

          <div>
            <h4>
              Request snapshot
            </h4>

            <pre>
              {JSON.stringify(
                log.requestSnapshot || {},
                null,
                2
              )}
            </pre>
          </div>

          <div>
            <h4>
              Target user snapshot
            </h4>

            <pre>
              {JSON.stringify(
                log.targetUserSnapshot || {},
                null,
                2
              )}
            </pre>
          </div>
        </div>
      ) : null}
    </article>
  );
}