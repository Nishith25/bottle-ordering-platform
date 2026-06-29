import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAdminAuth } from "../context/AuthContext";

import {
  createDeliveryPartner,
  fetchDeliveryPartners,
  updateDeliveryPartner,
  type DeliveryPartner,
} from "../services/adminDeliveryApi";

import "./deliveryPartners.css";

type PartnerForm = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
};

const EMPTY_FORM: PartnerForm = {
  fullName: "",
  email: "",
  phone: "",
  password: "",
};

function formatDate(value: string | null) {
  if (!value) {
    return "Never";
  }

  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function DeliveryPartnersPage() {
  const { token } = useAdminAuth();

  const [partners, setPartners] = useState<DeliveryPartner[]>([]);
  const [form, setForm] = useState<PartnerForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadPartners = useCallback(async () => {
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await fetchDeliveryPartners(token);
      setPartners(data);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load delivery partners."
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadPartners();
  }, [loadPartners]);

  const activePartners = useMemo(
    () => partners.filter((partner) => partner.active).length,
    [partners]
  );

  const activeAssignments = useMemo(
    () =>
      partners.reduce(
        (sum, partner) => sum + partner.activeAssignmentCount,
        0
      ),
    [partners]
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!token || saving) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const partner = await createDeliveryPartner(token, {
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.replace(/\D/g, ""),
        password: form.password,
      });

      setPartners((current) => [partner, ...current]);
      setForm(EMPTY_FORM);
      setSuccess("Delivery partner created successfully.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to create delivery partner."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (partner: DeliveryPartner) => {
    if (!token || updatingId) {
      return;
    }

    const nextActive = !partner.active;

    if (
      !nextActive &&
      partner.activeAssignmentCount > 0
    ) {
      setError(
        "Reassign this partner's active orders before disabling the account."
      );
      return;
    }

    setUpdatingId(partner.id);
    setError(null);
    setSuccess(null);

    try {
      const updatedPartner = await updateDeliveryPartner(
        token,
        partner.id,
        { active: nextActive }
      );

      setPartners((current) =>
        current.map((item) =>
          item.id === updatedPartner.id ? updatedPartner : item
        )
      );

      setSuccess(
        nextActive
          ? "Delivery partner enabled."
          : "Delivery partner disabled."
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update delivery partner."
      );
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="delivery-partners-page">
      <div className="page-heading-row">
        <div>
          <h2>Delivery partners</h2>
          <p>
            Create delivery accounts, control access and review active assignments.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          disabled={loading}
          onClick={() => void loadPartners()}
        >
          {loading ? "Refreshing..." : "Refresh partners"}
        </button>
      </div>

      {error ? <div className="inline-error">{error}</div> : null}
      {success ? <div className="inline-success">{success}</div> : null}

      <div className="delivery-partner-metrics">
        <Metric label="All partners" value={partners.length} />
        <Metric label="Active partners" value={activePartners} />
        <Metric label="Active assignments" value={activeAssignments} />
      </div>

      <div className="delivery-partner-layout">
        <section className="panel partner-form-panel">
          <span className="partner-eyebrow">NEW ACCOUNT</span>
          <h3>Add delivery partner</h3>
          <p>
            The partner can use this email or mobile number to log in to the delivery dashboard.
          </p>

          <form onSubmit={handleSubmit} className="partner-form">
            <label>
              Full name
              <input
                value={form.fullName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    fullName: event.target.value,
                  }))
                }
                placeholder="Partner name"
                required
              />
            </label>

            <label>
              Email address
              <input
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                placeholder="partner@example.com"
                required
              />
            </label>

            <label>
              Mobile number
              <input
                inputMode="numeric"
                maxLength={10}
                value={form.phone}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    phone: event.target.value.replace(/\D/g, ""),
                  }))
                }
                placeholder="10-digit mobile number"
                required
              />
            </label>

            <label>
              Temporary password
              <input
                type="password"
                minLength={8}
                value={form.password}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
                placeholder="Minimum 8 characters"
                required
              />
            </label>

            <button
              type="submit"
              className="primary-button partner-submit"
              disabled={saving}
            >
              {saving ? "Creating partner..." : "Create delivery partner"}
            </button>
          </form>
        </section>

        <section className="panel partner-list-panel">
          {loading && partners.length === 0 ? (
            <div className="page-state compact">
              <div className="spinner" />
              <p>Loading delivery partners</p>
            </div>
          ) : partners.length === 0 ? (
            <div className="page-state compact">
              <div className="state-icon">⇢</div>
              <h3>No delivery partners</h3>
              <p>Create the first delivery account using the form.</p>
            </div>
          ) : (
            <div className="partner-list">
              {partners.map((partner) => (
                <article key={partner.id} className="partner-card">
                  <div className="partner-card-main">
                    <div className="partner-avatar">
                      {partner.fullName.charAt(0).toUpperCase()}
                    </div>

                    <div className="partner-card-details">
                      <div className="partner-name-row">
                        <strong>{partner.fullName}</strong>
                        <span
                          className={
                            partner.active
                              ? "partner-status partner-active"
                              : "partner-status partner-inactive"
                          }
                        >
                          {partner.active ? "Active" : "Disabled"}
                        </span>
                      </div>

                      <span>{partner.email}</span>
                      <span>+91 {partner.phone}</span>
                    </div>
                  </div>

                  <div className="partner-card-stats">
                    <div>
                      <span>Active orders</span>
                      <strong>{partner.activeAssignmentCount}</strong>
                    </div>
                    <div>
                      <span>Last login</span>
                      <strong>{formatDate(partner.lastLoginAt)}</strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    className={
                      partner.active
                        ? "partner-disable-button"
                        : "partner-enable-button"
                    }
                    disabled={updatingId === partner.id}
                    onClick={() => void handleToggle(partner)}
                  >
                    {updatingId === partner.id
                      ? "Updating..."
                      : partner.active
                        ? "Disable account"
                        : "Enable account"}
                  </button>
                </article>
              ))}
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
    <div className="delivery-partner-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
