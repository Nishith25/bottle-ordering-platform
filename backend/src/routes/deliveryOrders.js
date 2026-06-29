const express = require("express");

const {
  protect,
  allowRoles,
} = require("../middleware/auth");

const Order = require("../models/Order");
const OrderReview = require(
  "../models/OrderReview"
);

const {
  getDeliveryOtp,
  verifyDeliveryOtp,
} = require("../services/deliveryOtp");

const router = express.Router();

router.use(protect);

const ACTIVE_DELIVERY_STATUSES = [
  "assigned",
  "picked_up",
  "out_for_delivery",
];

function cleanText(value) {
  return String(value || "").trim();
}

function sanitiseOrder(order) {
  const value =
    typeof order.toObject === "function"
      ? order.toObject()
      : { ...order };

  delete value.deliveryOtpSalt;
  delete value.deliveryOtpHash;

  return value;
}

/**
 * GET /api/delivery/orders/customer/:orderId
 *
 * Any authenticated account may purchase bottles.
 * OTP visibility is controlled through order
 * ownership rather than account role.
 */
router.get(
  "/customer/:orderId",
  async (req, res, next) => {
    try {
      const order =
        await Order.findOne({
          _id: req.params.orderId,
          user: req.user._id,
        })
          .select(
            "+deliveryOtpSalt +deliveryOtpHash"
          )
          .populate(
            "deliveryPartner",
            "fullName email phone role active"
          );

      if (!order) {
        return res.status(404).json({
          success: false,
          message:
            "Order not found for this account.",
        });
      }

      const otpAvailable =
        Boolean(order.deliveryPartner) &&
        ACTIVE_DELIVERY_STATUSES.includes(
          order.deliveryStatus
        ) &&
        ![
          "delivered",
          "cancelled",
        ].includes(order.orderStatus);

      const deliveryOtp =
        otpAvailable
          ? getDeliveryOtp(order)
          : "";

      return res.status(200).json({
        success: true,

        data: {
          order: sanitiseOrder(order),
          deliveryOtp,
        },
      });
    } catch (error) {
      if (error.name === "CastError") {
        return res.status(404).json({
          success: false,
          message: "Order not found.",
        });
      }

      return next(error);
    }
  }
);

/**
 * GET /api/delivery/orders/performance
 *
 * Returns only the logged-in delivery partner's
 * own statistics, ratings, recent reviews and
 * completed-delivery history.
 *
 * This route must appear before /:orderId.
 */
router.get(
  "/performance",
  allowRoles("delivery"),
  async (req, res, next) => {
    try {
      const partnerId =
        req.user._id;

      const [
        deliveryStatistics,
        reviewStatistics,
        recentReviews,
        recentDeliveries,
      ] = await Promise.all([
        Order.aggregate([
          {
            $match: {
              deliveryPartner:
                partnerId,

              orderStatus: {
                $ne: "cancelled",
              },
            },
          },

          {
            $group: {
              _id: null,

              totalAssigned: {
                $sum: 1,
              },

              activeDeliveries: {
                $sum: {
                  $cond: [
                    {
                      $in: [
                        "$deliveryStatus",
                        ACTIVE_DELIVERY_STATUSES,
                      ],
                    },

                    1,
                    0,
                  ],
                },
              },

              completedDeliveries: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        {
                          $eq: [
                            "$orderStatus",
                            "delivered",
                          ],
                        },

                        {
                          $eq: [
                            "$deliveryStatus",
                            "delivered",
                          ],
                        },
                      ],
                    },

                    1,
                    0,
                  ],
                },
              },
            },
          },
        ]),

        OrderReview.aggregate([
          {
            $match: {
              deliveryPartner:
                partnerId,
            },
          },

          {
            $group: {
              _id: null,

              reviewCount: {
                $sum: 1,
              },

              averageDeliveryRating: {
                $avg:
                  "$deliveryRating",
              },

              fiveStarReviews: {
                $sum: {
                  $cond: [
                    {
                      $eq: [
                        "$deliveryRating",
                        5,
                      ],
                    },

                    1,
                    0,
                  ],
                },
              },
            },
          },
        ]),

        OrderReview.find({
          deliveryPartner:
            partnerId,
        })
          .populate(
            "user",
            "fullName"
          )
          .sort({
            submittedAt: -1,
            createdAt: -1,
          })
          .limit(6)
          .lean(),

        Order.find({
          deliveryPartner:
            partnerId,

          orderStatus:
            "delivered",

          deliveryStatus:
            "delivered",
        })
          .populate(
            "user",
            "fullName phone"
          )
          .sort({
            deliveryCompletedAt: -1,
            deliveredAt: -1,
            createdAt: -1,
          })
          .limit(12)
          .lean(),
      ]);

      const deliveryData =
        deliveryStatistics[0] || {
          totalAssigned: 0,
          activeDeliveries: 0,
          completedDeliveries: 0,
        };

      const reviewData =
        reviewStatistics[0] || {
          reviewCount: 0,
          averageDeliveryRating: 0,
          fiveStarReviews: 0,
        };

      const totalAssigned =
        Number(
          deliveryData.totalAssigned ||
            0
        );

      const completedDeliveries =
        Number(
          deliveryData.completedDeliveries ||
            0
        );

      const completionRate =
        totalAssigned > 0
          ? Number(
              (
                (completedDeliveries /
                  totalAssigned) *
                100
              ).toFixed(1)
            )
          : 0;

      return res.status(200).json({
        success: true,

        data: {
          performance: {
            totalAssigned,

            activeDeliveries:
              Number(
                deliveryData.activeDeliveries ||
                  0
              ),

            completedDeliveries,

            reviewCount:
              Number(
                reviewData.reviewCount ||
                  0
              ),

            averageDeliveryRating:
              Number(
                (
                  reviewData.averageDeliveryRating ||
                  0
                ).toFixed(1)
              ),

            fiveStarReviews:
              Number(
                reviewData.fiveStarReviews ||
                  0
              ),

            completionRate,

            recentReviews,

            recentDeliveries,
          },
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * GET /api/delivery/orders/assigned
 *
 * Returns orders assigned to the logged-in
 * delivery partner.
 */
router.get(
  "/assigned",
  allowRoles("delivery"),
  async (req, res, next) => {
    try {
      const orders =
        await Order.find({
          deliveryPartner:
            req.user._id,

          orderStatus: {
            $ne: "cancelled",
          },
        })
          .populate(
            "user",
            "fullName phone"
          )
          .sort({
            deliveredAt: 1,

            "deliverySchedule.deliveryDateId": 1,

            createdAt: -1,
          })
          .limit(200)
          .lean();

      const statusCounts = {
        assigned: 0,
        picked_up: 0,
        out_for_delivery: 0,
        delivered: 0,
      };

      for (const order of orders) {
        if (
          Object.prototype.hasOwnProperty.call(
            statusCounts,
            order.deliveryStatus
          )
        ) {
          statusCounts[
            order.deliveryStatus
          ] += 1;
        }
      }

      return res.status(200).json({
        success: true,
        count: orders.length,

        data: {
          orders,
          statusCounts,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * GET /api/delivery/orders/:orderId
 */
router.get(
  "/:orderId",
  allowRoles("delivery"),
  async (req, res, next) => {
    try {
      const order =
        await Order.findOne({
          _id: req.params.orderId,

          deliveryPartner:
            req.user._id,
        })
          .populate(
            "user",
            "fullName phone"
          )
          .lean();

      if (!order) {
        return res.status(404).json({
          success: false,

          message:
            "Assigned delivery order not found.",
        });
      }

      return res.status(200).json({
        success: true,

        data: {
          order,
        },
      });
    } catch (error) {
      if (error.name === "CastError") {
        return res.status(404).json({
          success: false,

          message:
            "Assigned delivery order not found.",
        });
      }

      return next(error);
    }
  }
);

/**
 * PATCH /api/delivery/orders/:orderId/status
 *
 * assigned -> picked_up -> out_for_delivery
 */
router.patch(
  "/:orderId/status",
  allowRoles("delivery"),
  async (req, res, next) => {
    try {
      const nextStatus =
        cleanText(
          req.body.deliveryStatus
        );

      if (
        ![
          "picked_up",
          "out_for_delivery",
        ].includes(nextStatus)
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Please select a valid delivery status.",
        });
      }

      const order =
        await Order.findOne({
          _id: req.params.orderId,

          deliveryPartner:
            req.user._id,
        });

      if (!order) {
        return res.status(404).json({
          success: false,

          message:
            "Assigned delivery order not found.",
        });
      }

      if (
        [
          "cancelled",
          "delivered",
        ].includes(order.orderStatus)
      ) {
        return res.status(400).json({
          success: false,

          message:
            "This order can no longer be updated.",
        });
      }

      if (
        nextStatus ===
        "picked_up"
      ) {
        if (
          order.deliveryStatus !==
          "assigned"
        ) {
          return res.status(400).json({
            success: false,

            message:
              "Only an assigned order can be marked as picked up.",
          });
        }

        order.deliveryStatus =
          "picked_up";

        order.pickedUpAt =
          new Date();

        if (
          [
            "placed",
            "confirmed",
          ].includes(
            order.orderStatus
          )
        ) {
          order.orderStatus =
            "preparing";
        }
      }

      if (
        nextStatus ===
        "out_for_delivery"
      ) {
        if (
          order.deliveryStatus !==
          "picked_up"
        ) {
          return res.status(400).json({
            success: false,

            message:
              "Mark the order as picked up before starting delivery.",
          });
        }

        order.deliveryStatus =
          "out_for_delivery";

        order.orderStatus =
          "out_for_delivery";

        order.outForDeliveryAt =
          new Date();
      }

      await order.save();

      const updatedOrder =
        await Order.findById(
          order._id
        )
          .populate(
            "user",
            "fullName phone"
          )
          .lean();

      return res.status(200).json({
        success: true,

        message:
          nextStatus ===
          "picked_up"
            ? "Order marked as picked up."
            : "Order is now out for delivery.",

        data: {
          order: updatedOrder,
        },
      });
    } catch (error) {
      if (error.name === "CastError") {
        return res.status(404).json({
          success: false,

          message:
            "Assigned delivery order not found.",
        });
      }

      return next(error);
    }
  }
);

/**
 * POST /api/delivery/orders/:orderId/verify-otp
 */
router.post(
  "/:orderId/verify-otp",
  allowRoles("delivery"),
  async (req, res, next) => {
    try {
      const order =
        await Order.findOne({
          _id: req.params.orderId,

          deliveryPartner:
            req.user._id,
        }).select(
          "+deliveryOtpSalt +deliveryOtpHash"
        );

      if (!order) {
        return res.status(404).json({
          success: false,

          message:
            "Assigned delivery order not found.",
        });
      }

      if (
        order.deliveryStatus !==
          "out_for_delivery" ||
        order.orderStatus !==
          "out_for_delivery"
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Start delivery before verifying the customer OTP.",
        });
      }

      if (
        !order.deliveryOtpSalt ||
        !order.deliveryOtpHash
      ) {
        return res.status(409).json({
          success: false,

          message:
            "Delivery OTP is unavailable. Ask the administrator to reassign this order.",
        });
      }

      const result =
        verifyDeliveryOtp(
          order,
          req.body.otp
        );

      if (!result.valid) {
        await order.save();

        if (result.locked) {
          return res.status(429).json({
            success: false,

            message:
              "Too many incorrect OTP attempts. Try again after 15 minutes.",
          });
        }

        return res.status(400).json({
          success: false,

          message:
            `Incorrect delivery OTP. ${result.attemptsRemaining} attempt${
              result.attemptsRemaining ===
              1
                ? ""
                : "s"
            } remaining.`,
        });
      }

      const completedAt =
        new Date();

      order.deliveryStatus =
        "delivered";

      order.orderStatus =
        "delivered";

      order.deliveryCompletedAt =
        completedAt;

      order.deliveredAt =
        completedAt;

      order.deliveryOtpVerifiedAt =
        completedAt;

      if (
        order.paymentMethod ===
        "cod"
      ) {
        order.paymentStatus =
          "paid";

        order.paidAt =
          order.paidAt ||
          completedAt;
      }

      await order.save();

      const updatedOrder =
        await Order.findById(
          order._id
        )
          .populate(
            "user",
            "fullName phone"
          )
          .lean();

      return res.status(200).json({
        success: true,

        message:
          "Delivery completed successfully after OTP verification.",

        data: {
          order: updatedOrder,
        },
      });
    } catch (error) {
      if (error.name === "CastError") {
        return res.status(404).json({
          success: false,

          message:
            "Assigned delivery order not found.",
        });
      }

      return next(error);
    }
  }
);

module.exports = router;