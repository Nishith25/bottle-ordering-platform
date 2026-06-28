const mongoose = require("mongoose");

const Order = require("../models/Order");

const {
  restoreOrderInventory,
} = require("./inventory");

const {
  createRazorpayRefund,
  fetchRazorpayPayment,
  getRazorpayErrorMessage,
  getRazorpayRefundSpeed,
} = require("./razorpay");

const REFUND_LOCK_TIMEOUT_MS =
  2 * 60 * 1000;

function createHttpError(
  message,
  statusCode = 400
) {
  const error = new Error(message);
  error.statusCode = statusCode;

  return error;
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function toRefundAmountPaise(order) {
  const storedAmount = Number(
    order.refundAmountPaise || 0
  );

  if (
    Number.isInteger(storedAmount) &&
    storedAmount >= 100
  ) {
    return storedAmount;
  }

  return Math.round(
    Number(order.total || 0) * 100
  );
}

function toRefundAmountRupees(
  amountPaise
) {
  return Number(
    (amountPaise / 100).toFixed(2)
  );
}

function createRefundIdempotencyKey(
  order
) {
  return (
    cleanText(
      order.refundIdempotencyKey
    ) ||
    `refund-${String(order._id)}`
  );
}

function getRefundSpeed(order) {
  return [
    "normal",
    "optimum",
  ].includes(
    cleanText(
      order.refundSpeedRequested
    )
  )
    ? order.refundSpeedRequested
    : getRazorpayRefundSpeed();
}

function unixTimestampToDate(value) {
  const timestamp = Number(value);

  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return new Date(timestamp * 1000);
}

function getRefundEntityStatus(
  refund,
  eventName = ""
) {
  if (
    eventName === "refund.processed"
  ) {
    return "processed";
  }

  if (
    eventName === "refund.failed"
  ) {
    return "failed";
  }

  if (
    eventName === "refund.created"
  ) {
    return "pending";
  }

  const status = cleanText(
    refund?.status
  ).toLowerCase();

  if (
    [
      "pending",
      "processed",
      "failed",
    ].includes(status)
  ) {
    return status;
  }

  return "pending";
}

function getRefundFailureReason(
  refund
) {
  return (
    cleanText(
      refund?.error?.description
    ) ||
    cleanText(
      refund?.error_description
    ) ||
    cleanText(
      refund?.error_reason
    ) ||
    "Razorpay could not process the refund."
  );
}

async function updateOrderFromRefundEntity({
  orderId,
  refund,
  eventName = "",
}) {
  const order =
    await Order.findById(orderId);

  if (!order) {
    throw createHttpError(
      "Order not found.",
      404
    );
  }

  const nextStatus =
    getRefundEntityStatus(
      refund,
      eventName
    );

  const amountPaise = Number(
    refund?.amount ||
      toRefundAmountPaise(order)
  );

  if (refund?.id) {
    order.refundId =
      String(refund.id);
  }

  order.refundAmountPaise =
    amountPaise;

  order.refundAmount =
    toRefundAmountRupees(
      amountPaise
    );

  if (
    [
      "normal",
      "optimum",
    ].includes(
      cleanText(
        refund?.speed_requested
      )
    )
  ) {
    order.refundSpeedRequested =
      refund.speed_requested;
  }

  order.refundRequestLockedAt =
    null;

  const refundAlreadyProcessed =
    order.refundStatus ===
    "processed";

  if (
    nextStatus === "processed"
  ) {
    order.refundStatus =
      "processed";

    order.paymentStatus =
      "refunded";

    order.refundProcessedAt =
      unixTimestampToDate(
        refund?.processed_at
      ) || new Date();

    order.refundFailedAt = null;
    order.refundFailureReason = "";
  } else if (
    !refundAlreadyProcessed &&
    nextStatus === "failed"
  ) {
    order.refundStatus =
      "failed";

    order.refundFailedAt =
      new Date();

    order.refundFailureReason =
      getRefundFailureReason(
        refund
      );
  } else if (
    !refundAlreadyProcessed
  ) {
    order.refundStatus =
      "pending";

    order.refundFailedAt = null;
    order.refundFailureReason = "";
  }

  await order.save();

  return order;
}

async function markOrderRefundProcessed(
  orderId
) {
  return Order.findByIdAndUpdate(
    orderId,
    {
      $set: {
        refundStatus:
          "processed",

        paymentStatus:
          "refunded",

        refundProcessedAt:
          new Date(),

        refundFailedAt: null,
        refundFailureReason: "",
        refundRequestLockedAt: null,
      },
    },
    {
      new: true,
      runValidators: true,
    }
  );
}

async function markOrderRefundFailed(
  orderId,
  reason
) {
  return Order.findByIdAndUpdate(
    orderId,
    {
      $set: {
        refundStatus:
          "failed",

        refundFailedAt:
          new Date(),

        refundFailureReason:
          cleanText(reason) ||
          "Unable to start the Razorpay refund.",

        refundRequestLockedAt:
          null,
      },
    },
    {
      new: true,
      runValidators: true,
    }
  );
}

async function markOrderRefundPending(
  orderId
) {
  return Order.findByIdAndUpdate(
    orderId,
    {
      $set: {
        refundStatus:
          "pending",

        refundFailedAt: null,
        refundFailureReason: "",
        refundRequestLockedAt: null,
      },
    },
    {
      new: true,
      runValidators: true,
    }
  );
}

async function initiateOrderRefund(
  orderId
) {
  const preview =
    await Order.findById(orderId);

  if (!preview) {
    throw createHttpError(
      "Order not found.",
      404
    );
  }

  if (
    preview.refundStatus ===
      "processed" ||
    preview.paymentStatus ===
      "refunded"
  ) {
    return preview;
  }

  if (
    preview.refundStatus !==
    "pending"
  ) {
    return preview;
  }

  if (preview.refundId) {
    return preview;
  }

  const refundAmountPaise =
    toRefundAmountPaise(preview);

  const refundAmount =
    toRefundAmountRupees(
      refundAmountPaise
    );

  const refundSpeed =
    getRefundSpeed(preview);

  const idempotencyKey =
    createRefundIdempotencyKey(
      preview
    );

  const staleLockDate =
    new Date(
      Date.now() -
        REFUND_LOCK_TIMEOUT_MS
    );

  const claimedOrder =
    await Order.findOneAndUpdate(
      {
        _id: orderId,
        orderStatus: "cancelled",
        paymentMethod: "online",
        paymentGateway: "razorpay",
        paymentStatus: "paid",
        refundStatus: "pending",

        $and: [
          {
            $or: [
              {
                refundId: "",
              },
              {
                refundId: null,
              },
              {
                refundId: {
                  $exists: false,
                },
              },
            ],
          },
          {
            $or: [
              {
                refundRequestLockedAt:
                  null,
              },
              {
                refundRequestLockedAt:
                  {
                    $exists: false,
                  },
              },
              {
                refundRequestLockedAt:
                  {
                    $lte:
                      staleLockDate,
                  },
              },
            ],
          },
        ],
      },
      {
        $set: {
          refundAmount,
          refundAmountPaise,
          refundSpeedRequested:
            refundSpeed,
          refundIdempotencyKey:
            idempotencyKey,
          refundRequestLockedAt:
            new Date(),
          refundFailureReason: "",
          refundFailedAt: null,
        },

        $inc: {
          refundAttemptCount: 1,
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

  if (!claimedOrder) {
    return Order.findById(orderId);
  }

  try {
    const payment =
      await fetchRazorpayPayment(
        claimedOrder.paymentReference
      );

    const amountRefunded =
      Number(
        payment.amount_refunded || 0
      );

    if (
      amountRefunded >=
      refundAmountPaise
    ) {
      return markOrderRefundProcessed(
        claimedOrder._id
      );
    }

    if (
      payment.status !==
        "captured" &&
      payment.captured !== true
    ) {
      throw createHttpError(
        "Only a captured Razorpay payment can be refunded.",
        409
      );
    }

    const refund =
      await createRazorpayRefund({
        paymentId:
          claimedOrder.paymentReference,

        amountPaise:
          refundAmountPaise,

        speed: refundSpeed,

        idempotencyKey,

        notes: {
          order_id:
            String(
              claimedOrder._id
            ),

          order_number:
            claimedOrder.orderNumber,
        },
      });

    return updateOrderFromRefundEntity({
      orderId:
        claimedOrder._id,
      refund,
    });
  } catch (error) {
    if (
      Number(error.statusCode) ===
      409
    ) {
      return markOrderRefundPending(
        claimedOrder._id
      );
    }

    return markOrderRefundFailed(
      claimedOrder._id,
      getRazorpayErrorMessage(error)
    );
  }
}

async function cancelOrderWithRefund({
  orderId,
  userId = null,
  allowedStatuses,
  reason,
  initiatedBy,
}) {
  const session =
    await mongoose.startSession();

  let cancelledOrderId = null;

  try {
    await session.withTransaction(
      async () => {
        const filter = {
          _id: orderId,
        };

        if (userId) {
          filter.user = userId;
        }

        const order =
          await Order.findOne(
            filter
          ).session(session);

        if (!order) {
          throw createHttpError(
            "Order not found.",
            404
          );
        }

        if (
          order.orderStatus ===
          "cancelled"
        ) {
          cancelledOrderId =
            order._id;

          return;
        }

        if (
          !allowedStatuses.includes(
            order.orderStatus
          )
        ) {
          throw createHttpError(
            "This order can no longer be cancelled.",
            400
          );
        }

        order.orderStatus =
          "cancelled";

        order.cancellationReason =
          cleanText(reason) ||
          (initiatedBy === "admin"
            ? "Cancelled by administrator"
            : "Cancelled by customer");

        order.cancelledAt =
          new Date();

        if (
          order.paymentStatus ===
          "refunded"
        ) {
          order.refundStatus =
            "processed";

          order.refundProcessedAt =
            order.refundProcessedAt ||
            new Date();
        } else if (
          order.paymentMethod ===
            "online" &&
          order.paymentStatus ===
            "paid"
        ) {
          const amountPaise =
            toRefundAmountPaise(
              order
            );

          order.refundAmountPaise =
            amountPaise;

          order.refundAmount =
            toRefundAmountRupees(
              amountPaise
            );

          order.refundInitiatedBy =
            initiatedBy;

          order.refundRequestedAt =
            new Date();

          order.refundSpeedRequested =
            getRefundSpeed(order);

          order.refundIdempotencyKey =
            createRefundIdempotencyKey(
              order
            );

          order.refundRequestLockedAt =
            null;

          order.refundFailedAt = null;
          order.refundFailureReason = "";

          if (
            order.paymentGateway ===
              "razorpay" &&
            order.paymentReference
          ) {
            order.refundStatus =
              "pending";
          } else {
            order.refundStatus =
              "failed";

            order.refundFailedAt =
              new Date();

            order.refundFailureReason =
              "The Razorpay payment reference is missing from this order.";
          }
        } else {
          order.refundStatus =
            "not_required";
        }

        await restoreOrderInventory({
          order,
          session,
        });

        await order.save({
          session,
        });

        cancelledOrderId =
          order._id;
      }
    );
  } finally {
    await session.endSession();
  }

  let cancelledOrder =
    await Order.findById(
      cancelledOrderId
    );

  if (
    cancelledOrder &&
    cancelledOrder.refundStatus ===
      "pending" &&
    !cancelledOrder.refundId
  ) {
    cancelledOrder =
      await initiateOrderRefund(
        cancelledOrder._id
      );
  }

  return cancelledOrder;
}

async function retryOrderRefund({
  orderId,
  initiatedBy = "admin",
}) {
  const order =
    await Order.findById(orderId);

  if (!order) {
    throw createHttpError(
      "Order not found.",
      404
    );
  }

  if (
    order.orderStatus !==
    "cancelled"
  ) {
    throw createHttpError(
      "Only a cancelled order can be refunded."
    );
  }

  if (
    order.paymentMethod !==
      "online" ||
    order.paymentGateway !==
      "razorpay"
  ) {
    throw createHttpError(
      "This order does not use Razorpay."
    );
  }

  if (
    order.paymentStatus ===
      "refunded" ||
    order.refundStatus ===
      "processed"
  ) {
    return order;
  }

  if (
    order.paymentStatus !==
    "paid"
  ) {
    throw createHttpError(
      "This order does not have a paid transaction to refund."
    );
  }

  if (!order.paymentReference) {
    throw createHttpError(
      "The Razorpay payment reference is missing."
    );
  }

  if (
    order.refundStatus ===
      "pending" &&
    order.refundId
  ) {
    return order;
  }

  const amountPaise =
    toRefundAmountPaise(order);

  await Order.findByIdAndUpdate(
    order._id,
    {
      $set: {
        refundStatus:
          "pending",

        refundAmount:
          toRefundAmountRupees(
            amountPaise
          ),

        refundAmountPaise:
          amountPaise,

        refundSpeedRequested:
          getRefundSpeed(order),

        refundInitiatedBy:
          initiatedBy,

        refundIdempotencyKey:
          createRefundIdempotencyKey(
            order
          ),

        refundRequestedAt:
          new Date(),

        refundFailedAt: null,
        refundFailureReason: "",
        refundRequestLockedAt: null,
      },
    },
    {
      new: true,
      runValidators: true,
    }
  );

  return initiateOrderRefund(
    order._id
  );
}

async function applyRefundWebhook({
  eventName,
  refund,
}) {
  const refundId = cleanText(
    refund?.id
  );

  const paymentId = cleanText(
    refund?.payment_id
  );

  if (!refundId && !paymentId) {
    return null;
  }

  const conditions = [];

  if (refundId) {
    conditions.push({
      refundId,
    });
  }

  if (paymentId) {
    conditions.push({
      paymentReference:
        paymentId,
      orderStatus:
        "cancelled",
    });
  }

  const order =
    await Order.findOne({
      $or: conditions,
    }).sort({
      cancelledAt: -1,
    });

  if (!order) {
    return null;
  }

  return updateOrderFromRefundEntity({
    orderId: order._id,
    refund,
    eventName,
  });
}

function getCancellationMessage(
  order,
  actor = "customer"
) {
  if (!order) {
    return "Order cancelled.";
  }

  if (
    order.refundStatus ===
    "processed"
  ) {
    return actor === "admin"
      ? "Order cancelled, inventory restored and refund processed."
      : "Your order was cancelled and the refund was processed.";
  }

  if (
    order.refundStatus ===
    "pending"
  ) {
    return actor === "admin"
      ? "Order cancelled, inventory restored and refund initiated."
      : "Your order was cancelled. The refund has been initiated.";
  }

  if (
    order.refundStatus ===
    "failed"
  ) {
    return actor === "admin"
      ? "Order cancelled and inventory restored, but the refund requires a retry."
      : "Your order was cancelled. The automatic refund needs manual review.";
  }

  return actor === "admin"
    ? "Order cancelled and inventory restored."
    : "Your order was cancelled and the reserved stock was restored.";
}

module.exports = {
  applyRefundWebhook,
  cancelOrderWithRefund,
  getCancellationMessage,
  initiateOrderRefund,
  retryOrderRefund,
};
