// customer-app/src/services/api.ts

import type {
  Product,
  ProductCategory,
} from "../data/products";

const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL ??
  "http://localhost:5001"
).replace(/\/$/, "");

type ApiBaseResponse = {
  success: boolean;
  message?: string;
};

type ApiRequestOptions = RequestInit & {
  token?: string | null;
};

type BackendProduct = {
  _id: string;
  productId: string;
  name: string;
  shortName: string;
  description: string;
  ingredients: string[];
  sizeMl: number;
  price: number;
  category: ProductCategory;
  imageUrl?: string;
  liquidColor: string;
  cardColor: string;
  accentColor: string;
  subscriptionEligible: boolean;
  available: boolean;
  sortOrder?: number;
};

type ProductsResponse = ApiBaseResponse & {
  count: number;
  data: BackendProduct[];
};

type LocationCheckResponse = ApiBaseResponse & {
  serviceable: boolean;
  data: ServiceableLocation | null;
};

type AuthResponse = ApiBaseResponse & {
  data: AuthSession;
};

type CurrentUserResponse = ApiBaseResponse & {
  data: {
    user: AuthUser;
  };
};

type CreateOrderResponse = ApiBaseResponse & {
  data: {
    order: CustomerOrder;
  };
};

type MyOrdersResponse = ApiBaseResponse & {
  count: number;
  data: {
    orders: CustomerOrder[];
  };
};

type SingleOrderResponse = ApiBaseResponse & {
  data: {
    order: CustomerOrder;
  };
};

export type ServiceableLocation = {
  _id?: string;
  pincode: string;
  area: string;
  city: string;
  active: boolean;
  deliveryFee: number;
  minimumOrder: number;
  sortOrder?: number;
};

export type PincodeCheckResult = {
  serviceable: boolean;
  message: string;
  location: ServiceableLocation | null;
};

export type AuthUser = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: "customer" | "admin";
  active: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AuthSession = {
  token: string;
  user: AuthUser;
};

export type RegisterInput = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
};

export type LoginInput = {
  identifier: string;
  password: string;
};

export type OrderPaymentMethod =
  | "cod"
  | "online";

export type OrderPaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "refunded";

export type OrderStatus =
  | "placed"
  | "confirmed"
  | "preparing"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export type CustomerOrderItem = {
  product: string;
  productId: string;
  name: string;
  shortName: string;
  sizeMl: number;
  price: number;
  quantity: number;
  lineTotal: number;
};

export type OrderDeliveryAddress = {
  fullName: string;
  phone: string;
  pincode: string;
  houseDetails: string;
  areaDetails: string;
  landmark: string;
  area: string;
  city: string;
};

export type OrderDeliverySchedule = {
  deliveryDateId: string;
  deliveryDateLabel: string;
  deliverySlot: string;
};

export type CustomerOrder = {
  _id: string;
  orderNumber: string;
  user: string;
  items: CustomerOrderItem[];
  deliveryAddress: OrderDeliveryAddress;
  deliverySchedule: OrderDeliverySchedule;
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: OrderPaymentMethod;
  paymentStatus: OrderPaymentStatus;
  paymentReference: string;
  orderStatus: OrderStatus;
  cancellationReason: string;
  cancelledAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateOrderInput = {
  items: Array<{
    productId: string;
    quantity: number;
  }>;

  deliveryAddress: {
    fullName: string;
    phone: string;
    pincode: string;
    houseDetails: string;
    areaDetails: string;
    landmark: string;
  };

  deliverySchedule: {
    deliveryDateId: string;
    deliveryDateLabel: string;
    deliverySlot: string;
  };

  paymentMethod: OrderPaymentMethod;
};

async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 10000);

  const {
    token,
    headers,
    ...requestOptions
  } = options;

  const requestHeaders: Record<
    string,
    string
  > = {
    Accept: "application/json",
  };

  if (requestOptions.body) {
    requestHeaders["Content-Type"] =
      "application/json";
  }

  if (token) {
    requestHeaders.Authorization =
      `Bearer ${token}`;
  }

  if (headers) {
    Object.assign(
      requestHeaders,
      headers as Record<string, string>
    );
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}${path}`,
      {
        ...requestOptions,
        headers: requestHeaders,
        signal: controller.signal,
      }
    );

    const responseText =
      await response.text();

    let payload: ApiBaseResponse & T;

    try {
      payload = responseText
        ? JSON.parse(responseText)
        : ({
            success: response.ok,
          } as ApiBaseResponse & T);
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
    clearTimeout(timeoutId);
  }
}

function normaliseProduct(
  product: BackendProduct
): Product {
  return {
    id: product.productId,
    databaseId: product._id,
    name: product.name,
    shortName: product.shortName,
    description: product.description,
    ingredients:
      product.ingredients ?? [],
    sizeMl: product.sizeMl,
    price: product.price,
    category: product.category,
    imageUrl: product.imageUrl ?? "",
    liquidColor: product.liquidColor,
    cardColor: product.cardColor,
    accentColor: product.accentColor,
    subscriptionEligible:
      product.subscriptionEligible,
    available: product.available,
    sortOrder: product.sortOrder ?? 0,
  };
}

export async function fetchProducts(): Promise<
  Product[]
> {
  const response =
    await apiRequest<ProductsResponse>(
      "/api/products"
    );

  return response.data.map(normaliseProduct);
}

export async function checkServiceablePincode(
  pincode: string
): Promise<PincodeCheckResult> {
  const normalisedPincode =
    pincode.replace(/\D/g, "");

  if (normalisedPincode.length !== 6) {
    throw new Error(
      "Please enter a valid six-digit pincode."
    );
  }

  const response =
    await apiRequest<LocationCheckResponse>(
      `/api/locations/check/${normalisedPincode}`
    );

  return {
    serviceable: response.serviceable,

    message:
      response.message ??
      (response.serviceable
        ? "Delivery is available."
        : "Delivery is not available."),

    location: response.data,
  };
}

export async function registerCustomer(
  input: RegisterInput
): Promise<AuthSession> {
  const response =
    await apiRequest<AuthResponse>(
      "/api/auth/register",
      {
        method: "POST",
        body: JSON.stringify(input),
      }
    );

  return response.data;
}

export async function loginCustomer(
  input: LoginInput
): Promise<AuthSession> {
  const response =
    await apiRequest<AuthResponse>(
      "/api/auth/login",
      {
        method: "POST",
        body: JSON.stringify(input),
      }
    );

  return response.data;
}

export async function fetchCurrentUser(
  token: string
): Promise<AuthUser> {
  const response =
    await apiRequest<CurrentUserResponse>(
      "/api/auth/me",
      {
        token,
      }
    );

  return response.data.user;
}

export async function createCustomerOrder(
  token: string,
  input: CreateOrderInput
): Promise<CustomerOrder> {
  const response =
    await apiRequest<CreateOrderResponse>(
      "/api/orders",
      {
        method: "POST",
        token,
        body: JSON.stringify(input),
      }
    );

  return response.data.order;
}

export async function fetchMyOrders(
  token: string
): Promise<CustomerOrder[]> {
  const response =
    await apiRequest<MyOrdersResponse>(
      "/api/orders/my",
      {
        token,
      }
    );

  return response.data.orders;
}

export async function fetchOrderById(
  token: string,
  orderId: string
): Promise<CustomerOrder> {
  const response =
    await apiRequest<SingleOrderResponse>(
      `/api/orders/${encodeURIComponent(
        orderId
      )}`,
      {
        token,
      }
    );

  return response.data.order;
}

export async function cancelCustomerOrder(
  token: string,
  orderId: string,
  reason = "Cancelled by customer"
): Promise<CustomerOrder> {
  const response =
    await apiRequest<SingleOrderResponse>(
      `/api/orders/${encodeURIComponent(
        orderId
      )}/cancel`,
      {
        method: "PATCH",
        token,
        body: JSON.stringify({
          reason,
        }),
      }
    );

  return response.data.order;
}

export { API_BASE_URL };