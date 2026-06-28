// customer-app/src/context/OrderContext.tsx

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  cancelCustomerOrder,
  createCustomerOrder,
  fetchMyOrders,
  type CustomerOrder,
  type OrderPaymentMethod,
} from "../services/api";

import { useAuth } from "./AuthContext";
import { useCart } from "./CartContext";

/**
 * Compatibility type for any existing screen that
 * still imports PaymentMethod from OrderContext.
 */
export type PaymentMethod =
  OrderPaymentMethod;

export type PendingCheckout = {
  fullName: string;
  phone: string;
  pincode: string;

  houseDetails: string;
  areaDetails: string;
  landmark: string;

  area: string;
  city: string;

  deliveryDateId: string;
  deliveryDateLabel: string;
  deliverySlot: string;

  deliveryFee: number;
  subtotal: number;
  total: number;
};

type OrderContextValue = {
  pendingCheckout: PendingCheckout | null;

  orders: CustomerOrder[];

  lastPlacedOrder: CustomerOrder | null;

  loadingOrders: boolean;
  placingOrder: boolean;

  cancellingOrderId: string | null;

  error: string | null;

  setPendingCheckout: (
    checkout: PendingCheckout | null
  ) => void;

  placeOrder: (
    paymentMethod: OrderPaymentMethod
  ) => Promise<CustomerOrder | null>;

  refreshOrders: () => Promise<void>;

  cancelOrder: (
    orderId: string,
    reason?: string
  ) => Promise<boolean>;

  getOrderById: (
    orderId: string
  ) => CustomerOrder | undefined;

  clearError: () => void;
};

const OrderContext = createContext<
  OrderContextValue | undefined
>(undefined);

export function OrderProvider({
  children,
}: {
  children: ReactNode;
}) {
  const {
    token,
    isAuthenticated,
  } = useAuth();

  const {
    items,
    clearCart,
  } = useCart();

  const [
    pendingCheckout,
    setPendingCheckout,
  ] = useState<PendingCheckout | null>(
    null
  );

  const [orders, setOrders] = useState<
    CustomerOrder[]
  >([]);

  const [
    lastPlacedOrder,
    setLastPlacedOrder,
  ] = useState<CustomerOrder | null>(
    null
  );

  const [
    loadingOrders,
    setLoadingOrders,
  ] = useState(false);

  const [
    placingOrder,
    setPlacingOrder,
  ] = useState(false);

  const [
    cancellingOrderId,
    setCancellingOrderId,
  ] = useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const refreshOrders =
    useCallback(async () => {
      if (!token) {
        setOrders([]);
        return;
      }

      setLoadingOrders(true);
      setError(null);

      try {
        const latestOrders =
          await fetchMyOrders(token);

        setOrders(latestOrders);
      } catch (requestError) {
        const message =
          requestError instanceof Error
            ? requestError.message
            : "Unable to load your orders.";

        setError(message);
      } finally {
        setLoadingOrders(false);
      }
    }, [token]);

  useEffect(() => {
    if (
      isAuthenticated &&
      token
    ) {
      void refreshOrders();
      return;
    }

    setOrders([]);
    setLastPlacedOrder(null);
    setPendingCheckout(null);
  }, [
    isAuthenticated,
    token,
    refreshOrders,
  ]);

  const placeOrder = useCallback(
    async (
      paymentMethod: OrderPaymentMethod
    ): Promise<CustomerOrder | null> => {
      if (!token) {
        setError(
          "Please log in before placing your order."
        );

        return null;
      }

      if (!pendingCheckout) {
        setError(
          "Your delivery details are missing."
        );

        return null;
      }

      if (items.length === 0) {
        setError("Your cart is empty.");

        return null;
      }

      setPlacingOrder(true);
      setError(null);

      try {
        const order =
          await createCustomerOrder(
            token,
            {
              items: items.map(
                (item) => ({
                  productId:
                    item.product.id,

                  quantity:
                    item.quantity,
                })
              ),

              deliveryAddress: {
                fullName:
                  pendingCheckout.fullName,

                phone:
                  pendingCheckout.phone,

                pincode:
                  pendingCheckout.pincode,

                houseDetails:
                  pendingCheckout.houseDetails,

                areaDetails:
                  pendingCheckout.areaDetails,

                landmark:
                  pendingCheckout.landmark,
              },

              deliverySchedule: {
                deliveryDateId:
                  pendingCheckout.deliveryDateId,

                deliveryDateLabel:
                  pendingCheckout.deliveryDateLabel,

                deliverySlot:
                  pendingCheckout.deliverySlot,
              },

              paymentMethod,
            }
          );

        setOrders(
          (currentOrders) => [
            order,

            ...currentOrders.filter(
              (currentOrder) =>
                currentOrder._id !==
                order._id
            ),
          ]
        );

        setLastPlacedOrder(order);

        setPendingCheckout(null);

        clearCart();

        return order;
      } catch (requestError) {
        const message =
          requestError instanceof Error
            ? requestError.message
            : "Unable to place your order.";

        setError(message);

        return null;
      } finally {
        setPlacingOrder(false);
      }
    },
    [
      token,
      pendingCheckout,
      items,
      clearCart,
    ]
  );

  const cancelOrder = useCallback(
    async (
      orderId: string,
      reason =
        "Cancelled by customer"
    ): Promise<boolean> => {
      if (!token) {
        setError(
          "Please log in to cancel an order."
        );

        return false;
      }

      setCancellingOrderId(orderId);
      setError(null);

      try {
        const updatedOrder =
          await cancelCustomerOrder(
            token,
            orderId,
            reason
          );

        setOrders(
          (currentOrders) =>
            currentOrders.map(
              (order) =>
                order._id ===
                updatedOrder._id
                  ? updatedOrder
                  : order
            )
        );

        setLastPlacedOrder(
          (currentOrder) =>
            currentOrder?._id ===
            updatedOrder._id
              ? updatedOrder
              : currentOrder
        );

        return true;
      } catch (requestError) {
        const message =
          requestError instanceof Error
            ? requestError.message
            : "Unable to cancel this order.";

        setError(message);

        return false;
      } finally {
        setCancellingOrderId(null);
      }
    },
    [token]
  );

  const getOrderById = useCallback(
    (
      orderId: string
    ): CustomerOrder | undefined => {
      const matchingOrder =
        orders.find(
          (order) =>
            order._id === orderId
        );

      if (matchingOrder) {
        return matchingOrder;
      }

      if (
        lastPlacedOrder?._id ===
        orderId
      ) {
        return lastPlacedOrder;
      }

      return undefined;
    },
    [orders, lastPlacedOrder]
  );

  const value =
    useMemo<OrderContextValue>(
      () => ({
        pendingCheckout,
        orders,
        lastPlacedOrder,
        loadingOrders,
        placingOrder,
        cancellingOrderId,
        error,
        setPendingCheckout,
        placeOrder,
        refreshOrders,
        cancelOrder,
        getOrderById,
        clearError,
      }),
      [
        pendingCheckout,
        orders,
        lastPlacedOrder,
        loadingOrders,
        placingOrder,
        cancellingOrderId,
        error,
        placeOrder,
        refreshOrders,
        cancelOrder,
        getOrderById,
        clearError,
      ]
    );

  return (
    <OrderContext.Provider value={value}>
      {children}
    </OrderContext.Provider>
  );
}

export function useOrders(): OrderContextValue {
  const context =
    useContext(OrderContext);

  if (!context) {
    throw new Error(
      "useOrders must be used inside OrderProvider"
    );
  }

  return context;
}