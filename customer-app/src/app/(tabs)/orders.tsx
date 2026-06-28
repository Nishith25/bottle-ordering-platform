// customer-app/src/app/(tabs)/orders.tsx

import SectionScreen from "../../components/SectionScreen";

export default function OrdersScreen() {
  return (
    <SectionScreen
      eyebrow="YOUR PURCHASES"
      title="Orders and deliveries"
      description="Track active deliveries and view all your completed or cancelled orders."
      icon="receipt-outline"
      buttonText="Sign in to view orders"
    />
  );
}