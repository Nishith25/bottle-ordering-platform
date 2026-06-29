import {
  API_BASE_URL,
} from "./api";

type ApiResponse = {
  success: boolean;
  message?: string;
};

export type DueSubscriptionUser = {
  _id?: string;
  id?: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  active: boolean;
};

export type LastGeneratedOrder = {
  _id: string;
  orderNumber: string;
  orderStatus: string;
  deliveryStatus: string;
  createdAt: string;
};

export type DueSubscriptionDelivery = {
  _id: string;
  subscriptionNumber: string;
  user:
    | DueSubscriptionUser
    | string;

  planId: string;
  planName: string;
  billingCycle:
    | "weekly"
    | "monthly";

  bottleCount: number;
  deliveriesPerCycle: number;
  preferredDay: string;
  preferredSlot: string;
  status: string;
  paymentStatus: string;
  nextBillingAt: string;
  generatedDeliveryCount?: number;
  overdueByDays: number;

  lastDeliveryOrder?:
    | LastGeneratedOrder
    | string
    | null;

  lastDeliveryOrderAt?:
    | string
    | null;

  lastDeliveryGenerationAttemptAt?:
    | string
    | null;

  lastDeliveryGenerationFailedAt?:
    | string
    | null;

  lastDeliveryGenerationError?: string;
};

export type SubscriptionDeliveryResult = {
  status:
    | "created"
    | "skipped"
    | "failed";

  subscriptionId: string;
  subscriptionNumber: string;
  planName: string;
  orderId: string | null;
  orderNumber: string;
  reason: string;
  nextBillingAt: string | null;
};

export type DueSubscriptionPreview = {
  totalDue: number;
  count: number;
  dueAt: string;

  subscriptions:
    DueSubscriptionDelivery[];
};

export type SubscriptionDeliveryBatchResult = {
  processedCount: number;
  createdCount: number;
  skippedCount: number;
  failedCount: number;
  processedAt: string;

  results:
    SubscriptionDeliveryResult[];
};

type PreviewResponse =
  ApiResponse & {
    count: number;

    data:
      DueSubscriptionPreview;
  };

type BatchResponse =
  ApiResponse & {
    data:
      SubscriptionDeliveryBatchResult;
  };

type SingleResponse =
  ApiResponse & {
    data: {
      result:
        SubscriptionDeliveryResult;
    };
  };

async function request<T>(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  const controller =
    new AbortController();

  const timeoutId =
    window.setTimeout(() => {
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
              `Bearer ${token}`,

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
        "The server returned an invalid response."
      );
    }

    if (
      !response.ok ||
      payload.success === false
    ) {
      throw new Error(
        payload.message ??
          "Unable to complete the request."
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
        "The server took too long to respond."
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
      "Unable to complete the request."
    );
  } finally {
    window.clearTimeout(
      timeoutId
    );
  }
}

export async function fetchDueSubscriptionDeliveries(
  token: string,
  limit = 50
): Promise<DueSubscriptionPreview> {
  const safeLimit =
    Math.min(
      Math.max(
        Math.floor(limit),
        1
      ),
      100
    );

  const response =
    await request<PreviewResponse>(
      `/api/admin/subscriptions/due-deliveries?limit=${safeLimit}`,
      token
    );

  return response.data;
}

export async function generateDueSubscriptionDeliveries(
  token: string,
  limit = 25
): Promise<SubscriptionDeliveryBatchResult> {
  const response =
    await request<BatchResponse>(
      "/api/admin/subscriptions/generate-due-deliveries",
      token,
      {
        method: "POST",

        body: JSON.stringify({
          limit,
        }),
      }
    );

  return response.data;
}

export async function generateSingleSubscriptionDelivery(
  token: string,
  subscriptionId: string,
  force = false
): Promise<SubscriptionDeliveryResult> {
  if (!subscriptionId.trim()) {
    throw new Error(
      "Subscription ID is missing."
    );
  }

  const response =
    await request<SingleResponse>(
      `/api/admin/subscriptions/${encodeURIComponent(
        subscriptionId.trim()
      )}/generate-delivery`,
      token,
      {
        method: "POST",

        body: JSON.stringify({
          force,
        }),
      }
    );

  return response.data.result;
}