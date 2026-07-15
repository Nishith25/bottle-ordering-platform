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

export type AdminActivityLogsResult = {
  logs: AdminActivityLog[];
  summary: AdminActivitySummary;
  admins: AdminActivityAdmin[];
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
  options: {
    actionType?: string;
    entityType?: string;
    severity?: string;
    adminId?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  } = {}
): Promise<AdminActivityLogsResult> {
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

  if (options.limit) {
    params.set(
      "limit",
      String(options.limit)
    );
  }

  const query =
    params.toString();

  const response =
    await request<ActivityLogsResponse>(
      `/api/admin/activity-logs${
        query ? `?${query}` : ""
      }`,
      token
    );

  return response.data;
}