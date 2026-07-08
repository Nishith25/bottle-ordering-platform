const mongoose = require("mongoose");

const deliverySlotUsageSchema =
  new mongoose.Schema(
    {
      serviceableLocation: {
        type:
          mongoose.Schema.Types
            .ObjectId,

        ref:
          "ServiceableLocation",

        required: true,
        index: true,
      },

      pincode: {
        type: String,
        required: true,
        trim: true,
      },

      deliveryDateId: {
        type: String,
        required: true,
        trim: true,
      },

      slot: {
        type:
          mongoose.Schema.Types
            .ObjectId,

        ref: "DeliverySlot",
        required: true,
      },

      slotCode: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
      },

      slotLabel: {
        type: String,
        required: true,
        trim: true,
      },

      capacitySnapshot: {
        type: Number,
        required: true,
        min: 1,
      },

      reservedCount: {
        type: Number,
        default: 0,
        min: 0,
      },

      lastReservationAt: {
        type: Date,
        default: null,
      },

      lastReleaseAt: {
        type: Date,
        default: null,
      },
    },
    {
      timestamps: true,
    }
  );

deliverySlotUsageSchema.index(
  {
    serviceableLocation: 1,
    deliveryDateId: 1,
    slotCode: 1,
  },
  {
    unique: true,
  }
);

deliverySlotUsageSchema.index({
  deliveryDateId: 1,
  slotCode: 1,
});

module.exports =
  mongoose.model(
    "DeliverySlotUsage",
    deliverySlotUsageSchema
  );