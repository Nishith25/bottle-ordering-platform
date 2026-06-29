const mongoose = require("mongoose");

const NOTIFICATION_TYPES = [
  "order_placed",
  "order_confirmed",
  "order_preparing",
  "delivery_assigned",
  "order_picked_up",
  "order_out_for_delivery",
  "order_delivered",
  "order_cancelled",
  "refund_pending",
  "refund_processed",
  "refund_failed",
  "review_submitted",

  "subscription_created",
  "subscription_activated",
  "subscription_paused",
  "subscription_resumed",
  "subscription_cancelled",
  "subscription_expired",
  "subscription_payment_failed",
  "subscription_billing_updated",

  "system",
];

const NOTIFICATION_ACTIONS = [
  "none",
  "orders",
  "delivery_tracking",
  "subscriptions",
];

const notificationSchema =
  new mongoose.Schema(
    {
      user: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: "User",
        required: true,
        index: true,
      },

      type: {
        type: String,
        enum: NOTIFICATION_TYPES,
        default: "system",
        required: true,
      },

      title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120,
      },

      message: {
        type: String,
        required: true,
        trim: true,
        maxlength: 500,
      },

      action: {
        type: String,
        enum: NOTIFICATION_ACTIONS,
        default: "none",
      },

      order: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: "Order",
        default: null,
        index: true,
      },

      subscription: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: "Subscription",
        default: null,
        index: true,
      },

      metadata: {
        type:
          mongoose.Schema.Types.Mixed,

        default: {},
      },

      readAt: {
        type: Date,
        default: null,
        index: true,
      },

      dedupeKey: {
        type: String,
        trim: true,
        default: undefined,
      },
    },
    {
      timestamps: true,
    }
  );

notificationSchema.index({
  user: 1,
  createdAt: -1,
});

notificationSchema.index({
  user: 1,
  readAt: 1,
  createdAt: -1,
});

notificationSchema.index({
  subscription: 1,
  createdAt: -1,
});

notificationSchema.index(
  {
    dedupeKey: 1,
  },
  {
    unique: true,
    sparse: true,
  }
);

module.exports =
  mongoose.model(
    "Notification",
    notificationSchema
  );