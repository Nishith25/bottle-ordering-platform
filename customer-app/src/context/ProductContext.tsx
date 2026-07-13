import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AppState,
  type AppStateStatus,
} from "react-native";

import type {
  Product,
} from "../data/products";

import {
  fetchProducts,
} from "../services/api";

type RefreshProductsOptions = {
  force?: boolean;
  showIndicator?: boolean;
};

type ProductContextValue = {
  products: Product[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  lastUpdatedAt: number | null;

  refreshProducts: (
    options?: RefreshProductsOptions
  ) => Promise<void>;
};

const ProductContext =
  createContext<
    ProductContextValue | undefined
  >(undefined);

const PRODUCT_REFRESH_INTERVAL_MS =
  10_000;

const MINIMUM_REFRESH_GAP_MS =
  8_000;

export function ProductProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [
    products,
    setProducts,
  ] = useState<Product[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null
  );

  const [
    lastUpdatedAt,
    setLastUpdatedAt,
  ] = useState<number | null>(
    null
  );

  const mountedRef =
    useRef(true);

  const requestInProgressRef =
    useRef<Promise<void> | null>(
      null
    );

  const lastSuccessfulFetchRef =
    useRef(0);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current =
        false;
    };
  }, []);

  const loadProducts =
    useCallback(
      async ({
        initial = false,
        force = false,
        showIndicator = false,
      }: {
        initial?: boolean;
        force?: boolean;
        showIndicator?: boolean;
      } = {}) => {
        const now =
          Date.now();

        const recentlyLoaded =
          lastSuccessfulFetchRef.current >
            0 &&
          now -
            lastSuccessfulFetchRef.current <
            MINIMUM_REFRESH_GAP_MS;

        if (
          !force &&
          recentlyLoaded
        ) {
          return;
        }

        if (
          requestInProgressRef.current
        ) {
          await requestInProgressRef.current;
          return;
        }

        if (initial) {
          setLoading(true);
        } else if (
          showIndicator
        ) {
          setRefreshing(true);
        }

        setError(null);

        const request =
          (async () => {
            try {
              const latestProducts =
                await fetchProducts();

              if (
                !mountedRef.current
              ) {
                return;
              }

              const completedAt =
                Date.now();

              lastSuccessfulFetchRef.current =
                completedAt;

              setProducts(
                latestProducts
              );

              setLastUpdatedAt(
                completedAt
              );
            } catch (
              requestError
            ) {
              if (
                !mountedRef.current
              ) {
                return;
              }

              const message =
                requestError instanceof
                Error
                  ? requestError.message
                  : "Unable to load bottles.";

              setError(message);
            } finally {
              if (
                mountedRef.current
              ) {
                setLoading(false);
                setRefreshing(false);
              }
            }
          })();

        requestInProgressRef.current =
          request;

        try {
          await request;
        } finally {
          if (
            requestInProgressRef.current ===
            request
          ) {
            requestInProgressRef.current =
              null;
          }
        }
      },
      []
    );

  useEffect(() => {
    void loadProducts({
      initial: true,
      force: true,
    });
  }, [
    loadProducts,
  ]);

  useEffect(() => {
    let currentAppState:
      AppStateStatus =
      AppState.currentState ??
      "active";

    const subscription =
      AppState.addEventListener(
        "change",
        (
          nextAppState
        ) => {
          const returningToForeground =
            currentAppState !==
              "active" &&
            nextAppState ===
              "active";

          currentAppState =
            nextAppState;

          if (
            returningToForeground
          ) {
            void loadProducts({
              force: true,
            });
          }
        }
      );

    const intervalId =
      setInterval(() => {
        if (
          currentAppState ===
          "active"
        ) {
          void loadProducts({
            force: false,
          });
        }
      }, PRODUCT_REFRESH_INTERVAL_MS);

    return () => {
      clearInterval(
        intervalId
      );

      subscription.remove();
    };
  }, [
    loadProducts,
  ]);

  const refreshProducts =
    useCallback(
      async (
        options:
          RefreshProductsOptions = {}
      ) => {
        await loadProducts({
          force:
            options.force ??
            false,

          showIndicator:
            options.showIndicator ??
            false,
        });
      },
      [
        loadProducts,
      ]
    );

  const value =
    useMemo<ProductContextValue>(
      () => ({
        products,
        loading,
        refreshing,
        error,
        lastUpdatedAt,
        refreshProducts,
      }),
      [
        products,
        loading,
        refreshing,
        error,
        lastUpdatedAt,
        refreshProducts,
      ]
    );

  return (
    <ProductContext.Provider
      value={value}
    >
      {children}
    </ProductContext.Provider>
  );
}

export function useProducts() {
  const context =
    useContext(
      ProductContext
    );

  if (!context) {
    throw new Error(
      "useProducts must be used inside ProductProvider"
    );
  }

  return context;
}