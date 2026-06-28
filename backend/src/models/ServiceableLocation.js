// backend/src/models/ServiceableLocation.js

const mongoose = require("mongoose");

const serviceableLocationSchema =
  new mongoose.Schema(
    {
      pincode: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        match: [
          /^\d{6}$/,
          "Pincode must contain exactly six digits.",
        ],
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

      active: {
        type: Boolean,
        default: true,
      },

      deliveryFee: {
        type: Number,
        default: 0,
        min: 0,
      },

      minimumOrder: {
        type: Number,
        default: 0,
        min: 0,
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

serviceableLocationSchema.index({
  active: 1,
  sortOrder: 1,
});

module.exports = mongoose.model(
  "ServiceableLocation",
  serviceableLocationSchema
);