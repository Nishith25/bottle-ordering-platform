import {
  API_BASE_URL,
  type CustomerSubscription,
} from "./api";

type ApiResponse = {
  success: boolean;
  message?: string;
};

export type SubscriptionDetailsItem = {
  product?: string;
  productId: string;
  name: string;
  shortName: string;
  sizeMl: number;
  price: number;
  quantity: number;
  lineTotal: number;
};

export type SubscriptionDeliveryAddress = {
  fullName: string;
  phone: string;
  pincode: string;
  houseDetails: string;
  areaDetails: string;
  landmark?: string;
  area: string;
  city: string;
};

export type SubscriptionDeliverySchedule = {
  deliveryDateId: string;
  deliveryDateLabel: string;
  deliverySlot: string;
};

export type SubscriptionDeliveryHistoryOrder = {
  _id: string;
  orderNumber: string;
  orderSource: "subscription";
  subscriptionNumber?: string;
  subscriptionCycleKey?: string;
  subscriptionBillingAt?: string | null;

  items:
    SubscriptionDetailsItem[];

  deliveryAddress:
    SubscriptionDeliveryAddress;

  deliverySchedule:
    SubscriptionDeliverySchedule;

  subtotal: number;
  deliveryFee: number;
  amountBeforeDiscount?: number;
  couponDiscount?: number;
  total: number;

  paymentMethod:
    | "online"
    | "cod";

  paymentGateway?: string;

  paymentStatus:
    | "pending"
    | "paid"
    | "failed"
    | "refunded";

  paymentReference?: string;
  paidAt?: string | null;

  orderStatus:
    | "placed"
    | "confirmed"
    | "preparing"
    | "out_for_delivery"
    | "delivered"
    | "cancelled";

  deliveryStatus:
    | "unassigned"
    | "assigned"
    | "picked_up"
    | "out_for_delivery"
    | "delivered"
    | "cancelled";

  deliveryPartnerSnapshot?: {
    fullName?: string;
    email?: string;
    phone?: string;
  } | null;

  deliveryAssignedAt?: string | null;
  pickedUpAt?: string | null;
  outForDeliveryAt?: string | null;
  deliveryCompletedAt?: string | null;

  cancellationReason?: string;
  cancelledAt?: string | null;
  deliveredAt?: string | null;

  refundStatus?:
    | "not_required"
    | "pending"
    | "processed"
    | "failed";

  createdAt: string;
  updatedAt: string;
};

export type DetailedCustomerSubscription =
  CustomerSubscription & {
    generatedDeliveryCount?: number;

    lastDeliveryOrder?:
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

export type SubscriptionDetailsResult = {
  subscription:
    DetailedCustomerSubscription;

  latestDeliveryOrder:
    SubscriptionDeliveryHistoryOrder | null;

  generatedDeliveryCount: number;
};

export type SubscriptionDeliveryPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type SubscriptionDeliveriesResult = {
  deliveries:
    SubscriptionDeliveryHistoryOrder[];

  pagination:
    SubscriptionDeliveryPagination;
};

type DetailsResponse =
  ApiResponse & {
    data:
      SubscriptionDetailsResult;
  };

type DeliveriesResponse =
  ApiResponse & {
    data:
      SubscriptionDeliveriesResult;
  };

async function request<T>(
  path: string,
  token: string
): Promise<T> {
  if (!token.trim()) {
    throw new Error(
      "Please log in to view this subscription."
    );
  }

  const controller =
    new AbortController();

  const timeoutId =
    setTimeout(() => {
      controller.abort();
    }, 15000);

  try {
    const response =
      await fetch(
        `${API_BASE_URL}${path}`,
        {
          headers: {
            Accept:
              "application/json",

            Authorization:
              `Bearer ${token}`,
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
          "Unable to load subscription details."
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
      "Unable to load subscription details."
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

function getSubscriptionPath(
  subscriptionId: string
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
  )}`;
}

export async function fetchCustomerSubscriptionDetails(
  token: string,
  subscriptionId: string
): Promise<SubscriptionDetailsResult> {
  const response =
    await request<DetailsResponse>(
      `${getSubscriptionPath(
        subscriptionId
      )}/details`,

      token
    );

  return response.data;
}

export async function fetchCustomerSubscriptionDeliveries(
  token: string,
  subscriptionId: string,
  page = 1,
  limit = 10
): Promise<SubscriptionDeliveriesResult> {
  const safePage =
    Math.max(
      1,
      Math.floor(page)
    );

  const safeLimit =
    Math.min(
      Math.max(
        1,
        Math.floor(limit)
      ),
      25
    );

  const response =
    await request<DeliveriesResponse>(
      `${getSubscriptionPath(
        subscriptionId
      )}/deliveries?page=${safePage}&limit=${safeLimit}`,

      token
    );

  return response.data;
}