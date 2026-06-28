// customer-app/src/context/CartContext.tsx

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import type {
  Product,
} from "../data/products";

export type CartItem = {
  product: Product;
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  subtotal: number;

  addItem: (
    product: Product
  ) => void;

  increaseItem: (
    productId: string
  ) => void;

  decreaseItem: (
    productId: string
  ) => void;

  removeItem: (
    productId: string
  ) => void;

  clearCart: () => void;

  getQuantity: (
    productId: string
  ) => number;

  syncProducts: (
    products: Product[]
  ) => void;
};

const CartContext =
  createContext<
    CartContextValue | undefined
  >(undefined);

const MAX_ORDER_QUANTITY = 50;

function getProductLimit(
  product: Product
) {
  if (
    !product.available ||
    product.stockQuantity <= 0
  ) {
    return 0;
  }

  return Math.min(
    product.stockQuantity,
    MAX_ORDER_QUANTITY
  );
}

export function CartProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [items, setItems] =
    useState<CartItem[]>([]);

  const addItem =
    useCallback(
      (product: Product) => {
        const productLimit =
          getProductLimit(product);

        if (productLimit <= 0) {
          return;
        }

        setItems(
          (currentItems) => {
            const existingItem =
              currentItems.find(
                (item) =>
                  item.product.id ===
                  product.id
              );

            if (existingItem) {
              if (
                existingItem.quantity >=
                productLimit
              ) {
                return currentItems;
              }

              return currentItems.map(
                (item) =>
                  item.product.id ===
                  product.id
                    ? {
                        ...item,
                        product,
                        quantity:
                          item.quantity +
                          1,
                      }
                    : item
              );
            }

            return [
              ...currentItems,

              {
                product,
                quantity: 1,
              },
            ];
          }
        );
      },
      []
    );

  const increaseItem =
    useCallback(
      (productId: string) => {
        setItems(
          (currentItems) =>
            currentItems.map(
              (item) => {
                if (
                  item.product.id !==
                  productId
                ) {
                  return item;
                }

                const productLimit =
                  getProductLimit(
                    item.product
                  );

                if (
                  item.quantity >=
                  productLimit
                ) {
                  return item;
                }

                return {
                  ...item,

                  quantity:
                    item.quantity +
                    1,
                };
              }
            )
        );
      },
      []
    );

  const decreaseItem =
    useCallback(
      (productId: string) => {
        setItems(
          (currentItems) =>
            currentItems
              .map((item) =>
                item.product.id ===
                productId
                  ? {
                      ...item,

                      quantity:
                        item.quantity -
                        1,
                    }
                  : item
              )
              .filter(
                (item) =>
                  item.quantity > 0
              )
        );
      },
      []
    );

  const removeItem =
    useCallback(
      (productId: string) => {
        setItems(
          (currentItems) =>
            currentItems.filter(
              (item) =>
                item.product.id !==
                productId
            )
        );
      },
      []
    );

  const clearCart =
    useCallback(() => {
      setItems([]);
    }, []);

  const getQuantity =
    useCallback(
      (productId: string) =>
        items.find(
          (item) =>
            item.product.id ===
            productId
        )?.quantity ?? 0,
      [items]
    );

  const syncProducts =
    useCallback(
      (
        latestProducts:
          Product[]
      ) => {
        const productsById =
          new Map(
            latestProducts.map(
              (product) => [
                product.id,
                product,
              ]
            )
          );

        setItems(
          (currentItems) =>
            currentItems.flatMap(
              (item) => {
                const latestProduct =
                  productsById.get(
                    item.product.id
                  );

                if (
                  !latestProduct ||
                  !latestProduct.available ||
                  latestProduct.stockQuantity <=
                    0
                ) {
                  return [];
                }

                const quantity =
                  Math.min(
                    item.quantity,

                    getProductLimit(
                      latestProduct
                    )
                  );

                if (quantity <= 0) {
                  return [];
                }

                return [
                  {
                    product:
                      latestProduct,

                    quantity,
                  },
                ];
              }
            )
        );
      },
      []
    );

  const itemCount =
    useMemo(
      () =>
        items.reduce(
          (total, item) =>
            total +
            item.quantity,
          0
        ),
      [items]
    );

  const subtotal =
    useMemo(
      () =>
        items.reduce(
          (total, item) =>
            total +
            item.product.price *
              item.quantity,
          0
        ),
      [items]
    );

  const value = useMemo(
    () => ({
      items,
      itemCount,
      subtotal,
      addItem,
      increaseItem,
      decreaseItem,
      removeItem,
      clearCart,
      getQuantity,
      syncProducts,
    }),
    [
      items,
      itemCount,
      subtotal,
      addItem,
      increaseItem,
      decreaseItem,
      removeItem,
      clearCart,
      getQuantity,
      syncProducts,
    ]
  );

  return (
    <CartContext.Provider
      value={value}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context =
    useContext(CartContext);

  if (!context) {
    throw new Error(
      "useCart must be used inside CartProvider"
    );
  }

  return context;
}