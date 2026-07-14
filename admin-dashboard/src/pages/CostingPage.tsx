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
  createAdminExpense,
  deleteAdminExpense,
  fetchAdminExpenses,
  fetchAdminProductCosts,
  updateAdminProductCost,
  type AdminBusinessExpense,
  type AdminExpenseSummary,
  type AdminProductCost,
  type ProductCostPayload,
} from "../services/adminCostingApi";

import "./costing.css";

const EXPENSE_CATEGORIES: Array<AdminBusinessExpense["category"]> = [
  "fruit",
  "juice",
  "bottle",
  "printing",
  "packaging",
  "delivery",
  "marketing",
  "labour",
  "rent",
  "utilities",
  "wastage",
  "other",
];

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
  ).format(Number(value || 0));
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

function toCostPayload(
  cost: AdminProductCost
): ProductCostPayload {
  return {
    bottleCost:
      Number(cost.bottleCost || 0),

    printingCost:
      Number(cost.printingCost || 0),

    fruitCost:
      Number(cost.fruitCost || 0),

    juiceCost:
      Number(cost.juiceCost || 0),

    packagingCost:
      Number(cost.packagingCost || 0),

    deliveryCost:
      Number(cost.deliveryCost || 0),

    otherCost:
      Number(cost.otherCost || 0),

    wastagePercent:
      Number(cost.wastagePercent || 0),
  };
}

export default function CostingPage() {
  const { token } =
    useAdminAuth();

  const today =
    getDateIdInIndia(0);

  const [fromDate, setFromDate] =
    useState(today);

  const [toDate, setToDate] =
    useState(today);

  const [costs, setCosts] =
    useState<AdminProductCost[]>([]);

  const [expenses, setExpenses] =
    useState<AdminBusinessExpense[]>([]);

  const [
    expenseSummary,
    setExpenseSummary,
  ] =
    useState<AdminExpenseSummary>({
      totalAmount: 0,
      categoryTotals: {},
    });

  const [costDrafts, setCostDrafts] =
    useState<Record<string, ProductCostPayload>>({});

  const [expenseDateId, setExpenseDateId] =
    useState(today);

  const [expenseTitle, setExpenseTitle] =
    useState("");

  const [
    expenseCategory,
    setExpenseCategory,
  ] =
    useState<AdminBusinessExpense["category"]>(
      "fruit"
    );

  const [expenseAmount, setExpenseAmount] =
    useState("");

  const [vendorName, setVendorName] =
    useState("");

  const [notes, setNotes] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [savingKey, setSavingKey] =
    useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const [success, setSuccess] =
    useState<string | null>(null);

  const loadData =
    useCallback(async () => {
      if (!token) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const [
          costResult,
          expenseResult,
        ] = await Promise.all([
          fetchAdminProductCosts(token),

          fetchAdminExpenses(token, {
            from:
              fromDate,

            to:
              toDate,
          }),
        ]);

        setCosts(costResult);
        setExpenses(
          expenseResult.expenses
        );
        setExpenseSummary(
          expenseResult.summary
        );

        setCostDrafts(
          Object.fromEntries(
            costResult.map((cost) => [
              cost.productId,
              toCostPayload(cost),
            ])
          )
        );
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load costing."
        );
      } finally {
        setLoading(false);
      }
    }, [
      token,
      fromDate,
      toDate,
    ]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const averageBottleCost =
    useMemo(() => {
      if (costs.length === 0) {
        return 0;
      }

      return Math.round(
        costs.reduce(
          (total, cost) =>
            total +
            Number(
              cost.totalCost || 0
            ),
          0
        ) / costs.length
      );
    }, [costs]);

  const updateDraft =
    (
      productId: string,
      field: keyof ProductCostPayload,
      value: string
    ) => {
      const numberValue =
        Number(value);

      setCostDrafts((current) => ({
        ...current,

        [productId]: {
          ...(current[productId] || {
            bottleCost: 0,
            printingCost: 0,
            fruitCost: 0,
            juiceCost: 0,
            packagingCost: 0,
            deliveryCost: 0,
            otherCost: 0,
            wastagePercent: 0,
          }),

          [field]:
            Number.isFinite(numberValue) &&
            numberValue >= 0
              ? numberValue
              : 0,
        },
      }));
    };

  const handleSaveCost =
    async (
      cost: AdminProductCost
    ) => {
      if (!token) {
        return;
      }

      const payload =
        costDrafts[cost.productId];

      if (!payload) {
        return;
      }

      setSavingKey(cost.productId);
      setError(null);
      setSuccess(null);

      try {
        await updateAdminProductCost(
          token,
          cost.productId,
          payload
        );

        setSuccess(
          `${cost.productName} cost updated.`
        );

        await loadData();
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to update product cost."
        );
      } finally {
        setSavingKey(null);
      }
    };

  const handleCreateExpense =
    async (
      event: FormEvent
    ) => {
      event.preventDefault();

      if (!token) {
        return;
      }

      const amount =
        Number(expenseAmount);

      if (!expenseTitle.trim()) {
        setError(
          "Expense title is required."
        );
        return;
      }

      if (
        !Number.isFinite(amount) ||
        amount <= 0
      ) {
        setError(
          "Expense amount must be greater than 0."
        );
        return;
      }

      setSavingKey("expense");
      setError(null);
      setSuccess(null);

      try {
        await createAdminExpense(
          token,
          {
            expenseDateId,
            title:
              expenseTitle.trim(),
            category:
              expenseCategory,
            amount,
            vendorName:
              vendorName.trim(),
            notes:
              notes.trim(),
          }
        );

        setSuccess(
          "Expense recorded."
        );

        setExpenseTitle("");
        setExpenseAmount("");
        setVendorName("");
        setNotes("");

        await loadData();
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to create expense."
        );
      } finally {
        setSavingKey(null);
      }
    };

  const handleDeleteExpense =
    async (
      expense: AdminBusinessExpense
    ) => {
      if (!token) {
        return;
      }

      const confirmed =
        window.confirm(
          `Delete expense "${expense.title}"?`
        );

      if (!confirmed) {
        return;
      }

      setSavingKey(expense._id);
      setError(null);
      setSuccess(null);

      try {
        await deleteAdminExpense(
          token,
          expense._id
        );

        setSuccess(
          "Expense deleted."
        );

        await loadData();
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to delete expense."
        );
      } finally {
        setSavingKey(null);
      }
    };

  return (
    <div className="costing-page">
      <div className="page-heading-row costing-heading">
        <div>
          <h2>
            Costing & expenses
          </h2>

          <p>
            Set real bottle costs and record daily business expenses for accurate profit reports.
          </p>
        </div>

        <div className="costing-heading-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={loading}
            onClick={() => {
              void loadData();
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

      <div className="costing-summary-grid">
        <article className="costing-summary-card">
          <span>
            Products
          </span>

          <strong>
            {costs.length}
          </strong>
        </article>

        <article className="costing-summary-card">
          <span>
            Avg cost / bottle
          </span>

          <strong>
            {formatCurrency(
              averageBottleCost
            )}
          </strong>
        </article>

        <article className="costing-summary-card">
          <span>
            Expense entries
          </span>

          <strong>
            {expenses.length}
          </strong>
        </article>

        <article className="costing-summary-card">
          <span>
            Expense total
          </span>

          <strong>
            {formatCurrency(
              expenseSummary.totalAmount
            )}
          </strong>
        </article>
      </div>

      <section className="panel product-cost-panel">
        <div className="costing-section-header">
          <div>
            <h3>
              Product-wise cost settings
            </h3>

            <p>
              These costs are used in Sales report to calculate product-level profit.
            </p>
          </div>
        </div>

        {loading && costs.length === 0 ? (
          <div className="page-state compact">
            <div className="spinner" />

            <p>
              Loading costs
            </p>
          </div>
        ) : (
          <div className="product-cost-list">
            {costs.map((cost) => {
              const draft =
                costDrafts[
                  cost.productId
                ] ||
                toCostPayload(cost);

              const draftBaseCost =
                draft.bottleCost +
                draft.printingCost +
                draft.fruitCost +
                draft.juiceCost +
                draft.packagingCost +
                draft.deliveryCost +
                draft.otherCost;

              const draftTotalCost =
                Math.round(
                  draftBaseCost *
                    (1 +
                      draft.wastagePercent /
                        100)
                );

              return (
                <article
                  key={cost.productId}
                  className="product-cost-card"
                >
                  <div className="product-cost-header">
                    <div>
                      <strong>
                        {
                          cost.productName
                        }
                      </strong>

                      <span>
                        {
                          cost.productId
                        }
                      </span>
                    </div>

                    <div className="product-total-cost">
                      <span>
                        Total / bottle
                      </span>

                      <strong>
                        {formatCurrency(
                          draftTotalCost
                        )}
                      </strong>
                    </div>
                  </div>

                  <div className="cost-input-grid">
                    <label>
                      Bottle
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={
                          draft.bottleCost
                        }
                        onChange={(event) =>
                          updateDraft(
                            cost.productId,
                            "bottleCost",
                            event.target.value
                          )
                        }
                      />
                    </label>

                    <label>
                      Printing
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={
                          draft.printingCost
                        }
                        onChange={(event) =>
                          updateDraft(
                            cost.productId,
                            "printingCost",
                            event.target.value
                          )
                        }
                      />
                    </label>

                    <label>
                      Fruit
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={
                          draft.fruitCost
                        }
                        onChange={(event) =>
                          updateDraft(
                            cost.productId,
                            "fruitCost",
                            event.target.value
                          )
                        }
                      />
                    </label>

                    <label>
                      Juice
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={
                          draft.juiceCost
                        }
                        onChange={(event) =>
                          updateDraft(
                            cost.productId,
                            "juiceCost",
                            event.target.value
                          )
                        }
                      />
                    </label>

                    <label>
                      Packaging
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={
                          draft.packagingCost
                        }
                        onChange={(event) =>
                          updateDraft(
                            cost.productId,
                            "packagingCost",
                            event.target.value
                          )
                        }
                      />
                    </label>

                    <label>
                      Delivery
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={
                          draft.deliveryCost
                        }
                        onChange={(event) =>
                          updateDraft(
                            cost.productId,
                            "deliveryCost",
                            event.target.value
                          )
                        }
                      />
                    </label>

                    <label>
                      Other
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={
                          draft.otherCost
                        }
                        onChange={(event) =>
                          updateDraft(
                            cost.productId,
                            "otherCost",
                            event.target.value
                          )
                        }
                      />
                    </label>

                    <label>
                      Wastage %
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={
                          draft.wastagePercent
                        }
                        onChange={(event) =>
                          updateDraft(
                            cost.productId,
                            "wastagePercent",
                            event.target.value
                          )
                        }
                      />
                    </label>
                  </div>

                  <div className="product-cost-actions">
                    <span>
                      Base cost:{" "}
                      {formatCurrency(
                        draftBaseCost
                      )}
                    </span>

                    <button
                      type="button"
                      className="primary-button"
                      disabled={
                        savingKey ===
                        cost.productId
                      }
                      onClick={() =>
                        handleSaveCost(
                          cost
                        )
                      }
                    >
                      {savingKey ===
                      cost.productId
                        ? "Saving..."
                        : "Save cost"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel expense-panel">
        <div className="costing-section-header">
          <div>
            <h3>
              Daily expenses
            </h3>

            <p>
              Record extra expenses like fruit purchase, delivery, labour, marketing and wastage.
            </p>
          </div>
        </div>

        <section className="expense-filter-row">
          <div>
            <span className="costing-eyebrow">
              EXPENSE RANGE
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
        </section>

        <form
          className="expense-form"
          onSubmit={handleCreateExpense}
        >
          <label>
            Date
            <input
              type="date"
              value={expenseDateId}
              onChange={(event) =>
                setExpenseDateId(
                  event.target.value
                )
              }
            />
          </label>

          <label>
            Title
            <input
              type="text"
              value={expenseTitle}
              onChange={(event) =>
                setExpenseTitle(
                  event.target.value
                )
              }
              placeholder="Example: Pineapple purchase"
            />
          </label>

          <label>
            Category
            <select
              value={expenseCategory}
              onChange={(event) =>
                setExpenseCategory(
                  event.target.value as AdminBusinessExpense["category"]
                )
              }
            >
              {EXPENSE_CATEGORIES.map(
                (category) => (
                  <option
                    key={category}
                    value={category}
                  >
                    {category}
                  </option>
                )
              )}
            </select>
          </label>

          <label>
            Amount
            <input
              type="number"
              min="1"
              step="1"
              value={expenseAmount}
              onChange={(event) =>
                setExpenseAmount(
                  event.target.value
                )
              }
              placeholder="500"
            />
          </label>

          <label>
            Vendor
            <input
              type="text"
              value={vendorName}
              onChange={(event) =>
                setVendorName(
                  event.target.value
                )
              }
              placeholder="Optional"
            />
          </label>

          <label className="full-width">
            Notes
            <textarea
              value={notes}
              onChange={(event) =>
                setNotes(
                  event.target.value
                )
              }
              placeholder="Optional notes"
            />
          </label>

          <div className="expense-form-actions full-width">
            <button
              type="submit"
              className="primary-button"
              disabled={
                savingKey ===
                "expense"
              }
            >
              {savingKey ===
              "expense"
                ? "Saving..."
                : "Add expense"}
            </button>
          </div>
        </form>

        <div className="expense-list">
          {expenses.length === 0 ? (
            <div className="page-state compact">
              <div className="state-icon">
                ₹
              </div>

              <h3>
                No expenses added
              </h3>

              <p>
                Add expenses for this date range.
              </p>
            </div>
          ) : (
            expenses.map((expense) => (
              <article
                key={expense._id}
                className="expense-card"
              >
                <div>
                  <strong>
                    {expense.title}
                  </strong>

                  <span>
                    {
                      expense.expenseDateId
                    }{" "}
                    · {
                      expense.category
                    }
                    {expense.vendorName
                      ? ` · ${expense.vendorName}`
                      : ""}
                  </span>

                  {expense.notes ? (
                    <p>
                      {expense.notes}
                    </p>
                  ) : null}
                </div>

                <div className="expense-card-right">
                  <strong>
                    {formatCurrency(
                      expense.amount
                    )}
                  </strong>

                  <button
                    type="button"
                    className="danger-light-button"
                    disabled={
                      savingKey ===
                      expense._id
                    }
                    onClick={() =>
                      handleDeleteExpense(
                        expense
                      )
                    }
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}