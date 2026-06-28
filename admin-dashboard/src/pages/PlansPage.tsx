// admin-dashboard/src/pages/PlansPage.tsx

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAdminAuth } from "../context/AuthContext";

import {
  archiveAdminPlan,
  createAdminPlan,
  fetchAdminPlans,
  updateAdminPlan,
  type AdminSubscriptionPlan,
  type PlanBillingCycle,
  type SubscriptionPlanPayload,
} from "../services/adminPlansApi";

import "./plans.css";

type PlanFormState = {
  planId: string;
  name: string;
  description: string;
  billingCycle: PlanBillingCycle;
  bottleCount: string;
  deliveriesPerCycle: string;
  discountPercent: string;
  badge: string;
  features: string;
  active: boolean;
  sortOrder: string;
};

const EMPTY_FORM: PlanFormState = {
  planId: "",
  name: "",
  description: "",
  billingCycle: "weekly",
  bottleCount: "4",
  deliveriesPerCycle: "1",
  discountPercent: "5",
  badge: "",
  features: "",
  active: true,
  sortOrder: "0",
};

function createPlanId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function PlansPage() {
  const { token } = useAdminAuth();

  const [plans, setPlans] = useState<
    AdminSubscriptionPlan[]
  >([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [
    updatingPlanId,
    setUpdatingPlanId,
  ] = useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const [success, setSuccess] =
    useState<string | null>(null);

  const [search, setSearch] =
    useState("");

  const [formOpen, setFormOpen] =
    useState(false);

  const [
    editingPlanId,
    setEditingPlanId,
  ] = useState<string | null>(null);

  const [form, setForm] =
    useState<PlanFormState>(
      EMPTY_FORM
    );

  const loadPlans =
    useCallback(async () => {
      if (!token) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data =
          await fetchAdminPlans(token);

        setPlans(data);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load subscription plans."
        );
      } finally {
        setLoading(false);
      }
    }, [token]);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  const filteredPlans = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    if (!query) {
      return plans;
    }

    return plans.filter(
      (plan) =>
        plan.name
          .toLowerCase()
          .includes(query) ||
        plan.planId
          .toLowerCase()
          .includes(query) ||
        plan.billingCycle
          .toLowerCase()
          .includes(query)
    );
  }, [plans, search]);

  const activePlanCount = useMemo(
    () =>
      plans.filter(
        (plan) => plan.active
      ).length,
    [plans]
  );

  const weeklyPlanCount = useMemo(
    () =>
      plans.filter(
        (plan) =>
          plan.billingCycle ===
          "weekly"
      ).length,
    [plans]
  );

  const monthlyPlanCount = useMemo(
    () =>
      plans.filter(
        (plan) =>
          plan.billingCycle ===
          "monthly"
      ).length,
    [plans]
  );

  function updateField<
    K extends keyof PlanFormState,
  >(
    field: K,
    value: PlanFormState[K]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingPlanId(null);
    setFormOpen(false);
  };

  const openCreateForm = () => {
    setError(null);
    setSuccess(null);
    setForm(EMPTY_FORM);
    setEditingPlanId(null);
    setFormOpen(true);
  };

  const openEditForm = (
    plan: AdminSubscriptionPlan
  ) => {
    setError(null);
    setSuccess(null);

    setEditingPlanId(plan.planId);

    setForm({
      planId: plan.planId,
      name: plan.name,
      description: plan.description,
      billingCycle:
        plan.billingCycle,

      bottleCount: String(
        plan.bottleCount
      ),

      deliveriesPerCycle: String(
        plan.deliveriesPerCycle
      ),

      discountPercent: String(
        plan.discountPercent
      ),

      badge: plan.badge,

      features:
        plan.features.join("\n"),

      active: plan.active,

      sortOrder: String(
        plan.sortOrder
      ),
    });

    setFormOpen(true);
  };

  const createPayload =
    (): SubscriptionPlanPayload => ({
      planId: createPlanId(
        form.planId
      ),

      name: form.name.trim(),

      description:
        form.description.trim(),

      billingCycle:
        form.billingCycle,

      bottleCount: Number(
        form.bottleCount
      ),

      deliveriesPerCycle: Number(
        form.deliveriesPerCycle
      ),

      discountPercent: Number(
        form.discountPercent
      ),

      badge: form.badge.trim(),

      features: form.features
        .split(/\n|,/)
        .map((feature) =>
          feature.trim()
        )
        .filter(Boolean),

      active: form.active,

      sortOrder:
        Number(form.sortOrder) || 0,
    });

  const validatePayload = (
    payload: SubscriptionPlanPayload
  ) => {
    if (!payload.planId) {
      return "Plan ID is required.";
    }

    if (
      payload.name.length < 2
    ) {
      return "Plan name is required.";
    }

    if (
      payload.description.length < 5
    ) {
      return "Enter a clear plan description.";
    }

    if (
      !Number.isInteger(
        payload.bottleCount
      ) ||
      payload.bottleCount < 1
    ) {
      return "Bottle count must be at least one.";
    }

    if (
      !Number.isInteger(
        payload.deliveriesPerCycle
      ) ||
      payload.deliveriesPerCycle < 1
    ) {
      return "Deliveries per cycle must be at least one.";
    }

    if (
      payload.deliveriesPerCycle >
      payload.bottleCount
    ) {
      return "Deliveries per cycle cannot exceed the bottle count.";
    }

    if (
      !Number.isFinite(
        payload.discountPercent
      ) ||
      payload.discountPercent < 0 ||
      payload.discountPercent > 100
    ) {
      return "Discount must be between 0 and 100.";
    }

    return null;
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!token || saving) {
      return;
    }

    const payload = createPayload();

    const validationError =
      validatePayload(payload);

    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (editingPlanId) {
        const {
          planId: ignoredPlanId,
          ...updates
        } = payload;

        void ignoredPlanId;

        await updateAdminPlan(
          token,
          editingPlanId,
          updates
        );

        setSuccess(
          "Subscription plan updated successfully."
        );
      } else {
        await createAdminPlan(
          token,
          payload
        );

        setSuccess(
          "Subscription plan created successfully."
        );
      }

      resetForm();
      await loadPlans();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to save subscription plan."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleActiveToggle =
    async (
      plan: AdminSubscriptionPlan
    ) => {
      if (!token) {
        return;
      }

      setUpdatingPlanId(plan.planId);
      setError(null);
      setSuccess(null);

      try {
        await updateAdminPlan(
          token,
          plan.planId,
          {
            active: !plan.active,
          }
        );

        setSuccess(
          plan.active
            ? `${plan.name} has been disabled.`
            : `${plan.name} is now active.`
        );

        await loadPlans();
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to update this plan."
        );
      } finally {
        setUpdatingPlanId(null);
      }
    };

  const handleArchive = async (
    plan: AdminSubscriptionPlan
  ) => {
    if (!token) {
      return;
    }

    const confirmed =
      window.confirm(
        `Archive ${plan.name}? It will no longer appear in the customer app.`
      );

    if (!confirmed) {
      return;
    }

    setUpdatingPlanId(plan.planId);
    setError(null);
    setSuccess(null);

    try {
      await archiveAdminPlan(
        token,
        plan.planId
      );

      setSuccess(
        `${plan.name} has been archived.`
      );

      await loadPlans();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to archive this plan."
      );
    } finally {
      setUpdatingPlanId(null);
    }
  };

  return (
    <div className="plans-page">
      <div className="page-heading-row">
        <div>
          <h2>Subscription plans</h2>

          <p>
            Manage recurring bottle plans,
            savings and delivery frequency.
          </p>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={openCreateForm}
        >
          + Add plan
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

      <div className="plan-metric-grid">
        <PlanMetric
          label="Total plans"
          value={plans.length}
        />

        <PlanMetric
          label="Active plans"
          value={activePlanCount}
        />

        <PlanMetric
          label="Weekly plans"
          value={weeklyPlanCount}
        />

        <PlanMetric
          label="Monthly plans"
          value={monthlyPlanCount}
        />
      </div>

      <section className="panel plans-toolbar">
        <input
          className="search-input"
          value={search}
          onChange={(event) =>
            setSearch(
              event.target.value
            )
          }
          placeholder="Search plan name, ID or billing cycle"
        />

        <button
          type="button"
          className="secondary-button"
          disabled={loading}
          onClick={() => {
            void loadPlans();
          }}
        >
          {loading
            ? "Refreshing..."
            : "Refresh"}
        </button>
      </section>

      {loading &&
      plans.length === 0 ? (
        <section className="panel">
          <div className="page-state compact">
            <div className="spinner" />

            <p>
              Loading subscription plans
            </p>
          </div>
        </section>
      ) : filteredPlans.length ===
        0 ? (
        <section className="panel">
          <div className="page-state compact">
            <div className="state-icon">
              ↻
            </div>

            <h3>No plans found</h3>

            <p>
              Add a plan or change your
              search.
            </p>
          </div>
        </section>
      ) : (
        <div className="admin-plan-grid">
          {filteredPlans.map((plan) => (
            <article
              key={plan._id}
              className={`admin-plan-card ${
                !plan.active
                  ? "admin-plan-card-inactive"
                  : ""
              }`}
            >
              <div className="admin-plan-top">
                <div className="plan-cycle-icon">
                  {plan.billingCycle ===
                  "weekly"
                    ? "7"
                    : "30"}
                </div>

                <div className="plan-status-group">
                  {plan.badge ? (
                    <span className="plan-badge">
                      {plan.badge}
                    </span>
                  ) : null}

                  <span
                    className={`status-pill ${
                      plan.active
                        ? "status-active"
                        : "status-inactive"
                    }`}
                  >
                    {plan.active
                      ? "Active"
                      : "Disabled"}
                  </span>
                </div>
              </div>

              <span className="plan-id">
                {plan.planId}
              </span>

              <h3>{plan.name}</h3>

              <p className="plan-description">
                {plan.description}
              </p>

              <div className="plan-statistics">
                <div>
                  <strong>
                    {plan.bottleCount}
                  </strong>

                  <span>Bottles</span>
                </div>

                <div>
                  <strong>
                    {
                      plan.deliveriesPerCycle
                    }
                  </strong>

                  <span>Deliveries</span>
                </div>

                <div>
                  <strong>
                    {
                      plan.discountPercent
                    }
                    %
                  </strong>

                  <span>Saving</span>
                </div>
              </div>

              <div className="plan-cycle-row">
                <span>Billing cycle</span>

                <strong>
                  {plan.billingCycle ===
                  "weekly"
                    ? "Every week"
                    : "Every month"}
                </strong>
              </div>

              <div className="admin-plan-features">
                <h4>Included benefits</h4>

                {plan.features.length ===
                0 ? (
                  <p>
                    No benefits have been
                    added.
                  </p>
                ) : (
                  plan.features.map(
                    (feature) => (
                      <div
                        key={feature}
                        className="admin-plan-feature"
                      >
                        <span>✓</span>

                        <p>{feature}</p>
                      </div>
                    )
                  )
                )}
              </div>

              <div className="admin-plan-actions">
                <button
                  type="button"
                  className="table-action"
                  onClick={() =>
                    openEditForm(plan)
                  }
                >
                  Edit
                </button>

                <button
                  type="button"
                  className="table-action"
                  disabled={
                    updatingPlanId ===
                    plan.planId
                  }
                  onClick={() => {
                    void handleActiveToggle(
                      plan
                    );
                  }}
                >
                  {updatingPlanId ===
                  plan.planId
                    ? "Updating..."
                    : plan.active
                      ? "Disable"
                      : "Activate"}
                </button>

                {plan.active ? (
                  <button
                    type="button"
                    className="table-action danger"
                    disabled={
                      updatingPlanId ===
                      plan.planId
                    }
                    onClick={() => {
                      void handleArchive(
                        plan
                      );
                    }}
                  >
                    Archive
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}

      {formOpen ? (
        <div className="modal-backdrop">
          <div className="plan-modal">
            <div className="modal-header">
              <div>
                <span className="form-eyebrow">
                  PLAN MANAGEMENT
                </span>

                <h2>
                  {editingPlanId
                    ? "Edit subscription plan"
                    : "Add subscription plan"}
                </h2>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={resetForm}
              >
                ×
              </button>
            </div>

            <form
              className="plan-form"
              onSubmit={handleSubmit}
            >
              <div className="form-grid">
                <label className="form-field">
                  <span>Plan ID</span>

                  <input
                    value={form.planId}
                    disabled={Boolean(
                      editingPlanId
                    )}
                    onChange={(event) =>
                      updateField(
                        "planId",
                        createPlanId(
                          event.target.value
                        )
                      )
                    }
                    placeholder="weekly-fresh"
                  />
                </label>

                <label className="form-field">
                  <span>Plan name</span>

                  <input
                    value={form.name}
                    onChange={(event) =>
                      updateField(
                        "name",
                        event.target.value
                      )
                    }
                    placeholder="Weekly Fresh Plan"
                  />
                </label>

                <label className="form-field">
                  <span>
                    Billing cycle
                  </span>

                  <select
                    value={
                      form.billingCycle
                    }
                    onChange={(event) =>
                      updateField(
                        "billingCycle",
                        event.target
                          .value as PlanBillingCycle
                      )
                    }
                  >
                    <option value="weekly">
                      Weekly
                    </option>

                    <option value="monthly">
                      Monthly
                    </option>
                  </select>
                </label>

                <label className="form-field">
                  <span>Badge</span>

                  <input
                    value={form.badge}
                    onChange={(event) =>
                      updateField(
                        "badge",
                        event.target.value
                      )
                    }
                    placeholder="Best value"
                  />
                </label>

                <label className="form-field">
                  <span>Bottle count</span>

                  <input
                    type="number"
                    min="1"
                    value={
                      form.bottleCount
                    }
                    onChange={(event) =>
                      updateField(
                        "bottleCount",
                        event.target.value
                      )
                    }
                  />
                </label>

                <label className="form-field">
                  <span>
                    Deliveries per cycle
                  </span>

                  <input
                    type="number"
                    min="1"
                    value={
                      form.deliveriesPerCycle
                    }
                    onChange={(event) =>
                      updateField(
                        "deliveriesPerCycle",
                        event.target.value
                      )
                    }
                  />
                </label>

                <label className="form-field">
                  <span>
                    Discount percentage
                  </span>

                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={
                      form.discountPercent
                    }
                    onChange={(event) =>
                      updateField(
                        "discountPercent",
                        event.target.value
                      )
                    }
                  />
                </label>

                <label className="form-field">
                  <span>Sort order</span>

                  <input
                    type="number"
                    value={
                      form.sortOrder
                    }
                    onChange={(event) =>
                      updateField(
                        "sortOrder",
                        event.target.value
                      )
                    }
                  />
                </label>

                <label className="form-field full-width">
                  <span>Description</span>

                  <textarea
                    value={
                      form.description
                    }
                    onChange={(event) =>
                      updateField(
                        "description",
                        event.target.value
                      )
                    }
                    placeholder="Describe the subscription plan..."
                  />
                </label>

                <label className="form-field full-width">
                  <span>
                    Benefits — one per line
                  </span>

                  <textarea
                    value={form.features}
                    onChange={(event) =>
                      updateField(
                        "features",
                        event.target.value
                      )
                    }
                    placeholder={`4 bottles per cycle
1 delivery every week
5% saving
Free subscription delivery`}
                  />
                </label>
              </div>

              <label className="checkbox-field plan-active-checkbox">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) =>
                    updateField(
                      "active",
                      event.target.checked
                    )
                  }
                />

                Display this plan to customers
              </label>

              <div className="plan-preview">
                <div className="plan-preview-icon">
                  {form.billingCycle ===
                  "weekly"
                    ? "7"
                    : "30"}
                </div>

                <div>
                  <span>
                    Customer plan preview
                  </span>

                  <strong>
                    {form.name ||
                      "Plan name"}
                  </strong>

                  <small>
                    {form.bottleCount ||
                      "0"}{" "}
                    bottles ·{" "}
                    {form.deliveriesPerCycle ||
                      "0"}{" "}
                    deliveries ·{" "}
                    {form.discountPercent ||
                      "0"}
                    % saving
                  </small>
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={resetForm}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingPlanId
                      ? "Save changes"
                      : "Create plan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PlanMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <article className="plan-metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}