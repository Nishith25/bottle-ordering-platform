const {
  sendPushToUser:
    sendNativePushToUser,
} = require(
  "./pushNotificationService"
);

const {
  sendWebPushToUser,
} = require(
  "./webPushService"
);

function cleanError(error) {
  return error instanceof Error
    ? error.message
    : String(
        error ||
          "Unknown push notification error."
      );
}

function toCount(value) {
  const parsedValue =
    Number(value);

  return Number.isFinite(
    parsedValue
  )
    ? Math.max(
        0,
        parsedValue
      )
    : 0;
}

function isNativeDelivered(
  result
) {
  if (
    !result ||
    result.duplicate
  ) {
    return false;
  }

  if (
    toCount(
      result.acceptedCount
    ) > 0
  ) {
    return true;
  }

  return (
    result.success ===
      true &&
    [
      "queued",
      "sent",
      "partial",
    ].includes(
      result.status
    )
  );
}

function isWebDelivered(
  result
) {
  if (!result) {
    return false;
  }

  if (
    toCount(
      result.deliveredCount
    ) > 0
  ) {
    return true;
  }

  return (
    result.success ===
      true &&
    [
      "sent",
      "partial",
    ].includes(
      result.status
    )
  );
}

function hasChannelFailure(
  result
) {
  return Boolean(
    result &&
      [
        "failed",
        "partial",
        "not_configured",
      ].includes(
        result.status
      )
  );
}

/**
 * Sends the same notification through:
 *
 * 1. Expo Push Service for native Android/iOS.
 * 2. Standards-based Web Push for installed PWAs.
 *
 * The existing native push log is used as the
 * shared dedupe guard for both channels.
 */
async function sendPushToUser(
  input
) {
  let nativePush =
    null;

  let webPush =
    null;

  let nativeError =
    null;

  let webError =
    null;

  try {
    nativePush =
      await sendNativePushToUser(
        input
      );
  } catch (error) {
    nativeError =
      error;
  }

  /*
   * When the native push service says this
   * dedupe key was already handled, Web Push
   * must also be skipped to prevent duplicates.
   */
  if (
    !nativePush?.duplicate
  ) {
    try {
      webPush =
        await sendWebPushToUser({
          userId:
            input.userId,

          title:
            input.title,

          body:
            input.body,

          data:
            input.data ||
            {},

          dedupeKey:
            input.dedupeKey,

          ttl:
            input.ttl,

          urgency:
            input.priority ===
            "normal"
              ? "normal"
              : "high",
        });
    } catch (error) {
      webError =
        error;
    }
  }

  /*
   * Only throw when both delivery channels
   * failed with operational errors.
   *
   * When one channel succeeds, return a
   * partial result instead.
   */
  if (
    nativeError &&
    webError
  ) {
    const combinedError =
      new Error(
        `Native push failed: ${cleanError(
          nativeError
        )}. Web Push failed: ${cleanError(
          webError
        )}.`
      );

    combinedError.nativeError =
      nativeError;

    combinedError.webError =
      webError;

    throw combinedError;
  }

  const duplicate =
    Boolean(
      nativePush?.duplicate
    );

  const attemptedTokenCount =
    toCount(
      nativePush
        ?.attemptedTokenCount
    );

  const acceptedCount =
    toCount(
      nativePush
        ?.acceptedCount
    );

  const nativeFailedCount =
    toCount(
      nativePush
        ?.failedCount
    );

  const attemptedSubscriptionCount =
    toCount(
      webPush
        ?.attemptedSubscriptionCount
    );

  const webDeliveredCount =
    toCount(
      webPush
        ?.deliveredCount
    );

  const webFailedCount =
    toCount(
      webPush
        ?.failedCount
    );

  const attemptedDeviceCount =
    attemptedTokenCount +
    attemptedSubscriptionCount;

  const deliveredCount =
    acceptedCount +
    webDeliveredCount;

  const failedCount =
    nativeFailedCount +
    webFailedCount;

  const nativeDelivered =
    isNativeDelivered(
      nativePush
    );

  const webDelivered =
    isWebDelivered(
      webPush
    );

  const success =
    duplicate ||
    nativeDelivered ||
    webDelivered;

  let status;

  if (duplicate) {
    status =
      "duplicate";
  } else if (
    success &&
    (
      nativeError ||
      webError ||
      hasChannelFailure(
        nativePush
      ) ||
      hasChannelFailure(
        webPush
      )
    )
  ) {
    status =
      "partial";
  } else if (success) {
    status =
      "sent";
  } else if (
    nativePush?.status ===
      "no_tokens" &&
    webPush?.status ===
      "not_configured"
  ) {
    status =
      "not_configured";
  } else if (
    nativePush?.status ===
      "no_tokens" &&
    webPush?.status ===
      "no_subscriptions"
  ) {
    status =
      "no_recipients";
  } else if (
    !nativeError &&
    !webError &&
    attemptedDeviceCount ===
      0
  ) {
    status =
      "no_recipients";
  } else {
    status =
      "failed";
  }

  return {
    success,
    duplicate,

    /*
     * Preserve the native notification-log ID
     * for existing callers.
     */
    logId:
      nativePush?.logId,

    status,

    /*
     * Combined channel counts.
     */
    attemptedDeviceCount,
    deliveredCount,
    failedCount,

    /*
     * Existing Expo-native fields are retained
     * at the top level for backward compatibility.
     */
    attemptedTokenCount,
    acceptedCount,
    nativeFailedCount,

    /*
     * Web Push count fields.
     */
    attemptedSubscriptionCount,
    webDeliveredCount,
    webFailedCount,

    nativePush,
    webPush,

    ...(nativeError
      ? {
          nativeError:
            cleanError(
              nativeError
            ),
        }
      : {}),

    ...(webError
      ? {
          webError:
            cleanError(
              webError
            ),
        }
      : {}),
  };
}

module.exports = {
  sendPushToUser,
};