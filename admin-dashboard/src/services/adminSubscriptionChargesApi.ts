const API_BASE_URL = (
  import.meta.env.VITE_API_URL ??
  "http://localhost:5001"
).replace(/\/$/, "");

type ApiResponse = {
  success: boolean;
  message?: string;
};

export type SubscriptionChargeProcessingStatus =
  | "received"
  | "processing"
  | "fulfilled"
  | "fulfillment_failed"
  | "ignored";

export type SubscriptionChargeUser = {
  _id: string;
  fullName?: string;
  email?: string;
  phone?: string;
  role?: string;
  active?: boolean;
};

export type PopulatedSubscriptionChargeOrder = {
  _id: string;
  orderNumber: string;
  orderStatus: string;
  deliveryStatus: string;
  paymentStatus: string;
  total: number;
  createdAt: string;
};

export type PopulatedChargeSubscription = {
  _id: string;
  subscriptionNumber: string;
  planName: string;
  status: string;
  billingCycle: string;
  nextBillingAt?: string | null;
};

export type AdminSubscriptionCharge = {
  _id: string;

  localSubscription:
    | string
    | PopulatedChargeSubscription;

  mandate: string;

  user:
    | string
    | SubscriptionChargeUser;

  subscriptionNumber: string;
  planName: string;

  razorpayPaymentId: string;
  razorpaySubscriptionId: string;
  razorpayInvoiceId?: string;

  webhookEventId?: string;
  eventType?: string;

  amountPaise: number;
  expectedAmountPaise: number;
  currency: string;

  paymentStatus: string;
  paymentMethod?: string;

  captured: boolean;
  amountMatches: boolean;

  processingStatus:
    SubscriptionChargeProcessingStatus;

  subscriptionCycleKey?: string;

  order:
    | string
    | PopulatedSubscriptionChargeOrder
    | null;

  orderNumber?: string;

  failureCode?: string;
  failureReason?: string;

  paymentErrorCode?: string;
  paymentErrorDescription?: string;

  retryCount: number;
  lastRetriedAt?: string | null;

  paymentCreatedAt?: string | null;
  processedAt?: string | null;

  createdAt: string;
  updatedAt: string;
};

export type SubscriptionChargeSummary = {
  totalCharges: number;
  fulfilled: number;
  fulfillmentFailed: number;
  ignored: number;
  processing: number;
  collectedAmountPaise: number;
};

export type SubscriptionChargePagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type SubscriptionChargeFilters = {
  subscriptionId?: string;
  processingStatus?:
    | SubscriptionChargeProcessingStatus
    | "all";

  paymentStatus?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
};

export type SubscriptionChargesResult = {
  charges:
    AdminSubscriptionCharge[];

  summary:
    SubscriptionChargeSummary;

  pagination:
    SubscriptionChargePagination;
};

export type RetryChargeResult = {
  status: string;
  chargeId?: string;
  orderId?: string | null;
  orderNumber?: string;
  razorpayPaymentId?: string;
  reason?: string;
};

type ChargesResponse =
  ApiResponse & {
    data:
      SubscriptionChargesResult;
  };

type RetryResponse =
  ApiResponse & {
    data: {
      result:
        RetryChargeResult;
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
    window.setTimeout(
      () => {
        controller.abort();
      },
      20000
    );

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
        "The backend returned an invalid response."
      );
    }

    if (
      !response.ok ||
      payload.success === false
    ) {
      throw new Error(
        payload.message ||
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

export async function fetchAdminSubscriptionCharges(
  token: string,
  filters:
    SubscriptionChargeFilters = {}
): Promise<SubscriptionChargesResult> {
  const searchParams =
    new URLSearchParams();

  if (filters.subscriptionId) {
    searchParams.set(
      "subscriptionId",
      filters.subscriptionId
    );
  }

  if (
    filters.processingStatus &&
    filters.processingStatus !==
      "all"
  ) {
    searchParams.set(
      "processingStatus",
      filters.processingStatus
    );
  }

  if (
    filters.paymentStatus &&
    filters.paymentStatus !==
      "all"
  ) {
    searchParams.set(
      "paymentStatus",
      filters.paymentStatus
    );
  }

  if (filters.search?.trim()) {
    searchParams.set(
      "search",
      filters.search.trim()
    );
  }

  if (filters.dateFrom) {
    searchParams.set(
      "dateFrom",
      filters.dateFrom
    );
  }

  if (filters.dateTo) {
    searchParams.set(
      "dateTo",
      filters.dateTo
    );
  }

  searchParams.set(
    "page",
    String(
      Math.max(
        1,
        filters.page || 1
      )
    )
  );

  searchParams.set(
    "limit",
    String(
      Math.min(
        100,
        Math.max(
          1,
          filters.limit || 20
        )
      )
    )
  );

  const response =
    await request<ChargesResponse>(
      `/api/admin/subscription-charges?${searchParams.toString()}`,
      token
    );

  return response.data;
}

export async function retryAdminSubscriptionCharge(
  token: string,
  chargeId: string
): Promise<RetryChargeResult> {
  const cleanChargeId =
    chargeId.trim();

  if (!cleanChargeId) {
    throw new Error(
      "Subscription charge ID is missing."
    );
  }

  const response =
    await request<RetryResponse>(
      `/api/admin/subscription-charges/${encodeURIComponent(
        cleanChargeId
      )}/retry`,
      token,
      {
        method: "POST",

        body: JSON.stringify({}),
      }
    );

  return response.data.result;
}