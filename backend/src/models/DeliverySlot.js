const mongoose = require("mongoose");

const deliverySlotSchema =
  new mongoose.Schema(
    {
      slotCode: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
      },

      label: {
        type: String,
        required: true,
        trim: true,
      },

      startMinutes: {
        type: Number,
        required: true,
        min: 0,
        max: 1439,
      },

      endMinutes: {
        type: Number,
        required: true,
        min: 1,
        max: 1440,
      },

      capacity: {
        type: Number,
        required: true,
        min: 1,
        max: 10000,
        default: 25,
      },

      cutoffMinutes: {
        type: Number,
        required: true,
        min: 0,
        max: 10080,
        default: 180,
      },

      weekdays: {
        type: [Number],

        default: [
          0,
          1,
          2,
          3,
          4,
          5,
          6,
        ],

        validate: {
          validator(values) {
            return (
              Array.isArray(
                values
              ) &&
              values.length >
                0 &&
              values.every(
                (value) =>
                  Number.isInteger(
                    value
                  ) &&
                  value >= 0 &&
                  value <= 6
              )
            );
          },

          message:
            "Delivery-slot weekdays must contain values from 0 to 6.",
        },
      },

      serviceableLocation: {
        type:
          mongoose.Schema.Types
            .ObjectId,

        ref:
          "ServiceableLocation",

        default: null,
      },

      pincodeSnapshot: {
        type: String,
        default: "",
        trim: true,
      },

      active: {
        type: Boolean,
        default: true,
      },

      sortOrder: {
        type: Number,
        default: 0,
      },
    },
    {
      timestamps: true,
    }
  );

deliverySlotSchema.pre(
  "validate",

  function validateTimeRange() {
    if (
      Number(
        this.endMinutes
      ) <=
      Number(
        this.startMinutes
      )
    ) {
      this.invalidate(
        "endMinutes",

        "Delivery-slot end time must be later than the start time."
      );
    }

    this.slotCode =
      String(
        this.slotCode ||
          ""
      )
        .trim()
        .toLowerCase();

    this.weekdays = [
      ...new Set(
        (
          this.weekdays ||
          []
        )
          .map(Number)
          .filter(
            (value) =>
              Number.isInteger(
                value
              ) &&
              value >= 0 &&
              value <= 6
          )
      ),
    ].sort(
      (
        left,
        right
      ) =>
        left -
        right
    );
  }
);

deliverySlotSchema.index(
  {
    serviceableLocation: 1,
    slotCode: 1,
  },
  {
    unique: true,
  }
);

deliverySlotSchema.index({
  active: 1,
  sortOrder: 1,
  startMinutes: 1,
});

module.exports =
  mongoose.model(
    "DeliverySlot",
    deliverySlotSchema
  );