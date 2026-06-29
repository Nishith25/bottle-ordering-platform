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

export type DeliveryOrderStatusCounts = {
  assigned: number;
  picked_up: number;
  out_for_delivery: number;
  delivered: number;
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
};

type PartnersResponse = ApiResponse & {
  count: number;

  data: {
    partners: DeliveryPartner[];
  };
};

type PartnerResponse = ApiResponse & {
  data: {
    partner: DeliveryPartner;
  };
};

type OrderResponse = ApiResponse & {
  data: {
    order: AdminOrder;
  };
};

type DeliveryOrdersResponse =
  ApiResponse & {
    count: number;

    data: {
      orders: DeliveryOrder[];

      statusCounts:
        DeliveryOrderStatusCounts;
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
        Accept: "application/json",

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

  let payload: T & ApiResponse;

  try {
    payload = responseText
      ? JSON.parse(responseText)
      : ({
          success: response.ok,
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

export async function updateDeliveryOrderStatus(
  token: string,
  orderId: string,

  deliveryStatus:
    | "picked_up"
    | "out_for_delivery"
): Promise<DeliveryOrder> {
  const response = await request<
    ApiResponse & {
      data: {
        order: DeliveryOrder;
      };
    }
  >(
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

export async function verifyDeliveryOrderOtp(
  token: string,
  orderId: string,
  otp: string
): Promise<DeliveryOrder> {
  const response = await request<
    ApiResponse & {
      data: {
        order: DeliveryOrder;
      };
    }
  >(
    `/api/delivery/orders/${encodeURIComponent(
      orderId
    )}/verify-otp`,
    token,
    {
      method: "POST",

      body: JSON.stringify({
        otp,
      }),
    }
  );

  return response.data.order;
}