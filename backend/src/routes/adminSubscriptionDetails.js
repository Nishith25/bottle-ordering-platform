const express = require("express");

const {
  protect,
  allowRoles,
} = require("../middleware/auth");

const Order = require("../models/Order");
const Subscription = require(
  "../models/Subscription"
);

const router = express.Router();

router.use(protect);
router.use(allowRoles("admin"));

const ALLOWED_PAYMENT_STATUSES = [
  "demo_confirmed",
  "active",
];

function parsePositiveInteger(
  value,
  fallback,
  maximum
) {
  const parsedValue =
    Number.parseInt(
      String(value ?? ""),
      10
    );

  if (
    !Number.isFinite(parsedValue) ||
    parsedValue < 1
  ) {
    return fallback;
  }

  return Math.min(
    parsedValue,
    maximum
  );
}

function getGenerationState(
  subscription
) {
  if (
    subscription.status !==
    "active"
  ) {
    return {
      isDue: false,
      canGenerate: false,

      message:
        "Only an active subscription can generate a recurring delivery order.",
    };
  }

  if (
    !ALLOWED_PAYMENT_STATUSES.includes(
      subscription.paymentStatus
    )
  ) {
    return {
      isDue: false,
      canGenerate: false,

      message:
        "The recurring payment mandate is not active.",
    };
  }

  const nextBillingAt =
    new Date(
      subscription.nextBillingAt
    );

  if (
    Number.isNaN(
      nextBillingAt.getTime()
    )
  ) {
    return {
      isDue: false,
      canGenerate: false,

      message:
        "The subscription has an invalid next billing date.",
    };
  }

  const isDue =
    nextBillingAt.getTime() <=
    Date.now();

  return {
    isDue,
    canGenerate: true,

    message: isDue
      ? "The subscription is due and ready to generate."
      : "The next cycle is not due yet. An administrator can still force-generate it for testing or exceptional cases.",
  };
}

/**
 * GET
 * /api/admin/subscriptions/:subscriptionId/details
 */
router.get(
  "/:subscriptionId/details",

  async (req, res, next) => {
    try {
      const subscription =
        await Subscription.findById(
          req.params.subscriptionId
        )
          .populate(
            "user",
            "fullName email phone role active createdAt"
          )
          .populate(
            "lastDeliveryOrder",
            [
              "orderNumber",
              "orderStatus",
              "deliveryStatus",
              "paymentStatus",
              "total",
              "createdAt",
            ].join(" ")
          )
          .lean();

      if (!subscription) {
        return res.status(404).json({
          success: false,

          message:
            "Subscription not found.",
        });
      }

      const orderFilter = {
        subscription:
          subscription._id,

        orderSource:
          "subscription",
      };

      const [
        latestDeliveryOrder,
        generatedDeliveryCount,
      ] = await Promise.all([
        Order.findOne(orderFilter)
          .sort({
            subscriptionBillingAt: -1,
            createdAt: -1,
          })
          .select(
            [
              "orderNumber",
              "subscriptionBillingAt",
              "subscriptionCycleKey",
              "items",
              "deliveryAddress",
              "deliverySchedule",
              "subtotal",
              "deliveryFee",
              "couponDiscount",
              "total",
              "paymentMethod",
              "paymentStatus",
              "paymentReference",
              "paidAt",
              "orderStatus",
              "deliveryStatus",
              "deliveryPartnerSnapshot",
              "cancellationReason",
              "cancelledAt",
              "deliveredAt",
              "refundStatus",
              "createdAt",
              "updatedAt",
            ].join(" ")
          )
          .lean(),

        Order.countDocuments(
          orderFilter
        ),
      ]);

      const generationState =
        getGenerationState(
          subscription
        );

      return res.status(200).json({
        success: true,

        data: {
          subscription,

          latestDeliveryOrder:
            latestDeliveryOrder ||
            null,

          generatedDeliveryCount,

          generationState,
        },
      });
    } catch (error) {
      if (
        error.name ===
        "CastError"
      ) {
        return res.status(404).json({
          success: false,

          message:
            "Subscription not found.",
        });
      }

      return next(error);
    }
  }
);

/**
 * GET
 * /api/admin/subscriptions/:subscriptionId/deliveries
 *
 * Query:
 * page=1
 * limit=10
 */
router.get(
  "/:subscriptionId/deliveries",

  async (req, res, next) => {
    try {
      const subscription =
        await Subscription.findById(
          req.params.subscriptionId
        )
          .select(
            "_id subscriptionNumber"
          )
          .lean();

      if (!subscription) {
        return res.status(404).json({
          success: false,

          message:
            "Subscription not found.",
        });
      }

      const page =
        parsePositiveInteger(
          req.query.page,
          1,
          100000
        );

      const limit =
        parsePositiveInteger(
          req.query.limit,
          10,
          25
        );

      const skip =
        (page - 1) * limit;

      const orderFilter = {
        subscription:
          subscription._id,

        orderSource:
          "subscription",
      };

      const [
        deliveries,
        total,
      ] = await Promise.all([
        Order.find(orderFilter)
          .sort({
            subscriptionBillingAt: -1,
            createdAt: -1,
          })
          .skip(skip)
          .limit(limit)
          .select(
            [
              "orderNumber",
              "orderSource",
              "subscriptionNumber",
              "subscriptionCycleKey",
              "subscriptionBillingAt",
              "items",
              "deliveryAddress",
              "deliverySchedule",
              "subtotal",
              "deliveryFee",
              "amountBeforeDiscount",
              "couponDiscount",
              "coupon",
              "total",
              "paymentMethod",
              "paymentGateway",
              "paymentStatus",
              "paymentReference",
              "paidAt",
              "orderStatus",
              "deliveryStatus",
              "deliveryPartnerSnapshot",
              "deliveryAssignedAt",
              "pickedUpAt",
              "outForDeliveryAt",
              "deliveryCompletedAt",
              "cancellationReason",
              "cancelledAt",
              "deliveredAt",
              "refundStatus",
              "refundAmount",
              "createdAt",
              "updatedAt",
            ].join(" ")
          )
          .lean(),

        Order.countDocuments(
          orderFilter
        ),
      ]);

      const totalPages =
        Math.max(
          1,
          Math.ceil(
            total / limit
          )
        );

      return res.status(200).json({
        success: true,
        count:
          deliveries.length,

        data: {
          subscriptionNumber:
            subscription.subscriptionNumber,

          deliveries,

          pagination: {
            page,
            limit,
            total,
            totalPages,

            hasNextPage:
              page < totalPages,

            hasPreviousPage:
              page > 1,
          },
        },
      });
    } catch (error) {
      if (
        error.name ===
        "CastError"
      ) {
        return res.status(404).json({
          success: false,

          message:
            "Subscription not found.",
        });
      }

      return next(error);
    }
  }
);

module.exports = router;