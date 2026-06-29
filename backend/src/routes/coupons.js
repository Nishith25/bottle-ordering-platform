const express = require("express");

const {
  getCouponQuote,
  normalizeCouponCode,
} = require("../services/couponService");

const router = express.Router();

router.post("/validate", async (req, res, next) => {
  try {
    const context = String(req.body.context || "order")
      .trim()
      .toLowerCase();

    const eligibleAmount = Number(req.body.eligibleAmount);

    const { snapshot } = await getCouponQuote({
      code: normalizeCouponCode(req.body.code),
      context,
      eligibleAmount,
      includeUsageValidation: true,
    });

    return res.status(200).json({
      success: true,
      message: `Coupon ${snapshot.code} applied successfully.`,
      data: {
        coupon: {
          code: snapshot.code,
          description: snapshot.description,
          discountType: snapshot.discountType,
          discountValue: snapshot.discountValue,
          maxDiscountAmount: snapshot.maxDiscountAmount,
          minimumOrder: snapshot.minimumOrder,
          appliesTo: snapshot.appliesTo,
          eligibleAmount: snapshot.eligibleAmount,
          discountAmount: snapshot.discountAmount,
          finalEligibleAmount: Math.max(
            0,
            snapshot.eligibleAmount - snapshot.discountAmount
          ),
        },
      },
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
