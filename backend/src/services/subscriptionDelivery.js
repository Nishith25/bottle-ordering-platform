const mongoose = require("mongoose");

const Order = require("../models/Order");
const Product = require("../models/Product");
const Subscription = require(
  "../models/Subscription"
);

const {
  reserveProductInventory,
} = require("./inventory");

const {
  createUniqueOrderNumber,
} = require("./orderCheckout");

const ALLOWED_PAYMENT_STATUSES = [
  "demo_confirmed",
  "active",
];

const IST_OFFSET_MS =
  5.5 * 60 * 60 * 1000;

const WEEKDAY_INDEXES = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

let workerTimer = null;
let workerRunning = false;

function cleanText(value) {
  return String(value ?? "").trim();
}

function roundMoney(value) {
  return Math.round(
    (Number(value || 0) +
      Number.EPSILON) *
      100
  ) / 100;
}

function parsePositiveInteger(
  value,
  fallback,
  maximum = 100
) {
  const parsedValue =
    Number.parseInt(
      String(value ?? ""),
      10
    );

  if (
    !Number.isFinite(parsedValue) ||
    parsedValue < 1
  ) {
    return fallback;
  }

  return Math.min(
    parsedValue,
    maximum
  );
}

function getErrorMessage(error) {
  if (
    error instanceof Error &&
    cleanText(error.message)
  ) {
    return error.message;
  }

  return (
    "Unable to generate the recurring " +
    "subscription delivery."
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

function getIstDate(value) {
  return new Date(
    new Date(value).getTime() +
      IST_OFFSET_MS
  );
}

function fromIstDate(value) {
  return new Date(
    value.getTime() -
      IST_OFFSET_MS
  );
}

function getPreferredWeekday(
  preferredDay
) {
  const normalisedValue =
    cleanText(
      preferredDay
    ).toLowerCase();

  for (
    const [
      weekday,
      weekdayIndex,
    ] of Object.entries(
      WEEKDAY_INDEXES
    )
  ) {
    if (
      normalisedValue.includes(
        weekday
      )
    ) {
      return weekdayIndex;
    }
  }

  return null;
}

function addIstDays(
  value,
  numberOfDays
) {
  const shiftedDate =
    getIstDate(value);

  shiftedDate.setUTCDate(
    shiftedDate.getUTCDate() +
      numberOfDays
  );

  return fromIstDate(
    shiftedDate
  );
}

function calculateDeliveryDate({
  billingAt,
  preferredDay,
  currentDate,
}) {
  const billingDate =
    new Date(billingAt);

  const now =
    new Date(currentDate);

  const baseDate =
    billingDate.getTime() >
    now.getTime()
      ? billingDate
      : now;

  const targetWeekday =
    getPreferredWeekday(
      preferredDay
    );

  if (targetWeekday === null) {
    return baseDate;
  }

  const shiftedBase =
    getIstDate(baseDate);

  const currentWeekday =
    shiftedBase.getUTCDay();

  const daysToAdd =
    (
      targetWeekday -
      currentWeekday +
      7
    ) % 7;

  return addIstDays(
    baseDate,
    daysToAdd
  );
}

function formatDateId(value) {
  const shiftedDate =
    getIstDate(value);

  const year =
    shiftedDate.getUTCFullYear();

  const month = String(
    shiftedDate.getUTCMonth() + 1
  ).padStart(2, "0");

  const day = String(
    shiftedDate.getUTCDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateLabel(value) {
  return new Intl.DateTimeFormat(
    "en-IN",
    {
      timeZone: "Asia/Kolkata",
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  ).format(
    new Date(value)
  );
}

function addBillingCycle(
  value,
  billingCycle
) {
  const nextDate =
    new Date(value);

  if (
    billingCycle === "weekly"
  ) {
    nextDate.setUTCDate(
      nextDate.getUTCDate() + 7
    );

    return nextDate;
  }

  const originalDay =
    nextDate.getUTCDate();

  nextDate.setUTCDate(1);

  nextDate.setUTCMonth(
    nextDate.getUTCMonth() + 1
  );

  const lastDayOfMonth =
    new Date(
      Date.UTC(
        nextDate.getUTCFullYear(),
        nextDate.getUTCMonth() + 1,
        0
      )
    ).getUTCDate();

  nextDate.setUTCDate(
    Math.min(
      originalDay,
      lastDayOfMonth
    )
  );

  return nextDate;
}

function calculateNextFutureBillingDate({
  currentBillingAt,
  billingCycle,
  currentDate,
}) {
  let nextBillingAt =
    addBillingCycle(
      currentBillingAt,
      billingCycle
    );

  const now =
    new Date(currentDate);

  let safetyCounter = 0;

  while (
    nextBillingAt.getTime() <=
      now.getTime() &&
    safetyCounter < 60
  ) {
    nextBillingAt =
      addBillingCycle(
        nextBillingAt,
        billingCycle
      );

    safetyCounter += 1;
  }

  return nextBillingAt;
}

function buildCycleKey(
  billingAt
) {
  return new Date(
    billingAt
  ).toISOString();
}

function buildPaymentReference({
  subscription,
  cycleKey,
}) {
  const cycleDate =
    cycleKey.slice(0, 10);

  return [
    "SUB",
    cleanText(
      subscription.subscriptionNumber
    ),
    cycleDate,
  ]
    .filter(Boolean)
    .join("-");
}

function buildResult({
  status,
  subscription,
  order = null,
  reason = "",
}) {
  return {
    status,

    subscriptionId:
      String(subscription._id),

    subscriptionNumber:
      subscription.subscriptionNumber,

    planName:
      subscription.planName,

    orderId:
      order?._id
        ? String(order._id)
        : null,

    orderNumber:
      order?.orderNumber || "",

    reason:
      cleanText(reason),

    nextBillingAt:
      subscription.nextBillingAt
        ? new Date(
            subscription.nextBillingAt
          ).toISOString()
        : null,
  };
}

async function markGenerationFailure({
  subscriptionId,
  reason,
}) {
  try {
    await Subscription.findByIdAndUpdate(
      subscriptionId,
      {
        $set: {
          lastDeliveryGenerationAttemptAt:
            new Date(),

          lastDeliveryGenerationFailedAt:
            new Date(),

          lastDeliveryGenerationError:
            cleanText(reason).slice(
              0,
              500
            ),
        },
      },
      {
        runValidators: true,
      }
    );
  } catch (updateError) {
    console.error(
      "Unable to store subscription delivery failure:",
      updateError.message
    );
  }
}

async function generateSubscriptionDelivery({
  subscriptionId,
  dueAt = new Date(),
  force = false,
}) {
  const session =
    await mongoose.startSession();

  let outcome = null;

  try {
    await session.withTransaction(
      async () => {
        const subscription =
          await Subscription.findById(
            subscriptionId
          ).session(session);

        if (!subscription) {
          const error =
            new Error(
              "Subscription not found."
            );

          error.statusCode = 404;
          throw error;
        }

        if (
          subscription.status !==
          "active"
        ) {
          outcome = buildResult({
            status: "skipped",
            subscription,

            reason:
              `Subscription status is ${subscription.status}.`,
          });

          return;
        }

        if (
          !ALLOWED_PAYMENT_STATUSES.includes(
            subscription.paymentStatus
          )
        ) {
          outcome = buildResult({
            status: "skipped",
            subscription,

            reason:
              "The subscription payment mandate is not active.",
          });

          return;
        }

        const billingAt =
          new Date(
            subscription.nextBillingAt
          );

        const processingDate =
          new Date(dueAt);

        if (
          Number.isNaN(
            billingAt.getTime()
          )
        ) {
          const error =
            new Error(
              "The subscription has an invalid next billing date."
            );

          error.statusCode = 409;
          throw error;
        }

        if (
          !force &&
          billingAt.getTime() >
            processingDate.getTime()
        ) {
          outcome = buildResult({
            status: "skipped",
            subscription,

            reason:
              "The subscription is not due yet.",
          });

          return;
        }

        const cycleKey =
          buildCycleKey(
            billingAt
          );

        const existingOrder =
          await Order.findOne({
            subscription:
              subscription._id,

            subscriptionCycleKey:
              cycleKey,
          }).session(session);

        const nextBillingAt =
          calculateNextFutureBillingDate({
            currentBillingAt:
              billingAt,

            billingCycle:
              subscription.billingCycle,

            currentDate:
              processingDate,
          });

        if (existingOrder) {
          subscription.nextBillingAt =
            nextBillingAt;

          subscription.lastDeliveryOrder =
            existingOrder._id;

          subscription.lastDeliveryOrderAt =
            existingOrder.createdAt ||
            new Date();

          subscription.lastDeliveryGenerationAttemptAt =
            new Date();

          subscription.lastDeliveryGenerationFailedAt =
            null;

          subscription.lastDeliveryGenerationError =
            "";

          await subscription.save({
            session,
          });

          outcome = buildResult({
            status: "skipped",
            subscription,
            order: existingOrder,

            reason:
              "This billing cycle already has a delivery order.",
          });

          return;
        }

        const quantitiesByProductId =
          new Map();

        for (
          const item of
          subscription.items
        ) {
          const productId =
            cleanText(
              item.productId
            ).toLowerCase();

          quantitiesByProductId.set(
            productId,
            (
              quantitiesByProductId.get(
                productId
              ) || 0
            ) +
              Number(
                item.quantity || 0
              )
          );
        }

        const productIds = [
          ...quantitiesByProductId.keys(),
        ];

        const products =
          await Product.find({
            productId: {
              $in: productIds,
            },

            available: true,
          }).session(session);

        if (
          products.length !==
          productIds.length
        ) {
          const error =
            new Error(
              "One or more subscription bottles are unavailable."
            );

          error.statusCode = 409;
          throw error;
        }

        const productsById =
          new Map(
            products.map(
              (product) => [
                cleanText(
                  product.productId
                ).toLowerCase(),

                product,
              ]
            )
          );

        await reserveProductInventory({
          products,
          quantitiesByProductId,
          session,
        });

        const orderItems =
          subscription.items.map(
            (item) => {
              const product =
                productsById.get(
                  cleanText(
                    item.productId
                  ).toLowerCase()
                );

              if (!product) {
                const error =
                  new Error(
                    `${item.name} is unavailable.`
                  );

                error.statusCode = 409;
                throw error;
              }

              return {
                product:
                  product._id,

                productId:
                  item.productId,

                name:
                  item.name,

                shortName:
                  item.shortName,

                sizeMl:
                  item.sizeMl,

                price:
                  item.price,

                quantity:
                  item.quantity,

                lineTotal:
                  item.lineTotal,
              };
            }
          );

        const orderNumber =
          await createUniqueOrderNumber(
            session
          );

        const deliveryDate =
          calculateDeliveryDate({
            billingAt,
            preferredDay:
              subscription.preferredDay,

            currentDate:
              processingDate,
          });

        const subtotal =
          roundMoney(
            subscription.amountBeforeCoupon ||
              (
                Number(
                  subscription.totalPerCycle ||
                    0
                ) +
                Number(
                  subscription.couponDiscount ||
                    0
                )
              )
          );

        const total =
          roundMoney(
            subscription.totalPerCycle
          );

        const totalDiscount =
          roundMoney(
            Math.max(
              0,
              subtotal - total
            )
          );

        const createdOrders =
          await Order.create(
            [
              {
                orderNumber,

                user:
                  subscription.user,

                orderSource:
                  "subscription",

                subscription:
                  subscription._id,

                subscriptionNumber:
                  subscription.subscriptionNumber,

                subscriptionCycleKey:
                  cycleKey,

                subscriptionBillingAt:
                  billingAt,

                items:
                  orderItems,

                deliveryAddress: {
                  fullName:
                    subscription
                      .deliveryAddress
                      .fullName,

                  phone:
                    subscription
                      .deliveryAddress
                      .phone,

                  pincode:
                    subscription
                      .deliveryAddress
                      .pincode,

                  houseDetails:
                    subscription
                      .deliveryAddress
                      .houseDetails,

                  areaDetails:
                    subscription
                      .deliveryAddress
                      .areaDetails,

                  landmark:
                    subscription
                      .deliveryAddress
                      .landmark,

                  area:
                    subscription
                      .deliveryAddress
                      .area,

                  city:
                    subscription
                      .deliveryAddress
                      .city,
                },

                deliverySchedule: {
                  deliveryDateId:
                    formatDateId(
                      deliveryDate
                    ),

                  deliveryDateLabel:
                    formatDateLabel(
                      deliveryDate
                    ),

                  deliverySlot:
                    subscription.preferredSlot,
                },

                subtotal,
                deliveryFee: 0,

                amountBeforeDiscount:
                  subtotal,

                couponDiscount:
                  totalDiscount,

                coupon:
                  subscription.coupon
                    ? toPlainObject(
                        subscription.coupon
                      )
                    : null,

                total,

                paymentMethod:
                  "online",

                paymentGateway: "",

                paymentStatus:
                  "paid",

                paymentReference:
                  buildPaymentReference({
                    subscription,
                    cycleKey,
                  }),

                paidAt:
                  new Date(),

                orderStatus:
                  "placed",

                deliveryStatus:
                  "unassigned",

                refundStatus:
                  "not_required",

                inventoryReserved:
                  true,

                inventoryRestored:
                  false,
              },
            ],
            {
              session,
            }
          );

        const createdOrder =
          createdOrders[0];

        subscription.nextBillingAt =
          nextBillingAt;

        subscription.lastDeliveryOrder =
          createdOrder._id;

        subscription.lastDeliveryOrderAt =
          new Date();

        subscription.lastDeliveryGenerationAttemptAt =
          new Date();

        subscription.lastDeliveryGenerationFailedAt =
          null;

        subscription.lastDeliveryGenerationError =
          "";

        subscription.generatedDeliveryCount =
          Number(
            subscription.generatedDeliveryCount ||
              0
          ) + 1;

        await subscription.save({
          session,
        });

        outcome = buildResult({
          status: "created",
          subscription,
          order: createdOrder,
        });
      }
    );

    return outcome;
  } catch (error) {
    if (
      error?.code === 11000
    ) {
      const subscription =
        await Subscription.findById(
          subscriptionId
        );

      if (subscription) {
        const existingOrder =
          await Order.findOne({
            subscription:
              subscription._id,

            subscriptionCycleKey:
              buildCycleKey(
                subscription.nextBillingAt
              ),
          });

        return buildResult({
          status: "skipped",
          subscription,
          order: existingOrder,

          reason:
            "This billing cycle was already processed.",
        });
      }
    }

    const message =
      getErrorMessage(error);

    await markGenerationFailure({
      subscriptionId,
      reason: message,
    });

    const subscription =
      await Subscription.findById(
        subscriptionId
      );

    if (!subscription) {
      throw error;
    }

    return buildResult({
      status: "failed",
      subscription,
      reason: message,
    });
  } finally {
    await session.endSession();
  }
}

async function getDueSubscriptionDeliveriesPreview({
  dueAt = new Date(),
  limit = 50,
} = {}) {
  const safeLimit =
    parsePositiveInteger(
      limit,
      50,
      100
    );

  const processingDate =
    new Date(dueAt);

  const filter = {
    status: "active",

    paymentStatus: {
      $in:
        ALLOWED_PAYMENT_STATUSES,
    },

    nextBillingAt: {
      $lte:
        processingDate,
    },
  };

  const [
    subscriptions,
    totalDue,
  ] = await Promise.all([
    Subscription.find(filter)
      .populate(
        "user",
        "fullName email phone role active"
      )
      .populate(
        "lastDeliveryOrder",
        "orderNumber orderStatus deliveryStatus createdAt"
      )
      .sort({
        nextBillingAt: 1,
        createdAt: 1,
      })
      .limit(safeLimit)
      .lean(),

    Subscription.countDocuments(
      filter
    ),
  ]);

  const data =
    subscriptions.map(
      (subscription) => {
        const dueTime =
          new Date(
            subscription.nextBillingAt
          ).getTime();

        const overdueByDays =
          Math.max(
            0,

            Math.floor(
              (
                processingDate.getTime() -
                dueTime
              ) /
                (
                  24 *
                  60 *
                  60 *
                  1000
                )
            )
          );

        return {
          ...subscription,
          overdueByDays,
        };
      }
    );

  return {
    totalDue,
    count: data.length,
    dueAt:
      processingDate.toISOString(),

    subscriptions: data,
  };
}

async function generateDueSubscriptionDeliveries({
  dueAt = new Date(),
  limit = 25,
  subscriptionId = null,
} = {}) {
  const safeLimit =
    parsePositiveInteger(
      limit,
      25,
      100
    );

  const processingDate =
    new Date(dueAt);

  const filter = {
    status: "active",

    paymentStatus: {
      $in:
        ALLOWED_PAYMENT_STATUSES,
    },

    nextBillingAt: {
      $lte:
        processingDate,
    },
  };

  if (subscriptionId) {
    filter._id =
      subscriptionId;
  }

  const dueSubscriptions =
    await Subscription.find(filter)
      .sort({
        nextBillingAt: 1,
        createdAt: 1,
      })
      .limit(safeLimit)
      .select("_id")
      .lean();

  const results = [];

  for (
    const dueSubscription of
    dueSubscriptions
  ) {
    const result =
      await generateSubscriptionDelivery({
        subscriptionId:
          dueSubscription._id,

        dueAt:
          processingDate,

        force: false,
      });

    results.push(result);
  }

  return {
    processedCount:
      results.length,

    createdCount:
      results.filter(
        (result) =>
          result.status ===
          "created"
      ).length,

    skippedCount:
      results.filter(
        (result) =>
          result.status ===
          "skipped"
      ).length,

    failedCount:
      results.filter(
        (result) =>
          result.status ===
          "failed"
      ).length,

    processedAt:
      new Date().toISOString(),

    results,
  };
}

function startSubscriptionDeliveryWorker() {
  if (
    process.env.NODE_ENV ===
      "test" ||
    String(
      process.env
        .SUBSCRIPTION_DELIVERY_WORKER_ENABLED ??
        "true"
    ).toLowerCase() === "false"
  ) {
    return null;
  }

  if (workerTimer) {
    return workerTimer;
  }

  const intervalMinutes =
    parsePositiveInteger(
      process.env
        .SUBSCRIPTION_DELIVERY_WORKER_INTERVAL_MINUTES,

      15,
      1440
    );

  const batchLimit =
    parsePositiveInteger(
      process.env
        .SUBSCRIPTION_DELIVERY_WORKER_BATCH_LIMIT,

      25,
      100
    );

  const runWorker =
    async () => {
      if (workerRunning) {
        return;
      }

      workerRunning = true;

      try {
        const result =
          await generateDueSubscriptionDeliveries({
            dueAt:
              new Date(),

            limit:
              batchLimit,
          });

        if (
          result.createdCount > 0 ||
          result.failedCount > 0
        ) {
          console.log(
            "Subscription delivery worker:",
            {
              created:
                result.createdCount,

              skipped:
                result.skippedCount,

              failed:
                result.failedCount,
            }
          );
        }
      } catch (error) {
        console.error(
          "Subscription delivery worker failed:",
          error.message
        );
      } finally {
        workerRunning = false;
      }
    };

  const initialTimer =
    setTimeout(() => {
      void runWorker();
    }, 8000);

  if (
    typeof initialTimer.unref ===
    "function"
  ) {
    initialTimer.unref();
  }

  workerTimer =
    setInterval(
      () => {
        void runWorker();
      },
      intervalMinutes *
        60 *
        1000
    );

  if (
    typeof workerTimer.unref ===
    "function"
  ) {
    workerTimer.unref();
  }

  console.log(
    `Subscription delivery worker enabled every ${intervalMinutes} minute(s).`
  );

  return workerTimer;
}

module.exports = {
  generateDueSubscriptionDeliveries,
  generateSubscriptionDelivery,
  getDueSubscriptionDeliveriesPreview,
  startSubscriptionDeliveryWorker,
};