// admin-dashboard/src/services/adminActivityLogsApi.ts

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ??
  "http://localhost:5001"
).replace(/\/$/, "");

export type AdminActivitySeverity =
  | "info"
  | "success"
  | "warning"
  | "danger";

export type AdminActivityLog = {
  _id: string;
  actionType: string;
  actionLabel: string;
  severity: AdminActivitySeverity;
  message: string;

  actor: string | null;

  actorSnapshot:
    | {
        fullName: string;
        email: string;
        role: string;
      }
    | null;

  entityType: string;
  entityId: string | null;
  entityLabel: string;

  targetUser: string | null;

  targetUserSnapshot:
    | {
        fullName: string;
        email: string;
        phone: string;
        role: string;
      }
    | null;

  requestSnapshot:
    | {
        ip: string;
        userAgent: string;
        method: string;
        path: string;
      }
    | null;

  metadata: Record<string, unknown>;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminActivitySummary = {
  total: number;
  info: number;
  success: number;
  warning: number;
  danger: number;
  today: number;
};

export type AdminActivityAdmin = {
  _id: string;
  fullName: string;
  email: string;
  role: string;
  active: boolean;
};

export type AdminActivityActionType = {
  actionType: string;
  count: number;
};

export type AdminActivityInsightItem = {
  label: string;
  email?: string;
  entityType?: string;
  count: number;
};

export type AdminActivityInsights = {
  topActions: AdminActivityInsightItem[];
  topAdmins: AdminActivityInsightItem[];
  topEntities: AdminActivityInsightItem[];
};

export type AdminActivityPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export type AdminActivityLogsResult = {
  logs: AdminActivityLog[];
  summary: AdminActivitySummary;
  admins: AdminActivityAdmin[];
  actionTypes: AdminActivityActionType[];
  insights: AdminActivityInsights;
  pagination: AdminActivityPagination;
};

export type AdminActivityLogFilters = {
  actionType?: string;
  entityType?: string;
  severity?: string;
  adminId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
};

type ApiBaseResponse = {
  success: boolean;
  message?: string;
};

type ActivityLogsResponse =
  ApiBaseResponse & {
    count: number;
    data: AdminActivityLogsResult;
  };

function requireToken(token: string) {
  if (!token.trim()) {
    throw new Error(
      "Dashboard authentication token is missing."
    );
  }
}

function buildActivityLogQuery(
  options: AdminActivityLogFilters
) {
  const params =
    new URLSearchParams();

  if (options.actionType) {
    params.set(
      "actionType",
      options.actionType
    );
  }

  if (options.entityType) {
    params.set(
      "entityType",
      options.entityType
    );
  }

  if (options.severity) {
    params.set(
      "severity",
      options.severity
    );
  }

  if (options.adminId) {
    params.set(
      "adminId",
      options.adminId
    );
  }

  if (options.search?.trim()) {
    params.set(
      "search",
      options.search.trim()
    );
  }

  if (options.dateFrom) {
    params.set(
      "dateFrom",
      options.dateFrom
    );
  }

  if (options.dateTo) {
    params.set(
      "dateTo",
      options.dateTo
    );
  }

  if (options.page) {
    params.set(
      "page",
      String(options.page)
    );
  }

  if (options.limit) {
    params.set(
      "limit",
      String(options.limit)
    );
  }

  return params.toString();
}

async function request<T>(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  requireToken(token);

  const response = await fetch(
    `${API_BASE_URL}${path}`,
    {
      ...options,

      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
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

export async function fetchAdminActivityLogs(
  token: string,
  options: AdminActivityLogFilters = {}
): Promise<AdminActivityLogsResult> {
  const query =
    buildActivityLogQuery(options);

  const response =
    await request<ActivityLogsResponse>(
      `/api/admin/activity-logs${
        query ? `?${query}` : ""
      }`,
      token
    );

  return response.data;
}

export async function downloadAdminActivityLogsCsv(
  token: string,
  options: AdminActivityLogFilters = {}
): Promise<void> {
  requireToken(token);

  const query =
    buildActivityLogQuery({
      ...options,
      page: undefined,
      limit:
        options.limit || 10000,
    });

  const response =
    await fetch(
      `${API_BASE_URL}/api/admin/activity-logs/export.csv${
        query ? `?${query}` : ""
      }`,
      {
        headers: {
          Accept: "text/csv",
          Authorization: `Bearer ${token}`,
        },
      }
    );

  if (!response.ok) {
    let message =
      "Unable to export activity logs.";

    try {
      const payload =
        await response.json();

      message =
        payload.message || message;
    } catch {
      // Keep fallback message.
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
    `solidsip-activity-log-${new Date()
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