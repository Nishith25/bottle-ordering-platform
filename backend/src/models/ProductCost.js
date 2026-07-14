const mongoose = require("mongoose");

const productCostSchema = new mongoose.Schema(
  {
    productId: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    productName: {
      type: String,
      required: true,
      trim: true,
    },

    bottleCost: {
      type: Number,
      min: 0,
      default: 20,
    },

    printingCost: {
      type: Number,
      min: 0,
      default: 10,
    },

    fruitCost: {
      type: Number,
      min: 0,
      default: 0,
    },

    juiceCost: {
      type: Number,
      min: 0,
      default: 0,
    },

    packagingCost: {
      type: Number,
      min: 0,
      default: 0,
    },

    deliveryCost: {
      type: Number,
      min: 0,
      default: 0,
    },

    otherCost: {
      type: Number,
      min: 0,
      default: 0,
    },

    wastagePercent: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    updatedBySnapshot: {
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
  },
  {
    timestamps: true,
  }
);

productCostSchema.virtual("baseCost").get(function () {
  return (
    Number(this.bottleCost || 0) +
    Number(this.printingCost || 0) +
    Number(this.fruitCost || 0) +
    Number(this.juiceCost || 0) +
    Number(this.packagingCost || 0) +
    Number(this.deliveryCost || 0) +
    Number(this.otherCost || 0)
  );
});

productCostSchema.virtual("totalCost").get(function () {
  const baseCost =
    Number(this.baseCost || 0);

  const wastageMultiplier =
    1 +
    Number(this.wastagePercent || 0) /
      100;

  return Math.round(
    baseCost * wastageMultiplier
  );
});

productCostSchema.set(
  "toJSON",
  {
    virtuals: true,
  }
);

productCostSchema.set(
  "toObject",
  {
    virtuals: true,
  }
);

module.exports = mongoose.model(
  "ProductCost",
  productCostSchema
);