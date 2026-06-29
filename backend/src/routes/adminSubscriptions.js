const express = require("express");

const {
  protect,
  allowRoles,
} = require("../middleware/auth");

const Subscription = require(
  "../models/Subscription"
);

const User = require("../models/User");

const {
  generateDueSubscriptionDeliveries,
  generateSubscriptionDelivery,
  getDueSubscriptionDeliveriesPreview,
} = require(
  "../services/subscriptionDelivery"
);

const router = express.Router();

router.use(protect);
router.use(allowRoles("admin"));

const SUBSCRIPTION_STATUSES = [
  "active",
  "paused",
  "cancelled",
  "expired",
];

const ALLOWED_TRANSITIONS = {
  active: [
    "paused",
    "cancelled",
    "expired",
  ],

  paused: [
    "active",
    "cancelled",
    "expired",
  ],

  cancelled: [],
  expired: [],
};

function cleanText(value) {
  return String(
    value ?? ""
  ).trim();
}

function escapeRegex(value) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

function parseLimit(
  value,
  fallback = 50
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
    100
  );
}

/**
 * GET
 * /api/admin/subscriptions/due-deliveries
 */
router.get(
  "/due-deliveries",
  async (req, res, next) => {
    try {
      const preview =
        await getDueSubscriptionDeliveriesPreview({
          dueAt:
            new Date(),

          limit:
            parseLimit(
              req.query.limit,
              50
            ),
        });

      return res.status(200).json({
        success: true,
        count: preview.count,

        data: preview,
      });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * POST
 * /api/admin/subscriptions/generate-due-deliveries
 */
router.post(
  "/generate-due-deliveries",
  async (req, res, next) => {
    try {
      const result =
        await generateDueSubscriptionDeliveries({
          dueAt:
            new Date(),

          limit:
            parseLimit(
              req.body.limit,
              25
            ),
        });

      return res.status(200).json({
        success: true,

        message:
          result.createdCount > 0
            ? `${result.createdCount} recurring delivery order${
                result.createdCount ===
                1
                  ? ""
                  : "s"
              } generated successfully.`
            : "No due subscription deliveries required generation.",

        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * POST
 * /api/admin/subscriptions/:subscriptionId/generate-delivery
 *
 * force=true allows the administrator to
 * generate the upcoming cycle before its due date.
 */
router.post(
  "/:subscriptionId/generate-delivery",
  async (req, res, next) => {
    try {
      const force =
        req.body.force === true;

      const result =
        await generateSubscriptionDelivery({
          subscriptionId:
            req.params.subscriptionId,

          dueAt:
            new Date(),

          force,
        });

      if (
        result.status ===
        "failed"
      ) {
        return res.status(409).json({
          success: false,

          message:
            result.reason,

          data: {
            result,
          },
        });
      }

      return res
        .status(
          result.status ===
            "created"
            ? 201
            : 200
        )
        .json({
          success: true,

          message:
            result.status ===
            "created"
              ? "Recurring delivery order generated successfully."
              : result.reason,

          data: {
            result,
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

/**
 * GET /api/admin/subscriptions
 */
router.get(
  "/",
  async (req, res, next) => {
    try {
      const status =
        cleanText(
          req.query.status
        ).toLowerCase();

      const search =
        cleanText(
          req.query.search
        );

      const filter = {};

      if (
        status &&
        status !== "all"
      ) {
        if (
          !SUBSCRIPTION_STATUSES.includes(
            status
          )
        ) {
          return res.status(400).json({
            success: false,

            message:
              "Invalid subscription status filter.",
          });
        }

        filter.status = status;
      }

      if (search) {
        const searchRegex =
          new RegExp(
            escapeRegex(search),
            "i"
          );

        const matchingUsers =
          await User.find({
            $or: [
              {
                fullName:
                  searchRegex,
              },

              {
                email:
                  searchRegex,
              },

              {
                phone:
                  searchRegex,
              },
            ],
          })
            .select("_id")
            .lean();

        const matchingUserIds =
          matchingUsers.map(
            (user) =>
              user._id
          );

        filter.$or = [
          {
            subscriptionNumber:
              searchRegex,
          },

          {
            planId:
              searchRegex,
          },

          {
            planName:
              searchRegex,
          },

          {
            preferredDay:
              searchRegex,
          },

          {
            "deliveryAddress.fullName":
              searchRegex,
          },

          {
            "deliveryAddress.phone":
              searchRegex,
          },

          {
            "deliveryAddress.pincode":
              searchRegex,
          },

          {
            "deliveryAddress.area":
              searchRegex,
          },

          {
            "deliveryAddress.city":
              searchRegex,
          },

          {
            user: {
              $in:
                matchingUserIds,
            },
          },
        ];
      }

      const [
        subscriptions,
        statusBreakdown,
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
            createdAt: -1,
          })
          .limit(250)
          .lean(),

        Subscription.aggregate([
          {
            $group: {
              _id:
                "$status",

              count: {
                $sum: 1,
              },
            },
          },
        ]),
      ]);

      const statusCounts =
        SUBSCRIPTION_STATUSES.reduce(
          (
            result,
            subscriptionStatus
          ) => {
            result[
              subscriptionStatus
            ] = 0;

            return result;
          },
          {}
        );

      for (
        const item of
        statusBreakdown
      ) {
        if (
          SUBSCRIPTION_STATUSES.includes(
            item._id
          )
        ) {
          statusCounts[
            item._id
          ] =
            item.count;
        }
      }

      return res.status(200).json({
        success: true,
        count:
          subscriptions.length,

        data: {
          subscriptions,
          statusCounts,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * PATCH
 * /api/admin/subscriptions/:subscriptionId/status
 */
router.patch(
  "/:subscriptionId/status",
  async (req, res, next) => {
    try {
      const nextStatus =
        cleanText(
          req.body.status
        ).toLowerCase();

      const reason =
        cleanText(
          req.body.reason
        );

      if (
        !SUBSCRIPTION_STATUSES.includes(
          nextStatus
        )
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Please select a valid subscription status.",
        });
      }

      const subscription =
        await Subscription.findById(
          req.params.subscriptionId
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
        nextStatus
      ) {
        const unchangedSubscription =
          await Subscription.findById(
            subscription._id
          )
            .populate(
              "user",
              "fullName email phone role active"
            )
            .populate(
              "lastDeliveryOrder",
              "orderNumber orderStatus deliveryStatus createdAt"
            )
            .lean();

        return res.status(200).json({
          success: true,

          message:
            "Subscription status is already up to date.",

          data: {
            subscription:
              unchangedSubscription,
          },
        });
      }

      const allowedStatuses =
        ALLOWED_TRANSITIONS[
          subscription.status
        ] ?? [];

      if (
        !allowedStatuses.includes(
          nextStatus
        )
      ) {
        return res.status(400).json({
          success: false,

          message:
            `Subscription cannot move from ${subscription.status} to ${nextStatus}.`,
        });
      }

      subscription.status =
        nextStatus;

      if (
        nextStatus ===
        "cancelled"
      ) {
        subscription.paymentStatus =
          "cancelled";

        subscription.cancelledAt =
          new Date();

        subscription.cancellationReason =
          reason ||
          "Cancelled by administrator";
      }

      if (
        nextStatus ===
        "paused"
      ) {
        subscription.cancellationReason =
          "";

        subscription.cancelledAt =
          null;
      }

      if (
        nextStatus ===
        "active"
      ) {
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
      }

      if (
        nextStatus ===
        "expired"
      ) {
        subscription.cancellationReason =
          reason ||
          "Subscription expired";

        subscription.cancelledAt =
          null;
      }

      await subscription.save();

      const updatedSubscription =
        await Subscription.findById(
          subscription._id
        )
          .populate(
            "user",
            "fullName email phone role active"
          )
          .populate(
            "lastDeliveryOrder",
            "orderNumber orderStatus deliveryStatus createdAt"
          )
          .lean();

      return res.status(200).json({
        success: true,

        message:
          "Subscription status updated successfully.",

        data: {
          subscription:
            updatedSubscription,
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