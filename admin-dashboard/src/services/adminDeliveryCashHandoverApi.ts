const API_BASE_URL = (
  import.meta.env.VITE_API_URL ??
  "http://localhost:5001"
).replace(/\/$/, "");

type ApiResponse = {
  success: boolean;
  message?: string;
};

export type AdminDeliveryCashHandoverBatch = {
  batchId: string;
  status:
    | "not_submitted"
    | "submitted"
    | "handed_over"
    | "short_collected"
    | string;

  partner: {
    id: string;
    fullName: string;
    email: string;
    phone: string;
  };

  dateId: string;
  submittedAt: string | null;
  verifiedAt: string | null;
  expectedAmount: number;
  submittedAmount: number;
  receivedAmount: number;
  shortAmount: number;
  partnerNote: string;
  adminNote: string;
  orderCount: number;

  orders: Array<{
    id: string;
    order?: string | null;
    orderNumber: string;
    amountCollected: number;
    collectedAt?: string | null;
    status: string;
  }>;
};

export type AdminDeliveryCashHandoverSummary = {
  dateId: string;
  notSubmittedCount: number;
  notSubmittedAmount: number;
  submittedCount: number;
  submittedAmount: number;
  verifiedCount: number;
  verifiedAmount: number;
  shortAmount: number;
  totalRows: number;
};

export type AdminDeliveryCashHandoverResult = {
  summary: AdminDeliveryCashHandoverSummary;
  handoverBatches: AdminDeliveryCashHandoverBatch[];
  submittedBatches: AdminDeliveryCashHandoverBatch[];
  notSubmittedBatches: AdminDeliveryCashHandoverBatch[];
  verifiedBatches: AdminDeliveryCashHandoverBatch[];
};

type SummaryResponse =
  ApiResponse & {
    data:
      AdminDeliveryCashHandoverResult;
  };

type VerifyResponse =
  ApiResponse & {
    data: {
      batch:
        AdminDeliveryCashHandoverBatch;
    };
  };

async function request<T>(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  const controller =
    new AbortController();

  const timeoutId =
    window.setTimeout(() => {
      controller.abort();
    }, 12000);

  try {
    const response =
      await fetch(
        `${API_BASE_URL}${path}`,
        {
          ...options,

          headers: {
            Accept:
              "application/json",

            ...(options.body
              ? {
                  "Content-Type":
                    "application/json",
                }
              : {}),

            Authorization:
              `Bearer ${token}`,

            ...(options.headers ?? {}),
          },

          signal:
            controller.signal,
        }
      );

    const responseText =
      await response.text();

    let payload:
      T & ApiResponse;

    try {
      payload =
        responseText
          ? JSON.parse(responseText)
          : ({
              success:
                response.ok,
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
        payload.message ||
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
    window.clearTimeout(timeoutId);
  }
}

export async function fetchAdminDeliveryCashHandoverSummary(
  token: string,
  dateId = ""
): Promise<AdminDeliveryCashHandoverResult> {
  const params =
    new URLSearchParams();

  if (dateId.trim()) {
    params.set("date", dateId.trim());
  }

  const query =
    params.toString();

  const response =
    await request<SummaryResponse>(
      `/api/admin/delivery-cash-handover/summary${
        query ? `?${query}` : ""
      }`,
      token
    );

  return response.data;
}

export async function verifyAdminDeliveryCashHandover(
  token: string,
  batchId: string,
  payload: {
    receivedAmount: number;
    adminNote?: string;
  }
): Promise<AdminDeliveryCashHandoverBatch> {
  const response =
    await request<VerifyResponse>(
      `/api/admin/delivery-cash-handover/batches/${encodeURIComponent(
        batchId
      )}/verify`,
      token,
      {
        method: "PATCH",

        body: JSON.stringify(payload),
      }
    );

  return response.data.batch;
}