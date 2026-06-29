const Product = require("../models/Product");
const ServiceableLocation = require(
  "../models/ServiceableLocation"
);
const Subscription = require(
  "../models/Subscription"
);

const {
  createNotificationSafely,
} = require("./notificationService");

const EDIT_LOCK_HOURS = 24;

function cleanText(value) {
  return String(value ?? "").trim();
}

function cleanPhone(value) {
  return String(value ?? "").replace(
    /\D/g,
    ""
  );
}

function cleanPincode(value) {
  return String(value ?? "").replace(
    /\D/g,
    ""
  );
}

function roundMoney(value) {
  return (
    Math.round(
      (Number(value || 0) +
        Number.EPSILON) *
        100
    ) / 100
  );
}

function createHttpError(
  message,
  statusCode = 400
) {
  const error = new Error(message);

  error.statusCode = statusCode;

  return error;
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

function validateAddress(address) {
  if (!address) {
    return "Delivery address is required.";
  }

  if (
    cleanText(
      address.fullName
    ).length < 2
  ) {
    return "A valid customer name is required.";
  }

  if (
    !/^[6-9]\d{9}$/.test(
      cleanPhone(address.phone)
    )
  ) {
    return "A valid 10-digit Indian mobile number is required.";
  }

  if (
    cleanPincode(
      address.pincode
    ).length !== 6
  ) {
    return "A valid six-digit pincode is required.";
  }

  if (
    cleanText(
      address.houseDetails
    ).length < 3
  ) {
    return "House, flat or building details are required.";
  }

  if (
    cleanText(
      address.areaDetails
    ).length < 3
  ) {
    return "Area and street details are required.";
  }

  return null;
}

function getEditDeadline(
  subscription
) {
  const nextBillingAt =
    new Date(
      subscription.nextBillingAt
    );

  if (
    Number.isNaN(
      nextBillingAt.getTime()
    )
  ) {
    return null;
  }

  return new Date(
    nextBillingAt.getTime() -
      EDIT_LOCK_HOURS *
        60 *
        60 *
        1000
  );
}

function getSubscriptionEditState(
  subscription
) {
  if (
    !subscription ||
    ![
      "active",
      "paused",
    ].includes(
      subscription.status
    )
  ) {
    return {
      canEdit: false,
      editDeadline: null,

      reason:
        "Only active or paused subscriptions can be edited.",
    };
  }

  const editDeadline =
    getEditDeadline(
      subscription
    );

  if (!editDeadline) {
    return {
      canEdit: false,
      editDeadline: null,

      reason:
        "The subscription has an invalid billing date.",
    };
  }

  /*
   * Paused subscriptions do not generate
   * recurring orders, so they can be edited
   * even when their stored billing date has passed.
   */
  if (
    subscription.status ===
    "paused"
  ) {
    return {
      canEdit: true,
      editDeadline,

      reason:
        "Changes will apply when the subscription is resumed.",
    };
  }

  if (
    editDeadline.getTime() <=
    Date.now()
  ) {
    return {
      canEdit: false,
      editDeadline,

      reason:
        "Changes are locked during the final 24 hours before billing.",
    };
  }

  return {
    canEdit: true,
    editDeadline,

    reason:
      "Changes will apply to future recurring delivery orders.",
  };
}

function calculateCouponDiscount(
  coupon,
  eligibleAmount
) {
  if (!coupon) {
    return 0;
  }

  const appliesTo =
    cleanText(
      coupon.appliesTo
    ).toLowerCase();

  if (
    ![
      "subscription",
      "both",
    ].includes(appliesTo)
  ) {
    return 0;
  }

  const minimumOrder =
    Number(
      coupon.minimumOrder || 0
    );

  if (
    eligibleAmount <
    minimumOrder
  ) {
    return 0;
  }

  const discountType =
    cleanText(
      coupon.discountType
    ).toLowerCase();

  const discountValue =
    Number(
      coupon.discountValue || 0
    );

  let discountAmount = 0;

  if (
    discountType === "fixed"
  ) {
    discountAmount =
      discountValue;
  }

  if (
    discountType ===
    "percentage"
  ) {
    discountAmount =
      eligibleAmount *
      (discountValue / 100);

    const maximumDiscount =
      Number(
        coupon.maxDiscountAmount ||
          0
      );

    if (
      maximumDiscount > 0
    ) {
      discountAmount =
        Math.min(
          discountAmount,
          maximumDiscount
        );
    }
  }

  return roundMoney(
    Math.min(
      Math.max(
        discountAmount,
        0
      ),
      eligibleAmount
    )
  );
}

async function updateFutureSubscription({
  subscriptionId,
  userId,
  input,
}) {
  const session =
    await Subscription.startSession();

  let updatedSubscriptionId =
    null;

  try {
    await session.withTransaction(
      async () => {
        const subscription =
          await Subscription.findOne({
            _id: subscriptionId,
            user: userId,
          }).session(session);

        if (!subscription) {
          throw createHttpError(
            "Subscription not found.",
            404
          );
        }

        const editState =
          getSubscriptionEditState(
            subscription
          );

        if (!editState.canEdit) {
          throw createHttpError(
            editState.reason,
            409
          );
        }

        const requestedItems =
          input.items;

        const preferredDay =
          cleanText(
            input.preferredDay
          );

        const preferredSlot =
          cleanText(
            input.preferredSlot
          );

        const deliveryAddress =
          input.deliveryAddress;

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
            "Select a preferred delivery day and time slot."
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
              requestedItem.productId
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
              total,
              quantity
            ) =>
              total + quantity,
            0
          );

        if (
          selectedBottleCount !==
          subscription.bottleCount
        ) {
          throw createHttpError(
            `${subscription.planName} requires exactly ${subscription.bottleCount} bottles.`
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
                cleanText(
                  product.productId
                ).toLowerCase(),

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

              if (!product) {
                throw createHttpError(
                  "A selected bottle is unavailable."
                );
              }

              const quantity =
                quantitiesByProductId.get(
                  productId
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
                total,
                item
              ) =>
                total +
                item.lineTotal,
              0
            )
          );

        const discountPercent =
          Number(
            subscription.discountPercent ||
              0
          );

        const savings =
          roundMoney(
            originalTotal *
              (
                discountPercent /
                100
              )
          );

        const amountBeforeCoupon =
          roundMoney(
            Math.max(
              0,
              originalTotal -
                savings
            )
          );

        if (
          amountBeforeCoupon <
          serviceableLocation.minimumOrder
        ) {
          throw createHttpError(
            `The subscription total must be at least ₹${serviceableLocation.minimumOrder} for ${serviceableLocation.area}.`
          );
        }

        const couponSnapshot =
          subscription.coupon
            ? toPlainObject(
                subscription.coupon
              )
            : null;

        const couponDiscount =
          calculateCouponDiscount(
            couponSnapshot,
            amountBeforeCoupon
          );

        if (couponSnapshot) {
          couponSnapshot.eligibleAmount =
            amountBeforeCoupon;

          couponSnapshot.discountAmount =
            couponDiscount;
        }

        const totalPerCycle =
          roundMoney(
            Math.max(
              0,
              amountBeforeCoupon -
                couponDiscount
            )
          );

        subscription.items =
          subscriptionItems;

        subscription.preferredDay =
          preferredDay;

        subscription.preferredSlot =
          preferredSlot;

        subscription.deliveryAddress = {
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
        };

        subscription.originalTotal =
          originalTotal;

        subscription.savings =
          savings;

        subscription.amountBeforeCoupon =
          amountBeforeCoupon;

        subscription.couponDiscount =
          couponDiscount;

        subscription.coupon =
          couponSnapshot;

        subscription.totalPerCycle =
          totalPerCycle;

        subscription.recurringTotalPerCycle =
          amountBeforeCoupon;

        await subscription.save({
          session,
        });

        updatedSubscriptionId =
          subscription._id;
      }
    );
  } finally {
    await session.endSession();
  }

  const updatedSubscription =
    await Subscription.findById(
      updatedSubscriptionId
    ).lean();

  if (!updatedSubscription) {
    throw createHttpError(
      "Subscription not found.",
      404
    );
  }

  await createNotificationSafely({
    userId:
      updatedSubscription.user,

    type: "system",

    title:
      "Subscription updated",

    message:
      `${updatedSubscription.subscriptionNumber} was updated. The new bottles, schedule and address will apply to future recurring deliveries.`,

    action:
      "subscriptions",

    subscriptionId:
      updatedSubscription._id,

    metadata: {
      subscriptionNumber:
        updatedSubscription.subscriptionNumber,

      planName:
        updatedSubscription.planName,

      nextBillingAt:
        updatedSubscription.nextBillingAt,
    },

    dedupeKey:
      `subscription:${updatedSubscription._id}:edited:${new Date(
        updatedSubscription.updatedAt
      ).getTime()}`,
  });

  return updatedSubscription;
}

module.exports = {
  EDIT_LOCK_HOURS,
  getSubscriptionEditState,
  updateFutureSubscription,
};