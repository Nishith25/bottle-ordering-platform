// backend/src/models/Product.js

const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    productId: {
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

    shortName: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    ingredients: {
      type: [String],
      default: [],
    },

    sizeMl: {
      type: Number,
      required: true,
      min: 1,
      default: 300,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    category: {
      type: String,
      required: true,
      enum: ["Hydrating", "Fruity"],
    },

    imageUrl: {
      type: String,
      default: "",
      trim: true,
    },

    liquidColor: {
      type: String,
      required: true,
    },

    cardColor: {
      type: String,
      required: true,
    },

    accentColor: {
      type: String,
      required: true,
    },

    subscriptionEligible: {
      type: Boolean,
      default: true,
    },

    available: {
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

productSchema.index({
  available: 1,
  sortOrder: 1,
});

module.exports = mongoose.model(
  "Product",
  productSchema
);