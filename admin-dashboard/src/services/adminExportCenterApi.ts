// admin-dashboard/src/services/adminExportCenterApi.ts

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ??
  "http://localhost:5001"
).replace(/\/$/, "");

export type ExportCenterSummary = {
  totalOrders: number;
  todayOrders: number;
  totalCustomers: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  pendingCodOrders: number;
  pendingCashHandover: number;
  inventoryMovements24h: number;
};

export type ExportCenterSummaryResult = {
  summary: ExportCenterSummary;
};

export type ExportType =
  | "orders"
  | "cod"
  | "customers"
  | "inventory-movements"
  | "low-stock"
  | "daily-closing";

export type ExportCenterFilters = {
  dateFrom?: string;
  dateTo?: string;
  date?: string;
  status?: string;
  customerStatus?: string;
  productId?: string;
};

type ExportSummaryResponse = {
  success: boolean;
  message?: string;
  data: ExportCenterSummaryResult;
};

function requireToken(token: string) {
  if (!token.trim()) {
    throw new Error(
      "Dashboard authentication token is missing."
    );
  }
}

function buildQuery(filters: ExportCenterFilters = {}) {
  const params =
    new URLSearchParams();

  if (filters.dateFrom) {
    params.set(
      "dateFrom",
      filters.dateFrom
    );
  }

  if (filters.dateTo) {
    params.set(
      "dateTo",
      filters.dateTo
    );
  }

  if (filters.date) {
    params.set(
      "date",
      filters.date
    );
  }

  if (filters.status) {
    params.set(
      "status",
      filters.status
    );
  }

  if (filters.customerStatus) {
    params.set(
      "customerStatus",
      filters.customerStatus
    );
  }

  if (filters.productId?.trim()) {
    params.set(
      "productId",
      filters.productId.trim()
    );
  }

  return params.toString();
}

function getExportPath(type: ExportType) {
  return `/api/admin/export-center/${type}.csv`;
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

export async function fetchExportCenterSummary(
  token: string,
  filters: ExportCenterFilters = {}
): Promise<ExportCenterSummaryResult> {
  const query =
    buildQuery(filters);

  const response =
    await request<ExportSummaryResponse>(
      `/api/admin/export-center/summary${
        query ? `?${query}` : ""
      }`,
      token
    );

  return response.data;
}

export async function downloadExportCenterCsv(
  token: string,
  type: ExportType,
  filters: ExportCenterFilters = {}
): Promise<void> {
  requireToken(token);

  const query =
    buildQuery(filters);

  const response =
    await fetch(
      `${API_BASE_URL}${getExportPath(type)}${
        query ? `?${query}` : ""
      }`,
      {
        headers: {
          Accept:
            "text/csv",
          Authorization:
            `Bearer ${token}`,
        },
      }
    );

  if (!response.ok) {
    let message =
      "Unable to export CSV.";

    try {
      const payload =
        await response.json();

      message =
        payload.message || message;
    } catch {
      // keep fallback
    }

    throw new Error(message);
  }

  const blob =
    await response.blob();

  const disposition =
    response.headers.get(
      "content-disposition"
    );

  const fileNameMatch =
    disposition?.match(
      /filename="?([^"]+)"?/i
    );

  const fileName =
    fileNameMatch?.[1] ||
    `solidsip-${type}-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;
  link.download = fileName;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}