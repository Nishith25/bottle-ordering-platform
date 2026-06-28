// backend/src/models/SubscriptionPlan.js

const mongoose = require("mongoose");

const subscriptionPlanSchema =
  new mongoose.Schema(
    {
      planId: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
      },

      name: {
        type: String,
        required: true,
        trim: true,
      },

      description: {
        type: String,
        required: true,
        trim: true,
      },

      billingCycle: {
        type: String,
        enum: ["weekly", "monthly"],
        required: true,
      },

      bottleCount: {
        type: Number,
        required: true,
        min: 1,
      },

      deliveriesPerCycle: {
        type: Number,
        required: true,
        min: 1,
      },

      discountPercent: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
      },

      badge: {
        type: String,
        default: "",
        trim: true,
      },

      features: {
        type: [String],
        default: [],
      },

      active: {
        type: Boolean,
        default: true,
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

subscriptionPlanSchema.index({
  active: 1,
  sortOrder: 1,
});

module.exports = mongoose.model(
  "SubscriptionPlan",
  subscriptionPlanSchema
);