// customer-app/src/context/OrderContext.tsx

import AsyncStorage from
  "@react-native-async-storage/async-storage";

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
  fetchRazorpayPaymentStatus,
  initiateRazorpayPayment,
  type CustomerOrder,
  type OrderPaymentMethod,
  type RazorpayPaymentSession,
} from "../services/api";

import { useAuth } from "./AuthContext";
import { useCart } from "./CartContext";

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

type StoredCheckoutState = {
  pendingCheckout:
    PendingCheckout | null;

  activePaymentSession:
    RazorpayPaymentSession | null;
};

type OrderContextValue = {
  pendingCheckout:
    PendingCheckout | null;

  activePaymentSession:
    RazorpayPaymentSession | null;

  checkoutReady: boolean;

  orders: CustomerOrder[];

  lastPlacedOrder:
    CustomerOrder | null;

  loadingOrders: boolean;
  placingOrder: boolean;

  cancellingOrderId:
    string | null;

  error: string | null;

  setPendingCheckout: (
    checkout:
      PendingCheckout | null
  ) => void;

  dismissOnlinePaymentSession:
    () => void;

  placeOrder: (
    paymentMethod:
      OrderPaymentMethod
  ) => Promise<
    CustomerOrder | null
  >;

  startOnlinePayment: (
    returnUrl: string
  ) => Promise<
    RazorpayPaymentSession | null
  >;

  completeOnlinePayment: (
    sessionToken: string
  ) => Promise<
    CustomerOrder | null
  >;

  refreshOrders: () =>
    Promise<void>;

  cancelOrder: (
    orderId: string,
    reason?: string
  ) => Promise<boolean>;

  getOrderById: (
    orderId: string
  ) =>
    | CustomerOrder
    | undefined;

  clearError: () => void;
};

const CHECKOUT_STORAGE_KEY =
  "@sipbite/checkout:v1";

const OrderContext =
  createContext<
    OrderContextValue | undefined
  >(undefined);

async function persistCheckoutState(
  pendingCheckout:
    PendingCheckout | null,

  activePaymentSession:
    RazorpayPaymentSession | null
) {
  try {
    if (
      !pendingCheckout &&
      !activePaymentSession
    ) {
      await AsyncStorage.removeItem(
        CHECKOUT_STORAGE_KEY
      );

      return;
    }

    const storedValue:
      StoredCheckoutState = {
        pendingCheckout,
        activePaymentSession,
      };

    await AsyncStorage.setItem(
      CHECKOUT_STORAGE_KEY,
      JSON.stringify(storedValue)
    );
  } catch (error) {
    console.warn(
      "Unable to save checkout state:",
      error
    );
  }
}

export function OrderProvider({
  children,
}: {
  children: ReactNode;
}) {
  const {
    token,
    isAuthenticated,
    loading: authLoading,
  } = useAuth();

  const {
    items,
    clearCart,
    hydrated: cartHydrated,
  } = useCart();

  const [
    pendingCheckout,
    setPendingCheckoutState,
  ] =
    useState<PendingCheckout | null>(
      null
    );

  const [
    activePaymentSession,
    setActivePaymentSession,
  ] =
    useState<RazorpayPaymentSession | null>(
      null
    );

  const [
    checkoutStorageReady,
    setCheckoutStorageReady,
  ] = useState(false);

  const [orders, setOrders] =
    useState<CustomerOrder[]>([]);

  const [
    lastPlacedOrder,
    setLastPlacedOrder,
  ] =
    useState<CustomerOrder | null>(
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
  ] =
    useState<string | null>(
      null
    );

  const [error, setError] =
    useState<string | null>(
      null
    );

  const checkoutReady =
    cartHydrated &&
    checkoutStorageReady;

  useEffect(() => {
    let mounted = true;

    async function restoreCheckout() {
      try {
        const storedValue =
          await AsyncStorage.getItem(
            CHECKOUT_STORAGE_KEY
          );

        if (!storedValue) {
          return;
        }

        const parsedValue =
          JSON.parse(
            storedValue
          ) as Partial<StoredCheckoutState>;

        if (!mounted) {
          return;
        }

        if (
          parsedValue.pendingCheckout &&
          typeof parsedValue
            .pendingCheckout ===
            "object"
        ) {
          setPendingCheckoutState(
            parsedValue.pendingCheckout
          );
        }

        if (
          parsedValue.activePaymentSession &&
          typeof parsedValue
            .activePaymentSession ===
            "object"
        ) {
          setActivePaymentSession(
            parsedValue.activePaymentSession
          );
        }
      } catch (restoreError) {
        console.warn(
          "Unable to restore checkout state:",
          restoreError
        );

        await AsyncStorage.removeItem(
          CHECKOUT_STORAGE_KEY
        );
      } finally {
        if (mounted) {
          setCheckoutStorageReady(
            true
          );
        }
      }
    }

    void restoreCheckout();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!checkoutStorageReady) {
      return;
    }

    void persistCheckoutState(
      pendingCheckout,
      activePaymentSession
    );
  }, [
    checkoutStorageReady,
    pendingCheckout,
    activePaymentSession,
  ]);

  const clearError =
    useCallback(() => {
      setError(null);
    }, []);

  const setPendingCheckout =
    useCallback(
      (
        checkout:
          PendingCheckout | null
      ) => {
        setPendingCheckoutState(
          checkout
        );
      },
      []
    );

  const dismissOnlinePaymentSession =
    useCallback(() => {
      setActivePaymentSession(
        null
      );

      void persistCheckoutState(
        pendingCheckout,
        null
      );
    }, [pendingCheckout]);

  const refreshOrders =
    useCallback(async () => {
      if (!token) {
        setOrders([]);
        return;
      }

      setLoadingOrders(true);

      try {
        const latestOrders =
          await fetchMyOrders(
            token
          );

        setOrders(
          latestOrders
        );
      } catch (requestError) {
        setError(
          requestError instanceof
            Error
            ? requestError.message
            : "Unable to load your orders."
        );
      } finally {
        setLoadingOrders(false);
      }
    }, [token]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (
      isAuthenticated &&
      token
    ) {
      void refreshOrders();
      return;
    }

    setOrders([]);
    setLastPlacedOrder(
      null
    );
  }, [
    authLoading,
    isAuthenticated,
    token,
    refreshOrders,
  ]);

  const buildCheckoutInput =
    useCallback(() => {
      if (!pendingCheckout) {
        return null;
      }

      return {
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
      };
    }, [
      items,
      pendingCheckout,
    ]);

  const acceptCompletedOrder =
    useCallback(
      (
        order: CustomerOrder
      ) => {
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

        setLastPlacedOrder(
          order
        );

        setPendingCheckoutState(
          null
        );

        setActivePaymentSession(
          null
        );

        clearCart();

        void persistCheckoutState(
          null,
          null
        );
      },
      [clearCart]
    );

  const placeOrder =
    useCallback(
      async (
        paymentMethod:
          OrderPaymentMethod
      ): Promise<
        CustomerOrder | null
      > => {
        if (!checkoutReady) {
          setError(
            "Checkout details are still loading."
          );

          return null;
        }

        if (!token) {
          setError(
            "Please log in before placing your order."
          );

          return null;
        }

        if (
          paymentMethod !== "cod"
        ) {
          setError(
            "Use Razorpay Checkout for online payment."
          );

          return null;
        }

        const checkoutInput =
          buildCheckoutInput();

        if (!checkoutInput) {
          setError(
            "Your delivery details are missing."
          );

          return null;
        }

        if (
          items.length === 0
        ) {
          setError(
            "Your cart is empty."
          );

          return null;
        }

        setPlacingOrder(true);
        setError(null);

        try {
          const order =
            await createCustomerOrder(
              token,
              {
                ...checkoutInput,

                paymentMethod:
                  "cod",
              }
            );

          acceptCompletedOrder(
            order
          );

          return order;
        } catch (requestError) {
          setError(
            requestError instanceof
              Error
              ? requestError.message
              : "Unable to place your order."
          );

          return null;
        } finally {
          setPlacingOrder(false);
        }
      },
      [
        checkoutReady,
        token,
        items.length,
        buildCheckoutInput,
        acceptCompletedOrder,
      ]
    );

  const startOnlinePayment =
    useCallback(
      async (
        returnUrl: string
      ): Promise<
        RazorpayPaymentSession | null
      > => {
        if (!checkoutReady) {
          setError(
            "Checkout details are still loading."
          );

          return null;
        }

        if (!token) {
          setError(
            "Please log in before making payment."
          );

          return null;
        }

        const checkoutInput =
          buildCheckoutInput();

        if (
          !checkoutInput ||
          items.length === 0
        ) {
          setError(
            "Your cart or delivery details are missing."
          );

          return null;
        }

        setPlacingOrder(true);
        setError(null);

        try {
          const paymentSession =
            await initiateRazorpayPayment(
              token,
              {
                ...checkoutInput,
                returnUrl,
              }
            );

          setActivePaymentSession(
            paymentSession
          );

          /*
           * Store this immediately before
           * leaving the Expo web app.
           */
          await persistCheckoutState(
            pendingCheckout,
            paymentSession
          );

          return paymentSession;
        } catch (requestError) {
          setError(
            requestError instanceof
              Error
              ? requestError.message
              : "Unable to start Razorpay Checkout."
          );

          return null;
        } finally {
          setPlacingOrder(false);
        }
      },
      [
        checkoutReady,
        token,
        items.length,
        pendingCheckout,
        buildCheckoutInput,
      ]
    );

  const completeOnlinePayment =
    useCallback(
      async (
        sessionToken: string
      ): Promise<
        CustomerOrder | null
      > => {
        if (!checkoutReady) {
          setError(
            "Your checkout information is still loading."
          );

          return null;
        }

        if (!token) {
          setError(
            "Please log in to verify your payment."
          );

          return null;
        }

        setPlacingOrder(true);
        setError(null);

        try {
          const result =
            await fetchRazorpayPaymentStatus(
              token,
              sessionToken
            );

          if (
            result.status ===
              "paid" &&
            result.order
          ) {
            acceptCompletedOrder(
              result.order
            );

            return result.order;
          }

          if (
            [
              "failed",
              "expired",
            ].includes(
              result.status
            )
          ) {
            setActivePaymentSession(
              null
            );

            await persistCheckoutState(
              pendingCheckout,
              null
            );

            setError(
              result.message ||
                "The online payment was not completed."
            );

            return null;
          }

          if (
            result.status ===
            "abandoned"
          ) {
            setActivePaymentSession(
              null
            );

            await persistCheckoutState(
              pendingCheckout,
              null
            );

            setError(
              result.message ||
                "Payment was not completed. You can try again."
            );

            return null;
          }

          setError(
            result.message ||
              "Payment confirmation is still processing. Please try checking again."
          );

          return null;
        } catch (requestError) {
          setError(
            requestError instanceof
              Error
              ? requestError.message
              : "Unable to confirm the payment."
          );

          return null;
        } finally {
          setPlacingOrder(false);
        }
      },
      [
        checkoutReady,
        token,
        pendingCheckout,
        acceptCompletedOrder,
      ]
    );

  const cancelOrder =
    useCallback(
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

        setCancellingOrderId(
          orderId
        );

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
          setError(
            requestError instanceof
              Error
              ? requestError.message
              : "Unable to cancel this order."
          );

          return false;
        } finally {
          setCancellingOrderId(
            null
          );
        }
      },
      [token]
    );

  const getOrderById =
    useCallback(
      (
        orderId: string
      ) => {
        return (
          orders.find(
            (order) =>
              order._id ===
              orderId
          ) ??
          (lastPlacedOrder?._id ===
          orderId
            ? lastPlacedOrder
            : undefined)
        );
      },
      [
        orders,
        lastPlacedOrder,
      ]
    );

  const value =
    useMemo<OrderContextValue>(
      () => ({
        pendingCheckout,
        activePaymentSession,
        checkoutReady,
        orders,
        lastPlacedOrder,
        loadingOrders,
        placingOrder,
        cancellingOrderId,
        error,
        setPendingCheckout,
        dismissOnlinePaymentSession,
        placeOrder,
        startOnlinePayment,
        completeOnlinePayment,
        refreshOrders,
        cancelOrder,
        getOrderById,
        clearError,
      }),
      [
        pendingCheckout,
        activePaymentSession,
        checkoutReady,
        orders,
        lastPlacedOrder,
        loadingOrders,
        placingOrder,
        cancellingOrderId,
        error,
        setPendingCheckout,
        dismissOnlinePaymentSession,
        placeOrder,
        startOnlinePayment,
        completeOnlinePayment,
        refreshOrders,
        cancelOrder,
        getOrderById,
        clearError,
      ]
    );

  return (
    <OrderContext.Provider
      value={value}
    >
      {children}
    </OrderContext.Provider>
  );
}

export function useOrders() {
  const context =
    useContext(OrderContext);

  if (!context) {
    throw new Error(
      "useOrders must be used inside OrderProvider"
    );
  }

  return context;
}