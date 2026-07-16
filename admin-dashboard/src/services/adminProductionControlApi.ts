// admin-dashboard/src/services/adminProductionControlApi.ts

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ??
  "http://localhost:5001"
).replace(/\/$/, "");

export type ProductionControlStatus =
  | "ok"
  | "warning"
  | "danger";

export type ProductionChecklistItem = {
  key: string;
  label: string;
  status: ProductionControlStatus;
  count: number;
  message: string;
  route: string;
};

export type ProductionControlOrderBrief = {
  _id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  orderStatus: string;
  paymentMethod: "cod" | "online";
  paymentStatus: string;
  refundStatus: string;
  refundFailureReason: string;
  total: number;
  bottleCount: number;
  deliveryDateId: string;
  deliveryDateLabel: string;
  deliverySlot: string;
  createdAt: string;
  updatedAt: string;
};

export type ProductionControlProduct = {
  _id: string;
  productId: string;
  name: string;
  shortName: string;
  stockQuantity: number;
  lowStockThreshold: number;
  active: boolean;
};

export type ProductionControlCashCollection = {
  _id: string;
  order: string;
  orderNumber: string;
  amountDue: number;
  amountCollected: number;
  status: string;
  collectedAt: string | null;
  handedOverAt: string | null;
  notes: string;
};

export type ProductionControlSummary = {
  todaysOrders: number;
  todaysBottles: number;
  ordersNeedingConfirmation: number;
  failedRefunds: number;
  pendingCodOrders: number;
  pendingCodAmount: number;
  pendingCashHandoverCollections: number;
  pendingHandoverAmount: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  overdueFollowUps: number;
  todayFollowUps: number;
  unreadNotifications: number;
  dangerNotifications: number;
  activityLast24Hours: number;
};

export type DailyClosingReport = {
  dateId: string;
  createdOrderCount: number;
  deliveredOrderCount: number;
  salesTodayAmount: number;
  bottlesSoldToday: number;
  codCollectedToday: number;
  cashHandedOverToday: number;
  pendingCodAmount: number;
  pendingHandoverAmount: number;
  failedRefundCount: number;
};

export type ProductionControlResult = {
  dateId: string;
  generatedAt: string;
  checklist: ProductionChecklistItem[];
  summary: ProductionControlSummary;
  dailyClosing: DailyClosingReport;
  todaysOrders: ProductionControlOrderBrief[];
  ordersNeedingConfirmation: ProductionControlOrderBrief[];
  failedRefundOrders: ProductionControlOrderBrief[];
  pendingCodOrders: ProductionControlOrderBrief[];
  pendingCashHandoverCollections: ProductionControlCashCollection[];
  lowStockProducts: ProductionControlProduct[];
  outOfStockProducts: ProductionControlProduct[];
};

type ProductionControlResponse = {
  success: boolean;
  message?: string;
  data: ProductionControlResult;
};

function requireToken(token: string) {
  if (!token.trim()) {
    throw new Error(
      "Dashboard authentication token is missing."
    );
  }
}

async function request<T>(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  requireToken(token);

  const response =
    await fetch(
      `${API_BASE_URL}${path}`,
      {
        ...options,

        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization:
            `Bearer ${token}`,
          ...(options.headers ?? {}),
        },
      }
    );

  const responseText =
    await response.text();

  let payload:
    T & {
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

export async function fetchProductionControlSummary(
  token: string,
  dateId = ""
): Promise<ProductionControlResult> {
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
    await request<ProductionControlResponse>(
      `/api/admin/production-control/summary${
        query ? `?${query}` : ""
      }`,
      token
    );

  return response.data;
}