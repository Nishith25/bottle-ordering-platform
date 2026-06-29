const API_BASE_URL = (
  import.meta.env.VITE_API_URL ??
  "http://localhost:5001"
).replace(/\/$/, "");

export type CouponDiscountType =
  | "fixed"
  | "percentage";

export type CouponAppliesTo =
  | "order"
  | "subscription"
  | "both";

export type AdminCoupon = {
  _id: string;
  code: string;
  description: string;
  discountType: CouponDiscountType;
  discountValue: number;
  maxDiscountAmount: number;
  minimumOrder: number;
  appliesTo: CouponAppliesTo;
  usageLimit: number;
  perUserLimit: number;
  usedCount: number;
  reservedCount: number;
  startsAt: string;
  endsAt: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type CouponPayload = {
  code: string;
  description: string;
  discountType: CouponDiscountType;
  discountValue: number;
  maxDiscountAmount: number;
  minimumOrder: number;
  appliesTo: CouponAppliesTo;
  usageLimit: number;
  perUserLimit: number;
  startsAt: string;
  endsAt: string | null;
  active: boolean;
  sortOrder: number;
};

type ApiBaseResponse = {
  success: boolean;
  message?: string;
};

type CouponsResponse = ApiBaseResponse & {
  count: number;
  data: {
    coupons: AdminCoupon[];
  };
};

type CouponResponse = ApiBaseResponse & {
  data: {
    coupon: AdminCoupon;
  };
};

async function request<T>(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });

  const responseText = await response.text();

  let payload: T & ApiBaseResponse;

  try {
    payload = responseText
      ? JSON.parse(responseText)
      : ({} as T & ApiBaseResponse);
  } catch {
    throw new Error("The server returned an invalid response.");
  }

  if (!response.ok || payload.success === false) {
    throw new Error(
      payload.message ?? "Unable to complete the request."
    );
  }

  return payload;
}

export async function fetchAdminCoupons(
  token: string
): Promise<AdminCoupon[]> {
  const response = await request<CouponsResponse>(
    "/api/admin/coupons",
    token
  );

  return response.data.coupons;
}

export async function createAdminCoupon(
  token: string,
  payload: CouponPayload
): Promise<AdminCoupon> {
  const response = await request<CouponResponse>(
    "/api/admin/coupons",
    token,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );

  return response.data.coupon;
}

export async function updateAdminCoupon(
  token: string,
  couponId: string,
  payload: CouponPayload
): Promise<AdminCoupon> {
  const response = await request<CouponResponse>(
    `/api/admin/coupons/${encodeURIComponent(couponId)}`,
    token,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    }
  );

  return response.data.coupon;
}

export async function deactivateAdminCoupon(
  token: string,
  couponId: string
): Promise<AdminCoupon> {
  const response = await request<CouponResponse>(
    `/api/admin/coupons/${encodeURIComponent(couponId)}`,
    token,
    {
      method: "DELETE",
    }
  );

  return response.data.coupon;
}
