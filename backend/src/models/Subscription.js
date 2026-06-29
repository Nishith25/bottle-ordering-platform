const mongoose = require("mongoose");

const {
  processSubscriptionNotificationChanges,
} = require(
  "../services/notificationService"
);

const subscriptionItemSchema =
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
        max: 100,
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

const subscriptionAddressSchema =
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

const subscriptionSchema =
  new mongoose.Schema(
    {
      subscriptionNumber: {
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

      plan: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: "SubscriptionPlan",
        required: true,
      },

      planId: {
        type: String,
        required: true,
        trim: true,
      },

      planName: {
        type: String,
        required: true,
        trim: true,
      },

      billingCycle: {
        type: String,

        enum: [
          "weekly",
          "monthly",
        ],

        required: true,
      },

      bottleCount: {
        type: Number,
        required: true,
        min: 1,
      },

      deliveriesPerCycle: {
        type: Number,
        required: true,
        min: 1,
      },

      items: {
        type:
          [subscriptionItemSchema],

        required: true,

        validate: {
          validator(items) {
            return (
              Array.isArray(items) &&
              items.length > 0
            );
          },

          message:
            "A subscription must contain at least one bottle.",
        },
      },

      preferredDay: {
        type: String,
        required: true,
        trim: true,
      },

      preferredSlot: {
        type: String,
        required: true,
        trim: true,
      },

      deliveryAddress: {
        type:
          subscriptionAddressSchema,

        required: true,
      },

      originalTotal: {
        type: Number,
        required: true,
        min: 0,
      },

      discountPercent: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
      },

      savings: {
        type: Number,
        required: true,
        min: 0,
      },

      amountBeforeCoupon: {
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

      totalPerCycle: {
        type: Number,
        required: true,
        min: 0,
      },

      recurringTotalPerCycle: {
        type: Number,
        default: 0,
        min: 0,
      },

      paymentMethod: {
        type: String,

        enum: [
          "upi_autopay",
          "card_mandate",
        ],

        required: true,
      },

      paymentStatus: {
        type: String,

        enum: [
          "demo_confirmed",
          "mandate_pending",
          "active",
          "failed",
          "cancelled",
        ],

        default:
          "demo_confirmed",
      },

      paymentReference: {
        type: String,
        default: "",
        trim: true,
      },

      status: {
        type: String,

        enum: [
          "active",
          "paused",
          "cancelled",
          "expired",
        ],

        default: "active",
      },

      startDate: {
        type: Date,
        default: Date.now,
      },

      nextBillingAt: {
        type: Date,
        required: true,
      },

      cancelledAt: {
        type: Date,
        default: null,
      },

      cancellationReason: {
        type: String,
        default: "",
        trim: true,
      },
    },
    {
      timestamps: true,
    }
  );

subscriptionSchema.pre(
  "validate",

  function ensureLegacyTotals() {
    if (
      !Number.isFinite(
        this.amountBeforeCoupon
      ) ||
      this.amountBeforeCoupon <= 0
    ) {
      this.amountBeforeCoupon =
        Math.max(
          0,

          Number(
            this.originalTotal || 0
          ) -
            Number(
              this.savings || 0
            )
        );
    }

    if (
      !Number.isFinite(
        this.recurringTotalPerCycle
      ) ||
      this.recurringTotalPerCycle <=
        0
    ) {
      this.recurringTotalPerCycle =
        this.amountBeforeCoupon ||
        Number(
          this.totalPerCycle || 0
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
  }
);

const SUBSCRIPTION_NOTIFICATION_FIELDS =
  [
    "status",
    "paymentStatus",
    "nextBillingAt",
  ];

function dateValue(value) {
  if (!value) {
    return null;
  }

  const timestamp =
    new Date(value).getTime();

  return Number.isFinite(
    timestamp
  )
    ? timestamp
    : null;
}

function hasSubscriptionNotificationDifference(
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
    current.status !==
      previous.status ||
    current.paymentStatus !==
      previous.paymentStatus ||
    dateValue(
      current.nextBillingAt
    ) !==
      dateValue(
        previous.nextBillingAt
      )
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

function scheduleSubscriptionNotification({
  model,
  subscriptionId,
  previous,
  isNew,
}) {
  const run =
    async () => {
      /*
       * Subscriptions may be saved inside a
       * MongoDB transaction. Wait until the
       * committed document becomes visible
       * before generating the notification.
       */
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

        const committedSubscription =
          await model
            .findById(
              subscriptionId
            )
            .lean();

        if (
          !committedSubscription
        ) {
          continue;
        }

        if (
          isNew ||
          hasSubscriptionNotificationDifference(
            committedSubscription,
            previous
          )
        ) {
          await processSubscriptionNotificationChanges({
            subscription:
              committedSubscription,

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
        "Unable to process subscription notification:",
        error.message
      );
    }
  );
}

subscriptionSchema.pre(
  "save",

  async function captureSubscriptionNotificationState() {
    const isNewDocument =
      this.isNew;

    const shouldTrack =
      isNewDocument ||
      SUBSCRIPTION_NOTIFICATION_FIELDS.some(
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
      .subscriptionNotificationState =
      {
        isNewDocument,
        previous,
      };
  }
);

subscriptionSchema.post(
  "save",

  function processSavedSubscription(
    savedSubscription
  ) {
    const state =
      savedSubscription.$locals
        .subscriptionNotificationState;

    if (!state) {
      return;
    }

    scheduleSubscriptionNotification({
      model:
        savedSubscription
          .constructor,

      subscriptionId:
        savedSubscription._id,

      previous:
        state.previous,

      isNew:
        state.isNewDocument,
    });

    delete savedSubscription
      .$locals
      .subscriptionNotificationState;
  }
);

subscriptionSchema.pre(
  "findOneAndUpdate",

  async function captureUpdatedSubscriptionState() {
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

    this
      ._previousSubscriptionForNotification =
      await query;
  }
);

subscriptionSchema.post(
  "findOneAndUpdate",

  function processUpdatedSubscription() {
    const previous =
      this
        ._previousSubscriptionForNotification;

    if (!previous?._id) {
      return;
    }

    scheduleSubscriptionNotification({
      model:
        this.model,

      subscriptionId:
        previous._id,

      previous,
      isNew: false,
    });
  }
);

subscriptionSchema.index({
  user: 1,
  createdAt: -1,
});

subscriptionSchema.index({
  user: 1,
  status: 1,
});

subscriptionSchema.index({
  "coupon.code": 1,
  createdAt: -1,
});

subscriptionSchema.index({
  status: 1,
  nextBillingAt: 1,
});

subscriptionSchema.index({
  paymentStatus: 1,
  updatedAt: -1,
});

module.exports =
  mongoose.model(
    "Subscription",
    subscriptionSchema
  );