// backend/src/services/adminNotificationService.js

const AdminNotification = require("../models/AdminNotification");
const CustomerFollowUp = require("../models/CustomerFollowUp");
const Order = require("../models/Order");
const Product = require("../models/Product");

const DEFAULT_INTERVAL_MS =
  5 * 60 * 1000;

let workerStarted = false;
let workerRunning = false;

function cleanText(value) {
  return String(value ?? "").trim();
}

function addHours(hours) {
  return new Date(
    Date.now() + hours * 60 * 60 * 1000
  );
}

async function createNotificationOnce({
  type,
  severity,
  title,
  message,
  actionUrl,
  sourceType,
  sourceId,
  sourceLabel,
  automationKey,
  metadata = {},
}) {
  if (!automationKey) {
    return {
      created: false,
      skipped: true,
    };
  }

  const now = new Date();

  const result =
    await AdminNotification.findOneAndUpdate(
      {
        automationKey,
      },
      {
        $setOnInsert: {
          type,
          severity,
          title,
          message,
          actionUrl:
            cleanText(actionUrl),
          sourceType:
            sourceType || "",
          sourceId:
            sourceId || null,
          sourceLabel:
            cleanText(sourceLabel),
          automationKey,
          metadata,
          readAt: null,
          readBy: null,
          readBySnapshot: {
            fullName: "",
            email: "",
            role: "",
          },
          active: true,
          createdAt: now,
          updatedAt: now,
        },
      },
      {
        upsert: true,
        new: false,
        rawResult: true,
      }
    );

  return {
    created:
      Boolean(
        result?.lastErrorObject
          ?.upserted
      ),
    skipped:
      !result?.lastErrorObject
        ?.upserted,
  };
}

async function generateStockNotifications() {
  const products =
    await Product.find({
      available: true,
      $expr: {
        $lte: [
          "$stockQuantity",
          "$lowStockThreshold",
        ],
      },
    })
      .select(
        "_id productId name stockQuantity lowStockThreshold available"
      )
      .sort({
        stockQuantity: 1,
      })
      .limit(100)
      .lean();

  let created = 0;

  for (const product of products) {
    const outOfStock =
      Number(product.stockQuantity || 0) <= 0;

    const result =
      await createNotificationOnce({
        type: "stock",
        severity:
          outOfStock
            ? "danger"
            : "warning",

        title:
          outOfStock
            ? `${product.name} is out of stock`
            : `${product.name} is low on stock`,

        message:
          outOfStock
            ? `${product.name} has 0 bottles available. Update stock before customers place orders.`
            : `${product.name} has ${product.stockQuantity} bottles left. Low-stock threshold is ${product.lowStockThreshold}.`,

        actionUrl:
          "/products",

        sourceType:
          "product",

        sourceId:
          product._id,

        sourceLabel:
          product.productId || product.name,

        automationKey:
          `product:${product._id}:stock:${outOfStock ? "out" : "low"}:${product.stockQuantity}`,

        metadata: {
          productId:
            product.productId,
          productName:
            product.name,
          stockQuantity:
            Number(
              product.stockQuantity || 0
            ),
          lowStockThreshold:
            Number(
              product.lowStockThreshold || 0
            ),
          rule:
            outOfStock
              ? "product_out_of_stock"
              : "product_low_stock",
        },
      });

    if (result.created) {
      created += 1;
    }
  }

  return created;
}

async function generateOverdueFollowUpNotifications() {
  const followUps =
    await CustomerFollowUp.find({
      active: true,
      status: "pending",
      dueAt: {
        $lt: new Date(),
      },
    })
      .populate(
        "customer",
        "fullName phone email"
      )
      .select(
        "_id title dueAt customer priority category sourceLabel"
      )
      .sort({
        dueAt: 1,
      })
      .limit(150)
      .lean();

  let created = 0;

  for (const followUp of followUps) {
    const customer =
      followUp.customer &&
      typeof followUp.customer ===
        "object"
        ? followUp.customer
        : null;

    const result =
      await createNotificationOnce({
        type: "follow_up",
        severity: "danger",

        title:
          `Overdue follow-up: ${followUp.title}`,

        message:
          `${followUp.title} is overdue${customer?.fullName ? ` for ${customer.fullName}` : ""}. Open Follow-up Center and complete it.`,

        actionUrl:
          "/follow-ups?status=overdue",

        sourceType:
          "follow_up",

        sourceId:
          followUp._id,

        sourceLabel:
          followUp.title,

        automationKey:
          `follow_up:${followUp._id}:overdue_notification`,

        metadata: {
          dueAt:
            followUp.dueAt,
          customerName:
            customer?.fullName || "",
          customerPhone:
            customer?.phone || "",
          category:
            followUp.category,
          priority:
            followUp.priority,
          rule:
            "follow_up_overdue",
        },
      });

    if (result.created) {
      created += 1;
    }
  }

  return created;
}

async function generateRefundFailedNotifications() {
  const orders =
    await Order.find({
      refundStatus: "failed",
    })
      .select(
        "_id orderNumber user refundFailureReason refundAmount total refundStatus updatedAt"
      )
      .sort({
        updatedAt: -1,
      })
      .limit(150)
      .lean();

  let created = 0;

  for (const order of orders) {
    const result =
      await createNotificationOnce({
        type: "refund",
        severity: "danger",

        title:
          `Refund failed: ${order.orderNumber}`,

        message:
          cleanText(
            order.refundFailureReason
          )
            ? `Refund failed for ${order.orderNumber}. Reason: ${order.refundFailureReason}`
            : `Refund failed for ${order.orderNumber}. Retry the refund from Orders or Follow-up Center.`,

        actionUrl:
          `/orders?search=${encodeURIComponent(
            order.orderNumber
          )}`,

        sourceType:
          "order",

        sourceId:
          order._id,

        sourceLabel:
          order.orderNumber,

        automationKey:
          `order:${order._id}:refund_failed_notification`,

        metadata: {
          orderNumber:
            order.orderNumber,
          refundAmount:
            Number(order.refundAmount || 0),
          refundFailureReason:
            cleanText(
              order.refundFailureReason
            ),
          rule:
            "refund_failed",
        },
      });

    if (result.created) {
      created += 1;
    }
  }

  return created;
}

async function generateCodUnpaidNotifications() {
  const orders =
    await Order.find({
      orderStatus: "delivered",
      paymentMethod: "cod",
      paymentStatus: {
        $ne: "paid",
      },
    })
      .select(
        "_id orderNumber total paymentMethod paymentStatus orderStatus deliveredAt updatedAt"
      )
      .sort({
        deliveredAt: -1,
        updatedAt: -1,
      })
      .limit(150)
      .lean();

  let created = 0;

  for (const order of orders) {
    const result =
      await createNotificationOnce({
        type: "cod_payment",
        severity: "danger",

        title:
          `COD unpaid: ${order.orderNumber}`,

        message:
          `Order ${order.orderNumber} is delivered but COD payment is still ${order.paymentStatus}. Amount: ${Number(order.total || 0)}.`,

        actionUrl:
          `/orders?search=${encodeURIComponent(
            order.orderNumber
          )}`,

        sourceType:
          "order",

        sourceId:
          order._id,

        sourceLabel:
          order.orderNumber,

        automationKey:
          `order:${order._id}:cod_unpaid_notification`,

        metadata: {
          orderNumber:
            order.orderNumber,
          total:
            Number(order.total || 0),
          paymentStatus:
            order.paymentStatus,
          rule:
            "cod_delivered_unpaid",
        },
      });

    if (result.created) {
      created += 1;
    }
  }

  return created;
}

async function generateNewOrderNotifications() {
  const since =
    new Date(
      Date.now() -
        24 * 60 * 60 * 1000
    );

  const orders =
    await Order.find({
      createdAt: {
        $gte: since,
      },
      orderStatus: {
        $in: [
          "placed",
          "confirmed",
        ],
      },
    })
      .select(
        "_id orderNumber total paymentMethod paymentStatus orderStatus createdAt"
      )
      .sort({
        createdAt: -1,
      })
      .limit(150)
      .lean();

  let created = 0;

  for (const order of orders) {
    const result =
      await createNotificationOnce({
        type: "order",
        severity: "info",

        title:
          `New order: ${order.orderNumber}`,

        message:
          `New ${order.paymentMethod} order placed for ${Number(order.total || 0)}. Current status: ${order.orderStatus}.`,

        actionUrl:
          `/orders?search=${encodeURIComponent(
            order.orderNumber
          )}`,

        sourceType:
          "order",

        sourceId:
          order._id,

        sourceLabel:
          order.orderNumber,

        automationKey:
          `order:${order._id}:new_order_notification`,

        metadata: {
          orderNumber:
            order.orderNumber,
          total:
            Number(order.total || 0),
          paymentMethod:
            order.paymentMethod,
          paymentStatus:
            order.paymentStatus,
          orderStatus:
            order.orderStatus,
          rule:
            "new_order_created",
        },
      });

    if (result.created) {
      created += 1;
    }
  }

  return created;
}

async function generatePaymentFailedNotifications() {
  const orders =
    await Order.find({
      paymentStatus: "failed",
    })
      .select(
        "_id orderNumber total paymentMethod paymentStatus orderStatus updatedAt"
      )
      .sort({
        updatedAt: -1,
      })
      .limit(150)
      .lean();

  let created = 0;

  for (const order of orders) {
    const result =
      await createNotificationOnce({
        type: "payment",
        severity: "warning",

        title:
          `Payment failed: ${order.orderNumber}`,

        message:
          `Payment failed for ${order.orderNumber}. Check whether the customer needs help placing the order again.`,

        actionUrl:
          `/orders?search=${encodeURIComponent(
            order.orderNumber
          )}`,

        sourceType:
          "order",

        sourceId:
          order._id,

        sourceLabel:
          order.orderNumber,

        automationKey:
          `order:${order._id}:payment_failed_notification`,

        metadata: {
          orderNumber:
            order.orderNumber,
          total:
            Number(order.total || 0),
          paymentMethod:
            order.paymentMethod,
          paymentStatus:
            order.paymentStatus,
          rule:
            "order_payment_failed",
        },
      });

    if (result.created) {
      created += 1;
    }
  }

  return created;
}

async function generateAdminNotifications() {
  const startedAt = new Date();

  const results = {
    stock: await generateStockNotifications(),
    followUps:
      await generateOverdueFollowUpNotifications(),
    refunds:
      await generateRefundFailedNotifications(),
    codPayments:
      await generateCodUnpaidNotifications(),
    newOrders:
      await generateNewOrderNotifications(),
    failedPayments:
      await generatePaymentFailedNotifications(),
  };

  const totalCreated =
    Object.values(results).reduce(
      (sum, value) =>
        sum + Number(value || 0),
      0
    );

  return {
    startedAt,
    finishedAt: new Date(),
    totalCreated,
    results,
  };
}

function startAdminNotificationWorker() {
  if (workerStarted) {
    return;
  }

  if (
    process.env.NODE_ENV === "test"
  ) {
    return;
  }

  workerStarted = true;

  const intervalMs =
    Math.max(
      Number(
        process.env
          .ADMIN_NOTIFICATION_WORKER_INTERVAL_MS ||
          DEFAULT_INTERVAL_MS
      ),
      60_000
    );

  const tick = async () => {
    if (workerRunning) {
      return;
    }

    workerRunning = true;

    try {
      const result =
        await generateAdminNotifications();

      if (result.totalCreated > 0) {
        console.log(
          "Admin notification worker created alerts:",
          result
        );
      }
    } catch (error) {
      console.error(
        "Admin notification worker failed:",
        error
      );
    } finally {
      workerRunning = false;
    }
  };

  setTimeout(() => {
    void tick();
  }, 25_000);

  setInterval(() => {
    void tick();
  }, intervalMs);

  console.log(
    `Admin notification worker started every ${Math.round(
      intervalMs / 1000
    )}s.`
  );
}

module.exports = {
  generateAdminNotifications,
  startAdminNotificationWorker,
};