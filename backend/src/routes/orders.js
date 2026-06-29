const express = require("express");
const mongoose = require("mongoose");

const { protect } = require("../middleware/auth");
const Order = require("../models/Order");

const {
  reserveProductInventory,
} = require("../services/inventory");

const {
  buildOrderDraft,
  cleanText,
  createUniqueOrderNumber,
} = require("../services/orderCheckout");

const {
  redeemCouponForRecord,
} = require("../services/couponService");

const {
  cancelOrderWithRefund,
  getCancellationMessage,
} = require("../services/orderRefund");

const router = express.Router();

router.post("/", protect, async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    const paymentMethod = cleanText(req.body.paymentMethod).toLowerCase();

    if (paymentMethod !== "cod") {
      return res.status(400).json({
        success: false,
        message:
          "Online orders must be completed through Razorpay Checkout.",
      });
    }

    let createdOrder = null;

    await session.withTransaction(async () => {
      const {
        draft,
        products,
        quantitiesByProductId,
      } = await buildOrderDraft(req.body, session, {
        userId: req.user._id,
      });

      await reserveProductInventory({
        products,
        quantitiesByProductId,
        session,
      });

      const orderNumber = await createUniqueOrderNumber(session);

      const orders = await Order.create(
        [
          {
            orderNumber,
            user: req.user._id,
            ...draft,
            paymentMethod: "cod",
            paymentGateway: "",
            paymentStatus: "pending",
            paymentReference: "",
            orderStatus: "placed",
            refundStatus: "not_required",
            inventoryReserved: true,
            inventoryRestored: false,
          },
        ],
        { session }
      );

      createdOrder = orders[0];

      if (draft.coupon?.couponId) {
        const usage = await redeemCouponForRecord({
          couponSnapshot: draft.coupon,
          userId: req.user._id,
          context: "order",
          recordId: createdOrder._id,
          session,
        });

        createdOrder.couponUsage = usage?._id || null;
        await createdOrder.save({ session });
      }
    });

    return res.status(201).json({
      success: true,
      message: "Your order was placed successfully.",
      data: {
        order: createdOrder,
      },
    });
  } catch (error) {
    return next(error);
  } finally {
    await session.endSession();
  }
});

router.get("/my", protect, async (req, res, next) => {
  try {
    const orders = await Order.find({
      user: req.user._id,
    })
      .sort({ createdAt: -1 })
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
});

router.get("/:orderId", protect, async (req, res, next) => {
  try {
    const query = {
      _id: req.params.orderId,
    };

    if (req.user.role !== "admin") {
      query.user = req.user._id;
    }

    const order = await Order.findOne(query).lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
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
        message: "Order not found.",
      });
    }

    return next(error);
  }
});

router.patch("/:orderId/cancel", protect, async (req, res, next) => {
  try {
    const cancelledOrder = await cancelOrderWithRefund({
      orderId: req.params.orderId,
      userId: req.user._id,
      allowedStatuses: ["placed", "confirmed"],
      reason: cleanText(req.body.reason) || "Cancelled by customer",
      initiatedBy: "customer",
    });

    return res.status(200).json({
      success: true,
      message: getCancellationMessage(cancelledOrder, "customer"),
      data: {
        order: cancelledOrder,
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
});

module.exports = router;
