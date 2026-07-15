// backend/src/models/AdminActivityLog.js

const mongoose = require("mongoose");

const adminActivityLogSchema =
  new mongoose.Schema(
    {
      actionType: {
        type: String,
        required: true,
        trim: true,
        index: true,
      },

      actionLabel: {
        type: String,
        required: true,
        trim: true,
        maxlength: 160,
      },

      severity: {
        type: String,
        enum: [
          "info",
          "success",
          "warning",
          "danger",
        ],
        default: "info",
        index: true,
      },

      message: {
        type: String,
        trim: true,
        maxlength: 1200,
        default: "",
      },

      actor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
        index: true,
      },

      actorSnapshot: {
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

      entityType: {
        type: String,
        enum: [
          "",
          "order",
          "user",
          "customer",
          "product",
          "inventory",
          "follow_up",
          "notification",
          "subscription",
          "cash_collection",
          "batch",
          "coupon",
          "location",
          "system",
        ],
        default: "",
        index: true,
      },

      entityId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
        index: true,
      },

      entityLabel: {
        type: String,
        trim: true,
        default: "",
        index: true,
      },

      targetUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
        index: true,
      },

      targetUserSnapshot: {
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

        phone: {
          type: String,
          trim: true,
          default: "",
        },

        role: {
          type: String,
          trim: true,
          default: "",
        },
      },

      requestSnapshot: {
        ip: {
          type: String,
          trim: true,
          default: "",
        },

        userAgent: {
          type: String,
          trim: true,
          default: "",
        },

        method: {
          type: String,
          trim: true,
          default: "",
        },

        path: {
          type: String,
          trim: true,
          default: "",
        },
      },

      metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
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

adminActivityLogSchema.index({
  createdAt: -1,
  actionType: 1,
});

adminActivityLogSchema.index({
  entityType: 1,
  entityId: 1,
  createdAt: -1,
});

adminActivityLogSchema.index({
  actor: 1,
  createdAt: -1,
});

module.exports =
  mongoose.models.AdminActivityLog ||
  mongoose.model(
    "AdminActivityLog",
    adminActivityLogSchema
  );