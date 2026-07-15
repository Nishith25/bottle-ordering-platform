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

export type UserRole =
  | "customer"
  | "admin"
  | "delivery";

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
  stockQuantity?: number;
  lowStockThreshold?: number;
  sortOrder?: number;
};

type ProductsResponse =
  ApiBaseResponse & {
    count: number;
    data: BackendProduct[];
  };

type LocationCheckResponse =
  ApiBaseResponse & {
    serviceable: boolean;
    data: ServiceableLocation | null;
  };

type DeliverySlotAvailabilityResponse =
  ApiBaseResponse & {
    count: number;

    data: {
      location: ServiceableLocation;
      deliveryDateId: string;
      slots: DeliverySlotAvailability[];
    };
  };

type AuthResponse =
  ApiBaseResponse & {
    data: AuthSession;
  };

type CurrentUserResponse =
  ApiBaseResponse & {
    data: {
      user: AuthUser;
    };
  };

type SavedAddressMutationResponse =
  ApiBaseResponse & {
    data: {
      user: AuthUser;
      address?: SavedDeliveryAddress;
    };
  };

type CouponValidationResponse =
  ApiBaseResponse & {
    data: {
      coupon: CouponQuote;
    };
  };

type CreateOrderResponse =
  ApiBaseResponse & {
    data: {
      order: CustomerOrder;
    };
  };

type RazorpayInitiateResponse =
  ApiBaseResponse & {
    data: {
      paymentSession: RazorpayPaymentSession;
    };
  };

type RazorpayStatusResponse =
  ApiBaseResponse & {
    data: {
      status: RazorpayPaymentSessionStatus;
      order: CustomerOrder | null;
      message?: string;
      inventoryRestored?: boolean;
    };
  };

type MyOrdersResponse =
  ApiBaseResponse & {
    count: number;

    data: {
      orders: CustomerOrder[];
    };
  };

type SingleOrderResponse =
  ApiBaseResponse & {
    data: {
      order: CustomerOrder;
    };
  };

type CustomerDeliveryTrackingResponse =
  ApiBaseResponse & {
    data: {
      order: CustomerOrder;
      deliveryOtp: string;
    };
  };

type MyOrderReviewsResponse =
  ApiBaseResponse & {
    count: number;

    data: {
      reviews: OrderReview[];
    };
  };

type SingleOrderReviewResponse =
  ApiBaseResponse & {
    data: {
      review: OrderReview;
    };
  };

type OrderReviewLookupResponse =
  ApiBaseResponse & {
    data: {
      review: OrderReview | null;
    };
  };

type SubscriptionPlansResponse =
  ApiBaseResponse & {
    count: number;

    data: {
      plans: SubscriptionPlan[];
    };
  };

type CreateSubscriptionResponse =
  ApiBaseResponse & {
    data: {
      subscription: CustomerSubscription;
    };
  };

type MySubscriptionsResponse =
  ApiBaseResponse & {
    count: number;

    data: {
      subscriptions: CustomerSubscription[];
    };
  };

type SingleSubscriptionResponse =
  ApiBaseResponse & {
    data: {
      subscription: CustomerSubscription;
    };
  };

export type CouponContext =
  | "order"
  | "subscription";

export type CouponDiscountType =
  | "fixed"
  | "percentage";

export type CouponAppliesTo =
  | "order"
  | "subscription"
  | "both";

export type CouponQuote = {
  code: string;
  description: string;
  discountType: CouponDiscountType;
  discountValue: number;
  maxDiscountAmount: number;
  minimumOrder: number;
  appliesTo: CouponAppliesTo;
  eligibleAmount: number;
  discountAmount: number;
  finalEligibleAmount: number;
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

export type DeliverySlotUnavailableReason =
  | ""
  | "not_scheduled"
  | "cutoff_passed"
  | "full";

export type DeliverySlotAvailability = {
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
  reason: DeliverySlotUnavailableReason;
  locationSpecific: boolean;
};

export type DeliverySlotAvailabilityResult = {
  location: ServiceableLocation;
  deliveryDateId: string;
  slots: DeliverySlotAvailability[];
};

export type SavedDeliveryAddress = {
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

export type SavedDeliveryAddressInput = {
  label?: string;
  fullName: string;
  phone: string;
  pincode: string;
  houseDetails: string;
  areaDetails: string;
  landmark?: string;
  area: string;
  city: string;
  isDefault?: boolean;
};

export type UpdateSavedDeliveryAddressInput =
  Partial<SavedDeliveryAddressInput>;

export type AuthUser = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  active: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  savedAddresses: SavedDeliveryAddress[];
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

export type OrderPaymentGateway =
  | ""
  | "razorpay";

export type RefundStatus =
  | "not_required"
  | "pending"
  | "processed"
  | "failed";

export type DeliveryStatus =
  | "unassigned"
  | "assigned"
  | "picked_up"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export type DeliveryPartnerSummary = {
  _id?: string;
  id?: string;
  fullName: string;
  email: string;
  phone: string;
  role?: "delivery";
  active?: boolean;
};

export type CustomerDeliveryTracking = {
  order: CustomerOrder;
  deliveryOtp: string;
};

export type StoredCouponSnapshot = {
  couponId?: string | null;
  code: string;
  description: string;

  discountType:
    | ""
    | CouponDiscountType;

  discountValue: number;
  maxDiscountAmount: number;
  minimumOrder: number;

  appliesTo:
    | ""
    | CouponAppliesTo;

  eligibleAmount: number;
  discountAmount: number;
};

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
  deliverySlotCode?: string;
  deliverySlotId?: string | null;
  deliverySlotStartMinutes?: number | null;
  deliverySlotEndMinutes?: number | null;
  deliverySlotCutoffMinutes?: number | null;
  deliverySlotCapacitySnapshot?: number | null;
  deliverySlotReservationToken?: string;
};

export type CustomerOrder = {
  _id: string;
  orderNumber: string;

  user:
    | string
    | {
        _id?: string;
        id?: string;
        fullName?: string;
        phone?: string;
      };

  items: CustomerOrderItem[];

  deliveryAddress: OrderDeliveryAddress;
  deliverySchedule: OrderDeliverySchedule;

  subtotal: number;
  deliveryFee: number;

  amountBeforeDiscount?: number;
  couponDiscount?: number;
  coupon?: StoredCouponSnapshot | null;

  total: number;

  paymentMethod: OrderPaymentMethod;
  paymentGateway?: OrderPaymentGateway;
  paymentGatewayOrderId?: string;
  paymentStatus: OrderPaymentStatus;
  paymentReference: string;
  paidAt?: string | null;

  orderStatus: OrderStatus;

  deliveryPartner?:
    | DeliveryPartnerSummary
    | string
    | null;

  deliveryPartnerSnapshot?: {
    fullName: string;
    email: string;
    phone: string;
  } | null;

  deliveryStatus?: DeliveryStatus;
  deliveryAssignedAt?: string | null;
  pickedUpAt?: string | null;
  outForDeliveryAt?: string | null;
  deliveryCompletedAt?: string | null;
  deliveryOtpGeneratedAt?: string | null;
  deliveryOtpVerifiedAt?: string | null;

  cancellationReason: string;
  cancelledAt: string | null;
  deliveredAt: string | null;

  refundStatus?: RefundStatus;
  refundId?: string;
  refundAmount?: number;
  refundAmountPaise?: number;
  refundRequestedAt?: string | null;
  refundProcessedAt?: string | null;
  refundFailedAt?: string | null;
  refundFailureReason?: string;
  refundAttemptCount?: number;

  inventoryReserved?: boolean;
  inventoryRestored?: boolean;
  inventoryRestoredAt?: string | null;

  createdAt: string;
  updatedAt: string;
};

export type OrderReviewPerson = {
  _id?: string;
  id?: string;
  fullName: string;
  email: string;
  phone: string;
  role?: UserRole;
  active?: boolean;
};

export type OrderReview = {
  _id: string;

  order: string;
  orderNumber: string;

  user:
    | string
    | OrderReviewPerson;

  customerSnapshot: {
    fullName: string;
    email: string;
    phone: string;
  };

  deliveryPartner:
    | string
    | OrderReviewPerson;

  deliveryPartnerSnapshot: {
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

export type CreateOrderReviewInput = {
  orderRating: number;
  deliveryRating: number;
  comment?: string;
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
    deliverySlotCode: string;
  };

  paymentMethod: OrderPaymentMethod;
  couponCode?: string;
};

export type RazorpayPaymentSessionStatus =
  | "gateway_creating"
  | "created"
  | "abandoned"
  | "paid"
  | "failed"
  | "expired";

export type RazorpayPaymentSession = {
  sessionToken: string;
  razorpayOrderId: string;
  amount: number;
  amountPaise: number;
  currency: string;
  expiresAt: string;
  checkoutUrl: string;
};

export type InitiateRazorpayPaymentInput = {
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
    deliverySlotCode: string;
  };

  couponCode?: string;
  returnUrl: string;
};

export type RazorpayPaymentStatusResult = {
  status: RazorpayPaymentSessionStatus;
  order: CustomerOrder | null;
  message: string;
  inventoryRestored: boolean;
};

export type SubscriptionBillingCycle =
  | "weekly"
  | "monthly";

export type SubscriptionPaymentMethod =
  | "upi_autopay"
  | "card_mandate";

export type SubscriptionStatus =
  | "active"
  | "paused"
  | "cancelled"
  | "expired";

export type SubscriptionPaymentStatus =
  | "demo_confirmed"
  | "mandate_pending"
  | "active"
  | "failed"
  | "cancelled";

export type SubscriptionPlan = {
  _id: string;
  planId: string;
  name: string;
  description: string;
  billingCycle: SubscriptionBillingCycle;
  bottleCount: number;
  deliveriesPerCycle: number;
  discountPercent: number;
  badge: string;
  features: string[];
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type SubscriptionItem = {
  product: string;
  productId: string;
  name: string;
  shortName: string;
  sizeMl: number;
  price: number;
  quantity: number;
  lineTotal: number;
};

export type SubscriptionDeliveryAddress = {
  fullName: string;
  phone: string;
  pincode: string;
  houseDetails: string;
  areaDetails: string;
  landmark: string;
  area: string;
  city: string;
};

export type CustomerSubscription = {
  _id: string;
  subscriptionNumber: string;
  user: string;
  plan: string;
  planId: string;
  planName: string;
  billingCycle: SubscriptionBillingCycle;
  bottleCount: number;
  deliveriesPerCycle: number;
  items: SubscriptionItem[];
  preferredDay: string;
  preferredSlot: string;
  deliveryAddress: SubscriptionDeliveryAddress;
  originalTotal: number;
  discountPercent: number;
  savings: number;
  amountBeforeCoupon?: number;
  couponDiscount?: number;
  coupon?: StoredCouponSnapshot | null;
  totalPerCycle: number;
  recurringTotalPerCycle?: number;
  paymentMethod: SubscriptionPaymentMethod;
  paymentStatus: SubscriptionPaymentStatus;
  paymentReference: string;
  status: SubscriptionStatus;
  startDate: string;
  nextBillingAt: string;
  cancelledAt: string | null;
  cancellationReason: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateSubscriptionInput = {
  planId: string;

  items: Array<{
    productId: string;
    quantity: number;
  }>;

  preferredDay: string;
  preferredSlot: string;

  deliveryAddress: {
    fullName: string;
    phone: string;
    pincode: string;
    houseDetails: string;
    areaDetails: string;
    landmark: string;
  };

  couponCode?: string;
  paymentMethod: SubscriptionPaymentMethod;
};

function hasFormDataBody(
  body: RequestInit["body"]
) {
  return (
    typeof FormData !== "undefined" &&
    body instanceof FormData
  );
}

async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const controller =
    new AbortController();

  const timeoutId = setTimeout(() => {
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
    !hasFormDataBody(
      requestOptions.body
    )
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
        headers: requestHeaders,
        signal: controller.signal,
      }
    );

    const responseText =
      await response.text();

    let payload:
      ApiBaseResponse & T;

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
    ingredients: product.ingredients ?? [],
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
      "Authentication is required. Please log in."
    );
  }
}

function requireIdentifier(
  value: string,
  message: string
) {
  if (!value.trim()) {
    throw new Error(message);
  }
}

export async function fetchProducts(): Promise<
  Product[]
> {
  const response =
    await apiRequest<ProductsResponse>(
      "/api/products"
    );

  return response.data.map(
    normaliseProduct
  );
}

export async function checkServiceablePincode(
  pincode: string
): Promise<PincodeCheckResult> {
  const normalisedPincode =
    pincode.replace(/\D/g, "");

  if (
    normalisedPincode.length !== 6
  ) {
    throw new Error(
      "Please enter a valid six-digit pincode."
    );
  }

  const response =
    await apiRequest<LocationCheckResponse>(
      `/api/locations/check/${normalisedPincode}`
    );

  return {
    serviceable:
      response.serviceable,

    message:
      response.message ??
      (response.serviceable
        ? "Delivery is available."
        : "Delivery is not available."),

    location:
      response.data,
  };
}

export async function fetchDeliverySlotAvailability(
  pincode: string,
  deliveryDateId: string
): Promise<DeliverySlotAvailabilityResult> {
  const normalisedPincode =
    pincode.replace(/\D/g, "");

  if (
    normalisedPincode.length !== 6
  ) {
    throw new Error(
      "Please enter a valid six-digit pincode."
    );
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      deliveryDateId.trim()
    )
  ) {
    throw new Error(
      "Select a valid delivery date."
    );
  }

  const response =
    await apiRequest<DeliverySlotAvailabilityResponse>(
      `/api/delivery-slots/availability?pincode=${encodeURIComponent(
        normalisedPincode
      )}&date=${encodeURIComponent(
        deliveryDateId.trim()
      )}`
    );

  return {
    location:
      response.data.location,

    deliveryDateId:
      response.data.deliveryDateId,

    slots:
      response.data.slots,
  };
}

export async function validateCoupon(
  input: {
    code: string;
    context: CouponContext;
    eligibleAmount: number;
  }
): Promise<CouponQuote> {
  const code =
    input.code
      .trim()
      .toUpperCase();

  if (!code) {
    throw new Error(
      "Enter a coupon code."
    );
  }

  if (
    !Number.isFinite(
      input.eligibleAmount
    ) ||
    input.eligibleAmount <= 0
  ) {
    throw new Error(
      "A valid order amount is required to apply a coupon."
    );
  }

  const response =
    await apiRequest<CouponValidationResponse>(
      "/api/coupons/validate",
      {
        method: "POST",

        body: JSON.stringify({
          ...input,
          code,
        }),
      }
    );

  return response.data.coupon;
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
  requireToken(token);

  const response =
    await apiRequest<CurrentUserResponse>(
      "/api/auth/me",
      {
        token,
      }
    );

  return response.data.user;
}

export async function saveCustomerAddress(
  token: string,
  input: SavedDeliveryAddressInput
): Promise<{
  user: AuthUser;
  address?: SavedDeliveryAddress;
}> {
  requireToken(token);

  const response =
    await apiRequest<SavedAddressMutationResponse>(
      "/api/auth/addresses",
      {
        method: "POST",
        token,
        body: JSON.stringify(input),
      }
    );

  return response.data;
}

export async function updateCustomerAddress(
  token: string,
  addressId: string,
  input: UpdateSavedDeliveryAddressInput
): Promise<{
  user: AuthUser;
  address?: SavedDeliveryAddress;
}> {
  requireToken(token);

  requireIdentifier(
    addressId,
    "Address ID is missing."
  );

  const response =
    await apiRequest<SavedAddressMutationResponse>(
      `/api/auth/addresses/${encodeURIComponent(
        addressId.trim()
      )}`,
      {
        method: "PATCH",
        token,
        body: JSON.stringify(input),
      }
    );

  return response.data;
}

export async function deleteCustomerAddress(
  token: string,
  addressId: string
): Promise<AuthUser> {
  requireToken(token);

  requireIdentifier(
    addressId,
    "Address ID is missing."
  );

  const response =
    await apiRequest<SavedAddressMutationResponse>(
      `/api/auth/addresses/${encodeURIComponent(
        addressId.trim()
      )}`,
      {
        method: "DELETE",
        token,
      }
    );

  return response.data.user;
}

export async function createCustomerOrder(
  token: string,
  input: CreateOrderInput
): Promise<CustomerOrder> {
  requireToken(token);

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

export async function initiateRazorpayPayment(
  token: string,
  input: InitiateRazorpayPaymentInput
): Promise<RazorpayPaymentSession> {
  requireToken(token);

  const response =
    await apiRequest<RazorpayInitiateResponse>(
      "/api/payments/razorpay/initiate",
      {
        method: "POST",
        token,
        body: JSON.stringify(input),
      }
    );

  return response.data.paymentSession;
}

export async function fetchRazorpayPaymentStatus(
  token: string,
  sessionToken: string
): Promise<RazorpayPaymentStatusResult> {
  requireToken(token);

  requireIdentifier(
    sessionToken,
    "Payment session token is missing."
  );

  const response =
    await apiRequest<RazorpayStatusResponse>(
      `/api/payments/razorpay/status/${encodeURIComponent(
        sessionToken.trim()
      )}`,
      {
        token,
      }
    );

  return {
    status: response.data.status,
    order: response.data.order,
    message:
      response.data.message ?? "",
    inventoryRestored:
      response.data.inventoryRestored ??
      false,
  };
}

export async function fetchMyOrders(
  token: string
): Promise<CustomerOrder[]> {
  requireToken(token);

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
  requireToken(token);

  requireIdentifier(
    orderId,
    "Order ID is missing."
  );

  const response =
    await apiRequest<SingleOrderResponse>(
      `/api/orders/${encodeURIComponent(
        orderId.trim()
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
  reason =
    "Cancelled by customer"
): Promise<CustomerOrder> {
  requireToken(token);

  requireIdentifier(
    orderId,
    "Order ID is missing."
  );

  const response =
    await apiRequest<SingleOrderResponse>(
      `/api/orders/${encodeURIComponent(
        orderId.trim()
      )}/cancel`,
      {
        method: "PATCH",
        token,

        body: JSON.stringify({
          reason:
            reason.trim() ||
            "Cancelled by customer",
        }),
      }
    );

  return response.data.order;
}

export async function fetchCustomerDeliveryTracking(
  token: string,
  orderId: string
): Promise<CustomerDeliveryTracking> {
  requireToken(token);

  requireIdentifier(
    orderId,
    "Order ID is missing."
  );

  const response =
    await apiRequest<CustomerDeliveryTrackingResponse>(
      `/api/delivery/orders/customer/${encodeURIComponent(
        orderId.trim()
      )}`,
      {
        token,
      }
    );

  return response.data;
}

export async function fetchMyOrderReviews(
  token: string
): Promise<OrderReview[]> {
  requireToken(token);

  const response =
    await apiRequest<MyOrderReviewsResponse>(
      "/api/order-reviews/my",
      {
        token,
      }
    );

  return response.data.reviews;
}

export async function fetchOrderReview(
  token: string,
  orderId: string
): Promise<OrderReview | null> {
  requireToken(token);

  requireIdentifier(
    orderId,
    "Order ID is missing."
  );

  const response =
    await apiRequest<OrderReviewLookupResponse>(
      `/api/order-reviews/order/${encodeURIComponent(
        orderId.trim()
      )}`,
      {
        token,
      }
    );

  return response.data.review;
}

export async function createOrderReview(
  token: string,
  orderId: string,
  input: CreateOrderReviewInput
): Promise<OrderReview> {
  requireToken(token);

  requireIdentifier(
    orderId,
    "Order ID is missing."
  );

  if (
    !Number.isInteger(
      input.orderRating
    ) ||
    input.orderRating < 1 ||
    input.orderRating > 5
  ) {
    throw new Error(
      "Order rating must be between 1 and 5 stars."
    );
  }

  if (
    !Number.isInteger(
      input.deliveryRating
    ) ||
    input.deliveryRating < 1 ||
    input.deliveryRating > 5
  ) {
    throw new Error(
      "Delivery rating must be between 1 and 5 stars."
    );
  }

  const comment =
    input.comment?.trim() ?? "";

  if (comment.length > 500) {
    throw new Error(
      "Review comments cannot exceed 500 characters."
    );
  }

  const response =
    await apiRequest<SingleOrderReviewResponse>(
      `/api/order-reviews/${encodeURIComponent(
        orderId.trim()
      )}`,
      {
        method: "POST",
        token,

        body: JSON.stringify({
          orderRating:
            input.orderRating,

          deliveryRating:
            input.deliveryRating,

          comment,
        }),
      }
    );

  return response.data.review;
}

export async function fetchSubscriptionPlans(): Promise<
  SubscriptionPlan[]
> {
  const response =
    await apiRequest<SubscriptionPlansResponse>(
      "/api/subscriptions/plans"
    );

  return response.data.plans;
}

export async function createCustomerSubscription(
  token: string,
  input: CreateSubscriptionInput
): Promise<CustomerSubscription> {
  requireToken(token);

  const response =
    await apiRequest<CreateSubscriptionResponse>(
      "/api/subscriptions",
      {
        method: "POST",
        token,
        body: JSON.stringify(input),
      }
    );

  return response.data.subscription;
}

export async function fetchMySubscriptions(
  token: string
): Promise<CustomerSubscription[]> {
  requireToken(token);

  const response =
    await apiRequest<MySubscriptionsResponse>(
      "/api/subscriptions/my",
      {
        token,
      }
    );

  return response.data.subscriptions;
}

export async function fetchSubscriptionById(
  token: string,
  subscriptionId: string
): Promise<CustomerSubscription> {
  requireToken(token);

  requireIdentifier(
    subscriptionId,
    "Subscription ID is missing."
  );

  const response =
    await apiRequest<SingleSubscriptionResponse>(
      `/api/subscriptions/${encodeURIComponent(
        subscriptionId.trim()
      )}`,
      {
        token,
      }
    );

  return response.data.subscription;
}

export async function cancelCustomerSubscription(
  token: string,
  subscriptionId: string,
  reason =
    "Cancelled by customer"
): Promise<CustomerSubscription> {
  requireToken(token);

  requireIdentifier(
    subscriptionId,
    "Subscription ID is missing."
  );

  const response =
    await apiRequest<SingleSubscriptionResponse>(
      `/api/subscriptions/${encodeURIComponent(
        subscriptionId.trim()
      )}/cancel`,
      {
        method: "PATCH",
        token,

        body: JSON.stringify({
          reason:
            reason.trim() ||
            "Cancelled by customer",
        }),
      }
    );

  return response.data.subscription;
}

export {
  API_BASE_URL,
};