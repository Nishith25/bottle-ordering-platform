const API_BASE_URL = (
  import.meta.env.VITE_API_URL ??
  "http://localhost:5001"
).replace(/\/$/, "");

export type SalesReportProductTotal = {
  productId: string;
  name: string;
  shortName: string;
  sizeMl: number;
  quantitySold: number;
  revenue: number;
  orderCount: number;
  costPerBottle: number;
  estimatedCost: number;
  estimatedGrossProfit: number;
};

export type SalesReportDateTotal = {
  dateId: string;
  orderCount: number;
  bottlesSold: number;
  revenue: number;
  codRevenue: number;
  onlineRevenue: number;
};

export type AdminSalesReport = {
  fromDateId: string;
  toDateId: string;
  fallbackCostPerBottle: number;

  summary: {
    orderCount: number;
    activeOrderCount: number;
    deliveredOrderCount: number;
    cancelledOrderCount: number;
    bottlesSold: number;
    grossRevenue: number;
    subtotalRevenue: number;
    deliveryFeeRevenue: number;
    couponDiscount: number;
    codRevenue: number;
    onlineRevenue: number;
    codPendingAmount: number;
    onlinePaidAmount: number;
    cancelledValue: number;
    refundedValue: number;
    estimatedProductCost: number;
    expenseTotal: number;
    estimatedCost: number;
    estimatedGrossProfit: number;
  };

  expenseSummary: {
    totalAmount: number;
    categoryTotals: Record<string, number>;
  };

  bestSellingProduct:
    | SalesReportProductTotal
    | null;

  paymentSplit: {
    cod: {
      orderCount: number;
      revenue: number;
      bottles: number;
    };

    online: {
      orderCount: number;
      revenue: number;
      bottles: number;
    };
  };

  productTotals:
    SalesReportProductTotal[];

  dateTotals:
    SalesReportDateTotal[];
};

type SalesReportResponse = {
  success: boolean;
  message?: string;

  data: {
    report: AdminSalesReport;
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

export async function fetchAdminSalesReport(
  token: string,
  options: {
    from: string;
    to: string;
    costPerBottle: number;
  }
): Promise<AdminSalesReport> {
  const parameters =
    new URLSearchParams();

  parameters.set(
    "from",
    options.from
  );

  parameters.set(
    "to",
    options.to
  );

  parameters.set(
    "costPerBottle",
    String(
      options.costPerBottle
    )
  );

  const response =
    await request<SalesReportResponse>(
      `/api/admin/reports/sales?${parameters.toString()}`,
      token
    );

  return response.data.report;
}