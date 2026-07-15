// backend/src/routes/adminUsers.js

const express = require("express");

const {
  protect,
  allowRoles,
} = require("../middleware/auth");

const Order = require("../models/Order");
const Subscription = require("../models/Subscription");
const User = require("../models/User");

const router = express.Router();

router.use(protect);
router.use(allowRoles("admin"));

const USER_ROLES = [
  "customer",
  "admin",
  "delivery",
];

const MANAGED_ROLES = [
  "customer",
  "admin",
];

const ACTIVE_ORDER_STATUSES = [
  "placed",
  "confirmed",
  "preparing",
  "out_for_delivery",
  "delivered",
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

function serializeSavedAddress(address) {
  if (!address) {
    return null;
  }

  return {
    id: String(address._id),
    label: address.label,
    fullName: address.fullName,
    phone: address.phone,
    pincode: address.pincode,
    houseDetails: address.houseDetails,
    areaDetails: address.areaDetails,
    landmark: address.landmark || "",
    area: address.area,
    city: address.city,
    isDefault: Boolean(address.isDefault),
    createdAt: address.createdAt,
    updatedAt: address.updatedAt,
  };
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
    savedAddressCount:
      Array.isArray(user.savedAddresses)
        ? user.savedAddresses.length
        : 0,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function serializeOrderSummary(order) {
  const bottleCount =
    Array.isArray(order.items)
      ? order.items.reduce(
          (total, item) =>
            total + Number(item.quantity || 0),
          0
        )
      : 0;

  return {
    _id: order._id,
    orderNumber: order.orderNumber,
    total: Number(order.total || 0),
    subtotal: Number(order.subtotal || 0),
    deliveryFee: Number(order.deliveryFee || 0),
    couponDiscount: Number(order.couponDiscount || 0),
    bottleCount,
    paymentMethod: order.paymentMethod,
    paymentGateway: order.paymentGateway || "",
    paymentStatus: order.paymentStatus,
    orderStatus: order.orderStatus,
    deliveryStatus: order.deliveryStatus || "unassigned",
    deliveryAddress: order.deliveryAddress,
    deliverySchedule: order.deliverySchedule,
    refundStatus: order.refundStatus || "not_required",
    refundFailureReason: order.refundFailureReason || "",
    refundAttemptCount: Number(order.refundAttemptCount || 0),
    refundAmount: Number(order.refundAmount || 0),
    refundRequestedAt: order.refundRequestedAt || null,
    refundProcessedAt: order.refundProcessedAt || null,
    refundFailedAt: order.refundFailedAt || null,
    cancellationReason: order.cancellationReason || "",
    cancelledAt: order.cancelledAt || null,
    deliveredAt: order.deliveredAt || null,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

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
        totalDeliveryPartners,
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

              bottleCount: {
                $sum: {
                  $cond: [
                    {
                      $ne: [
                        "$orderStatus",
                        "cancelled",
                      ],
                    },
                    {
                      $sum: "$items.quantity",
                    },
                    0,
                  ],
                },
              },

              codPendingAmount: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        {
                          $eq: [
                            "$paymentMethod",
                            "cod",
                          ],
                        },
                        {
                          $eq: [
                            "$paymentStatus",
                            "pending",
                          ],
                        },
                        {
                          $ne: [
                            "$orderStatus",
                            "cancelled",
                          ],
                        },
                      ],
                    },
                    "$total",
                    0,
                  ],
                },
              },

              codPaidAmount: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        {
                          $eq: [
                            "$paymentMethod",
                            "cod",
                          ],
                        },
                        {
                          $eq: [
                            "$paymentStatus",
                            "paid",
                          ],
                        },
                        {
                          $ne: [
                            "$orderStatus",
                            "cancelled",
                          ],
                        },
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
          role: "delivery",
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

              bottleCount:
                orderStats?.bottleCount ??
                0,

              codPendingAmount:
                orderStats
                  ?.codPendingAmount ??
                0,

              codPaidAmount:
                orderStats?.codPaidAmount ??
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
            totalDeliveryPartners,
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

router.get(
  "/:userId",
  async (req, res, next) => {
    try {
      const user =
        await User.findById(
          req.params.userId
        ).lean();

      if (!user) {
        return res.status(404).json({
          success: false,
          message:
            "User account not found.",
        });
      }

      const [
        orderSummary,
        latestOrders,
        subscriptionSummary,
        latestSubscriptions,
      ] = await Promise.all([
        Order.aggregate([
          {
            $match: {
              user: user._id,
            },
          },
          {
            $group: {
              _id: "$user",

              totalOrders: {
                $sum: 1,
              },

              activeOrders: {
                $sum: {
                  $cond: [
                    {
                      $in: [
                        "$orderStatus",
                        ACTIVE_ORDER_STATUSES,
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },

              deliveredOrders: {
                $sum: {
                  $cond: [
                    {
                      $eq: [
                        "$orderStatus",
                        "delivered",
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },

              cancelledOrders: {
                $sum: {
                  $cond: [
                    {
                      $eq: [
                        "$orderStatus",
                        "cancelled",
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },

              totalRevenue: {
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

              totalBottles: {
                $sum: {
                  $cond: [
                    {
                      $ne: [
                        "$orderStatus",
                        "cancelled",
                      ],
                    },
                    {
                      $sum: "$items.quantity",
                    },
                    0,
                  ],
                },
              },

              codPendingAmount: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        {
                          $eq: [
                            "$paymentMethod",
                            "cod",
                          ],
                        },
                        {
                          $eq: [
                            "$paymentStatus",
                            "pending",
                          ],
                        },
                        {
                          $ne: [
                            "$orderStatus",
                            "cancelled",
                          ],
                        },
                      ],
                    },
                    "$total",
                    0,
                  ],
                },
              },

              codPaidAmount: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        {
                          $eq: [
                            "$paymentMethod",
                            "cod",
                          ],
                        },
                        {
                          $eq: [
                            "$paymentStatus",
                            "paid",
                          ],
                        },
                        {
                          $ne: [
                            "$orderStatus",
                            "cancelled",
                          ],
                        },
                      ],
                    },
                    "$total",
                    0,
                  ],
                },
              },

              onlinePaidAmount: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        {
                          $eq: [
                            "$paymentMethod",
                            "online",
                          ],
                        },
                        {
                          $eq: [
                            "$paymentStatus",
                            "paid",
                          ],
                        },
                        {
                          $ne: [
                            "$orderStatus",
                            "cancelled",
                          ],
                        },
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

        Order.find({
          user: user._id,
        })
          .sort({
            createdAt: -1,
          })
          .limit(10)
          .lean(),

        Subscription.aggregate([
          {
            $match: {
              user: user._id,
            },
          },
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

              pausedSubscriptionCount: {
                $sum: {
                  $cond: [
                    {
                      $eq: [
                        "$status",
                        "paused",
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },

              cancelledSubscriptionCount: {
                $sum: {
                  $cond: [
                    {
                      $eq: [
                        "$status",
                        "cancelled",
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },

              recurringValue: {
                $sum: {
                  $cond: [
                    {
                      $eq: [
                        "$status",
                        "active",
                      ],
                    },
                    "$totalPerCycle",
                    0,
                  ],
                },
              },
            },
          },
        ]),

        Subscription.find({
          user: user._id,
        })
          .sort({
            createdAt: -1,
          })
          .limit(5)
          .select(
            "subscriptionNumber planName status billingCycle totalPerCycle nextBillingAt createdAt"
          )
          .lean(),
      ]);

      const orderStats =
        orderSummary[0] || {};

      const subscriptionStats =
        subscriptionSummary[0] || {};

      return res.status(200).json({
        success: true,
        data: {
          customer: {
            user: {
              ...serializeUser(user),
              savedAddresses:
                Array.isArray(
                  user.savedAddresses
                )
                  ? user.savedAddresses
                      .map(
                        serializeSavedAddress
                      )
                      .filter(Boolean)
                  : [],
            },

            statistics: {
              totalOrders:
                orderStats.totalOrders ??
                0,

              activeOrders:
                orderStats.activeOrders ??
                0,

              deliveredOrders:
                orderStats
                  .deliveredOrders ?? 0,

              cancelledOrders:
                orderStats
                  .cancelledOrders ?? 0,

              totalRevenue:
                orderStats.totalRevenue ??
                0,

              totalBottles:
                orderStats.totalBottles ??
                0,

              codPendingAmount:
                orderStats
                  .codPendingAmount ??
                0,

              codPaidAmount:
                orderStats.codPaidAmount ??
                0,

              onlinePaidAmount:
                orderStats
                  .onlinePaidAmount ??
                0,

              subscriptionCount:
                subscriptionStats
                  .subscriptionCount ??
                0,

              activeSubscriptionCount:
                subscriptionStats
                  .activeSubscriptionCount ??
                0,

              pausedSubscriptionCount:
                subscriptionStats
                  .pausedSubscriptionCount ??
                0,

              cancelledSubscriptionCount:
                subscriptionStats
                  .cancelledSubscriptionCount ??
                0,

              activeRecurringValue:
                subscriptionStats
                  .recurringValue ?? 0,
            },

            latestOrders:
              latestOrders.map(
                serializeOrderSummary
              ),

            latestSubscriptions,
          },
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

router.patch(
  "/:userId/role",
  async (req, res, next) => {
    try {
      const role = cleanText(
        req.body.role
      ).toLowerCase();

      if (!MANAGED_ROLES.includes(role)) {
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

      if (user.role === "delivery") {
        return res.status(400).json({
          success: false,
          message:
            "Delivery partner roles must be managed from the delivery partners page.",
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