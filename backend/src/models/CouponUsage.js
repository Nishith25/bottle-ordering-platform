const mongoose =
  require("mongoose");

const couponUsageSchema =
  new mongoose.Schema(
    {
      coupon: {
        type:
          mongoose.Schema.Types
            .ObjectId,

        ref:
          "Coupon",

        required: true,
        index: true,
      },

      user: {
        type:
          mongoose.Schema.Types
            .ObjectId,

        ref:
          "User",

        required: true,
        index: true,
      },

      context: {
        type: String,

        enum: [
          "order",
          "subscription",
        ],

        required: true,
        index: true,
      },

      status: {
        type: String,

        enum: [
          "reserved",
          "redeemed",
          "released",
        ],

        required: true,
        index: true,
      },

      code: {
        type: String,
        required: true,
        uppercase: true,
        trim: true,
      },

      discountAmount: {
        type: Number,
        required: true,
        min: 0,
      },

      eligibleAmount: {
        type: Number,
        required: true,
        min: 0,
      },

      paymentSession: {
        type:
          mongoose.Schema.Types
            .ObjectId,

        ref:
          "PaymentSession",

        default: null,
      },

      order: {
        type:
          mongoose.Schema.Types
            .ObjectId,

        ref:
          "Order",

        default: null,
      },

      subscription: {
        type:
          mongoose.Schema.Types
            .ObjectId,

        ref:
          "Subscription",

        default: null,
      },

      reservedAt: {
        type: Date,
        default: null,
      },

      redeemedAt: {
        type: Date,
        default: null,
      },

      releasedAt: {
        type: Date,
        default: null,
      },

      expiresAt: {
        type: Date,
        default: null,
        index: true,
      },
    },
    {
      timestamps: true,
    }
  );

couponUsageSchema.index({
  coupon: 1,
  user: 1,
  status: 1,
});

couponUsageSchema.index(
  {
    paymentSession: 1,
  },
  {
    unique: true,
    sparse: true,
  }
);

couponUsageSchema.index(
  {
    order: 1,
  },
  {
    unique: true,
    sparse: true,
  }
);

couponUsageSchema.index(
  {
    subscription: 1,
  },
  {
    unique: true,
    sparse: true,
  }
);

module.exports =
  mongoose.model(
    "CouponUsage",
    couponUsageSchema
  );