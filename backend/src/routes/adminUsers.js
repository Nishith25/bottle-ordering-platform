// backend/src/routes/adminUsers.js

const express = require("express");

const {
  protect,
  allowRoles,
} = require("../middleware/auth");

const Order = require("../models/Order");
const Subscription = require(
  "../models/Subscription"
);
const User = require("../models/User");

const router = express.Router();

router.use(protect);
router.use(allowRoles("admin"));

const USER_ROLES = [
  "customer",
  "admin",
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

function serializeUser(user) {
  return {
    _id: user._id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    active: user.active,
    emailVerified: user.emailVerified,
    phoneVerified: user.phoneVerified,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * GET /api/admin/users
 *
 * Query parameters:
 * role=customer|admin|all
 * status=active|inactive|all
 * search=name, email or phone
 */
router.get(
  "/",
  async (req, res, next) => {
    try {
      const role = cleanText(
        req.query.role
      ).toLowerCase();

      const status = cleanText(
        req.query.status
      ).toLowerCase();

      const search = cleanText(
        req.query.search
      );

      const filter = {};

      if (role && role !== "all") {
        if (!USER_ROLES.includes(role)) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid user role filter.",
          });
        }

        filter.role = role;
      }

      if (
        status &&
        status !== "all"
      ) {
        if (
          ![
            "active",
            "inactive",
          ].includes(status)
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid account status filter.",
          });
        }

        filter.active =
          status === "active";
      }

      if (search) {
        const searchRegex =
          new RegExp(
            escapeRegex(search),
            "i"
          );

        filter.$or = [
          {
            fullName: searchRegex,
          },
          {
            email: searchRegex,
          },
          {
            phone: searchRegex,
          },
        ];
      }

      const [
        users,
        orderStatistics,
        subscriptionStatistics,
        totalUsers,
        totalCustomers,
        totalAdmins,
        activeUsers,
        inactiveUsers,
      ] = await Promise.all([
        User.find(filter)
          .sort({
            createdAt: -1,
          })
          .limit(500)
          .lean(),

        Order.aggregate([
          {
            $group: {
              _id: "$user",

              orderCount: {
                $sum: 1,
              },

              orderValue: {
                $sum: {
                  $cond: [
                    {
                      $ne: [
                        "$orderStatus",
                        "cancelled",
                      ],
                    },
                    "$total",
                    0,
                  ],
                },
              },
            },
          },
        ]),

        Subscription.aggregate([
          {
            $group: {
              _id: "$user",

              subscriptionCount: {
                $sum: 1,
              },

              activeSubscriptionCount: {
                $sum: {
                  $cond: [
                    {
                      $eq: [
                        "$status",
                        "active",
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ]),

        User.countDocuments(),

        User.countDocuments({
          role: "customer",
        }),

        User.countDocuments({
          role: "admin",
        }),

        User.countDocuments({
          active: true,
        }),

        User.countDocuments({
          active: false,
        }),
      ]);

      const orderStatisticsByUser =
        new Map(
          orderStatistics.map(
            (item) => [
              String(item._id),
              item,
            ]
          )
        );

      const subscriptionStatisticsByUser =
        new Map(
          subscriptionStatistics.map(
            (item) => [
              String(item._id),
              item,
            ]
          )
        );

      const usersWithStatistics =
        users.map((user) => {
          const userId = String(
            user._id
          );

          const orderStats =
            orderStatisticsByUser.get(
              userId
            );

          const subscriptionStats =
            subscriptionStatisticsByUser.get(
              userId
            );

          return {
            ...serializeUser(user),

            isCurrentAdmin:
              userId ===
              String(req.user._id),

            statistics: {
              orderCount:
                orderStats?.orderCount ??
                0,

              orderValue:
                orderStats?.orderValue ??
                0,

              subscriptionCount:
                subscriptionStats
                  ?.subscriptionCount ??
                0,

              activeSubscriptionCount:
                subscriptionStats
                  ?.activeSubscriptionCount ??
                0,
            },
          };
        });

      return res.status(200).json({
        success: true,
        count:
          usersWithStatistics.length,

        data: {
          users:
            usersWithStatistics,

          summary: {
            totalUsers,
            totalCustomers,
            totalAdmins,
            activeUsers,
            inactiveUsers,
          },
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * PATCH /api/admin/users/:userId/status
 *
 * Body:
 * {
 *   active: true | false
 * }
 */
router.patch(
  "/:userId/status",
  async (req, res, next) => {
    try {
      if (
        typeof req.body.active !==
        "boolean"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "The account status must be true or false.",
        });
      }

      const user = await User.findById(
        req.params.userId
      );

      if (!user) {
        return res.status(404).json({
          success: false,
          message:
            "User account not found.",
        });
      }

      const isCurrentAdmin =
        String(user._id) ===
        String(req.user._id);

      if (isCurrentAdmin) {
        return res.status(400).json({
          success: false,
          message:
            "You cannot disable or reactivate your own administrator account from this page.",
        });
      }

      if (
        user.active === req.body.active
      ) {
        return res.status(200).json({
          success: true,

          message:
            "The account status is already up to date.",

          data: {
            user:
              serializeUser(user),
          },
        });
      }

      if (
        user.role === "admin" &&
        user.active &&
        req.body.active === false
      ) {
        const activeAdminCount =
          await User.countDocuments({
            role: "admin",
            active: true,
          });

        if (
          activeAdminCount <= 1
        ) {
          return res.status(400).json({
            success: false,
            message:
              "The final active administrator account cannot be disabled.",
          });
        }
      }

      user.active =
        req.body.active;

      await user.save();

      return res.status(200).json({
        success: true,

        message: user.active
          ? "User account activated successfully."
          : "User account disabled successfully.",

        data: {
          user:
            serializeUser(user),
        },
      });
    } catch (error) {
      if (
        error.name === "CastError"
      ) {
        return res.status(404).json({
          success: false,
          message:
            "User account not found.",
        });
      }

      return next(error);
    }
  }
);

/**
 * PATCH /api/admin/users/:userId/role
 *
 * Body:
 * {
 *   role: "customer" | "admin"
 * }
 */
router.patch(
  "/:userId/role",
  async (req, res, next) => {
    try {
      const role = cleanText(
        req.body.role
      ).toLowerCase();

      if (!USER_ROLES.includes(role)) {
        return res.status(400).json({
          success: false,
          message:
            "Please select a valid account role.",
        });
      }

      const user = await User.findById(
        req.params.userId
      );

      if (!user) {
        return res.status(404).json({
          success: false,
          message:
            "User account not found.",
        });
      }

      const isCurrentAdmin =
        String(user._id) ===
        String(req.user._id);

      if (isCurrentAdmin) {
        return res.status(400).json({
          success: false,
          message:
            "You cannot change your own administrator role from this page.",
        });
      }

      if (user.role === role) {
        return res.status(200).json({
          success: true,

          message:
            "The account role is already up to date.",

          data: {
            user:
              serializeUser(user),
          },
        });
      }

      if (
        user.role === "admin" &&
        role === "customer" &&
        user.active
      ) {
        const activeAdminCount =
          await User.countDocuments({
            role: "admin",
            active: true,
          });

        if (
          activeAdminCount <= 1
        ) {
          return res.status(400).json({
            success: false,
            message:
              "The final active administrator cannot be changed to a customer.",
          });
        }
      }

      user.role = role;

      await user.save();

      return res.status(200).json({
        success: true,

        message:
          role === "admin"
            ? "Customer promoted to administrator successfully."
            : "Administrator changed to customer successfully.",

        data: {
          user:
            serializeUser(user),
        },
      });
    } catch (error) {
      if (
        error.name === "CastError"
      ) {
        return res.status(404).json({
          success: false,
          message:
            "User account not found.",
        });
      }

      return next(error);
    }
  }
);

module.exports = router;