const mongoose = require("mongoose");

const razorpayPlanMappingSchema =
  new mongoose.Schema(
    {
      mappingKey: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true,
      },

      razorpayPlanId: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true,
      },

      billingCycle: {
        type: String,
        required: true,
        enum: [
          "weekly",
          "monthly",
        ],
      },

      period: {
        type: String,
        required: true,
        enum: [
          "weekly",
          "monthly",
        ],
      },

      interval: {
        type: Number,
        required: true,
        default: 1,
        min: 1,
      },

      amountPaise: {
        type: Number,
        required: true,
        min: 100,
      },

      currency: {
        type: String,
        required: true,
        default: "INR",
        uppercase: true,
        trim: true,
      },

      itemName: {
        type: String,
        required: true,
        trim: true,
      },

      active: {
        type: Boolean,
        default: true,
        index: true,
      },
    },
    {
      timestamps: true,
    }
  );

module.exports =
  mongoose.models
    .RazorpayPlanMapping ||
  mongoose.model(
    "RazorpayPlanMapping",
    razorpayPlanMappingSchema
  );