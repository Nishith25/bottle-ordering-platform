// customer-app/src/components/BottleVisual.tsx

import { StyleSheet, Text, View } from "react-native";

type BottleVisualProps = {
  label: string;
  liquidColor: string;
  accentColor: string;
  large?: boolean;
};

export default function BottleVisual({
  label,
  liquidColor,
  accentColor,
  large = false,
}: BottleVisualProps) {
  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.cap,
          large && styles.capLarge,
          { backgroundColor: accentColor },
        ]}
      />

      <View style={[styles.neck, large && styles.neckLarge]} />

      <View style={[styles.body, large && styles.bodyLarge]}>
        <View
          style={[
            styles.liquid,
            large && styles.liquidLarge,
            { backgroundColor: liquidColor },
          ]}
        />

        <View style={styles.seedOne} />
        <View style={styles.seedTwo} />
        <View style={styles.seedThree} />
        <View style={styles.seedFour} />

        <View style={[styles.label, large && styles.labelLarge]}>
          <Text
            numberOfLines={1}
            style={[
              styles.labelText,
              large && styles.labelTextLarge,
              { color: accentColor },
            ]}
          >
            {label}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
  },

  cap: {
    width: 29,
    height: 12,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
  },

  capLarge: {
    width: 38,
    height: 15,
  },

  neck: {
    width: 23,
    height: 11,
    backgroundColor: "rgba(255,255,255,0.88)",
  },

  neckLarge: {
    width: 30,
    height: 14,
  },

  body: {
    width: 67,
    height: 125,
    borderRadius: 19,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.95)",
    backgroundColor: "rgba(255,255,255,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },

  bodyLarge: {
    width: 85,
    height: 158,
    borderRadius: 23,
  },

  liquid: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    height: "73%",
  },

  liquidLarge: {
    height: "75%",
  },

  label: {
    width: 53,
    paddingHorizontal: 5,
    paddingVertical: 6,
    borderRadius: 7,
    backgroundColor: "rgba(255,255,255,0.88)",
    alignItems: "center",
  },

  labelLarge: {
    width: 68,
    paddingVertical: 8,
  },

  labelText: {
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },

  labelTextLarge: {
    fontSize: 9,
  },

  seedOne: {
    position: "absolute",
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#26302A",
    bottom: 15,
    left: 13,
    opacity: 0.65,
  },

  seedTwo: {
    position: "absolute",
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#26302A",
    bottom: 27,
    right: 15,
    opacity: 0.55,
  },

  seedThree: {
    position: "absolute",
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#26302A",
    bottom: 37,
    left: 21,
    opacity: 0.6,
  },

  seedFour: {
    position: "absolute",
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#26302A",
    bottom: 20,
    right: 28,
    opacity: 0.6,
  },
});