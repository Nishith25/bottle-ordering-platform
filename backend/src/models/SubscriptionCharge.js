const mongoose = require("mongoose");

const subscriptionChargeSchema =
  new mongoose.Schema(
    {
      localSubscription: {
        type:
          mongoose.Schema.Types
            .ObjectId,

        ref: "Subscription",

        required: true,

        index: true,
      },

      mandate: {
        type:
          mongoose.Schema.Types
            .ObjectId,

        ref:
          "RazorpaySubscriptionMandate",

        required: true,

        index: true,
      },

      user: {
        type:
          mongoose.Schema.Types
            .ObjectId,

        ref: "User",

        required: true,

        index: true,
      },

      subscriptionNumber: {
        type: String,

        required: true,

        trim: true,

        index: true,
      },

      planName: {
        type: String,

        required: true,

        trim: true,
      },

      razorpayPaymentId: {
        type: String,

        required: true,

        unique: true,

        trim: true,

        index: true,
      },

      razorpaySubscriptionId: {
        type: String,

        required: true,

        trim: true,

        index: true,
      },

      razorpayInvoiceId: {
        type: String,

        default: "",

        trim: true,

        index: true,
      },

      webhookEventId: {
        type: String,

        default: "",

        trim: true,

        index: true,
      },

      eventType: {
        type: String,

        default:
          "subscription.charged",

        trim: true,
      },

      amountPaise: {
        type: Number,

        required: true,

        min: 0,
      },

      expectedAmountPaise: {
        type: Number,

        required: true,

        min: 0,
      },

      currency: {
        type: String,

        default: "INR",

        uppercase: true,

        trim: true,
      },

      paymentStatus: {
        type: String,

        default: "",

        trim: true,

        index: true,
      },

      paymentMethod: {
        type: String,

        default: "",

        trim: true,
      },

      captured: {
        type: Boolean,

        default: false,
      },

      amountMatches: {
        type: Boolean,

        default: false,
      },

      processingStatus: {
        type: String,

        enum: [
          "received",
          "processing",
          "fulfilled",
          "fulfillment_failed",
          "ignored",
        ],

        default: "received",

        index: true,
      },

      subscriptionCycleKey: {
        type: String,

        default: "",

        trim: true,

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

      orderNumber: {
        type: String,

        default: "",

        trim: true,

        index: true,
      },

      failureCode: {
        type: String,

        default: "",

        trim: true,
      },

      failureReason: {
        type: String,

        default: "",

        trim: true,
      },

      paymentErrorCode: {
        type: String,

        default: "",

        trim: true,
      },

      paymentErrorDescription: {
        type: String,

        default: "",

        trim: true,
      },

      retryCount: {
        type: Number,

        default: 0,

        min: 0,
      },

      lastRetriedAt: {
        type: Date,

        default: null,
      },

      paymentCreatedAt: {
        type: Date,

        default: null,
      },

      processedAt: {
        type: Date,

        default: null,
      },
    },
    {
      timestamps: true,
    }
  );

subscriptionChargeSchema.index({
  localSubscription: 1,
  createdAt: -1,
});

subscriptionChargeSchema.index({
  razorpaySubscriptionId: 1,
  createdAt: -1,
});

subscriptionChargeSchema.index(
  {
    subscriptionCycleKey: 1,
  },
  {
    unique: true,

    sparse: true,

    partialFilterExpression: {
      subscriptionCycleKey: {
        $type: "string",

        $ne: "",
      },
    },
  }
);

module.exports =
  mongoose.models
    .SubscriptionCharge ||
  mongoose.model(
    "SubscriptionCharge",
    subscriptionChargeSchema
  );