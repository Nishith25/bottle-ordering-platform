// backend/src/routes/adminProductionControl.js

const express = require("express");

const {
  protect,
  allowRoles,
} = require("../middleware/auth");

const AdminActivityLog = require("../models/AdminActivityLog");
const AdminNotification = require("../models/AdminNotification");
const CashCollection = require("../models/CashCollection");
const CustomerFollowUp = require("../models/CustomerFollowUp");
const Order = require("../models/Order");
const Product = require("../models/Product");

const router = express.Router();

router.use(protect);
router.use(allowRoles("admin"));

const ACTIVE_ORDER_STATUSES = [
  "placed",
  "confirmed",
  "preparing",
  "out_for_delivery",
  "delivered",
];

function cleanText(value) {
  return String(value ?? "").trim();
}

function getDateIdInIndia(offsetDays = 0) {
  const now = new Date();

  now.setDate(
    now.getDate() + offsetDays
  );

  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(now);
}

function parseDateId(value) {
  const dateId =
    cleanText(value) ||
    getDateIdInIndia();

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      dateId
    )
  ) {
    const error = new Error(
      "Please select a valid date."
    );

    error.statusCode = 400;
    throw error;
  }

  return dateId;
}

function getDayRangeInIndia(dateId) {
  return {
    start:
      new Date(`${dateId}T00:00:00.000+05:30`),

    end:
      new Date(`${dateId}T23:59:59.999+05:30`),
  };
}

function getTodayFollowUpRange() {
  const dateId =
    getDateIdInIndia();

  return getDayRangeInIndia(dateId);
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

function getCustomerName(order) {
  return (
    cleanText(order.customerSnapshot?.fullName) ||
    cleanText(order.customerSnapshot?.name) ||
    cleanText(order.deliveryAddress?.fullName) ||
    cleanText(order.deliveryAddress?.name) ||
    cleanText(order.user?.fullName) ||
    cleanText(order.user?.name) ||
    "Customer"
  );
}

function getCustomerPhone(order) {
  return (
    cleanText(order.deliveryAddress?.phone) ||
    cleanText(order.customerSnapshot?.phone) ||
    cleanText(order.user?.phone) ||
    cleanText(order.user?.mobile) ||
    ""
  );
}

function serializeOrderBrief(order) {
  return {
    _id:
      String(order._id),

    orderNumber:
      order.orderNumber,

    customerName:
      getCustomerName(order),

    customerPhone:
      getCustomerPhone(order),

    orderStatus:
      order.orderStatus,

    paymentMethod:
      order.paymentMethod,

    paymentStatus:
      order.paymentStatus,

    refundStatus:
      order.refundStatus || "not_required",

    refundFailureReason:
      order.refundFailureReason || "",

    total:
      Number(order.total || 0),

    bottleCount:
      getBottleCount(order),

    deliveryDateId:
      order.deliverySchedule?.deliveryDateId ||
      "",

    deliveryDateLabel:
      order.deliverySchedule?.deliveryDateLabel ||
      "",

    deliverySlot:
      order.deliverySchedule?.deliverySlot ||
      order.deliverySchedule?.slotLabel ||
      "",

    createdAt:
      order.createdAt,

    updatedAt:
      order.updatedAt,
  };
}

function serializeProduct(product) {
  return {
    _id:
      String(product._id),

    productId:
      product.productId,

    name:
      product.name,

    shortName:
      product.shortName || product.name,

    stockQuantity:
      Number(product.stockQuantity || 0),

    lowStockThreshold:
      Number(product.lowStockThreshold || 0),

    active:
      product.active !== false,
  };
}

function serializeCashCollection(collection) {
  return {
    _id:
      String(collection._id),

    order:
      String(collection.order),

    orderNumber:
      collection.orderNumber,

    amountDue:
      Number(collection.amountDue || 0),

    amountCollected:
      Number(collection.amountCollected || 0),

    status:
      collection.status,

    collectedAt:
      collection.collectedAt || null,

    handedOverAt:
      collection.handedOverAt || null,

    notes:
      collection.notes || "",
  };
}

function sumOrders(orders) {
  return orders.reduce(
    (total, order) =>
      total +
      Number(order.total || 0),
    0
  );
}

function sumCash(collections) {
  return collections.reduce(
    (total, collection) =>
      total +
      Number(
        collection.amountCollected || 0
      ),
    0
  );
}

function buildChecklist({
  ordersNeedingConfirmation,
  failedRefunds,
  lowStockProducts,
  outOfStockProducts,
  pendingCodOrders,
  pendingCashHandoverCollections,
  overdueFollowUps,
  unreadNotifications,
  todaysOrders,
}) {
  return [
    {
      key: "orders_needing_confirmation",
      label:
        "Orders needing confirmation",
      status:
        ordersNeedingConfirmation > 0
          ? "warning"
          : "ok",
      count:
        ordersNeedingConfirmation,
      message:
        ordersNeedingConfirmation > 0
          ? "Confirm these before production starts."
          : "No pending confirmations.",
      route:
        "/orders?status=placed",
    },
    {
      key: "failed_refunds",
      label:
        "Failed refunds",
      status:
        failedRefunds > 0
          ? "danger"
          : "ok",
      count:
        failedRefunds,
      message:
        failedRefunds > 0
          ? "Retry failed refunds immediately."
          : "No failed refunds.",
      route:
        "/orders?search=refund",
    },
    {
      key: "low_stock",
      label:
        "Low-stock products",
      status:
        outOfStockProducts > 0
          ? "danger"
          : lowStockProducts > 0
            ? "warning"
            : "ok",
      count:
        lowStockProducts,
      message:
        outOfStockProducts > 0
          ? "Some products are out of stock."
          : lowStockProducts > 0
            ? "Some products are below threshold."
            : "Stock levels are healthy.",
      route:
        "/products",
    },
    {
      key: "pending_cod",
      label:
        "Pending COD",
      status:
        pendingCodOrders > 0
          ? "warning"
          : "ok",
      count:
        pendingCodOrders,
      message:
        pendingCodOrders > 0
          ? "Track COD collection before closing."
          : "No pending COD orders.",
      route:
        "/operations",
    },
    {
      key: "cash_handover",
      label:
        "Cash handover pending",
      status:
        pendingCashHandoverCollections > 0
          ? "warning"
          : "ok",
      count:
        pendingCashHandoverCollections,
      message:
        pendingCashHandoverCollections > 0
          ? "Collected cash still needs handover."
          : "No handover pending.",
      route:
        "/operations",
    },
    {
      key: "overdue_followups",
      label:
        "Overdue follow-ups",
      status:
        overdueFollowUps > 0
          ? "warning"
          : "ok",
      count:
        overdueFollowUps,
      message:
        overdueFollowUps > 0
          ? "Close overdue customer follow-ups."
          : "No overdue follow-ups.",
      route:
        "/follow-ups?status=overdue",
    },
    {
      key: "unread_notifications",
      label:
        "Unread admin alerts",
      status:
        unreadNotifications > 0
          ? "warning"
          : "ok",
      count:
        unreadNotifications,
      message:
        unreadNotifications > 0
          ? "Review unread admin alerts."
          : "No unread admin alerts.",
      route:
        "/notifications",
    },
    {
      key: "todays_load",
      label:
        "Today’s delivery load",
      status:
        todaysOrders > 0
          ? "ok"
          : "warning",
      count:
        todaysOrders,
      message:
        todaysOrders > 0
          ? "Today has active delivery work."
          : "No active delivery orders for today.",
      route:
        "/operations",
    },
  ];
}

router.get(
  "/summary",
  async (req, res, next) => {
    try {
      const dateId =
        parseDateId(req.query.date);

      const dayRange =
        getDayRangeInIndia(dateId);

      const todayFollowUpRange =
        getTodayFollowUpRange();

      const now =
        new Date();

      const last24Hours =
        new Date(
          Date.now() -
            24 * 60 * 60 * 1000
        );

      const [
        todaysOrders,
        ordersNeedingConfirmation,
        failedRefundOrders,
        pendingCodOrders,
        pendingCashHandoverCollections,
        collectedTodayCollections,
        handedOverTodayCollections,
        allProducts,
        overdueFollowUpCount,
        todayFollowUpCount,
        unreadNotificationCount,
        dangerNotificationCount,
        activityLast24Hours,
        salesTodayOrders,
        deliveredTodayCount,
      ] = await Promise.all([
        Order.find({
          orderStatus: {
            $in:
              ACTIVE_ORDER_STATUSES,
          },
          "deliverySchedule.deliveryDateId":
            dateId,
        })
          .sort({
            "deliverySchedule.deliverySlotStartMinutes": 1,
            "deliverySchedule.startMinutes": 1,
            createdAt: 1,
          })
          .limit(200)
          .lean(),

        Order.find({
          orderStatus:
            "placed",
        })
          .sort({
            createdAt: 1,
          })
          .limit(50)
          .lean(),

        Order.find({
          refundStatus:
            "failed",
        })
          .sort({
            refundFailedAt: -1,
            updatedAt: -1,
          })
          .limit(30)
          .lean(),

        Order.find({
          paymentMethod:
            "cod",
          paymentStatus: {
            $ne:
              "paid",
          },
          orderStatus: {
            $ne:
              "cancelled",
          },
        })
          .sort({
            createdAt: 1,
          })
          .limit(500)
          .lean(),

        CashCollection.find({
          status: {
            $in: [
              "collected",
              "short_collected",
            ],
          },
        })
          .sort({
            collectedAt: -1,
            createdAt: -1,
          })
          .limit(300)
          .lean(),

        CashCollection.find({
          collectedAt: {
            $gte:
              dayRange.start,
            $lte:
              dayRange.end,
          },
        })
          .sort({
            collectedAt: -1,
          })
          .limit(500)
          .lean(),

        CashCollection.find({
          status:
            "handed_over",
          handedOverAt: {
            $gte:
              dayRange.start,
            $lte:
              dayRange.end,
          },
        })
          .sort({
            handedOverAt: -1,
          })
          .limit(500)
          .lean(),

        Product.find({
          active: {
            $ne:
              false,
          },
        })
          .sort({
            name: 1,
          })
          .lean(),

        CustomerFollowUp.countDocuments({
          active: true,
          status: "pending",
          dueAt: {
            $lt:
              now,
          },
        }),

        CustomerFollowUp.countDocuments({
          active: true,
          status: "pending",
          dueAt: {
            $gte:
              todayFollowUpRange.start,
            $lte:
              todayFollowUpRange.end,
          },
        }),

        AdminNotification.countDocuments({
          active: true,
          readAt:
            null,
        }),

        AdminNotification.countDocuments({
          active: true,
          readAt:
            null,
          severity:
            "danger",
        }),

        AdminActivityLog.countDocuments({
          active: true,
          createdAt: {
            $gte:
              last24Hours,
          },
        }),

        Order.find({
          createdAt: {
            $gte:
              dayRange.start,
            $lte:
              dayRange.end,
          },
          orderStatus: {
            $ne:
              "cancelled",
          },
        })
          .limit(1000)
          .lean(),

        Order.countDocuments({
          orderStatus:
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
          ],
        }),
      ]);

      const productList =
        allProducts.map(
          serializeProduct
        );

      const lowStockProducts =
        productList.filter(
          (product) =>
            product.stockQuantity <=
            product.lowStockThreshold
        );

      const outOfStockProducts =
        productList.filter(
          (product) =>
            product.stockQuantity <= 0
        );

      const todaysOrderBriefs =
        todaysOrders.map(
          serializeOrderBrief
        );

      const pendingCodAmount =
        sumOrders(pendingCodOrders);

      const salesTodayAmount =
        sumOrders(salesTodayOrders);

      const bottlesToday =
        salesTodayOrders.reduce(
          (total, order) =>
            total +
            getBottleCount(order),
          0
        );

      const codCollectedToday =
        sumCash(
          collectedTodayCollections
        );

      const cashHandedOverToday =
        sumCash(
          handedOverTodayCollections
        );

      const pendingHandoverAmount =
        sumCash(
          pendingCashHandoverCollections
        );

      const checklist =
        buildChecklist({
          ordersNeedingConfirmation:
            ordersNeedingConfirmation.length,
          failedRefunds:
            failedRefundOrders.length,
          lowStockProducts:
            lowStockProducts.length,
          outOfStockProducts:
            outOfStockProducts.length,
          pendingCodOrders:
            pendingCodOrders.length,
          pendingCashHandoverCollections:
            pendingCashHandoverCollections.length,
          overdueFollowUps:
            overdueFollowUpCount,
          unreadNotifications:
            unreadNotificationCount,
          todaysOrders:
            todaysOrders.length,
        });

      return res.status(200).json({
        success: true,

        data: {
          dateId,

          generatedAt:
            new Date()
              .toISOString(),

          checklist,

          summary: {
            todaysOrders:
              todaysOrders.length,

            todaysBottles:
              todaysOrderBriefs.reduce(
                (total, order) =>
                  total +
                  Number(
                    order.bottleCount || 0
                  ),
                0
              ),

            ordersNeedingConfirmation:
              ordersNeedingConfirmation.length,

            failedRefunds:
              failedRefundOrders.length,

            pendingCodOrders:
              pendingCodOrders.length,

            pendingCodAmount,

            pendingCashHandoverCollections:
              pendingCashHandoverCollections.length,

            pendingHandoverAmount,

            lowStockProducts:
              lowStockProducts.length,

            outOfStockProducts:
              outOfStockProducts.length,

            overdueFollowUps:
              overdueFollowUpCount,

            todayFollowUps:
              todayFollowUpCount,

            unreadNotifications:
              unreadNotificationCount,

            dangerNotifications:
              dangerNotificationCount,

            activityLast24Hours,
          },

          dailyClosing: {
            dateId,
            createdOrderCount:
              salesTodayOrders.length,

            deliveredOrderCount:
              deliveredTodayCount,

            salesTodayAmount,

            bottlesSoldToday:
              bottlesToday,

            codCollectedToday,

            cashHandedOverToday,

            pendingCodAmount,

            pendingHandoverAmount,

            failedRefundCount:
              failedRefundOrders.length,
          },

          todaysOrders:
            todaysOrderBriefs,

          ordersNeedingConfirmation:
            ordersNeedingConfirmation.map(
              serializeOrderBrief
            ),

          failedRefundOrders:
            failedRefundOrders.map(
              serializeOrderBrief
            ),

          pendingCodOrders:
            pendingCodOrders
              .slice(0, 50)
              .map(
                serializeOrderBrief
              ),

          pendingCashHandoverCollections:
            pendingCashHandoverCollections.map(
              serializeCashCollection
            ),

          lowStockProducts,

          outOfStockProducts,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = router;