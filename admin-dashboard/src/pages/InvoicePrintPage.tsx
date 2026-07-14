import {
  type FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  useSearchParams,
} from "react-router-dom";

import {
  useAdminAuth,
} from "../context/AuthContext";

import {
  createAdminInvoicePrintLink,
  fetchAdminInvoice,
  type AdminInvoice,
} from "../services/adminInvoicesApi";

import "./invoicePrint.css";

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

export default function InvoicePrintPage() {
  const { token } =
    useAdminAuth();

  const [searchParams] =
    useSearchParams();

  const initialOrderRef =
    searchParams.get("order") ||
    "";

  const [orderRef, setOrderRef] =
    useState(initialOrderRef);

  const [invoice, setInvoice] =
    useState<AdminInvoice | null>(
      null
    );

  const [loading, setLoading] =
    useState(false);

  const [printing, setPrinting] =
    useState(false);

  const [error, setError] =
    useState<string | null>(
      null
    );

  const loadInvoice =
    useCallback(
      async (targetRef = orderRef) => {
        if (
          !token ||
          !targetRef.trim()
        ) {
          return;
        }

        setLoading(true);
        setError(null);

        try {
          const data =
            await fetchAdminInvoice(
              token,
              targetRef.trim()
            );

          setInvoice(data);
        } catch (requestError) {
          setInvoice(null);

          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load invoice."
          );
        } finally {
          setLoading(false);
        }
      },
      [
        token,
        orderRef,
      ]
    );

  useEffect(() => {
    if (initialOrderRef) {
      void loadInvoice(initialOrderRef);
    }
  }, [
    initialOrderRef,
    loadInvoice,
  ]);

  const handleSubmit =
    (event: FormEvent) => {
      event.preventDefault();

      void loadInvoice();
    };

  const handlePrint =
    async () => {
      if (
        !token ||
        !invoice
      ) {
        return;
      }

      setPrinting(true);
      setError(null);

      try {
        const printUrl =
          await createAdminInvoicePrintLink(
            token,
            invoice.orderNumber ||
              invoice.orderId
          );

        window.open(
          printUrl,
          "_blank",
          "noopener,noreferrer"
        );
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to create invoice print link."
        );
      } finally {
        setPrinting(false);
      }
    };

  return (
    <div className="invoice-print-page">
      <div className="page-heading-row invoice-heading">
        <div>
          <h2>
            Invoices
          </h2>

          <p>
            Search an order number or order ID, preview the bill and print or save it as PDF.
          </p>
        </div>

        <button
          type="button"
          className="primary-button"
          disabled={
            !invoice || printing
          }
          onClick={
            handlePrint
          }
        >
          {printing
            ? "Opening..."
            : "Print / Save PDF"}
        </button>
      </div>

      {error ? (
        <div className="inline-error">
          {error}
        </div>
      ) : null}

      <section className="panel invoice-search-panel">
        <form
          onSubmit={handleSubmit}
        >
          <label>
            Order number / Order ID
            <input
              type="text"
              value={orderRef}
              onChange={(event) =>
                setOrderRef(
                  event.target.value
                )
              }
              placeholder="Example: BO-20260714-781EC3"
            />
          </label>

          <button
            type="submit"
            className="secondary-button"
            disabled={
              loading ||
              !orderRef.trim()
            }
          >
            {loading
              ? "Loading..."
              : "Load invoice"}
          </button>
        </form>
      </section>

      {!invoice ? (
        <section className="panel">
          <div className="page-state compact">
            <div className="state-icon">
              ▤
            </div>

            <h3>
              No invoice loaded
            </h3>

            <p>
              Enter an order number to generate the invoice preview.
            </p>
          </div>
        </section>
      ) : (
        <section className="panel invoice-preview-panel">
          <div className="invoice-preview-header">
            <div>
              <span>
                Invoice
              </span>

              <strong>
                {
                  invoice.invoiceNumber
                }
              </strong>
            </div>

            <div>
              <span>
                Total
              </span>

              <strong>
                {formatCurrency(
                  invoice.totals.total
                )}
              </strong>
            </div>
          </div>

          <div className="invoice-info-grid">
            <div>
              <span>
                Brand
              </span>

              <strong>
                {
                  invoice.brand.name
                }
              </strong>

              {invoice.brand.legalName ? (
                <p>
                  {
                    invoice.brand.legalName
                  }
                </p>
              ) : null}

              {invoice.brand.fssai ? (
                <p>
                  FSSAI:{" "}
                  {
                    invoice.brand.fssai
                  }
                </p>
              ) : null}
            </div>

            <div>
              <span>
                Customer
              </span>

              <strong>
                {
                  invoice.customer.name
                }
              </strong>

              <p>
                {
                  invoice.customer.phone ||
                  "No phone"
                }
              </p>

              <p>
                {
                  invoice.customer.address ||
                  "No address"
                }
              </p>
            </div>

            <div>
              <span>
                Order
              </span>

              <strong>
                {
                  invoice.orderNumber
                }
              </strong>

              <p>
                {
                  formatDateTime(
                    invoice.orderDate
                  )
                }
              </p>

              <p>
                {
                  invoice.status.order
                }
              </p>
            </div>

            <div>
              <span>
                Delivery / Payment
              </span>

              <strong>
                {
                  invoice.delivery.slotLabel
                }
              </strong>

              <p>
                {
                  invoice.payment.method
                }{" "}
                · {
                  invoice.payment.status
                }
              </p>
            </div>
          </div>

          <div className="invoice-table-wrapper">
            <table className="invoice-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Rate</th>
                  <th>Amount</th>
                </tr>
              </thead>

              <tbody>
                {invoice.items.map(
                  (item, index) => (
                    <tr
                      key={`${item.productId}-${index}`}
                    >
                      <td>
                        <strong>
                          {
                            item.name
                          }
                        </strong>

                        <span>
                          {
                            item.sizeMl
                          }{" "}
                          ml
                        </span>
                      </td>

                      <td>
                        {
                          item.quantity
                        }
                      </td>

                      <td>
                        {formatCurrency(
                          item.price
                        )}
                      </td>

                      <td>
                        {formatCurrency(
                          item.lineTotal
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>

          <div className="invoice-total-box">
            <div>
              <span>
                Subtotal
              </span>

              <strong>
                {formatCurrency(
                  invoice.totals.subtotal
                )}
              </strong>
            </div>

            <div>
              <span>
                Delivery fee
              </span>

              <strong>
                {formatCurrency(
                  invoice.totals.deliveryFee
                )}
              </strong>
            </div>

            <div>
              <span>
                Discount
              </span>

              <strong>
                -
                {formatCurrency(
                  invoice.totals.couponDiscount
                )}
              </strong>
            </div>

            <div className="invoice-grand-total">
              <span>
                Total
              </span>

              <strong>
                {formatCurrency(
                  invoice.totals.total
                )}
              </strong>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}