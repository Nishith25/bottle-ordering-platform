// admin-dashboard/src/services/api.ts

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

export type AdminUser = {
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
      products:
        AdminProduct[];
    };
  };

type ProductResponse =
  ApiBaseResponse & {
    data: {
      product:
        AdminProduct;
    };
  };

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

  if (requestOptions.body) {
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
        ? JSON.parse(responseText)
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

export async function loginAdmin(
  identifier: string,
  password: string
): Promise<AdminSession> {
  const response =
    await apiRequest<LoginResponse>(
      "/api/auth/login",
      {
        method: "POST",

        body: JSON.stringify({
          identifier,
          password,
        }),
      }
    );

  if (
    response.data.user.role !==
    "admin"
  ) {
    throw new Error(
      "This account does not have administrator access."
    );
  }

  return response.data;
}

export async function fetchAdminUser(
  token: string
): Promise<AdminUser> {
  const response =
    await apiRequest<CurrentUserResponse>(
      "/api/auth/me",
      {
        token,
      }
    );

  if (
    response.data.user.role !==
    "admin"
  ) {
    throw new Error(
      "This account does not have administrator access."
    );
  }

  return response.data.user;
}

export async function fetchAdminDashboard(
  token: string
): Promise<DashboardData> {
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
  const response =
    await apiRequest<ProductsResponse>(
      "/api/admin/products",
      {
        token,
      }
    );

  return response.data.products.map(
    (product) => ({
      ...product,

      stockQuantity:
        product.stockQuantity ??
        0,

      lowStockThreshold:
        product.lowStockThreshold ??
        10,
    })
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
  const response =
    await apiRequest<ProductResponse>(
      `/api/admin/inventory/${encodeURIComponent(
        productId
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

  return response.data.product;
}

export async function createAdminProduct(
  token: string,
  payload: ProductPayload
): Promise<AdminProduct> {
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

        body:
          JSON.stringify(
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

          body:
            JSON.stringify(
              cataloguePayload
            ),
        }
      );

    latestProduct =
      response.data.product;
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

  return response.data.product;
}

export { API_BASE_URL };