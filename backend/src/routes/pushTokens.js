const express =
  require("express");

const {
  protect,
} = require(
  "../middleware/auth"
);

const PushToken =
  require(
    "../models/PushToken"
  );

const {
  DEFAULT_ANDROID_CHANNEL_ID,
  registerPushToken,
  unregisterPushToken,
  unregisterAllPushTokens,
} = require(
  "../services/pushNotificationService"
);

const {
  sendPushToUser,
} = require(
  "../services/notificationDeliveryService"
);

const router =
  express.Router();

router.use(protect);

function getAuthenticatedUserId(
  req
) {
  return (
    req.user?._id ||
    req.user?.id
  );
}

function getTestPushMessage(
  result
) {
  switch (
    result?.status
  ) {
    case "duplicate":
      return "This test notification was already submitted.";

    case "no_recipients":
      return "No active native app or Home Screen PWA notification subscription is registered for this account.";

    case "not_configured":
      return "No native device is registered and Web Push VAPID configuration is missing.";

    case "partial":
      return "The test notification reached at least one registered device, but another delivery channel reported a problem.";

    case "sent":
      return "The test notification was submitted to your registered devices.";

    case "failed":
      return "The test notification could not be delivered.";

    default:
      return "The test notification request was completed.";
  }
}

/**
 * GET /api/push-tokens/mine
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

      const tokens =
        await PushToken.find({
          user:
            userId,
        })
          .sort({
            active: -1,
            updatedAt: -1,
          })
          .select(
            [
              "platform",
              "deviceId",
              "deviceName",
              "appVersion",
              "projectId",
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
            tokens,
          },
        });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * POST /api/push-tokens/register
 *
 * Body:
 * {
 *   token,
 *   platform,
 *   deviceId,
 *   deviceName,
 *   appVersion,
 *   projectId
 * }
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

      const body =
        req.body ||
        {};

      const pushToken =
        await registerPushToken({
          userId,

          token:
            body.token,

          platform:
            body.platform,

          deviceId:
            body.deviceId,

          deviceName:
            body.deviceName,

          appVersion:
            body.appVersion,

          projectId:
            body.projectId,
        });

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Push notifications were enabled for this device.",

          data: {
            pushToken: {
              _id:
                pushToken._id,

              platform:
                pushToken.platform,

              deviceId:
                pushToken.deviceId,

              deviceName:
                pushToken.deviceName,

              appVersion:
                pushToken.appVersion,

              projectId:
                pushToken.projectId,

              active:
                pushToken.active,

              lastSeenAt:
                pushToken.lastSeenAt,
            },
          },
        });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * DELETE /api/push-tokens/unregister
 *
 * Body:
 * {
 *   token
 * }
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

      const body =
        req.body ||
        {};

      const pushToken =
        await unregisterPushToken({
          userId,

          token:
            body.token,
        });

      return res
        .status(200)
        .json({
          success: true,

          message:
            pushToken
              ? "Push notifications were disabled for this device."
              : "No active push-token record was found for this device.",

          data: {
            disabled:
              Boolean(
                pushToken
              ),
          },
        });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * DELETE /api/push-tokens/unregister-all
 *
 * This route preserves its existing native-device
 * behavior. Browser subscriptions are handled by
 * the separate Web Push subscription routes.
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
        await unregisterAllPushTokens(
          {
            userId,
          }
        );

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Push notifications were disabled on all registered native devices.",

          data:
            result,
        });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * POST /api/push-tokens/test
 *
 * Sends to the authenticated user's:
 *
 * - Expo native Android/iOS devices
 * - Standards-based Web Push PWA subscriptions
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

      const body =
        req.body ||
        {};

      const requestData =
        body.data &&
        typeof body.data ===
          "object" &&
        !Array.isArray(
          body.data
        )
          ? body.data
          : {};

      const result =
        await sendPushToUser({
          userId,

          title:
            body.title ||
            "SipBite notifications enabled",

          body:
            body.body ||
            "You will now receive important order and subscription updates.",

          data: {
            route:
              "/notifications",

            type:
              "push_test",

            ...requestData,
          },

          dedupeKey:
            body.dedupeKey ||
            `manual-test:${Date.now()}`,

          channelId:
            DEFAULT_ANDROID_CHANNEL_ID,

          priority:
            "high",
        });

      return res
        .status(200)
        .json({
          success: true,

          message:
            getTestPushMessage(
              result
            ),

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