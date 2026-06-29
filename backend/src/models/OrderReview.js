const mongoose = require("mongoose");

const {
  notifyReviewSubmitted,
} = require(
  "../services/notificationService"
);

const personSnapshotSchema =
  new mongoose.Schema(
    {
      fullName: {
        type: String,
        required: true,
        trim: true,
      },

      email: {
        type: String,
        default: "",
        trim: true,
        lowercase: true,
      },

      phone: {
        type: String,
        default: "",
        trim: true,
      },
    },
    {
      _id: false,
    }
  );

const orderReviewSchema =
  new mongoose.Schema(
    {
      order: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: "Order",
        required: true,
        unique: true,
        index: true,
      },

      orderNumber: {
        type: String,
        required: true,
        trim: true,
        uppercase: true,
      },

      user: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: "User",
        required: true,
        index: true,
      },

      customerSnapshot: {
        type:
          personSnapshotSchema,

        required: true,
      },

      deliveryPartner: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: "User",
        required: true,
        index: true,
      },

      deliveryPartnerSnapshot: {
        type:
          personSnapshotSchema,

        required: true,
      },

      orderRating: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
      },

      deliveryRating: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
      },

      comment: {
        type: String,
        default: "",
        trim: true,
        maxlength: 500,
      },

      submittedAt: {
        type: Date,
        default: Date.now,
      },
    },
    {
      timestamps: true,
    }
  );

orderReviewSchema.pre(
  "save",

  function captureNewReview() {
    this.$locals.wasNewReview =
      this.isNew;
  }
);

orderReviewSchema.post(
  "save",

  function processNewReview(
    review
  ) {
    if (
      !review.$locals
        .wasNewReview
    ) {
      return;
    }

    const timer =
      setTimeout(() => {
        void notifyReviewSubmitted(
          review
        );
      }, 25);

    if (
      typeof timer.unref ===
      "function"
    ) {
      timer.unref();
    }

    delete review.$locals
      .wasNewReview;
  }
);

orderReviewSchema.index({
  user: 1,
  createdAt: -1,
});

orderReviewSchema.index({
  deliveryPartner: 1,
  createdAt: -1,
});

orderReviewSchema.index({
  deliveryRating: 1,
  createdAt: -1,
});

module.exports =
  mongoose.model(
    "OrderReview",
    orderReviewSchema
  );