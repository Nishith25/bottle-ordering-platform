const API_BASE_URL = (
  import.meta.env.VITE_API_URL ??
  "http://localhost:5001"
).replace(/\/$/, "");

type ApiResponse = {
  success: boolean;
  message?: string;
};

export type DeliveryControlUser = {
  _id?: string;
  fullName?: string;
  phone?: string;
  email?: string;
  role?: string;
  active?: boolean;
};

export type DeliveryControlAddress = {
  fullName: string;
  phone: string;
  pincode: string;
  houseDetails: string;
  areaDetails: string;
  landmark?: string;
  area: string;
  city: string;
};

export type DeliveryControlSchedule = {
  deliveryDateId?: string;
  deliveryDateLabel?: string;
  deliverySlot?: string;
  deliverySlotCode?: string;
};

export type DeliveryControlItem = {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  lineTotal: number;
};

export type DeliveryControlOrder = {
  _id: string;
  orderNumber: string;
  orderStatus: string;
  deliveryStatus: string;
  paymentMethod: string;
  paymentStatus: string;
  total: number;
  createdAt: string;
  updatedAt?: string;

  deliveredAt?: string | null;
  deliveryCompletedAt?: string | null;
  deliveryAcceptedAt?: string | null;
  deliveryAssignedAt?: string | null;
  pickedUpAt?: string | null;
  outForDeliveryAt?: string | null;

  failedDeliveryAt?: string | null;
  failedDeliveryReason?: string;
  failedDeliveryNotes?: string;
  failedDeliveryAttemptCount?: number;
  lastDeliveryAttemptStatus?: string;

  deliveryPartnerNote?: string;
  deliveryPartnerNoteUpdatedAt?: string | null;

  deliveryAdminNote?: string;
  deliveryAdminNoteUpdatedAt?: string | null;
  deliveryReleaseReason?: string;
  deliveryReleasedAt?: string | null;

  codCollectedAmount?: number;
  codCollectedAt?: string | null;

  user:
    | DeliveryControlUser
    | string
    | null;

  deliveryPartner:
    | DeliveryControlUser
    | string
    | null;

  deliveryAddress:
    DeliveryControlAddress;

  deliverySchedule:
    DeliveryControlSchedule;

  items:
    DeliveryControlItem[];
};

export type DeliveryPartnerSummary = {
  partner: {
    id: string;
    fullName: string;
    email: string;
    phone: string;
  };

  assignedCount: number;
  pickedUpCount: number;
  outForDeliveryCount: number;
  activeCount: number;
  failedAttemptCount: number;
  pendingCodAmount: number;
  pendingCodCount: number;
  deliveredTodayCount: number;
  deliveredBottleCountToday: number;
  codCollectedToday: number;
};

export type DeliveryControlSummary = {
  openPoolCount: number;
  activeDeliveryCount: number;
  assignedCount: number;
  pickedUpCount: number;
  outForDeliveryCount: number;
  failedAttemptCount: number;
  deliveredTodayCount: number;
  deliveredBottleCountToday: number;
  pendingCodOrderCount: number;
  pendingCodAmount: number;
  codCollectedToday: number;
  pendingCashHandoverAmount: number;
  pendingCashHandoverCount: number;
};

export type DeliveryControlResult = {
  dateId: string;
  summary: DeliveryControlSummary;
  openPoolOrders: DeliveryControlOrder[];
  activeOrders: DeliveryControlOrder[];
  failedOrders: DeliveryControlOrder[];
  deliveredToday: DeliveryControlOrder[];
  partnerSummaries: DeliveryPartnerSummary[];
};

type DeliveryControlResponse =
  ApiResponse & {
    data:
      DeliveryControlResult;
  };

type DeliveryControlOrderResponse =
  ApiResponse & {
    data: {
      order:
        DeliveryControlOrder;
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

            ...(options.headers ?? {}),
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
        payload.message ||
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

export async function fetchDeliveryControlSummary(
  token: string,
  dateId = ""
): Promise<DeliveryControlResult> {
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
    await request<DeliveryControlResponse>(
      `/api/admin/delivery-control/summary${
        query ? `?${query}` : ""
      }`,
      token
    );

  return response.data;
}

export async function releaseDeliveryOrderToPool(
  token: string,
  orderId: string,
  reason: string
): Promise<DeliveryControlOrder> {
  const response =
    await request<DeliveryControlOrderResponse>(
      `/api/admin/delivery-control/orders/${encodeURIComponent(
        orderId
      )}/release-to-pool`,
      token,
      {
        method: "PATCH",

        body: JSON.stringify({
          reason,
        }),
      }
    );

  return response.data.order;
}

export async function saveDeliveryAdminNote(
  token: string,
  orderId: string,
  note: string
): Promise<DeliveryControlOrder> {
  const response =
    await request<DeliveryControlOrderResponse>(
      `/api/admin/delivery-control/orders/${encodeURIComponent(
        orderId
      )}/admin-note`,
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