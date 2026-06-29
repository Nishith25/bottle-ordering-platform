const mongoose = require("mongoose");

const {
  processOrderNotificationChanges,
} = require(
  "../services/notificationService"
);

const orderItemSchema =
  new mongoose.Schema(
    {
      product: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: "Product",
        required: true,
      },

      productId: {
        type: String,
        required: true,
        trim: true,
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

      sizeMl: {
        type: Number,
        required: true,
        min: 1,
      },

      price: {
        type: Number,
        required: true,
        min: 0,
      },

      quantity: {
        type: Number,
        required: true,
        min: 1,
        max: 50,
      },

      lineTotal: {
        type: Number,
        required: true,
        min: 0,
      },
    },
    {
      _id: false,
    }
  );

const deliveryAddressSchema =
  new mongoose.Schema(
    {
      fullName: {
        type: String,
        required: true,
        trim: true,
      },

      phone: {
        type: String,
        required: true,
        trim: true,
      },

      pincode: {
        type: String,
        required: true,
        trim: true,
      },

      houseDetails: {
        type: String,
        required: true,
        trim: true,
      },

      areaDetails: {
        type: String,
        required: true,
        trim: true,
      },

      landmark: {
        type: String,
        default: "",
        trim: true,
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
    },
    {
      _id: false,
    }
  );

const deliveryScheduleSchema =
  new mongoose.Schema(
    {
      deliveryDateId: {
        type: String,
        required: true,
        trim: true,
      },

      deliveryDateLabel: {
        type: String,
        required: true,
        trim: true,
      },

      deliverySlot: {
        type: String,
        required: true,
        trim: true,
      },
    },
    {
      _id: false,
    }
  );

const couponSnapshotSchema =
  new mongoose.Schema(
    {
      couponId: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: "Coupon",
        default: null,
      },

      code: {
        type: String,
        default: "",
        uppercase: true,
        trim: true,
      },

      description: {
        type: String,
        default: "",
        trim: true,
      },

      discountType: {
        type: String,

        enum: [
          "",
          "fixed",
          "percentage",
        ],

        default: "",
      },

      discountValue: {
        type: Number,
        default: 0,
        min: 0,
      },

      maxDiscountAmount: {
        type: Number,
        default: 0,
        min: 0,
      },

      minimumOrder: {
        type: Number,
        default: 0,
        min: 0,
      },

      appliesTo: {
        type: String,

        enum: [
          "",
          "order",
          "subscription",
          "both",
        ],

        default: "",
      },

      eligibleAmount: {
        type: Number,
        default: 0,
        min: 0,
      },

      discountAmount: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    {
      _id: false,
    }
  );

const deliveryPartnerSnapshotSchema =
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

const orderSchema =
  new mongoose.Schema(
    {
      orderNumber: {
        type: String,
        required: true,
        unique: true,
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

      items: {
        type:
          [orderItemSchema],

        required: true,

        validate: {
          validator(items) {
            return (
              Array.isArray(items) &&
              items.length > 0
            );
          },

          message:
            "An order must contain at least one bottle.",
        },
      },

      deliveryAddress: {
        type:
          deliveryAddressSchema,

        required: true,
      },

      deliverySchedule: {
        type:
          deliveryScheduleSchema,

        required: true,
      },

      subtotal: {
        type: Number,
        required: true,
        min: 0,
      },

      deliveryFee: {
        type: Number,
        required: true,
        min: 0,
      },

      amountBeforeDiscount: {
        type: Number,
        default: 0,
        min: 0,
      },

      couponDiscount: {
        type: Number,
        default: 0,
        min: 0,
      },

      coupon: {
        type:
          couponSnapshotSchema,

        default: null,
      },

      couponUsage: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: "CouponUsage",
        default: null,
      },

      total: {
        type: Number,
        required: true,
        min: 0,
      },

      paymentMethod: {
        type: String,

        enum: [
          "cod",
          "online",
        ],

        required: true,
      },

      paymentGateway: {
        type: String,

        enum: [
          "",
          "razorpay",
        ],

        default: "",
      },

      paymentGatewayOrderId: {
        type: String,
        default: "",
        trim: true,
      },

      paymentStatus: {
        type: String,

        enum: [
          "pending",
          "paid",
          "failed",
          "refunded",
        ],

        default: "pending",
      },

      paymentReference: {
        type: String,
        default: "",
        trim: true,
      },

      paidAt: {
        type: Date,
        default: null,
      },

      orderStatus: {
        type: String,

        enum: [
          "placed",
          "confirmed",
          "preparing",
          "out_for_delivery",
          "delivered",
          "cancelled",
        ],

        default: "placed",
      },

      cancellationReason: {
        type: String,
        default: "",
        trim: true,
      },

      cancelledAt: {
        type: Date,
        default: null,
      },

      deliveredAt: {
        type: Date,
        default: null,
      },

      deliveryPartner: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: "User",
        default: null,
        index: true,
      },

      deliveryPartnerSnapshot: {
        type:
          deliveryPartnerSnapshotSchema,

        default: null,
      },

      deliveryStatus: {
        type: String,

        enum: [
          "unassigned",
          "assigned",
          "picked_up",
          "out_for_delivery",
          "delivered",
          "cancelled",
        ],

        default: "unassigned",
        index: true,
      },

      deliveryAssignedAt: {
        type: Date,
        default: null,
      },

      pickedUpAt: {
        type: Date,
        default: null,
      },

      outForDeliveryAt: {
        type: Date,
        default: null,
      },

      deliveryCompletedAt: {
        type: Date,
        default: null,
      },

      deliveryOtpSalt: {
        type: String,
        default: "",
        trim: true,
        select: false,
      },

      deliveryOtpHash: {
        type: String,
        default: "",
        trim: true,
        select: false,
      },

      deliveryOtpGeneratedAt: {
        type: Date,
        default: null,
      },

      deliveryOtpVerifiedAt: {
        type: Date,
        default: null,
      },

      deliveryOtpAttempts: {
        type: Number,
        default: 0,
        min: 0,
      },

      deliveryOtpLockedUntil: {
        type: Date,
        default: null,
      },

      refundStatus: {
        type: String,

        enum: [
          "not_required",
          "pending",
          "processed",
          "failed",
        ],

        default: "not_required",
      },

      refundId: {
        type: String,
        default: "",
        trim: true,
      },

      refundAmount: {
        type: Number,
        default: 0,
        min: 0,
      },

      refundAmountPaise: {
        type: Number,
        default: 0,
        min: 0,
      },

      refundSpeedRequested: {
        type: String,

        enum: [
          "",
          "normal",
          "optimum",
        ],

        default: "",
      },

      refundInitiatedBy: {
        type: String,

        enum: [
          "",
          "customer",
          "admin",
          "system",
        ],

        default: "",
      },

      refundIdempotencyKey: {
        type: String,
        default: "",
        trim: true,
      },

      refundRequestedAt: {
        type: Date,
        default: null,
      },

      refundProcessedAt: {
        type: Date,
        default: null,
      },

      refundFailedAt: {
        type: Date,
        default: null,
      },

      refundFailureReason: {
        type: String,
        default: "",
        trim: true,
      },

      refundAttemptCount: {
        type: Number,
        default: 0,
        min: 0,
      },

      refundRequestLockedAt: {
        type: Date,
        default: null,
      },

      inventoryReserved: {
        type: Boolean,
        default: false,
      },

      inventoryRestored: {
        type: Boolean,
        default: false,
      },

      inventoryRestoredAt: {
        type: Date,
        default: null,
      },
    },
    {
      timestamps: true,
    }
  );

orderSchema.pre(
  "validate",

  function ensureLegacyTotals() {
    if (
      !Number.isFinite(
        this.amountBeforeDiscount
      ) ||
      this.amountBeforeDiscount <= 0
    ) {
      this.amountBeforeDiscount =
        Number(
          this.subtotal || 0
        ) +
        Number(
          this.deliveryFee || 0
        );
    }

    if (
      !Number.isFinite(
        this.couponDiscount
      ) ||
      this.couponDiscount < 0
    ) {
      this.couponDiscount = 0;
    }

    if (
      this.orderStatus ===
      "cancelled"
    ) {
      this.deliveryStatus =
        "cancelled";
    }

    if (
      this.orderStatus ===
      "delivered"
    ) {
      this.deliveryStatus =
        "delivered";
    }
  }
);

const NOTIFICATION_FIELDS = [
  "orderStatus",
  "deliveryStatus",
  "deliveryPartner",
  "deliveryPartnerSnapshot",
  "refundStatus",
  "refundAttemptCount",
  "paymentStatus",
];

function referenceValue(value) {
  if (!value) {
    return "";
  }

  if (value._id) {
    return String(value._id);
  }

  return String(value);
}

function hasNotificationDifference(
  current,
  previous
) {
  if (!current) {
    return false;
  }

  if (!previous) {
    return true;
  }

  return (
    current.orderStatus !==
      previous.orderStatus ||
    current.deliveryStatus !==
      previous.deliveryStatus ||
    referenceValue(
      current.deliveryPartner
    ) !==
      referenceValue(
        previous.deliveryPartner
      ) ||
    current.refundStatus !==
      previous.refundStatus ||
    Number(
      current.refundAttemptCount ||
        0
    ) !==
      Number(
        previous.refundAttemptCount ||
          0
      ) ||
    current.paymentStatus !==
      previous.paymentStatus
  );
}

function wait(milliseconds) {
  return new Promise(
    (resolve) => {
      setTimeout(
        resolve,
        milliseconds
      );
    }
  );
}

function scheduleOrderNotification({
  model,
  orderId,
  previous,
  isNew,
}) {
  const run =
    async () => {
      const retryDelays = [
        25,
        75,
        150,
        300,
        600,
      ];

      for (
        const delay of
        retryDelays
      ) {
        await wait(delay);

        const committedOrder =
          await model
            .findById(orderId)
            .lean();

        if (!committedOrder) {
          continue;
        }

        if (
          isNew ||
          hasNotificationDifference(
            committedOrder,
            previous
          )
        ) {
          await processOrderNotificationChanges({
            order:
              committedOrder,

            previous,
            isNew,
          });

          return;
        }
      }
    };

  void run().catch(
    (error) => {
      console.error(
        "Unable to process order notification:",
        error.message
      );
    }
  );
}

orderSchema.pre(
  "save",

  async function captureOrderNotificationState() {
    const isNewDocument =
      this.isNew;

    const shouldTrack =
      isNewDocument ||
      NOTIFICATION_FIELDS.some(
        (field) =>
          this.isModified(field)
      );

    if (!shouldTrack) {
      return;
    }

    let previous = null;

    if (!isNewDocument) {
      let query =
        this.constructor
          .findById(this._id)
          .lean();

      const session =
        this.$session();

      if (session) {
        query =
          query.session(session);
      }

      previous =
        await query;
    }

    this.$locals
      .orderNotificationState = {
        isNewDocument,
        previous,
      };
  }
);

orderSchema.post(
  "save",

  function processSavedOrder(
    savedOrder
  ) {
    const state =
      savedOrder.$locals
        .orderNotificationState;

    if (!state) {
      return;
    }

    scheduleOrderNotification({
      model:
        savedOrder.constructor,

      orderId:
        savedOrder._id,

      previous:
        state.previous,

      isNew:
        state.isNewDocument,
    });

    delete savedOrder.$locals
      .orderNotificationState;
  }
);

orderSchema.pre(
  "findOneAndUpdate",

  async function captureUpdatedOrderState() {
    let query =
      this.model
        .findOne(
          this.getQuery()
        )
        .lean();

    const session =
      this.getOptions()
        .session;

    if (session) {
      query =
        query.session(session);
    }

    this._previousOrderForNotification =
      await query;
  }
);

orderSchema.post(
  "findOneAndUpdate",

  function processUpdatedOrder() {
    const previous =
      this
        ._previousOrderForNotification;

    if (!previous?._id) {
      return;
    }

    scheduleOrderNotification({
      model:
        this.model,

      orderId:
        previous._id,

      previous,
      isNew: false,
    });
  }
);

orderSchema.index({
  user: 1,
  createdAt: -1,
});

orderSchema.index({
  orderStatus: 1,
  createdAt: -1,
});

orderSchema.index({
  paymentGatewayOrderId: 1,
});

orderSchema.index({
  refundId: 1,
});

orderSchema.index({
  refundStatus: 1,
  updatedAt: -1,
});

orderSchema.index({
  "coupon.code": 1,
  createdAt: -1,
});

orderSchema.index({
  deliveryPartner: 1,
  deliveryStatus: 1,
  createdAt: -1,
});

module.exports =
  mongoose.model(
    "Order",
    orderSchema
  );