// customer-app/src/data/subscriptionPlans.ts

export type BillingCycle = "weekly" | "monthly";

export type SubscriptionPlan = {
  id: string;
  name: string;
  shortDescription: string;
  description: string;
  billingCycle: BillingCycle;
  bottleCount: number;
  deliveriesPerCycle: number;
  discountPercent: number;
  badge: string;
  accentColor: string;
  lightColor: string;
  features: string[];
};

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "weekly-fresh",
    name: "Weekly Fresh Plan",
    shortDescription: "Four fresh bottles every week",
    description:
      "Select any mix of four bottles and receive one fresh delivery every week.",
    billingCycle: "weekly",
    bottleCount: 4,
    deliveriesPerCycle: 1,
    discountPercent: 5,
    badge: "FLEXIBLE",
    accentColor: "#245C42",
    lightColor: "#E6F1E9",
    features: [
      "Choose any four bottles",
      "One delivery every week",
      "Change your bottle mix later",
      "Cancel or pause anytime",
    ],
  },
  {
    id: "monthly-fresh",
    name: "Monthly Fresh Plan",
    shortDescription: "Sixteen bottles across four deliveries",
    description:
      "Build a monthly bottle mix and receive four convenient weekly deliveries.",
    billingCycle: "monthly",
    bottleCount: 16,
    deliveriesPerCycle: 4,
    discountPercent: 10,
    badge: "BEST VALUE",
    accentColor: "#8B650C",
    lightColor: "#FFF3D2",
    features: [
      "Choose any sixteen bottles",
      "Four weekly deliveries",
      "Better monthly savings",
      "Manage your preferred schedule",
    ],
  },
];

export function getSubscriptionPlan(
  planId: string
): SubscriptionPlan | undefined {
  return SUBSCRIPTION_PLANS.find(
    (plan) => plan.id === planId
  );
}