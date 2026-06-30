const mongoose = require("mongoose");

const pushDeliverySchema =
  new mongoose.Schema(
    {
      pushToken: {
        type:
          mongoose.Schema.Types
            .ObjectId,

        ref: "PushToken",

        default: null,
      },

      tokenSnapshot: {
        type: String,

        required: true,

        trim: true,
      },

      ticketId: {
        type: String,

        default: "",

        trim: true,

        index: true,
      },

      ticketStatus: {
        type: String,

        enum: [
          "pending",
          "ok",
          "error",
        ],

        default: "pending",
      },

      receiptStatus: {
        type: String,

        enum: [
          "pending",
          "ok",
          "error",
          "not_applicable",
        ],

        default: "pending",
      },

      errorCode: {
        type: String,

        default: "",

        trim: true,
      },

      errorMessage: {
        type: String,

        default: "",

        trim: true,
      },

      receiptCheckedAt: {
        type: Date,

        default: null,
      },
    },
    {
      _id: true,
    }
  );

const pushNotificationLogSchema =
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

      title: {
        type: String,

        required: true,

        trim: true,
      },

      body: {
        type: String,

        required: true,

        trim: true,
      },

      data: {
        type:
          mongoose.Schema.Types.Mixed,

        default: {},
      },

      dedupeKey: {
        type: String,

        trim: true,
      },

      status: {
        type: String,

        enum: [
          "queued",
          "no_tokens",
          "sent",
          "partial",
          "failed",
        ],

        default: "queued",

        index: true,
      },

      attemptedTokenCount: {
        type: Number,

        default: 0,

        min: 0,
      },

      acceptedCount: {
        type: Number,

        default: 0,

        min: 0,
      },

      failedCount: {
        type: Number,

        default: 0,

        min: 0,
      },

      deliveries: {
        type: [
          pushDeliverySchema,
        ],

        default: [],
      },

      errorMessage: {
        type: String,

        default: "",

        trim: true,
      },

      processedAt: {
        type: Date,

        default: null,
      },

      expireAt: {
        type: Date,

        default: () =>
          new Date(
            Date.now() +
              90 *
                24 *
                60 *
                60 *
                1000
          ),
      },
    },
    {
      timestamps: true,
    }
  );

pushNotificationLogSchema.index(
  {
    dedupeKey: 1,
  },
  {
    unique: true,

    partialFilterExpression: {
      dedupeKey: {
        $type: "string",
      },
    },
  }
);

pushNotificationLogSchema.index({
  user: 1,
  createdAt: -1,
});

pushNotificationLogSchema.index(
  {
    expireAt: 1,
  },
  {
    expireAfterSeconds: 0,
  }
);

module.exports =
  mongoose.models
    .PushNotificationLog ||
  mongoose.model(
    "PushNotificationLog",
    pushNotificationLogSchema
  );