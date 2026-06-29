const mongoose = require("mongoose");

const razorpayWebhookEventSchema =
  new mongoose.Schema(
    {
      eventId: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true,
      },

      eventType: {
        type: String,
        required: true,
        trim: true,
        index: true,
      },

      razorpaySubscriptionId: {
        type: String,
        default: "",
        trim: true,
        index: true,
      },

      razorpayPaymentId: {
        type: String,
        default: "",
        trim: true,
        index: true,
      },

      payloadDigest: {
        type: String,
        required: true,
        trim: true,
      },

      processingStatus: {
        type: String,
        enum: [
          "processing",
          "processed",
          "ignored",
          "failed",
        ],
        default: "processing",
        index: true,
      },

      attempts: {
        type: Number,
        default: 1,
        min: 1,
      },

      errorMessage: {
        type: String,
        default: "",
        trim: true,
      },

      receivedAt: {
        type: Date,
        default: Date.now,
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

module.exports =
  mongoose.models
    .RazorpayWebhookEvent ||
  mongoose.model(
    "RazorpayWebhookEvent",
    razorpayWebhookEventSchema
  );