// backend/src/models/CustomerFollowUp.js

const mongoose = require("mongoose");

const customerFollowUpSchema =
  new mongoose.Schema(
    {
      customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
      },

      title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120,
      },

      description: {
        type: String,
        trim: true,
        maxlength: 1000,
        default: "",
      },

      dueAt: {
        type: Date,
        required: true,
        index: true,
      },

      status: {
        type: String,
        enum: [
          "pending",
          "done",
          "cancelled",
        ],
        default: "pending",
        index: true,
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
          default: "admin",
        },
      },

      completedAt: {
        type: Date,
        default: null,
      },

      completedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },

      completedBySnapshot: {
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

customerFollowUpSchema.index({
  customer: 1,
  status: 1,
  dueAt: 1,
});

module.exports = mongoose.model(
  "CustomerFollowUp",
  customerFollowUpSchema
);