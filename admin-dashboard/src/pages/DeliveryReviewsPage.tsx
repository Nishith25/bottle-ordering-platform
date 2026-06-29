import {
  type FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  useAdminAuth,
} from "../context/AuthContext";

import {
  fetchDeliveryReviews,
  type DeliveryReview,
  type DeliveryReviewSummary,
  type ReviewPerson,
} from "../services/adminReviewsApi";

import "./deliveryReviews.css";

const EMPTY_SUMMARY:
  DeliveryReviewSummary = {
    totalReviews: 0,
    averageOrderRating: 0,
    averageDeliveryRating: 0,
    fiveStarDeliveries: 0,
  };

function formatDate(
  value: string
) {
  return new Date(
    value
  ).toLocaleString(
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

function getPerson(
  value:
    | string
    | ReviewPerson
): ReviewPerson | null {
  if (
    value &&
    typeof value === "object"
  ) {
    return value;
  }

  return null;
}

export default function DeliveryReviewsPage() {
  const {
    token,
  } = useAdminAuth();

  const [
    reviews,
    setReviews,
  ] = useState<
    DeliveryReview[]
  >([]);

  const [
    summary,
    setSummary,
  ] =
    useState<DeliveryReviewSummary>(
      EMPTY_SUMMARY
    );

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    submittedSearch,
    setSubmittedSearch,
  ] = useState("");

  const [
    ratingFilter,
    setRatingFilter,
  ] = useState("all");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  const loadReviews =
    useCallback(async () => {
      if (!token) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result =
          await fetchDeliveryReviews(
            token,
            {
              search:
                submittedSearch,

              rating:
                ratingFilter,
            }
          );

        setReviews(
          result.reviews
        );

        setSummary(
          result.summary
        );
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load reviews."
        );
      } finally {
        setLoading(false);
      }
    }, [
      token,
      submittedSearch,
      ratingFilter,
    ]);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  const handleSearch = (
    event: FormEvent
  ) => {
    event.preventDefault();

    setSubmittedSearch(
      search.trim()
    );
  };

  return (
    <div className="delivery-reviews-page">
      <div className="page-heading-row">
        <div>
          <h2>
            Delivery reviews
          </h2>

          <p>
            Review customer feedback,
            bottle ratings and delivery
            partner performance.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          disabled={loading}
          onClick={() => {
            void loadReviews();
          }}
        >
          {loading
            ? "Refreshing..."
            : "Refresh reviews"}
        </button>
      </div>

      {error ? (
        <div className="inline-error">
          {error}
        </div>
      ) : null}

      <div className="review-metric-grid">
        <ReviewMetric
          label="Total reviews"
          value={`${summary.totalReviews}`}
        />

        <ReviewMetric
          label="Average order rating"
          value={`${summary.averageOrderRating.toFixed(
            1
          )} / 5`}
        />

        <ReviewMetric
          label="Average delivery rating"
          value={`${summary.averageDeliveryRating.toFixed(
            1
          )} / 5`}
        />

        <ReviewMetric
          label="Five-star deliveries"
          value={`${summary.fiveStarDeliveries}`}
        />
      </div>

      <section className="panel review-toolbar">
        <form
          className="review-search-form"
          onSubmit={handleSearch}
        >
          <input
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Search order, customer, partner or comment"
          />

          <select
            value={ratingFilter}
            onChange={(event) =>
              setRatingFilter(
                event.target.value
              )
            }
          >
            <option value="all">
              All delivery ratings
            </option>

            <option value="5">
              5 stars
            </option>

            <option value="4">
              4 stars
            </option>

            <option value="3">
              3 stars
            </option>

            <option value="2">
              2 stars
            </option>

            <option value="1">
              1 star
            </option>
          </select>

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

      <section className="panel reviews-panel">
        {loading &&
        reviews.length === 0 ? (
          <div className="page-state compact">
            <div className="spinner" />

            <p>
              Loading customer reviews
            </p>
          </div>
        ) : reviews.length ===
          0 ? (
          <div className="page-state compact">
            <div className="state-icon">
              ★
            </div>

            <h3>
              No reviews found
            </h3>

            <p>
              Delivered order reviews
              will appear here.
            </p>
          </div>
        ) : (
          <div className="delivery-review-list">
            {reviews.map(
              (review) => {
                const customer =
                  getPerson(
                    review.user
                  );

                const partner =
                  getPerson(
                    review.deliveryPartner
                  );

                return (
                  <article
                    key={review._id}
                    className="delivery-review-card"
                  >
                    <div className="review-card-header">
                      <div>
                        <div className="review-order-row">
                          <strong>
                            {
                              review.orderNumber
                            }
                          </strong>

                          <span>
                            Review submitted
                          </span>
                        </div>

                        <small>
                          {formatDate(
                            review.submittedAt ||
                              review.createdAt
                          )}
                        </small>
                      </div>

                      <StarDisplay
                        value={
                          review.deliveryRating
                        }
                      />
                    </div>

                    <div className="review-people-grid">
                      <div>
                        <span>
                          CUSTOMER
                        </span>

                        <strong>
                          {customer?.fullName ??
                            review
                              .customerSnapshot
                              .fullName}
                        </strong>

                        <small>
                          {customer?.email ??
                            review
                              .customerSnapshot
                              .email}
                        </small>

                        <small>
                          +91{" "}
                          {customer?.phone ??
                            review
                              .customerSnapshot
                              .phone}
                        </small>
                      </div>

                      <div>
                        <span>
                          DELIVERY PARTNER
                        </span>

                        <strong>
                          {partner?.fullName ??
                            review
                              .deliveryPartnerSnapshot
                              .fullName}
                        </strong>

                        <small>
                          {partner?.email ??
                            review
                              .deliveryPartnerSnapshot
                              .email}
                        </small>

                        <small>
                          +91{" "}
                          {partner?.phone ??
                            review
                              .deliveryPartnerSnapshot
                              .phone}
                        </small>
                      </div>
                    </div>

                    <div className="review-rating-grid">
                      <div>
                        <span>
                          Bottle order
                        </span>

                        <StarDisplay
                          value={
                            review.orderRating
                          }
                        />
                      </div>

                      <div>
                        <span>
                          Delivery service
                        </span>

                        <StarDisplay
                          value={
                            review.deliveryRating
                          }
                        />
                      </div>
                    </div>

                    {review.comment ? (
                      <div className="review-comment">
                        “{review.comment}”
                      </div>
                    ) : (
                      <div className="review-no-comment">
                        No written comment
                      </div>
                    )}
                  </article>
                );
              }
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function ReviewMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="review-metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StarDisplay({
  value,
}: {
  value: number;
}) {
  return (
    <div
      className="admin-star-display"
      aria-label={`${value} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map(
        (star) => (
          <span
            key={star}
            className={
              star <= value
                ? "admin-star-filled"
                : "admin-star-empty"
            }
          >
            ★
          </span>
        )
      )}
    </div>
  );
}