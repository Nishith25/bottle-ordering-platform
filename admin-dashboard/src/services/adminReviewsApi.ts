const API_BASE_URL = (
  import.meta.env.VITE_API_URL ??
  "http://localhost:5001"
).replace(/\/$/, "");

type ApiResponse = {
  success: boolean;
  message?: string;
};

export type ReviewPerson = {
  _id?: string;
  id?: string;
  fullName: string;
  email: string;
  phone: string;

  role?:
    | "customer"
    | "admin"
    | "delivery";

  active?: boolean;
};

export type DeliveryReview = {
  _id: string;
  order: string;
  orderNumber: string;

  user:
    | string
    | ReviewPerson;

  customerSnapshot: {
    fullName: string;
    email: string;
    phone: string;
  };

  deliveryPartner:
    | string
    | ReviewPerson;

  deliveryPartnerSnapshot: {
    fullName: string;
    email: string;
    phone: string;
  };

  orderRating: number;
  deliveryRating: number;
  comment: string;
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type DeliveryReviewSummary = {
  totalReviews: number;
  averageOrderRating: number;
  averageDeliveryRating: number;
  fiveStarDeliveries: number;
};

type ReviewsResponse =
  ApiResponse & {
    count: number;

    data: {
      reviews:
        DeliveryReview[];

      summary:
        DeliveryReviewSummary;
    };
  };

async function request<T>(
  path: string,
  token: string
): Promise<T> {
  const response = await fetch(
    `${API_BASE_URL}${path}`,
    {
      headers: {
        Accept:
          "application/json",

        Authorization:
          `Bearer ${token}`,
      },
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
}

export async function fetchDeliveryReviews(
  token: string,
  options?: {
    search?: string;
    rating?: string;
  }
): Promise<{
  reviews: DeliveryReview[];
  summary: DeliveryReviewSummary;
}> {
  const parameters =
    new URLSearchParams();

  if (
    options?.search?.trim()
  ) {
    parameters.set(
      "search",
      options.search.trim()
    );
  }

  if (
    options?.rating &&
    options.rating !== "all"
  ) {
    parameters.set(
      "rating",
      options.rating
    );
  }

  const query =
    parameters.toString();

  const response =
    await request<ReviewsResponse>(
      `/api/order-reviews/admin${
        query
          ? `?${query}`
          : ""
      }`,
      token
    );

  return response.data;
}