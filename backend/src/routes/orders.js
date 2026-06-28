// backend/src/routes/orders.js

const express = require("express");
const mongoose = require("mongoose");

const { protect } = require(
  "../middleware/auth"
);

const Order = require("../models/Order");

const {
  reserveProductInventory,
  restoreOrderInventory,
} = require("../services/inventory");

const {
  buildOrderDraft,
  cleanText,
  createUniqueOrderNumber,
} = require("../services/orderCheckout");

const router = express.Router();

/**
 * POST /api/orders
 *
 * COD orders are created directly here.
 * Online orders use /api/payments/razorpay/initiate.
 */
router.post(
  "/",
  protect,
  async (req, res, next) => {
    const session =
      await mongoose.startSession();

    try {
      const paymentMethod =
        cleanText(
          req.body.paymentMethod
        ).toLowerCase();

      if (paymentMethod !== "cod") {
        return res.status(400).json({
          success: false,

          message:
            "Online orders must be completed through Razorpay Checkout.",
        });
      }

      let createdOrder = null;

      await session.withTransaction(
        async () => {
          const {
            draft,
            products,
            quantitiesByProductId,
          } = await buildOrderDraft(
            req.body,
            session
          );

          await reserveProductInventory({
            products,
            quantitiesByProductId,
            session,
          });

          const orderNumber =
            await createUniqueOrderNumber(
              session
            );

          const orders =
            await Order.create(
              [
                {
                  orderNumber,
                  user: req.user._id,

                  ...draft,

                  paymentMethod: "cod",
                  paymentGateway: "",
                  paymentStatus:
                    "pending",

                  paymentReference: "",
                  orderStatus: "placed",

                  inventoryReserved:
                    true,

                  inventoryRestored:
                    false,
                },
              ],
              {
                session,
              }
            );

          createdOrder = orders[0];
        }
      );

      return res.status(201).json({
        success: true,

        message:
          "Your order was placed successfully.",

        data: {
          order: createdOrder,
        },
      });
    } catch (error) {
      return next(error);
    } finally {
      await session.endSession();
    }
  }
);

router.get(
  "/my",
  protect,
  async (req, res, next) => {
    try {
      const orders =
        await Order.find({
          user: req.user._id,
        })
          .sort({
            createdAt: -1,
          })
          .lean();

      return res.status(200).json({
        success: true,
        count: orders.length,

        data: {
          orders,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.get(
  "/:orderId",
  protect,
  async (req, res, next) => {
    try {
      const query = {
        _id: req.params.orderId,
      };

      if (
        req.user.role !== "admin"
      ) {
        query.user =
          req.user._id;
      }

      const order =
        await Order.findOne(
          query
        ).lean();

      if (!order) {
        return res.status(404).json({
          success: false,
          message:
            "Order not found.",
        });
      }

      return res.status(200).json({
        success: true,

        data: {
          order,
        },
      });
    } catch (error) {
      if (
        error.name === "CastError"
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Order not found.",
        });
      }

      return next(error);
    }
  }
);

router.patch(
  "/:orderId/cancel",
  protect,
  async (req, res, next) => {
    const session =
      await mongoose.startSession();

    try {
      let cancelledOrder = null;

      await session.withTransaction(
        async () => {
          const order =
            await Order.findOne({
              _id:
                req.params.orderId,

              user:
                req.user._id,
            }).session(session);

          if (!order) {
            const error = new Error(
              "Order not found."
            );

            error.statusCode = 404;
            throw error;
          }

          if (
            ![
              "placed",
              "confirmed",
            ].includes(
              order.orderStatus
            )
          ) {
            const error = new Error(
              "This order can no longer be cancelled."
            );

            error.statusCode = 400;
            throw error;
          }

          order.orderStatus =
            "cancelled";

          order.cancellationReason =
            cleanText(
              req.body.reason
            ) ||
            "Cancelled by customer";

          order.cancelledAt =
            new Date();

          if (
            order.paymentStatus ===
            "paid"
          ) {
            order.paymentStatus =
              "refunded";
          }

          await restoreOrderInventory({
            order,
            session,
          });

          await order.save({
            session,
          });

          cancelledOrder = order;
        }
      );

      return res.status(200).json({
        success: true,

        message:
          "Your order was cancelled and the reserved stock was restored.",

        data: {
          order:
            cancelledOrder,
        },
      });
    } catch (error) {
      if (
        error.name === "CastError"
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Order not found.",
        });
      }

      return next(error);
    } finally {
      await session.endSession();
    }
  }
);

module.exports = router;