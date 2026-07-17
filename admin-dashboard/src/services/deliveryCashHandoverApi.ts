const API_BASE_URL = (
  import.meta.env.VITE_API_URL ??
  "http://localhost:5001"
).replace(/\/$/, "");

type ApiResponse = {
  success: boolean;
  message?: string;
};

export type DeliveryCashCollectionRow = {
  _id: string;
  order?: string;
  orderNumber: string;
  amountDue?: number;
  amountCollected?: number;
  status: string;
  collectedAt?: string | null;
};

export type DeliveryCashHandoverBatch = {
  batchId: string;
  status: string;
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

export type DeliveryCashHandoverSummary = {
  dateId: string;
  pendingSubmitCount: number;
  pendingSubmitAmount: number;
  submittedCount: number;
  submittedAmount: number;
  verifiedCount: number;
  verifiedAmount: number;
  shortAmount: number;
  totalRows: number;
};

export type DeliveryCashHandoverResult = {
  summary: DeliveryCashHandoverSummary;
  pendingCollections: DeliveryCashCollectionRow[];
  submittedBatches: DeliveryCashHandoverBatch[];
  verifiedBatches: DeliveryCashHandoverBatch[];
};

type SummaryResponse =
  ApiResponse & {
    data:
      DeliveryCashHandoverResult;
  };

type SubmitResponse =
  ApiResponse & {
    data: {
      batch:
        DeliveryCashHandoverBatch;
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

export async function fetchDeliveryCashHandoverSummary(
  token: string,
  dateId = ""
): Promise<DeliveryCashHandoverResult> {
  const params =
    new URLSearchParams();

  if (dateId.trim()) {
    params.set("date", dateId.trim());
  }

  const query =
    params.toString();

  const response =
    await request<SummaryResponse>(
      `/api/delivery/cash-handover/summary${
        query ? `?${query}` : ""
      }`,
      token
    );

  return response.data;
}

export async function submitDeliveryCashHandover(
  token: string,
  payload: {
    dateId?: string;
    amountSubmitted: number;
    note?: string;
  }
): Promise<DeliveryCashHandoverBatch> {
  const response =
    await request<SubmitResponse>(
      "/api/delivery/cash-handover/submit",
      token,
      {
        method: "POST",

        body: JSON.stringify(payload),
      }
    );

  return response.data.batch;
}