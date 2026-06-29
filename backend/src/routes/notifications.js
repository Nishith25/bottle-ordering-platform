const express = require("express");

const {
  protect,
} = require("../middleware/auth");

const Notification = require(
  "../models/Notification"
);

const router =
  express.Router();

router.use(protect);

function getLimit(value) {
  const parsedValue =
    Number.parseInt(
      String(value || "50"),
      10
    );

  if (
    !Number.isFinite(
      parsedValue
    )
  ) {
    return 50;
  }

  return Math.min(
    Math.max(
      parsedValue,
      1
    ),
    100
  );
}

router.get(
  "/",
  async (req, res, next) => {
    try {
      const limit =
        getLimit(
          req.query.limit
        );

      const [
        notifications,
        unreadCount,
      ] = await Promise.all([
        Notification.find({
          user:
            req.user._id,
        })
          .sort({
            createdAt: -1,
          })
          .limit(limit)
          .lean(),

        Notification.countDocuments({
          user:
            req.user._id,

          readAt: null,
        }),
      ]);

      return res.status(200).json({
        success: true,
        count:
          notifications.length,

        data: {
          notifications,
          unreadCount,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.get(
  "/unread-count",
  async (req, res, next) => {
    try {
      const unreadCount =
        await Notification.countDocuments({
          user:
            req.user._id,

          readAt: null,
        });

      return res.status(200).json({
        success: true,

        data: {
          unreadCount,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.patch(
  "/read-all",
  async (req, res, next) => {
    try {
      const readAt =
        new Date();

      const result =
        await Notification.updateMany(
          {
            user:
              req.user._id,

            readAt: null,
          },
          {
            $set: {
              readAt,
            },
          }
        );

      return res.status(200).json({
        success: true,

        message:
          "All notifications marked as read.",

        data: {
          modifiedCount:
            result.modifiedCount ||
            0,

          readAt,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.patch(
  "/:notificationId/read",
  async (req, res, next) => {
    try {
      const notification =
        await Notification.findOneAndUpdate(
          {
            _id:
              req.params
                .notificationId,

            user:
              req.user._id,
          },
          {
            $set: {
              readAt:
                new Date(),
            },
          },
          {
            new: true,
            runValidators: true,
          }
        ).lean();

      if (!notification) {
        return res.status(404).json({
          success: false,

          message:
            "Notification not found.",
        });
      }

      return res.status(200).json({
        success: true,

        data: {
          notification,
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
            "Notification not found.",
        });
      }

      return next(error);
    }
  }
);

module.exports = router;