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
  cancelCustomerSubscription,
  createCustomerSubscription,
  fetchMySubscriptions,
  fetchSubscriptionPlans,
  validateCoupon,
  type CustomerSubscription,
  type CouponQuote,
  type SubscriptionPaymentMethod,
  type SubscriptionPlan,
} from "../services/api";

import { useAuth } from "./AuthContext";

export type SubscriptionDraftItem = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
};

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

export type PendingSubscriptionDraft = {
  planId: string;
  items: SubscriptionDraftItem[];
  preferredDay: string;
  preferredSlot: string;
  originalTotal: number;
  savings: number;
  amountBeforeCoupon?: number;
  couponCode?: string;
  couponDiscount?: number;
  couponQuote?: CouponQuote | null;
  total: number;
  deliveryDetails?: SubscriptionDeliveryDetails;
};

type SubscriptionContextValue = {
  plans: SubscriptionPlan[];
  subscriptions: CustomerSubscription[];
  pendingSubscriptionDraft: PendingSubscriptionDraft | null;
  lastActivatedSubscription: CustomerSubscription | null;
  loadingPlans: boolean;
  loadingSubscriptions: boolean;
  activatingSubscription: boolean;
  applyingCoupon: boolean;
  cancellingSubscriptionId: string | null;
  error: string | null;
  couponError: string | null;
  setPendingSubscriptionDraft: (
    draft: PendingSubscriptionDraft | null
  ) => void;
  saveSubscriptionDeliveryDetails: (
    details: SubscriptionDeliveryDetails
  ) => boolean;
  applySubscriptionCoupon: (code: string) => Promise<boolean>;
  removeSubscriptionCoupon: () => void;
  confirmSubscription: (
    paymentMethod: SubscriptionPaymentMethod
  ) => Promise<CustomerSubscription | null>;
  refreshPlans: () => Promise<void>;
  refreshSubscriptions: () => Promise<void>;
  cancelSubscription: (
    subscriptionId: string,
    reason?: string
  ) => Promise<boolean>;
  getPlanById: (
    planId: string
  ) => SubscriptionPlan | undefined;
  getSubscriptionById: (
    subscriptionId: string
  ) => CustomerSubscription | undefined;
  clearError: () => void;
};

const SubscriptionContext = createContext<
  SubscriptionContextValue | undefined
>(undefined);

function getBaseSubscriptionAmount(
  draft: PendingSubscriptionDraft
) {
  return (
    draft.amountBeforeCoupon ??
    draft.total + (draft.couponDiscount ?? 0)
  );
}

export function SubscriptionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { token, isAuthenticated } = useAuth();

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscriptions, setSubscriptions] = useState<
    CustomerSubscription[]
  >([]);
  const [pendingSubscriptionDraft, setPendingSubscriptionDraft] =
    useState<PendingSubscriptionDraft | null>(null);
  const [lastActivatedSubscription, setLastActivatedSubscription] =
    useState<CustomerSubscription | null>(null);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [loadingSubscriptions, setLoadingSubscriptions] =
    useState(false);
  const [activatingSubscription, setActivatingSubscription] =
    useState(false);
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [cancellingSubscriptionId, setCancellingSubscriptionId] =
    useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
    setCouponError(null);
  }, []);

  const refreshPlans = useCallback(async () => {
    setLoadingPlans(true);
    setError(null);

    try {
      setPlans(await fetchSubscriptionPlans());
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load subscription plans."
      );
    } finally {
      setLoadingPlans(false);
    }
  }, []);

  const refreshSubscriptions = useCallback(async () => {
    if (!token) {
      setSubscriptions([]);
      return;
    }

    setLoadingSubscriptions(true);
    setError(null);

    try {
      setSubscriptions(await fetchMySubscriptions(token));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load your subscriptions."
      );
    } finally {
      setLoadingSubscriptions(false);
    }
  }, [token]);

  useEffect(() => {
    void refreshPlans();
  }, [refreshPlans]);

  useEffect(() => {
    if (isAuthenticated && token) {
      void refreshSubscriptions();
      return;
    }

    setSubscriptions([]);
    setLastActivatedSubscription(null);
  }, [isAuthenticated, token, refreshSubscriptions]);

  const saveSubscriptionDeliveryDetails = useCallback(
    (details: SubscriptionDeliveryDetails): boolean => {
      if (!pendingSubscriptionDraft) {
        setError("Your subscription plan details are missing.");
        return false;
      }

      setPendingSubscriptionDraft({
        ...pendingSubscriptionDraft,
        deliveryDetails: details,
      });

      setError(null);
      return true;
    },
    [pendingSubscriptionDraft]
  );

  const applySubscriptionCoupon = useCallback(
    async (code: string): Promise<boolean> => {
      if (!pendingSubscriptionDraft) {
        setCouponError("Your subscription plan details are missing.");
        return false;
      }

      const normalizedCode = code.trim().toUpperCase();

      if (!normalizedCode) {
        setCouponError("Enter a coupon code.");
        return false;
      }

      const amountBeforeCoupon = getBaseSubscriptionAmount(
        pendingSubscriptionDraft
      );

      setApplyingCoupon(true);
      setCouponError(null);

      try {
        const quote = await validateCoupon({
          code: normalizedCode,
          context: "subscription",
          eligibleAmount: amountBeforeCoupon,
        });

        setPendingSubscriptionDraft({
          ...pendingSubscriptionDraft,
          amountBeforeCoupon,
          couponCode: quote.code,
          couponDiscount: quote.discountAmount,
          couponQuote: quote,
          total: Math.max(
            0,
            amountBeforeCoupon - quote.discountAmount
          ),
        });

        return true;
      } catch (requestError) {
        setCouponError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to apply this coupon."
        );
        return false;
      } finally {
        setApplyingCoupon(false);
      }
    },
    [pendingSubscriptionDraft]
  );

  const removeSubscriptionCoupon = useCallback(() => {
    setPendingSubscriptionDraft((currentDraft) => {
      if (!currentDraft) return currentDraft;

      const amountBeforeCoupon = getBaseSubscriptionAmount(
        currentDraft
      );

      return {
        ...currentDraft,
        amountBeforeCoupon,
        couponCode: "",
        couponDiscount: 0,
        couponQuote: null,
        total: amountBeforeCoupon,
      };
    });

    setCouponError(null);
  }, []);

  const confirmSubscription = useCallback(
    async (
      paymentMethod: SubscriptionPaymentMethod
    ): Promise<CustomerSubscription | null> => {
      if (!token) {
        setError(
          "Please log in before activating a subscription."
        );
        return null;
      }

      if (
        !pendingSubscriptionDraft ||
        !pendingSubscriptionDraft.deliveryDetails
      ) {
        setError("Your subscription delivery details are missing.");
        return null;
      }

      setActivatingSubscription(true);
      setError(null);

      try {
        const subscription = await createCustomerSubscription(
          token,
          {
            planId: pendingSubscriptionDraft.planId,
            items: pendingSubscriptionDraft.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
            })),
            preferredDay: pendingSubscriptionDraft.preferredDay,
            preferredSlot: pendingSubscriptionDraft.preferredSlot,
            deliveryAddress: {
              fullName:
                pendingSubscriptionDraft.deliveryDetails.fullName,
              phone: pendingSubscriptionDraft.deliveryDetails.phone,
              pincode: pendingSubscriptionDraft.deliveryDetails.pincode,
              houseDetails:
                pendingSubscriptionDraft.deliveryDetails.houseDetails,
              areaDetails:
                pendingSubscriptionDraft.deliveryDetails.areaDetails,
              landmark:
                pendingSubscriptionDraft.deliveryDetails.landmark,
            },
            couponCode:
              pendingSubscriptionDraft.couponCode || undefined,
            paymentMethod,
          }
        );

        setSubscriptions((currentSubscriptions) => [
          subscription,
          ...currentSubscriptions.filter(
            (currentSubscription) =>
              currentSubscription._id !== subscription._id
          ),
        ]);

        setLastActivatedSubscription(subscription);
        setPendingSubscriptionDraft(null);
        setCouponError(null);

        return subscription;
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to activate this subscription."
        );
        return null;
      } finally {
        setActivatingSubscription(false);
      }
    },
    [token, pendingSubscriptionDraft]
  );

  const cancelSubscription = useCallback(
    async (
      subscriptionId: string,
      reason = "Cancelled by customer"
    ): Promise<boolean> => {
      if (!token) {
        setError("Please log in to cancel a subscription.");
        return false;
      }

      setCancellingSubscriptionId(subscriptionId);
      setError(null);

      try {
        const updatedSubscription =
          await cancelCustomerSubscription(
            token,
            subscriptionId,
            reason
          );

        setSubscriptions((currentSubscriptions) =>
          currentSubscriptions.map((subscription) =>
            subscription._id === updatedSubscription._id
              ? updatedSubscription
              : subscription
          )
        );

        setLastActivatedSubscription((currentSubscription) =>
          currentSubscription?._id === updatedSubscription._id
            ? updatedSubscription
            : currentSubscription
        );

        return true;
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to cancel this subscription."
        );
        return false;
      } finally {
        setCancellingSubscriptionId(null);
      }
    },
    [token]
  );

  const getPlanById = useCallback(
    (planId: string) =>
      plans.find((plan) => plan.planId === planId),
    [plans]
  );

  const getSubscriptionById = useCallback(
    (subscriptionId: string) =>
      subscriptions.find(
        (subscription) => subscription._id === subscriptionId
      ) ??
      (lastActivatedSubscription?._id === subscriptionId
        ? lastActivatedSubscription
        : undefined),
    [subscriptions, lastActivatedSubscription]
  );

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      plans,
      subscriptions,
      pendingSubscriptionDraft,
      lastActivatedSubscription,
      loadingPlans,
      loadingSubscriptions,
      activatingSubscription,
      applyingCoupon,
      cancellingSubscriptionId,
      error,
      couponError,
      setPendingSubscriptionDraft,
      saveSubscriptionDeliveryDetails,
      applySubscriptionCoupon,
      removeSubscriptionCoupon,
      confirmSubscription,
      refreshPlans,
      refreshSubscriptions,
      cancelSubscription,
      getPlanById,
      getSubscriptionById,
      clearError,
    }),
    [
      plans,
      subscriptions,
      pendingSubscriptionDraft,
      lastActivatedSubscription,
      loadingPlans,
      loadingSubscriptions,
      activatingSubscription,
      applyingCoupon,
      cancellingSubscriptionId,
      error,
      couponError,
      saveSubscriptionDeliveryDetails,
      applySubscriptionCoupon,
      removeSubscriptionCoupon,
      confirmSubscription,
      refreshPlans,
      refreshSubscriptions,
      cancelSubscription,
      getPlanById,
      getSubscriptionById,
      clearError,
    ]
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscriptions(): SubscriptionContextValue {
  const context = useContext(SubscriptionContext);

  if (!context) {
    throw new Error(
      "useSubscriptions must be used inside SubscriptionProvider"
    );
  }

  return context;
}
