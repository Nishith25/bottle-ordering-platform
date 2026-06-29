import {
  API_BASE_URL,
} from "./api";

type ApiResponse = {
  success: boolean;
  message?: string;
};

export type RazorpayMandateStatus =
  | "created"
  | "authenticated"
  | "active"
  | "pending"
  | "halted"
  | "paused"
  | "cancelled"
  | "completed"
  | "expired"
  | "unknown";

export type RazorpaySubscriptionMandate = {
  _id: string;

  localSubscription: string;
  user: string;

  subscriptionNumber: string;
  planName: string;

  billingCycle:
    | "weekly"
    | "monthly";

  amountPaise: number;
  currency: string;

  razorpayPlanId: string;
  razorpaySubscriptionId: string;
  razorpayCustomerId?: string;

  shortUrl?: string;

  status:
    RazorpayMandateStatus;

  totalCount: number;
  paidCount: number;
  remainingCount: number;
  authAttempts: number;

  startAt?: string | null;
  chargeAt?: string | null;
  currentStart?: string | null;
  currentEnd?: string | null;
  endedAt?: string | null;

  checkoutPaymentId?: string;
  checkoutSignatureVerifiedAt?:
    | string
    | null;

  paymentMethod?: string;

  lastPaymentId?: string;
  lastPaymentStatus?: string;
  lastPaymentAmountPaise?: number;
  lastPaymentAt?: string | null;
  lastPaymentFailureReason?: string;

  lastWebhookEventId?: string;
  lastWebhookEventType?: string;
  lastWebhookAt?: string | null;

  cancelledAt?: string | null;
  cancelAtCycleEnd?: boolean;

  createdAt: string;
  updatedAt: string;
};

export type RazorpayCheckoutDetails = {
  keyId: string;

  razorpaySubscriptionId:
    string;

  shortUrl: string;

  amountPaise: number;
  currency: string;

  name: string;
  description: string;

  prefill: {
    name?: string;
    email?: string;
    contact?: string;
  };
};

export type PrepareRazorpaySubscriptionResult = {
  mandate:
    RazorpaySubscriptionMandate;

  checkout:
    RazorpayCheckoutDetails;
};

type PrepareResponse =
  ApiResponse & {
    data:
      PrepareRazorpaySubscriptionResult;
  };

type MandateResponse =
  ApiResponse & {
    data: {
      mandate:
        RazorpaySubscriptionMandate | null;
    };
  };

async function request<T>(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  if (!token.trim()) {
    throw new Error(
      "Please log in to manage your recurring payment."
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
          "Unable to complete the recurring payment request."
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
        "The backend took too long to respond."
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
      "Unable to complete the recurring payment request."
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

function getRazorpayPath(
  subscriptionId: string,
  action: string
) {
  const cleanSubscriptionId =
    subscriptionId.trim();

  if (!cleanSubscriptionId) {
    throw new Error(
      "Subscription ID is missing."
    );
  }

  return `/api/subscriptions/${encodeURIComponent(
    cleanSubscriptionId
  )}/razorpay/${action}`;
}

export async function prepareCustomerRazorpaySubscription(
  token: string,
  subscriptionId: string
): Promise<PrepareRazorpaySubscriptionResult> {
  const response =
    await request<PrepareResponse>(
      getRazorpayPath(
        subscriptionId,
        "prepare"
      ),
      token,
      {
        method: "POST",

        body: JSON.stringify({}),
      }
    );

  return response.data;
}

export async function fetchCustomerRazorpayMandateStatus(
  token: string,
  subscriptionId: string
): Promise<RazorpaySubscriptionMandate | null> {
  const response =
    await request<MandateResponse>(
      getRazorpayPath(
        subscriptionId,
        "status"
      ),
      token
    );

  return response.data.mandate;
}

export async function refreshCustomerRazorpayMandateStatus(
  token: string,
  subscriptionId: string
): Promise<RazorpaySubscriptionMandate> {
  const response =
    await request<MandateResponse>(
      getRazorpayPath(
        subscriptionId,
        "refresh"
      ),
      token,
      {
        method: "POST",

        body: JSON.stringify({}),
      }
    );

  if (!response.data.mandate) {
    throw new Error(
      "Razorpay mandate was not found."
    );
  }

  return response.data.mandate;
}

export async function cancelCustomerRazorpayMandate(
  token: string,
  subscriptionId: string,
  cancelAtCycleEnd = false
): Promise<RazorpaySubscriptionMandate> {
  const response =
    await request<MandateResponse>(
      getRazorpayPath(
        subscriptionId,
        "cancel"
      ),
      token,
      {
        method: "POST",

        body: JSON.stringify({
          cancelAtCycleEnd,
        }),
      }
    );

  if (!response.data.mandate) {
    throw new Error(
      "Razorpay mandate was not found."
    );
  }

  return response.data.mandate;
}