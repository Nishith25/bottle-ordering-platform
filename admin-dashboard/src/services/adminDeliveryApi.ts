import type {
  AdminDeliveryStatus,
  AdminOrder,
  AdminOrderUser,
} from "./adminOrdersApi";

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ??
  "http://localhost:5001"
).replace(/\/$/, "");

type ApiResponse = {
  success: boolean;
  message?: string;
};

export type DeliveryPartner = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: "delivery";
  active: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;

  activeAssignmentCount: number;
  completedDeliveryCount: number;
  reviewCount: number;
  averageDeliveryRating: number;
};

export type DeliveryPartnerPayload = {
  fullName: string;
  email: string;
  phone: string;
  password?: string;
  active?: boolean;
};

export type DeliveryFailureReason =
  | "customer_not_available"
  | "customer_no_response"
  | "wrong_address"
  | "payment_issue"
  | "otp_issue"
  | "customer_requested_later"
  | "vehicle_issue"
  | "other";

export type DeliveryOrderStatusCounts = {
  assigned: number;
  picked_up: number;
  out_for_delivery: number;
  delivered: number;
  failed_attempts?: number;
};

export type DeliveryOrder = Omit<
  AdminOrder,
  "user"
> & {
  user:
    | Pick<
        AdminOrderUser,
        "_id" | "fullName" | "phone"
      >
    | string
    | null;

  deliveryStatus:
    AdminDeliveryStatus;

  lastDeliveryAttemptStatus?:
    | ""
    | "failed"
    | "completed";

  failedDeliveryReason?:
    | DeliveryFailureReason
    | "";

  failedDeliveryNotes?: string;
  failedDeliveryAt?: string | null;
  failedDeliveryAttemptCount?: number;

  deliveryPartnerNote?: string;
  deliveryPartnerNoteUpdatedAt?: string | null;

  codCollectedByDeliveryPartner?: boolean;
  codCollectedAmount?: number;
  codCollectedAt?: string | null;
};

export type DeliveryCashSummary = {
  dateId: string;
  activeOrderCount: number;
  activeBottleCount: number;
  pendingCodOrderCount: number;
  pendingCodAmount: number;
  collectedTodayOrderCount: number;
  collectedTodayAmount: number;
  deliveredTodayOrderCount: number;
  deliveredBottleCountToday: number;
};

export type DeliveryPerformanceReview = {
  _id: string;
  order: string;
  orderNumber: string;

  user:
    | {
        _id?: string;
        fullName?: string;
      }
    | string
    | null;

  customerSnapshot: {
    fullName: string;
    email: string;
    phone: string;
  };

  orderRating: number;
  deliveryRating: number;
  comment: string;
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type DeliveryPerformance = {
  totalAssigned: number;
  activeDeliveries: number;
  completedDeliveries: number;
  reviewCount: number;
  averageDeliveryRating: number;
  fiveStarReviews: number;
  completionRate: number;

  recentReviews:
    DeliveryPerformanceReview[];

  recentDeliveries:
    DeliveryOrder[];
};

type PartnersResponse =
  ApiResponse & {
    count: number;

    data: {
      partners:
        DeliveryPartner[];
    };
  };

type PartnerResponse =
  ApiResponse & {
    data: {
      partner:
        DeliveryPartner;
    };
  };

type OrderResponse =
  ApiResponse & {
    data: {
      order:
        AdminOrder;
    };
  };

type DeliveryOrderResponse =
  ApiResponse & {
    data: {
      order:
        DeliveryOrder;
    };
  };

type DeliveryOrdersResponse =
  ApiResponse & {
    count: number;

    data: {
      orders:
        DeliveryOrder[];

      statusCounts:
        DeliveryOrderStatusCounts;
    };
  };

type DeliveryPerformanceResponse =
  ApiResponse & {
    data: {
      performance:
        DeliveryPerformance;
    };
  };

type DeliveryCashSummaryResponse =
  ApiResponse & {
    data: {
      cashSummary:
        DeliveryCashSummary;
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

  try {
    const response = await fetch(
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
        ? JSON.parse(responseText)
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

export async function fetchDeliveryPartners(
  token: string
): Promise<DeliveryPartner[]> {
  const response =
    await request<PartnersResponse>(
      "/api/admin/delivery-partners",
      token
    );

  return response.data.partners;
}

export async function createDeliveryPartner(
  token: string,
  payload: Required<
    Pick<
      DeliveryPartnerPayload,
      | "fullName"
      | "email"
      | "phone"
      | "password"
    >
  >
): Promise<DeliveryPartner> {
  const response =
    await request<PartnerResponse>(
      "/api/admin/delivery-partners",
      token,
      {
        method: "POST",

        body: JSON.stringify(
          payload
        ),
      }
    );

  return response.data.partner;
}

export async function updateDeliveryPartner(
  token: string,
  partnerId: string,
  payload: DeliveryPartnerPayload
): Promise<DeliveryPartner> {
  const response =
    await request<PartnerResponse>(
      `/api/admin/delivery-partners/${encodeURIComponent(
        partnerId
      )}`,
      token,
      {
        method: "PATCH",

        body: JSON.stringify(
          payload
        ),
      }
    );

  return response.data.partner;
}

export async function assignDeliveryPartner(
  token: string,
  orderId: string,
  deliveryPartnerId: string
): Promise<AdminOrder> {
  const response =
    await request<OrderResponse>(
      `/api/admin/orders/${encodeURIComponent(
        orderId
      )}/delivery-partner`,
      token,
      {
        method: "PATCH",

        body: JSON.stringify({
          deliveryPartnerId,
        }),
      }
    );

  return response.data.order;
}

export async function fetchAssignedDeliveryOrders(
  token: string
): Promise<{
  orders: DeliveryOrder[];

  statusCounts:
    DeliveryOrderStatusCounts;
}> {
  const response =
    await request<DeliveryOrdersResponse>(
      "/api/delivery/orders/assigned",
      token
    );

  return response.data;
}

export async function fetchDeliveryPerformance(
  token: string
): Promise<DeliveryPerformance> {
  const response =
    await request<DeliveryPerformanceResponse>(
      "/api/delivery/orders/performance",
      token
    );

  return response.data.performance;
}

export async function fetchDeliveryCashSummary(
  token: string,
  dateId = ""
): Promise<DeliveryCashSummary> {
  const params =
    new URLSearchParams();

  if (dateId.trim()) {
    params.set(
      "date",
      dateId.trim()
    );
  }

  const query =
    params.toString();

  const response =
    await request<DeliveryCashSummaryResponse>(
      `/api/delivery/orders/cash-summary${
        query ? `?${query}` : ""
      }`,
      token
    );

  return response.data.cashSummary;
}

export async function updateDeliveryOrderStatus(
  token: string,
  orderId: string,
  deliveryStatus:
    | "picked_up"
    | "out_for_delivery"
): Promise<DeliveryOrder> {
  const response =
    await request<DeliveryOrderResponse>(
      `/api/delivery/orders/${encodeURIComponent(
        orderId
      )}/status`,
      token,
      {
        method: "PATCH",

        body: JSON.stringify({
          deliveryStatus,
        }),
      }
    );

  return response.data.order;
}

export async function saveDeliveryOrderNote(
  token: string,
  orderId: string,
  note: string
): Promise<DeliveryOrder> {
  const response =
    await request<DeliveryOrderResponse>(
      `/api/delivery/orders/${encodeURIComponent(
        orderId
      )}/notes`,
      token,
      {
        method: "PATCH",

        body: JSON.stringify({
          note,
        }),
      }
    );

  return response.data.order;
}

export async function reportFailedDelivery(
  token: string,
  orderId: string,
  payload: {
    reason:
      DeliveryFailureReason;
    notes?: string;
  }
): Promise<DeliveryOrder> {
  const response =
    await request<DeliveryOrderResponse>(
      `/api/delivery/orders/${encodeURIComponent(
        orderId
      )}/failed-delivery`,
      token,
      {
        method: "POST",

        body: JSON.stringify(
          payload
        ),
      }
    );

  return response.data.order;
}

export async function verifyDeliveryOrderOtp(
  token: string,
  orderId: string,
  otp: string,
  options?: {
    codCollected?: boolean;
    codAmountCollected?: number;
  }
): Promise<DeliveryOrder> {
  const response =
    await request<DeliveryOrderResponse>(
      `/api/delivery/orders/${encodeURIComponent(
        orderId
      )}/verify-otp`,
      token,
      {
        method: "POST",

        body: JSON.stringify({
          otp,
          ...(options ?? {}),
        }),
      }
    );

  return response.data.order;
}