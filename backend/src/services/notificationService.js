const Notification = require(
  "../models/Notification"
);

function cleanText(value) {
  return String(
    value ?? ""
  ).trim();
}

function getReferenceId(value) {
  if (!value) {
    return null;
  }

  if (
    typeof value === "string"
  ) {
    return value;
  }

  if (value._id) {
    return String(value._id);
  }

  return String(value);
}

function toPlainObject(value) {
  if (!value) {
    return {};
  }

  if (
    typeof value.toObject ===
    "function"
  ) {
    return value.toObject();
  }

  return {
    ...value,
  };
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  const parsedDate =
    new Date(value);

  if (
    Number.isNaN(
      parsedDate.getTime()
    )
  ) {
    return "";
  }

  return parsedDate.toLocaleDateString(
    "en-IN",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  );
}

function getUpdateToken(record) {
  const updatedAt =
    new Date(
      record?.updatedAt ||
        Date.now()
    ).getTime();

  return Number.isFinite(updatedAt)
    ? updatedAt
    : Date.now();
}

function getOrderNumber(order) {
  return (
    cleanText(
      order.orderNumber
    ) ||
    "Your order"
  );
}

function getPartnerName(order) {
  if (
    order.deliveryPartnerSnapshot
      ?.fullName
  ) {
    return cleanText(
      order
        .deliveryPartnerSnapshot
        .fullName
    );
  }

  if (
    order.deliveryPartner &&
    typeof order.deliveryPartner ===
      "object"
  ) {
    return cleanText(
      order.deliveryPartner
        .fullName
    );
  }

  return "A delivery partner";
}

function getSubscriptionNumber(
  subscription
) {
  return (
    cleanText(
      subscription
        .subscriptionNumber
    ) ||
    "Your subscription"
  );
}

function getPlanName(subscription) {
  return (
    cleanText(
      subscription.planName
    ) ||
    "subscription plan"
  );
}

async function createNotification({
  userId,
  type,
  title,
  message,
  action = "none",
  orderId = null,
  subscriptionId = null,
  metadata = {},
  dedupeKey,
}) {
  if (!userId) {
    return null;
  }

  const payload = {
    user: userId,
    type,

    title:
      cleanText(title),

    message:
      cleanText(message),

    action,

    order:
      orderId || null,

    subscription:
      subscriptionId || null,

    metadata:
      metadata || {},

    readAt: null,
  };

  if (dedupeKey) {
    payload.dedupeKey =
      cleanText(dedupeKey);

    return Notification.findOneAndUpdate(
      {
        dedupeKey:
          payload.dedupeKey,
      },
      {
        $setOnInsert:
          payload,
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );
  }

  return Notification.create(
    payload
  );
}

async function createNotificationSafely(
  input
) {
  try {
    return await createNotification(
      input
    );
  } catch (error) {
    if (
      error?.code === 11000 &&
      input.dedupeKey
    ) {
      return Notification.findOne({
        dedupeKey:
          cleanText(
            input.dedupeKey
          ),
      });
    }

    console.error(
      "Unable to create notification:",
      error.message
    );

    return null;
  }
}

/*
 * Order notifications
 */

async function notifyOrderPlaced(
  order
) {
  const current =
    toPlainObject(order);

  const userId =
    getReferenceId(
      current.user
    );

  const orderId =
    getReferenceId(
      current._id
    );

  const orderNumber =
    getOrderNumber(current);

  return createNotificationSafely({
    userId,
    type: "order_placed",
    title: "Order placed",

    message:
      `${orderNumber} was placed successfully. We will notify you when it is confirmed.`,

    action: "orders",
    orderId,

    metadata: {
      orderNumber,

      orderStatus:
        current.orderStatus,
    },

    dedupeKey:
      `order:${orderId}:placed`,
  });
}

async function notifyOrderCancelled(
  order
) {
  const current =
    toPlainObject(order);

  const userId =
    getReferenceId(
      current.user
    );

  const orderId =
    getReferenceId(
      current._id
    );

  const orderNumber =
    getOrderNumber(current);

  let message =
    `${orderNumber} was cancelled.`;

  if (
    current.refundStatus ===
    "pending"
  ) {
    message =
      `${orderNumber} was cancelled and your refund has been initiated.`;
  }

  if (
    current.refundStatus ===
    "processed"
  ) {
    message =
      `${orderNumber} was cancelled and your refund was processed successfully.`;
  }

  if (
    current.refundStatus ===
    "failed"
  ) {
    message =
      `${orderNumber} was cancelled, but the automatic refund needs support review.`;
  }

  return createNotificationSafely({
    userId,
    type: "order_cancelled",
    title: "Order cancelled",
    message,
    action: "orders",
    orderId,

    metadata: {
      orderNumber,

      refundStatus:
        current.refundStatus,
    },

    dedupeKey:
      `order:${orderId}:cancelled`,
  });
}

async function notifyRefundUpdate(
  order
) {
  const current =
    toPlainObject(order);

  const userId =
    getReferenceId(
      current.user
    );

  const orderId =
    getReferenceId(
      current._id
    );

  const orderNumber =
    getOrderNumber(current);

  const attemptCount =
    Number(
      current.refundAttemptCount ||
        0
    );

  if (
    current.refundStatus ===
    "pending"
  ) {
    return createNotificationSafely({
      userId,
      type: "refund_pending",
      title: "Refund processing",

      message:
        `The refund for ${orderNumber} is being processed through Razorpay.`,

      action: "orders",
      orderId,

      metadata: {
        orderNumber,

        refundStatus:
          current.refundStatus,
      },

      dedupeKey:
        `order:${orderId}:refund:pending:${attemptCount}`,
    });
  }

  if (
    current.refundStatus ===
    "processed"
  ) {
    return createNotificationSafely({
      userId,
      type:
        "refund_processed",

      title:
        "Refund completed",

      message:
        `The refund for ${orderNumber} was processed successfully.`,

      action: "orders",
      orderId,

      metadata: {
        orderNumber,

        refundStatus:
          current.refundStatus,

        refundAmount:
          current.refundAmount ||
          current.total ||
          0,
      },

      dedupeKey:
        `order:${orderId}:refund:processed`,
    });
  }

  if (
    current.refundStatus ===
    "failed"
  ) {
    return createNotificationSafely({
      userId,
      type: "refund_failed",

      title:
        "Refund needs attention",

      message:
        `The automatic refund for ${orderNumber} could not be completed. The support team can retry it.`,

      action: "orders",
      orderId,

      metadata: {
        orderNumber,

        refundStatus:
          current.refundStatus,
      },

      dedupeKey:
        `order:${orderId}:refund:failed:${attemptCount}`,
    });
  }

  return null;
}

async function processOrderNotificationChanges({
  order,
  previous = null,
  isNew = false,
}) {
  const current =
    toPlainObject(order);

  const previousOrder =
    toPlainObject(previous);

  const userId =
    getReferenceId(
      current.user
    );

  const orderId =
    getReferenceId(
      current._id
    );

  if (
    !userId ||
    !orderId
  ) {
    return;
  }

  const orderNumber =
    getOrderNumber(current);

  if (isNew) {
    await notifyOrderPlaced(
      current
    );

    return;
  }

  const previousPartnerId =
    getReferenceId(
      previousOrder
        .deliveryPartner
    );

  const currentPartnerId =
    getReferenceId(
      current.deliveryPartner
    );

  const orderStatusChanged =
    previousOrder.orderStatus !==
    current.orderStatus;

  const deliveryStatusChanged =
    previousOrder.deliveryStatus !==
    current.deliveryStatus;

  const deliveryPartnerChanged =
    previousPartnerId !==
    currentPartnerId;

  const refundStatusChanged =
    previousOrder.refundStatus !==
    current.refundStatus;

  if (
    orderStatusChanged &&
    current.orderStatus ===
      "cancelled"
  ) {
    await notifyOrderCancelled(
      current
    );

    return;
  }

  let lifecycleNotificationSent =
    false;

  if (
    currentPartnerId &&
    current.deliveryStatus ===
      "assigned" &&
    (
      deliveryPartnerChanged ||
      (
        deliveryStatusChanged &&
        previousOrder.deliveryStatus !==
          "assigned"
      )
    )
  ) {
    const partnerName =
      getPartnerName(current);

    await createNotificationSafely({
      userId,

      type:
        "delivery_assigned",

      title:
        "Delivery partner assigned",

      message:
        `${partnerName} has been assigned to deliver ${orderNumber}.`,

      action:
        "delivery_tracking",

      orderId,

      metadata: {
        orderNumber,

        deliveryPartnerName:
          partnerName,
      },

      dedupeKey:
        `order:${orderId}:assigned:${currentPartnerId}`,
    });

    lifecycleNotificationSent =
      true;
  }

  if (
    deliveryStatusChanged
  ) {
    if (
      current.deliveryStatus ===
      "picked_up"
    ) {
      await createNotificationSafely({
        userId,

        type:
          "order_picked_up",

        title:
          "Order picked up",

        message:
          `${orderNumber} has been picked up by the delivery partner.`,

        action:
          "delivery_tracking",

        orderId,

        metadata: {
          orderNumber,

          deliveryStatus:
            current.deliveryStatus,
        },

        dedupeKey:
          `order:${orderId}:picked-up`,
      });

      lifecycleNotificationSent =
        true;
    }

    if (
      current.deliveryStatus ===
      "out_for_delivery"
    ) {
      await createNotificationSafely({
        userId,

        type:
          "order_out_for_delivery",

        title:
          "Out for delivery",

        message:
          `${orderNumber} is out for delivery. Your four-digit verification OTP is ready.`,

        action:
          "delivery_tracking",

        orderId,

        metadata: {
          orderNumber,

          deliveryStatus:
            current.deliveryStatus,
        },

        dedupeKey:
          `order:${orderId}:out-for-delivery`,
      });

      lifecycleNotificationSent =
        true;
    }

    if (
      current.deliveryStatus ===
      "delivered"
    ) {
      await createNotificationSafely({
        userId,

        type:
          "order_delivered",

        title:
          "Order delivered",

        message:
          `${orderNumber} was delivered successfully. You can now share your feedback.`,

        action: "orders",
        orderId,

        metadata: {
          orderNumber,

          deliveryStatus:
            current.deliveryStatus,
        },

        dedupeKey:
          `order:${orderId}:delivered`,
      });

      lifecycleNotificationSent =
        true;
    }
  }

  if (
    orderStatusChanged &&
    !lifecycleNotificationSent
  ) {
    if (
      current.orderStatus ===
      "confirmed"
    ) {
      await createNotificationSafely({
        userId,

        type:
          "order_confirmed",

        title:
          "Order confirmed",

        message:
          `${orderNumber} has been confirmed and will be prepared for delivery.`,

        action: "orders",
        orderId,

        metadata: {
          orderNumber,

          orderStatus:
            current.orderStatus,
        },

        dedupeKey:
          `order:${orderId}:confirmed`,
      });
    }

    if (
      current.orderStatus ===
      "preparing"
    ) {
      await createNotificationSafely({
        userId,

        type:
          "order_preparing",

        title:
          "Preparing your order",

        message:
          `${orderNumber} is being prepared for delivery.`,

        action: "orders",
        orderId,

        metadata: {
          orderNumber,

          orderStatus:
            current.orderStatus,
        },

        dedupeKey:
          `order:${orderId}:preparing`,
      });
    }

    if (
      current.orderStatus ===
      "out_for_delivery"
    ) {
      await createNotificationSafely({
        userId,

        type:
          "order_out_for_delivery",

        title:
          "Out for delivery",

        message:
          `${orderNumber} is out for delivery. Your four-digit verification OTP is ready.`,

        action:
          "delivery_tracking",

        orderId,

        metadata: {
          orderNumber,

          orderStatus:
            current.orderStatus,
        },

        dedupeKey:
          `order:${orderId}:out-for-delivery`,
      });
    }

    if (
      current.orderStatus ===
      "delivered"
    ) {
      await createNotificationSafely({
        userId,

        type:
          "order_delivered",

        title:
          "Order delivered",

        message:
          `${orderNumber} was delivered successfully. You can now share your feedback.`,

        action: "orders",
        orderId,

        metadata: {
          orderNumber,

          orderStatus:
            current.orderStatus,
        },

        dedupeKey:
          `order:${orderId}:delivered`,
      });
    }
  }

  if (
    refundStatusChanged &&
    !(
      orderStatusChanged &&
      current.orderStatus ===
        "cancelled"
    )
  ) {
    await notifyRefundUpdate(
      current
    );
  }
}

/*
 * Review notifications
 */

async function notifyReviewSubmitted(
  review
) {
  const current =
    toPlainObject(review);

  const userId =
    getReferenceId(
      current.user
    );

  const orderId =
    getReferenceId(
      current.order
    );

  const reviewId =
    getReferenceId(
      current._id
    );

  if (
    !userId ||
    !reviewId
  ) {
    return null;
  }

  const orderNumber =
    cleanText(
      current.orderNumber
    ) || "your order";

  return createNotificationSafely({
    userId,

    type:
      "review_submitted",

    title:
      "Review submitted",

    message:
      `Thank you. Your review for ${orderNumber} was submitted successfully.`,

    action: "orders",
    orderId,

    metadata: {
      orderNumber,

      orderRating:
        current.orderRating,

      deliveryRating:
        current.deliveryRating,
    },

    dedupeKey:
      `review:${reviewId}:submitted`,
  });
}

/*
 * Subscription notifications
 */

async function notifySubscriptionCreated(
  subscription
) {
  const current =
    toPlainObject(
      subscription
    );

  const userId =
    getReferenceId(
      current.user
    );

  const subscriptionId =
    getReferenceId(
      current._id
    );

  if (
    !userId ||
    !subscriptionId
  ) {
    return null;
  }

  const subscriptionNumber =
    getSubscriptionNumber(
      current
    );

  const planName =
    getPlanName(current);

  const billingDate =
    formatDate(
      current.nextBillingAt
    );

  return createNotificationSafely({
    userId,

    type:
      "subscription_created",

    title:
      "Subscription activated",

    message:
      `${subscriptionNumber} for ${planName} is active.${
        billingDate
          ? ` The next billing date is ${billingDate}.`
          : ""
      }`,

    action:
      "subscriptions",

    subscriptionId,

    metadata: {
      subscriptionNumber,
      planName,

      status:
        current.status,

      paymentStatus:
        current.paymentStatus,

      nextBillingAt:
        current.nextBillingAt,
    },

    dedupeKey:
      `subscription:${subscriptionId}:created`,
  });
}

async function processSubscriptionNotificationChanges({
  subscription,
  previous = null,
  isNew = false,
}) {
  const current =
    toPlainObject(
      subscription
    );

  const previousSubscription =
    toPlainObject(
      previous
    );

  const userId =
    getReferenceId(
      current.user
    );

  const subscriptionId =
    getReferenceId(
      current._id
    );

  if (
    !userId ||
    !subscriptionId
  ) {
    return;
  }

  if (isNew) {
    await notifySubscriptionCreated(
      current
    );

    return;
  }

  const subscriptionNumber =
    getSubscriptionNumber(
      current
    );

  const planName =
    getPlanName(current);

  const statusChanged =
    previousSubscription.status !==
    current.status;

  const paymentStatusChanged =
    previousSubscription
      .paymentStatus !==
    current.paymentStatus;

  const previousBillingDate =
    previousSubscription
      .nextBillingAt
      ? new Date(
          previousSubscription
            .nextBillingAt
        ).getTime()
      : null;

  const currentBillingDate =
    current.nextBillingAt
      ? new Date(
          current.nextBillingAt
        ).getTime()
      : null;

  const billingDateChanged =
    previousBillingDate !==
    currentBillingDate;

  const updateToken =
    getUpdateToken(current);

  if (statusChanged) {
    if (
      current.status ===
      "paused"
    ) {
      await createNotificationSafely({
        userId,

        type:
          "subscription_paused",

        title:
          "Subscription paused",

        message:
          `${subscriptionNumber} for ${planName} was paused. Recurring deliveries will remain stopped until it is resumed.`,

        action:
          "subscriptions",

        subscriptionId,

        metadata: {
          subscriptionNumber,
          planName,
          status:
            current.status,
        },

        dedupeKey:
          `subscription:${subscriptionId}:paused:${updateToken}`,
      });
    }

    if (
      current.status ===
      "active"
    ) {
      const resumed =
        previousSubscription.status ===
        "paused";

      await createNotificationSafely({
        userId,

        type:
          resumed
            ? "subscription_resumed"
            : "subscription_activated",

        title:
          resumed
            ? "Subscription resumed"
            : "Subscription activated",

        message:
          resumed
            ? `${subscriptionNumber} for ${planName} was resumed. Recurring deliveries are active again.`
            : `${subscriptionNumber} for ${planName} is now active.`,

        action:
          "subscriptions",

        subscriptionId,

        metadata: {
          subscriptionNumber,
          planName,
          status:
            current.status,
        },

        dedupeKey:
          `subscription:${subscriptionId}:${resumed ? "resumed" : "activated"}:${updateToken}`,
      });
    }

    if (
      current.status ===
      "cancelled"
    ) {
      const reason =
        cleanText(
          current
            .cancellationReason
        );

      await createNotificationSafely({
        userId,

        type:
          "subscription_cancelled",

        title:
          "Subscription cancelled",

        message:
          `${subscriptionNumber} for ${planName} was cancelled.${
            reason
              ? ` Reason: ${reason}.`
              : ""
          } Future recurring deliveries will not be created.`,

        action:
          "subscriptions",

        subscriptionId,

        metadata: {
          subscriptionNumber,
          planName,
          status:
            current.status,

          cancellationReason:
            reason,
        },

        dedupeKey:
          `subscription:${subscriptionId}:cancelled`,
      });
    }

    if (
      current.status ===
      "expired"
    ) {
      await createNotificationSafely({
        userId,

        type:
          "subscription_expired",

        title:
          "Subscription expired",

        message:
          `${subscriptionNumber} for ${planName} has expired. Choose a new plan to continue recurring deliveries.`,

        action:
          "subscriptions",

        subscriptionId,

        metadata: {
          subscriptionNumber,
          planName,
          status:
            current.status,
        },

        dedupeKey:
          `subscription:${subscriptionId}:expired`,
      });
    }
  }

  if (
    paymentStatusChanged &&
    current.paymentStatus ===
      "failed"
  ) {
    await createNotificationSafely({
      userId,

      type:
        "subscription_payment_failed",

      title:
        "Subscription payment failed",

      message:
        `The recurring payment or mandate for ${subscriptionNumber} could not be completed. Please review the payment method for your ${planName}.`,

      action:
        "subscriptions",

      subscriptionId,

      metadata: {
        subscriptionNumber,
        planName,

        paymentStatus:
          current.paymentStatus,
      },

      dedupeKey:
        `subscription:${subscriptionId}:payment-failed:${updateToken}`,
    });
  }

  if (
    billingDateChanged &&
    ![
      "cancelled",
      "expired",
    ].includes(current.status)
  ) {
    const billingDate =
      formatDate(
        current.nextBillingAt
      );

    await createNotificationSafely({
      userId,

      type:
        "subscription_billing_updated",

      title:
        "Billing date updated",

      message:
        billingDate
          ? `The next billing date for ${subscriptionNumber} is now ${billingDate}.`
          : `The next billing date for ${subscriptionNumber} was updated.`,

      action:
        "subscriptions",

      subscriptionId,

      metadata: {
        subscriptionNumber,
        planName,

        nextBillingAt:
          current.nextBillingAt,
      },

      dedupeKey:
        `subscription:${subscriptionId}:billing:${currentBillingDate || updateToken}`,
    });
  }
}

module.exports = {
  createNotification,
  createNotificationSafely,
  notifyReviewSubmitted,
  notifySubscriptionCreated,
  processOrderNotificationChanges,
  processSubscriptionNotificationChanges,
};