const API_BASE_URL = (
  import.meta.env.VITE_API_URL ??
  "http://localhost:5001"
).replace(/\/$/, "");

export type AdminBatchRecord = {
  _id: string;
  batchNumber: string;
  product: string;
  productId: string;
  productName: string;
  productShortName: string;
  sizeMl: number;
  productionDateId: string;
  packedOnAt: string;
  useByAt: string;
  shelfLifeDays: number;
  quantityPacked: number;

  status:
    | "packed"
    | "released"
    | "discarded";

  notes: string;

  createdBy:
    | string
    | {
        _id: string;
        fullName?: string;
        email?: string;
        role?: string;
      }
    | null;

  createdBySnapshot:
    | {
        fullName: string;
        email: string;
        role: string;
      }
    | null;

  createdAt: string;
  updatedAt: string;
};

export type CreateBatchPayload = {
  productId: string;
  productionDateId: string;
  packedOnAt: string;
  shelfLifeDays: number;
  quantityPacked: number;
  notes?: string;
};

type ApiBaseResponse = {
  success: boolean;
  message?: string;
};

type BatchesResponse =
  ApiBaseResponse & {
    count: number;

    data: {
      batches: AdminBatchRecord[];
    };
  };

type BatchResponse =
  ApiBaseResponse & {
    data: {
      batch: AdminBatchRecord;
    };
  };

type NextBatchNumberResponse =
  ApiBaseResponse & {
    data: {
      batchNumber: string;
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

export async function fetchAdminBatches(
  token: string,
  options: {
    date?: string;
    productId?: string;
    limit?: number;
  } = {}
): Promise<AdminBatchRecord[]> {
  const parameters =
    new URLSearchParams();

  if (options.date?.trim()) {
    parameters.set(
      "date",
      options.date.trim()
    );
  }

  if (
    options.productId &&
    options.productId !== "all"
  ) {
    parameters.set(
      "productId",
      options.productId
    );
  }

  if (options.limit) {
    parameters.set(
      "limit",
      String(options.limit)
    );
  }

  const query =
    parameters.toString();

  const response =
    await request<BatchesResponse>(
      `/api/admin/batches${
        query ? `?${query}` : ""
      }`,
      token
    );

  return response.data.batches;
}

export async function fetchNextBatchNumber(
  token: string,
  options: {
    productId: string;
    productionDateId: string;
  }
): Promise<string> {
  const parameters =
    new URLSearchParams();

  parameters.set(
    "productId",
    options.productId
  );

  parameters.set(
    "productionDateId",
    options.productionDateId
  );

  const response =
    await request<NextBatchNumberResponse>(
      `/api/admin/batches/next-number?${parameters.toString()}`,
      token
    );

  return response.data.batchNumber;
}

export async function createAdminBatch(
  token: string,
  payload: CreateBatchPayload
): Promise<AdminBatchRecord> {
  const response =
    await request<BatchResponse>(
      "/api/admin/batches",
      token,
      {
        method: "POST",

        body: JSON.stringify(
          payload
        ),
      }
    );

  return response.data.batch;
}