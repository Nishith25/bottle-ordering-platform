// customer-app/src/app/(tabs)/plans.tsx

import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  CustomerSubscription,
  useSubscriptions,
} from "../../context/SubscriptionContext";
import {
  SUBSCRIPTION_PLANS,
  SubscriptionPlan,
} from "../../data/subscriptionPlans";

function PlanCard({
  plan,
  onPress,
}: {
  plan: SubscriptionPlan;
  onPress: () => void;
}) {
  const bottlesPerDelivery =
    plan.bottleCount / plan.deliveriesPerCycle;

  return (
    <View
      style={[
        styles.planCard,
        {
          backgroundColor: plan.lightColor,
        },
      ]}
    >
      <View style={styles.planTopRow}>
        <View
          style={[
            styles.planIcon,
            {
              backgroundColor: plan.accentColor,
            },
          ]}
        >
          <Ionicons
            name={
              plan.billingCycle === "weekly"
                ? "calendar-outline"
                : "repeat-outline"
            }
            size={24}
            color="#FFFFFF"
          />
        </View>

        <View style={styles.planHeading}>
          <View style={styles.planBadge}>
            <Text
              style={[
                styles.planBadgeText,
                {
                  color: plan.accentColor,
                },
              ]}
            >
              {plan.badge}
            </Text>
          </View>

          <Text style={styles.planName}>
            {plan.name}
          </Text>

          <Text style={styles.planShortDescription}>
            {plan.shortDescription}
          </Text>
        </View>
      </View>

      <View style={styles.planStats}>
        <View style={styles.planStat}>
          <Text style={styles.planStatValue}>
            {plan.bottleCount}
          </Text>
          <Text style={styles.planStatLabel}>
            Bottles
          </Text>
        </View>

        <View style={styles.planStatDivider} />

        <View style={styles.planStat}>
          <Text style={styles.planStatValue}>
            {plan.deliveriesPerCycle}
          </Text>
          <Text style={styles.planStatLabel}>
            Deliveries
          </Text>
        </View>

        <View style={styles.planStatDivider} />

        <View style={styles.planStat}>
          <Text style={styles.planStatValue}>
            {bottlesPerDelivery}
          </Text>
          <Text style={styles.planStatLabel}>
            Per delivery
          </Text>
        </View>
      </View>

      <View style={styles.featureContainer}>
        {plan.features.slice(0, 3).map((feature) => (
          <View key={feature} style={styles.featureRow}>
            <Ionicons
              name="checkmark-circle"
              size={16}
              color={plan.accentColor}
            />

            <Text style={styles.featureText}>
              {feature}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.planBottomRow}>
        <View>
          <Text style={styles.savingLabel}>
            PLAN SAVING
          </Text>

          <Text
            style={[
              styles.savingValue,
              {
                color: plan.accentColor,
              },
            ]}
          >
            {plan.discountPercent}% off
          </Text>
        </View>

        <Pressable
          onPress={onPress}
          style={({ pressed }) => [
            styles.buildButton,
            {
              backgroundColor: plan.accentColor,
            },
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.buildButtonText}>
            Build plan
          </Text>

          <Ionicons
            name="arrow-forward"
            size={17}
            color="#FFFFFF"
          />
        </Pressable>
      </View>
    </View>
  );
}

function ActiveSubscriptionCard({
  subscription,
  onCancel,
}: {
  subscription: CustomerSubscription;
  onCancel: () => void;
}) {
  const isCancelled =
    subscription.status === "cancelled";

  return (
    <View style={styles.activeCard}>
      <View style={styles.activeTopRow}>
        <View style={styles.activeIcon}>
          <Ionicons
            name="refresh-outline"
            size={22}
            color="#2F6549"
          />
        </View>

        <View style={styles.activeHeading}>
          <Text style={styles.activeName}>
            {subscription.planName}
          </Text>

          <Text style={styles.subscriptionNumber}>
            {subscription.displayId}
          </Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            isCancelled && styles.cancelledBadge,
          ]}
        >
          <View
            style={[
              styles.statusDot,
              isCancelled &&
                styles.cancelledStatusDot,
            ]}
          />

          <Text
            style={[
              styles.statusText,
              isCancelled &&
                styles.cancelledStatusText,
            ]}
          >
            {isCancelled ? "Cancelled" : "Active"}
          </Text>
        </View>
      </View>

      <View style={styles.activeDetails}>
        <View style={styles.activeDetailRow}>
          <Ionicons
            name="nutrition-outline"
            size={16}
            color="#52705E"
          />

          <Text style={styles.activeDetailText}>
            {subscription.bottlesPerDelivery} bottles per
            delivery
          </Text>
        </View>

        <View style={styles.activeDetailRow}>
          <Ionicons
            name="calendar-outline"
            size={16}
            color="#52705E"
          />

          <Text style={styles.activeDetailText}>
            Every {subscription.preferredDay}
          </Text>
        </View>

        <View style={styles.activeDetailRow}>
          <Ionicons
            name="time-outline"
            size={16}
            color="#52705E"
          />

          <Text style={styles.activeDetailText}>
            {subscription.preferredSlot}
          </Text>
        </View>
      </View>

      <View style={styles.activeBottomRow}>
        <View>
          <Text style={styles.subscriptionPriceLabel}>
            {subscription.billingCycle === "weekly"
              ? "Weekly total"
              : "Monthly total"}
          </Text>

          <Text style={styles.subscriptionPrice}>
            ₹{subscription.total}
          </Text>
        </View>

        {!isCancelled ? (
          <Pressable
            onPress={onCancel}
            style={({ pressed }) => [
              styles.cancelButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.cancelButtonText}>
              Cancel plan
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export default function PlansScreen() {
  const router = useRouter();

  const {
    subscriptions,
    cancelSubscription,
  } = useSubscriptions();

  const openPlanBuilder = (
    plan: SubscriptionPlan
  ) => {
    router.push({
      pathname: "/plan-builder",
      params: {
        planId: plan.id,
      },
    });
  };

  const handleCancel = (
    subscription: CustomerSubscription
  ) => {
    Alert.alert(
      "Cancel subscription?",
      `This will cancel ${subscription.planName}.`,
      [
        {
          text: "Keep plan",
          style: "cancel",
        },
        {
          text: "Cancel plan",
          style: "destructive",
          onPress: () =>
            cancelSubscription(subscription.id),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>
            FLEXIBLE SUBSCRIPTIONS
          </Text>

          <Text style={styles.title}>
            Freshness on repeat
          </Text>

          <Text style={styles.subtitle}>
            Choose your bottles once and receive fresh
            deliveries every week.
          </Text>
        </View>

        {subscriptions.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Your subscriptions
            </Text>

            <Text style={styles.sectionSubtitle}>
              Manage your current bottle plans.
            </Text>

            <View style={styles.subscriptionList}>
              {subscriptions.map((subscription) => (
                <ActiveSubscriptionCard
                  key={subscription.id}
                  subscription={subscription}
                  onCancel={() =>
                    handleCancel(subscription)
                  }
                />
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Choose a plan
          </Text>

          <Text style={styles.sectionSubtitle}>
            Select weekly or monthly delivery.
          </Text>

          <View style={styles.planList}>
            {SUBSCRIPTION_PLANS.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                onPress={() =>
                  openPlanBuilder(plan)
                }
              />
            ))}
          </View>
        </View>

        <View style={styles.notice}>
          <View style={styles.noticeIcon}>
            <Ionicons
              name="information-circle-outline"
              size={21}
              color="#35694E"
            />
          </View>

          <View style={styles.noticeContent}>
            <Text style={styles.noticeTitle}>
              Flexible plan management
            </Text>

            <Text style={styles.noticeText}>
              Bottle combinations, delivery schedules and
              plan prices will later be controlled by the
              admin dashboard.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7F7F2",
  },

  scrollContent: {
    paddingBottom: 125,
  },

  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
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
    fontSize: 31,
    lineHeight: 38,
    fontWeight: "900",
    letterSpacing: -1,
  },

  subtitle: {
    color: "#717A75",
    fontSize: 12,
    lineHeight: 19,
    marginTop: 8,
  },

  section: {
    paddingHorizontal: 20,
    marginBottom: 27,
  },

  sectionTitle: {
    color: "#1C2922",
    fontSize: 20,
    fontWeight: "900",
  },

  sectionSubtitle: {
    color: "#76807A",
    fontSize: 11,
    marginTop: 5,
    marginBottom: 14,
  },

  planList: {
    gap: 14,
  },

  planCard: {
    padding: 18,
    borderRadius: 27,
    overflow: "hidden",
  },

  planTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  planIcon: {
    width: 53,
    height: 53,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  planHeading: {
    flex: 1,
    marginLeft: 13,
  },

  planBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9,
    backgroundColor: "rgba(255,255,255,0.72)",
  },

  planBadgeText: {
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 0.8,
  },

  planName: {
    color: "#1D2922",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 8,
  },

  planShortDescription: {
    color: "#68736D",
    fontSize: 10,
    lineHeight: 15,
    marginTop: 4,
  },

  planStats: {
    marginTop: 19,
    padding: 13,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.65)",
    flexDirection: "row",
    alignItems: "center",
  },

  planStat: {
    flex: 1,
    alignItems: "center",
  },

  planStatValue: {
    color: "#22342A",
    fontSize: 17,
    fontWeight: "900",
  },

  planStatLabel: {
    color: "#718078",
    fontSize: 8,
    marginTop: 3,
  },

  planStatDivider: {
    width: 1,
    height: 29,
    backgroundColor: "rgba(74,94,82,0.18)",
  },

  featureContainer: {
    marginTop: 16,
    gap: 8,
  },

  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  featureText: {
    flex: 1,
    color: "#53625A",
    fontSize: 10,
    fontWeight: "600",
  },

  planBottomRow: {
    marginTop: 19,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(72,91,80,0.15)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  savingLabel: {
    color: "#7B847F",
    fontSize: 7,
    fontWeight: "800",
    letterSpacing: 0.8,
  },

  savingValue: {
    fontSize: 15,
    fontWeight: "900",
    marginTop: 3,
  },

  buildButton: {
    minHeight: 46,
    paddingHorizontal: 16,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  buildButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },

  subscriptionList: {
    gap: 12,
  },

  activeCard: {
    padding: 17,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E9E3",
  },

  activeTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  activeIcon: {
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: "#E5EFE7",
    alignItems: "center",
    justifyContent: "center",
  },

  activeHeading: {
    flex: 1,
    marginLeft: 11,
  },

  activeName: {
    color: "#1E2C24",
    fontSize: 13,
    fontWeight: "900",
  },

  subscriptionNumber: {
    color: "#7A837E",
    fontSize: 8,
    marginTop: 3,
  },

  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "#E4F1E7",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  cancelledBadge: {
    backgroundColor: "#F5E8E8",
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#34714F",
  },

  cancelledStatusDot: {
    backgroundColor: "#A84C4C",
  },

  statusText: {
    color: "#34714F",
    fontSize: 8,
    fontWeight: "800",
  },

  cancelledStatusText: {
    color: "#A84C4C",
  },

  activeDetails: {
    marginTop: 16,
    gap: 9,
  },

  activeDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  activeDetailText: {
    color: "#5D6D63",
    fontSize: 10,
    fontWeight: "600",
  },

  activeBottomRow: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#EAede8",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  subscriptionPriceLabel: {
    color: "#7B847F",
    fontSize: 8,
  },

  subscriptionPrice: {
    color: "#1D2B23",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 3,
  },

  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 13,
    backgroundColor: "#FAECEC",
  },

  cancelButtonText: {
    color: "#A84C4C",
    fontSize: 9,
    fontWeight: "800",
  },

  notice: {
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 21,
    backgroundColor: "#E8F0EA",
    flexDirection: "row",
  },

  noticeIcon: {
    width: 39,
    height: 39,
    borderRadius: 14,
    backgroundColor: "#D6E6DB",
    alignItems: "center",
    justifyContent: "center",
  },

  noticeContent: {
    flex: 1,
    marginLeft: 11,
  },

  noticeTitle: {
    color: "#294534",
    fontSize: 11,
    fontWeight: "800",
  },

  noticeText: {
    color: "#637168",
    fontSize: 9,
    lineHeight: 15,
    marginTop: 4,
  },

  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.98 }],
  },
});