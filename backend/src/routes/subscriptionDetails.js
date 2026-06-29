const express = require("express");

const {
  protect,
} = require("../middleware/auth");

const Order = require("../models/Order");
const Subscription = require(
  "../models/Subscription"
);

const router = express.Router();

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

async function findOwnedSubscription({
  subscriptionId,
  userId,
}) {
  return Subscription.findOne({
    _id: subscriptionId,
    user: userId,
  }).lean();
}

/**
 * GET
 * /api/subscriptions/:subscriptionId/details
 *
 * Returns the complete subscription and
 * latest generated recurring delivery order.
 */
router.get(
  "/:subscriptionId/details",
  protect,
  async (req, res, next) => {
    try {
      const subscription =
        await findOwnedSubscription({
          subscriptionId:
            req.params.subscriptionId,

          userId:
            req.user._id,
        });

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
              "orderSource",
              "subscriptionBillingAt",
              "items",
              "deliveryAddress",
              "deliverySchedule",
              "subtotal",
              "deliveryFee",
              "couponDiscount",
              "total",
              "paymentMethod",
              "paymentStatus",
              "orderStatus",
              "deliveryStatus",
              "deliveryPartnerSnapshot",
              "cancellationReason",
              "cancelledAt",
              "deliveredAt",
              "createdAt",
              "updatedAt",
            ].join(" ")
          )
          .lean(),

        Order.countDocuments(
          orderFilter
        ),
      ]);

      return res.status(200).json({
        success: true,

        data: {
          subscription,

          latestDeliveryOrder:
            latestDeliveryOrder ||
            null,

          generatedDeliveryCount,
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
 * /api/subscriptions/:subscriptionId/deliveries
 *
 * Query:
 * page=1
 * limit=10
 */
router.get(
  "/:subscriptionId/deliveries",
  protect,
  async (req, res, next) => {
    try {
      const subscription =
        await findOwnedSubscription({
          subscriptionId:
            req.params.subscriptionId,

          userId:
            req.user._id,
        });

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