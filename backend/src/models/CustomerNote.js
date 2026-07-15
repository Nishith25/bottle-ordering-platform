// backend/src/models/CustomerNote.js

const mongoose = require("mongoose");

const customerNoteSchema =
  new mongoose.Schema(
    {
      customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
      },

      note: {
        type: String,
        required: true,
        trim: true,
        maxlength: 1500,
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

customerNoteSchema.index({
  customer: 1,
  createdAt: -1,
});

module.exports = mongoose.model(
  "CustomerNote",
  customerNoteSchema
);