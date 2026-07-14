const API_BASE_URL = (
  import.meta.env.VITE_API_URL ??
  "http://localhost:5001"
).replace(/\/$/, "");

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

export type AdminOperationsOrder = {
  _id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  address: string;
  deliveryDateId: string;
  deliverySlotLabel: string;
  deliveryPartnerName: string;

  items: Array<{
    productId: string;
    name: string;
    shortName: string;
    sizeMl: number;
    quantity: number;
    price: number;
    lineTotal: number;
  }>;

  subtotal: number;
  deliveryFee: number;
  couponDiscount: number;
  total: number;

  paymentMethod:
    | "cod"
    | "online"
    | string;

  paymentStatus: string;
  orderStatus: string;
  deliveryStatus: string;

  createdAt: string;
  updatedAt: string;

  cashCollection:
    | AdminCashCollection
    | null;
};

export type AdminOperationsReport = {
  dateId: string;

  summary: {
    orderCount: number;
    bottleCount: number;
    codOrderCount: number;
    codAmount: number;
    codCollectedAmount: number;
    codPendingAmount: number;
    onlineOrderCount: number;
    onlineAmount: number;
    deliveredCount: number;
    packingSlipCount: number;
  };

  orders: AdminOperationsOrder[];
};

type ApiBaseResponse = {
  success: boolean;
  message?: string;
};

type OperationsResponse =
  ApiBaseResponse & {
    data: AdminOperationsReport;
  };

type CollectionResponse =
  ApiBaseResponse & {
    data: {
      collection: AdminCashCollection;
    };
  };

async function request<T>(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  const response =
    await fetch(
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

  let payload:
    T & {
      success?: boolean;
      message?: string;
    };

  try {
    payload =
      responseText
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

export async function fetchAdminOperationsReport(
  token: string,
  options: {
    date: string;
  }
): Promise<AdminOperationsReport> {
  const parameters =
    new URLSearchParams();

  parameters.set(
    "date",
    options.date
  );

  const response =
    await request<OperationsResponse>(
      `/api/admin/operations/packing-cod?${parameters.toString()}`,
      token
    );

  return response.data;
}

export async function markOrderCodCollected(
  token: string,
  orderId: string,
  payload: {
    amountCollected: number;
    notes?: string;
  }
): Promise<AdminCashCollection> {
  const response =
    await request<CollectionResponse>(
      `/api/admin/operations/orders/${orderId}/cod-collected`,
      token,
      {
        method: "PATCH",

        body: JSON.stringify(
          payload
        ),
      }
    );

  return response.data.collection;
}

export async function markCashCollectionHandedOver(
  token: string,
  collectionId: string,
  payload: {
    notes?: string;
  } = {}
): Promise<AdminCashCollection> {
  const response =
    await request<CollectionResponse>(
      `/api/admin/operations/cash-collections/${collectionId}/handover`,
      token,
      {
        method: "PATCH",

        body: JSON.stringify(
          payload
        ),
      }
    );

  return response.data.collection;
}