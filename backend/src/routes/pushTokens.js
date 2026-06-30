const express = require("express");

const {
  protect,
} = require(
  "../middleware/auth"
);

const PushToken = require(
  "../models/PushToken"
);

const {
  registerPushToken,
  unregisterPushToken,
  unregisterAllPushTokens,
  sendPushToUser,
} = require(
  "../services/pushNotificationService"
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

      const pushToken =
        await registerPushToken({
          userId,

          token:
            req.body.token,

          platform:
            req.body.platform,

          deviceId:
            req.body.deviceId,

          deviceName:
            req.body.deviceName,

          appVersion:
            req.body.appVersion,

          projectId:
            req.body.projectId,
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

      const pushToken =
        await unregisterPushToken({
          userId,

          token:
            req.body.token,
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
            "Push notifications were disabled on all registered devices.",

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
 * Sends only to the authenticated user.
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
        await sendPushToUser({
          userId,

          title:
            req.body.title ||
            "Bottle notifications enabled",

          body:
            req.body.body ||
            "You will now receive important order and subscription updates.",

          data: {
            route:
              "/notifications",

            type:
              "push_test",

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
            `manual-test:${Date.now()}`,

          channelId:
            "default",
        });

      return res
        .status(200)
        .json({
          success: true,

          message:
            result.status ===
            "no_tokens"
              ? "No active push-enabled device is registered for this account."
              : "Test push notification was submitted.",

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