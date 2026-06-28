// backend/src/routes/adminOrders.js

const express = require("express");

const {
  protect,
  allowRoles,
} = require("../middleware/auth");

const Order = require("../models/Order");
const User = require("../models/User");

const router = express.Router();

router.use(protect);
router.use(allowRoles("admin"));

const ORDER_STATUSES = [
  "placed",
  "confirmed",
  "preparing",
  "out_for_delivery",
  "delivered",
  "cancelled",
];

const ALLOWED_TRANSITIONS = {
  placed: ["confirmed", "cancelled"],

  confirmed: [
    "preparing",
    "cancelled",
  ],

  preparing: [
    "out_for_delivery",
    "cancelled",
  ],

  out_for_delivery: ["delivered"],

  delivered: [],

  cancelled: [],
};

function cleanText(value) {
  return String(value ?? "").trim();
}

function escapeRegex(value) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

/**
 * GET /api/admin/orders
 *
 * Query parameters:
 * status=placed
 * search=customer name, email, phone or order number
 */
router.get(
  "/",
  async (req, res, next) => {
    try {
      const status = cleanText(
        req.query.status
      );

      const search = cleanText(
        req.query.search
      );

      const filter = {};

      if (
        status &&
        status !== "all"
      ) {
        if (
          !ORDER_STATUSES.includes(
            status
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid order status filter.",
          });
        }

        filter.orderStatus = status;
      }

      if (search) {
        const searchRegex =
          new RegExp(
            escapeRegex(search),
            "i"
          );

        const matchingUsers =
          await User.find({
            $or: [
              {
                fullName: searchRegex,
              },
              {
                email: searchRegex,
              },
              {
                phone: searchRegex,
              },
            ],
          })
            .select("_id")
            .lean();

        const matchingUserIds =
          matchingUsers.map(
            (user) => user._id
          );

        filter.$or = [
          {
            orderNumber:
              searchRegex,
          },

          {
            "deliveryAddress.fullName":
              searchRegex,
          },

          {
            "deliveryAddress.phone":
              searchRegex,
          },

          {
            user: {
              $in: matchingUserIds,
            },
          },
        ];
      }

      const [
        orders,
        statusBreakdown,
      ] = await Promise.all([
        Order.find(filter)
          .populate(
            "user",
            "fullName email phone role"
          )
          .sort({
            createdAt: -1,
          })
          .limit(250)
          .lean(),

        Order.aggregate([
          {
            $group: {
              _id: "$orderStatus",

              count: {
                $sum: 1,
              },
            },
          },
        ]),
      ]);

      const counts = ORDER_STATUSES.reduce(
        (result, orderStatus) => {
          result[orderStatus] = 0;
          return result;
        },
        {}
      );

      for (const item of statusBreakdown) {
        counts[item._id] =
          item.count;
      }

      return res.status(200).json({
        success: true,

        count: orders.length,

        data: {
          orders,
          statusCounts: counts,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * PATCH /api/admin/orders/:orderId/status
 */
router.patch(
  "/:orderId/status",
  async (req, res, next) => {
    try {
      const nextStatus =
        cleanText(
          req.body.orderStatus
        );

      const cancellationReason =
        cleanText(
          req.body.cancellationReason
        );

      if (
        !ORDER_STATUSES.includes(
          nextStatus
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Please select a valid order status.",
        });
      }

      const order =
        await Order.findById(
          req.params.orderId
        );

      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found.",
        });
      }

      if (
        order.orderStatus ===
        nextStatus
      ) {
        const unchangedOrder =
          await Order.findById(
            order._id
          )
            .populate(
              "user",
              "fullName email phone role"
            )
            .lean();

        return res.status(200).json({
          success: true,

          message:
            "Order status is already up to date.",

          data: {
            order: unchangedOrder,
          },
        });
      }

      const allowedStatuses =
        ALLOWED_TRANSITIONS[
          order.orderStatus
        ] ?? [];

      if (
        !allowedStatuses.includes(
          nextStatus
        )
      ) {
        return res.status(400).json({
          success: false,

          message: `Order cannot move from ${order.orderStatus} to ${nextStatus}.`,
        });
      }

      order.orderStatus =
        nextStatus;

      if (
        nextStatus === "cancelled"
      ) {
        order.cancelledAt =
          new Date();

        order.cancellationReason =
          cancellationReason ||
          "Cancelled by administrator";
      }

      if (
        nextStatus === "delivered"
      ) {
        order.deliveredAt =
          new Date();

        if (
          order.paymentMethod ===
          "cod"
        ) {
          order.paymentStatus =
            "paid";
        }
      }

      await order.save();

      const updatedOrder =
        await Order.findById(
          order._id
        )
          .populate(
            "user",
            "fullName email phone role"
          )
          .lean();

      return res.status(200).json({
        success: true,

        message:
          "Order status updated successfully.",

        data: {
          order: updatedOrder,
        },
      });
    } catch (error) {
      if (
        error.name === "CastError"
      ) {
        return res.status(404).json({
          success: false,
          message: "Order not found.",
        });
      }

      return next(error);
    }
  }
);

module.exports = router;