import type {
  AdminSubscription,
} from "./adminSubscriptionsApi";

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ??
  "http://localhost:5001"
).replace(/\/$/, "");

type ApiResponse = {
  success: boolean;
  message?: string;
};

export type AdminSubscriptionOrderItem = {
  _id?: string;

  product?: string;

  productId: string;

  name: string;

  shortName: string;

  sizeMl: number;

  price: number;

  quantity: number;

  lineTotal: number;
};

export type AdminSubscriptionDeliveryAddress = {
  fullName: string;

  phone: string;

  pincode: string;

  houseDetails: string;

  areaDetails: string;

  landmark?: string;

  area: string;

  city: string;
};

export type AdminSubscriptionDeliverySchedule = {
  deliveryDateId?: string;

  deliveryDateLabel?: string;

  deliverySlot?: string;
};

export type AdminSubscriptionDeliveryOrder = {
  _id: string;

  orderNumber: string;

  orderSource?: "subscription";

  subscription?: string;

  subscriptionNumber?: string;

  subscriptionCycleKey?: string;

  subscriptionBillingAt?:
    | string
    | null;

  items:
    AdminSubscriptionOrderItem[];

  deliveryAddress:
    AdminSubscriptionDeliveryAddress;

  deliverySchedule:
    AdminSubscriptionDeliverySchedule;

  subtotal: number;

  deliveryFee: number;

  amountBeforeDiscount?: number;

  couponDiscount?: number;

  total: number;

  paymentMethod: string;

  paymentGateway?: string;

  paymentStatus: string;

  paymentReference?: string;

  paidAt?: string | null;

  orderStatus: string;

  deliveryStatus: string;

  deliveryPartnerSnapshot?: {
    fullName?: string;

    email?: string;

    phone?: string;
  } | null;

  deliveryAssignedAt?:
    | string
    | null;

  pickedUpAt?:
    | string
    | null;

  outForDeliveryAt?:
    | string
    | null;

  deliveryCompletedAt?:
    | string
    | null;

  cancellationReason?: string;

  cancelledAt?:
    | string
    | null;

  deliveredAt?:
    | string
    | null;

  refundStatus?: string;

  refundAmount?: number;

  createdAt: string;

  updatedAt: string;
};

export type AdminDetailedSubscription =
  AdminSubscription & {
    originalTotal?: number;

    discountPercent?: number;

    savings?: number;

    amountBeforeCoupon?: number;

    couponDiscount?: number;

    totalPerCycle: number;

    recurringTotalPerCycle?: number;

    paymentMethod?: string;

    paymentStatus?: string;

    paymentReference?: string;

    preferredDay?: string;

    preferredSlot?: string;

    startDate?: string;

    nextBillingAt?: string;

    cancellationReason?: string;

    cancelledAt?:
      | string
      | null;

    generatedDeliveryCount?: number;

    lastDeliveryOrder?:
      | AdminSubscriptionDeliveryOrder
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

    coupon?: {
      couponId?: string;

      code?: string;

      discountType?: string;

      discountValue?: number;

      eligibleAmount?: number;

      discountAmount?: number;
    } | null;
  };

export type SubscriptionGenerationState = {
  isDue: boolean;

  canGenerate: boolean;

  message: string;
};

export type AdminSubscriptionDetailsResult = {
  subscription:
    AdminDetailedSubscription;

  latestDeliveryOrder:
    AdminSubscriptionDeliveryOrder | null;

  generatedDeliveryCount: number;

  generationState:
    SubscriptionGenerationState;
};

export type AdminSubscriptionDeliveryPagination = {
  page: number;

  limit: number;

  total: number;

  totalPages: number;

  hasNextPage: boolean;

  hasPreviousPage: boolean;
};

export type AdminSubscriptionDeliveriesResult = {
  subscriptionNumber: string;

  deliveries:
    AdminSubscriptionDeliveryOrder[];

  pagination:
    AdminSubscriptionDeliveryPagination;
};

export type GenerateDeliveryResult = {
  status:
    | "created"
    | "skipped"
    | "failed";

  subscriptionId: string;

  subscriptionNumber: string;

  planName: string;

  orderId:
    | string
    | null;

  orderNumber: string;

  reason: string;

  nextBillingAt:
    | string
    | null;
};

type DetailsResponse =
  ApiResponse & {
    data:
      AdminSubscriptionDetailsResult;
  };

type DeliveriesResponse =
  ApiResponse & {
    data:
      AdminSubscriptionDeliveriesResult;
  };

type GenerateResponse =
  ApiResponse & {
    data: {
      result:
        GenerateDeliveryResult;
    };
  };

async function request<T>(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  if (!token.trim()) {
    throw new Error(
      "Admin authentication is required."
    );
  }

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
      payload =
        responseText
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
      "Unable to complete the request."
    );
  } finally {
    window.clearTimeout(
      timeoutId
    );
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

  return `/api/admin/subscriptions/${encodeURIComponent(
    cleanSubscriptionId
  )}`;
}

export async function fetchAdminSubscriptionDetails(
  token: string,
  subscriptionId: string
): Promise<AdminSubscriptionDetailsResult> {
  const response =
    await request<DetailsResponse>(
      `${getSubscriptionPath(
        subscriptionId
      )}/details`,

      token
    );

  return response.data;
}

export async function fetchAdminSubscriptionDeliveries(
  token: string,
  subscriptionId: string,
  page = 1,
  limit = 10
): Promise<AdminSubscriptionDeliveriesResult> {
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

export async function generateAdminSubscriptionDelivery(
  token: string,
  subscriptionId: string,
  force = false
): Promise<GenerateDeliveryResult> {
  const response =
    await request<GenerateResponse>(
      `${getSubscriptionPath(
        subscriptionId
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