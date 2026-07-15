// backend/src/models/AdminNotification.js

const mongoose = require("mongoose");

const adminNotificationSchema =
  new mongoose.Schema(
    {
      type: {
        type: String,
        enum: [
          "stock",
          "follow_up",
          "refund",
          "cod_payment",
          "order",
          "payment",
          "system",
        ],
        required: true,
        index: true,
      },

      severity: {
        type: String,
        enum: [
          "info",
          "warning",
          "danger",
          "success",
        ],
        default: "info",
        index: true,
      },

      title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 140,
      },

      message: {
        type: String,
        required: true,
        trim: true,
        maxlength: 1000,
      },

      actionUrl: {
        type: String,
        trim: true,
        default: "",
      },

      sourceType: {
        type: String,
        enum: [
          "",
          "product",
          "order",
          "follow_up",
          "subscription",
          "system",
        ],
        default: "",
        index: true,
      },

      sourceId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
        index: true,
      },

      sourceLabel: {
        type: String,
        trim: true,
        default: "",
      },

      automationKey: {
        type: String,
        trim: true,
        sparse: true,
        unique: true,
      },

      metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },

      readAt: {
        type: Date,
        default: null,
        index: true,
      },

      readBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },

      readBySnapshot: {
        fullName: {
          type: String,
          trim: true,
          default: "",
        },

        email: {
          type: String,
          trim: true,
          lowercase: true,
          default: "",
        },

        role: {
          type: String,
          trim: true,
          default: "",
        },
      },

      active: {
        type: Boolean,
        default: true,
        index: true,
      },
    },
    {
      timestamps: true,
    }
  );

adminNotificationSchema.index({
  active: 1,
  readAt: 1,
  createdAt: -1,
});

adminNotificationSchema.index({
  type: 1,
  severity: 1,
  createdAt: -1,
});

module.exports =
  mongoose.models.AdminNotification ||
  mongoose.model(
    "AdminNotification",
    adminNotificationSchema
  );