const express = require("express");

const {
  protect,
  allowRoles,
} = require("../middleware/auth");

const Coupon = require("../models/Coupon");

const {
  normalizeCouponCode,
} = require("../services/couponService");

const router = express.Router();

router.use(protect);
router.use(allowRoles("admin"));

const DISCOUNT_TYPES = ["fixed", "percentage"];
const APPLIES_TO = ["order", "subscription", "both"];

function cleanText(value) {
  return String(value ?? "").trim();
}

function numberField(value, fieldName, minimum = 0) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < minimum) {
    const error = new Error(
      `${fieldName} must be at least ${minimum}.`
    );

    error.statusCode = 400;
    throw error;
  }

  return parsed;
}

function integerField(value, fieldName, minimum = 0) {
  const parsed = numberField(value, fieldName, minimum);

  if (!Number.isInteger(parsed)) {
    const error = new Error(`${fieldName} must be a whole number.`);
    error.statusCode = 400;
    throw error;
  }

  return parsed;
}

function parseOptionalDate(value, fieldName) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    const error = new Error(`${fieldName} is invalid.`);
    error.statusCode = 400;
    throw error;
  }

  return date;
}

function buildPayload(body, existingCoupon = null) {
  const code = normalizeCouponCode(
    body.code ?? existingCoupon?.code
  );

  const description = cleanText(
    body.description ?? existingCoupon?.description
  );

  const discountType = cleanText(
    body.discountType ?? existingCoupon?.discountType
  ).toLowerCase();

  const appliesTo = cleanText(
    body.appliesTo ?? existingCoupon?.appliesTo
  ).toLowerCase();

  if (code.length < 3 || code.length > 30) {
    const error = new Error(
      "Coupon code must contain between 3 and 30 characters."
    );
    error.statusCode = 400;
    throw error;
  }

  if (!/^[A-Z0-9_-]+$/.test(code)) {
    const error = new Error(
      "Coupon code can contain only letters, numbers, hyphens and underscores."
    );
    error.statusCode = 400;
    throw error;
  }

  if (!DISCOUNT_TYPES.includes(discountType)) {
    const error = new Error("Select a valid discount type.");
    error.statusCode = 400;
    throw error;
  }

  if (!APPLIES_TO.includes(appliesTo)) {
    const error = new Error("Select where this coupon can be used.");
    error.statusCode = 400;
    throw error;
  }

  const discountValue = numberField(
    body.discountValue ?? existingCoupon?.discountValue,
    "Discount value",
    1
  );

  if (discountType === "percentage" && discountValue > 100) {
    const error = new Error(
      "Percentage discount cannot be greater than 100%."
    );
    error.statusCode = 400;
    throw error;
  }

  const maxDiscountAmount = numberField(
    body.maxDiscountAmount ??
      existingCoupon?.maxDiscountAmount ??
      0,
    "Maximum discount",
    0
  );

  const minimumOrder = numberField(
    body.minimumOrder ?? existingCoupon?.minimumOrder ?? 0,
    "Minimum order",
    0
  );

  const usageLimit = integerField(
    body.usageLimit ?? existingCoupon?.usageLimit ?? 0,
    "Usage limit",
    0
  );

  const perUserLimit = integerField(
    body.perUserLimit ?? existingCoupon?.perUserLimit ?? 1,
    "Per-customer limit",
    0
  );

  const startsAt = parseOptionalDate(
    body.startsAt ?? existingCoupon?.startsAt ?? new Date(),
    "Start date"
  );

  const endsAt = parseOptionalDate(
    body.endsAt ?? existingCoupon?.endsAt ?? null,
    "Expiry date"
  );

  if (startsAt && endsAt && endsAt <= startsAt) {
    const error = new Error(
      "Expiry date must be later than the start date."
    );
    error.statusCode = 400;
    throw error;
  }

  const active =
    body.active === undefined
      ? existingCoupon?.active ?? true
      : Boolean(body.active);

  const sortOrder = integerField(
    body.sortOrder ?? existingCoupon?.sortOrder ?? 0,
    "Sort order",
    0
  );

  if (
    existingCoupon &&
    usageLimit > 0 &&
    usageLimit <
      Number(existingCoupon.usedCount) +
        Number(existingCoupon.reservedCount)
  ) {
    const error = new Error(
      "Usage limit cannot be lower than the already used and reserved count."
    );
    error.statusCode = 400;
    throw error;
  }

  return {
    code,
    description,
    discountType,
    discountValue,
    maxDiscountAmount:
      discountType === "percentage" ? maxDiscountAmount : 0,
    minimumOrder,
    appliesTo,
    usageLimit,
    perUserLimit,
    startsAt: startsAt || new Date(),
    endsAt,
    active,
    sortOrder,
  };
}

router.get("/", async (req, res, next) => {
  try {
    const coupons = await Coupon.find({})
      .sort({
        active: -1,
        sortOrder: 1,
        createdAt: -1,
      })
      .lean();

    return res.status(200).json({
      success: true,
      count: coupons.length,
      data: {
        coupons,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const payload = buildPayload(req.body);
    const coupon = await Coupon.create(payload);

    return res.status(201).json({
      success: true,
      message: "Coupon created successfully.",
      data: {
        coupon,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.patch("/:couponId", async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.couponId);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found.",
      });
    }

    const payload = buildPayload(req.body, coupon);
    Object.assign(coupon, payload);
    await coupon.save();

    return res.status(200).json({
      success: true,
      message: "Coupon updated successfully.",
      data: {
        coupon,
      },
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(404).json({
        success: false,
        message: "Coupon not found.",
      });
    }

    return next(error);
  }
});

router.delete("/:couponId", async (req, res, next) => {
  try {
    const coupon = await Coupon.findByIdAndUpdate(
      req.params.couponId,
      {
        $set: {
          active: false,
        },
      },
      {
        new: true,
      }
    );

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Coupon deactivated successfully.",
      data: {
        coupon,
      },
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(404).json({
        success: false,
        message: "Coupon not found.",
      });
    }

    return next(error);
  }
});

module.exports = router;
