import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAdminAuth } from "../context/AuthContext";

import {
  createAdminCoupon,
  deactivateAdminCoupon,
  fetchAdminCoupons,
  updateAdminCoupon,
  type AdminCoupon,
  type CouponAppliesTo,
  type CouponDiscountType,
  type CouponPayload,
} from "../services/adminCouponsApi";

import "./coupons.css";

type CouponFormState = {
  code: string;
  description: string;
  discountType: CouponDiscountType;
  discountValue: string;
  maxDiscountAmount: string;
  minimumOrder: string;
  appliesTo: CouponAppliesTo;
  usageLimit: string;
  perUserLimit: string;
  startsAt: string;
  endsAt: string;
  active: boolean;
  sortOrder: string;
};

const EMPTY_FORM: CouponFormState = {
  code: "",
  description: "",
  discountType: "percentage",
  discountValue: "10",
  maxDiscountAmount: "100",
  minimumOrder: "299",
  appliesTo: "order",
  usageLimit: "0",
  perUserLimit: "1",
  startsAt: toLocalDateTimeInput(new Date()),
  endsAt: "",
  active: true,
  sortOrder: "0",
};

function toLocalDateTimeInput(value: Date | string) {
  const date = new Date(value);
  const timezoneOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - timezoneOffset)
    .toISOString()
    .slice(0, 16);
}

function formatDate(value: string | null) {
  if (!value) {
    return "No expiry";
  }

  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDiscount(coupon: AdminCoupon) {
  if (coupon.discountType === "fixed") {
    return `₹${coupon.discountValue} off`;
  }

  return `${coupon.discountValue}% off${
    coupon.maxDiscountAmount > 0
      ? ` up to ₹${coupon.maxDiscountAmount}`
      : ""
  }`;
}

function getStatus(coupon: AdminCoupon) {
  const now = Date.now();
  const startsAt = new Date(coupon.startsAt).getTime();
  const endsAt = coupon.endsAt
    ? new Date(coupon.endsAt).getTime()
    : null;

  if (!coupon.active) return "Inactive";
  if (startsAt > now) return "Scheduled";
  if (endsAt && endsAt < now) return "Expired";
  if (
    coupon.usageLimit > 0 &&
    coupon.usedCount + coupon.reservedCount >= coupon.usageLimit
  ) {
    return "Limit reached";
  }

  return "Active";
}

function formFromCoupon(coupon: AdminCoupon): CouponFormState {
  return {
    code: coupon.code,
    description: coupon.description,
    discountType: coupon.discountType,
    discountValue: String(coupon.discountValue),
    maxDiscountAmount: String(coupon.maxDiscountAmount),
    minimumOrder: String(coupon.minimumOrder),
    appliesTo: coupon.appliesTo,
    usageLimit: String(coupon.usageLimit),
    perUserLimit: String(coupon.perUserLimit),
    startsAt: toLocalDateTimeInput(coupon.startsAt),
    endsAt: coupon.endsAt
      ? toLocalDateTimeInput(coupon.endsAt)
      : "",
    active: coupon.active,
    sortOrder: String(coupon.sortOrder),
  };
}

function payloadFromForm(form: CouponFormState): CouponPayload {
  return {
    code: form.code.trim().toUpperCase(),
    description: form.description.trim(),
    discountType: form.discountType,
    discountValue: Number(form.discountValue),
    maxDiscountAmount:
      form.discountType === "percentage"
        ? Number(form.maxDiscountAmount || 0)
        : 0,
    minimumOrder: Number(form.minimumOrder || 0),
    appliesTo: form.appliesTo,
    usageLimit: Number(form.usageLimit || 0),
    perUserLimit: Number(form.perUserLimit || 0),
    startsAt: new Date(form.startsAt).toISOString(),
    endsAt: form.endsAt
      ? new Date(form.endsAt).toISOString()
      : null,
    active: form.active,
    sortOrder: Number(form.sortOrder || 0),
  };
}

export default function CouponsPage() {
  const { token } = useAdminAuth();

  const [coupons, setCoupons] = useState<AdminCoupon[]>([]);
  const [form, setForm] = useState<CouponFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadCoupons = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      setCoupons(await fetchAdminCoupons(token));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load coupons."
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadCoupons();
  }, [loadCoupons]);

  const metrics = useMemo(() => {
    return coupons.reduce(
      (result, coupon) => {
        const status = getStatus(coupon);
        result.total += 1;
        result.used += coupon.usedCount;
        result.reserved += coupon.reservedCount;
        if (status === "Active") result.active += 1;
        return result;
      },
      { total: 0, active: 0, used: 0, reserved: 0 }
    );
  }, [coupons]);

  const resetForm = () => {
    setForm({
      ...EMPTY_FORM,
      startsAt: toLocalDateTimeInput(new Date()),
    });
    setEditingId(null);
  };

  const setField = <K extends keyof CouponFormState>(
    key: K,
    value: CouponFormState[K]
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!token || saving) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = payloadFromForm(form);

      if (editingId) {
        await updateAdminCoupon(token, editingId, payload);
        setSuccess(`${payload.code} updated successfully.`);
      } else {
        await createAdminCoupon(token, payload);
        setSuccess(`${payload.code} created successfully.`);
      }

      resetForm();
      await loadCoupons();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to save coupon."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (coupon: AdminCoupon) => {
    if (!token) return;

    const confirmed = window.confirm(
      `Deactivate coupon ${coupon.code}?`
    );

    if (!confirmed) return;

    setError(null);
    setSuccess(null);

    try {
      await deactivateAdminCoupon(token, coupon._id);
      setSuccess(`${coupon.code} deactivated.`);
      await loadCoupons();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to deactivate coupon."
      );
    }
  };

  return (
    <div className="coupons-page">
      <div className="page-heading-row">
        <div>
          <h2>Coupons and promo codes</h2>
          <p>
            Create discounts for bottle orders and first subscription cycles.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          disabled={loading}
          onClick={() => void loadCoupons()}
        >
          {loading ? "Refreshing..." : "Refresh coupons"}
        </button>
      </div>

      {error ? <div className="inline-error">{error}</div> : null}
      {success ? <div className="inline-success">{success}</div> : null}

      <div className="coupon-metric-grid">
        <Metric label="Total coupons" value={metrics.total} />
        <Metric label="Currently active" value={metrics.active} />
        <Metric label="Redeemed" value={metrics.used} />
        <Metric label="Payment reservations" value={metrics.reserved} />
      </div>

      <div className="coupon-layout">
        <section className="panel coupon-form-panel">
          <div className="coupon-panel-heading">
            <div>
              <h3>{editingId ? "Edit coupon" : "Create coupon"}</h3>
              <p>All prices are revalidated by the backend.</p>
            </div>

            {editingId ? (
              <button
                type="button"
                className="secondary-button"
                onClick={resetForm}
              >
                Cancel edit
              </button>
            ) : null}
          </div>

          <form className="coupon-form" onSubmit={handleSubmit}>
            <label>
              Coupon code
              <input
                required
                value={form.code}
                maxLength={30}
                placeholder="WELCOME10"
                onChange={(event) =>
                  setField(
                    "code",
                    event.target.value
                      .toUpperCase()
                      .replace(/\s+/g, "")
                  )
                }
              />
            </label>

            <label className="coupon-span-two">
              Description
              <input
                value={form.description}
                maxLength={180}
                placeholder="10% off your first bottle order"
                onChange={(event) =>
                  setField("description", event.target.value)
                }
              />
            </label>

            <label>
              Discount type
              <select
                value={form.discountType}
                onChange={(event) =>
                  setField(
                    "discountType",
                    event.target.value as CouponDiscountType
                  )
                }
              >
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed amount</option>
              </select>
            </label>

            <label>
              Discount value
              <input
                required
                type="number"
                min="1"
                max={form.discountType === "percentage" ? 100 : undefined}
                value={form.discountValue}
                onChange={(event) =>
                  setField("discountValue", event.target.value)
                }
              />
            </label>

            <label>
              Maximum discount
              <input
                type="number"
                min="0"
                disabled={form.discountType === "fixed"}
                value={
                  form.discountType === "fixed"
                    ? "0"
                    : form.maxDiscountAmount
                }
                onChange={(event) =>
                  setField("maxDiscountAmount", event.target.value)
                }
              />
              <small>Use 0 for no percentage cap.</small>
            </label>

            <label>
              Minimum eligible amount
              <input
                type="number"
                min="0"
                value={form.minimumOrder}
                onChange={(event) =>
                  setField("minimumOrder", event.target.value)
                }
              />
            </label>

            <label>
              Applies to
              <select
                value={form.appliesTo}
                onChange={(event) =>
                  setField(
                    "appliesTo",
                    event.target.value as CouponAppliesTo
                  )
                }
              >
                <option value="order">Bottle orders</option>
                <option value="subscription">Subscriptions</option>
                <option value="both">Orders and subscriptions</option>
              </select>
            </label>

            <label>
              Total usage limit
              <input
                type="number"
                min="0"
                step="1"
                value={form.usageLimit}
                onChange={(event) =>
                  setField("usageLimit", event.target.value)
                }
              />
              <small>Use 0 for unlimited.</small>
            </label>

            <label>
              Per-customer limit
              <input
                type="number"
                min="0"
                step="1"
                value={form.perUserLimit}
                onChange={(event) =>
                  setField("perUserLimit", event.target.value)
                }
              />
              <small>Use 0 for unlimited.</small>
            </label>

            <label>
              Starts at
              <input
                required
                type="datetime-local"
                value={form.startsAt}
                onChange={(event) =>
                  setField("startsAt", event.target.value)
                }
              />
            </label>

            <label>
              Expires at
              <input
                type="datetime-local"
                value={form.endsAt}
                onChange={(event) =>
                  setField("endsAt", event.target.value)
                }
              />
            </label>

            <label>
              Sort order
              <input
                type="number"
                min="0"
                step="1"
                value={form.sortOrder}
                onChange={(event) =>
                  setField("sortOrder", event.target.value)
                }
              />
            </label>

            <label className="coupon-toggle-label">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) =>
                  setField("active", event.target.checked)
                }
              />
              Coupon is active
            </label>

            <button
              type="submit"
              className="primary-button coupon-submit"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : editingId
                  ? "Update coupon"
                  : "Create coupon"}
            </button>
          </form>
        </section>

        <section className="panel coupon-list-panel">
          <div className="coupon-panel-heading">
            <div>
              <h3>Available coupons</h3>
              <p>Reservations are held while Razorpay Checkout is active.</p>
            </div>
          </div>

          {loading && coupons.length === 0 ? (
            <div className="page-state compact">
              <div className="spinner" />
              <p>Loading coupons</p>
            </div>
          ) : coupons.length === 0 ? (
            <div className="page-state compact">
              <h3>No coupons created</h3>
              <p>Create your first promotional code.</p>
            </div>
          ) : (
            <div className="coupon-card-list">
              {coupons.map((coupon) => {
                const status = getStatus(coupon);
                const usageText =
                  coupon.usageLimit > 0
                    ? `${coupon.usedCount + coupon.reservedCount}/${coupon.usageLimit}`
                    : `${coupon.usedCount} used`;

                return (
                  <article key={coupon._id} className="coupon-card">
                    <div className="coupon-card-top">
                      <div>
                        <div className="coupon-code-row">
                          <strong>{coupon.code}</strong>
                          <span
                            className={`coupon-status coupon-status-${status
                              .toLowerCase()
                              .replace(/\s+/g, "-")}`}
                          >
                            {status}
                          </span>
                        </div>

                        <p>{coupon.description || "No description"}</p>
                      </div>

                      <strong className="coupon-discount">
                        {formatDiscount(coupon)}
                      </strong>
                    </div>

                    <div className="coupon-detail-grid">
                      <div>
                        <span>Applies to</span>
                        <strong>{coupon.appliesTo}</strong>
                      </div>
                      <div>
                        <span>Minimum</span>
                        <strong>₹{coupon.minimumOrder}</strong>
                      </div>
                      <div>
                        <span>Usage</span>
                        <strong>{usageText}</strong>
                      </div>
                      <div>
                        <span>Per customer</span>
                        <strong>
                          {coupon.perUserLimit > 0
                            ? coupon.perUserLimit
                            : "Unlimited"}
                        </strong>
                      </div>
                    </div>

                    <div className="coupon-date-row">
                      <span>Starts {formatDate(coupon.startsAt)}</span>
                      <span>Ends {formatDate(coupon.endsAt)}</span>
                    </div>

                    <div className="coupon-card-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => {
                          setEditingId(coupon._id);
                          setForm(formFromCoupon(coupon));
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      >
                        Edit
                      </button>

                      {coupon.active ? (
                        <button
                          type="button"
                          className="danger-button"
                          onClick={() => void handleDeactivate(coupon)}
                        >
                          Deactivate
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="coupon-metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
