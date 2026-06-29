const API_BASE_URL = (
  import.meta.env.VITE_API_URL ??
  "http://localhost:5001"
).replace(/\/$/, "");

export type AdminOrderStatus =
  | "placed"
  | "confirmed"
  | "preparing"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export type AdminOrderPaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "refunded";

export type AdminOrderRefundStatus =
  | "not_required"
  | "pending"
  | "processed"
  | "failed";

export type AdminDeliveryStatus =
  | "unassigned"
  | "assigned"
  | "picked_up"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export type AdminOrderUser = {
  _id: string;
  fullName: string;
  email: string;
  phone: string;

  role:
    | "customer"
    | "admin"
    | "delivery";

  active?: boolean;
};

export type AdminOrderItem = {
  product: string;
  productId: string;
  name: string;
  shortName: string;
  sizeMl: number;
  price: number;
  quantity: number;
  lineTotal: number;
};

export type AdminOrder = {
  _id: string;
  orderNumber: string;

  user:
    | AdminOrderUser
    | string
    | null;

  items: AdminOrderItem[];

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

  deliverySchedule: {
    deliveryDateId: string;
    deliveryDateLabel: string;
    deliverySlot: string;
  };

  subtotal: number;
  deliveryFee: number;

  amountBeforeDiscount?: number;
  couponDiscount?: number;

  coupon?: {
    couponId?: string | null;
    code: string;
    description: string;

    discountType:
      | ""
      | "fixed"
      | "percentage";

    discountValue: number;
    maxDiscountAmount: number;
    minimumOrder: number;

    appliesTo:
      | ""
      | "order"
      | "subscription"
      | "both";

    eligibleAmount: number;
    discountAmount: number;
  } | null;

  total: number;

  paymentMethod:
    | "cod"
    | "online";

  paymentGateway?:
    | ""
    | "razorpay";

  paymentGatewayOrderId?: string;

  paymentStatus:
    AdminOrderPaymentStatus;

  paymentReference: string;

  paidAt?: string | null;

  orderStatus:
    AdminOrderStatus;

  cancellationReason: string;

  cancelledAt:
    | string
    | null;

  deliveredAt:
    | string
    | null;

  deliveryPartner?:
    | AdminOrderUser
    | string
    | null;

  deliveryPartnerSnapshot?: {
    fullName: string;
    email: string;
    phone: string;
  } | null;

  deliveryStatus?:
    AdminDeliveryStatus;

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

  refundStatus?:
    AdminOrderRefundStatus;

  refundId?: string;
  refundAmount?: number;
  refundAmountPaise?: number;

  refundSpeedRequested?:
    | ""
    | "normal"
    | "optimum";

  refundInitiatedBy?:
    | ""
    | "customer"
    | "admin"
    | "system";

  refundIdempotencyKey?: string;

  refundRequestedAt?:
    | string
    | null;

  refundProcessedAt?:
    | string
    | null;

  refundFailedAt?:
    | string
    | null;

  refundFailureReason?: string;
  refundAttemptCount?: number;

  createdAt: string;
  updatedAt: string;
};

export type AdminOrderStatusCounts =
  Record<
    AdminOrderStatus,
    number
  >;

type AdminOrdersResponse = {
  success: boolean;
  message?: string;
  count: number;

  data: {
    orders: AdminOrder[];

    statusCounts:
      AdminOrderStatusCounts;
  };
};

type AdminOrderResponse = {
  success: boolean;
  message?: string;

  data: {
    order: AdminOrder;
  };
};

async function request<T>(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(
    `${API_BASE_URL}${path}`,
    {
      ...options,

      headers: {
        Accept:
          "application/json",

        "Content-Type":
          "application/json",

        Authorization:
          `Bearer ${token}`,

        ...(options.headers ?? {}),
      },
    }
  );

  const responseText =
    await response.text();

  let payload: T & {
    success?: boolean;
    message?: string;
  };

  try {
    payload = responseText
      ? JSON.parse(responseText)
      : ({} as T);
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
}

export async function fetchAdminOrders(
  token: string,

  options?: {
    status?: string;
    search?: string;
  }
): Promise<{
  orders: AdminOrder[];

  statusCounts:
    AdminOrderStatusCounts;
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

  if (
    options?.search?.trim()
  ) {
    parameters.set(
      "search",
      options.search.trim()
    );
  }

  const query =
    parameters.toString();

  const response =
    await request<AdminOrdersResponse>(
      `/api/admin/orders${
        query
          ? `?${query}`
          : ""
      }`,
      token
    );

  return response.data;
}

export async function updateAdminOrderStatus(
  token: string,
  orderId: string,
  orderStatus: AdminOrderStatus,
  cancellationReason?: string
): Promise<AdminOrder> {
  const response =
    await request<AdminOrderResponse>(
      `/api/admin/orders/${encodeURIComponent(
        orderId
      )}/status`,
      token,
      {
        method: "PATCH",

        body: JSON.stringify({
          orderStatus,
          cancellationReason,
        }),
      }
    );

  return response.data.order;
}

export async function retryAdminOrderRefund(
  token: string,
  orderId: string
): Promise<AdminOrder> {
  const response =
    await request<AdminOrderResponse>(
      `/api/admin/orders/${encodeURIComponent(
        orderId
      )}/refund/retry`,
      token,
      {
        method: "POST",

        body: JSON.stringify(
          {}
        ),
      }
    );

  return response.data.order;
}