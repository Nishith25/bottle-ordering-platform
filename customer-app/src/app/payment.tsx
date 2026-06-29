import Ionicons from "@expo/vector-icons/Ionicons";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
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

import { useAuth } from "../context/AuthContext";
import { useOrders } from "../context/OrderContext";
import type { OrderPaymentMethod } from "../services/api";

function readQueryValue(
  value: string | string[] | undefined
) {
  return Array.isArray(value) ? value[0] : value;
}

export default function PaymentScreen() {
  const router = useRouter();

  const {
    loading: authLoading,
    isAuthenticated,
  } = useAuth();

  const {
    pendingCheckout,
    checkoutReady,
    placingOrder,
    error,
    placeOrder,
    startOnlinePayment,
    completeOnlinePayment,
    dismissOnlinePaymentSession,
    clearError,
  } = useOrders();

  const [selectedMethod, setSelectedMethod] =
    useState<OrderPaymentMethod>("cod");

  const [browserMessage, setBrowserMessage] =
    useState<string | null>(null);

  useEffect(() => {
    clearError();
    setBrowserMessage(null);
  }, [clearError]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/checkout");
  };

  const handlePlaceOrder = async () => {
    if (!pendingCheckout || placingOrder || !checkoutReady) {
      return;
    }

    clearError();
    setBrowserMessage(null);

    if (selectedMethod === "cod") {
      const order = await placeOrder("cod");

      if (!order) return;

      router.replace({
        pathname: "/order-success",
        params: { orderId: order._id },
      });
      return;
    }

    const returnUrl = Linking.createURL("payment-result");
    const paymentSession = await startOnlinePayment(returnUrl);

    if (!paymentSession) return;

    if (Platform.OS === "web") {
      globalThis.location.assign(paymentSession.checkoutUrl);
      return;
    }

    try {
      const browserResult = await WebBrowser.openAuthSessionAsync(
        paymentSession.checkoutUrl,
        returnUrl
      );

      if (browserResult.type !== "success") {
        dismissOnlinePaymentSession();
        setBrowserMessage(
          "Payment window was closed. Your cart, coupon and delivery details have been retained."
        );
        return;
      }

      const parsedUrl = Linking.parse(browserResult.url);

      const returnedSession =
        readQueryValue(
          parsedUrl.queryParams?.session as
            | string
            | string[]
            | undefined
        ) || paymentSession.sessionToken;

      const returnedStatus = readQueryValue(
        parsedUrl.queryParams?.status as
          | string
          | string[]
          | undefined
      );

      const returnedMessage = readQueryValue(
        parsedUrl.queryParams?.message as
          | string
          | string[]
          | undefined
      );

      if (
        returnedStatus === "failed" ||
        returnedStatus === "cancelled"
      ) {
        dismissOnlinePaymentSession();
        setBrowserMessage(
          returnedMessage ||
            (returnedStatus === "cancelled"
              ? "Payment was cancelled."
              : "Payment failed. Please use another payment method.")
        );
        return;
      }

      const order = await completeOnlinePayment(returnedSession);

      if (order) {
        router.replace({
          pathname: "/order-success",
          params: { orderId: order._id },
        });
        return;
      }

      setBrowserMessage(
        returnedMessage ||
          "Payment confirmation is still processing. Please check again."
      );
    } catch (paymentError) {
      dismissOnlinePaymentSession();

      const message =
        paymentError instanceof Error
          ? paymentError.message
          : "Unable to open Razorpay Checkout.";

      setBrowserMessage(message);
      Alert.alert("Online payment", message);
    }
  };

  if (authLoading || !checkoutReady) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#245C42" />
          <Text style={styles.loadingText}>
            Restoring checkout details
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!pendingCheckout) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons
              name="receipt-outline"
              size={36}
              color="#35694E"
            />
          </View>

          <Text style={styles.emptyTitle}>
            Checkout details unavailable
          </Text>

          <Text style={styles.emptyDescription}>
            Return to your cart and enter your delivery information
            again.
          </Text>

          <Pressable
            onPress={() => router.replace("/cart")}
            style={({ pressed }) => [
              styles.primaryAction,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryActionText}>
              Return to cart
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable
            onPress={handleBack}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name="arrow-back"
              size={22}
              color="#203128"
            />
          </Pressable>
          <Text style={styles.headerTitle}>Payment</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.centerContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons
              name="person-outline"
              size={37}
              color="#35694E"
            />
          </View>

          <Text style={styles.emptyTitle}>
            Log in to place your order
          </Text>
          <Text style={styles.emptyDescription}>
            Your cart, coupon and delivery details will remain
            available after login.
          </Text>

          <Pressable
            onPress={() => router.push("/login")}
            style={({ pressed }) => [
              styles.primaryAction,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryActionText}>Log in</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/register")}
            style={({ pressed }) => [
              styles.secondaryAction,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.secondaryActionText}>
              Create account
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          disabled={placingOrder}
          onPress={handleBack}
          style={({ pressed }) => [
            styles.backButton,
            placingOrder && styles.disabledButton,
            pressed && !placingOrder && styles.pressed,
          ]}
        >
          <Ionicons
            name="arrow-back"
            size={22}
            color="#203128"
          />
        </Pressable>

        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Choose payment</Text>
          <Text style={styles.headerSubtitle}>
            Complete your bottle order
          </Text>
        </View>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.progressContainer}>
          <View style={styles.completeStep}>
            <Ionicons
              name="checkmark"
              size={15}
              color="#FFFFFF"
            />
          </View>
          <View style={styles.progressLine} />
          <View style={styles.completeStep}>
            <Ionicons
              name="checkmark"
              size={15}
              color="#FFFFFF"
            />
          </View>
          <View style={styles.progressLine} />
          <View style={styles.currentStep}>
            <Text style={styles.currentStepText}>3</Text>
          </View>
        </View>

        <InfoCard
          icon="location-outline"
          title="Delivery address"
          lines={[
            pendingCheckout.fullName,
            `${pendingCheckout.houseDetails}, ${pendingCheckout.areaDetails}`,
            ...(pendingCheckout.landmark
              ? [`Near ${pendingCheckout.landmark}`]
              : []),
            `${pendingCheckout.area}, ${pendingCheckout.city} – ${pendingCheckout.pincode}`,
            `+91 ${pendingCheckout.phone}`,
          ]}
        />

        <InfoCard
          icon="time-outline"
          title="Delivery schedule"
          lines={[
            pendingCheckout.deliveryDateLabel,
            pendingCheckout.deliverySlot,
          ]}
        />

        {pendingCheckout.couponCode ? (
          <View style={styles.couponCard}>
            <View style={styles.couponIcon}>
              <Ionicons
                name="pricetag-outline"
                size={20}
                color="#FFFFFF"
              />
            </View>

            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>
                Coupon {pendingCheckout.couponCode}
              </Text>
              <Text style={styles.cardDescription}>
                Saving ₹{pendingCheckout.couponDiscount}. The backend
                will validate the coupon again before payment.
              </Text>
            </View>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Payment method</Text>

        <PaymentOption
          title="Cash on delivery"
          description="Pay when your bottles are delivered"
          icon="cash-outline"
          selected={selectedMethod === "cod"}
          onPress={() => {
            clearError();
            setBrowserMessage(null);
            setSelectedMethod("cod");
          }}
        />

        <PaymentOption
          title="Pay securely with Razorpay"
          description="UPI, cards, net banking and supported wallets"
          icon="shield-checkmark-outline"
          selected={selectedMethod === "online"}
          onPress={() => {
            clearError();
            setBrowserMessage(null);
            setSelectedMethod("online");
          }}
        />

        {selectedMethod === "online" ? (
          <View style={styles.infoNotice}>
            <Ionicons
              name="lock-closed-outline"
              size={19}
              color="#35694E"
            />
            <Text style={styles.infoNoticeText}>
              Razorpay Checkout opens securely. Failed or cancelled
              payments will not clear your cart or coupon.
            </Text>
          </View>
        ) : null}

        {error || browserMessage ? (
          <View style={styles.errorCard}>
            <Ionicons
              name="alert-circle-outline"
              size={19}
              color="#A34848"
            />
            <Text style={styles.errorText}>
              {browserMessage || error}
            </Text>
          </View>
        ) : null}

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Order summary</Text>

          <SummaryRow
            label="Bottle total"
            value={`₹${pendingCheckout.subtotal}`}
          />

          <SummaryRow
            label="Delivery fee"
            value={
              pendingCheckout.deliveryFee === 0
                ? "Free"
                : `₹${pendingCheckout.deliveryFee}`
            }
          />

          {pendingCheckout.couponDiscount > 0 ? (
            <SummaryRow
              label={`Coupon (${pendingCheckout.couponCode})`}
              value={`− ₹${pendingCheckout.couponDiscount}`}
              saving
            />
          ) : null}

          <View style={styles.summaryDivider} />

          <SummaryRow
            label="Total"
            value={`₹${pendingCheckout.total}`}
            total
          />
        </View>

        <View style={styles.secureNotice}>
          <Ionicons
            name="shield-checkmark-outline"
            size={20}
            color="#35694E"
          />
          <Text style={styles.secureNoticeText}>
            Prices, coupon eligibility, delivery charges and stock are
            checked again by the backend.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <View>
          <Text style={styles.bottomLabel}>Total</Text>
          <Text style={styles.bottomAmount}>
            ₹{pendingCheckout.total}
          </Text>
        </View>

        <Pressable
          disabled={placingOrder}
          onPress={() => void handlePlaceOrder()}
          style={({ pressed }) => [
            styles.placeOrderButton,
            placingOrder && styles.placeOrderDisabled,
            pressed && !placingOrder && styles.pressed,
          ]}
        >
          {placingOrder ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.placeOrderText}>
                {selectedMethod === "online"
                  ? `Pay ₹${pendingCheckout.total}`
                  : "Place COD order"}
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

function InfoCard({
  icon,
  title,
  lines,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  lines: string[];
}) {
  return (
    <View style={styles.addressCard}>
      <View style={styles.cardIcon}>
        <Ionicons
          name={icon}
          size={21}
          color="#35694E"
        />
      </View>

      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{title}</Text>
        {lines.map((line, index) => (
          <Text key={`${line}-${index}`} style={styles.cardDescription}>
            {line}
          </Text>
        ))}
      </View>
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
      style={({ pressed }) => [
        styles.paymentOption,
        selected && styles.paymentOptionSelected,
        pressed && styles.pressed,
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

      <View
        style={[
          styles.radioOuter,
          selected && styles.radioOuterSelected,
        ]}
      >
        {selected ? <View style={styles.radioInner} /> : null}
      </View>
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
      <Text style={total ? styles.totalLabel : styles.summaryLabel}>
        {label}
      </Text>
      <Text
        style={[
          total ? styles.totalValue : styles.summaryValue,
          saving && styles.savingValue,
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
  disabledButton: { opacity: 0.5 },
  headerText: { flex: 1, alignItems: "center" },
  headerTitle: { color: "#19251E", fontSize: 17, fontWeight: "800" },
  headerSubtitle: { color: "#77807B", fontSize: 9, marginTop: 3 },
  headerSpacer: { width: 44 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 140 },
  progressContainer: { marginVertical: 15, flexDirection: "row", alignItems: "center" },
  completeStep: { width: 31, height: 31, borderRadius: 16, backgroundColor: "#245C42", alignItems: "center", justifyContent: "center" },
  currentStep: { width: 31, height: 31, borderRadius: 16, borderWidth: 2, borderColor: "#245C42", backgroundColor: "#E4EFE7", alignItems: "center", justifyContent: "center" },
  currentStepText: { color: "#245C42", fontSize: 11, fontWeight: "900" },
  progressLine: { flex: 1, height: 2, backgroundColor: "#245C42" },
  addressCard: { padding: 16, borderRadius: 21, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E8E3", flexDirection: "row", marginBottom: 11 },
  couponCard: { padding: 16, borderRadius: 21, backgroundColor: "#E7F2E9", borderWidth: 1, borderColor: "#D3E6D7", flexDirection: "row", marginBottom: 11 },
  cardIcon: { width: 43, height: 43, borderRadius: 14, backgroundColor: "#E5EFE7", alignItems: "center", justifyContent: "center" },
  couponIcon: { width: 43, height: 43, borderRadius: 14, backgroundColor: "#34714F", alignItems: "center", justifyContent: "center" },
  cardContent: { flex: 1, marginLeft: 12 },
  cardTitle: { color: "#26382E", fontSize: 12, fontWeight: "800", marginBottom: 5 },
  cardDescription: { color: "#6E7972", fontSize: 10, lineHeight: 15 },
  sectionTitle: { color: "#1D2922", fontSize: 15, fontWeight: "900", marginTop: 12, marginBottom: 11 },
  paymentOption: { padding: 15, borderRadius: 19, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E3E7E1", flexDirection: "row", alignItems: "center", marginBottom: 10 },
  paymentOptionSelected: { borderColor: "#245C42", backgroundColor: "#EDF5EF" },
  paymentIcon: { width: 45, height: 45, borderRadius: 15, backgroundColor: "#E6EFE8", alignItems: "center", justifyContent: "center" },
  paymentIconSelected: { backgroundColor: "#245C42" },
  paymentContent: { flex: 1, marginLeft: 12 },
  paymentTitle: { color: "#26352D", fontSize: 12, fontWeight: "800" },
  paymentDescription: { color: "#758079", fontSize: 9, lineHeight: 14, marginTop: 4 },
  radioOuter: { width: 21, height: 21, borderRadius: 11, borderWidth: 2, borderColor: "#AAB4AD", alignItems: "center", justifyContent: "center" },
  radioOuterSelected: { borderColor: "#245C42" },
  radioInner: { width: 11, height: 11, borderRadius: 6, backgroundColor: "#245C42" },
  infoNotice: { padding: 13, borderRadius: 16, backgroundColor: "#E8F0EA", flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 12 },
  infoNoticeText: { flex: 1, color: "#55675C", fontSize: 9, lineHeight: 15 },
  errorCard: { padding: 13, borderRadius: 16, backgroundColor: "#FAECEC", flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 12 },
  errorText: { flex: 1, color: "#934545", fontSize: 10, lineHeight: 15 },
  summaryCard: { padding: 18, borderRadius: 23, backgroundColor: "#E8F0EA", marginTop: 5 },
  summaryTitle: { color: "#294534", fontSize: 14, fontWeight: "900", marginBottom: 15 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 11 },
  summaryLabel: { color: "#607067", fontSize: 11 },
  summaryValue: { color: "#294534", fontSize: 11, fontWeight: "700" },
  savingValue: { color: "#34714F" },
  summaryDivider: { height: 1, backgroundColor: "#D3E0D6", marginBottom: 11 },
  totalLabel: { color: "#233C2E", fontSize: 13, fontWeight: "900" },
  totalValue: { color: "#233C2E", fontSize: 17, fontWeight: "900" },
  secureNotice: { padding: 14, flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  secureNoticeText: { flex: 1, color: "#6B7770", fontSize: 9, lineHeight: 15 },
  bottomBar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 13, paddingBottom: 24, backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: "#E5E8E3", flexDirection: "row", alignItems: "center" },
  bottomLabel: { color: "#78817C", fontSize: 9 },
  bottomAmount: { color: "#1D2922", fontSize: 18, fontWeight: "900", marginTop: 2 },
  placeOrderButton: { flex: 1, minHeight: 54, borderRadius: 18, backgroundColor: "#245C42", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginLeft: 25 },
  placeOrderDisabled: { backgroundColor: "#91A69A" },
  placeOrderText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  centerContainer: { flex: 1, paddingHorizontal: 32, alignItems: "center", justifyContent: "center" },
  loadingText: { color: "#607067", fontSize: 12, marginTop: 14 },
  emptyIcon: { width: 82, height: 82, borderRadius: 27, backgroundColor: "#E5EFE7", alignItems: "center", justifyContent: "center" },
  emptyTitle: { color: "#1D2922", fontSize: 20, fontWeight: "900", textAlign: "center", marginTop: 20 },
  emptyDescription: { color: "#727D76", fontSize: 12, lineHeight: 19, textAlign: "center", marginTop: 8 },
  primaryAction: { width: "100%", maxWidth: 340, minHeight: 52, borderRadius: 17, backgroundColor: "#245C42", alignItems: "center", justifyContent: "center", marginTop: 22 },
  primaryActionText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  secondaryAction: { width: "100%", maxWidth: 340, minHeight: 52, borderRadius: 17, backgroundColor: "#E8EEE8", alignItems: "center", justifyContent: "center", marginTop: 10 },
  secondaryActionText: { color: "#245C42", fontSize: 12, fontWeight: "800" },
  pressed: { opacity: 0.84, transform: [{ scale: 0.98 }] },
});
