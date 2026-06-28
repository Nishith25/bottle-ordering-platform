// customer-app/src/app/(tabs)/plans.tsx

import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../context/AuthContext";
import { useSubscriptions } from "../../context/SubscriptionContext";
import type {
  CustomerSubscription,
  SubscriptionPlan,
} from "../../services/api";

export default function PlansScreen() {
  const router = useRouter();

  const {
    isAuthenticated,
  } = useAuth();

  const {
    plans,
    subscriptions,
    loadingPlans,
    loadingSubscriptions,
    cancellingSubscriptionId,
    error,
    refreshPlans,
    refreshSubscriptions,
    cancelSubscription,
  } = useSubscriptions();

  const requestCancellation = (
    subscription: CustomerSubscription
  ) => {
    const performCancellation =
      async () => {
        await cancelSubscription(
          subscription._id,
          "Cancelled by customer"
        );
      };

    if (
      Platform.OS === "web" &&
      typeof window !== "undefined"
    ) {
      const confirmed =
        window.confirm(
          `Cancel ${subscription.subscriptionNumber}?`
        );

      if (confirmed) {
        void performCancellation();
      }

      return;
    }

    Alert.alert(
      "Cancel subscription",
      "Future recurring deliveries will stop. Continue?",
      [
        {
          text: "Keep subscription",
          style: "cancel",
        },
        {
          text: "Cancel plan",
          style: "destructive",
          onPress: () => {
            void performCancellation();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={
          styles.scrollContent
        }
      >
        <Text style={styles.eyebrow}>
          RECURRING DELIVERY
        </Text>

        <Text style={styles.title}>
          Freshness on repeat
        </Text>

        <Text style={styles.subtitle}>
          Build a weekly or monthly bottle
          plan and save on every recurring
          cycle.
        </Text>

        {error ? (
          <View style={styles.errorCard}>
            <Ionicons
              name="alert-circle-outline"
              size={18}
              color="#A34848"
            />

            <Text style={styles.errorText}>
              {error}
            </Text>
          </View>
        ) : null}

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>
            Choose a plan
          </Text>

          <Pressable
            onPress={() => {
              void refreshPlans();
            }}
          >
            <Ionicons
              name="refresh"
              size={19}
              color="#35694E"
            />
          </Pressable>
        </View>

        {loadingPlans &&
        plans.length === 0 ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator
              color="#245C42"
            />

            <Text style={styles.loadingText}>
              Loading plans
            </Text>
          </View>
        ) : (
          plans.map((plan) => (
            <PlanCard
              key={plan._id}
              plan={plan}
              onChoose={() =>
                router.push({
                  pathname:
                    "/plan-builder",
                  params: {
                    planId:
                      plan.planId,
                  },
                })
              }
            />
          ))
        )}

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>
            Your subscriptions
          </Text>

          {isAuthenticated ? (
            <Pressable
              onPress={() => {
                void refreshSubscriptions();
              }}
            >
              <Ionicons
                name="refresh"
                size={19}
                color="#35694E"
              />
            </Pressable>
          ) : null}
        </View>

        {!isAuthenticated ? (
          <View style={styles.guestCard}>
            <Ionicons
              name="person-outline"
              size={30}
              color="#35694E"
            />

            <Text style={styles.guestTitle}>
              Log in to view your plans
            </Text>

            <Text
              style={styles.guestDescription}
            >
              Active and cancelled
              subscriptions will appear here.
            </Text>

            <Pressable
              onPress={() =>
                router.push("/login")
              }
              style={styles.loginButton}
            >
              <Text
                style={styles.loginButtonText}
              >
                Log in
              </Text>
            </Pressable>
          </View>
        ) : loadingSubscriptions &&
          subscriptions.length === 0 ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator
              color="#245C42"
            />

            <Text style={styles.loadingText}>
              Loading subscriptions
            </Text>
          </View>
        ) : subscriptions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons
              name="repeat-outline"
              size={31}
              color="#35694E"
            />

            <Text style={styles.emptyTitle}>
              No subscriptions yet
            </Text>

            <Text
              style={styles.emptyDescription}
            >
              Choose a plan above to start
              recurring deliveries.
            </Text>
          </View>
        ) : (
          subscriptions.map(
            (subscription) => (
              <SubscriptionCard
                key={subscription._id}
                subscription={
                  subscription
                }
                cancelling={
                  cancellingSubscriptionId ===
                  subscription._id
                }
                onCancel={() =>
                  requestCancellation(
                    subscription
                  )
                }
              />
            )
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PlanCard({
  plan,
  onChoose,
}: {
  plan: SubscriptionPlan;
  onChoose: () => void;
}) {
  return (
    <View style={styles.planCard}>
      <View style={styles.planTopRow}>
        <View style={styles.planIcon}>
          <Ionicons
            name={
              plan.billingCycle ===
              "weekly"
                ? "calendar-outline"
                : "calendar-number-outline"
            }
            size={23}
            color="#35694E"
          />
        </View>

        {plan.badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {plan.badge}
            </Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.planName}>
        {plan.name}
      </Text>

      <Text style={styles.planDescription}>
        {plan.description}
      </Text>

      <View style={styles.statRow}>
        <PlanStat
          value={`${plan.bottleCount}`}
          label="Bottles"
        />

        <PlanStat
          value={`${plan.deliveriesPerCycle}`}
          label="Deliveries"
        />

        <PlanStat
          value={`${plan.discountPercent}%`}
          label="Saving"
        />
      </View>

      <View style={styles.features}>
        {plan.features.map((feature) => (
          <View
            key={feature}
            style={styles.featureRow}
          >
            <Ionicons
              name="checkmark-circle"
              size={17}
              color="#397454"
            />

            <Text
              style={styles.featureText}
            >
              {feature}
            </Text>
          </View>
        ))}
      </View>

      <Pressable
        onPress={onChoose}
        style={({ pressed }) => [
          styles.chooseButton,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.chooseButtonText}>
          Build this plan
        </Text>

        <Ionicons
          name="arrow-forward"
          size={18}
          color="#FFFFFF"
        />
      </Pressable>
    </View>
  );
}

function PlanStat({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>
        {value}
      </Text>

      <Text style={styles.statLabel}>
        {label}
      </Text>
    </View>
  );
}

function SubscriptionCard({
  subscription,
  cancelling,
  onCancel,
}: {
  subscription: CustomerSubscription;
  cancelling: boolean;
  onCancel: () => void;
}) {
  const active =
    subscription.status === "active";

  return (
    <View style={styles.subscriptionCard}>
      <View
        style={styles.subscriptionTopRow}
      >
        <View>
          <Text
            style={
              styles.subscriptionNumber
            }
          >
            {subscription.subscriptionNumber}
          </Text>

          <Text
            style={styles.subscriptionName}
          >
            {subscription.planName}
          </Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            !active &&
              styles.inactiveStatusBadge,
          ]}
        >
          <Text
            style={[
              styles.statusText,
              !active &&
                styles.inactiveStatusText,
            ]}
          >
            {subscription.status}
          </Text>
        </View>
      </View>

      <View style={styles.subscriptionInfo}>
        <Text
          style={styles.subscriptionDetail}
        >
          {subscription.bottleCount} bottles ·{" "}
          {subscription.preferredDay}
        </Text>

        <Text
          style={styles.subscriptionDetail}
        >
          {subscription.preferredSlot}
        </Text>

        <Text
          style={styles.subscriptionDetail}
        >
          Next billing:{" "}
          {new Date(
            subscription.nextBillingAt
          ).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </Text>
      </View>

      <View style={styles.subscriptionTotal}>
        <Text style={styles.totalLabel}>
          Per{" "}
          {subscription.billingCycle ===
          "weekly"
            ? "week"
            : "month"}
        </Text>

        <Text style={styles.totalValue}>
          ₹{subscription.totalPerCycle}
        </Text>
      </View>

      {active ? (
        <Pressable
          disabled={cancelling}
          onPress={onCancel}
          style={[
            styles.cancelButton,
            cancelling &&
              styles.disabledButton,
          ]}
        >
          <Text
            style={styles.cancelButtonText}
          >
            {cancelling
              ? "Cancelling..."
              : "Cancel subscription"}
          </Text>
        </Pressable>
      ) : null}
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
    maxWidth: 680,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 130,
  },

  eyebrow: {
    color: "#4D765F",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.6,
  },

  title: {
    color: "#17221C",
    fontSize: 31,
    fontWeight: "900",
    letterSpacing: -1,
    marginTop: 8,
  },

  subtitle: {
    color: "#717A75",
    fontSize: 12,
    lineHeight: 19,
    marginTop: 7,
  },

  errorCard: {
    padding: 13,
    borderRadius: 16,
    backgroundColor: "#FAECEC",
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 16,
  },

  errorText: {
    flex: 1,
    color: "#934545",
    fontSize: 10,
    lineHeight: 15,
  },

  sectionHeading: {
    marginTop: 25,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  sectionTitle: {
    color: "#1D2922",
    fontSize: 16,
    fontWeight: "900",
  },

  planCard: {
    padding: 19,
    borderRadius: 25,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E8E2",
    marginBottom: 13,
  },

  planTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  planIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#E5EFE7",
    alignItems: "center",
    justifyContent: "center",
  },

  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 11,
    backgroundColor: "#E8F0EA",
  },

  badgeText: {
    color: "#35694E",
    fontSize: 8,
    fontWeight: "900",
  },

  planName: {
    color: "#203128",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 16,
  },

  planDescription: {
    color: "#707B74",
    fontSize: 10,
    lineHeight: 16,
    marginTop: 6,
  },

  statRow: {
    paddingVertical: 15,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#E8EBE7",
    flexDirection: "row",
    marginTop: 15,
  },

  statItem: {
    flex: 1,
    alignItems: "center",
  },

  statValue: {
    color: "#244A35",
    fontSize: 17,
    fontWeight: "900",
  },

  statLabel: {
    color: "#7A847E",
    fontSize: 8,
    marginTop: 4,
  },

  features: {
    gap: 9,
    marginTop: 15,
  },

  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  featureText: {
    color: "#536159",
    fontSize: 10,
  },

  chooseButton: {
    minHeight: 51,
    borderRadius: 17,
    backgroundColor: "#245C42",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 18,
  },

  chooseButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },

  loadingCard: {
    minHeight: 120,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    color: "#657269",
    fontSize: 10,
    marginTop: 10,
  },

  guestCard: {
    padding: 22,
    borderRadius: 24,
    backgroundColor: "#E8F0EA",
    alignItems: "center",
  },

  guestTitle: {
    color: "#223229",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 12,
  },

  guestDescription: {
    color: "#68746D",
    fontSize: 10,
    textAlign: "center",
    marginTop: 6,
  },

  loginButton: {
    minHeight: 45,
    paddingHorizontal: 28,
    borderRadius: 15,
    backgroundColor: "#245C42",
    justifyContent: "center",
    marginTop: 16,
  },

  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },

  emptyCard: {
    padding: 25,
    borderRadius: 24,
    backgroundColor: "#E8F0EA",
    alignItems: "center",
  },

  emptyTitle: {
    color: "#223229",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 11,
  },

  emptyDescription: {
    color: "#68746D",
    fontSize: 10,
    textAlign: "center",
    marginTop: 6,
  },

  subscriptionCard: {
    padding: 17,
    borderRadius: 23,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E8E3",
    marginBottom: 12,
  },

  subscriptionTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  subscriptionNumber: {
    color: "#728078",
    fontSize: 8,
  },

  subscriptionName: {
    color: "#203128",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 4,
  },

  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#E5F1E7",
  },

  inactiveStatusBadge: {
    backgroundColor: "#FAECEC",
  },

  statusText: {
    color: "#2E714A",
    fontSize: 8,
    fontWeight: "900",
    textTransform: "capitalize",
  },

  inactiveStatusText: {
    color: "#A34848",
  },

  subscriptionInfo: {
    gap: 5,
    marginTop: 14,
  },

  subscriptionDetail: {
    color: "#68746D",
    fontSize: 9,
  },

  subscriptionTotal: {
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: "#E8EBE7",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
  },

  totalLabel: {
    color: "#657269",
    fontSize: 10,
  },

  totalValue: {
    color: "#203128",
    fontSize: 16,
    fontWeight: "900",
  },

  cancelButton: {
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: "#FAECEC",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },

  cancelButtonText: {
    color: "#994646",
    fontSize: 10,
    fontWeight: "800",
  },

  disabledButton: {
    opacity: 0.55,
  },

  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.98 }],
  },
});