// admin-dashboard/src/services/adminNotificationsApi.ts

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ??
  "http://localhost:5001"
).replace(/\/$/, "");

export type AdminNotificationType =
  | "stock"
  | "follow_up"
  | "refund"
  | "cod_payment"
  | "order"
  | "payment"
  | "system";

export type AdminNotificationSeverity =
  | "info"
  | "warning"
  | "danger"
  | "success";

export type AdminNotification = {
  _id: string;
  type: AdminNotificationType;
  severity: AdminNotificationSeverity;
  title: string;
  message: string;
  actionUrl: string;

  sourceType:
    | ""
    | "product"
    | "order"
    | "follow_up"
    | "subscription"
    | "system";

  sourceId:
    | string
    | null;

  sourceLabel: string;
  automationKey: string;
  metadata: Record<string, unknown>;
  readAt: string | null;
  readBy: string | null;

  readBySnapshot:
    | {
        fullName: string;
        email: string;
        role: string;
      }
    | null;

  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminNotificationSummary = {
  total: number;
  unread: number;
  danger: number;
  warning: number;
  stock: number;
  followUp: number;
  refund: number;
  codPayment: number;
  order: number;
  payment: number;
};

export type AdminNotificationsResult = {
  notifications: AdminNotification[];
  summary: AdminNotificationSummary;
};

type ApiBaseResponse = {
  success: boolean;
  message?: string;
};

type NotificationsResponse =
  ApiBaseResponse & {
    count: number;

    data: AdminNotificationsResult;
  };

type NotificationResponse =
  ApiBaseResponse & {
    data: {
      notification: AdminNotification;
    };
  };

type GenerateResponse =
  ApiBaseResponse & {
    data: {
      result: {
        startedAt: string;
        finishedAt: string;
        totalCreated: number;
        results: Record<string, number>;
      };
    };
  };

type MarkAllResponse =
  ApiBaseResponse & {
    data: {
      modifiedCount: number;
    };
  };

function requireToken(
  token: string
) {
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

export async function fetchAdminNotifications(
  token: string,
  options: {
    type?:
      | AdminNotificationType
      | "all";
    unreadOnly?: boolean;
    search?: string;
    limit?: number;
  } = {}
): Promise<AdminNotificationsResult> {
  const params =
    new URLSearchParams();

  if (options.type) {
    params.set(
      "type",
      options.type
    );
  }

  if (options.unreadOnly) {
    params.set(
      "unreadOnly",
      "true"
    );
  }

  if (options.search?.trim()) {
    params.set(
      "search",
      options.search.trim()
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
    await request<NotificationsResponse>(
      `/api/admin/notifications${
        query ? `?${query}` : ""
      }`,
      token
    );

  return response.data;
}

export async function generateAdminNotificationsNow(
  token: string
): Promise<GenerateResponse["data"]["result"]> {
  const response =
    await request<GenerateResponse>(
      "/api/admin/notifications/generate",
      token,
      {
        method: "POST",
        body: JSON.stringify({}),
      }
    );

  return response.data.result;
}

export async function markAdminNotificationRead(
  token: string,
  notificationId: string
): Promise<AdminNotification> {
  if (!notificationId.trim()) {
    throw new Error(
      "Notification ID is missing."
    );
  }

  const response =
    await request<NotificationResponse>(
      `/api/admin/notifications/${encodeURIComponent(
        notificationId.trim()
      )}/read`,
      token,
      {
        method: "PATCH",
        body: JSON.stringify({}),
      }
    );

  return response.data.notification;
}

export async function markAllAdminNotificationsRead(
  token: string
): Promise<number> {
  const response =
    await request<MarkAllResponse>(
      "/api/admin/notifications/mark-all-read",
      token,
      {
        method: "PATCH",
        body: JSON.stringify({}),
      }
    );

  return response.data.modifiedCount;
}