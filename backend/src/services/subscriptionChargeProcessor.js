const crypto = require("crypto");
const mongoose = require("mongoose");

const Order = require(
  "../models/Order"
);

const Product = require(
  "../models/Product"
);

const RazorpaySubscriptionMandate =
  require(
    "../models/RazorpaySubscriptionMandate"
  );

const Subscription = require(
  "../models/Subscription"
);

const SubscriptionCharge = require(
  "../models/SubscriptionCharge"
);

const {
  reserveProductInventory,
} = require("./inventory");

const {
  createNotificationSafely,
} = require(
  "./notificationService"
);

const SUBSCRIPTION_TIME_ZONE =
  process.env
    .SUBSCRIPTION_TIME_ZONE ||
  "Asia/Kolkata";

const DAY_IN_MILLISECONDS =
  24 * 60 * 60 * 1000;

function cleanText(value) {
  return String(
    value ?? ""
  ).trim();
}

function roundMoney(value) {
  return (
    Math.round(
      (
        Number(value || 0) +
        Number.EPSILON
      ) *
        100
    ) / 100
  );
}

function unixToDate(value) {
  const numericValue =
    Number(value);

  if (
    !Number.isFinite(
      numericValue
    ) ||
    numericValue <= 0
  ) {
    return null;
  }

  return new Date(
    numericValue * 1000
  );
}

function toPlainObject(value) {
  if (!value) {
    return null;
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

function createFulfillmentError(
  code,
  message,
  statusCode = 409
) {
  const error =
    new Error(message);

  error.code = code;

  error.statusCode =
    statusCode;

  error.isFulfillmentError =
    true;

  return error;
}

function isBusinessFailure(
  error
) {
  if (
    error
      ?.isFulfillmentError
  ) {
    return true;
  }

  const statusCode =
    Number(
      error?.statusCode || 0
    );

  return (
    statusCode >= 400 &&
    statusCode < 500
  );
}

function formatDateParts(
  date
) {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          SUBSCRIPTION_TIME_ZONE,

        year: "numeric",

        month: "2-digit",

        day: "2-digit",
      }
    ).formatToParts(date);

  const result = {};

  for (
    const part of parts
  ) {
    if (
      part.type !==
      "literal"
    ) {
      result[part.type] =
        part.value;
    }
  }

  return {
    year:
      result.year,

    month:
      result.month,

    day:
      result.day,
  };
}

function getDateId(date) {
  const parts =
    formatDateParts(date);

  return [
    parts.year,
    parts.month,
    parts.day,
  ].join("-");
}

function getDeliveryDateLabel(
  date
) {
  return date.toLocaleDateString(
    "en-IN",
    {
      timeZone:
        SUBSCRIPTION_TIME_ZONE,

      weekday: "long",

      day: "numeric",

      month: "long",

      year: "numeric",
    }
  );
}

function getWeekdayName(
  date
) {
  return date.toLocaleDateString(
    "en-US",
    {
      timeZone:
        SUBSCRIPTION_TIME_ZONE,

      weekday: "long",
    }
  );
}

function getNextDeliveryDate({
  baseDate,
  preferredDay,
}) {
  const cleanPreferredDay =
    cleanText(
      preferredDay
    ).toLowerCase();

  const safeBaseDate =
    baseDate instanceof Date &&
    !Number.isNaN(
      baseDate.getTime()
    )
      ? baseDate
      : new Date();

  /*
   * Start from the following day so
   * a charge does not create a delivery
   * scheduled earlier on the same day.
   */
  for (
    let offset = 1;
    offset <= 8;
    offset += 1
  ) {
    const candidate =
      new Date(
        safeBaseDate.getTime() +
          offset *
            DAY_IN_MILLISECONDS
      );

    const candidateDay =
      getWeekdayName(
        candidate
      ).toLowerCase();

    if (
      !cleanPreferredDay ||
      candidateDay ===
        cleanPreferredDay
    ) {
      return candidate;
    }
  }

  return new Date(
    safeBaseDate.getTime() +
      DAY_IN_MILLISECONDS
  );
}

function getNextBillingDate({
  subscription,
  subscriptionEntity,
  paymentDate,
}) {
  const providerChargeAt =
    unixToDate(
      subscriptionEntity
        ?.charge_at
    );

  if (
    providerChargeAt &&
    providerChargeAt.getTime() >
      paymentDate.getTime()
  ) {
    return providerChargeAt;
  }

  const existingBillingDate =
    new Date(
      subscription.nextBillingAt ||
        paymentDate
    );

  const baseDate =
    Number.isNaN(
      existingBillingDate.getTime()
    )
      ? new Date(
          paymentDate
        )
      : existingBillingDate;

  if (
    subscription.billingCycle ===
    "monthly"
  ) {
    const nextDate =
      new Date(baseDate);

    nextDate.setMonth(
      nextDate.getMonth() +
        1
    );

    return nextDate;
  }

  return new Date(
    baseDate.getTime() +
      7 *
        DAY_IN_MILLISECONDS
  );
}

async function createUniqueOrderNumber(
  session
) {
  for (
    let attempt = 0;
    attempt < 10;
    attempt += 1
  ) {
    const datePart =
      new Date()
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, "");

    const randomPart =
      crypto
        .randomBytes(4)
        .toString("hex")
        .toUpperCase()
        .slice(0, 7);

    const orderNumber =
      `ORD-${datePart}-${randomPart}`;

    const existingOrder =
      await Order.exists({
        orderNumber,
      }).session(session);

    if (!existingOrder) {
      return orderNumber;
    }
  }

  throw new Error(
    "Unable to generate a unique order number."
  );
}

function getCycleKey(
  razorpayPaymentId
) {
  return `razorpay:${cleanText(
    razorpayPaymentId
  )}`;
}

function isCapturedPayment(
  paymentEntity
) {
  return (
    paymentEntity?.captured ===
      true ||
    cleanText(
      paymentEntity?.status
    ).toLowerCase() ===
      "captured"
  );
}

async function findOrCreateCharge({
  mandate,
  paymentEntity,
  eventId,
  eventType,
}) {
  const razorpayPaymentId =
    cleanText(
      paymentEntity?.id
    );

  if (
    !razorpayPaymentId
  ) {
    throw createFulfillmentError(
      "missing_payment_id",
      "The Razorpay payment ID is missing.",
      400
    );
  }

  const amountPaise =
    Number(
      paymentEntity?.amount ||
        0
    );

  const expectedAmountPaise =
    Number(
      mandate.amountPaise ||
        0
    );

  const update = {
    $set: {
      webhookEventId:
        cleanText(eventId),

      eventType:
        cleanText(eventType) ||
        "subscription.charged",

      razorpayInvoiceId:
        cleanText(
          paymentEntity
            ?.invoice_id
        ),

      amountPaise,

      expectedAmountPaise,

      currency:
        cleanText(
          paymentEntity
            ?.currency ||
            mandate.currency ||
            "INR"
        ).toUpperCase(),

      paymentStatus:
        cleanText(
          paymentEntity
            ?.status
        ),

      paymentMethod:
        cleanText(
          paymentEntity
            ?.method
        ),

      captured:
        isCapturedPayment(
          paymentEntity
        ),

      amountMatches:
        amountPaise ===
        expectedAmountPaise,

      paymentErrorCode:
        cleanText(
          paymentEntity
            ?.error_code
        ),

      paymentErrorDescription:
        cleanText(
          paymentEntity
            ?.error_description ||
            paymentEntity
              ?.error_reason
        ),

      paymentCreatedAt:
        unixToDate(
          paymentEntity
            ?.created_at
        ) || new Date(),

      subscriptionCycleKey:
        getCycleKey(
          razorpayPaymentId
        ),
    },

    $setOnInsert: {
      localSubscription:
        mandate.localSubscription,

      mandate:
        mandate._id,

      user:
        mandate.user,

      subscriptionNumber:
        mandate.subscriptionNumber,

      planName:
        mandate.planName,

      razorpayPaymentId,

      razorpaySubscriptionId:
        mandate.razorpaySubscriptionId,

      processingStatus:
        "received",

      retryCount: 0,
    },
  };

  try {
    return await SubscriptionCharge.findOneAndUpdate(
      {
        razorpayPaymentId,
      },

      update,

      {
        new: true,

        upsert: true,

        setDefaultsOnInsert:
          true,
      }
    );
  } catch (error) {
    if (
      error.code === 11000
    ) {
      const existingCharge =
        await SubscriptionCharge.findOne(
          {
            razorpayPaymentId,
          }
        );

      if (
        existingCharge
      ) {
        return existingCharge;
      }
    }

    throw error;
  }
}

async function markChargeIgnored({
  charge,
  failureCode,
  failureReason,
}) {
  charge.processingStatus =
    "ignored";

  charge.failureCode =
    failureCode;

  charge.failureReason =
    failureReason;

  charge.processedAt =
    new Date();

  await charge.save();

  return {
    status: "ignored",

    chargeId:
      String(charge._id),

    razorpayPaymentId:
      charge.razorpayPaymentId,

    reason:
      failureReason,
  };
}

async function loadProductsForSubscription({
  subscription,
  session,
}) {
  const subscriptionItems =
    Array.isArray(
      subscription.items
    )
      ? subscription.items
      : [];

  if (
    subscriptionItems.length ===
    0
  ) {
    throw createFulfillmentError(
      "subscription_items_missing",
      "The subscription has no selected bottles."
    );
  }

  const productIds = [
    ...new Set(
      subscriptionItems
        .map((item) =>
          cleanText(
            item.productId
          )
        )
        .filter(Boolean)
    ),
  ];

  if (
    productIds.length === 0
  ) {
    throw createFulfillmentError(
      "product_ids_missing",
      "The selected subscription bottles have no product IDs."
    );
  }

  const products =
    await Product.find({
      productId: {
        $in: productIds,
      },

      available: true,

      subscriptionEligible:
        true,
    }).session(session);

  if (
    products.length !==
    productIds.length
  ) {
    throw createFulfillmentError(
      "product_unavailable",
      "One or more subscription bottles are currently unavailable."
    );
  }

  const productsById =
    new Map(
      products.map(
        (product) => [
          cleanText(
            product.productId
          ),

          product,
        ]
      )
    );

  const quantitiesByProductId =
    new Map();

  const orderItems =
    subscriptionItems.map(
      (subscriptionItem) => {
        const productId =
          cleanText(
            subscriptionItem.productId
          );

        const product =
          productsById.get(
            productId
          );

        if (!product) {
          throw createFulfillmentError(
            "product_unavailable",
            `${subscriptionItem.name || "A selected bottle"} is currently unavailable.`
          );
        }

        const quantity =
          Number(
            subscriptionItem.quantity ||
              0
          );

        if (
          !Number.isInteger(
            quantity
          ) ||
          quantity < 1
        ) {
          throw createFulfillmentError(
            "invalid_quantity",
            `The quantity for ${subscriptionItem.name || product.name} is invalid.`
          );
        }

        quantitiesByProductId.set(
          productId,
          quantity
        );

        return {
          product:
            product._id,

          productId:
            product.productId,

          name:
            product.name,

          shortName:
            product.shortName,

          sizeMl:
            product.sizeMl,

          price:
            Number(
              subscriptionItem.price ??
                product.price
            ),

          quantity,

          lineTotal:
            roundMoney(
              Number(
                subscriptionItem.price ??
                  product.price
              ) *
                quantity
            ),
        };
      }
    );

  return {
    products,

    quantitiesByProductId,

    orderItems,
  };
}

async function notifySuccessfulCharge({
  subscription,
  order,
  charge,
}) {
  await createNotificationSafely({
    userId:
      subscription.user,

    type: "order",

    title:
      "Recurring payment successful",

    message:
      `${order.orderNumber} was created after your ${subscription.planName} recurring payment was confirmed.`,

    action: "orders",

    orderId:
      order._id,

    subscriptionId:
      subscription._id,

    metadata: {
      orderNumber:
        order.orderNumber,

      subscriptionNumber:
        subscription.subscriptionNumber,

      razorpayPaymentId:
        charge.razorpayPaymentId,

      total:
        order.total,

      deliveryDate:
        order.deliverySchedule
          ?.deliveryDateLabel,

      deliverySlot:
        order.deliverySchedule
          ?.deliverySlot,
    },

    dedupeKey:
      `subscription-charge:${charge.razorpayPaymentId}:fulfilled`,
  });
}

async function notifyFulfillmentFailure({
  subscription,
  charge,
  failureReason,
}) {
  await createNotificationSafely({
    userId:
      subscription.user,

    type: "subscription",

    title:
      "Payment received — delivery needs attention",

    message:
      `Your recurring payment for ${subscription.planName} was received, but the delivery order could not be created automatically. Our team will review it.`,

    action:
      "subscriptions",

    subscriptionId:
      subscription._id,

    metadata: {
      subscriptionNumber:
        subscription.subscriptionNumber,

      razorpayPaymentId:
        charge.razorpayPaymentId,

      failureReason,
    },

    dedupeKey:
      `subscription-charge:${charge.razorpayPaymentId}:fulfillment-failed:${charge.retryCount}`,
  });
}

async function processSubscriptionChargedEvent({
  eventId,
  eventType =
    "subscription.charged",
  subscriptionEntity,
  paymentEntity,
}) {
  const razorpaySubscriptionId =
    cleanText(
      subscriptionEntity?.id
    );

  const razorpayPaymentId =
    cleanText(
      paymentEntity?.id
    );

  if (
    !razorpaySubscriptionId
  ) {
    throw createFulfillmentError(
      "missing_subscription_id",
      "The Razorpay subscription ID is missing.",
      400
    );
  }

  if (
    !razorpayPaymentId
  ) {
    throw createFulfillmentError(
      "missing_payment_id",
      "The Razorpay payment ID is missing.",
      400
    );
  }

  const mandate =
    await RazorpaySubscriptionMandate.findOne(
      {
        razorpaySubscriptionId,
      }
    );

  if (!mandate) {
    return {
      status: "ignored",

      razorpayPaymentId,

      reason:
        "No matching local Razorpay mandate was found.",
    };
  }

  const charge =
    await findOrCreateCharge({
      mandate,

      paymentEntity,

      eventId,

      eventType,
    });

  if (
    charge.processingStatus ===
      "fulfilled" &&
    charge.order
  ) {
    return {
      status:
        "already_fulfilled",

      chargeId:
        String(charge._id),

      orderId:
        String(charge.order),

      orderNumber:
        charge.orderNumber,

      razorpayPaymentId:
        charge.razorpayPaymentId,
    };
  }

  if (
    !isCapturedPayment(
      paymentEntity
    )
  ) {
    return markChargeIgnored({
      charge,

      failureCode:
        "payment_not_captured",

      failureReason:
        "The recurring payment was not captured.",
    });
  }

  const actualAmountPaise =
    Number(
      paymentEntity.amount ||
        0
    );

  const expectedAmountPaise =
    Number(
      mandate.amountPaise ||
        0
    );

  if (
    actualAmountPaise !==
    expectedAmountPaise
  ) {
    return markChargeIgnored({
      charge,

      failureCode:
        "amount_mismatch",

      failureReason:
        `The payment amount ${actualAmountPaise} paise does not match the expected cycle amount ${expectedAmountPaise} paise.`,
    });
  }

  const currency =
    cleanText(
      paymentEntity.currency
    ).toUpperCase();

  if (
    currency &&
    currency !==
      cleanText(
        mandate.currency ||
          "INR"
      ).toUpperCase()
  ) {
    return markChargeIgnored({
      charge,

      failureCode:
        "currency_mismatch",

      failureReason:
        "The recurring payment currency does not match the subscription currency.",
    });
  }

  const session =
    await mongoose.startSession();

  let generatedOrder =
    null;

  let localSubscription =
    null;

  try {
    await session.withTransaction(
      async () => {
        const transactionalCharge =
          await SubscriptionCharge.findById(
            charge._id
          ).session(session);

        if (
          !transactionalCharge
        ) {
          throw new Error(
            "Subscription charge record was not found."
          );
        }

        if (
          transactionalCharge.processingStatus ===
            "fulfilled" &&
          transactionalCharge.order
        ) {
          generatedOrder =
            await Order.findById(
              transactionalCharge.order
            ).session(session);

          return;
        }

        transactionalCharge.processingStatus =
          "processing";

        transactionalCharge.failureCode =
          "";

        transactionalCharge.failureReason =
          "";

        await transactionalCharge.save({
          session,
        });

        localSubscription =
          await Subscription.findById(
            mandate.localSubscription
          ).session(session);

        if (
          !localSubscription
        ) {
          throw createFulfillmentError(
            "subscription_not_found",
            "The local subscription was not found.",
            404
          );
        }

        const cycleKey =
          getCycleKey(
            razorpayPaymentId
          );

        const existingOrder =
          await Order.findOne({
            $or: [
              {
                paymentReference:
                  razorpayPaymentId,
              },

              {
                subscription:
                  localSubscription._id,

                subscriptionCycleKey:
                  cycleKey,
              },
            ],
          }).session(session);

        if (
          existingOrder
        ) {
          transactionalCharge.processingStatus =
            "fulfilled";

          transactionalCharge.order =
            existingOrder._id;

          transactionalCharge.orderNumber =
            existingOrder.orderNumber;

          transactionalCharge.processedAt =
            new Date();

          await transactionalCharge.save({
            session,
          });

          generatedOrder =
            existingOrder;

          return;
        }

        if (
          localSubscription.status !==
          "active"
        ) {
          throw createFulfillmentError(
            "subscription_not_active",
            `The subscription is currently ${localSubscription.status}.`
          );
        }

        const {
          products,

          quantitiesByProductId,

          orderItems,
        } =
          await loadProductsForSubscription(
            {
              subscription:
                localSubscription,

              session,
            }
          );

        await reserveProductInventory({
          products,

          quantitiesByProductId,

          session,
        });

        const paymentDate =
          unixToDate(
            paymentEntity.created_at
          ) || new Date();

        const deliveryDate =
          getNextDeliveryDate({
            baseDate:
              paymentDate,

            preferredDay:
              localSubscription.preferredDay,
          });

        const orderNumber =
          await createUniqueOrderNumber(
            session
          );

        const originalTotal =
          roundMoney(
            localSubscription.originalTotal ||
              orderItems.reduce(
                (
                  total,
                  item
                ) =>
                  total +
                  item.lineTotal,
                0
              )
          );

        const chargedTotal =
          roundMoney(
            actualAmountPaise /
              100
          );

        const totalDiscount =
          roundMoney(
            Math.max(
              0,
              originalTotal -
                chargedTotal
            )
          );

        const deliveryAddress =
          toPlainObject(
            localSubscription.deliveryAddress
          );

        const couponSnapshot =
          toPlainObject(
            localSubscription.coupon
          );

        const createdOrders =
          await Order.create(
            [
              {
                user:
                  localSubscription.user,

                orderNumber,

                items:
                  orderItems,

                deliveryAddress,

                deliverySchedule: {
                  deliveryDateId:
                    getDateId(
                      deliveryDate
                    ),

                  deliveryDateLabel:
                    getDeliveryDateLabel(
                      deliveryDate
                    ),

                  deliverySlot:
                    localSubscription.preferredSlot,
                },

                subtotal:
                  originalTotal,

                deliveryFee: 0,

                amountBeforeDiscount:
                  originalTotal,

                couponDiscount:
                  totalDiscount,

                coupon:
                  couponSnapshot,

                total:
                  chargedTotal,

                paymentMethod:
                  "online",

                paymentGateway:
                  "razorpay",

                paymentStatus:
                  "paid",

                paymentReference:
                  razorpayPaymentId,

                paidAt:
                  paymentDate,

                orderStatus:
                  "placed",

                deliveryStatus:
                  "unassigned",

                orderSource:
                  "subscription",

                subscription:
                  localSubscription._id,

                subscriptionNumber:
                  localSubscription.subscriptionNumber,

                subscriptionCycleKey:
                  cycleKey,

                subscriptionBillingAt:
                  paymentDate,
              },
            ],
            {
              session,
            }
          );

        generatedOrder =
          createdOrders[0];

        localSubscription.lastDeliveryOrder =
          generatedOrder._id;

        localSubscription.lastDeliveryOrderAt =
          new Date();

        localSubscription.generatedDeliveryCount =
          Number(
            localSubscription.generatedDeliveryCount ||
              0
          ) + 1;

        localSubscription.lastDeliveryGenerationAttemptAt =
          new Date();

        localSubscription.lastDeliveryGenerationFailedAt =
          null;

        localSubscription.lastDeliveryGenerationError =
          "";

        localSubscription.nextBillingAt =
          getNextBillingDate({
            subscription:
              localSubscription,

            subscriptionEntity,

            paymentDate,
          });

        /*
         * Keep mandate_pending for real
         * Razorpay subscriptions.
         *
         * The Razorpay mandate model stores
         * the true provider state. Keeping
         * this value prevents the old
         * date-based demo worker from
         * generating duplicate orders.
         */
        localSubscription.paymentStatus =
          "mandate_pending";

        localSubscription.paymentReference =
          razorpaySubscriptionId;

        await localSubscription.save({
          session,
        });

        transactionalCharge.processingStatus =
          "fulfilled";

        transactionalCharge.order =
          generatedOrder._id;

        transactionalCharge.orderNumber =
          generatedOrder.orderNumber;

        transactionalCharge.processedAt =
          new Date();

        await transactionalCharge.save({
          session,
        });
      }
    );
  } catch (error) {
    const failureCode =
      cleanText(
        error.code
      ) ||
      "fulfillment_error";

    const failureReason =
      cleanText(
        error.message
      ) ||
      "The recurring delivery order could not be generated.";

    await SubscriptionCharge.findByIdAndUpdate(
      charge._id,
      {
        $set: {
          processingStatus:
            "fulfillment_failed",

          failureCode,

          failureReason,

          processedAt:
            new Date(),
        },
      }
    );

    const subscription =
      localSubscription ||
      (await Subscription.findById(
        mandate.localSubscription
      ));

    if (subscription) {
      await Subscription.findByIdAndUpdate(
        subscription._id,
        {
          $set: {
            lastDeliveryGenerationAttemptAt:
              new Date(),

            lastDeliveryGenerationFailedAt:
              new Date(),

            lastDeliveryGenerationError:
              failureReason,
          },
        }
      );

      await notifyFulfillmentFailure({
        subscription,

        charge,

        failureReason,
      });
    }

    if (
      isBusinessFailure(
        error
      )
    ) {
      return {
        status:
          "fulfillment_failed",

        chargeId:
          String(charge._id),

        razorpayPaymentId,

        reason:
          failureReason,
      };
    }

    throw error;
  } finally {
    await session.endSession();
  }

  if (
    !generatedOrder
  ) {
    throw new Error(
      "The recurring payment was processed, but no delivery order was returned."
    );
  }

  const finalSubscription =
    localSubscription ||
    (await Subscription.findById(
      mandate.localSubscription
    ));

  if (
    finalSubscription
  ) {
    await notifySuccessfulCharge({
      subscription:
        finalSubscription,

      order:
        generatedOrder,

      charge,
    });
  }

  return {
    status: "fulfilled",

    chargeId:
      String(charge._id),

    razorpayPaymentId,

    orderId:
      String(
        generatedOrder._id
      ),

    orderNumber:
      generatedOrder.orderNumber,

    nextBillingAt:
      finalSubscription
        ?.nextBillingAt ||
      null,
  };
}

async function recordSubscriptionPaymentStateEvent({
  eventId,
  eventType,
  subscriptionEntity,
  paymentEntity,
}) {
  const razorpaySubscriptionId =
    cleanText(
      subscriptionEntity?.id
    );

  if (
    !razorpaySubscriptionId
  ) {
    return {
      status: "ignored",

      reason:
        "Razorpay subscription ID is missing.",
    };
  }

  const mandate =
    await RazorpaySubscriptionMandate.findOne(
      {
        razorpaySubscriptionId,
      }
    );

  if (!mandate) {
    return {
      status: "ignored",

      reason:
        "No matching local mandate was found.",
    };
  }

  const localSubscription =
    await Subscription.findById(
      mandate.localSubscription
    );

  if (
    paymentEntity?.id
  ) {
    const charge =
      await findOrCreateCharge({
        mandate,

        paymentEntity,

        eventId,

        eventType,
      });

    if (
      charge.processingStatus !==
      "fulfilled"
    ) {
      charge.processingStatus =
        "ignored";

      charge.failureCode =
        eventType ===
        "subscription.halted"
          ? "subscription_halted"
          : "payment_pending";

      charge.failureReason =
        cleanText(
          paymentEntity.error_description ||
            paymentEntity.error_reason
        ) ||
        (
          eventType ===
          "subscription.halted"
            ? "Razorpay exhausted the automatic payment retries."
            : "The recurring payment is pending."
        );

      charge.processedAt =
        new Date();

      await charge.save();
    }
  }

  if (
    localSubscription
  ) {
    const halted =
      eventType ===
      "subscription.halted";

    await createNotificationSafely({
      userId:
        localSubscription.user,

      type:
        "subscription",

      title: halted
        ? "Recurring payment needs action"
        : "Recurring payment pending",

      message: halted
        ? `Razorpay could not complete the recurring payment for ${localSubscription.planName}. Please review or update the payment method.`
        : `The recurring payment for ${localSubscription.planName} is pending. Razorpay may retry it automatically.`,

      action:
        "subscriptions",

      subscriptionId:
        localSubscription._id,

      metadata: {
        subscriptionNumber:
          localSubscription.subscriptionNumber,

        razorpaySubscriptionId,

        eventType,

        paymentId:
          paymentEntity?.id ||
          "",
      },

      dedupeKey:
        `subscription-payment-state:${eventId}`,
    });
  }

  return {
    status:
      eventType ===
      "subscription.halted"
        ? "halted_recorded"
        : "pending_recorded",

    razorpaySubscriptionId,
  };
}

async function retrySubscriptionChargeProcessing({
  chargeId,
}) {
  const charge =
    await SubscriptionCharge.findById(
      chargeId
    );

  if (!charge) {
    throw createFulfillmentError(
      "charge_not_found",
      "Subscription charge not found.",
      404
    );
  }

  if (
    charge.processingStatus ===
    "fulfilled"
  ) {
    return {
      status:
        "already_fulfilled",

      chargeId:
        String(charge._id),

      orderId:
        charge.order
          ? String(
              charge.order
            )
          : null,

      orderNumber:
        charge.orderNumber,

      razorpayPaymentId:
        charge.razorpayPaymentId,
    };
  }

  if (
    charge.processingStatus !==
    "fulfillment_failed"
  ) {
    throw createFulfillmentError(
      "charge_not_retryable",
      "Only fulfilment-failed charges can be retried.",
      409
    );
  }

  const mandate =
    await RazorpaySubscriptionMandate.findById(
      charge.mandate
    );

  if (!mandate) {
    throw createFulfillmentError(
      "mandate_not_found",
      "The Razorpay mandate linked to this charge was not found.",
      404
    );
  }

  charge.retryCount =
    Number(
      charge.retryCount ||
        0
    ) + 1;

  charge.lastRetriedAt =
    new Date();

  charge.processingStatus =
    "received";

  await charge.save();

  return processSubscriptionChargedEvent(
    {
      eventId:
        `admin-retry:${charge._id}:${Date.now()}`,

      eventType:
        "subscription.charged",

      subscriptionEntity: {
        id:
          charge.razorpaySubscriptionId,

        charge_at:
          mandate.chargeAt
            ? Math.floor(
                new Date(
                  mandate.chargeAt
                ).getTime() /
                  1000
              )
            : null,
      },

      paymentEntity: {
        id:
          charge.razorpayPaymentId,

        invoice_id:
          charge.razorpayInvoiceId,

        amount:
          charge.amountPaise,

        currency:
          charge.currency,

        status:
          charge.paymentStatus ||
          "captured",

        captured: true,

        method:
          charge.paymentMethod,

        created_at:
          charge.paymentCreatedAt
            ? Math.floor(
                new Date(
                  charge.paymentCreatedAt
                ).getTime() /
                  1000
              )
            : Math.floor(
                Date.now() /
                  1000
              ),
      },
    }
  );
}

module.exports = {
  processSubscriptionChargedEvent,

  recordSubscriptionPaymentStateEvent,

  retrySubscriptionChargeProcessing,
};