const mongoose = require("mongoose");

const pushTokenSchema =
  new mongoose.Schema(
    {
      user: {
        type:
          mongoose.Schema.Types
            .ObjectId,

        ref: "User",

        required: true,

        index: true,
      },

      token: {
        type: String,

        required: true,

        unique: true,

        trim: true,

        index: true,
      },

      platform: {
        type: String,

        enum: [
          "ios",
          "android",
          "unknown",
        ],

        default: "unknown",

        index: true,
      },

      deviceId: {
        type: String,

        default: "",

        trim: true,
      },

      deviceName: {
        type: String,

        default: "",

        trim: true,
      },

      appVersion: {
        type: String,

        default: "",

        trim: true,
      },

      projectId: {
        type: String,

        default: "",

        trim: true,
      },

      active: {
        type: Boolean,

        default: true,

        index: true,
      },

      lastSeenAt: {
        type: Date,

        default: Date.now,
      },

      lastSentAt: {
        type: Date,

        default: null,
      },

      lastReceiptAt: {
        type: Date,

        default: null,
      },

      lastSuccessfulAt: {
        type: Date,

        default: null,
      },

      failureCount: {
        type: Number,

        default: 0,

        min: 0,
      },

      lastErrorCode: {
        type: String,

        default: "",

        trim: true,
      },

      lastErrorMessage: {
        type: String,

        default: "",

        trim: true,
      },

      disabledAt: {
        type: Date,

        default: null,
      },
    },
    {
      timestamps: true,
    }
  );

pushTokenSchema.index({
  user: 1,
  active: 1,
  updatedAt: -1,
});

pushTokenSchema.index({
  user: 1,
  deviceId: 1,
});

module.exports =
  mongoose.models.PushToken ||
  mongoose.model(
    "PushToken",
    pushTokenSchema
  );