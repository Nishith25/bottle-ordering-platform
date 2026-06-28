// backend/src/models/Subscription.js

const mongoose = require("mongoose");

const subscriptionItemSchema =
  new mongoose.Schema(
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
      },

      productId: {
        type: String,
        required: true,
        trim: true,
      },

      name: {
        type: String,
        required: true,
        trim: true,
      },

      shortName: {
        type: String,
        required: true,
        trim: true,
      },

      sizeMl: {
        type: Number,
        required: true,
        min: 1,
      },

      price: {
        type: Number,
        required: true,
        min: 0,
      },

      quantity: {
        type: Number,
        required: true,
        min: 1,
        max: 100,
      },

      lineTotal: {
        type: Number,
        required: true,
        min: 0,
      },
    },
    {
      _id: false,
    }
  );

const subscriptionAddressSchema =
  new mongoose.Schema(
    {
      fullName: {
        type: String,
        required: true,
        trim: true,
      },

      phone: {
        type: String,
        required: true,
        trim: true,
      },

      pincode: {
        type: String,
        required: true,
        trim: true,
      },

      houseDetails: {
        type: String,
        required: true,
        trim: true,
      },

      areaDetails: {
        type: String,
        required: true,
        trim: true,
      },

      landmark: {
        type: String,
        default: "",
        trim: true,
      },

      area: {
        type: String,
        required: true,
        trim: true,
      },

      city: {
        type: String,
        required: true,
        trim: true,
      },
    },
    {
      _id: false,
    }
  );

const subscriptionSchema =
  new mongoose.Schema(
    {
      subscriptionNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        uppercase: true,
      },

      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
      },

      plan: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SubscriptionPlan",
        required: true,
      },

      planId: {
        type: String,
        required: true,
        trim: true,
      },

      planName: {
        type: String,
        required: true,
        trim: true,
      },

      billingCycle: {
        type: String,
        enum: ["weekly", "monthly"],
        required: true,
      },

      bottleCount: {
        type: Number,
        required: true,
        min: 1,
      },

      deliveriesPerCycle: {
        type: Number,
        required: true,
        min: 1,
      },

      items: {
        type: [subscriptionItemSchema],
        required: true,

        validate: {
          validator(items) {
            return (
              Array.isArray(items) &&
              items.length > 0
            );
          },

          message:
            "A subscription must contain at least one bottle.",
        },
      },

      preferredDay: {
        type: String,
        required: true,
        trim: true,
      },

      preferredSlot: {
        type: String,
        required: true,
        trim: true,
      },

      deliveryAddress: {
        type: subscriptionAddressSchema,
        required: true,
      },

      originalTotal: {
        type: Number,
        required: true,
        min: 0,
      },

      discountPercent: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
      },

      savings: {
        type: Number,
        required: true,
        min: 0,
      },

      totalPerCycle: {
        type: Number,
        required: true,
        min: 0,
      },

      paymentMethod: {
        type: String,
        enum: [
          "upi_autopay",
          "card_mandate",
        ],
        required: true,
      },

      paymentStatus: {
        type: String,
        enum: [
          "demo_confirmed",
          "mandate_pending",
          "active",
          "failed",
          "cancelled",
        ],
        default: "demo_confirmed",
      },

      paymentReference: {
        type: String,
        default: "",
        trim: true,
      },

      status: {
        type: String,
        enum: [
          "active",
          "paused",
          "cancelled",
          "expired",
        ],
        default: "active",
      },

      startDate: {
        type: Date,
        default: Date.now,
      },

      nextBillingAt: {
        type: Date,
        required: true,
      },

      cancelledAt: {
        type: Date,
        default: null,
      },

      cancellationReason: {
        type: String,
        default: "",
        trim: true,
      },
    },
    {
      timestamps: true,
    }
  );

subscriptionSchema.index({
  user: 1,
  createdAt: -1,
});

subscriptionSchema.index({
  user: 1,
  status: 1,
});

module.exports = mongoose.model(
  "Subscription",
  subscriptionSchema
);