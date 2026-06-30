import { API_BASE_URL } from "./api";

type ApiResponse = {
  success: boolean;
  message?: string;
};

export type RegisterPushTokenInput = {
  expoPushToken: string;

  platform:
    | "ios"
    | "android"
    | "unknown";

  deviceId?: string;
  deviceName?: string;
  appVersion?: string;
  projectId?: string;
};

export type RegisteredPushToken = {
  _id: string;

  platform:
    | "ios"
    | "android"
    | "unknown";

  deviceId?: string;
  deviceName?: string;
  appVersion?: string;
  projectId?: string;

  active: boolean;
  lastSeenAt?: string;
};

export type PushTestResult = {
  success: boolean;
  duplicate?: boolean;

  logId?: string;

  status:
    | "queued"
    | "no_tokens"
    | "sent"
    | "partial"
    | "failed"
    | string;

  attemptedTokenCount?: number;
  acceptedCount?: number;
  failedCount?: number;
};

type RegisterResponse =
  ApiResponse & {
    data: {
      pushToken:
        RegisteredPushToken;
    };
  };

type UnregisterResponse =
  ApiResponse & {
    data: {
      disabled: boolean;
    };
  };

type UnregisterAllResponse =
  ApiResponse & {
    data: {
      disabledCount: number;
    };
  };

type PushTestResponse =
  ApiResponse & {
    data: {
      result:
        PushTestResult;
    };
  };

async function request<T>(
  path: string,
  authToken: string,
  options: RequestInit = {}
): Promise<T> {
  const cleanAuthToken =
    authToken.trim();

  if (!cleanAuthToken) {
    throw new Error(
      "Authentication is required."
    );
  }

  const controller =
    new AbortController();

  const timeoutId =
    setTimeout(() => {
      controller.abort();
    }, 20000);

  try {
    const response =
      await fetch(
        `${API_BASE_URL}${path}`,
        {
          ...options,

          headers: {
            Accept:
              "application/json",

            ...(options.body
              ? {
                  "Content-Type":
                    "application/json",
                }
              : {}),

            Authorization:
              `Bearer ${cleanAuthToken}`,

            ...(options.headers ??
              {}),
          },

          signal:
            controller.signal,
        }
      );

    const responseText =
      await response.text();

    let payload:
      T & ApiResponse;

    try {
      payload = responseText
        ? JSON.parse(
            responseText
          )
        : ({
            success:
              response.ok,
          } as T & ApiResponse);
    } catch {
      throw new Error(
        "The backend returned an invalid response."
      );
    }

    if (
      !response.ok ||
      payload.success === false
    ) {
      throw new Error(
        payload.message ||
          "Unable to complete the push-notification request."
      );
    }

    return payload;
  } catch (error) {
    if (
      error instanceof Error &&
      error.name ===
        "AbortError"
    ) {
      throw new Error(
        "The push-notification request timed out."
      );
    }

    if (
      error instanceof TypeError
    ) {
      throw new Error(
        "Unable to connect to the backend."
      );
    }

    if (
      error instanceof Error
    ) {
      throw error;
    }

    throw new Error(
      "Unable to complete the push-notification request."
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function registerDevicePushToken(
  authToken: string,
  input:
    RegisterPushTokenInput
): Promise<RegisteredPushToken> {
  const cleanPushToken =
    input.expoPushToken.trim();

  if (!cleanPushToken) {
    throw new Error(
      "Expo push token is missing."
    );
  }

  const response =
    await request<RegisterResponse>(
      "/api/push-tokens/register",
      authToken,
      {
        method: "POST",

        body: JSON.stringify({
          token:
            cleanPushToken,

          platform:
            input.platform,

          deviceId:
            input.deviceId || "",

          deviceName:
            input.deviceName || "",

          appVersion:
            input.appVersion || "",

          projectId:
            input.projectId || "",
        }),
      }
    );

  return response.data.pushToken;
}

export async function unregisterDevicePushToken(
  authToken: string,
  expoPushToken: string
): Promise<boolean> {
  const cleanPushToken =
    expoPushToken.trim();

  if (!cleanPushToken) {
    return false;
  }

  const response =
    await request<UnregisterResponse>(
      "/api/push-tokens/unregister",
      authToken,
      {
        method: "DELETE",

        body: JSON.stringify({
          token:
            cleanPushToken,
        }),
      }
    );

  return response.data.disabled;
}

export async function unregisterAllDevicePushTokens(
  authToken: string
): Promise<number> {
  const response =
    await request<UnregisterAllResponse>(
      "/api/push-tokens/unregister-all",
      authToken,
      {
        method: "DELETE",
      }
    );

  return response.data.disabledCount;
}

export async function sendCustomerTestPush(
  authToken: string,
  input?: {
    title?: string;
    body?: string;
  }
): Promise<PushTestResult> {
  const response =
    await request<PushTestResponse>(
      "/api/push-tokens/test",
      authToken,
      {
        method: "POST",

        body: JSON.stringify({
          title:
            input?.title ||
            "Bottle notification test",

          body:
            input?.body ||
            "Your iOS or Android push notifications are connected.",
        }),
      }
    );

  return response.data.result;
}