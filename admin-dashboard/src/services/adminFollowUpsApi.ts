// admin-dashboard/src/services/adminFollowUpsApi.ts

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ??
  "http://localhost:5001"
).replace(/\/$/, "");

export type AdminFollowUpStatus =
  | "pending"
  | "done"
  | "cancelled";

export type AdminFollowUpFilter =
  | "all"
  | "pending"
  | "overdue"
  | "today"
  | "done"
  | "cancelled";

export type AdminFollowUpCustomer = {
  _id: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  active: boolean;
};

export type AdminFollowUp = {
  _id: string;

  customer:
    | AdminFollowUpCustomer
    | string
    | null;

  title: string;
  description: string;
  dueAt: string;
  status: AdminFollowUpStatus;

  createdBy:
    | string
    | null;

  createdBySnapshot:
    | {
        fullName: string;
        email: string;
        role: string;
      }
    | null;

  completedAt:
    | string
    | null;

  completedBy:
    | string
    | null;

  completedBySnapshot:
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

export type AdminFollowUpsSummary = {
  total: number;
  pending: number;
  overdue: number;
  today: number;
  done: number;
  cancelled: number;
};

export type AdminFollowUpsResult = {
  followUps: AdminFollowUp[];
  summary: AdminFollowUpsSummary;
};

type ApiBaseResponse = {
  success: boolean;
  message?: string;
};

type FollowUpsResponse =
  ApiBaseResponse & {
    count: number;

    data: AdminFollowUpsResult;
  };

type FollowUpResponse =
  ApiBaseResponse & {
    data: {
      followUp: AdminFollowUp;
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

export async function fetchAdminFollowUps(
  token: string,
  options: {
    status?: AdminFollowUpFilter;
    search?: string;
    limit?: number;
  } = {}
): Promise<AdminFollowUpsResult> {
  const params =
    new URLSearchParams();

  if (options.status) {
    params.set(
      "status",
      options.status
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
    await request<FollowUpsResponse>(
      `/api/admin/follow-ups${
        query ? `?${query}` : ""
      }`,
      token
    );

  return response.data;
}

export async function updateAdminFollowUpStatus(
  token: string,
  followUpId: string,
  status: AdminFollowUpStatus
): Promise<AdminFollowUp> {
  if (!followUpId.trim()) {
    throw new Error(
      "Follow-up ID is missing."
    );
  }

  const response =
    await request<FollowUpResponse>(
      `/api/admin/follow-ups/${encodeURIComponent(
        followUpId.trim()
      )}/status`,
      token,
      {
        method: "PATCH",

        body: JSON.stringify({
          status,
        }),
      }
    );

  return response.data.followUp;
}