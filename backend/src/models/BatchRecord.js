const mongoose = require("mongoose");

const createdBySnapshotSchema =
  new mongoose.Schema(
    {
      fullName: {
        type: String,
        default: "",
        trim: true,
      },

      email: {
        type: String,
        default: "",
        trim: true,
        lowercase: true,
      },

      role: {
        type: String,
        default: "",
        trim: true,
      },
    },
    {
      _id: false,
    }
  );

const batchRecordSchema =
  new mongoose.Schema(
    {
      batchNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        uppercase: true,
      },

      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
        index: true,
      },

      productId: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        index: true,
      },

      productName: {
        type: String,
        required: true,
        trim: true,
      },

      productShortName: {
        type: String,
        required: true,
        trim: true,
      },

      sizeMl: {
        type: Number,
        required: true,
        min: 1,
      },

      productionDateId: {
        type: String,
        required: true,
        trim: true,
        index: true,
      },

      packedOnAt: {
        type: Date,
        required: true,
        index: true,
      },

      useByAt: {
        type: Date,
        required: true,
      },

      shelfLifeDays: {
        type: Number,
        required: true,
        min: 1,
        max: 30,
        default: 3,
      },

      quantityPacked: {
        type: Number,
        required: true,
        min: 1,
      },

      status: {
        type: String,
        enum: [
          "packed",
          "released",
          "discarded",
        ],
        default: "packed",
        index: true,
      },

      notes: {
        type: String,
        default: "",
        trim: true,
      },

      createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
        index: true,
      },

      createdBySnapshot: {
        type: createdBySnapshotSchema,
        default: null,
      },
    },
    {
      timestamps: true,
    }
  );

batchRecordSchema.index({
  productionDateId: 1,
  productId: 1,
  createdAt: -1,
});

batchRecordSchema.index({
  packedOnAt: -1,
});

module.exports = mongoose.model(
  "BatchRecord",
  batchRecordSchema
);