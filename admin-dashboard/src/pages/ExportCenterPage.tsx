// admin-dashboard/src/pages/ExportCenterPage.tsx

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
  downloadExportCenterCsv,
  fetchExportCenterSummary,
  type ExportCenterSummary,
  type ExportType,
} from "../services/adminExportCenterApi";

import "./exportCenter.css";

const EMPTY_SUMMARY: ExportCenterSummary =
  {
    totalOrders: 0,
    todayOrders: 0,
    totalCustomers: 0,
    lowStockProducts: 0,
    outOfStockProducts: 0,
    pendingCodOrders: 0,
    pendingCashHandover: 0,
    inventoryMovements24h: 0,
  };

const ORDER_STATUSES = [
  {
    value: "all",
    label: "All orders",
  },
  {
    value: "placed",
    label: "Placed",
  },
  {
    value: "confirmed",
    label: "Confirmed",
  },
  {
    value: "preparing",
    label: "Preparing",
  },
  {
    value: "out_for_delivery",
    label: "Out for delivery",
  },
  {
    value: "delivered",
    label: "Delivered",
  },
  {
    value: "cancelled",
    label: "Cancelled",
  },
];

function getTodayDateId() {
  return new Date()
    .toLocaleDateString(
      "en-CA",
      {
        timeZone:
          "Asia/Kolkata",
      }
    );
}

function getDateOffsetId(days: number) {
  const date =
    new Date();

  date.setDate(
    date.getDate() + days
  );

  return date.toLocaleDateString(
    "en-CA",
    {
      timeZone:
        "Asia/Kolkata",
    }
  );
}

function formatLabel(value: string) {
  return value
    .replace(/-/g, " ")
    .replace(/_/g, " ")
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}

export default function ExportCenterPage() {
  const { token } =
    useAdminAuth();

  const [
    summary,
    setSummary,
  ] =
    useState<ExportCenterSummary>(
      EMPTY_SUMMARY
    );

  const [
    dateFrom,
    setDateFrom,
  ] =
    useState(
      getDateOffsetId(-30)
    );

  const [
    dateTo,
    setDateTo,
  ] =
    useState(
      getTodayDateId()
    );

  const [
    closingDate,
    setClosingDate,
  ] =
    useState(
      getTodayDateId()
    );

  const [
    orderStatus,
    setOrderStatus,
  ] =
    useState("all");

  const [
    customerStatus,
    setCustomerStatus,
  ] =
    useState("all");

  const [
    productId,
    setProductId,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    exportingType,
    setExportingType,
  ] =
    useState<ExportType | null>(
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

  const loadSummary =
    useCallback(async () => {
      if (!token) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result =
          await fetchExportCenterSummary(
            token
          );

        setSummary(
          result.summary
        );
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load export center summary."
        );
      } finally {
        setLoading(false);
      }
    }, [
      token,
    ]);

  useEffect(() => {
    void loadSummary();
  }, [
    loadSummary,
  ]);

  const exportCards =
    useMemo(
      () => [
        {
          type: "orders" as ExportType,
          title: "Orders CSV",
          description:
            "All order details, payment, delivery address, items and totals.",
          count:
            summary.totalOrders,
          danger:
            false,
        },
        {
          type: "cod" as ExportType,
          title: "COD / Cash CSV",
          description:
            "COD status, cash collected, pending collections and handovers.",
          count:
            summary.pendingCodOrders +
            summary.pendingCashHandover,
          danger:
            summary.pendingCodOrders > 0 ||
            summary.pendingCashHandover > 0,
        },
        {
          type: "customers" as ExportType,
          title: "Customers CSV",
          description:
            "Customer contact list, status and order value summary.",
          count:
            summary.totalCustomers,
          danger:
            false,
        },
        {
          type: "inventory-movements" as ExportType,
          title: "Inventory Movements CSV",
          description:
            "Stock changes, manual adjustments, reservations and restorations.",
          count:
            summary.inventoryMovements24h,
          danger:
            false,
        },
        {
          type: "low-stock" as ExportType,
          title: "Low Stock CSV",
          description:
            "Products below threshold or out of stock.",
          count:
            summary.lowStockProducts,
          danger:
            summary.outOfStockProducts > 0,
        },
        {
          type: "daily-closing" as ExportType,
          title: "Daily Closing CSV",
          description:
            "Sales, COD collected, cash handed over, pending COD and failed refunds.",
          count:
            summary.todayOrders,
          danger:
            false,
        },
      ],
      [
        summary,
      ]
    );

  async function handleDownload(
    type: ExportType
  ) {
    if (!token) {
      return;
    }

    setExportingType(type);
    setError(null);
    setSuccess(null);

    try {
      await downloadExportCenterCsv(
        token,
        type,
        {
          dateFrom,
          dateTo,
          date:
            closingDate,
          status:
            type === "orders"
              ? orderStatus
              : type === "customers"
                ? customerStatus
                : undefined,
          productId:
            type ===
            "inventory-movements"
              ? productId
              : undefined,
        }
      );

      setSuccess(
        `${formatLabel(type)} CSV downloaded.`
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to download export."
      );
    } finally {
      setExportingType(null);
    }
  }

  return (
    <div className="export-center-page">
      <div className="page-heading-row">
        <div>
          <h2>
            Export Center
          </h2>

          <p>
            Download production,
            customer, inventory, COD and
            daily closing records for
            backup, accounting and audit.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          disabled={loading}
          onClick={() => {
            void loadSummary();
          }}
        >
          {loading
            ? "Refreshing..."
            : "Refresh summary"}
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

      <div className="export-summary-grid">
        <SummaryCard
          label="Total orders"
          value={
            summary.totalOrders
          }
        />

        <SummaryCard
          label="Today orders"
          value={
            summary.todayOrders
          }
        />

        <SummaryCard
          label="Customers"
          value={
            summary.totalCustomers
          }
        />

        <SummaryCard
          label="Pending COD"
          value={
            summary.pendingCodOrders
          }
          warning={
            summary.pendingCodOrders > 0
          }
        />

        <SummaryCard
          label="Cash handover"
          value={
            summary.pendingCashHandover
          }
          warning={
            summary.pendingCashHandover >
            0
          }
        />

        <SummaryCard
          label="Low stock"
          value={
            summary.lowStockProducts
          }
          danger={
            summary.outOfStockProducts >
            0
          }
          warning={
            summary.lowStockProducts >
            0
          }
        />
      </div>

      <section className="panel export-filter-panel">
        <div className="export-filter-grid">
          <label>
            Date from

            <input
              type="date"
              value={dateFrom}
              onChange={(event) =>
                setDateFrom(
                  event.target.value
                )
              }
            />
          </label>

          <label>
            Date to

            <input
              type="date"
              value={dateTo}
              onChange={(event) =>
                setDateTo(
                  event.target.value
                )
              }
            />
          </label>

          <label>
            Daily closing date

            <input
              type="date"
              value={closingDate}
              onChange={(event) =>
                setClosingDate(
                  event.target.value
                )
              }
            />
          </label>

          <label>
            Order status

            <select
              value={orderStatus}
              onChange={(event) =>
                setOrderStatus(
                  event.target.value
                )
              }
            >
              {ORDER_STATUSES.map(
                (status) => (
                  <option
                    key={
                      status.value
                    }
                    value={
                      status.value
                    }
                  >
                    {status.label}
                  </option>
                )
              )}
            </select>
          </label>

          <label>
            Customer status

            <select
              value={customerStatus}
              onChange={(event) =>
                setCustomerStatus(
                  event.target.value
                )
              }
            >
              <option value="all">
                All customers
              </option>

              <option value="active">
                Active only
              </option>

              <option value="inactive">
                Inactive only
              </option>
            </select>
          </label>

          <label>
            Product ID filter

            <input
              value={productId}
              onChange={(event) =>
                setProductId(
                  event.target.value
                )
              }
              placeholder="Optional"
            />
          </label>
        </div>

        <div className="export-filter-help">
          Orders, COD and inventory exports use the selected date range. Daily closing uses the daily closing date only.
        </div>
      </section>

      <section className="export-card-grid">
        {exportCards.map((card) => (
          <article
            key={card.type}
            className={`export-card ${
              card.danger
                ? "danger"
                : ""
            }`}
          >
            <div>
              <span>
                {card.count}
              </span>

              <h3>
                {card.title}
              </h3>

              <p>
                {card.description}
              </p>
            </div>

            <button
              type="button"
              disabled={
                exportingType === card.type
              }
              onClick={() => {
                void handleDownload(
                  card.type
                );
              }}
            >
              {exportingType ===
              card.type
                ? "Downloading..."
                : "Download CSV"}
            </button>
          </article>
        ))}
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  warning = false,
  danger = false,
}: {
  label: string;
  value: number;
  warning?: boolean;
  danger?: boolean;
}) {
  return (
    <article
      className={`export-summary-card ${
        danger
          ? "danger"
          : warning
            ? "warning"
            : ""
      }`}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}