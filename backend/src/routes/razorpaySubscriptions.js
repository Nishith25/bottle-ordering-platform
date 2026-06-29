const express = require("express");

const {
  protect,
} = require("../middleware/auth");

const Subscription = require(
  "../models/Subscription"
);

const RazorpaySubscriptionMandate =
  require(
    "../models/RazorpaySubscriptionMandate"
  );

const {
  cancelRazorpayMandate,
  prepareRazorpaySubscription,
  refreshRazorpayMandate,
  verifyRazorpayCheckout,
} = require(
  "../services/razorpaySubscriptionService"
);

const router = express.Router();

async function findOwnedSubscription(
  subscriptionId,
  userId
) {
  return Subscription.findOne({
    _id:
      subscriptionId,

    user:
      userId,
  }).populate(
    "user",
    "fullName email phone"
  );
}

/*
 * Prepare Razorpay plan and subscription.
 */
router.post(
  "/:subscriptionId/razorpay/prepare",

  protect,

  async (
    req,
    res,
    next
  ) => {
    try {
      const subscription =
        await findOwnedSubscription(
          req.params
            .subscriptionId,

          req.user._id
        );

      if (!subscription) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Subscription not found.",
          });
      }

      const result =
        await prepareRazorpaySubscription(
          {
            localSubscription:
              subscription,

            user:
              subscription.user,
          }
        );

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Razorpay subscription is ready for authorisation.",

          data: result,
        });
    } catch (error) {
      return next(error);
    }
  }
);

/*
 * Verify Standard Checkout response.
 */
router.post(
  "/:subscriptionId/razorpay/verify",

  protect,

  async (
    req,
    res,
    next
  ) => {
    try {
      const {
        razorpay_payment_id:
          razorpayPaymentId,

        razorpay_subscription_id:
          razorpaySubscriptionId,

        razorpay_signature:
          razorpaySignature,
      } = req.body;

      if (
        !razorpayPaymentId ||
        !razorpaySubscriptionId ||
        !razorpaySignature
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "The Razorpay Checkout response is incomplete.",
          });
      }

      const mandate =
        await verifyRazorpayCheckout(
          {
            localSubscriptionId:
              req.params
                .subscriptionId,

            userId:
              req.user._id,

            razorpayPaymentId,

            razorpaySubscriptionId,

            razorpaySignature,
          }
        );

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Razorpay subscription authorisation was verified.",

          data: {
            mandate,
          },
        });
    } catch (error) {
      return next(error);
    }
  }
);

/*
 * Get latest locally stored mandate status.
 */
router.get(
  "/:subscriptionId/razorpay/status",

  protect,

  async (
    req,
    res,
    next
  ) => {
    try {
      const subscription =
        await findOwnedSubscription(
          req.params
            .subscriptionId,

          req.user._id
        );

      if (!subscription) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Subscription not found.",
          });
      }

      const mandate =
        await RazorpaySubscriptionMandate.findOne(
          {
            localSubscription:
              subscription._id,

            user:
              req.user._id,
          }
        )
          .sort({
            createdAt: -1,
          })
          .lean();

      return res
        .status(200)
        .json({
          success: true,

          data: {
            mandate:
              mandate ||
              null,
          },
        });
    } catch (error) {
      return next(error);
    }
  }
);

/*
 * Fetch current status directly from Razorpay.
 */
router.post(
  "/:subscriptionId/razorpay/refresh",

  protect,

  async (
    req,
    res,
    next
  ) => {
    try {
      const mandate =
        await refreshRazorpayMandate(
          {
            localSubscriptionId:
              req.params
                .subscriptionId,

            userId:
              req.user._id,
          }
        );

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Razorpay mandate status refreshed.",

          data: {
            mandate,
          },
        });
    } catch (error) {
      return next(error);
    }
  }
);

/*
 * Cancel Razorpay subscription.
 */
router.post(
  "/:subscriptionId/razorpay/cancel",

  protect,

  async (
    req,
    res,
    next
  ) => {
    try {
      const mandate =
        await cancelRazorpayMandate(
          {
            localSubscriptionId:
              req.params
                .subscriptionId,

            userId:
              req.user._id,

            cancelAtCycleEnd:
              Boolean(
                req.body
                  .cancelAtCycleEnd
              ),
          }
        );

      return res
        .status(200)
        .json({
          success: true,

          message:
            req.body
              .cancelAtCycleEnd
              ? "The Razorpay subscription will be cancelled after the current cycle."
              : "The Razorpay subscription was cancelled.",

          data: {
            mandate,
          },
        });
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = router;