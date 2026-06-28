// customer-app/src/app/(tabs)/orders.tsx

import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import BottleVisual from "../../components/BottleVisual";
import {
  CustomerOrder,
  useOrders,
} from "../../context/OrderContext";

function formatOrderDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function OrderCard({
  order,
}: {
  order: CustomerOrder;
}) {
  const firstItem = order.items[0];

  return (
    <View style={styles.orderCard}>
      <View style={styles.orderTopRow}>
        <View>
          <Text style={styles.orderNumber}>
            {order.displayId}
          </Text>

          <Text style={styles.orderDate}>
            Placed on {formatOrderDate(order.createdAt)}
          </Text>
        </View>

        <View style={styles.statusBadge}>
          <View style={styles.statusDot} />

          <Text style={styles.statusText}>
            Confirmed
          </Text>
        </View>
      </View>

      <View style={styles.orderContent}>
        {firstItem ? (
          <View
            style={[
              styles.bottleVisual,
              {
                backgroundColor: firstItem.cardColor,
              },
            ]}
          >
            <BottleVisual
              label={firstItem.shortName}
              liquidColor={firstItem.liquidColor}
              accentColor={firstItem.accentColor}
            />
          </View>
        ) : null}

        <View style={styles.orderInformation}>
          <Text style={styles.bottleCount}>
            {order.itemCount}{" "}
            {order.itemCount === 1
              ? "bottle"
              : "bottles"}
          </Text>

          <Text
            numberOfLines={2}
            style={styles.productNames}
          >
            {order.items
              .map((item) => item.name)
              .join(", ")}
          </Text>

          <View style={styles.scheduleRow}>
            <Ionicons
              name="calendar-outline"
              size={14}
              color="#52705E"
            />

            <Text style={styles.scheduleText}>
              {order.delivery.deliveryDateLabel}
            </Text>
          </View>

          <View style={styles.scheduleRow}>
            <Ionicons
              name="time-outline"
              size={14}
              color="#52705E"
            />

            <Text style={styles.scheduleText}>
              {order.delivery.deliverySlot}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.orderBottomRow}>
        <View>
          <Text style={styles.paymentLabel}>
            {order.paymentMethod === "cod"
              ? "Cash on delivery"
              : "Online payment pending"}
          </Text>

          <Text style={styles.orderTotal}>
            ₹{order.delivery.total}
          </Text>
        </View>

        <Pressable style={styles.detailsButton}>
          <Text style={styles.detailsButtonText}>
            View details
          </Text>

          <Ionicons
            name="chevron-forward"
            size={15}
            color="#35694E"
          />
        </Pressable>
      </View>
    </View>
  );
}

export default function OrdersScreen() {
  const router = useRouter();
  const { orders } = useOrders();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>
          YOUR PURCHASES
        </Text>

        <Text style={styles.title}>
          Orders and deliveries
        </Text>

        <Text style={styles.subtitle}>
          Track current deliveries and view your previous
          purchases.
        </Text>
      </View>

      {orders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons
              name="receipt-outline"
              size={37}
              color="#35694E"
            />
          </View>

          <Text style={styles.emptyTitle}>
            No orders yet
          </Text>

          <Text style={styles.emptyText}>
            Your confirmed bottle orders will appear here.
          </Text>

          <Pressable
            onPress={() =>
              router.push("/(tabs)/bottles")
            }
            style={styles.browseButton}
          >
            <Text style={styles.browseButtonText}>
              Browse bottles
            </Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.ordersContainer}
        >
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7F7F2",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  eyebrow: {
    color: "#4D765F",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.6,
    marginBottom: 8,
  },
  title: {
    color: "#17221C",
    fontSize: 30,
    lineHeight: 37,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  subtitle: {
    color: "#717A75",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 7,
  },
  ordersContainer: {
    paddingHorizontal: 20,
    paddingBottom: 120,
    gap: 13,
  },
  orderCard: {
    padding: 16,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E9E3",
  },
  orderTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  orderNumber: {
    color: "#22342A",
    fontSize: 13,
    fontWeight: "900",
  },
  orderDate: {
    color: "#7A837E",
    fontSize: 9,
    marginTop: 4,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "#E5F1E8",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#34714F",
  },
  statusText: {
    color: "#34714F",
    fontSize: 8,
    fontWeight: "800",
  },
  orderContent: {
    marginTop: 16,
    flexDirection: "row",
  },
  bottleVisual: {
    width: 96,
    height: 130,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  orderInformation: {
    flex: 1,
    marginLeft: 13,
  },
  bottleCount: {
    color: "#1D2B23",
    fontSize: 13,
    fontWeight: "800",
  },
  productNames: {
    color: "#6F7973",
    fontSize: 9,
    lineHeight: 14,
    marginTop: 4,
  },
  scheduleRow: {
    marginTop: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  scheduleText: {
    flex: 1,
    color: "#52705E",
    fontSize: 9,
    fontWeight: "600",
  },
  orderBottomRow: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#EAede8",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  paymentLabel: {
    color: "#78817C",
    fontSize: 8,
  },
  orderTotal: {
    color: "#1D2B23",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 3,
  },
  detailsButton: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 13,
    backgroundColor: "#E8F0EA",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailsButtonText: {
    color: "#35694E",
    fontSize: 9,
    fontWeight: "800",
  },
  emptyContainer: {
    flex: 1,
    paddingHorizontal: 35,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIcon: {
    width: 83,
    height: 83,
    borderRadius: 27,
    backgroundColor: "#E5EFE7",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    color: "#1C2922",
    fontSize: 21,
    fontWeight: "800",
    marginTop: 21,
  },
  emptyText: {
    color: "#747E78",
    fontSize: 12,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 8,
  },
  browseButton: {
    minHeight: 51,
    paddingHorizontal: 27,
    borderRadius: 17,
    backgroundColor: "#245C42",
    justifyContent: "center",
    marginTop: 22,
  },
  browseButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
});