// backend/src/routes/adminUsers.js

const express = require("express");

const {
  protect,
  allowRoles,
} = require("../middleware/auth");

const CustomerFollowUp = require("../models/CustomerFollowUp");
const CustomerNote = require("../models/CustomerNote");
const Order = require("../models/Order");
const Subscription = require("../models/Subscription");
const User = require("../models/User");

const {
  logAdminActivity,
} = require("../services/adminActivityLogger");

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

const FOLLOW_UP_STATUSES = [
  "pending",
  "done",
  "cancelled",
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

function parseDueAt(value) {
  const date = new Date(value);

  if (
    !value ||
    Number.isNaN(date.getTime())
  ) {
    const error = new Error(
      "Please select a valid follow-up date and time."
    );

    error.statusCode = 400;
    throw error;
  }

  return date;
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

function serializeCustomerNote(note) {
  return {
    _id: note._id,
    customer: note.customer,
    note: note.note,
    createdBy: note.createdBy,
    createdBySnapshot:
      note.createdBySnapshot || null,
    active: note.active,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}

function serializeCustomerFollowUp(followUp) {
  return {
    _id: followUp._id,
    customer: followUp.customer,
    title: followUp.title,
    description: followUp.description || "",
    dueAt: followUp.dueAt,
    status: followUp.status,
    createdBy: followUp.createdBy,
    createdBySnapshot:
      followUp.createdBySnapshot || null,
    completedAt: followUp.completedAt || null,
    completedBy: followUp.completedBy || null,
    completedBySnapshot:
      followUp.completedBySnapshot || null,
    active: followUp.active,
    createdAt: followUp.createdAt,
    updatedAt: followUp.updatedAt,
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
        notes,
        followUps,
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

        CustomerNote.find({
          customer: user._id,
          active: true,
        })
          .sort({
            createdAt: -1,
          })
          .limit(25)
          .lean(),

        CustomerFollowUp.find({
          customer: user._id,
          active: true,
        })
          .sort({
            status: 1,
            dueAt: 1,
            createdAt: -1,
          })
          .limit(50)
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

            notes:
              notes.map(
                serializeCustomerNote
              ),

            followUps:
              followUps.map(
                serializeCustomerFollowUp
              ),
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

router.post(
  "/:userId/notes",
  async (req, res, next) => {
    try {
      const noteText =
        cleanText(req.body.note);

      if (
        !noteText ||
        noteText.length < 3
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Customer note must contain at least 3 characters.",
        });
      }

      if (noteText.length > 1500) {
        return res.status(400).json({
          success: false,
          message:
            "Customer note cannot exceed 1500 characters.",
        });
      }

      const customer =
        await User.findById(
          req.params.userId
        ).select(
          "_id fullName email phone role"
        );

      if (!customer) {
        return res.status(404).json({
          success: false,
          message:
            "User account not found.",
        });
      }

      const note =
        await CustomerNote.create({
          customer: customer._id,
          note: noteText,
          createdBy:
            req.user?._id || null,
          createdBySnapshot:
            buildAdminSnapshot(req.user),
        });

      await logAdminActivity({
        req,
        actionType:
          "customer_note_added",

        actionLabel:
          "Customer note added",

        severity:
          "info",

        message:
          `Internal note added for ${customer.fullName}.`,

        entityType:
          "customer",

        entityId:
          customer._id,

        entityLabel:
          customer.fullName,

        targetUser:
          customer,

        metadata: {
          noteId:
            String(note._id),
          notePreview:
            noteText.slice(0, 140),
        },
      });

      return res.status(201).json({
        success: true,
        message:
          "Customer note added successfully.",
        data: {
          note:
            serializeCustomerNote(
              note.toObject()
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
            "User account not found.",
        });
      }

      return next(error);
    }
  }
);

router.post(
  "/:userId/follow-ups",
  async (req, res, next) => {
    try {
      const title =
        cleanText(req.body.title);

      const description =
        cleanText(req.body.description);

      const dueAt =
        parseDueAt(req.body.dueAt);

      if (
        !title ||
        title.length < 3
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Follow-up title must contain at least 3 characters.",
        });
      }

      if (title.length > 120) {
        return res.status(400).json({
          success: false,
          message:
            "Follow-up title cannot exceed 120 characters.",
        });
      }

      if (description.length > 1000) {
        return res.status(400).json({
          success: false,
          message:
            "Follow-up description cannot exceed 1000 characters.",
        });
      }

      const customer =
        await User.findById(
          req.params.userId
        ).select(
          "_id fullName email phone role"
        );

      if (!customer) {
        return res.status(404).json({
          success: false,
          message:
            "User account not found.",
        });
      }

      const followUp =
        await CustomerFollowUp.create({
          customer: customer._id,
          title,
          description,
          dueAt,
          createdBy:
            req.user?._id || null,
          createdBySnapshot:
            buildAdminSnapshot(req.user),
        });

      await logAdminActivity({
        req,
        actionType:
          "customer_follow_up_added",

        actionLabel:
          "Customer follow-up added",

        severity:
          "success",

        message:
          `Follow-up "${title}" added for ${customer.fullName}.`,

        entityType:
          "follow_up",

        entityId:
          followUp._id,

        entityLabel:
          title,

        targetUser:
          customer,

        metadata: {
          customerId:
            String(customer._id),
          title,
          description,
          dueAt,
          status:
            followUp.status,
        },
      });

      return res.status(201).json({
        success: true,
        message:
          "Customer follow-up added successfully.",
        data: {
          followUp:
            serializeCustomerFollowUp(
              followUp.toObject()
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
            "User account not found.",
        });
      }

      return next(error);
    }
  }
);

router.patch(
  "/:userId/follow-ups/:followUpId/status",
  async (req, res, next) => {
    try {
      const status =
        cleanText(req.body.status).toLowerCase();

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

      const customer =
        await User.findById(
          req.params.userId
        ).select(
          "_id fullName email phone role"
        );

      if (!customer) {
        return res.status(404).json({
          success: false,
          message:
            "User account not found.",
        });
      }

      const followUp =
        await CustomerFollowUp.findOne({
          _id: req.params.followUpId,
          customer: customer._id,
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

      await logAdminActivity({
        req,
        actionType:
          "customer_follow_up_status_changed",

        actionLabel:
          "Customer follow-up status changed",

        severity:
          status === "done"
            ? "success"
            : status === "cancelled"
              ? "warning"
              : "info",

        message:
          `Follow-up "${followUp.title}" changed from ${previousStatus} to ${status}.`,

        entityType:
          "follow_up",

        entityId:
          followUp._id,

        entityLabel:
          followUp.title,

        targetUser:
          customer,

        metadata: {
          customerId:
            String(customer._id),
          previousStatus,
          nextStatus:
            status,
          dueAt:
            followUp.dueAt,
        },
      });

      return res.status(200).json({
        success: true,
        message:
          "Customer follow-up updated successfully.",
        data: {
          followUp:
            serializeCustomerFollowUp(
              followUp.toObject()
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

      const previousActive =
        user.active;

      user.active =
        req.body.active;

      await user.save();

      await logAdminActivity({
        req,
        actionType:
          "user_status_changed",

        actionLabel:
          user.active
            ? "User account activated"
            : "User account disabled",

        severity:
          user.active
            ? "success"
            : "warning",

        message:
          `${user.fullName} was ${user.active ? "activated" : "disabled"}.`,

        entityType:
          user.role === "customer"
            ? "customer"
            : "user",

        entityId:
          user._id,

        entityLabel:
          user.fullName,

        targetUser:
          user,

        metadata: {
          previousActive,
          nextActive:
            user.active,
          role:
            user.role,
        },
      });

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

      const previousRole =
        user.role;

      user.role = role;

      await user.save();

      await logAdminActivity({
        req,
        actionType:
          "user_role_changed",

        actionLabel:
          "User role changed",

        severity:
          role === "admin"
            ? "warning"
            : "info",

        message:
          `${user.fullName} role changed from ${previousRole} to ${role}.`,

        entityType:
          "user",

        entityId:
          user._id,

        entityLabel:
          user.fullName,

        targetUser:
          user,

        metadata: {
          previousRole,
          nextRole:
            role,
          active:
            user.active,
        },
      });

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