const mongoose = require("mongoose");

const paymentSessionSchema = new mongoose.Schema(
  {
    sessionTokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: [
        "gateway_creating",
        "created",
        "abandoned",
        "paid",
        "failed",
        "expired",
      ],
      default: "gateway_creating",
      index: true,
    },
    returnUrl: { type: String, required: true, trim: true },
    prefill: {
      name: { type: String, default: "", trim: true },
      email: { type: String, default: "", trim: true },
      contact: { type: String, default: "", trim: true },
    },
    razorpayOrderId: { type: String, default: "", trim: true, index: true },
    razorpayPaymentId: { type: String, default: "", trim: true },
    amountPaise: { type: Number, required: true, min: 1 },
    currency: { type: String, default: "INR", uppercase: true, trim: true },
    orderDraft: { type: mongoose.Schema.Types.Mixed, required: true },
    couponUsage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CouponUsage",
      default: null,
    },
    inventoryReserved: { type: Boolean, default: true },
    inventoryRestored: { type: Boolean, default: false },
    inventoryRestoredAt: { type: Date, default: null },
    createdOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    abandonedAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    failureReason: { type: String, default: "", trim: true },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

paymentSessionSchema.index({ status: 1, expiresAt: 1 });

module.exports = mongoose.model("PaymentSession", paymentSessionSchema);
