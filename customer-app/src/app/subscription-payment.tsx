import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../context/AuthContext";
import { useSubscriptions } from "../context/SubscriptionContext";
import type { SubscriptionPaymentMethod } from "../services/api";

export default function SubscriptionPaymentScreen() {
  const router = useRouter();

  const {
    loading: authLoading,
    isAuthenticated,
  } = useAuth();

  const {
    pendingSubscriptionDraft,
    activatingSubscription,
    error,
    getPlanById,
    confirmSubscription,
    clearError,
  } = useSubscriptions();

  const [paymentMethod, setPaymentMethod] =
    useState<SubscriptionPaymentMethod>("upi_autopay");

  const plan = pendingSubscriptionDraft
    ? getPlanById(pendingSubscriptionDraft.planId)
    : undefined;

  useEffect(() => {
    clearError();
  }, [clearError]);

  const handleActivate = async () => {
    const subscription = await confirmSubscription(paymentMethod);

    if (!subscription) return;

    router.replace({
      pathname: "/subscription-success",
      params: {
        subscriptionId: subscription._id,
      },
    });
  };

  if (authLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <ActivityIndicator color="#245C42" />
        </View>
      </SafeAreaView>
    );
  }

  if (
    !pendingSubscriptionDraft ||
    !pendingSubscriptionDraft.deliveryDetails ||
    !plan
  ) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <Text style={styles.errorTitle}>
            Subscription details unavailable
          </Text>

          <Pressable
            onPress={() => router.replace("/(tabs)/plans")}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>View plans</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <Ionicons
            name="person-outline"
            size={40}
            color="#35694E"
          />

          <Text style={styles.errorTitle}>
            Log in to activate your plan
          </Text>

          <Text style={styles.errorDescription}>
            Your selected bottles, coupon and delivery details will
            remain available.
          </Text>

          <Pressable
            onPress={() => router.push("/login")}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Log in</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/register")}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>
              Create account
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const delivery = pendingSubscriptionDraft.deliveryDetails;
  const couponDiscount =
    pendingSubscriptionDraft.couponDiscount ?? 0;
  const amountBeforeCoupon =
    pendingSubscriptionDraft.amountBeforeCoupon ??
    pendingSubscriptionDraft.total + couponDiscount;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/subscription-checkout");
            }
          }}
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
          <Text style={styles.headerSubtitle}>
            Set up recurring payments
          </Text>
        </View>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.planCard}>
          <Text style={styles.planName}>{plan.name}</Text>
          <Text style={styles.planDetails}>
            {pendingSubscriptionDraft.preferredDay} ·{" "}
            {pendingSubscriptionDraft.preferredSlot}
          </Text>

          <View style={styles.statsRow}>
            <Stat label="Bottles" value={`${plan.bottleCount}`} />
            <Stat
              label="Deliveries"
              value={`${plan.deliveriesPerCycle}`}
            />
            <Stat
              label="Plan saving"
              value={`${plan.discountPercent}%`}
            />
          </View>
        </View>

        <View style={styles.addressCard}>
          <Ionicons
            name="location-outline"
            size={22}
            color="#35694E"
          />

          <View style={styles.addressContent}>
            <Text style={styles.cardTitle}>Delivery address</Text>
            <Text style={styles.cardDescription}>
              {delivery.fullName}
            </Text>
            <Text style={styles.cardDescription}>
              {delivery.houseDetails}, {delivery.areaDetails}
            </Text>
            <Text style={styles.cardDescription}>
              {delivery.area}, {delivery.city} – {delivery.pincode}
            </Text>
          </View>
        </View>

        {pendingSubscriptionDraft.couponCode ? (
          <View style={styles.couponCard}>
            <View style={styles.couponIcon}>
              <Ionicons
                name="pricetag-outline"
                size={20}
                color="#FFFFFF"
              />
            </View>

            <View style={styles.addressContent}>
              <Text style={styles.cardTitle}>
                {pendingSubscriptionDraft.couponCode} applied
              </Text>
              <Text style={styles.cardDescription}>
                Saves ₹{couponDiscount} on the first billing cycle.
                Future cycles are ₹{amountBeforeCoupon}.
              </Text>
            </View>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>
          Recurring payment method
        </Text>

        <PaymentOption
          title="UPI AutoPay"
          description="Demo recurring UPI mandate"
          icon="phone-portrait-outline"
          selected={paymentMethod === "upi_autopay"}
          onPress={() => setPaymentMethod("upi_autopay")}
        />

        <PaymentOption
          title="Card mandate"
          description="Demo recurring card mandate"
          icon="card-outline"
          selected={paymentMethod === "card_mandate"}
          onPress={() => setPaymentMethod("card_mandate")}
        />

        <View style={styles.demoNotice}>
          <Ionicons
            name="shield-checkmark-outline"
            size={20}
            color="#35694E"
          />

          <Text style={styles.demoNoticeText}>
            No real recurring payment is collected yet. Coupon and
            subscription prices are still validated by the backend.
          </Text>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Ionicons
              name="alert-circle-outline"
              size={19}
              color="#A34848"
            />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.summaryCard}>
          <SummaryRow
            label="Bottle total"
            value={`₹${pendingSubscriptionDraft.originalTotal}`}
          />
          <SummaryRow
            label="Plan saving"
            value={`− ₹${pendingSubscriptionDraft.savings}`}
            saving
          />
          {couponDiscount > 0 ? (
            <SummaryRow
              label={`Coupon (${pendingSubscriptionDraft.couponCode})`}
              value={`− ₹${couponDiscount}`}
              saving
            />
          ) : null}
          <SummaryRow label="Delivery" value="Free" saving />
          <View style={styles.divider} />
          <SummaryRow
            label="First cycle"
            value={`₹${pendingSubscriptionDraft.total}`}
            total
          />

          {couponDiscount > 0 ? (
            <Text style={styles.futureCycleText}>
              Recurring from the next cycle: ₹{amountBeforeCoupon} per{" "}
              {plan.billingCycle === "weekly" ? "week" : "month"}.
            </Text>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <View>
          <Text style={styles.bottomLabel}>First cycle</Text>
          <Text style={styles.bottomAmount}>
            ₹{pendingSubscriptionDraft.total}
          </Text>
        </View>

        <Pressable
          disabled={activatingSubscription}
          onPress={() => void handleActivate()}
          style={[
            styles.activateButton,
            activatingSubscription && styles.activateDisabled,
          ]}
        >
          {activatingSubscription ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.activateText}>
                Activate subscription
              </Text>
              <Ionicons
                name="arrow-forward"
                size={18}
                color="#FFFFFF"
              />
            </>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function PaymentOption({
  title,
  description,
  icon,
  selected,
  onPress,
}: {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.paymentOption,
        selected && styles.paymentOptionSelected,
      ]}
    >
      <View
        style={[
          styles.paymentIcon,
          selected && styles.paymentIconSelected,
        ]}
      >
        <Ionicons
          name={icon}
          size={22}
          color={selected ? "#FFFFFF" : "#35694E"}
        />
      </View>

      <View style={styles.paymentContent}>
        <Text style={styles.paymentTitle}>{title}</Text>
        <Text style={styles.paymentDescription}>{description}</Text>
      </View>

      <Ionicons
        name={
          selected ? "radio-button-on" : "radio-button-off"
        }
        size={21}
        color={selected ? "#245C42" : "#A4AEA8"}
      />
    </Pressable>
  );
}

function SummaryRow({
  label,
  value,
  saving = false,
  total = false,
}: {
  label: string;
  value: string;
  saving?: boolean;
  total?: boolean;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text
        style={[
          styles.summaryLabel,
          total && styles.totalLabel,
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.summaryValue,
          saving && styles.savingValue,
          total && styles.totalValue,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F7F7F2" },
  header: { paddingHorizontal: 20, paddingVertical: 12, flexDirection: "row", alignItems: "center" },
  backButton: { width: 44, height: 44, borderRadius: 16, backgroundColor: "#E9ECE6", alignItems: "center", justifyContent: "center" },
  headerText: { flex: 1, alignItems: "center" },
  headerTitle: { color: "#19251E", fontSize: 17, fontWeight: "800" },
  headerSubtitle: { color: "#77807B", fontSize: 9, marginTop: 3 },
  headerSpacer: { width: 44 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 145 },
  planCard: { padding: 18, borderRadius: 23, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E8E3", marginTop: 10 },
  planName: { color: "#203128", fontSize: 15, fontWeight: "900" },
  planDetails: { color: "#68746D", fontSize: 9, marginTop: 5 },
  statsRow: { paddingTop: 15, borderTopWidth: 1, borderTopColor: "#E8EBE7", flexDirection: "row", marginTop: 15 },
  stat: { flex: 1 },
  statLabel: { color: "#7A847E", fontSize: 8 },
  statValue: { color: "#294534", fontSize: 14, fontWeight: "900", marginTop: 4 },
  addressCard: { padding: 16, borderRadius: 21, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E8E3", flexDirection: "row", marginTop: 12 },
  couponCard: { padding: 16, borderRadius: 21, backgroundColor: "#E7F2E9", borderWidth: 1, borderColor: "#D3E6D7", flexDirection: "row", marginTop: 12 },
  couponIcon: { width: 43, height: 43, borderRadius: 14, backgroundColor: "#34714F", alignItems: "center", justifyContent: "center" },
  addressContent: { flex: 1, marginLeft: 11 },
  cardTitle: { color: "#26382E", fontSize: 11, fontWeight: "800", marginBottom: 5 },
  cardDescription: { color: "#6E7972", fontSize: 9, lineHeight: 14 },
  sectionTitle: { color: "#1D2922", fontSize: 15, fontWeight: "900", marginTop: 21, marginBottom: 11 },
  paymentOption: { padding: 15, borderRadius: 19, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E3E7E1", flexDirection: "row", alignItems: "center", marginBottom: 10 },
  paymentOptionSelected: { borderColor: "#245C42", backgroundColor: "#EDF5EF" },
  paymentIcon: { width: 45, height: 45, borderRadius: 15, backgroundColor: "#E6EFE8", alignItems: "center", justifyContent: "center" },
  paymentIconSelected: { backgroundColor: "#245C42" },
  paymentContent: { flex: 1, marginLeft: 12 },
  paymentTitle: { color: "#26352D", fontSize: 11, fontWeight: "800" },
  paymentDescription: { color: "#758079", fontSize: 9, marginTop: 4 },
  demoNotice: { padding: 14, borderRadius: 17, backgroundColor: "#E8F0EA", flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  demoNoticeText: { flex: 1, color: "#5F6F66", fontSize: 9, lineHeight: 15 },
  errorCard: { padding: 13, borderRadius: 16, backgroundColor: "#FAECEC", flexDirection: "row", alignItems: "center", gap: 9, marginTop: 12 },
  errorText: { flex: 1, color: "#934545", fontSize: 10 },
  summaryCard: { padding: 18, borderRadius: 23, backgroundColor: "#E8F0EA", marginTop: 13 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 11 },
  summaryLabel: { color: "#607067", fontSize: 10 },
  summaryValue: { color: "#294534", fontSize: 11, fontWeight: "700" },
  savingValue: { color: "#34714F" },
  divider: { height: 1, backgroundColor: "#D3E0D6", marginBottom: 11 },
  totalLabel: { color: "#233C2E", fontWeight: "900" },
  totalValue: { color: "#233C2E", fontSize: 17, fontWeight: "900" },
  futureCycleText: { color: "#5F6F66", fontSize: 9, lineHeight: 14, marginTop: 2 },
  bottomBar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 13, paddingBottom: 24, backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: "#E5E8E3", flexDirection: "row", alignItems: "center" },
  bottomLabel: { color: "#78817C", fontSize: 9 },
  bottomAmount: { color: "#1D2922", fontSize: 18, fontWeight: "900", marginTop: 2 },
  activateButton: { flex: 1, minHeight: 53, borderRadius: 18, backgroundColor: "#245C42", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginLeft: 25 },
  activateDisabled: { backgroundColor: "#91A69A" },
  activateText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  centerState: { flex: 1, paddingHorizontal: 32, alignItems: "center", justifyContent: "center" },
  errorTitle: { color: "#203128", fontSize: 19, fontWeight: "900", textAlign: "center", marginTop: 15 },
  errorDescription: { color: "#727D76", fontSize: 11, lineHeight: 18, textAlign: "center", marginTop: 8 },
  primaryButton: { minHeight: 50, paddingHorizontal: 29, borderRadius: 16, backgroundColor: "#245C42", justifyContent: "center", marginTop: 20 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
  secondaryButton: { minHeight: 50, paddingHorizontal: 29, borderRadius: 16, backgroundColor: "#E8EEE8", justifyContent: "center", marginTop: 10 },
  secondaryButtonText: { color: "#245C42", fontSize: 11, fontWeight: "800" },
});
