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

function escapeCsv(value) {
  const text = String(value ?? "");

  if (
    text.includes(",") ||
    text.includes('"') ||
    text.includes("\n")
  ) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
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

function buildActivityFilter(query) {
  const actionType =
    cleanText(query.actionType);

  const entityType =
    cleanText(query.entityType);

  const severity =
    cleanText(query.severity);

  const adminId =
    cleanText(query.adminId);

  const search =
    cleanText(query.search);

  const dateFrom =
    parseDate(query.dateFrom);

  const dateTo =
    parseDate(query.dateTo);

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
      const error = new Error(
        "Invalid entity type filter."
      );

      error.statusCode = 400;
      throw error;
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
      const error = new Error(
        "Invalid severity filter."
      );

      error.statusCode = 400;
      throw error;
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
        query.dateTo &&
        !String(query.dateTo).includes("T")
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

  return filter;
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

async function buildInsights(filter = {}) {
  const [
    topActions,
    topAdmins,
    topEntities,
  ] = await Promise.all([
    AdminActivityLog.aggregate([
      {
        $match: filter,
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
        },
      },
      {
        $limit: 6,
      },
    ]),

    AdminActivityLog.aggregate([
      {
        $match: filter,
      },
      {
        $group: {
          _id: {
            actor:
              "$actor",
            name:
              "$actorSnapshot.fullName",
            email:
              "$actorSnapshot.email",
          },
          count: {
            $sum: 1,
          },
        },
      },
      {
        $sort: {
          count: -1,
        },
      },
      {
        $limit: 6,
      },
    ]),

    AdminActivityLog.aggregate([
      {
        $match: filter,
      },
      {
        $group: {
          _id: {
            entityType:
              "$entityType",
            entityLabel:
              "$entityLabel",
          },
          count: {
            $sum: 1,
          },
        },
      },
      {
        $sort: {
          count: -1,
        },
      },
      {
        $limit: 6,
      },
    ]),
  ]);

  return {
    topActions:
      topActions.map((item) => ({
        label:
          item._id || "Unknown",
        count:
          item.count,
      })),

    topAdmins:
      topAdmins.map((item) => ({
        label:
          item._id?.name ||
          item._id?.email ||
          "System/Admin",
        email:
          item._id?.email || "",
        count:
          item.count,
      })),

    topEntities:
      topEntities.map((item) => ({
        label:
          item._id?.entityLabel ||
          item._id?.entityType ||
          "Unknown",
        entityType:
          item._id?.entityType || "",
        count:
          item.count,
      })),
  };
}

function buildCsv(logs) {
  const headers = [
    "Date",
    "Action Type",
    "Action Label",
    "Severity",
    "Message",
    "Admin Name",
    "Admin Email",
    "Entity Type",
    "Entity Label",
    "Target User",
    "Target User Phone",
    "Request Method",
    "Request Path",
    "Metadata JSON",
  ];

  const rows =
    logs.map((log) => [
      log.createdAt
        ? new Date(log.createdAt).toLocaleString(
            "en-IN",
            {
              timeZone:
                "Asia/Kolkata",
            }
          )
        : "",
      log.actionType,
      log.actionLabel,
      log.severity,
      log.message || "",
      log.actorSnapshot?.fullName || "",
      log.actorSnapshot?.email || "",
      log.entityType || "",
      log.entityLabel || "",
      log.targetUserSnapshot?.fullName || "",
      log.targetUserSnapshot?.phone || "",
      log.requestSnapshot?.method || "",
      log.requestSnapshot?.path || "",
      JSON.stringify(log.metadata || {}),
    ]);

  return [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) =>
      row.map(escapeCsv).join(",")
    ),
  ].join("\n");
}

router.get(
  "/export.csv",
  async (req, res, next) => {
    try {
      const filter =
        buildActivityFilter(req.query);

      const limit = Math.min(
        Math.max(
          Number(req.query.limit || 5000),
          1
        ),
        10000
      );

      const logs =
        await AdminActivityLog.find(filter)
          .sort({
            createdAt: -1,
          })
          .limit(limit)
          .lean();

      const csv =
        buildCsv(logs);

      const dateId =
        new Date()
          .toISOString()
          .slice(0, 10);

      res.setHeader(
        "Content-Type",
        "text/csv; charset=utf-8"
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="solidsip-activity-log-${dateId}.csv"`
      );

      return res.status(200).send(csv);
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
        });
      }

      return next(error);
    }
  }
);

router.get(
  "/",
  async (req, res, next) => {
    try {
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

      const filter =
        buildActivityFilter(req.query);

      const [
        logs,
        totalMatching,
        summary,
        admins,
        actionTypes,
        insights,
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

        buildInsights(filter),
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

          insights,

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
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
        });
      }

      return next(error);
    }
  }
);

module.exports = router;