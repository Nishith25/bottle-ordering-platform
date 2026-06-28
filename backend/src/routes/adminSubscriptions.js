// backend/src/routes/adminSubscriptions.js

const express = require("express");

const {
  protect,
  allowRoles,
} = require("../middleware/auth");

const Subscription = require(
  "../models/Subscription"
);

const User = require("../models/User");

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
  return String(value ?? "").trim();
}

function escapeRegex(value) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

/**
 * GET /api/admin/subscriptions
 *
 * Query parameters:
 * status=active
 * search=subscription number, plan, customer,
 * email, phone or delivery address
 */
router.get(
  "/",
  async (req, res, next) => {
    try {
      const status = cleanText(
        req.query.status
      ).toLowerCase();

      const search = cleanText(
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
                email: searchRegex,
              },
              {
                phone: searchRegex,
              },
            ],
          })
            .select("_id")
            .lean();

        const matchingUserIds =
          matchingUsers.map(
            (user) => user._id
          );

        filter.$or = [
          {
            subscriptionNumber:
              searchRegex,
          },
          {
            planId: searchRegex,
          },
          {
            planName: searchRegex,
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
              $in: matchingUserIds,
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
          .sort({
            createdAt: -1,
          })
          .limit(250)
          .lean(),

        Subscription.aggregate([
          {
            $group: {
              _id: "$status",
              count: {
                $sum: 1,
              },
            },
          },
        ]),
      ]);

      const statusCounts =
        SUBSCRIPTION_STATUSES.reduce(
          (result, subscriptionStatus) => {
            result[subscriptionStatus] = 0;
            return result;
          },
          {}
        );

      for (const item of statusBreakdown) {
        if (
          SUBSCRIPTION_STATUSES.includes(
            item._id
          )
        ) {
          statusCounts[item._id] =
            item.count;
        }
      }

      return res.status(200).json({
        success: true,
        count: subscriptions.length,

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
      const nextStatus = cleanText(
        req.body.status
      ).toLowerCase();

      const reason = cleanText(
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

          message: `Subscription cannot move from ${subscription.status} to ${nextStatus}.`,
        });
      }

      subscription.status =
        nextStatus;

      if (nextStatus === "cancelled") {
        subscription.paymentStatus =
          "cancelled";

        subscription.cancelledAt =
          new Date();

        subscription.cancellationReason =
          reason ||
          "Cancelled by administrator";
      }

      if (nextStatus === "paused") {
        subscription.cancellationReason =
          "";

        subscription.cancelledAt =
          null;
      }

      if (nextStatus === "active") {
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

      if (nextStatus === "expired") {
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