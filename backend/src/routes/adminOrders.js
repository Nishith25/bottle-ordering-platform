const express = require("express");
const mongoose = require("mongoose");

const {
  protect,
  allowRoles,
} = require("../middleware/auth");

const Order = require("../models/Order");
const User = require("../models/User");

const {
  cancelOrderWithRefund,
  getCancellationMessage,
  retryOrderRefund,
} = require("../services/orderRefund");

const {
  generateDeliveryOtp,
} = require("../services/deliveryOtp");

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

const PRODUCTION_ORDER_STATUSES = [
  "placed",
  "confirmed",
  "preparing",
  "out_for_delivery",
];

const ALLOWED_TRANSITIONS = {
  placed: [
    "confirmed",
    "cancelled",
  ],

  confirmed: [
    "preparing",
    "cancelled",
  ],

  preparing: [
    "cancelled",
  ],

  out_for_delivery: [],
  delivered: [],
  cancelled: [],
};

const IST_OFFSET_MS =
  5.5 * 60 * 60 * 1000;

function cleanText(value) {
  return String(value ?? "").trim();
}

function escapeRegex(value) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

function getTodayDateIdInIst() {
  return new Date(
    Date.now() + IST_OFFSET_MS
  )
    .toISOString()
    .slice(0, 10);
}

function parseDeliveryDateId(value) {
  const dateId =
    cleanText(value) ||
    getTodayDateIdInIst();

  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      dateId
    );

  if (!match) {
    const error = new Error(
      "Please select a valid delivery date."
    );

    error.statusCode = 400;
    throw error;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const parsedDate =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  if (
    parsedDate.getUTCFullYear() !==
      year ||
    parsedDate.getUTCMonth() !==
      month - 1 ||
    parsedDate.getUTCDate() !==
      day
  ) {
    const error = new Error(
      "Please select a valid delivery date."
    );

    error.statusCode = 400;
    throw error;
  }

  return dateId;
}

function formatAddress(address = {}) {
  return [
    address.houseDetails,
    address.areaDetails,
    address.landmark
      ? `near ${address.landmark}`
      : "",
    address.area,
    address.city,
    address.pincode,
  ]
    .map(cleanText)
    .filter(Boolean)
    .join(", ");
}

function getCustomerName(order) {
  if (
    order.user &&
    typeof order.user === "object" &&
    order.user.fullName
  ) {
    return order.user.fullName;
  }

  return order.deliveryAddress?.fullName || "";
}

function getCustomerPhone(order) {
  if (
    order.user &&
    typeof order.user === "object" &&
    order.user.phone
  ) {
    return order.user.phone;
  }

  return order.deliveryAddress?.phone || "";
}

function getItemValue(item) {
  const storedLineTotal =
    Number(item.lineTotal || 0);

  if (
    Number.isFinite(storedLineTotal) &&
    storedLineTotal > 0
  ) {
    return storedLineTotal;
  }

  return (
    Number(item.price || 0) *
    Number(item.quantity || 0)
  );
}

function buildProductionPlan({
  deliveryDateId,
  orders,
}) {
  const productTotalsMap =
    new Map();

  const slotTotalsMap =
    new Map();

  const packingOrders =
    orders.map((order) => {
      const totalBottles =
        order.items.reduce(
          (total, item) =>
            total +
            Number(item.quantity || 0),
          0
        );

      const slotCode =
        cleanText(
          order.deliverySchedule
            ?.deliverySlotCode
        ) ||
        cleanText(
          order.deliverySchedule
            ?.deliverySlot
        );

      const slotLabel =
        cleanText(
          order.deliverySchedule
            ?.deliverySlot
        ) || "Unspecified slot";

      const slotStartMinutes =
        Number(
          order.deliverySchedule
            ?.deliverySlotStartMinutes ??
            99999
        );

      if (!slotTotalsMap.has(slotCode)) {
        slotTotalsMap.set(slotCode, {
          slotCode,
          slotLabel,
          slotStartMinutes,
          orderCount: 0,
          totalBottles: 0,
        });
      }

      const slotTotal =
        slotTotalsMap.get(slotCode);

      slotTotal.orderCount += 1;
      slotTotal.totalBottles += totalBottles;

      for (const item of order.items) {
        const productId =
          cleanText(item.productId) ||
          String(item.product || "");

        if (!productTotalsMap.has(productId)) {
          productTotalsMap.set(productId, {
            productId,
            name: item.name,
            shortName: item.shortName,
            sizeMl: item.sizeMl,
            totalQuantity: 0,
            totalValue: 0,
          });
        }

        const productTotal =
          productTotalsMap.get(productId);

        productTotal.totalQuantity +=
          Number(item.quantity || 0);

        productTotal.totalValue +=
          getItemValue(item);
      }

      return {
        _id: order._id,
        orderNumber: order.orderNumber,
        orderStatus: order.orderStatus,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        customerName: getCustomerName(order),
        customerPhone: getCustomerPhone(order),
        deliveryDateId:
          order.deliverySchedule
            ?.deliveryDateId ||
          deliveryDateId,
        deliveryDateLabel:
          order.deliverySchedule
            ?.deliveryDateLabel || "",
        deliverySlot: slotLabel,
        deliverySlotCode: slotCode,
        deliverySlotStartMinutes:
          slotStartMinutes,
        addressLine:
          formatAddress(
            order.deliveryAddress
          ),
        deliveryAddress:
          order.deliveryAddress,
        items: order.items.map((item) => ({
          productId: item.productId,
          name: item.name,
          shortName: item.shortName,
          quantity: item.quantity,
          sizeMl: item.sizeMl,
          lineTotal:
            getItemValue(item),
        })),
        totalBottles,
        total: order.total,
        createdAt: order.createdAt,
      };
    });

  const productTotals = [
    ...productTotalsMap.values(),
  ].sort((left, right) =>
    left.name.localeCompare(right.name)
  );

  const slotTotals = [
    ...slotTotalsMap.values(),
  ].sort(
    (left, right) =>
      left.slotStartMinutes -
        right.slotStartMinutes ||
      left.slotLabel.localeCompare(
        right.slotLabel
      )
  );

  return {
    deliveryDateId,

    summary: {
      orderCount: packingOrders.length,

      totalBottles:
        packingOrders.reduce(
          (total, order) =>
            total + order.totalBottles,
          0
        ),

      totalValue:
        packingOrders.reduce(
          (total, order) =>
            total +
            Number(order.total || 0),
          0
        ),

      productCount:
        productTotals.length,

      slotCount:
        slotTotals.length,
    },

    productTotals,
    slotTotals,

    orders:
      packingOrders.sort(
        (left, right) =>
          left.deliverySlotStartMinutes -
            right.deliverySlotStartMinutes ||
          left.orderNumber.localeCompare(
            right.orderNumber
          )
      ),
  };
}

async function findPopulatedOrder(orderId) {
  return Order.findById(orderId)
    .populate(
      "user",
      "fullName email phone role"
    )
    .populate(
      "deliveryPartner",
      "fullName email phone role active"
    )
    .lean();
}

router.get(
  "/production-plan",
  async (req, res, next) => {
    try {
      const deliveryDateId =
        parseDeliveryDateId(
          req.query.date ||
            req.query.deliveryDateId
        );

      const orders =
        await Order.find({
          "deliverySchedule.deliveryDateId":
            deliveryDateId,

          orderStatus: {
            $in:
              PRODUCTION_ORDER_STATUSES,
          },
        })
          .populate(
            "user",
            "fullName email phone role"
          )
          .sort({
            "deliverySchedule.deliverySlotStartMinutes": 1,
            createdAt: 1,
          })
          .lean();

      const plan =
        buildProductionPlan({
          deliveryDateId,
          orders,
        });

      return res.status(200).json({
        success: true,

        data: {
          plan,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

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
                fullName:
                  searchRegex,
              },

              {
                email:
                  searchRegex,
              },

              {
                phone:
                  searchRegex,
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
            "deliveryPartnerSnapshot.fullName":
              searchRegex,
          },

          {
            user: {
              $in:
                matchingUserIds,
            },
          },

          {
            deliveryPartner: {
              $in:
                matchingUserIds,
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
          .populate(
            "deliveryPartner",
            "fullName email phone role active"
          )
          .sort({
            createdAt: -1,
          })
          .limit(250)
          .lean(),

        Order.aggregate([
          {
            $group: {
              _id:
                "$orderStatus",

              count: {
                $sum: 1,
              },
            },
          },
        ]),
      ]);

      const counts =
        ORDER_STATUSES.reduce(
          (
            result,
            orderStatus
          ) => {
            result[orderStatus] = 0;
            return result;
          },
          {}
        );

      for (
        const item of statusBreakdown
      ) {
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

router.patch(
  "/:orderId/status",
  async (req, res, next) => {
    const nextStatus = cleanText(
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

    if (
      nextStatus === "cancelled"
    ) {
      try {
        const cancelledOrder =
          await cancelOrderWithRefund({
            orderId:
              req.params.orderId,

            allowedStatuses: [
              "placed",
              "confirmed",
              "preparing",
            ],

            reason:
              cancellationReason ||
              "Cancelled by administrator",

            initiatedBy: "admin",
          });

        const populatedOrder =
          await findPopulatedOrder(
            cancelledOrder._id
          );

        return res.status(200).json({
          success: true,

          message:
            getCancellationMessage(
              populatedOrder,
              "admin"
            ),

          data: {
            order:
              populatedOrder,
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

    const session =
      await mongoose.startSession();

    try {
      let updatedOrderId = null;
      let message =
        "Order status updated successfully.";

      await session.withTransaction(
        async () => {
          const order =
            await Order.findById(
              req.params.orderId
            ).session(session);

          if (!order) {
            const error = new Error(
              "Order not found."
            );

            error.statusCode = 404;
            throw error;
          }

          if (
            order.orderStatus ===
            nextStatus
          ) {
            updatedOrderId =
              order._id;

            message =
              "Order status is already up to date.";

            return;
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
            const error = new Error(
              `Order cannot move from ${order.orderStatus} to ${nextStatus}. Delivery pickup, out-for-delivery and completion are controlled by the assigned delivery partner.`
            );

            error.statusCode = 400;
            throw error;
          }

          order.orderStatus =
            nextStatus;

          await order.save({
            session,
          });

          updatedOrderId =
            order._id;
        }
      );

      const updatedOrder =
        await findPopulatedOrder(
          updatedOrderId
        );

      return res.status(200).json({
        success: true,
        message,

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

router.patch(
  "/:orderId/delivery-partner",
  async (req, res, next) => {
    const session =
      await mongoose.startSession();

    try {
      const deliveryPartnerId = cleanText(
        req.body.deliveryPartnerId
      );

      if (!deliveryPartnerId) {
        return res.status(400).json({
          success: false,
          message:
            "Please select a delivery partner.",
        });
      }

      let updatedOrderId = null;

      await session.withTransaction(
        async () => {
          const order =
            await Order.findById(
              req.params.orderId
            ).session(session);

          if (!order) {
            const error = new Error(
              "Order not found."
            );
            error.statusCode = 404;
            throw error;
          }

          if (
            [
              "delivered",
              "cancelled",
            ].includes(
              order.orderStatus
            )
          ) {
            const error = new Error(
              "Delivered or cancelled orders cannot be assigned."
            );
            error.statusCode = 400;
            throw error;
          }

          if (
            order.orderStatus ===
            "placed"
          ) {
            const error = new Error(
              "Confirm the order before assigning a delivery partner."
            );
            error.statusCode = 400;
            throw error;
          }

          const partner =
            await User.findOne({
              _id: deliveryPartnerId,
              role: "delivery",
              active: true,
            }).session(session);

          if (!partner) {
            const error = new Error(
              "The selected delivery partner is unavailable."
            );
            error.statusCode = 404;
            throw error;
          }

          order.deliveryPartner =
            partner._id;

          order.deliveryPartnerSnapshot = {
            fullName:
              partner.fullName,
            email:
              partner.email,
            phone:
              partner.phone,
          };

          order.deliveryStatus =
            "assigned";

          order.deliveryAssignedAt =
            new Date();

          order.pickedUpAt = null;
          order.outForDeliveryAt = null;
          order.deliveryCompletedAt = null;

          if (
            order.orderStatus ===
            "out_for_delivery"
          ) {
            order.orderStatus =
              "preparing";
          }

          generateDeliveryOtp(order);

          await order.save({
            session,
          });

          updatedOrderId =
            order._id;
        }
      );

      const updatedOrder =
        await findPopulatedOrder(
          updatedOrderId
        );

      return res.status(200).json({
        success: true,
        message:
          "Delivery partner assigned successfully. A new customer delivery OTP was generated.",
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
          message:
            "Order or delivery partner not found.",
        });
      }

      return next(error);
    } finally {
      await session.endSession();
    }
  }
);

router.post(
  "/:orderId/refund/retry",
  async (req, res, next) => {
    try {
      const order =
        await retryOrderRefund({
          orderId:
            req.params.orderId,

          initiatedBy: "admin",
        });

      const populatedOrder =
        await findPopulatedOrder(
          order._id
        );

      let message =
        "Refund retry submitted.";

      if (
        populatedOrder.refundStatus ===
        "processed"
      ) {
        message =
          "Refund processed successfully.";
      } else if (
        populatedOrder.refundStatus ===
        "failed"
      ) {
        message =
          populatedOrder.refundFailureReason ||
          "Refund retry failed.";
      }

      return res.status(200).json({
        success: true,
        message,

        data: {
          order:
            populatedOrder,
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

module.exports = router;