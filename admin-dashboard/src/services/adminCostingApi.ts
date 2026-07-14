const API_BASE_URL = (
  import.meta.env.VITE_API_URL ??
  "http://localhost:5001"
).replace(/\/$/, "");

export type AdminProductCost = {
  _id: string;
  productId: string;
  productName: string;
  bottleCost: number;
  printingCost: number;
  fruitCost: number;
  juiceCost: number;
  packagingCost: number;
  deliveryCost: number;
  otherCost: number;
  wastagePercent: number;
  baseCost: number;
  totalCost: number;

  updatedBySnapshot:
    | {
        fullName: string;
        email: string;
        role: string;
      }
    | null;

  createdAt: string;
  updatedAt: string;
};

export type AdminBusinessExpense = {
  _id: string;
  expenseDateId: string;
  title: string;

  category:
    | "fruit"
    | "juice"
    | "bottle"
    | "printing"
    | "packaging"
    | "delivery"
    | "marketing"
    | "labour"
    | "rent"
    | "utilities"
    | "wastage"
    | "other";

  amount: number;
  vendorName: string;
  notes: string;

  createdBySnapshot:
    | {
        fullName: string;
        email: string;
        role: string;
      }
    | null;

  createdAt: string;
  updatedAt: string;
};

export type AdminExpenseSummary = {
  totalAmount: number;
  categoryTotals: Record<string, number>;
};

export type ProductCostPayload = {
  bottleCost: number;
  printingCost: number;
  fruitCost: number;
  juiceCost: number;
  packagingCost: number;
  deliveryCost: number;
  otherCost: number;
  wastagePercent: number;
};

export type CreateExpensePayload = {
  expenseDateId: string;
  title: string;
  category: AdminBusinessExpense["category"];
  amount: number;
  vendorName?: string;
  notes?: string;
};

type ApiBaseResponse = {
  success: boolean;
  message?: string;
};

type ProductCostsResponse =
  ApiBaseResponse & {
    count: number;

    data: {
      costs: AdminProductCost[];
    };
  };

type ProductCostResponse =
  ApiBaseResponse & {
    data: {
      cost: AdminProductCost;
    };
  };

type ExpensesResponse =
  ApiBaseResponse & {
    count: number;

    data: {
      expenses: AdminBusinessExpense[];
      summary: AdminExpenseSummary;
    };
  };

type ExpenseResponse =
  ApiBaseResponse & {
    data: {
      expense: AdminBusinessExpense;
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

export async function fetchAdminProductCosts(
  token: string
): Promise<AdminProductCost[]> {
  const response =
    await request<ProductCostsResponse>(
      "/api/admin/costing/product-costs",
      token
    );

  return response.data.costs;
}

export async function updateAdminProductCost(
  token: string,
  productId: string,
  payload: ProductCostPayload
): Promise<AdminProductCost> {
  const response =
    await request<ProductCostResponse>(
      `/api/admin/costing/product-costs/${encodeURIComponent(
        productId
      )}`,
      token,
      {
        method: "PATCH",

        body: JSON.stringify(
          payload
        ),
      }
    );

  return response.data.cost;
}

export async function fetchAdminExpenses(
  token: string,
  options: {
    from: string;
    to: string;
  }
): Promise<{
  expenses: AdminBusinessExpense[];
  summary: AdminExpenseSummary;
}> {
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

  const response =
    await request<ExpensesResponse>(
      `/api/admin/costing/expenses?${parameters.toString()}`,
      token
    );

  return response.data;
}

export async function createAdminExpense(
  token: string,
  payload: CreateExpensePayload
): Promise<AdminBusinessExpense> {
  const response =
    await request<ExpenseResponse>(
      "/api/admin/costing/expenses",
      token,
      {
        method: "POST",

        body: JSON.stringify(
          payload
        ),
      }
    );

  return response.data.expense;
}

export async function deleteAdminExpense(
  token: string,
  expenseId: string
): Promise<void> {
  await request<ApiBaseResponse>(
    `/api/admin/costing/expenses/${expenseId}`,
    token,
    {
      method: "DELETE",
    }
  );
}