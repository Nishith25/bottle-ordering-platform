const express = require("express");

const {
  protect,
  allowRoles,
} = require("../middleware/auth");

const CashCollection = require("../models/CashCollection");
const Order = require("../models/Order");

let logAdminActivity = async () => {};

try {
  ({
    logAdminActivity,
  } = require("../services/adminActivityLogger"));
} catch {
  logAdminActivity = async () => {};
}

const router = express.Router();

router.use(protect);
router.use(allowRoles("admin"));

const ACTIVE_DELIVERY_STATUSES = [
  "assigned",
  "picked_up",
  "out_for_delivery",
];

const AVAILABLE_ORDER_STATUSES = [
  "placed",
  "confirmed",
  "preparing",
];

function cleanText(value) {
  return String(value || "").trim();
}

function parseNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

function setLoose(document, key, value) {
  document.set(
    key,
    value,
    undefined,
    {
      strict: false,
    }
  );
}

function getDateIdInIndia() {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(new Date());
}

function getDayRangeInIndia(dateId) {
  return {
    start:
      new Date(`${dateId}T00:00:00.000+05:30`),

    end:
      new Date(`${dateId}T23:59:59.999+05:30`),
  };
}

function getBottleCount(order) {
  return Array.isArray(order.items)
    ? order.items.reduce(
        (total, item) =>
          total +
          Number(item.quantity || 0),
        0
      )
    : 0;
}

function buildAvailableDeliveryQuery() {
  return {
    orderStatus: {
      $in: AVAILABLE_ORDER_STATUSES,
    },

    $and: [
      {
        $or: [
          {
            deliveryPartner: null,
          },
          {
            deliveryPartner: {
              $exists: false,
            },
          },
        ],
      },

      {
        $or: [
          {
            deliveryStatus: "unassigned",
          },
          {
            deliveryStatus: "",
          },
          {
            deliveryStatus: null,
          },
          {
            deliveryStatus: {
              $exists: false,
            },
          },
        ],
      },

      {
        $or: [
          {
            paymentMethod: "cod",
          },
          {
            paymentStatus: "paid",
          },
        ],
      },
    ],
  };
}

function buildPartnerSnapshot(partner) {
  if (!partner || typeof partner !== "object") {
    return {
      id: "",
      fullName: "Unassigned",
      email: "",
      phone: "",
    };
  }

  return {
    id:
      String(partner._id || partner.id || ""),

    fullName:
      cleanText(partner.fullName) ||
      "Delivery partner",

    email:
      cleanText(partner.email),

    phone:
      cleanText(partner.phone),
  };
}

function buildPartnerSummaries({
  activeOrders,
  deliveredToday,
}) {
  const map =
    new Map();

  function ensurePartner(partner) {
    const snapshot =
      buildPartnerSnapshot(partner);

    const key =
      snapshot.id || "unknown";

    if (!map.has(key)) {
      map.set(key, {
        partner:
          snapshot,

        assignedCount:
          0,

        pickedUpCount:
          0,

        outForDeliveryCount:
          0,

        activeCount:
          0,

        failedAttemptCount:
          0,

        pendingCodAmount:
          0,

        pendingCodCount:
          0,

        deliveredTodayCount:
          0,

        deliveredBottleCountToday:
          0,

        codCollectedToday:
          0,
      });
    }

    return map.get(key);
  }

  for (const order of activeOrders) {
    const row =
      ensurePartner(order.deliveryPartner);

    row.activeCount += 1;

    if (
      order.deliveryStatus ===
      "assigned"
    ) {
      row.assignedCount += 1;
    }

    if (
      order.deliveryStatus ===
      "picked_up"
    ) {
      row.pickedUpCount += 1;
    }

    if (
      order.deliveryStatus ===
      "out_for_delivery"
    ) {
      row.outForDeliveryCount += 1;
    }

    if (
      order.lastDeliveryAttemptStatus ===
      "failed"
    ) {
      row.failedAttemptCount += 1;
    }

    if (
      order.paymentMethod === "cod" &&
      order.paymentStatus !== "paid"
    ) {
      row.pendingCodCount += 1;
      row.pendingCodAmount +=
        Number(order.total || 0);
    }
  }

  for (const order of deliveredToday) {
    const row =
      ensurePartner(order.deliveryPartner);

    row.deliveredTodayCount += 1;
    row.deliveredBottleCountToday +=
      getBottleCount(order);

    if (
      order.paymentMethod === "cod"
    ) {
      row.codCollectedToday +=
        Number(
          order.codCollectedAmount ||
            order.total ||
            0
        );
    }
  }

  return Array.from(map.values()).sort(
    (a, b) =>
      b.activeCount -
        a.activeCount ||
      b.pendingCodAmount -
        a.pendingCodAmount
  );
}

/**
 * GET /api/admin/delivery-control/summary
 */
router.get(
  "/summary",
  async (req, res, next) => {
    try {
      const dateId =
        cleanText(req.query.date) ||
        getDateIdInIndia();

      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(
          dateId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Please select a valid date.",
        });
      }

      const dayRange =
        getDayRangeInIndia(dateId);

      const [
        openPoolOrders,
        activeOrders,
        failedOrders,
        deliveredToday,
        collectedCashRows,
      ] = await Promise.all([
        Order.find(
          buildAvailableDeliveryQuery()
        )
          .populate(
            "user",
            "fullName phone"
          )
          .sort({
            "deliverySchedule.deliveryDateId": 1,
            createdAt: 1,
          })
          .limit(200)
          .lean(),

        Order.find({
          deliveryPartner: {
            $exists: true,
            $ne: null,
          },

          deliveryStatus: {
            $in: ACTIVE_DELIVERY_STATUSES,
          },

          orderStatus: {
            $ne: "cancelled",
          },
        })
          .populate(
            "user",
            "fullName phone"
          )
          .populate(
            "deliveryPartner",
            "fullName email phone role active"
          )
          .sort({
            "deliverySchedule.deliveryDateId": 1,
            createdAt: 1,
          })
          .limit(300)
          .lean(),

        Order.find({
          deliveryPartner: {
            $exists: true,
            $ne: null,
          },

          lastDeliveryAttemptStatus:
            "failed",

          orderStatus: {
            $nin: [
              "cancelled",
              "delivered",
            ],
          },
        })
          .populate(
            "user",
            "fullName phone"
          )
          .populate(
            "deliveryPartner",
            "fullName email phone role active"
          )
          .sort({
            failedDeliveryAt: -1,
            updatedAt: -1,
          })
          .limit(100)
          .lean(),

        Order.find({
          deliveryPartner: {
            $exists: true,
            $ne: null,
          },

          orderStatus:
            "delivered",

          deliveryStatus:
            "delivered",

          $or: [
            {
              deliveredAt: {
                $gte:
                  dayRange.start,
                $lte:
                  dayRange.end,
              },
            },
            {
              deliveryCompletedAt: {
                $gte:
                  dayRange.start,
                $lte:
                  dayRange.end,
              },
            },
            {
              codCollectedAt: {
                $gte:
                  dayRange.start,
                $lte:
                  dayRange.end,
              },
            },
          ],
        })
          .populate(
            "user",
            "fullName phone"
          )
          .populate(
            "deliveryPartner",
            "fullName email phone role active"
          )
          .sort({
            deliveryCompletedAt: -1,
            deliveredAt: -1,
          })
          .limit(200)
          .lean(),

        CashCollection.find({
          status: {
            $in: [
              "collected",
              "short_collected",
            ],
          },
        }).lean(),
      ]);

      const pendingCodOrders =
        activeOrders.filter(
          (order) =>
            order.paymentMethod ===
              "cod" &&
            order.paymentStatus !==
              "paid"
        );

      const pendingCodAmount =
        pendingCodOrders.reduce(
          (total, order) =>
            total +
            Number(order.total || 0),
          0
        );

      const codCollectedToday =
        deliveredToday
          .filter(
            (order) =>
              order.paymentMethod ===
              "cod"
          )
          .reduce(
            (total, order) =>
              total +
              Number(
                order.codCollectedAmount ||
                  order.total ||
                  0
              ),
            0
          );

      const pendingCashHandoverAmount =
        collectedCashRows.reduce(
          (total, row) =>
            total +
            Number(
              row.amountCollected || 0
            ),
          0
        );

      const partnerSummaries =
        buildPartnerSummaries({
          activeOrders,
          deliveredToday,
        });

      return res.status(200).json({
        success: true,

        data: {
          dateId,

          summary: {
            openPoolCount:
              openPoolOrders.length,

            activeDeliveryCount:
              activeOrders.length,

            assignedCount:
              activeOrders.filter(
                (order) =>
                  order.deliveryStatus ===
                  "assigned"
              ).length,

            pickedUpCount:
              activeOrders.filter(
                (order) =>
                  order.deliveryStatus ===
                  "picked_up"
              ).length,

            outForDeliveryCount:
              activeOrders.filter(
                (order) =>
                  order.deliveryStatus ===
                  "out_for_delivery"
              ).length,

            failedAttemptCount:
              failedOrders.length,

            deliveredTodayCount:
              deliveredToday.length,

            deliveredBottleCountToday:
              deliveredToday.reduce(
                (total, order) =>
                  total +
                  getBottleCount(order),
                0
              ),

            pendingCodOrderCount:
              pendingCodOrders.length,

            pendingCodAmount,

            codCollectedToday,

            pendingCashHandoverAmount,

            pendingCashHandoverCount:
              collectedCashRows.length,
          },

          openPoolOrders,
          activeOrders,
          failedOrders,
          deliveredToday,
          partnerSummaries,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * PATCH /api/admin/delivery-control/orders/:orderId/release-to-pool
 */
router.patch(
  "/orders/:orderId/release-to-pool",
  async (req, res, next) => {
    try {
      const reason =
        cleanText(
          req.body.reason
        ).slice(0, 400);

      const order =
        await Order.findOne({
          _id:
            req.params.orderId,

          deliveryPartner: {
            $exists: true,
            $ne: null,
          },

          orderStatus: {
            $nin: [
              "cancelled",
              "delivered",
            ],
          },
        })
          .populate(
            "deliveryPartner",
            "fullName email phone role active"
          );

      if (!order) {
        return res.status(404).json({
          success: false,
          message:
            "Active accepted delivery order not found.",
        });
      }

      const previousPartner =
        order.deliveryPartner;

      order.deliveryPartner = null;
      order.deliveryStatus = "unassigned";

      if (
        [
          "preparing",
          "out_for_delivery",
        ].includes(
          order.orderStatus
        )
      ) {
        order.orderStatus =
          "confirmed";
      }

      setLoose(
        order,
        "deliveryReleasedAt",
        new Date()
      );

      setLoose(
        order,
        "deliveryReleasedBy",
        req.user._id
      );

      setLoose(
        order,
        "deliveryReleaseReason",
        reason
      );

      setLoose(
        order,
        "lastDeliveryAttemptStatus",
        ""
      );

      await order.save();

      const updatedOrder =
        await Order.findById(
          order._id
        )
          .populate(
            "user",
            "fullName phone"
          )
          .populate(
            "deliveryPartner",
            "fullName email phone role active"
          )
          .lean();

      await logAdminActivity({
        req,
        actor:
          req.user,

        actionType:
          "delivery_order_released",

        actionLabel:
          "Released delivery order back to pool",

        severity:
          "warning",

        entityType:
          "order",

        entityId:
          order._id,

        entityLabel:
          order.orderNumber,

        message:
          `${order.orderNumber} was released from ${previousPartner?.fullName || "delivery partner"} back to the open delivery pool.`,

        metadata: {
          reason,
          previousPartner:
            previousPartner
              ? {
                  id:
                    previousPartner._id,
                  fullName:
                    previousPartner.fullName,
                  phone:
                    previousPartner.phone,
                  email:
                    previousPartner.email,
                }
              : null,
        },
      });

      return res.status(200).json({
        success: true,
        message:
          "Order released back to open delivery pool.",

        data: {
          order:
            updatedOrder,
        },
      });
    } catch (error) {
      if (error.name === "CastError") {
        return res.status(404).json({
          success: false,
          message:
            "Delivery order not found.",
        });
      }

      return next(error);
    }
  }
);

/**
 * PATCH /api/admin/delivery-control/orders/:orderId/admin-note
 */
router.patch(
  "/orders/:orderId/admin-note",
  async (req, res, next) => {
    try {
      const note =
        cleanText(
          req.body.note
        ).slice(0, 1000);

      const order =
        await Order.findById(
          req.params.orderId
        );

      if (!order) {
        return res.status(404).json({
          success: false,
          message:
            "Delivery order not found.",
        });
      }

      setLoose(
        order,
        "deliveryAdminNote",
        note
      );

      setLoose(
        order,
        "deliveryAdminNoteUpdatedAt",
        new Date()
      );

      setLoose(
        order,
        "deliveryAdminNoteBy",
        req.user._id
      );

      await order.save();

      const updatedOrder =
        await Order.findById(
          order._id
        )
          .populate(
            "user",
            "fullName phone"
          )
          .populate(
            "deliveryPartner",
            "fullName email phone role active"
          )
          .lean();

      await logAdminActivity({
        req,
        actor:
          req.user,

        actionType:
          "delivery_admin_note_updated",

        actionLabel:
          "Updated delivery admin note",

        severity:
          "info",

        entityType:
          "order",

        entityId:
          order._id,

        entityLabel:
          order.orderNumber,

        message:
          `Delivery admin note updated for ${order.orderNumber}.`,

        metadata: {
          note,
        },
      });

      return res.status(200).json({
        success: true,
        message:
          "Delivery admin note saved.",

        data: {
          order:
            updatedOrder,
        },
      });
    } catch (error) {
      if (error.name === "CastError") {
        return res.status(404).json({
          success: false,
          message:
            "Delivery order not found.",
        });
      }

      return next(error);
    }
  }
);

module.exports = router;