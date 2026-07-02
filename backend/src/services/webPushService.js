const webPush = require(
  "web-push"
);

const WebPushSubscription =
  require(
    "../models/WebPushSubscription"
  );

let configuredSignature = "";

function cleanText(value) {
  return String(
    value ?? ""
  ).trim();
}

function truncateText(
  value,
  maximumLength
) {
  const cleanValue =
    cleanText(value);

  if (
    cleanValue.length <=
    maximumLength
  ) {
    return cleanValue;
  }

  return `${cleanValue.slice(
    0,
    Math.max(
      0,
      maximumLength - 1
    )
  )}…`;
}

function normalizePlatform(
  value
) {
  const platform =
    cleanText(
      value
    ).toLowerCase();

  if (
    [
      "ios",
      "android",
      "macos",
      "windows",
      "linux",
      "other",
    ].includes(platform)
  ) {
    return platform;
  }

  return "other";
}

function normalizeData(value) {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

  try {
    return JSON.parse(
      JSON.stringify(value)
    );
  } catch {
    return {};
  }
}

function getVapidConfiguration() {
  return {
    subject:
      cleanText(
        process.env
          .WEB_PUSH_VAPID_SUBJECT
      ),

    publicKey:
      cleanText(
        process.env
          .WEB_PUSH_VAPID_PUBLIC_KEY
      ),

    privateKey:
      cleanText(
        process.env
          .WEB_PUSH_VAPID_PRIVATE_KEY
      ),
  };
}

function isValidVapidSubject(
  subject
) {
  return (
    subject.startsWith(
      "mailto:"
    ) ||
    subject.startsWith(
      "https://"
    )
  );
}

function ensureWebPushConfigured() {
  const configuration =
    getVapidConfiguration();

  if (
    !configuration.subject ||
    !configuration.publicKey ||
    !configuration.privateKey
  ) {
    const error =
      new Error(
        "Web Push VAPID configuration is missing."
      );

    error.statusCode = 503;

    error.code =
      "WEB_PUSH_NOT_CONFIGURED";

    throw error;
  }

  if (
    !isValidVapidSubject(
      configuration.subject
    )
  ) {
    const error =
      new Error(
        "WEB_PUSH_VAPID_SUBJECT must start with mailto: or https://."
      );

    error.statusCode = 500;

    error.code =
      "INVALID_VAPID_SUBJECT";

    throw error;
  }

  const signature = [
    configuration.subject,
    configuration.publicKey,
    configuration.privateKey,
  ].join("|");

  if (
    configuredSignature !==
    signature
  ) {
    webPush.setVapidDetails(
      configuration.subject,

      configuration.publicKey,

      configuration.privateKey
    );

    configuredSignature =
      signature;
  }

  return configuration;
}

function getWebPushPublicKey() {
  const configuration =
    ensureWebPushConfigured();

  return configuration.publicKey;
}

function normalizeSubscriptionPayload(
  value
) {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(value)
  ) {
    const error =
      new Error(
        "A valid browser push subscription is required."
      );

    error.statusCode = 400;

    throw error;
  }

  const endpoint =
    cleanText(
      value.endpoint
    );

  const p256dh =
    cleanText(
      value.keys?.p256dh
    );

  const auth =
    cleanText(
      value.keys?.auth
    );

  if (
    !endpoint.startsWith(
      "https://"
    ) ||
    !p256dh ||
    !auth
  ) {
    const error =
      new Error(
        "The browser push subscription is incomplete or invalid."
      );

    error.statusCode = 400;

    throw error;
  }

  let expirationTime =
    null;

  if (
    value.expirationTime !==
      null &&
    value.expirationTime !==
      undefined
  ) {
    const parsedExpiration =
      Number(
        value.expirationTime
      );

    if (
      Number.isFinite(
        parsedExpiration
      )
    ) {
      const expirationDate =
        new Date(
          parsedExpiration
        );

      if (
        !Number.isNaN(
          expirationDate.getTime()
        )
      ) {
        expirationTime =
          expirationDate;
      }
    }
  }

  return {
    endpoint,

    expirationTime,

    keys: {
      p256dh,

      auth,
    },
  };
}

function toWebPushSubscription(
  subscriptionDocument
) {
  return {
    endpoint:
      subscriptionDocument
        .endpoint,

    expirationTime:
      subscriptionDocument
        .expirationTime
        ? new Date(
            subscriptionDocument
              .expirationTime
          ).getTime()
        : null,

    keys: {
      p256dh:
        subscriptionDocument
          .keys.p256dh,

      auth:
        subscriptionDocument
          .keys.auth,
    },
  };
}

function getWebPushErrorCode(
  error
) {
  return cleanText(
    error?.code ||
      error?.statusCode ||
      error?.body?.code ||
      "WEB_PUSH_ERROR"
  );
}

function getWebPushErrorMessage(
  error
) {
  return truncateText(
    error?.body ||
      error?.message ||
      "Unable to deliver the Web Push notification.",

    500
  );
}

function shouldDisableSubscription(
  error
) {
  return [
    404,
    410,
  ].includes(
    Number(
      error?.statusCode
    )
  );
}

async function registerWebPushSubscription({
  userId,
  subscription,
  platform,
  deviceName,
  userAgent,
}) {
  ensureWebPushConfigured();

  const normalizedSubscription =
    normalizeSubscriptionPayload(
      subscription
    );

  const now =
    new Date();

  return WebPushSubscription
    .findOneAndUpdate(
      {
        endpoint:
          normalizedSubscription
            .endpoint,
      },

      {
        $set: {
          user:
            userId,

          endpoint:
            normalizedSubscription
              .endpoint,

          expirationTime:
            normalizedSubscription
              .expirationTime,

          keys:
            normalizedSubscription
              .keys,

          platform:
            normalizePlatform(
              platform
            ),

          deviceName:
            truncateText(
              deviceName,
              200
            ),

          userAgent:
            truncateText(
              userAgent,
              500
            ),

          active: true,

          lastSeenAt:
            now,

          disabledAt:
            null,

          lastErrorCode:
            "",

          lastErrorMessage:
            "",
        },

        $setOnInsert: {
          failureCount: 0,
        },
      },

      {
        new: true,

        upsert: true,

        setDefaultsOnInsert:
          true,
      }
    );
}

async function unregisterWebPushSubscription({
  userId,
  endpoint,
}) {
  const cleanEndpoint =
    cleanText(
      endpoint
    );

  if (!cleanEndpoint) {
    const error =
      new Error(
        "The Web Push subscription endpoint is required."
      );

    error.statusCode = 400;

    throw error;
  }

  return WebPushSubscription
    .findOneAndUpdate(
      {
        user:
          userId,

        endpoint:
          cleanEndpoint,
      },

      {
        $set: {
          active:
            false,

          disabledAt:
            new Date(),
        },
      },

      {
        new: true,
      }
    );
}

async function unregisterAllWebPushSubscriptions({
  userId,
}) {
  const result =
    await WebPushSubscription
      .updateMany(
        {
          user:
            userId,

          active:
            true,
        },

        {
          $set: {
            active:
              false,

            disabledAt:
              new Date(),
          },
        }
      );

  return {
    disabledCount:
      Number(
        result.modifiedCount ||
          0
      ),
  };
}

async function sendWebPushToUser({
  userId,
  title,
  body,
  data = {},
  dedupeKey,
  ttl = 60 * 60,
  urgency = "high",
}) {
  if (!userId) {
    throw new Error(
      "Web Push notification user ID is required."
    );
  }

  const cleanTitle =
    cleanText(title);

  const cleanBody =
    cleanText(body);

  if (
    !cleanTitle ||
    !cleanBody
  ) {
    throw new Error(
      "Web Push notification title and body are required."
    );
  }

  try {
    ensureWebPushConfigured();
  } catch (error) {
    if (
      error.code ===
      "WEB_PUSH_NOT_CONFIGURED"
    ) {
      return {
        success: false,

        status:
          "not_configured",

        attemptedSubscriptionCount:
          0,

        deliveredCount:
          0,

        failedCount:
          0,
      };
    }

    throw error;
  }

  const subscriptions =
    await WebPushSubscription
      .find({
        user:
          userId,

        active:
          true,
      })
      .sort({
        updatedAt: -1,
      });

  if (
    subscriptions.length ===
    0
  ) {
    return {
      success: true,

      status:
        "no_subscriptions",

      attemptedSubscriptionCount:
        0,

      deliveredCount:
        0,

      failedCount:
        0,
    };
  }

  const normalizedData =
    normalizeData(data);

  const payload =
    JSON.stringify({
      title:
        truncateText(
          cleanTitle,
          150
        ),

      body:
        truncateText(
          cleanBody,
          1000
        ),

      icon:
        "/pwa-192.png",

      badge:
        "/pwa-192.png",

      tag:
        cleanText(
          normalizedData
            .notificationId
        ) ||
        cleanText(
          dedupeKey
        ) ||
        undefined,

      data:
        normalizedData,
    });

  let deliveredCount = 0;

  let failedCount = 0;

  const deliveries = [];

  for (
    const subscriptionDocument of
    subscriptions
  ) {
    const now =
      new Date();

    subscriptionDocument
      .lastSentAt =
      now;

    try {
      const response =
        await webPush
          .sendNotification(
            toWebPushSubscription(
              subscriptionDocument
            ),

            payload,

            {
              TTL:
                Math.max(
                  0,
                  Number(ttl) ||
                    0
                ),

              urgency:
                [
                  "very-low",
                  "low",
                  "normal",
                  "high",
                ].includes(
                  urgency
                )
                  ? urgency
                  : "high",
            }
          );

      deliveredCount += 1;

      subscriptionDocument
        .lastSuccessfulAt =
        now;

      subscriptionDocument
        .lastErrorCode =
        "";

      subscriptionDocument
        .lastErrorMessage =
        "";

      subscriptionDocument
        .active =
        true;

      subscriptionDocument
        .disabledAt =
        null;

      await subscriptionDocument
        .save();

      deliveries.push({
        subscriptionId:
          String(
            subscriptionDocument
              ._id
          ),

        endpoint:
          subscriptionDocument
            .endpoint,

        status:
          "sent",

        statusCode:
          Number(
            response
              ?.statusCode ||
              0
          ),
      });
    } catch (error) {
      failedCount += 1;

      const errorCode =
        getWebPushErrorCode(
          error
        );

      const errorMessage =
        getWebPushErrorMessage(
          error
        );

      const disable =
        shouldDisableSubscription(
          error
        );

      subscriptionDocument
        .failureCount =
        Number(
          subscriptionDocument
            .failureCount ||
            0
        ) + 1;

      subscriptionDocument
        .lastErrorCode =
        errorCode;

      subscriptionDocument
        .lastErrorMessage =
        errorMessage;

      if (disable) {
        subscriptionDocument
          .active =
          false;

        subscriptionDocument
          .disabledAt =
          now;
      }

      await subscriptionDocument
        .save();

      deliveries.push({
        subscriptionId:
          String(
            subscriptionDocument
              ._id
          ),

        endpoint:
          subscriptionDocument
            .endpoint,

        status:
          "failed",

        statusCode:
          Number(
            error?.statusCode ||
              0
          ),

        errorCode,

        errorMessage,

        disabled:
          disable,
      });
    }
  }

  const status =
    deliveredCount > 0 &&
    failedCount === 0
      ? "sent"
      : deliveredCount > 0
        ? "partial"
        : "failed";

  return {
    success:
      deliveredCount > 0,

    status,

    attemptedSubscriptionCount:
      subscriptions.length,

    deliveredCount,

    failedCount,

    deliveries,
  };
}

module.exports = {
  getWebPushPublicKey,

  registerWebPushSubscription,

  unregisterWebPushSubscription,

  unregisterAllWebPushSubscriptions,

  sendWebPushToUser,
};