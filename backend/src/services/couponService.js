const Coupon = require("../models/Coupon");
const CouponUsage = require("../models/CouponUsage");

function createCouponError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeCouponCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function supportsContext(coupon, context) {
  return (
    coupon.appliesTo === "both" ||
    coupon.appliesTo === context
  );
}

function calculateCouponDiscount(coupon, eligibleAmount) {
  const amount = Math.max(0, Number(eligibleAmount) || 0);

  let discount = 0;

  if (coupon.discountType === "fixed") {
    discount = Number(coupon.discountValue) || 0;
  } else {
    discount =
      amount * ((Number(coupon.discountValue) || 0) / 100);
  }

  if (
    coupon.discountType === "percentage" &&
    Number(coupon.maxDiscountAmount) > 0
  ) {
    discount = Math.min(
      discount,
      Number(coupon.maxDiscountAmount)
    );
  }

  return roundMoney(Math.min(amount, Math.max(0, discount)));
}

function buildCouponSnapshot(coupon, eligibleAmount) {
  const discountAmount = calculateCouponDiscount(
    coupon,
    eligibleAmount
  );

  return {
    couponId: coupon._id,
    code: coupon.code,
    description: coupon.description || "",
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    maxDiscountAmount: coupon.maxDiscountAmount || 0,
    minimumOrder: coupon.minimumOrder || 0,
    appliesTo: coupon.appliesTo,
    eligibleAmount: roundMoney(eligibleAmount),
    discountAmount,
  };
}

async function countUserCouponUses({
  couponId,
  userId,
  session,
}) {
  if (!userId) {
    return 0;
  }

  const query = CouponUsage.countDocuments({
    coupon: couponId,
    user: userId,
    status: {
      $in: ["reserved", "redeemed"],
    },
  });

  if (session) {
    query.session(session);
  }

  return query;
}

async function getCouponQuote({
  code,
  context,
  eligibleAmount,
  userId = null,
  session = null,
  includeUsageValidation = true,
}) {
  const normalizedCode = normalizeCouponCode(code);

  if (!normalizedCode) {
    throw createCouponError("Enter a coupon code.");
  }

  if (!["order", "subscription"].includes(context)) {
    throw createCouponError("Invalid coupon context.");
  }

  const amount = roundMoney(eligibleAmount);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw createCouponError(
      "A valid order amount is required to apply this coupon."
    );
  }

  const query = Coupon.findOne({
    code: normalizedCode,
  });

  if (session) {
    query.session(session);
  }

  const coupon = await query;

  if (!coupon || !coupon.active) {
    throw createCouponError(
      "This coupon is invalid or inactive."
    );
  }

  const now = new Date();

  if (
    coupon.startsAt &&
    new Date(coupon.startsAt).getTime() > now.getTime()
  ) {
    throw createCouponError(
      "This coupon is not active yet."
    );
  }

  if (
    coupon.endsAt &&
    new Date(coupon.endsAt).getTime() < now.getTime()
  ) {
    throw createCouponError(
      "This coupon has expired."
    );
  }

  if (!supportsContext(coupon, context)) {
    throw createCouponError(
      context === "subscription"
        ? "This coupon cannot be used for subscriptions."
        : "This coupon cannot be used for bottle orders."
    );
  }

  if (amount < Number(coupon.minimumOrder || 0)) {
    throw createCouponError(
      `This coupon requires a minimum amount of ₹${coupon.minimumOrder}.`
    );
  }

  if (
    includeUsageValidation &&
    Number(coupon.usageLimit) > 0 &&
    Number(coupon.usedCount) + Number(coupon.reservedCount) >=
      Number(coupon.usageLimit)
  ) {
    throw createCouponError(
      "This coupon has reached its usage limit."
    );
  }

  if (
    includeUsageValidation &&
    userId &&
    Number(coupon.perUserLimit) > 0
  ) {
    const userUseCount = await countUserCouponUses({
      couponId: coupon._id,
      userId,
      session,
    });

    if (userUseCount >= Number(coupon.perUserLimit)) {
      throw createCouponError(
        "You have already used this coupon the maximum number of times."
      );
    }
  }

  const snapshot = buildCouponSnapshot(coupon, amount);

  if (snapshot.discountAmount <= 0) {
    throw createCouponError(
      "This coupon does not provide a discount for the current amount."
    );
  }

  return {
    coupon,
    snapshot,
  };
}

function buildUsageLimitFilter(coupon) {
  const filter = {
    _id: coupon._id,
    active: true,
  };

  if (Number(coupon.usageLimit) > 0) {
    filter.$expr = {
      $lt: [
        {
          $add: ["$usedCount", "$reservedCount"],
        },
        "$usageLimit",
      ],
    };
  }

  return filter;
}

async function reserveCouponForPaymentSession({
  couponSnapshot,
  userId,
  paymentSessionId,
  expiresAt,
  session,
}) {
  if (!couponSnapshot?.couponId) {
    return null;
  }

  const coupon = await Coupon.findById(
    couponSnapshot.couponId
  ).session(session);

  if (!coupon) {
    throw createCouponError(
      "The selected coupon is no longer available."
    );
  }

  if (Number(coupon.perUserLimit) > 0) {
    const userUseCount = await countUserCouponUses({
      couponId: coupon._id,
      userId,
      session,
    });

    if (userUseCount >= Number(coupon.perUserLimit)) {
      throw createCouponError(
        "You have already used this coupon the maximum number of times."
      );
    }
  }

  const updatedCoupon = await Coupon.findOneAndUpdate(
    buildUsageLimitFilter(coupon),
    {
      $inc: {
        reservedCount: 1,
      },
    },
    {
      new: true,
      session,
    }
  );

  if (!updatedCoupon) {
    throw createCouponError(
      "This coupon has reached its usage limit."
    );
  }

  const usages = await CouponUsage.create(
    [
      {
        coupon: coupon._id,
        user: userId,
        context: "order",
        status: "reserved",
        code: couponSnapshot.code,
        discountAmount: couponSnapshot.discountAmount,
        eligibleAmount: couponSnapshot.eligibleAmount,
        paymentSession: paymentSessionId,
        reservedAt: new Date(),
        expiresAt,
      },
    ],
    { session }
  );

  return usages[0];
}

async function redeemCouponForRecord({
  couponSnapshot,
  userId,
  context,
  recordId,
  session,
}) {
  if (!couponSnapshot?.couponId) {
    return null;
  }

  const coupon = await Coupon.findById(
    couponSnapshot.couponId
  ).session(session);

  if (!coupon) {
    throw createCouponError(
      "The selected coupon is no longer available."
    );
  }

  if (Number(coupon.perUserLimit) > 0) {
    const userUseCount = await countUserCouponUses({
      couponId: coupon._id,
      userId,
      session,
    });

    if (userUseCount >= Number(coupon.perUserLimit)) {
      throw createCouponError(
        "You have already used this coupon the maximum number of times."
      );
    }
  }

  const updatedCoupon = await Coupon.findOneAndUpdate(
    buildUsageLimitFilter(coupon),
    {
      $inc: {
        usedCount: 1,
      },
    },
    {
      new: true,
      session,
    }
  );

  if (!updatedCoupon) {
    throw createCouponError(
      "This coupon has reached its usage limit."
    );
  }

  const usagePayload = {
    coupon: coupon._id,
    user: userId,
    context,
    status: "redeemed",
    code: couponSnapshot.code,
    discountAmount: couponSnapshot.discountAmount,
    eligibleAmount: couponSnapshot.eligibleAmount,
    redeemedAt: new Date(),
  };

  if (context === "order") {
    usagePayload.order = recordId;
  } else {
    usagePayload.subscription = recordId;
  }

  const usages = await CouponUsage.create(
    [usagePayload],
    { session }
  );

  return usages[0];
}

async function redeemReservedCoupon({
  paymentSessionId,
  orderId,
  session,
}) {
  const usage = await CouponUsage.findOne({
    paymentSession: paymentSessionId,
  }).session(session);

  if (!usage) {
    return null;
  }

  if (usage.status === "redeemed") {
    if (!usage.order) {
      usage.order = orderId;
      await usage.save({ session });
    }

    return usage;
  }

  if (usage.status === "reserved") {
    await Coupon.updateOne(
      {
        _id: usage.coupon,
        reservedCount: {
          $gte: 1,
        },
      },
      {
        $inc: {
          reservedCount: -1,
          usedCount: 1,
        },
      },
      { session }
    );
  } else {
    // A payment may complete after the local session expired.
    // Honour the discount already charged and record the redemption.
    await Coupon.updateOne(
      {
        _id: usage.coupon,
      },
      {
        $inc: {
          usedCount: 1,
        },
      },
      { session }
    );
  }

  usage.status = "redeemed";
  usage.order = orderId;
  usage.redeemedAt = new Date();
  usage.releasedAt = null;

  await usage.save({ session });

  return usage;
}

async function releaseCouponReservation({
  paymentSessionId,
  session,
}) {
  const usage = await CouponUsage.findOne({
    paymentSession: paymentSessionId,
    status: "reserved",
  }).session(session);

  if (!usage) {
    return false;
  }

  await Coupon.updateOne(
    {
      _id: usage.coupon,
      reservedCount: {
        $gte: 1,
      },
    },
    {
      $inc: {
        reservedCount: -1,
      },
    },
    { session }
  );

  usage.status = "released";
  usage.releasedAt = new Date();

  await usage.save({ session });

  return true;
}

module.exports = {
  calculateCouponDiscount,
  createCouponError,
  getCouponQuote,
  normalizeCouponCode,
  redeemCouponForRecord,
  redeemReservedCoupon,
  releaseCouponReservation,
  reserveCouponForPaymentSession,
};
