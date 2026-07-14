import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAdminAuth } from "../context/AuthContext";

import {
  fetchAdminProducts,
  type AdminProduct,
} from "../services/api";

import {
  createAdminBatch,
  fetchAdminBatches,
  fetchNextBatchNumber,
  type AdminBatchRecord,
} from "../services/adminBatchesApi";

import "./batchRegister.css";

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

function getDateTimeLocalNow() {
  const now = new Date();

  const offsetMs =
    now.getTimezoneOffset() *
    60 *
    1000;

  return new Date(
    now.getTime() - offsetMs
  )
    .toISOString()
    .slice(0, 16);
}

function toIsoFromDateTimeLocal(
  value: string
) {
  if (!value) {
    return new Date().toISOString();
  }

  return new Date(value).toISOString();
}

function formatDateTime(value: string) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  ).format(new Date(value));
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

function getCreatedBy(
  batch: AdminBatchRecord
) {
  if (
    batch.createdBySnapshot?.fullName
  ) {
    return batch.createdBySnapshot.fullName;
  }

  if (
    batch.createdBy &&
    typeof batch.createdBy ===
      "object" &&
    batch.createdBy.fullName
  ) {
    return batch.createdBy.fullName;
  }

  return "Admin";
}

export default function BatchRegisterPage() {
  const { token } =
    useAdminAuth();

  const [products, setProducts] =
    useState<AdminProduct[]>([]);

  const [batches, setBatches] =
    useState<AdminBatchRecord[]>([]);

  const [selectedDate, setSelectedDate] =
    useState(getDateIdInIndia(0));

  const [productFilter, setProductFilter] =
    useState("all");

  const [formProductId, setFormProductId] =
    useState("");

  const [
    quantityPacked,
    setQuantityPacked,
  ] = useState("25");

  const [
    packedOnAt,
    setPackedOnAt,
  ] = useState(getDateTimeLocalNow());

  const [
    shelfLifeDays,
    setShelfLifeDays,
  ] = useState("3");

  const [notes, setNotes] =
    useState("");

  const [
    nextBatchNumber,
    setNextBatchNumber,
  ] = useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [
    previewLoading,
    setPreviewLoading,
  ] = useState(false);

  const [error, setError] =
    useState<string | null>(
      null
    );

  const [success, setSuccess] =
    useState<string | null>(
      null
    );

  const loadData =
    useCallback(async () => {
      if (!token) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const [
          productResult,
          batchResult,
        ] = await Promise.all([
          fetchAdminProducts(token),

          fetchAdminBatches(token, {
            date: selectedDate,
            productId: productFilter,
            limit: 150,
          }),
        ]);

        setProducts(productResult);
        setBatches(batchResult);

        if (
          !formProductId &&
          productResult[0]
        ) {
          setFormProductId(
            productResult[0].productId
          );
        }
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load batch register."
        );
      } finally {
        setLoading(false);
      }
    }, [
      token,
      selectedDate,
      productFilter,
      formProductId,
    ]);

  const loadNextBatchNumber =
    useCallback(async () => {
      if (
        !token ||
        !formProductId ||
        !selectedDate
      ) {
        setNextBatchNumber("");
        return;
      }

      setPreviewLoading(true);

      try {
        const batchNumber =
          await fetchNextBatchNumber(
            token,
            {
              productId:
                formProductId,

              productionDateId:
                selectedDate,
            }
          );

        setNextBatchNumber(
          batchNumber
        );
      } catch {
        setNextBatchNumber("");
      } finally {
        setPreviewLoading(false);
      }
    }, [
      token,
      formProductId,
      selectedDate,
    ]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    void loadNextBatchNumber();
  }, [loadNextBatchNumber]);

  const summary =
    useMemo(() => {
      return {
        batchCount:
          batches.length,

        totalQuantity:
          batches.reduce(
            (total, batch) =>
              total +
              Number(
                batch.quantityPacked || 0
              ),
            0
          ),

        productCount:
          new Set(
            batches.map(
              (batch) =>
                batch.productId
            )
          ).size,
      };
    }, [batches]);

  const selectedProduct =
    products.find(
      (product) =>
        product.productId ===
        formProductId
    );

  const handleSubmit =
    async (
      event: FormEvent
    ) => {
      event.preventDefault();

      if (!token || saving) {
        return;
      }

      if (!formProductId) {
        setError(
          "Please select a product."
        );
        return;
      }

      const quantity =
        Number(quantityPacked);

      if (
        !Number.isInteger(quantity) ||
        quantity < 1
      ) {
        setError(
          "Quantity packed must be at least 1."
        );
        return;
      }

      const shelfLife =
        Number(shelfLifeDays);

      if (
        !Number.isInteger(
          shelfLife
        ) ||
        shelfLife < 1 ||
        shelfLife > 30
      ) {
        setError(
          "Shelf life must be between 1 and 30 days."
        );
        return;
      }

      setSaving(true);
      setError(null);
      setSuccess(null);

      try {
        const batch =
          await createAdminBatch(
            token,
            {
              productId:
                formProductId,

              productionDateId:
                selectedDate,

              packedOnAt:
                toIsoFromDateTimeLocal(
                  packedOnAt
                ),

              shelfLifeDays:
                shelfLife,

              quantityPacked:
                quantity,

              notes:
                notes.trim(),
            }
          );

        setSuccess(
          `${batch.batchNumber} created successfully.`
        );

        setNotes("");
        setQuantityPacked("25");
        setPackedOnAt(
          getDateTimeLocalNow()
        );

        await loadData();
        await loadNextBatchNumber();
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to create batch record."
        );
      } finally {
        setSaving(false);
      }
    };

  return (
    <div className="batch-register-page">
      <div className="page-heading-row batch-heading">
        <div>
          <h2>
            Batch register
          </h2>

          <p>
            Generate daily batch numbers, packed-on time and use-by records for printed bottle labels.
          </p>
        </div>

        <div className="batch-heading-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              setSelectedDate(
                getDateIdInIndia(0)
              )
            }
          >
            Today
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              setSelectedDate(
                getDateIdInIndia(1)
              )
            }
          >
            Tomorrow
          </button>

          <button
            type="button"
            className="primary-button"
            disabled={
              batches.length === 0
            }
            onClick={() =>
              window.print()
            }
          >
            Print batch sheet
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

      <section className="panel batch-date-panel">
        <div>
          <span className="batch-eyebrow">
            PRODUCTION DATE
          </span>

          <strong>
            {formatDateLabel(
              selectedDate
            )}
          </strong>
        </div>

        <label>
          Select date
          <input
            type="date"
            value={selectedDate}
            onChange={(event) =>
              setSelectedDate(
                event.target.value
              )
            }
          />
        </label>

        <label>
          Filter product
          <select
            value={productFilter}
            onChange={(event) =>
              setProductFilter(
                event.target.value
              )
            }
          >
            <option value="all">
              All products
            </option>

            {products.map(
              (product) => (
                <option
                  key={
                    product.productId
                  }
                  value={
                    product.productId
                  }
                >
                  {product.name}
                </option>
              )
            )}
          </select>
        </label>

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
      </section>

      <div className="batch-summary-grid">
        <article className="batch-summary-card">
          <span>
            Batch records
          </span>

          <strong>
            {summary.batchCount}
          </strong>
        </article>

        <article className="batch-summary-card">
          <span>
            Bottles packed
          </span>

          <strong>
            {summary.totalQuantity}
          </strong>
        </article>

        <article className="batch-summary-card">
          <span>
            Product types
          </span>

          <strong>
            {summary.productCount}
          </strong>
        </article>

        <article className="batch-summary-card">
          <span>
            Default shelf life
          </span>

          <strong>
            3 days
          </strong>
        </article>
      </div>

      <section className="panel create-batch-panel">
        <div className="batch-section-header">
          <div>
            <h3>
              Create batch record
            </h3>

            <p>
              Use this before printing or writing batch number and packed-on details.
            </p>
          </div>

          <div className="next-batch-card">
            <span>
              Next batch no.
            </span>

            <strong>
              {previewLoading
                ? "Loading..."
                : nextBatchNumber ||
                  "Select product"}
            </strong>
          </div>
        </div>

        <form
          className="batch-form"
          onSubmit={handleSubmit}
        >
          <label>
            Product
            <select
              value={formProductId}
              onChange={(event) =>
                setFormProductId(
                  event.target.value
                )
              }
            >
              <option value="">
                Select product
              </option>

              {products.map(
                (product) => (
                  <option
                    key={
                      product.productId
                    }
                    value={
                      product.productId
                    }
                  >
                    {product.name}
                  </option>
                )
              )}
            </select>
          </label>

          <label>
            Quantity packed
            <input
              type="number"
              min="1"
              step="1"
              value={quantityPacked}
              onChange={(event) =>
                setQuantityPacked(
                  event.target.value
                )
              }
            />
          </label>

          <label>
            Packed on
            <input
              type="datetime-local"
              value={packedOnAt}
              onChange={(event) =>
                setPackedOnAt(
                  event.target.value
                )
              }
            />
          </label>

          <label>
            Use within days
            <input
              type="number"
              min="1"
              max="30"
              step="1"
              value={shelfLifeDays}
              onChange={(event) =>
                setShelfLifeDays(
                  event.target.value
                )
              }
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
              placeholder="Optional: cane juice vendor, packing observations, wastage notes..."
            />
          </label>

          <div className="batch-form-note full-width">
            <strong>
              Label values
            </strong>

            <p>
              Batch No:{" "}
              {nextBatchNumber || "—"} · Packed on:{" "}
              {packedOnAt || "—"} · Product:{" "}
              {selectedProduct?.name || "—"}
            </p>
          </div>

          <div className="batch-form-actions full-width">
            <button
              type="submit"
              className="primary-button"
              disabled={
                saving ||
                !formProductId
              }
            >
              {saving
                ? "Creating..."
                : "Create batch"}
            </button>
          </div>
        </form>
      </section>

      <section className="panel batch-list-panel">
        <div className="batch-section-header">
          <div>
            <h3>
              Batch records
            </h3>

            <p>
              Print or copy these details for daily packing records.
            </p>
          </div>

          <span className="batch-print-date">
            {formatDateLabel(
              selectedDate
            )}
          </span>
        </div>

        {loading &&
        batches.length === 0 ? (
          <div className="page-state compact">
            <div className="spinner" />

            <p>
              Loading batch records
            </p>
          </div>
        ) : batches.length ===
          0 ? (
          <div className="page-state compact">
            <div className="state-icon">
              ▧
            </div>

            <h3>
              No batches created
            </h3>

            <p>
              Create your first batch record for this date.
            </p>
          </div>
        ) : (
          <div className="batch-record-list">
            {batches.map(
              (batch) => (
                <article
                  key={batch._id}
                  className="batch-record-card"
                >
                  <div className="batch-record-header">
                    <div>
                      <strong>
                        {
                          batch.batchNumber
                        }
                      </strong>

                      <span>
                        {
                          batch.productName
                        }{" "}
                        · {
                          batch.sizeMl
                        } ml
                      </span>
                    </div>

                    <div className="batch-status-pill">
                      {
                        batch.status
                      }
                    </div>
                  </div>

                  <div className="batch-record-grid">
                    <div>
                      <span>
                        Quantity packed
                      </span>

                      <strong>
                        {
                          batch.quantityPacked
                        }{" "}
                        bottles
                      </strong>
                    </div>

                    <div>
                      <span>
                        Packed on
                      </span>

                      <strong>
                        {formatDateTime(
                          batch.packedOnAt
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Use by
                      </span>

                      <strong>
                        {formatDateTime(
                          batch.useByAt
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Created by
                      </span>

                      <strong>
                        {getCreatedBy(
                          batch
                        )}
                      </strong>
                    </div>
                  </div>

                  {batch.notes ? (
                    <p className="batch-notes">
                      {batch.notes}
                    </p>
                  ) : null}
                </article>
              )
            )}
          </div>
        )}
      </section>
    </div>
  );
}