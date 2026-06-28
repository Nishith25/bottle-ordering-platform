// customer-app/src/context/SubscriptionContext.tsx

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import { PRODUCTS } from "../data/products";
import type {
  BillingCycle,
  SubscriptionPlan,
} from "../data/subscriptionPlans";

export type SubscriptionItem = {
  productId: string;
  name: string;
  shortName: string;
  quantity: number;
  price: number;
  sizeMl: number;
  cardColor: string;
  liquidColor: string;
  accentColor: string;
};

export type CustomerSubscription = {
  id: string;
  displayId: string;
  planId: string;
  planName: string;
  billingCycle: BillingCycle;
  status: "active" | "paused" | "cancelled";
  createdAt: string;
  bottleCount: number;
  deliveriesPerCycle: number;
  bottlesPerDelivery: number;
  discountPercent: number;
  originalTotal: number;
  total: number;
  preferredDay: string;
  preferredSlot: string;
  items: SubscriptionItem[];
};

type CreateSubscriptionInput = {
  plan: SubscriptionPlan;
  quantities: Record<string, number>;
  preferredDay: string;
  preferredSlot: string;
};

type SubscriptionContextValue = {
  subscriptions: CustomerSubscription[];
  createSubscription: (
    input: CreateSubscriptionInput
  ) => CustomerSubscription | null;
  cancelSubscription: (subscriptionId: string) => void;
  getSubscriptionById: (
    subscriptionId: string
  ) => CustomerSubscription | undefined;
};

const SubscriptionContext = createContext<
  SubscriptionContextValue | undefined
>(undefined);

export function SubscriptionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [subscriptions, setSubscriptions] = useState<
    CustomerSubscription[]
  >([]);

  const createSubscription = useCallback(
    ({
      plan,
      quantities,
      preferredDay,
      preferredSlot,
    }: CreateSubscriptionInput) => {
      const selectedItems = PRODUCTS.filter(
        (product) =>
          product.subscriptionEligible &&
          product.available &&
          (quantities[product.id] ?? 0) > 0
      ).map((product) => ({
        productId: product.id,
        name: product.name,
        shortName: product.shortName,
        quantity: quantities[product.id] ?? 0,
        price: product.price,
        sizeMl: product.sizeMl,
        cardColor: product.cardColor,
        liquidColor: product.liquidColor,
        accentColor: product.accentColor,
      }));

      const selectedBottleCount = selectedItems.reduce(
        (total, item) => total + item.quantity,
        0
      );

      if (
        selectedBottleCount !== plan.bottleCount ||
        selectedItems.length === 0
      ) {
        return null;
      }

      const originalTotal = selectedItems.reduce(
        (total, item) =>
          total + item.price * item.quantity,
        0
      );

      const total = Math.round(
        originalTotal *
          (1 - plan.discountPercent / 100)
      );

      const timestamp = Date.now();

      const subscription: CustomerSubscription = {
        id: `subscription-${timestamp}`,
        displayId: `SUB${String(timestamp).slice(-8)}`,
        planId: plan.id,
        planName: plan.name,
        billingCycle: plan.billingCycle,
        status: "active",
        createdAt: new Date().toISOString(),
        bottleCount: plan.bottleCount,
        deliveriesPerCycle: plan.deliveriesPerCycle,
        bottlesPerDelivery:
          plan.bottleCount / plan.deliveriesPerCycle,
        discountPercent: plan.discountPercent,
        originalTotal,
        total,
        preferredDay,
        preferredSlot,
        items: selectedItems,
      };

      setSubscriptions((currentSubscriptions) => [
        subscription,
        ...currentSubscriptions,
      ]);

      return subscription;
    },
    []
  );

  const cancelSubscription = useCallback(
    (subscriptionId: string) => {
      setSubscriptions((currentSubscriptions) =>
        currentSubscriptions.map((subscription) =>
          subscription.id === subscriptionId
            ? {
                ...subscription,
                status: "cancelled",
              }
            : subscription
        )
      );
    },
    []
  );

  const getSubscriptionById = useCallback(
    (subscriptionId: string) =>
      subscriptions.find(
        (subscription) =>
          subscription.id === subscriptionId
      ),
    [subscriptions]
  );

  const value = useMemo(
    () => ({
      subscriptions,
      createSubscription,
      cancelSubscription,
      getSubscriptionById,
    }),
    [
      subscriptions,
      createSubscription,
      cancelSubscription,
      getSubscriptionById,
    ]
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscriptions() {
  const context = useContext(SubscriptionContext);

  if (!context) {
    throw new Error(
      "useSubscriptions must be used inside SubscriptionProvider"
    );
  }

  return context;
}