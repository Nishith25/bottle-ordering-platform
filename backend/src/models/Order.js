const mongoose = require("mongoose");

const orderItemSchema =
  new mongoose.Schema(
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
      },

      productId: {
        type: String,
        required: true,
        trim: true,
      },

      name: {
        type: String,
        required: true,
        trim: true,
      },

      shortName: {
        type: String,
        required: true,
        trim: true,
      },

      sizeMl: {
        type: Number,
        required: true,
        min: 1,
      },

      price: {
        type: Number,
        required: true,
        min: 0,
      },

      quantity: {
        type: Number,
        required: true,
        min: 1,
        max: 50,
      },

      lineTotal: {
        type: Number,
        required: true,
        min: 0,
      },
    },
    {
      _id: false,
    }
  );

const deliveryAddressSchema =
  new mongoose.Schema(
    {
      fullName: {
        type: String,
        required: true,
        trim: true,
      },

      phone: {
        type: String,
        required: true,
        trim: true,
      },

      pincode: {
        type: String,
        required: true,
        trim: true,
      },

      houseDetails: {
        type: String,
        required: true,
        trim: true,
      },

      areaDetails: {
        type: String,
        required: true,
        trim: true,
      },

      landmark: {
        type: String,
        default: "",
        trim: true,
      },

      area: {
        type: String,
        required: true,
        trim: true,
      },

      city: {
        type: String,
        required: true,
        trim: true,
      },
    },
    {
      _id: false,
    }
  );

const deliveryScheduleSchema =
  new mongoose.Schema(
    {
      deliveryDateId: {
        type: String,
        required: true,
        trim: true,
      },

      deliveryDateLabel: {
        type: String,
        required: true,
        trim: true,
      },

      deliverySlot: {
        type: String,
        required: true,
        trim: true,
      },
    },
    {
      _id: false,
    }
  );

const orderSchema =
  new mongoose.Schema(
    {
      orderNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        uppercase: true,
      },

      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
      },

      items: {
        type: [orderItemSchema],
        required: true,

        validate: {
          validator(items) {
            return (
              Array.isArray(items) &&
              items.length > 0
            );
          },

          message:
            "An order must contain at least one bottle.",
        },
      },

      deliveryAddress: {
        type: deliveryAddressSchema,
        required: true,
      },

      deliverySchedule: {
        type: deliveryScheduleSchema,
        required: true,
      },

      subtotal: {
        type: Number,
        required: true,
        min: 0,
      },

      deliveryFee: {
        type: Number,
        required: true,
        min: 0,
      },

      total: {
        type: Number,
        required: true,
        min: 0,
      },

      paymentMethod: {
        type: String,
        enum: ["cod", "online"],
        required: true,
      },

      paymentGateway: {
        type: String,
        enum: ["", "razorpay"],
        default: "",
      },

      paymentGatewayOrderId: {
        type: String,
        default: "",
        trim: true,
      },

      paymentStatus: {
        type: String,

        enum: [
          "pending",
          "paid",
          "failed",
          "refunded",
        ],

        default: "pending",
      },

      paymentReference: {
        type: String,
        default: "",
        trim: true,
      },

      paidAt: {
        type: Date,
        default: null,
      },

      orderStatus: {
        type: String,

        enum: [
          "placed",
          "confirmed",
          "preparing",
          "out_for_delivery",
          "delivered",
          "cancelled",
        ],

        default: "placed",
      },

      cancellationReason: {
        type: String,
        default: "",
        trim: true,
      },

      cancelledAt: {
        type: Date,
        default: null,
      },

      deliveredAt: {
        type: Date,
        default: null,
      },

      refundStatus: {
        type: String,
        enum: [
          "not_required",
          "pending",
          "processed",
          "failed",
        ],
        default: "not_required",
      },

      refundId: {
        type: String,
        default: "",
        trim: true,
      },

      refundAmount: {
        type: Number,
        default: 0,
        min: 0,
      },

      refundAmountPaise: {
        type: Number,
        default: 0,
        min: 0,
      },

      refundSpeedRequested: {
        type: String,
        enum: ["", "normal", "optimum"],
        default: "",
      },

      refundInitiatedBy: {
        type: String,
        enum: [
          "",
          "customer",
          "admin",
          "system",
        ],
        default: "",
      },

      refundIdempotencyKey: {
        type: String,
        default: "",
        trim: true,
      },

      refundRequestedAt: {
        type: Date,
        default: null,
      },

      refundProcessedAt: {
        type: Date,
        default: null,
      },

      refundFailedAt: {
        type: Date,
        default: null,
      },

      refundFailureReason: {
        type: String,
        default: "",
        trim: true,
      },

      refundAttemptCount: {
        type: Number,
        default: 0,
        min: 0,
      },

      refundRequestLockedAt: {
        type: Date,
        default: null,
      },

      inventoryReserved: {
        type: Boolean,
        default: false,
      },

      inventoryRestored: {
        type: Boolean,
        default: false,
      },

      inventoryRestoredAt: {
        type: Date,
        default: null,
      },
    },
    {
      timestamps: true,
    }
  );

orderSchema.index({
  user: 1,
  createdAt: -1,
});

orderSchema.index({
  orderStatus: 1,
  createdAt: -1,
});

orderSchema.index({
  paymentGatewayOrderId: 1,
});

orderSchema.index({
  refundId: 1,
});

orderSchema.index({
  refundStatus: 1,
  updatedAt: -1,
});

module.exports = mongoose.model(
  "Order",
  orderSchema
);
