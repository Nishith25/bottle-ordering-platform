const crypto = require("crypto");
const express = require("express");
const mongoose = require("mongoose");

const { protect } = require("../middleware/auth");
const Product = require("../models/Product");
const ServiceableLocation = require("../models/ServiceableLocation");
const Subscription = require("../models/Subscription");
const SubscriptionPlan = require("../models/SubscriptionPlan");

const {
  getCouponQuote,
  normalizeCouponCode,
  redeemCouponForRecord,
} = require("../services/couponService");

const router = express.Router();

function cleanText(value) {
  return String(value || "").trim();
}

function cleanPhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function cleanPincode(value) {
  return String(value || "").replace(/\D/g, "");
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
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

async function createUniqueSubscriptionNumber(session) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const subscriptionNumber = generateSubscriptionNumber();

    const exists = await Subscription.exists({
      subscriptionNumber,
    }).session(session);

    if (!exists) {
      return subscriptionNumber;
    }
  }

  throw new Error("Unable to generate a subscription number.");
}

function calculateNextBillingDate(billingCycle) {
  const nextDate = new Date();

  if (billingCycle === "weekly") {
    nextDate.setDate(nextDate.getDate() + 7);
    return nextDate;
  }

  nextDate.setMonth(nextDate.getMonth() + 1);
  return nextDate;
}

function validateAddress(address) {
  if (!address) return "Delivery address is required.";
  if (cleanText(address.fullName).length < 2) {
    return "A valid customer name is required.";
  }
  if (!/^[6-9]\d{9}$/.test(cleanPhone(address.phone))) {
    return "A valid 10-digit Indian mobile number is required.";
  }
  if (cleanPincode(address.pincode).length !== 6) {
    return "A valid six-digit pincode is required.";
  }
  if (cleanText(address.houseDetails).length < 3) {
    return "House, flat or building details are required.";
  }
  if (cleanText(address.areaDetails).length < 3) {
    return "Area and street details are required.";
  }
  return null;
}

router.get("/plans", async (req, res, next) => {
  try {
    const plans = await SubscriptionPlan.find({ active: true })
      .sort({ sortOrder: 1, createdAt: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: plans.length,
      data: { plans },
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/", protect, async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    let createdSubscription = null;

    await session.withTransaction(async () => {
      const planId = cleanText(req.body.planId).toLowerCase();
      const requestedItems = req.body.items;
      const preferredDay = cleanText(req.body.preferredDay);
      const preferredSlot = cleanText(req.body.preferredSlot);
      const deliveryAddress = req.body.deliveryAddress;
      const paymentMethod = cleanText(req.body.paymentMethod).toLowerCase();

      if (!planId) {
        const error = new Error("Please select a subscription plan.");
        error.statusCode = 400;
        throw error;
      }

      const plan = await SubscriptionPlan.findOne({
        planId,
        active: true,
      })
        .session(session)
        .lean();

      if (!plan) {
        const error = new Error("This subscription plan is unavailable.");
        error.statusCode = 404;
        throw error;
      }

      if (!Array.isArray(requestedItems) || requestedItems.length === 0) {
        const error = new Error("Select bottles for your subscription.");
        error.statusCode = 400;
        throw error;
      }

      if (!preferredDay || !preferredSlot) {
        const error = new Error(
          "Select a preferred delivery day and slot."
        );
        error.statusCode = 400;
        throw error;
      }

      if (!["upi_autopay", "card_mandate"].includes(paymentMethod)) {
        const error = new Error(
          "Please choose a valid recurring payment method."
        );
        error.statusCode = 400;
        throw error;
      }

      const addressError = validateAddress(deliveryAddress);

      if (addressError) {
        const error = new Error(addressError);
        error.statusCode = 400;
        throw error;
      }

      const pincode = cleanPincode(deliveryAddress.pincode);

      const serviceableLocation = await ServiceableLocation.findOne({
        pincode,
        active: true,
      })
        .session(session)
        .lean();

      if (!serviceableLocation) {
        const error = new Error(
          "Subscription delivery is not available for this pincode."
        );
        error.statusCode = 400;
        throw error;
      }

      const quantitiesByProductId = new Map();

      for (const requestedItem of requestedItems) {
        const productId = cleanText(
          requestedItem.productId || requestedItem.id
        ).toLowerCase();
        const quantity = Number(requestedItem.quantity);

        if (!productId) {
          const error = new Error(
            "A selected bottle is missing its product ID."
          );
          error.statusCode = 400;
          throw error;
        }

        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
          const error = new Error(
            "Each bottle quantity must be a valid whole number."
          );
          error.statusCode = 400;
          throw error;
        }

        quantitiesByProductId.set(
          productId,
          (quantitiesByProductId.get(productId) || 0) + quantity
        );
      }

      const selectedBottleCount = [...quantitiesByProductId.values()].reduce(
        (sum, quantity) => sum + quantity,
        0
      );

      if (selectedBottleCount !== plan.bottleCount) {
        const error = new Error(
          `${plan.name} requires exactly ${plan.bottleCount} bottles.`
        );
        error.statusCode = 400;
        throw error;
      }

      const productIds = [...quantitiesByProductId.keys()];

      const products = await Product.find({
        productId: { $in: productIds },
        available: true,
        subscriptionEligible: true,
      })
        .session(session)
        .lean();

      if (products.length !== productIds.length) {
        const error = new Error(
          "One or more selected bottles are unavailable for subscriptions."
        );
        error.statusCode = 400;
        throw error;
      }

      const productsById = new Map(
        products.map((product) => [product.productId, product])
      );

      const subscriptionItems = productIds.map((productId) => {
        const product = productsById.get(productId);
        const quantity = quantitiesByProductId.get(product.productId);

        return {
          product: product._id,
          productId: product.productId,
          name: product.name,
          shortName: product.shortName,
          sizeMl: product.sizeMl,
          price: product.price,
          quantity,
          lineTotal: roundMoney(product.price * quantity),
        };
      });

      const originalTotal = roundMoney(
        subscriptionItems.reduce((sum, item) => sum + item.lineTotal, 0)
      );

      const savings = roundMoney(
        originalTotal * (plan.discountPercent / 100)
      );

      const amountBeforeCoupon = roundMoney(originalTotal - savings);

      if (amountBeforeCoupon < serviceableLocation.minimumOrder) {
        const error = new Error(
          `The subscription total must be at least ₹${serviceableLocation.minimumOrder} for ${serviceableLocation.area}.`
        );
        error.statusCode = 400;
        throw error;
      }

      const couponCode = normalizeCouponCode(req.body.couponCode);
      let coupon = null;
      let couponDiscount = 0;

      if (couponCode) {
        const quote = await getCouponQuote({
          code: couponCode,
          context: "subscription",
          eligibleAmount: amountBeforeCoupon,
          userId: req.user._id,
          session,
          includeUsageValidation: true,
        });

        coupon = quote.snapshot;
        couponDiscount = quote.snapshot.discountAmount;
      }

      const totalPerCycle = roundMoney(
        Math.max(0, amountBeforeCoupon - couponDiscount)
      );

      const subscriptionNumber = await createUniqueSubscriptionNumber(
        session
      );

      const subscriptions = await Subscription.create(
        [
          {
            subscriptionNumber,
            user: req.user._id,
            plan: plan._id,
            planId: plan.planId,
            planName: plan.name,
            billingCycle: plan.billingCycle,
            bottleCount: plan.bottleCount,
            deliveriesPerCycle: plan.deliveriesPerCycle,
            items: subscriptionItems,
            preferredDay,
            preferredSlot,
            deliveryAddress: {
              fullName: cleanText(deliveryAddress.fullName),
              phone: cleanPhone(deliveryAddress.phone),
              pincode,
              houseDetails: cleanText(deliveryAddress.houseDetails),
              areaDetails: cleanText(deliveryAddress.areaDetails),
              landmark: cleanText(deliveryAddress.landmark),
              area: serviceableLocation.area,
              city: serviceableLocation.city,
            },
            originalTotal,
            discountPercent: plan.discountPercent,
            savings,
            amountBeforeCoupon,
            couponDiscount,
            coupon,
            totalPerCycle,
            recurringTotalPerCycle: amountBeforeCoupon,
            paymentMethod,
            paymentStatus: "demo_confirmed",
            paymentReference: `DEMO-MANDATE-${Date.now()}`,
            status: "active",
            nextBillingAt: calculateNextBillingDate(plan.billingCycle),
          },
        ],
        { session }
      );

      createdSubscription = subscriptions[0];

      if (coupon?.couponId) {
        const usage = await redeemCouponForRecord({
          couponSnapshot: coupon,
          userId: req.user._id,
          context: "subscription",
          recordId: createdSubscription._id,
          session,
        });

        createdSubscription.couponUsage = usage?._id || null;
        await createdSubscription.save({ session });
      }
    });

    return res.status(201).json({
      success: true,
      message: "Your subscription was activated successfully.",
      data: {
        subscription: createdSubscription,
      },
    });
  } catch (error) {
    return next(error);
  } finally {
    await session.endSession();
  }
});

router.get("/my", protect, async (req, res, next) => {
  try {
    const subscriptions = await Subscription.find({
      user: req.user._id,
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: subscriptions.length,
      data: { subscriptions },
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/:subscriptionId", protect, async (req, res, next) => {
  try {
    const query = { _id: req.params.subscriptionId };

    if (req.user.role !== "admin") {
      query.user = req.user._id;
    }

    const subscription = await Subscription.findOne(query).lean();

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: { subscription },
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(404).json({
        success: false,
        message: "Subscription not found.",
      });
    }
    return next(error);
  }
});

router.patch("/:subscriptionId/cancel", protect, async (req, res, next) => {
  try {
    const subscription = await Subscription.findOne({
      _id: req.params.subscriptionId,
      user: req.user._id,
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found.",
      });
    }

    if (subscription.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "This subscription is already cancelled.",
      });
    }

    if (subscription.status === "expired") {
      return res.status(400).json({
        success: false,
        message: "An expired subscription cannot be cancelled.",
      });
    }

    subscription.status = "cancelled";
    subscription.paymentStatus = "cancelled";
    subscription.cancelledAt = new Date();
    subscription.cancellationReason =
      cleanText(req.body.reason) || "Cancelled by customer";

    await subscription.save();

    return res.status(200).json({
      success: true,
      message: "Your subscription was cancelled.",
      data: { subscription },
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(404).json({
        success: false,
        message: "Subscription not found.",
      });
    }
    return next(error);
  }
});

module.exports = router;
