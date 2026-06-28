// admin-dashboard/src/services/adminSubscriptionsApi.ts

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ??
  "http://localhost:5001"
).replace(/\/$/, "");

export type AdminSubscriptionStatus =
  | "active"
  | "paused"
  | "cancelled"
  | "expired";

export type SubscriptionPaymentStatus =
  | "demo_confirmed"
  | "mandate_pending"
  | "active"
  | "failed"
  | "cancelled";

export type SubscriptionPaymentMethod =
  | "upi_autopay"
  | "card_mandate";

export type AdminSubscriptionUser = {
  _id: string;
  fullName: string;
  email: string;
  phone: string;
  role: "customer" | "admin";
  active: boolean;
};

export type AdminSubscriptionItem = {
  product: string;
  productId: string;
  name: string;
  shortName: string;
  sizeMl: number;
  price: number;
  quantity: number;
  lineTotal: number;
};

export type AdminSubscription = {
  _id: string;
  subscriptionNumber: string;

  user:
    | AdminSubscriptionUser
    | string
    | null;

  plan: string;
  planId: string;
  planName: string;

  billingCycle:
    | "weekly"
    | "monthly";

  bottleCount: number;
  deliveriesPerCycle: number;

  items: AdminSubscriptionItem[];

  preferredDay: string;
  preferredSlot: string;

  deliveryAddress: {
    fullName: string;
    phone: string;
    pincode: string;
    houseDetails: string;
    areaDetails: string;
    landmark: string;
    area: string;
    city: string;
  };

  originalTotal: number;
  discountPercent: number;
  savings: number;
  totalPerCycle: number;

  paymentMethod:
    SubscriptionPaymentMethod;

  paymentStatus:
    SubscriptionPaymentStatus;

  paymentReference: string;

  status:
    AdminSubscriptionStatus;

  startDate: string;
  nextBillingAt: string;

  cancelledAt: string | null;
  cancellationReason: string;

  createdAt: string;
  updatedAt: string;
};

export type AdminSubscriptionStatusCounts =
  Record<
    AdminSubscriptionStatus,
    number
  >;

type ApiBaseResponse = {
  success: boolean;
  message?: string;
};

type SubscriptionsResponse =
  ApiBaseResponse & {
    count: number;

    data: {
      subscriptions:
        AdminSubscription[];

      statusCounts:
        AdminSubscriptionStatusCounts;
    };
  };

type SubscriptionResponse =
  ApiBaseResponse & {
    data: {
      subscription:
        AdminSubscription;
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
    }, 12000);

  const headers = new Headers(
    options.headers
  );

  headers.set(
    "Accept",
    "application/json"
  );

  headers.set(
    "Authorization",
    `Bearer ${token}`
  );

  if (options.body) {
    headers.set(
      "Content-Type",
      "application/json"
    );
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}${path}`,
      {
        ...options,
        headers,
        signal: controller.signal,
      }
    );

    const responseText =
      await response.text();

    let payload: T & ApiBaseResponse;

    try {
      payload = responseText
        ? JSON.parse(responseText)
        : ({
            success: response.ok,
          } as T & ApiBaseResponse);
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
      error.name === "AbortError"
    ) {
      throw new Error(
        "The server took too long to respond."
      );
    }

    if (error instanceof TypeError) {
      throw new Error(
        "Unable to connect to the backend."
      );
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error(
      "Unable to complete the request."
    );
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function fetchAdminSubscriptions(
  token: string,
  options?: {
    status?: string;
    search?: string;
  }
): Promise<{
  subscriptions:
    AdminSubscription[];

  statusCounts:
    AdminSubscriptionStatusCounts;
}> {
  const parameters =
    new URLSearchParams();

  if (
    options?.status &&
    options.status !== "all"
  ) {
    parameters.set(
      "status",
      options.status
    );
  }

  if (options?.search?.trim()) {
    parameters.set(
      "search",
      options.search.trim()
    );
  }

  const query =
    parameters.toString();

  const response =
    await request<SubscriptionsResponse>(
      `/api/admin/subscriptions${
        query ? `?${query}` : ""
      }`,
      token
    );

  return response.data;
}

export async function updateAdminSubscriptionStatus(
  token: string,
  subscriptionId: string,
  status: AdminSubscriptionStatus,
  reason?: string
): Promise<AdminSubscription> {
  const response =
    await request<SubscriptionResponse>(
      `/api/admin/subscriptions/${encodeURIComponent(
        subscriptionId
      )}/status`,
      token,
      {
        method: "PATCH",

        body: JSON.stringify({
          status,
          reason,
        }),
      }
    );

  return response.data.subscription;
}