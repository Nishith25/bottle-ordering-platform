const API_BASE_URL = (
  import.meta.env.VITE_API_URL ??
  "http://localhost:5001"
).replace(/\/$/, "");

export type AdminInvoice = {
  invoiceNumber: string;
  invoiceDate: string;
  orderId: string;
  orderNumber: string;
  orderDate: string;

  brand: {
    name: string;
    legalName: string;
    supportEmail: string;
    phone: string;
    address: string;
    fssai: string;
    gstin: string;
  };

  customer: {
    name: string;
    phone: string;
    address: string;
  };

  delivery: {
    dateId: string;
    slotLabel: string;
  };

  payment: {
    method: string;
    status: string;
  };

  status: {
    order: string;
    delivery: string;
  };

  items: Array<{
    productId: string;
    name: string;
    shortName: string;
    sizeMl: number;
    quantity: number;
    price: number;
    lineTotal: number;
  }>;

  totals: {
    bottleCount: number;
    subtotal: number;
    deliveryFee: number;
    couponDiscount: number;
    total: number;
  };
};

type ApiBaseResponse = {
  success: boolean;
  message?: string;
};

type InvoiceResponse =
  ApiBaseResponse & {
    data: {
      invoice: AdminInvoice;
    };
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

export async function fetchAdminInvoice(
  token: string,
  orderRef: string
): Promise<AdminInvoice> {
  const response =
    await request<InvoiceResponse>(
      `/api/invoices/orders/${encodeURIComponent(
        orderRef
      )}`,
      token
    );

  return response.data.invoice;
}

export async function createAdminInvoicePrintLink(
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