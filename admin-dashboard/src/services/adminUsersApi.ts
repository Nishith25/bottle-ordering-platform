// admin-dashboard/src/services/adminUsersApi.ts

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ??
  "http://localhost:5001"
).replace(/\/$/, "");

export type ManagedUserRole =
  | "customer"
  | "admin";

export type ManagedUserStatistics = {
  orderCount: number;
  orderValue: number;
  subscriptionCount: number;
  activeSubscriptionCount: number;
};

export type AdminManagedUser = {
  _id: string;
  fullName: string;
  email: string;
  phone: string;
  role: ManagedUserRole;
  active: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  isCurrentAdmin: boolean;
  statistics: ManagedUserStatistics;
};

export type AdminUserSummary = {
  totalUsers: number;
  totalCustomers: number;
  totalAdmins: number;
  activeUsers: number;
  inactiveUsers: number;
};

type ApiBaseResponse = {
  success: boolean;
  message?: string;
};

type UsersResponse =
  ApiBaseResponse & {
    count: number;

    data: {
      users:
        AdminManagedUser[];

      summary:
        AdminUserSummary;
    };
  };

type UserResponse =
  ApiBaseResponse & {
    data: {
      user: Omit<
        AdminManagedUser,
        | "statistics"
        | "isCurrentAdmin"
      >;
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

  const headers = new Headers(
    options.headers
  );

  headers.set(
    "Accept",
    "application/json"
  );

  headers.set(
    "Authorization",
    `Bearer ${token}`
  );

  if (options.body) {
    headers.set(
      "Content-Type",
      "application/json"
    );
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}${path}`,
      {
        ...options,
        headers,
        signal: controller.signal,
      }
    );

    const responseText =
      await response.text();

    let payload:
      T & ApiBaseResponse;

    try {
      payload = responseText
        ? JSON.parse(responseText)
        : ({
            success: response.ok,
          } as T & ApiBaseResponse);
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
    window.clearTimeout(
      timeoutId
    );
  }
}

export async function fetchAdminUsers(
  token: string,
  options?: {
    role?: string;
    status?: string;
    search?: string;
  }
): Promise<{
  users: AdminManagedUser[];
  summary: AdminUserSummary;
}> {
  const parameters =
    new URLSearchParams();

  if (
    options?.role &&
    options.role !== "all"
  ) {
    parameters.set(
      "role",
      options.role
    );
  }

  if (
    options?.status &&
    options.status !== "all"
  ) {
    parameters.set(
      "status",
      options.status
    );
  }

  if (
    options?.search?.trim()
  ) {
    parameters.set(
      "search",
      options.search.trim()
    );
  }

  const query =
    parameters.toString();

  const response =
    await request<UsersResponse>(
      `/api/admin/users${
        query ? `?${query}` : ""
      }`,
      token
    );

  return response.data;
}

export async function updateAdminUserStatus(
  token: string,
  userId: string,
  active: boolean
): Promise<void> {
  await request<UserResponse>(
    `/api/admin/users/${encodeURIComponent(
      userId
    )}/status`,
    token,
    {
      method: "PATCH",

      body: JSON.stringify({
        active,
      }),
    }
  );
}

export async function updateAdminUserRole(
  token: string,
  userId: string,
  role: ManagedUserRole
): Promise<void> {
  await request<UserResponse>(
    `/api/admin/users/${encodeURIComponent(
      userId
    )}/role`,
    token,
    {
      method: "PATCH",

      body: JSON.stringify({
        role,
      }),
    }
  );
}