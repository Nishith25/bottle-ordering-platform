// backend/src/services/customerFollowUpAutomation.js

const CustomerFollowUp = require("../models/CustomerFollowUp");
const Order = require("../models/Order");
const Subscription = require("../models/Subscription");

const DEFAULT_INTERVAL_MS =
  10 * 60 * 1000;

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

function addDays(days) {
  return new Date(
    Date.now() + days * 24 * 60 * 60 * 1000
  );
}

function getDateIdInIndia(value = new Date()) {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(new Date(value));
}

function getSystemSnapshot() {
  return {
    fullName: "System",
    email: "",
    role: "system",
  };
}

function getOrderCustomerId(order) {
  return order.user || null;
}

function getSubscriptionCustomerId(subscription) {
  return subscription.user || null;
}

async function createFollowUpOnce({
  customer,
  title,
  description,
  dueAt,
  category,
  priority,
  sourceType,
  sourceId,
  sourceLabel,
  automationKey,
  metadata = {},
}) {
  if (!customer || !automationKey) {
    return {
      created: false,
      skipped: true,
    };
  }

  const now = new Date();

  const result =
    await CustomerFollowUp.findOneAndUpdate(
      {
        automationKey,
      },
      {
        $setOnInsert: {
          customer,
          title,
          description,
          dueAt,
          status: "pending",
          category,
          priority,
          sourceType,
          sourceId,
          sourceLabel:
            cleanText(sourceLabel),
          automationKey,
          autoCreated: true,
          metadata,
          createdBy: null,
          createdBySnapshot:
            getSystemSnapshot(),
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

async function createCodPaymentFollowUps() {
  const orders =
    await Order.find({
      user: {
        $exists: true,
        $ne: null,
      },
      orderStatus: "delivered",
      paymentMethod: "cod",
      paymentStatus: {
        $ne: "paid",
      },
    })
      .select(
        "_id user orderNumber total paymentStatus paymentMethod orderStatus deliveredAt createdAt"
      )
      .sort({
        deliveredAt: -1,
        createdAt: -1,
      })
      .limit(150)
      .lean();

  let created = 0;

  for (const order of orders) {
    const result =
      await createFollowUpOnce({
        customer:
          getOrderCustomerId(order),

        title:
          `Collect COD payment for ${order.orderNumber}`,

        description:
          `Order ${order.orderNumber} is delivered but COD payment is still marked as ${order.paymentStatus}. Follow up and confirm collection of ${Number(order.total || 0)}.`,

        dueAt:
          addHours(2),

        category:
          "cod_payment",

        priority:
          "urgent",

        sourceType:
          "order",

        sourceId:
          order._id,

        sourceLabel:
          order.orderNumber,

        automationKey:
          `order:${order._id}:cod_payment_pending`,

        metadata: {
          orderNumber:
            order.orderNumber,
          total:
            Number(order.total || 0),
          paymentStatus:
            order.paymentStatus,
          rule:
            "cod_delivered_payment_pending",
        },
      });

    if (result.created) {
      created += 1;
    }
  }

  return created;
}

async function createRefundFailedFollowUps() {
  const orders =
    await Order.find({
      user: {
        $exists: true,
        $ne: null,
      },
      refundStatus: "failed",
    })
      .select(
        "_id user orderNumber refundStatus refundFailureReason refundAmount total createdAt"
      )
      .sort({
        refundFailedAt: -1,
        updatedAt: -1,
      })
      .limit(150)
      .lean();

  let created = 0;

  for (const order of orders) {
    const result =
      await createFollowUpOnce({
        customer:
          getOrderCustomerId(order),

        title:
          `Refund failed for ${order.orderNumber}`,

        description:
          cleanText(
            order.refundFailureReason
          )
            ? `Refund failed for ${order.orderNumber}. Reason: ${order.refundFailureReason}. Retry or contact customer.`
            : `Refund failed for ${order.orderNumber}. Retry the refund or contact customer.`,

        dueAt:
          addHours(1),

        category:
          "refund",

        priority:
          "urgent",

        sourceType:
          "order",

        sourceId:
          order._id,

        sourceLabel:
          order.orderNumber,

        automationKey:
          `order:${order._id}:refund_failed`,

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

async function createCancellationConfirmationFollowUps() {
  const orders =
    await Order.find({
      user: {
        $exists: true,
        $ne: null,
      },
      orderStatus: "cancelled",
    })
      .select(
        "_id user orderNumber cancellationReason paymentMethod paymentStatus refundStatus cancelledAt createdAt"
      )
      .sort({
        cancelledAt: -1,
        updatedAt: -1,
      })
      .limit(150)
      .lean();

  let created = 0;

  for (const order of orders) {
    const result =
      await createFollowUpOnce({
        customer:
          getOrderCustomerId(order),

        title:
          `Confirm cancellation for ${order.orderNumber}`,

        description:
          `Order ${order.orderNumber} was cancelled. Confirm customer communication and payment/refund status if required.`,

        dueAt:
          addHours(4),

        category:
          "cancellation",

        priority:
          order.paymentMethod ===
            "online" &&
          order.refundStatus !==
            "processed"
            ? "high"
            : "normal",

        sourceType:
          "order",

        sourceId:
          order._id,

        sourceLabel:
          order.orderNumber,

        automationKey:
          `order:${order._id}:cancellation_confirmation`,

        metadata: {
          orderNumber:
            order.orderNumber,
          cancellationReason:
            cleanText(
              order.cancellationReason
            ),
          paymentMethod:
            order.paymentMethod,
          paymentStatus:
            order.paymentStatus,
          refundStatus:
            order.refundStatus,
          rule:
            "cancelled_order_confirmation",
        },
      });

    if (result.created) {
      created += 1;
    }
  }

  return created;
}

async function createSubscriptionPaymentIssueFollowUps() {
  const subscriptions =
    await Subscription.find({
      user: {
        $exists: true,
        $ne: null,
      },
      $or: [
        {
          status: {
            $in: [
              "payment_failed",
              "past_due",
              "failed",
            ],
          },
        },
        {
          paymentStatus: "failed",
        },
        {
          lastPaymentStatus: "failed",
        },
        {
          paymentFailureReason: {
            $exists: true,
            $ne: "",
          },
        },
      ],
    })
      .select(
        "_id user subscriptionNumber planName status paymentStatus lastPaymentStatus paymentFailureReason totalPerCycle nextBillingAt createdAt updatedAt"
      )
      .sort({
        updatedAt: -1,
      })
      .limit(150)
      .lean();

  let created = 0;

  for (const subscription of subscriptions) {
    const label =
      cleanText(
        subscription.subscriptionNumber
      ) ||
      String(subscription._id);

    const result =
      await createFollowUpOnce({
        customer:
          getSubscriptionCustomerId(
            subscription
          ),

        title:
          `Subscription payment issue ${label}`,

        description:
          cleanText(
            subscription.paymentFailureReason
          )
            ? `Subscription ${label} has a payment issue. Reason: ${subscription.paymentFailureReason}. Contact customer and resolve.`
            : `Subscription ${label} has a payment issue. Contact customer and resolve.`,

        dueAt:
          addHours(3),

        category:
          "subscription",

        priority:
          "high",

        sourceType:
          "subscription",

        sourceId:
          subscription._id,

        sourceLabel:
          label,

        automationKey:
          `subscription:${subscription._id}:payment_issue`,

        metadata: {
          subscriptionNumber:
            label,
          planName:
            cleanText(
              subscription.planName
            ),
          status:
            subscription.status,
          paymentStatus:
            subscription.paymentStatus,
          lastPaymentStatus:
            subscription.lastPaymentStatus,
          paymentFailureReason:
            cleanText(
              subscription.paymentFailureReason
            ),
          rule:
            "subscription_payment_issue",
        },
      });

    if (result.created) {
      created += 1;
    }
  }

  return created;
}

async function createSubscriptionRenewalFollowUps() {
  const now = new Date();
  const until = addDays(2);

  const subscriptions =
    await Subscription.find({
      user: {
        $exists: true,
        $ne: null,
      },
      status: "active",
      nextBillingAt: {
        $gte: now,
        $lte: until,
      },
    })
      .select(
        "_id user subscriptionNumber planName status billingCycle totalPerCycle nextBillingAt createdAt"
      )
      .sort({
        nextBillingAt: 1,
      })
      .limit(150)
      .lean();

  let created = 0;

  for (const subscription of subscriptions) {
    const label =
      cleanText(
        subscription.subscriptionNumber
      ) ||
      String(subscription._id);

    const renewalDateId =
      getDateIdInIndia(
        subscription.nextBillingAt
      );

    const dueAt =
      new Date(
        subscription.nextBillingAt
      );

    if (
      !Number.isFinite(
        dueAt.getTime()
      )
    ) {
      continue;
    }

    const reminderDueAt =
      dueAt.getTime() <
      Date.now()
        ? addHours(1)
        : dueAt;

    const result =
      await createFollowUpOnce({
        customer:
          getSubscriptionCustomerId(
            subscription
          ),

        title:
          `Subscription renewal due ${label}`,

        description:
          `Subscription ${label} is due for renewal on ${renewalDateId}. Check payment readiness and customer status if needed.`,

        dueAt:
          reminderDueAt,

        category:
          "renewal",

        priority:
          "normal",

        sourceType:
          "subscription",

        sourceId:
          subscription._id,

        sourceLabel:
          label,

        automationKey:
          `subscription:${subscription._id}:renewal_due:${renewalDateId}`,

        metadata: {
          subscriptionNumber:
            label,
          planName:
            cleanText(
              subscription.planName
            ),
          billingCycle:
            subscription.billingCycle,
          totalPerCycle:
            Number(
              subscription.totalPerCycle || 0
            ),
          nextBillingAt:
            subscription.nextBillingAt,
          renewalDateId,
          rule:
            "subscription_renewal_due",
        },
      });

    if (result.created) {
      created += 1;
    }
  }

  return created;
}

async function createOverdueEscalationFollowUps() {
  const olderThan =
    new Date(
      Date.now() -
        24 * 60 * 60 * 1000
    );

  const followUps =
    await CustomerFollowUp.find({
      active: true,
      status: "pending",
      dueAt: {
        $lt: olderThan,
      },
      category: {
        $ne: "overdue_escalation",
      },
    })
      .select(
        "_id customer title dueAt category priority sourceType sourceId sourceLabel"
      )
      .sort({
        dueAt: 1,
      })
      .limit(100)
      .lean();

  let created = 0;

  for (const followUp of followUps) {
    const result =
      await createFollowUpOnce({
        customer:
          followUp.customer,

        title:
          `Overdue follow-up: ${followUp.title}`,

        description:
          `The original follow-up "${followUp.title}" has been overdue for more than 1 day. Review and complete it.`,

        dueAt:
          addHours(2),

        category:
          "overdue_escalation",

        priority:
          "urgent",

        sourceType:
          "follow_up",

        sourceId:
          followUp._id,

        sourceLabel:
          followUp.title,

        automationKey:
          `follow_up:${followUp._id}:overdue_escalation`,

        metadata: {
          originalFollowUpId:
            String(followUp._id),
          originalTitle:
            followUp.title,
          originalDueAt:
            followUp.dueAt,
          originalCategory:
            followUp.category,
          rule:
            "follow_up_overdue_more_than_1_day",
        },
      });

    if (result.created) {
      created += 1;
    }
  }

  return created;
}

async function runCustomerFollowUpAutomation() {
  const startedAt = new Date();

  const results = {
    codPayment: 0,
    refundFailed: 0,
    cancellationConfirmation: 0,
    subscriptionPaymentIssue: 0,
    subscriptionRenewal: 0,
    overdueEscalation: 0,
  };

  results.codPayment =
    await createCodPaymentFollowUps();

  results.refundFailed =
    await createRefundFailedFollowUps();

  results.cancellationConfirmation =
    await createCancellationConfirmationFollowUps();

  results.subscriptionPaymentIssue =
    await createSubscriptionPaymentIssueFollowUps();

  results.subscriptionRenewal =
    await createSubscriptionRenewalFollowUps();

  results.overdueEscalation =
    await createOverdueEscalationFollowUps();

  const totalCreated =
    Object.values(results).reduce(
      (total, value) =>
        total + Number(value || 0),
      0
    );

  return {
    startedAt,
    finishedAt: new Date(),
    totalCreated,
    results,
  };
}

function startCustomerFollowUpAutomationWorker() {
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
          .CUSTOMER_FOLLOW_UP_AUTOMATION_INTERVAL_MS ||
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
        await runCustomerFollowUpAutomation();

      if (result.totalCreated > 0) {
        console.log(
          "Customer follow-up automation created reminders:",
          result
        );
      }
    } catch (error) {
      console.error(
        "Customer follow-up automation failed:",
        error
      );
    } finally {
      workerRunning = false;
    }
  };

  setTimeout(() => {
    void tick();
  }, 20_000);

  setInterval(() => {
    void tick();
  }, intervalMs);

  console.log(
    `Customer follow-up automation worker started every ${Math.round(
      intervalMs / 1000
    )}s.`
  );
}

module.exports = {
  runCustomerFollowUpAutomation,
  startCustomerFollowUpAutomationWorker,
};