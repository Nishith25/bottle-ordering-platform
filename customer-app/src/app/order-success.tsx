// customer-app/src/app/order-success.tsx

import Ionicons from "@expo/vector-icons/Ionicons";
import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { useEffect } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useOrders } from "../context/OrderContext";

export default function OrderSuccessScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    orderId?: string | string[];
  }>();

  const orderId = Array.isArray(
    params.orderId
  )
    ? params.orderId[0]
    : params.orderId;

  const {
    lastPlacedOrder,
    loadingOrders,
    getOrderById,
    refreshOrders,
  } = useOrders();

  const order =
    (orderId
      ? getOrderById(orderId)
      : undefined) ??
    lastPlacedOrder;

  useEffect(() => {
    if (
      orderId &&
      !order &&
      !loadingOrders
    ) {
      void refreshOrders();
    }
  }, [
    orderId,
    order,
    loadingOrders,
    refreshOrders,
  ]);

  if (
    loadingOrders &&
    !order
  ) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <ActivityIndicator
            size="large"
            color="#245C42"
          />

          <Text style={styles.loadingText}>
            Loading order details
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <View style={styles.errorIcon}>
            <Ionicons
              name="receipt-outline"
              size={36}
              color="#35694E"
            />
          </View>

          <Text style={styles.errorTitle}>
            Order details unavailable
          </Text>

          <Text
            style={styles.errorDescription}
          >
            Open your order history to view
            your latest orders.
          </Text>

          <Pressable
            onPress={() =>
              router.replace(
                "/(tabs)/orders"
              )
            }
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={
                styles.primaryButtonText
              }
            >
              View orders
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
          Order placed
        </Text>

        <Text style={styles.subtitle}>
          Your fresh bottles have been
          ordered successfully.
        </Text>

        <View style={styles.orderNumberCard}>
          <Text
            style={styles.orderNumberLabel}
          >
            Order number
          </Text>

          <Text
            style={styles.orderNumber}
          >
            {order.orderNumber}
          </Text>
        </View>

        <View style={styles.detailsCard}>
          <DetailRow
            icon="bag-handle-outline"
            label="Bottles"
            value={`${order.items.reduce(
              (sum, item) =>
                sum + item.quantity,
              0
            )}`}
          />

          <DetailRow
            icon="calendar-outline"
            label="Delivery date"
            value={
              order.deliverySchedule
                .deliveryDateLabel
            }
          />

          <DetailRow
            icon="time-outline"
            label="Delivery slot"
            value={
              order.deliverySchedule
                .deliverySlot
            }
          />

          <DetailRow
            icon="location-outline"
            label="Delivery area"
            value={`${order.deliveryAddress.area}, ${order.deliveryAddress.city}`}
          />

          <DetailRow
            icon="card-outline"
            label="Payment"
            value={
              order.paymentMethod === "cod"
                ? "Cash on delivery"
                : "Online payment"
            }
          />

          <DetailRow
            icon="wallet-outline"
            label="Total"
            value={`₹${order.total}`}
            last
          />
        </View>

        <View style={styles.noticeCard}>
          <Ionicons
            name="notifications-outline"
            size={21}
            color="#35694E"
          />

          <Text style={styles.noticeText}>
            You can track this order from the
            Orders tab. Order status updates
            will appear there.
          </Text>
        </View>

        <Pressable
          onPress={() =>
            router.replace(
              "/(tabs)/orders"
            )
          }
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={
              styles.primaryButtonText
            }
          >
            View my orders
          </Text>

          <Ionicons
            name="arrow-forward"
            size={18}
            color="#FFFFFF"
          />
        </Pressable>

        <Pressable
          onPress={() =>
            router.replace(
              "/(tabs)/bottles"
            )
          }
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={
              styles.secondaryButtonText
            }
          >
            Continue shopping
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({
  icon,
  label,
  value,
  last = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
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
      <View style={styles.detailIcon}>
        <Ionicons
          name={icon}
          size={19}
          color="#35694E"
        />
      </View>

      <View style={styles.detailContent}>
        <Text style={styles.detailLabel}>
          {label}
        </Text>

        <Text style={styles.detailValue}>
          {value}
        </Text>
      </View>
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
    paddingTop: 42,
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
    fontSize: 29,
    fontWeight: "900",
    letterSpacing: -1,
    marginTop: 23,
  },

  subtitle: {
    color: "#6E7872",
    fontSize: 12,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 8,
  },

  orderNumberCard: {
    width: "100%",
    padding: 17,
    borderRadius: 20,
    backgroundColor: "#E4EFE7",
    alignItems: "center",
    marginTop: 25,
  },

  orderNumberLabel: {
    color: "#66736B",
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  orderNumber: {
    color: "#244A35",
    fontSize: 16,
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
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#E8EBE7",
  },

  lastDetailRow: {
    borderBottomWidth: 0,
  },

  detailIcon: {
    width: 39,
    height: 39,
    borderRadius: 13,
    backgroundColor: "#E7F0E9",
    alignItems: "center",
    justifyContent: "center",
  },

  detailContent: {
    flex: 1,
    marginLeft: 11,
  },

  detailLabel: {
    color: "#7A847E",
    fontSize: 9,
  },

  detailValue: {
    color: "#28372F",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 4,
  },

  noticeCard: {
    width: "100%",
    padding: 15,
    borderRadius: 18,
    backgroundColor: "#E8F0EA",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 14,
  },

  noticeText: {
    flex: 1,
    color: "#5F6F66",
    fontSize: 9,
    lineHeight: 15,
  },

  primaryButton: {
    width: "100%",
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: "#245C42",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 19,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },

  secondaryButton: {
    width: "100%",
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: "#E8EEE8",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },

  secondaryButtonText: {
    color: "#245C42",
    fontSize: 12,
    fontWeight: "800",
  },

  centerState: {
    flex: 1,
    paddingHorizontal: 32,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    color: "#68746D",
    fontSize: 12,
    marginTop: 14,
  },

  errorIcon: {
    width: 82,
    height: 82,
    borderRadius: 27,
    backgroundColor: "#E5EFE7",
    alignItems: "center",
    justifyContent: "center",
  },

  errorTitle: {
    color: "#1D2922",
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 20,
  },

  errorDescription: {
    color: "#727D76",
    fontSize: 12,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 8,
  },

  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.98 }],
  },
});