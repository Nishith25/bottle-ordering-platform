const express = require("express");

const {
  protect,
  allowRoles,
} = require("../middleware/auth");

const Order = require("../models/Order");

const {
  getDeliveryOtp,
  verifyDeliveryOtp,
} = require("../services/deliveryOtp");

const router = express.Router();

router.use(protect);

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

router.get(
  "/customer/:orderId",
  async (req, res, next) => {
    try {
      if (req.user.role !== "customer") {
        return res.status(403).json({
          success: false,
          message:
            "Only the customer who owns this order can view the delivery OTP.",
        });
      }

      const query = {
        _id: req.params.orderId,
        user: req.user._id,
      };

      const order = await Order.findOne(query)
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
          message: "Order not found.",
        });
      }

      const otpAvailable =
        Boolean(order.deliveryPartner) &&
        [
          "assigned",
          "picked_up",
          "out_for_delivery",
        ].includes(order.deliveryStatus) &&
        ![
          "delivered",
          "cancelled",
        ].includes(order.orderStatus);

      const deliveryOtp = otpAvailable
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

router.get(
  "/assigned",
  allowRoles("delivery"),
  async (req, res, next) => {
    try {
      const orders = await Order.find({
        deliveryPartner: req.user._id,
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
          statusCounts[order.deliveryStatus] += 1;
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

router.get(
  "/:orderId",
  allowRoles("delivery"),
  async (req, res, next) => {
    try {
      const order = await Order.findOne({
        _id: req.params.orderId,
        deliveryPartner: req.user._id,
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

router.patch(
  "/:orderId/status",
  allowRoles("delivery"),
  async (req, res, next) => {
    try {
      const nextStatus = cleanText(
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

      const order = await Order.findOne({
        _id: req.params.orderId,
        deliveryPartner: req.user._id,
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

      if (nextStatus === "picked_up") {
        if (order.deliveryStatus !== "assigned") {
          return res.status(400).json({
            success: false,
            message:
              "Only an assigned order can be marked as picked up.",
          });
        }

        order.deliveryStatus = "picked_up";
        order.pickedUpAt = new Date();

        if (order.orderStatus === "confirmed") {
          order.orderStatus = "preparing";
        }
      }

      if (nextStatus === "out_for_delivery") {
        if (order.deliveryStatus !== "picked_up") {
          return res.status(400).json({
            success: false,
            message:
              "Mark the order as picked up before starting delivery.",
          });
        }

        order.deliveryStatus = "out_for_delivery";
        order.orderStatus = "out_for_delivery";
        order.outForDeliveryAt = new Date();
      }

      await order.save();

      const updatedOrder = await Order.findById(
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
          nextStatus === "picked_up"
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

router.post(
  "/:orderId/verify-otp",
  allowRoles("delivery"),
  async (req, res, next) => {
    try {
      const order = await Order.findOne({
        _id: req.params.orderId,
        deliveryPartner: req.user._id,
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

      const result = verifyDeliveryOtp(
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
          message: `Incorrect delivery OTP. ${result.attemptsRemaining} attempt${
            result.attemptsRemaining === 1 ? "" : "s"
          } remaining.`,
        });
      }

      const completedAt = new Date();

      order.deliveryStatus = "delivered";
      order.orderStatus = "delivered";
      order.deliveryCompletedAt = completedAt;
      order.deliveredAt = completedAt;

      if (order.paymentMethod === "cod") {
        order.paymentStatus = "paid";
        order.paidAt = order.paidAt || completedAt;
      }

      await order.save();

      const updatedOrder = await Order.findById(
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
