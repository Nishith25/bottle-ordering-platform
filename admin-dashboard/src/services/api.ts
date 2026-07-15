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

export type AdminInventoryMovement = {
  _id: string;
  product: string;
  productId: string;
  productName: string;

  movementType:
    | "reserve"
    | "restore"
    | "manual_adjustment"
    | "manual_set"
    | "threshold_update";

  direction:
    | "in"
    | "out"
    | "neutral";

  quantityChange: number;
  stockBefore: number;
  stockAfter: number;

  lowStockThresholdBefore:
    | number
    | null;

  lowStockThresholdAfter:
    | number
    | null;

  source: string;

  sourceType:
    | ""
    | "admin"
    | "order"
    | "payment_session"
    | "system";

  order:
    | string
    | null;

  orderNumber: string;

  paymentSession:
    | string
    | null;

  actor:
    | string
    | {
        _id: string;
        fullName?: string;
        email?: string;
        role?: string;
      }
    | null;

  actorSnapshot:
    | {
        fullName: string;
        email: string;
        role: string;
      }
    | null;

  reason: string;
  metadata: Record<string, unknown>;
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

export type ManagedUserRole =
  | "customer"
  | "admin";

export type AdminSavedAddress = {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  pincode: string;
  houseDetails: string;
  areaDetails: string;
  landmark: string;
  area: string;
  city: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminCustomerNote = {
  _id: string;
  customer: string;
  note: string;

  createdBy:
    | string
    | null;

  createdBySnapshot:
    | {
        fullName: string;
        email: string;
        role: string;
      }
    | null;

  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminManagedUser = {
  _id: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  active: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  savedAddressCount?: number;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  isCurrentAdmin: boolean;

  statistics: {
    orderCount: number;
    orderValue: number;
    bottleCount: number;
    codPendingAmount: number;
    codPaidAmount: number;
    subscriptionCount: number;
    activeSubscriptionCount: number;
  };
};

export type AdminUserSummary = {
  totalUsers: number;
  totalCustomers: number;
  totalAdmins: number;
  totalDeliveryPartners?: number;
  activeUsers: number;
  inactiveUsers: number;
};

export type AdminUsersResult = {
  users: AdminManagedUser[];
  summary: AdminUserSummary;
};

export type AdminCustomerOrderSummary = {
  _id: string;
  orderNumber: string;
  total: number;
  subtotal: number;
  deliveryFee: number;
  couponDiscount?: number;
  bottleCount: number;
  paymentMethod: "cod" | "online";
  paymentGateway?: "" | "razorpay";
  paymentStatus: string;
  orderStatus: string;
  deliveryStatus: string;

  deliveryAddress: {
    fullName?: string;
    phone?: string;
    pincode?: string;
    houseDetails?: string;
    areaDetails?: string;
    landmark?: string;
    area?: string;
    city?: string;
  };

  deliverySchedule: {
    deliveryDateId?: string;
    deliveryDateLabel?: string;
    deliverySlot?: string;
    deliverySlotCode?: string;
    deliverySlotStartMinutes?: number;
    deliverySlotEndMinutes?: number;
  };

  refundStatus?:
    | "not_required"
    | "pending"
    | "processed"
    | "failed"
    | string;

  refundFailureReason?: string;
  refundAttemptCount?: number;
  refundAmount?: number;
  refundRequestedAt?: string | null;
  refundProcessedAt?: string | null;
  refundFailedAt?: string | null;

  cancellationReason?: string;
  cancelledAt?: string | null;
  deliveredAt?: string | null;

  createdAt: string;
  updatedAt: string;
};

export type AdminCustomerSubscriptionSummary = {
  _id: string;
  subscriptionNumber: string;
  planName: string;
  status: string;
  billingCycle: string;
  totalPerCycle: number;
  nextBillingAt: string | null;
  createdAt: string;
};

export type AdminCustomerDetails = {
  user: AdminManagedUser & {
    savedAddresses: AdminSavedAddress[];
  };

  statistics: {
    totalOrders: number;
    activeOrders: number;
    deliveredOrders: number;
    cancelledOrders: number;
    totalRevenue: number;
    totalBottles: number;
    codPendingAmount: number;
    codPaidAmount: number;
    onlinePaidAmount: number;
    subscriptionCount: number;
    activeSubscriptionCount: number;
    pausedSubscriptionCount: number;
    cancelledSubscriptionCount: number;
    activeRecurringValue: number;
  };

  latestOrders: AdminCustomerOrderSummary[];

  latestSubscriptions:
    AdminCustomerSubscriptionSummary[];

  notes: AdminCustomerNote[];
};

export type AdminCashCollection = {
  _id: string;
  order: string;
  orderNumber: string;
  amountDue: number;
  amountCollected: number;

  status:
    | "pending"
    | "short_collected"
    | "collected"
    | "handed_over";

  collectedAt: string | null;

  collectedBySnapshot:
    | {
        fullName: string;
        email: string;
        role: string;
      }
    | null;

  handedOverAt: string | null;

  handedOverBySnapshot:
    | {
        fullName: string;
        email: string;
        role: string;
      }
    | null;

  notes: string;
  createdAt: string;
  updatedAt: string;
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

type InventoryMovementsResponse =
  ApiBaseResponse & {
    count: number;

    data: {
      movements:
        AdminInventoryMovement[];
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

type AdminUsersResponse =
  ApiBaseResponse & {
    count: number;

    data: {
      users: AdminManagedUser[];
      summary: AdminUserSummary;
    };
  };

type AdminUserMutationResponse =
  ApiBaseResponse & {
    data: {
      user: AdminManagedUser;
    };
  };

type AdminCustomerDetailsResponse =
  ApiBaseResponse & {
    data: {
      customer: AdminCustomerDetails;
    };
  };

type CustomerNoteResponse =
  ApiBaseResponse & {
    data: {
      note: AdminCustomerNote;
    };
  };

type PrintLinkResponse =
  ApiBaseResponse & {
    data: {
      printUrl: string;
      expiresIn: string;
    };
  };

type AdminOrderActionResponse =
  ApiBaseResponse & {
    data: {
      order: unknown;
    };
  };

type CollectionResponse =
  ApiBaseResponse & {
    data: {
      collection: AdminCashCollection;
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

function normaliseMovement(
  movement: AdminInventoryMovement
): AdminInventoryMovement {
  return {
    ...movement,

    quantityChange:
      Number(
        movement.quantityChange ??
          0
      ),

    stockBefore:
      Number(
        movement.stockBefore ??
          0
      ),

    stockAfter:
      Number(
        movement.stockAfter ??
          0
      ),

    lowStockThresholdBefore:
      movement.lowStockThresholdBefore ===
        null ||
      movement.lowStockThresholdBefore ===
        undefined
        ? null
        : Number(
            movement.lowStockThresholdBefore
          ),

    lowStockThresholdAfter:
      movement.lowStockThresholdAfter ===
        null ||
      movement.lowStockThresholdAfter ===
        undefined
        ? null
        : Number(
            movement.lowStockThresholdAfter
          ),

    productName:
      movement.productName ||
      movement.productId,

    reason:
      movement.reason ?? "",

    source:
      movement.source ?? "",

    orderNumber:
      movement.orderNumber ?? "",

    metadata:
      movement.metadata ?? {},
  };
}

function normaliseManagedUser(
  user: AdminManagedUser
): AdminManagedUser {
  return {
    ...user,

    savedAddressCount:
      user.savedAddressCount ?? 0,

    statistics: {
      orderCount:
        Number(
          user.statistics
            ?.orderCount ?? 0
        ),

      orderValue:
        Number(
          user.statistics
            ?.orderValue ?? 0
        ),

      bottleCount:
        Number(
          user.statistics
            ?.bottleCount ?? 0
        ),

      codPendingAmount:
        Number(
          user.statistics
            ?.codPendingAmount ?? 0
        ),

      codPaidAmount:
        Number(
          user.statistics
            ?.codPaidAmount ?? 0
        ),

      subscriptionCount:
        Number(
          user.statistics
            ?.subscriptionCount ?? 0
        ),

      activeSubscriptionCount:
        Number(
          user.statistics
            ?.activeSubscriptionCount ?? 0
        ),
    },
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
    const response =
      await fetch(
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
      payload =
        responseText
          ? JSON.parse(
              responseText
            )
          : ({
              success:
                response.ok,
            } as T &
              ApiBaseResponse);
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

export async function fetchAdminInventoryMovements(
  token: string,
  options: {
    productId?: string;
    limit?: number;
  } = {}
): Promise<AdminInventoryMovement[]> {
  requireToken(token);

  const params =
    new URLSearchParams();

  if (
    options.productId &&
    options.productId !== "all"
  ) {
    params.set(
      "productId",
      options.productId
    );
  }

  if (options.limit) {
    params.set(
      "limit",
      String(options.limit)
    );
  }

  const query =
    params.toString();

  const response =
    await apiRequest<InventoryMovementsResponse>(
      `/api/admin/inventory/movements${
        query ? `?${query}` : ""
      }`,
      {
        token,
      }
    );

  return response.data.movements.map(
    normaliseMovement
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
      options.pincode ?? ""
    )
      .replace(/\D/g, "")
      .slice(0, 6);

  if (cleanPincode) {
    searchParams.set(
      "pincode",
      cleanPincode
    );
  }

  if (options.date) {
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
  payload: AdminDeliverySlotPayload
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

  if (!slotId.trim()) {
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

  if (!slotId.trim()) {
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

export async function fetchAdminUsers(
  token: string,
  options: {
    role?: string;
    status?: string;
    search?: string;
  } = {}
): Promise<AdminUsersResult> {
  requireToken(token);

  const params =
    new URLSearchParams();

  if (options.role) {
    params.set(
      "role",
      options.role
    );
  }

  if (options.status) {
    params.set(
      "status",
      options.status
    );
  }

  const search =
    options.search?.trim();

  if (search) {
    params.set(
      "search",
      search
    );
  }

  const query =
    params.toString();

  const response =
    await apiRequest<AdminUsersResponse>(
      `/api/admin/users${
        query ? `?${query}` : ""
      }`,
      {
        token,
      }
    );

  return {
    users:
      response.data.users.map(
        normaliseManagedUser
      ),

    summary:
      response.data.summary,
  };
}

export async function fetchAdminUserDetails(
  token: string,
  userId: string
): Promise<AdminCustomerDetails> {
  requireToken(token);

  if (!userId.trim()) {
    throw new Error(
      "User ID is missing."
    );
  }

  const response =
    await apiRequest<AdminCustomerDetailsResponse>(
      `/api/admin/users/${encodeURIComponent(
        userId.trim()
      )}`,
      {
        token,
      }
    );

  return {
    ...response.data.customer,

    user:
      normaliseManagedUser(
        response.data.customer.user
      ) as AdminCustomerDetails["user"],

    notes:
      response.data.customer.notes ?? [],
  };
}

export async function createAdminCustomerNote(
  token: string,
  userId: string,
  note: string
): Promise<AdminCustomerNote> {
  requireToken(token);

  if (!userId.trim()) {
    throw new Error(
      "User ID is missing."
    );
  }

  const cleanNote =
    note.trim();

  if (cleanNote.length < 3) {
    throw new Error(
      "Customer note must contain at least 3 characters."
    );
  }

  const response =
    await apiRequest<CustomerNoteResponse>(
      `/api/admin/users/${encodeURIComponent(
        userId.trim()
      )}/notes`,
      {
        method: "POST",
        token,

        body: JSON.stringify({
          note: cleanNote,
        }),
      }
    );

  return response.data.note;
}

export async function updateAdminUserStatus(
  token: string,
  userId: string,
  active: boolean
): Promise<AdminManagedUser> {
  requireToken(token);

  if (!userId.trim()) {
    throw new Error(
      "User ID is missing."
    );
  }

  const response =
    await apiRequest<AdminUserMutationResponse>(
      `/api/admin/users/${encodeURIComponent(
        userId.trim()
      )}/status`,
      {
        method: "PATCH",
        token,

        body: JSON.stringify({
          active,
        }),
      }
    );

  return normaliseManagedUser(
    response.data.user
  );
}

export async function updateAdminUserRole(
  token: string,
  userId: string,
  role: ManagedUserRole
): Promise<AdminManagedUser> {
  requireToken(token);

  if (!userId.trim()) {
    throw new Error(
      "User ID is missing."
    );
  }

  const response =
    await apiRequest<AdminUserMutationResponse>(
      `/api/admin/users/${encodeURIComponent(
        userId.trim()
      )}/role`,
      {
        method: "PATCH",
        token,

        body: JSON.stringify({
          role,
        }),
      }
    );

  return normaliseManagedUser(
    response.data.user
  );
}

export async function createAdminCustomerInvoicePrintLink(
  token: string,
  orderRef: string
): Promise<string> {
  requireToken(token);

  if (!orderRef.trim()) {
    throw new Error(
      "Order reference is missing."
    );
  }

  const response =
    await apiRequest<PrintLinkResponse>(
      `/api/invoices/orders/${encodeURIComponent(
        orderRef.trim()
      )}/print-link`,
      {
        method: "POST",
        token,
      }
    );

  const printUrl =
    response.data.printUrl;

  if (
    printUrl.startsWith("http://") ||
    printUrl.startsWith("https://")
  ) {
    return printUrl;
  }

  return `${API_BASE_URL}${printUrl}`;
}

export async function markAdminCustomerOrderCodCollected(
  token: string,
  orderId: string,
  payload: {
    amountCollected: number;
    notes?: string;
  }
): Promise<AdminCashCollection> {
  requireToken(token);

  if (!orderId.trim()) {
    throw new Error(
      "Order ID is missing."
    );
  }

  const response =
    await apiRequest<CollectionResponse>(
      `/api/admin/operations/orders/${encodeURIComponent(
        orderId.trim()
      )}/cod-collected`,
      {
        method: "PATCH",
        token,

        body: JSON.stringify({
          amountCollected:
            payload.amountCollected,

          notes:
            payload.notes ?? "",
        }),
      }
    );

  return response.data.collection;
}

export async function cancelAdminCustomerOrder(
  token: string,
  orderId: string,
  reason =
    "Cancelled by administrator"
): Promise<void> {
  requireToken(token);

  if (!orderId.trim()) {
    throw new Error(
      "Order ID is missing."
    );
  }

  await apiRequest<AdminOrderActionResponse>(
    `/api/admin/orders/${encodeURIComponent(
      orderId.trim()
    )}/status`,
    {
      method: "PATCH",
      token,

      body: JSON.stringify({
        orderStatus: "cancelled",
        cancellationReason:
          reason.trim() ||
          "Cancelled by administrator",
      }),
    }
  );
}

export async function retryAdminCustomerOrderRefund(
  token: string,
  orderId: string
): Promise<void> {
  requireToken(token);

  if (!orderId.trim()) {
    throw new Error(
      "Order ID is missing."
    );
  }

  await apiRequest<AdminOrderActionResponse>(
    `/api/admin/orders/${encodeURIComponent(
      orderId.trim()
    )}/refund/retry`,
    {
      method: "POST",
      token,
      body: JSON.stringify({}),
    }
  );
}

export {
  API_BASE_URL,
};