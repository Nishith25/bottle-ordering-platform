const express = require("express");

const {
  protect,
  allowRoles,
} = require("../middleware/auth");

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
router.use(allowRoles("admin"));

const PROCESSING_STATUSES = [
  "received",
  "processing",
  "fulfilled",
  "fulfillment_failed",
  "ignored",
];

function parsePositiveInteger(
  value,
  fallback,
  maximum
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

function escapeRegExp(value) {
  return String(value).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

function parseDateStart(value) {
  if (!value) {
    return null;
  }

  const date = new Date(
    `${value}T00:00:00.000Z`
  );

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

function parseDateEnd(value) {
  if (!value) {
    return null;
  }

  const date = new Date(
    `${value}T23:59:59.999Z`
  );

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

function buildChargeFilter(query) {
  const filter = {};

  if (query.subscriptionId) {
    filter.localSubscription =
      query.subscriptionId;
  }

  if (
    query.processingStatus &&
    PROCESSING_STATUSES.includes(
      query.processingStatus
    )
  ) {
    filter.processingStatus =
      query.processingStatus;
  }

  if (
    query.paymentStatus &&
    query.paymentStatus !== "all"
  ) {
    filter.paymentStatus =
      String(
        query.paymentStatus
      ).trim();
  }

  const dateFrom =
    parseDateStart(
      query.dateFrom
    );

  const dateTo =
    parseDateEnd(
      query.dateTo
    );

  if (dateFrom || dateTo) {
    filter.createdAt = {};

    if (dateFrom) {
      filter.createdAt.$gte =
        dateFrom;
    }

    if (dateTo) {
      filter.createdAt.$lte =
        dateTo;
    }
  }

  const search =
    String(
      query.search || ""
    ).trim();

  if (search) {
    const searchExpression =
      new RegExp(
        escapeRegExp(search),
        "i"
      );

    filter.$or = [
      {
        subscriptionNumber:
          searchExpression,
      },
      {
        planName:
          searchExpression,
      },
      {
        razorpayPaymentId:
          searchExpression,
      },
      {
        razorpaySubscriptionId:
          searchExpression,
      },
      {
        razorpayInvoiceId:
          searchExpression,
      },
      {
        orderNumber:
          searchExpression,
      },
      {
        failureReason:
          searchExpression,
      },
    ];
  }

  return filter;
}

/**
 * GET /api/admin/subscription-charges
 *
 * Query:
 * - subscriptionId
 * - processingStatus
 * - paymentStatus
 * - search
 * - dateFrom
 * - dateTo
 * - page
 * - limit
 */
router.get(
  "/",
  async (req, res, next) => {
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

      const filter =
        buildChargeFilter(
          req.query
        );

      const [
        charges,
        total,
        summaryResult,
      ] = await Promise.all([
        SubscriptionCharge.find(
          filter
        )
          .populate(
            "user",
            "fullName email phone role active"
          )
          .populate(
            "order",
            [
              "orderNumber",
              "orderStatus",
              "deliveryStatus",
              "paymentStatus",
              "total",
              "createdAt",
            ].join(" ")
          )
          .populate(
            "localSubscription",
            [
              "subscriptionNumber",
              "planName",
              "status",
              "billingCycle",
              "nextBillingAt",
            ].join(" ")
          )
          .sort({
            paymentCreatedAt: -1,
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

        SubscriptionCharge.aggregate([
          {
            $match: filter,
          },
          {
            $group: {
              _id: null,

              totalCharges: {
                $sum: 1,
              },

              fulfilled: {
                $sum: {
                  $cond: [
                    {
                      $eq: [
                        "$processingStatus",
                        "fulfilled",
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },

              fulfillmentFailed: {
                $sum: {
                  $cond: [
                    {
                      $eq: [
                        "$processingStatus",
                        "fulfillment_failed",
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },

              ignored: {
                $sum: {
                  $cond: [
                    {
                      $eq: [
                        "$processingStatus",
                        "ignored",
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },

              processing: {
                $sum: {
                  $cond: [
                    {
                      $in: [
                        "$processingStatus",
                        [
                          "received",
                          "processing",
                        ],
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },

              collectedAmountPaise: {
                $sum: {
                  $cond: [
                    {
                      $eq: [
                        "$captured",
                        true,
                      ],
                    },
                    "$amountPaise",
                    0,
                  ],
                },
              },
            },
          },
        ]),
      ]);

      const totalPages =
        Math.max(
          1,
          Math.ceil(
            total / limit
          )
        );

      const summary =
        summaryResult[0] || {
          totalCharges: 0,
          fulfilled: 0,
          fulfillmentFailed: 0,
          ignored: 0,
          processing: 0,
          collectedAmountPaise: 0,
        };

      return res
        .status(200)
        .json({
          success: true,

          data: {
            charges,

            summary: {
              totalCharges:
                Number(
                  summary.totalCharges ||
                    0
                ),

              fulfilled:
                Number(
                  summary.fulfilled ||
                    0
                ),

              fulfillmentFailed:
                Number(
                  summary.fulfillmentFailed ||
                    0
                ),

              ignored:
                Number(
                  summary.ignored ||
                    0
                ),

              processing:
                Number(
                  summary.processing ||
                    0
                ),

              collectedAmountPaise:
                Number(
                  summary.collectedAmountPaise ||
                    0
                ),
            },

            pagination: {
              page,
              limit,
              total,
              totalPages,

              hasNextPage:
                page < totalPages,

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

/**
 * POST
 * /api/admin/subscription-charges/:chargeId/retry
 */
router.post(
  "/:chargeId/retry",
  async (req, res, next) => {
    try {
      const result =
        await retrySubscriptionChargeProcessing(
          {
            chargeId:
              req.params.chargeId,
          }
        );

      let message =
        result.reason ||
        "The recurring charge was processed.";

      if (
        result.status ===
        "fulfilled"
      ) {
        message =
          `${result.orderNumber} was created successfully.`;
      }

      if (
        result.status ===
        "already_fulfilled"
      ) {
        message =
          "This recurring charge was already fulfilled.";
      }

      return res
        .status(200)
        .json({
          success: true,
          message,

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