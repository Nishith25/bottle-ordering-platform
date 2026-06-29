import {
  API_BASE_URL,
  type CustomerSubscription,
} from "./api";

type ApiResponse = {
  success: boolean;
  message?: string;
};

type SubscriptionResponse =
  ApiResponse & {
    data: {
      subscription:
        CustomerSubscription;

      skippedBillingDate?: string;
    };
  };

async function request<T>(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  if (!token.trim()) {
    throw new Error(
      "Please log in to manage your subscription."
    );
  }

  const controller =
    new AbortController();

  const timeoutId =
    setTimeout(() => {
      controller.abort();
    }, 12000);

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
          "Unable to complete the subscription request."
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
      "Unable to complete the subscription request."
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

function getSubscriptionPath(
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
  )}/${action}`;
}

export async function pauseCustomerSubscription(
  token: string,
  subscriptionId: string
): Promise<CustomerSubscription> {
  const response =
    await request<SubscriptionResponse>(
      getSubscriptionPath(
        subscriptionId,
        "pause"
      ),
      token,
      {
        method: "PATCH",
      }
    );

  return response.data
    .subscription;
}

export async function resumeCustomerSubscription(
  token: string,
  subscriptionId: string
): Promise<CustomerSubscription> {
  const response =
    await request<SubscriptionResponse>(
      getSubscriptionPath(
        subscriptionId,
        "resume"
      ),
      token,
      {
        method: "PATCH",
      }
    );

  return response.data
    .subscription;
}

export async function skipNextCustomerSubscriptionDelivery(
  token: string,
  subscriptionId: string
): Promise<{
  subscription:
    CustomerSubscription;

  skippedBillingDate:
    string | null;
}> {
  const response =
    await request<SubscriptionResponse>(
      getSubscriptionPath(
        subscriptionId,
        "skip-next"
      ),
      token,
      {
        method: "PATCH",
      }
    );

  return {
    subscription:
      response.data.subscription,

    skippedBillingDate:
      response.data
        .skippedBillingDate ??
      null,
  };
}