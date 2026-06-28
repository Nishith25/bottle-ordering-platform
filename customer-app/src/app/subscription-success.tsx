// customer-app/src/app/subscription-success.tsx

import Ionicons from "@expo/vector-icons/Ionicons";
import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useSubscriptions } from "../context/SubscriptionContext";

export default function SubscriptionSuccessScreen() {
  const router = useRouter();

  const { subscriptionId } =
    useLocalSearchParams<{
      subscriptionId?: string;
    }>();

  const { getSubscriptionById } =
    useSubscriptions();

  const subscription = subscriptionId
    ? getSubscriptionById(subscriptionId)
    : undefined;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.successIcon}>
          <Ionicons
            name="checkmark"
            size={48}
            color="#FFFFFF"
          />
        </View>

        <Text style={styles.eyebrow}>
          SUBSCRIPTION CREATED
        </Text>

        <Text style={styles.title}>
          Fresh deliveries are now part of your routine.
        </Text>

        <Text style={styles.description}>
          Your selected bottle mix and preferred delivery
          schedule have been saved.
        </Text>

        {subscription ? (
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                Subscription
              </Text>

              <Text style={styles.summaryValue}>
                {subscription.displayId}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                Plan
              </Text>

              <Text style={styles.summaryValue}>
                {subscription.planName}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                Bottle delivery
              </Text>

              <Text style={styles.summaryValue}>
                {subscription.bottlesPerDelivery} bottles
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                Schedule
              </Text>

              <Text style={styles.summaryValue}>
                Every {subscription.preferredDay}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                Delivery slot
              </Text>

              <Text style={styles.summaryValue}>
                {subscription.preferredSlot}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>
                {subscription.billingCycle === "weekly"
                  ? "Weekly total"
                  : "Monthly total"}
              </Text>

              <Text style={styles.totalValue}>
                ₹{subscription.total}
              </Text>
            </View>
          </View>
        ) : null}

        <Pressable
          onPress={() =>
            router.replace("/(tabs)/plans")
          }
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>
            View subscription
          </Text>

          <Ionicons
            name="arrow-forward"
            size={18}
            color="#FFFFFF"
          />
        </Pressable>

        <Pressable
          onPress={() =>
            router.replace("/(tabs)/bottles")
          }
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>
            Browse bottles
          </Text>
        </Pressable>
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
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },

  successIcon: {
    width: 94,
    height: 94,
    borderRadius: 47,
    backgroundColor: "#245C42",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 25,
  },

  eyebrow: {
    color: "#4D765F",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.7,
  },

  title: {
    color: "#17221C",
    fontSize: 27,
    lineHeight: 34,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 11,
  },

  description: {
    color: "#6F7973",
    fontSize: 12,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 10,
    maxWidth: 340,
  },

  summaryCard: {
    width: "100%",
    padding: 19,
    borderRadius: 23,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E9E3",
    marginTop: 24,
  },

  summaryRow: {
    marginVertical: 7,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 15,
  },

  summaryLabel: {
    color: "#727C76",
    fontSize: 10,
  },

  summaryValue: {
    flex: 1,
    color: "#26372D",
    fontSize: 10,
    fontWeight: "800",
    textAlign: "right",
  },

  divider: {
    height: 1,
    backgroundColor: "#E8EBE6",
    marginVertical: 8,
  },

  totalLabel: {
    color: "#1D2B23",
    fontSize: 13,
    fontWeight: "800",
  },

  totalValue: {
    color: "#1D2B23",
    fontSize: 17,
    fontWeight: "900",
  },

  primaryButton: {
    width: "100%",
    minHeight: 55,
    borderRadius: 18,
    backgroundColor: "#245C42",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 22,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },

  secondaryButton: {
    minHeight: 48,
    paddingHorizontal: 25,
    justifyContent: "center",
    marginTop: 7,
  },

  secondaryButtonText: {
    color: "#396B51",
    fontSize: 12,
    fontWeight: "800",
  },
});