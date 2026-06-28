// customer-app/src/app/(tabs)/bottles.tsx

import SectionScreen from "../../components/SectionScreen";

export default function BottlesScreen() {
  return (
    <SectionScreen
      eyebrow="FRESH SELECTION"
      title="Choose your bottle"
      description="Browse all available 300 ml bottles, ingredients, nutrition and prices."
      icon="nutrition-outline"
      buttonText="Explore bottles"
    />
  );
}