// backend/src/routes/adminNotifications.js

const express = require("express");

const {
  protect,
  allowRoles,
} = require("../middleware/auth");

const AdminNotification = require("../models/AdminNotification");

const {
  generateAdminNotifications,
} = require("../services/adminNotificationService");

const {
  logAdminActivity,
} = require("../services/adminActivityLogger");

const router = express.Router();

router.use(protect);
router.use(allowRoles("admin"));

const NOTIFICATION_TYPES = [
  "stock",
  "follow_up",
  "refund",
  "cod_payment",
  "order",
  "payment",
  "system",
];

function cleanText(value) {
  return String(value ?? "").trim();
}

function escapeRegex(value) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

function buildAdminSnapshot(user) {
  return {
    fullName:
      cleanText(user?.fullName) ||
      "Admin",

    email:
      cleanText(user?.email).toLowerCase(),

    role:
      cleanText(user?.role) ||
      "admin",
  };
}

function serializeNotification(notification) {
  return {
    _id: notification._id,
    type: notification.type,
    severity: notification.severity,
    title: notification.title,
    message: notification.message,
    actionUrl: notification.actionUrl || "",
    sourceType: notification.sourceType || "",
    sourceId: notification.sourceId || null,
    sourceLabel: notification.sourceLabel || "",
    automationKey: notification.automationKey || "",
    metadata: notification.metadata || {},
    readAt: notification.readAt || null,
    readBy: notification.readBy || null,
    readBySnapshot: notification.readBySnapshot || null,
    active: notification.active,
    createdAt: notification.createdAt,
    updatedAt: notification.updatedAt,
  };
}

async function buildSummary() {
  const [
    total,
    unread,
    danger,
    warning,
    stock,
    followUp,
    refund,
    codPayment,
    order,
    payment,
  ] = await Promise.all([
    AdminNotification.countDocuments({
      active: true,
    }),

    AdminNotification.countDocuments({
      active: true,
      readAt: null,
    }),

    AdminNotification.countDocuments({
      active: true,
      readAt: null,
      severity: "danger",
    }),

    AdminNotification.countDocuments({
      active: true,
      readAt: null,
      severity: "warning",
    }),

    AdminNotification.countDocuments({
      active: true,
      type: "stock",
      readAt: null,
    }),

    AdminNotification.countDocuments({
      active: true,
      type: "follow_up",
      readAt: null,
    }),

    AdminNotification.countDocuments({
      active: true,
      type: "refund",
      readAt: null,
    }),

    AdminNotification.countDocuments({
      active: true,
      type: "cod_payment",
      readAt: null,
    }),

    AdminNotification.countDocuments({
      active: true,
      type: "order",
      readAt: null,
    }),

    AdminNotification.countDocuments({
      active: true,
      type: "payment",
      readAt: null,
    }),
  ]);

  return {
    total,
    unread,
    danger,
    warning,
    stock,
    followUp,
    refund,
    codPayment,
    order,
    payment,
  };
}

router.get(
  "/",
  async (req, res, next) => {
    try {
      const type =
        cleanText(req.query.type).toLowerCase();

      const unreadOnly =
        cleanText(req.query.unreadOnly).toLowerCase() ===
        "true";

      const search =
        cleanText(req.query.search);

      const limit = Math.min(
        Math.max(
          Number(req.query.limit || 200),
          1
        ),
        500
      );

      const filter = {
        active: true,
      };

      if (
        type &&
        type !== "all"
      ) {
        if (
          !NOTIFICATION_TYPES.includes(type)
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid notification type filter.",
          });
        }

        filter.type = type;
      }

      if (unreadOnly) {
        filter.readAt = null;
      }

      if (search) {
        const regex =
          new RegExp(
            escapeRegex(search),
            "i"
          );

        filter.$or = [
          {
            title: regex,
          },
          {
            message: regex,
          },
          {
            sourceLabel: regex,
          },
          {
            type: regex,
          },
        ];
      }

      const [
        notifications,
        summary,
      ] = await Promise.all([
        AdminNotification.find(filter)
          .sort({
            readAt: 1,
            severity: 1,
            createdAt: -1,
          })
          .limit(limit)
          .lean(),

        buildSummary(),
      ]);

      return res.status(200).json({
        success: true,
        count:
          notifications.length,
        data: {
          notifications:
            notifications.map(
              serializeNotification
            ),
          summary,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  "/generate",
  async (req, res, next) => {
    try {
      const result =
        await generateAdminNotifications();

      await logAdminActivity({
        req,
        actionType:
          "admin_notifications_generated",

        actionLabel:
          "Admin notifications generated",

        severity:
          result.totalCreated > 0
            ? "success"
            : "info",

        message:
          `${result.totalCreated || 0} new admin notification${
            result.totalCreated === 1 ? "" : "s"
          } generated.`,

        entityType:
          "system",

        entityId:
          null,

        entityLabel:
          "Admin Notification Center",

        metadata: {
          totalCreated:
            result.totalCreated || 0,
          results:
            result.results || {},
          errors:
            result.errors || {},
          startedAt:
            result.startedAt,
          finishedAt:
            result.finishedAt,
        },
      });

      return res.status(200).json({
        success: true,
        message:
          "Admin notifications generated successfully.",
        data: {
          result,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.patch(
  "/mark-all-read",
  async (req, res, next) => {
    try {
      const now = new Date();

      const result =
        await AdminNotification.updateMany(
          {
            active: true,
            readAt: null,
          },
          {
            $set: {
              readAt: now,
              readBy:
                req.user?._id || null,
              readBySnapshot:
                buildAdminSnapshot(req.user),
            },
          }
        );

      const modifiedCount =
        result.modifiedCount || 0;

      await logAdminActivity({
        req,
        actionType:
          "notifications_marked_all_read",

        actionLabel:
          "All notifications marked read",

        severity:
          modifiedCount > 0
            ? "success"
            : "info",

        message:
          `${modifiedCount} admin notification${
            modifiedCount === 1 ? "" : "s"
          } marked as read.`,

        entityType:
          "notification",

        entityId:
          null,

        entityLabel:
          "All notifications",

        metadata: {
          modifiedCount,
          readAt: now,
        },
      });

      return res.status(200).json({
        success: true,
        message:
          "All notifications marked as read.",
        data: {
          modifiedCount,
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
        await AdminNotification.findOne({
          _id: req.params.notificationId,
          active: true,
        });

      if (!notification) {
        return res.status(404).json({
          success: false,
          message:
            "Notification not found.",
        });
      }

      const wasAlreadyRead =
        Boolean(notification.readAt);

      notification.readAt =
        notification.readAt || new Date();

      notification.readBy =
        notification.readBy ||
        req.user?._id ||
        null;

      notification.readBySnapshot =
        notification.readBySnapshot?.fullName
          ? notification.readBySnapshot
          : buildAdminSnapshot(req.user);

      await notification.save();

      await logAdminActivity({
        req,
        actionType:
          "notification_read",

        actionLabel:
          wasAlreadyRead
            ? "Notification read opened again"
            : "Notification marked read",

        severity:
          "info",

        message:
          notification.title,

        entityType:
          "notification",

        entityId:
          notification._id,

        entityLabel:
          notification.sourceLabel ||
          notification.title,

        metadata: {
          notificationType:
            notification.type,
          notificationSeverity:
            notification.severity,
          sourceType:
            notification.sourceType || "",
          sourceLabel:
            notification.sourceLabel || "",
          actionUrl:
            notification.actionUrl || "",
          wasAlreadyRead,
          readAt:
            notification.readAt,
        },
      });

      return res.status(200).json({
        success: true,
        message:
          "Notification marked as read.",
        data: {
          notification:
            serializeNotification(
              notification.toObject()
            ),
        },
      });
    } catch (error) {
      if (
        error.name === "CastError"
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