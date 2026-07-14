const mongoose = require("mongoose");

const businessExpenseSchema = new mongoose.Schema(
  {
    expenseDateId: {
      type: String,
      required: true,
      trim: true,
      index: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    category: {
      type: String,
      enum: [
        "fruit",
        "juice",
        "bottle",
        "printing",
        "packaging",
        "delivery",
        "marketing",
        "labour",
        "rent",
        "utilities",
        "wastage",
        "other",
      ],
      default: "other",
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    vendorName: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },

    notes: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    createdBySnapshot: {
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

businessExpenseSchema.index({
  expenseDateId: 1,
  category: 1,
});

businessExpenseSchema.index({
  createdAt: -1,
});

module.exports = mongoose.model(
  "BusinessExpense",
  businessExpenseSchema
);