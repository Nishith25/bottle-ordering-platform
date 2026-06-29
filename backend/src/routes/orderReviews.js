const express = require("express");

const {
  protect,
  allowRoles,
} = require("../middleware/auth");

const Order = require(
  "../models/Order"
);

const OrderReview = require(
  "../models/OrderReview"
);

const User = require(
  "../models/User"
);

const router = express.Router();

router.use(protect);

function cleanText(value) {
  return String(value || "").trim();
}

function escapeRegex(value) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

function validateRating(
  value,
  label
) {
  const rating = Number(value);

  if (
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5
  ) {
    return {
      valid: false,
      message: `${label} must be between 1 and 5 stars.`,
      value: 0,
    };
  }

  return {
    valid: true,
    message: "",
    value: rating,
  };
}

async function getPopulatedReview(
  reviewId
) {
  return OrderReview.findById(
    reviewId
  )
    .populate(
      "user",
      "fullName email phone role"
    )
    .populate(
      "deliveryPartner",
      "fullName email phone role active"
    )
    .lean();
}

/**
 * GET /api/order-reviews/my
 *
 * Returns reviews submitted by the
 * currently logged-in account.
 *
 * Customer, admin and delivery accounts
 * can all purchase and review their own
 * orders.
 */
router.get(
  "/my",
  async (req, res, next) => {
    try {
      const reviews =
        await OrderReview.find({
          user: req.user._id,
        })
          .populate(
            "deliveryPartner",
            "fullName email phone role active"
          )
          .sort({
            createdAt: -1,
          })
          .lean();

      return res.status(200).json({
        success: true,
        count: reviews.length,

        data: {
          reviews,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * GET /api/order-reviews/order/:orderId
 *
 * Returns the logged-in user's review
 * for a particular order.
 */
router.get(
  "/order/:orderId",
  async (req, res, next) => {
    try {
      const review =
        await OrderReview.findOne({
          order: req.params.orderId,
          user: req.user._id,
        })
          .populate(
            "deliveryPartner",
            "fullName email phone role active"
          )
          .lean();

      return res.status(200).json({
        success: true,

        data: {
          review: review || null,
        },
      });
    } catch (error) {
      if (
        error.name === "CastError"
      ) {
        return res.status(200).json({
          success: true,

          data: {
            review: null,
          },
        });
      }

      return next(error);
    }
  }
);

/**
 * GET /api/order-reviews/admin
 *
 * Admin-only list of order and delivery
 * reviews.
 */
router.get(
  "/admin",
  allowRoles("admin"),
  async (req, res, next) => {
    try {
      const search = cleanText(
        req.query.search
      );

      const ratingFilter =
        cleanText(
          req.query.rating
        );

      const filter = {};

      if (
        ratingFilter &&
        ratingFilter !== "all"
      ) {
        const parsedRating =
          Number(ratingFilter);

        if (
          !Number.isInteger(
            parsedRating
          ) ||
          parsedRating < 1 ||
          parsedRating > 5
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Rating filter must be between 1 and 5.",
          });
        }

        filter.deliveryRating =
          parsedRating;
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
            orderNumber:
              searchRegex,
          },

          {
            comment:
              searchRegex,
          },

          {
            "customerSnapshot.fullName":
              searchRegex,
          },

          {
            "customerSnapshot.email":
              searchRegex,
          },

          {
            "customerSnapshot.phone":
              searchRegex,
          },

          {
            "deliveryPartnerSnapshot.fullName":
              searchRegex,
          },

          {
            user: {
              $in:
                matchingUserIds,
            },
          },

          {
            deliveryPartner: {
              $in:
                matchingUserIds,
            },
          },
        ];
      }

      const [
        reviews,
        summaryResult,
      ] = await Promise.all([
        OrderReview.find(filter)
          .populate(
            "user",
            "fullName email phone role"
          )
          .populate(
            "deliveryPartner",
            "fullName email phone role active"
          )
          .sort({
            createdAt: -1,
          })
          .limit(300)
          .lean(),

        OrderReview.aggregate([
          {
            $match: filter,
          },

          {
            $group: {
              _id: null,

              totalReviews: {
                $sum: 1,
              },

              averageOrderRating: {
                $avg:
                  "$orderRating",
              },

              averageDeliveryRating: {
                $avg:
                  "$deliveryRating",
              },

              fiveStarDeliveries: {
                $sum: {
                  $cond: [
                    {
                      $eq: [
                        "$deliveryRating",
                        5,
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
      ]);

      const summary =
        summaryResult[0] || {
          totalReviews: 0,
          averageOrderRating: 0,
          averageDeliveryRating: 0,
          fiveStarDeliveries: 0,
        };

      return res.status(200).json({
        success: true,
        count: reviews.length,

        data: {
          reviews,

          summary: {
            totalReviews:
              summary.totalReviews,

            averageOrderRating:
              Number(
                (
                  summary.averageOrderRating ||
                  0
                ).toFixed(1)
              ),

            averageDeliveryRating:
              Number(
                (
                  summary.averageDeliveryRating ||
                  0
                ).toFixed(1)
              ),

            fiveStarDeliveries:
              summary.fiveStarDeliveries,
          },
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * POST /api/order-reviews/:orderId
 *
 * Creates one review for a delivered
 * order owned by the current account.
 */
router.post(
  "/:orderId",
  async (req, res, next) => {
    try {
      const orderRatingResult =
        validateRating(
          req.body.orderRating,
          "Order rating"
        );

      if (
        !orderRatingResult.valid
      ) {
        return res.status(400).json({
          success: false,
          message:
            orderRatingResult.message,
        });
      }

      const deliveryRatingResult =
        validateRating(
          req.body.deliveryRating,
          "Delivery rating"
        );

      if (
        !deliveryRatingResult.valid
      ) {
        return res.status(400).json({
          success: false,
          message:
            deliveryRatingResult.message,
        });
      }

      const comment = cleanText(
        req.body.comment
      );

      if (comment.length > 500) {
        return res.status(400).json({
          success: false,
          message:
            "Review comments cannot exceed 500 characters.",
        });
      }

      const order =
        await Order.findOne({
          _id: req.params.orderId,
          user: req.user._id,
        }).populate(
          "deliveryPartner",
          "fullName email phone role active"
        );

      if (!order) {
        return res.status(404).json({
          success: false,
          message:
            "Order not found.",
        });
      }

      if (
        order.orderStatus !==
          "delivered" ||
        order.deliveryStatus !==
          "delivered"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "You can review an order only after it has been delivered.",
        });
      }

      if (!order.deliveryPartner) {
        return res.status(400).json({
          success: false,
          message:
            "This order does not have a delivery partner to review.",
        });
      }

      const existingReview =
        await OrderReview.exists({
          order: order._id,
        });

      if (existingReview) {
        return res.status(409).json({
          success: false,
          message:
            "A review has already been submitted for this order.",
        });
      }

      const deliveryPartner =
        order.deliveryPartner;

      const partnerId =
        deliveryPartner._id ||
        deliveryPartner;

      const review =
        await OrderReview.create({
          order: order._id,

          orderNumber:
            order.orderNumber,

          user: req.user._id,

          customerSnapshot: {
            fullName:
              req.user.fullName,

            email:
              req.user.email,

            phone:
              req.user.phone,
          },

          deliveryPartner:
            partnerId,

          deliveryPartnerSnapshot: {
            fullName:
              deliveryPartner.fullName ||
              order
                .deliveryPartnerSnapshot
                ?.fullName ||
              "Delivery partner",

            email:
              deliveryPartner.email ||
              order
                .deliveryPartnerSnapshot
                ?.email ||
              "",

            phone:
              deliveryPartner.phone ||
              order
                .deliveryPartnerSnapshot
                ?.phone ||
              "",
          },

          orderRating:
            orderRatingResult.value,

          deliveryRating:
            deliveryRatingResult.value,

          comment,

          submittedAt:
            new Date(),
        });

      const populatedReview =
        await getPopulatedReview(
          review._id
        );

      return res.status(201).json({
        success: true,

        message:
          "Thank you. Your review was submitted successfully.",

        data: {
          review:
            populatedReview,
        },
      });
    } catch (error) {
      if (
        error.name === "CastError"
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Order not found.",
        });
      }

      if (
        error.code === 11000
      ) {
        return res.status(409).json({
          success: false,
          message:
            "A review has already been submitted for this order.",
        });
      }

      return next(error);
    }
  }
);

module.exports = router;