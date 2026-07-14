const mongoose = require("mongoose");

const cashCollectionSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      unique: true,
      index: true,
    },

    orderNumber: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    amountDue: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    amountCollected: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    status: {
      type: String,
      enum: [
        "pending",
        "short_collected",
        "collected",
        "handed_over",
      ],
      default: "pending",
      index: true,
    },

    collectedAt: {
      type: Date,
      default: null,
    },

    collectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    collectedBySnapshot: {
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

    handedOverAt: {
      type: Date,
      default: null,
    },

    handedOverBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    handedOverBySnapshot: {
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

    notes: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
  }
);

cashCollectionSchema.index({
  createdAt: -1,
});

cashCollectionSchema.index({
  status: 1,
  createdAt: -1,
});

module.exports = mongoose.model(
  "CashCollection",
  cashCollectionSchema
);