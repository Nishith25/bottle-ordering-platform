// admin-dashboard/src/services/adminPlansApi.ts

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ??
  "http://localhost:5001"
).replace(/\/$/, "");

export type PlanBillingCycle =
  | "weekly"
  | "monthly";

export type AdminSubscriptionPlan = {
  _id: string;
  planId: string;
  name: string;
  description: string;
  billingCycle: PlanBillingCycle;
  bottleCount: number;
  deliveriesPerCycle: number;
  discountPercent: number;
  badge: string;
  features: string[];
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type SubscriptionPlanPayload = {
  planId: string;
  name: string;
  description: string;
  billingCycle: PlanBillingCycle;
  bottleCount: number;
  deliveriesPerCycle: number;
  discountPercent: number;
  badge: string;
  features: string[];
  active: boolean;
  sortOrder: number;
};

type ApiBaseResponse = {
  success: boolean;
  message?: string;
};

type PlansResponse = ApiBaseResponse & {
  count: number;

  data: {
    plans: AdminSubscriptionPlan[];
  };
};

type PlanResponse = ApiBaseResponse & {
  data: {
    plan: AdminSubscriptionPlan;
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
    const response = await fetch(
      `${API_BASE_URL}${path}`,
      {
        ...options,

        headers: {
          Accept: "application/json",

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

        signal: controller.signal,
      }
    );

    const responseText =
      await response.text();

    let payload: T & ApiBaseResponse;

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

export async function fetchAdminPlans(
  token: string
): Promise<AdminSubscriptionPlan[]> {
  const response =
    await request<PlansResponse>(
      "/api/admin/plans",
      token
    );

  return response.data.plans;
}

export async function createAdminPlan(
  token: string,
  payload: SubscriptionPlanPayload
): Promise<AdminSubscriptionPlan> {
  const response =
    await request<PlanResponse>(
      "/api/admin/plans",
      token,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );

  return response.data.plan;
}

export async function updateAdminPlan(
  token: string,
  planId: string,
  payload: Partial<SubscriptionPlanPayload>
): Promise<AdminSubscriptionPlan> {
  const response =
    await request<PlanResponse>(
      `/api/admin/plans/${encodeURIComponent(
        planId
      )}`,
      token,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    );

  return response.data.plan;
}

export async function archiveAdminPlan(
  token: string,
  planId: string
): Promise<AdminSubscriptionPlan> {
  const response =
    await request<PlanResponse>(
      `/api/admin/plans/${encodeURIComponent(
        planId
      )}`,
      token,
      {
        method: "DELETE",
      }
    );

  return response.data.plan;
}