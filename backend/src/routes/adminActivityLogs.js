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

function mergeTodayFilter(filter) {
  const todayStart =
    new Date();

  todayStart.setHours(
    0,
    0,
    0,
    0
  );

  const todayFilter = {
    ...filter,
  };

  const existingCreatedAt =
    filter.createdAt || {};

  todayFilter.createdAt = {
    ...existingCreatedAt,
    $gte:
      existingCreatedAt.$gte &&
      existingCreatedAt.$gte > todayStart
        ? existingCreatedAt.$gte
        : todayStart,
  };

  return todayFilter;
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

    AdminActivityLog.countDocuments(
      mergeTodayFilter(filter)
    ),
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

async function buildActionTypes() {
  const items =
    await AdminActivityLog.aggregate([
      {
        $match: {
          active: true,
        },
      },
      {
        $group: {
          _id: "$actionType",
          count: {
            $sum: 1,
          },
        },
      },
      {
        $sort: {
          count: -1,
          _id: 1,
        },
      },
      {
        $limit: 100,
      },
    ]);

  return items
    .filter((item) => item._id)
    .map((item) => ({
      actionType: item._id,
      count: item.count,
    }));
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

      const page = Math.min(
        Math.max(
          Number(req.query.page || 1),
          1
        ),
        10000
      );

      const limit = Math.min(
        Math.max(
          Number(req.query.limit || 50),
          1
        ),
        500
      );

      const skip =
        (page - 1) * limit;

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
          const endDate =
            new Date(dateTo);

          if (
            req.query.dateTo &&
            !String(req.query.dateTo).includes("T")
          ) {
            endDate.setHours(
              23,
              59,
              59,
              999
            );
          }

          filter.createdAt.$lte =
            endDate;
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
        totalMatching,
        summary,
        admins,
        actionTypes,
      ] = await Promise.all([
        AdminActivityLog.find(filter)
          .sort({
            createdAt: -1,
          })
          .skip(skip)
          .limit(limit)
          .lean(),

        AdminActivityLog.countDocuments(
          filter
        ),

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

        buildActionTypes(),
      ]);

      const totalPages =
        Math.max(
          Math.ceil(
            totalMatching / limit
          ),
          1
        );

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

          actionTypes,

          pagination: {
            page,
            limit,
            total:
              totalMatching,
            totalPages,
            hasPreviousPage:
              page > 1,
            hasNextPage:
              page < totalPages,
          },
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = router;