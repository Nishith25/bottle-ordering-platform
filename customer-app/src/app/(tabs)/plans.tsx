// customer-app/src/app/(tabs)/plans.tsx

import SectionScreen from "../../components/SectionScreen";

export default function PlansScreen() {
  return (
    <SectionScreen
      eyebrow="FLEXIBLE SUBSCRIPTIONS"
      title="Freshness on repeat"
      description="Build a weekly or monthly plan using your preferred bottles and delivery schedule."
      icon="calendar-outline"
      buttonText="View subscription plans"
    />
  );
}