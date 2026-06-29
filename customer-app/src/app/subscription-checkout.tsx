import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useSubscriptions } from "../context/SubscriptionContext";
import { useServiceablePincode } from "../hooks/useServiceablePincode";

type FormInputProps = {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: "default" | "phone-pad" | "number-pad";
  maxLength?: number;
  multiline?: boolean;
};

function FormInput({
  label,
  placeholder,
  value,
  onChangeText,
  keyboardType = "default",
  maxLength,
  multiline = false,
}: FormInputProps) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#A0A7A3"
        keyboardType={keyboardType}
        maxLength={maxLength}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        style={[
          styles.input,
          multiline && styles.multilineInput,
        ]}
      />
    </View>
  );
}

export default function SubscriptionCheckoutScreen() {
  const router = useRouter();

  const {
    pendingSubscriptionDraft,
    applyingCoupon,
    couponError,
    getPlanById,
    saveSubscriptionDeliveryDetails,
    applySubscriptionCoupon,
    removeSubscriptionCoupon,
  } = useSubscriptions();

  const {
    checking: checkingPincode,
    checked: pincodeChecked,
    location: serviceableLocation,
    message: pincodeMessage,
    requestError: pincodeRequestError,
    checkPincode,
    resetPincodeCheck,
  } = useServiceablePincode();

  const plan = pendingSubscriptionDraft
    ? getPlanById(pendingSubscriptionDraft.planId)
    : undefined;

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [pincode, setPincode] = useState("");
  const [houseDetails, setHouseDetails] = useState("");
  const [areaDetails, setAreaDetails] = useState("");
  const [landmark, setLandmark] = useState("");
  const [couponInput, setCouponInput] = useState("");

  const cleanPhone = phone.replace(/\D/g, "");

  const addressIsComplete =
    fullName.trim().length >= 2 &&
    cleanPhone.length === 10 &&
    houseDetails.trim().length >= 3 &&
    areaDetails.trim().length >= 3;

  const amountBeforeCoupon =
    pendingSubscriptionDraft?.amountBeforeCoupon ??
    pendingSubscriptionDraft?.total ??
    0;

  const meetsMinimumOrder = Boolean(
    serviceableLocation &&
      pendingSubscriptionDraft &&
      amountBeforeCoupon >= serviceableLocation.minimumOrder
  );

  const canContinue = Boolean(
    pendingSubscriptionDraft &&
      plan &&
      serviceableLocation &&
      addressIsComplete &&
      meetsMinimumOrder &&
      !checkingPincode &&
      !applyingCoupon
  );

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/(tabs)/plans");
  };

  const handlePincodeChange = (value: string) => {
    setPincode(value.replace(/\D/g, ""));
    resetPincodeCheck();
  };

  const handleCheckPincode = async () => {
    if (pincode.length !== 6) {
      Alert.alert(
        "Enter a valid pincode",
        "Please enter a six-digit delivery pincode."
      );
      return;
    }

    await checkPincode(pincode);
  };

  const handleApplyCoupon = async () => {
    const applied = await applySubscriptionCoupon(couponInput);

    if (applied && pendingSubscriptionDraft?.couponCode) {
      setCouponInput(pendingSubscriptionDraft.couponCode);
    }
  };

  const handleContinue = () => {
    if (!canContinue || !serviceableLocation) return;

    const saved = saveSubscriptionDeliveryDetails({
      fullName: fullName.trim(),
      phone: cleanPhone,
      pincode,
      houseDetails: houseDetails.trim(),
      areaDetails: areaDetails.trim(),
      landmark: landmark.trim(),
      area: serviceableLocation.area,
      city: serviceableLocation.city,
    });

    if (saved) {
      router.push("/subscription-payment");
    }
  };

  if (!pendingSubscriptionDraft || !plan) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyContainer}>
          <Ionicons
            name="repeat-outline"
            size={40}
            color="#35694E"
          />
          <Text style={styles.emptyTitle}>
            Plan details unavailable
          </Text>
          <Pressable
            onPress={() => router.replace("/(tabs)/plans")}
            style={styles.returnButton}
          >
            <Text style={styles.returnButtonText}>View plans</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const couponDiscount =
    pendingSubscriptionDraft.couponDiscount ?? 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Ionicons
              name="arrow-back"
              size={22}
              color="#203128"
            />
          </Pressable>

          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>
              Subscription delivery
            </Text>
            <Text style={styles.headerSubtitle}>
              Address, coupon and availability
            </Text>
          </View>

          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.planCard}>
            <Ionicons
              name="repeat-outline"
              size={24}
              color="#35694E"
            />

            <View style={styles.planContent}>
              <Text style={styles.planName}>{plan.name}</Text>
              <Text style={styles.planDetails}>
                {plan.bottleCount} bottles ·{" "}
                {pendingSubscriptionDraft.preferredDay}
              </Text>
            </View>

            <Text style={styles.planPrice}>
              ₹{pendingSubscriptionDraft.total}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Check delivery availability
            </Text>

            <View style={styles.pincodeRow}>
              <TextInput
                value={pincode}
                onChangeText={handlePincodeChange}
                placeholder="Enter 6-digit pincode"
                placeholderTextColor="#A0A7A3"
                keyboardType="number-pad"
                maxLength={6}
                style={styles.pincodeInput}
              />

              <Pressable
                disabled={checkingPincode}
                onPress={() => void handleCheckPincode()}
                style={[
                  styles.checkButton,
                  checkingPincode && styles.checkButtonDisabled,
                ]}
              >
                <Text style={styles.checkButtonText}>
                  {checkingPincode ? "Checking..." : "Check"}
                </Text>
              </Pressable>
            </View>

            {pincodeChecked && serviceableLocation ? (
              <View style={styles.availableCard}>
                <Ionicons
                  name="checkmark-circle"
                  size={22}
                  color="#34714F"
                />
                <View style={styles.statusContent}>
                  <Text style={styles.availableTitle}>
                    Delivery available
                  </Text>
                  <Text style={styles.statusDescription}>
                    {serviceableLocation.area},{" "}
                    {serviceableLocation.city}
                  </Text>
                </View>
              </View>
            ) : null}

            {pincodeChecked && !serviceableLocation ? (
              <View style={styles.unavailableCard}>
                <Ionicons
                  name={
                    pincodeRequestError
                      ? "cloud-offline-outline"
                      : "close-circle-outline"
                  }
                  size={22}
                  color="#A34848"
                />
                <View style={styles.statusContent}>
                  <Text style={styles.unavailableTitle}>
                    {pincodeRequestError
                      ? "Unable to check pincode"
                      : "Delivery unavailable"}
                  </Text>
                  <Text style={styles.statusDescription}>
                    {pincodeMessage}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery address</Text>

            <FormInput
              label="Full name"
              placeholder="Enter customer name"
              value={fullName}
              onChangeText={setFullName}
            />
            <FormInput
              label="Mobile number"
              placeholder="10-digit mobile number"
              value={phone}
              onChangeText={(value) =>
                setPhone(value.replace(/\D/g, ""))
              }
              keyboardType="phone-pad"
              maxLength={10}
            />
            <FormInput
              label="House, flat or building"
              placeholder="Flat or building details"
              value={houseDetails}
              onChangeText={setHouseDetails}
            />
            <FormInput
              label="Area and street"
              placeholder="Area or street"
              value={areaDetails}
              onChangeText={setAreaDetails}
              multiline
            />
            <FormInput
              label="Landmark (optional)"
              placeholder="Nearby landmark"
              value={landmark}
              onChangeText={setLandmark}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Coupon code</Text>
            <Text style={styles.sectionDescription}>
              Subscription coupons apply to the first billing cycle only.
              Future cycles continue at the normal plan-discounted price.
            </Text>

            {pendingSubscriptionDraft.couponCode ? (
              <View style={styles.appliedCouponCard}>
                <View style={styles.couponIcon}>
                  <Ionicons
                    name="pricetag-outline"
                    size={19}
                    color="#FFFFFF"
                  />
                </View>

                <View style={styles.couponContent}>
                  <Text style={styles.couponCode}>
                    {pendingSubscriptionDraft.couponCode}
                  </Text>
                  <Text style={styles.couponDescription}>
                    First-cycle saving ₹{couponDiscount}
                  </Text>
                </View>

                <Pressable
                  onPress={() => {
                    removeSubscriptionCoupon();
                    setCouponInput("");
                  }}
                >
                  <Text style={styles.removeCouponText}>Remove</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.couponRow}>
                <TextInput
                  value={couponInput}
                  onChangeText={(value) =>
                    setCouponInput(value.toUpperCase())
                  }
                  placeholder="Enter promo code"
                  placeholderTextColor="#A0A7A3"
                  autoCapitalize="characters"
                  editable={!applyingCoupon}
                  style={styles.couponInput}
                />

                <Pressable
                  disabled={applyingCoupon}
                  onPress={() => void handleApplyCoupon()}
                  style={[
                    styles.applyCouponButton,
                    applyingCoupon && styles.checkButtonDisabled,
                  ]}
                >
                  <Text style={styles.applyCouponText}>
                    {applyingCoupon ? "Applying..." : "Apply"}
                  </Text>
                </Pressable>
              </View>
            )}

            {couponError ? (
              <Text style={styles.couponError}>{couponError}</Text>
            ) : null}
          </View>

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
              label="First cycle total"
              value={`₹${pendingSubscriptionDraft.total}`}
              total
            />
            {couponDiscount > 0 ? (
              <Text style={styles.recurringNote}>
                Future cycles: ₹{amountBeforeCoupon}
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
            disabled={!canContinue}
            onPress={handleContinue}
            style={[
              styles.continueButton,
              !canContinue && styles.continueDisabled,
            ]}
          >
            <Text style={styles.continueText}>
              Continue to payment
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  keyboardView: { flex: 1 },
  header: { paddingHorizontal: 20, paddingVertical: 12, flexDirection: "row", alignItems: "center" },
  backButton: { width: 44, height: 44, borderRadius: 16, backgroundColor: "#E9ECE6", alignItems: "center", justifyContent: "center" },
  headerText: { flex: 1, alignItems: "center" },
  headerTitle: { color: "#19251E", fontSize: 17, fontWeight: "800" },
  headerSubtitle: { color: "#77807B", fontSize: 9, marginTop: 3 },
  headerSpacer: { width: 44 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 145 },
  planCard: { padding: 16, borderRadius: 21, backgroundColor: "#E8F0EA", flexDirection: "row", alignItems: "center", marginTop: 10, marginBottom: 14 },
  planContent: { flex: 1, marginLeft: 11 },
  planName: { color: "#294534", fontSize: 12, fontWeight: "900" },
  planDetails: { color: "#637168", fontSize: 9, marginTop: 4 },
  planPrice: { color: "#244332", fontSize: 16, fontWeight: "900" },
  section: { padding: 18, borderRadius: 24, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E7EAE5", marginBottom: 14 },
  sectionTitle: { color: "#1D2922", fontSize: 15, fontWeight: "900", marginBottom: 15 },
  sectionDescription: { color: "#727B76", fontSize: 9, lineHeight: 15, marginTop: -6, marginBottom: 15 },
  pincodeRow: { flexDirection: "row", gap: 9 },
  pincodeInput: { flex: 1, height: 52, borderRadius: 16, paddingHorizontal: 15, backgroundColor: "#F2F4EF", borderWidth: 1, borderColor: "#E2E5DF", color: "#1D2922" },
  checkButton: { width: 96, height: 52, borderRadius: 16, backgroundColor: "#245C42", alignItems: "center", justifyContent: "center" },
  checkButtonDisabled: { backgroundColor: "#91A69A" },
  checkButtonText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" },
  availableCard: { padding: 13, borderRadius: 16, backgroundColor: "#E8F3EA", flexDirection: "row", alignItems: "center", marginTop: 12 },
  unavailableCard: { padding: 13, borderRadius: 16, backgroundColor: "#FAECEC", flexDirection: "row", alignItems: "center", marginTop: 12 },
  statusContent: { flex: 1, marginLeft: 10 },
  availableTitle: { color: "#285C42", fontSize: 10, fontWeight: "800" },
  unavailableTitle: { color: "#963F3F", fontSize: 10, fontWeight: "800" },
  statusDescription: { color: "#68736C", fontSize: 9, marginTop: 3 },
  inputGroup: { marginBottom: 14 },
  inputLabel: { color: "#4E5A53", fontSize: 10, fontWeight: "700", marginBottom: 7 },
  input: { minHeight: 51, borderRadius: 16, paddingHorizontal: 15, backgroundColor: "#F2F4EF", borderWidth: 1, borderColor: "#E2E5DF", color: "#1D2922" },
  multilineInput: { minHeight: 82, paddingTop: 14 },
  couponRow: { flexDirection: "row", gap: 9 },
  couponInput: { flex: 1, minHeight: 51, borderRadius: 16, paddingHorizontal: 15, backgroundColor: "#F2F4EF", borderWidth: 1, borderColor: "#E2E5DF", color: "#1D2922", fontWeight: "800", letterSpacing: 0.5 },
  applyCouponButton: { width: 94, minHeight: 51, borderRadius: 16, backgroundColor: "#245C42", alignItems: "center", justifyContent: "center" },
  applyCouponText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  appliedCouponCard: { padding: 13, borderRadius: 17, backgroundColor: "#E7F2E9", flexDirection: "row", alignItems: "center" },
  couponIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#34714F", alignItems: "center", justifyContent: "center" },
  couponContent: { flex: 1, marginLeft: 11 },
  couponCode: { color: "#285C42", fontSize: 11, fontWeight: "900" },
  couponDescription: { color: "#5D7264", fontSize: 9, marginTop: 3 },
  removeCouponText: { color: "#9A4646", fontSize: 9, fontWeight: "800" },
  couponError: { color: "#A34848", fontSize: 9, lineHeight: 14, marginTop: 10 },
  summaryCard: { padding: 18, borderRadius: 24, backgroundColor: "#E8F0EA" },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 11 },
  summaryLabel: { color: "#607067", fontSize: 10 },
  summaryValue: { color: "#294534", fontSize: 11, fontWeight: "700" },
  savingValue: { color: "#34714F" },
  divider: { height: 1, backgroundColor: "#D3E0D6", marginBottom: 11 },
  totalLabel: { color: "#233C2E", fontWeight: "900" },
  totalValue: { color: "#233C2E", fontSize: 16, fontWeight: "900" },
  recurringNote: { color: "#5F6F66", fontSize: 9, lineHeight: 14, marginTop: 1 },
  bottomBar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 13, paddingBottom: 24, backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: "#E5E8E3", flexDirection: "row", alignItems: "center" },
  bottomLabel: { color: "#78817C", fontSize: 9 },
  bottomAmount: { color: "#1D2922", fontSize: 18, fontWeight: "900", marginTop: 2 },
  continueButton: { flex: 1, minHeight: 53, borderRadius: 18, backgroundColor: "#245C42", alignItems: "center", justifyContent: "center", marginLeft: 25 },
  continueDisabled: { backgroundColor: "#AAB7AE" },
  continueText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyTitle: { color: "#203128", fontSize: 19, fontWeight: "900", marginTop: 15 },
  returnButton: { minHeight: 48, paddingHorizontal: 25, borderRadius: 16, backgroundColor: "#245C42", justifyContent: "center", marginTop: 18 },
  returnButtonText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
});
