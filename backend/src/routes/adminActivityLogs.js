// backend/src/routes/adminActivityLogs.js

const express = require("express");

const {
  protect,
  allowRoles,
} = require("../middleware/auth");

const AdminActivityLog = require("../models/AdminActivityLog");
const User = require("../models/User");

const router = express.Router();

router.use(protect);
router.use(allowRoles("admin"));

const ENTITY_TYPES = [
  "",
  "order",
  "user",
  "customer",
  "product",
  "inventory",
  "follow_up",
  "notification",
  "subscription",
  "cash_collection",
  "batch",
  "coupon",
  "location",
  "system",
];

const SEVERITIES = [
  "info",
  "success",
  "warning",
  "danger",
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

function parseDate(value) {
  const cleanValue =
    cleanText(value);

  if (!cleanValue) {
    return null;
  }

  const date =
    new Date(cleanValue);

  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date;
}

function serializeActivityLog(log) {
  return {
    _id: log._id,
    actionType: log.actionType,
    actionLabel: log.actionLabel,
    severity: log.severity,
    message: log.message || "",
    actor: log.actor || null,
    actorSnapshot: log.actorSnapshot || null,
    entityType: log.entityType || "",
    entityId: log.entityId || null,
    entityLabel: log.entityLabel || "",
    targetUser: log.targetUser || null,
    targetUserSnapshot:
      log.targetUserSnapshot || null,
    requestSnapshot:
      log.requestSnapshot || null,
    metadata: log.metadata || {},
    active: log.active,
    createdAt: log.createdAt,
    updatedAt: log.updatedAt,
  };
}

async function buildSummary(filter = {}) {
  const [
    total,
    info,
    success,
    warning,
    danger,
    today,
  ] = await Promise.all([
    AdminActivityLog.countDocuments(
      filter
    ),

    AdminActivityLog.countDocuments({
      ...filter,
      severity: "info",
    }),

    AdminActivityLog.countDocuments({
      ...filter,
      severity: "success",
    }),

    AdminActivityLog.countDocuments({
      ...filter,
      severity: "warning",
    }),

    AdminActivityLog.countDocuments({
      ...filter,
      severity: "danger",
    }),

    AdminActivityLog.countDocuments({
      ...filter,
      createdAt: {
        $gte: new Date(
          new Date().setHours(
            0,
            0,
            0,
            0
          )
        ),
      },
    }),
  ]);

  return {
    total,
    info,
    success,
    warning,
    danger,
    today,
  };
}

router.get(
  "/",
  async (req, res, next) => {
    try {
      const actionType =
        cleanText(req.query.actionType);

      const entityType =
        cleanText(req.query.entityType);

      const severity =
        cleanText(req.query.severity);

      const adminId =
        cleanText(req.query.adminId);

      const search =
        cleanText(req.query.search);

      const dateFrom =
        parseDate(req.query.dateFrom);

      const dateTo =
        parseDate(req.query.dateTo);

      const limit = Math.min(
        Math.max(
          Number(req.query.limit || 250),
          1
        ),
        500
      );

      const filter = {
        active: true,
      };

      if (
        actionType &&
        actionType !== "all"
      ) {
        filter.actionType =
          actionType;
      }

      if (
        entityType &&
        entityType !== "all"
      ) {
        if (
          !ENTITY_TYPES.includes(
            entityType
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid entity type filter.",
          });
        }

        filter.entityType =
          entityType;
      }

      if (
        severity &&
        severity !== "all"
      ) {
        if (
          !SEVERITIES.includes(
            severity
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid severity filter.",
          });
        }

        filter.severity =
          severity;
      }

      if (adminId) {
        filter.actor =
          adminId;
      }

      if (
        dateFrom ||
        dateTo
      ) {
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

      if (search) {
        const regex =
          new RegExp(
            escapeRegex(search),
            "i"
          );

        filter.$or = [
          {
            actionType: regex,
          },
          {
            actionLabel: regex,
          },
          {
            message: regex,
          },
          {
            entityLabel: regex,
          },
          {
            "actorSnapshot.fullName": regex,
          },
          {
            "actorSnapshot.email": regex,
          },
          {
            "targetUserSnapshot.fullName": regex,
          },
          {
            "targetUserSnapshot.email": regex,
          },
          {
            "targetUserSnapshot.phone": regex,
          },
        ];
      }

      const [
        logs,
        summary,
        admins,
      ] = await Promise.all([
        AdminActivityLog.find(filter)
          .sort({
            createdAt: -1,
          })
          .limit(limit)
          .lean(),

        buildSummary(filter),

        User.find({
          role: "admin",
        })
          .select(
            "_id fullName email role active"
          )
          .sort({
            fullName: 1,
          })
          .lean(),
      ]);

      return res.status(200).json({
        success: true,
        count: logs.length,
        data: {
          logs:
            logs.map(
              serializeActivityLog
            ),

          summary,

          admins:
            admins.map((admin) => ({
              _id: admin._id,
              fullName: admin.fullName,
              email: admin.email,
              role: admin.role,
              active: admin.active,
            })),
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = router;