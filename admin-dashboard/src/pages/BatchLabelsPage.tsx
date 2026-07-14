import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useSearchParams,
} from "react-router-dom";

import { useAdminAuth } from "../context/AuthContext";

import {
  fetchAdminProducts,
  type AdminProduct,
} from "../services/api";

import {
  fetchAdminBatches,
  type AdminBatchRecord,
} from "../services/adminBatchesApi";

import "./batchLabels.css";

function getDateIdInIndia() {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(new Date());
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

function clampLabelCount(value: string) {
  const numberValue =
    Number(value);

  if (
    !Number.isInteger(numberValue) ||
    numberValue < 1
  ) {
    return 1;
  }

  return Math.min(
    numberValue,
    300
  );
}

export default function BatchLabelsPage() {
  const { token } =
    useAdminAuth();

  const [searchParams] =
    useSearchParams();

  const initialDate =
    searchParams.get("date") ||
    getDateIdInIndia();

  const initialProduct =
    searchParams.get("productId") ||
    "all";

  const initialBatchId =
    searchParams.get("batchId") ||
    "";

  const [products, setProducts] =
    useState<AdminProduct[]>([]);

  const [batches, setBatches] =
    useState<AdminBatchRecord[]>([]);

  const [selectedDate, setSelectedDate] =
    useState(initialDate);

  const [productFilter, setProductFilter] =
    useState(initialProduct);

  const [
    selectedBatchId,
    setSelectedBatchId,
  ] = useState(initialBatchId);

  const [labelCount, setLabelCount] =
    useState("1");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
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
            limit: 250,
          }),
        ]);

        setProducts(productResult);
        setBatches(batchResult);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load batch labels."
        );
      } finally {
        setLoading(false);
      }
    }, [
      token,
      selectedDate,
      productFilter,
    ]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (batches.length === 0) {
      setSelectedBatchId("");
      return;
    }

    const selectedExists =
      selectedBatchId &&
      batches.some(
        (batch) =>
          batch._id ===
          selectedBatchId
      );

    if (!selectedExists) {
      const fallbackBatch =
        initialBatchId &&
        batches.find(
          (batch) =>
            batch._id ===
            initialBatchId
        );

      setSelectedBatchId(
        fallbackBatch?._id ||
          batches[0]._id
      );
    }
  }, [
    batches,
    selectedBatchId,
    initialBatchId,
  ]);

  const selectedBatch =
    useMemo(() => {
      return (
        batches.find(
          (batch) =>
            batch._id ===
            selectedBatchId
        ) || null
      );
    }, [
      batches,
      selectedBatchId,
    ]);

  useEffect(() => {
    if (selectedBatch) {
      setLabelCount(
        String(
          selectedBatch.quantityPacked ||
            1
        )
      );
    }
  }, [selectedBatch?._id]);

  const labels =
    useMemo(() => {
      if (!selectedBatch) {
        return [];
      }

      const count =
        clampLabelCount(
          labelCount
        );

      return Array.from(
        {
          length: count,
        },
        (_, index) => ({
          id: `${selectedBatch._id}-${index}`,
          serial: index + 1,
        })
      );
    }, [
      selectedBatch,
      labelCount,
    ]);

  const selectedDateLabel =
    formatDateLabel(
      selectedDate
    );

  return (
    <div className="batch-labels-page">
      <div className="page-heading-row batch-labels-heading">
        <div>
          <h2>
            Batch label print
          </h2>

          <p>
            Print small batch stickers with product, batch number, packed-on and use-by details.
          </p>
        </div>

        <div className="batch-labels-actions">
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

          <button
            type="button"
            className="primary-button"
            disabled={
              !selectedBatch ||
              labels.length === 0
            }
            onClick={() =>
              window.print()
            }
          >
            Print labels
          </button>
        </div>
      </div>

      {error ? (
        <div className="inline-error">
          {error}
        </div>
      ) : null}

      <section className="panel batch-label-controls">
        <div>
          <span className="label-control-eyebrow">
            LABEL DATE
          </span>

          <strong>
            {selectedDateLabel}
          </strong>
        </div>

        <label>
          Date
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
          Product
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

        <label>
          Batch
          <select
            value={selectedBatchId}
            onChange={(event) =>
              setSelectedBatchId(
                event.target.value
              )
            }
          >
            {batches.length === 0 ? (
              <option value="">
                No batches found
              </option>
            ) : null}

            {batches.map(
              (batch) => (
                <option
                  key={batch._id}
                  value={batch._id}
                >
                  {batch.batchNumber} · {batch.productName}
                </option>
              )
            )}
          </select>
        </label>

        <label>
          Labels to print
          <input
            type="number"
            min="1"
            max="300"
            step="1"
            value={labelCount}
            onChange={(event) =>
              setLabelCount(
                event.target.value
              )
            }
          />
        </label>
      </section>

      {!selectedBatch ? (
        <section className="panel">
          <div className="page-state compact">
            <div className="state-icon">
              ▨
            </div>

            <h3>
              No batch selected
            </h3>

            <p>
              Create a batch record first or change the date/product filter.
            </p>
          </div>
        </section>
      ) : (
        <>
          <section className="panel selected-batch-panel">
            <div>
              <span>
                Selected batch
              </span>

              <strong>
                {
                  selectedBatch.batchNumber
                }
              </strong>
            </div>

            <div>
              <span>
                Product
              </span>

              <strong>
                {
                  selectedBatch.productName
                }
              </strong>
            </div>

            <div>
              <span>
                Quantity packed
              </span>

              <strong>
                {
                  selectedBatch.quantityPacked
                }{" "}
                bottles
              </strong>
            </div>

            <div>
              <span>
                Labels
              </span>

              <strong>
                {
                  labels.length
                }
              </strong>
            </div>
          </section>

          <section className="panel label-sheet-panel">
            <div className="label-sheet-header">
              <div>
                <h3>
                  A4 sticker label sheet
                </h3>

                <p>
                  Print this page on sticker paper or use it as a cutting sheet.
                </p>
              </div>

              <span>
                {labels.length} labels
              </span>
            </div>

            <div className="label-sheet">
              {labels.map(
                (label) => (
                  <div
                    key={label.id}
                    className="batch-sticker-label"
                  >
                    <div className="sticker-top-row">
                      <strong>
                        {
                          selectedBatch.productName
                        }
                      </strong>

                      <span>
                        {
                          selectedBatch.sizeMl
                        }
                        ml
                      </span>
                    </div>

                    <div className="sticker-batch-number">
                      {
                        selectedBatch.batchNumber
                      }
                    </div>

                    <div className="sticker-detail-grid">
                      <span>
                        Packed on
                      </span>

                      <strong>
                        {formatDateTime(
                          selectedBatch.packedOnAt
                        )}
                      </strong>

                      <span>
                        Use by
                      </span>

                      <strong>
                        {formatDateTime(
                          selectedBatch.useByAt
                        )}
                      </strong>
                    </div>

                    <div className="sticker-footer">
                      <span>
                        Keep refrigerated 0–4°C
                      </span>

                      <small>
                        #{label.serial}
                      </small>
                    </div>
                  </div>
                )
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}