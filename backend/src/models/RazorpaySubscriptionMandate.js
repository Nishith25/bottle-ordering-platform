const mongoose = require("mongoose");

const razorpaySubscriptionMandateSchema =
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

      billingCycle: {
        type: String,
        required: true,
        enum: [
          "weekly",
          "monthly",
        ],
      },

      amountPaise: {
        type: Number,
        required: true,
        min: 100,
      },

      currency: {
        type: String,
        required: true,
        default: "INR",
        uppercase: true,
        trim: true,
      },

      razorpayPlanId: {
        type: String,
        required: true,
        trim: true,
        index: true,
      },

      razorpaySubscriptionId: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true,
      },

      razorpayCustomerId: {
        type: String,
        default: "",
        trim: true,
      },

      shortUrl: {
        type: String,
        default: "",
        trim: true,
      },

      status: {
        type: String,
        enum: [
          "created",
          "authenticated",
          "active",
          "pending",
          "halted",
          "paused",
          "cancelled",
          "completed",
          "expired",
          "unknown",
        ],
        default: "created",
        index: true,
      },

      totalCount: {
        type: Number,
        required: true,
        min: 1,
      },

      paidCount: {
        type: Number,
        default: 0,
        min: 0,
      },

      remainingCount: {
        type: Number,
        default: 0,
        min: 0,
      },

      authAttempts: {
        type: Number,
        default: 0,
        min: 0,
      },

      startAt: {
        type: Date,
        default: null,
      },

      chargeAt: {
        type: Date,
        default: null,
      },

      currentStart: {
        type: Date,
        default: null,
      },

      currentEnd: {
        type: Date,
        default: null,
      },

      endedAt: {
        type: Date,
        default: null,
      },

      checkoutPaymentId: {
        type: String,
        default: "",
        trim: true,
        index: true,
      },

      checkoutSignature: {
        type: String,
        default: "",
        trim: true,
      },

      checkoutSignatureVerifiedAt: {
        type: Date,
        default: null,
      },

      paymentMethod: {
        type: String,
        default: "",
        trim: true,
      },

      lastPaymentId: {
        type: String,
        default: "",
        trim: true,
        index: true,
      },

      lastPaymentStatus: {
        type: String,
        default: "",
        trim: true,
      },

      lastPaymentAmountPaise: {
        type: Number,
        default: 0,
        min: 0,
      },

      lastPaymentAt: {
        type: Date,
        default: null,
      },

      lastPaymentFailureReason: {
        type: String,
        default: "",
        trim: true,
      },

      lastWebhookEventId: {
        type: String,
        default: "",
        trim: true,
      },

      lastWebhookEventType: {
        type: String,
        default: "",
        trim: true,
      },

      lastWebhookAt: {
        type: Date,
        default: null,
      },

      cancelledAt: {
        type: Date,
        default: null,
      },

      cancelAtCycleEnd: {
        type: Boolean,
        default: false,
      },
    },
    {
      timestamps: true,
    }
  );

razorpaySubscriptionMandateSchema.index({
  localSubscription: 1,
  createdAt: -1,
});

module.exports =
  mongoose.models
    .RazorpaySubscriptionMandate ||
  mongoose.model(
    "RazorpaySubscriptionMandate",
    razorpaySubscriptionMandateSchema
  );