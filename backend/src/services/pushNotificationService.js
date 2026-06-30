const {
  Expo,
} = require(
  "expo-server-sdk"
);

const PushToken = require(
  "../models/PushToken"
);

const PushNotificationLog =
  require(
    "../models/PushNotificationLog"
  );

const PUSH_RECEIPT_INTERVAL_MS =
  Math.max(
    60 * 1000,
    Number(
      process.env
        .PUSH_RECEIPT_INTERVAL_MS ||
        15 * 60 * 1000
    )
  );

const PUSH_RECEIPT_INITIAL_DELAY_MS =
  Math.max(
    10 * 1000,
    Number(
      process.env
        .PUSH_RECEIPT_INITIAL_DELAY_MS ||
        30 * 1000
    )
  );

const expo =
  new Expo({
    ...(String(
      process.env
        .EXPO_ACCESS_TOKEN ||
        ""
    ).trim()
      ? {
          accessToken:
            String(
              process.env
                .EXPO_ACCESS_TOKEN
            ).trim(),
        }
      : {}),
  });

let receiptWorkerTimer =
  null;

let receiptWorkerRunning =
  false;

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
    ].includes(platform)
  ) {
    return platform;
  }

  return "unknown";
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

function getErrorCode(value) {
  return cleanText(
    value?.details?.error ||
      value?.error ||
      value?.code
  );
}

function getErrorMessage(value) {
  return truncateText(
    value?.message ||
      value?.details
        ?.message ||
      "Push notification failed.",
    500
  );
}

function shouldDisableToken(
  errorCode
) {
  return (
    cleanText(
      errorCode
    ) ===
    "DeviceNotRegistered"
  );
}

async function disablePushToken({
  pushTokenId,
  errorCode,
  errorMessage,
}) {
  if (!pushTokenId) {
    return;
  }

  await PushToken.findByIdAndUpdate(
    pushTokenId,
    {
      $set: {
        active: false,

        disabledAt:
          new Date(),

        lastReceiptAt:
          new Date(),

        lastErrorCode:
          cleanText(
            errorCode
          ),

        lastErrorMessage:
          truncateText(
            errorMessage,
            500
          ),
      },

      $inc: {
        failureCount: 1,
      },
    }
  );
}

async function markTokenFailure({
  pushTokenId,
  errorCode,
  errorMessage,
  disable = false,
}) {
  if (!pushTokenId) {
    return;
  }

  await PushToken.findByIdAndUpdate(
    pushTokenId,
    {
      $set: {
        ...(disable
          ? {
              active: false,

              disabledAt:
                new Date(),
            }
          : {}),

        lastErrorCode:
          cleanText(
            errorCode
          ),

        lastErrorMessage:
          truncateText(
            errorMessage,
            500
          ),
      },

      $inc: {
        failureCount: 1,
      },
    }
  );
}

async function registerPushToken({
  userId,
  token,
  platform,
  deviceId,
  deviceName,
  appVersion,
  projectId,
}) {
  const cleanToken =
    cleanText(token);

  if (
    !Expo.isExpoPushToken(
      cleanToken
    )
  ) {
    const error =
      new Error(
        "A valid Expo push token is required."
      );

    error.statusCode = 400;

    throw error;
  }

  const now =
    new Date();

  const pushToken =
    await PushToken.findOneAndUpdate(
      {
        token:
          cleanToken,
      },

      {
        $set: {
          user:
            userId,

          platform:
            normalizePlatform(
              platform
            ),

          deviceId:
            truncateText(
              deviceId,
              200
            ),

          deviceName:
            truncateText(
              deviceName,
              200
            ),

          appVersion:
            truncateText(
              appVersion,
              100
            ),

          projectId:
            truncateText(
              projectId,
              200
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

  return pushToken;
}

async function unregisterPushToken({
  userId,
  token,
}) {
  const cleanToken =
    cleanText(token);

  if (!cleanToken) {
    const error =
      new Error(
        "Push token is required."
      );

    error.statusCode = 400;

    throw error;
  }

  const result =
    await PushToken.findOneAndUpdate(
      {
        user:
          userId,

        token:
          cleanToken,
      },

      {
        $set: {
          active: false,

          disabledAt:
            new Date(),
        },
      },

      {
        new: true,
      }
    );

  return result;
}

async function unregisterAllPushTokens({
  userId,
}) {
  const result =
    await PushToken.updateMany(
      {
        user:
          userId,

        active: true,
      },

      {
        $set: {
          active: false,

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

async function createPushLog({
  userId,
  title,
  body,
  data,
  dedupeKey,
}) {
  const normalizedDedupeKey =
    cleanText(
      dedupeKey
    )
      ? `${String(
          userId
        )}:${cleanText(
          dedupeKey
        )}`
      : undefined;

  try {
    const payload = {
      user:
        userId,

      title:
        truncateText(
          title,
          150
        ),

      body:
        truncateText(
          body,
          1000
        ),

      data:
        normalizeData(
          data
        ),

      status:
        "queued",
    };

    if (
      normalizedDedupeKey
    ) {
      payload.dedupeKey =
        normalizedDedupeKey;
    }

    const log =
      await PushNotificationLog.create(
        payload
      );

    return {
      duplicate: false,

      log,
    };
  } catch (error) {
    if (
      error.code ===
        11000 &&
      normalizedDedupeKey
    ) {
      const existingLog =
        await PushNotificationLog.findOne(
          {
            dedupeKey:
              normalizedDedupeKey,
          }
        );

      if (
        existingLog
      ) {
        return {
          duplicate: true,

          log:
            existingLog,
        };
      }
    }

    throw error;
  }
}

function buildExpoMessage({
  token,
  title,
  body,
  data,
  sound,
  priority,
  channelId,
  badge,
  ttl,
}) {
  return {
    to: token,

    title:
      truncateText(
        title,
        150
      ),

    body:
      truncateText(
        body,
        1000
      ),

    data:
      normalizeData(
        data
      ),

    sound:
      sound || "default",

    priority:
      priority || "high",

    ...(channelId
      ? {
          channelId,
        }
      : {}),

    ...(Number.isInteger(
      badge
    )
      ? {
          badge:
            Math.max(
              0,
              badge
            ),
        }
      : {}),

    ...(Number.isFinite(
      Number(ttl)
    )
      ? {
          ttl:
            Math.max(
              0,
              Number(ttl)
            ),
        }
      : {}),
  };
}

async function sendPushToUser({
  userId,
  title,
  body,
  data = {},
  dedupeKey,
  sound = "default",
  priority = "high",
  channelId = "default",
  badge,
  ttl,
}) {
  if (!userId) {
    throw new Error(
      "Push notification user ID is required."
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
      "Push notification title and body are required."
    );
  }

  const {
    duplicate,
    log,
  } =
    await createPushLog({
      userId,

      title:
        cleanTitle,

      body:
        cleanBody,

      data,

      dedupeKey,
    });

  if (duplicate) {
    return {
      success: true,

      duplicate: true,

      logId:
        String(log._id),

      status:
        log.status,

      attemptedTokenCount:
        log.attemptedTokenCount,

      acceptedCount:
        log.acceptedCount,

      failedCount:
        log.failedCount,
    };
  }

  const tokenDocuments =
    await PushToken.find({
      user:
        userId,

      active: true,
    }).sort({
      updatedAt: -1,
    });

  const validTokens = [];

  for (
    const tokenDocument of
    tokenDocuments
  ) {
    if (
      Expo.isExpoPushToken(
        tokenDocument.token
      )
    ) {
      validTokens.push(
        tokenDocument
      );

      continue;
    }

    tokenDocument.active =
      false;

    tokenDocument.disabledAt =
      new Date();

    tokenDocument.lastErrorCode =
      "InvalidExpoPushToken";

    tokenDocument.lastErrorMessage =
      "The stored push token is not valid.";

    tokenDocument.failureCount =
      Number(
        tokenDocument.failureCount ||
          0
      ) + 1;

    await tokenDocument.save();
  }

  if (
    validTokens.length ===
    0
  ) {
    log.status =
      "no_tokens";

    log.attemptedTokenCount =
      0;

    log.processedAt =
      new Date();

    await log.save();

    return {
      success: true,

      duplicate: false,

      logId:
        String(log._id),

      status:
        "no_tokens",

      attemptedTokenCount:
        0,

      acceptedCount:
        0,

      failedCount:
        0,
    };
  }

  const tokenByValue =
    new Map(
      validTokens.map(
        (
          tokenDocument
        ) => [
          tokenDocument.token,

          tokenDocument,
        ]
      )
    );

  const messages =
    validTokens.map(
      (
        tokenDocument
      ) =>
        buildExpoMessage({
          token:
            tokenDocument.token,

          title:
            cleanTitle,

          body:
            cleanBody,

          data,

          sound,

          priority,

          channelId,

          badge,

          ttl,
        })
    );

  const messageChunks =
    expo.chunkPushNotifications(
      messages
    );

  const deliveries = [];

  let acceptedCount = 0;
  let failedCount = 0;

  try {
    for (
      const messageChunk of
      messageChunks
    ) {
      const tickets =
        await expo.sendPushNotificationsAsync(
          messageChunk
        );

      for (
        let index = 0;
        index <
        tickets.length;
        index += 1
      ) {
        const ticket =
          tickets[index];

        const message =
          messageChunk[index];

        const tokenDocument =
          tokenByValue.get(
            message.to
          );

        const now =
          new Date();

        if (
          tokenDocument
        ) {
          tokenDocument.lastSentAt =
            now;
        }

        if (
          ticket.status ===
          "ok"
        ) {
          acceptedCount += 1;

          deliveries.push({
            pushToken:
              tokenDocument
                ?._id ||
              null,

            tokenSnapshot:
              message.to,

            ticketId:
              cleanText(
                ticket.id
              ),

            ticketStatus:
              "ok",

            receiptStatus:
              ticket.id
                ? "pending"
                : "not_applicable",
          });

          if (
            tokenDocument
          ) {
            tokenDocument.lastErrorCode =
              "";

            tokenDocument.lastErrorMessage =
              "";

            await tokenDocument.save();
          }

          continue;
        }

        failedCount += 1;

        const errorCode =
          getErrorCode(
            ticket
          );

        const errorMessage =
          getErrorMessage(
            ticket
          );

        deliveries.push({
          pushToken:
            tokenDocument
              ?._id ||
            null,

          tokenSnapshot:
            message.to,

          ticketStatus:
            "error",

          receiptStatus:
            "not_applicable",

          errorCode,

          errorMessage,
        });

        if (
          tokenDocument
        ) {
          await markTokenFailure({
            pushTokenId:
              tokenDocument._id,

            errorCode,

            errorMessage,

            disable:
              shouldDisableToken(
                errorCode
              ),
          });
        }
      }
    }

    log.deliveries =
      deliveries;

    log.attemptedTokenCount =
      validTokens.length;

    log.acceptedCount =
      acceptedCount;

    log.failedCount =
      failedCount;

    if (
      acceptedCount > 0 &&
      failedCount === 0
    ) {
      log.status =
        "sent";
    } else if (
      acceptedCount > 0
    ) {
      log.status =
        "partial";
    } else {
      log.status =
        "failed";
    }

    log.processedAt =
      new Date();

    await log.save();

    return {
      success:
        acceptedCount > 0,

      duplicate: false,

      logId:
        String(log._id),

      status:
        log.status,

      attemptedTokenCount:
        validTokens.length,

      acceptedCount,

      failedCount,
    };
  } catch (error) {
    log.status =
      "failed";

    log.attemptedTokenCount =
      validTokens.length;

    log.acceptedCount =
      acceptedCount;

    log.failedCount =
      Math.max(
        failedCount,
        validTokens.length -
          acceptedCount
      );

    log.deliveries =
      deliveries;

    log.errorMessage =
      truncateText(
        error.message ||
          "Unable to send push notification.",
        500
      );

    log.processedAt =
      new Date();

    await log.save();

    throw error;
  }
}

async function sendPushToUsers({
  userIds,
  title,
  body,
  data = {},
  dedupeKey,
  sound,
  priority,
  channelId,
  badge,
  ttl,
}) {
  const uniqueUserIds = [
    ...new Set(
      (
        Array.isArray(
          userIds
        )
          ? userIds
          : []
      )
        .map((userId) =>
          cleanText(
            userId
          )
        )
        .filter(Boolean)
    ),
  ];

  const results = [];

  for (
    const userId of
    uniqueUserIds
  ) {
    try {
      const result =
        await sendPushToUser({
          userId,

          title,

          body,

          data,

          dedupeKey,

          sound,

          priority,

          channelId,

          badge,

          ttl,
        });

      results.push({
        userId,

        ...result,
      });
    } catch (error) {
      results.push({
        userId,

        success: false,

        error:
          error.message ||
          "Unable to send push notification.",
      });
    }
  }

  return results;
}

async function processPendingPushReceipts() {
  if (
    receiptWorkerRunning
  ) {
    return {
      skipped: true,
    };
  }

  receiptWorkerRunning =
    true;

  try {
    const logs =
      await PushNotificationLog.find({
        deliveries: {
          $elemMatch: {
            ticketId: {
              $ne: "",
            },

            receiptStatus:
              "pending",
          },
        },
      })
        .sort({
          createdAt: 1,
        })
        .limit(100);

    if (
      logs.length === 0
    ) {
      return {
        checked: 0,
      };
    }

    const ticketIds = [];

    for (
      const log of logs
    ) {
      for (
        const delivery of
        log.deliveries
      ) {
        if (
          delivery.ticketId &&
          delivery.receiptStatus ===
            "pending"
        ) {
          ticketIds.push(
            delivery.ticketId
          );
        }

        if (
          ticketIds.length >=
          1000
        ) {
          break;
        }
      }

      if (
        ticketIds.length >=
        1000
      ) {
        break;
      }
    }

    if (
      ticketIds.length ===
      0
    ) {
      return {
        checked: 0,
      };
    }

    const receiptIdChunks =
      expo.chunkPushNotificationReceiptIds(
        ticketIds
      );

    const receiptsById =
      {};

    for (
      const receiptIdChunk of
      receiptIdChunks
    ) {
      const receipts =
        await expo.getPushNotificationReceiptsAsync(
          receiptIdChunk
        );

      Object.assign(
        receiptsById,
        receipts
      );
    }

    let checkedCount = 0;

    for (
      const log of logs
    ) {
      let changed =
        false;

      for (
        const delivery of
        log.deliveries
      ) {
        if (
          !delivery.ticketId ||
          delivery.receiptStatus !==
            "pending"
        ) {
          continue;
        }

        const receipt =
          receiptsById[
            delivery.ticketId
          ];

        if (!receipt) {
          continue;
        }

        checkedCount += 1;

        changed = true;

        delivery.receiptCheckedAt =
          new Date();

        if (
          receipt.status ===
          "ok"
        ) {
          delivery.receiptStatus =
            "ok";

          delivery.errorCode =
            "";

          delivery.errorMessage =
            "";

          if (
            delivery.pushToken
          ) {
            await PushToken.findByIdAndUpdate(
              delivery.pushToken,
              {
                $set: {
                  lastReceiptAt:
                    new Date(),

                  lastSuccessfulAt:
                    new Date(),

                  lastErrorCode:
                    "",

                  lastErrorMessage:
                    "",
                },
              }
            );
          }

          continue;
        }

        const errorCode =
          getErrorCode(
            receipt
          );

        const errorMessage =
          getErrorMessage(
            receipt
          );

        delivery.receiptStatus =
          "error";

        delivery.errorCode =
          errorCode;

        delivery.errorMessage =
          errorMessage;

        if (
          delivery.pushToken
        ) {
          if (
            shouldDisableToken(
              errorCode
            )
          ) {
            await disablePushToken({
              pushTokenId:
                delivery.pushToken,

              errorCode,

              errorMessage,
            });
          } else {
            await markTokenFailure({
              pushTokenId:
                delivery.pushToken,

              errorCode,

              errorMessage,

              disable: false,
            });
          }
        }
      }

      if (changed) {
        const deliveryErrors =
          log.deliveries.filter(
            (delivery) =>
              delivery.receiptStatus ===
                "error" ||
              delivery.ticketStatus ===
                "error"
          ).length;

        const deliverySuccesses =
          log.deliveries.filter(
            (delivery) =>
              delivery.receiptStatus ===
                "ok"
          ).length;

        if (
          deliverySuccesses > 0 &&
          deliveryErrors > 0
        ) {
          log.status =
            "partial";
        } else if (
          deliveryErrors > 0 &&
          deliverySuccesses === 0
        ) {
          log.status =
            "failed";
        } else if (
          deliverySuccesses > 0
        ) {
          log.status =
            "sent";
        }

        await log.save();
      }
    }

    return {
      checked:
        checkedCount,
    };
  } finally {
    receiptWorkerRunning =
      false;
  }
}

function startPushReceiptWorker() {
  if (
    process.env.NODE_ENV ===
      "test" ||
    receiptWorkerTimer
  ) {
    return;
  }

  const runWorker =
    async () => {
      try {
        const result =
          await processPendingPushReceipts();

        if (
          Number(
            result.checked ||
              0
          ) > 0
        ) {
          console.log(
            `Push receipt worker checked ${result.checked} receipt(s).`
          );
        }
      } catch (error) {
        console.error(
          "Push receipt worker error:",
          error.message
        );
      }
    };

  const initialTimer =
    setTimeout(
      runWorker,
      PUSH_RECEIPT_INITIAL_DELAY_MS
    );

  if (
    typeof initialTimer.unref ===
    "function"
  ) {
    initialTimer.unref();
  }

  receiptWorkerTimer =
    setInterval(
      runWorker,
      PUSH_RECEIPT_INTERVAL_MS
    );

  if (
    typeof receiptWorkerTimer.unref ===
    "function"
  ) {
    receiptWorkerTimer.unref();
  }

  console.log(
    `Push receipt worker started. Interval: ${PUSH_RECEIPT_INTERVAL_MS} ms`
  );
}

module.exports = {
  registerPushToken,

  unregisterPushToken,

  unregisterAllPushTokens,

  sendPushToUser,

  sendPushToUsers,

  processPendingPushReceipts,

  startPushReceiptWorker,
};