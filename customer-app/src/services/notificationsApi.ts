import {
  API_BASE_URL,
} from "./api";

type ApiResponse = {
  success: boolean;
  message?: string;
};

export type NotificationType =
  | "order_placed"
  | "order_confirmed"
  | "order_preparing"
  | "delivery_assigned"
  | "order_picked_up"
  | "order_out_for_delivery"
  | "order_delivered"
  | "order_cancelled"
  | "refund_pending"
  | "refund_processed"
  | "refund_failed"
  | "review_submitted"
  | "subscription_created"
  | "subscription_cancelled"
  | "system";

export type NotificationAction =
  | "none"
  | "orders"
  | "delivery_tracking"
  | "subscriptions";

export type CustomerNotification = {
  _id: string;
  user: string;
  type: NotificationType;
  title: string;
  message: string;
  action: NotificationAction;
  order: string | null;
  subscription: string | null;

  metadata: Record<
    string,
    unknown
  >;

  readAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type NotificationsResponse =
  ApiResponse & {
    count: number;

    data: {
      notifications:
        CustomerNotification[];

      unreadCount: number;
    };
  };

type UnreadCountResponse =
  ApiResponse & {
    data: {
      unreadCount: number;
    };
  };

type NotificationResponse =
  ApiResponse & {
    data: {
      notification:
        CustomerNotification;
    };
  };

type ReadAllResponse =
  ApiResponse & {
    data: {
      modifiedCount: number;
      readAt: string;
    };
  };

async function request<T>(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  if (!token.trim()) {
    throw new Error(
      "Please log in to view notifications."
    );
  }

  const controller =
    new AbortController();

  const timeoutId =
    setTimeout(() => {
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

            ...(options.headers ??
              {}),
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
      payload = responseText
        ? JSON.parse(
            responseText
          )
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
        payload.message ??
          "Unable to complete the request."
      );
    }

    return payload;
  } catch (error) {
    if (
      error instanceof Error &&
      error.name ===
        "AbortError"
    ) {
      throw new Error(
        "The server took too long to respond."
      );
    }

    if (
      error instanceof TypeError
    ) {
      throw new Error(
        "Unable to connect to the backend."
      );
    }

    if (
      error instanceof Error
    ) {
      throw error;
    }

    throw new Error(
      "Unable to complete the request."
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchNotifications(
  token: string,
  limit = 50
): Promise<{
  notifications:
    CustomerNotification[];

  unreadCount: number;
}> {
  const safeLimit =
    Math.min(
      Math.max(
        Math.floor(limit),
        1
      ),
      100
    );

  const response =
    await request<NotificationsResponse>(
      `/api/notifications?limit=${safeLimit}`,
      token
    );

  return response.data;
}

export async function fetchUnreadNotificationCount(
  token: string
): Promise<number> {
  const response =
    await request<UnreadCountResponse>(
      "/api/notifications/unread-count",
      token
    );

  return response.data
    .unreadCount;
}

export async function markNotificationRead(
  token: string,
  notificationId: string
): Promise<CustomerNotification> {
  if (
    !notificationId.trim()
  ) {
    throw new Error(
      "Notification ID is missing."
    );
  }

  const response =
    await request<NotificationResponse>(
      `/api/notifications/${encodeURIComponent(
        notificationId.trim()
      )}/read`,
      token,
      {
        method: "PATCH",
      }
    );

  return response.data
    .notification;
}

export async function markAllNotificationsRead(
  token: string
): Promise<{
  modifiedCount: number;
  readAt: string;
}> {
  const response =
    await request<ReadAllResponse>(
      "/api/notifications/read-all",
      token,
      {
        method: "PATCH",
      }
    );

  return response.data;
}