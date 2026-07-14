const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL ??
  "http://localhost:5001"
).replace(/\/$/, "");

type ApiBaseResponse = {
  success: boolean;
  message?: string;
};

type PrintLinkResponse =
  ApiBaseResponse & {
    data: {
      printUrl: string;
      expiresIn: string;
    };
  };

async function request<T>(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
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

export async function createCustomerInvoicePrintLink(
  token: string,
  orderRef: string
): Promise<string> {
  const response =
    await request<PrintLinkResponse>(
      `/api/invoices/orders/${encodeURIComponent(
        orderRef
      )}/print-link`,
      token,
      {
        method: "POST",
      }
    );

  const printUrl =
    response.data.printUrl;

  if (
    printUrl.startsWith("http://") ||
    printUrl.startsWith("https://")
  ) {
    return printUrl;
  }

  return `${API_BASE_URL}${printUrl}`;
}