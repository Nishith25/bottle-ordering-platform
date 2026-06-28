// admin-dashboard/src/services/adminLocationsApi.ts

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ??
  "http://localhost:5001"
).replace(/\/$/, "");

export type AdminLocation = {
  _id: string;
  pincode: string;
  area: string;
  city: string;
  active: boolean;
  deliveryFee: number;
  minimumOrder: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type LocationPayload = {
  pincode: string;
  area: string;
  city: string;
  active: boolean;
  deliveryFee: number;
  minimumOrder: number;
  sortOrder: number;
};

type ApiBaseResponse = {
  success: boolean;
  message?: string;
};

type LocationsResponse =
  ApiBaseResponse & {
    count: number;

    data: {
      locations: AdminLocation[];
    };
  };

type LocationResponse =
  ApiBaseResponse & {
    data: {
      location: AdminLocation;
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

export async function fetchAdminLocations(
  token: string
): Promise<AdminLocation[]> {
  const response =
    await request<LocationsResponse>(
      "/api/admin/locations",
      token
    );

  return response.data.locations;
}

export async function createAdminLocation(
  token: string,
  payload: LocationPayload
): Promise<AdminLocation> {
  const response =
    await request<LocationResponse>(
      "/api/admin/locations",
      token,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );

  return response.data.location;
}

export async function updateAdminLocation(
  token: string,
  pincode: string,
  payload: Partial<LocationPayload>
): Promise<AdminLocation> {
  const response =
    await request<LocationResponse>(
      `/api/admin/locations/${encodeURIComponent(
        pincode
      )}`,
      token,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    );

  return response.data.location;
}

export async function disableAdminLocation(
  token: string,
  pincode: string
): Promise<AdminLocation> {
  const response =
    await request<LocationResponse>(
      `/api/admin/locations/${encodeURIComponent(
        pincode
      )}`,
      token,
      {
        method: "DELETE",
      }
    );

  return response.data.location;
}