// customer-app/src/app/order-success.tsx

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

import { useOrders } from "../context/OrderContext";

export default function OrderSuccessScreen() {
  const router = useRouter();

  const { orderId } =
    useLocalSearchParams<{ orderId?: string }>();

  const { getOrderById } = useOrders();

  const order = orderId
    ? getOrderById(orderId)
    : undefined;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.successCircle}>
          <Ionicons
            name="checkmark"
            size={48}
            color="#FFFFFF"
          />
        </View>

        <Text style={styles.eyebrow}>ORDER CONFIRMED</Text>

        <Text style={styles.title}>
          Your fresh bottles are on their way.
        </Text>

        <Text style={styles.description}>
          Your order has been received and will be prepared
          for the selected delivery schedule.
        </Text>

        {order ? (
          <View style={styles.orderCard}>
            <View style={styles.orderRow}>
              <Text style={styles.orderLabel}>
                Order number
              </Text>

              <Text style={styles.orderValue}>
                {order.displayId}
              </Text>
            </View>

            <View style={styles.orderRow}>
              <Text style={styles.orderLabel}>
                Delivery date
              </Text>

              <Text style={styles.orderValue}>
                {order.delivery.deliveryDateLabel}
              </Text>
            </View>

            <View style={styles.orderRow}>
              <Text style={styles.orderLabel}>
                Delivery slot
              </Text>

              <Text style={styles.orderValue}>
                {order.delivery.deliverySlot}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.orderRow}>
              <Text style={styles.totalLabel}>Total</Text>

              <Text style={styles.totalValue}>
                ₹{order.delivery.total}
              </Text>
            </View>
          </View>
        ) : null}

        <Pressable
          onPress={() =>
            router.replace("/(tabs)/orders")
          }
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>
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
            router.replace("/(tabs)/bottles")
          }
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>
            Continue shopping
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
  successCircle: {
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
  orderCard: {
    width: "100%",
    padding: 19,
    borderRadius: 23,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E9E3",
    marginTop: 25,
  },
  orderRow: {
    marginVertical: 7,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 15,
  },
  orderLabel: {
    color: "#727C76",
    fontSize: 10,
  },
  orderValue: {
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