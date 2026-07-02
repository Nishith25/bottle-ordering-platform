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
          "Unknown push error."
      );
}

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
   * The existing native push log is also
   * used as the global dedupe guard.
   *
   * When the native result says duplicate,
   * the first delivery attempt has already
   * handled Web Push too.
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

    combinedError
      .nativeError =
      nativeError;

    combinedError
      .webError =
      webError;

    throw combinedError;
  }

  return {
    success:
      Boolean(
        nativePush?.success ||
          webPush?.success
      ),

    duplicate:
      Boolean(
        nativePush?.duplicate
      ),

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