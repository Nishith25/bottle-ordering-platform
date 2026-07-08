const mongoose = require("mongoose");

const deliverySlotReservationSchema =
  new mongoose.Schema(
    {
      reservationToken: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true,
      },

      user: {
        type:
          mongoose.Schema.Types
            .ObjectId,

        ref: "User",
        default: null,
        index: true,
      },

      order: {
        type:
          mongoose.Schema.Types
            .ObjectId,

        ref: "Order",
        default: null,
        index: true,
      },

      source: {
        type: String,

        enum: [
          "checkout",
          "order",
          "subscription",
          "system",
        ],

        default: "system",
      },

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

      startMinutes: {
        type: Number,
        required: true,
      },

      endMinutes: {
        type: Number,
        required: true,
      },

      cutoffMinutes: {
        type: Number,
        required: true,
      },

      capacitySnapshot: {
        type: Number,
        required: true,
        min: 1,
      },

      status: {
        type: String,

        enum: [
          "reserved",
          "consumed",
          "releasing",
          "released",
        ],

        default: "reserved",
        index: true,
      },

      reservedAt: {
        type: Date,
        default:
          Date.now,
      },

      consumedAt: {
        type: Date,
        default: null,
      },

      releasedAt: {
        type: Date,
        default: null,
      },

      releaseReason: {
        type: String,
        default: "",
        trim: true,
      },
    },
    {
      timestamps: true,
    }
  );

deliverySlotReservationSchema.index({
  serviceableLocation: 1,
  deliveryDateId: 1,
  slotCode: 1,
  status: 1,
});

deliverySlotReservationSchema.index(
  {
    order: 1,
  },
  {
    sparse: true,
  }
);

module.exports =
  mongoose.model(
    "DeliverySlotReservation",
    deliverySlotReservationSchema
  );