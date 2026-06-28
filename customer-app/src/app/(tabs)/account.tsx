// customer-app/src/app/(tabs)/account.tsx

import SectionScreen from "../../components/SectionScreen";

export default function AccountScreen() {
  return (
    <SectionScreen
      eyebrow="YOUR PROFILE"
      title="Account and preferences"
      description="Manage your profile, saved addresses, subscriptions and notification settings."
      icon="person-outline"
      buttonText="Create an account"
    />
  );
}