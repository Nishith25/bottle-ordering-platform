const express =
  require("express");

const {
  protect,
} = require(
  "../middleware/auth"
);

const WebPushSubscription =
  require(
    "../models/WebPushSubscription"
  );

const {
  getWebPushPublicKey,
  registerWebPushSubscription,
  unregisterWebPushSubscription,
  unregisterAllWebPushSubscriptions,
  sendWebPushToUser,
} = require(
  "../services/webPushService"
);

const router =
  express.Router();

function getAuthenticatedUserId(
  req
) {
  return (
    req.user?._id ||
    req.user?.id
  );
}

/**
 * GET /api/web-push/public-key
 *
 * The VAPID public key is safe
 * to expose to the browser.
 */
router.get(
  "/public-key",

  (
    req,
    res,
    next
  ) => {
    try {
      return res
        .status(200)
        .json({
          success: true,

          data: {
            publicKey:
              getWebPushPublicKey(),
          },
        });
    } catch (error) {
      return next(error);
    }
  }
);

router.use(protect);

/**
 * GET /api/web-push/mine
 */
router.get(
  "/mine",

  async (
    req,
    res,
    next
  ) => {
    try {
      const userId =
        getAuthenticatedUserId(
          req
        );

      const subscriptions =
        await WebPushSubscription
          .find({
            user:
              userId,
          })
          .sort({
            active: -1,

            updatedAt: -1,
          })
          .select(
            [
              "endpoint",
              "platform",
              "deviceName",
              "active",
              "lastSeenAt",
              "lastSentAt",
              "lastSuccessfulAt",
              "failureCount",
              "lastErrorCode",
              "disabledAt",
              "createdAt",
              "updatedAt",
            ].join(" ")
          )
          .lean();

      return res
        .status(200)
        .json({
          success: true,

          data: {
            subscriptions,
          },
        });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * POST /api/web-push/register
 */
router.post(
  "/register",

  async (
    req,
    res,
    next
  ) => {
    try {
      const userId =
        getAuthenticatedUserId(
          req
        );

      const subscription =
        await registerWebPushSubscription(
          {
            userId,

            subscription:
              req.body
                .subscription,

            platform:
              req.body
                .platform,

            deviceName:
              req.body
                .deviceName,

            userAgent:
              req.body
                .userAgent ||
              req.headers[
                "user-agent"
              ] ||
              "",
          }
        );

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Web Push notifications were enabled for this browser app.",

          data: {
            subscription: {
              _id:
                subscription._id,

              endpoint:
                subscription.endpoint,

              platform:
                subscription.platform,

              deviceName:
                subscription.deviceName,

              active:
                subscription.active,

              lastSeenAt:
                subscription.lastSeenAt,
            },
          },
        });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * DELETE /api/web-push/unregister
 */
router.delete(
  "/unregister",

  async (
    req,
    res,
    next
  ) => {
    try {
      const userId =
        getAuthenticatedUserId(
          req
        );

      const subscription =
        await unregisterWebPushSubscription(
          {
            userId,

            endpoint:
              req.body
                .endpoint,
          }
        );

      return res
        .status(200)
        .json({
          success: true,

          message:
            subscription
              ? "Web Push notifications were disabled for this browser app."
              : "No Web Push subscription was found for this browser app.",

          data: {
            disabled:
              Boolean(
                subscription
              ),
          },
        });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * DELETE /api/web-push/unregister-all
 */
router.delete(
  "/unregister-all",

  async (
    req,
    res,
    next
  ) => {
    try {
      const userId =
        getAuthenticatedUserId(
          req
        );

      const result =
        await unregisterAllWebPushSubscriptions(
          {
            userId,
          }
        );

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Web Push notifications were disabled on all registered browser apps.",

          data:
            result,
        });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * POST /api/web-push/test
 */
router.post(
  "/test",

  async (
    req,
    res,
    next
  ) => {
    try {
      const userId =
        getAuthenticatedUserId(
          req
        );

      const result =
        await sendWebPushToUser({
          userId,

          title:
            req.body.title ||
            "SipBite Web Push is enabled",

          body:
            req.body.body ||
            "Your Home Screen app can now receive order and subscription updates.",

          data: {
            route:
              "/notifications",

            type:
              "web_push_test",

            ...(req.body.data &&
            typeof req.body
              .data ===
              "object" &&
            !Array.isArray(
              req.body.data
            )
              ? req.body.data
              : {}),
          },

          dedupeKey:
            req.body
              .dedupeKey ||
            `manual-web-test:${Date.now()}`,

          urgency:
            "high",
        });

      return res
        .status(200)
        .json({
          success:
            result.success,

          message:
            result.status ===
            "no_subscriptions"
              ? "No active Web Push subscription is registered for this account."
              : result.status ===
                  "not_configured"
                ? "Web Push has not been configured on the backend."
                : result.success
                  ? "Test Web Push notification was submitted."
                  : "The test Web Push notification could not be delivered.",

          data: {
            result,
          },
        });
    } catch (error) {
      return next(error);
    }
  }
);

module.exports =
  router;