const API_BASE_URL = (
  import.meta.env.VITE_API_URL ??
  "http://localhost:5001"
).replace(/\/$/, "");

type ApiBaseResponse = {
  success: boolean;
  message?: string;
};

type ApiRequestOptions =
  RequestInit & {
    token?: string | null;
  };

export type UserRole =
  | "customer"
  | "admin"
  | "delivery";

export type DashboardRole =
  | "admin"
  | "delivery";

export type AdminUser = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  active: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminSession = {
  token: string;
  user: AdminUser;
};

export type DashboardTotals = {
  products: number;
  activeProducts: number;
  customers: number;
  activeLocations: number;
  orders: number;
  activeSubscriptions: number;
  orderValue: number;
  activeSubscriptionCycleValue: number;
};

export type DashboardData = {
  totals: DashboardTotals;

  orderStatusBreakdown: Record<
    string,
    number
  >;

  subscriptionStatusBreakdown: Record<
    string,
    number
  >;
};

export type ProductCategory =
  | "Hydrating"
  | "Fruity";

export type AdminProduct = {
  _id: string;
  productId: string;
  name: string;
  shortName: string;
  description: string;
  ingredients: string[];
  sizeMl: number;
  price: number;
  category: ProductCategory;
  imageUrl: string;
  liquidColor: string;
  cardColor: string;
  accentColor: string;
  subscriptionEligible: boolean;
  available: boolean;
  stockQuantity: number;
  lowStockThreshold: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type ProductPayload = {
  productId: string;
  name: string;
  shortName: string;
  description: string;
  ingredients: string[];
  sizeMl: number;
  price: number;
  category: ProductCategory;
  imageUrl: string;
  liquidColor: string;
  cardColor: string;
  accentColor: string;
  subscriptionEligible: boolean;
  available: boolean;
  stockQuantity: number;
  lowStockThreshold: number;
  sortOrder: number;
};

export type AdminDeliverySlotLocation = {
  _id: string;
  pincode: string;
  area: string;
  city: string;
  active: boolean;
};

export type AdminDeliverySlotConfiguration = {
  _id: string;
  slotCode: string;
  label: string;
  startMinutes: number;
  endMinutes: number;
  capacity: number;
  cutoffMinutes: number;
  weekdays: number[];

  serviceableLocation:
    | AdminDeliverySlotLocation
    | string
    | null;

  pincodeSnapshot: string;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminDeliverySlotAvailability = {
  id: string;
  slotCode: string;
  label: string;
  startMinutes: number;
  endMinutes: number;
  capacity: number;
  booked: number;
  remaining: number;
  cutoffMinutes: number;
  cutoffAt: string;
  weekdays: number[];
  available: boolean;

  reason:
    | ""
    | "not_scheduled"
    | "cutoff_passed"
    | "full";

  locationSpecific: boolean;
};

export type AdminDeliverySlotPreview = {
  location: {
    _id?: string;
    pincode: string;
    area: string;
    city: string;
    active: boolean;
  };

  deliveryDateId: string;
  slots: AdminDeliverySlotAvailability[];
};

export type AdminDeliverySlotsResult = {
  configurations: AdminDeliverySlotConfiguration[];

  preview:
    | AdminDeliverySlotPreview
    | null;
};

export type AdminDeliverySlotPayload = {
  slotCode: string;
  label: string;
  startMinutes: number;
  endMinutes: number;
  capacity: number;
  cutoffMinutes: number;
  weekdays: number[];
  active: boolean;
  sortOrder: number;
  pincode?: string;
};

type LoginResponse =
  ApiBaseResponse & {
    data: AdminSession;
  };

type CurrentUserResponse =
  ApiBaseResponse & {
    data: {
      user: AdminUser;
    };
  };

type DashboardResponse =
  ApiBaseResponse & {
    data: DashboardData;
  };

type ProductsResponse =
  ApiBaseResponse & {
    count: number;

    data: {
      products: AdminProduct[];
    };
  };

type ProductResponse =
  ApiBaseResponse & {
    data: {
      product: AdminProduct;
    };
  };

type DeliverySlotsResponse =
  ApiBaseResponse & {
    count: number;

    data: {
      configurations:
        AdminDeliverySlotConfiguration[];

      preview:
        | AdminDeliverySlotPreview
        | null;
    };
  };

type DeliverySlotResponse =
  ApiBaseResponse & {
    data: {
      slot:
        AdminDeliverySlotConfiguration;
    };
  };

function isDashboardRole(
  role: UserRole
): role is DashboardRole {
  return (
    role === "admin" ||
    role === "delivery"
  );
}

function normaliseProduct(
  product: AdminProduct
): AdminProduct {
  return {
    ...product,

    imageUrl:
      product.imageUrl ?? "",

    ingredients:
      product.ingredients ?? [],

    stockQuantity:
      product.stockQuantity ?? 0,

    lowStockThreshold:
      product.lowStockThreshold ?? 10,

    sortOrder:
      product.sortOrder ?? 0,
  };
}

function requireToken(
  token: string
) {
  if (!token.trim()) {
    throw new Error(
      "Dashboard authentication token is missing."
    );
  }
}

async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const controller =
    new AbortController();

  const timeoutId =
    window.setTimeout(() => {
      controller.abort();
    }, 12000);

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

  if (
    requestOptions.body &&
    !(requestOptions.body instanceof FormData)
  ) {
    requestHeaders[
      "Content-Type"
    ] = "application/json";
  }

  if (token) {
    requestHeaders.Authorization =
      `Bearer ${token}`;
  }

  if (headers) {
    Object.assign(
      requestHeaders,
      headers as Record<
        string,
        string
      >
    );
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}${path}`,
      {
        ...requestOptions,

        headers:
          requestHeaders,

        signal:
          controller.signal,
      }
    );

    const responseText =
      await response.text();

    let payload:
      T & ApiBaseResponse;

    try {
      payload = responseText
        ? JSON.parse(
            responseText
          )
        : ({
            success:
              response.ok,
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

export async function loginDashboardUser(
  identifier: string,
  password: string
): Promise<AdminSession> {
  const cleanedIdentifier =
    identifier.trim();

  if (!cleanedIdentifier) {
    throw new Error(
      "Enter your email address or mobile number."
    );
  }

  if (!password) {
    throw new Error(
      "Enter your password."
    );
  }

  const response =
    await apiRequest<LoginResponse>(
      "/api/auth/login",
      {
        method: "POST",

        body: JSON.stringify({
          identifier:
            cleanedIdentifier,

          password,
        }),
      }
    );

  const session =
    response.data;

  if (
    !session?.token ||
    !session.user
  ) {
    throw new Error(
      "The server returned an incomplete login response."
    );
  }

  if (
    !isDashboardRole(
      session.user.role
    )
  ) {
    throw new Error(
      "This account does not have access to the operations dashboard."
    );
  }

  if (!session.user.active) {
    throw new Error(
      "This dashboard account has been disabled."
    );
  }

  return session;
}

export async function fetchDashboardUser(
  token: string
): Promise<AdminUser> {
  requireToken(token);

  const response =
    await apiRequest<CurrentUserResponse>(
      "/api/auth/me",
      {
        token,
      }
    );

  const dashboardUser =
    response.data.user;

  if (!dashboardUser) {
    throw new Error(
      "The server returned an incomplete account response."
    );
  }

  if (
    !isDashboardRole(
      dashboardUser.role
    )
  ) {
    throw new Error(
      "This account does not have access to the operations dashboard."
    );
  }

  if (!dashboardUser.active) {
    throw new Error(
      "This dashboard account has been disabled."
    );
  }

  return dashboardUser;
}

export const loginAdmin =
  loginDashboardUser;

export const fetchAdminUser =
  fetchDashboardUser;

export async function fetchAdminDashboard(
  token: string
): Promise<DashboardData> {
  requireToken(token);

  const response =
    await apiRequest<DashboardResponse>(
      "/api/admin/dashboard",
      {
        token,
      }
    );

  return response.data;
}

export async function fetchAdminProducts(
  token: string
): Promise<AdminProduct[]> {
  requireToken(token);

  const response =
    await apiRequest<ProductsResponse>(
      "/api/admin/products",
      {
        token,
      }
    );

  return response.data.products.map(
    normaliseProduct
  );
}

async function updateInventory(
  token: string,
  productId: string,
  payload: {
    stockQuantity?: number;
    lowStockThreshold?: number;
    adjustment?: number;
  }
): Promise<AdminProduct> {
  requireToken(token);

  const response =
    await apiRequest<ProductResponse>(
      `/api/admin/inventory/${encodeURIComponent(
        productId
      )}`,
      {
        method: "PATCH",
        token,

        body: JSON.stringify(
          payload
        ),
      }
    );

  return normaliseProduct(
    response.data.product
  );
}

export async function createAdminProduct(
  token: string,
  payload: ProductPayload
): Promise<AdminProduct> {
  requireToken(token);

  const {
    stockQuantity,
    lowStockThreshold,
    ...cataloguePayload
  } = payload;

  const response =
    await apiRequest<ProductResponse>(
      "/api/admin/products",
      {
        method: "POST",
        token,

        body: JSON.stringify(
          cataloguePayload
        ),
      }
    );

  return updateInventory(
    token,
    response.data.product.productId,
    {
      stockQuantity,
      lowStockThreshold,
    }
  );
}

export async function updateAdminProduct(
  token: string,
  productId: string,
  payload:
    Partial<ProductPayload>
): Promise<AdminProduct> {
  requireToken(token);

  const {
    stockQuantity,
    lowStockThreshold,
    ...cataloguePayload
  } = payload;

  let latestProduct:
    AdminProduct | null = null;

  if (
    Object.keys(
      cataloguePayload
    ).length > 0
  ) {
    const response =
      await apiRequest<ProductResponse>(
        `/api/admin/products/${encodeURIComponent(
          productId
        )}`,
        {
          method: "PATCH",
          token,

          body: JSON.stringify(
            cataloguePayload
          ),
        }
      );

    latestProduct =
      normaliseProduct(
        response.data.product
      );
  }

  if (
    stockQuantity !==
      undefined ||
    lowStockThreshold !==
      undefined
  ) {
    latestProduct =
      await updateInventory(
        token,
        productId,
        {
          stockQuantity,
          lowStockThreshold,
        }
      );
  }

  if (!latestProduct) {
    throw new Error(
      "No product changes were provided."
    );
  }

  return latestProduct;
}

export async function adjustAdminProductStock(
  token: string,
  productId: string,
  adjustment: number
): Promise<AdminProduct> {
  requireToken(token);

  if (
    !Number.isFinite(
      adjustment
    ) ||
    adjustment === 0
  ) {
    throw new Error(
      "Enter a valid stock adjustment."
    );
  }

  if (
    !Number.isInteger(
      adjustment
    )
  ) {
    throw new Error(
      "Stock adjustment must be a whole number."
    );
  }

  return updateInventory(
    token,
    productId,
    {
      adjustment,
    }
  );
}

export async function archiveAdminProduct(
  token: string,
  productId: string
): Promise<AdminProduct> {
  requireToken(token);

  const response =
    await apiRequest<ProductResponse>(
      `/api/admin/products/${encodeURIComponent(
        productId
      )}`,
      {
        method: "DELETE",
        token,
      }
    );

  return normaliseProduct(
    response.data.product
  );
}

export async function fetchAdminDeliverySlots(
  token: string,
  options: {
    includeInactive?: boolean;
    pincode?: string;
    date?: string;
  } = {}
): Promise<AdminDeliverySlotsResult> {
  requireToken(token);

  const searchParams =
    new URLSearchParams();

  searchParams.set(
    "includeInactive",
    String(
      options.includeInactive ??
      true
    )
  );

  const cleanPincode =
    String(
      options.pincode ??
      ""
    )
      .replace(
        /\D/g,
        ""
      )
      .slice(
        0,
        6
      );

  if (
    cleanPincode
  ) {
    searchParams.set(
      "pincode",
      cleanPincode
    );
  }

  if (
    options.date
  ) {
    searchParams.set(
      "date",
      options.date
    );
  }

  const response =
    await apiRequest<DeliverySlotsResponse>(
      `/api/admin/delivery-slots?${searchParams.toString()}`,
      {
        token,
      }
    );

  return {
    configurations:
      response.data.configurations,

    preview:
      response.data.preview,
  };
}

export async function createAdminDeliverySlot(
  token: string,
  payload:
    AdminDeliverySlotPayload
): Promise<AdminDeliverySlotConfiguration> {
  requireToken(token);

  const response =
    await apiRequest<DeliverySlotResponse>(
      "/api/admin/delivery-slots",
      {
        method: "POST",
        token,

        body:
          JSON.stringify(
            payload
          ),
      }
    );

  return response.data.slot;
}

export async function updateAdminDeliverySlot(
  token: string,
  slotId: string,
  payload:
    Partial<AdminDeliverySlotPayload>
): Promise<AdminDeliverySlotConfiguration> {
  requireToken(token);

  if (
    !slotId.trim()
  ) {
    throw new Error(
      "Delivery-slot ID is missing."
    );
  }

  const response =
    await apiRequest<DeliverySlotResponse>(
      `/api/admin/delivery-slots/${encodeURIComponent(
        slotId.trim()
      )}`,
      {
        method: "PATCH",
        token,

        body:
          JSON.stringify(
            payload
          ),
      }
    );

  return response.data.slot;
}

export async function disableAdminDeliverySlot(
  token: string,
  slotId: string
): Promise<AdminDeliverySlotConfiguration> {
  requireToken(token);

  if (
    !slotId.trim()
  ) {
    throw new Error(
      "Delivery-slot ID is missing."
    );
  }

  const response =
    await apiRequest<DeliverySlotResponse>(
      `/api/admin/delivery-slots/${encodeURIComponent(
        slotId.trim()
      )}`,
      {
        method: "DELETE",
        token,
      }
    );

  return response.data.slot;
}

export {
  API_BASE_URL,
};