import {
  API_BASE_URL,
} from "./api";

import type {
  WebPushPlatform,
  WebPushSubscriptionPayload,
} from "./webPushNotificationService";

type ApiResponse = {
  success: boolean;

  message?: string;
};

export type RegisteredWebPushSubscription = {
  _id: string;

  endpoint: string;

  platform:
    WebPushPlatform;

  deviceName?: string;

  active: boolean;

  lastSeenAt?: string;
};

export type WebPushTestResult = {
  success: boolean;

  status:
    | "not_configured"
    | "no_subscriptions"
    | "sent"
    | "partial"
    | "failed"
    | string;

  attemptedSubscriptionCount?:
    number;

  deliveredCount?:
    number;

  failedCount?:
    number;
};

type PublicKeyResponse =
  ApiResponse & {
    data: {
      publicKey: string;
    };
  };

type RegisterResponse =
  ApiResponse & {
    data: {
      subscription:
        RegisteredWebPushSubscription;
    };
  };

type UnregisterResponse =
  ApiResponse & {
    data: {
      disabled: boolean;
    };
  };

type WebPushTestResponse =
  ApiResponse & {
    data: {
      result:
        WebPushTestResult;
    };
  };

async function request<T>(
  path: string,

  options:
    RequestInit = {},

  authToken?: string
): Promise<T> {
  const controller =
    new AbortController();

  const timeoutId =
    setTimeout(
      () => {
        controller.abort();
      },

      60000
    );

  try {
    const cleanAuthToken =
      authToken?.trim() ||
      "";

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

            ...(cleanAuthToken
              ? {
                  Authorization:
                    `Bearer ${cleanAuthToken}`,
                }
              : {}),

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
      payload =
        responseText
          ? JSON.parse(
              responseText
            )
          : ({
              success:
                response.ok,
            } as T &
              ApiResponse);
    } catch {
      throw new Error(
        "The backend returned an invalid response."
      );
    }

    if (
      !response.ok ||
      payload.success ===
        false
    ) {
      throw new Error(
        payload.message ||
          "Unable to complete the Web Push request."
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
        "The Web Push request timed out. Please try again."
      );
    }

    if (
      error instanceof
      TypeError
    ) {
      throw new Error(
        "Unable to connect to the SipBite backend."
      );
    }

    if (
      error instanceof Error
    ) {
      throw error;
    }

    throw new Error(
      "Unable to complete the Web Push request."
    );
  } finally {
    clearTimeout(
      timeoutId
    );
  }
}

export async function getWebPushPublicKey():
  Promise<string> {
  const response =
    await request<PublicKeyResponse>(
      "/api/web-push/public-key"
    );

  const publicKey =
    response.data
      .publicKey
      .trim();

  if (!publicKey) {
    throw new Error(
      "The Web Push public key is unavailable."
    );
  }

  return publicKey;
}

export async function registerBrowserWebPushSubscription(
  authToken: string,

  input: {
    subscription:
      WebPushSubscriptionPayload;

    platform:
      WebPushPlatform;

    deviceName:
      string;

    userAgent:
      string;
  }
): Promise<
  RegisteredWebPushSubscription
> {
  const response =
    await request<RegisterResponse>(
      "/api/web-push/register",

      {
        method: "POST",

        body:
          JSON.stringify(
            input
          ),
      },

      authToken
    );

  return response.data
    .subscription;
}

export async function unregisterBrowserWebPushSubscription(
  authToken: string,

  endpoint: string
): Promise<boolean> {
  const cleanEndpoint =
    endpoint.trim();

  if (!cleanEndpoint) {
    return false;
  }

  const response =
    await request<UnregisterResponse>(
      "/api/web-push/unregister",

      {
        method: "DELETE",

        body:
          JSON.stringify({
            endpoint:
              cleanEndpoint,
          }),
      },

      authToken
    );

  return response.data
    .disabled;
}

export async function sendCustomerWebPushTest(
  authToken: string,

  input?: {
    title?: string;

    body?: string;
  }
): Promise<
  WebPushTestResult
> {
  const response =
    await request<WebPushTestResponse>(
      "/api/web-push/test",

      {
        method: "POST",

        body:
          JSON.stringify({
            title:
              input?.title ||
              "SipBite Web Push test",

            body:
              input?.body ||
              "Your iPhone Home Screen app can receive SipBite notifications.",
          }),
      },

      authToken
    );

  return response.data
    .result;
}