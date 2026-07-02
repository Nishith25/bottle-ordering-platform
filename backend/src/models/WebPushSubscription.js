const mongoose = require(
  "mongoose"
);

const webPushSubscriptionSchema =
  new mongoose.Schema(
    {
      user: {
        type:
          mongoose.Schema.Types
            .ObjectId,

        ref: "User",

        required: true,
      },

      endpoint: {
        type: String,

        required: true,

        trim: true,
      },

      expirationTime: {
        type: Date,

        default: null,
      },

      keys: {
        p256dh: {
          type: String,

          required: true,

          trim: true,
        },

        auth: {
          type: String,

          required: true,

          trim: true,
        },
      },

      platform: {
        type: String,

        enum: [
          "ios",
          "android",
          "macos",
          "windows",
          "linux",
          "other",
        ],

        default: "other",
      },

      deviceName: {
        type: String,

        trim: true,

        default: "",
      },

      userAgent: {
        type: String,

        trim: true,

        default: "",
      },

      active: {
        type: Boolean,

        default: true,
      },

      lastSeenAt: {
        type: Date,

        default: Date.now,
      },

      lastSentAt: {
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

        trim: true,

        default: "",
      },

      lastErrorMessage: {
        type: String,

        trim: true,

        default: "",
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

webPushSubscriptionSchema.index(
  {
    endpoint: 1,
  },

  {
    unique: true,
  }
);

webPushSubscriptionSchema.index({
  user: 1,

  active: 1,

  updatedAt: -1,
});

module.exports =
  mongoose.model(
    "WebPushSubscription",

    webPushSubscriptionSchema
  );