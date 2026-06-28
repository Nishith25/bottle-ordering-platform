// customer-app/src/context/ProductContext.tsx

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { Product } from "../data/products";
import { fetchProducts } from "../services/api";

type ProductContextValue = {
  products: Product[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refreshProducts: () => Promise<void>;
};

const ProductContext = createContext<
  ProductContextValue | undefined
>(undefined);

export function ProductProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [products, setProducts] = useState<Product[]>(
    []
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] = useState<string | null>(
    null
  );

  const loadProducts = useCallback(
    async (refresh = false) => {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      try {
        const latestProducts = await fetchProducts();

        setProducts(latestProducts);
      } catch (requestError) {
        const message =
          requestError instanceof Error
            ? requestError.message
            : "Unable to load bottles.";

        setError(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const refreshProducts = useCallback(async () => {
    await loadProducts(true);
  }, [loadProducts]);

  const value = useMemo(
    () => ({
      products,
      loading,
      refreshing,
      error,
      refreshProducts,
    }),
    [
      products,
      loading,
      refreshing,
      error,
      refreshProducts,
    ]
  );

  return (
    <ProductContext.Provider value={value}>
      {children}
    </ProductContext.Provider>
  );
}

export function useProducts() {
  const context = useContext(ProductContext);

  if (!context) {
    throw new Error(
      "useProducts must be used inside ProductProvider"
    );
  }

  return context;
}