const express = require("express");

const {
  protect,
  allowRoles,
} = require(
  "../middleware/auth"
);

const SubscriptionCharge = require(
  "../models/SubscriptionCharge"
);

const {
  retrySubscriptionChargeProcessing,
} = require(
  "../services/subscriptionChargeProcessor"
);

const router = express.Router();

router.use(protect);
router.use(
  allowRoles("admin")
);

function parsePositiveInteger(
  value,
  fallback,
  maximum
) {
  const parsed =
    Number.parseInt(
      String(value ?? ""),
      10
    );

  if (
    !Number.isFinite(
      parsed
    ) ||
    parsed < 1
  ) {
    return fallback;
  }

  return Math.min(
    parsed,
    maximum
  );
}

/*
 * GET
 * /api/admin/subscription-charges
 *
 * Query:
 * subscriptionId
 * processingStatus
 * page
 * limit
 */
router.get(
  "/",

  async (
    req,
    res,
    next
  ) => {
    try {
      const page =
        parsePositiveInteger(
          req.query.page,
          1,
          100000
        );

      const limit =
        parsePositiveInteger(
          req.query.limit,
          20,
          100
        );

      const filter = {};

      if (
        req.query
          .subscriptionId
      ) {
        filter.localSubscription =
          req.query.subscriptionId;
      }

      if (
        req.query
          .processingStatus
      ) {
        filter.processingStatus =
          req.query.processingStatus;
      }

      const [
        charges,
        total,
      ] = await Promise.all([
        SubscriptionCharge.find(
          filter
        )
          .populate(
            "order",
            "orderNumber orderStatus deliveryStatus paymentStatus total createdAt"
          )
          .populate(
            "localSubscription",
            "subscriptionNumber planName status nextBillingAt"
          )
          .sort({
            createdAt: -1,
          })
          .skip(
            (page - 1) *
              limit
          )
          .limit(limit)
          .lean(),

        SubscriptionCharge.countDocuments(
          filter
        ),
      ]);

      const totalPages =
        Math.max(
          1,
          Math.ceil(
            total / limit
          )
        );

      return res
        .status(200)
        .json({
          success: true,

          data: {
            charges,

            pagination: {
              page,

              limit,

              total,

              totalPages,

              hasNextPage:
                page <
                totalPages,

              hasPreviousPage:
                page > 1,
            },
          },
        });
    } catch (error) {
      return next(error);
    }
  }
);

/*
 * POST
 * /api/admin/subscription-charges/:chargeId/retry
 */
router.post(
  "/:chargeId/retry",

  async (
    req,
    res,
    next
  ) => {
    try {
      const result =
        await retrySubscriptionChargeProcessing(
          {
            chargeId:
              req.params
                .chargeId,
          }
        );

      return res
        .status(200)
        .json({
          success: true,

          message:
            result.status ===
            "fulfilled"
              ? `${result.orderNumber} was created successfully.`
              : result.status ===
                  "already_fulfilled"
                ? "This recurring charge was already fulfilled."
                : result.reason ||
                  "The recurring charge was processed.",

          data: {
            result,
          },
        });
    } catch (error) {
      if (
        error.name ===
        "CastError"
      ) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Subscription charge not found.",
          });
      }

      return next(error);
    }
  }
);

module.exports = router;