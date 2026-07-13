import {
  useEffect,
} from "react";

import {
  useCart,
} from "../context/CartContext";

import {
  useProducts,
} from "../context/ProductContext";

export default function LiveInventorySync() {
  const {
    products,
    loading,
  } = useProducts();

  const {
    hydrated,
    syncProducts,
  } = useCart();

  useEffect(() => {
    if (
      loading ||
      !hydrated
    ) {
      return;
    }

    /*
     * This intentionally also synchronizes an empty product list.
     * If every product becomes unavailable, stale products must be
     * removed from the cart.
     */
    syncProducts(
      products
    );
  }, [
    products,
    loading,
    hydrated,
    syncProducts,
  ]);

  return null;
}