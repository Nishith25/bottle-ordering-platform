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
import {
  getSubscriptionPlan,
  type BillingCycle,
} from "../data/subscriptionPlans";

export type SubscriptionPaymentMethod =
  | "upi_autopay"
  | "card_mandate";

export type SubscriptionDeliveryDetails = {
  fullName: string;
  phone: string;
  pincode: string;
  houseDetails: string;
  areaDetails: string;
  landmark: string;
  area: string;
  city: string;
};

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

export type PendingSubscriptionDraft = {
  planId: string;
  quantities: Record<string, number>;
  preferredDay: string;
  preferredSlot: string;
  originalTotal: number;
  total: number;
  savings: number;
  deliveryDetails?: SubscriptionDeliveryDetails;
};

export type CustomerSubscription = {
  id: string;
  displayId: string;
  planId: string;
  planName: string;
  billingCycle: BillingCycle;
  status: "active" | "paused" | "cancelled";
  paymentMethod: SubscriptionPaymentMethod;
  paymentStatus: "demo_confirmed";
  createdAt: string;
  bottleCount: number;
  deliveriesPerCycle: number;
  bottlesPerDelivery: number;
  discountPercent: number;
  originalTotal: number;
  total: number;
  savings: number;
  preferredDay: string;
  preferredSlot: string;
  deliveryDetails: SubscriptionDeliveryDetails;
  items: SubscriptionItem[];
};

type SubscriptionContextValue = {
  subscriptions: CustomerSubscription[];
  pendingSubscriptionDraft: PendingSubscriptionDraft | null;

  setPendingSubscriptionDraft: (
    draft: PendingSubscriptionDraft | null
  ) => void;

  saveSubscriptionDeliveryDetails: (
    deliveryDetails: SubscriptionDeliveryDetails
  ) => boolean;

  confirmSubscription: (
    paymentMethod: SubscriptionPaymentMethod
  ) => CustomerSubscription | null;

  cancelSubscription: (
    subscriptionId: string
  ) => void;

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

  const [
    pendingSubscriptionDraft,
    setPendingSubscriptionDraft,
  ] = useState<PendingSubscriptionDraft | null>(null);

  const saveSubscriptionDeliveryDetails =
    useCallback(
      (
        deliveryDetails: SubscriptionDeliveryDetails
      ) => {
        if (!pendingSubscriptionDraft) {
          return false;
        }

        setPendingSubscriptionDraft((currentDraft) => {
          if (!currentDraft) {
            return null;
          }

          return {
            ...currentDraft,
            deliveryDetails,
          };
        });

        return true;
      },
      [pendingSubscriptionDraft]
    );

  const confirmSubscription = useCallback(
    (
      paymentMethod: SubscriptionPaymentMethod
    ): CustomerSubscription | null => {
      if (
        !pendingSubscriptionDraft ||
        !pendingSubscriptionDraft.deliveryDetails
      ) {
        return null;
      }

      const plan = getSubscriptionPlan(
        pendingSubscriptionDraft.planId
      );

      if (!plan) {
        return null;
      }

      const selectedItems = PRODUCTS.filter(
        (product) =>
          product.subscriptionEligible &&
          product.available &&
          (pendingSubscriptionDraft.quantities[
            product.id
          ] ?? 0) > 0
      ).map((product) => ({
        productId: product.id,
        name: product.name,
        shortName: product.shortName,
        quantity:
          pendingSubscriptionDraft.quantities[
            product.id
          ] ?? 0,
        price: product.price,
        sizeMl: product.sizeMl,
        cardColor: product.cardColor,
        liquidColor: product.liquidColor,
        accentColor: product.accentColor,
      }));

      const selectedBottleCount =
        selectedItems.reduce(
          (total, item) =>
            total + item.quantity,
          0
        );

      if (
        selectedBottleCount !== plan.bottleCount ||
        selectedItems.length === 0
      ) {
        return null;
      }

      const timestamp = Date.now();

      const subscription: CustomerSubscription = {
        id: `subscription-${timestamp}`,
        displayId: `SUB${String(timestamp).slice(
          -8
        )}`,

        planId: plan.id,
        planName: plan.name,
        billingCycle: plan.billingCycle,

        status: "active",
        paymentMethod,
        paymentStatus: "demo_confirmed",

        createdAt: new Date().toISOString(),

        bottleCount: plan.bottleCount,
        deliveriesPerCycle:
          plan.deliveriesPerCycle,

        bottlesPerDelivery:
          plan.bottleCount /
          plan.deliveriesPerCycle,

        discountPercent:
          plan.discountPercent,

        originalTotal:
          pendingSubscriptionDraft.originalTotal,

        total: pendingSubscriptionDraft.total,
        savings:
          pendingSubscriptionDraft.savings,

        preferredDay:
          pendingSubscriptionDraft.preferredDay,

        preferredSlot:
          pendingSubscriptionDraft.preferredSlot,

        deliveryDetails:
          pendingSubscriptionDraft.deliveryDetails,

        items: selectedItems,
      };

      setSubscriptions((currentSubscriptions) => [
        subscription,
        ...currentSubscriptions,
      ]);

      setPendingSubscriptionDraft(null);

      return subscription;
    },
    [pendingSubscriptionDraft]
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
      pendingSubscriptionDraft,
      setPendingSubscriptionDraft,
      saveSubscriptionDeliveryDetails,
      confirmSubscription,
      cancelSubscription,
      getSubscriptionById,
    }),
    [
      subscriptions,
      pendingSubscriptionDraft,
      saveSubscriptionDeliveryDetails,
      confirmSubscription,
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
  const context = useContext(
    SubscriptionContext
  );

  if (!context) {
    throw new Error(
      "useSubscriptions must be used inside SubscriptionProvider"
    );
  }

  return context;
}