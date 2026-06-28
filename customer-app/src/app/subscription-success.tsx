// customer-app/src/app/subscription-success.tsx

import Ionicons from "@expo/vector-icons/Ionicons";
import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useSubscriptions } from "../context/SubscriptionContext";

export default function SubscriptionSuccessScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    subscriptionId?:
      | string
      | string[];
  }>();

  const subscriptionId = Array.isArray(
    params.subscriptionId
  )
    ? params.subscriptionId[0]
    : params.subscriptionId;

  const {
    lastActivatedSubscription,
    getSubscriptionById,
  } = useSubscriptions();

  const subscription =
    (subscriptionId
      ? getSubscriptionById(
          subscriptionId
        )
      : undefined) ??
    lastActivatedSubscription;

  if (!subscription) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <Text style={styles.errorTitle}>
            Subscription details unavailable
          </Text>

          <Pressable
            onPress={() =>
              router.replace(
                "/(tabs)/plans"
              )
            }
            style={styles.primaryButton}
          >
            <Text
              style={styles.primaryButtonText}
            >
              View subscriptions
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={
          styles.scrollContent
        }
      >
        <View style={styles.successIcon}>
          <Ionicons
            name="checkmark"
            size={43}
            color="#FFFFFF"
          />
        </View>

        <Text style={styles.title}>
          Subscription active
        </Text>

        <Text style={styles.subtitle}>
          Your recurring bottle plan has been
          saved successfully.
        </Text>

        <View style={styles.numberCard}>
          <Text style={styles.numberLabel}>
            Subscription number
          </Text>

          <Text style={styles.numberValue}>
            {
              subscription.subscriptionNumber
            }
          </Text>
        </View>

        <View style={styles.detailsCard}>
          <DetailRow
            label="Plan"
            value={subscription.planName}
          />

          <DetailRow
            label="Bottles"
            value={`${subscription.bottleCount}`}
          />

          <DetailRow
            label="Schedule"
            value={`${subscription.preferredDay}, ${subscription.preferredSlot}`}
          />

          <DetailRow
            label="Delivery area"
            value={`${subscription.deliveryAddress.area}, ${subscription.deliveryAddress.city}`}
          />

          <DetailRow
            label="Payment method"
            value={
              subscription.paymentMethod ===
              "upi_autopay"
                ? "UPI AutoPay"
                : "Card mandate"
            }
          />

          <DetailRow
            label="Total per cycle"
            value={`₹${subscription.totalPerCycle}`}
            last
          />
        </View>

        <Pressable
          onPress={() =>
            router.replace(
              "/(tabs)/plans"
            )
          }
          style={styles.primaryButton}
        >
          <Text
            style={styles.primaryButtonText}
          >
            View my subscriptions
          </Text>
        </Pressable>

        <Pressable
          onPress={() =>
            router.replace(
              "/(tabs)/bottles"
            )
          }
          style={styles.secondaryButton}
        >
          <Text
            style={
              styles.secondaryButtonText
            }
          >
            Browse bottles
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.detailRow,
        last && styles.lastDetailRow,
      ]}
    >
      <Text style={styles.detailLabel}>
        {label}
      </Text>

      <Text style={styles.detailValue}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7F7F2",
  },

  scrollContent: {
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
    paddingHorizontal: 22,
    paddingTop: 45,
    paddingBottom: 45,
    alignItems: "center",
  },

  successIcon: {
    width: 91,
    height: 91,
    borderRadius: 31,
    backgroundColor: "#245C42",
    alignItems: "center",
    justifyContent: "center",
  },

  title: {
    color: "#18251E",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 22,
  },

  subtitle: {
    color: "#6E7872",
    fontSize: 11,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 8,
  },

  numberCard: {
    width: "100%",
    padding: 17,
    borderRadius: 20,
    backgroundColor: "#E4EFE7",
    alignItems: "center",
    marginTop: 24,
  },

  numberLabel: {
    color: "#66736B",
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  numberValue: {
    color: "#244A35",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 6,
  },

  detailsCard: {
    width: "100%",
    paddingHorizontal: 17,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E8E3",
    marginTop: 14,
  },

  detailRow: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#E8EBE7",
  },

  lastDetailRow: {
    borderBottomWidth: 0,
  },

  detailLabel: {
    color: "#7A847E",
    fontSize: 8,
  },

  detailValue: {
    color: "#28372F",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 4,
  },

  primaryButton: {
    width: "100%",
    minHeight: 53,
    borderRadius: 18,
    backgroundColor: "#245C42",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 19,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },

  secondaryButton: {
    width: "100%",
    minHeight: 51,
    borderRadius: 18,
    backgroundColor: "#E8EEE8",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },

  secondaryButtonText: {
    color: "#245C42",
    fontSize: 11,
    fontWeight: "800",
  },

  centerState: {
    flex: 1,
    paddingHorizontal: 32,
    alignItems: "center",
    justifyContent: "center",
  },

  errorTitle: {
    color: "#203128",
    fontSize: 19,
    fontWeight: "900",
    textAlign: "center",
  },
});