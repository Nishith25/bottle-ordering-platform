// customer-app/src/context/OrderContext.tsx

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import { useCart } from "./CartContext";

export type PaymentMethod = "online" | "cod";

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

export type OrderItem = {
  productId: string;
  name: string;
  shortName: string;
  sizeMl: number;
  price: number;
  quantity: number;
  cardColor: string;
  liquidColor: string;
  accentColor: string;
};

export type CustomerOrder = {
  id: string;
  displayId: string;
  createdAt: string;
  status: "confirmed" | "preparing" | "out_for_delivery" | "delivered";
  paymentMethod: PaymentMethod;
  paymentStatus: "pending" | "pay_on_delivery";
  items: OrderItem[];
  itemCount: number;
  delivery: PendingCheckout;
};

type OrderContextValue = {
  orders: CustomerOrder[];
  pendingCheckout: PendingCheckout | null;
  setPendingCheckout: (checkout: PendingCheckout | null) => void;
  placeOrder: (paymentMethod: PaymentMethod) => CustomerOrder | null;
  getOrderById: (orderId: string) => CustomerOrder | undefined;
};

const OrderContext = createContext<OrderContextValue | undefined>(
  undefined
);

export function OrderProvider({
  children,
}: {
  children: ReactNode;
}) {
  const {
    items,
    itemCount,
    clearCart,
  } = useCart();

  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [pendingCheckout, setPendingCheckout] =
    useState<PendingCheckout | null>(null);

  const placeOrder = useCallback(
    (paymentMethod: PaymentMethod) => {
      if (!pendingCheckout || items.length === 0) {
        return null;
      }

      const now = new Date();
      const timestamp = now.getTime();

      const order: CustomerOrder = {
        id: `order-${timestamp}`,
        displayId: `ORD${String(timestamp).slice(-8)}`,
        createdAt: now.toISOString(),
        status: "confirmed",
        paymentMethod,
        paymentStatus:
          paymentMethod === "cod"
            ? "pay_on_delivery"
            : "pending",
        itemCount,
        delivery: pendingCheckout,
        items: items.map(({ product, quantity }) => ({
          productId: product.id,
          name: product.name,
          shortName: product.shortName,
          sizeMl: product.sizeMl,
          price: product.price,
          quantity,
          cardColor: product.cardColor,
          liquidColor: product.liquidColor,
          accentColor: product.accentColor,
        })),
      };

      setOrders((currentOrders) => [
        order,
        ...currentOrders,
      ]);

      clearCart();
      setPendingCheckout(null);

      return order;
    },
    [
      pendingCheckout,
      items,
      itemCount,
      clearCart,
    ]
  );

  const getOrderById = useCallback(
    (orderId: string) =>
      orders.find((order) => order.id === orderId),
    [orders]
  );

  const value = useMemo(
    () => ({
      orders,
      pendingCheckout,
      setPendingCheckout,
      placeOrder,
      getOrderById,
    }),
    [
      orders,
      pendingCheckout,
      placeOrder,
      getOrderById,
    ]
  );

  return (
    <OrderContext.Provider value={value}>
      {children}
    </OrderContext.Provider>
  );
}

export function useOrders() {
  const context = useContext(OrderContext);

  if (!context) {
    throw new Error(
      "useOrders must be used inside OrderProvider"
    );
  }

  return context;
}