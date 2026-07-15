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

function toNumber(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
}

function getOrderNumber(order) {
  return (
    cleanText(order?.orderNumber) ||
    cleanText(order?.orderId) ||
    String(order?._id || "")
  );
}

function getProductName(product) {
  return (
    cleanText(product?.name) ||
    cleanText(product?.title) ||
    cleanText(product?.productName) ||
    "Bottle"
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

  try {
    const existing =
      await AdminNotification.findOne({
        automationKey,
      }).select("_id");

    if (existing) {
      return {
        created: false,
        skipped: true,
      };
    }

    await AdminNotification.create({
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
    });

    return {
      created: true,
      skipped: false,
    };
  } catch (error) {
    if (
      error &&
      error.code === 11000
    ) {
      return {
        created: false,
        skipped: true,
      };
    }

    throw error;
  }
}

async function generateStockNotifications() {
  const products =
    await Product.find({
      available: true,
    })
      .select(
        "_id productId name title productName stockQuantity lowStockThreshold available"
      )
      .sort({
        updatedAt: -1,
      })
      .limit(300)
      .lean();

  let created = 0;

  for (const product of products) {
    const stockQuantity =
      toNumber(product.stockQuantity);

    const lowStockThreshold =
      toNumber(product.lowStockThreshold);

    if (
      stockQuantity >
      lowStockThreshold
    ) {
      continue;
    }

    const productName =
      getProductName(product);

    const outOfStock =
      stockQuantity <= 0;

    const result =
      await createNotificationOnce({
        type: "stock",

        severity:
          outOfStock
            ? "danger"
            : "warning",

        title:
          outOfStock
            ? `${productName} is out of stock`
            : `${productName} is low on stock`,

        message:
          outOfStock
            ? `${productName} has 0 bottles available. Update stock before customers place orders.`
            : `${productName} has ${stockQuantity} bottles left. Low-stock threshold is ${lowStockThreshold}.`,

        actionUrl:
          "/products",

        sourceType:
          "product",

        sourceId:
          product._id,

        sourceLabel:
          product.productId || productName,

        automationKey:
          `product:${product._id}:stock:${outOfStock ? "out" : "low"}:${stockQuantity}`,

        metadata: {
          productId:
            product.productId,
          productName,
          stockQuantity,
          lowStockThreshold,
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
        "_id orderNumber orderId user refundFailureReason refundAmount total refundStatus updatedAt"
      )
      .sort({
        updatedAt: -1,
      })
      .limit(150)
      .lean();

  let created = 0;

  for (const order of orders) {
    const orderNumber =
      getOrderNumber(order);

    const result =
      await createNotificationOnce({
        type: "refund",
        severity: "danger",

        title:
          `Refund failed: ${orderNumber}`,

        message:
          cleanText(
            order.refundFailureReason
          )
            ? `Refund failed for ${orderNumber}. Reason: ${order.refundFailureReason}`
            : `Refund failed for ${orderNumber}. Retry the refund from Orders or Follow-up Center.`,

        actionUrl:
          `/orders?search=${encodeURIComponent(
            orderNumber
          )}`,

        sourceType:
          "order",

        sourceId:
          order._id,

        sourceLabel:
          orderNumber,

        automationKey:
          `order:${order._id}:refund_failed_notification`,

        metadata: {
          orderNumber,
          refundAmount:
            toNumber(order.refundAmount),
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
        "_id orderNumber orderId total paymentMethod paymentStatus orderStatus deliveredAt updatedAt"
      )
      .sort({
        updatedAt: -1,
      })
      .limit(150)
      .lean();

  let created = 0;

  for (const order of orders) {
    const orderNumber =
      getOrderNumber(order);

    const result =
      await createNotificationOnce({
        type: "cod_payment",
        severity: "danger",

        title:
          `COD unpaid: ${orderNumber}`,

        message:
          `Order ${orderNumber} is delivered but COD payment is still ${order.paymentStatus}. Amount: ₹${toNumber(order.total)}.`,

        actionUrl:
          `/orders?search=${encodeURIComponent(
            orderNumber
          )}`,

        sourceType:
          "order",

        sourceId:
          order._id,

        sourceLabel:
          orderNumber,

        automationKey:
          `order:${order._id}:cod_unpaid_notification`,

        metadata: {
          orderNumber,
          total:
            toNumber(order.total),
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
        "_id orderNumber orderId total paymentMethod paymentStatus orderStatus createdAt"
      )
      .sort({
        createdAt: -1,
      })
      .limit(150)
      .lean();

  let created = 0;

  for (const order of orders) {
    const orderNumber =
      getOrderNumber(order);

    const result =
      await createNotificationOnce({
        type: "order",
        severity: "info",

        title:
          `New order: ${orderNumber}`,

        message:
          `New ${order.paymentMethod || "customer"} order placed for ₹${toNumber(order.total)}. Current status: ${order.orderStatus}.`,

        actionUrl:
          `/orders?search=${encodeURIComponent(
            orderNumber
          )}`,

        sourceType:
          "order",

        sourceId:
          order._id,

        sourceLabel:
          orderNumber,

        automationKey:
          `order:${order._id}:new_order_notification`,

        metadata: {
          orderNumber,
          total:
            toNumber(order.total),
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
        "_id orderNumber orderId total paymentMethod paymentStatus orderStatus updatedAt"
      )
      .sort({
        updatedAt: -1,
      })
      .limit(150)
      .lean();

  let created = 0;

  for (const order of orders) {
    const orderNumber =
      getOrderNumber(order);

    const result =
      await createNotificationOnce({
        type: "payment",
        severity: "warning",

        title:
          `Payment failed: ${orderNumber}`,

        message:
          `Payment failed for ${orderNumber}. Check whether the customer needs help placing the order again.`,

        actionUrl:
          `/orders?search=${encodeURIComponent(
            orderNumber
          )}`,

        sourceType:
          "order",

        sourceId:
          order._id,

        sourceLabel:
          orderNumber,

        automationKey:
          `order:${order._id}:payment_failed_notification`,

        metadata: {
          orderNumber,
          total:
            toNumber(order.total),
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

async function runRule(name, fn) {
  try {
    const created =
      await fn();

    return {
      created,
      error: null,
    };
  } catch (error) {
    console.error(
      `Admin notification rule failed: ${name}`,
      error
    );

    return {
      created: 0,
      error:
        error?.message ||
        "Rule failed.",
    };
  }
}

async function generateAdminNotifications() {
  const startedAt = new Date();

  const ruleResults = {
    stock:
      await runRule(
        "stock",
        generateStockNotifications
      ),

    followUps:
      await runRule(
        "followUps",
        generateOverdueFollowUpNotifications
      ),

    refunds:
      await runRule(
        "refunds",
        generateRefundFailedNotifications
      ),

    codPayments:
      await runRule(
        "codPayments",
        generateCodUnpaidNotifications
      ),

    newOrders:
      await runRule(
        "newOrders",
        generateNewOrderNotifications
      ),

    failedPayments:
      await runRule(
        "failedPayments",
        generatePaymentFailedNotifications
      ),
  };

  const results =
    Object.fromEntries(
      Object.entries(
        ruleResults
      ).map(
        ([
          key,
          value,
        ]) => [
          key,
          value.created,
        ]
      )
    );

  const errors =
    Object.fromEntries(
      Object.entries(
        ruleResults
      )
        .filter(
          ([
            ,
            value,
          ]) =>
            Boolean(value.error)
        )
        .map(
          ([
            key,
            value,
          ]) => [
            key,
            value.error,
          ]
        )
    );

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
    errors,
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

      if (
        result.totalCreated > 0 ||
        Object.keys(result.errors || {}).length > 0
      ) {
        console.log(
          "Admin notification worker result:",
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