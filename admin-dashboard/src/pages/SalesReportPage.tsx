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
  fetchAdminSalesReport,
  type AdminSalesReport,
} from "../services/adminSalesReportsApi";

import "./salesReport.css";

function getDateIdInIndia(
  offsetDays = 0
) {
  const now = new Date();

  now.setDate(
    now.getDate() + offsetDays
  );

  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(now);
}

function formatCurrency(value: number) {
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

function formatDateLabel(value: string) {
  if (!value) {
    return "Selected date";
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    }
  ).format(
    new Date(`${value}T00:00:00+05:30`)
  );
}

function getProfitClass(value: number) {
  if (value > 0) {
    return "profit-positive";
  }

  if (value < 0) {
    return "profit-negative";
  }

  return "profit-neutral";
}

export default function SalesReportPage() {
  const { token } =
    useAdminAuth();

  const today =
    getDateIdInIndia(0);

  const [fromDate, setFromDate] =
    useState(today);

  const [toDate, setToDate] =
    useState(today);

  const [
    costPerBottle,
    setCostPerBottle,
  ] = useState("30");

  const [report, setReport] =
    useState<AdminSalesReport | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(
      null
    );

  const parsedCostPerBottle =
    useMemo(() => {
      const value =
        Number(costPerBottle);

      if (
        !Number.isFinite(value) ||
        value < 0
      ) {
        return 0;
      }

      return value;
    }, [costPerBottle]);

  const loadReport =
    useCallback(async () => {
      if (!token) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data =
          await fetchAdminSalesReport(
            token,
            {
              from:
                fromDate,

              to:
                toDate,

              costPerBottle:
                parsedCostPerBottle,
            }
          );

        setReport(data);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load sales report."
        );
      } finally {
        setLoading(false);
      }
    }, [
      token,
      fromDate,
      toDate,
      parsedCostPerBottle,
    ]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const setTodayRange =
    () => {
      const date =
        getDateIdInIndia(0);

      setFromDate(date);
      setToDate(date);
    };

  const setLast7DaysRange =
    () => {
      setFromDate(
        getDateIdInIndia(-6)
      );

      setToDate(
        getDateIdInIndia(0)
      );
    };

  const setThisMonthRange =
    () => {
      const now =
        new Date();

      const firstDay =
        new Date(
          now.getFullYear(),
          now.getMonth(),
          1
        );

      const from =
        new Intl.DateTimeFormat(
          "en-CA",
          {
            timeZone: "Asia/Kolkata",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }
        ).format(firstDay);

      setFromDate(from);
      setToDate(
        getDateIdInIndia(0)
      );
    };

  return (
    <div className="sales-report-page">
      <div className="page-heading-row sales-heading">
        <div>
          <h2>
            Sales & profit report
          </h2>

          <p>
            Track revenue, bottle sales, COD/online split, cancellations, real costs, expenses and estimated gross profit.
          </p>
        </div>

        <div className="sales-heading-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={
              setTodayRange
            }
          >
            Today
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={
              setLast7DaysRange
            }
          >
            Last 7 days
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={
              setThisMonthRange
            }
          >
            This month
          </button>

          <button
            type="button"
            className="primary-button"
            disabled={!report}
            onClick={() =>
              window.print()
            }
          >
            Print report
          </button>
        </div>
      </div>

      {error ? (
        <div className="inline-error">
          {error}
        </div>
      ) : null}

      <section className="panel sales-filter-panel">
        <div>
          <span className="sales-eyebrow">
            REPORT RANGE
          </span>

          <strong>
            {formatDateLabel(
              fromDate
            )}
            {fromDate !== toDate
              ? ` – ${formatDateLabel(
                  toDate
                )}`
              : ""}
          </strong>
        </div>

        <label>
          From
          <input
            type="date"
            value={fromDate}
            onChange={(event) =>
              setFromDate(
                event.target.value
              )
            }
          />
        </label>

        <label>
          To
          <input
            type="date"
            value={toDate}
            onChange={(event) =>
              setToDate(
                event.target.value
              )
            }
          />
        </label>

        <label>
          Fallback cost / bottle
          <input
            type="number"
            min="0"
            step="1"
            value={costPerBottle}
            onChange={(event) =>
              setCostPerBottle(
                event.target.value
              )
            }
          />
        </label>

        <button
          type="button"
          className="secondary-button"
          disabled={loading}
          onClick={() => {
            void loadReport();
          }}
        >
          {loading
            ? "Refreshing..."
            : "Refresh"}
        </button>
      </section>

      {loading && !report ? (
        <section className="panel">
          <div className="page-state compact">
            <div className="spinner" />

            <p>
              Loading sales report
            </p>
          </div>
        </section>
      ) : !report ? (
        <section className="panel">
          <div className="page-state compact">
            <div className="state-icon">
              ₹
            </div>

            <h3>
              No report available
            </h3>

            <p>
              Select a date range and refresh.
            </p>
          </div>
        </section>
      ) : (
        <>
          <div className="sales-summary-grid">
            <article className="sales-summary-card">
              <span>
                Gross revenue
              </span>

              <strong>
                {formatCurrency(
                  report.summary.grossRevenue
                )}
              </strong>
            </article>

            <article className="sales-summary-card">
              <span>
                Bottles sold
              </span>

              <strong>
                {
                  report.summary.bottlesSold
                }
              </strong>
            </article>

            <article className="sales-summary-card">
              <span>
                Total cost
              </span>

              <strong>
                {formatCurrency(
                  report.summary.estimatedCost
                )}
              </strong>
            </article>

            <article
              className={`sales-summary-card ${getProfitClass(
                report.summary
                  .estimatedGrossProfit
              )}`}
            >
              <span>
                Estimated gross profit
              </span>

              <strong>
                {formatCurrency(
                  report.summary
                    .estimatedGrossProfit
                )}
              </strong>
            </article>
          </div>

          <section className="panel sales-highlight-panel">
            <div>
              <span>
                Best-selling bottle
              </span>

              <strong>
                {report.bestSellingProduct
                  ? report.bestSellingProduct
                      .name
                  : "No sales yet"}
              </strong>

              {report.bestSellingProduct ? (
                <small>
                  {
                    report.bestSellingProduct
                      .quantitySold
                  }{" "}
                  bottles ·{" "}
                  {formatCurrency(
                    report.bestSellingProduct
                      .revenue
                  )}
                </small>
              ) : null}
            </div>

            <div>
              <span>
                Product cost
              </span>

              <strong>
                {formatCurrency(
                  report.summary
                    .estimatedProductCost
                )}
              </strong>

              <small>
                Direct bottle production cost
              </small>
            </div>

            <div>
              <span>
                Expenses
              </span>

              <strong>
                {formatCurrency(
                  report.summary.expenseTotal
                )}
              </strong>

              <small>
                Extra business expenses
              </small>
            </div>

            <div>
              <span>
                Online paid
              </span>

              <strong>
                {formatCurrency(
                  report.summary
                    .onlinePaidAmount
                )}
              </strong>

              <small>
                {
                  report.paymentSplit.online
                    .orderCount
                }{" "}
                orders
              </small>
            </div>

            <div>
              <span>
                COD pending
              </span>

              <strong>
                {formatCurrency(
                  report.summary
                    .codPendingAmount
                )}
              </strong>

              <small>
                {
                  report.paymentSplit.cod
                    .orderCount
                }{" "}
                COD orders
              </small>
            </div>

            <div>
              <span>
                Cancelled value
              </span>

              <strong>
                {formatCurrency(
                  report.summary
                    .cancelledValue
                )}
              </strong>

              <small>
                {
                  report.summary
                    .cancelledOrderCount
                }{" "}
                cancelled orders
              </small>
            </div>
          </section>

          <section className="panel sales-table-panel">
            <div className="sales-section-header">
              <div>
                <h3>
                  Product-wise sales
                </h3>

                <p>
                  Bottles sold, revenue, real cost and estimated gross profit by product.
                </p>
              </div>
            </div>

            {report.productTotals.length ===
            0 ? (
              <div className="page-state compact">
                <div className="state-icon">
                  ◫
                </div>

                <h3>
                  No product sales
                </h3>

                <p>
                  Product-wise sales will appear after orders are placed.
                </p>
              </div>
            ) : (
              <div className="sales-table-wrapper">
                <table className="sales-table">
                  <thead>
                    <tr>
                      <th>Bottle</th>
                      <th>Sold</th>
                      <th>Revenue</th>
                      <th>Cost / bottle</th>
                      <th>Est. cost</th>
                      <th>Est. profit</th>
                    </tr>
                  </thead>

                  <tbody>
                    {report.productTotals.map(
                      (product) => (
                        <tr
                          key={
                            product.productId
                          }
                        >
                          <td>
                            <strong>
                              {product.name}
                            </strong>

                            <span>
                              {
                                product.productId
                              }{" "}
                              · {
                                product.sizeMl
                              }{" "}
                              ml
                            </span>
                          </td>

                          <td>
                            {
                              product.quantitySold
                            }
                          </td>

                          <td>
                            {formatCurrency(
                              product.revenue
                            )}
                          </td>

                          <td>
                            {formatCurrency(
                              product.costPerBottle
                            )}
                          </td>

                          <td>
                            {formatCurrency(
                              product.estimatedCost
                            )}
                          </td>

                          <td
                            className={getProfitClass(
                              product.estimatedGrossProfit
                            )}
                          >
                            {formatCurrency(
                              product.estimatedGrossProfit
                            )}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="panel sales-table-panel">
            <div className="sales-section-header">
              <div>
                <h3>
                  Date-wise sales
                </h3>

                <p>
                  Daily revenue split for the selected range.
                </p>
              </div>
            </div>

            {report.dateTotals.length ===
            0 ? (
              <div className="page-state compact">
                <div className="state-icon">
                  ₹
                </div>

                <h3>
                  No date-wise sales
                </h3>

                <p>
                  Select a range with active orders.
                </p>
              </div>
            ) : (
              <div className="sales-table-wrapper">
                <table className="sales-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Orders</th>
                      <th>Bottles</th>
                      <th>Revenue</th>
                      <th>COD</th>
                      <th>Online</th>
                    </tr>
                  </thead>

                  <tbody>
                    {report.dateTotals.map(
                      (dateRow) => (
                        <tr
                          key={
                            dateRow.dateId
                          }
                        >
                          <td>
                            <strong>
                              {formatDateLabel(
                                dateRow.dateId
                              )}
                            </strong>
                          </td>

                          <td>
                            {
                              dateRow.orderCount
                            }
                          </td>

                          <td>
                            {
                              dateRow.bottlesSold
                            }
                          </td>

                          <td>
                            {formatCurrency(
                              dateRow.revenue
                            )}
                          </td>

                          <td>
                            {formatCurrency(
                              dateRow.codRevenue
                            )}
                          </td>

                          <td>
                            {formatCurrency(
                              dateRow.onlineRevenue
                            )}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="panel sales-note-panel">
            <strong>
              Profit note
            </strong>

            <p>
              Estimated profit is calculated as gross revenue minus product-wise bottle costs and daily business expenses. If a product cost is not configured, the fallback cost per bottle is used.
            </p>
          </section>
        </>
      )}
    </div>
  );
}