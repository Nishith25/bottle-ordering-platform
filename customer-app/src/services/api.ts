// customer-app/src/services/api.ts

import type {
  Product,
  ProductCategory,
} from "../data/products";

const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL ??
  "http://localhost:5001"
).replace(/\/$/, "");

type ApiBaseResponse = {
  success: boolean;
  message?: string;
};

type ProductsResponse = ApiBaseResponse & {
  count: number;
  data: BackendProduct[];
};

type LocationCheckResponse = ApiBaseResponse & {
  serviceable: boolean;
  data: ServiceableLocation | null;
};

type BackendProduct = {
  _id: string;
  productId: string;
  name: string;
  shortName: string;
  description: string;
  ingredients: string[];
  sizeMl: number;
  price: number;
  category: ProductCategory;
  imageUrl?: string;
  liquidColor: string;
  cardColor: string;
  accentColor: string;
  subscriptionEligible: boolean;
  available: boolean;
  sortOrder?: number;
};

export type ServiceableLocation = {
  _id?: string;
  pincode: string;
  area: string;
  city: string;
  active: boolean;
  deliveryFee: number;
  minimumOrder: number;
  sortOrder?: number;
};

export type PincodeCheckResult = {
  serviceable: boolean;
  message: string;
  location: ServiceableLocation | null;
};

async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 10000);

  try {
    const response = await fetch(
      `${API_BASE_URL}${path}`,
      {
        ...options,
        headers: {
          Accept: "application/json",
          ...(options.body
            ? {
                "Content-Type": "application/json",
              }
            : {}),
          ...(options.headers as
            | Record<string, string>
            | undefined),
        },
        signal: controller.signal,
      }
    );

    const payload = (await response.json()) as T &
      ApiBaseResponse;

    if (!response.ok || payload.success === false) {
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

    if (error instanceof Error) {
      throw error;
    }

    throw new Error(
      "Unable to connect to the backend."
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

function normaliseProduct(
  product: BackendProduct
): Product {
  return {
    id: product.productId,
    databaseId: product._id,
    name: product.name,
    shortName: product.shortName,
    description: product.description,
    ingredients: product.ingredients ?? [],
    sizeMl: product.sizeMl,
    price: product.price,
    category: product.category,
    imageUrl: product.imageUrl ?? "",
    liquidColor: product.liquidColor,
    cardColor: product.cardColor,
    accentColor: product.accentColor,
    subscriptionEligible:
      product.subscriptionEligible,
    available: product.available,
    sortOrder: product.sortOrder ?? 0,
  };
}

export async function fetchProducts(): Promise<
  Product[]
> {
  const response =
    await apiRequest<ProductsResponse>(
      "/api/products"
    );

  return response.data.map(normaliseProduct);
}

export async function checkServiceablePincode(
  pincode: string
): Promise<PincodeCheckResult> {
  const normalisedPincode =
    pincode.replace(/\D/g, "");

  if (normalisedPincode.length !== 6) {
    throw new Error(
      "Please enter a valid six-digit pincode."
    );
  }

  const response =
    await apiRequest<LocationCheckResponse>(
      `/api/locations/check/${normalisedPincode}`
    );

  return {
    serviceable: response.serviceable,
    message:
      response.message ??
      (response.serviceable
        ? "Delivery is available."
        : "Delivery is not available."),
    location: response.data,
  };
}

export { API_BASE_URL };