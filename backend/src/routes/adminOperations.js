const express = require("express");

const {
  protect,
  allowRoles,
} = require("../middleware/auth");

const Order = require("../models/Order");
const CashCollection = require("../models/CashCollection");

const router = express.Router();

router.use(protect);
router.use(allowRoles("admin"));

const ACTIVE_OPERATION_STATUSES = [
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

function buildUserSnapshot(user) {
  return {
    fullName:
      cleanText(user?.fullName) ||
      cleanText(user?.name) ||
      "Admin",

    email:
      cleanText(user?.email).toLowerCase(),

    role:
      cleanText(user?.role) ||
      "admin",
  };
}

function getCustomerName(order) {
  return (
    cleanText(order.customerSnapshot?.fullName) ||
    cleanText(order.customerSnapshot?.name) ||
    cleanText(order.deliveryAddress?.fullName) ||
    cleanText(order.deliveryAddress?.name) ||
    cleanText(order.customerName) ||
    cleanText(order.user?.fullName) ||
    cleanText(order.user?.name) ||
    "Customer"
  );
}

function getCustomerPhone(order) {
  return (
    cleanText(order.deliveryAddress?.phone) ||
    cleanText(order.customerSnapshot?.phone) ||
    cleanText(order.customerPhone) ||
    cleanText(order.user?.phone) ||
    cleanText(order.user?.mobile) ||
    ""
  );
}

function getDeliverySlotLabel(order) {
  return (
    cleanText(order.deliverySchedule?.slotLabel) ||
    cleanText(order.deliverySchedule?.deliverySlotLabel) ||
    cleanText(order.deliverySchedule?.slot) ||
    cleanText(order.deliverySlotLabel) ||
    "Slot not selected"
  );
}

function getDeliveryDateId(order) {
  return (
    cleanText(order.deliverySchedule?.deliveryDateId) ||
    cleanText(order.deliveryDateId) ||
    ""
  );
}

function getDeliveryPartnerName(order) {
  return (
    cleanText(order.deliveryPartnerSnapshot?.fullName) ||
    cleanText(order.deliveryPartnerSnapshot?.name) ||
    cleanText(order.assignedDeliveryPartnerSnapshot?.fullName) ||
    cleanText(order.assignedDeliveryPartnerSnapshot?.name) ||
    cleanText(order.deliveryAssignment?.partnerName) ||
    cleanText(order.deliveryAssignment?.fullName) ||
    "Not assigned"
  );
}

function formatAddress(address) {
  if (!address) {
    return "";
  }

  if (typeof address === "string") {
    return address;
  }

  const parts = [
    address.flat,
    address.house,
    address.houseNumber,
    address.apartment,
    address.building,
    address.street,
    address.area,
    address.landmark
      ? `Landmark: ${address.landmark}`
      : "",
    address.city,
    address.state,
    address.pincode,
  ]
    .map(cleanText)
    .filter(Boolean);

  return parts.join(", ");
}

function getAddress(order) {
  return (
    formatAddress(
      order.deliveryAddress
    ) ||
    formatAddress(order.address) ||
    cleanText(order.customerAddress) ||
    ""
  );
}

function getOrderItems(order) {
  return (order.items || []).map(
    (item) => {
      const quantity =
        Number(item.quantity || 0);

      const price =
        Number(item.price || 0);

      const lineTotal =
        Number(
          item.lineTotal ||
            price * quantity
        );

      return {
        productId:
          cleanText(item.productId) ||
          cleanText(item.product),

        name:
          cleanText(item.name) ||
          cleanText(item.productName) ||
          "Bottle",

        shortName:
          cleanText(item.shortName) ||
          cleanText(item.name) ||
          "Bottle",

        sizeMl:
          Number(item.sizeMl || 0),

        quantity,

        price,

        lineTotal,
      };
    }
  );
}

function normalizeCollection(collection) {
  if (!collection) {
    return null;
  }

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
      collection.collectedAt,

    collectedBySnapshot:
      collection.collectedBySnapshot ||
      null,

    handedOverAt:
      collection.handedOverAt,

    handedOverBySnapshot:
      collection.handedOverBySnapshot ||
      null,

    notes:
      collection.notes || "",

    createdAt:
      collection.createdAt,

    updatedAt:
      collection.updatedAt,
  };
}

function normalizeOrder(
  order,
  collection
) {
  return {
    _id:
      String(order._id),

    orderNumber:
      order.orderNumber,

    customerName:
      getCustomerName(order),

    customerPhone:
      getCustomerPhone(order),

    address:
      getAddress(order),

    deliveryDateId:
      getDeliveryDateId(order),

    deliverySlotLabel:
      getDeliverySlotLabel(order),

    deliveryPartnerName:
      getDeliveryPartnerName(order),

    items:
      getOrderItems(order),

    subtotal:
      Number(order.subtotal || 0),

    deliveryFee:
      Number(order.deliveryFee || 0),

    couponDiscount:
      Number(order.couponDiscount || 0),

    total:
      Number(order.total || 0),

    paymentMethod:
      order.paymentMethod || "cod",

    paymentStatus:
      order.paymentStatus || "pending",

    orderStatus:
      order.orderStatus,

    deliveryStatus:
      order.deliveryStatus,

    createdAt:
      order.createdAt,

    updatedAt:
      order.updatedAt,

    cashCollection:
      normalizeCollection(collection),
  };
}

function buildSummary(orders) {
  const summary = {
    orderCount: orders.length,
    bottleCount: 0,
    codOrderCount: 0,
    codAmount: 0,
    codCollectedAmount: 0,
    codPendingAmount: 0,
    onlineOrderCount: 0,
    onlineAmount: 0,
    deliveredCount: 0,
    packingSlipCount: orders.length,
  };

  for (const order of orders) {
    const bottleCount =
      order.items.reduce(
        (total, item) =>
          total +
          Number(item.quantity || 0),
        0
      );

    summary.bottleCount += bottleCount;

    if (
      order.orderStatus === "delivered"
    ) {
      summary.deliveredCount += 1;
    }

    if (
      order.paymentMethod === "online"
    ) {
      summary.onlineOrderCount += 1;
      summary.onlineAmount +=
        Number(order.total || 0);
      continue;
    }

    summary.codOrderCount += 1;
    summary.codAmount +=
      Number(order.total || 0);

    const collected =
      Number(
        order.cashCollection
          ?.amountCollected || 0
      );

    summary.codCollectedAmount +=
      collected;

    summary.codPendingAmount +=
      Math.max(
        Number(order.total || 0) -
          collected,
        0
      );
  }

  return summary;
}

router.get(
  "/packing-cod",
  async (req, res, next) => {
    try {
      const dateId =
        parseDateId(req.query.date);

      const orders =
        await Order.find({
          orderStatus: {
            $in: ACTIVE_OPERATION_STATUSES,
          },

          "deliverySchedule.deliveryDateId":
            dateId,
        })
          .populate({
            path: "user",
            select:
              "fullName name email phone mobile",
            options: {
              strictPopulate: false,
            },
          })
          .sort({
            "deliverySchedule.startMinutes": 1,
            createdAt: 1,
          })
          .lean();

      const orderIds =
        orders.map(
          (order) => order._id
        );

      const collections =
        await CashCollection.find({
          order: {
            $in: orderIds,
          },
        }).lean();

      const collectionMap =
        new Map(
          collections.map(
            (collection) => [
              String(collection.order),
              collection,
            ]
          )
        );

      const normalizedOrders =
        orders.map((order) =>
          normalizeOrder(
            order,
            collectionMap.get(
              String(order._id)
            )
          )
        );

      return res.status(200).json({
        success: true,

        data: {
          dateId,

          summary:
            buildSummary(
              normalizedOrders
            ),

          orders:
            normalizedOrders,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.patch(
  "/orders/:orderId/cod-collected",
  async (req, res, next) => {
    try {
      const order =
        await Order.findById(
          req.params.orderId
        );

      if (!order) {
        return res.status(404).json({
          success: false,
          message:
            "Order not found.",
        });
      }

      if (
        order.paymentMethod !== "cod"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Only COD orders can be marked as cash collected.",
        });
      }

      if (
        order.orderStatus ===
        "cancelled"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Cancelled orders cannot be marked as collected.",
        });
      }

      const amountCollected =
        Number(
          req.body.amountCollected ??
            order.total
        );

      if (
        !Number.isFinite(
          amountCollected
        ) ||
        amountCollected < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Please enter a valid collected amount.",
        });
      }

      const amountDue =
        Number(order.total || 0);

      const status =
        amountCollected >= amountDue
          ? "collected"
          : "short_collected";

      const userSnapshot =
        buildUserSnapshot(req.user);

      const collection =
        await CashCollection.findOneAndUpdate(
          {
            order: order._id,
          },
          {
            $set: {
              order:
                order._id,

              orderNumber:
                order.orderNumber,

              amountDue,

              amountCollected,

              status,

              collectedAt:
                new Date(),

              collectedBy:
                req.user?._id ||
                null,

              collectedBySnapshot:
                userSnapshot,

              notes:
                cleanText(
                  req.body.notes
                ),
            },
          },
          {
            new: true,
            upsert: true,
            runValidators: true,
            setDefaultsOnInsert: true,
          }
        ).lean();

      if (
        status === "collected" &&
        order.paymentStatus !==
          "paid"
      ) {
        order.paymentStatus = "paid";

        await order.save();
      }

      return res.status(200).json({
        success: true,

        message:
          status === "collected"
            ? "COD marked as collected."
            : "COD marked as short collected.",

        data: {
          collection:
            normalizeCollection(
              collection
            ),
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.patch(
  "/cash-collections/:collectionId/handover",
  async (req, res, next) => {
    try {
      const userSnapshot =
        buildUserSnapshot(req.user);

      const existing =
        await CashCollection.findById(
          req.params.collectionId
        );

      if (!existing) {
        return res.status(404).json({
          success: false,
          message:
            "Cash collection record not found.",
        });
      }

      if (
        ![
          "collected",
          "short_collected",
        ].includes(existing.status)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Only collected cash can be marked as handed over.",
        });
      }

      existing.status =
        "handed_over";

      existing.handedOverAt =
        new Date();

      existing.handedOverBy =
        req.user?._id || null;

      existing.handedOverBySnapshot =
        userSnapshot;

      const handoverNote =
        cleanText(req.body.notes);

      if (handoverNote) {
        existing.notes =
          existing.notes
            ? `${existing.notes}\nHandover: ${handoverNote}`
            : `Handover: ${handoverNote}`;
      }

      await existing.save();

      return res.status(200).json({
        success: true,

        message:
          "Cash marked as handed over.",

        data: {
          collection:
            normalizeCollection(
              existing.toObject()
            ),
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = router;