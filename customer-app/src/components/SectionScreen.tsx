// customer-app/src/components/SectionScreen.tsx

import Ionicons from "@expo/vector-icons/Ionicons";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type IoniconName = React.ComponentProps<
  typeof Ionicons
>["name"];

type SectionScreenProps = {
  eyebrow: string;
  title: string;
  description: string;
  icon: IoniconName;
  buttonText?: string;
  onPress?: () => void;
};

export default function SectionScreen({
  eyebrow,
  title,
  description,
  icon,
  buttonText,
  onPress,
}: SectionScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.headingSection}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
        </View>

        <View style={styles.contentCard}>
          <View style={styles.iconContainer}>
            <Ionicons
              name={icon}
              size={34}
              color="#2D694C"
            />
          </View>

          <Text style={styles.cardTitle}>Coming together</Text>

          <Text style={styles.cardDescription}>
            This section is ready for the next development step.
            Products and information will later load directly from
            the admin dashboard.
          </Text>

          {buttonText ? (
            <Pressable
              onPress={onPress}
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.buttonText}>
                {buttonText}
              </Text>

              <Ionicons
                name="arrow-forward"
                size={17}
                color="#FFFFFF"
              />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.notice}>
          <Ionicons
            name="leaf-outline"
            size={19}
            color="#397156"
          />

          <Text style={styles.noticeText}>
            Only serviceable delivery locations will be able to
            place an order.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7F7F2",
  },

  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 22,
  },

  headingSection: {
    marginBottom: 32,
  },

  eyebrow: {
    color: "#4D765F",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.6,
    marginBottom: 10,
  },

  title: {
    color: "#17221C",
    fontSize: 34,
    lineHeight: 41,
    fontWeight: "800",
    letterSpacing: -1,
  },

  description: {
    color: "#6E7772",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 11,
    maxWidth: 350,
  },

  contentCard: {
    padding: 25,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7E9E4",
  },

  iconContainer: {
    width: 68,
    height: 68,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E4F0E7",
    marginBottom: 21,
  },

  cardTitle: {
    color: "#1D2922",
    fontSize: 21,
    fontWeight: "800",
  },

  cardDescription: {
    color: "#737C77",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 9,
  },

  button: {
    minHeight: 50,
    borderRadius: 16,
    paddingHorizontal: 18,
    marginTop: 23,
    backgroundColor: "#245C42",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },

  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },

  buttonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },

  notice: {
    marginTop: 16,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#EAF1EC",
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },

  noticeText: {
    flex: 1,
    color: "#53655B",
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "600",
  },
});