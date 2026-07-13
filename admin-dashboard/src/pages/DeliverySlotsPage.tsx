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
  createAdminDeliverySlot,
  disableAdminDeliverySlot,
  fetchAdminDeliverySlots,
  updateAdminDeliverySlot,
  type AdminDeliverySlotAvailability,
  type AdminDeliverySlotConfiguration,
  type AdminDeliverySlotPayload,
  type AdminDeliverySlotPreview,
} from "../services/api";

const WEEKDAYS = [
  {
    value: 0,
    short: "Sun",
    label: "Sunday",
  },
  {
    value: 1,
    short: "Mon",
    label: "Monday",
  },
  {
    value: 2,
    short: "Tue",
    label: "Tuesday",
  },
  {
    value: 3,
    short: "Wed",
    label: "Wednesday",
  },
  {
    value: 4,
    short: "Thu",
    label: "Thursday",
  },
  {
    value: 5,
    short: "Fri",
    label: "Friday",
  },
  {
    value: 6,
    short: "Sat",
    label: "Saturday",
  },
];

type SlotFormState = {
  slotCode: string;
  label: string;
  startTime: string;
  endTime: string;
  capacity: string;
  cutoffMinutes: string;
  pincode: string;
  sortOrder: string;
  active: boolean;
  weekdays: number[];
};

const EMPTY_FORM:
  SlotFormState = {
    slotCode: "",
    label: "",
    startTime: "08:00",
    endTime: "10:00",
    capacity: "25",
    cutoffMinutes: "180",
    pincode: "",
    sortOrder: "10",
    active: true,
    weekdays: [
      0,
      1,
      2,
      3,
      4,
      5,
      6,
    ],
  };

function getTomorrowDateId() {
  const date =
    new Date();

  date.setDate(
    date.getDate() +
      1
  );

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() +
        1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    );

  return `${year}-${month}-${day}`;
}

function minutesToTime(
  minutes: number
) {
  const hours =
    Math.floor(
      minutes / 60
    );

  const remainingMinutes =
    minutes % 60;

  return `${String(
    hours
  ).padStart(
    2,
    "0"
  )}:${String(
    remainingMinutes
  ).padStart(
    2,
    "0"
  )}`;
}

function timeToMinutes(
  value: string
) {
  const [
    hoursText,
    minutesText,
  ] =
    value.split(":");

  const hours =
    Number(
      hoursText
    );

  const minutes =
    Number(
      minutesText
    );

  if (
    !Number.isInteger(
      hours
    ) ||
    !Number.isInteger(
      minutes
    ) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return (
    hours * 60 +
    minutes
  );
}

function generateSlotCode(
  startTime: string,
  endTime: string
) {
  return `slot-${startTime.replace(
    ":",
    ""
  )}-${endTime.replace(
    ":",
    ""
  )}`
    .toLowerCase();
}

function getLocationPincode(
  slot:
    AdminDeliverySlotConfiguration
) {
  if (
    slot.serviceableLocation &&
    typeof slot
      .serviceableLocation ===
      "object"
  ) {
    return slot
      .serviceableLocation
      .pincode;
  }

  return (
    slot.pincodeSnapshot ||
    ""
  );
}

function getLocationLabel(
  slot:
    AdminDeliverySlotConfiguration
) {
  if (
    slot.serviceableLocation &&
    typeof slot
      .serviceableLocation ===
      "object"
  ) {
    return `${slot.serviceableLocation.area}, ${slot.serviceableLocation.city} · ${slot.serviceableLocation.pincode}`;
  }

  if (
    slot.pincodeSnapshot
  ) {
    return `Pincode ${slot.pincodeSnapshot}`;
  }

  return "All serviceable locations";
}

function formatWeekdays(
  weekdays: number[]
) {
  const sorted =
    [...weekdays].sort(
      (
        left,
        right
      ) =>
        left -
        right
    );

  if (
    sorted.length ===
    7
  ) {
    return "Every day";
  }

  return sorted
    .map(
      (weekday) =>
        WEEKDAYS.find(
          (item) =>
            item.value ===
            weekday
        )?.short
    )
    .filter(Boolean)
    .join(", ");
}

function formatCutoff(
  minutes: number
) {
  if (
    minutes ===
    0
  ) {
    return "At slot start";
  }

  if (
    minutes %
      1440 ===
      0
  ) {
    const days =
      minutes / 1440;

    return `${days} day${
      days === 1
        ? ""
        : "s"
    } before`;
  }

  if (
    minutes %
      60 ===
      0
  ) {
    const hours =
      minutes / 60;

    return `${hours} hour${
      hours === 1
        ? ""
        : "s"
    } before`;
  }

  return `${minutes} minutes before`;
}

function getPreviewReason(
  slot:
    AdminDeliverySlotAvailability
) {
  switch (
    slot.reason
  ) {
    case "full":
      return "Full";

    case "cutoff_passed":
      return "Cutoff passed";

    case "not_scheduled":
      return "Not scheduled";

    default:
      return "Available";
  }
}

export default function DeliverySlotsPage() {
  const {
    token,
  } =
    useAdminAuth();

  const [
    slots,
    setSlots,
  ] =
    useState<
      AdminDeliverySlotConfiguration[]
    >([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    actionSlotId,
    setActionSlotId,
  ] =
    useState<
      string | null
    >(null);

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

  const [
    success,
    setSuccess,
  ] =
    useState<
      string | null
    >(null);

  const [
    modalOpen,
    setModalOpen,
  ] =
    useState(false);

  const [
    editingSlot,
    setEditingSlot,
  ] =
    useState<
      AdminDeliverySlotConfiguration | null
    >(null);

  const [
    form,
    setForm,
  ] =
    useState<SlotFormState>(
      EMPTY_FORM
    );

  const [
    previewPincode,
    setPreviewPincode,
  ] =
    useState("");

  const [
    previewDate,
    setPreviewDate,
  ] =
    useState(
      getTomorrowDateId()
    );

  const [
    preview,
    setPreview,
  ] =
    useState<
      AdminDeliverySlotPreview | null
    >(null);

  const [
    previewLoading,
    setPreviewLoading,
  ] =
    useState(false);

  const [
    previewError,
    setPreviewError,
  ] =
    useState<
      string | null
    >(null);

  const loadSlots =
    useCallback(
      async () => {
        if (
          !token
        ) {
          return;
        }

        setLoading(
          true
        );

        setError(
          null
        );

        try {
          const result =
            await fetchAdminDeliverySlots(
              token,

              {
                includeInactive:
                  true,
              }
            );

          setSlots(
            result.configurations
          );
        } catch (
          requestError
        ) {
          setError(
            requestError instanceof
              Error
              ? requestError.message
              : "Unable to load delivery slots."
          );
        } finally {
          setLoading(
            false
          );
        }
      },

      [token]
    );

  useEffect(() => {
    void loadSlots();
  }, [
    loadSlots,
  ]);

  const activeSlots =
    useMemo(
      () =>
        slots.filter(
          (slot) =>
            slot.active
        ).length,

      [slots]
    );

  const globalSlots =
    useMemo(
      () =>
        slots.filter(
          (slot) =>
            !getLocationPincode(
              slot
            )
        ).length,

      [slots]
    );

  const locationOverrides =
    slots.length -
    globalSlots;

  const openCreateModal =
    () => {
      setEditingSlot(
        null
      );

      setForm({
        ...EMPTY_FORM,

        weekdays: [
          ...EMPTY_FORM.weekdays,
        ],
      });

      setError(
        null
      );

      setSuccess(
        null
      );

      setModalOpen(
        true
      );
    };

  const openEditModal =
    (
      slot:
        AdminDeliverySlotConfiguration
    ) => {
      setEditingSlot(
        slot
      );

      setForm({
        slotCode:
          slot.slotCode,

        label:
          slot.label,

        startTime:
          minutesToTime(
            slot.startMinutes
          ),

        endTime:
          minutesToTime(
            slot.endMinutes
          ),

        capacity:
          String(
            slot.capacity
          ),

        cutoffMinutes:
          String(
            slot.cutoffMinutes
          ),

        pincode:
          getLocationPincode(
            slot
          ),

        sortOrder:
          String(
            slot.sortOrder
          ),

        active:
          slot.active,

        weekdays: [
          ...slot.weekdays,
        ],
      });

      setError(
        null
      );

      setSuccess(
        null
      );

      setModalOpen(
        true
      );
    };

  const closeModal =
    () => {
      if (
        saving
      ) {
        return;
      }

      setModalOpen(
        false
      );

      setEditingSlot(
        null
      );
    };

  const toggleWeekday =
    (
      weekday:
        number
    ) => {
      setForm(
        (
          current
        ) => ({
          ...current,

          weekdays:
            current.weekdays.includes(
              weekday
            )
              ? current.weekdays.filter(
                  (value) =>
                    value !==
                    weekday
                )
              : [
                  ...current.weekdays,
                  weekday,
                ].sort(
                  (
                    left,
                    right
                  ) =>
                    left -
                    right
                ),
        })
      );
    };

  const buildPayload =
    (): AdminDeliverySlotPayload => {
      const startMinutes =
        timeToMinutes(
          form.startTime
        );

      const endMinutes =
        timeToMinutes(
          form.endTime
        );

      if (
        startMinutes ===
          null ||
        endMinutes ===
          null
      ) {
        throw new Error(
          "Enter valid start and end times."
        );
      }

      if (
        endMinutes <=
        startMinutes
      ) {
        throw new Error(
          "The end time must be later than the start time."
        );
      }

      const capacity =
        Number(
          form.capacity
        );

      if (
        !Number.isInteger(
          capacity
        ) ||
        capacity < 1
      ) {
        throw new Error(
          "Capacity must be at least 1."
        );
      }

      const cutoffMinutes =
        Number(
          form.cutoffMinutes
        );

      if (
        !Number.isInteger(
          cutoffMinutes
        ) ||
        cutoffMinutes <
          0
      ) {
        throw new Error(
          "Cutoff minutes must be zero or more."
        );
      }

      if (
        form.weekdays.length ===
        0
      ) {
        throw new Error(
          "Select at least one weekday."
        );
      }

      const pincode =
        form.pincode.replace(
          /\D/g,
          ""
        );

      if (
        pincode &&
        pincode.length !==
          6
      ) {
        throw new Error(
          "A location override must use a valid six-digit pincode."
        );
      }

      return {
        slotCode:
          form.slotCode
            .trim()
            .toLowerCase() ||
          generateSlotCode(
            form.startTime,
            form.endTime
          ),

        label:
          form.label.trim(),

        startMinutes,
        endMinutes,
        capacity,
        cutoffMinutes,

        weekdays: [
          ...form.weekdays,
        ],

        active:
          form.active,

        sortOrder:
          Number(
            form.sortOrder
          ) || 0,

        pincode:
          pincode ||
          undefined,
      };
    };

  const handleSave =
    async () => {
      if (
        !token
      ) {
        return;
      }

      setSaving(
        true
      );

      setError(
        null
      );

      setSuccess(
        null
      );

      try {
        const payload =
          buildPayload();

        if (
          editingSlot
        ) {
          await updateAdminDeliverySlot(
            token,
            editingSlot._id,
            payload
          );

          setSuccess(
            "Delivery slot updated successfully."
          );
        } else {
          await createAdminDeliverySlot(
            token,
            payload
          );

          setSuccess(
            "Delivery slot created successfully."
          );
        }

        setModalOpen(
          false
        );

        setEditingSlot(
          null
        );

        await loadSlots();
      } catch (
        requestError
      ) {
        setError(
          requestError instanceof
            Error
            ? requestError.message
            : "Unable to save the delivery slot."
        );
      } finally {
        setSaving(
          false
        );
      }
    };

  const handleDisable =
    async (
      slot:
        AdminDeliverySlotConfiguration
    ) => {
      if (
        !token
      ) {
        return;
      }

      const confirmed =
        window.confirm(
          `Disable "${slot.label}"? Existing historical orders will remain unchanged.`
        );

      if (
        !confirmed
      ) {
        return;
      }

      setActionSlotId(
        slot._id
      );

      setError(
        null
      );

      setSuccess(
        null
      );

      try {
        await disableAdminDeliverySlot(
          token,
          slot._id
        );

        setSuccess(
          "Delivery slot disabled successfully."
        );

        await loadSlots();
      } catch (
        requestError
      ) {
        setError(
          requestError instanceof
            Error
            ? requestError.message
            : "Unable to disable the delivery slot."
        );
      } finally {
        setActionSlotId(
          null
        );
      }
    };

  const handleEnable =
    async (
      slot:
        AdminDeliverySlotConfiguration
    ) => {
      if (
        !token
      ) {
        return;
      }

      setActionSlotId(
        slot._id
      );

      setError(
        null
      );

      setSuccess(
        null
      );

      try {
        await updateAdminDeliverySlot(
          token,
          slot._id,

          {
            active:
              true,
          }
        );

        setSuccess(
          "Delivery slot enabled successfully."
        );

        await loadSlots();
      } catch (
        requestError
      ) {
        setError(
          requestError instanceof
            Error
            ? requestError.message
            : "Unable to enable the delivery slot."
        );
      } finally {
        setActionSlotId(
          null
        );
      }
    };

  const handlePreview =
    async () => {
      if (
        !token
      ) {
        return;
      }

      const cleanPincode =
        previewPincode.replace(
          /\D/g,
          ""
        );

      if (
        cleanPincode.length !==
        6
      ) {
        setPreviewError(
          "Enter a valid six-digit pincode."
        );

        return;
      }

      if (
        !previewDate
      ) {
        setPreviewError(
          "Select a preview date."
        );

        return;
      }

      setPreviewLoading(
        true
      );

      setPreviewError(
        null
      );

      try {
        const result =
          await fetchAdminDeliverySlots(
            token,

            {
              includeInactive:
                true,

              pincode:
                cleanPincode,

              date:
                previewDate,
            }
          );

        setPreview(
          result.preview
        );
      } catch (
        requestError
      ) {
        setPreview(
          null
        );

        setPreviewError(
          requestError instanceof
            Error
            ? requestError.message
            : "Unable to preview slot availability."
        );
      } finally {
        setPreviewLoading(
          false
        );
      }
    };

  if (
    loading
  ) {
    return (
      <div className="page-state">
        <div className="spinner" />

        <h3>
          Loading delivery slots
        </h3>

        <p>
          Checking current capacity and cutoff settings.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="page-heading-row">
        <div>
          <h2>
            Delivery slots
          </h2>

          <p>
            Manage live customer availability, capacity, booking cutoffs and location-specific overrides.
          </p>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={
            openCreateModal
          }
        >
          Add delivery slot
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

      <div className="slot-metric-grid">
        <div className="slot-metric-card">
          <span>
            Total configurations
          </span>

          <strong>
            {slots.length}
          </strong>

          <small>
            Global slots and pincode overrides
          </small>
        </div>

        <div className="slot-metric-card">
          <span>
            Active configurations
          </span>

          <strong>
            {activeSlots}
          </strong>

          <small>
            Currently available for matching dates
          </small>
        </div>

        <div className="slot-metric-card">
          <span>
            Global slots
          </span>

          <strong>
            {globalSlots}
          </strong>

          <small>
            Applied to all active delivery locations
          </small>
        </div>

        <div className="slot-metric-card">
          <span>
            Location overrides
          </span>

          <strong>
            {locationOverrides}
          </strong>

          <small>
            Pincode-specific slot rules
          </small>
        </div>
      </div>

      <section className="panel slot-preview-panel">
        <div className="panel-heading">
          <h3>
            Availability preview
          </h3>

          <p>
            Check what a customer will see for a specific pincode and date.
          </p>
        </div>

        <div className="slot-preview-controls">
          <label className="form-field">
            <span>
              Delivery pincode
            </span>

            <input
              value={
                previewPincode
              }
              inputMode="numeric"
              maxLength={6}
              placeholder="500001"
              onChange={(
                event
              ) =>
                setPreviewPincode(
                  event.target.value
                    .replace(
                      /\D/g,
                      ""
                    )
                    .slice(
                      0,
                      6
                    )
                )
              }
            />
          </label>

          <label className="form-field">
            <span>
              Delivery date
            </span>

            <input
              type="date"
              value={
                previewDate
              }
              onChange={(
                event
              ) =>
                setPreviewDate(
                  event.target.value
                )
              }
            />
          </label>

          <button
            type="button"
            className="primary-button slot-preview-button"
            disabled={
              previewLoading
            }
            onClick={() =>
              void handlePreview()
            }
          >
            {previewLoading
              ? "Checking..."
              : "Preview availability"}
          </button>
        </div>

        {previewError ? (
          <div className="slot-preview-message error">
            {previewError}
          </div>
        ) : null}

        {preview ? (
          <div className="slot-preview-content">
            <div className="slot-preview-location">
              <strong>
                {preview.location.area},{" "}
                {preview.location.city}
              </strong>

              <span>
                Pincode{" "}
                {preview.location.pincode} ·{" "}
                {preview.deliveryDateId}
              </span>
            </div>

            <div className="slot-preview-grid">
              {preview.slots.map(
                (slot) => (
                  <div
                    key={
                      slot.slotCode
                    }
                    className={`slot-preview-card ${
                      slot.available
                        ? "available"
                        : "unavailable"
                    }`}
                  >
                    <div>
                      <strong>
                        {slot.label}
                      </strong>

                      <span>
                        {slot.locationSpecific
                          ? "Location override"
                          : "Global configuration"}
                      </span>
                    </div>

                    <div className="slot-preview-capacity">
                      <strong>
                        {slot.remaining}
                      </strong>

                      <span>
                        of {slot.capacity} remaining
                      </span>
                    </div>

                    <div
                      className={`slot-preview-status ${
                        slot.available
                          ? "available"
                          : "unavailable"
                      }`}
                    >
                      {getPreviewReason(
                        slot
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        ) : null}
      </section>

      <section className="panel slot-table-panel">
        <div className="panel-heading">
          <h3>
            Slot configurations
          </h3>

          <p>
            A pincode-specific slot with the same slot code overrides the global configuration for that location.
          </p>
        </div>

        {slots.length ===
        0 ? (
          <div className="empty-panel">
            No delivery slots have been configured.
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="product-table delivery-slot-table">
              <thead>
                <tr>
                  <th>
                    Slot
                  </th>

                  <th>
                    Applies to
                  </th>

                  <th>
                    Days
                  </th>

                  <th>
                    Capacity
                  </th>

                  <th>
                    Cutoff
                  </th>

                  <th>
                    Status
                  </th>

                  <th>
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {slots.map(
                  (slot) => (
                    <tr
                      key={
                        slot._id
                      }
                    >
                      <td>
                        <div className="slot-name-cell">
                          <strong>
                            {slot.label}
                          </strong>

                          <span>
                            {slot.slotCode}
                          </span>
                        </div>
                      </td>

                      <td>
                        <div className="slot-location-cell">
                          <strong>
                            {getLocationPincode(
                              slot
                            )
                              ? "Location override"
                              : "Global"}
                          </strong>

                          <span>
                            {getLocationLabel(
                              slot
                            )}
                          </span>
                        </div>
                      </td>

                      <td>
                        {formatWeekdays(
                          slot.weekdays
                        )}
                      </td>

                      <td>
                        <strong>
                          {slot.capacity}
                        </strong>{" "}
                        orders
                      </td>

                      <td>
                        {formatCutoff(
                          slot.cutoffMinutes
                        )}
                      </td>

                      <td>
                        <span
                          className={`status-pill ${
                            slot.active
                              ? "status-active"
                              : "status-inactive"
                          }`}
                        >
                          {slot.active
                            ? "Active"
                            : "Disabled"}
                        </span>
                      </td>

                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="table-action"
                            onClick={() =>
                              openEditModal(
                                slot
                              )
                            }
                          >
                            Edit
                          </button>

                          {slot.active ? (
                            <button
                              type="button"
                              className="table-action danger"
                              disabled={
                                actionSlotId ===
                                slot._id
                              }
                              onClick={() =>
                                void handleDisable(
                                  slot
                                )
                              }
                            >
                              {actionSlotId ===
                              slot._id
                                ? "Disabling..."
                                : "Disable"}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="table-action"
                              disabled={
                                actionSlotId ===
                                slot._id
                              }
                              onClick={() =>
                                void handleEnable(
                                  slot
                                )
                              }
                            >
                              {actionSlotId ===
                              slot._id
                                ? "Enabling..."
                                : "Enable"}
                            </button>
                          )}
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

      {modalOpen ? (
        <div className="modal-backdrop">
          <div className="product-modal delivery-slot-modal">
            <div className="modal-header">
              <div>
                <span className="form-eyebrow">
                  DELIVERY OPERATIONS
                </span>

                <h2>
                  {editingSlot
                    ? "Edit delivery slot"
                    : "Create delivery slot"}
                </h2>
              </div>

              <button
                type="button"
                className="modal-close"
                aria-label="Close delivery slot form"
                onClick={
                  closeModal
                }
              >
                ×
              </button>
            </div>

            <div className="product-form">
              <div className="slot-form-notice">
                Leave the pincode blank to create a global slot. Enter a serviceable pincode to create an override for that location.
              </div>

              <div className="form-grid">
                <label className="form-field">
                  <span>
                    Slot code
                  </span>

                  <input
                    value={
                      form.slotCode
                    }
                    placeholder="morning-8-10"
                    onChange={(
                      event
                    ) =>
                      setForm(
                        (
                          current
                        ) => ({
                          ...current,

                          slotCode:
                            event.target.value
                              .toLowerCase()
                              .replace(
                                /[^a-z0-9-]/g,
                                "-"
                              ),
                        })
                      )
                    }
                  />
                </label>

                <label className="form-field">
                  <span>
                    Customer label
                  </span>

                  <input
                    value={
                      form.label
                    }
                    placeholder="8:00 AM – 10:00 AM"
                    onChange={(
                      event
                    ) =>
                      setForm(
                        (
                          current
                        ) => ({
                          ...current,

                          label:
                            event.target.value,
                        })
                      )
                    }
                  />
                </label>

                <label className="form-field">
                  <span>
                    Start time
                  </span>

                  <input
                    type="time"
                    value={
                      form.startTime
                    }
                    onChange={(
                      event
                    ) =>
                      setForm(
                        (
                          current
                        ) => ({
                          ...current,

                          startTime:
                            event.target.value,
                        })
                      )
                    }
                  />
                </label>

                <label className="form-field">
                  <span>
                    End time
                  </span>

                  <input
                    type="time"
                    value={
                      form.endTime
                    }
                    onChange={(
                      event
                    ) =>
                      setForm(
                        (
                          current
                        ) => ({
                          ...current,

                          endTime:
                            event.target.value,
                        })
                      )
                    }
                  />
                </label>

                <label className="form-field">
                  <span>
                    Maximum orders
                  </span>

                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={
                      form.capacity
                    }
                    onChange={(
                      event
                    ) =>
                      setForm(
                        (
                          current
                        ) => ({
                          ...current,

                          capacity:
                            event.target.value,
                        })
                      )
                    }
                  />
                </label>

                <label className="form-field">
                  <span>
                    Cutoff minutes before start
                  </span>

                  <input
                    type="number"
                    min="0"
                    max="10080"
                    value={
                      form.cutoffMinutes
                    }
                    onChange={(
                      event
                    ) =>
                      setForm(
                        (
                          current
                        ) => ({
                          ...current,

                          cutoffMinutes:
                            event.target.value,
                        })
                      )
                    }
                  />
                </label>

                <label className="form-field">
                  <span>
                    Pincode override
                  </span>

                  <input
                    inputMode="numeric"
                    maxLength={6}
                    value={
                      form.pincode
                    }
                    placeholder="Blank for all locations"
                    onChange={(
                      event
                    ) =>
                      setForm(
                        (
                          current
                        ) => ({
                          ...current,

                          pincode:
                            event.target.value
                              .replace(
                                /\D/g,
                                ""
                              )
                              .slice(
                                0,
                                6
                              ),
                        })
                      )
                    }
                  />
                </label>

                <label className="form-field">
                  <span>
                    Sort order
                  </span>

                  <input
                    type="number"
                    value={
                      form.sortOrder
                    }
                    onChange={(
                      event
                    ) =>
                      setForm(
                        (
                          current
                        ) => ({
                          ...current,

                          sortOrder:
                            event.target.value,
                        })
                      )
                    }
                  />
                </label>

                <div className="form-field full-width">
                  <span>
                    Delivery weekdays
                  </span>

                  <div className="weekday-selector">
                    {WEEKDAYS.map(
                      (weekday) => {
                        const selected =
                          form.weekdays.includes(
                            weekday.value
                          );

                        return (
                          <button
                            key={
                              weekday.value
                            }
                            type="button"
                            title={
                              weekday.label
                            }
                            className={`weekday-button ${
                              selected
                                ? "selected"
                                : ""
                            }`}
                            onClick={() =>
                              toggleWeekday(
                                weekday.value
                              )
                            }
                          >
                            {weekday.short}
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>
              </div>

              <label className="checkbox-field slot-active-toggle">
                <input
                  type="checkbox"
                  checked={
                    form.active
                  }
                  onChange={(
                    event
                  ) =>
                    setForm(
                      (
                        current
                      ) => ({
                        ...current,

                        active:
                          event.target.checked,
                      })
                    )
                  }
                />

                Make this slot active
              </label>

              {error ? (
                <div className="form-error">
                  {error}
                </div>
              ) : null}

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={
                    saving
                  }
                  onClick={
                    closeModal
                  }
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="primary-button"
                  disabled={
                    saving
                  }
                  onClick={() =>
                    void handleSave()
                  }
                >
                  {saving
                    ? "Saving..."
                    : editingSlot
                      ? "Save changes"
                      : "Create slot"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}