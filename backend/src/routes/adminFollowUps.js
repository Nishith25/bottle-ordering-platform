const express = require("express");

const {
  protect,
  allowRoles,
} = require("../middleware/auth");

const CustomerFollowUp = require("../models/CustomerFollowUp");
const User = require("../models/User");

const {
  runCustomerFollowUpAutomation,
} = require("../services/customerFollowUpAutomation");

const {
  logAdminActivity,
} = require("../services/adminActivityLogger");

const router = express.Router();

router.use(protect);
router.use(allowRoles("admin"));

const FOLLOW_UP_STATUSES = [
  "pending",
  "done",
  "cancelled",
];

const FOLLOW_UP_CATEGORIES = [
  "manual",
  "cod_payment",
  "refund",
  "cancellation",
  "subscription",
  "renewal",
  "overdue_escalation",
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

function getTodayRangeInIndia() {
  const dateId =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    ).format(new Date());

  return {
    start: new Date(`${dateId}T00:00:00+05:30`),
    end: new Date(`${dateId}T23:59:59.999+05:30`),
  };
}

function serializeCustomer(customer) {
  if (!customer) {
    return null;
  }

  return {
    _id: customer._id,
    fullName: customer.fullName,
    email: customer.email,
    phone: customer.phone,
    role: customer.role,
    active: customer.active,
  };
}

function serializeFollowUp(followUp) {
  return {
    _id: followUp._id,

    customer:
      followUp.customer &&
      typeof followUp.customer === "object"
        ? serializeCustomer(followUp.customer)
        : followUp.customer,

    title: followUp.title,
    description: followUp.description || "",
    dueAt: followUp.dueAt,
    status: followUp.status,

    category:
      followUp.category || "manual",

    priority:
      followUp.priority || "normal",

    sourceType:
      followUp.sourceType || "",

    sourceId:
      followUp.sourceId || null,

    sourceLabel:
      followUp.sourceLabel || "",

    automationKey:
      followUp.automationKey || "",

    autoCreated:
      Boolean(followUp.autoCreated),

    metadata:
      followUp.metadata || {},

    createdBy:
      followUp.createdBy || null,

    createdBySnapshot:
      followUp.createdBySnapshot || null,

    completedAt:
      followUp.completedAt || null,

    completedBy:
      followUp.completedBy || null,

    completedBySnapshot:
      followUp.completedBySnapshot || null,

    active: followUp.active,
    createdAt: followUp.createdAt,
    updatedAt: followUp.updatedAt,
  };
}

async function buildFollowUpFilter(req) {
  const status = cleanText(
    req.query.status
  ).toLowerCase();

  const category = cleanText(
    req.query.category
  ).toLowerCase();

  const search = cleanText(
    req.query.search
  );

  const filter = {
    active: true,
  };

  const now = new Date();

  if (
    status &&
    status !== "all"
  ) {
    if (status === "overdue") {
      filter.status = "pending";
      filter.dueAt = {
        $lt: now,
      };
    } else if (status === "today") {
      const range =
        getTodayRangeInIndia();

      filter.status = "pending";
      filter.dueAt = {
        $gte: range.start,
        $lte: range.end,
      };
    } else {
      if (
        !FOLLOW_UP_STATUSES.includes(
          status
        )
      ) {
        const error = new Error(
          "Invalid follow-up status filter."
        );

        error.statusCode = 400;
        throw error;
      }

      filter.status = status;
    }
  }

  if (
    category &&
    category !== "all"
  ) {
    if (
      !FOLLOW_UP_CATEGORIES.includes(
        category
      )
    ) {
      const error = new Error(
        "Invalid follow-up category filter."
      );

      error.statusCode = 400;
      throw error;
    }

    filter.category = category;
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
        (user) => user._id
      );

    filter.$or = [
      {
        title: searchRegex,
      },
      {
        description: searchRegex,
      },
      {
        sourceLabel: searchRegex,
      },
      {
        category: searchRegex,
      },
      {
        customer: {
          $in:
            matchingUserIds,
        },
      },
    ];
  }

  return filter;
}

async function buildSummary() {
  const now = new Date();
  const todayRange =
    getTodayRangeInIndia();

  const [
    total,
    pending,
    overdue,
    today,
    done,
    cancelled,
    automated,
    manual,
  ] = await Promise.all([
    CustomerFollowUp.countDocuments({
      active: true,
    }),

    CustomerFollowUp.countDocuments({
      active: true,
      status: "pending",
    }),

    CustomerFollowUp.countDocuments({
      active: true,
      status: "pending",
      dueAt: {
        $lt: now,
      },
    }),

    CustomerFollowUp.countDocuments({
      active: true,
      status: "pending",
      dueAt: {
        $gte: todayRange.start,
        $lte: todayRange.end,
      },
    }),

    CustomerFollowUp.countDocuments({
      active: true,
      status: "done",
    }),

    CustomerFollowUp.countDocuments({
      active: true,
      status: "cancelled",
    }),

    CustomerFollowUp.countDocuments({
      active: true,
      autoCreated: true,
    }),

    CustomerFollowUp.countDocuments({
      active: true,
      autoCreated: {
        $ne: true,
      },
    }),
  ]);

  return {
    total,
    pending,
    overdue,
    today,
    done,
    cancelled,
    automated,
    manual,
  };
}

router.get(
  "/",
  async (req, res, next) => {
    try {
      const filter =
        await buildFollowUpFilter(req);

      const limit = Math.min(
        Math.max(
          Number(req.query.limit || 200),
          1
        ),
        500
      );

      const [
        followUps,
        summary,
      ] = await Promise.all([
        CustomerFollowUp.find(filter)
          .populate(
            "customer",
            "fullName email phone role active"
          )
          .sort({
            status: 1,
            priority: -1,
            dueAt: 1,
            createdAt: -1,
          })
          .limit(limit)
          .lean(),

        buildSummary(),
      ]);

      return res.status(200).json({
        success: true,
        count:
          followUps.length,

        data: {
          followUps:
            followUps.map(
              serializeFollowUp
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
  "/run-automation",
  async (req, res, next) => {
    try {
      const result =
        await runCustomerFollowUpAutomation();

      await logAdminActivity({
        req,
        actionType:
          "customer_follow_up_automation_run",

        actionLabel:
          "Follow-up automation run",

        severity:
          result.totalCreated > 0
            ? "success"
            : "info",

        message:
          `${result.totalCreated || 0} new follow-up${result.totalCreated === 1 ? "" : "s"} created by automation.`,

        entityType:
          "follow_up",

        entityId:
          null,

        entityLabel:
          "Follow-up Automation",

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
          "Follow-up automation completed.",
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
  "/:followUpId/status",
  async (req, res, next) => {
    try {
      const status =
        cleanText(
          req.body.status
        ).toLowerCase();

      if (
        !FOLLOW_UP_STATUSES.includes(
          status
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Please select a valid follow-up status.",
        });
      }

      const followUp =
        await CustomerFollowUp.findOne({
          _id: req.params.followUpId,
          active: true,
        });

      if (!followUp) {
        return res.status(404).json({
          success: false,
          message:
            "Customer follow-up not found.",
        });
      }

      const previousStatus =
        followUp.status;

      followUp.status = status;

      if (status === "done") {
        followUp.completedAt =
          new Date();

        followUp.completedBy =
          req.user?._id || null;

        followUp.completedBySnapshot =
          buildAdminSnapshot(req.user);
      } else {
        followUp.completedAt = null;
        followUp.completedBy = null;
        followUp.completedBySnapshot = {
          fullName: "",
          email: "",
          role: "",
        };
      }

      await followUp.save();

      const populatedFollowUp =
        await CustomerFollowUp.findById(
          followUp._id
        )
          .populate(
            "customer",
            "fullName email phone role active"
          )
          .lean();

      await logAdminActivity({
        req,
        actionType:
          "follow_up_status_changed",

        actionLabel:
          "Follow-up status changed",

        severity:
          status === "done"
            ? "success"
            : status === "cancelled"
              ? "warning"
              : "info",

        message:
          `${populatedFollowUp.title} changed from ${previousStatus} to ${status}.`,

        entityType:
          "follow_up",

        entityId:
          populatedFollowUp._id,

        entityLabel:
          populatedFollowUp.sourceLabel ||
          populatedFollowUp.title,

        targetUser:
          populatedFollowUp.customer &&
          typeof populatedFollowUp.customer === "object"
            ? populatedFollowUp.customer
            : null,

        metadata: {
          previousStatus,
          nextStatus:
            status,
          title:
            populatedFollowUp.title,
          category:
            populatedFollowUp.category || "manual",
          priority:
            populatedFollowUp.priority || "normal",
          sourceType:
            populatedFollowUp.sourceType || "",
          sourceLabel:
            populatedFollowUp.sourceLabel || "",
          autoCreated:
            Boolean(populatedFollowUp.autoCreated),
          dueAt:
            populatedFollowUp.dueAt,
        },
      });

      return res.status(200).json({
        success: true,
        message:
          "Follow-up updated successfully.",
        data: {
          followUp:
            serializeFollowUp(
              populatedFollowUp
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
            "Customer follow-up not found.",
        });
      }

      return next(error);
    }
  }
);

module.exports = router;