const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },

    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 180,
    },

    discountType: {
      type: String,
      enum: ["fixed", "percentage"],
      required: true,
    },

    discountValue: {
      type: Number,
      required: true,
      min: 1,
    },

    maxDiscountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    minimumOrder: {
      type: Number,
      default: 0,
      min: 0,
    },

    appliesTo: {
      type: String,
      enum: ["order", "subscription", "both"],
      default: "order",
      index: true,
    },

    usageLimit: {
      type: Number,
      default: 0,
      min: 0,
    },

    perUserLimit: {
      type: Number,
      default: 1,
      min: 0,
    },

    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    reservedCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    startsAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    endsAt: {
      type: Date,
      default: null,
      index: true,
    },

    active: {
      type: Boolean,
      default: true,
      index: true,
    },

    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

couponSchema.index({
  active: 1,
  appliesTo: 1,
  startsAt: 1,
  endsAt: 1,
});

module.exports = mongoose.model("Coupon", couponSchema);
