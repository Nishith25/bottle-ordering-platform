const crypto = require("crypto");
const express = require("express");
const mongoose = require("mongoose");

const {
  protect,
} = require("../middleware/auth");

const Product = require(
  "../models/Product"
);

const ServiceableLocation = require(
  "../models/ServiceableLocation"
);

const Subscription = require(
  "../models/Subscription"
);

const SubscriptionPlan = require(
  "../models/SubscriptionPlan"
);

const {
  getCouponQuote,
  normalizeCouponCode,
  redeemCouponForRecord,
} = require(
  "../services/couponService"
);

const router = express.Router();

const ALLOWED_RECURRING_PAYMENT_STATUSES = [
  "demo_confirmed",
  "active",
];

function cleanText(value) {
  return String(
    value ?? ""
  ).trim();
}

function cleanPhone(value) {
  return String(
    value ?? ""
  ).replace(/\D/g, "");
}

function cleanPincode(value) {
  return String(
    value ?? ""
  ).replace(/\D/g, "");
}

function roundMoney(value) {
  return (
    Math.round(
      (
        Number(value) +
        Number.EPSILON
      ) *
        100
    ) / 100
  );
}

function createHttpError(
  message,
  statusCode = 400
) {
  const error =
    new Error(message);

  error.statusCode =
    statusCode;

  return error;
}

function generateSubscriptionNumber() {
  const datePart =
    new Date()
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "");

  const randomPart =
    crypto
      .randomBytes(3)
      .toString("hex")
      .toUpperCase();

  return `SUB-${datePart}-${randomPart}`;
}

async function createUniqueSubscriptionNumber(
  session
) {
  for (
    let attempt = 0;
    attempt < 5;
    attempt += 1
  ) {
    const subscriptionNumber =
      generateSubscriptionNumber();

    const exists =
      await Subscription.exists({
        subscriptionNumber,
      }).session(session);

    if (!exists) {
      return subscriptionNumber;
    }
  }

  throw new Error(
    "Unable to generate a subscription number."
  );
}

function addBillingCycle(
  value,
  billingCycle
) {
  const sourceDate =
    new Date(value);

  if (
    Number.isNaN(
      sourceDate.getTime()
    )
  ) {
    throw createHttpError(
      "The subscription has an invalid billing date.",
      409
    );
  }

  if (
    billingCycle ===
    "weekly"
  ) {
    sourceDate.setUTCDate(
      sourceDate.getUTCDate() +
        7
    );

    return sourceDate;
  }

  const originalDay =
    sourceDate.getUTCDate();

  sourceDate.setUTCDate(1);

  sourceDate.setUTCMonth(
    sourceDate.getUTCMonth() +
      1
  );

  const finalDayOfMonth =
    new Date(
      Date.UTC(
        sourceDate.getUTCFullYear(),
        sourceDate.getUTCMonth() +
          1,
        0
      )
    ).getUTCDate();

  sourceDate.setUTCDate(
    Math.min(
      originalDay,
      finalDayOfMonth
    )
  );

  return sourceDate;
}

function calculateNextBillingDate(
  billingCycle
) {
  return addBillingCycle(
    new Date(),
    billingCycle
  );
}

function moveBillingDateIntoFuture({
  nextBillingAt,
  billingCycle,
}) {
  let futureDate =
    new Date(nextBillingAt);

  if (
    Number.isNaN(
      futureDate.getTime()
    )
  ) {
    futureDate =
      new Date();
  }

  const now =
    new Date();

  let safetyCounter = 0;

  while (
    futureDate.getTime() <=
      now.getTime() &&
    safetyCounter < 60
  ) {
    futureDate =
      addBillingCycle(
        futureDate,
        billingCycle
      );

    safetyCounter += 1;
  }

  return futureDate;
}

function validateAddress(address) {
  if (!address) {
    return (
      "Delivery address is required."
    );
  }

  if (
    cleanText(
      address.fullName
    ).length < 2
  ) {
    return (
      "A valid customer name is required."
    );
  }

  if (
    !/^[6-9]\d{9}$/.test(
      cleanPhone(
        address.phone
      )
    )
  ) {
    return (
      "A valid 10-digit Indian mobile number is required."
    );
  }

  if (
    cleanPincode(
      address.pincode
    ).length !== 6
  ) {
    return (
      "A valid six-digit pincode is required."
    );
  }

  if (
    cleanText(
      address.houseDetails
    ).length < 3
  ) {
    return (
      "House, flat or building details are required."
    );
  }

  if (
    cleanText(
      address.areaDetails
    ).length < 3
  ) {
    return (
      "Area and street details are required."
    );
  }

  return null;
}

async function findCustomerSubscription(
  subscriptionId,
  userId
) {
  return Subscription.findOne({
    _id: subscriptionId,
    user: userId,
  });
}

/*
 * Public subscription plans
 */
router.get(
  "/plans",
  async (
    req,
    res,
    next
  ) => {
    try {
      const plans =
        await SubscriptionPlan.find({
          active: true,
        })
          .sort({
            sortOrder: 1,
            createdAt: 1,
          })
          .lean();

      return res.status(200).json({
        success: true,
        count: plans.length,

        data: {
          plans,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

/*
 * Create subscription
 */
router.post(
  "/",
  protect,
  async (
    req,
    res,
    next
  ) => {
    const session =
      await mongoose.startSession();

    try {
      let createdSubscription =
        null;

      await session.withTransaction(
        async () => {
          const planId =
            cleanText(
              req.body.planId
            ).toLowerCase();

          const requestedItems =
            req.body.items;

          const preferredDay =
            cleanText(
              req.body.preferredDay
            );

          const preferredSlot =
            cleanText(
              req.body.preferredSlot
            );

          const deliveryAddress =
            req.body.deliveryAddress;

          const paymentMethod =
            cleanText(
              req.body.paymentMethod
            ).toLowerCase();

          if (!planId) {
            throw createHttpError(
              "Please select a subscription plan."
            );
          }

          const plan =
            await SubscriptionPlan.findOne({
              planId,
              active: true,
            })
              .session(session)
              .lean();

          if (!plan) {
            throw createHttpError(
              "This subscription plan is unavailable.",
              404
            );
          }

          if (
            !Array.isArray(
              requestedItems
            ) ||
            requestedItems.length ===
              0
          ) {
            throw createHttpError(
              "Select bottles for your subscription."
            );
          }

          if (
            !preferredDay ||
            !preferredSlot
          ) {
            throw createHttpError(
              "Select a preferred delivery day and slot."
            );
          }

          if (
            ![
              "upi_autopay",
              "card_mandate",
            ].includes(
              paymentMethod
            )
          ) {
            throw createHttpError(
              "Please choose a valid recurring payment method."
            );
          }

          const addressError =
            validateAddress(
              deliveryAddress
            );

          if (addressError) {
            throw createHttpError(
              addressError
            );
          }

          const pincode =
            cleanPincode(
              deliveryAddress.pincode
            );

          const serviceableLocation =
            await ServiceableLocation.findOne({
              pincode,
              active: true,
            })
              .session(session)
              .lean();

          if (
            !serviceableLocation
          ) {
            throw createHttpError(
              "Subscription delivery is not available for this pincode."
            );
          }

          const quantitiesByProductId =
            new Map();

          for (
            const requestedItem of
            requestedItems
          ) {
            const productId =
              cleanText(
                requestedItem.productId ||
                  requestedItem.id
              ).toLowerCase();

            const quantity =
              Number(
                requestedItem.quantity
              );

            if (!productId) {
              throw createHttpError(
                "A selected bottle is missing its product ID."
              );
            }

            if (
              !Number.isInteger(
                quantity
              ) ||
              quantity < 1 ||
              quantity > 100
            ) {
              throw createHttpError(
                "Each bottle quantity must be a valid whole number."
              );
            }

            quantitiesByProductId.set(
              productId,
              (
                quantitiesByProductId.get(
                  productId
                ) || 0
              ) + quantity
            );
          }

          const selectedBottleCount =
            [
              ...quantitiesByProductId.values(),
            ].reduce(
              (
                sum,
                quantity
              ) =>
                sum + quantity,
              0
            );

          if (
            selectedBottleCount !==
            plan.bottleCount
          ) {
            throw createHttpError(
              `${plan.name} requires exactly ${plan.bottleCount} bottles.`
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

              subscriptionEligible:
                true,
            })
              .session(session)
              .lean();

          if (
            products.length !==
            productIds.length
          ) {
            throw createHttpError(
              "One or more selected bottles are unavailable for subscriptions."
            );
          }

          const productsById =
            new Map(
              products.map(
                (product) => [
                  product.productId,
                  product,
                ]
              )
            );

          const subscriptionItems =
            productIds.map(
              (productId) => {
                const product =
                  productsById.get(
                    productId
                  );

                const quantity =
                  quantitiesByProductId.get(
                    product.productId
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
                    product.price,

                  quantity,

                  lineTotal:
                    roundMoney(
                      product.price *
                        quantity
                    ),
                };
              }
            );

          const originalTotal =
            roundMoney(
              subscriptionItems.reduce(
                (
                  sum,
                  item
                ) =>
                  sum +
                  item.lineTotal,
                0
              )
            );

          const savings =
            roundMoney(
              originalTotal *
                (
                  plan.discountPercent /
                  100
                )
            );

          const amountBeforeCoupon =
            roundMoney(
              originalTotal -
                savings
            );

          if (
            amountBeforeCoupon <
            serviceableLocation.minimumOrder
          ) {
            throw createHttpError(
              `The subscription total must be at least ₹${serviceableLocation.minimumOrder} for ${serviceableLocation.area}.`
            );
          }

          const couponCode =
            normalizeCouponCode(
              req.body.couponCode
            );

          let coupon = null;
          let couponDiscount = 0;

          if (couponCode) {
            const quote =
              await getCouponQuote({
                code:
                  couponCode,

                context:
                  "subscription",

                eligibleAmount:
                  amountBeforeCoupon,

                userId:
                  req.user._id,

                session,

                includeUsageValidation:
                  true,
              });

            coupon =
              quote.snapshot;

            couponDiscount =
              quote.snapshot
                .discountAmount;
          }

          const totalPerCycle =
            roundMoney(
              Math.max(
                0,

                amountBeforeCoupon -
                  couponDiscount
              )
            );

          const subscriptionNumber =
            await createUniqueSubscriptionNumber(
              session
            );

          const subscriptions =
            await Subscription.create(
              [
                {
                  subscriptionNumber,

                  user:
                    req.user._id,

                  plan:
                    plan._id,

                  planId:
                    plan.planId,

                  planName:
                    plan.name,

                  billingCycle:
                    plan.billingCycle,

                  bottleCount:
                    plan.bottleCount,

                  deliveriesPerCycle:
                    plan.deliveriesPerCycle,

                  items:
                    subscriptionItems,

                  preferredDay,

                  preferredSlot,

                  deliveryAddress: {
                    fullName:
                      cleanText(
                        deliveryAddress.fullName
                      ),

                    phone:
                      cleanPhone(
                        deliveryAddress.phone
                      ),

                    pincode,

                    houseDetails:
                      cleanText(
                        deliveryAddress.houseDetails
                      ),

                    areaDetails:
                      cleanText(
                        deliveryAddress.areaDetails
                      ),

                    landmark:
                      cleanText(
                        deliveryAddress.landmark
                      ),

                    area:
                      serviceableLocation.area,

                    city:
                      serviceableLocation.city,
                  },

                  originalTotal,

                  discountPercent:
                    plan.discountPercent,

                  savings,

                  amountBeforeCoupon,

                  couponDiscount,

                  coupon,

                  totalPerCycle,

                  recurringTotalPerCycle:
                    amountBeforeCoupon,

                  paymentMethod,

                  paymentStatus:
                    "demo_confirmed",

                  paymentReference:
                    `DEMO-MANDATE-${Date.now()}`,

                  status:
                    "active",

                  nextBillingAt:
                    calculateNextBillingDate(
                      plan.billingCycle
                    ),
                },
              ],
              {
                session,
              }
            );

          createdSubscription =
            subscriptions[0];

          if (
            coupon?.couponId
          ) {
            const usage =
              await redeemCouponForRecord({
                couponSnapshot:
                  coupon,

                userId:
                  req.user._id,

                context:
                  "subscription",

                recordId:
                  createdSubscription._id,

                session,
              });

            createdSubscription.couponUsage =
              usage?._id ||
              null;

            await createdSubscription.save({
              session,
            });
          }
        }
      );

      return res.status(201).json({
        success: true,

        message:
          "Your subscription was activated successfully.",

        data: {
          subscription:
            createdSubscription,
        },
      });
    } catch (error) {
      return next(error);
    } finally {
      await session.endSession();
    }
  }
);

/*
 * Current user's subscriptions
 */
router.get(
  "/my",
  protect,
  async (
    req,
    res,
    next
  ) => {
    try {
      const subscriptions =
        await Subscription.find({
          user:
            req.user._id,
        })
          .sort({
            createdAt: -1,
          })
          .lean();

      return res.status(200).json({
        success: true,
        count:
          subscriptions.length,

        data: {
          subscriptions,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

/*
 * Pause subscription
 */
router.patch(
  "/:subscriptionId/pause",
  protect,
  async (
    req,
    res,
    next
  ) => {
    try {
      const subscription =
        await findCustomerSubscription(
          req.params
            .subscriptionId,

          req.user._id
        );

      if (!subscription) {
        return res.status(404).json({
          success: false,

          message:
            "Subscription not found.",
        });
      }

      if (
        subscription.status ===
        "paused"
      ) {
        return res.status(400).json({
          success: false,

          message:
            "This subscription is already paused.",
        });
      }

      if (
        subscription.status !==
        "active"
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Only an active subscription can be paused.",
        });
      }

      subscription.status =
        "paused";

      subscription.cancellationReason =
        "";

      subscription.cancelledAt =
        null;

      await subscription.save();

      return res.status(200).json({
        success: true,

        message:
          "Your subscription was paused. No recurring delivery orders will be generated while it remains paused.",

        data: {
          subscription,
        },
      });
    } catch (error) {
      if (
        error.name ===
        "CastError"
      ) {
        return res.status(404).json({
          success: false,

          message:
            "Subscription not found.",
        });
      }

      return next(error);
    }
  }
);

/*
 * Resume subscription
 */
router.patch(
  "/:subscriptionId/resume",
  protect,
  async (
    req,
    res,
    next
  ) => {
    try {
      const subscription =
        await findCustomerSubscription(
          req.params
            .subscriptionId,

          req.user._id
        );

      if (!subscription) {
        return res.status(404).json({
          success: false,

          message:
            "Subscription not found.",
        });
      }

      if (
        subscription.status ===
        "active"
      ) {
        return res.status(400).json({
          success: false,

          message:
            "This subscription is already active.",
        });
      }

      if (
        subscription.status !==
        "paused"
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Only a paused subscription can be resumed.",
        });
      }

      if (
        [
          "failed",
          "cancelled",
        ].includes(
          subscription.paymentStatus
        )
      ) {
        return res.status(400).json({
          success: false,

          message:
            "This subscription cannot be resumed until its payment mandate is restored.",
        });
      }

      subscription.status =
        "active";

      subscription.cancellationReason =
        "";

      subscription.cancelledAt =
        null;

      if (
        subscription.paymentStatus ===
        "mandate_pending"
      ) {
        subscription.paymentStatus =
          "demo_confirmed";
      }

      subscription.nextBillingAt =
        moveBillingDateIntoFuture({
          nextBillingAt:
            subscription.nextBillingAt,

          billingCycle:
            subscription.billingCycle,
        });

      await subscription.save();

      return res.status(200).json({
        success: true,

        message:
          "Your subscription was resumed successfully.",

        data: {
          subscription,
        },
      });
    } catch (error) {
      if (
        error.name ===
        "CastError"
      ) {
        return res.status(404).json({
          success: false,

          message:
            "Subscription not found.",
        });
      }

      return next(error);
    }
  }
);

/*
 * Skip the next upcoming delivery cycle
 */
router.patch(
  "/:subscriptionId/skip-next",
  protect,
  async (
    req,
    res,
    next
  ) => {
    try {
      const subscription =
        await findCustomerSubscription(
          req.params
            .subscriptionId,

          req.user._id
        );

      if (!subscription) {
        return res.status(404).json({
          success: false,

          message:
            "Subscription not found.",
        });
      }

      if (
        subscription.status !==
        "active"
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Only an active subscription can skip its next delivery."
        });
      }

      if (
        !ALLOWED_RECURRING_PAYMENT_STATUSES.includes(
          subscription.paymentStatus
        )
      ) {
        return res.status(400).json({
          success: false,

          message:
            "The subscription payment mandate is not active."
        });
      }

      const currentBillingAt =
        new Date(
          subscription.nextBillingAt
        );

      if (
        Number.isNaN(
          currentBillingAt.getTime()
        )
      ) {
        return res.status(409).json({
          success: false,

          message:
            "This subscription has an invalid next billing date."
        });
      }

      if (
        currentBillingAt.getTime() <=
        Date.now()
      ) {
        return res.status(409).json({
          success: false,

          message:
            "The current delivery cycle is already due and can no longer be skipped."
        });
      }

      const skippedBillingDate =
        currentBillingAt;

      subscription.nextBillingAt =
        addBillingCycle(
          currentBillingAt,
          subscription.billingCycle
        );

      await subscription.save();

      return res.status(200).json({
        success: true,

        message:
          "The next subscription delivery was skipped successfully.",

        data: {
          subscription,

          skippedBillingDate,
        },
      });
    } catch (error) {
      if (
        error.name ===
        "CastError"
      ) {
        return res.status(404).json({
          success: false,

          message:
            "Subscription not found.",
        });
      }

      return next(error);
    }
  }
);

/*
 * Cancel subscription
 */
router.patch(
  "/:subscriptionId/cancel",
  protect,
  async (
    req,
    res,
    next
  ) => {
    try {
      const subscription =
        await findCustomerSubscription(
          req.params
            .subscriptionId,

          req.user._id
        );

      if (!subscription) {
        return res.status(404).json({
          success: false,

          message:
            "Subscription not found.",
        });
      }

      if (
        subscription.status ===
        "cancelled"
      ) {
        return res.status(400).json({
          success: false,

          message:
            "This subscription is already cancelled.",
        });
      }

      if (
        subscription.status ===
        "expired"
      ) {
        return res.status(400).json({
          success: false,

          message:
            "An expired subscription cannot be cancelled.",
        });
      }

      subscription.status =
        "cancelled";

      subscription.paymentStatus =
        "cancelled";

      subscription.cancelledAt =
        new Date();

      subscription.cancellationReason =
        cleanText(
          req.body.reason
        ) ||
        "Cancelled by customer";

      await subscription.save();

      return res.status(200).json({
        success: true,

        message:
          "Your subscription was cancelled.",

        data: {
          subscription,
        },
      });
    } catch (error) {
      if (
        error.name ===
        "CastError"
      ) {
        return res.status(404).json({
          success: false,

          message:
            "Subscription not found.",
        });
      }

      return next(error);
    }
  }
);

/*
 * Single subscription details
 */
router.get(
  "/:subscriptionId",
  protect,
  async (
    req,
    res,
    next
  ) => {
    try {
      const query = {
        _id:
          req.params
            .subscriptionId,
      };

      if (
        req.user.role !==
        "admin"
      ) {
        query.user =
          req.user._id;
      }

      const subscription =
        await Subscription.findOne(
          query
        ).lean();

      if (!subscription) {
        return res.status(404).json({
          success: false,

          message:
            "Subscription not found.",
        });
      }

      return res.status(200).json({
        success: true,

        data: {
          subscription,
        },
      });
    } catch (error) {
      if (
        error.name ===
        "CastError"
      ) {
        return res.status(404).json({
          success: false,

          message:
            "Subscription not found.",
        });
      }

      return next(error);
    }
  }
);

module.exports = router;