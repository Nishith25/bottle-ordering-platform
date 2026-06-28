// backend/src/routes/subscriptions.js

const crypto = require("crypto");
const express = require("express");

const { protect } = require(
  "../middleware/auth"
);

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

const router = express.Router();

function cleanText(value) {
  return String(value || "").trim();
}

function cleanPhone(value) {
  return String(value || "").replace(
    /\D/g,
    ""
  );
}

function cleanPincode(value) {
  return String(value || "").replace(
    /\D/g,
    ""
  );
}

function generateSubscriptionNumber() {
  const datePart = new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");

  const randomPart = crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase();

  return `SUB-${datePart}-${randomPart}`;
}

async function createUniqueSubscriptionNumber() {
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
      });

    if (!exists) {
      return subscriptionNumber;
    }
  }

  throw new Error(
    "Unable to generate a subscription number."
  );
}

function calculateNextBillingDate(
  billingCycle
) {
  const nextDate = new Date();

  if (billingCycle === "weekly") {
    nextDate.setDate(
      nextDate.getDate() + 7
    );

    return nextDate;
  }

  nextDate.setMonth(
    nextDate.getMonth() + 1
  );

  return nextDate;
}

function validateAddress(address) {
  if (!address) {
    return "Delivery address is required.";
  }

  if (
    cleanText(address.fullName).length < 2
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
    cleanPincode(address.pincode).length !==
    6
  ) {
    return "A valid six-digit pincode is required.";
  }

  if (
    cleanText(address.houseDetails).length <
    3
  ) {
    return "House, flat or building details are required.";
  }

  if (
    cleanText(address.areaDetails).length <
    3
  ) {
    return "Area and street details are required.";
  }

  return null;
}

/**
 * GET /api/subscriptions/plans
 * Returns active customer subscription plans.
 */
router.get(
  "/plans",
  async (req, res, next) => {
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

/**
 * POST /api/subscriptions
 * Creates a subscription for the logged-in user.
 */
router.post(
  "/",
  protect,
  async (req, res, next) => {
    try {
      const planId = cleanText(
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
        return res.status(400).json({
          success: false,
          message:
            "Please select a subscription plan.",
        });
      }

      const plan =
        await SubscriptionPlan.findOne({
          planId,
          active: true,
        }).lean();

      if (!plan) {
        return res.status(404).json({
          success: false,
          message:
            "This subscription plan is unavailable.",
        });
      }

      if (
        !Array.isArray(requestedItems) ||
        requestedItems.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Select bottles for your subscription.",
        });
      }

      if (
        !preferredDay ||
        !preferredSlot
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Select a preferred delivery day and slot.",
        });
      }

      if (
        ![
          "upi_autopay",
          "card_mandate",
        ].includes(paymentMethod)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Please choose a valid recurring payment method.",
        });
      }

      const addressError =
        validateAddress(
          deliveryAddress
        );

      if (addressError) {
        return res.status(400).json({
          success: false,
          message: addressError,
        });
      }

      const pincode = cleanPincode(
        deliveryAddress.pincode
      );

      const serviceableLocation =
        await ServiceableLocation.findOne({
          pincode,
          active: true,
        }).lean();

      if (!serviceableLocation) {
        return res.status(400).json({
          success: false,
          message:
            "Subscription delivery is not available for this pincode.",
        });
      }

      const quantitiesByProductId =
        new Map();

      for (const requestedItem of requestedItems) {
        const productId = cleanText(
          requestedItem.productId ||
            requestedItem.id
        ).toLowerCase();

        const quantity = Number(
          requestedItem.quantity
        );

        if (!productId) {
          return res.status(400).json({
            success: false,
            message:
              "A selected bottle is missing its product ID.",
          });
        }

        if (
          !Number.isInteger(quantity) ||
          quantity < 1 ||
          quantity > 100
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Each bottle quantity must be a valid whole number.",
          });
        }

        quantitiesByProductId.set(
          productId,
          (quantitiesByProductId.get(
            productId
          ) || 0) + quantity
        );
      }

      const selectedBottleCount = [
        ...quantitiesByProductId.values(),
      ].reduce(
        (sum, quantity) =>
          sum + quantity,
        0
      );

      if (
        selectedBottleCount !==
        plan.bottleCount
      ) {
        return res.status(400).json({
          success: false,
          message: `${plan.name} requires exactly ${plan.bottleCount} bottles.`,
        });
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

          subscriptionEligible: true,
        }).lean();

      if (
        products.length !==
        productIds.length
      ) {
        return res.status(400).json({
          success: false,
          message:
            "One or more selected bottles are unavailable for subscriptions.",
        });
      }

      const subscriptionItems =
        products.map((product) => {
          const quantity =
            quantitiesByProductId.get(
              product.productId
            );

          const lineTotal =
            product.price * quantity;

          return {
            product: product._id,
            productId:
              product.productId,
            name: product.name,
            shortName:
              product.shortName,
            sizeMl: product.sizeMl,
            price: product.price,
            quantity,
            lineTotal,
          };
        });

      const originalTotal =
        subscriptionItems.reduce(
          (sum, item) =>
            sum + item.lineTotal,
          0
        );

      const savings = Math.round(
        originalTotal *
          (plan.discountPercent / 100)
      );

      const totalPerCycle =
        originalTotal - savings;

      if (
        totalPerCycle <
        serviceableLocation.minimumOrder
      ) {
        return res.status(400).json({
          success: false,
          message: `The subscription total must be at least ₹${serviceableLocation.minimumOrder} for ${serviceableLocation.area}.`,
        });
      }

      const subscriptionNumber =
        await createUniqueSubscriptionNumber();

      const subscription =
        await Subscription.create({
          subscriptionNumber,

          user: req.user._id,

          plan: plan._id,
          planId: plan.planId,
          planName: plan.name,

          billingCycle:
            plan.billingCycle,

          bottleCount:
            plan.bottleCount,

          deliveriesPerCycle:
            plan.deliveriesPerCycle,

          items: subscriptionItems,

          preferredDay,
          preferredSlot,

          deliveryAddress: {
            fullName: cleanText(
              deliveryAddress.fullName
            ),

            phone: cleanPhone(
              deliveryAddress.phone
            ),

            pincode,

            houseDetails: cleanText(
              deliveryAddress.houseDetails
            ),

            areaDetails: cleanText(
              deliveryAddress.areaDetails
            ),

            landmark: cleanText(
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
          totalPerCycle,

          paymentMethod,

          paymentStatus:
            "demo_confirmed",

          paymentReference:
            `DEMO-MANDATE-${Date.now()}`,

          status: "active",

          nextBillingAt:
            calculateNextBillingDate(
              plan.billingCycle
            ),
        });

      return res.status(201).json({
        success: true,

        message:
          "Your subscription was activated successfully.",

        data: {
          subscription,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * GET /api/subscriptions/my
 * Returns subscriptions owned by the user.
 */
router.get(
  "/my",
  protect,
  async (req, res, next) => {
    try {
      const subscriptions =
        await Subscription.find({
          user: req.user._id,
        })
          .sort({
            createdAt: -1,
          })
          .lean();

      return res.status(200).json({
        success: true,
        count: subscriptions.length,

        data: {
          subscriptions,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * GET /api/subscriptions/:subscriptionId
 */
router.get(
  "/:subscriptionId",
  protect,
  async (req, res, next) => {
    try {
      const query = {
        _id: req.params.subscriptionId,
      };

      if (req.user.role !== "admin") {
        query.user = req.user._id;
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
        error.name === "CastError"
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

/**
 * PATCH /api/subscriptions/:subscriptionId/cancel
 */
router.patch(
  "/:subscriptionId/cancel",
  protect,
  async (req, res, next) => {
    try {
      const subscription =
        await Subscription.findOne({
          _id:
            req.params.subscriptionId,

          user: req.user._id,
        });

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
        error.name === "CastError"
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