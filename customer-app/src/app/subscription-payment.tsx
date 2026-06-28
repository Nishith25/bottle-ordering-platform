// customer-app/src/app/subscription-payment.tsx

import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import type { ComponentProps } from "react";
import { useState } from "react";
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
  type SubscriptionPaymentMethod,
  useSubscriptions,
} from "../context/SubscriptionContext";
import { getSubscriptionPlan } from "../data/subscriptionPlans";

type PaymentOptionProps = {
  title: string;
  description: string;
  icon: ComponentProps<
    typeof Ionicons
  >["name"];
  selected: boolean;
  badge?: string;
  onPress: () => void;
};

function PaymentOption({
  title,
  description,
  icon,
  selected,
  badge,
  onPress,
}: PaymentOptionProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.paymentOption,
        selected &&
          styles.paymentOptionSelected,
      ]}
    >
      <View
        style={[
          styles.paymentIcon,
          selected &&
            styles.paymentIconSelected,
        ]}
      >
        <Ionicons
          name={icon}
          size={23}
          color={
            selected
              ? "#FFFFFF"
              : "#315F47"
          }
        />
      </View>

      <View
        style={styles.paymentInformation}
      >
        <View style={styles.paymentTitleRow}>
          <Text style={styles.paymentTitle}>
            {title}
          </Text>

          {badge ? (
            <View style={styles.badge}>
              <Text
                style={styles.badgeText}
              >
                {badge}
              </Text>
            </View>
          ) : null}
        </View>

        <Text
          style={styles.paymentDescription}
        >
          {description}
        </Text>
      </View>

      <View
        style={[
          styles.radioOuter,
          selected &&
            styles.radioOuterSelected,
        ]}
      >
        {selected ? (
          <View style={styles.radioInner} />
        ) : null}
      </View>
    </Pressable>
  );
}

export default function SubscriptionPaymentScreen() {
  const router = useRouter();

  const {
    pendingSubscriptionDraft,
    confirmSubscription,
  } = useSubscriptions();

  const plan = pendingSubscriptionDraft
    ? getSubscriptionPlan(
        pendingSubscriptionDraft.planId
      )
    : undefined;

  const [selectedMethod, setSelectedMethod] =
    useState<SubscriptionPaymentMethod>(
      "upi_autopay"
    );

  const [processing, setProcessing] =
    useState(false);

  const handleConfirm = () => {
    if (
      !pendingSubscriptionDraft ||
      !pendingSubscriptionDraft.deliveryDetails ||
      !plan ||
      processing
    ) {
      return;
    }

    Alert.alert(
      "Demo subscription payment",
      "The recurring payment mandate will be connected through Razorpay after the backend is ready. Continue with a local test confirmation?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Continue",
          onPress: createSubscription,
        },
      ]
    );
  };

  const createSubscription = () => {
    setProcessing(true);

    const subscription =
      confirmSubscription(selectedMethod);

    if (!subscription) {
      setProcessing(false);

      Alert.alert(
        "Unable to activate subscription",
        "Some subscription information is missing. Please restart the plan setup."
      );

      return;
    }

    router.replace({
      pathname: "/subscription-success",
      params: {
        subscriptionId:
          subscription.id,
      },
    });
  };

  if (
    !pendingSubscriptionDraft ||
    !pendingSubscriptionDraft.deliveryDetails ||
    !plan
  ) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons
              name="card-outline"
              size={38}
              color="#35694E"
            />
          </View>

          <Text style={styles.emptyTitle}>
            Payment details unavailable
          </Text>

          <Text
            style={styles.emptyDescription}
          >
            Complete your plan and delivery
            address before selecting payment.
          </Text>

          <Pressable
            onPress={() =>
              router.replace(
                "/(tabs)/plans"
              )
            }
            style={styles.returnButton}
          >
            <Text
              style={
                styles.returnButtonText
              }
            >
              View plans
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const deliveryDetails =
    pendingSubscriptionDraft.deliveryDetails;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons
            name="arrow-back"
            size={22}
            color="#203128"
          />
        </Pressable>

        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>
            Subscription payment
          </Text>

          <Text
            style={styles.headerSubtitle}
          >
            Set up recurring payments
          </Text>
        </View>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={
          styles.scrollContent
        }
      >
        <View
          style={styles.progressContainer}
        >
          <View style={styles.progressItem}>
            <View
              style={styles.progressComplete}
            >
              <Ionicons
                name="checkmark"
                size={15}
                color="#FFFFFF"
              />
            </View>

            <Text
              style={styles.progressLabel}
            >
              Plan
            </Text>
          </View>

          <View
            style={styles.progressLineActive}
          />

          <View style={styles.progressItem}>
            <View
              style={styles.progressComplete}
            >
              <Ionicons
                name="checkmark"
                size={15}
                color="#FFFFFF"
              />
            </View>

            <Text
              style={styles.progressLabel}
            >
              Delivery
            </Text>
          </View>

          <View
            style={styles.progressLineActive}
          />

          <View style={styles.progressItem}>
            <View
              style={styles.progressCurrent}
            >
              <Text
                style={
                  styles.progressCurrentText
                }
              >
                3
              </Text>
            </View>

            <Text
              style={
                styles.progressLabelActive
              }
            >
              Payment
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Select recurring payment
          </Text>

          <Text
            style={styles.sectionDescription}
          >
            A recurring mandate will be used
            for future subscription renewals.
          </Text>

          <PaymentOption
            title="UPI AutoPay"
            description="Approve recurring payments through your UPI application"
            icon="phone-portrait-outline"
            badge="RECOMMENDED"
            selected={
              selectedMethod ===
              "upi_autopay"
            }
            onPress={() =>
              setSelectedMethod(
                "upi_autopay"
              )
            }
          />

          <PaymentOption
            title="Card or eMandate"
            description="Use an eligible card or bank mandate for recurring billing"
            icon="card-outline"
            selected={
              selectedMethod ===
              "card_mandate"
            }
            onPress={() =>
              setSelectedMethod(
                "card_mandate"
              )
            }
          />
        </View>

        <View style={styles.planCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIcon}>
              <Ionicons
                name="repeat-outline"
                size={21}
                color="#35694E"
              />
            </View>

            <View
              style={styles.cardHeaderText}
            >
              <Text style={styles.cardTitle}>
                {plan.name}
              </Text>

              <Text
                style={styles.cardSubtitle}
              >
                {
                  pendingSubscriptionDraft.preferredDay
                }{" "}
                ·{" "}
                {
                  pendingSubscriptionDraft.preferredSlot
                }
              </Text>
            </View>
          </View>

          <View style={styles.planStats}>
            <View>
              <Text style={styles.statLabel}>
                Bottles
              </Text>

              <Text style={styles.statValue}>
                {plan.bottleCount}
              </Text>
            </View>

            <View>
              <Text style={styles.statLabel}>
                Deliveries
              </Text>

              <Text style={styles.statValue}>
                {plan.deliveriesPerCycle}
              </Text>
            </View>

            <View>
              <Text style={styles.statLabel}>
                Saving
              </Text>

              <Text style={styles.statValue}>
                {plan.discountPercent}%
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.addressCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIcon}>
              <Ionicons
                name="location-outline"
                size={21}
                color="#35694E"
              />
            </View>

            <View
              style={styles.cardHeaderText}
            >
              <Text style={styles.cardTitle}>
                Delivery address
              </Text>

              <Text
                style={styles.cardSubtitle}
              >
                {deliveryDetails.area},{" "}
                {deliveryDetails.city}
              </Text>
            </View>
          </View>

          <Text style={styles.addressName}>
            {deliveryDetails.fullName}
          </Text>

          <Text style={styles.addressText}>
            {deliveryDetails.houseDetails},{" "}
            {deliveryDetails.areaDetails}
            {deliveryDetails.landmark
              ? `, ${deliveryDetails.landmark}`
              : ""}
            , {deliveryDetails.city} –{" "}
            {deliveryDetails.pincode}
          </Text>

          <Text style={styles.phoneText}>
            +91 {deliveryDetails.phone}
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <Text
            style={styles.summaryTitle}
          >
            Recurring payment summary
          </Text>

          <View style={styles.summaryRow}>
            <Text
              style={styles.summaryLabel}
            >
              Bottle total
            </Text>

            <Text
              style={styles.summaryValue}
            >
              ₹
              {
                pendingSubscriptionDraft.originalTotal
              }
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text
              style={styles.summaryLabel}
            >
              Plan saving
            </Text>

            <Text
              style={styles.savingValue}
            >
              − ₹
              {
                pendingSubscriptionDraft.savings
              }
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text
              style={styles.summaryLabel}
            >
              Delivery
            </Text>

            <Text
              style={styles.savingValue}
            >
              Free
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>
              {plan.billingCycle ===
              "weekly"
                ? "Charged weekly"
                : "Charged monthly"}
            </Text>

            <Text style={styles.totalValue}>
              ₹
              {
                pendingSubscriptionDraft.total
              }
            </Text>
          </View>
        </View>

        <View style={styles.secureNotice}>
          <Ionicons
            name="shield-checkmark-outline"
            size={21}
            color="#35694E"
          />

          <Text
            style={styles.secureNoticeText}
          >
            No real payment is collected in
            this version. Razorpay recurring
            mandates will be connected after
            the backend setup.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <View style={styles.bottomTotal}>
          <Text style={styles.bottomLabel}>
            {plan.billingCycle === "weekly"
              ? "Per week"
              : "Per month"}
          </Text>

          <Text style={styles.bottomAmount}>
            ₹
            {
              pendingSubscriptionDraft.total
            }
          </Text>
        </View>

        <Pressable
          disabled={processing}
          onPress={handleConfirm}
          style={[
            styles.confirmButton,
            processing &&
              styles.confirmButtonDisabled,
          ]}
        >
          <Text
            style={styles.confirmButtonText}
          >
            {processing
              ? "Activating..."
              : "Activate subscription"}
          </Text>

          <Ionicons
            name="arrow-forward"
            size={18}
            color="#FFFFFF"
          />
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

  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "#E9ECE6",
    alignItems: "center",
    justifyContent: "center",
  },

  headerText: {
    flex: 1,
    alignItems: "center",
  },

  headerTitle: {
    color: "#19251E",
    fontSize: 17,
    fontWeight: "800",
  },

  headerSubtitle: {
    color: "#77807B",
    fontSize: 9,
    marginTop: 3,
  },

  headerSpacer: {
    width: 44,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 150,
  },

  progressContainer: {
    marginVertical: 15,
    flexDirection: "row",
    alignItems: "flex-start",
  },

  progressItem: {
    alignItems: "center",
  },

  progressComplete: {
    width: 31,
    height: 31,
    borderRadius: 16,
    backgroundColor: "#245C42",
    alignItems: "center",
    justifyContent: "center",
  },

  progressCurrent: {
    width: 31,
    height: 31,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#245C42",
    backgroundColor: "#E4EFE7",
    alignItems: "center",
    justifyContent: "center",
  },

  progressCurrentText: {
    color: "#245C42",
    fontSize: 11,
    fontWeight: "900",
  },

  progressLabel: {
    color: "#69766F",
    fontSize: 9,
    marginTop: 5,
  },

  progressLabelActive: {
    color: "#245C42",
    fontSize: 9,
    fontWeight: "800",
    marginTop: 5,
  },

  progressLineActive: {
    flex: 1,
    height: 2,
    marginTop: 15,
    backgroundColor: "#245C42",
  },

  section: {
    padding: 18,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7EAE5",
    marginBottom: 14,
  },

  sectionTitle: {
    color: "#1D2922",
    fontSize: 16,
    fontWeight: "800",
  },

  sectionDescription: {
    color: "#727B76",
    fontSize: 10,
    lineHeight: 16,
    marginTop: 5,
    marginBottom: 16,
  },

  paymentOption: {
    minHeight: 82,
    padding: 13,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "#E1E5DF",
    backgroundColor: "#F5F6F2",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },

  paymentOptionSelected: {
    borderColor: "#245C42",
    backgroundColor: "#EAF2EC",
  },

  paymentIcon: {
    width: 47,
    height: 47,
    borderRadius: 15,
    backgroundColor: "#E1ECE4",
    alignItems: "center",
    justifyContent: "center",
  },

  paymentIconSelected: {
    backgroundColor: "#245C42",
  },

  paymentInformation: {
    flex: 1,
    marginLeft: 12,
  },

  paymentTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  paymentTitle: {
    color: "#1E2C24",
    fontSize: 13,
    fontWeight: "800",
  },

  paymentDescription: {
    color: "#707A74",
    fontSize: 9,
    lineHeight: 14,
    marginTop: 4,
  },

  badge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "#DCECDF",
  },

  badgeText: {
    color: "#35694E",
    fontSize: 6,
    fontWeight: "900",
  },

  radioOuter: {
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#BCC4BF",
    alignItems: "center",
    justifyContent: "center",
  },

  radioOuterSelected: {
    borderColor: "#245C42",
  },

  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: "#245C42",
  },

  planCard: {
    padding: 17,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7EAE5",
    marginBottom: 13,
  },

  addressCard: {
    padding: 17,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7EAE5",
    marginBottom: 13,
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#E4EFE7",
    alignItems: "center",
    justifyContent: "center",
  },

  cardHeaderText: {
    flex: 1,
    marginLeft: 11,
  },

  cardTitle: {
    color: "#25382D",
    fontSize: 12,
    fontWeight: "800",
  },

  cardSubtitle: {
    color: "#707B74",
    fontSize: 9,
    marginTop: 3,
  },

  planStats: {
    marginTop: 15,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#E8EBE6",
    flexDirection: "row",
    justifyContent: "space-between",
  },

  statLabel: {
    color: "#7A837E",
    fontSize: 8,
  },

  statValue: {
    color: "#25382D",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 4,
  },

  addressName: {
    color: "#1D2922",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 15,
  },

  addressText: {
    color: "#68736D",
    fontSize: 10,
    lineHeight: 16,
    marginTop: 5,
  },

  phoneText: {
    color: "#3C5948",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 7,
  },

  summaryCard: {
    padding: 18,
    borderRadius: 23,
    backgroundColor: "#E8F0EA",
  },

  summaryTitle: {
    color: "#294534",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 16,
  },

  summaryRow: {
    marginBottom: 11,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  summaryLabel: {
    color: "#607067",
    fontSize: 11,
  },

  summaryValue: {
    color: "#294534",
    fontSize: 11,
    fontWeight: "700",
  },

  savingValue: {
    color: "#34714F",
    fontSize: 11,
    fontWeight: "800",
  },

  divider: {
    height: 1,
    backgroundColor: "#D3E0D6",
    marginVertical: 5,
  },

  totalLabel: {
    color: "#233C2E",
    fontSize: 13,
    fontWeight: "800",
  },

  totalValue: {
    color: "#233C2E",
    fontSize: 17,
    fontWeight: "900",
  },

  secureNotice: {
    marginTop: 13,
    padding: 15,
    borderRadius: 18,
    backgroundColor: "#EAF1EC",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  secureNoticeText: {
    flex: 1,
    color: "#5E6F65",
    fontSize: 9,
    lineHeight: 14,
  },

  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 13,
    paddingBottom: 24,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E8E3",
    flexDirection: "row",
    alignItems: "center",
  },

  bottomTotal: {
    width: 90,
  },

  bottomLabel: {
    color: "#78817C",
    fontSize: 9,
  },

  bottomAmount: {
    color: "#1D2922",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 2,
  },

  confirmButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: "#245C42",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  confirmButtonDisabled: {
    backgroundColor: "#9BAAA0",
  },

  confirmButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },

  emptyContainer: {
    flex: 1,
    paddingHorizontal: 35,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyIcon: {
    width: 84,
    height: 84,
    borderRadius: 28,
    backgroundColor: "#E5EFE7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },

  emptyTitle: {
    color: "#1C2922",
    fontSize: 21,
    fontWeight: "800",
    textAlign: "center",
  },

  emptyDescription: {
    color: "#747E78",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 9,
  },

  returnButton: {
    minHeight: 51,
    paddingHorizontal: 27,
    borderRadius: 17,
    backgroundColor: "#245C42",
    justifyContent: "center",
    marginTop: 23,
  },

  returnButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
});