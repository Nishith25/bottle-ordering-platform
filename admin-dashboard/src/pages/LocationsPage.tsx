// admin-dashboard/src/pages/LocationsPage.tsx

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAdminAuth } from "../context/AuthContext";

import {
  createAdminLocation,
  disableAdminLocation,
  fetchAdminLocations,
  updateAdminLocation,
  type AdminLocation,
  type LocationPayload,
} from "../services/adminLocationsApi";

import "./locations.css";

type LocationFormState = {
  pincode: string;
  area: string;
  city: string;
  deliveryFee: string;
  minimumOrder: string;
  sortOrder: string;
  active: boolean;
};

const EMPTY_FORM: LocationFormState = {
  pincode: "",
  area: "",
  city: "Hyderabad",
  deliveryFee: "39",
  minimumOrder: "99",
  sortOrder: "0",
  active: true,
};

export default function LocationsPage() {
  const { token } = useAdminAuth();

  const [locations, setLocations] =
    useState<AdminLocation[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [updatingPincode, setUpdatingPincode] =
    useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const [success, setSuccess] =
    useState<string | null>(null);

  const [search, setSearch] =
    useState("");

  const [formOpen, setFormOpen] =
    useState(false);

  const [
    editingPincode,
    setEditingPincode,
  ] = useState<string | null>(null);

  const [form, setForm] =
    useState<LocationFormState>(
      EMPTY_FORM
    );

  const loadLocations =
    useCallback(async () => {
      if (!token) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data =
          await fetchAdminLocations(
            token
          );

        setLocations(data);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load delivery locations."
        );
      } finally {
        setLoading(false);
      }
    }, [token]);

  useEffect(() => {
    void loadLocations();
  }, [loadLocations]);

  const filteredLocations =
    useMemo(() => {
      const query = search
        .trim()
        .toLowerCase();

      if (!query) {
        return locations;
      }

      return locations.filter(
        (location) =>
          location.pincode.includes(
            query
          ) ||
          location.area
            .toLowerCase()
            .includes(query) ||
          location.city
            .toLowerCase()
            .includes(query)
      );
    }, [locations, search]);

  const activeLocationCount =
    useMemo(
      () =>
        locations.filter(
          (location) =>
            location.active
        ).length,
      [locations]
    );

  function updateField<
    K extends keyof LocationFormState,
  >(
    field: K,
    value: LocationFormState[K]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingPincode(null);
    setFormOpen(false);
  };

  const openCreateForm = () => {
    setError(null);
    setSuccess(null);
    setForm(EMPTY_FORM);
    setEditingPincode(null);
    setFormOpen(true);
  };

  const openEditForm = (
    location: AdminLocation
  ) => {
    setError(null);
    setSuccess(null);

    setEditingPincode(
      location.pincode
    );

    setForm({
      pincode: location.pincode,
      area: location.area,
      city: location.city,

      deliveryFee: String(
        location.deliveryFee
      ),

      minimumOrder: String(
        location.minimumOrder
      ),

      sortOrder: String(
        location.sortOrder
      ),

      active: location.active,
    });

    setFormOpen(true);
  };

  const createPayload =
    (): LocationPayload => ({
      pincode: form.pincode.replace(
        /\D/g,
        ""
      ),

      area: form.area.trim(),
      city: form.city.trim(),

      deliveryFee: Number(
        form.deliveryFee
      ),

      minimumOrder: Number(
        form.minimumOrder
      ),

      sortOrder:
        Number(form.sortOrder) || 0,

      active: form.active,
    });

  const validatePayload = (
    payload: LocationPayload
  ) => {
    if (
      !/^\d{6}$/.test(
        payload.pincode
      )
    ) {
      return "Enter a valid six-digit pincode.";
    }

    if (
      payload.area.length < 2
    ) {
      return "Area name is required.";
    }

    if (
      payload.city.length < 2
    ) {
      return "City name is required.";
    }

    if (
      !Number.isFinite(
        payload.deliveryFee
      ) ||
      payload.deliveryFee < 0
    ) {
      return "Enter a valid delivery fee.";
    }

    if (
      !Number.isFinite(
        payload.minimumOrder
      ) ||
      payload.minimumOrder < 0
    ) {
      return "Enter a valid minimum order value.";
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

    const payload =
      createPayload();

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
      if (editingPincode) {
        const {
          pincode: ignoredPincode,
          ...updates
        } = payload;

        void ignoredPincode;

        await updateAdminLocation(
          token,
          editingPincode,
          updates
        );

        setSuccess(
          "Delivery location updated successfully."
        );
      } else {
        await createAdminLocation(
          token,
          payload
        );

        setSuccess(
          "Delivery location added successfully."
        );
      }

      resetForm();
      await loadLocations();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to save delivery location."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleActiveToggle =
    async (
      location: AdminLocation
    ) => {
      if (!token) {
        return;
      }

      setUpdatingPincode(
        location.pincode
      );

      setError(null);
      setSuccess(null);

      try {
        await updateAdminLocation(
          token,
          location.pincode,
          {
            active:
              !location.active,
          }
        );

        setSuccess(
          location.active
            ? `${location.area} has been disabled.`
            : `${location.area} is now active.`
        );

        await loadLocations();
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to update this location."
        );
      } finally {
        setUpdatingPincode(null);
      }
    };

  const handleDisable =
    async (
      location: AdminLocation
    ) => {
      if (!token) {
        return;
      }

      const confirmed =
        window.confirm(
          `Disable deliveries to ${location.area} – ${location.pincode}?`
        );

      if (!confirmed) {
        return;
      }

      setUpdatingPincode(
        location.pincode
      );

      setError(null);
      setSuccess(null);

      try {
        await disableAdminLocation(
          token,
          location.pincode
        );

        setSuccess(
          `${location.area} has been disabled.`
        );

        await loadLocations();
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to disable this location."
        );
      } finally {
        setUpdatingPincode(null);
      }
    };

  return (
    <div className="locations-page">
      <div className="page-heading-row">
        <div>
          <h2>Delivery locations</h2>

          <p>
            Manage serviceable pincodes,
            delivery charges and minimum
            order values.
          </p>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={openCreateForm}
        >
          + Add location
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

      <div className="location-metric-grid">
        <article className="location-metric-card">
          <span>
            Total locations
          </span>

          <strong>
            {locations.length}
          </strong>
        </article>

        <article className="location-metric-card">
          <span>
            Active locations
          </span>

          <strong>
            {activeLocationCount}
          </strong>
        </article>

        <article className="location-metric-card">
          <span>
            Disabled locations
          </span>

          <strong>
            {locations.length -
              activeLocationCount}
          </strong>
        </article>
      </div>

      <section className="panel locations-toolbar">
        <input
          className="search-input"
          value={search}
          onChange={(event) =>
            setSearch(
              event.target.value
            )
          }
          placeholder="Search pincode, area or city"
        />

        <button
          type="button"
          className="secondary-button"
          disabled={loading}
          onClick={() => {
            void loadLocations();
          }}
        >
          {loading
            ? "Refreshing..."
            : "Refresh"}
        </button>
      </section>

      <section className="panel location-table-panel">
        {loading &&
        locations.length === 0 ? (
          <div className="page-state compact">
            <div className="spinner" />

            <p>
              Loading delivery locations
            </p>
          </div>
        ) : filteredLocations.length ===
          0 ? (
          <div className="page-state compact">
            <div className="state-icon">
              ⌖
            </div>

            <h3>
              No locations found
            </h3>

            <p>
              Add a new pincode or change
              your search.
            </p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="location-table">
              <thead>
                <tr>
                  <th>Pincode</th>
                  <th>Area</th>
                  <th>City</th>
                  <th>Delivery fee</th>
                  <th>Minimum order</th>
                  <th>Status</th>
                  <th>Sort order</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredLocations.map(
                  (location) => (
                    <tr
                      key={
                        location._id
                      }
                    >
                      <td>
                        <strong className="location-pincode">
                          {
                            location.pincode
                          }
                        </strong>
                      </td>

                      <td>
                        <div className="location-area-cell">
                          <div className="location-pin-icon">
                            ⌖
                          </div>

                          <strong>
                            {
                              location.area
                            }
                          </strong>
                        </div>
                      </td>

                      <td>
                        {location.city}
                      </td>

                      <td>
                        {location.deliveryFee ===
                        0
                          ? "Free"
                          : `₹${location.deliveryFee}`}
                      </td>

                      <td>
                        ₹
                        {
                          location.minimumOrder
                        }
                      </td>

                      <td>
                        <span
                          className={`status-pill ${
                            location.active
                              ? "status-active"
                              : "status-inactive"
                          }`}
                        >
                          {location.active
                            ? "Active"
                            : "Disabled"}
                        </span>
                      </td>

                      <td>
                        {
                          location.sortOrder
                        }
                      </td>

                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="table-action"
                            onClick={() =>
                              openEditForm(
                                location
                              )
                            }
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className="table-action"
                            disabled={
                              updatingPincode ===
                              location.pincode
                            }
                            onClick={() => {
                              void handleActiveToggle(
                                location
                              );
                            }}
                          >
                            {updatingPincode ===
                            location.pincode
                              ? "Updating..."
                              : location.active
                                ? "Disable"
                                : "Activate"}
                          </button>

                          {location.active ? (
                            <button
                              type="button"
                              className="table-action danger"
                              disabled={
                                updatingPincode ===
                                location.pincode
                              }
                              onClick={() => {
                                void handleDisable(
                                  location
                                );
                              }}
                            >
                              Remove
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {formOpen ? (
        <div className="modal-backdrop">
          <div className="location-modal">
            <div className="modal-header">
              <div>
                <span className="form-eyebrow">
                  DELIVERY MANAGEMENT
                </span>

                <h2>
                  {editingPincode
                    ? "Edit location"
                    : "Add location"}
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
              className="location-form"
              onSubmit={handleSubmit}
            >
              <div className="form-grid">
                <label className="form-field">
                  <span>Pincode</span>

                  <input
                    value={form.pincode}
                    disabled={Boolean(
                      editingPincode
                    )}
                    inputMode="numeric"
                    maxLength={6}
                    onChange={(event) =>
                      updateField(
                        "pincode",
                        event.target.value.replace(
                          /\D/g,
                          ""
                        )
                      )
                    }
                    placeholder="500081"
                  />
                </label>

                <label className="form-field">
                  <span>Area</span>

                  <input
                    value={form.area}
                    onChange={(event) =>
                      updateField(
                        "area",
                        event.target.value
                      )
                    }
                    placeholder="Madhapur"
                  />
                </label>

                <label className="form-field">
                  <span>City</span>

                  <input
                    value={form.city}
                    onChange={(event) =>
                      updateField(
                        "city",
                        event.target.value
                      )
                    }
                    placeholder="Hyderabad"
                  />
                </label>

                <label className="form-field">
                  <span>
                    Delivery fee
                  </span>

                  <input
                    type="number"
                    min="0"
                    value={
                      form.deliveryFee
                    }
                    onChange={(event) =>
                      updateField(
                        "deliveryFee",
                        event.target.value
                      )
                    }
                    placeholder="39"
                  />
                </label>

                <label className="form-field">
                  <span>
                    Minimum order
                  </span>

                  <input
                    type="number"
                    min="0"
                    value={
                      form.minimumOrder
                    }
                    onChange={(event) =>
                      updateField(
                        "minimumOrder",
                        event.target.value
                      )
                    }
                    placeholder="99"
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
              </div>

              <label className="checkbox-field location-active-checkbox">
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

                Delivery available for this
                pincode
              </label>

              <div className="location-preview">
                <div className="location-preview-icon">
                  ⌖
                </div>

                <div>
                  <span>
                    Customer checkout preview
                  </span>

                  <strong>
                    {form.area ||
                      "Area name"}
                    {form.city
                      ? `, ${form.city}`
                      : ""}
                  </strong>

                  <small>
                    Delivery fee ₹
                    {form.deliveryFee ||
                      "0"}{" "}
                    · Minimum order ₹
                    {form.minimumOrder ||
                      "0"}
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
                    : editingPincode
                      ? "Save changes"
                      : "Add location"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}