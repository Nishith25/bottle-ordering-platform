import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
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
  hydrated: boolean;

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

const CART_STORAGE_KEY =
  "@sipbite/cart:v1";

const MAX_ORDER_QUANTITY =
  50;

function getAvailableStock(
  product: Product
) {
  const stock =
    Number(
      product.stockQuantity
    );

  if (
    !Number.isFinite(stock)
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor(stock)
  );
}

function getProductLimit(
  product: Product
) {
  if (
    !product.available
  ) {
    return 0;
  }

  return Math.min(
    getAvailableStock(
      product
    ),
    MAX_ORDER_QUANTITY
  );
}

function areStringArraysEqual(
  first: string[],
  second: string[]
) {
  if (
    first.length !==
    second.length
  ) {
    return false;
  }

  return first.every(
    (
      value,
      index
    ) =>
      value ===
      second[index]
  );
}

function areProductsEquivalent(
  first: Product,
  second: Product
) {
  return (
    first.id ===
      second.id &&
    first.databaseId ===
      second.databaseId &&
    first.name ===
      second.name &&
    first.shortName ===
      second.shortName &&
    first.description ===
      second.description &&
    areStringArraysEqual(
      first.ingredients,
      second.ingredients
    ) &&
    first.sizeMl ===
      second.sizeMl &&
    first.price ===
      second.price &&
    first.category ===
      second.category &&
    first.imageUrl ===
      second.imageUrl &&
    first.liquidColor ===
      second.liquidColor &&
    first.cardColor ===
      second.cardColor &&
    first.accentColor ===
      second.accentColor &&
    first.subscriptionEligible ===
      second.subscriptionEligible &&
    first.available ===
      second.available &&
    first.stockQuantity ===
      second.stockQuantity &&
    first.lowStockThreshold ===
      second.lowStockThreshold &&
    first.sortOrder ===
      second.sortOrder
  );
}

function isStoredCartItem(
  value: unknown
): value is CartItem {
  if (
    !value ||
    typeof value !==
      "object"
  ) {
    return false;
  }

  const item =
    value as Partial<CartItem>;

  return Boolean(
    item.product &&
      typeof item.product ===
        "object" &&
      typeof item.product.id ===
        "string" &&
      item.product.id.length >
        0 &&
      Number.isInteger(
        item.quantity
      ) &&
      Number(
        item.quantity
      ) > 0
  );
}

export function CartProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [
    items,
    setItems,
  ] =
    useState<CartItem[]>(
      []
    );

  const [
    hydrated,
    setHydrated,
  ] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function restoreCart() {
      try {
        const storedValue =
          await AsyncStorage.getItem(
            CART_STORAGE_KEY
          );

        if (
          !storedValue
        ) {
          return;
        }

        const parsedValue:
          unknown =
          JSON.parse(
            storedValue
          );

        if (
          !Array.isArray(
            parsedValue
          )
        ) {
          return;
        }

        const restoredItems =
          parsedValue
            .filter(
              isStoredCartItem
            )
            .map(
              (item) => ({
                product:
                  item.product,

                quantity:
                  Math.min(
                    Math.max(
                      1,
                      item.quantity
                    ),
                    MAX_ORDER_QUANTITY
                  ),
              })
            );

        if (
          mounted
        ) {
          setItems(
            restoredItems
          );
        }
      } catch (error) {
        console.warn(
          "Unable to restore cart:",
          error
        );

        await AsyncStorage.removeItem(
          CART_STORAGE_KEY
        );
      } finally {
        if (
          mounted
        ) {
          setHydrated(
            true
          );
        }
      }
    }

    void restoreCart();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (
      !hydrated
    ) {
      return;
    }

    async function persistCart() {
      try {
        if (
          items.length ===
          0
        ) {
          await AsyncStorage.removeItem(
            CART_STORAGE_KEY
          );

          return;
        }

        await AsyncStorage.setItem(
          CART_STORAGE_KEY,
          JSON.stringify(
            items
          )
        );
      } catch (error) {
        console.warn(
          "Unable to save cart:",
          error
        );
      }
    }

    void persistCart();
  }, [
    hydrated,
    items,
  ]);

  const addItem =
    useCallback(
      (
        product: Product
      ) => {
        const productLimit =
          getProductLimit(
            product
          );

        if (
          productLimit <= 0
        ) {
          return;
        }

        setItems(
          (
            currentItems
          ) => {
            const existingItem =
              currentItems.find(
                (item) =>
                  item.product.id ===
                  product.id
              );

            if (
              existingItem
            ) {
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
      (
        productId: string
      ) => {
        setItems(
          (
            currentItems
          ) =>
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
                  productLimit <= 0 ||
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
      (
        productId: string
      ) => {
        setItems(
          (
            currentItems
          ) =>
            currentItems
              .map(
                (item) =>
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
                  item.quantity >
                  0
              )
        );
      },
      []
    );

  const removeItem =
    useCallback(
      (
        productId: string
      ) => {
        setItems(
          (
            currentItems
          ) =>
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

      void AsyncStorage.removeItem(
        CART_STORAGE_KEY
      );
    }, []);

  const getQuantity =
    useCallback(
      (
        productId: string
      ) =>
        items.find(
          (item) =>
            item.product.id ===
            productId
        )?.quantity ??
        0,
      [
        items,
      ]
    );

  const syncProducts =
    useCallback(
      (
        latestProducts:
          Product[]
      ) => {
        if (
          !hydrated
        ) {
          return;
        }

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
          (
            currentItems
          ) => {
            let changed =
              false;

            const synchronizedItems:
              CartItem[] =
              [];

            for (
              const item of
              currentItems
            ) {
              const latestProduct =
                productsById.get(
                  item.product.id
                );

              /*
               * Remove products that no longer exist or have been
               * intentionally disabled by the admin.
               */
              if (
                !latestProduct ||
                !latestProduct.available
              ) {
                changed = true;
                continue;
              }

              const availableStock =
                getAvailableStock(
                  latestProduct
                );

              /*
               * Important:
               *
               * When stock temporarily reaches zero, keep the product
               * in the cart. This allows checkout to resume when stock
               * is restored instead of permanently forgetting the item.
               */
              const nextQuantity =
                availableStock <= 0
                  ? Math.min(
                      Math.max(
                        1,
                        item.quantity
                      ),
                      MAX_ORDER_QUANTITY
                    )
                  : Math.min(
                      item.quantity,
                      availableStock,
                      MAX_ORDER_QUANTITY
                    );

              const productChanged =
                !areProductsEquivalent(
                  item.product,
                  latestProduct
                );

              const quantityChanged =
                nextQuantity !==
                item.quantity;

              if (
                productChanged ||
                quantityChanged
              ) {
                changed = true;

                synchronizedItems.push({
                  product:
                    latestProduct,

                  quantity:
                    nextQuantity,
                });

                continue;
              }

              synchronizedItems.push(
                item
              );
            }

            if (
              !changed &&
              synchronizedItems.length ===
                currentItems.length
            ) {
              return currentItems;
            }

            return synchronizedItems;
          }
        );
      },
      [
        hydrated,
      ]
    );

  const itemCount =
    useMemo(
      () =>
        items.reduce(
          (
            total,
            item
          ) =>
            total +
            item.quantity,
          0
        ),
      [
        items,
      ]
    );

  const subtotal =
    useMemo(
      () =>
        items.reduce(
          (
            total,
            item
          ) =>
            total +
            item.product.price *
              item.quantity,
          0
        ),
      [
        items,
      ]
    );

  const value =
    useMemo<CartContextValue>(
      () => ({
        items,
        itemCount,
        subtotal,
        hydrated,
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
        hydrated,
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
    useContext(
      CartContext
    );

  if (
    !context
  ) {
    throw new Error(
      "useCart must be used inside CartProvider"
    );
  }

  return context;
}