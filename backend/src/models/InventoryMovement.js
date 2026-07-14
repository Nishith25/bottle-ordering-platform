const mongoose = require("mongoose");

const actorSnapshotSchema =
  new mongoose.Schema(
    {
      fullName: {
        type: String,
        default: "",
        trim: true,
      },

      email: {
        type: String,
        default: "",
        trim: true,
        lowercase: true,
      },

      role: {
        type: String,
        default: "",
        trim: true,
      },
    },
    {
      _id: false,
    }
  );

const inventoryMovementSchema =
  new mongoose.Schema(
    {
      product: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: "Product",
        required: true,
        index: true,
      },

      productId: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        index: true,
      },

      productName: {
        type: String,
        required: true,
        trim: true,
      },

      movementType: {
        type: String,

        enum: [
          "reserve",
          "restore",
          "manual_adjustment",
          "manual_set",
          "threshold_update",
        ],

        required: true,
        index: true,
      },

      direction: {
        type: String,

        enum: [
          "in",
          "out",
          "neutral",
        ],

        required: true,
      },

      quantityChange: {
        type: Number,
        required: true,
      },

      stockBefore: {
        type: Number,
        required: true,
        min: 0,
      },

      stockAfter: {
        type: Number,
        required: true,
        min: 0,
      },

      lowStockThresholdBefore: {
        type: Number,
        default: null,
      },

      lowStockThresholdAfter: {
        type: Number,
        default: null,
      },

      source: {
        type: String,
        default: "",
        trim: true,
      },

      sourceType: {
        type: String,

        enum: [
          "",
          "admin",
          "order",
          "payment_session",
          "system",
        ],

        default: "",
        index: true,
      },

      order: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: "Order",
        default: null,
        index: true,
      },

      orderNumber: {
        type: String,
        default: "",
        trim: true,
        uppercase: true,
      },

      paymentSession: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: "PaymentSession",
        default: null,
        index: true,
      },

      actor: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: "User",
        default: null,
        index: true,
      },

      actorSnapshot: {
        type: actorSnapshotSchema,
        default: null,
      },

      reason: {
        type: String,
        default: "",
        trim: true,
      },

      metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
    },
    {
      timestamps: true,
    }
  );

inventoryMovementSchema.index({
  createdAt: -1,
});

inventoryMovementSchema.index({
  productId: 1,
  createdAt: -1,
});

inventoryMovementSchema.index({
  movementType: 1,
  createdAt: -1,
});

module.exports =
  mongoose.model(
    "InventoryMovement",
    inventoryMovementSchema
  );